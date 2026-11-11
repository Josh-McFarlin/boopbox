/* SPDX-License-Identifier: GPL-3.0-only */
/* The TRAINER (FELUCCA_TRAINER builds only): three levels that teach three songs on the FM-1 itself. A level is a list
 * of cards (build/gen/trainer_lessons.h, made by tools/trainer/lessons.py from the approved songs); a card is a goal on
 * the state of the FM-1 (a track selected, a page open, a kit, a sound, a parameter, a pattern's notes or hits, the mutes,
 * a lock, the patterns playing, a section saved, the song...). Every screen, button, knob and key works as in BoopBox:
 * the coach only watches.
 *   The coach owns the screen's title area (lcd_clip_y: no page draws there while a level runs): what the card is about,
 *   what to do ("@" in it: the value wanted, as the screen shows it), and, when something is off, what is wrong and what
 *   fixes it ("STEP 5: NO KICK HERE (KEY 5)"). It blinks the button to press; while a card is about keys it takes the
 *   keys' lights over: only the keys to press are lit, all of them (every step of the page to fix). In the sound browser a
 *   fading dot marks the group and the sound; a sound or kit card is done when SAVE closes the browser on it.
 *   HOME held: in a level, the step's "why" first (its music, tools/trainer/theory.py; SELECT turns the pages), then the
 *   level picker (one level a page, SELECT turns them, OCT+ does the action picked with KNOB 1; its last page opens
 *   BoopBox's menu). Progress is a log in its own flash sector (TR_LOG: a few bytes a card, written while the
 *   music plays too; erased when full, stopped). One level is in progress at a time: starting one (from a new project)
 *   resets the others that are not done. */
enum {
    TG_TRACK, TG_KIT, TG_SOUND, TG_PARAM, TG_GLOBAL, TG_PLAY, TG_PAGE, TG_OCT, TG_NOTES, TG_LANES, TG_MUTES,
    TG_LOCK, TG_PATSEL, TG_PATS, TG_PATHAS, TG_SAVED, TG_SONG, TG_SONGMODE, TG_DONE,
    /* the SCENES and CHAIN pages: */
    TG_SCENE,                                      /* scene p: its name v (N_SCN; -1 any), each track's pattern (data:
                                                    * 8 bytes, 255 any, SCN_KEEP keep) */
    TG_SCNPLAY,                                    /* scene p playing (launched, every track of it changed) */
    TG_CHAIN,                                      /* track trk's chain (data: its count, then each slot, CH_SLOT), on */
    TG_COUNT
};
enum { HOW_ANY, HOW_SEQ, HOW_NOTES };              /* how a pattern is written: the hints and the keys lit */
enum { PG_DRUMS = 1, PG_PATTERNS, PG_SONG };       /* TG_PAGE */
typedef struct {
    const char *head, *act;                        /* the headline (what it is about), the action (what to do) */
    uint8_t goal, trk, p, btn;                     /* TG_*, the track (0..7), a parameter / engine / page / pattern,
                                                    * the button to light (B_*, NB: none) */
    int16_t v;                                     /* the value wanted */
    uint8_t tol, flags;                            /* how far off it may be; per goal (HOW_*, SLIDE, filled...) */
    uint16_t data;                                 /* where its target is in TR_DATA */
    uint8_t why;                                   /* its topic: the "why" pages (TR_WHY, tools/trainer/theory.py) */
} tr_card_t;
typedef struct {
    const char *name, *style, *learn1, *learn2;    /* the picker's page: the song, its style and tempo, what it teaches */
    const tr_card_t *cards;
    uint8_t n;
} tr_level_t;
#include "trainer_lessons.h"
UI_SMALL static const tr_level_t *tr_level(uint32_t l) { return &TR_LEVELS[l]; }
#define TR_D TR_DATA                               /* the targets of the levels */

#define TR_OK_MS 700u                              /* NICE shows this long, then the next card */
#define TR_HEAD_MS 2000u                           /* a new card (one line): its number and headline this long */
#define TR_ALT_MS 2200u                            /* one line: the action and the hint take turns */
#define TR_LOG 0xFB000u                            /* the progress log's flash sector (fm1_flash.h FL_TRN_OK) */
#define TR_REC 16u
static struct {
    uint8_t lvl;                                   /* the level running + 1, 0 = none */
    uint8_t card;                                  /* its card */
    uint8_t at[TR_NLEVELS];                        /* each level's card (kept) */
    uint8_t done;                                  /* the levels finished, a bit each (kept) */
    uint8_t seen;                                  /* the welcome was shown (kept) */
    uint8_t ok;                                    /* the goal held: NICE until ok_ms + TR_OK_MS */
    uint8_t pend;                                  /* a level to begin once the transport has stopped: 1 + the level */
    uint8_t dirty;                                 /* a record for the log */
    uint8_t page, sel;                             /* the picker: the page shown (a level, or TR_NLEVELS: the menu), action */
    uint8_t wp;                                    /* the picker on the step's "why" pages: 1 + the page, 0: not */
    uint8_t btn;                                   /* a button the hint asks for (B_*, NB: the card's) */
    uint8_t keyed;                                 /* the card is about keys: the coach owns their lights */
    uint32_t ok_ms, t0;
    uint32_t base;                                 /* TG_SAVED: the section's sum when the card came */
    uint32_t sig, psig;                            /* the band, the picker as last drawn */
    uint32_t keys;                                 /* the keys lit */
    uint32_t log_at;                               /* the log's next free record (offset in TR_LOG) */
    uint32_t mq_t0, mq_sig;                        /* (1.5.1) a line too wide scrolls: since when, for which text */
    char hint[48];                                 /* (1.5.1: 48, a hint may be wider than the screen: it scrolls) */
} tr;

UI_SMALL static const tr_card_t *tr_card(void)
{
    const tr_level_t *L;
    if (!tr.lvl)
        return 0;
    L = tr_level(tr.lvl - 1u);
    return tr.card < L->n ? &L->cards[tr.card] : &L->cards[L->n - 1u];
}
UI_SMALL static int tr_on(void) { return tr.lvl != 0; }
UI_SMALL static int tr_running(void)                    /* a level on a card to do (not its DONE): the menu's controls */
{
    const tr_card_t *c = tr_card();
    return c && c->goal != TG_DONE;
}

/* ---------------------------------------------------------------- what to say --- */
UI_SMALL static void tr_cat(const char *a) { str_cpy(tr.hint + str_len(tr.hint), a, sizeof tr.hint - str_len(tr.hint)); }
UI_SMALL static void tr_num(int32_t v) { char b[8]; fmt_int(b, v); tr_cat(b); }
UI_SMALL static void tr_say(const char *a, const char *b) { tr.hint[0] = 0; tr_cat(a); tr_cat(b); }
UI_SMALL static void tr_step(uint32_t i, const char *a, const char *b)   /* "STEP 8: " a b */
{
    tr.hint[0] = 0;
    tr_cat("STEP ");
    tr_num((int32_t)i + 1);
    tr_cat(": ");
    tr_cat(a);
    tr_cat(b);
}
UI_SMALL static void tr_value(char *b, const param_desc_t *d, int32_t v)   /* a value as the screen shows it: "24%" */
{
    char val[12];
    const char *unit = "";
    param_format(d, v, val, &unit);
    str_cpy(b, val, 16);
    if (unit[0]) {
        if (unit[0] != '%')
            str_cpy(b + str_len(b), " ", 2);
        str_cpy(b + str_len(b), unit, 16 - str_len(b));
    }
}
/* a card's value as the screen the card is on shows it: the parameter's own format (since 1.4.2 HOME's LEVEL and PAN too:
 * ui_studio.c mix_value), but SEQ held shows LEN as a number (not "4 STEP") */
