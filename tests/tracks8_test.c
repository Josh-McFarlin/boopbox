/* SPDX-License-Identifier: GPL-3.0-only */
/* Eight tracks (core.h NTRK): every track plays at once on its own length; the synth tracks share one budget of NVOICE
 * voices (the bass of each kept), the drum tracks one pool (each voice its track's: level, mute, choke); a track
 * changes kind while the transport runs (nothing left sounding); the engine arenas and the SLICER's STUT buffers are
 * lent, a fifth asker waits or plays live; MIDI channels CH5..CH8 in and out; the selected track changes without
 * touching the others; the cost of eight busy tracks against four (host timing: not the FM-1's).
 *   cc -O2 -DARENA_STATS -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/tracks8_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

static int fails;
static void check(int ok, const char *what)
{
    printf("tracks8: %-96s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}

static void reset(uint32_t bpm)
{
    uint32_t i;
    memset(trk, 0, sizeof trk);
    memset(eng_arena_trk, 0, sizeof eng_arena_trk);
    memset(eng_arena_own, 0, sizeof eng_arena_own);
    memset(sl_buf_trk, 0, sizeof sl_buf_trk);
    memset(&drums, 0, sizeof drums);
    drums.set = -2;
    host_tracks_init();
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
    song.g[G_BPM] = (int16_t)bpm;
    song.rec = 0, song.solo = 0, song.sel = 0;
    rec_wait = 0;
    fm1_in.notes = fm1_in.buttons = 0;
    kb_prev = 0;
    mi_r = mi_w;
    memset(live_held, 0, sizeof live_held);
    memset(mi_trk_held, 0, sizeof mi_trk_held);
    memset(drum_mute, 0, sizeof drum_mute);
}

static int32_t out[CTL * 2];
static int32_t pk[NTRK];                           /* each track's peak over the run (its meter, taken every block) */
static uint32_t busy_max, peak_out;
static void block(void)
{
    uint32_t i, b;
    mix_block(out, CTL);
    for (i = 0; i < NTRK; i++) {
        if (trk[i].peak > pk[i])
            pk[i] = trk[i].peak;
        trk[i].peak = 0;
    }
    b = voices_busy();
    if (b > busy_max)
        busy_max = b;
    for (i = 0; i < CTL * 2u; i++) {
        uint32_t a = (uint32_t)(out[i] < 0 ? -out[i] : out[i]);
        if (a > peak_out)
            peak_out = a;
    }
}
static void blocks(uint32_t n)
{
    while (n--)
        block();
}
static uint32_t bars_blocks(uint32_t bars) { return bars * 4u * 60u * FS / ((uint32_t)song.g[G_BPM] * CTL); }
static uint32_t synth_active(const track_t *t)
{
    uint32_t v, n = 0;
    for (v = 0; v < NVOICE; v++)
        n += t->v[v].active;
    return n;
}
static uint32_t drum_active(uint32_t own)
{
    uint32_t v, n = 0;
    for (v = 0; v < NDRUM; v++)
        n += drums.v[v].active && drums.own[v] == own;
    return n;
}
static uint32_t all_active(void)
{
    uint32_t i, n = 0;
    for (i = 0; i < NTRK; i++)
        n += synth_active(&trk[i]) + drum_active(i);
    return n;
}
static void mpush(uint32_t pkt) { midi_in_q[mi_w % MQ] = pkt; mi_w++; }
static void m_on(uint32_t ch, uint32_t n, uint32_t v) { mpush(0x09u | (0x90u | ch) << 8 | n << 16 | v << 24); }
static void m_off(uint32_t ch, uint32_t n) { mpush(0x08u | (0x80u | ch) << 8 | n << 16); }

