/* SPDX-License-Identifier: GPL-3.0-only
 * The voice: Copyright (C) 2026 zvenson, OberVave 3.3.2 (github.com/zvenson/obervave, commit 099ccd6, GPL-3.0-only):
 * obv_dsp.h (oscillators, filters) and obv_engine.h (voice_block, voice_render, env_tick, lfo_shape), its programs
 * (tools/obervave/, tools/gen_obv.py). BoopBox's adaptation (1.7): the voice as an engine of a track. */
/* OBERVAVE: an 8-voice analog polysynth in the spirit of the classic American ones of 1979-84, OberVave's voice.
 * Two oscillators (saw, pulse, both; hard sync, cross-modulation OSC 2 -> OSC 1, an envelope on OSC 2's pitch) and
 * noise, a drive stage, a 12 dB state-variable filter (LP, HP, BP, notch, SEM's LP .. notch .. HP morph) or a 24 dB
 * ladder, a filter envelope of its own, an LFO (pitch, PWM, filter, amp; a delay, per-voice phase spread) and
 * "vintage": each voice a little off in tune, cutoff and envelope times, drifting.
 *
 * PROG picks one of OberVave's 70 programs: every voice setting comes from it. The other seven knobs move the
 * program's own values (0: as stored), so a program never keeps another's settings: TYPE (PROG: its own),
 * X-MOD, DETUNE (OSC 2's fine), CUT, RES, F.ENV (the filter envelope's amount), DRV. BoopBox plays the notes:
 * the amp envelope is the track's ADSR (the program's sets it, as a preset), and glide, MONO / UNISON, the arp, the
 * bend, the LFO and the effects are the track's, as for every engine. OberVave's own effects, mixer, arp and
 * sequencer are not here. The state of a track's voices lives in its engine arena (engines.c), as FM6's. */
#include "felucca_obv.h"

typedef struct { uint32_t ph; int32_t prev; } obv_osc_t;
typedef struct { int32_t a1, a2, a3, k; } obv_svfc_t;
typedef struct { int32_t ic1, ic2; } obv_svfs_t;
typedef struct { int32_t G, G2, G3, G4, k, inv, gin; } obv_ladc_t;
typedef struct { int32_t s[4]; } obv_lads_t;
typedef struct {
    obv_osc_t o1, o2;
    uint32_t noise;                             /* the voice's noise and vintage walk (xorshift) */
    uint32_t fstage;                            /* the filter envelope: E_* below */
    int32_t flevel;                             /* Q24 */
    obv_svfs_t f1;
    obv_lads_t lad;
    int32_t drift;                              /* the vintage random walk */
    uint32_t lfo_blk;                           /* blocks since the note (LFO delay) */
    int32_t lfo_fade;                           /* Q15 */
} obv_voice_t;
typedef struct {
    uint8_t pv[OP_N];                           /* the program, expanded (OBV_DEF + its changes) */
    uint8_t prog;                               /* which, + 1 (0: not yet) */
    uint32_t lfo_ph, rnd_a, rnd_b, rnd;
    int32_t lfo_val;                            /* this block, Q15 */
    int32_t cut_sm, reso_sm;                    /* CUTOFF and RESO slewed (Q8): a knob sweep glides */
    obv_voice_t v[NVOICE];
} obv_part_t;
static obv_part_t *obv_of(const track_t *t) { return (obv_part_t *)eng_arena_of(t, ENGI_OBV); }

enum { OE_IDLE, OE_ATT, OE_DEC, OE_SUS, OE_REL };
#define OBV_ONE (1 << 24)
/* the voice cards' small differences, scaled by VINTAGE (OberVave's tables) */
static const int16_t OBV_VTUNE8[8] = {-20, 12, 7, -15, 18, -9, 3, -17};          /* +-8 cents */
static const int16_t OBV_VCUT8[8] = {-300, 250, 120, -380, 60, 330, -180, 220};  /* +-1.5 semitones */
static const int8_t OBV_VENV[8] = {10, -6, 14, -12, 3, -16, 8, -4};              /* /128: +-12 % on the times */

