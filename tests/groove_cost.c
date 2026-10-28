/* SPDX-License-Identifier: GPL-3.0-only */
/* The host cost of the groovebox features, measured (a benchmark: it prints, it checks only that the features were
 * really at work). The same eight busy tracks (six synths playing 3-note chords on every step, two drum tracks),
 * first as SLOOP 2.8.3 could play them (no component, lock, pattern chain, harmony or FX target), then with all of
 * them: step components on 7 steps a track, 8 locks a track (4 with SLIDE), a chain of two patterns (a change every
 * loop), FOLLOW SCALE with a 4-chord progression changing each bar, and a latched effect on the DRUMS target.
 *   events: events_block alone (the sequencer, components, locks, patterns, harmony: core 0's control path in the
 *           audio ISR), the voices not rendered
 *   block:  mix_block (all of it: events, voices, effects, mix), a block of CTL frames
 *   target: mix_block with a latched effect on the MASTER, then the same on the DRUMS (the second dry bus)
 * Host times (this machine, cc -O2), not the FM-1's: a ratio between two runs is what they tell.
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/groove_cost.c -lm -o build/host/groove_cost */
#define main hostsim_main
#include "hostsim.c"
#undef main

#define NB 40000u
static int32_t out[CTL * 2];
static uint32_t ns[NB];
static int fails;