UI_SMALL static void tr_card_value(char *b, const tr_card_t *c, int32_t v)
{
    if (c->goal == TG_PARAM && c->btn == B_HOME && (c->p == P_LEVEL || c->p == P_PAN)) {
        mix_fmt(b, &trk[c->trk % NTRK], c->p, v);      /* (HOME's dials: ui_studio.c, "98") */
    } else if (c->goal == TG_PARAM && c->btn == B_SEQ && !c->data && c->p == P_SLEN)
        fmt_int(b, v);                                  /* (SEQ held: "steps 4", ui_layers.c) */
    else
        tr_value(b, c->goal == TG_GLOBAL ? &GP[c->p] : track_desc(&trk[c->trk % NTRK], c->p), v);
}
UI_SMALL static void tr_now_c(const tr_card_t *c, int32_t v)   /* "NOW 30% (WANT 24%)", as the card's screen shows them */
{
    char b[16];
    tr_card_value(b, c, v);
    tr_say("NOW ", b);
    tr_card_value(b, c, c->v);
    tr_cat(" (WANT ");
    tr_cat(b);
    tr_cat(")");
}
UI_SMALL static void tr_now(const param_desc_t *d, int32_t v, int32_t want)   /* "NOW 30% (WANT 24%)" */
{
    char b[16];
    tr_value(b, d, v);
    tr_say("NOW ", b);
    tr_value(b, d, want);
    tr_cat(" (WANT ");
    tr_cat(b);
    tr_cat(")");
}
UI_SMALL static int tr_near(int32_t a, int32_t b, uint32_t tol) { return a - b <= (int32_t)tol && b - a <= (int32_t)tol; }
UI_SMALL static uint32_t tr_white_of(uint32_t k)       /* key k's number among the white keys (1..16), 0: a black key */
{
    uint32_t w;
    for (w = 0; w < 16u; w++)
        if (key_of_white(w) == k)
            return w + 1u;
    return 0;
}
UI_SMALL static void tr_key_text(char *b, uint32_t keys)   /* "KEY 6", "LIT KEYS", "LIT KEY" (a black key) */
{
    uint32_t k, n = 0, at = 0;
    for (k = 0; k < 27u; k++)
        if ((keys >> k) & 1u)
            n++, at = k;
    if (n == 1u && tr_white_of(at)) {
        str_cpy(b, "KEY ", 8);
        fmt_int(b + 4, (int32_t)tr_white_of(at));
    } else
        str_cpy(b, n == 1u ? "LIT KEY" : "LIT KEYS", 16);   /* (1.5.1: "LIT BLACK KEY" was wider than the screen) */
}

/* the keys (bit k: key k, F3 = 0) that play notes c[0..n) on track t as it is now (chord mode: the key of that chord);
 * 0 and *oct the way to go (+1 up, -1 down) when the keys cannot at this octave */
UI_SMALL static uint32_t tr_keys_for(const track_t *t, const uint8_t *c, uint32_t n, int32_t *oct)
{
    uint32_t k, j, m = 0, want = 0;
    *oct = 0;
    for (j = 0; j < n; j++)
        want |= 1u << (c[j] % 12u);
    if (t->p[P_CHORD]) {                           /* a key plays a chord: the one whose notes are these */
        for (k = 0; k < 27u && !m; k++) {
            uint8_t cn[4];
            uint32_t p = kb_pitch(t, k, song.octave), pcs = 0, q, cnt;
            if (p == KB_SILENT)
                continue;
            cnt = chord_notes(t, p, cn);
            for (q = 0; q < cnt; q++)
                pcs |= 1u << (cn[q] % 12u);
            if (pcs == want && cnt == n && cn[0] == c[0])
                m = 1u << k;
        }
        if (!m)
            *oct = (int32_t)c[0] > (int32_t)kb_pitch(t, 7u, song.octave) ? 1 : -1;
        return m;
    }
    for (j = 0; j < n; j++) {
        uint32_t found = 0;
        for (k = 0; k < 27u; k++)
            if (kb_pitch(t, k, song.octave) == c[j])
                found = 1u << k;
        if (!found)
            *oct = (int32_t)c[j] > (int32_t)kb_pitch(t, 26u, song.octave) ? 1 : -1;
        m |= found;
    }
    return *oct ? 0u : m;
}

/* ---------------------------------------------------------------- a synth pattern --- */
/* the target's step i (TR_DATA: LEN, then per step 0 empty, 2 TIE, or 1 | flags << 2, n, the notes) */
typedef struct { uint8_t kind, fl, n; const uint8_t *note; } tr_st_t;
UI_SMALL static void tr_st(const tr_card_t *c, uint32_t i, tr_st_t *o)
{
    const uint8_t *d = &TR_D[c->data + 1u];
    uint32_t j;
    for (j = 0;; j++) {
        o->kind = *d & 3u, o->fl = (uint8_t)(*d >> 2), o->n = 0, o->note = 0;
        d++;
        if (o->kind == 1u) {
            o->n = *d++;
            o->note = d;
            d += o->n;
        }
        if (j == i)
            return;
    }
}
/* step i of t against the target: 0 as wanted, 1 its notes, 2 a TIE, 3 its accent or slide */
UI_SMALL static uint32_t tr_st_off(const track_t *t, uint32_t i, const tr_st_t *w)
{
    const step_t *s = &t->step[i];
    uint32_t have = s->time == ST_TIE ? 2u : s->time == ST_NOTE && s->n ? 1u : 0u, j, pa = 0, pw = 0;
    if (w->kind != 1u)
        return w->kind == have ? 0u : have == 1u || w->kind == 0u ? 1u : 2u;
    if (have != 1u)
        return have == 2u ? 2u : 1u;
    for (j = 0; j < w->n; j++)
        pw |= 1u << (w->note[j] % 12u);
    for (j = 0; j < s->n && j < 4u; j++)
        pa |= 1u << (s->note[j] % 12u);
    if (s->n != w->n || pa != pw || (w->n == 1u && s->note[0] != w->note[0]))
        return 1u;
    return (s->flags & SF_ACCENT) == (w->fl & 1u) && ((s->flags & SF_SLIDE) != 0) == ((w->fl & 2u) != 0) ? 0u : 3u;
}
UI_SMALL static int tr_pen_is(const tr_st_t *w)     /* the SEQ layer's pen (the note or chord played last) is the target's */
{
    uint32_t j, n = pen_n ? pen_n : 1u;
    if (n != w->n)
        return 0;
    for (j = 0; j < n; j++)
        if ((pen_n ? pen_note[j] : last_note) % 12u != w->note[j] % 12u ||
            (n == 1u && (pen_n ? pen_note[0] : last_note) != w->note[0]))
            return 0;
    return 1;
}
UI_SMALL static int tr_notes(const tr_card_t *c, track_t *t)
{
    uint32_t len = TR_D[c->data], i, bad = NSTEP, why = 0, page;
    tr_st_t w, x;
    char nb[16], kb[16];
    if ((uint32_t)t->p[P_SLEN] != len) {
        tr_say("HOLD SEQ, KNOB 4 STEPS TO ", "");
        tr_num((int32_t)len);
        return 0;
    }
    for (i = 0; i < len && bad == NSTEP; i++) {
        tr_st(c, i, &w);
        if ((why = tr_st_off(t, i, &w)) != 0)
            bad = i;
    }
    if (bad == NSTEP)
        return 1;
    tr_st(c, bad, &w);
    if (why == 2u || (why == 1u && w.kind != 1u && t->step[bad].time == ST_TIE)) {   /* a length: at its note's step */
        uint32_t s0 = bad, L = 1;
        while (s0 && t->step[s0].time == ST_TIE)
            s0--;
        while (s0 && w.kind == 2u && (tr_st(c, s0, &x), x.kind == 2u))
            s0--;
        tr_st(c, s0, &x);
        while (s0 + L < len && (tr_st(c, s0 + L, &w), w.kind == 2u))
            L++;
        if (on_notes_page() && ui.cursor != s0) {
            tr_say("KNOB 1 TO STEP ", "");
            tr_num((int32_t)s0 + 1);
        } else {
            tr_step(s0, "KNOB 3 LEN TO ", "");
            tr_num((int32_t)L);
        }
        return 0;
    }
    if (why == 3u) {
        if (on_notes_page() && ui.cursor != bad) {
            tr_say("KNOB 1 TO STEP ", "");
            tr_num((int32_t)bad + 1);
        } else
            tr_step(bad, (w.fl & 1u) ? "KNOB 4 TO ACC" : (t->step[bad].flags & SF_ACCENT) ? "KNOB 4 TO NORM" :
                         (w.fl & 2u) ? "SLIDE ON (HOLD OCT+)" : "SLIDE OFF (HOLD OCT+)", "");
        return 0;
    }
    if (c->flags == HOW_SEQ) {                      /* the SEQ layer: play the note, then SEQ held + the step keys */
        int held = ui.layer == LY_STEP;
        uint32_t pen = 0, first = NSTEP;
        if (on_notes_page() && !held) {             /* (1.7) NOTES types a key played into its step: leave it first */
            tr_say("TAP HOME FIRST", "");
            tr.btn = B_HOME;
            return 0;
        }
        page = ui.step_page;
        /* the note in hand first: every step of the page still empty that wants it stays lit until all are in (the
         * first step wrong may want another note: going there would put out the keys of this one) */
        for (i = page * 16u; i < page * 16u + 16u && i < len; i++) {
            tr_st(c, i, &x);
            if (x.kind == 1u && tr_st_off(t, i, &x) == 1u && !(t->step[i].time == ST_NOTE && t->step[i].n) &&
                tr_pen_is(&x)) {
                pen |= 1u << key_of_white(i % 16u);
                if (first == NSTEP)
                    first = i;
            }
        }
        if (pen) {
            tr_st(c, first, &x);
            note_name(nb, x.note[0]);
            if (!held) {
                tr_step(first, "HOLD SEQ, TAP KEY ", "");
                tr_num((int32_t)(first % 16u) + 1);
                tr.btn = B_SEQ;
            } else {
                tr_say(x.n > 1u ? "THE CHORD" : nb, ": TAP THE LIT KEYS");
                tr.keys = pen;
            }
            return 0;
        }
        if (w.kind != 1u || (t->step[bad].time == ST_NOTE && t->step[bad].n)) {   /* a note to take out first */
            if (!held) {
                tr_step(bad, "HOLD SEQ, TAP KEY ", "");
                tr_num((int32_t)(bad % 16u) + 1);
                tr.btn = B_SEQ;
            } else if (bad / 16u != page) {
                tr_say("HOLD SEQ, OCT+: NEXT 16 STEPS", "");
            } else {
                tr_step(bad, "TAP KEY ", "");
                tr_num((int32_t)(bad % 16u) + 1);
                tr_cat(" TO CLEAR");
                tr.keys = 1u << key_of_white(bad % 16u);
            }
            return 0;
        }
        note_name(nb, w.note[0]);
        if (!tr_pen_is(&w)) {
            int32_t oct;
            uint32_t k = tr_keys_for(t, w.note, w.n, &oct);
            if (held) {
                tr_say("LET GO OF SEQ, PLAY ", w.n > 1u ? "THE CHORD" : nb);
            } else if (oct) {
                tr_step(bad, nb, oct > 0 ? ": PRESS OCT+" : ": PRESS OCT-");
                tr.btn = oct > 0 ? B_OCTUP : B_OCTDN;
            } else {
                tr_key_text(kb, k);
                tr_step(bad, "PLAY ", w.n > 1u ? "THE LIT KEY" : nb);
                if (w.n == 1u) {
                    tr_cat(" (");
                    tr_cat(kb);
                    tr_cat(")");
                }
                tr.keys = k;
            }
            return 0;
        }
        if (!held) {
            tr_step(bad, "HOLD SEQ, TAP KEY ", "");
            tr_num((int32_t)(bad % 16u) + 1);
            tr.btn = B_SEQ;
            return 0;
        }
        if (bad / 16u != page) {
            tr_say("HOLD SEQ, OCT+: NEXT 16 STEPS", "");
            return 0;
        }
        for (i = page * 16u; i < page * 16u + 16u && i < len; i++) {   /* every step of the page this note goes on */
            tr_st(c, i, &x);
            if (x.kind == 1u && tr_st_off(t, i, &x) == 1u && !(t->step[i].time == ST_NOTE && t->step[i].n)) {
                uint32_t j, same = x.n == w.n;
                for (j = 0; j < x.n && same; j++)
                    same = x.note[j] == w.note[j];
                if (same)
                    tr.keys |= 1u << key_of_white(i % 16u);
            }
        }
        tr_say(nb, ": TAP THE LIT KEYS");
        return 0;
    }
    /* the NOTES page: KNOB 1 to the step, the keys write it */
    if (!on_notes_page()) {
        tr_say("TAP SEQ UNTIL YOU SEE NOTES", "");
        tr.btn = B_SEQ;
        return 0;
    }
    if (ui.cursor != bad) {
        tr_say("KNOB 1 TO STEP ", "");
        tr_num((int32_t)bad + 1);
        return 0;
    }
    if (w.kind != 1u) {
        tr_step(bad, "TAP EDIT TO DELETE IT", "");
        tr.btn = B_EDIT;
        return 0;
    }
    note_name(nb, w.note[0]);
    {
        int32_t oct;
        uint32_t k = tr_keys_for(t, w.note, w.n, &oct);
        if (oct) {
            tr_step(bad, nb, oct > 0 ? ": PRESS OCT+" : ": PRESS OCT-");
            tr.btn = oct > 0 ? B_OCTUP : B_OCTDN;
        } else if (w.n > 1u) {
            tr_step(bad, "LIT KEYS TOGETHER", "");
            tr.keys = k;
        } else {
            tr_key_text(kb, k);
            tr_step(bad, "PRESS ", nb);
            tr_cat(" (");
            tr_cat(kb);
            tr_cat(")");
            tr.keys = k;
        }
    }
    return 0;
}

