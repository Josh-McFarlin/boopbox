/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Juan Ignacio Antonucci (Juan Jiant): the model and the harness, from JIANT FM's tests/vel_test.c */
/* (1.8) Host test of the keys' velocity and aftertouch (firmware/src/keyvel.c) through the key scan itself
 * (hal/fm1_input.h fm1_input_tick, its debounce and its PA7 / PA8 sampling; hal/fm1_adc.h), on modelled strikes (JIANT
 * FM's model of its owner's captures): the GPIO and the converter are memory; each modelled key has a pulled-up reading
 * (880 at the touch down to its seat, ~200, over its fall), a driven one (falling from 950 to its strike over the same
 * fall: a sample that catches it still falling reads high), its digital contact (closed under 600 pulled up) and, held,
 * a pressure (the driven reading going further down). Checked:
 *   1. all OFF (the default, an older settings byte): no converter access at all, every press 100 at its debounce,
 *      nothing held back: bit for bit as before 1.8; AFTERTOUCH alone: sampled, presses still 100 at once;
 *   2. the map: monotonic, through HARD 112 / NORMAL 76 / SOFT 36, 1..127; SOFT >= NORMAL >= HARD;
 *   3. modelled strikes: soft < normal < hard on several keys;
 *   4. the wait: 300 presses (falls 0.4 .. 10 ms), the note let through at most 2.2 ms (22 scan ticks) after its
 *      debounce, with 0 / 50 % of the conversions timing out; none on a drum track's keys; the top row no wait;
 *   5. the calibration: a key whose strikes sit 60 counts off the seeds converges; a graze learns nothing; VEL LEARN OFF
 *      nothing; kv_poll asks for a save 30 s after the last strike learnt, not before; saved and read back within the
 *      quantisation; none saved: the seeds;
 *   6. the pressure: a held key's reading under its strike, the dead zone none, more pressure more aftertouch, 0 let go;
 *      kv_at: the highest of the keys asked; AFTERTOUCH OFF none;
 *   7. MASTER read in its slot while sampling; the rows inputs whenever the scan reads them; off again: the main loop's.
 *   cc -O1 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/keyvel_test.c -o build/host/keyvel_test */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#pragma GCC diagnostic ignored "-Wint-to-pointer-cast"
static uint32_t host_now;                          /* TIMER4 ticks (24 MHz) */
#include "../firmware/hal/fm1_time.h"
#include "../firmware/hal/fm1_gpio.h"
static volatile uint32_t host_reg[16][64];         /* the GPIO registers, as memory */
static uint32_t host_rows_bad;                     /* rows read while one of PA7 / PA8 was not an input */
static volatile uint32_t *host_pr(uint32_t p, uint32_t r);
#undef FM1_PR
#define FM1_PR(p, r) (*host_pr((p), (r)))
static uint32_t host_ticks(void) { return host_now; }
#define fm1_ticks host_ticks
static uint32_t adc_con, adc_res, adc_wla, adc_writes;
static uint32_t *adc_reg(void) { adc_writes++; return &adc_con; }
#define FM1_ADC_CON (*adc_reg())
#define FM1_ADC_RES adc_res
#define FM1_WLA_CON0 adc_wla
static volatile uint32_t fm1_ms;
static void kv_sample(uint32_t key, uint32_t v, uint32_t driven, uint32_t now_ms);
static int kv_drive(uint32_t key);
static void host_note_on(uint32_t k);
static void kv_tick(void);
#define FM1_INPUT_ANALOG(col, rowbit, v, driven) kv_sample(fm1_an_note(col, rowbit), v, driven, fm1_ms)
#define FM1_INPUT_DRIVE(col, rowbit) kv_drive(fm1_an_note(col, rowbit))
#define FM1_INPUT_NOTE_ON(k) host_note_on(k)
#define FM1_INPUT_TICK() kv_tick()
#include "../firmware/hal/fm1_input.h"
#include "../firmware/src/keyvel.c"

static int fails;
static int check(const char *what, int ok)
{
    printf("keyvel: %-100s %s\n", what, ok ? "ok" : "FAIL");
    fails += !ok;
    return ok;
}

