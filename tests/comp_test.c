/* SPDX-License-Identifier: GPL-3.0-only */
/* Step components (firmware/src/comp.c): each type on its own and together, on synth and drum tracks; the evaluation
 * apart from the playing (comp_eval on a track that does not play); the play directions; the same numbers from the
 * same seed; tracks of other lengths beside them stay on the grid; nothing left sounding (a random session of
 * components on every track, edited while playing, then STOP); parameters back to their base after a step's PARAM /
 * PORTA and after STOP; the cost of a busy session against none (host timing: not the FM-1's).
 * What plays is read from the sequencer's MIDI out (every track on its own channel): a note-on, its velocity, and the
 * step of the track that was playing when it went out.
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/comp_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

enum { LANE_KICK = 0, LANE_SNARE = 2, LANE_HAT = 4 };   /* drums.c LANE_NOTE: 36, 38, 42 */
static int fails;
static void check(int ok, const char *what)
{
    printf("comp: %-100s %s\n", what, ok ? "ok" : "FAIL");
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
    for (i = 0; i < NTRK; i++) {
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
        steps_clear(&trk[i]);
        trk[i].p[P_SLEN] = 8;
        trk[i].p[P_SDIV] = 2;                       /* 1/16 */
        trk[i].p[P_SGATE] = 64;                     /* half the step */
        trk[i].p[P_SSWING] = 0;                     /* (straight: 0 is 50 %) */
        trk[i].p[P_ARATE] = trk[i].p[P_AMODE] = 0;
    }
    song.g[G_BPM] = (int16_t)bpm;
    song.g[G_SWING] = 0;
    song.g[G_MIDI] = 1;
    song.g[G_CH1] = 1, song.g[G_CH2] = 2, song.g[G_CH3] = 3, song.g[G_DRCH] = 4;
    song.g[G_CH5] = 5, song.g[G_CH6] = 6, song.g[G_CH7] = 7, song.g[G_CH8] = 8;
    song.rec = 0, song.solo = 0, song.sel = 0;
    rec_wait = 0;
    fm1_in.notes = fm1_in.buttons = 0;
    kb_prev = 0;
    mi_r = mi_w;
    mo_r = mo_w;
    usb.config = 1;
    memset(live_held, 0, sizeof live_held);
    memset(mi_trk_held, 0, sizeof mi_trk_held);
    memset(drum_mute, 0, sizeof drum_mute);
    memset(mo_set, 0, sizeof mo_set);
}

/* the note-ons and -offs out of the sequencer, each with the step of its track that played */
typedef struct { uint32_t blk, trk, note, vel, on, idx, abs; } ev_t;
#define NEV 20000u
static ev_t ev[NEV];
static uint32_t nev, blkno;
static int32_t out[CTL * 2];
static void drain(void)
{
    while (mo_r != mo_w) {
        uint32_t pkt = midi_out_q[mo_r % MQ], st = (pkt >> 8) & 0xF0u, ch = (pkt >> 8) & 15u, i;
        mo_r++;
        if (st != 0x90u && st != 0x80u)
            continue;
        for (i = 0; i < NTRK && trk_midi_ch(i) != ch; i++)
            ;
        if (i == NTRK || nev >= NEV)
            continue;
        ev[nev].blk = blkno;
        ev[nev].trk = i;
        ev[nev].note = (pkt >> 16) & 127u;
        ev[nev].vel = (pkt >> 24) & 127u;
        ev[nev].on = st == 0x90u && ev[nev].vel;
        ev[nev].idx = trk[i].seq_idx;
        ev[nev].abs = trk[i].seq_abs;
        nev++;
    }
}
static void block(void)
{
    mix_block(out, CTL);
    blkno++;
    drain();
}
static void blocks(uint32_t n)
{
    while (n--)
        block();
}
/* blocks of n grid steps (1/16) at the song's tempo, from the start (rounded up to the step's last block) */
static uint32_t step_blocks(uint32_t n) { return (uint32_t)(((uint64_t)n * BEAT_U / 4u / (uint32_t)song.g[G_BPM] + CTL - 1u) / CTL); }
static void play(uint32_t steps)
{
    nev = 0;
    blkno = 0;
    transport_req = 1;
    block();                                        /* (PLAY: step 1 in the first block) */
    blocks(step_blocks(steps) - 1u);
}
static void stop(void)
{
    transport_req = 2;
    blocks(FS / CTL);                               /* a second: every release over */
    drain();
}
static void note1(track_t *t, uint32_t i, uint32_t note)
{
    uint8_t n = (uint8_t)note;
    put_step(t, i, 1, &n, ST_NOTE, 0);
}
/* the steps track k played (its note-ons, in order): idx[], notes[], vels[]; their count */
static uint32_t ons(uint32_t k, uint32_t *idx, uint32_t *notes, uint32_t *vels, uint32_t max)
{
    uint32_t i, n = 0;
    for (i = 0; i < nev && n < max; i++)
        if (ev[i].trk == k && ev[i].on) {
            if (idx)
                idx[n] = ev[i].idx;
            if (notes)
                notes[n] = ev[i].note;
            if (vels)
                vels[n] = ev[i].vel;
            n++;
        }
    return n;
}
static uint32_t all_active(void)
{
    uint32_t i, v, n = 0;
    for (i = 0; i < NTRK; i++)
        for (v = 0; v < NVOICE; v++)
            n += trk[i].v[v].active;
    for (v = 0; v < NDRUM; v++)
        n += drums.v[v].active;
    return n;
}
static uint32_t midi_on(void)                       /* MIDI notes still on */
{
    uint32_t i, w, n = 0;
    for (i = 0; i < NTRK; i++)
        for (w = 0; w < 4u; w++)
            n += (uint32_t)__builtin_popcount(mo_set[i][w]);
    return n;
}
static int seq_is(const uint32_t *got, uint32_t n, const uint32_t *want, uint32_t nw)
{
    uint32_t i;
    if (n < nw)
        return 0;
    for (i = 0; i < nw; i++)
        if (got[i] != want[i])
            return 0;
    return 1;
}
static void show(const char *what, const uint32_t *v, uint32_t n)
{
    uint32_t i;
    printf("   %s:", what);
    for (i = 0; i < n && i < 40u; i++)
        printf(" %u", v[i]);
    printf("\n");
}

