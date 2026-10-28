/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* The pattern codec: a byte writer and reader (pw_t, pr_t: a value one byte, or 0x80 and two) and a track's pattern
 * as bytes (pat_put, pat_get): format 7's projects (project.c) and the pattern bank (patbank.c) keep patterns this
 * way. Included by seq.c (after comp.c): the audio ISR switches patterns with it. Bounded: a pattern is at most
 * ~1 KB of bytes, every loop over its 64 steps, NLOCK locks and NCOMP components; nothing allocated; a reader never
 * reads past its end (pr_t.bad). */
typedef struct { uint8_t *b; uint32_t n, max; } pw_t;   /* a writer: n counts on past max (the size, nothing written) */
UI_SMALL static __attribute__((noinline)) void pw_u8(pw_t *w, uint32_t v)
{
    if (w->n < w->max)
        w->b[w->n] = (uint8_t)v;
    w->n++;
}
UI_SMALL static __attribute__((noinline)) void pw_v(pw_t *w, int32_t v)
{
    if (v >= -127 && v <= 127) {
        pw_u8(w, (uint32_t)v & 0xFFu);
    } else {
        pw_u8(w, 0x80u);
        pw_u8(w, (uint32_t)v & 0xFFu);
        pw_u8(w, ((uint32_t)v >> 8) & 0xFFu);
    }
}
static uint32_t pw_open(pw_t *w, uint32_t tag)          /* a chunk: its length is written by pw_close */
{
    pw_u8(w, tag);
    pw_u8(w, 0);
    pw_u8(w, 0);
    return w->n;
}
static void pw_close(pw_t *w, uint32_t at)
{
    uint32_t len = w->n - at;
    if (at - 2u < w->max)
        w->b[at - 2u] = (uint8_t)len;
    if (at - 1u < w->max)
        w->b[at - 1u] = (uint8_t)(len >> 8);
}
typedef struct { const uint8_t *b; uint32_t n, i; uint8_t bad; } pr_t;   /* a reader: never past n */
UI_SMALL static __attribute__((noinline)) uint32_t pr_u8(pr_t *r)
{
    if (r->i >= r->n) {
        r->bad = 1;
        return 0;
    }
    return r->b[r->i++];
}
UI_SMALL static __attribute__((noinline)) int32_t pr_v(pr_t *r)
{
    uint32_t v = pr_u8(r);
    if (v != 0x80u)
        return (int8_t)v;
    v = pr_u8(r);
    v |= pr_u8(r) << 8;
    return (int16_t)v;
}

/* a track's pattern (its steps, nudges and fill conditions, parameter locks, step components): each of the first two
 * sparse (a bit per step it holds something on, then those) or whole, whichever is smaller. The components last:
 * the direction, the seed, their count, each one's step, type and values, in the order of the list (the order
 * comp_eval draws its random numbers in); a pattern written before them has none (FWD) */
