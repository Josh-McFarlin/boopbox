/* SPDX-License-Identifier: GPL-3.0-only */
/* Parameter locks (seq.c lock_*): several on one step, up to NLOCK a track, on synth and drum tracks and on every engine;
 * the parameters back at their base after the step and after STOP; SLIDE (the value glides over the step) and a knob
 * turned meanwhile winning; a knob turned while recording kept as a lock (lock_capture), the track's own value kept; a
 * project or a user preset captured while a lock plays keeps the track's own values (trk_base), never the lock's; format 7
 * keeps 32 locks and SLIDE, format 6 (24, no SLIDE) is refused rather than cut.
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/lock_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

static int fails;
static void check(int ok, const char *what)
{
    printf("lock: %-100s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static int32_t out[CTL * 2];
static void block(void) { mix_block(out, CTL); }
static void blocks(uint32_t n)
{
    while (n--)
        block();
}
static uint32_t step_blocks(uint32_t n) { return (uint32_t)(((uint64_t)n * BEAT_U / 4u / (uint32_t)song.g[G_BPM] + CTL - 1u) / CTL); }
static void reset(void)
{
    uint32_t i;
    memset(trk, 0, sizeof trk);
    memset(eng_arena_trk, 0, sizeof eng_arena_trk);
    memset(eng_arena_own, 0, sizeof eng_arena_own);
    memset(sl_buf_trk, 0, sizeof sl_buf_trk);
    memset(&drums, 0, sizeof drums);
    drums.set = -2;
    host_tracks_init();
    for (i = 0; i < NTRK; i++) {
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
        steps_clear(&trk[i]);
        trk[i].p[P_SLEN] = 8;
        trk[i].p[P_SDIV] = 2;
        trk[i].p[P_SSWING] = 0;
    }
    song.g[G_BPM] = 150;
    song.g[G_SWING] = 0;
    song.rec = 0, song.solo = 0, song.sel = 0;
    rec_wait = 0;
    fm1_in.notes = fm1_in.buttons = 0;
}
static void stop(void)
{
    transport_req = 2;
    blocks(FS / CTL);
}
/* run until track t is on step idx (at most n blocks); 1: it is */
static int until_step(const track_t *t, uint32_t idx, uint32_t n)
{
    while (n--) {
        block();
        if (t->seq_idx == idx)
            return 1;
    }
    return 0;
}

static void t_basic(void)
{
    track_t *t;
    int16_t flt, dly, pan;
    uint32_t k, ok = 1;
    reset();
    t = &trk[0];
    flt = t->p[P_ED_FLT], dly = t->p[P_DLY], pan = t->p[P_PAN];
    check(lock_set(t, 2, P_ED_FLT, flt + 30) && lock_set(t, 2, P_DLY, 90) && lock_set(t, 2, P_PAN, -40) &&
              lock_set(t, 5, P_DLY, 10),
          "three locks on step 3 (FLT, DLY, PAN), one on step 6");
    transport_req = 1;
    ok = until_step(t, 2, step_blocks(8)) && t->p[P_ED_FLT] == flt + 30 && t->p[P_DLY] == 90 && t->p[P_PAN] == -40;
    check(ok, "step 3: its three locks in force at once");
    ok = until_step(t, 3, step_blocks(4)) && t->p[P_ED_FLT] == flt && t->p[P_DLY] == dly && t->p[P_PAN] == pan;
    check(ok, "step 4: all three back to the track's own values");
    ok = until_step(t, 5, step_blocks(4)) && t->p[P_DLY] == 10 && t->p[P_ED_FLT] == flt;
    check(ok, "step 6: its one lock, the others as they are");
    stop();
    check(t->p[P_DLY] == dly && t->p[P_ED_FLT] == flt && t->p[P_PAN] == pan && !t->lk_n, "STOP: every parameter at its base");
    /* NLOCK a track */
    steps_clear(t);
    for (k = 0, ok = 1; k < NLOCK; k++)
        ok &= lock_set(t, k % NSTEP, k < 16u ? P_DLY : P_REV, (int32_t)k);
    check(ok && NLOCK == 32 && !lock_set(t, 40, P_PAN, 1) && lock_set(t, 3, P_DLY, 77),
          "32 locks a track; a 33rd refused; a lock it has still changes");
    for (k = 0, ok = 1; k < NLOCK; k++)
        ok &= !p_lockable(P_SLEN) && !lock_set(t, 50, P_SLEN, 3);
    check(ok, "not lockable: LEN (the pattern's)");
    steps_clear(t);
    /* a drum track's, and a lock on an engine parameter of every engine */
    {
        track_t *d = &trk[3];
        int16_t lv = d->p[P_LEVEL];
        uint32_t e, all = 1;
        lock_set(d, 1, P_LEVEL, 20);
        dstep_set(&d->dstep[1], 0, LV_NORM, 0);
        transport_req = 1;
        ok = until_step(d, 1, step_blocks(8)) && d->p[P_LEVEL] == 20;
        ok &= until_step(d, 2, step_blocks(4)) && d->p[P_LEVEL] == lv;
        stop();
        check(ok, "a drum track's lock (its LEVEL) for its step, back after");
        steps_clear(d);
        for (e = 0; e < NENGINES; e++) {
            const engine_t *en = ENGINES[e];
            int32_t want;
            host_preset(t, e, 0);
            steps_clear(t);
            want = en->edit[1].max;
            lock_set(t, 1, P_E1, want);
            transport_req = 1;
            all &= until_step(t, 1, step_blocks(8)) && t->p[P_E1] == want;
            stop();
            all &= t->p[P_E1] != want || en->edit[1].def == want || t->p[P_E1] == trk_base(t, P_E1);
        }
        host_preset(t, TRK_DEF[0][1], TRK_DEF[0][2]);
        steps_clear(t);
        check(all, "a lock of the engine's second parameter on every engine (its own range)");
    }
}