/* ---- evaluation alone: comp_eval on a track that does not play ---- */
static void t_eval(void)
{
    track_t *t;
    cp_ev_t e;
    uint32_t i, ok = 1;
    reset(120);
    t = &trk[0];
    comp_reset(t);
    check(comp_set(t, 2, CP_PULSE, 3, 0) && comp_set(t, 2, CP_TONE, 7, 0) && comp_set(t, 2, CP_VEL, 90, 0) &&
              comp_set(t, 2, CP_MULT, 4, 0) && comp_set(t, 2, CP_PORTA, 30, 0) && comp_set(t, 2, CP_BEND, -3, 1),
          "comp_set: six components on one step");
    check(!comp_set(t, 2, CP_MULT, 9, 0) && !comp_set(t, 2, CP_COND, 0, 2) && !comp_set(t, 2, CP_PARAM, P_SLEN, 10) &&
              !comp_set(t, NSTEP, CP_TONE, 1, 0) && !comp_set(t, 2, CP_COUNT, 1, 0),
          "comp_set refuses values out of range, COND 0:B, a parameter that does not lock, a step past 64, no type");
    comp_eval(t, 2, 0, 8, &e);
    check(!e.skip && e.rep == 3 && !e.hold && e.semi == 7 && e.vel == 90 && e.hits == 4 && e.np == 1 &&
              e.pid[0] == P_GLIDE && e.pv[0] == 30 && (e.pabs & 1u) && e.bend == -3 && e.bend_b == 1 && e.jump == -1,
          "comp_eval: what the step does (repeats, semitones, velocity, hits, glide, bend), nothing played");
    comp_eval(t, 3, 0, 8, &e);
    check(!e.skip && !e.rep && !e.semi && !e.vel && !e.hits && !e.np && !e.bend && e.jump == -1,
          "comp_eval: a step without a component: nothing");
    check(comp_count(t, 2) == 6 && comp_count(t, NSTEP) == 6, "comp_count: per step and the track's");
    comp_del(t, 2, CP_TONE);
    check(comp_count(t, 2) == 5 && comp_find(t, 2, CP_TONE) < 0, "comp_del: one type of the step");
    comp_del(t, 2, CP_NONE);
    check(comp_count(t, NSTEP) == 0, "comp_del CP_NONE: every one of the step");
    for (i = 0; i < NCOMP; i++)
        ok &= comp_set(t, i, CP_TONE, 1, 0);
    check(ok && !comp_set(t, 40, CP_TONE, 1, 0) && comp_set(t, 3, CP_TONE, 5, 0) && t->comp[comp_find(t, 3, CP_TONE)].a == 5,
          "NCOMP components a track; a full list takes no new one but changes one it has");
    comp_clear(t);
    check(!comp_count(t, NSTEP) && t->cp_dir == DIR_FWD, "comp_clear: none, FWD");
    /* COND A:B over the loops (cp_adv: steps moved on) */
    comp_set(t, 0, CP_COND, 2, 3);
    for (i = 0, ok = 1; i < 9u; i++) {
        t->cp_adv = i * 8u;
        comp_eval(t, 0, 0, 8, &e);
        ok &= e.skip == (i % 3u != 1u);
    }
    check(ok, "COND 2:3: loop 2, 5, 8 of every 3");
    comp_set(t, 0, CP_COND, -1, 2);
    for (i = 0, ok = 1; i < 6u; i++) {
        t->cp_adv = i * 8u;
        comp_eval(t, 0, 0, 8, &e);
        ok &= e.skip == (i % 2u == 0u);
    }
    check(ok, "COND -1:2 (NOT 1:2): every loop but 1, 3, 5");
    comp_clear(t);
    /* TRIG: the chance, and the same numbers again from the same seed */
    {
        uint32_t n = 0, a[64], same = 1, k;
        comp_set(t, 1, CP_TRIG, 25, 0);
        comp_reset(t);
        for (i = 0; i < 4000u; i++) {
            comp_eval(t, 1, 0, 8, &e);
            n += !e.skip;
            if (i < 64u)
                a[i] = e.skip;
        }
        check(n > 900u && n < 1100u, "TRIG 25: plays about a quarter of the time (of 4000)");
        comp_reset(t);
        for (k = 0; k < 64u; k++) {
            comp_eval(t, 1, 0, 8, &e);
            same &= a[k] == e.skip;
        }
        check(same, "TRIG: the same draws again after comp_reset (the seed)");
    }
    comp_clear(t);
    /* RUP / RDN / RAND in the scale (C major, ROOT C) */
    t->p[P_ROOT] = 0;
    t->p[P_SCALE] = 1;
    {
        static const uint32_t UP[] = {60, 62, 64, 65, 60, 62};
        static const uint32_t DN[] = {60, 59, 57, 55, 60, 59};
        uint32_t got[6], inscale = 1, near = 1, k;
        comp_set(t, 0, CP_RUP, 3, 1);
        comp_reset(t);
        for (k = 0; k < 6u; k++) {
            comp_eval(t, 0, 0, 8, &e);
            got[k] = comp_note(t, 60, &e);
        }
        check(seq_is(got, 6, UP, 6), "RAMP+ 3 (one degree): C D E F, then C again (C major)");
        comp_clear(t);
        comp_set(t, 0, CP_RDN, 3, 1);
        comp_reset(t);
        for (k = 0; k < 6u; k++) {
            comp_eval(t, 0, 0, 8, &e);
            got[k] = comp_note(t, 60, &e);
        }
        check(seq_is(got, 6, DN, 6), "RAMP- 3: C B A G, then C again");
        comp_clear(t);
        comp_set(t, 0, CP_RAND, 2, 0);
        comp_reset(t);
        for (k = 0; k < 500u; k++) {
            uint32_t n;
            comp_eval(t, 0, 0, 8, &e);
            n = comp_note(t, 64, &e);
            inscale &= ((SCALE_MASK[1] >> (n % 12u)) & 1u) != 0u;
            near &= n >= 60u && n <= 67u;
        }
        check(inscale && near, "RAND 2: in the scale, within two degrees of E (C..G)");
        comp_clear(t);
        comp_set(t, 0, CP_TONE, 5, 0);
        comp_eval(t, 0, 0, 8, &e);
        check(comp_note(t, 60, &e) == 65u && comp_note(t, 126, &e) == 127u, "TONE +5: semitones, out of the scale; kept within 0..127");
        comp_clear(t);
    }
}

