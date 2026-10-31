/* SPDX-License-Identifier: GPL-3.0-only */
/* Patterns (firmware/src/patbank.c): NPAT a track; a change stopped (at once) and playing, quantized (LOOP: the track's
 * own loop end; 1, 2, 4 bars: tracks asked together change together), independent tracks; chains; a pattern's own LEN;
 * live edits kept across changes; a full bank refuses the change and keeps what plays; format 7 keeps the patterns,
 * the chains, the pattern playing (format 6 is refused for them); damaged bank chunks; the song's loop region
 * (arranger.h); a random session of changes with notes playing: nothing left on; the cost of a change (host timing).
 * What plays is read from the sequencer's MIDI out (each track on its own channel).
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/pat_test.c -lm */
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
static void check(int ok, const char *what)
{
    printf("pat: %-100s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
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
    pat_reset_all();
    for (i = 0; i < NTRK; i++) {
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
        steps_clear(&trk[i]);
        trk[i].p[P_SLEN] = 8;
        trk[i].p[P_SDIV] = 2;
        trk[i].p[P_SSWING] = 0;
        trk[i].p[P_SGATE] = 64;
        trk[i].p[P_AMODE] = 0;
    }
    song.g[G_BPM] = 150;
    song.g[G_SWING] = 0;
    song.g[G_PATQ] = PQ_LOOP;
    song.g[G_MIDI] = 1;
    song.g[G_CH1] = 1, song.g[G_CH2] = 2, song.g[G_CH3] = 3, song.g[G_DRCH] = 4;
    song.g[G_CH5] = 5, song.g[G_CH6] = 6, song.g[G_CH7] = 7, song.g[G_CH8] = 8;
    song.rec = 0, song.solo = 0, song.sel = 0;
    rec_wait = 0;
    fm1_in.notes = fm1_in.buttons = 0;
    mo_r = mo_w;
    usb.config = 1;
    memset(mo_set, 0, sizeof mo_set);
    pb_full = 0;
}
typedef struct { uint32_t blk, trk, note, on, idx, abs; } ev_t;
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
        ev[nev].blk = blkno, ev[nev].trk = i, ev[nev].note = (pkt >> 16) & 127u;
        ev[nev].on = st == 0x90u && ((pkt >> 24) & 127u);
        ev[nev].idx = trk[i].seq_idx, ev[nev].abs = trk[i].seq_abs;
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
static uint32_t step_blocks(uint32_t n) { return (uint32_t)(((uint64_t)n * BEAT_U / 4u / (uint32_t)song.g[G_BPM] + CTL - 1u) / CTL); }
static void play(void)
{
    nev = 0;
    blkno = 0;
    transport_req = 1;
    block();
}
static void stop(void)
{
    transport_req = 2;
    blocks(FS / CTL);
    drain();
}
static void note1(track_t *t, uint32_t i, uint32_t note)
{
    uint8_t n = (uint8_t)note;
    put_step(t, i, 1, &n, ST_NOTE, 0);
}
static void fill_pat(track_t *t, uint32_t base)   /* a note a step: base + step (so a note names its pattern and step) */
{
    uint32_t i;
    for (i = 0; i < (uint32_t)t->p[P_SLEN]; i++)
        note1(t, i, base + i);
}
/* the notes track k started, in order */
static uint32_t notes_of(uint32_t k, uint32_t *n, uint32_t max)
{
    uint32_t i, c = 0;
    for (i = 0; i < nev && c < max; i++)
        if (ev[i].trk == k && ev[i].on)
            n[c++] = ev[i].note;
    return c;
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
static uint32_t midi_on(void)
{
    uint32_t i, w, n = 0;
    for (i = 0; i < NTRK; i++)
        for (w = 0; w < 4u; w++)
            n += (uint32_t)__builtin_popcount(mo_set[i][w]);
    return n;
}
static void ask(uint32_t k, uint32_t pat) { trk[k].pat_req = (uint8_t)(pat + 1u); }

static void t_stopped(void)
{
    track_t *t;
    uint32_t n[64], c;
    reset();
    t = &trk[0];
    fill_pat(t, 40);                                /* pattern 1: notes 40.. */
    ask(0, 1);
    block();
    check(t->pat == 1u && !t->pat_req && pat_empty(t) && (pb_used(0) & 1u), "stopped: a change at once; pattern 2 empty, pattern 1 in the bank");
    t->p[P_SLEN] = 12;
    fill_pat(t, 60);                                /* pattern 2: 12 steps, notes 60.. */
    ask(0, 0);
    block();
    check(t->pat == 0u && t->p[P_SLEN] == 8 && t->step[3].note[0] == 43u && (pb_used(0) & 2u), "back to pattern 1: its notes, its LEN (8); pattern 2 kept");
    ask(0, 1);
    block();
    check(t->pat == 1u && t->p[P_SLEN] == 12 && t->step[11].note[0] == 71u, "pattern 2 again: its 12 steps as edited");
    ask(0, 1);
    block();
    check(t->pat == 1u && !t->pat_req, "asking for the pattern playing: nothing changes");
    play();
    blocks(step_blocks(12) - 1u);
    c = notes_of(0, n, 64);
    check(c == 12u && n[0] == 60u && n[11] == 71u, "PLAY: pattern 2 plays, 12 steps");
    stop();
}

static void t_quant(void)
{
    track_t *t, *u;
    uint32_t n[256], c, i, ok, sw;
    reset();
    t = &trk[0];
    u = &trk[1];
    fill_pat(t, 40);
    ask(0, 1);
    block();
    fill_pat(t, 60);
    ask(0, 0);
    block();                                        /* track 1: pattern 1 (40..47) playing, pattern 2 (60..67) */
    u->p[P_SLEN] = 5;
    fill_pat(u, 80);                                /* track 2: 5 steps, 80..84, no change */
    play();
    blocks(step_blocks(3));                         /* on step 4 */
    ask(0, 1);
    blocks(step_blocks(13));
    c = notes_of(0, n, 256);
    for (i = 0, ok = c >= 16u, sw = 0; i < 16u && ok; i++)
        ok = n[i] == (i < 8u ? 40u + i : 60u + i - 8u);
    check(ok, "LOOP: asked on step 4, pattern 2 from the next loop's start, its step 1 (40..47, 60..)");
    c = notes_of(1, n, 256);
    for (i = 0, ok = c >= 16u; i < c && ok; i++)
        ok = n[i] == 80u + i % 5u;
    check(ok, "track 2 (5 steps) beside it: on its own, not changed");
    stop();
    /* 1 BAR: a 12-step track changes on the bar line (grid step 16), from its step 1 */
    reset();
    t = &trk[0];
    t->p[P_SLEN] = 12;
    fill_pat(t, 40);
    ask(0, 1);
    block();
    fill_pat(t, 60);
    ask(0, 0);
    block();
    song.g[G_PATQ] = PQ_BAR;
    play();
    blocks(step_blocks(2));
    ask(0, 1);
    blocks(step_blocks(18));
    c = notes_of(0, n, 256);
    ok = c >= 18u;
    for (i = 0; i < 16u && ok; i++)
        ok = n[i] == 40u + i % 12u;
    ok = ok && n[16] == 60u && n[17] == 61u;
    check(ok, "1 BAR: a 12-step pattern: steps 1..12, 1..4, then pattern 2 from its step 1 on the bar line");
    stop();
    /* two tracks asked together on 2 BARS: they change on the same block */
    reset();
    for (i = 0; i < 2u; i++) {
        trk[i].p[P_SLEN] = (int16_t)(i ? 6 : 16);
        fill_pat(&trk[i], 40u + 20u * i);
        ask(i, 1);
        block();
        fill_pat(&trk[i], 70u + 20u * i);
        ask(i, 0);
        block();
    }
    song.g[G_PATQ] = PQ_2BAR;
    play();
    blocks(step_blocks(5));
    ask(0, 1);
    ask(1, 1);
    {
        uint32_t b0 = 0, b1 = 0, k;
        blocks(step_blocks(40));
        for (k = 0; k < nev; k++)
            if (ev[k].on && ev[k].note == 70u && ev[k].trk == 0u && !b0)
                b0 = ev[k].blk;
            else if (ev[k].on && ev[k].note == 90u && ev[k].trk == 1u && !b1)
                b1 = ev[k].blk;
        check(b0 && b0 == b1 && b0 >= step_blocks(32) - 1u && b0 <= step_blocks(32) + 1u,
              "2 BARS: two tracks (16 and 6 steps) asked together change together, on bar 3");
    }
    stop();
}

static void t_chain(void)
{
    track_t *t;
    uint32_t n[256], c, i, ok;
    static const uint8_t CH[3] = {0, 2, 1};
    reset();
    t = &trk[0];
    t->p[P_SLEN] = 4;
    for (i = 0; i < 3u; i++) {
        ask(0, i);
        block();
        fill_pat(t, 40u + 10u * i);
    }
    ask(0, 0);
    block();
    pat_chain_set(t, CH, 3);
    play();
    blocks(step_blocks(4 * 7) - 1u);
    c = notes_of(0, n, 256);
    for (i = 0, ok = c >= 28u; i < 28u && ok; i++) {
        static const uint32_t P[7] = {40, 60, 50, 40, 60, 50, 40};
        ok = n[i] == P[i / 4u] + i % 4u;
    }
    check(ok, "a chain 1 3 2: one loop each, round (40.., 60.., 50.., 40..)");
    ask(0, 1);                                      /* an asked change goes first; the chain goes on from it */
    blocks(step_blocks(8));
    stop();
    c = notes_of(0, n, 256);
    check(c >= 36u && n[28] == 50u && n[32] == 40u, "asked for pattern 2 mid-chain: it plays next, then the chain from it (1)");
    pat_chain_set(t, CH, 1);
    check(t->pat_nchain == 0u, "a chain of one: none");
}

static void t_full(void)
{
    track_t *t;
    uint32_t k, i, ok = 1, before;
    reset();
    for (k = 0; k < NTRK && !pb_full; k++) {        /* dense patterns until the bank is full */
        t = &trk[k];
        for (i = 0; i < NPAT && !pb_full; i++) {
            uint32_t s;
            t->p[P_SLEN] = 64;
            for (s = 0; s < NSTEP; s++) {
                uint8_t c[4] = {(uint8_t)(30 + s), (uint8_t)(40 + i), (uint8_t)(50 + k), (uint8_t)(60 + s % 7)};
                if (!is_drum(t))
                    put_step(t, s, 4, c, ST_NOTE, SF_ACCENT);
                else
                    dstep_set(&t->dstep[s], s % 16u, LV_HARD, 1);
            }
            ask(k, (i + 1u) % NPAT);
            block();
        }
    }
    check(pb_full && pb_n <= PB_SIZE, "dense patterns until the bank is full: a change refused (PATTERNS FULL)");
    t = &trk[k - 1u];
    before = t->pat;
    ok = t->step[5].n == 4u || is_drum(t);
    check(ok && t->pat == before && !t->pat_req, "  .. the pattern playing stays, whole");
    {   /* the project with all of it: format 7 whole, or refused untouched */
        static project_t p;
        memset(&p, 0x77, sizeof p);
        ok = proj_capture(&p);
        if (!ok)
            for (i = 0, ok = 1; i < sizeof p; i++)
                ok &= ((uint8_t *)&p)[i] == 0x77u;
        check(ok, "a full bank: the project saves whole (format 7) or is refused (PROJECT FULL), never cut");
    }
}

static void t_store(void)
{
    static project_t p;
    track_t *t;
    uint32_t ok;
    static const uint8_t CH[2] = {2, 0};
    reset();
    t = &trk[2];
    fill_pat(t, 40);
    lock_set(t, 3, P_DLY, 99);
    comp_set(t, 2, CP_TONE, 5, 0);
    ask(2, 2);
    block();
    t->p[P_SLEN] = 6;
    fill_pat(t, 70);
    t->cp_dir = DIR_REV;
    pat_chain_set(t, CH, 2);
    fill_pat(&trk[7], 36);                          /* (a drum track's pattern 1) */
    ask(7, 4);
    block();
    dstep_set(&trk[7].dstep[1], 3, LV_NORM, 0);
    ok = proj_capture(&p) && p.magic == PROJ_MAGIC;
    check(ok, "patterns, a chain, a pattern playing other than 1: saved");
    reset();
    proj_apply(&p, 1);
    t = &trk[2];
    ok = t->pat == 2u && t->p[P_SLEN] == 6 && t->step[0].note[0] == 70u && t->cp_dir == DIR_REV && t->pat_nchain == 2u &&
         t->pat_chain[0] == 2u && t->pat_chain[1] == 0u && (pb_used(2) == 1u) && trk[7].pat == 4u && (pb_used(7) == 1u);
    check(ok, "loaded: each track's pattern playing (its LEN, direction), the chain, the others in the bank");
    ask(2, 0);
    block();
    ok = t->pat == 0u && t->step[3].note[0] == 43u && lock_find(t, 3, P_DLY, 0) >= 0 && comp_find(t, 2, CP_TONE) >= 0 &&
         t->p[P_SLEN] == 8;
    check(ok, "  .. pattern 1 of track 3 out of the bank: its notes, lock, component, LEN");
    {   /* a damaged 'P' chunk: a track or pattern that does not exist, and one twice: not taken */
        static project_t q;
        uint32_t o, n0 = pb_n;
        proj_capture(&q);
        for (o = 0; o + 3u <= q.size - PROJ_HDR;) {
            uint32_t tag = q.d[o], len = (uint32_t)q.d[o + 1u] | (uint32_t)q.d[o + 2u] << 8;
            if (tag == 'P')
                q.d[o + 3u] = 0x9Fu;                 /* (track 10, pattern 16) */
            o += 3u + len;
        }
        q.sum = proj7_sum(&q);
        reset();
        proj_apply(&q, 1);
        check(proj_ok(&q) && pb_n == 0u && n0 > 0u, "a bank entry of track 10 / pattern 16: dropped, the rest loaded");
    }
    /* a section (song mode) carries its patterns */
    reset();
    fill_pat(&trk[0], 40);
    ask(0, 3);
    block();
    fill_pat(&trk[0], 50);
    proj_capture(&proj_slot[1]);
    reset();
    arrangement_apply(1);
    check(trk[0].pat == 3u && trk[0].step[0].note[0] == 50u && (pb_used(0) & 1u), "a section applied (song mode): its patterns, the one playing");
}

static void t_song_loop(void)
{
    arr_config_t c;
    arr_clock_t r;
    uint32_t i, seq[12], n = 0;
    int s;
    arr_defaults(&c);
    c.count = 5;
    for (i = 0; i < 5u; i++)
        c.entry[i].scene = (uint8_t)(i % 4u), c.entry[i].bars = 1;
    c.loop = 1;
    c.reserved[0] = 1, c.reserved[1] = 4;            /* (entries 2..4) */
    s = arr_begin(&r, &c, 15);
    seq[n++] = (uint32_t)s;
    while (n < 12u) {
        arr_elapse(&r, FS * 60u * 4u, 1u);           /* (a bar at 1 BPM in units: four beats) */
        s = arr_next(&r, &c, FS);
        if (s >= 0)
            seq[n++] = r.index;
    }
    {
        static const uint32_t W[12] = {0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2};
        check(!memcmp(seq, W, sizeof W) || (seq[0] == 0u && seq[1] == 1u && seq[4] == 1u && seq[7] == 1u),
              "the song's loop region (entries 2..4): 1 2 3 4 2 3 4 2 ..");
    }
    c.reserved[1] = 9;                               /* past the song: the whole song loops */
    check(arr_loop_first(&c) == 0u && arr_loop_end(&c) == 5u, "a region past the song's end: the whole song");
}

static uint32_t rs = 4242u;
static uint32_t rnd(uint32_t n)
{
    rs ^= rs << 13;
    rs ^= rs >> 17;
    rs ^= rs << 5;
    return rs % n;
}
static void t_session(void)
{
    uint32_t i, k, round, hung = 0;
    clock_t c0;
    double worst = 0;
    reset();
    for (i = 0; i < NTRK; i++)
        for (k = 0; k < 3u; k++) {
            uint32_t s;
            trk[i].p[P_SLEN] = (int16_t)(4 + 3 * k + i);
            for (s = 0; s < (uint32_t)trk[i].p[P_SLEN]; s += 1u + k) {
                uint8_t c[2] = {(uint8_t)(36 + s + k * 5), (uint8_t)(48 + s)};
                if (is_drum(&trk[i]))
                    dstep_set(&trk[i].dstep[s], (s + k) % 16u, LV_NORM, k == 2u);
                else
                    put_step(&trk[i], s, 1u + (s % 3u == 0u), c, ST_NOTE, s % 5u == 0u ? SF_SLIDE : 0u);
                if (s % 4u == 1u && !is_drum(&trk[i]))
                    put_step(&trk[i], (s + 1u) % (uint32_t)trk[i].p[P_SLEN], 0, 0, ST_TIE, 0);
            }
            ask(i, (k + 1u) % 3u);
            block();
        }
    play();
    for (round = 0; round < 60u; round++) {
        uint32_t m = rnd(4);
        song.g[G_PATQ] = (int16_t)rnd(4);
        for (k = 0; k <= m; k++)
            ask(rnd(NTRK), rnd(4));
        if (rnd(6) == 0) {
            uint8_t ch[3] = {(uint8_t)rnd(3), (uint8_t)rnd(3), (uint8_t)rnd(3)};
            fm1_irq_off();
            pat_chain_set(&trk[rnd(NTRK)], ch, rnd(4));
            fm1_irq_on();
        }
        for (k = 0; k < step_blocks(1u + rnd(20)); k++) {
            c0 = clock();
            block();
            {
                double d = (double)(clock() - c0) / CLOCKS_PER_SEC;
                if (d > worst)
                    worst = d;
            }
        }
        if (rnd(8) == 0) {
            stop();
            blocks(4u * FS / CTL);                       /* (a crash or a ride of the kits rings for seconds: not held) */
            if (all_active() != 0u || midi_on() != 0u) {
                uint32_t q, v;
                printf("   round %u: active %u midi %u:", round, all_active(), midi_on());
                for (q = 0; q < NTRK; q++)
                    for (v = 0; v < NVOICE; v++)
                        if (trk[q].v[v].active)
                            printf(" t%u v%u note %u gate %u stage %u", q, v, trk[q].v[v].note, trk[q].v[v].gate, trk[q].v[v].stage);
                for (q = 0; q < NTRK; q++)
                    if (mo_set[q][0] | mo_set[q][1] | mo_set[q][2] | mo_set[q][3])
                        printf(" midi t%u", q);
                printf("\n");
            }
            hung += all_active() != 0u || midi_on() != 0u;
            play();
        }
    }
    stop();
    blocks(4u * FS / CTL);
    check(!hung && all_active() == 0u && midi_on() == 0u, "a random session of changes, chains and stops with notes playing: nothing left on");
    printf("   the longest block of that session (host): %.1f us\n", worst * 1e6);
    {   /* the cost of a change: eight tracks at once, dense patterns (host timing) */
        double t0, t1;
        uint32_t s;
        reset();
        for (i = 0; i < NTRK; i++) {
            trk[i].p[P_SLEN] = 32;
            for (s = 0; s < 32u; s++) {
                uint8_t c[3] = {(uint8_t)(40 + s), (uint8_t)(52 + s), (uint8_t)(64 + i)};
                if (is_drum(&trk[i]))
                    dstep_set(&trk[i].dstep[s], s % 16u, LV_HARD, 1);
                else
                    put_step(&trk[i], s, 3, c, ST_NOTE, 0);
            }
        }
        t0 = (double)clock();
        for (k = 0; k < 100u; k++)
            for (i = 0; i < NTRK; i++)
                pat_swap(i, (trk[i].pat + 1u) % 2u);
        t1 = (double)clock();
        printf("   a change (encode + decode, a 32-step chord pattern): %.2f us on the host; eight at once %.1f us\n",
               (t1 - t0) / CLOCKS_PER_SEC * 1e6 / (100.0 * NTRK), (t1 - t0) / CLOCKS_PER_SEC * 1e6 / 100.0);
        check(!pb_full, "  (eight tracks of 32-step chords swap through the bank)");
    }
}

int main(void)
{
    t_stopped();
    t_quant();
    t_chain();
    t_full();
    t_store();
    t_song_loop();
    t_session();
    printf(fails ? "pat: %d FAILED\n" : "pat: all passed\n", fails);
    return fails != 0;
}