/* ---- eight tracks at once, each on its own length (polymeter) ---- */
static void t_eight(void)
{
    static const uint8_t LEN[NTRK] = {16, 12, 10, 16, 7, 9, 11, 13};
    uint32_t i, k, ok = 1, phase_ok = 1, n;
    reset(120);
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        t->p[P_SLEN] = LEN[i];
        t->p[P_SDIV] = 2;                          /* 1/16 */
        for (k = 0; k < LEN[i]; k += 2u) {
            uint8_t notes[2] = {(uint8_t)(36u + i * 5u + k), (uint8_t)(48u + i * 3u)};
            uint8_t drum[1] = {(uint8_t)(k % 4u ? 42 : 36)};
            if (is_drum(t))
                put_step(t, k, 1, drum, ST_NOTE, 0);
            else
                put_step(t, k, i == 1u ? 2u : 1u, notes, ST_NOTE, 0);
        }
    }
    memset(pk, 0, sizeof pk);
    busy_max = 0;
    transport_req = 1;
    n = bars_blocks(4);
    for (k = 0; k < n; k++) {
        block();
        for (i = 0; i < NTRK; i++)                 /* the step playing is the grid's step on its own length */
            if (trk[i].seq_abs != SEQ_NONE && trk[i].seq_idx != trk[i].seq_abs % LEN[i])
                phase_ok = 0;
    }
    for (i = 0; i < NTRK; i++)
        ok &= pk[i] > 500;
    check(ok, "eight tracks play together: every one heard (its meter), synths 1-3 5-7, drums 4 and 8");
    check(phase_ok, "each track on its own length (16 12 10 16 7 9 11 13): step = grid step mod LEN, every block");
    check(busy_max <= NVOICE, "the synth voices sounding never pass the shared budget (NVOICE)");
    {
        uint32_t after = trk[4].seq_abs, ok2;
        ok2 = trk[4].seq_abs != SEQ_NONE && trk[0].seq_abs != SEQ_NONE && trk[4].seq_abs == trk[0].seq_abs;
        check(ok2 && after % 7u == trk[4].seq_idx, "all eight on the one transport grid (the same grid step, polymeters in phase)");
    }
    transport_req = 2;
    blocks(2u * FS / CTL);
    check(all_active() == 0u, "STOP: two seconds later nothing sounds on any of the eight tracks");
}

/* ---- the shared voice budget: six synth tracks of four-note chords ---- */
static void t_budget(void)
{
    uint32_t i, k, bass_ok = 1, kills0;
    reset(120);
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i])) {
            uint8_t ch[4] = {(uint8_t)(36u + i), (uint8_t)(55u + i), (uint8_t)(59u + i), (uint8_t)(62u + i)};
            host_preset(&trk[i], 0, 12);               /* ANALOG WARM PAD: POLY, a long release */
            trk[i].p[P_VOICE] = V_POLY;
            trk[i].p[P_SLEN] = 16, trk[i].p[P_SDIV] = 2;
            for (k = 0; k < 16u; k += 4u)
                put_step(&trk[i], k, 4, ch, ST_NOTE, 0);
        }
    busy_max = 0;
    kills0 = voice_kills;
    transport_req = 1;
    for (k = 0; k < bars_blocks(2); k++) {
        block();
        if (k > 8u && k % 23u == 0u)
            for (i = 0; i < NTRK; i++)
                if (!is_drum(&trk[i]) && trk[i].seq_n) {   /* each track's bass (its lowest note) still sounds */
                    uint32_t v, has = 0;
                    for (v = 0; v < NVOICE; v++)
                        has |= trk[i].v[v].active && trk[i].v[v].gate && trk[i].v[v].stage != 4u &&
                               trk[i].v[v].note == 36u + i;
                    bass_ok &= has;
                }
    }
    check(busy_max <= NVOICE && voice_kills > kills0, "24 notes asked of 8 voices: never more than 8 sound, the rest are taken (faded)");
    check(bass_ok, "voice stealing keeps every track's bass (its lowest held note) while the chords run");
    transport_req = 2;
    blocks(4u * FS / CTL);
    check(all_active() == 0u, "after STOP and the releases: no voice left on any track");
}