/* ---- each component played ---- */
static void t_flow(void)
{
    uint32_t idx[256], n, i, ok;
    track_t *t;
    /* no component: steps on the grid */
    reset(150);
    t = &trk[0];
    for (i = 0; i < 8u; i++)
        note1(t, i, 60 + i);
    play(16);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7};
        check(seq_is(idx, n, W, 16), "no component: steps 1..8 on the grid, twice");
    }
    stop();
    /* PULSE 2 on step 2 (index 1) */
    comp_set(t, 1, CP_PULSE, 2, 0);
    play(12);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 1, 1, 2, 3, 4, 5, 6, 7, 0, 1};
        check(seq_is(idx, n, W, 12), "PULSE 2: step 2 three times (hit each), then on");
        if (!seq_is(idx, n, W, 12))
            show("got", idx, n);
    }
    stop();
    comp_clear(t);
    /* HOLD 2 on step 2: one hit, sounding through two more grid steps, the next one later */
    comp_set(t, 1, CP_HOLD, 2, 0);
    play(10);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 3, 4, 5, 6};
        uint32_t on_blk = 0, off_blk = 0, k;
        check(seq_is(idx, n, W, 7), "HOLD 2: step 2 once, then 3 .. (two grid steps later)");
        for (k = 0; k < nev; k++)
            if (ev[k].trk == 0u && ev[k].note == 61u) {
                if (ev[k].on && !on_blk)
                    on_blk = ev[k].blk;
                else if (!ev[k].on && on_blk && !off_blk)
                    off_blk = ev[k].blk;
            }
        check(off_blk > on_blk && off_blk - on_blk >= step_blocks(2) + step_blocks(1) / 3u &&
                  off_blk - on_blk <= step_blocks(3),
              "HOLD 2: its note sounds through the held steps (off in the last, at its gate)");
    }
    stop();
    comp_clear(t);
    /* JUMP: step 4 -> step 2, every time; then every second time */
    comp_set(t, 3, CP_JUMP, 2, 1);
    play(10);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 3, 1, 2, 3, 1, 2, 3};
        check(seq_is(idx, n, W, 10), "JUMP 2 (every time) on step 4: 1 2 3 4 2 3 4 2 ..");
    }
    stop();
    comp_set(t, 3, CP_JUMP, 2, 2);
    play(14);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 1, 2};
        check(seq_is(idx, n, W, 14), "JUMP 2 every 2nd time: the first pass goes on, the second jumps");
        if (!seq_is(idx, n, W, 14))
            show("got", idx, n);
    }
    stop();
    comp_clear(t);
    /* directions */
    t->cp_dir = DIR_REV;
    play(10);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {7, 6, 5, 4, 3, 2, 1, 0, 7, 6};
        check(seq_is(idx, n, W, 10), "REV: 8 7 .. 1 8 ..");
    }
    stop();
    t->cp_dir = DIR_PEND;
    play(16);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 1};
        check(seq_is(idx, n, W, 16), "PEND: 1 .. 8 7 .. 1 2 (the ends once)");
    }
    stop();
    t->cp_dir = DIR_RAND;
    play(64);
    n = ons(0, idx, 0, 0, 256);
    {
        uint32_t first[64], seen = 0, k;
        memcpy(first, idx, sizeof first);
        for (k = 0; k < n; k++)
            seen |= 1u << idx[k];
        check(n == 64u && seen == 0xFFu, "RAND: 64 steps, every step of 8 among them");
        stop();
        play(64);
        n = ons(0, idx, 0, 0, 256);
        check(n == 64u && !memcmp(first, idx, sizeof first), "RAND: the same order from the next PLAY (the seed)");
        stop();
        t->cp_seed = 7;
        play(64);
        n = ons(0, idx, 0, 0, 256);
        check(n == 64u && memcmp(first, idx, sizeof first), "RAND: another seed, another order");
    }
    stop();
    t->cp_dir = DIR_FWD;
    t->cp_seed = 0;
    /* other lengths beside it stay on the grid */
    {
        track_t *u = &trk[1];
        uint32_t uidx[256], un, k;
        u->p[P_SLEN] = 5;
        for (i = 0; i < 5u; i++)
            note1(u, i, 48 + i);
        comp_set(t, 2, CP_PULSE, 3, 0);
        comp_set(t, 6, CP_JUMP, 1, 1);
        play(40);
        un = ons(1, uidx, 0, 0, 256);
        for (k = 0, ok = un == 40u; k < un; k++)
            ok &= uidx[k] == k % 5u;
        check(ok, "a 5-step track beside one with PULSE and JUMP: on its own grid, every step");
        stop();
    }
    comp_clear(t);
}