static inline uint32_t obv_xs(uint32_t *st)
{
    uint32_t s = *st;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    *st = s;
    return s;
}
/* (obv_dsp.h) a soft knee: linear to +-32768, tanh above; tanh(x / 98304) * 98301; tanh(x / 65536) * 65534 */
static inline __attribute__((always_inline)) int32_t obv_knee(int32_t x)
{
    int32_t a = x < 0 ? -x : x;
    if (a <= 32768)
        return x;
    a = 32768 + softclip(a - 32768);
    return x < 0 ? -a : a;
}
static inline __attribute__((always_inline)) int32_t obv_sat_in(int32_t x) { return softclip((x * 85) >> 8) * 3; }
static inline __attribute__((always_inline)) int32_t obv_tanh(int32_t x) { return softclip(x >> 1) << 1; }

/* ---- the oscillators: naive saw / pulse with polyBLEP corrections as discontinuity events, one sample late (a wrap and
 * a hard-sync reset are the same event). OW_SAW / OW_PLS bits */
static inline __attribute__((always_inline)) int32_t obv_naive(uint32_t ph, uint32_t pw, uint32_t wave)
{
    int32_t v = 0;
    if (wave & OW_SAW)
        v = (int32_t)(ph >> 16) - 32768;
    if (wave & OW_PLS)                          /* saw(ph) - saw(ph + pw): a pulse with mean 0 */
        v += (int32_t)(ph >> 16) - (int32_t)((ph + pw) >> 16);
    return v;
}
static inline __attribute__((always_inline)) void obv_event(int32_t *prev, int32_t *cur, int32_t h, int32_t t)
{
    int32_t u = 32767 - t, h16 = h >> 4;
    *prev += (h16 * ((t * t) >> 15)) >> 12;
    *cur -= (h16 * ((u * u) >> 15)) >> 12;
}
static inline __attribute__((always_inline)) int32_t obv_osc(obv_osc_t *o, uint32_t inc, uint32_t d, uint32_t pw,
                                                             uint32_t wave, int32_t hw, int32_t reset_t)
{
    uint32_t old = o->ph, ph = old + inc;
    int32_t cur, out = o->prev;
    if (reset_t < 0 || !d) {
        cur = obv_naive(ph, pw, wave);
        if (ph < inc && d)
            obv_event(&out, &cur, hw, (int32_t)(ph / d));
        if ((wave & OW_PLS) && ph + pw < inc && d)
            obv_event(&out, &cur, 65536, (int32_t)((ph + pw) / d));
    } else {
        uint32_t at = ph - d * (uint32_t)reset_t;
        int32_t t;
        ph = d * (uint32_t)reset_t;
        cur = obv_naive(ph, pw, wave);
        if (at < old) {
            t = (int32_t)(at / d) + reset_t;
            obv_event(&out, &cur, hw, t > 32767 ? 32767 : t);
        }
        if ((wave & OW_PLS) && at + pw < old + pw) {
            t = (int32_t)((at + pw) / d) + reset_t;
            obv_event(&out, &cur, 65536, t > 32767 ? 32767 : t);
        }
        obv_event(&out, &cur, obv_naive(0, pw, wave) - obv_naive(at, pw, wave), reset_t);
    }
    o->ph = ph;
    o->prev = cur;
    return out;
}

