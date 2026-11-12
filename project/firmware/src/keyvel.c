/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Juan Ignacio Antonucci (Juan Jiant): the velocity and pressure model, from JIANT FM's vel.c and
 * vel_diag.c (V10.6z6 .. V10.7.10). After Velo (Charles Vestal, github.com/charlesvestal/fm1-velocity, GPL-3.0: the
 * drive and the reading of the carbon pill are his findings). Ported to BoopBox in 1.8. */
/* (1.8) Key velocity and aftertouch on the FM-1's own keys, MENU > KEYS: VELOCITY (OFF, SOFT, NORMAL, HARD: the curve),
 * AFTERTOUCH (OFF, LOW, MID, HIGH: how much pressure), AT TARGET (FILTER or VIBRATO), VEL LEARN (ON, OFF; OCT+ on it
 * resets). All OFF by default: the scan then samples nothing and every key plays 100, bit for bit as before 1.8.
 *
 * No HAL here (the host tests include it on its own). The 20 keys F3..C5 sit on rows PA7 / PA8, which the converter can
 * read (hal/fm1_input.h, hal/fm1_adc.h fm1__an_*); the top row C#5..G5 has no converter and plays the mean of the recent
 * velocities. The FM-1's keys are a carbon pill under a rubber dome whose resistance falls as the key is pressed harder.
 * The scan samples each of the 20 every two frames (~2.2 ms) and hands every sample to kv_sample: 1023 open, lower the
 * harder; a key touched gets every other sample with its row driven high (a seated key then spreads 100..150 counts
 * between soft and firm, against 10..20 pulled up).
 *
 * Per key (the scan's ISR, kv_sample): OPEN; a pulled-up sample under KV_TOUCH: TOUCHED, its strike's window open; one
 * under KV_PRESS: DOWN (seated); two pulled-up samples in a row at KV_RELEASE or over (not seated yet: KV_TOUCH) OPEN
 * again (Velo's thresholds). The strike: the lowest driven reading from the touch to the first driven sample after the
 * key seated, or after its press was debounced, whichever comes first (JIANT's captures: the minimum of an early window
 * is the reliable measure, lower = harder). The digital scan debounces a press 1.1..2.2 ms after its contact closes; a
 * press whose window is still open then waits (kv_note_on: its bit held back from the keys' block, kv.hold), at most
 * KV_WAIT_T scan ticks (2.2 ms), then plays with the velocity read so far, else the key's recent mean. A key going to a
 * drum track never waits (a drum needs its hit on time).
 *
 * The velocity (kv_map): each key keeps three references, its HARD, NORMAL and SOFT strikes; the strike's reading maps
 * piecewise-linearly through them (HARD 112, NORMAL 76, SOFT 36, half the slope past either end, 1..127), then the
 * curve (SOFT: louder for less, v + v (127 - v) / 254; HARD: v - v (127 - v) / 254). The calibration (kv_lift, at a
 * seated key's release, VEL LEARN ON): each strike moves the key's references a step towards its own running
 * quantiles (HARD the 15th percentile, NORMAL the median, SOFT the 85th: sign steps no freak strike can throw; four
 * times larger for a key's first 24 strikes), kept 8 and 16 counts apart; seeded from JIANT's measured medians. Saved
 * in the settings' side record (project.c) 30 s after the last strike learnt, no key held, the transport stopped.
 *
 * The pressure: a held key's driven reading under its strike, past a dead zone (a resting finger does not move it):
 * (strike - reading) x 1 / 2 / 4 - 16, 0..127, smoothed a quarter of the way a driven sample, 0 when let go. A track's
 * aftertouch is its held keys' highest (seq.c kv_block), with MIDI channel pressure beside it (trk_at). */
#ifndef FM1_NCOL                        /* (the host tests: no HAL, the converter's owner as data) */
static volatile struct {
    uint8_t want, on, drive;
    int16_t master, batt;
} fm1_an;
#endif
#define KV_NK 20u                       /* the keys with a converter: F3..C5 */
#define KV_TOUCH 900u                   /* pulled-up readings (1023 open): touched, */
#define KV_PRESS 400u                   /* seated, */
#define KV_RELEASE 600u                 /* and two in a row from here up: let go */
#define KV_NONE 0xFFFFu
#define KV_WAIT_T 22u                   /* a press waits for its strike at most this many scan ticks (100 us each) */
#define KV_NOM_H 560
#define KV_NOM_N 594
#define KV_NOM_S 675
#define KV_DRIVE 2u                     /* fm1_an.drive: Velo's strength 1, the one calibrated */
#define KV_BARRIER() __asm__ volatile("" ::: "memory")
enum { KV_OPEN, KV_TOUCHED, KV_DOWN };
enum { KV_VOFF, KV_VSOFT, KV_VNORM, KV_VHARD };   /* kv_set bits 0-1: VELOCITY */
/* kv_set (the settings, project.c's MIDI part): bits 0-1 VELOCITY, 2-3 AFTERTOUCH (OFF LOW MID HIGH), bit 4 AT TARGET
 * (0 FILTER, 1 VIBRATO), bit 5 VEL LEARN OFF. 0: all off, as before 1.8 */