static void t_notes(void)
{
    uint32_t idx[256], notes[256], vels[256], n, i, ok;
    track_t *t;
    reset(150);
    t = &trk[0];
    t->p[P_ROOT] = 0;
    t->p[P_SCALE] = 1;
    for (i = 0; i < 8u; i++)
        note1(t, i, 60);
    /* MULT 3 on step 3: three hits in its grid step */
    comp_set(t, 2, CP_MULT, 3, 0);
    play(8);
    n = ons(0, idx, 0, 0, 256);
    {
        static const uint32_t W[] = {0, 1, 2, 2, 2, 3, 4};
        uint32_t k, b0 = 0, b2 = 0, c = 0;
        check(seq_is(idx, n, W, 7), "MULT 3: three hits of step 3");
        for (k = 0; k < nev; k++)
            if (ev[k].on && ev[k].trk == 0u && ev[k].idx == 2u) {
                if (!c)
                    b0 = ev[k].blk;
                b2 = ev[k].blk;
                c++;
            }
        check(c == 3u && b2 - b0 >= step_blocks(1) * 2u / 3u - 2u && b2 - b0 <= step_blocks(1) * 2u / 3u + 2u,
              "MULT 3: evenly inside the step (the third two thirds in)");
    }
    stop();
    comp_clear(t);
    /* VEL */
    comp_set(t, 1, CP_VEL, 40, 0);
    comp_set(t, 3, CP_VEL, 80, 20);
    play(64);
    n = ons(0, idx, 0, vels, 256);
    for (i = 0, ok = n == 64u; i < n; i++)
        ok &= idx[i] == 1u ? vels[i] == 40u : idx[i] == 3u ? vels[i] >= 60u && vels[i] <= 100u : vels[i] == 100u;
    check(ok, "VEL 40: that velocity; VEL 80 +-20: within 60..100; the others as recorded (100)");
    {
        uint32_t v3[8], k, m = 0, diff = 0;
        for (k = 0; k < n && m < 8u; k++)
            if (idx[k] == 3u)
                v3[m++] = vels[k];
        for (k = 1; k < m; k++)
            diff |= v3[k] != v3[0];
        check(diff, "VEL's spread: not the same velocity every loop");
    }
    stop();
    comp_clear(t);
    /* RUP on step 1 over loops; TONE on step 2; both on step 3 */
    comp_set(t, 0, CP_RUP, 2, 1);
    comp_set(t, 1, CP_TONE, -12, 0);
    comp_set(t, 2, CP_TONE, 12, 0);
    comp_set(t, 2, CP_RDN, 1, 2);
    play(32);
    n = ons(0, idx, notes, 0, 256);
    {
        uint32_t k, r = 0, s1 = 0, s2 = 0;
        static const uint32_t R[] = {60, 62, 64, 60};
        uint32_t rs[4];
        for (k = 0, ok = 1; k < n; k++) {
            if (idx[k] == 0u && r < 4u)
                rs[r++] = notes[k];
            if (idx[k] == 1u)
                ok &= notes[k] == 48u, s1++;
            if (idx[k] == 2u)                       /* +12, then 2 degrees down every other time: 72, 69 (A) */
                ok &= notes[k] == (s2++ % 2u ? 69u : 72u);
        }
        check(r == 4u && seq_is(rs, 4, R, 4), "RAMP+ 2 on step 1: C D E C over four loops");
        check(ok && s1 == 4u && s2 == 4u, "TONE -12; TONE +12 with RAMP- (2 degrees) on one step: 72 69 72 69");
    }
    stop();
    check(midi_on() == 0u && all_active() == 0u, "moved notes: each one's note-off is its own (nothing on after STOP)");
    comp_clear(t);
    /* PORTA: GLIDE for the step, back after it and after STOP */
    t->p[P_GLIDE] = 0;
    comp_set(t, 2, CP_PORTA, 50, 0);
    nev = 0;
    transport_req = 1;
    {
        uint32_t k, during = 0, after = 1;
        for (k = 0; k < step_blocks(6); k++) {
            block();
            if (t->seq_idx == 2u)
                during |= t->p[P_GLIDE] == 50;
            if (t->seq_idx == 4u)
                after &= t->p[P_GLIDE] == 0;
        }
        check(during && after, "PORTA 50: GLIDE 50 for its step, 0 again on the next");
        while (t->seq_idx != 2u)
            block();
        stop();
        check(t->p[P_GLIDE] == 0, "PORTA: GLIDE back to its base after STOP inside the step");
    }
    comp_clear(t);
    /* PARAM: a random value of the filter for the step, back after */
    {
        int16_t base = t->p[P_ED_FLT];
        uint32_t k, moved = 0, within = 1, back = 1;
        const param_desc_t *d = lock_desc(t, P_ED_FLT);
        int32_t w = (d->max - d->min) * 30 / 100;
        comp_set(t, 1, CP_PARAM, P_ED_FLT, 30);
        transport_req = 1;
        for (k = 0; k < step_blocks(64); k++) {
            block();
            if (t->seq_idx == 1u) {
                moved |= t->p[P_ED_FLT] != base;
                within &= t->p[P_ED_FLT] >= clamp(base - w, d->min, d->max) && t->p[P_ED_FLT] <= clamp(base + w, d->min, d->max);
            } else {
                back &= t->p[P_ED_FLT] == base;
            }
        }
        check(moved && within && back, "PARAM FLT 30 %: a value within +-30 % of the range on its step, the base elsewhere");
        stop();
        check(t->p[P_ED_FLT] == base, "PARAM: the base after STOP");
    }
    comp_clear(t);
    /* BEND: the track's bend over the step, nothing on the next */
    {
        uint32_t k, rise = 1, endv = 0, zero = 1;
        int32_t last = -1;
        comp_set(t, 3, CP_BEND, 2, 0);
        transport_req = 1;
        for (k = 0; k < step_blocks(6); k++) {
            block();
            if (t->seq_idx == 3u) {
                rise &= t->cp_bend >= last;
                last = t->cp_bend;
                endv = (uint32_t)t->cp_bend;
            } else if (t->seq_idx > 3u) {
                zero &= t->cp_bend == 0;
            }
        }
        check(rise && endv > 2u * 4096u * 9u / 10u && endv <= 2u * 4096u && zero,
              "BEND +2: from the note up two semitones over its step; 0 on the next");
        stop();
        check(t->cp_bend == 0, "BEND: none after STOP");
    }
    comp_clear(t);
    /* COND 1:2 and TRIG, played */
    comp_set(t, 0, CP_COND, 1, 2);
    comp_set(t, 4, CP_TRIG, 50, 0);
    play(8 * 40);
    n = ons(0, idx, 0, 0, 512);
    {
        uint32_t k, c0 = 0, c4 = 0;
        for (k = 0; k < n; k++) {
            c0 += idx[k] == 0u;
            c4 += idx[k] == 4u;
        }
        check(c0 == 20u, "COND 1:2 on step 1: plays on 20 of 40 loops");
        check(c4 >= 12u && c4 <= 28u, "TRIG 50 on step 5: about half of 40 loops");
    }
    stop();
    comp_clear(t);
}

