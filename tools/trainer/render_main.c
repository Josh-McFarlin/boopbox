/* SPDX-License-Identifier: GPL-3.0-only */
/* The trainer's song renderer (tools/trainer/render.py writes the songs below this file): the firmware's sequencer,
 * engines, mixer and song mode on the host, as tests/song_audio_test.c and tests/tracks8_test.c run them. */
#define FELUCCA_ARRANGER 1
#define main hostsim_main
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"
static struct { uint8_t force; } ui;
static uint8_t sync_reload;
#include "../firmware/src/arranger_scene.c"

static int fails;

static void reset(uint32_t bpm)                  /* as tests/tracks8_test.c: the power-on project, empty patterns */
{
    uint32_t i;
    memset(trk, 0, sizeof trk);
    memset(eng_arena_trk, 0, sizeof eng_arena_trk);
    memset(eng_arena_own, 0, sizeof eng_arena_own);
    memset(sl_buf_trk, 0, sizeof sl_buf_trk);
    memset(&drums, 0, sizeof drums);
    drums.set = 0;
    host_tracks_init();
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
    song.g[G_BPM] = (int16_t)bpm;
    song.rec = 0, song.solo = 0, song.sel = 0;
    harm_defaults();
}

static void synth(uint32_t k, const char *name)
{
    uint32_t e, i;
    for (e = 0; e < NENGINES; e++)
        for (i = 0; i < ENGINES[e]->npresets; i++)
            if (!strcmp(ENGINES[e]->presets[i].name, name)) {
                host_preset(&trk[k], e, i);
                return;
            }
    printf("  no sound %s\n", name);
    fails++;
}
static void kit(uint32_t k, const char *name)
{
    uint32_t i;
    for (i = 0; i < DRUM_KITS; i++)
        if (!strcmp(DRUM_KIT_NAMES[i], name)) {
            trk[k].p[P_E0] = (int16_t)i;
            return;
        }
    printf("  no kit %s\n", name);
    fails++;
}
static void note(uint32_t k, uint32_t i, uint32_t flags, uint32_t lvl, uint32_t n, int a, int b, int c, int d)
{
    step_t *s = &trk[k].step[i];
    uint32_t j;
    memset(s, 0, sizeof *s);
    s->n = (uint8_t)n;
    s->note[0] = (uint8_t)a, s->note[1] = (uint8_t)b, s->note[2] = (uint8_t)c, s->note[3] = (uint8_t)d;
    s->time = ST_NOTE;
    s->flags = (uint8_t)flags;
    s->vel = 100;
    for (j = 0; j < n; j++)
        s->lvl |= (uint8_t)(lvl << (2u * j));
}
static void tie(uint32_t k, uint32_t i)
{
    memset(&trk[k].step[i], 0, sizeof trk[k].step[i]);
    trk[k].step[i].time = ST_TIE;
}
static void lk(uint32_t k, uint32_t step, uint32_t param, int32_t v, int slide)
{
    if (!lock_set(&trk[k], step, param, v) || (slide && !lock_slide_set(&trk[k], step, param, 1))) {
        printf("  track %u: lock on step %u refused\n", k + 1, step + 1);
        fails++;
    }
}
static void cp(uint32_t k, uint32_t step, uint32_t type, int a, int b)
{
    uint32_t i;
    for (i = 0; i < NCOMP; i++)
        if (trk[k].comp[i].type == CP_NONE) {
            trk[k].comp[i] = (comp_t){(uint8_t)step, (uint8_t)type, (int8_t)a, (int8_t)b};
            return;
        }
    printf("  track %u: no component left\n", k + 1);
    fails++;
}
static void fillc(uint32_t k, uint32_t step, uint32_t fc)
{
    uint32_t sh = (step & 3u) * 2u;
    trk[k].fill[step / 4u] = (uint8_t)((trk[k].fill[step / 4u] & ~(3u << sh)) | (fc << sh));
}
static void check_capture(uint32_t slot)
{
    if (!proj_capture(&proj_slot[slot])) {
        printf("  section %c does not fit a project\n", 'A' + slot);
        fails++;
    } else
        printf("  section %c: %u bytes\n", 'A' + slot, proj_slot[slot].size);
}

/* the song in song mode, bars of it; the mix to f; the health of it to log */
static void play(FILE *f, FILE *log, uint32_t bars)
{
    static int32_t out[CTL * 2];
    uint32_t frames = (uint32_t)((uint64_t)bars * 4u * 60u * FS / (uint32_t)song.g[G_BPM]) + FS * 3u, fr, i;
    uint32_t full = 0, peak = 0, clip = 0, vmax = 0, tmax[NTRK] = {0}, kills = 0, nb = 0;
    uint64_t sq = 0, tsum[NTRK] = {0}, tpk[NTRK] = {0}, tpn[NTRK] = {0};
    uint8_t was4[NTRK][NVOICE] = {{0}};
    proj_apply(&proj_slot[arrangement.entry[0].scene], 1);
    arrangement_enabled = 1;
    transport_req = 1;
    frames = frames / CTL * CTL;
    wav_hdr(f, frames);
    for (fr = 0; fr < frames; fr += CTL) {
        uint32_t b;
        mix_block(out, CTL);
        b = voices_busy();
        nb++;
        for (i = 0; i < NTRK; i++) {
            uint32_t j, n = 0;
            for (j = 0; j < NVOICE; j++) {
                uint32_t k4 = trk[i].v[j].active && trk[i].v[j].stage == 4u;
                n += trk[i].v[j].active && trk[i].v[j].stage != 4u;
                kills += k4 && !was4[i][j];
                was4[i][j] = (uint8_t)k4;
            }
            tmax[i] = n > tmax[i] ? n : tmax[i];
            if (trk[i].peak > 64) tpk[i] += (uint64_t)trk[i].peak, tpn[i]++;
            trk[i].peak = 0;
            tsum[i] += n;
        }
        vmax = b > vmax ? b : vmax;
        full += b >= NVOICE;
        for (i = 0; i < CTL * 2u; i++) {
            int32_t s = out[i] < 0 ? -out[i] : out[i];
            peak = (uint32_t)s > peak ? (uint32_t)s : peak;
            clip += s >= 32767;
            sq += (uint64_t)((int64_t)out[i] * out[i]);
        }
        for (i = 0; i < CTL; i++)
            wav_put(f, out[i * 2], out[i * 2 + 1]);
    }
    if (song.playing) {
        transport_req = 2;
        mix_block(out, CTL);
    }
    fprintf(log, "  %u bars, %.1f s: peak %.1f dBFS, rms %.1f dBFS, %u clipped samples; synth voices: at most %u, "
            "%u blocks at the budget of %u\n", bars, frames / (double)FS, 20 * log10(peak / 32768.0 + 1e-9),
            10 * log10(sq / (double)(frames * 2u) / (32768.0 * 32768.0) + 1e-12), clip, vmax, full, NVOICE);
    fprintf(log, "  voices given up (stolen or ended early): %u; per track max/mean:", kills);
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i]))
            fprintf(log, " T%u %u/%.1f", i + 1, tmax[i], tsum[i] / (double)nb);
    fprintf(log, "\n  track level (mean block peak while sounding):");
    for (i = 0; i < NTRK; i++)
        if (tpn[i])
            fprintf(log, " T%u %.1f dB", i + 1, 20 * log10(tpk[i] / (double)tpn[i] / 32768.0));
    fprintf(log, "\n");
}