/* ---- the filters. cut: Q8 semitones (0..136 << 8, OBV_SVF_G); k: damping Q12 */
static int32_t obv_g(int32_t cut)
{
    int32_t i, g;
    cut = clamp(cut, 0, 136 << 8);
    i = cut >> 8;
    g = OBV_SVF_G[i];
    if (i < 136)
        g += ((OBV_SVF_G[i + 1] - g) * (cut & 255)) >> 8;
    return g;
}
static void obv_svf_coef(obv_svfc_t *c, int32_t cut, int32_t k)
{
    int32_t g = obv_g(cut), den = 4096 + ((g * (g + k)) >> 12);
    if (den < 64)
        den = 64;
    c->a1 = (int32_t)((4096u << 13) / (uint32_t)den);
    c->a2 = (c->a1 * g) >> 12;
    c->a3 = (c->a2 * g) >> 12;
    c->k = k;
}
static inline __attribute__((always_inline)) void obv_svf(const obv_svfc_t *c, obv_svfs_t *s, int32_t in, int32_t *lp,
                                                          int32_t *bp, int32_t *hp)
{
    int32_t v3 = in - s->ic2;
    int32_t v1 = (c->a1 * s->ic1 + c->a2 * v3) >> 13;
    int32_t v2 = s->ic2 + ((c->a2 * s->ic1 + c->a3 * v3) >> 13);
    int32_t n1 = 2 * v1 - s->ic1;
    s->ic1 = (uint32_t)(n1 + 24576) < 49152u ? n1 : softclip(n1 >> 1) << 1;   /* the resonance stays warm, bounded */
    s->ic2 = 2 * v2 - s->ic2;
    *lp = v2;
    *bp = v1;
    *hp = in - ((c->k * v1) >> 12) - v2;
}
/* the 24 dB ladder: four trapezoidal one-poles, the resonance fed back around all four through a tanh */
static void obv_lad_coef(obv_ladc_t *c, int32_t cut, int32_t k10)
{
    int32_t g = obv_g(cut), G = (int32_t)(((uint32_t)g << 12) / (uint32_t)(4096 + g));
    c->G = G;
    c->G2 = (G * G) >> 12;
    c->G3 = (c->G2 * G) >> 12;
    c->G4 = (c->G3 * G) >> 12;
    c->k = k10;
    c->inv = (int32_t)((4096u << 12) / (uint32_t)(4096 + ((k10 * c->G4) >> 10)));
    c->gin = 4096 + 2 * k10;
}
static inline __attribute__((always_inline)) int32_t obv_lad(const obv_ladc_t *c, obv_lads_t *s, int32_t in)
{
    int32_t G = c->G, *st = s->s, v, y, u;
    int32_t S1 = st[0] - ((G * st[0]) >> 12), S2 = st[1] - ((G * st[1]) >> 12);
    int32_t S3 = st[2] - ((G * st[2]) >> 12), S4 = st[3] - ((G * st[3]) >> 12);
    int32_t x = (in * c->gin) >> 12;
    int32_t acc = ((c->G3 * S1 + c->G2 * S2 + G * S3) >> 12) + S4;
    int32_t y4 = (int32_t)(((int64_t)(((c->G4 * x) >> 12) + acc) * c->inv) >> 12);
    u = obv_tanh(x - ((c->k * clamp(y4, -131072, 131071)) >> 10));
    v = ((u - st[0]) * G) >> 12; y = v + st[0]; st[0] = y + v;
    v = ((y - st[1]) * G) >> 12; y = v + st[1]; st[1] = y + v;
    v = ((y - st[2]) * G) >> 12; y = v + st[2]; st[2] = y + v;
    v = ((y - st[3]) * G) >> 12; y = v + st[3]; st[3] = y + v;
    return y;
}