/* ---- two drum tracks: their own kits, levels, mutes, chokes ---- */
static void t_drums2(void)
{
    uint32_t k, owned = 1, hats4 = 0, hats8, pk4, pk8;
    static const uint8_t KICK[1] = {36}, HAT[1] = {42};
    reset(120);
    trk[3].p[P_SLEN] = 16, trk[7].p[P_SLEN] = 16;
    for (k = 0; k < 16u; k += 4u)
        put_step(&trk[3], k, 1, KICK, ST_NOTE, 0);
    for (k = 0; k < 16u; k += 2u)
        put_step(&trk[7], k, 1, HAT, ST_NOTE, 0);
    memset(pk, 0, sizeof pk);
    transport_req = 1;
    for (k = 0; k < bars_blocks(1); k++) {
        uint32_t v;
        block();
        hats4 |= drums.hits[3] & (1u << lane_of_note(42));
        for (v = 0; v < NDRUM; v++)
            if (drums.v[v].active)
                owned &= (drums.own[v] == 3u && drums.v[v].note == 36u) || (drums.own[v] == 7u && drums.v[v].note == 42u);
    }
    check(pk[3] > 500 && pk[7] > 500 && owned && !hats4, "two drum tracks: each voice its own track's (kicks on 4, hats on 8)");
    trk[7].p[P_LEVEL] = 0;                          /* track 8 silent: only its meter goes down */
    blocks(40);                                     /* (LEVEL glides a quarter of the way a block: from 100 to 0 ~27 blocks) */
    memset(pk, 0, sizeof pk);
    blocks(bars_blocks(1));
    pk4 = (uint32_t)pk[3], pk8 = (uint32_t)pk[7];
    check(pk4 > 500 && pk8 == 0u, "track 8's LEVEL at 0: it is silent, track 4 not");
    trk[7].p[P_LEVEL] = 100;
    drum_mute[7] = (uint16_t)(1u << lane_of_note(42));   /* track 8's hat muted live (EDIT + a black key) */
    drums.hits[7] = 0, drums.hits[3] = 0;
    blocks(bars_blocks(1));
    hats8 = drums.hits[7];
    check(!hats8 && (drums.hits[3] & 1u), "a lane muted on track 8 (its hat): track 8 silent there, track 4's kick plays on");
    drum_mute[7] = 0;
    transport_req = 2;
    blocks(FS / CTL);
    /* the hi-hat choke stays inside a track: track 8's closed hat leaves track 4's open hat ringing */
    trk_note_on(&trk[3], 46, 100);
    blocks(2);
    trk_note_on(&trk[7], 42, 100);
    blocks(2);
    {
        uint32_t v, open4 = 0;
        for (v = 0; v < NDRUM; v++)
            open4 |= drums.v[v].active && drums.v[v].note == 46u && drums.own[v] == 3u;
        check(open4, "the hat choke stays in its track: track 8's closed hat does not choke track 4's open hat");
        trk_note_on(&trk[3], 42, 100);
        blocks(2);
        for (v = 0, open4 = 0; v < NDRUM; v++)
            open4 |= drums.v[v].active && drums.v[v].note == 46u && drums.own[v] == 3u;
        check(!open4, "  .. and track 4's own closed hat does");
    }
    blocks(2u * FS / CTL);
}

/* ---- a track changes kind while the transport runs (a song section or a project): nothing left sounding ---- */
static void t_kind(void)
{
    uint32_t k, before;
    static const uint8_t CH[3] = {48, 52, 55}, KICK[1] = {36};
    reset(120);
    host_preset(&trk[5], 0, 12);
    trk[5].p[P_SLEN] = 8, trk[5].p[P_SDIV] = 2, trk[5].p[P_SGATE] = 127;   /* (1/16, the full gate: always sounding) */
    for (k = 0; k < 8u; k++)
        put_step(&trk[5], k, 3, CH, ST_NOTE, 0);
    transport_req = 1;
    blocks(bars_blocks(1) / 2u);
    before = synth_active(&trk[5]);
    trk_kind_now(&trk[5], TK_DRUM);                /* (as proj_apply does it, inside a block) */
    trk[5].p[P_E0] = DRUM_DEFAULT_KIT;
    trk[5].p[P_LEVEL] = 100;
    steps_clear(&trk[5]);
    for (k = 0; k < 8u; k += 2u)
        put_step(&trk[5], k, 1, KICK, ST_NOTE, 0);
    {
        uint32_t i, others = 0;
        for (i = 0; i < NTRK; i++)
            if (i != 5u)
                for (k = 0; k < NVOICE; k++)
                    others += trk[i].v[k].active && trk[i].v[k].stage != 4u;
        check(before > 0u && synth_active(&trk[5]) == 0u && voices_busy() == others,
              "synth -> drums while playing: its synth voices end at once, the budget counts them no more");
    }
    memset(pk, 0, sizeof pk);
    drums.hits[5] = 0;
    blocks(bars_blocks(1));
    check(pk[5] > 500 && (drums.hits[5] & 1u), "  .. and it plays its drum pattern on its own kit");
    trk_kind_now(&trk[5], TK_SYNTH);
    check(drum_active(5) == 0u, "drums -> synth: its drum voices end at once");
    transport_req = 2;
    blocks(2u * FS / CTL);
    check(all_active() == 0u, "  .. nothing left sounding after STOP");
}