static void t_drums(void)
{
    uint32_t idx[512], notes[512], vels[512], n, i, ok, k;
    track_t *d = &trk[3];
    reset(150);
    for (i = 0; i < 8u; i++) {
        memset(&d->dstep[i], 0, sizeof d->dstep[i]);
        dstep_set(&d->dstep[i], LANE_KICK, LV_NORM, 0);
    }
    dstep_set(&d->dstep[2], LANE_SNARE, LV_NORM, 0);
    comp_set(d, 2, CP_MULT, 4, 0);
    comp_set(d, 5, CP_VEL, 30, 0);
    comp_set(d, 6, CP_PULSE, 1, 0);
    play(9);
    n = ons(3, idx, notes, vels, 512);
    {
        uint32_t m2 = 0, v5 = 0, p6 = 0;
        for (k = 0, ok = 1; k < n; k++) {
            m2 += idx[k] == 2u;
            if (idx[k] == 5u)
                v5++, ok &= vels[k] == 30u;
            p6 += idx[k] == 6u;
        }
        check(m2 == 8u, "drums: MULT 4 on a step of two sounds: four hits of each");
        check(ok && v5 == 1u, "drums: VEL 30");
        check(p6 == 2u, "drums: PULSE 1: the step twice");
    }
    stop();
    comp_clear(d);
    comp_set(d, 1, CP_HOLD, 3, 0);
    comp_set(d, 0, CP_COND, 2, 2);
    play(16);
    n = ons(3, idx, 0, 0, 512);
    {
        static const uint32_t W[] = {1, 2, 2, 3, 4, 5, 6, 7, 0, 1};   /* (step 3: kick and snare) */
        uint32_t b1 = 0, b2 = 0;
        for (k = 0; k < nev; k++)
            if (ev[k].trk == 3u && ev[k].on) {
                if (ev[k].idx == 1u && !b1)
                    b1 = ev[k].blk;
                if (ev[k].idx == 2u && !b2)
                    b2 = ev[k].blk;
            }
        check(seq_is(idx, n, W, 10), "drums: COND 2:2 (step 1 not on the first loop, on the second), HOLD 3 on step 2");
        check(b2 - b1 >= step_blocks(4) - 2u && b2 - b1 <= step_blocks(4) + 2u, "drums: HOLD 3: no hit on the held grid steps, step 3 four steps after");
        if (!seq_is(idx, n, W, 10))
            show("got", idx, n);
    }
    stop();
    check(all_active() == 0u && midi_on() == 0u, "drums: nothing on after STOP");
}