static void t_slide(void)
{
    track_t *t;
    int16_t base;
    int32_t last, v;
    uint32_t k, mono = 1, n = 0, ok;
    reset();
    t = &trk[0];
    base = t->p[P_DLY];
    lock_set(t, 2, P_DLY, 120);
    check(lock_slide_set(t, 2, P_DLY, 1) && (t->lock[lock_find(t, 2, P_DLY, 0)].param & LOCK_SLIDE),
          "SLIDE on a lock (lock_slide_set)");
    check(!lock_slide_set(t, 3, P_DLY, 1), "SLIDE needs a lock there");
    transport_req = 1;
    until_step(t, 2, step_blocks(8));
    check(t->p[P_DLY] < 120 && t->p[P_DLY] <= base + 4, "its step starts at the value before (the base), not at the lock's");
    last = t->p[P_DLY];
    for (k = 0; k < step_blocks(1) && t->seq_idx == 2u; k++) {
        block();
        if (t->seq_idx != 2u)
            break;                                      /* (the next step has begun) */
        v = t->p[P_DLY];
        mono &= v >= last;
        last = v;
        n++;
    }
    if (!(mono && last >= 115 && n > 10u))
        printf("   base %d last %d n %u mono %u\n", base, last, n, mono);
    check(mono && last >= 115 && n > 10u, "over the step it glides up to the lock's value (monotonic)");
    check(t->seq_idx == 3u && t->p[P_DLY] == base, "the next step (no lock): back to the base");
    stop();
    /* from one lock to the next */
    lock_set(t, 3, P_DLY, 20);
    lock_slide_set(t, 3, P_DLY, 1);
    transport_req = 1;
    until_step(t, 3, step_blocks(8));
    ok = t->p[P_DLY] >= 110;                            /* (from step 3's 120, step 3 was a slide too: reached) */
    until_step(t, 4, step_blocks(2));
    ok &= t->p[P_DLY] == base;
    check(ok, "slide after slide: from the last one's value; the step after: the base");
    stop();
    /* a knob turned during the slide wins */
    transport_req = 1;
    until_step(t, 2, step_blocks(8));
    blocks(step_blocks(1) / 4u);
    t->p[P_DLY] = 33;                                   /* (the knob) */
    blocks(4);
    ok = t->p[P_DLY] == 33;
    until_step(t, 4, step_blocks(4));
    ok &= t->p[P_DLY] == 33;
    stop();
    check(ok && t->p[P_DLY] == 33, "a knob turned in a slide: its value stays, the slide stops, it is the new base");
    /* the slides a step plays at once: NSLIDE; the others jump */
    steps_clear(t);
    lock_set(t, 1, P_DLY, 100), lock_set(t, 1, P_REV, 100), lock_set(t, 1, P_CHOR, 100), lock_set(t, 1, P_DIST, 100);
    lock_set(t, 1, P_PAN, 60);
    for (k = 0; k < NLOCK; k++)
        if (t->lock[k].step == 1u)
            t->lock[k].param |= LOCK_SLIDE;
    transport_req = 1;
    until_step(t, 1, step_blocks(8));
    ok = t->sl_n == NSLIDE && t->p[P_PAN] == 60;
    until_step(t, 2, step_blocks(2));
    stop();
    check(ok, "five SLIDE locks on one step: four glide (NSLIDE), the fifth jumps to its value");
}