/* ---------------------------------------------------------------- drum lanes --- */
/* the target's lane l, step i: 0x10 a hit | level | ratchet << 2 (TR_DATA: LEN, the lanes listed, then each lane's number
 * and a byte a step); a lane not listed: empty */
UI_SMALL static uint32_t tr_hit(const tr_card_t *c, uint32_t lane, uint32_t i)
{
    const uint8_t *d = &TR_D[c->data];
    uint32_t len = d[0], nl = d[1], l;
    for (l = 0; l < nl; l++)
        if (d[2u + l * (len + 1u)] == lane)
            return d[3u + l * (len + 1u) + i];
    return 0;
}
static const uint8_t TR_LANE_ORDER[DRUM_LANES] = {0, 2, 3, 4, 5, 6, 7, 1, 8, 9, 10, 11, 12, 13, 14, 15};
UI_SMALL static int tr_lanes(const tr_card_t *c, track_t *t)
{
    uint32_t len = TR_D[c->data], i, li, lane = DRUM_LANES, bad = NSTEP, page, layer = ui.layer == LY_STEP;
    if ((uint32_t)t->p[P_SLEN] != len) {
        tr_say("HOLD SEQ, KNOB 4 STEPS TO ", "");
        tr_num((int32_t)len);
        return 0;
    }
    for (li = 0; li < DRUM_LANES && bad == NSTEP; li++) {   /* the first lane with something to change */
        uint32_t l = TR_LANE_ORDER[li];
        for (i = 0; i < len; i++) {
            uint32_t w = tr_hit(c, l, i), on = dstep_has(&t->dstep[i], l);
            if (((w & 0x10u) != 0) != (on != 0) ||
                (on && (dstep_lvl(&t->dstep[i], l) != (w & 3u) || dstep_rat(&t->dstep[i], l) != ((w >> 2) & 3u)))) {
                lane = l, bad = i;
                break;
            }
        }
    }
    if (bad == NSTEP)
        return 1;
    if (!layer && !(on_drum_page() && !drum_page)) {   /* the DRUMS grid first (SEQ held: its keys are the steps anywhere) */
        if (on_drum_page())
            tr_say("TAP SEQ: THE GRID", ""), tr.btn = B_SEQ;
        else if (ui.home && !ui.menu)
            tr_say("TAP SEQ: THE DRUM GRID", ""), tr.btn = B_SEQ;
        else
            tr_say("TAP HOME, THEN SEQ: THE GRID", ""), tr.btn = B_HOME;
        return 0;
    }
    if (pen_lane != lane) {                         /* the sound to work on: KNOB 1 (or its black key) */
        tr_say("KNOB 1 TO ", LANE_NAME[lane]);
        tr.keys = 1u << drum_black_key(lane);
        return 0;
    }
    page = layer ? ui.step_page : drum_cursor / 16u;
    for (i = 0; i < len; i++) {                     /* the hits to put in or take out: first on this page */
        uint32_t w = tr_hit(c, lane, i), on = dstep_has(&t->dstep[i], lane);
        if (((w & 0x10u) != 0) != (on != 0) && i / 16u == page) {
            tr.keys |= 1u << key_of_white(i % 16u);
            if (bad / 16u != page || ((tr_hit(c, lane, bad) & 0x10u) != 0) == (dstep_has(&t->dstep[bad], lane) != 0))
                bad = i;
        }
    }
    {
        uint32_t w = tr_hit(c, lane, bad), on = dstep_has(&t->dstep[bad], lane);
        if (((w & 0x10u) != 0) != (on != 0)) {
            if (bad / 16u != page) {
                tr_say(layer ? "HOLD SEQ, OCT+: STEPS " : "TAP OCT+: STEPS ", "");
                tr_num((int32_t)(bad / 16u) * 16 + 1);
                tr_cat("-");
                tr_num((int32_t)(bad / 16u) * 16 + 16);
                tr.keys = 0;
                tr.btn = B_OCTUP;
                return 0;
            }
            tr_step(bad, on ? "NO " : "ADD ", LANE_NAME[lane]);
            tr_cat(on ? " HERE (KEY " : " (KEY ");
            tr_num((int32_t)(bad % 16u) + 1);
            tr_cat(")");
            return 0;
        }
        tr.keys = 0;                                    /* its level or its ratchet: the knobs */
        if (drum_cursor != bad) {
            tr_say("KNOB 2 TO STEP ", "");
            tr_num((int32_t)bad + 1);
        } else if (dstep_lvl(&t->dstep[bad], lane) != (w & 3u)) {
            tr_step(bad, "KNOB 4 TO ", (w & 3u) == LV_GHOST ? "GHOST" : (w & 3u) == LV_HARD ? "HARD" :
                                       (w & 3u) == LV_SOFT ? "SOFT" : "NORM");
        } else {
            static const char *const R[4] = {"X1", "X2", "X3", "X4"};
            if (ui.sheet)
                tr_step(bad, "KNOB 2: RATCHET ", R[(w >> 2) & 3u]);
            else {
                tr_step(bad, "HOLD OCT+, RATCHET ", R[(w >> 2) & 3u]);
                tr.btn = B_OCTUP;
            }
        }
        return 0;
    }
}