/* ---- random components on every track, edited while it plays; then STOP: nothing left ---- */
static uint32_t rs = 12345u;
static uint32_t rnd(uint32_t n)
{
    rs ^= rs << 13;
    rs ^= rs >> 17;
    rs ^= rs << 5;
    return rs % n;
}
static void random_comp(track_t *t)
{
    uint32_t type = 1u + rnd(CP_COUNT - 1u), step = rnd(16);
    int32_t a = CP_RANGE[type][0] + (int32_t)rnd((uint32_t)(CP_RANGE[type][1] - CP_RANGE[type][0] + 1));
    int32_t b = CP_RANGE[type][2] + (int32_t)rnd((uint32_t)(CP_RANGE[type][3] - CP_RANGE[type][2] + 1));
    if (type == CP_PARAM)
        a = P_ED_FLT + (int32_t)rnd(3);
    if (type == CP_COND && !a)
        a = 1;
    if (rnd(4) == 0)
        comp_del(t, step, CP_NONE);
    else
        comp_set(t, step, type, a, b);
}
static void t_session(void)
{
    uint32_t i, k, round, worst = 0, hung = 0;
    clock_t c0, c1;
    double with, without;
    reset(132);
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        t->p[P_SLEN] = (int16_t)(5 + 3 * i);
        for (k = 0; k < 16u; k++)
            if (is_drum(t)) {
                memset(&t->dstep[k], 0, sizeof t->dstep[k]);
                dstep_set(&t->dstep[k], k % 3u ? LANE_HAT : LANE_KICK, LV_NORM, k % 5u == 0u ? 1u : 0u);
            } else if (k % 2u == 0u) {
                uint8_t ch[2] = {(uint8_t)(48 + 3 * i + k), (uint8_t)(55 + 3 * i + k)};
                put_step(t, k, 1u + (k % 4u == 0u), ch, ST_NOTE, k % 6u == 0u ? SF_SLIDE : 0u);
            } else if (k % 4u == 1u) {
                put_step(t, k, 0, 0, ST_TIE, 0);
            }
    }
    /* the cost first: none, then a busy set (host timing) */
    transport_req = 1;
    c0 = clock();
    blocks(step_blocks(256));
    c1 = clock();
    without = (double)(c1 - c0);
    for (i = 0; i < NTRK; i++)
        for (k = 0; k < NCOMP; k++)
            random_comp(&trk[i]);
    c0 = clock();
    blocks(step_blocks(256));
    c1 = clock();
    with = (double)(c1 - c0);
    printf("   host time, 256 steps of eight tracks: no component %.1f ms, NCOMP random ones a track %.1f ms (x%.2f)\n",
           without * 1e3 / CLOCKS_PER_SEC, with * 1e3 / CLOCKS_PER_SEC, without > 0 ? with / without : 0.0);
    check(with < without * 1.5 + 0.02 * CLOCKS_PER_SEC, "the components cost little beside the render (host)");
    for (round = 0; round < 40u; round++) {
        uint32_t m = 1u + rnd(6);
        for (k = 0; k < m; k++)
            random_comp(&trk[rnd(NTRK)]);
        if (rnd(5) == 0)
            trk[rnd(NTRK)].cp_dir = (uint8_t)rnd(DIR_COUNT);
        if (rnd(7) == 0)
            trk[rnd(NTRK)].p[P_SLEN] = (int16_t)(1 + rnd(16));
        blocks(step_blocks(1u + rnd(24)));
        for (i = 0; i < NTRK; i++) {
            uint32_t v, held = 0;
            for (v = 0; v < NVOICE; v++)
                held += trk[i].v[v].active && trk[i].v[v].gate;
            if (held > worst)
                worst = held;
        }
        if (rnd(9) == 0) {
            stop();
            hung += all_active() != 0u || midi_on() != 0u;
            transport_req = 1;
        }
    }
    stop();
    check(!hung && all_active() == 0u && midi_on() == 0u, "a random session (40 rounds of edits, directions, lengths, stops): nothing left on");
    printf("   most held voices on one track at once: %u (of %u)\n", worst, NVOICE);
}