/* ---- the filter envelope (OberVave's env_tick): attack aims at 1.3 and stops at 1.0, decay and release exponential */
static void obv_env(obv_voice_t *e, uint32_t a, uint32_t d, int32_t sus, uint32_t r, int gate, int32_t vt)
{
    int32_t k, target;
    if (gate && e->fstage >= OE_REL)
        e->fstage = OE_ATT;
    if (!gate && e->fstage && e->fstage < OE_REL)
        e->fstage = OE_REL;
    switch (e->fstage) {
    case OE_ATT:
        k = (int32_t)OBV_ENV_ATT[a & 127u];
        k += (int32_t)(((int64_t)k * vt) >> 7);
        target = OBV_ONE + (OBV_ONE * 3 >> 3);
        e->flevel += (int32_t)(((int64_t)(target - e->flevel) * k) >> 24);
        if (e->flevel >= OBV_ONE) {
            e->flevel = OBV_ONE;
            e->fstage = OE_DEC;
        }
        break;
    case OE_DEC:
        k = (int32_t)OBV_ENV_DEC[d & 127u];
        k += (int32_t)(((int64_t)k * vt) >> 7);
        e->flevel += (int32_t)(((int64_t)(sus - e->flevel) * k) >> 24) - 16;
        if (e->flevel <= sus + 64) {
            e->flevel = sus;
            e->fstage = OE_SUS;
        }
        break;
    case OE_SUS:
        e->flevel = sus;
        break;
    case OE_REL:
        k = (int32_t)OBV_ENV_DEC[r & 127u];
        k += (int32_t)(((int64_t)k * vt) >> 7);
        e->flevel -= (int32_t)(((int64_t)e->flevel * k) >> 24) + 16;
        if (e->flevel <= 0) {
            e->flevel = 0;
            e->fstage = OE_IDLE;
        }
        break;
    default:
        break;
    }
}

/* ---- the LFO (one per track, as the originals' one per sound) */
static int32_t obv_lfo_shape(const obv_part_t *P, uint32_t ph, uint32_t shape)
{
    switch (shape) {
    case OL_TRI: return ph < 0x80000000u ? (int32_t)(ph >> 15) - 32768 : 98303 - (int32_t)(ph >> 15);
    case OL_SAW: return 32767 - (int32_t)(ph >> 16);
    case OL_RAMP: return (int32_t)(ph >> 16) - 32768;
    case OL_SQR: return ph < 0x80000000u ? 32767 : -32767;
    case OL_SH: return (int32_t)(P->rnd_b >> 16) - 32768;
    default: {                                  /* smooth random: a line from one random value to the next */
        int32_t a = (int32_t)(P->rnd_a >> 16) - 32768, b = (int32_t)(P->rnd_b >> 16) - 32768;
        return a + (int32_t)(((int64_t)(b - a) * (ph >> 8)) >> 24);
    }
    }
}

/* the program PROG, expanded */
static void obv_load(obv_part_t *P, uint32_t prog)
{
    const uint8_t *s = &OBV_SET[OBV_OFF[prog % OBV_NPROG]];
    uint32_t i;
    for (i = 0; i < OP_N; i++)
        P->pv[i] = OBV_DEF[i];
    for (; s[0] != 255u; s += 2)
        P->pv[s[0] % OP_N] = s[1];
    P->prog = (uint8_t)(prog % OBV_NPROG + 1u);
    if (!P->rnd)
        P->rnd = 0x9E3779B9u;
}

/* once a block (also with no voice sounding): the program, the LFO, the slewed CUT and RES */
static void obv_block(track_t *t)
{
    obv_part_t *P = obv_of(t);
    const int16_t *p = t->p;
    uint32_t prog = (uint32_t)clamp(p[P_E0], 0, OBV_NPROG - 1), old;
    if (!P)
        return;
    if (P->prog != prog + 1u) {
        obv_load(P, prog);
        P->cut_sm = clamp(P->pv[OP_CUTOFF] + p[P_E4], 0, 127) << 8;
        P->reso_sm = clamp(P->pv[OP_RESO] + p[P_E5], 0, 127) << 8;
    }
    old = P->lfo_ph;
    P->lfo_ph += OBV_LFO_INC[P->pv[OP_LFO_RATE] & 127u];
    if (P->lfo_ph < old) {
        P->rnd_a = P->rnd_b;
        P->rnd_b = obv_xs(&P->rnd);
    }
    P->lfo_val = obv_lfo_shape(P, P->lfo_ph, P->pv[OP_LFO_SHAPE]);
    P->cut_sm += ((clamp(P->pv[OP_CUTOFF] + p[P_E4], 0, 127) << 8) - P->cut_sm) >> 5;   /* ~23 ms, as OberVave's */
    P->reso_sm += ((clamp(P->pv[OP_RESO] + p[P_E5], 0, 127) << 8) - P->reso_sm) >> 5;
}