static uint8_t kv_set;
#define KV_VEL_MODE() (kv_set & 3u)
#define KV_AT_MODE() ((kv_set >> 2) & 3u)
#define KV_AT_VIB() ((kv_set >> 4) & 1u)
#define KV_LEARN() (!((kv_set >> 5) & 1u))

typedef struct {
    uint16_t dmin;                      /* the lowest driven reading since the touch */
    uint16_t strike;                    /* the strike (KV_NONE: the window still open): the pressure's zero */
    uint16_t vd;                        /* the reading the last velocity came from */
    uint8_t st, up, dnext, seated;      /* state; pulled-up samples let go; drive the next sample; seated this press */
    uint8_t pend;                       /* touched, the strike's window still open */
    uint8_t vel, at, km, n, cnt;        /* velocity so far; pressure; the recent strikes' mean; strikes learnt; wait */
} kv_key_t;
static struct {
    kv_key_t k[KV_NK];
    uint16_t ref[KV_NK][3];             /* each key's HARD, NORMAL, SOFT strike, 1/16 count */
    uint32_t hold;                      /* the presses waiting for their strike (held back from the keys' block) */
    uint32_t now;                       /* the keys whose press never waits (the main loop: a drum track) */
    uint32_t t;                         /* the last strike learnt (kv_ms) */
    uint8_t on;                         /* bit 0 VELOCITY on, bit 1 AFTERTOUCH on (the ISR's copy) */
    uint8_t curve, atr, learn, mean, dirty, cal;
    uint8_t velx[27];                   /* each key's press's velocity ^ 100 (0, as zeroed: 100) */
} kv;
#define KV_VEL(k) (kv.velx[(k) % 27u] ^ 100u)
/* the calibration in the settings' side record (project.c): 12 bits a key: NORMAL 400 + 8 n (6 bits), SOFT - NORMAL
 * 16 + 16 s, NORMAL - HARD 8 + 8 h (3 bits each); magic and CRC around it */
#define KV_CAL_BYTES 30u
#define KV_MAGIC 0x314C4556u           /* "VEL1" */

static __attribute__((noinline)) void kv_cal_reset(void)
{
    static const int8_t OFS[KV_NK] = {0, 0, 0, 0, 0, 0, 0, 15, 0, 77, -1, 0, 5, 0, 34, 0, 0, -31, 0, 0};   /* (JIANT's) */
    uint32_t k;
    for (k = 0; k < KV_NK; k++) {
        int32_t o = OFS[k];
        kv.ref[k][0] = (uint16_t)((KV_NOM_H + o) << 4);
        kv.ref[k][1] = (uint16_t)((KV_NOM_N + o) << 4);
        kv.ref[k][2] = (uint16_t)((KV_NOM_S + o) << 4);
        kv.k[k].n = 0;
    }
}

/* the velocity of key k's press now: 100 with VELOCITY OFF; its strike's so far, else the key's recent mean, else every
 * key's */
static uint32_t kv_vel_now(uint32_t k)
{
    if (!(kv.on & 1u))
        return 100u;
    if (k < KV_NK && (kv.k[k].vel || kv.k[k].km))
        return kv.k[k].vel ? kv.k[k].vel : kv.k[k].km;
    return kv.mean ? kv.mean : 100u;
}
/* the velocity of driven reading d on key key */
static __attribute__((noinline)) uint32_t kv_map(uint32_t key, uint32_t d)
{
    const uint16_t *r = kv.ref[key];
    int32_t x = (int32_t)d, j = x > r[1] >> 4, lo = r[j] >> 4, hi = r[j + 1] >> 4, ylo = j ? 76 : 112, yhi = j ? 36 : 76, v;
    v = ylo + (yhi - ylo) * (x - lo) / (hi - lo);
    if (x < lo || x > hi)
        v = (v + (x < lo ? ylo : yhi)) / 2;
    v = v < 1 ? 1 : v > 127 ? 127 : v;
    if (kv.curve & 1u)                          /* SOFT 1, HARD 3 */
        v += (kv.curve == KV_VSOFT ? 1 : -1) * v * (127 - v) / 254;
    return (uint32_t)v;
}