/* ---- the engine arenas: three tracks at once, a fourth waits ---- */
static void t_arena(void)
{
    static const uint8_t BIG[3] = {ENGI_FM6, ENGI_PHYS, ENGI_GRAIN};
    uint32_t i, k, waited, took = 0;
    reset(120);
    eng_arena_bad = 0;
    for (i = 0; i < 3u; i++) {
        host_preset_req(&trk[i], BIG[i], 0);       /* (the UI's way: eng_req, then the engine block switches) */
        trk_note_on(&trk[i], 60, 100);
    }
    blocks(20);
    for (i = 0; i < 3u; i++)
        took += trk[i].engine == BIG[i] && trk[i].arena;
    host_preset_req(&trk[4], ENGI_FM6, 0);
    trk_note_on(&trk[4], 64, 100);
    blocks(40);
    waited = trk[4].engine != ENGI_FM6 && !trk[4].arena && eng_arenas_busy(&trk[4]) == 3u;
    check(took == 3u && waited, "three tracks hold the three arenas (FM6, PHYS, GRAIN); a fourth big engine waits, none lent to it");
    host_preset_req(&trk[1], 0, 0);                /* track 2 back to ANALOG: its arena is free once its switch ends */
    for (k = 0; k < 200u && trk[4].engine != ENGI_FM6; k++)
        block();
    check(trk[4].engine == ENGI_FM6 && trk[4].arena && !trk[1].arena && trk[1].engine == 0u,
          "track 2 to another engine: its arena goes to the waiting track 5, which switches (its notes on FM6)");
    trk_note_on(&trk[4], 67, 100);
    blocks(100);
    check(eng_arena_bad == 0u && peak_out < 32767u * 16u, "no engine ever on an arena not its own; the mix bounded");
    for (i = 0; i < NTRK; i++)
        trk_all_off(&trk[i]);
    blocks(3u * FS / CTL);
}

/* ---- STUT buffers: four lent, a fifth STUT track plays live ---- */
static void t_stut(void)
{
    static const uint8_t TR[5] = {0, 1, 2, 4, 5};
    uint32_t i, k, lent = 0, five = 0, none = NTRK, gave = 1;
    reset(120);
    for (i = 0; i < 5u; i++) {
        track_t *t = &trk[TR[i]];
        t->p[P_SLCR] = SL_STUT, t->p[P_SLDEPTH] = 127;
        trk_note_on(t, (uint32_t)(48 + i * 4), 100);
    }
    transport_req = 1;
    blocks(200);
    for (i = 0; i < SL_NBUF; i++)
        lent += sl_buf_trk[i] != 0u;
    for (i = 0; i < 5u; i++)
        if (!sl_buf_of(&trk[TR[i]], TR[i]))
            none = TR[i], five++;
    check(lent == SL_NBUF && five == 1u && none == 5u,
          "five tracks in STUT: the four buffers to the first four in track order (1 2 3 5), the fifth (6) plays live");
    trk[1].p[P_SLCR] = SL_OFF;                     /* track 2 out of STUT: its buffer to the fifth */
    blocks(200);
    for (k = 0; k < SL_NBUF; k++)
        gave &= sl_buf_trk[k] != 2u;
    check(sl_buf_of(&trk[5], 5) != 0 && gave && peak_out < 32767u * 16u,
          "track 2 out of STUT: its buffer goes to the fifth; the mix bounded");
    transport_req = 2;
    for (i = 0; i < NTRK; i++)
        trk_all_off(&trk[i]), trk[i].p[P_SLCR] = SL_OFF;
    blocks(3u * FS / CTL);
}