/* ---- the model: each key's readings at time t (us) */
typedef struct {
    int on;
    uint32_t t0, fall, hold;                       /* touch, touch -> landed, the press's length (us) */
    int32_t pseat, d;                              /* the pulled-up seat, the driven strike */
    int32_t at_d;                                  /* held: the driven reading this far under the strike .. */
    uint32_t at_t0, at_ramp;                       /* .. from at_t0 over at_ramp us */
    int32_t graze;                                 /* a graze: the pulled-up reading never under this */
} mkey_t;
static mkey_t model[27];
static uint32_t pot = 700, sim_us;
static int32_t model_v(uint32_t key, uint32_t t, int driven)
{
    const mkey_t *m = &model[key];
    uint32_t x;
    int32_t v;
    if (!m->on || t < m->t0 || t >= m->t0 + m->fall + m->hold)
        return 1023;
    x = t - m->t0;
    if (m->graze)
        return driven ? 1023 : m->graze;
    if (!driven)
        return x >= m->fall ? m->pseat : 880 - (880 - m->pseat) * (int32_t)x / (int32_t)m->fall;
    v = x >= m->fall ? m->d : 950 - (950 - m->d) * (int32_t)x / (int32_t)m->fall;
    if (m->at_d && t > m->at_t0)
        v -= t >= m->at_t0 + m->at_ramp ? m->at_d : m->at_d * (int32_t)(t - m->at_t0) / (int32_t)m->at_ramp;
    return v;
}
static int dig_closed(uint32_t key)               /* the digital contact; the top row (no converter): while held */
{
    if (key >= KV_NK)
        return model[key].on && sim_us >= model[key].t0 && sim_us < model[key].t0 + model[key].fall + model[key].hold;
    return model[key].on && model_v(key, sim_us, 0) < 600;
}
static volatile uint32_t *host_pr(uint32_t p, uint32_t r)
{
    static volatile uint32_t in;
    if (p == FM1_PA && r == FM1_IN) {
        uint32_t col = fm1__tick_col, rb, v = 0xFFFFFFFFu;
        if (~host_reg[FM1_PA][FM1_DIR / 4u] & ((1u << 7) | (1u << 8)))
            host_rows_bad++;
        for (rb = 2; rb <= 4u; rb++) {             /* PA6 PA7 PA8: the note keys' rows */
            int id = FM1_KEYMAP[rb][col];
            if (id >= 14 && dig_closed((uint32_t)id - 14u))
                v &= ~(1u << (rb + 4u));
        }
        in = v;
        return &in;
    }
    if (p == FM1_PB && r == FM1_IN) {
        in = 0xFFFFFFFFu;
        return &in;
    }
    return &host_reg[p & 15u][(r / 4u) & 63u];
}
static uint32_t adc_drop, drop_s = 777u;           /* this % of the conversions not done by the next tick */
static void adc_finish(void)
{
    uint32_t ch = (adc_con >> 8) & 15u, v;
    if (!(adc_con & 0x10u))
        return;
    drop_s = drop_s * 1103515245u + 12345u;
    if (adc_drop && (drop_s >> 8) % 100u < adc_drop)
        return;                                    /* (timed out: fm1__an_take drops it) */
    if (ch == FM1_ADC_MASTER)
        v = pot;
    else if (ch == FM1_ADC_BATT)
        v = 620;
    else {
        uint32_t key = fm1_an_note(fm1_an.col, fm1_an.rowbit), m = 1u << (fm1_an.rowbit == 3u ? 7 : 8);
        int driven = !(host_reg[FM1_PA][FM1_DIR / 4u] & m) && (host_reg[FM1_PA][FM1_OUT / 4u] & m);
        v = key < KV_NK ? (uint32_t)model_v(key, sim_us, driven) : 1023u;
    }
    adc_res = v;
    adc_con |= 0x80u;
}
/* the presses as the keys' block (seq.c) sees them: let through (fm1_in.notes & ~kv.hold) */
static uint32_t t_press[27], t_vis[27], vel_vis[27], vis_prev, n_vis, n_press;
static void host_note_on(uint32_t k)
{
    t_press[k] = sim_us;
    n_press++;
    kv_note_on(k);
}
static void tick(void)
{
    uint32_t vis, k;
    adc_finish();
    sim_us += 100u;
    host_now = sim_us * 24u;
    fm1_ms = sim_us / 1000u;
    fm1_input_tick();
    vis = fm1_in.notes & ~kv.hold;
    for (k = 0; k < 27u; k++)
        if ((vis & ~vis_prev) >> k & 1u) {
            t_vis[k] = sim_us;
            vel_vis[k] = KV_VEL(k);
            n_vis++;
        }
    vis_prev = vis;
}
static void run_ms(uint32_t ms)
{
    uint32_t i;
    for (i = 0; i < ms * 10u; i++)
        tick();
}
static uint32_t rnd_s = 12345u;
static uint32_t rnd(uint32_t n) { rnd_s = rnd_s * 1103515245u + 12345u; return (rnd_s >> 8) % n; }
/* one strike of key k: fall (us), strike d, held hold ms; then let go; returns the velocity the keys' block saw */
static uint32_t strike(uint32_t k, uint32_t fall, int32_t d, uint32_t hold)
{
    mkey_t *m = &model[k];
    memset(m, 0, sizeof *m);
    m->on = 1;
    m->t0 = sim_us + 300u;
    m->fall = fall < 100u ? 100u : fall;
    m->hold = hold * 1000u;
    m->pseat = 200;
    m->d = d;
    t_vis[k] = 0;
    vel_vis[k] = 0;
    run_ms(hold + fall / 1000u + 2u);
    m->on = 0;
    run_ms(25);
    return vel_vis[k];
}
static uint32_t drum_keys;
static int poll(void) { return kv_poll(drum_keys, fm1_in.notes, fm1_ms); }
static void settings(uint32_t vel, uint32_t at, uint32_t vib, uint32_t learn_off)
{
    kv_set = (uint8_t)(vel | at << 2 | vib << 4 | learn_off << 5);
    poll();
}