/* ---------------------------------------------------------------- the goals --- */
static uint8_t tr_quiet;                           /* checking a card done before (tr_resume): what is there, not where */
UI_SMALL static int tr_browsing(void) { return !ui.home && !ui.menu && cur_page()->graph == GR_BROWSE; }
/* ALGORITHM picks the track here (ui_input.c; the DRUMS screen too since 1.4.2): not on the SONG screen (its loop), not
 * while a button is held, nor in a take; there HOME comes first */
UI_SMALL static int tr_algo_ok(void)
{
    return !ui.menu && ui.layer == LY_PLAY && !ui.hold_kind && !ft_on && !rec_wait && !on_song_page();
}
UI_SMALL static void tr_algo_say(uint32_t k)        /* "TURN ALGORITHM TO TRACK 4", or HOME first */
{
    tr_say(tr_algo_ok() ? "TURN ALGORITHM TO TRACK " : "TAP HOME, ALGORITHM TO ", "");
    tr_num((int32_t)k + 1);
    if (!tr_algo_ok() && ui.layer == LY_PLAY)
        tr.btn = B_HOME;
}
/* the way to the PATTERNS page: SEQ held + SAVE (SCENES), from any page and track; then SELECT left to PATTERNS */
UI_SMALL static int tr_to_pats(void)
{
    if (tr_quiet || (on_pats_page() && pats_view() == PV_PADS))
        return 1;
    if (on_pats_page()) {
        tr_say("TURN SELECT LEFT: PATTERNS", "");
        return 0;
    }
    tr_say("HOLD SEQ, TAP SAVE", "");
    tr.btn = B_SEQ;
    return 0;
}
/* on the PATTERNS screen, the next press to put pattern p on track k (copy: the pattern playing copied into it) */
UI_SMALL static void tr_pat_way(uint32_t k, uint32_t p, int copy)
{
    if (tr_quiet)
        return;
    if (!tr_to_pats())
        return;
    if (song.sel != k) {
        tr_algo_say(k);
        return;
    }
    if (copy && pats_cursor != p) {
        tr_say("KNOB 1 TO PATTERN ", "");
        tr_num((int32_t)p + 1);
        return;
    }
    if (copy)
        tr_say(pats_arm == 1u ? "KNOB 3 RIGHT AGAIN: COPY" : "KNOB 3 RIGHT TWICE: COPY", "");
    else if (song.playing && trk[k].pat_req == p + 1u)
        tr_say("WAIT FOR THE BAR", "");
    else {
        tr_say("PRESS WHITE KEY ", "");          /* (the keys are the pads: the pattern's key lit) */
        tr_num((int32_t)p + 1);
        tr.keys = 1u << key_of_white(p);
    }
}
/* the way to a page of the three (PV_*): SEQ held + SAVE (SCENES), then SELECT left */
UI_SMALL static int tr_to_view(uint32_t view)
{
    static const char *const VN[3] = {"PATTERNS", "CHAIN", "SCENES"};
    if (tr_quiet || (on_pats_page() && pats_view() == view))
        return 1;
    if (on_pats_page()) {
        tr_say(pats_view() > view ? "TURN SELECT LEFT: " : "TURN SELECT RIGHT: ", VN[view % 3u]);
        return 0;
    }
    tr_say("HOLD SEQ, TAP SAVE", "");
    tr.btn = B_SEQ;
    return 0;
}
UI_SMALL static int tr_sel(const tr_card_t *c)       /* the card's track selected (else: the hint says which) */
{
    if (tr_quiet || song.sel == c->trk)
        return 1;
    tr_algo_say(c->trk);
    return 0;
}
/* a parameter card's page (data: 1 + its PAGES index, 0: any, a held button's knobs): off it, the hint says where */
UI_SMALL static int tr_on_page(const tr_card_t *c)
{
    if (tr_quiet || !c->data || ui.layer != LY_PLAY || (!ui.home && !ui.menu && ui.page == c->data - 1u))
        return 1;
    tr_say("OPEN THE ", PAGES[c->data - 1u].title);
    tr_cat(" PAGE");
    tr.btn = c->btn;
    return 0;
}
UI_SMALL static int tr_goal(const tr_card_t *c)
{
    track_t *t = &trk[c->trk % NTRK];
    tr.hint[0] = 0;
    tr.keys = 0;
    tr.btn = NB;
    switch (c->goal) {
    case TG_TRACK:
        if (song.sel == c->trk)
            return 1;
        tr_algo_say(c->trk);
        return 0;
    case TG_KIT:
    case TG_SOUND: {
        int on = c->goal == TG_KIT ? is_drum(t) && t->p[P_E0] == c->v :
                 !is_drum(t) && t->eng_req == c->p && t->preset == (uint8_t)c->v && user_of(t) >= UP_SLOTS;
        if (on && (tr_quiet || !tr_browsing()))
            return 1;                                   /* (done when the browser closes on it) */
        if (!tr_sel(c))
            return 0;
        if (on)
            tr_say("THAT'S IT! TAP SAVE TO KEEP IT", ""), tr.btn = B_SAVE;
        else if (tr_browsing())
            tr_say("FOLLOW THE DOTS: KNOB 2, 3", "");
        else
            tr_say("TURN PRESETS, FOLLOW THE DOTS", "");
        return 0;
    }
    case TG_PARAM:
        if (tr_near(t->p[c->p], c->v, c->tol))
            return 1;
        if (c->p == P_ROOT) {                           /* SEL held + a key of that note: the keys lit */
            uint32_t k;
            for (k = 0; k < 27u; k++)
                if ((53u + k) % 12u == (uint32_t)c->v)
                    tr.keys |= 1u << k;
            tr.btn = B_SCL;
            return 0;
        }
        if (c->p != P_MUTE && !tr_sel(c))
            return 0;
        if (!tr_on_page(c))
            return 0;
        tr_now_c(c, t->p[c->p]);
        return 0;
    case TG_GLOBAL:
        if (tr_near(song.g[c->p], c->v, c->tol))
            return 1;
        if (!tr_on_page(c))
            return 0;
        tr_now_c(c, song.g[c->p]);
        return 0;
    case TG_PLAY:
        return (song.playing != 0) == (c->v != 0);
    case TG_PAGE: {
        int at = ui.menu || ui.layer != LY_PLAY ? 0 :
                 PAGES[c->p].scope == SC_DRUM ? on_drum_page() && !drum_page :
                 PAGES[c->p].scope == SC_PATS ? on_pats_page() && ui.page == c->p : PAGES[c->p].scope == SC_SONG ? on_song_page() :
                 !ui.home && ui.page == c->p;
        if (at)
            return 1;
        if (PAGES[c->p].scope == SC_PATS) {
            uint32_t v = 0, i = c->p;                   /* (which of the three: its place among them) */
            while (i > 0u && PAGES[i - 1u].scope == SC_PATS)
                i--, v++;
            tr_to_view(v);
            if (str_eq(tr.hint, c->act))
                tr.hint[0] = 0;                         /* (what the action says already) */
        } else if (PAGES[c->p].scope == SC_DRUM && on_drum_page())
            tr_say("TAP SEQ: THE GRID", "");
        else if (!ui.home && !on_drum_page() && !on_pats_page() && !on_song_page())
            tr_say("NOW ON ", cur_page()->title);
        return 0;
    }
    case TG_OCT:
        if (song.octave == c->v)
            return 1;
        tr_say("NOW OCTAVE ", "");
        tr_num(song.octave);
        tr.btn = song.octave < c->v ? B_OCTUP : B_OCTDN;
        return 0;
    case TG_NOTES:
        tr.keyed = 1;
        return tr_sel(c) && tr_notes(c, t);
    case TG_LANES:
        tr.keyed = 1;
        return tr_sel(c) && tr_lanes(c, t);
    case TG_MUTES: {
        uint32_t k;
        for (k = 0; k < NTRK; k++)
            if (((c->p >> k) & 1u) && (trk[k].p[P_MUTE] != 0) != (((uint32_t)c->v >> k) & 1u)) {
                tr_say("TRACK ", "");
                tr_num((int32_t)k + 1);
                tr_cat(trk[k].p[P_MUTE] ? ": UNMUTE (GLO + KEY " : ": MUTE (GLO + KEY ");
                tr_num((int32_t)(k % 4u) + 1);
                tr_cat(")");
                if (k / 4u != song.sel / 4u) {          /* (GLO's keys 1-4: the bank of the selected track) */
                    tr_algo_say(k);
                }
                return 0;
            }
        return 1;
    }
    case TG_LOCK: {
        uint32_t k, step = TR_D[c->data];
        for (k = 0; k < NLOCK; k++)
            if (t->lock[k].step == step && (t->lock[k].param & LOCK_PID) == c->p) {
                if (!tr_near(t->lock[k].val, c->v, c->tol)) {
                    tr_now(lock_desc(t, c->p), t->lock[k].val, c->v);
                    return 0;
                }
                if ((c->flags & 1u) && !(t->lock[k].param & LOCK_SLIDE)) {
                    tr_say("KNOB 3: SLIDE ON", "");
                    return 0;
                }
                return 1;
            }
        if (!tr_sel(c))
            return 0;
        if (tr_quiet)
            return 0;
        if (ui.home || ui.menu || cur_page()->scope != SC_STEP)
            tr_say("OPEN THE NOTES PAGE (SEQ)", ""), tr.btn = B_SEQ;
        else if (!ui.sheet && ui.cursor != step) {
            tr_say("KNOB 1 TO STEP ", "");
            tr_num((int32_t)step + 1);
        } else if (!ui.sheet)
            tr_say("HOLD OCT+ FOR THE STEP'S MENU", ""), tr.btn = B_OCTUP;
        else if (!ui.lsheet)
            tr_say("KNOB 1 TO LOCKS, TAP OCT+", ""), tr.btn = B_OCTUP;
        else if (ui.lock_par != c->p) {
            tr_say("KNOB 1 TO ADD, KNOB 2 TO ", lock_desc(t, c->p)->label);
        } else
            tr_say("ON ADD: TAP OCT+", ""), tr.btn = B_OCTUP;
        return 0;
    }
    case TG_PATSEL: {
        uint32_t k = c->trk % NTRK, has = pb_find(k, c->v) >= 0 || (t->pat == c->v && !pat_empty(t));
        if (t->pat == c->v && (!(c->flags & 1u) || has))
            return 1;
        if ((c->flags & 1u) && !has)                    /* to play a pattern that holds something: the copy first */
            tr_pat_way(k, t->pat == c->v ? 0u : (uint32_t)c->v, t->pat != c->v);
        else
            tr_pat_way(k, (uint32_t)c->v, 0);
        return 0;
    }
    case TG_PATS: {
        uint32_t k, w0 = 255u, same = 1, bad = NTRK;
        for (k = 0; k < NTRK; k++) {
            uint32_t w = TR_D[c->data + k];
            if (w == 255u)
                continue;
            same &= w0 == 255u || w == w0;
            w0 = w;
            if (trk[k].pat != w && (bad == NTRK || k == song.sel))
                bad = k;                                /* (the track selected first) */
        }
        if (bad == NTRK)
            return 1;
        if (same && on_pats_page() && pats_view() == PV_PADS && pats_cursor == w0 && w0 < NPAT) {   /* one for all: OCT- */
            tr_say(song.playing && trk[bad].pat_req ? "WAIT FOR THE BAR" : "PRESS OCT-: EVERY TRACK", "");
            tr.btn = B_OCTDN;
            return 0;
        }
        tr_pat_way(bad, TR_D[c->data + bad], 0);
        return 0;
    }
    case TG_PATHAS: {
        uint32_t k, bad = NTRK;
        for (k = 0; k < NTRK; k++)
            if ((((uint32_t)c->v >> k) & 1u) && pb_find(k, c->p) < 0 && !(trk[k].pat == c->p && !pat_empty(&trk[k])) &&
                (bad == NTRK || k == song.sel))
                bad = k;                                /* (the track selected first) */
        if (bad == NTRK)
            return 1;
        tr_pat_way(bad, c->p, 1);
        return 0;
    }
    case TG_SAVED:
        return proj_ok(&proj_slot[c->v & 3]) && proj_slot[c->v & 3].sum != tr.base;
    case TG_SONG: {
        const uint8_t *d = &TR_D[c->data];
        uint32_t k;
        if (arrangement.count != d[0]) {
            tr_say("KNOB 4: STEPS TO ", "");
            tr_num(d[0]);
            return 0;
        }
        if (c->flags & 1u)
            return 1;
        for (k = 0; k < d[0]; k++)
            if (arrangement.entry[k].scene != d[1u + 2u * k] || arrangement.entry[k].bars != d[2u + 2u * k]) {
                tr_say(song_cursor != k ? "KNOB 1 TO STEP " : "STEP ", "");
                tr_num((int32_t)k + 1);
                if (song_cursor == k) {
                    tr_cat(": ");
                    tr_cat(SEC_NAME[d[1u + 2u * k] & 3u]);
                    tr_cat(", ");
                    tr_num(d[2u + 2u * k]);
                    tr_cat(" BARS");
                }
                return 0;
            }
        return 1;
    }
    case TG_SONGMODE:
        return arrangement_enabled && song.playing;
    case TG_SCENE: {
        const uint8_t *d = &TR_D[c->data];
        uint32_t s = c->p % NSCENE, k, bad = NTRK, store = 1;
        for (k = 0; k < NTRK; k++) {
            if (d[k] == 255u || scn_pat[s][k] == d[k])
                continue;
            store &= d[k] < NPAT && trk[k].pat == d[k] && !trk[k].pat_req;   /* (what plays is what it wants) */
            if (bad == NTRK || k == song.sel)
                bad = k;                         /* (the track selected first) */
        }
        if (bad == NTRK && (c->v < 0 || scn_name[s] == (uint32_t)c->v))
            return 1;
        if (!tr_to_view(PV_SCENES))
            return 0;
        if (scn_cursor != s) {
            tr_say("KNOB 1 TO SCENE ", "");
            tr_num((int32_t)s + 1);
        } else if (c->v >= 0 && scn_name[s] != (uint32_t)c->v) {
            tr_say("KNOB 3 TO ", N_SCN[(uint32_t)c->v % NSCN_NAMES]);
        } else if (store) {
            tr_say(pats_arm == 3u ? "PRESS OCT- AGAIN: STORE" : "PRESS OCT- TWICE: STORE", "");
            tr.btn = B_OCTDN;
        } else if (song.sel != bad) {
            tr_algo_say(bad);
        } else if (d[bad] >= NPAT) {
            tr_say("KNOB 4 DOWN TO KEEP", "");
        } else {
            tr_say("KNOB 4 TO PATTERN ", "");
            tr_num((int32_t)d[bad] + 1);
        }
        return 0;
    }
    case TG_SCNPLAY:
        if (scn_cur == c->p && scn_ask == SCN_NONE)
            return 1;
        if (!on_pats_page()) {                   /* (any of the three: the keys 9..16 launch the scenes) */
            tr_to_view(PV_SCENES);
            return 0;
        }
        if (scn_ask == c->p && song.playing) {
            tr_say("WAIT FOR THE BAR", "");
            return 0;
        }
        tr_say("PRESS WHITE KEY ", "");
        tr_num((int32_t)c->p + 9);
        tr.keys = 1u << key_of_white(8u + c->p);
        return 0;
    case TG_CHAIN: {
        const uint8_t *d = &TR_D[c->data];
        uint32_t n = d[0], i;
        for (i = 0; i < n && i < t->pat_nchain && t->pat_chain[i] == d[1u + i]; i++)
            ;
        if (i == n && t->pat_nchain == n && !t->pat_coff)
            return 1;
        if (!tr_to_view(PV_CHAIN) || !tr_sel(c))
            return 0;
        if (i == n && t->pat_nchain == n) {      /* (the slots right: PLAY off) */
            tr_say("KNOB 4 RIGHT: PLAY ON", "");
        } else if (i >= t->pat_nchain) {         /* (a slot missing: at the end, its key) */
            if (chain_cursor != t->pat_nchain) {
                tr_say("KNOB 1 TO THE END", "");
            } else {
                tr_say("PRESS WHITE KEY ", "");
                tr_num((int32_t)CH_PAT(d[1u + i]) + 1);
                tr.keys = 1u << key_of_white(CH_PAT(d[1u + i]));
            }
        } else if (chain_cursor != i) {          /* (a slot wrong, or one too many) */
            tr_say("KNOB 1 TO SLOT ", "");
            tr_num((int32_t)i + 1);
        } else if (i >= n) {
            tr_say("PRESS OCT-: REMOVE IT", "");
            tr.btn = B_OCTDN;
        } else if (CH_PAT(t->pat_chain[i]) != CH_PAT(d[1u + i])) {
            tr_say("KNOB 2 TO PATTERN ", "");
            tr_num((int32_t)CH_PAT(d[1u + i]) + 1);
        } else {
            tr_say("KNOB 3 TO X", "");
            tr_num((int32_t)CH_REP(d[1u + i]));
        }
        return 0;
    }
    default:
        return 0;
    }
}

