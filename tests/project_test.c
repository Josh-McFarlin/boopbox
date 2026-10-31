/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* Host test of the project format (firmware/src/project.c, -DPROJ_HOST part): "FUN7", eight tracks, variable length.
 * Round trips of the whole working state, damage refused, a project too big refused whole (fun7_tests); SLOOP's
 * four-track formats ("FUN1" .. "FUN6") read as no project. Run by tests/run_tests.sh (needs build/gen). */
#define main hostsim_main
#include <stddef.h>
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

static int check(const char *what, int ok)
{
    printf("%-66s %s\n", what, ok ? "ok" : "FAIL");
    return ok ? 0 : 1;
}

/* ---- format 7 (eight tracks, variable length) ---- */
static project_t P7, P7b, Q2_7;
typedef struct {                                   /* what a project holds of the working state, to compare */
    int16_t p[NTRK][P_COUNT], g[G_COUNT];
    uint8_t kind[NTRK], eng[NTRK], pre[NTRK], sel;
    uint8_t steps[NTRK][sizeof(step_t) * NSTEP];
    int8_t micro[NTRK][NSTEP];
    uint8_t fill[NTRK][NSTEP / 4];
    uint32_t locks[NTRK];                           /* (a hash of the set of locks: their slots may move) */
    int8_t tune[NTRK][DRUM_LANES], dec[NTRK][DRUM_LANES];
} snap_t;
static snap_t S1, S2;
static uint32_t lock_hash(const track_t *t)
{
    uint32_t k, h = 0;
    for (k = 0; k < NLOCK; k++)
        if (t->lock[k].step != LOCK_FREE)          /* (a sum: the order of the slots does not count) */
            h += ((uint32_t)t->lock[k].step * 131u + t->lock[k].param) * 2654435761u ^ (uint32_t)(uint16_t)t->lock[k].val;
    return h;
}
static void snap(snap_t *s)
{
    uint32_t i;
    memset(s, 0, sizeof *s);
    for (i = 0; i < NTRK; i++) {
        memcpy(s->p[i], trk[i].p, sizeof trk[i].p);
        s->kind[i] = trk[i].kind;
        s->eng[i] = is_drum(&trk[i]) ? 0u : trk[i].eng_req;   /* (a drum track has neither: not stored) */
        s->pre[i] = is_drum(&trk[i]) ? 0u : trk[i].preset;
        memcpy(s->steps[i], trk[i].step, sizeof s->steps[i]);
        memcpy(s->micro[i], trk[i].micro, sizeof s->micro[i]);
        memcpy(s->fill[i], trk[i].fill, sizeof s->fill[i]);
        s->locks[i] = lock_hash(&trk[i]);
        memcpy(s->tune[i], drum_tune[i], DRUM_LANES);
        memcpy(s->dec[i], drum_dec[i], DRUM_LANES);
    }
    for (i = 0; i < G_COUNT; i++)
        s->g[i] = g_setting(i) || i == G_LOAD || i == G_SAVE || i == G_INFO ? 0 : song.g[i];
    s->sel = song.sel;
}
static uint32_t snap_diff(const snap_t *a, const snap_t *b)   /* 0 = the same; else what differs (for the log) */
{
    uint32_t i;
    for (i = 0; i < NTRK; i++) {
        if (memcmp(a->p[i], b->p[i], sizeof a->p[i])) {
            uint32_t k;
            for (k = 0; k < P_COUNT && a->p[i][k] == b->p[i][k]; k++)
                ;
            printf("  track %u parameter %u: %d != %d\n", i + 1u, k, a->p[i][k], b->p[i][k]);
            return 1;
        }
        if (a->kind[i] != b->kind[i] || a->eng[i] != b->eng[i] || a->pre[i] != b->pre[i])
            return printf("  track %u kind / engine / preset\n", i + 1u), 2;
        if (memcmp(a->steps[i], b->steps[i], sizeof a->steps[i]))
            return printf("  track %u steps\n", i + 1u), 3;
        if (memcmp(a->micro[i], b->micro[i], NSTEP) || memcmp(a->fill[i], b->fill[i], NSTEP / 4))
            return printf("  track %u nudges / conditions\n", i + 1u), 4;
        if (a->locks[i] != b->locks[i])
            return printf("  track %u locks\n", i + 1u), 5;
        if (memcmp(a->tune[i], b->tune[i], DRUM_LANES) || memcmp(a->dec[i], b->dec[i], DRUM_LANES))
            return printf("  track %u drum tune / decay\n", i + 1u), 6;
    }
    if (memcmp(a->g, b->g, sizeof a->g))
        return printf("  globals\n"), 7;
    return a->sel != b->sel ? 8u : 0u;
}
/* the power-on sound of a synth track, through the path the UI takes (hostsim's copy of apply_preset_to) */
static int pon_matches(uint32_t i)
{
    static track_t t;
    int16_t p[P_COUNT];
    uint32_t k;
    memset(&t, 0, sizeof t);
    t.kind = (uint8_t)trk_def_kind(i);
    for (k = 0; k < P_E0; k++)
        t.p[k] = TP[k].def;
    if (is_drum(&t)) {
        t.p[P_LEVEL] = 100, t.p[P_REV] = 16, t.p[P_DLY] = 0, t.p[P_E0] = TRK_DEF[i][1];
    } else {
        for (k = 0; k < 8u; k++)
            t.p[P_E0 + k] = ENGINES[TRK_DEF[i][1]]->edit[k].def;
        host_preset_req(&t, TRK_DEF[i][1], TRK_DEF[i][2]);
    }
    pon_params(i, p);
    return !memcmp(p, t.p, sizeof p);
}
/* a busy track i: every kind of value its pattern can hold (dense: every step, the most notes, locks; else a few) */
static void busy_track(uint32_t i, int dense, uint32_t seed)
{
    track_t *t = &trk[i];
    uint32_t k, n = dense ? NSTEP : 9u;
    t->p[P_SLEN] = (int16_t)(dense ? 64 : 12 + i);
    t->p[P_SDIV] = (int16_t)(i % 4u);
    t->p[P_PAN] = (int16_t)((int32_t)i * 9 - 30);
    t->p[P_TFLT] = (int16_t)(dense ? -50 : 0);
    for (k = 0; k < n; k++) {
        uint32_t s = (k * 7u + seed) % NSTEP, r = seed * 2654435761u + k * 40503u;
        if (is_drum(t)) {
            dstep_set(&t->dstep[s], r % 16u, (r >> 4) & 3u, (r >> 6) & 3u);
            if (dense)
                dstep_set(&t->dstep[s], (r >> 8) % 16u, (r >> 12) & 3u, (r >> 14) & 3u);
        } else {
            step_t *st = &t->step[s];
            st->n = (uint8_t)(dense ? 4u : 1u + r % 4u);
            st->time = ST_NOTE;
            st->note[0] = (uint8_t)(40u + r % 40u), st->note[1] = (uint8_t)(41u + r % 39u);
            st->note[2] = (uint8_t)(50u + r % 30u), st->note[3] = (uint8_t)(60u + r % 20u);
            st->flags = (uint8_t)((r >> 3) & 3u);
            st->vel = (uint8_t)(dense || (r & 1u) ? 20u + r % 100u : 0u);
            st->lvl = (uint8_t)(dense ? (r >> 5) & 0xFFu : 0u);
            st->rat = (uint8_t)(dense ? (r >> 9) & 0xFFu : 0u);
        }
        if (dense || k % 3u == 0u)
            t->micro[s] = (int8_t)((int32_t)(r % 64u) - 32);
        if (dense || k % 4u == 1u)
            step_fill_set(t, s, 1u + r % 2u);
    }
    for (k = 0; k < (dense ? NLOCK : 3u); k++)
        lock_set(t, (k * 5u + seed) % NSTEP, k % 2u ? P_DIST : P_PAN, (int32_t)((seed + k) % 60u));
    if (!dense && !is_drum(t))                     /* (a step left with a note past n: kept as it is) */
        t->step[(seed + 3u) % NSTEP].note[3] = 99;
    if (is_drum(t))
        for (k = 0; k < DRUM_LANES; k++)
            drum_tune[i][k] = (int8_t)((int32_t)((k + seed) % 16u) - 8), drum_dec[i][k] = (int8_t)((int32_t)((k * 3u + seed) % 8u) - 4);
}
static int fun7_tests(void)
{
    int bad = 0, ok;
    uint32_t i, k;

    ok = 1;
    for (i = 0; i < NTRK; i++)
        ok &= pon_matches(i);
    bad += check("pon_params: every track's power-on sound as the UI's preset path makes it (eight tracks)", ok);

    /* an eight-track project: two tracks change kind (5 drums, 4 a synth), every part of a pattern, globals */
    host_tracks_init();
    trk[4].kind = TK_DRUM;
    trk[4].p[P_LEVEL] = 100, trk[4].p[P_REV] = 16, trk[4].p[P_DLY] = 0, trk[4].p[P_E0] = 9;
    steps_clear(&trk[4]);
    trk[3].kind = TK_SYNTH;
    steps_clear(&trk[3]);
    for (i = 0; i < NTRK; i++) {
        busy_track(i, 0, 11u * i + 3u);
        if (!is_drum(&trk[i])) {
            trk[i].eng_req = (uint8_t)(i % NENGINES), trk[i].preset = (uint8_t)(i % 3u);
            for (k = 0; k < 8u; k++)                    /* (the engine's own values, as a switch sets them) */
                trk[i].p[P_E0 + k] = ENGINES[i % NENGINES]->edit[k].def;
            trk[i].p[P_E0 + 2] = (int16_t)clamp(10 + (int32_t)i, ENGINES[i % NENGINES]->edit[2].min, ENGINES[i % NENGINES]->edit[2].max);
        }
        trk[i].p[P_ATK] = (int16_t)(5 + i), trk[i].p[P_ITYPE] = (int16_t)(i % 9u), trk[i].p[P_LSYNC] = (int16_t)(i % 4u);
    }
    trk[6].p[P_E0] = (int16_t)ENGINES[6]->edit[0].max;  /* (a value past -127..127 somewhere: two bytes) */
    trk[1].lock[0].val = trk[1].lock[0].val;
    lock_set(&trk[1], 7, P_E0 + 1, ENGINES[1]->edit[1].max);
    song.g[G_BPM] = 133, song.g[G_DUST] = 21, song.g[G_TXSRC] = 3, song.g[G_FILT] = -20, song.g[G_DTIME] = 4;
    song.sel = 6;
    snap(&S1);
    ok = proj_capture(&P7) && P7.magic == PROJ_MAGIC && proj_ok(&P7) && P7.size > PROJ_HDR && P7.size <= PROJ_MAX;
    printf("  (an eight-track project, a few steps each: %u bytes of %u)\n", P7.size, PROJ_MAX);
    host_tracks_init();
    song.sel = 0;
    proj_apply(&P7, 1);
    song.sel = (uint8_t)proj_sel(&P7);
    snap(&S2);
    bad += check("format 7: eight tracks (kinds changed), sounds, patterns, nudges, conditions, locks, drum TUNE / DECAY, "
                 "globals, the selected track: capture -> apply, the same", ok && !snap_diff(&S1, &S2));
    P7b = P7;
    proj_capture(&P7b);
    bad += check("format 7: two captures of one state are the same bytes", !memcmp(&P7, &P7b, sizeof P7));
    {
        int32_t l, d;
        proj_lendiv(&P7, 2, &l, &d);
        bad += check("format 7: a track's LEN and DIV read without applying it (the song's bars), the selected track",
                     l == 14 && d == 2 && proj_sel(&P7) == 6u);
    }

    /* the object as stored: its size checked against the bytes read, any change refused */
    memcpy(&P7b, &P7, P7.size);
    ok = proj_import(&P7b, &P7, (int)P7.size) && !memcmp(&P7b, &P7, P7.size);
    ok &= !proj_import(&P7b, &P7, (int)P7.size - 1) && !proj_import(&P7b, &P7, (int)P7.size + 1);
    bad += check("format 7: imported only at its own size (cut short or longer: refused)", ok);
    ok = 1;
    for (k = 0; k < P7.size - PROJ_HDR; k += 37u) {    /* a bit flipped anywhere in the data, the size or the check */
        P7b = P7;
        P7b.d[k] ^= (uint8_t)(1u << (k % 8u));
        ok &= !proj_ok(&P7b) && !proj_import(&Q2_7, &P7b, (int)P7b.size);
    }
    P7b = P7, P7b.size += 1u;
    ok &= !proj_ok(&P7b);
    P7b = P7, P7b.sum ^= 1u;
    ok &= !proj_ok(&P7b);
    P7b = P7, P7b.size = PROJ_MAX + 4u;
    ok &= !proj_ok(&P7b);
    bad += check("format 7: a bit flipped in the data, a wrong size or check word, a size past the object: refused", ok);

    /* a chunk this firmware does not know (a later BoopBox's) is read past; a chunk cut short ends the reading */
    P7b = P7;
    memmove(P7b.d + 6, P7b.d, P7b.size - PROJ_HDR);
    P7b.d[0] = 'Z', P7b.d[1] = 3, P7b.d[2] = 0, P7b.d[3] = 1, P7b.d[4] = 2, P7b.d[5] = 3;
    P7b.size += 6u;
    P7b.sum = proj7_sum(&P7b);
    host_tracks_init();
    proj_apply(&P7b, 1);
    song.sel = (uint8_t)proj_sel(&P7b);
    snap(&S2);
    ok = proj_ok(&P7b) && !snap_diff(&S1, &S2);
    P7b = P7;
    P7b.d[1] = 0xFF, P7b.d[2] = 0x7F;              /* the first chunk's length past the end */
    P7b.sum = proj7_sum(&P7b);
    host_tracks_init();
    proj_apply(&P7b, 1);                           /* (nothing read: every track as at power-on, nothing past the object) */
    for (i = 0; i < NTRK; i++)
        ok &= trk[i].kind == trk_def_kind(i) && track_empty(&trk[i]);
    bad += check("format 7: an unknown chunk read past; a chunk longer than the object: no read past it, the tracks at power-on", ok);

    /* a section (all 0): its tracks and TEXTURE, not the tempo or the master; a project with no chunk for a track */
    host_tracks_init();
    song.g[G_BPM] = 99, song.g[G_DUST] = 0, song.g[G_TXSRC] = 0;
    proj_apply(&P7, 0);
    ok = song.g[G_BPM] == 99 && song.g[G_DUST] == 0 && song.g[G_TXSRC] == 3 && trk[4].kind == TK_DRUM && trk[6].p[P_ATK] == 11;
    bad += check("format 7: a song section takes its tracks and TEXTURE, keeps the tempo and the master", ok);

    /* SLOOP's four-track projects ("FUN1" .. "FUN6", at their stored sizes, check words right): no project */
    {
        static const struct { uint32_t magic, size; } OLD[6] = {
            {0x46554E31u, 688u}, {0x46554E32u, 2552u}, {0x46554E33u, 2584u},
            {0x46554E34u, 3112u}, {0x46554E35u, 3840u}, {0x46554E36u, 3816u}};
        static uint8_t img[PROJ_MAX];
        ok = 1;
        for (i = 0; i < 6u; i++) {
            uint32_t s = 0x811C9DC5u, n = OLD[i].size;
            memset(img, 0, sizeof img);
            memcpy(img, &OLD[i].magic, 4), memcpy(img + 4, &OLD[i].size, 4);
            for (k = 0; k < n - 4u; k++)                 /* (their check word: FNV-1a over all but itself) */
                s = (s ^ img[k]) * 16777619u;
            memcpy(img + n - 4u, &s, 4);
            Q2_7 = P7;
            ok &= !proj_import(&Q2_7, img, (int)n) && !memcmp(&Q2_7, &P7, sizeof P7) && !proj_ok((const project_t *)img);
        }
        bad += check("SLOOP's four-track projects (FUN1 .. FUN6): not a project, the slot unchanged", ok);
    }

    /* too big: the working project is refused as a whole (the slot keeps what it had), never cut */
    host_tracks_init();
    for (i = 0; i < NTRK; i++)
        busy_track(i, 1, 7u * i + 1u);
    P7b = P7;
    ok = !proj_capture(&P7b) && !memcmp(&P7b, &P7, sizeof P7);
    {
        pw_t w = {0, 0, 0};
        proj7_put(&w);
        printf("  (eight dense tracks would take %u bytes of %u)\n", w.n + PROJ_HDR, PROJ_MAX);
        ok &= w.n + PROJ_HDR > PROJ_MAX;
    }
    bad += check("format 7: eight dense tracks do not fit: refused, the slot unchanged (PROJECT FULL), nothing cut", ok);

    /* dense on tracks 1..4 only: saved whole as format 7, or refused whole (never cut) */
    host_tracks_init();
    for (i = 4; i < NTRK; i++)
        trk_pon_now(i);                              /* (tracks 5..8 as at power-on: no value left from above) */
    for (i = 0; i < 4u; i++)
        busy_track(i, 1, 3u * i + 2u);
    snap(&S1);
    {
        pw_t w = {0, 0, 0};
        proj7_put(&w);
        printf("  (four dense tracks: %u bytes of %u)\n", w.n + PROJ_HDR, PROJ_MAX);
        P7b = P7;
        if (w.n + PROJ_HDR <= PROJ_MAX) {
            ok = proj_capture(&P7) && P7.magic == PROJ_MAGIC;
            host_tracks_init();
            proj_apply(&P7, 1);
            snap(&S2);
            ok &= !snap_diff(&S1, &S2);
        } else {
            ok = !proj_capture(&P7b) && !memcmp(&P7b, &P7, sizeof P7);
        }
    }
    bad += check("four dense tracks: saved whole, or refused untouched", ok);
    return bad;
}

int main(void)
{
    int bad = 0;
    static project_t Q;

    bad += check("a slot is 3840 bytes (one flash object); 4 slots fit .noinit",
                 sizeof(project_t) == 3840u && 4u * sizeof(project_t) <= 0x3D50u - 256u);
    memset(&Q, 0, sizeof Q);
    bad += check("SAVE > PROJECT > ERASE: an object of no bytes is no project (an empty slot)", !proj_import(&Q, &Q, 0));
    bad += fun7_tests();
    printf("%s\n", bad ? "PROJECT FORMAT TEST FAILED" : "project format test passed");
    return bad != 0;
}
