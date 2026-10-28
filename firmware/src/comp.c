/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* Step components (core.h CP_*): rules on a step that change how it plays each time the sequencer reaches it.
 *   rhythm     PULSE (plays again on the next grid steps), HOLD (sounds on through them), MULT (hits inside the step)
 *   melody     RUP / RDN (a scale degree further each time), RAND (a random degree), TONE (semitones), PORTA, BEND
 *   dynamics   VEL (a velocity, with a random spread), PARAM (a random value of a parameter for the step)
 *   sequence   JUMP (go on at another step), and the play direction of the track (FWD, REV, PEND, RAND)
 *   conditions COND (A:B: on loop A of every B), TRIG (a chance)
 * comp_eval works out what a step does this time (a cp_ev_t) from its components, the track's component state and
 * its own random numbers; seq.c seq_tick plays that (the scheduling stays there: comp_eval starts no note). Both run
 * in the audio ISR on core 0 (events_block), a step at a time: at most NCOMP components looked at, no allocation, no
 * wait. The random numbers are the track's own (cp_rng, from cp_seed at every PLAY): the same seed plays the same
 * sequence, and rng() (libc.c) is not drawn, so the render's draws stay where they were. A step without a component
 * plays exactly as before, on the grid (PULSE, HOLD, JUMP and a direction other than FWD move the playhead off the
 * grid: comp_next). A note a component moves is the note started, so its note-off (seq_notes) is that note too. */

/* each type's values: a's range, b's range, and what a new one starts at */
static const int8_t CP_RANGE[CP_COUNT][6] = {
    /*            a min, a max, b min, b max, a, b */
    [CP_NONE] = {0, 0, 0, 0, 0, 0},
    [CP_PULSE] = {1, 8, 0, 0, 1, 0},
    [CP_HOLD] = {1, 16, 0, 0, 1, 0},
    [CP_MULT] = {2, 8, 0, 0, 2, 0},
    [CP_VEL] = {1, 127, 0, 64, 100, 0},
    [CP_RUP] = {1, 16, 1, 7, 3, 1},
    [CP_RDN] = {1, 16, 1, 7, 3, 1},
    [CP_RAND] = {1, 12, 0, 0, 2, 0},
    [CP_PORTA] = {1, 127, 0, 0, 40, 0},
    [CP_BEND] = {-12, 12, 0, 1, 2, 0},
    [CP_TONE] = {-24, 24, 0, 0, 12, 0},
    [CP_JUMP] = {1, NSTEP, 1, 16, 1, 1},
    [CP_PARAM] = {0, P_E7, 1, 100, P_ED_FLT, 25},
    [CP_COND] = {-8, 8, 1, 8, 1, 2},
    [CP_TRIG] = {1, 99, 0, 0, 50, 0},
};
static const char *const CP_NAME[CP_COUNT] = {"-", "PULSE", "HOLD", "MULT", "VEL", "RAMP+", "RAMP-", "RAND",
                                              "PORTA", "BEND", "TONE", "JUMP", "PARAM", "COND", "TRIG"};

/* a component that can be: its type known, a in range (COND: not 0; PARAM: a lockable parameter) */
static int comp_valid(uint32_t type, int32_t a, int32_t b)
{
    if (type == CP_NONE || type >= CP_COUNT || a < CP_RANGE[type][0] || a > CP_RANGE[type][1] ||
        b < CP_RANGE[type][2] || b > CP_RANGE[type][3])
        return 0;
    if (type == CP_COND && !a)
        return 0;
    if (type == CP_PARAM && !p_lockable((uint32_t)a))
        return 0;
    return 1;
}
static int32_t comp_clamp(uint32_t type, uint32_t which, int32_t v)   /* which 0: a, 1: b */
{
    type %= CP_COUNT;
    return clamp(v, CP_RANGE[type][2u * (which & 1u)], CP_RANGE[type][2u * (which & 1u) + 1u]);
}

