/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* Projects: four slots in .noinit RAM (the song sections A..D), so they survive resets and UBOOT
 * entry. With FELUCCA_FLASH every save also goes to flash through storage.c, and an empty RAM slot
 * is filled from flash on load. The working project is also kept in flash by itself (autosave, when
 * the transport is stopped and nothing sounds) and comes back at power-on: BoopBox starts where you
 * left it.
 *
 * One format: "FUN7", eight tracks, variable length (below: proj7_*). BoopBox 1.0.0 reads and writes nothing else:
 * the four-track projects of SLOOP (formats "FUN1" .. "FUN6") read as no project, and SLOOP, which knows only
 * those, reads a BoopBox project as no project. Globals (G_*) and track parameters (P_*) are stored by index:
 * add new ones at the end of their group (the common parameters just before P_E0), never in between.
 *
 * Built on the host too (tests/project_test.c, -DPROJ_HOST): the part above the #ifndef
 * PROJ_HOST needs core.h, params.c (TP), drums.c (the lanes), the engines and trk_def_engine (ui.c). */
#ifndef UI_SMALL                 /* (2.7) compiled for size: not the audio path (gfx.c UI_SMALL); the host tests: nothing */
#define UI_SMALL
#endif
#define PROJ_MAGIC 0x46554E37u                 /* "FUN7": eight tracks, variable length */
/* a variable-length object in 3,840 bytes (one flash object, a RAM slot): a header (magic, size: the bytes used,
 * header included; sum: FNV-1a over size and the data) and chunks (proj7_* below) */
#define PROJ_MAX 3840u                         /* (storage.c ST_PAYLOAD_MAX: one flash object) */
#define PROJ_HDR 12u
typedef struct {
    uint32_t magic, size, sum;
    uint8_t d[PROJ_MAX - PROJ_HDR];
} project_t;
_Static_assert(sizeof(project_t) == PROJ_MAX, "a slot holds one project");
project_t proj_slot[4] __attribute__((section(".noinit")));

UI_SMALL static uint32_t proj7_sum(const project_t *p)   /* size (4 bytes, low first), then the data */
{
    uint32_t i, s = 0x811C9DC5u, n = p->size - PROJ_HDR;
    for (i = 0; i < 4u; i++)
        s = (s ^ ((p->size >> (8u * i)) & 0xFFu)) * 16777619u;
    for (i = 0; i < n; i++)
        s = (s ^ p->d[i]) * 16777619u;
    return s;
}
/* a project in the slot */
UI_SMALL static int proj_ok(const project_t *q)
{
    return q->magic == PROJ_MAGIC && q->size >= PROJ_HDR && q->size <= PROJ_MAX && q->sum == proj7_sum(q);
}
UI_SMALL static uint32_t proj_bytes(const project_t *q) { return q->size; }   /* the bytes it takes in flash */

/* n bytes of a stored project -> slot q (its size checked against n); 0 = not a project (damaged, cut short, a
 * format this firmware does not read) */
UI_SMALL static int proj_import(project_t *q, const void *b, int n)
{
    const project_t *p7 = (const project_t *)b;
    if (n < (int)PROJ_HDR || n > (int)PROJ_MAX || p7->size != (uint32_t)n || !proj_ok(p7))
        return 0;
    memcpy(q, b, (uint32_t)n);
    return 1;
}