static void reset(void)
{
    uint32_t i;
    transport_req = 2;
    mix_block(out, CTL);
    memset(trk, 0, sizeof trk);
    memset(eng_arena_trk, 0, sizeof eng_arena_trk);
    memset(eng_arena_own, 0, sizeof eng_arena_own);
    memset(sl_buf_trk, 0, sizeof sl_buf_trk);
    memset(&drums, 0, sizeof drums);
    drums.set = -2;
    host_tracks_init();
    pat_reset_all();
    for (i = 0; i < NTRK; i++) {
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], 0, 0);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
        steps_clear(&trk[i]);
        trk[i].p[P_SLEN] = 16;
    }
    song.g[G_BPM] = 120;
    punch.req = -1;
    for (i = 0; i < FS / CTL; i++)
        mix_block(out, CTL);
}
static void fill(void)
{
    static const uint8_t DR[3] = {36, 38, 42};
    uint32_t i, s;
    for (i = 0; i < NTRK; i++)
        for (s = 0; s < 16u; s++) {
            if (is_drum(&trk[i])) {
                uint8_t n = DR[s % 3u];
                put_step(&trk[i], s, 1, &n, ST_NOTE, 0);
            } else {
                uint8_t c[3] = {(uint8_t)(48u + i + s % 5u), (uint8_t)(52u + i + s % 5u), (uint8_t)(55u + i + s % 5u)};
                put_step(&trk[i], s, 3, c, ST_NOTE, 0);
            }
        }
}
static uint32_t n_comp, n_lock, n_slide;
static void features(void)
{
    static const uint8_t CH[2] = {0, 1};
    uint32_t i;
    n_comp = n_lock = n_slide = 0;
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        uint32_t s;
        n_comp += comp_set(t, 0, CP_RAND, 2, 0) != 0;
        n_comp += comp_set(t, 1, CP_RUP, 3, 1) != 0;
        n_comp += comp_set(t, 2, CP_MULT, 3, 0) != 0;
        n_comp += comp_set(t, 3, CP_VEL, 90, 20) != 0;
        n_comp += comp_set(t, 5, CP_TRIG, 50, 0) != 0;
        n_comp += comp_set(t, 6, CP_PARAM, P_ED_FLT, 25) != 0;
        n_comp += comp_set(t, 9, CP_BEND, 2, 0) != 0;
        for (s = 8; s < 16u; s++) {
            int ok = lock_set(t, s, P_E0 + 1u + (s & 1u), (int32_t)(s * 7u));
            n_lock += ok != 0;
            if (ok && (s & 2u))
                n_slide += lock_slide_set(t, s, P_E0 + 1u + (s & 1u), 1) != 0;
        }
        if (!is_drum(t))
            t->hfol = HF_SCALE;
        pb_store(i, 1);                               /* (pattern 2: the same, so the chain changes every loop) */
        pat_chain_set(t, CH, 2);
    }
    harm.n = 4;
    harm.c[0].deg = 0, harm.c[1].deg = 3, harm.c[2].deg = 4, harm.c[3].deg = 5;
    for (i = 0; i < 4u; i++)
        harm.c[i].bars = 1;
    song.g[G_HPROG] = 1, song.g[G_HQ] = HQ_BEAT, song.g[G_HKEY] = 2, song.g[G_HSCL] = 1;
}
static int cmp(const void *a, const void *b)
{
    uint32_t x = *(const uint32_t *)a, y = *(const uint32_t *)b;
    return x < y ? -1 : x > y;
}
static void report(const char *what)
{
    uint64_t sum = 0;
    uint32_t i;
    for (i = 0; i < NB; i++)
        sum += ns[i];
    qsort(ns, NB, sizeof ns[0], cmp);
    printf("cost: %-58s mean %7.2f us, 99.9 %% under %7.2f us, max %7.2f us\n", what, (double)sum / NB / 1000.0,
           ns[NB - NB / 1000u] / 1000.0, ns[NB - 1u] / 1000.0);
}
static uint32_t swaps, degs;
static void watch(void)
{
    static uint8_t pat_was[NTRK], deg_was = 0xFF;
    uint32_t i;
    for (i = 0; i < NTRK; i++)
        if (trk[i].pat != pat_was[i])
            swaps++, pat_was[i] = trk[i].pat;
    if (harm.deg != deg_was)
        degs |= 1u << harm.deg, deg_was = harm.deg;
}
static void run(int feat, int events_only, const char *what)
{
    uint32_t b;
    reset();
    fill();
    if (feat)
        features();
    swaps = degs = 0;
    transport_req = 1;
    for (b = 0; b < FS / CTL; b++)
        mix_block(out, CTL);
    for (b = 0; b < NB; b++) {
        uint64_t t0 = now_ns();
        if (events_only)
            events_block(CTL);
        else
            mix_block(out, CTL);
        ns[b] = (uint32_t)(now_ns() - t0);
        watch();
    }
    report(what);
    if (feat) {
        printf("   (at work: %u components, %u locks, %u with SLIDE; %u pattern changes; chords seen 0x%02x)\n", n_comp,
               n_lock, n_slide, swaps, degs);
        if (n_comp < 6u * NTRK || n_lock < 8u * NTRK || swaps < 8u || degs != 0x39u) {
            printf("cost: the features were not all at work: FAIL\n");
            fails++;
        }
    }
}
static void run_target(uint32_t target, const char *what)
{
    uint32_t b;
    reset();
    fill();
    song.g[G_PFXT] = (int16_t)target;
    transport_req = 1;
    for (b = 0; b < FS / CTL; b++)
        mix_block(out, CTL);
    punch.req = PX_CRUSH;
    for (b = 0; b < 4u; b++)
        mix_block(out, CTL);
    for (b = 0; b < NB; b++) {
        uint64_t t0 = now_ns();
        mix_block(out, CTL);
        ns[b] = (uint32_t)(now_ns() - t0);
    }
    report(what);
    punch.req = -1;
    song.g[G_PFXT] = PT_MASTER;
}

int main(void)
{
    host_tracks_init();
    printf("cost: %u blocks of %u frames each (%.2f ms of audio a block)\n", NB, (unsigned)CTL, 1000.0 * CTL / FS);
    run(0, 1, "events, eight tracks, no new feature");
    run(1, 1, "events, eight tracks, every feature");
    run(0, 0, "block, eight tracks, no new feature");
    run(1, 0, "block, eight tracks, every feature");
    run_target(PT_MASTER, "block, CRUSH latched on the MASTER (as before)");
    run_target(PT_DRUMS, "block, CRUSH latched on the DRUMS (the second dry bus)");
    printf(fails ? "cost: %d FAILED\n" : "cost: done\n", fails);
    return fails != 0;
}
