/* SPDX-License-Identifier: GPL-3.0-only */
/* (1.8) The key velocity and aftertouch in the sequencer (seq.c keyboard_block, key_down, kv_block; voice.c): a synth
 * key plays and sends out its velocity; with VELOCITY OFF every key 100, as before; a drum key's velocity picks its hit
 * level (GHOST .. HARD) unless OCT- / OCT+ is held; a press held back for its strike plays once let through; MIDI
 * channel pressure in sets the track's aftertouch, the keys' pressure too, the higher of the two; key pressure goes out
 * as channel pressure; the aftertouch opens the filter (FILTER) or moves the pitch (VIBRATO) and nothing at 0.
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/keyvel_seq_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

static int fails;
static void check(int ok, const char *what)
{
    printf("keyvel_seq: %-96s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static int32_t out[CTL * 2];
static void block(void) { mix_block(out, CTL); }
static void blocks(uint32_t n) { while (n--) block(); }
static void midi_in(uint32_t st, uint32_t d1, uint32_t d2)
{
    if (mi_w - mi_r >= MQ) return;
    midi_in_q[mi_w % MQ] = ((st >> 4) & 15u) | st << 8 | d1 << 16 | d2 << 24;
    mi_w++;
}
/* the last MIDI OUT event of status st (0: none) */
static uint32_t out_last(uint32_t st)
{
    uint32_t i, p = 0;
    for (i = mo_r; i != mo_w; i++)
        if (((midi_out_q[i % MQ] >> 8) & 0xF0u) == st)
            p = midi_out_q[i % MQ];
    return p;
}
static void press(uint32_t k, uint32_t vel)
{
    kv.velx[k] = (uint8_t)(vel ^ 100u);
    fm1_in.notes |= 1u << k;
    blocks(2);
}
static void lift(uint32_t k)
{
    fm1_in.notes &= ~(1u << k);
    blocks(4);
}
static uint32_t synth_trk(void)
{
    uint32_t i;
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i]))
            return i;
    return 0;
}
static uint32_t drum_trk(void)
{
    uint32_t i;
    for (i = 0; i < NTRK; i++)
        if (is_drum(&trk[i]))
            return i;
    return 0;
}
static int64_t energy(void)
{
    int64_t e = 0;
    uint32_t i, b;
    for (b = 0; b < 40u; b++) {
        block();
        for (i = 0; i < CTL * 2u; i++)
            e += (int64_t)out[i] * out[i] >> 8;
    }
    return e;
}

int main(void)
{
    uint32_t s, d, p;
    host_tracks_init();
    usb.config = 1;                                     /* (MIDI OUT queues only with a host) */
    s = synth_trk();
    d = drum_trk();
    song.sel = (uint8_t)s;
    kv_cal_io(0, 0);

    /* velocity off: 100, whatever velx says (kv_take writes 100 then) */
    kv.on = 0;
    kv.velx[7] = 0;
    press(7, 100);
    p = out_last(0x90u);
    check(p && (p >> 24) == 100u, "VELOCITY OFF: a synth key plays and sends 100, as before");
    lift(7);

    kv.on = 1;
    mo_r = mo_w;
    press(7, 37);
    p = out_last(0x90u);
    check(p && (p >> 24) == 37u, "VELOCITY on: the key's velocity goes out (37)");
    {
        uint32_t i, hit = 0;
        for (i = 0; i < NVOICE; i++)
            hit |= trk[s].v[i].active && trk[s].v[i].vel == 37u;
        check(hit, "... and plays the voice at 37");
    }
    lift(7);

    kv.hold = 1u << 9;                                  /* a press waiting for its strike: not yet */
    mo_r = mo_w;
    press(9, 90);
    check(!out_last(0x90u), "a press held back for its strike: nothing yet");
    kv.hold = 0;
    blocks(2);
    p = out_last(0x90u);
    check(p && (p >> 24) == 90u, "... let through: plays with its velocity");
    lift(9);

    song.sel = (uint8_t)d;                              /* the drum track */
    {
        static const uint8_t V[4] = {30, 70, 100, 125};
        static const uint8_t L[4] = {42, 72, 100, 127};
        uint32_t i, ok = 1;
        for (i = 0; i < 4u; i++) {
            mo_r = mo_w;
            press(0, V[i]);
            p = out_last(0x90u);
            ok &= p && (p >> 24) == L[i];
            lift(0);
        }
        check(ok, "a drum key: its velocity picks the hit level (GHOST SOFT NORM HARD go out 42 72 100 127)");
    }
    song.sel = (uint8_t)s;

    /* aftertouch: MIDI channel pressure, the keys' */
    kv.on = 0;
    midi_in(0xD0u | trk_midi_ch(s), 90, 0);
    blocks(2);
    check(trk_at[s] == 90u, "MIDI channel pressure on the track's channel: its aftertouch (90)");
    kv.on = 3;
    kv.k[7].at = 110;
    kv.velx[7] = 0;
    mo_r = mo_w;
    press(7, 100);
    check(trk_at[s] == 110u, "a held key's pressure: the higher of it and the MIDI pressure (110)");
    p = out_last(0xD0u);
    check(p && ((p >> 16) & 127u) == 110u, "... and goes out as channel pressure");
    kv.k[7].at = 0;
    lift(7);
    check(trk_at[s] == 90u, "let go: the MIDI pressure again");
    midi_in(0xD0u | trk_midi_ch(s), 0, 0);
    blocks(2);
    check(trk_at[s] == 0u, "MIDI pressure 0: none");

    /* the sound: one block rendered three times from the same state (the tracks and the engines' arenas): pressure 0,
     * FILTER 127, VIBRATO 127 */
    {
        static track_t tsave[NTRK];
        static eng_arena_t asave[NARENA];
        static int32_t r0[CTL], r1[CTL], r2[CTL], r3[CTL];
        uint32_t i;
        kv.on = 0;
        for (i = 0; i < NTRK; i++)
            trk_at[i] = midi_at[i] = 0;
        trk[s].p[P_LRATE] = 100;                        /* (an LFO that moves within a block or two) */
        fm1_in.notes |= 1u << 5;
        blocks(20);
        memcpy(tsave, trk, sizeof trk);
        memcpy(asave, eng_arena, sizeof eng_arena);
#define RENDER(buf, at, vib) do { memcpy(trk, tsave, sizeof trk); memcpy(eng_arena, asave, sizeof eng_arena); \
        trk_at[s] = (at); at_vib = (vib); track_render(&trk[s], buf, CTL); trk_at[s] = 0; } while (0)
        RENDER(r0, 0, 0);
        RENDER(r1, 127, 0);
        RENDER(r2, 127, 1);
        RENDER(r3, 0, 1);
#undef RENDER
        memcpy(trk, tsave, sizeof trk);
        memcpy(eng_arena, asave, sizeof eng_arena);
        check(memcmp(r0, r1, sizeof r0) != 0, "aftertouch FILTER changes the sound");
        check(memcmp(r0, r2, sizeof r0) != 0 && memcmp(r1, r2, sizeof r1) != 0, "aftertouch VIBRATO changes it otherwise");
        check(memcmp(r0, r3, sizeof r0) == 0, "at 0 nothing changes, bit for bit");
        fm1_in.notes = 0;
        blocks(10);
    }

    printf("keyvel_seq: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