/* ---- the working project <-> a project_t */
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
/* ---- the format. After the header, chunks: a tag, its length (2 bytes, low first), its bytes; a tag this firmware
 * does not know is skipped (a later BoopBox may add some). A value is one byte (-127..127) or 0x80 and two bytes (pw_v).
 *   'G' the globals: their count (G_COUNT of the writer), a bit per global not at its default, those values
 *   'S' the song: the selected track
 *   'T' a track: index, kind, engine, preset; the common parameters (P_LEVEL .. before P_E0, their count first: they
 *       are append-only, so a later BoopBox's extra ones are read past) and the engine's eight, each a bit when not at
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
    pw_u8(w, (uint32_t)t->hfol);                        /* (harmony: how it follows) */
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
            if (k < P_E0)                               /* (a later BoopBox's common parameters: read past) */
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
        if (r->i < r->n) {
            uint32_t h = pr_u8(r);
            t->hfol = (int16_t)(h < HF_COUNT && !r->bad ? h : HF_OFF);
        }
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
    if (!harm_default()) {                              /* the harmony's progression (its key, scale ..: the globals) */
        at = pw_open(w, 'H');
        pw_u8(w, harm.n);
        for (i = 0; i < harm.n && i < NHPROG; i++) {
            pw_u8(w, harm.c[i].deg);
            pw_u8(w, harm.c[i].bars);
        }
        pw_close(w, at);
    }
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
static int g_of_section(uint32_t i) { return (i >= G_TXSRC && i <= G_TXDUCK) || (i >= G_HKEY && i <= G_HPROG); }   /* (and its harmony) */
UI_SMALL static __attribute__((noinline)) void proj7_apply(const project_t *p, int all)
{
    pr_t r = {p->d, p->size - PROJ_HDR, 0, 0};
    uint32_t seen = 0, i;
    pat_reset_all();                                    /* (its patterns replace the ones there were) */
    harm_defaults();                                    /* (and its progression: none, I) */
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
        } else if (tag == 'H' && c.n >= 1u) {
            uint32_t n = pr_u8(&c), k;
            if (n >= 1u && n <= NHPROG) {
                harm.n = (uint8_t)n;
                for (k = 0; k < n && !c.bad; k++) {
                    harm.c[k].deg = (uint8_t)(pr_u8(&c) % 7u);
                    harm.c[k].bars = (uint8_t)clamp((int32_t)pr_u8(&c), 1, 16);
                }
                if (c.bad)
                    harm_defaults();
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

/* what is playing now, as a project in p. 0: it does not fit, p is left as it was (the caller says PROJECT FULL;
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
    return 0;
}
/* a project into the working one, every value back inside its range: all, a load (its globals too); else a song
 * section (its tracks and the TEXTURE). The audio ISR must not run meanwhile (the song sections: called from it; a
 * load: IRQ off) */
static void proj_apply(const project_t *p, int all) { proj7_apply(p, all); }
/* the selected track a project holds */
static uint32_t proj_sel(const project_t *p)
{
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
/* slot from flash into RAM (also the staging buffer of the user preset and FM6 banks and of a backup's objects) */
static project_t proj_tmp;
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
 * editor's restore leaves an empty slot (project_restore): an object of no bytes, which proj_fetch reads as no
 * project. The song's steps that played that section are taken out (the default song if none is left),
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
static uint8_t autosave_full;                  /* the last capture did not fit (said once) */

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
    if (!proj_capture(&autosave_buf)) {                 /* (it does not fit: the project stays in RAM; said once) */
        if (!autosave_full)
            ui_message("TOO BIG TO AUTOSAVE");
        autosave_full = 1;
        return;
    }
    autosave_full = 0;
    h = autosave_buf.sum;
    if (h == autosave_hash || !audio_quiet())
        return;
    if (st_save(OBJ_AUTOSAVE, &autosave_buf, proj_bytes(&autosave_buf)) == 0)
        autosave_hash = h;
    autosave_ms = fm1_ms;
#endif
}

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
    autosave_hash = q->sum;
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
    uint32_t lights;                               /* the backlight and the menu's switches (panel.c lights_word) */
} persist_t;
_Static_assert(sizeof(side_rec_t) == 80u && sizeof(side_rec_t) <= ST_SIDE_MAX, "the side record: theme, favourites");
static side_rec_t side_out;
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
        if (n == (int)sizeof p && p.magic == PERSIST_MAGIC) {
            settings.magic = SETTINGS_MAGIC;
            settings.palette = p.palette;
            settings.lowcut = p.lowcut;
            settings.zoom = p.zoom;
            if (p.panel.magic == PANEL_MAGIC)
                panel = p.panel;
            lights_from_word(p.lights);
#if FELUCCA_ARRANGER
            if (arr_valid(&p.arrangement, 15u))
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
                if (n != (int)sizeof proj_slot[i] || memcmp(&proj_tmp, &proj_slot[i], sizeof proj_slot[i]))
                    sec_dirty |= (uint8_t)(1u << i);
            }
    }
    dsu_boot();                                    /* the SYN kits and the MIDI part (after the settings) */
    up_boot();                                     /* user presets */
    fm6_bank_boot();                               /* the FM6 patch bank (fm6_bank.c) */