/* ---- the list (the UI and the stores; callers that change it hold the IRQ off). A slot of type CP_NONE is free */
static int comp_find(const track_t *t, uint32_t step, uint32_t type)   /* its slot, -1: none */
{
    uint32_t k;
    for (k = 0; k < NCOMP; k++)
        if (t->comp[k].type != CP_NONE && t->comp[k].step == step && t->comp[k].type == type)
            return (int)k;
    return -1;
}
static int comp_free(const track_t *t)          /* a free slot, -1: none */
{
    uint32_t k;
    for (k = 0; k < NCOMP; k++)
        if (t->comp[k].type == CP_NONE)
            return (int)k;
    return -1;
}
/* set (or add) step's component of this type; 0: not valid, or no slot left */
static int comp_set(track_t *t, uint32_t step, uint32_t type, int32_t a, int32_t b)
{
    int k;
    if (step >= NSTEP || !comp_valid(type, a, b))
        return 0;
    if ((k = comp_find(t, step, type)) < 0) {
        if ((k = comp_free(t)) < 0)
            return 0;
        t->cp_ctr[k] = 0;                           /* (a new one counts from its start) */
    }
    t->comp[k].step = (uint8_t)step;
    t->comp[k].type = (uint8_t)type;
    t->comp[k].a = (int8_t)a;
    t->comp[k].b = (int8_t)b;
    return 1;
}
static void comp_del(track_t *t, uint32_t step, uint32_t type)   /* type CP_NONE: every one of the step */
{
    uint32_t k;
    for (k = 0; k < NCOMP; k++)
        if (t->comp[k].step == step && (type == CP_NONE || t->comp[k].type == type)) {
            t->comp[k].step = COMP_FREE;
            t->comp[k].type = CP_NONE;
            t->comp[k].a = t->comp[k].b = 0;
        }
}
static void comp_clear(track_t *t)             /* no component, the direction FWD (an empty pattern) */
{
    uint32_t k;
    for (k = 0; k < NCOMP; k++) {
        t->comp[k].step = COMP_FREE;
        t->comp[k].type = CP_NONE;
        t->comp[k].a = t->comp[k].b = 0;
    }
    t->cp_dir = DIR_FWD;
    t->cp_seed = 0;
}
static uint32_t comp_count(const track_t *t, uint32_t step)   /* step's components (NSTEP: the track's) */
{
    uint32_t k, n = 0;
    for (k = 0; k < NCOMP; k++)
        n += t->comp[k].type != CP_NONE && (step >= NSTEP || t->comp[k].step == step);
    return n;
}

/* ---- the runtime ---- */
static uint32_t comp_rnd(track_t *t, uint32_t n)  /* 0..n-1 (n >= 1), the track's own numbers */
{
    uint32_t x = t->cp_rng ? t->cp_rng : 0x6D2B79F5u;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    t->cp_rng = x;
    return (x >> 8) % n;
}
static void comp_reset(track_t *t)             /* PLAY (seq_reset_tracks): from the start, the seed's numbers again */
{
    t->cp_rng = ((uint32_t)t->cp_seed + 1u) * 0x9E3779B1u ^ (trk_index(t) + 1u) * 0x85EBCA77u;
    t->cp_adv = 0;
    t->cp_rep = t->cp_hold = t->cp_held = 0;
    t->cp_jump = -1;
    t->cp_back = t->cp_skip = t->cp_on = 0;
    t->cp_hits = t->cp_hdone = t->cp_vel = 0;
    t->cp_bend_a = 0;
    t->cp_bend_b = 0;
    t->cp_bend = 0;
    memset(t->cp_ctr, 0, sizeof t->cp_ctr);
}
static void comp_stop(track_t *t)              /* STOP: nothing of a component stays on the track's sound */
{
    t->cp_bend_a = 0;
    t->cp_bend = 0;
    t->cp_on = t->cp_held = t->cp_hits = t->cp_vel = 0;
}
/* the playhead leaves the grid: a direction other than FWD, a PULSE / HOLD / JUMP anywhere, or one still running */
static int comp_flow(const track_t *t)
{
    uint32_t k;
    if (t->cp_dir != DIR_FWD || t->cp_rep || t->cp_jump >= 0)
        return 1;
    for (k = 0; k < NCOMP; k++)
        if ((t->comp[k].type == CP_PULSE || t->comp[k].type == CP_HOLD || t->comp[k].type == CP_JUMP))
            return 1;
    return 0;
}
/* the step the playhead goes to now (comp_flow), from the one playing (seq_idx); *again: the same step once more
 * (a PULSE / HOLD repeat). first: PLAY (from the start: step 1, or the last one going back) */