static void obv_note_on(track_t *t, voice_t *v)
{
    obv_part_t *P = obv_of(t);
    obv_voice_t *o;
    uint32_t i;
    if (!P)
        return;
    if (P->prog != (uint32_t)clamp(t->p[P_E0], 0, OBV_NPROG - 1) + 1u)
        obv_block(t);                           /* (a note before the first block: the program now) */
    o = &P->v[(uint32_t)(v - t->v) % NVOICE];
    o->fstage = OE_ATT;
    o->lfo_blk = 0;
    o->lfo_fade = P->pv[OP_LFO_DELAY] ? 0 : 32767;
    if (!o->noise)
        o->noise = 0x2545F491u ^ (uint32_t)(v - t->v) * 0x9E3779B9u;
    if (P->pv[OP_LFO_PHASE] == OLP_SYNC) {      /* the first key of a chord restarts the LFO */
        for (i = 0; i < NVOICE; i++)
            if (&t->v[i] != v && t->v[i].gate)
                break;
        if (i == NVOICE)
            P->lfo_ph = 0;
    }
}

/* the increment of p16 (1/16 semitone) plus q8 (1/256 semitone), with the voice's fine (unison detune, tune) */
static uint32_t obv_inc(int32_t p16, int32_t q8, int32_t fine)
{
    uint32_t inc;
    p16 += q8 >> 4;
    fine += ((q8 & 15) * 237) >> 8;             /* (1/256 semitone in the 1/4096 fine units voice.c uses) */
    inc = pitch_inc((uint32_t)clamp(p16, 0, 2047));
    if (fine)
        inc += (uint32_t)((int32_t)(inc >> 12) * fine);
    return inc;
}
static inline uint32_t obv_pw(uint32_t base, int32_t mod)
{
    int64_t q = (int64_t)base + ((int64_t)mod << 8);
    if (q < (1 << 26))
        q = 1 << 26;
    if (q > (int64_t)0xFFFFFFFFu - (1 << 26))
        q = (int64_t)0xFFFFFFFFu - (1 << 26);
    return (uint32_t)q;
}