#endif
}

UI_SMALL static int project_used(uint32_t slot) { return proj_ok(&proj_slot[slot & 3u]); }

#if FELUCCA_FLASH
/* The settings object: persist_t, then the SYN kits (drum_synth.c dsu), then the MIDI part (MIDI_PART_8 bytes), always
 * all three. The MIDI part: the MIDI LEARN map (seq.c ml_tab, ML_N entries, 2 bytes each, low first), then GLO > MIDI:
 * CH1 CH2 CH3, the drum channel | OTHER << 7 (and two menu switches), BEND | FX FADE << 4, FX CH, DR MAP | CLK OUT << 1
 * | FILTER RESO << 2, REMOTE; then (at MIDI_PART) GLO > MIDI 4's CH5..CH8, ml_hi (the learned entries of tracks 5..8, low
 * first), REC KNOBS, one spare. An object of another length: the SYN kits and the MIDI part at their defaults */
#define MIDI_PART (2u * ML_N + 8u)
#define MIDI_PART_8 (MIDI_PART + 8u)
_Static_assert(sizeof(persist_t) + sizeof(dsu_bank_t) + MIDI_PART_8 <= ST_PAYLOAD_MAX, "the settings object fits its sector");
static uint8_t midi_saved[MIDI_PART_8];             /* the part as flash has it (settings_save: written when it differs) */
UI_SMALL static void midi_part_fill(uint8_t *b)
{
    uint32_t k;
    for (k = 0; k < ML_N; k++)
        b[2u * k] = (uint8_t)ml_tab[k], b[2u * k + 1u] = (uint8_t)(ml_tab[k] >> 8);
    b[2u * ML_N] = midi_set[0], b[2u * ML_N + 1u] = midi_set[1], b[2u * ML_N + 2u] = midi_set[2];
    b[2u * ML_N + 3u] = (uint8_t)(midi_set[3] | (drum_preview != 0u) << 5 | (step_adv_off != 0u) << 6 | midi_set[4] << 7);
                                                    /* (bit 5 DRUM PREVIEW, bit 6 STEP ADVANCE OFF) */
    b[2u * ML_N + 4u] = (uint8_t)(midi_set[5] | (fxfade > 15u ? 15u : fxfade) << 4);   /* BEND (bits 0-3), FX FADE (bits 4-7) */
    b[2u * ML_N + 5u] = midi_set[6];                /* GLO > MIDI 3: FX CH */
    b[2u * ML_N + 6u] = (uint8_t)(midi_set[7] | midi_set[9] << 1 |
                                  (flt_reso > 10u ? 10u : flt_reso) << 2);   /* GLO > MIDI 3: DR MAP, bit 1 CLK OUT,
                                                                      * FILTER RESO in bits 2..5 */
    b[2u * ML_N + 7u] = midi_set[8];                /* GLO > MIDI 3: REMOTE */
    for (k = 0; k < 4u; k++)
        b[MIDI_PART + k] = midi_set[10u + k];       /* (eight tracks) CH5..CH8 */
    b[MIDI_PART + 4u] = (uint8_t)ml_hi, b[MIDI_PART + 5u] = (uint8_t)(ml_hi >> 8);
    b[MIDI_PART + 6u] = (uint8_t)(rec_locks != 0u);    /* menu SEQ > REC KNOBS (LOCKS) */
    b[MIDI_PART + 7u] = 0;
}
/* the MIDI part (MIDI_PART_8 bytes), every entry checked (a CC that learns, a parameter this knows, a channel 0..16, a
 * range 1..12) */