/* ---- MIDI: CH5..CH8, in and out ---- */
static void t_midi8(void)
{
    uint32_t i, v, on5 = 0, out_ch = 0, outs = 0;
    reset(120);
    usb.config = 1;
    song.g[G_ROUTE] = 0, song.g[G_CHOTH] = 0;
    song.g[G_CH5] = 5, song.g[G_CH6] = 6, song.g[G_CH7] = 7, song.g[G_CH8] = 11;
    m_on(4, 60, 100);                              /* channel 5: track 5 */
    blocks(2);
    for (v = 0; v < NVOICE; v++)
        on5 |= trk[4].v[v].active && trk[4].v[v].gate && trk[4].v[v].note == 60u;
    check(on5 && !synth_active(&trk[0]), "MIDI channel 5 plays track 5 (GLO > MIDI 4: CH5), not the selected track 1");
    m_off(4, 60);
    blocks(2);
    for (v = 0, on5 = 0; v < NVOICE; v++)
        on5 |= trk[4].v[v].active && trk[4].v[v].gate;
    check(!on5, "  .. its note-off ends it there");
    drums.hits[7] = 0;
    m_on(10, 38, 110);                             /* channel 11: track 8's drums (a snare) */
    blocks(2);
    check((drums.hits[7] >> lane_of_note(38)) & 1u, "MIDI channel 11 (CH8) hits track 8's drums");
    song.sel = 2;
    m_on(12, 72, 100);                             /* a channel no track has: OTHER = SEL, the selected track */
    blocks(2);
    for (v = 0, on5 = 0; v < NVOICE; v++)
        on5 |= trk[2].v[v].active && trk[2].v[v].gate && trk[2].v[v].note == 72u;
    song.sel = 6;                                  /* the selection moves: its note-off still ends it on track 3 */
    m_off(12, 72);
    blocks(2);
    for (v = 0, i = 0; v < NVOICE; v++)
        i |= trk[2].v[v].active && trk[2].v[v].gate && trk[2].v[v].note == 72u;
    check(on5 && !i && !synth_active(&trk[6]), "OTHER = SEL: the selected track; the note-off follows its note-on after a new selection");
    /* the sequencer to MIDI OUT on each track's channel */
    song.g[G_MIDI] = 1;
    mo_r = mo_w;
    {
        static const uint8_t N[1] = {62};
        trk[5].p[P_SLEN] = 4;
        put_step(&trk[5], 0, 1, N, ST_NOTE, 0);
    }
    transport_req = 1;
    blocks(bars_blocks(1));
    while (mo_r != mo_w) {
        uint32_t pkt = midi_out_q[mo_r % MQ];
        mo_r++;
        if (((pkt >> 8) & 0xF0u) == 0x90u && ((pkt >> 16) & 127u) == 62u) {
            outs++;
            out_ch |= 1u << ((pkt >> 8) & 15u);
        }
    }
    check(outs > 0u && out_ch == 1u << 5, "the sequencer of track 6 goes out on its channel (CH6 = 6)");
    transport_req = 2;
    song.g[G_MIDI] = 0;
    blocks(FS / CTL);
    check(all_active() == 0u, "  .. and nothing hangs after STOP");
}

/* ---- the selected track changes while every track plays: nothing interrupted ---- */
static void t_select(void)
{
    uint32_t i, k, steady = 1;
    reset(120);
    for (i = 0; i < NTRK; i++) {
        uint8_t n[1] = {(uint8_t)(is_drum(&trk[i]) ? 36 : 40 + i * 4)};
        trk[i].p[P_SLEN] = 1, trk[i].p[P_SDIV] = 0;
        trk[i].p[P_SGATE] = 127;
        put_step(&trk[i], 0, 1, n, ST_NOTE, 0);
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], 0, 12);
    }
    transport_req = 1;
    blocks(40);
    for (k = 0; k < 64u; k++) {
        song.sel = (uint8_t)(k % NTRK);             /* (as ALGORITHM turns: the keys, pages, editor follow it) */
        block();
        for (i = 0; i < NTRK; i++)
            if (!is_drum(&trk[i]) && i != 6u)
                steady &= trk[i].seq_n == 1u;     /* (each synth track's note held through its steps) */
    }
    check(steady, "the selected track turns 1..8 while all play: every other track's notes go on");
    transport_req = 2;
    blocks(3u * FS / CTL);
}

/* ---- the cost: eight busy tracks against four (host time) ---- */
static uint64_t ns_now(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000u + (uint64_t)ts.tv_nsec;
}
static double busy_cost(uint32_t ntracks)
{
    uint32_t i, k, n;
    uint64_t t0;
    reset(120);
    for (i = 0; i < ntracks; i++) {
        track_t *t = &trk[i];
        t->p[P_SLEN] = 16, t->p[P_SDIV] = 2;
        for (k = 0; k < 16u; k += 2u) {
            uint8_t notes[1] = {(uint8_t)(is_drum(t) ? (k % 4u ? 42 : 36) : 40 + i * 5 + k)};
            put_step(t, k, 1, notes, ST_NOTE, 0);
        }
    }
    transport_req = 1;
    blocks(50);
    n = 4u * FS / CTL;
    t0 = ns_now();
    blocks(n);
    transport_req = 2;
    return (double)(ns_now() - t0) / (double)(n * CTL);
}
static void t_cost(void)
{
    double c4, c8;
    (void)busy_cost(8);                             /* (warm up) */
    c4 = busy_cost(4);
    c8 = busy_cost(8);
    printf("tracks8:   host cost per sample: four busy tracks %.1f ns, eight %.1f ns (x%.2f; timed on the host, not the FM-1)\n",
           c4, c8, c8 / c4);
    check(c8 < c4 * 3.0, "eight busy tracks cost less than three times four (the voice budget is shared)");
}

int main(void)
{
    t_eight();
    t_budget();
    t_drums2();
    t_kind();
    t_arena();
    t_stut();
    t_midi8();
    t_select();
    t_cost();
    printf("%s\n", fails ? "tracks8: FAILED" : "tracks8: all checks ok");
    return fails != 0;
}
