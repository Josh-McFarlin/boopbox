/* SPDX-License-Identifier: GPL-3.0-only */
/* The punch-in FX as performance effects (punch.c, FX > PERF): LATCH (the FX layer's keys and the MIDI FX channel: a
 * key turns its effect on, again off; its release nothing); Q (an effect starts on the next 1/16, 1/8, 1/4 or bar line;
 * an end at once; stopped at once); TARGET (MASTER: the whole mix, as before; DRUMS, SYNTHS, SEL: those tracks only, the
 * others pass it by: FADE OUT on the drums leaves a synth sounding, on the synths or the master it does not); a target
 * changed while an effect plays waits for its end; idle, a target changes nothing in the output.
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/perf_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

static int fails;
static void check(int ok, const char *what)
{
    printf("perf: %-100s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static int32_t out[CTL * 2];
static uint32_t blk;
static void midi_in(uint32_t st, uint32_t d1, uint32_t d2)   /* (a USB-MIDI packet into the input ring, as usb.c puts it) */
{
    if (mi_w - mi_r >= MQ) return;
    midi_in_q[mi_w % MQ] = ((st >> 4) & 15u) | st << 8 | d1 << 16 | d2 << 24;
    mi_w++;
}
static void block(void)
{
    mix_block(out, CTL);
    blk++;
}
static void blocks(uint32_t n)
{
    while (n--)
        block();
}
static uint32_t peak_over(uint32_t n)            /* the output's peak over n blocks */
{
    uint32_t p = 0, i;
    while (n--) {
        block();
        for (i = 0; i < CTL * 2u; i++) {
            uint32_t a = (uint32_t)(out[i] < 0 ? -out[i] : out[i]);
            if (a > p)
                p = a;
        }
    }
    return p;
}
static uint32_t beat_blocks(uint32_t n) { return (uint32_t)((uint64_t)n * FS * 60u / (uint32_t)song.g[G_BPM] / CTL); }
static void reset(void)
{
    uint32_t i;
    transport_req = 2;
    blocks(4);
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
        trk[i].p[P_REV] = trk[i].p[P_DLY] = trk[i].p[P_CHOR] = 0;   /* (no sends: the dry tells what the effect did) */
        trk[i].p[P_AMODE] = 0;
    }
    song.g[G_BPM] = 120;
    song.g[G_DUST] = 0, song.g[G_FILT] = 0, song.g[G_TXSRC] = 0;
    song.g[G_PFXT] = PT_MASTER, song.g[G_PFXL] = 0, song.g[G_PFXQ] = 0;
    for (i = LY_FX; i < LY_COUNT; i++)
        ly_bit[i] = 1u << (7u + i);
    fm1_in.notes = fm1_in.buttons = 0;
    kb_prev = 0;
    punch.req = -1;
    blocks(FS / CTL / 4u);                        /* (any effect faded out) */
}
static void fx_key(uint32_t k, int down)        /* FX held, key k down / up */
{
    fm1_in.buttons |= ly_bit[LY_FX];
    if (down)
        fm1_in.notes |= 1u << k;
    else
        fm1_in.notes &= ~(1u << k);
    block();
}

static void t_latch(void)
{
    uint32_t k0 = (uint32_t)punch_key_of_fx(PX_CRUSH), k1 = (uint32_t)punch_key_of_fx(PX_ECHO);
    reset();
    fx_key(k0, 1);
    check(punch.req == PX_CRUSH, "LATCH OFF: FX + a key: its effect");
    fx_key(k0, 0);
    check(punch.req < 0, "  .. the key let go: it ends (as before)");
    song.g[G_PFXL] = 1;
    fx_key(k0, 1), fx_key(k0, 0);
    fm1_in.buttons = 0;
    blocks(8);
    check(punch.req == PX_CRUSH, "LATCH ON: the key let go, FX let go: the effect stays");
    fx_key(k1, 1), fx_key(k1, 0);
    check(punch.req == PX_ECHO, "  .. another key: that effect instead");
    fx_key(k1, 1), fx_key(k1, 0);
    check(punch.req < 0, "  .. its key again: off");
    fm1_in.buttons = 0;
    {   /* the MIDI FX channel (GLO > MIDI 3 FX CH): a note turns it on, the same note again off; note-offs nothing */
        uint32_t n = 53u + k0;
        song.g[G_FXCH] = 3;
        midi_in(0x92u, n, 100);
        block();
        midi_in(0x82u, n, 0);
        block();
        check(punch.req == PX_CRUSH, "LATCH ON, MIDI FX channel: a note on, its note-off: the effect stays");
        midi_in(0x92u, n, 100);
        block();
        check(punch.req < 0, "  .. the same note again: off");
        song.g[G_FXCH] = 0;
    }
    song.g[G_PFXL] = 0;
}