/* (ISR) key k's press let through to the keys' block (seq.c) with its velocity */
static __attribute__((noinline)) void kv_take(uint32_t k)
{
    kv.velx[k % 27u] = (uint8_t)(kv_vel_now(k) ^ 100u);
    KV_BARRIER();                               /* (the velocity before the press: the audio ISR may come between) */
    kv.hold &= ~(1u << k);
}
/* (the scan's ISR, FM1_INPUT_NOTE_ON) key k's press debounced, before its bit sets: its strike's window still open, it
 * waits (at most KV_WAIT_T ticks: kv_tick), else it plays now; a key going to a drum track never waits */
static __attribute__((noinline)) void kv_note_on(uint32_t k)
{
    if ((kv.on & 1u) && k < KV_NK && !((kv.now >> k) & 1u) && (kv.k[k].pend || kv.k[k].st == KV_OPEN)) {
        kv.k[k].cnt = KV_WAIT_T;
        kv.hold |= 1u << k;
        if (kv.k[k].st != KV_OPEN)
            kv.k[k].dnext = 1;                  /* (its next sample driven: the window closes there) */
    } else {
        kv_take(k);
    }
    KV_BARRIER();                               /* (before the caller sets the key's bit) */
}
/* (the scan's ISR, every tick, FM1_INPUT_TICK) a press waiting past KV_WAIT_T ticks plays with the velocity so far */
static __attribute__((noinline)) void kv_tick(void)
{
    uint32_t k;
    if (!kv.hold)
        return;
    for (k = 0; k < KV_NK; k++)
        if ((kv.hold >> k) & 1u && !--kv.k[k].cnt)
            kv_take(k);
}
/* (ISR) a driven reading v of key key, touched: the strike's window (closed once seated, or once its press waits), the
 * pressure's zero once seated, then the pressure */
static __attribute__((noinline)) void kv_driven(uint32_t key, kv_key_t *k, uint32_t v)
{
    int32_t t, a = k->at;
    if (v < k->dmin)
        k->dmin = (uint16_t)v;
    if (k->pend && kv.on) {
        uint32_t x = kv_map(key, k->dmin), w = (kv.hold >> key) & 1u;
        k->vel = (uint8_t)x;
        if (k->st == KV_DOWN || w) {            /* (closed) */
            k->pend = 0;
            k->vd = k->dmin;
            if (w)
                kv_take(key);
            kv.mean = (uint8_t)(((kv.mean ? kv.mean : 100u) * 7u + x + 4u) / 8u);
            k->km = (uint8_t)(k->km ? (k->km * 3u + x + 2u) / 4u : x);
        }
    }
    if (k->strike == KV_NONE) {
        if (k->st == KV_DOWN)
            k->strike = k->dmin;                /* (settled: the pressure's zero) */
        return;
    }
    if (!kv.atr)
        return;
    t = ((int32_t)k->strike - (int32_t)v) * (1 << kv.atr >> 1) - 16;   /* (LOW 1, MID 2, HIGH 4 a count) */
    t = t < 0 ? 0 : t > 127 ? 127 : t;
    k->at = (uint8_t)(a + (t - a + (t > a ? 3 : -3)) / 4);   /* (smoothed) */
}
/* (ISR) key let go: no pressure; a seated press moves its references by the reading its velocity came from */
static __attribute__((noinline)) void kv_lift(uint32_t key, kv_key_t *k, uint32_t now_ms)
{
    static const uint8_t DN[3] = {34, 16, 6}, UP[3] = {6, 16, 34};
    uint16_t *r = kv.ref[key];
    int32_t m = (int32_t)k->vd << 4, f = k->n < 24u ? 4 : 1, j, n;
    k->at = 0;
    if (!k->seated || k->pend || !kv.learn || !(kv.on & 1u))
        return;
    for (j = 0; j < 3; j++)
        r[j] = (uint16_t)(r[j] + (m < r[j] ? -DN[j] : UP[j]) * f);
    n = r[1];
    if (r[0] > n - (8 << 4))
        r[0] = (uint16_t)(n - (8 << 4));
    if (r[2] < n + (16 << 4))
        r[2] = (uint16_t)(n + (16 << 4));
    k->n = (uint8_t)(k->n + (k->n < 24u));
    kv.dirty = 1;
    kv.t = now_ms;
}

/* (the scan's ISR, FM1_INPUT_ANALOG) one sample of note key key (0..19; 20: none): v 0..1023; driven: taken with the
 * row driven high */