/* ---- the stores: format 7 keeps them ---- */
static void t_store(void)
{
    static project_t p;
    track_t *t = &trk[2];
    track_t *d = &trk[7];
    reset(120);
    note1(t, 0, 60);
    comp_set(t, 0, CP_RUP, 4, 2);
    comp_set(t, 5, CP_JUMP, 2, 3);
    comp_set(t, 5, CP_PARAM, P_E0 + 1, 40);
    comp_set(t, 9, CP_COND, -3, 4);
    t->cp_dir = DIR_PEND;
    t->cp_seed = 99;
    comp_set(d, 1, CP_MULT, 3, 0);
    d->cp_dir = DIR_REV;
    check(proj_capture(&p) && p.magic == PROJ_MAGIC, "a project with components captures (format 7)");
    comp_clear(t);
    comp_clear(d);
    proj_apply(&p, 1);
    t = &trk[2];
    d = &trk[7];
    check(comp_count(t, NSTEP) == 4u && t->comp[comp_find(t, 0, CP_RUP)].a == 4 && t->comp[comp_find(t, 0, CP_RUP)].b == 2 &&
              t->comp[comp_find(t, 5, CP_PARAM)].a == P_E0 + 1 && t->comp[comp_find(t, 9, CP_COND)].a == -3 &&
              t->cp_dir == DIR_PEND && t->cp_seed == 99,
          "loaded: the components, the direction and the seed of a synth track");
    check(comp_count(d, NSTEP) == 1u && d->comp[comp_find(d, 1, CP_MULT)].a == 3 && d->cp_dir == DIR_REV,
          "loaded: a drum track's");
    {
        uint32_t k, order = 1;
        static project_t q;
        proj_capture(&q);
        order = q.size == p.size && !memcmp(q.d, p.d, p.size - PROJ_HDR);
        check(order, "captured again: the same bytes (the order of the list kept: the same random numbers)");
        for (k = 0; k < NTRK; k++)
            comp_clear(&trk[k]);
    }
    {   /* a pattern's components damaged: what this firmware cannot play is dropped, the rest kept; cut short: no more */
        static uint8_t buf[4096];
        pw_t w = {buf, 0, sizeof buf};
        pr_t r;
        uint32_t n0, k;
        t = &trk[0];
        steps_clear(t);
        comp_set(t, 1, CP_TONE, 3, 0);
        comp_set(t, 2, CP_VEL, 70, 5);
        comp_set(t, 3, CP_PARAM, P_E0 + 2, 10);
        comp_set(t, 4, CP_MULT, 4, 0);
        t->cp_dir = DIR_RAND;
        pat_put(&w, t);
        n0 = w.n;                                    /* the entries: the last 4 x 4 bytes */
        buf[n0 - 16u + 1u] = 99;                     /* TONE: a type that does not exist */
        buf[n0 - 12u + 0u] = 200;                    /* VEL: a step past 64 */
        buf[n0 - 4u + 2u] = 50;                      /* MULT 50: out of range */
        r.b = buf, r.n = n0, r.i = 0, r.bad = 0;
        pat_get(&r, t);
        check(!r.bad && comp_count(t, NSTEP) == 1u && comp_find(t, 3, CP_PARAM) >= 0 &&
                  t->comp[comp_find(t, 3, CP_PARAM)].a == P_E0 + 2 && t->cp_dir == DIR_RAND,
              "damaged components: an unknown type, a step past 64, a value out of range dropped; the good one kept");
        buf[n0 - 17u] = 99;                          /* (the count: 4 entries of 4 bytes after it) */
        buf[n0 - 19u] = 9;                           /* (the direction, the seed, the count) a direction that does not exist */
        r.b = buf, r.n = n0, r.i = 0, r.bad = 0;
        pat_get(&r, t);
        check(t->cp_dir == DIR_FWD && comp_count(t, NSTEP) <= 1u, "a count past the end, a bad direction: FWD, nothing read past the data");
        for (k = 0; k < 20u; k++) {                  /* cut anywhere in the components: never past the end */
            r.b = buf, r.n = n0 - k, r.i = 0, r.bad = 0;
            pat_get(&r, t);
            if (r.i > r.n)
                break;
        }
        check(k == 20u, "cut short anywhere in them: read within the data");
        steps_clear(t);
    }
}

int main(void)
{
    t_eval();
    t_flow();
    t_notes();
    t_drums();
    t_session();
    t_store();
    printf(fails ? "comp: %d FAILED\n" : "comp: all passed\n", fails);
    return fails != 0;
}