UI_SMALL static __attribute__((noinline)) int step_blank(const track_t *t, uint32_t k)    /* as steps_clear leaves it */
{
    const uint8_t *b = (const uint8_t *)&t->step[k];
    uint32_t i;
    for (i = 0; i < sizeof(step_t); i++)
        if (b[i] != (!is_drum(t) && i == __builtin_offsetof(step_t, time) ? ST_REST : 0u))
            return 0;
    return 1;
}
UI_SMALL static __attribute__((noinline)) uint32_t step_size(const track_t *t, uint32_t k) /* the bytes step_put takes */
{
    if (is_drum(t)) {
        const dstep_t *d = &t->dstep[k];
        return 3u + ((d->lvl[0] | d->lvl[1] | d->lvl[2] | d->lvl[3]) ? 4u : 0u) +
               ((d->rat[0] | d->rat[1] | d->rat[2] | d->rat[3]) ? 4u : 0u);
    } else {
        const step_t *s = &t->step[k];
        uint32_t j, n = s->n > 4u ? 4u : s->n, all4 = s->n > 4u;
        for (j = n; j < 4u; j++)
            all4 |= s->note[j] != 0u;
        return 1u + (all4 || s->lvl || s->rat ? 1u : 0u) + (all4 ? 4u : n) + (s->flags != 0u) + (s->vel != 0u) +
               (s->lvl != 0u) + (s->rat != 0u);
    }
}
UI_SMALL static __attribute__((noinline)) void step_put(pw_t *w, const track_t *t, uint32_t k)
{
    uint32_t j;
    if (is_drum(t)) {
        const dstep_t *d = &t->dstep[k];
        uint32_t l = (d->lvl[0] | d->lvl[1] | d->lvl[2] | d->lvl[3]) != 0u, r = (d->rat[0] | d->rat[1] | d->rat[2] | d->rat[3]) != 0u;
        pw_u8(w, d->on[0]);
        pw_u8(w, d->on[1]);
        pw_u8(w, l | r << 1);
        for (j = 0; l && j < 4u; j++)
            pw_u8(w, d->lvl[j]);
        for (j = 0; r && j < 4u; j++)
            pw_u8(w, d->rat[j]);
    } else {
        const step_t *s = &t->step[k];
        uint32_t n = s->n > 4u ? 4u : s->n, all4 = s->n > 4u, x;
        for (j = n; j < 4u; j++)
            all4 |= s->note[j] != 0u;
        x = all4 || s->lvl || s->rat;
        pw_u8(w, (s->n & 7u) | (s->time & 3u) << 3 | (s->flags != 0u) << 5 | (s->vel != 0u) << 6 | x << 7);
        if (x)
            pw_u8(w, (s->lvl != 0u) | (s->rat != 0u) << 1 | all4 << 2);
        for (j = 0; j < (all4 ? 4u : n); j++)
            pw_u8(w, s->note[j]);
        if (s->flags)
            pw_u8(w, s->flags);
        if (s->vel)
            pw_u8(w, s->vel);
        if (s->lvl)
            pw_u8(w, s->lvl);
        if (s->rat)
            pw_u8(w, s->rat);
    }
}
UI_SMALL static __attribute__((noinline)) void step_get(pr_t *r, track_t *t, uint32_t k)
{
    uint32_t j;
    if (is_drum(t)) {
        dstep_t *d = &t->dstep[k];
        uint32_t m;
        memset(d, 0, sizeof *d);
        d->on[0] = (uint8_t)pr_u8(r);
        d->on[1] = (uint8_t)pr_u8(r);
        m = pr_u8(r);
        for (j = 0; (m & 1u) && j < 4u; j++)
            d->lvl[j] = (uint8_t)pr_u8(r);
        for (j = 0; (m & 2u) && j < 4u; j++)
            d->rat[j] = (uint8_t)pr_u8(r);
    } else {
        step_t *s = &t->step[k];
        uint32_t b = pr_u8(r), x = (b >> 7) ? pr_u8(r) : 0u, n = b & 7u;
        memset(s, 0, sizeof *s);
        s->n = (uint8_t)(n > 4u ? 4u : n);
        s->time = (uint8_t)((b >> 3) & 3u);
        if (s->time > ST_REST)
            s->time = ST_REST;
        for (j = 0; j < ((x & 4u) ? 4u : (n > 4u ? 4u : n)); j++)
            s->note[j] = (uint8_t)(pr_u8(r) & 127u);
        if (b & 0x20u)
            s->flags = (uint8_t)pr_u8(r);
        if (b & 0x40u)
            s->vel = (uint8_t)pr_u8(r);
        if (x & 1u)
            s->lvl = (uint8_t)pr_u8(r);
        if (x & 2u)
            s->rat = (uint8_t)pr_u8(r);
    }
}
static uint32_t step_mf(const track_t *t, uint32_t k)  /* a step's nudge (6 bits) | its fill condition << 6 (format 6's) */
{
    return ((uint32_t)t->micro[k] & 63u) | step_fill(t, k) << 6;
}
static uint32_t lock_code(uint32_t id) { return id < P_E0 ? id : 0xF0u + (id - P_E0); }   /* (P_E0 moves: see 'T') */
static uint32_t lock_id(uint32_t code) { return code >= 0xF0u ? (code - 0xF0u < 8u ? P_E0 + code - 0xF0u : P_COUNT) : code < P_E0 ? code : P_COUNT; }
UI_SMALL static __attribute__((noinline)) void pat_put(pw_t *w, const track_t *t)
{
    uint8_t map[NSTEP / 8];
    uint32_t k, sz = NSTEP / 8, nl = 0;
    memset(map, 0, sizeof map);
    for (k = 0; k < NSTEP; k++)
        if (!step_blank(t, k)) {
            map[k / 8u] |= (uint8_t)(1u << (k % 8u));
            sz += step_size(t, k);
        }
    if (sz < sizeof t->step) {                          /* the steps: 0 sparse */
        pw_u8(w, 0);
        for (k = 0; k < sizeof map; k++)
            pw_u8(w, map[k]);
        for (k = 0; k < NSTEP; k++)
            if ((map[k / 8u] >> (k % 8u)) & 1u)
                step_put(w, t, k);
    } else {                                            /* 1: whole */
        const uint8_t *b = (const uint8_t *)t->step;
        pw_u8(w, 1);
        for (k = 0; k < sizeof t->step; k++)
            pw_u8(w, b[k]);
    }
    memset(map, 0, sizeof map);                          /* the nudges and conditions: 0 none, 1 sparse, 2 whole */
    for (k = 0, sz = NSTEP / 8; k < NSTEP; k++)
        if (step_mf(t, k)) {
            map[k / 8u] |= (uint8_t)(1u << (k % 8u));
            sz++;
        }
    if (sz == NSTEP / 8) {
        pw_u8(w, 0);
    } else if (sz < NSTEP) {
        pw_u8(w, 1);
        for (k = 0; k < sizeof map; k++)
            pw_u8(w, map[k]);
        for (k = 0; k < NSTEP; k++)
            if ((map[k / 8u] >> (k % 8u)) & 1u)
                pw_u8(w, step_mf(t, k));
    } else {
        pw_u8(w, 2);
        for (k = 0; k < NSTEP; k++)
            pw_u8(w, step_mf(t, k));
    }
    for (k = 0; k < NLOCK; k++)                          /* the locks */
        nl += t->lock[k].step != LOCK_FREE;
    pw_u8(w, nl);
    for (k = 0; k < NLOCK; k++)
        if (t->lock[k].step != LOCK_FREE) {
            pw_u8(w, t->lock[k].step | (t->lock[k].param & LOCK_SLIDE));   /* (the step < 64: bit 7 its SLIDE) */
            pw_u8(w, lock_code(t->lock[k].param & LOCK_PID));
            pw_v(w, t->lock[k].val);
        }
    pw_u8(w, t->cp_dir);                                 /* the components */
    pw_u8(w, t->cp_seed);
    pw_u8(w, comp_count(t, NSTEP));
    for (k = 0; k < NCOMP; k++)
        if (t->comp[k].type != CP_NONE) {
            const comp_t *c = &t->comp[k];
            pw_u8(w, c->step);
            pw_u8(w, c->type == CP_PARAM ? CP_PARAM | 0x80u : c->type);   /* (PARAM's a: a parameter, coded as a lock's) */
            pw_u8(w, c->type == CP_PARAM ? lock_code((uint32_t)c->a) : (uint32_t)c->a & 0xFFu);
            pw_u8(w, (uint32_t)c->b & 0xFFu);
        }
}
UI_SMALL static __attribute__((noinline)) void pat_get(pr_t *r, track_t *t)
{
    uint32_t k, m, n;
    uint8_t map[NSTEP / 8];
    steps_clear(t);                                     /* (no step, nudge, condition or lock but what follows) */
    m = pr_u8(r);
    if (m == 1u) {
        uint8_t *b = (uint8_t *)t->step;
        for (k = 0; k < sizeof t->step; k++)
            b[k] = (uint8_t)pr_u8(r);
        if (!is_drum(t))
            for (k = 0; k < NSTEP; k++) {
                step_t *st = &t->step[k];
                uint32_t j;
                if (st->n > 4u)
                    st->n = 4;
                if (st->time > ST_REST)
                    st->time = ST_REST;
                for (j = 0; j < 4u; j++)
                    st->note[j] &= 127u;
            }
    } else {
        for (k = 0; k < sizeof map; k++)
            map[k] = (uint8_t)pr_u8(r);
        for (k = 0; k < NSTEP && !r->bad; k++)
            if ((map[k / 8u] >> (k % 8u)) & 1u)
                step_get(r, t, k);
    }
    m = pr_u8(r);
    if (m) {
        memset(map, 0xFF, sizeof map);
        if (m == 1u)
            for (k = 0; k < sizeof map; k++)
                map[k] = (uint8_t)pr_u8(r);
        for (k = 0; k < NSTEP && !r->bad; k++)
            if ((map[k / 8u] >> (k % 8u)) & 1u) {
                uint32_t v = pr_u8(r), c = v >> 6;
                int32_t mi = (int32_t)(v & 63u);
                t->micro[k] = (int8_t)clamp(mi >= 32 ? mi - 64 : mi, MICRO_MIN, MICRO_MAX);
                if (c != 3u)
                    t->fill[k / 4u] |= (uint8_t)(c << (2u * (k % 4u)));
            }
    }
    n = pr_u8(r);
    for (k = 0; k < n && !r->bad; k++) {
        uint32_t st = pr_u8(r), id = lock_id(pr_u8(r)), j, sl = st & LOCK_SLIDE;
        int32_t v = pr_v(r);
        st &= 0x7Fu;
        if (st >= NSTEP || id >= P_COUNT || !p_lockable(id) || lock_find(t, st, id, 0) >= 0)
            continue;                                   /* (no such step or parameter here, or a second lock of it) */
        for (j = 0; j < NLOCK && t->lock[j].step != LOCK_FREE; j++)
            ;
        if (j == NLOCK)
            break;
        t->lock[j].step = (uint8_t)st;
        t->lock[j].param = (uint8_t)(id | sl);
        t->lock[j].val = (int16_t)clamp(v, lock_desc(t, id)->min, lock_desc(t, id)->max);
    }
    if (r->i + 3u > r->n || r->bad)
        return;                                         /* (written before the components: none) */
    m = pr_u8(r);
    t->cp_dir = (uint8_t)(m < DIR_COUNT ? m : DIR_FWD);
    t->cp_seed = (uint8_t)pr_u8(r);
    n = pr_u8(r);
    for (k = 0; k < n && !r->bad; k++) {
        uint32_t st = pr_u8(r), ty = pr_u8(r), a = pr_u8(r), b = pr_u8(r);
        int32_t va = (int8_t)a;
        if (ty == (CP_PARAM | 0x80u)) {
            ty = CP_PARAM;
            va = (int32_t)lock_id(a);
        }
        if (r->bad || st >= NSTEP || !comp_valid(ty, va, (int8_t)b) || comp_find(t, st, ty) >= 0)
            continue;                                   /* (not one this firmware plays, or a second of its type) */
        comp_set(t, st, ty, va, (int8_t)b);
    }
}