static uint32_t comp_next(track_t *t, uint32_t len, int first, uint32_t *again)
{
    uint32_t i = t->seq_idx % len;
    *again = 0;
    if (first) {
        t->cp_rep = 0;
        t->cp_jump = -1;
        t->cp_back = 0;
        t->cp_adv = 0;
        return t->cp_dir == DIR_REV ? len - 1u : 0u;
    }
    if (t->cp_rep) {
        t->cp_rep--;
        *again = 1;
        return i;
    }
    t->cp_adv++;
    if (t->cp_jump >= 0) {
        i = (uint32_t)t->cp_jump % len;
        t->cp_jump = -1;
        return i;
    }
    switch (t->cp_dir) {
    case DIR_REV:
        return i ? i - 1u : len - 1u;
    case DIR_PEND:                                  /* 1 2 3 4 3 2 1 2 ..: the ends once */
        if (len < 2u)
            return 0;
        if (t->cp_back) {
            if (!i) {
                t->cp_back = 0;
                return 1;
            }
            return i - 1u;
        }
        if (i + 1u >= len) {
            t->cp_back = 1;
            return len - 2u;
        }
        return i + 1u;
    case DIR_RAND:
        return comp_rnd(t, len);
    default:
        return (i + 1u) % len;
    }
}

#define NCPAR 4u                                 /* PARAM / PORTA values one step sets at most */
typedef struct {                                 /* what a step does this time (comp_eval) */
    uint8_t skip;                                /* COND / TRIG: silent */
    uint8_t rep, hold;                           /* PULSE / HOLD: the grid steps it takes more; held */
    int8_t jump;                                 /* JUMP: the step after it, -1 none */
    uint8_t hits;                                /* MULT: 0 none */
    uint8_t vel;                                 /* VEL: 0 none */
    int8_t semi, deg;                            /* TONE: semitones; RUP / RDN / RAND: scale degrees */
    int8_t bend;                                 /* BEND: semitones, 0 none; bend_b its shape */
    uint8_t bend_b;
    uint8_t np, pabs;                            /* PARAM / PORTA: np values, bit j: pv[j] is the value (else an offset) */
    uint8_t pid[NCPAR];
    int16_t pv[NCPAR];
} cp_ev_t;
static uint32_t comp_loop(const track_t *t, uint32_t len) { return 1u + t->cp_adv / (len ? len : 1u); }
/* step idx's components, this time (again: a PULSE repeat: the conditions as the step had them, no PULSE / HOLD /
 * JUMP again; the melodic and random ones go on) */