static void kv_sample(uint32_t key, uint32_t v, uint32_t driven, uint32_t now_ms)
{
    kv_key_t *k;
    if (key >= KV_NK)
        return;
    k = &kv.k[key];
    if (driven) {                               /* only the force: no state change (a driven graze reads open too) */
        k->dnext = 0;
        if (k->st != KV_OPEN)
            kv_driven(key, k, v);
        return;
    }
    if (k->st == KV_OPEN && v < KV_TOUCH) {
        k->st = KV_TOUCHED;
        k->dmin = k->strike = (uint16_t)KV_NONE;
        k->up = k->seated = 0;
        k->pend = 1;                            /* (the strike's window open) */
        k->vel = k->at = 0;
    }
    if (k->st != KV_OPEN) {
        if (k->st == KV_TOUCHED && v < KV_PRESS) {
            k->st = KV_DOWN;
            k->seated = 1;
        }
        if (v < (k->st == KV_DOWN ? KV_RELEASE : KV_TOUCH)) {
            k->up = 0;
        } else if (++k->up >= 2u) {             /* let go */
            k->st = KV_OPEN;
            kv_lift(key, k, now_ms);
        }
    }
    k->dnext = k->st != KV_OPEN;                /* touched or held: the next sample driven */
}
/* (the scan's ISR, FM1_INPUT_DRIVE) drive the next sample of note key key? */
static int kv_drive(uint32_t key) { return key < KV_NK && kv.k[key].dnext; }

/* ---------------------------------------------------------------- main loop --- */
/* x (counts) as a field: (x - lo) / 2^sh rounded, 0..top */
static int32_t kv_q(int32_t x, int32_t lo, int32_t sh, int32_t top)
{
    x = (x - lo + (1 << sh >> 1)) >> sh;
    return x < 0 ? 0 : x > top ? top : x;
}
/* the calibration into c (KV_CAL_BYTES), or out of it (put 0; 0 c: the seeds) */
static __attribute__((noinline)) void kv_cal_io(uint8_t *c, uint32_t put)
{
    uint32_t k;
    if (!put)
        kv_cal_reset();
    else
        memset(c, 0, KV_CAL_BYTES);
    for (k = 0; k < KV_NK && c; k++) {
        uint16_t *r = kv.ref[k];
        uint8_t *b = &c[k * 3u / 2u];
        uint32_t sh = (k & 1u) * 4u, w = b[0] | (uint32_t)b[1] << 8, f;
        int32_t n = r[1] >> 4;
        if (put) {
            f = (uint32_t)(kv_q(n, 400, 3, 63) | kv_q((r[2] >> 4) - n, 16, 4, 7) << 6 | kv_q(n - (r[0] >> 4), 8, 3, 7) << 9);
            w |= f << sh;
            b[0] = (uint8_t)w;
            b[1] = (uint8_t)(w >> 8);
        } else {
            f = w >> sh;
            n = (int32_t)(400u + ((f & 63u) << 3)) << 4;
            r[1] = (uint16_t)n;
            r[2] = (uint16_t)(n + ((16 + (int32_t)((f >> 2) & 0x70u)) << 4));
            r[0] = (uint16_t)(n - ((8 + (int32_t)((f >> 6) & 0x38u)) << 4));
            kv.k[k].n = 24;
        }
    }
}
/* every main-loop pass: the settings into the ISR's copies, the sampling on or off (fm1_an), the drum keys that never
 * wait; 1 when the learnt calibration should be saved now (learnt, 30 s quiet, no key held) */
static int kv_poll(uint32_t drum_keys, uint32_t keys_held, uint32_t now_ms)
{
    uint32_t on = (KV_VEL_MODE() != KV_VOFF) | (uint32_t)(KV_AT_MODE() != 0u) << 1;
    kv.curve = (uint8_t)KV_VEL_MODE();
    kv.atr = (uint8_t)KV_AT_MODE();
    kv.learn = (uint8_t)KV_LEARN();
    kv.now = drum_keys;
    if (on != kv.on) {
        if (!kv.on) {                           /* (a fresh start: nothing from before) */
            uint32_t k;
            for (k = 0; k < KV_NK; k++)
                kv.k[k].st = KV_OPEN, kv.k[k].pend = kv.k[k].at = kv.k[k].dnext = 0;
            fm1_an.master = fm1_an.batt = -1;   /* (until the scan's first readings) */
        }
        kv.on = (uint8_t)on;
        kv.hold = 0;                            /* (no press left waiting) */
        fm1_an.drive = (uint8_t)KV_DRIVE;
        fm1_an.want = (uint8_t)(on != 0u);
        if (on)
            fm1_an.on = 1;
    }
    if (kv.dirty && now_ms - kv.t >= 30000u && !keys_held) {
        kv.dirty = 0;
        return 1;
    }
    return 0;
}
/* the aftertouch of the keys in mask (0..127: the highest) */
static uint32_t kv_at(uint32_t mask)
{
    uint32_t k, a = 0;
    if (!(kv.on & 2u))
        return 0;
    for (k = 0; k < KV_NK; k++)
        if ((mask >> k) & 1u && kv.k[k].at > a)
            a = kv.k[k].at;
    return a;
}