static void obv_render(track_t *t, voice_t *v, int32_t *out, uint32_t n, const vmod_t *m)
{
    obv_part_t *P = obv_of(t);
    const int16_t *p = t->p;
    const uint8_t *pv;
    obv_voice_t *o;
    uint32_t card = (uint32_t)(v - t->v) % NVOICE, i, ft, sy, w1, w2, inc1, inc2, d1, d2, pw1, pw2, xq;
    int32_t vint, vt, fenv, lfo, d, q1, q2, cut, k, l1, l2, ln, drv, morph, hw1, hw2, o2n, lpd, lfd, lpwd, trem, gain;
    obv_svfc_t c1;
    obv_ladc_t lc;
    if (!P)
        return;
    pv = P->pv;
    o = &P->v[card];
    vint = pv[OP_VINTAGE];
    vt = (vint * OBV_VENV[card]) >> 7;
    obv_env(o, pv[OP_FA], pv[OP_FD], pv[OP_FS] * (OBV_ONE / 127), pv[OP_FR], v->gate, vt);
    fenv = o->flevel >> 9;                      /* Q15 */
    /* the LFO as this voice hears it: SPREAD gives each voice its own phase; the delay fades it in */
    lfo = pv[OP_LFO_PHASE] == OLP_SPREAD ? obv_lfo_shape(P, P->lfo_ph + (card << 29), pv[OP_LFO_SHAPE]) : P->lfo_val;
    if (o->lfo_fade < 32767) {
        uint32_t dl = OBV_LFO_DLY[pv[OP_LFO_DELAY] & 127u];
        if (o->lfo_blk >= dl) {
            o->lfo_fade += 32767 / (int32_t)(dl / 2u + 1u) + 1;
            if (o->lfo_fade > 32767)
                o->lfo_fade = 32767;
        }
        o->lfo_blk++;
    }
    lfo = (lfo * o->lfo_fade) >> 15;
    o->drift += (int32_t)(obv_xs(&o->noise) & 31u) - 16;   /* vintage: a slow random walk */
    o->drift -= o->drift >> 11;
    /* pitch, Q8 semitones over the note BoopBox plays (glide, bend, its LFO and unison are in m) */
    d = pv[OP_LFO_PITCH];
    lpd = (lfo * ((d * d) >> 7) * 24) >> 15;
    q1 = ((OBV_VTUNE8[card] * vint) >> 7) + ((o->drift * vint) >> 10);
    q2 = q1 + ((int32_t)pv[OP_O2_SEMI] - 24) * 256 + (clamp((int32_t)pv[OP_O2_FINE] + p[P_E3], 0, 127) - 64) * 2 +
         ((fenv * ((int32_t)pv[OP_ENV_O2] - 64) * 97) >> 15);
    if (pv[OP_LFO_PITCH_TO] != OTO_O2)
        q1 += lpd;
    if (pv[OP_LFO_PITCH_TO] != OTO_O1)
        q2 += lpd;
    inc1 = q1 ? obv_inc(m->pitch16, q1, m->fine) : m->inc;
    inc2 = obv_inc(m->pitch16, q2, m->fine);
    d = pv[OP_LFO_PWM];
    lpwd = lfo * ((d * d) >> 7);
    pw1 = obv_pw(((uint32_t)pv[OP_O1_PW] << 25) + (1u << 24), pv[OP_LFO_PWM_TO] != OTO_O2 ? lpwd : 0);
    pw2 = obv_pw(((uint32_t)pv[OP_O2_PW] << 25) + (1u << 24), pv[OP_LFO_PWM_TO] != OTO_O1 ? lpwd : 0);
    /* cutoff, Q8 semitones: the knob, the envelope, the key, the velocity, the LFO, vintage; BoopBox's ENV / LFO -> FLT
     * (m->cutoff, in CUTOFF_HZ steps of ~0.72 semitone) */
    d = pv[OP_LFO_FLT];
    lfd = (d * d) >> 7;
    cut = P->cut_sm + 8 * 256 + ((fenv * (clamp((int32_t)pv[OP_FENV_AMT] + p[P_E6], 0, 127) - 64) * 390) >> 15) +
          ((int32_t)v->note - 60) * pv[OP_KEYTRK] * 2 + ((((int32_t)v->vel - 64) * pv[OP_VEL_FLT]) >> 1) +
          ((lfo * lfd * 97) >> 15) + ((OBV_VCUT8[card] * vint) >> 7) + ((o->drift * vint) >> 7) + ((m->cutoff * 183) >> 8);
    ft = p[P_E1] ? (uint32_t)(p[P_E1] - 1) : pv[OP_FTYPE];
    k = 8192 - P->reso_sm * 8400 / (127 * 256);
    if (ft == OF_LP24)
        obv_lad_coef(&lc, cut, (8192 - k) >> 1);
    else
        obv_svf_coef(&c1, cut, k);
    d = pv[OP_O1_LVL]; l1 = (d * d) >> 7;
    d = pv[OP_O2_LVL]; l2 = (d * d) >> 7;
    d = pv[OP_NOISE]; ln = (d * d) >> 7;
    d = clamp((int32_t)pv[OP_DRIVE] + p[P_E7], 0, 127);
    drv = 4096 + (d * d * 15 * 4096 / 16129);
    d = clamp((int32_t)pv[OP_XMOD] + p[P_E2], 0, 127);
    xq = (uint32_t)((d * d) >> 7);
    morph = pv[OP_FMORPH];
    sy = pv[OP_SYNC];
    w1 = pv[OP_O1_WAVE];
    w2 = pv[OP_O2_WAVE];
    hw1 = (w1 & OW_SAW ? -65536 : 0) + (w1 & OW_PLS ? -65536 : 0);
    hw2 = (w2 & OW_SAW ? -65536 : 0) + (w2 & OW_PLS ? -65536 : 0);
    trem = 32767 - (((32767 - lfo) * pv[OP_LFO_AMP]) >> 8);
    d = pv[OP_VOLUME];
    gain = (int32_t)((((d * d) >> 2) * (int64_t)trem) >> 15);   /* Q12: the program's VOLUME and the tremolo */
    d1 = inc1 >> 15;
    d2 = inc2 >> 15;
    o2n = o->o2.prev;
    for (i = 0; i < n; i++) {
        int32_t s1, s2, mix, lp, bp, hp, y, rt = -1;
        uint32_t ie = inc1;
        if (xq) {                               /* OSC 2 -> OSC 1 linear FM, the step never below inc / 16 */
            int32_t mm = (int32_t)(inc1 >> 8 > 0x200000u ? 0x200000u : inc1 >> 8) * (((o2n >> 8) * (int32_t)xq) >> 6);
            mm += (int32_t)inc1;
            ie = mm < (int32_t)(inc1 >> 4) ? inc1 >> 4 : (uint32_t)mm;
            d1 = ie >> 15;
        }
        s1 = obv_osc(&o->o1, ie, d1, pw1, w1, hw1, -1);
        if (sy && o->o1.ph < ie && d1)
            rt = (int32_t)(o->o1.ph / d1);
        s2 = obv_osc(&o->o2, inc2, d2, pw2, w2, hw2, rt);
        o2n = o->o2.prev;
        mix = s1 * l1 + s2 * l2;
        if (ln)
            mix += ((int32_t)(obv_xs(&o->noise) >> 16) - 32768) * ln;
        mix >>= 7;
        mix = obv_sat_in(((mix >> 3) * drv) >> 9);   /* the input stage: DRIVE's gain, then a tanh */
        if (ft == OF_LP24) {
            y = obv_lad(&lc, &o->lad, mix);
        } else {
            obv_svf(&c1, &o->f1, mix, &lp, &bp, &hp);
            y = ft == OF_HP12 ? hp : ft == OF_BP12 ? bp : ft == OF_NOTCH ? hp + lp :
                ft == OF_SEM ? lp + (((hp - lp) * morph) >> 7) : lp;
        }
        y = (obv_knee(y) * gain * 3) >> 12;     /* (x 6: VOLUME 100 about as loud as the other engines' presets) */
        out[i] += voice_amp(y, m, i);
    }
}

