/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* Projects: four slots in .noinit RAM (the song sections A..D), so they survive resets and UBOOT
 * entry. With FELUCCA_FLASH every save also goes to flash through storage.c, and an empty RAM slot
 * is filled from flash on load. The working project is also kept in flash by itself (autosave, when
 * the transport is stopped and nothing sounds) and comes back at power-on: SLOOP starts where you
 * left it.
 *
 * Formats: 6 ("FUN6", written, SLOOP 2.6): format 5 with the ten parameters of 2.6 (P_ITYPE .. P_LPOL, just
 * before P_E0: the INSERT, the ANALOG filter TYPE, ENV SYNC, LFO 2) in a byte each, and each step's nudge (6 bits)
 * and fill condition (2 bits) in one byte: format 5 was full (3840 bytes, one flash object), this is 3816.
 * Read and converted: 5 ("FUN5", SLOOP 2.4 .. 2.5: format 4 plus, per track, the nudge of each step (micro), NLOCK_V6
 * parameter locks, the steps' fill conditions (2 bits each) and P_TFLT, one parameter more just before P_E0;
 * converted by id, the 2.6 parameters at their defaults, a lock on P_E0.. moved with it), 4 ("FUN4", SLOOP 2.0 .. 2.3: PROJ_NP_V4 parameters, today's G_COUNT, 10-byte
 * steps with levels and ratchets, the drum track's 16 lanes; no nudge, no lock), 3 ("FUN3", SLOOP 1.x: 8-byte
 * steps, the drum track's notes become its lanes, the swings x 0.8 for the MPC scale), 2 ("FUN2") and 1
 * ("FUN1"), which held PROJ_NP_V2 parameters per track, mapped by count as user presets are (the first
 * PROJ_NP_V2 - 8 are P_LEVEL.. in order, the last 8 P_E0..P_E7; the parameters added since take their
 * defaults). Their engine bytes are kept: formats 1 and 2 had engines 0..7 (ANALOG .. WHEEL), and the
 * engines added since were appended, no index moved; the drum track's byte (it has no engine) becomes 0.
 *
 * Built on the host too (tests/project_test.c, -DPROJ_HOST): the part above the #ifndef
 * PROJ_HOST needs core.h, params.c (TP), drums.c (the lanes), the engines and trk_def_engine (ui.c). */
#ifndef UI_SMALL                 /* (2.7) compiled for size: not the audio path (gfx.c UI_SMALL); the host tests: nothing */
#define UI_SMALL
#endif
#define PROJ_MAGIC 0x46554E37u                 /* "FUN7": eight tracks, variable length (below: proj7_*) */
#define PROJ_MAGIC_V6 0x46554E36u              /* "FUN6": format 5 + the 2.6 parameters, nudge and condition in a byte */
#define PROJ_MAGIC_V5 0x46554E35u              /* "FUN5": format 4 + per-step nudge, parameter locks, fill conditions (SLOOP 2.4) */
#define PROJ_MAGIC_V4 0x46554E34u              /* "FUN4": four tracks, P_COUNT parameters each, 10-byte steps; read only */
#define PROJ_MAGIC_V3 0x46554E33u              /* "FUN3": SLOOP 1.x; read only */
#define PROJ_MAGIC_V2 0x46554E32u              /* "FUN2": four tracks, PROJ_NP_V2 parameters; read only */
#define PROJ_MAGIC_V1 0x46554E31u              /* "FUN1": one instrument; loads into track 1 */
#define PROJ_NP_V5 61u                         /* P_COUNT of format 5 (P_E0 was 53) */
#define PROJ_NP_V4 58u                         /* P_COUNT of format 4 (P_E0 was 50) */
#define PROJ_NP_V3 57u                         /* P_COUNT of format 3 (P_E0 was 49) */
#define PROJ_NG_V3 27u                         /* G_COUNT of formats 1..3 */
#define PROJ_NP_V2 53u                         /* P_COUNT of formats 1 and 2 (P_E0 was 45) */
#define PROJ_NG_V2 27u                         /* G_COUNT of formats 1 and 2 */
#define PROJ_NG 32u                            /* the globals of formats 4 and 5 (G_COUNT until 2.4). SLOOP 2.5's
                                                * G_DRDLY rides in the byte after sel (0 in older projects: off),
                                                * so the format and its size do not change */
_Static_assert(G_DRDLY == PROJ_NG && G_TXSRC == PROJ_NG + 5u,
               "the globals a project holds, then G_DRDLY (then 2.6's GLO > MIDI: settings of the FM-1)");
_Static_assert(G_FXFADE == G_CLKOUT + 1u && G_CH5 == G_FXFADE + 1u && G_PATQ == G_CH8 + 1u && G_COUNT == G_PATQ + 1u,
               "G_FXFADE (2.7.2), then the eight-track CH5..CH8: settings of the FM-1, the last globals");
#define PROJ_NC6 ((uint32_t)P_ITYPE)           /* format 6: the parameters kept in 16 bits, P_LEVEL .. P_VLEAD (as 5), */
#define PROJ_NX6 ((uint32_t)(P_E0 - P_ITYPE))  /* the 2.6 ones in a byte (0..127), then P_E0 .. P_E7 */
_Static_assert(PROJ_NC6 == PROJ_NP_V5 - 8u && PROJ_NX6 == 10u, "format 6: format 5's parameters, then ten bytes");
typedef struct {                               /* one track; the drum track ignores engine / preset */
    int16_t p[PROJ_NC6];                       /* P_LEVEL .. P_VLEAD (pt_get, pt_set) */
    int16_t e[8];                              /* P_E0 .. P_E7 */
    uint8_t x[PROJ_NX6];                       /* P_ITYPE .. P_LPOL (2.6) */
    uint8_t engine, preset;
    union {
        step_t step[NSTEP];
        dstep_t dstep[NSTEP];                  /* (the drum track: 16 lanes, the same size) */
    };
    uint8_t mf[NSTEP];                         /* each step's nudge (core.h MICRO_*, 6 bits) | its fill condition << 6 */
    plock_t lock[NLOCK_V6];                       /* and its parameter locks (step LOCK_FREE = none) */
} proj_trk_v6_t;
typedef struct {                               /* format 6 (SLOOP 2.6 .. 2.8.3): four tracks, drums on 4 */
    uint32_t magic, size;
    int16_t g[PROJ_NG];
    uint8_t sel, drdly, rsv[2];                /* the selected track; 2.5: G_DRDLY */
    proj_trk_v6_t t[4];
    uint32_t sum;
} project_v6_t;
static int16_t pt_get(const proj_trk_v6_t *t, uint32_t id)   /* p[id] of a stored track */
{
    return id < PROJ_NC6 ? t->p[id] : id < P_E0 ? (int16_t)t->x[id - PROJ_NC6] : t->e[(id - P_E0) & 7u];
}
UI_SMALL static void pt_set(proj_trk_v6_t *t, uint32_t id, int32_t v)
{
    if (id < PROJ_NC6)
        t->p[id] = (int16_t)v;
    else if (id < P_E0)
        t->x[id - PROJ_NC6] = (uint8_t)clamp(v, 0, 255);
    else
        t->e[(id - P_E0) & 7u] = (int16_t)v;
}
static int32_t pt_micro(const proj_trk_v6_t *t, uint32_t i) { int32_t m = t->mf[i] & 63; return m >= 32 ? m - 64 : m; }
static uint32_t pt_fill(const proj_trk_v6_t *t, uint32_t i) { return (uint32_t)t->mf[i] >> 6; }
UI_SMALL static void pt_set_mf(proj_trk_v6_t *t, uint32_t i, int32_t micro, uint32_t fill)
{
    t->mf[i] = (uint8_t)(((uint32_t)micro & 63u) | (fill & 3u) << 6);
}
typedef struct {                               /* a track of format 5 (SLOOP 2.4 .. 2.5), read only */
    int16_t p[PROJ_NP_V5];
    uint8_t engine, preset;
    union {
        step_t step[NSTEP];
        dstep_t dstep[NSTEP];
    };
    int8_t micro[NSTEP];                       /* each step's nudge (core.h) */
    plock_t lock[NLOCK_V6];                       /* and its parameter locks (step LOCK_FREE = none) */
    uint8_t fill[NSTEP / 4];                   /* and its fill condition, 2 bits a step (FC_*) */
} proj_trk_v5_t;
typedef struct {                               /* format 5, read only */
    uint32_t magic, size;
    int16_t g[PROJ_NG];
    uint8_t sel, drdly, rsv[2];
    proj_trk_v5_t t[4];
    uint32_t sum;
} project_v5_t;
typedef struct {                               /* a track of format 4 (SLOOP 2.0 .. 2.3), read only */
    int16_t p[PROJ_NP_V4];
    uint8_t engine, preset;
    union {
        step_t step[NSTEP];
        dstep_t dstep[NSTEP];
    };
} proj_trk_v4_t;
typedef struct {                               /* format 4, read only */
    uint32_t magic, size;
    int16_t g[PROJ_NG];
    uint8_t sel, rsv[3];
    proj_trk_v4_t t[4];
    uint32_t sum;
} project_v4_t;
typedef struct { uint8_t note[4], n, time, flags, vel; } step8_t;   /* the steps of formats 1..3 */
typedef struct {                               /* a track of format 3, read only */
    int16_t p[PROJ_NP_V3];
    uint8_t engine, preset;
    step8_t step[NSTEP];
} proj_trk_v3_t;
typedef struct {                               /* format 3 (SLOOP 1.x), read only */
    uint32_t magic, size;
    int16_t g[PROJ_NG_V3];
    uint8_t sel, rsv[3];
    proj_trk_v3_t t[4];
    uint32_t sum;
} project_v3_t;
typedef struct {                               /* a track of formats 1 and 2, read only */
    int16_t p[PROJ_NP_V2];
    uint8_t engine, preset;
    step8_t step[NSTEP];
} proj_trk_v2_t;
typedef struct {                               /* format 2 (until 0.9), read only */
    uint32_t magic, size;
    int16_t g[PROJ_NG_V2];
    uint8_t sel, rsv[3];
    proj_trk_v2_t t[4];
    uint32_t sum;
} project_v2_t;
typedef struct {                               /* format 1 (until 0.5 beta), read only */
    uint32_t magic, size;
    int16_t g[PROJ_NG_V2];
    proj_trk_v2_t t;
    uint32_t sum;
} project_v1_t;
_Static_assert(sizeof(project_v2_t) == 2552u && sizeof(project_v1_t) == 688u && sizeof(project_v3_t) == 2584u &&
               sizeof(project_v4_t) == 3112u && sizeof(project_v5_t) == 3840u, "formats 1 / 2 / 3 / 4 / 5 as they were stored");
_Static_assert(sizeof(project_v6_t) == 3816u, "format 6 as it was stored");
/* format 7 ("FUN7", eight tracks): a variable-length object in the same 3,840 bytes, sections, flash objects and RAM
 * slots as format 6: a header (magic, size: the bytes used, header included; sum: FNV-1a over size and the data) and
 * chunks (proj7_* below). A project_t holds format 7 or, as it was read, format 6 (proj6_* below: a section saved by
 * an older SLOOP stays as it was until it is saved again) */
#define PROJ_MAX 3840u                         /* (storage.c ST_PAYLOAD_MAX: one flash object) */
#define PROJ_HDR 12u
typedef struct {
    uint32_t magic, size, sum;
    uint8_t d[PROJ_MAX - PROJ_HDR];
} project_t;
_Static_assert(sizeof(project_t) == PROJ_MAX && sizeof(project_v6_t) <= sizeof(project_t), "a slot holds format 6 or 7");
project_t proj_slot[4] __attribute__((section(".noinit")));

UI_SMALL static uint32_t proj_hash(const void *p, uint32_t n)   /* FNV-1a over n bytes */
{
    const uint8_t *b = (const uint8_t *)p;
    uint32_t i, s = 0x811C9DC5u;
    for (i = 0; i < n; i++)
        s = (s ^ b[i]) * 16777619u;
    return s;
}
UI_SMALL static uint32_t proj6_sum(const project_v6_t *p) { return proj_hash(p, sizeof *p - 4u); }
UI_SMALL static int proj6_ok(const project_v6_t *q)
{
    return q->magic == PROJ_MAGIC_V6 && q->size == sizeof *q && q->sum == proj6_sum(q);
}
UI_SMALL static uint32_t proj7_sum(const project_t *p)   /* size (4 bytes, low first), then the data */
{
    uint32_t i, s = 0x811C9DC5u, n = p->size - PROJ_HDR;
    for (i = 0; i < 4u; i++)
        s = (s ^ ((p->size >> (8u * i)) & 0xFFu)) * 16777619u;
    for (i = 0; i < n; i++)
        s = (s ^ p->d[i]) * 16777619u;
    return s;
}
UI_SMALL static int proj7_ok(const project_t *q)
{
    return q->magic == PROJ_MAGIC && q->size >= PROJ_HDR && q->size <= PROJ_MAX && q->sum == proj7_sum(q);
}
/* a project in the slot (format 7, or a format 6 one as it was read) */
UI_SMALL static int proj_ok(const project_t *q) { return proj7_ok(q) || proj6_ok((const project_v6_t *)q); }
UI_SMALL static uint32_t proj_bytes(const project_t *q)   /* the bytes it takes in flash */
{
    return q->magic == PROJ_MAGIC ? q->size : (uint32_t)sizeof(project_v6_t);
}
UI_SMALL static uint32_t proj_sumof(const project_t *q)   /* its check word (the autosave's "changed?") */
{
    return q->magic == PROJ_MAGIC ? q->sum : ((const project_v6_t *)q)->sum;
}

/* ---- old formats -> format 5 */
/* an old step into a synth step (no level, no ratchet) */
UI_SMALL static void step_from8(step_t *d, const step8_t *s)
{
    memcpy(d->note, s->note, 4);
    d->n = s->n;
    d->time = s->time;
    d->flags = s->flags;
    d->vel = s->vel;
    d->lvl = d->rat = 0;
}
/* an old drum step (GM notes) into the drum track's lanes; its velocity / accent -> their level */
UI_SMALL static void dstep_from8(dstep_t *d, const step8_t *s)
{
    uint32_t i, lvl = (s->flags & SF_ACCENT) || s->vel > 115u ? LV_HARD : !s->vel ? LV_NORM : vel_lvl(s->vel);
    memset(d, 0, sizeof *d);
    if (s->time != ST_NOTE)
        return;
    for (i = 0; i < s->n && i < 4u; i++)
        dstep_set(d, lane_of_note(s->note[i] & 127u), lvl, 0);
}
UI_SMALL static int16_t swing_from_v3(int32_t v) { return (int16_t)clamp((v * 4 + 2) / 5, 0, 100); }   /* /250 -> /200 */

/* the globals of formats 1..3 (G_* unchanged since; any added later: their defaults) */
UI_SMALL static void proj_g_from_old(int16_t *g, const int16_t *g2)
{
    uint32_t i;
    for (i = 0; i < PROJ_NG; i++)
        g[i] = i < PROJ_NG_V3 ? g2[i] : GP[i].def;
    g[G_SWING] = swing_from_v3(g[G_SWING]);
}

/* no nudge, no lock, no condition (formats 1..4); the 2.6 parameters at their defaults (formats 1..5) */
UI_SMALL static void proj_trk_plain(proj_trk_v6_t *d)
{
    uint32_t k;
    memset(d->mf, 0, sizeof d->mf);
    for (k = PROJ_NC6; k < P_E0; k++)
        pt_set(d, k, TP[k].def);
    for (k = 0; k < NLOCK_V6; k++) {
        d->lock[k].step = LOCK_FREE;
        d->lock[k].param = 0;
        d->lock[k].val = 0;
    }
}

/* a track of format 3 -> today's (by id up to P_SLDEPTH; P_E0.. moved) */
UI_SMALL static void proj_trk_from_v3(proj_trk_v6_t *d, const proj_trk_v3_t *s, int drum)
{
    uint32_t k, nc = PROJ_NP_V3 - 8u;
    proj_trk_plain(d);
    for (k = 0; k < PROJ_NC6; k++)
        d->p[k] = k < nc ? s->p[k] : TP[k].def;
    for (k = 0; k < 8u; k++)
        d->e[k] = s->p[nc + k];
    d->p[P_SSWING] = swing_from_v3(d->p[P_SSWING]);
    d->p[P_ASWING] = swing_from_v3(d->p[P_ASWING]);
    d->engine = drum ? 0u : s->engine;
    d->preset = drum ? 0u : s->preset;
    for (k = 0; k < NSTEP; k++) {
        if (drum)
            dstep_from8(&d->dstep[k], &s->step[k]);
        else
            step_from8(&d->step[k], &s->step[k]);
    }
}

/* a track of formats 1 and 2 -> format 3 (mapped by count, see the top) */
UI_SMALL static void proj_trk_v2_to_v3(proj_trk_v3_t *d, const proj_trk_v2_t *s, int drum)
{
    uint32_t k, nc = PROJ_NP_V2 - 8u;
    for (k = 0; k < PROJ_NP_V3 - 8u; k++)
        d->p[k] = k < nc ? s->p[k] : TP[k].def;
    for (k = 0; k < 8u; k++)
        d->p[PROJ_NP_V3 - 8u + k] = s->p[nc + k];
    d->engine = drum ? 0u : s->engine;          /* (indices 0..7 as they were) */
    d->preset = drum ? 0u : s->preset;
    memcpy(d->step, s->step, sizeof d->step);
}

/* a format 4 project (n bytes in *v4) -> slot q as format 6: the same, no nudge, no lock, no condition, no FILTER */
UI_SMALL static int proj_from_v4(project_v6_t *q, const project_v4_t *v4, int n)
{
    uint32_t i;
    if (n != (int)sizeof *v4 || v4->magic != PROJ_MAGIC_V4 || v4->size != sizeof *v4 ||
        v4->sum != proj_hash(v4, sizeof *v4 - 4u))
        return 0;
    memset(q, 0, sizeof *q);
    q->magic = PROJ_MAGIC_V6;
    q->size = sizeof *q;
    memcpy(q->g, v4->g, sizeof q->g);
    q->sel = v4->sel;
    for (i = 0; i < 4u; i++) {
        uint32_t k;
        proj_trk_plain(&q->t[i]);
        for (k = 0; k < PROJ_NC6; k++)                 /* by id up to P_CHORD, the parameters added since: */
            q->t[i].p[k] = k < PROJ_NP_V4 - 8u ? v4->t[i].p[k] : TP[k].def;   /* their defaults; P_E0.. moved */
        for (k = 0; k < 8u; k++)
            q->t[i].e[k] = v4->t[i].p[PROJ_NP_V4 - 8u + k];
        q->t[i].engine = v4->t[i].engine;
        q->t[i].preset = v4->t[i].preset;
        memcpy(q->t[i].step, v4->t[i].step, sizeof q->t[i].step);
    }
    q->sum = proj6_sum(q);
    return 1;
}

/* a format 5 project (n bytes in *v5) -> slot q as format 6: by id, the 2.6 parameters at their defaults, each step's
 * nudge and condition into its byte, the locks as they were (a lock on P_E0.. follows its parameter's new id) */
UI_SMALL static int proj_from_v5(project_v6_t *q, const project_v5_t *v5, int n)
{
    uint32_t i, k;
    if (n != (int)sizeof *v5 || v5->magic != PROJ_MAGIC_V5 || v5->size != sizeof *v5 ||
        v5->sum != proj_hash(v5, sizeof *v5 - 4u))
        return 0;
    memset(q, 0, sizeof *q);
    q->magic = PROJ_MAGIC_V6;
    q->size = sizeof *q;
    memcpy(q->g, v5->g, sizeof q->g);
    q->sel = v5->sel;
    q->drdly = v5->drdly;
    for (i = 0; i < 4u; i++) {
        const proj_trk_v5_t *s = &v5->t[i];
        proj_trk_v6_t *d = &q->t[i];
        proj_trk_plain(d);
        for (k = 0; k < PROJ_NC6; k++)
            d->p[k] = s->p[k];
        for (k = 0; k < 8u; k++)
            d->e[k] = s->p[PROJ_NP_V5 - 8u + k];
        d->engine = s->engine;
        d->preset = s->preset;
        memcpy(d->step, s->step, sizeof d->step);
        for (k = 0; k < NSTEP; k++)
            pt_set_mf(d, k, clamp(s->micro[k], MICRO_MIN, MICRO_MAX), (uint32_t)s->fill[k / 4u] >> (2u * (k % 4u)));
        for (k = 0; k < NLOCK_V6; k++) {
            d->lock[k] = s->lock[k];
            if (s->lock[k].step != LOCK_FREE && s->lock[k].param >= PROJ_NP_V5 - 8u)   /* P_E0.. of format 5 */
                d->lock[k].param = (uint8_t)(s->lock[k].param - (PROJ_NP_V5 - 8u) + P_E0);
        }
    }
    q->sum = proj6_sum(q);
    return 1;
}

/* a format 3 project -> slot q as format 6 */
UI_SMALL static void proj_from_v3_ok(project_v6_t *q, const project_v3_t *v3)
{
    uint32_t i;
    memset(q, 0, sizeof *q);
    q->magic = PROJ_MAGIC_V6;
    q->size = sizeof *q;
    proj_g_from_old(q->g, v3->g);
    q->sel = v3->sel;
    for (i = 0; i < 4u; i++)
        proj_trk_from_v3(&q->t[i], &v3->t[i], i == TRK_DRUM_V6);
    q->sum = proj6_sum(q);
}
UI_SMALL static int proj_from_v3(project_v6_t *q, const project_v3_t *v3, int n)
{
    if (n != (int)sizeof *v3 || v3->magic != PROJ_MAGIC_V3 || v3->size != sizeof *v3 ||
        v3->sum != proj_hash(v3, sizeof *v3 - 4u))
        return 0;
    proj_from_v3_ok(q, v3);
    return 1;
}

static project_v3_t proj_v3_tmp;               /* (formats 1, 2: through format 3) */
/* a format 2 project (n bytes in *v2) -> slot q as format 5 */
UI_SMALL static int proj_from_v2(project_v6_t *q, const project_v2_t *v2, int n)
{
    project_v3_t *v3 = &proj_v3_tmp;
    uint32_t i;
    if (n != (int)sizeof *v2 || v2->magic != PROJ_MAGIC_V2 || v2->size != sizeof *v2 ||
        v2->sum != proj_hash(v2, sizeof *v2 - 4u))
        return 0;
    memset(v3, 0, sizeof *v3);
    memcpy(v3->g, v2->g, sizeof v3->g);
    v3->sel = v2->sel;
    for (i = 0; i < 4u; i++)
        proj_trk_v2_to_v3(&v3->t[i], &v2->t[i], i == TRK_DRUM_V6);
    proj_from_v3_ok(q, v3);
    return 1;
}

/* a format 1 project (n bytes in *v1) -> slot q as format 5: the instrument becomes track 1,
 * tracks 2..4 start empty (their sounds as at power-on) */
UI_SMALL static int proj_from_v1(project_v6_t *q, const project_v1_t *v1, int n)
{
    project_v3_t *v3 = &proj_v3_tmp;
    uint32_t i;
    if (n != (int)sizeof *v1 || v1->magic != PROJ_MAGIC_V1 || v1->size != sizeof *v1 ||
        v1->sum != proj_hash(v1, sizeof *v1 - 4u))
        return 0;
    memset(v3, 0, sizeof *v3);
    memcpy(v3->g, v1->g, sizeof v3->g);
    proj_trk_v2_to_v3(&v3->t[0], &v1->t, 0);
    proj_from_v3_ok(q, v3);
    for (i = 1; i < 4u; i++) {                 /* the other tracks: their defaults, no steps */
        uint32_t k;
        for (k = 0; k < P_COUNT; k++)
            pt_set(&q->t[i], k, k >= P_E0 ? ENGINES[trk_def_engine(i)]->edit[k - P_E0].def : TP[k].def);
        q->t[i].engine = (uint8_t)trk_def_engine(i);
        q->t[i].preset = 0xFF;                 /* 0xFF: its default preset (project_load) */
        memset(q->t[i].step, 0, sizeof q->t[i].step);
        if (i != TRK_DRUM_V6)
            for (k = 0; k < NSTEP; k++)
                q->t[i].step[k].time = ST_REST;
        proj_trk_plain(&q->t[i]);
    }
    q->sum = proj6_sum(q);
    return 1;
}

/* n bytes of a stored project (any format) -> slot q: format 7 as it is (its size checked against n), format 6 as it is,
 * formats 1..5 converted to format 6 (proj6_apply reads it); 0 = not a project (damaged, cut short, unknown) */
UI_SMALL static int proj_import(project_t *q, const void *b, int n)
{
    const project_t *p7 = (const project_t *)b;
    project_v6_t *q6 = (project_v6_t *)q;
    if (n >= (int)PROJ_HDR && n <= (int)PROJ_MAX && p7->magic == PROJ_MAGIC && p7->size == (uint32_t)n && proj7_ok(p7)) {
        memcpy(q, b, (uint32_t)n);
        return 1;
    }
    if (n == (int)sizeof *q6 && proj6_ok((const project_v6_t *)b)) {
        memcpy(q6, b, sizeof *q6);
        return 1;
    }
    return proj_from_v5(q6, (const project_v5_t *)b, n) || proj_from_v4(q6, (const project_v4_t *)b, n) ||
           proj_from_v3(q6, (const project_v3_t *)b, n) ||
           proj_from_v2(q6, (const project_v2_t *)b, n) || proj_from_v1(q6, (const project_v1_t *)b, n);
}

/* ---- the working project <-> a project_t */
/* 2.6: GLO > TEXTURE in a project (a song section has its own): in the slots of two globals a project no longer
 * applies (G_DRCH: a setting of the FM-1 now; G_INFO: the CPU readout) and the spare bytes. rsv[0]: 0x80 (there) | SRC
 * | WHEN << 4 | DUCK << 5, rsv[1]: RATE, g[G_DRCH]: LEVEL | (TONE + 64) << 7, g[G_INFO]: MOVE. Without the 0x80 (a
 * project before it, converted): the defaults, OFF */
UI_SMALL static void proj_tx_put(project_v6_t *p)
{
    p->rsv[0] = (uint8_t)(0x80u | ((uint32_t)song.g[G_TXSRC] & 15u) | ((uint32_t)song.g[G_TXWHEN] & 1u) << 4 |
                          ((uint32_t)song.g[G_TXDUCK] & 1u) << 5 | 0x40u);   /* (0x40: saved by 2.7 or later) */
    p->rsv[1] = (uint8_t)song.g[G_TXRATE];
    p->g[G_DRCH] = (int16_t)((song.g[G_TXLVL] & 127) | ((song.g[G_TXTONE] + 64) & 127) << 7);
    p->g[G_INFO] = song.g[G_TXMOVE];
}
static void proj_tx_get(const project_v6_t *p)
{
    static const uint8_t ID[7] = {G_TXSRC, G_TXLVL, G_TXTONE, G_TXMOVE, G_TXRATE, G_TXWHEN, G_TXDUCK};
    int32_t v[7];
    uint32_t i;
    if (!(p->rsv[0] & 0x80u)) {
        for (i = 0; i < 7u; i++)
            v[i] = GP[ID[i]].def;
    } else {
        v[0] = p->rsv[0] & 15u, v[5] = (p->rsv[0] >> 4) & 1u, v[6] = (p->rsv[0] >> 5) & 1u, v[4] = p->rsv[1];
        v[1] = p->g[G_DRCH] & 127, v[2] = ((p->g[G_DRCH] >> 7) & 127) - 64, v[3] = p->g[G_INFO];
    }
    for (i = 0; i < 7u; i++)
        song.g[ID[i]] = (int16_t)clamp(v[i], GP[ID[i]].min, GP[ID[i]].max);
}

/* (2.7) the DRUMS screen's SOUND page in a project: each sound's TUNE (4 bits) and DECAY (3 bits), two's complement
 * (0: as the kit has it), 16 x 7 bits in the drum track's engine values E1..E7 (the drum track has no engine: they
 * were free), and a check of them in g[G_SAVE] (never loaded: SAVE is a GO button). An older SLOOP keeps neither
 * (it limits E1..E7 to an engine's ranges and saves G_SAVE as 0): its project opens with every sound as the kit has it */
#define DRUM_TW_MARK 0x5400
UI_SMALL static uint32_t drum_tw_sum(const int16_t *e)
{
    uint32_t i, s = 0x5Au;
    for (i = 1; i < 8u; i++)
        s += ((uint32_t)(uint16_t)e[i] & 0xFFu) * (i * 2u + 1u) + ((uint32_t)(uint16_t)e[i] >> 8) * (i * 2u + 2u);
    return s & 0xFFu;
}
UI_SMALL static void drum_tw_put(project_v6_t *p)
{
    uint16_t w[7] = {0};
    uint32_t l, b;
    for (l = 0; l < DRUM_LANES; l++) {
        uint32_t v = ((uint32_t)drum_tune[TRK_DRUM_V6][l] & 15u) | ((uint32_t)drum_dec[TRK_DRUM_V6][l] & 7u) << 4;
        for (b = 0; b < 7u; b++)
            if ((v >> b) & 1u)
                w[(l * 7u + b) / 16u] |= (uint16_t)(1u << ((l * 7u + b) % 16u));
    }
    for (l = 0; l < 7u; l++)
        p->t[TRK_DRUM_V6].e[l + 1u] = (int16_t)w[l];
    p->g[G_SAVE] = (int16_t)(DRUM_TW_MARK | drum_tw_sum(p->t[TRK_DRUM_V6].e));
}
static void drum_tw_get(const project_v6_t *p)
{
    const int16_t *e = p->t[TRK_DRUM_V6].e;
    uint32_t l, b, ok = (uint16_t)p->g[G_SAVE] == (DRUM_TW_MARK | drum_tw_sum(e));
    for (l = 0; l < DRUM_LANES; l++) {
        uint32_t v = 0;
        for (b = 0; ok && b < 7u; b++)
            if (((uint16_t)e[1u + (l * 7u + b) / 16u] >> ((l * 7u + b) % 16u)) & 1u)
                v |= 1u << b;
        drum_tune[TRK_DRUM_V6][l] = (int8_t)((int32_t)((v & 15u) ^ 8u) - 8);
        drum_dec[TRK_DRUM_V6][l] = (int8_t)((int32_t)(((v >> 4) & 7u) ^ 4u) - 4);
    }
}

/* track t becomes kind k at once (a project or a section applied: the audio ISR, or with the IRQ off): whatever it
 * sounded (its synth voices, the drum voices it owns, a fade, its engine arena) ends here, its mix starts afresh */
UI_SMALL static __attribute__((noinline)) void trk_kind_now(track_t *t, uint32_t k)
{
    uint32_t i, own = (uint32_t)(t - trk) % NTRK;
    if (t->kind == k)
        return;
    for (i = 0; i < NVOICE; i++) {
        t->v[i].active = t->v[i].gate = t->v[i].stage = t->v[i].pend = 0;
        t->v[i].env = t->v[i].env_out = 0;
    }
    for (i = 0; i < NDRUM; i++)
        if (drums.own[i] == own)
            drums.v[i].active = 0;
    drums.tail[own] = 0;
    t->xf_on = t->xf = t->pold = 0;
    t->xp_n = t->nmono = t->mono_note = 0;
    t->mix_on = 0;
    t->tail = 0;
    eng_arena_drop(t);
    t->kind = (uint8_t)k;
}
/* track i as at power-on (its kind, sound and an empty pattern), from the audio ISR or with the IRQ off: no side effect
 * but what its sound needs (fm6_track_loaded: the main loop loads its FM6 patch). A project of four tracks leaves
 * tracks 5..8 so */
UI_SMALL static __attribute__((noinline)) void trk_pon_now(uint32_t i)
{
    track_t *t = &trk[i % NTRK];
    trk_kind_now(t, trk_def_kind(i));
    pon_params(i, t->p);
    t->eng_req = (uint8_t)trk_def_engine(i);
    t->preset = (uint8_t)(trk_def_kind(i) == TK_SYNTH ? TRK_DEF[i % NTRK][2] : 0u);
    t->user = 0;
    t->lk_n = 0;
    steps_clear(t);
    memset(drum_tune[i % NTRK], 0, sizeof drum_tune[0]);
    memset(drum_dec[i % NTRK], 0, sizeof drum_dec[0]);
    if (!is_drum(t))
        fm6_track_loaded(t);
}
/* track i is as at power-on: its kind and sound (every parameter), nothing in its pattern (format 6 can keep the
 * other tracks then) */
UI_SMALL static __attribute__((noinline)) int trk_pristine(uint32_t i)
{
    int16_t p[P_COUNT];
    const track_t *t = &trk[i % NTRK];
    uint32_t k;
    if (t->kind != trk_def_kind(i) || !track_empty(t) || (!is_drum(t) && t->eng_req != trk_def_engine(i)) || t->user)
        return 0;
    for (k = 0; k < NLOCK; k++)
        if (t->lock[k].step != LOCK_FREE)
            return 0;
    for (k = 0; k < NSTEP; k++)
        if (t->micro[k] || step_fill(t, k))
            return 0;
    if (is_drum(t) && drum_tweaked(i))
        return 0;
    pon_params(i, p);
    for (k = 0; k < P_COUNT; k++)
        if (t->p[k] != p[k])
            return 0;
    return 1;
}

/* ---- format 6: tracks 1..4 as the four-track SLOOP had them (three synths, drums on 4) */
static int proj6_fits(void)                            /* the working project is one format 6 holds whole */
{
    uint32_t i;
    for (i = 0; i < 4u; i++)
        if (trk[i].kind != (i == TRK_DRUM_V6 ? TK_DRUM : TK_SYNTH))
            return 0;
    if (pb_n)
        return 0;                                       /* (nor more than one pattern a track) */
    for (i = 0; i < NTRK; i++) {                        /* (format 6 has no step components, no direction, */
        uint32_t k, n = 0;                              /* NLOCK_V6 locks a track, no SLIDE) */
        if (comp_count(&trk[i], NSTEP) || trk[i].cp_dir || trk[i].cp_seed || trk[i].pat || trk[i].pat_nchain)
            return 0;
        for (k = 0; k < NLOCK; k++)
            if (trk[i].lock[k].step != LOCK_FREE) {
                if (trk[i].lock[k].param & LOCK_SLIDE)
                    return 0;
                n++;
            }
        if (n > NLOCK_V6)
            return 0;
    }
    for (i = 4; i < NTRK; i++)
        if (!trk_pristine(i))
            return 0;
    return 1;
}
UI_SMALL static void proj6_capture(project_v6_t *p)    /* tracks 1..4 as format 6 (proj6_fits) */
{
    uint32_t i;
    memset(p, 0, sizeof *p);
    p->magic = PROJ_MAGIC_V6;
    p->size = sizeof *p;
    for (i = 0; i < PROJ_NG; i++)
        p->g[i] = song.g[i];
    p->g[G_DRLVL] = trk[TRK_DRUM_V6].p[P_LEVEL];       /* (the drum track's mix: globals of format 6) */
    p->g[G_DRREV] = trk[TRK_DRUM_V6].p[P_REV];
    p->sel = song.sel < 4u ? song.sel : 0u;
    p->drdly = (uint8_t)trk[TRK_DRUM_V6].p[P_DLY];
    proj_tx_put(p);
    for (i = 0; i < 4u; i++) {
        uint32_t k;
        uint32_t n = 0;
        for (k = 0; k < P_COUNT; k++)
            pt_set(&p->t[i], k, trk_base(&trk[i], k));   /* (not a lock playing now) */
        p->t[i].engine = trk[i].eng_req;
        p->t[i].preset = trk[i].preset;
        memcpy(p->t[i].step, trk[i].step, sizeof trk[i].step);
        for (k = 0; k < NSTEP; k++)
            pt_set_mf(&p->t[i], k, trk[i].micro[k], (uint32_t)trk[i].fill[k / 4u] >> (2u * (k % 4u)));
        for (k = 0; k < NLOCK_V6; k++)
            p->t[i].lock[k].step = LOCK_FREE;
        for (k = 0; k < NLOCK && n < NLOCK_V6; k++)    /* (the locks, packed: proj6_fits saw NLOCK_V6 at most) */
            if (trk[i].lock[k].step != LOCK_FREE)
                p->t[i].lock[n++] = trk[i].lock[k];
    }
    p->t[TRK_DRUM_V6].p[P_LEVEL] = TP[P_LEVEL].def;     /* (format 6 kept the drum track's own as it never used them) */
    p->t[TRK_DRUM_V6].p[P_REV] = TP[P_REV].def;
    p->t[TRK_DRUM_V6].p[P_DLY] = TP[P_DLY].def;
    drum_tw_put(p);                                     /* (2.7) the drum sounds' TUNE and DECAY */
    p->sum = proj6_sum(p);
}

/* a format 6 project's tracks (and its globals, all: a load; or only the drum level / reverb / delay: a song section)
 * into tracks 1..4, every value back inside its range; tracks 5..8 as at power-on. The audio ISR must not run
 * meanwhile (the song sections: called from it; a load: IRQ off) */
UI_SMALL static __attribute__((noinline)) void proj6_apply(const project_v6_t *p, int all)
{
    uint32_t i, k;
    pat_reset_all();                                    /* (format 6: one pattern a track) */
    for (i = 0; i < PROJ_NG; i++)
        if (all ? i != G_SLOT && i != G_LOAD && i != G_SAVE && i != G_SYNC && i != G_MIDI && i != G_ROUTE && i != G_DRCH &&
                      i != G_INFO
                : i == G_DRLVL || i == G_DRREV)                 /* (2.6: the drum channel a setting of the FM-1, GLO > MIDI;
                                                                 * its slot and G_INFO's hold the TEXTURE) */
            song.g[i] = (int16_t)clamp(p->g[i], GP[i].min, GP[i].max);
    proj_tx_get(p);                                     /* GLO > TEXTURE (2.6): a load and a section */
    drum_tw_get(p);                                     /* (2.7) the drum sounds' TUNE and DECAY: a load and a section */
    for (k = 0; k < 4u; k++) {
        track_t *t = &trk[k];
        const proj_trk_v6_t *s = &p->t[k];
        uint32_t e = k != TRK_DRUM_V6 ? s->engine % NENGINES : 0u;
        trk_kind_now(t, k == TRK_DRUM_V6 ? TK_DRUM : TK_SYNTH);
        t->eng_req = (uint8_t)e;
        t->user = 0;                                    /* (no user preset slot is saved) */
        t->lk_n = 0;                                    /* (the locks in force: the values come from the project) */
        for (i = 0; i < P_COUNT; i++) {                 /* every value back inside its range */
            const param_desc_t *d = k == TRK_DRUM_V6 && i == P_E0 ? &DRUM_KIT_DESC :   /* the drum kit */
                                    i >= P_E0 && i <= P_E7 ? &ENGINES[e]->edit[i - P_E0] : &TP[i];
            t->p[i] = (int16_t)clamp(pt_get(s, i), d->min, d->max);
        }
        if (!(p->rsv[0] & 0x40u) && !t->p[P_AMODE])
            t->p[P_AHOLD] = 0;                          /* (2.7) saved before 2.7: HOLD with the arp OFF did nothing then; it
                                                         * is KBD HOLD now, so it starts OFF (no note held by surprise) */
        t->preset = (uint8_t)(ENGINES[e]->npresets ? (s->preset == 0xFFu ? 0u : s->preset) % ENGINES[e]->npresets : 0u);
        memcpy(t->step, s->step, sizeof t->step);
        memset(t->fill, 0, sizeof t->fill);
        for (i = 0; i < NSTEP; i++) {                   /* the nudges and conditions (3 means normal: 0) */
            uint32_t c = pt_fill(s, i);
            t->micro[i] = (int8_t)clamp(pt_micro(s, i), MICRO_MIN, MICRO_MAX);
            if (c != 3u)
                t->fill[i / 4u] |= (uint8_t)(c << (2u * (i % 4u)));
        }
        for (i = 0; i < NLOCK_V6; i++) {
            const plock_t *l = &s->lock[i];
            uint32_t id = l->param;
            if (l->step < NSTEP && id < P_COUNT && p_lockable(id)) {
                const param_desc_t *d = k == TRK_DRUM_V6 && id == P_E0 ? &DRUM_KIT_DESC :
                                        id >= P_E0 && id <= P_E7 ? &ENGINES[e]->edit[id - P_E0] : &TP[id];
                t->lock[i].step = l->step;
                t->lock[i].param = (uint8_t)id;
                t->lock[i].val = (int16_t)clamp(l->val, d->min, d->max);
            } else {
                t->lock[i].step = LOCK_FREE;            /* no such step or parameter: the slot is free */
                t->lock[i].param = 0;
                t->lock[i].val = 0;
            }
        }
        for (; i < NLOCK; i++) {                        /* (format 6 holds NLOCK_V6: the others free) */
            t->lock[i].step = LOCK_FREE;
            t->lock[i].param = 0;
            t->lock[i].val = 0;
        }
        if (k != TRK_DRUM_V6) {
            for (i = 0; i < NSTEP; i++) {
                step_t *st = &t->step[i];
                uint32_t j;
                if (st->n > 4u)
                    st->n = 4;
                if (st->time > ST_REST)
                    st->time = ST_REST;
                for (j = 0; j < 4u; j++)
                    st->note[j] &= 127u;
            }
            fm6_track_loaded(t);                        /* FM6: the project keeps PTCH, not the patch: its slot's */
        } else {                                        /* the drum track's mix: globals of format 6 */
            t->p[P_LEVEL] = (int16_t)clamp(p->g[G_DRLVL], 0, 127);
            t->p[P_REV] = (int16_t)clamp(p->g[G_DRREV], 0, 127);
            t->p[P_DLY] = (int16_t)clamp(p->drdly, 0, 127);   /* (a load and a section, as REV) */
            for (i = 1; i < 8u; i++)
                t->p[P_E0 + i] = 0;                     /* (E1..E7 held the TUNE / DECAY: drum_tw_get) */
        }
    }
    for (k = 4; k < NTRK; k++)                          /* (a four-track project: the others as at power-on) */
        trk_pon_now(k);
}

/* ---- format 7. After the header, chunks: a tag, its length (2 bytes, low first), its bytes; a tag this firmware
 * does not know is skipped (a later SLOOP may add some). A value is one byte (-127..127) or 0x80 and two bytes (pw_v).
 *   'G' the globals: their count (G_COUNT of the writer), a bit per global not at its default, those values
 *   'S' the song: the selected track
 *   'T' a track: index, kind, engine, preset; the common parameters (P_LEVEL .. before P_E0, their count first: they
 *       are append-only, so a later SLOOP's extra ones are read past) and the engine's eight, each a bit when not at
 *       its default then the value; a drum track's sounds' TUNE / DECAY (16 bytes); then its pattern (pat_put)
 * A track with no chunk is as at power-on (trk_pon_now). Every value is clamped to its range when it is read. */
/* (the pattern codec, pw_* / pr_* and pat_put / pat_get: patcodec.c, included by seq.c: the audio ISR switches
 * patterns with it) */

/* the reference a parameter is stored against: its default (a drum track's: its drum mix, its kit) */
static int32_t trk_pref(const track_t *t, uint32_t id)
{
    return is_drum(t) && id > P_E0 && id <= P_E7 ? 0 : track_desc(t, id)->def;   /* (a drum track's E1..E7: unused, 0) */
}
UI_SMALL static __attribute__((noinline)) void trk_put(pw_t *w, uint32_t i)
{
    const track_t *t = &trk[i];
    uint8_t map[(P_E0 + 7u) / 8u], em = 0;
    uint32_t k, at = pw_open(w, 'T');
    memset(map, 0, sizeof map);
    pw_u8(w, i);
    pw_u8(w, t->kind);
    pw_u8(w, is_drum(t) ? 0u : t->eng_req);
    pw_u8(w, is_drum(t) ? 0u : t->preset);              /* (a drum track has neither: 0) */
    pw_u8(w, P_E0);
    for (k = 0; k < P_E0; k++)                         /* (the track's own values: not a lock playing now, trk_base) */
        if (trk_base(t, k) != trk_pref(t, k))
            map[k / 8u] |= (uint8_t)(1u << (k % 8u));
    for (k = 0; k < sizeof map; k++)
        pw_u8(w, map[k]);
    for (k = 0; k < P_E0; k++)
        if ((map[k / 8u] >> (k % 8u)) & 1u)
            pw_v(w, trk_base(t, k));
    for (k = 0; k < 8u; k++)
        if (trk_base(t, P_E0 + k) != trk_pref(t, P_E0 + k))
            em |= (uint8_t)(1u << k);
    pw_u8(w, em);
    for (k = 0; k < 8u; k++)
        if ((em >> k) & 1u)
            pw_v(w, trk_base(t, P_E0 + k));
    if (is_drum(t))
        for (k = 0; k < DRUM_LANES; k++)
            pw_u8(w, ((uint32_t)drum_tune[i][k] & 15u) | ((uint32_t)drum_dec[i][k] & 7u) << 4);
    pat_put(w, t);
    pw_u8(w, t->pat);                                   /* (patterns: the one playing, the chain) */
    pw_u8(w, t->pat_nchain);
    for (k = 0; k < t->pat_nchain && k < NPAT; k++)
        pw_u8(w, t->pat_chain[k]);
    pw_close(w, at);
}
UI_SMALL static __attribute__((noinline)) void trk_get(pr_t *r)
{
    uint32_t i = pr_u8(r), kind = pr_u8(r), e = pr_u8(r) % NENGINES, pre = pr_u8(r), nc = pr_u8(r), k;
    uint8_t map[32];
    track_t *t;
    if (i >= NTRK || kind > TK_DRUM || nc > 8u * sizeof map || r->bad)
        return;
    t = &trk[i];
    trk_kind_now(t, kind);
    t->eng_req = (uint8_t)(kind == TK_DRUM ? 0u : e);   /* (a drum track: engine and preset 0, as power-on has them) */
    t->user = 0;
    t->lk_n = 0;
    for (k = 0; k < P_COUNT; k++)
        t->p[k] = (int16_t)trk_pref(t, k);
    for (k = 0; k < (nc + 7u) / 8u; k++)
        map[k] = (uint8_t)pr_u8(r);
    for (k = 0; k < nc; k++)
        if ((map[k / 8u] >> (k % 8u)) & 1u) {
            int32_t v = pr_v(r);
            if (k < P_E0)                               /* (a later SLOOP's common parameters: read past) */
                t->p[k] = (int16_t)clamp(v, track_desc(t, k)->min, track_desc(t, k)->max);
        }
    map[0] = (uint8_t)pr_u8(r);
    for (k = 0; k < 8u; k++)
        if ((map[0] >> k) & 1u) {
            int32_t v = pr_v(r);
            t->p[P_E0 + k] = (int16_t)clamp(v, track_desc(t, P_E0 + k)->min, track_desc(t, P_E0 + k)->max);
        }
    {
        const engine_t *en = ENGINES[t->eng_req % NENGINES];
        t->preset = (uint8_t)(kind == TK_SYNTH && en->npresets ? pre % en->npresets : 0u);
    }
    if (kind == TK_DRUM)
        for (k = 0; k < DRUM_LANES; k++) {
            uint32_t v = pr_u8(r);
            drum_tune[i][k] = (int8_t)((int32_t)((v & 15u) ^ 8u) - 8);
            drum_dec[i][k] = (int8_t)((int32_t)(((v >> 4) & 7u) ^ 4u) - 4);
        }
    pat_get(r, t);
    if (r->i < r->n && !r->bad) {                       /* (patterns: written after the pattern; none before them) */
        uint8_t ch[NPAT];
        uint32_t n;
        t->pat = (uint8_t)(pr_u8(r) % NPAT);
        n = pr_u8(r);
        for (k = 0; k < n && k < NPAT; k++)
            ch[k] = (uint8_t)(pr_u8(r) % NPAT);
        if (!r->bad)
            pat_chain_set(t, ch, k);
    }
    if (kind == TK_SYNTH)
        fm6_track_loaded(t);                            /* FM6: the project keeps PTCH, not the patch: its slot's */
}
UI_SMALL static __attribute__((noinline)) void proj7_put(pw_t *w)
{
    uint8_t map[(G_COUNT + 7u) / 8u];
    uint32_t i, at;
    memset(map, 0, sizeof map);
    at = pw_open(w, 'G');
    pw_u8(w, G_COUNT);
    for (i = 0; i < G_COUNT; i++)
        if (song.g[i] != GP[i].def)
            map[i / 8u] |= (uint8_t)(1u << (i % 8u));
    for (i = 0; i < sizeof map; i++)
        pw_u8(w, map[i]);
    for (i = 0; i < G_COUNT; i++)
        if ((map[i / 8u] >> (i % 8u)) & 1u)
            pw_v(w, song.g[i]);
    pw_close(w, at);
    at = pw_open(w, 'S');
    pw_u8(w, song.sel);
    pw_close(w, at);
    for (i = 0; i < NTRK; i++)
        trk_put(w, i);
    {   /* the other patterns: one 'P' chunk each (the bank's entry: track << 4 | pattern, LEN, the pattern's bytes) */
        uint32_t o = 0;
        while (o + 4u <= pb_n) {
            uint32_t sz = pb_entry(o), k;
            at = pw_open(w, 'P');
            pw_u8(w, pb_buf[o]);
            pw_u8(w, pb_buf[o + 3u]);
            for (k = 4; k < sz; k++)
                pw_u8(w, pb_buf[o + k]);
            pw_close(w, at);
            o += sz;
        }
    }
}
/* the globals a section takes from its project (a load takes all but the FM-1's settings): the TEXTURE */
static int g_of_section(uint32_t i) { return i >= G_TXSRC && i <= G_TXDUCK; }
UI_SMALL static __attribute__((noinline)) void proj7_apply(const project_t *p, int all)
{
    pr_t r = {p->d, p->size - PROJ_HDR, 0, 0};
    uint32_t seen = 0, i;
    pat_reset_all();                                    /* (its patterns replace the ones there were) */
    while (r.i + 3u <= r.n && !r.bad) {
        uint32_t tag = pr_u8(&r), len = pr_u8(&r);
        pr_t c;
        len |= pr_u8(&r) << 8;
        if (len > r.n - r.i)
            break;                                      /* (cut short: what came before is applied) */
        c.b = r.b + r.i, c.n = len, c.i = 0, c.bad = 0;
        r.i += len;
        if (tag == 'G') {
            uint32_t ng = pr_u8(&c), k;
            uint8_t map[32];
            if (ng > 8u * sizeof map)
                continue;
            for (k = 0; k < (ng + 7u) / 8u; k++)
                map[k] = (uint8_t)pr_u8(&c);
            for (k = 0; k < ng && !c.bad; k++) {
                int32_t v = (map[k / 8u] >> (k % 8u)) & 1u ? pr_v(&c) : k < G_COUNT ? GP[k].def : 0;
                if (k < G_COUNT && !g_setting(k) && k != G_LOAD && k != G_SAVE && k != G_INFO &&
                    (all || g_of_section(k)))
                    song.g[k] = (int16_t)clamp(v, GP[k].min, GP[k].max);
            }
        } else if (tag == 'S') {
            uint32_t sel = pr_u8(&c);
            if (all && sel < NTRK)
                song.sel = (uint8_t)sel;
        } else if (tag == 'T') {
            uint32_t ti = c.n ? c.b[0] : 0xFFu;
            if (ti < NTRK) {
                trk_get(&c);
                seen |= 1u << ti;
            }
        } else if (tag == 'P' && c.n >= 2u) {
            pb_add_raw((uint32_t)c.b[0] >> 4, c.b[0] & 15u, c.b[1], c.b + 2, c.n - 2u);
        }
    }
    for (i = 0; i < NTRK; i++)
        if (!((seen >> i) & 1u))
            trk_pon_now(i);                             /* (no chunk: as at power-on) */
    for (i = 0; i < NTRK; i++)
        pb_drop(i, trk[i].pat);                         /* (the pattern a track plays is its own, not the bank's) */
}

/* what is playing now, as a project in p: format 7, or format 6 when it does not fit and format 6 keeps it whole
 * (tracks 5..8 as at power-on: proj6_fits). 0: it fits neither, p is left as it was (the caller says PROJECT FULL;
 * nothing is cut). Bounded (the audio ISR captures the song's backup) */
UI_SMALL static int proj_capture(project_t *p)
{
    pw_t w = {0, 0, 0};
    proj7_put(&w);                                      /* (the size only) */
    if (PROJ_HDR + w.n <= PROJ_MAX) {
        w.b = p->d, w.n = 0, w.max = sizeof p->d;
        proj7_put(&w);
        memset(p->d + w.n, 0, sizeof p->d - w.n);       /* (the rest zero: two captures of one state are the same bytes) */
        p->magic = PROJ_MAGIC;
        p->size = PROJ_HDR + w.n;
        p->sum = proj7_sum(p);
        return 1;
    }
    if (proj6_fits()) {
        memset(p, 0, sizeof *p);
        proj6_capture((project_v6_t *)p);
        return 1;
    }
    return 0;
}
/* a project (format 7 or 6) into the working one, every value back inside its range: all, a load (its globals too);
 * else a song section (its tracks and the TEXTURE). The audio ISR must not run meanwhile (the song sections: called
 * from it; a load: IRQ off) */
static void proj_apply(const project_t *p, int all)
{
    if (p->magic == PROJ_MAGIC)
        proj7_apply(p, all);
    else
        proj6_apply((const project_v6_t *)p, all);
}
/* the selected track a project holds */
static uint32_t proj_sel(const project_t *p)
{
    if (p->magic != PROJ_MAGIC)
        return ((const project_v6_t *)p)->sel < 4u ? ((const project_v6_t *)p)->sel : 0u;
    {
        pr_t r = {p->d, p->size - PROJ_HDR, 0, 0};
        while (r.i + 3u <= r.n && !r.bad) {
            uint32_t tag = pr_u8(&r), len = pr_u8(&r);
            len |= pr_u8(&r) << 8;
            if (len > r.n - r.i)
                break;
            if (tag == 'S' && len)
                return r.b[r.i] < NTRK ? r.b[r.i] : 0u;
            r.i += len;
        }
    }
    return 0;
}
/* track k's LEN and DIV in a project (the song's chains: a section's bars), as at power-on when it has none */
static void proj_lendiv(const project_t *p, uint32_t k, int32_t *len, int32_t *div)
{
    *len = TP[P_SLEN].def;
    *div = TP[P_SDIV].def;
    if (p->magic != PROJ_MAGIC) {
        if (k < 4u) {
            *len = ((const project_v6_t *)p)->t[k].p[P_SLEN];
            *div = ((const project_v6_t *)p)->t[k].p[P_SDIV];
        }
        return;
    }
    {
        pr_t r = {p->d, p->size - PROJ_HDR, 0, 0};
        while (r.i + 3u <= r.n && !r.bad) {
            uint32_t tag = pr_u8(&r), len_c = pr_u8(&r);
            len_c |= pr_u8(&r) << 8;
            if (len_c > r.n - r.i)
                break;
            if (tag == 'T' && len_c >= 5u && r.b[r.i] == k) {
                pr_t c = {r.b + r.i + 4u, len_c - 4u, 0, 0};   /* (past index, kind, engine, preset) */
                uint32_t nc = pr_u8(&c), j;
                uint8_t map[32];
                if (nc > 8u * sizeof map)
                    return;
                for (j = 0; j < (nc + 7u) / 8u; j++)
                    map[j] = (uint8_t)pr_u8(&c);
                for (j = 0; j < nc && !c.bad; j++)
                    if ((map[j / 8u] >> (j % 8u)) & 1u) {
                        int32_t v = pr_v(&c);
                        if (j == P_SLEN)
                            *len = v;
                        else if (j == P_SDIV)
                            *div = v;
                    }
                return;
            }
            r.i += len_c;
        }
    }
}

#ifndef PROJ_HOST
#if FELUCCA_ARRANGER
#include "arranger_scene.c"
#endif
static uint8_t sec_dirty, song_dirty;           /* live sections / the song: in RAM, not yet in flash */
#if FELUCCA_FLASH
/* slot from flash into RAM (format 5, or an old one converted) */
static union {
    project_t v6;
    project_v5_t v5;
    project_v4_t v4;
    project_v3_t v3;
    project_v2_t v2;
    project_v1_t v1;
} proj_tmp;
UI_SMALL static void *up_stage(void) { return &proj_tmp; }   /* upreset.c: a user preset bank staged for a write (sloop-lab) */
UI_SMALL static void proj_fetch(uint32_t slot)
{
    project_t *q = &proj_slot[slot & 3u];
    int n = st_load(OBJ_PROJECT0 + (slot & 3u), &proj_tmp, sizeof proj_tmp);
    if (!proj_import(q, &proj_tmp, n))
        q->magic = 0;
}
#include "fm6_bank.c"                           /* the FM6 patch bank (eng_fm6.c PTCH B1..B27): staged in proj_tmp */
#endif

static const char *const SEC_NAME[4] = {"A", "B", "C", "D"};   /* (2.7: the slots named as the song's sections) */
UI_SMALL static void project_save(uint32_t slot)
{
    project_t *p = &proj_slot[slot & 3u];
#if FELUCCA_ARRANGER
    if (song.playing || transport_req) { ui_message("STOP BEFORE SAVE"); return; }
#endif
    if (!proj_capture(p)) {
        ui_message("PROJECT FULL: NOT SAVED");     /* (the section as it was: nothing cut) */
        return;
    }
#if FELUCCA_FLASH
    if (flash_ok) {
        if (st_save(OBJ_PROJECT0 + (slot & 3u), p, proj_bytes(p)))
            ui_message("SAVE ERROR");
        else
            ui_say("SAVED SECTION ", SEC_NAME[slot & 3u]);
        return;
    }
#endif
    ui_message("SAVED (RAM)");
}

/* SAVE > PROJECT > ERASE (SLOOP 2.6, after a YouTube comment): the slot (section A..D) empty again. In flash as the
 * editor's restore leaves an empty slot (project_restore): an object of no bytes, which proj_fetch (older SLOOP too)
 * reads as no project. The song's steps that played that section are taken out (the default song if none is left),
 * so song mode still plays. Stopped only: a flash erase stops the audio ~50 ms */
UI_SMALL static void project_erase(uint32_t slot)
{
    slot &= 3u;
#if FELUCCA_ARRANGER
    if (song.playing || transport_req) { ui_message("STOP BEFORE ERASE"); return; }
#endif
    if (!proj_ok(&proj_slot[slot])) {
        ui_say("EMPTY SECTION ", SEC_NAME[slot]);
        return;
    }
#if FELUCCA_FLASH
    if (flash_ok && st_save(OBJ_PROJECT0 + slot, &proj_slot[slot], 0)) {
        ui_message("ERASE ERROR");
        return;
    }
#endif
    fm1_irq_off();
    memset(&proj_slot[slot], 0, sizeof proj_slot[slot]);
    sec_dirty &= (uint8_t)~(1u << slot);
    if (live_sec == (int8_t)slot)
        live_sec = -1;
#if FELUCCA_ARRANGER
    if (arr_drop_scene(&arrangement, slot))
        song_dirty = 1;                                     /* (saved with the settings, when quiet) */
#endif
    fm1_irq_on();
    ui_say("ERASED SECTION ", SEC_NAME[slot]);
}

/* a project into the working one: the transport stops, everything sounding is released */
UI_SMALL static void project_apply(const project_t *p)
{
    uint32_t k;
    transport_req = 2;
    panic_req = (1u << NTRK) - 1u;
    for (k = 0; k < NTRK; k++) {
        drum_mute[k] = 0;                               /* (the live mutes: a performance's, not the project's) */
        ex_off[k] = 0;                                  /* (2.7.1) MIDI EXPRESSION: full again, as after CC 121 */
    }
    fm1_irq_off();                                      /* the audio ISR must not see half a project */
    proj_apply(p, 1);
    song.sel = (uint8_t)proj_sel(p);
    fm1_irq_on();
    if (p->magic == PROJ_MAGIC_V6)
        for (k = 0; k < 3u; k++)                        /* a format 1 project: the default sounds of tracks 2, 3 */
            if (((const project_v6_t *)p)->t[k].preset == 0xFFu) {
                apply_preset_to(&trk[k], TRK_DEF[k][2]);
                steps_clear(&trk[k]);
            }
    sync_reload = 1;
    ui.force = 1;
}

UI_SMALL static void project_load(uint32_t slot)
{
    project_t *p = &proj_slot[slot & 3u];
#if FELUCCA_ARRANGER
    if (song.playing || transport_req) { ui_message("STOP BEFORE LOAD"); return; }
#endif
#if FELUCCA_FLASH
    if (flash_ok && !proj_ok(p))
        proj_fetch(slot);
#endif
    if (!proj_ok(p)) {
        ui_say("EMPTY SECTION ", SEC_NAME[slot & 3u]);
        return;
    }
    project_apply(p);
    ui_say("LOADED SECTION ", SEC_NAME[slot & 3u]);
}

/* ---- the working project, kept in flash by itself: saved when it changed, the transport is stopped,
 * nothing sounds and the panel was not touched for AUTOSAVE_IDLE (a flash erase stops the audio for
 * ~50 ms: never while something plays); loaded at power-on (autosave_resume) */
#define AUTOSAVE_IDLE 2500u                    /* ms without input */
#define AUTOSAVE_GAP 20000u                    /* ms between two saves at least */
static project_t autosave_buf __attribute__((section(".pool")));
static uint32_t autosave_hash, autosave_ms, autosave_checked;
static uint8_t autosave_full;                  /* the last capture fitted no format (said once) */

UI_SMALL static int audio_quiet(void)
{
    uint32_t p, i;
    for (p = 0; p < NTRK; p++)
        for (i = 0; i < NVOICE; i++)
            if (trk[p].v[i].active)
                return 0;
    for (i = 0; i < NDRUM; i++)
        if (drums.v[i].active)
            return 0;
    return 1;
}

UI_SMALL static void autosave_tick(void)                /* main loop */
{
#if FELUCCA_FLASH
    uint32_t h, now = fm1_ms;
    if (!flash_ok || song.playing || transport_req || rec_wait || ft_on || ui.menu ||
        now - ui_input_ms < AUTOSAVE_IDLE || now - autosave_ms < AUTOSAVE_GAP || now - autosave_checked < 1000u)
        return;
    autosave_checked = now;
    if (!proj_capture(&autosave_buf)) {                 /* (it fits neither format: the project stays in RAM; said once) */
        if (!autosave_full)
            ui_message("PROJECT FULL: NO AUTOSAVE");
        autosave_full = 1;
        return;
    }
    autosave_full = 0;
    h = proj_sumof(&autosave_buf);
    if (h == autosave_hash || !audio_quiet())
        return;
    if (st_save(OBJ_AUTOSAVE, &autosave_buf, proj_bytes(&autosave_buf)) == 0)
        autosave_hash = h;
    autosave_ms = fm1_ms;
#endif
}

static uint8_t drch_seed;                           /* a settings object as 2.5 wrote it: the drum channel was the
                                                     * project's then (autosave_resume takes it from a 2.5 autosave) */
UI_SMALL static void autosave_resume(void)              /* power-on: the project as it was left (felucca_init) */
{
#if FELUCCA_FLASH
    project_t *q = &autosave_buf;
    int n;
    if (!flash_ok)
        return;
    n = st_load(OBJ_AUTOSAVE, &proj_tmp, sizeof proj_tmp);
    if (!proj_import(q, &proj_tmp, n))
        return;
    autosave_hash = proj_sumof(q);
    if (q->magic == PROJ_MAGIC_V6) {
        const project_v6_t *q6 = (const project_v6_t *)q;
        if (drch_seed && !(q6->rsv[0] & 0x80u) && q6->g[G_DRCH] >= 0 && q6->g[G_DRCH] <= 16 && q6->g[G_DRCH] != midi_set[3]) {
            midi_set[3] = (uint8_t)q6->g[G_DRCH];     /* (2.6) updated from 2.5: GLO > DRUMS > CH as it was there (a
                                                     * project's then, a setting of the FM-1 now), kept in the settings */
            settings_later = 1;
        }
    }
    drch_seed = 0;
    proj_apply(q, 1);
    song.sel = (uint8_t)proj_sel(q);
    for (n = 0; n < NTRK; n++)
        trk[n].engine = trk[n].eng_req;        /* (nothing sounds yet: no fade) */
#endif
}

/* settings + learned panel table: one flash object. The flash copy wins at
 * boot (the .noinit copies are garbage after a power-off). */
typedef struct {
    uint32_t magic, palette, lowcut, zoom;
    panel_t panel;
#if FELUCCA_ARRANGER
    arr_config_t arrangement;
#endif
    uint32_t lights;                               /* SLOOP 2.3: the backlight (panel.c lights_word); appended,
                                                    * so 2.2 still reads its part (st_load cuts at its size) */
} persist_t;
_Static_assert(sizeof(side_rec_t) == 80u && sizeof(side_rec_t) <= ST_SIDE_MAX, "the side record: theme, favourites");
static side_rec_t side_out;
#define PERSIST_SIZE_V22 __builtin_offsetof(persist_t, lights)   /* the settings as 2.2 wrote them (no lights) */
_Static_assert(sizeof(persist_t) == PERSIST_SIZE_V22 + 4u, "lights: the last word, no padding before it");
#if FELUCCA_ARRANGER
_Static_assert(__builtin_offsetof(persist_t, arrangement) == 48u && sizeof(arr_config_t) == 36u,
               "the web editor's Song page edits bytes 48..83 of the settings (web/editor.html ARR)");
#endif
#if FELUCCA_ARRANGER
#define PERSIST_MAGIC 0x50455233u                  /* "PER3": includes the song order */
#else
#define PERSIST_MAGIC 0x50455232u
#endif
#if FELUCCA_FLASH
static persist_t persist_saved;
static void dsu_boot(void);
#endif

UI_SMALL static void persist_boot(void)                    /* before settings_init / panel_init */
{
#if FELUCCA_ARRANGER
    arr_defaults(&arrangement);
#endif
#if FELUCCA_FLASH
    persist_t p;
    uint32_t f = irq_save();
    flash_ok = FL_FAR(fl_jedec_ram)() == 0x856014u;       /* the expected 1 MiB part, else stay RAM-only */
    irq_restore(f);
    if (!flash_ok)
        return;
    fl_plain_window_init();                        /* flash above 0x93000 reads as plaintext through XIP
                                                    * (user sample sets are played from there) */
    {
        uint32_t k;
        for (k = 0; k < SMP_USER_SLOTS; k++)
            smp_user_scan(k);
    }
    {
        int n = st_load(OBJ_SETTINGS, &p, sizeof p);
        if (n == (int)PERSIST_SIZE_V22 && p.magic == PERSIST_MAGIC)
            p.lights = 0;                          /* from 2.2: backlight off */
        if (((n == (int)sizeof p || n == (int)PERSIST_SIZE_V22) && p.magic == PERSIST_MAGIC)
#if FELUCCA_ARRANGER
            || (n == (int)(16u + sizeof(panel_t)) && p.magic == 0x50455232u)
#endif
            ) {
            settings.magic = SETTINGS_MAGIC;
            settings.palette = p.palette;
            settings.lowcut = p.lowcut;
            settings.zoom = p.zoom;
            if (p.panel.magic == PANEL_MAGIC)
                panel = p.panel;
            if (p.magic == PERSIST_MAGIC)
                lights_from_word(p.lights);
            else
                p.lights = 0;
#if FELUCCA_ARRANGER
            if (p.magic == PERSIST_MAGIC && arr_valid(&p.arrangement, 15u))
                arrangement = p.arrangement;
            else
                p.arrangement = arrangement;
#endif
            persist_saved = p;
            {   /* 2.7: the theme and the favourites, in the side record of the same copy (gfx.c, storage.c st_side) */
                side_rec_t r;
                if (st_side_load(OBJ_SETTINGS, &r, sizeof r) == 0)
                    side_take(&r);
            }
        } else if (n == (int)(8u + sizeof(panel_t)) && p.magic == 0x50455231u) {   /* "PER1": palette, panel */
            const uint32_t *w = (const uint32_t *)&p;
            panel_t old;
            memcpy(&old, w + 2, sizeof old);
            settings.magic = SETTINGS_MAGIC;
            settings.palette = w[1];
            settings.lowcut = 0;
            settings.zoom = 0;
            if (old.magic == PANEL_MAGIC)
                panel = old;
        }
    }
    {   /* projects: fill empty RAM slots from flash, so the slot list is right after power-on. A slot
         * still valid in RAM (a warm reset: an update, UPDATE MODE, a crash) may never have reached
         * flash (a live section stored while playing): marked to be written when quiet */
        uint32_t i;
        for (i = 0; i < 4u; i++)
            if (!proj_ok(&proj_slot[i])) {
                proj_fetch(i);
            } else {
                int n = st_load(OBJ_PROJECT0 + i, &proj_tmp, sizeof proj_tmp);
                if (n != (int)sizeof proj_slot[i] || memcmp(&proj_tmp.v6, &proj_slot[i], sizeof proj_slot[i]))
                    sec_dirty |= (uint8_t)(1u << i);
            }
    }
    dsu_boot();                                    /* SLOOP 2.5: the SYN kits (after the settings) */
    up_boot();                                     /* user presets */
    fm6_bank_boot();                               /* the FM6 patch bank (fm6_bank.c) */
#endif
}

UI_SMALL static int project_used(uint32_t slot) { return proj_ok(&proj_slot[slot & 3u]); }

#if FELUCCA_FLASH
/* SLOOP 2.5: the settings object holds the SYN kits after persist_t (drum_synth.c dsu): firmware before 2.5 reads
 * its persist_t and leaves the rest (st_load cuts at its size); its own next save drops them. 2.6: then the MIDI LEARN
 * map (seq.c ml_tab, ML_N entries), only while something is learned; 2.5 reads an object with the map as one without
 * its SYN kits (their defaults), one without it as its own */
/* the settings object's third part (2.6): the MIDI LEARN map (seq.c ml_tab, ML_N entries, 2 bytes each, low first),
 * then GLO > MIDI: CH1 CH2 CH3, the drum channel | OTHER << 7, GLO > MIDI 2's BEND, 3 spare. Written only while it is not
 * the default (nothing learned, channels 1 2 3 10, OTHER SEL, BEND 2): else the object is exactly 2.5's. 2.6 test
 * builds wrote 32 (the map) or 36 bytes (and the channels) */
/* (eight tracks) MIDI_PART_8: then GLO > MIDI 4's CH5..CH8 and ml_hi (the learned entries of tracks 5..8), low first, two
 * spare. Written only when one of them is not the default: else the part is exactly 2.7's (MIDI_PART); a SLOOP before it
 * reads the first MIDI_PART bytes and leaves the rest */
#define MIDI_PART (2u * ML_N + 8u)
#define MIDI_PART_8 (MIDI_PART + 8u)
_Static_assert(sizeof(persist_t) + sizeof(dsu_bank_t) + MIDI_PART_8 <= ST_PAYLOAD_MAX, "the settings object fits its sector");
static uint8_t midi_saved[MIDI_PART_8];
static uint8_t drch_seed;                           /* a settings object as 2.5 wrote it: the drum channel was the
                                                     * project's then (autosave_resume takes it from a 2.5 autosave) */               /* the part as flash has it (settings_save: written when it differs) */
UI_SMALL static void midi_part_fill(uint8_t *b)
{
    uint32_t k;
    for (k = 0; k < ML_N; k++)
        b[2u * k] = (uint8_t)ml_tab[k], b[2u * k + 1u] = (uint8_t)(ml_tab[k] >> 8);
    b[2u * ML_N] = midi_set[0], b[2u * ML_N + 1u] = midi_set[1], b[2u * ML_N + 2u] = midi_set[2];
    b[2u * ML_N + 3u] = (uint8_t)(midi_set[3] | (drum_preview != 0u) << 5 | (step_adv_off != 0u) << 6 | midi_set[4] << 7);
                                                    /* (2.7.1: bit 5 DRUM PREVIEW, bit 6 STEP ADVANCE OFF: bits 2.7 does not read) */
    b[2u * ML_N + 4u] = (uint8_t)(midi_set[5] | (fxfade > 15u ? 15u : fxfade) << 4);   /* BEND (bits 0-3); 2.7.2: FX FADE bits 4-7 (0 = none: the byte reads as 2.6's BEND) */
    b[2u * ML_N + 5u] = midi_set[6];                /* (2.7) GLO > MIDI 3: FX CH (2.6 read this spare byte as nothing) */
    b[2u * ML_N + 6u] = (uint8_t)(midi_set[7] | midi_set[9] << 1 |
                                  (flt_reso > 10u ? 10u : flt_reso) << 2);   /* (2.7) GLO > MIDI 3: DR MAP, bit 1 CLK OUT
                                                                      * (a spare byte to 2.6); 2.7.2: FILTER RESO in bits
                                                                      * 2..5 (0 = none: the byte then reads as 2.7's) */
    b[2u * ML_N + 7u] = midi_set[8];                /* (2.7) GLO > MIDI 3: REMOTE (the last spare byte) */
    for (k = 0; k < 4u; k++)
        b[MIDI_PART + k] = midi_set[10u + k];       /* (eight tracks) CH5..CH8 */
    b[MIDI_PART + 4u] = (uint8_t)ml_hi, b[MIDI_PART + 5u] = (uint8_t)(ml_hi >> 8);
    b[MIDI_PART + 6u] = (uint8_t)(rec_locks != 0u);    /* menu SEQ > REC KNOBS (LOCKS) */
    b[MIDI_PART + 7u] = 0;
}
/* the bytes of the part to write: MIDI_PART_8 when the eight-track tail holds something, else 2.7's MIDI_PART */
UI_SMALL static uint32_t midi_part_len(const uint8_t *b)
{
    uint32_t k;
    for (k = MIDI_PART; k < MIDI_PART_8; k++)
        if (b[k])
            return MIDI_PART_8;
    return MIDI_PART;
}
UI_SMALL static int midi_part_default(const uint8_t *b)
{
    static const uint8_t def[14] = MIDI_SET_DEF;
    uint32_t k;
    for (k = 0; k < 2u * ML_N; k++)
        if (b[k])
            return 0;
    for (k = MIDI_PART; k < MIDI_PART_8; k++)
        if (b[k])
            return 0;
    return b[2u * ML_N] == def[0] && b[2u * ML_N + 1u] == def[1] && b[2u * ML_N + 2u] == def[2] &&
           b[2u * ML_N + 3u] == (uint8_t)(def[3] | def[4] << 7) && b[2u * ML_N + 4u] == def[5] && b[2u * ML_N + 5u] == def[6] &&
           b[2u * ML_N + 6u] == (uint8_t)(def[7] | def[9] << 1) && b[2u * ML_N + 7u] == def[8];
}
/* n: 32 (the map), 36 (and the channels) or MIDI_PART; every entry checked (a CC that learns, a parameter this knows, a
 * channel 0..16, a range 1..12) */
UI_SMALL static void midi_part_read(const uint8_t *b, uint32_t n)
{
    uint32_t k, e;
    fm1_irq_off();                                  /* (the ISR reads the map and the channels: never half of them) */
    for (k = 0; k < ML_N; k++) {
        e = (uint32_t)b[2u * k] | (uint32_t)b[2u * k + 1u] << 8;
        ml_tab[k] = (uint16_t)((e >> 9) && ml_free_cc(e & 127u) && ml_id(e >> 9) < P_COUNT ? e : 0u);
    }
    if (n >= 2u * ML_N + 4u) {
        for (k = 0; k < 3u; k++)
            midi_set[k] = (uint8_t)(b[2u * ML_N + k] <= 16u ? b[2u * ML_N + k] : k + 1u);
        midi_set[3] = (uint8_t)((b[2u * ML_N + 3u] & 31u) <= 16u ? b[2u * ML_N + 3u] & 31u : 10u);
        midi_set[4] = (uint8_t)(b[2u * ML_N + 3u] >> 7);
        drum_preview = (uint8_t)((b[2u * ML_N + 3u] >> 5) & 1u);   /* (2.7.1) menu DRUM PREVIEW; older: OFF */
        step_adv_off = (uint8_t)((b[2u * ML_N + 3u] >> 6) & 1u);   /* (2.7.1) menu STEP ADVANCE; older: ON */
        song.g[G_CH1] = midi_set[0], song.g[G_CH2] = midi_set[1], song.g[G_CH3] = midi_set[2];
        song.g[G_DRCH] = midi_set[3], song.g[G_CHOTH] = midi_set[4];
    }
    if (n >= MIDI_PART) {
        midi_set[5] = (uint8_t)((b[2u * ML_N + 4u] & 15u) >= 1u && (b[2u * ML_N + 4u] & 15u) <= 12u ? b[2u * ML_N + 4u] & 15u : 2u);
        song.g[G_BEND] = midi_set[5];
        fxfade = (uint8_t)((b[2u * ML_N + 4u] >> 4) & 15u);         /* (2.7.2) FX FADE (bits 4-7); older: 0 */
        song.g[G_FXFADE] = fxfade;
        midi_set[6] = (uint8_t)(b[2u * ML_N + 5u] <= 16u ? b[2u * ML_N + 5u] : 0u);   /* (2.7) FX CH */
        song.g[G_FXCH] = midi_set[6];
        midi_set[7] = (uint8_t)(b[2u * ML_N + 6u] & 1u);             /* (2.7) DR MAP */
        midi_set[9] = (uint8_t)((b[2u * ML_N + 6u] >> 1) & 1u);      /* (2.7) CLK OUT */
        flt_reso = (uint8_t)((b[2u * ML_N + 6u] >> 2) & 15u);        /* (2.7.2) FILTER RESO (bits 2..5); older: 0 */
        if (flt_reso > 10u)
            flt_reso = 10u;
        song.g[G_DRMAP] = midi_set[7];
        song.g[G_CLKOUT] = midi_set[9];
        midi_set[8] = (uint8_t)(b[2u * ML_N + 7u] <= 16u ? b[2u * ML_N + 7u] : 0u);   /* (2.7) REMOTE */
        song.g[G_RMCH] = midi_set[8];
    }
    ml_hi = 0;
    for (k = 0; k < 4u; k++)                        /* (eight tracks) CH5..CH8, the learned entries of tracks 5..8 */
        midi_set[10u + k] = (uint8_t)(n >= MIDI_PART_8 && b[MIDI_PART + k] <= 16u ? b[MIDI_PART + k] : 0u);
    if (n >= MIDI_PART_8)
        ml_hi = (uint16_t)((uint32_t)b[MIDI_PART + 4u] | (uint32_t)b[MIDI_PART + 5u] << 8);
    rec_locks = (uint8_t)(n >= MIDI_PART_8 && (b[MIDI_PART + 6u] & 1u));   /* (older: SOUND) */
    song.g[G_CH5] = midi_set[10], song.g[G_CH6] = midi_set[11], song.g[G_CH7] = midi_set[12], song.g[G_CH8] = midi_set[13];
    fm1_irq_on();
}
UI_SMALL static int settings_write(const persist_t *p)
{
    uint8_t mp[MIDI_PART_8];
    int rc;
    if (!dsu_valid(&dsu))
        dsu_defaults();
    midi_part_fill(mp);
    /* the third part only when it is not the default: without, the object is exactly 2.5's (2.5 reads it whole, SYN
     * kits included; with it, it takes the object for one without them). 2.7: the theme in the side record */
    side_fill(&side_out);
    st_side = &side_out;
    st_side_len = sizeof side_out;
    rc = st_save3(OBJ_SETTINGS, p, sizeof *p, &dsu, sizeof dsu, mp, midi_part_default(mp) ? 0u : midi_part_len(mp));
    st_side = 0;
    if (rc)
        return -1;
    dsu_dirty = 0;
    fav_dirty = 0;
    memcpy(midi_saved, mp, sizeof midi_saved);
    return 0;
}
static void dsu_boot(void)                          /* the SYN kits (and the MIDI part) from the settings object, else */
{                                                   /* the defaults */
    st_hdr_t h;
    uint32_t len = sizeof(persist_t) + sizeof(dsu_bank_t), k;
    dsu_defaults();
    for (k = 0; k < ML_N; k++)
        ml_tab[k] = 0;
    ml_hi = 0;
    if (st_current(OBJ_SETTINGS, &h) >= 0 &&
        (h.len == len || h.len == len + 2u * ML_N || h.len == len + 2u * ML_N + 4u || h.len == len + MIDI_PART ||
         h.len == len + MIDI_PART_8) &&
        dsu_valid((const dsu_bank_t *)(st_buf + sizeof(persist_t)))) {
        memcpy(&dsu, st_buf + sizeof(persist_t), sizeof dsu);
        for (k = 0; k < DSU_N; k++)
            dsu_fix_kit(&dsu.k[k]);
        if (h.len > len)
            midi_part_read(st_buf + len, h.len - len);
        drch_seed = h.len == len;
    }
    midi_part_fill(midi_saved);
    dsu_dirty = 0;
}
#endif

UI_SMALL static void persist_fill(persist_t *p)              /* the settings as they are now */
{
    memset(p, 0, sizeof *p);
    p->magic = PERSIST_MAGIC;
    p->palette = settings.palette;
    p->lowcut = settings.lowcut;
    p->zoom = settings.zoom;
    p->panel = panel;
    p->lights = lights_word();
#if FELUCCA_ARRANGER
    p->arrangement = arrangement;
#endif
}

UI_SMALL static void settings_save(void)
{
#if FELUCCA_FLASH
    persist_t p;
    if (!flash_ok)
        return;
    persist_fill(&p);
    {
        uint8_t mp[MIDI_PART_8];
        midi_part_fill(mp);
        if (!memcmp(&p, &persist_saved, sizeof p) && !memcmp(mp, midi_saved, sizeof mp) && !fav_dirty)
            return;                                /* unchanged: no erase cycle */
    }
    if (settings_write(&p) == 0)
        persist_saved = p;
#endif
}

#if FELUCCA_FLASH
_Static_assert(sizeof(project_t) <= ST_PAYLOAD_MAX, "project does not fit one flash sector");

/* ---- backup restore (editor.c BK_PUT): each object checked as a load checks it, then written through the
 * same A/B commit as a save. rc: 0 ok, 2 not a valid object, 3 stop the song first, 4 flash */
UI_SMALL static int panel_valid(const panel_t *q)           /* a permutation of the buttons and of the knobs */
{
    uint32_t i, b = 0, e = 0;
    if (q->magic != PANEL_MAGIC)
        return 0;
    for (i = 0; i < NB; i++) {
        if (q->btn[i] >= 14u || (b >> q->btn[i]) & 1u)
            return 0;
        b |= 1u << q->btn[i];
    }
    for (i = 0; i < NE; i++) {
        if (q->enc[i] >= 7u || (e >> q->enc[i]) & 1u || (q->dir[i] != 1 && q->dir[i] != -1))
            return 0;
        e |= 1u << q->enc[i];
    }
    return 1;
}

UI_SMALL static uint32_t settings_restore(const void *raw, uint32_t n)
{
    persist_t p;
    if (n != sizeof p && n != PERSIST_SIZE_V22)
        return 2;
    memset(&p, 0, sizeof p);
    memcpy(&p, raw, n);
    if (p.magic != PERSIST_MAGIC || p.palette >= NPALETTES || p.lowcut > 1u || p.zoom > 1u || !panel_valid(&p.panel))
        return 2;
#if FELUCCA_ARRANGER
    if (!arr_valid(&p.arrangement, 15u))
        return 2;
    if ((song.playing || transport_req) && memcmp(&p.arrangement, &arrangement, sizeof arrangement))
        return 3;                                    /* SLOOP 2.5: a new song order only when stopped (as on the SONG screen) */
#endif
    if (!flash_ok || settings_write(&p))
        return 4;
    persist_saved = p;
    settings.palette = p.palette;
    settings.lowcut = p.lowcut;
    settings.zoom = p.zoom;
    panel = p.panel;
#if FELUCCA_ARRANGER
    arrangement = p.arrangement;
#endif
    lights_from_word(p.lights);
    song.g[G_SYNC] = (int16_t)lights_sync;
    song.g[G_MIDI] = (int16_t)lights_mout;
    song.g[G_ROUTE] = (int16_t)lights_min;
    palette_set(settings.palette);
    fx_lowcut = (uint8_t)(settings.lowcut != 0);
    ui.force = 1;
    return 0;
}

/* slot 0..3 (n 0: empty), or 4: the working project (loaded now) */
UI_SMALL static uint32_t project_restore(uint32_t slot, const void *raw, uint32_t n)
{
    if (song.playing || transport_req)
        return 3;
    if (slot < 4u && !n) {
        if (!flash_ok || st_save(OBJ_PROJECT0 + slot, raw, 0))
            return 4;
        memset(&proj_slot[slot], 0, sizeof proj_slot[slot]);
        sec_dirty &= (uint8_t)~(1u << slot);
        return 0;
    }
    if (!proj_import(&autosave_buf, raw, (int)n))
        return 2;
    if (slot == 4u) {
        project_apply(&autosave_buf);
        return 0;
    }
    if (!flash_ok || st_save(OBJ_PROJECT0 + slot, &autosave_buf, proj_bytes(&autosave_buf)))
        return 4;
    memcpy(&proj_slot[slot], &autosave_buf, sizeof proj_slot[slot]);
    sec_dirty &= (uint8_t)~(1u << slot);
    return 0;
}
#endif
#if FELUCCA_ARRANGER
UI_SMALL static void arrangement_save(void)
{
    if (song.playing || transport_req) { ui_message("STOP BEFORE SAVE"); return; }
    settings_save();
#if FELUCCA_FLASH
    if (flash_ok) {
        ui_message(memcmp(&persist_saved.arrangement, &arrangement, sizeof arrangement) ? "SAVE ERROR" : "SONG SAVED");
        return;
    }
#endif
    ui_message("SONG IN RAM ONLY");
}

/* ---- live sections (SAVE + key, ui_layers.c). A section is a project slot (A..D = 1..4): stored into RAM
 * at once (playing too), written to flash once the transport is stopped and nothing sounds (an erase
 * stops the audio for ~50 ms); a song recorded with SONG REC is saved the same way. */
UI_SMALL static int section_store(uint32_t s)          /* 0: PROJECT FULL, the section as it was */
{
    int ok;
    s &= 3u;
    fm1_irq_off();                                      /* (the audio ISR may be applying a section) */
    ok = proj_capture(&proj_slot[s]);
    if (ok)
        live_sec = (int8_t)s;
    fm1_irq_on();
    if (ok)
        sec_dirty |= (uint8_t)(1u << s);
    return ok;
}
UI_SMALL static void section_load(uint32_t s)                    /* stopped: the section is the loop now */
{
    s &= 3u;
    project_apply(&proj_slot[s]);
    live_sec = (int8_t)s;
}
UI_SMALL static void sections_write(void)                        /* the dirty sections and song into flash */
{
    uint32_t i;
#if FELUCCA_FLASH
    if (flash_ok)
        for (i = 0; i < 4u; i++)
            if (((sec_dirty >> i) & 1u) && st_save(OBJ_PROJECT0 + i, &proj_slot[i], proj_bytes(&proj_slot[i])) == 0)
                sec_dirty &= (uint8_t)~(1u << i);       /* (a failed write stays dirty: tried again later) */
    if (!flash_ok)
#endif
        sec_dirty = 0;
    (void)i;
    if (song_dirty || fav_dirty) {                      /* (2.7: the favourites too) */
        song_dirty = 0;
        settings_save();
    }
}
/* before an intentional reset (an update, UPDATE MODE, UBOOT from the host): the audio is stopped, so
 * whatever is only in RAM goes to flash now: the live sections, the song, the working project */
UI_SMALL static void persist_flush_now(void)
{
    sections_write();
#if FELUCCA_FLASH
    if (flash_ok && !arrangement_clock.running) {     /* (a song playing: the tracks hold a section) */
        proj_capture(&autosave_buf);
        if (autosave_buf.sum != autosave_hash && st_save(OBJ_AUTOSAVE, &autosave_buf, sizeof autosave_buf) == 0)
            autosave_hash = autosave_buf.sum;
    }
#endif
}
UI_SMALL static void sections_flush(void)                        /* main loop */
{
    static uint32_t tried;
    if (srec_done) {
        song_dirty = srec_done != 0xFFu;
        if (song_dirty) {
            char b[8];
            fmt_int(b, srec_done);
            ui_say("SONG PARTS ", b);
        } else {
            ui_message("NO SONG");
        }
        srec_done = 0;
    }
    if ((uint32_t)song.g[G_SYNC] != lights_sync) {      /* GLO > SYSTEM > SYNC: kept with the settings */
        lights_sync = (uint8_t)song.g[G_SYNC];
        settings_later = 1;
    }
    if ((uint32_t)(song.g[G_MIDI] != 0) != lights_mout) {   /* GLO > SYSTEM > MIDI: the same */
        lights_mout = (uint8_t)(song.g[G_MIDI] != 0);
        settings_later = 1;
    }
    if ((uint32_t)song.g[G_ROUTE] != lights_min) {        /* GLO > SYSTEM > IN: the same (2.6: CH n too) */
        lights_min = (uint8_t)song.g[G_ROUTE];
        settings_later = 1;
    }
    {   /* 2.6: GLO > MIDI (CH1 CH2 CH3 OTHER) and GLO > DRUMS > CH: the same */
        static const uint8_t gid[14] = {G_CH1, G_CH2, G_CH3, G_DRCH, G_CHOTH, G_BEND, G_FXCH, G_DRMAP, G_RMCH, G_CLKOUT,
                                        G_CH5, G_CH6, G_CH7, G_CH8};
        uint32_t k;
        for (k = 0; k < 14u; k++)
            if ((uint32_t)song.g[gid[k]] != midi_set[k]) {
                midi_set[k] = (uint8_t)song.g[gid[k]];
                settings_later = 1;
            }
        if ((uint32_t)song.g[G_FXFADE] != fxfade) {   /* (2.7.2) GLO > MASTER 2 > FADE: a setting of the FM-1 */
            fxfade = (uint8_t)song.g[G_FXFADE];
            settings_later = 1;
        }
    }
    if (settings_later) {                               /* the menu closed while playing */
        settings_later = 0;
        song_dirty = 1;                                 /* (settings_save when quiet, with the song) */
    }
    if ((!sec_dirty && !song_dirty) || song.playing || transport_req || !audio_quiet() || fm1_ms - ui_input_ms < 1500u ||
        fm1_ms - tried < 5000u)
        return;
    tried = fm1_ms;                                     /* (a failed write: again in 5 s, not every frame) */
    sections_write();
    if (sec_dirty)
        ui_message("SAVE ERROR: RETRYING");
}
#endif
#endif /* PROJ_HOST */