static void t_quant(void)
{
    uint32_t k = (uint32_t)punch_key_of_fx(PX_GATE), b, start = 0, at;
    static const uint8_t Q[3] = {1, 3, 4};      /* 1/16, 1/4, BAR */
    static const uint32_t LINES[3] = {4, 1, 0};
    uint32_t qi;
    for (qi = 0; qi < 3u; qi++) {
        uint32_t line = LINES[qi] ? (uint32_t)FS * 60u / 120u / LINES[qi] : (uint32_t)FS * 60u / 120u * 4u;   /* samples */
        uint32_t p0;
        reset();
        song.g[G_PFXQ] = Q[qi];
        p0 = blk;                                   /* (the grid starts with the block PLAY is taken in) */
        transport_req = 1;
        block();
        blocks(beat_blocks(1) + line / CTL / 3u);   /* (into the second beat, a third of a line further) */
        at = blk;
        fx_key(k, 1);
        for (b = 0, start = 0; b < beat_blocks(5) && !start; b++) {
            if (punch.cur == PX_GATE)
                start = blk;
            block();
        }
        {
            uint64_t s0 = (uint64_t)(at - p0) * CTL, s1 = (uint64_t)(start - p0) * CTL, next = (s0 / line + 1u) * line;
            char what[96];
            snprintf(what, sizeof what, "Q %s: asked off the grid, it starts on the next line (%llu samples after the ask)",
                     N_PFXQ[Q[qi]], (unsigned long long)(s1 - s0));
            check(start && s1 >= next && s1 <= next + 2u * CTL, what);
        }
        fx_key(k, 0);
        block();
        check(punch.req < 0, "  .. let go: it ends at once");
    }
    reset();
    song.g[G_PFXQ] = 3;
    fx_key(k, 1);
    block();
    check(punch.cur == PX_GATE, "Q 1/4, stopped: at once");
    fx_key(k, 0);
}

static void t_target(void)
{
    uint32_t k = (uint32_t)punch_key_of_fx(PX_FADE), p_ref, p_drums, p_synths, p_master, p_sel, p_idle, p_idle_t;
    uint8_t n = 60;
    /* a synth on track 1 holding a long note; no drums playing */
    reset();
    trk[0].p[P_SUS] = 127;
    put_step(&trk[0], 0, 1, &n, ST_NOTE, 0);
    {
        uint32_t s;
        for (s = 1; s < 16u; s++)
            put_step(&trk[0], s, 0, 0, ST_TIE, 0);
    }
    trk[0].p[P_SGATE] = 127;
    transport_req = 1;
    blocks(beat_blocks(1));
    p_ref = peak_over(beat_blocks(1));
    p_idle = p_ref;
    song.g[G_PFXT] = PT_SYNTHS;                     /* idle, a target: nothing changes */
    p_idle_t = peak_over(beat_blocks(1));
    check(p_ref > 1000u && p_idle_t * 10u >= p_idle * 9u && p_idle_t * 10u <= p_idle * 11u,
          "idle, TARGET SYNTHS: the output as with MASTER (the bus summed back)");
    song.g[G_PFXT] = PT_DRUMS;
    song.g[G_PFXL] = 1;
    fx_key(k, 1), fx_key(k, 0);                     /* FADE OUT, latched, on the drums */
    fm1_in.buttons = 0;
    blocks(beat_blocks(3));
    p_drums = peak_over(beat_blocks(1));
    fx_key(k, 1), fx_key(k, 0);                     /* off */
    fm1_in.buttons = 0;
    blocks(beat_blocks(1));
    song.g[G_PFXT] = PT_SYNTHS;
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    blocks(beat_blocks(3));
    p_synths = peak_over(beat_blocks(1));
    song.g[G_PFXT] = PT_DRUMS;                      /* (changed while it plays: it keeps the synths until its end) */
    blocks(beat_blocks(1));
    {
        uint32_t still = peak_over(beat_blocks(1));
        check(still * 20u < p_ref, "TARGET changed while the effect plays: it keeps acting on the tracks it started on");
    }
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    blocks(beat_blocks(1));
    song.g[G_PFXT] = PT_MASTER;
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    blocks(beat_blocks(3));
    p_master = peak_over(beat_blocks(1));
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    blocks(beat_blocks(1));
    song.g[G_PFXT] = PT_SEL;
    song.sel = 1;                                  /* (track 2: silent) */
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    blocks(beat_blocks(3));
    p_sel = peak_over(beat_blocks(1));
    fx_key(k, 1), fx_key(k, 0);
    fm1_in.buttons = 0;
    printf("   peaks: alone %u, FADE on DRUMS %u, on SYNTHS %u, on MASTER %u, on SEL (track 2) %u\n", p_ref, p_drums, p_synths,
           p_master, p_sel);
    check(p_drums * 10u >= p_ref * 8u, "FADE OUT on the DRUMS: the synth sounds on");
    check(p_synths * 20u < p_ref, "FADE OUT on the SYNTHS: it is gone");
    check(p_master * 20u < p_ref, "FADE OUT on the MASTER: gone (as before)");
    check(p_sel * 10u >= p_ref * 8u, "FADE OUT on SEL = track 2 (silent): track 1 sounds on");
    transport_req = 2;
    blocks(FS / CTL);
    song.g[G_PFXL] = 0;
    song.g[G_PFXT] = PT_MASTER;
}

int main(void)
{
    host_tracks_init();                           /* (a tempo before the first block) */
    t_latch();
    t_quant();
    t_target();
    printf(fails ? "perf: %d FAILED\n" : "perf: all passed\n", fails);
    return fails != 0;
}