/* ------------------------------------------------------------- the log (progress, in its own flash sector) --- */
typedef struct {
    uint8_t mark, lvl, card, done, seen, at[TR_NLEVELS], rsv[7 - TR_NLEVELS];   /* (rsv: was level 4's) */
    uint32_t crc;
} tr_rec_t;
_Static_assert(sizeof(tr_rec_t) == TR_REC, "a record of the log");
#define TR_MARK 0x5Au
UI_SMALL static void tr_log_boot(void)              /* power-on: the last record of the log */
{
    tr_rec_t r, last;
    uint32_t o, k, got = 0;
    for (o = 0; o + TR_REC <= 0x1000u; o += TR_REC) {
        if (!flash_ok || st_read(TR_LOG + o, &r, TR_REC) || r.mark == 0xFFu)
            break;
        if (r.mark == TR_MARK && r.crc == st_crc32(&r, TR_REC - 4u))
            last = r, got = 1;
    }
    tr.log_at = o;
    if (!got)
        return;
    for (k = 0; k < TR_NLEVELS; k++)
        tr.at[k] = (uint8_t)(last.at[k] < tr_level(k)->n ? last.at[k] : 0u);
    tr.done = (uint8_t)(last.done & ((1u << TR_NLEVELS) - 1u)), tr.seen = last.seen;
    if (last.lvl && last.lvl <= TR_NLEVELS) {
        tr.lvl = last.lvl;
        tr.card = tr.at[last.lvl - 1u];
    }
}
UI_SMALL static void tr_log_put(void)               /* a record (a few bytes programmed: also while playing) */
{
    tr_rec_t r;
    if (!flash_ok)
        return;
    if (tr.log_at + TR_REC > 0x1000u) {             /* full: erased, only stopped (an erase stops the audio ~50 ms) */
        if (song.playing || transport_req || st_erase(TR_LOG))
            return;
        tr.log_at = 0;
    }
    memset(&r, 0, sizeof r);
    r.mark = TR_MARK, r.lvl = tr.lvl, r.card = tr.card, r.done = tr.done, r.seen = tr.seen;
    memcpy(r.at, tr.at, sizeof tr.at);
    r.crc = st_crc32(&r, TR_REC - 4u);
    if (st_prog(TR_LOG + tr.log_at, &r, TR_REC) == 0)
        tr.dirty = 0;
    tr.log_at += TR_REC;
}