static void comp_eval(track_t *t, uint32_t idx, uint32_t again, uint32_t len, cp_ev_t *ev)
{
    uint32_t k;
    memset(ev, 0, sizeof *ev);
    ev->jump = -1;
    if (again) {
        ev->skip = t->cp_skip;
    } else {
        for (k = 0; k < NCOMP && !ev->skip; k++) {
            const comp_t *c = &t->comp[k];
            if (c->step != idx)
                continue;
            if (c->type == CP_COND && c->b > 0) {
                uint32_t a = (uint32_t)(c->a < 0 ? -c->a : c->a), hit = (comp_loop(t, len) - 1u) % (uint32_t)c->b == a - 1u;
                ev->skip = (uint8_t)(c->a < 0 ? hit : !hit);
            } else if (c->type == CP_TRIG) {
                ev->skip = (uint8_t)(comp_rnd(t, 100) >= (uint32_t)c->a);
            }
        }
    }
    if (ev->skip)
        return;                                    /* (a silent step: none of the others) */
    for (k = 0; k < NCOMP; k++) {
        const comp_t *c = &t->comp[k];
        int32_t a = c->a, b = c->b, v;
        if (c->step != idx)
            continue;
        switch (c->type) {
        case CP_PULSE:
        case CP_HOLD:
            if (!again && a > 0) {
                ev->rep = (uint8_t)a;
                ev->hold = c->type == CP_HOLD;
            }
            break;
        case CP_JUMP:
            if (!again && a > 0 && ++t->cp_ctr[k] >= (b > 0 ? (uint32_t)b : 1u)) {
                t->cp_ctr[k] = 0;
                ev->jump = (int8_t)(a - 1);
            }
            break;
        case CP_MULT:
            ev->hits = (uint8_t)clamp(a, 2, 8);
            break;
        case CP_VEL:
            v = a + (b > 0 ? (int32_t)comp_rnd(t, 2u * (uint32_t)b + 1u) - b : 0);
            ev->vel = (uint8_t)clamp(v, 1, 127);
            break;
        case CP_RUP:
        case CP_RDN:
            if (a > 0) {
                v = (int32_t)(t->cp_ctr[k] % (uint32_t)(a + 1)) * (b > 0 ? b : 1);
                t->cp_ctr[k] = (uint8_t)((t->cp_ctr[k] + 1u) % (uint32_t)(a + 1));
                ev->deg = (int8_t)clamp(ev->deg + (c->type == CP_RUP ? v : -v), -100, 100);
            }
            break;
        case CP_RAND:
            if (a > 0)
                ev->deg = (int8_t)clamp(ev->deg + (int32_t)comp_rnd(t, 2u * (uint32_t)a + 1u) - a, -100, 100);
            break;
        case CP_TONE:
            ev->semi = (int8_t)clamp(ev->semi + a, -48, 48);
            break;
        case CP_BEND:
            ev->bend = (int8_t)a;
            ev->bend_b = (uint8_t)(b & 1);
            break;
        case CP_PORTA:
        case CP_PARAM:
            if (ev->np < NCPAR) {
                uint32_t j = ev->np++;
                if (c->type == CP_PORTA) {
                    ev->pid[j] = P_GLIDE;
                    ev->pv[j] = (int16_t)a;
                    ev->pabs |= (uint8_t)(1u << j);
                } else {
                    const param_desc_t *d = lock_desc(t, (uint32_t)a % P_COUNT);
                    int32_t w = (d->max - d->min) * b / 100;
                    ev->pid[j] = (uint8_t)a;
                    ev->pv[j] = (int16_t)(w > 0 ? (int32_t)comp_rnd(t, 2u * (uint32_t)w + 1u) - w : 0);
                }
            }
            break;
        default:
            break;
        }
    }
}
/* the scale the melodic components walk: the track's ROOT and SCALE (CHR: semitones) */
static uint32_t cp_mask(const track_t *t) { return scale_mask(t); }
static int32_t cp_root(const track_t *t) { return t->p[P_ROOT]; }
static uint32_t comp_note(const track_t *t, uint32_t note, const cp_ev_t *ev)   /* a note as the components play it */
{
    int32_t n = (int32_t)note + ev->semi, d = ev->deg, guard = 160;
    uint32_t mask = cp_mask(t) & 0xFFFu;
    int32_t root = cp_root(t);
    if (!mask)
        mask = 0xFFFu;
    while (d > 0 && guard-- && n < 140) {
        n++;
        if ((mask >> (uint32_t)((n - root + 1200) % 12)) & 1u)
            d--;
    }
    while (d < 0 && guard-- && n > -12) {
        n--;
        if ((mask >> (uint32_t)((n - root + 1200) % 12)) & 1u)
            d++;
    }
    return (uint32_t)clamp(n, 0, 127);
}
/* synth step s as it plays this time (into the track's copy cp_step): its notes moved, its velocity */
static void comp_apply(track_t *t, step_t *s, const cp_ev_t *ev)
{
    uint32_t i;
    if (s->time == ST_NOTE && (ev->semi || ev->deg))
        for (i = 0; i < s->n && i < 4u; i++)
            s->note[i] = (uint8_t)comp_note(t, s->note[i], ev);
    if (ev->vel) {
        s->vel = ev->vel;
        s->flags &= (uint8_t)~SF_ACCENT;
        s->lvl = 0;                                 /* (every note at that velocity: LV_NORM plays s->vel) */
    }
    if (ev->hits)
        s->rat = 0;                                 /* (MULT is the step's ratchet: cp_hits) */
}
/* BEND over the step playing, rel units into it of slen: 0 .. a semitones (b 0), or a .. 0 (b 1) */
static void comp_bend_tick(track_t *t, uint32_t rel, uint32_t slen)
{
    uint32_t q = slen >> 8, f;
    if (!t->cp_bend_a) {
        t->cp_bend = 0;
        return;
    }
    f = q ? rel / q : 256u;
    if (f > 256u)
        f = 256u;
    if (t->cp_bend_b)
        f = 256u - f;
    t->cp_bend = (int32_t)t->cp_bend_a * 4096 * (int32_t)f / 256;
}
/* the step after the one playing, as far as it is known now (seq_step: does the next one tie, the notes held to it):
 * on the grid the next one; a RAND direction's is not known (the same step: not a tie after a note) */
static uint32_t comp_peek(const track_t *t)
{
    uint32_t len = trk_len(t), i = t->seq_idx % len;
    if (!comp_flow(t))
        return (t->seq_idx + 1u) % len;
    if (t->cp_rep)
        return i;
    if (t->cp_jump >= 0)
        return (uint32_t)t->cp_jump % len;
    switch (t->cp_dir) {
    case DIR_REV:
        return i ? i - 1u : len - 1u;
    case DIR_PEND:
        return len < 2u ? 0u : t->cp_back ? (i ? i - 1u : 1u) : (i + 1u >= len ? len - 2u : i + 1u);
    case DIR_RAND:
        return i;
    default:
        return (i + 1u) % len;
    }
}