static void t_capture(void)
{
    track_t *t;
    int16_t base;
    uint32_t ok;
    reset();
    t = &trk[0];
    base = t->p[P_ED_FLT];
    transport_req = 1;
    until_step(t, 3, step_blocks(8));
    fm1_irq_off();
    ok = lock_capture(t, t->seq_idx, P_ED_FLT, base + 20);
    fm1_irq_on();
    check(ok && t->p[P_ED_FLT] == base + 20 && lock_find(t, 3, P_ED_FLT, 0) >= 0, "lock_capture: the step playing gets the lock, heard at once");
    until_step(t, 4, step_blocks(2));
    check(t->p[P_ED_FLT] == base, "the next step: the track's own value (the knob did not change the sound)");
    until_step(t, 3, step_blocks(9));
    check(t->p[P_ED_FLT] == base + 20, "the next pass: the lock plays again");
    stop();
    check(t->p[P_ED_FLT] == base && trk_base(t, P_ED_FLT) == base, "STOP: the base");
}

static void t_saves(void)
{
    static project_t p;
    track_t *t;
    int16_t flt, e2;
    uint32_t ok, k;
    reset();
    t = &trk[1];
    flt = t->p[P_ED_FLT];
    e2 = t->p[P_E2];
    lock_set(t, 2, P_ED_FLT, flt + 40);
    lock_set(t, 2, P_E2, e2 == ENGINES[t->engine]->edit[2].max ? e2 - 1 : e2 + 1);
    transport_req = 1;
    until_step(t, 2, step_blocks(8));
    ok = t->p[P_ED_FLT] == flt + 40 && trk_base(t, P_ED_FLT) == flt && trk_base(t, P_E2) == e2;
    check(ok, "a lock playing: p[] holds its value, trk_base the track's own");
    proj_capture(&p);                                   /* (an autosave while it plays) */
    stop();
    reset();
    proj_apply(&p, 1);
    t = &trk[1];
    check(t->p[P_ED_FLT] == flt && t->p[P_E2] == e2 && lock_find(t, 2, P_ED_FLT, 0) >= 0,
          "a project captured while a lock plays: the track's own values saved, the lock as a lock");
    {   /* a knob turned while a lock is on: that is the track's value now (what a save keeps) */
        transport_req = 1;
        until_step(t, 2, step_blocks(8));
        t->p[P_ED_FLT] = 3;
        check(trk_base(t, P_ED_FLT) == 3, "a knob turned under a lock: the track's own value is the knob's");
        stop();
        check(t->p[P_ED_FLT] == 3, "  .. and it stays after STOP");
    }
    /* format 7 keeps 32 locks and SLIDE; format 6 is not taken when they would be lost */
    reset();
    for (k = 4; k < NTRK; k++)
        trk_pon_now(k);                                 /* (tracks 5..8 as at power-on: format 6 could hold the rest) */
    t = &trk[0];
    for (k = 0; k < NLOCK; k++)
        lock_set(t, k, k % 2u ? P_DLY : P_ED_FLT, (int32_t)(k + 3u));
    lock_slide_set(t, 5, P_DLY, 1);
    ok = !proj6_fits() && proj_capture(&p) && p.magic == PROJ_MAGIC;
    reset();
    proj_apply(&p, 1);
    t = &trk[0];
    for (k = 0; k < NLOCK; k++) {
        int j = lock_find(t, k, k % 2u ? P_DLY : P_ED_FLT, 0);
        ok &= j >= 0 && t->lock[j].val == (int16_t)(k + 3u) && ((t->lock[j].param & LOCK_SLIDE) != 0) == (k == 5u);
    }
    check(ok, "format 7: 32 locks and a SLIDE kept; format 6 refused for them (24, no SLIDE)");
    for (k = NLOCK_V6; k < NLOCK; k++)
        lock_del(t, k, P_COUNT);
    check(!proj6_fits(), "  24 locks with a SLIDE: still not format 6");
    lock_slide_set(t, 5, P_DLY, 0);
    check(proj6_fits(), "  24 locks without: format 6 would keep them all");
    {   /* format 6 capture packs the slots (they may be anywhere in the 32) */
        static project_v6_t q;
        for (k = 0; k < NLOCK_V6; k++)
            lock_del(t, k, P_COUNT);
        lock_set(t, 30, P_DLY, 9);
        lock_set(t, 31, P_REV, 8);
        for (k = 0; k < NLOCK; k++)                     /* (into the last slots) */
            if (t->lock[k].step != LOCK_FREE && k < NLOCK - 2u) {
                plock_t x = t->lock[k];
                t->lock[k].step = LOCK_FREE;
                t->lock[NLOCK - 1u - (x.param == P_REV)] = x;
            }
        proj6_capture(&q);
        reset();
        proj_apply((project_t *)&q, 1);
        t = &trk[0];
        check(lock_find(t, 30, P_DLY, 0) >= 0 && lock_find(t, 31, P_REV, 0) >= 0, "format 6: locks from slots 25..32 packed in, read back");
    }
}

int main(void)
{
    t_basic();
    t_slide();
    t_capture();
    t_saves();
    printf(fails ? "lock: %d FAILED\n" : "lock: all passed\n", fails);
    return fails != 0;
}