/* ------------------------------------------------------------- the levels --- */
UI_SMALL static void tr_card_begin(void)
{
    const tr_card_t *c = tr_card();
    tr.ok = 0;
    tr.t0 = fm1_ms;
    tr.sig = 0;
    tr.keyed = 0;
    if (c && c->goal == TG_SAVED)
        tr.base = proj_ok(&proj_slot[c->v & 3]) ? proj_slot[c->v & 3].sum : 0u;
    if (c && c->goal == TG_DONE)
        tr.done |= (uint8_t)(1u << (tr.lvl - 1u));
    tr.at[tr.lvl - 1u] = tr.card;
    tr.dirty = 1;
}
UI_SMALL static void tr_go(int32_t d)                    /* the next / the card before */
{
    const tr_level_t *L = tr_level(tr.lvl - 1u);
    int32_t n = (int32_t)tr.card + d;
    tr.card = (uint8_t)clamp(n, 0, L->n - 1);
    tr_card_begin();
}
/* going on with a level: the cards done since its last change of pattern or section are checked again (the loop may be
 * older than the progress: BoopBox autosaves it only when stopped); it goes on at the first one that no longer holds */
static const uint8_t TR_STATE[] = {TG_KIT, TG_SOUND, TG_PARAM, TG_GLOBAL, TG_NOTES, TG_LANES, TG_LOCK};
UI_SMALL static void tr_resume(void)
{
    const tr_level_t *L = tr_level(tr.lvl - 1u);
    uint32_t i, from = 0, k;
    for (i = 0; i < tr.card; i++)
        if (L->cards[i].goal == TG_PATSEL || L->cards[i].goal == TG_PATS || L->cards[i].goal == TG_PATHAS ||
            L->cards[i].goal == TG_SAVED || L->cards[i].goal == TG_SCENE || L->cards[i].goal == TG_SCNPLAY ||
            L->cards[i].goal == TG_CHAIN)
            from = i + 1u;
    tr_quiet = 1;
    for (i = from; i < tr.card; i++)
        for (k = 0; k < sizeof TR_STATE; k++)
            if (L->cards[i].goal == TR_STATE[k] && !tr_goal(&L->cards[i])) {
                tr.card = (uint8_t)i;
                i = tr.card;
                break;
            }
    tr_quiet = 0;
    tr_card_begin();
}
/* level l from its first card: a new project, in loop mode (when stopped: stopping a song puts the loop it kept back);
 * the other levels not done start again too (their loop is gone) */
UI_SMALL static void tr_begin(uint32_t l)
{
    uint32_t k;
    arrangement_enabled = 0;
    project_new();
    for (k = 0; k < TR_NLEVELS; k++)
        if (k == l || !((tr.done >> k) & 1u))
            tr.at[k] = 0;
    tr.done &= (uint8_t)~(1u << l);
    tr.lvl = (uint8_t)(l + 1u);
    tr.card = 0;
    tr_card_begin();
}
UI_SMALL static void tr_start(uint32_t l, int again)    /* level l: on where it was left; again: from its start */
{
    menu_close();
    if (!again && tr.at[l] && !((tr.done >> l) & 1u)) {
        tr.lvl = (uint8_t)(l + 1u);
        tr.card = tr.at[l];
        tr_resume();
        return;
    }
    if (song.playing || transport_req) {           /* stopped first, then the new project (trainer_tick) */
        transport_req = 2;
        tr.pend = (uint8_t)(l + 1u);
        return;
    }
    tr_begin(l);
}
UI_SMALL static void tr_quit(void)
{
    tr.lvl = 0;
    tr.pend = 0;
    tr.dirty = 1;
    lcd_clip_y = 0;
    ui.force = 1;
}

/* the coach's band: the screen's title area. The studio screens (TRACKS, DRUMS, PATTERNS, SONG, CHORDS, a layer held,
 * REC, the visualiser) have a 40-row title in large type: there two lines (the headline or what is wrong, then the
 * action); the pages and the browser a 20-row header: one line, in turn */
UI_SMALL static uint32_t tr_band_h(void)
{
    if (ui.menu)
        return 0;
    if (ui.layer != LY_PLAY || ui.hold_kind || rec_wait || ft_on || vis_shown() || on_song_page() || on_pats_page() ||
        on_chords_page() || on_drum_page() || (!ui.home && cur_page()->scope == SC_TRK))
        return 40;
    return H_HEAD;
}
/* every UI frame (main loop, after the input): the goal, NICE, the next card */
UI_SMALL static void trainer_tick(void)
{
    const tr_card_t *c = tr_card();
    if (tr.pend && !song.playing && !transport_req) {
        tr_begin(tr.pend - 1u);
        tr.pend = 0;
        c = tr_card();
    }
    if (tr.dirty)
        tr_log_put();
    if (!c) {
        lcd_clip_y = 0;
        return;
    }
    {
        uint32_t h = tr_band_h();
        if (h < lcd_clip_y)
            ui.force = 1;                               /* (a smaller band: the page draws the rows it gave back) */
        if (h != lcd_clip_y)
            tr.sig = 0;
        lcd_clip_y = (uint8_t)h;
    }
    if (ui.menu) {
        tr.sig = 0;                                     /* (the menu drew over the band: again after it) */
        return;
    }
    if (tr.ok) {
        if (fm1_ms - tr.ok_ms >= TR_OK_MS)
            tr_go(1);
        return;
    }
    if (c->goal != TG_DONE && tr_goal(c)) {
        tr.ok = 1;
        tr.ok_ms = fm1_ms;
        tr.keys = 0;
        tr.btn = NB;
    }
}

UI_SMALL static int tr_prefix(const char *a, const char *p)
{
    while (*p && *a == *p)
        a++, p++;
    return !*p;
}
/* the card's action as shown: "@" the value wanted, as the screen shows it ("KNOB 4 (GATE) TO 79%") */
UI_SMALL static void tr_act(const tr_card_t *c, char *b, uint32_t n)
{
    const char *a = c->act;
    uint32_t o = 0;
    if (!tr_algo_ok() && tr_prefix(a, "TURN ALGORITHM TO TRACK ")) {   /* (ALGORITHM does nothing here: HOME first) */
        str_cpy(b, "TAP HOME, ALGORITHM TO ", n);
        o = str_len(b);
        a += 24;
    }
    for (; *a && o + 1u < n; a++) {
        if (*a == '@' && (c->goal == TG_PARAM || c->goal == TG_GLOBAL)) {
            char v[16];
            tr_card_value(v, c, c->v);
            str_cpy(b + o, v, n - o);
            o = str_len(b);
        } else
            b[o++] = *a;
    }
    b[o] = 0;
}
/* (1.5.1) a line wider than the screen scrolls, as a ticker: still for a moment (its start read), to the left a
 * pixel each TR_MQ_PX ms until its end shows, still again, then from its start once more. tr_mq_len: how long that
 * takes (0: it fits); tr_marquee: how far it has gone after el ms (2 px at a time: a redraw each 50 ms at most) */