int main(void)
{
    uint32_t i, j, k;
    host_reg[FM1_PA][FM1_DIR / 4u] = 0xFFFFFFFFu;
    kv_cal_io(0, 0);                               /* (persist_boot: the seeds) */
    /* ---- 1. all off */
    poll();
    tick();
    adc_writes = 0;
    n_vis = n_press = 0;
    for (j = 0; j < 6u; j++)
        strike(j, 1500u + 1000u * j, 560 + 20 * (int32_t)j, 60);
    {
        uint32_t ok = n_vis == 6u && n_press == 6u;
        for (j = 0; j < 6u; j++)
            ok &= vel_vis[j] == 100u && t_vis[j] == t_press[j];
        check("1. all OFF (the default): no converter access, six presses each 100 at its debounce (as before 1.8)",
              ok && adc_writes == 0 && !fm1_an.on && !fm1_an.want && !kv.hold && !kv.on);
    }
    settings(KV_VOFF, 2, 0, 0);
    run_ms(5);
    strike(3, 1500u, 540, 60);
    check("   AFTERTOUCH alone: sampled, the press still 100 at its debounce", fm1_an.on && vel_vis[3] == 100u &&
          t_vis[3] == t_press[3]);

    /* ---- 2. the map */
    settings(KV_VNORM, 2, 0, 0);
    {
        uint32_t key = 14, prev = 200, mono = 1, d;
        int32_t h = kv.ref[key][0] >> 4, n = kv.ref[key][1] >> 4, s = kv.ref[key][2] >> 4;
        for (d = 300; d <= 1023u; d++) {
            uint32_t v = kv_map(key, d);
            if (d > 300u && v > prev)
                mono = 0;
            prev = v;
        }
        check("2. the map: monotonic", mono);
        check("   HARD 112, NORMAL 76, SOFT 36 at the key's references; 1..127",
              kv_map(key, (uint32_t)h) == 112u && kv_map(key, (uint32_t)n) == 76u && kv_map(key, (uint32_t)s) == 36u &&
              kv_map(key, 200) == 127u && kv_map(key, 1023) >= 1u);
        {
            uint32_t ok = 1, a, b, c;
            for (d = 300; d <= 1023u; d++) {
                kv.curve = KV_VSOFT; a = kv_map(key, d);
                kv.curve = KV_VNORM; b = kv_map(key, d);
                kv.curve = KV_VHARD; c = kv_map(key, d);
                ok &= a >= b && b >= c;
            }
            kv.curve = KV_VSOFT; a = kv_map(key, (uint32_t)n);
            kv.curve = KV_VHARD; c = kv_map(key, (uint32_t)n);
            kv.curve = KV_VNORM;
            check("   the curves: SOFT >= NORMAL >= HARD everywhere, apart at NORMAL", ok && a > 76u && c < 76u);
        }
    }

    /* ---- 3. modelled strikes */
    settings(KV_VNORM, 2, 0, 1);                   /* (VEL LEARN OFF: the seeds stay for this part) */
    {
        uint32_t ok = 1, keys[4] = {2, 7, 11, 16};
        for (j = 0; j < 4u; j++) {
            uint32_t s = strike(keys[j], 4000u, 690, 80), n = strike(keys[j], 2500u, 600, 80),
                     h = strike(keys[j], 800u, 545, 80);
            ok &= s && n && h && s < n && n < h;
            printf("keyvel:   key %u: soft %u, normal %u, hard %u\n", keys[j], s, n, h);
        }
        check("3. modelled strikes on four keys: soft < normal < hard", ok);
    }

    /* ---- 4. the wait */
    for (k = 0; k < 2u; k++) {
        uint32_t worst = 0, n = 0, ok = 1;
        adc_drop = k ? 50u : 0u;
        for (i = 0; i < 150u; i++) {
            uint32_t key = rnd(KV_NK), fall = 400u + rnd(9600u);
            strike(key, fall, 540 + (int32_t)rnd(160), 30);
            if (!t_vis[key] || !vel_vis[key]) {
                ok = 0;
                continue;
            }
            if (t_vis[key] - t_press[key] > worst)
                worst = t_vis[key] - t_press[key];
            n++;
        }
        printf("keyvel:   %u%% of the conversions timing out: the longest wait %u us\n", adc_drop, worst);
        check(k ? "4. ... with half the conversions timing out: still at most 2.2 ms, each with a velocity"
                : "4. 150 presses (falls 0.4 .. 10 ms): the note at most 2.2 ms after its debounce, each with a velocity",
              ok && n == 150u && worst <= 2200u);
    }
    adc_drop = 0;
    drum_keys = 0xFFFFFu;
    poll();
    {
        uint32_t ok = 1;
        for (i = 0; i < 20u; i++) {
            uint32_t key = rnd(KV_NK);
            strike(key, 400u + rnd(9600u), 600, 30);
            ok &= t_vis[key] == t_press[key] && vel_vis[key] >= 1u;
        }
        check("   a drum track's keys never wait (the velocity read so far, else the key's mean)", ok);
    }
    drum_keys = 0;
    poll();
    {
        uint32_t v = strike(22, 2000u, 600, 30);
        check("   the top row (no converter): no wait, the recent mean", t_vis[22] == t_press[22] && v == kv.mean);
    }

    /* ---- 5. the calibration */
    settings(KV_VNORM, 2, 0, 0);
    {
        uint32_t key = 5;
        int32_t n0 = kv.ref[key][1] >> 4, nn;
        uint8_t blob[KV_CAL_BYTES];
        uint16_t ref[3];
        int asked_early = 0, asked = 0;
        for (i = 0; i < 120u; i++) {
            strike(key, 2500u, n0 + 60 - 20 + (int32_t)rnd(41), 40);
            asked_early |= poll();
        }
        nn = kv.ref[key][1] >> 4;
        check("5. strikes 60 counts off the seeds: the key's NORMAL follows them (within 12)",
              nn >= n0 + 48 && nn <= n0 + 72 && kv.ref[key][0] < kv.ref[key][1] && kv.ref[key][1] < kv.ref[key][2]);
        run_ms(29000);
        asked_early |= poll();
        run_ms(1500);
        asked = poll();
        check("   kv_poll asks for a save 30 s after the last strike learnt, not before", !asked_early && asked);
        memcpy(ref, kv.ref[key], sizeof ref);
        kv_cal_io(blob, 1);
        kv_cal_io(0, 0);
        check("   none saved: the seeds", kv.ref[key][1] >> 4 == 594);
        kv_cal_io(blob, 0);
        check("   saved and read back: within the quantisation (NORMAL 8, the spans 16)",
              abs((int)(kv.ref[key][1] >> 4) - (int)(ref[1] >> 4)) <= 4 &&
              abs((int)(kv.ref[key][2] >> 4) - (int)(ref[2] >> 4)) <= 12 &&
              abs((int)(kv.ref[key][0] >> 4) - (int)(ref[0] >> 4)) <= 8);
        memcpy(ref, kv.ref[key], sizeof ref);
        {
            mkey_t *m = &model[key];
            memset(m, 0, sizeof *m);
            m->on = 1;
            m->t0 = sim_us + 300u;
            m->fall = 2000;
            m->hold = 30000;
            m->graze = 700;                    /* touched, never seated */
            run_ms(40);
            m->on = 0;
            run_ms(25);
        }
        check("   a graze learns nothing", !memcmp(ref, kv.ref[key], sizeof ref));
        settings(KV_VNORM, 2, 0, 1);
        for (i = 0; i < 10u; i++)
            strike(key, 2500u, 500, 40);
        check("   VEL LEARN OFF: nothing learnt", !memcmp(ref, kv.ref[key], sizeof ref));
    }

    /* ---- 6. the pressure */
    settings(KV_VNORM, 2, 0, 1);
    {
        mkey_t *m = &model[9];
        uint32_t a_rest, a_mid, a_hard, a_off;
        memset(m, 0, sizeof *m);
        m->on = 1;
        m->t0 = sim_us + 300u;
        m->fall = 2000;
        m->hold = 400000;
        m->pseat = 200;
        m->d = 600;
        run_ms(60);
        a_rest = kv_at(1u << 9);
        m->at_d = 4;                               /* a resting finger: inside the dead zone */
        m->at_t0 = sim_us;
        m->at_ramp = 1000;
        run_ms(60);
        a_rest = a_rest > kv_at(1u << 9) ? a_rest : kv_at(1u << 9);
        m->at_d = 30;
        m->at_t0 = sim_us;
        run_ms(80);
        a_mid = kv_at(1u << 9);
        m->at_d = 70;
        m->at_t0 = sim_us;
        run_ms(80);
        a_hard = kv_at(1u << 9 | 1u << 3);
        settings(KV_VNORM, 0, 0, 1);
        a_off = kv_at(1u << 9);
        settings(KV_VNORM, 2, 0, 1);
        m->on = 0;
        run_ms(30);
        printf("keyvel:   pressure: resting %u, 30 counts %u, 70 counts %u\n", a_rest, a_mid, a_hard);
        check("6. the pressure: none resting, more pressed harder, the highest of the keys asked, 0 let go, none OFF",
              a_rest == 0 && a_mid > 20u && a_hard > a_mid && kv_at(1u << 9) == 0 && a_off == 0);
    }

    /* ---- 7. the converter's owner */
    pot = 512;
    run_ms(10);
    check("7. MASTER read in its slot while sampling, the rows inputs whenever the scan reads them",
          fm1_adc_read(FM1_ADC_MASTER) == 512 && fm1_adc_read(FM1_ADC_BATT) == 620 && host_rows_bad == 0);
    settings(KV_VOFF, 0, 0, 0);
    run_ms(2);
    adc_writes = 0;
    run_ms(20);
    check("   all OFF again: the scan lets the converter go, no access from it", !fm1_an.on && adc_writes == 0);

    printf("keyvel: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