UI_SMALL static void midi_part_read(const uint8_t *b)
{
    uint32_t k, e;
    fm1_irq_off();                                  /* (the ISR reads the map and the channels: never half of them) */
    for (k = 0; k < ML_N; k++) {
        e = (uint32_t)b[2u * k] | (uint32_t)b[2u * k + 1u] << 8;
        ml_tab[k] = (uint16_t)((e >> 9) && ml_free_cc(e & 127u) && ml_id(e >> 9) < P_COUNT ? e : 0u);
    }
    for (k = 0; k < 3u; k++)
        midi_set[k] = (uint8_t)(b[2u * ML_N + k] <= 16u ? b[2u * ML_N + k] : k + 1u);
    midi_set[3] = (uint8_t)((b[2u * ML_N + 3u] & 31u) <= 16u ? b[2u * ML_N + 3u] & 31u : 10u);
    midi_set[4] = (uint8_t)(b[2u * ML_N + 3u] >> 7);
    drum_preview = (uint8_t)((b[2u * ML_N + 3u] >> 5) & 1u);       /* menu DRUM PREVIEW */
    step_adv_off = (uint8_t)((b[2u * ML_N + 3u] >> 6) & 1u);       /* menu STEP ADVANCE */
    song.g[G_CH1] = midi_set[0], song.g[G_CH2] = midi_set[1], song.g[G_CH3] = midi_set[2];
    song.g[G_DRCH] = midi_set[3], song.g[G_CHOTH] = midi_set[4];
    midi_set[5] = (uint8_t)((b[2u * ML_N + 4u] & 15u) >= 1u && (b[2u * ML_N + 4u] & 15u) <= 12u ? b[2u * ML_N + 4u] & 15u : 2u);
    song.g[G_BEND] = midi_set[5];
    fxfade = (uint8_t)((b[2u * ML_N + 4u] >> 4) & 15u);             /* FX FADE (bits 4-7) */
    song.g[G_FXFADE] = fxfade;
    midi_set[6] = (uint8_t)(b[2u * ML_N + 5u] <= 16u ? b[2u * ML_N + 5u] : 0u);   /* FX CH */
    song.g[G_FXCH] = midi_set[6];
    midi_set[7] = (uint8_t)(b[2u * ML_N + 6u] & 1u);                 /* DR MAP */
    midi_set[9] = (uint8_t)((b[2u * ML_N + 6u] >> 1) & 1u);          /* CLK OUT */
    flt_reso = (uint8_t)((b[2u * ML_N + 6u] >> 2) & 15u);            /* FILTER RESO (bits 2..5) */
    if (flt_reso > 10u)
        flt_reso = 10u;
    song.g[G_DRMAP] = midi_set[7];
    song.g[G_CLKOUT] = midi_set[9];
    midi_set[8] = (uint8_t)(b[2u * ML_N + 7u] <= 16u ? b[2u * ML_N + 7u] : 0u);   /* REMOTE */
    song.g[G_RMCH] = midi_set[8];
    for (k = 0; k < 4u; k++)                        /* CH5..CH8, the learned entries of tracks 5..8 */
        midi_set[10u + k] = (uint8_t)(b[MIDI_PART + k] <= 16u ? b[MIDI_PART + k] : 0u);
    ml_hi = (uint16_t)((uint32_t)b[MIDI_PART + 4u] | (uint32_t)b[MIDI_PART + 5u] << 8);
    rec_locks = (uint8_t)(b[MIDI_PART + 6u] & 1u);
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
    /* the theme and the favourites in the side record */
    side_fill(&side_out);
    st_side = &side_out;
    st_side_len = sizeof side_out;
    rc = st_save3(OBJ_SETTINGS, p, sizeof *p, &dsu, sizeof dsu, mp, sizeof mp);
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
    if (st_current(OBJ_SETTINGS, &h) >= 0 && h.len == len + MIDI_PART_8 &&
        dsu_valid((const dsu_bank_t *)(st_buf + sizeof(persist_t)))) {
        memcpy(&dsu, st_buf + sizeof(persist_t), sizeof dsu);
        for (k = 0; k < DSU_N; k++)
            dsu_fix_kit(&dsu.k[k]);
        midi_part_read(st_buf + len);
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
    if (n != sizeof p)
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
        if (autosave_buf.sum != autosave_hash && st_save(OBJ_AUTOSAVE, &autosave_buf, proj_bytes(&autosave_buf)) == 0)   /* (its own size: a
                                                                                         * longer object reads as none) */
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