#define TR_MQ_W 236
#define TR_MQ_HOLD 1200u
#define TR_MQ_PX 25u
UI_SMALL static int32_t tr_mq_over(const char *s) { return text_w(&FONT_S, s) + 2 - TR_MQ_W; }
UI_SMALL static uint32_t tr_mq_len(const char *s)
{
    int32_t over = tr_mq_over(s);
    return over > 0 ? 2u * TR_MQ_HOLD + (uint32_t)over * TR_MQ_PX : 0u;
}
UI_SMALL static int32_t tr_marquee(const char *s, uint32_t el)
{
    int32_t over = tr_mq_over(s);
    uint32_t run, t;
    if (over <= 0)
        return 0;
    run = (uint32_t)over * TR_MQ_PX;
    t = el % (2u * TR_MQ_HOLD + run);
    if (t < TR_MQ_HOLD)
        return 0;
    if (t >= TR_MQ_HOLD + run)
        return over;
    return (int32_t)((t - TR_MQ_HOLD) / TR_MQ_PX) & ~1;
}
/* the band: the card's number and headline, or what is wrong (amber); the action; a UI message; NICE; a progress bar */
UI_SMALL static void trainer_draw(void)
{
    const tr_card_t *c = tr_card();
    const tr_level_t *L;
    uint32_t el, sig, phase, h = lcd_clip_y, two = h > H_HEAD, mel = 0, own = 0;
    int32_t o1, o2;
    char b[48], act[48];
    uint16_t col;
    if (!c || ui.menu || !h)
        return;
    L = tr_level(tr.lvl - 1u);
    el = fm1_ms - tr.t0;
    tr_act(c, act, sizeof act);
    /* line 1 (or the line): 0 number + headline, 1 the action (one line only), 2 what is wrong, 3 NICE, 4 a message.
     * Two lines: what is wrong stays on line 1 (the action under it); one line: the action and it take turns */
    if (two)
        phase = tr.hint[0] && el >= TR_HEAD_MS / 2u ? 2u : 0u;
    else if (el < TR_HEAD_MS || !tr.hint[0])
        phase = el < TR_HEAD_MS ? 0u : 1u;
    else {                                          /* the action, then the hint, each its turn (a scroll: its whole) */
        uint32_t d1 = tr_mq_len(act), d2 = tr_mq_len(tr.hint), t;
        d1 = d1 > TR_ALT_MS ? d1 : TR_ALT_MS;
        d2 = d2 > TR_ALT_MS ? d2 : TR_ALT_MS;
        t = (el - TR_HEAD_MS) % (d1 + d2);
        phase = t < d1 ? 1u : 2u;
        mel = t < d1 ? t : t - d1;                  /* (the turn's own time: its scroll from its start) */
        own = 1;
    }
    if (c->goal == TG_DONE)
        phase = two || el < TR_HEAD_MS ? 0u : 1u;
    if (tr.ok)
        phase = 3u;
    if (ui.msg_t && !tr.ok)
        phase = 4u;                                     /* a message of the UI (on a page its place is this line) */
    if (phase == 0u) {                              /* "4/31 THE KICK DRUM" */
        fmt_int(b, tr.card + 1);
        str_cpy(b + str_len(b), "/", 2);
        fmt_int(b + str_len(b), L->n);
        str_cpy(b + str_len(b), " ", 2);
        str_cpy(b + str_len(b), c->head, sizeof b - str_len(b));
        col = C_WHITE;
    } else if (phase == 1u) {
        str_cpy(b, act, sizeof b);
        col = C_HI;
    } else if (phase == 2u) {
        str_cpy(b, tr.hint, sizeof b);
        col = C_AMB;
    } else if (phase == 4u) {
        str_cpy(b, ui.msg, sizeof b);
        col = C_WHITE;
    } else {
        str_cpy(b, "NICE!", sizeof b);
        col = RGB(90, 240, 150);
    }
    sig = str_hash(phase * 7919u + tr.card * 131u + tr.lvl * 31u + h, b);
    if (two)
        sig = str_hash(sig, act);
    if (sig != tr.mq_sig)                           /* (other text: a scroll from its start) */
        tr.mq_sig = sig, tr.mq_t0 = fm1_ms;
    o1 = tr_marquee(b, own ? mel : fm1_ms - tr.mq_t0);
    o2 = two ? tr_marquee(act, fm1_ms - tr.mq_t0) : 0;
    sig += (uint32_t)o1 * 2654435761u + (uint32_t)o2 * 40503u;
    if (sig == tr.sig)
        return;
    tr.sig = sig;
    lcd_clip_y = 0;
    cv_begin(240, h, C_BLACK);
    cv_text(2 - o1, 1, &FONT_S, b, col);
    if (two)
        cv_text(2 - o2, 19, &FONT_S, act, tr.ok ? C_DIM : C_HI);
    cv_rect(0, (int32_t)h - 2, 240, 2, C_LINE);
    cv_rect(0, (int32_t)h - 2, (int32_t)(240u * (tr.card + (tr.ok ? 1u : 0u)) / L->n), 2, UI_COL[(tr.lvl + 1u) & 7u]);
    cv_blit(0, 0);
    lcd_clip_y = (uint8_t)h;
}

/* the lights: the button to press blinks; on a card about keys the coach owns the keys' lights: only the keys to press,
 * pulsing (bright, then dim), every other key dark (BoopBox's own key lights would read as "press these") */
UI_SMALL static void tr_led_clr(uint8_t *a, uint32_t id)
{
    uint8_t q = led_pos[id];
    if (q != 0xFF)
        a[q >> 3] &= (uint8_t)~(1u << (q & 7u));
}
UI_SMALL static void trainer_leds(uint8_t *nl, uint8_t *dl, uint8_t *bl)
{
    const tr_card_t *c = tr_card();
    uint32_t k, ph = (fm1_ms / 125u) & 3u;
    if (ui.menu == 3u) {                                /* the picker: OCT+ does the action (not on the "why" pages) */
        if (ph < 2u && !tr.wp)
            led_put(nl, panel.btn[B_OCTUP], 1);
        return;
    }
    if (!c || ui.menu || tr.ok)
        return;
    {
        uint32_t b = tr.btn < NB ? tr.btn : c->btn;
        if (b < NB && ph < 2u)
            led_put(nl, panel.btn[b], 1);
    }
    if (!tr.keyed && !tr.keys)
        return;
    for (k = 0; k < 27u; k++) {
        tr_led_clr(nl, 14u + k), tr_led_clr(dl, 14u + k), tr_led_clr(bl, 14u + k);
        if ((tr.keys >> k) & 1u)
            led_put(ph < 3u ? nl : dl, 14u + k, 1);
    }
}

/* the sound browser (ui_draw.c graph_browse): the sound or kit the card asks for, marked while the card is on */
UI_SMALL static int tr_browse_target(uint32_t *kit, uint32_t *e, uint32_t *k)
{
    const tr_card_t *c = tr_card();
    if (!c || (c->goal != TG_SOUND && c->goal != TG_KIT) || song.sel != c->trk)
        return 0;
    *kit = c->goal == TG_KIT;
    *e = c->p;
    *k = (uint32_t)c->v;
    return 1;
}
UI_SMALL static uint32_t tr_pulse(void)                 /* 3..8..3 over 1.2 s (never gone), 0 with nothing to mark */
{
    uint32_t kit, e, k, ph = (fm1_ms / 100u) % 12u;
    if (!tr_browse_target(&kit, &e, &k))
        return 0;
    return ph < 6u ? ph + 3u : 14u - ph;
}

/* ------------------------------------------------------------- the picker (ui.menu 3: HOME held) --- */
/* one level a page (its song, style, what it teaches, the progress), the last page BoopBox's menu; SELECT (or ALGORITHM)
 * turns the pages, KNOB 1 (or PRESETS) picks the action, OCT+ does it, OCT- closes */
enum { TA_CONT, TA_START, TA_AGAIN, TA_OVER, TA_SKIP, TA_BACK, TA_QUIT, TA_MENU };
static const char *const TA_NAME[] = {"CONTINUE", "START", "PLAY IT AGAIN", "START OVER", "SKIP THIS STEP",
                                      "GO BACK A STEP", "QUIT THE LEVEL", "OPEN THE MENU"};