/* (as the other engines, voice.c unison_spread) UNISON: both oscillators moved by r (Q32) of a turn of the note, each by
 * its share (OSC 2 at its own interval), and the noise reseeded: the extra voices are not in phase with the first */
static void obv_spread(track_t *t, voice_t *v, uint32_t r)
{
    obv_part_t *P = obv_of(t);
    obv_voice_t *o;
    if (!P)
        return;
    o = &P->v[(uint32_t)(v - t->v) % NVOICE];
    o->o1.ph += r;
    o->o2.ph += uni_turns(r, v->pitch16, ((int32_t)P->pv[OP_O2_SEMI] - 24) * 16);
    o->noise ^= r | 1u;
}

static const char *const N_OBV_TYPE[] = {"PROG", "LP12", "HP12", "BP12", "NOTCH", "LP24", "SEM", 0};
static const engine_t ENG_OBV = {
    "OBERVAVE", {"PROGRAM", "FILTER"},
    {
        {"PROG", F_ENUM, 0, OBV_NPROG - 1, 0, OBV_NAMES},
        {"TYPE", F_ENUM, 0, 6, 0, N_OBV_TYPE},
        {"XMOD", F_INT, -64, 63, 0, 0},
        {"DTN", F_INT, -64, 63, 0, 0},
        {"CUT", F_INT, -64, 63, 0, 0},
        {"RES", F_INT, -64, 63, 0, 0},
        {"FENV", F_INT, -64, 63, 0, 0},
        {"DRV", F_INT, -64, 63, 0, 0},
    },
    OBV_PRESETS, OBV_NPROG, 1, obv_note_on, obv_render,
    0xE8E4, {P_E0, P_E4, P_E5, P_E6}, 0, 0, 0, obv_block,
};