UI_SMALL static uint32_t tr_actions(uint32_t page, uint8_t *a)   /* the page's actions, the first the default */
{
    uint32_t n = 0;
    if (page >= TR_NLEVELS) {
        a[n++] = TA_MENU;
        return n;
    }
    if (tr_running() && tr.lvl == page + 1u) {
        a[n++] = TA_CONT, a[n++] = TA_SKIP, a[n++] = TA_BACK, a[n++] = TA_OVER, a[n++] = TA_QUIT;
    } else if ((tr.done >> page) & 1u) {
        a[n++] = TA_AGAIN;
    } else if (tr.at[page]) {
        a[n++] = TA_CONT, a[n++] = TA_OVER;
    } else
        a[n++] = TA_START;
    return n;
}
UI_SMALL static void tr_pick_open(void)
{
    ui.menu = 3;
    ui.force = 1;
    tr.page = (uint8_t)(tr.lvl ? tr.lvl - 1u : 0u);
    tr.wp = (uint8_t)(tr_card() != 0);              /* in a level: the step's "why" first */
    tr.sel = 0;
    tr.psig = 0;
}
UI_SMALL static void tr_pick_input(uint32_t pressed)
{
    int32_t s;
    uint8_t a[8];
    uint32_t n = tr_actions(tr.page, a);
    if ((pressed >> panel.btn[B_OCTDN]) & 1u) {
        menu_close();
        return;
    }
    if (tr.wp) {                                    /* the "why" pages: SELECT turns them, past the last: the level */
        const tr_card_t *c = tr_card();
        uint32_t n = c ? TR_WHY[c->why % TR_NWHY].n : 0u;
        if ((s = panel_enc(EN_SELECT)) != 0 || (s = panel_enc(EN_ALGO)) != 0) {
            if (s > 0 && tr.wp >= n)
                tr.wp = 0;                              /* (on to the level's own page) */
            else
                tr.wp = (uint8_t)clamp((int32_t)tr.wp + (s > 0 ? 1 : -1), 1, (int32_t)n);
            tr.sel = 0;
            ui.force = 1;
        }
        enc_drop();
        return;
    }
    if ((s = panel_enc(EN_SELECT)) != 0 || (s = panel_enc(EN_ALGO)) != 0) {
        tr.page = (uint8_t)clamp((int32_t)tr.page + (s > 0 ? 1 : -1), 0, TR_NLEVELS);
        tr.sel = 0;
        ui.force = 1;
    }
    if ((s = panel_enc(EN_K1)) != 0 || (s = panel_enc(EN_PRESET)) != 0)
        tr.sel = (uint8_t)clamp((int32_t)tr.sel + (s > 0 ? 1 : -1), 0, (int32_t)n - 1);
    if ((pressed >> panel.btn[B_OCTUP]) & 1u) {
        uint32_t l = tr.page, act = a[tr.sel % n];
        if (act == TA_MENU) {
            ui.menu = 1;
            ui.menu_sel = 0;
            ui.force = 1;
        } else if (act == TA_CONT) {
            if (tr_running() && tr.lvl == l + 1u)
                menu_close();
            else
                tr_start(l, 0);
        } else if (act == TA_SKIP || act == TA_BACK) {
            tr_go(act == TA_SKIP ? 1 : -1);
            menu_close();
        } else if (act == TA_QUIT) {
            tr_quit();
            menu_close();
        } else
            tr_start(l, 1);
    }
    enc_drop();
}
UI_SMALL static void tr_why_draw(void)             /* the step's topic: a page of its text, as tools/trainer/lessons.py
                                                      * wrapped it (10 lines at most) */
{
    const tr_card_t *c = tr_card();
    uint32_t t = c->why % TR_NWHY, n = TR_WHY[t].n, pg = (tr.wp - 1u) % n, pass, sig;
    const char *x = TR_WHY_PG[TR_WHY[t].first + pg];
    uint16_t acc = UI_COL[(tr.lvl - 1u) & 3u];
    char b[32];
    sig = 0x5A17u + t * 131u + pg * 7u;
    if (!ui.force && sig == tr.psig)
        return;
    tr.psig = sig;
    for (pass = 0; pass < 2u; pass++) {             /* (the canvas holds 124 rows: two bands) */
        const char *l = x;
        int32_t y = 48;
        cv_begin(240, pass ? 116u : 124u, C_BLACK);
        cv_oy = pass ? -124 : 0;
        str_cpy(b, "WHY: STEP ", sizeof b);
        fmt_int(b + str_len(b), tr.card + 1);
        cv_text(4, 2, &FONT_S, b, C_HI);
        fmt_int(b, (int32_t)pg + 1);
        str_cpy(b + str_len(b), "/", 2);
        fmt_int(b + str_len(b), (int32_t)n);
        ui_text_r(2, b, C_GRAY);
        cv_rect(0, 20, 240, 1, C_LINE);
        cv_text(4, 26, &FONT_S, TR_WHY[t].title, acc);
        while (*l) {                                /* the lines, '\n' between */
            uint32_t k = 0;
            while (l[k] && l[k] != '\n' && k < sizeof b - 1u)
                b[k] = l[k], k++;
            b[k] = 0;
            cv_text(4, y, &FONT_S, b, C_WHITE);
            y += 17;
            l += k;
            if (*l == '\n')
                l++;
        }
        cv_text(4, 226, &FONT_S, pg + 1u < n ? "SELECT: MORE   OCT-: CLOSE" : "SELECT: LEVELS   OCT-: CLOSE", C_DIM);
        cv_oy = 0;
        cv_blit(0, pass * 124u);
    }
}
UI_SMALL static void tr_pick_draw(void)
{
    if (tr.wp && tr_card()) {
        tr_why_draw();
        return;
    }
    uint8_t a[8];
    uint32_t page = tr.page, n = tr_actions(page, a), pass, i, first, sig;
    const tr_level_t *L = page < TR_NLEVELS ? tr_level(page) : 0;
    uint16_t acc = page < TR_NLEVELS ? UI_COL[page & 3u] : C_GRAY;
    char b[32];
    sig = page * 131u + tr.sel * 7u + tr.done * 977u + (L ? tr.at[page] : 0u) * 31u + tr.lvl * 7919u + (uint32_t)tr_running();
    if (!ui.force && sig == tr.psig)
        return;
    tr.psig = sig;
    first = tr.sel > 2u ? tr.sel - 2u : 0u;
    for (pass = 0; pass < 2u; pass++) {             /* (the canvas holds 124 rows: two bands) */
        cv_begin(240, pass ? 116u : 124u, C_BLACK);
        cv_oy = pass ? -124 : 0;
        cv_text(4, 2, &FONT_S, "BOOPBOX TRAINER", C_HI);
        fmt_int(b, (int32_t)page + 1);
        str_cpy(b + str_len(b), "/", 2);
        fmt_int(b + str_len(b), TR_NLEVELS + 1);
        ui_text_r(2, b, C_GRAY);
        cv_rect(0, 20, 240, 1, C_LINE);
        if (L) {
            str_cpy(b, "LEVEL ", sizeof b);
            fmt_int(b + 6, (int32_t)page + 1);
            cv_text(4, 26, &FONT_S, b, acc);
            cv_text(4, 44, &FONT_L, L->name, C_WHITE);
            cv_text(4, 82, &FONT_S, L->style, C_AMB);
            cv_text(4, 102, &FONT_S, L->learn1, C_GRAY);
            cv_text(4, 118, &FONT_S, L->learn2, C_GRAY);
            cv_rect(4, 140, 232, 6, C_LINE);
            if ((tr.done >> page) & 1u) {
                cv_rect(4, 140, 232, 6, acc);
                str_cpy(b, "DONE", sizeof b);
            } else if (tr.at[page] || (tr.lvl == page + 1u)) {
                cv_rect(4, 140, (int32_t)(232u * tr.at[page] / L->n), 6, acc);
                str_cpy(b, "STEP ", sizeof b);
                fmt_int(b + 5, tr.at[page] + 1);
                str_cpy(b + str_len(b), " OF ", sizeof b - str_len(b));
                fmt_int(b + str_len(b), L->n);
            } else
                str_cpy(b, "NOT STARTED", sizeof b);
            cv_text(4, 150, &FONT_S, b, C_HI);
        } else {
            cv_text(4, 26, &FONT_S, "MORE", acc);
            cv_text(4, 44, &FONT_L, "SETTINGS", C_WHITE);
            cv_text(4, 82, &FONT_S, "SCREEN, LIGHTS, AUDIO, MIDI,", C_GRAY);
            cv_text(4, 98, &FONT_S, "CALIBRATION, ABOUT", C_GRAY);
        }
        for (i = first; i < n && i < first + 3u; i++) {   /* the actions: the one picked on a bar, OCT+ beside it */
            int32_t y = 172 + (int32_t)(i - first) * 18;
            int cur = i == tr.sel;
            if (cur)
                cv_rect(0, y - 1, 240, 17, C_LINE);
            cv_text(4, y, &FONT_S, cur ? "OCT+" : "", C_HI);
            cv_text(46, y, &FONT_S, TA_NAME[a[i]], cur ? C_WHITE : C_GRAY);
        }
        cv_text(4, 226, &FONT_S, n > 1u ? "SELECT: PAGE  KNOB 1: ACTION" : "SELECT: PAGE   OCT-: CLOSE", C_DIM);
        cv_oy = 0;
        cv_blit(0, pass * 124u);
    }
}

/* power-on: the progress log; the first start opens the picker */
UI_SMALL static void trainer_boot(void)
{
    tr_log_boot();
    if (tr.lvl)
        tr_resume();
    if (tr.seen)
        return;
    tr.seen = 1;
    tr.dirty = 1;
    tr_pick_open();
}
