/* SPDX-License-Identifier: GPL-3.0-only */
/* The TRAINER (FELUCCA_TRAINER builds only): three levels that teach three songs on the FM-1 itself. A level is a list
 * of cards (build/gen/trainer_lessons.h, made by tools/trainer/lessons.py from the approved songs); a card is a goal on
 * the state of the FM-1 (a track selected, a kit, a sound, a parameter, a pattern's notes or hits, the mutes, a lock, the
 * patterns playing, a section saved, the song...). Every screen, button, knob and key works as in BoopBox: the coach only
 * watches. It owns the header line (lcd_clip_y: no page draws there while a level runs), where it says what the card is
 * about, what to do, and what is still wrong ("STEP 8: KICK MISSING"); it lights the button to press and the keys to play
 * or the step keys to press. When the goal holds, the card says NICE and the next one comes. HOME held: the menu's
 * TRAINER section (the levels; in a level: SKIP STEP, STEP BACK, RESTART, QUIT). Progress is kept with the settings (the
 * side record, ui.c): a level goes on where it was left, a finished one shows DONE and can be done again. A level
 * starts from a new project: the loop there (and, by level 3, the sections) are replaced without asking. */
enum {
    TG_TRACK, TG_KIT, TG_SOUND, TG_PARAM, TG_GLOBAL, TG_PLAY, TG_PAGE, TG_OCT, TG_NOTES, TG_LANES, TG_MUTES,
    TG_LOCK, TG_PATSEL, TG_PATS, TG_PATHAS, TG_SAVED, TG_SONG, TG_SONGMODE, TG_DONE
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
} tr_card_t;
typedef struct {
    const char *name;
    const tr_card_t *cards;
    uint8_t n;
} tr_level_t;
#include "trainer_lessons.h"

#define TR_OK_MS 700u                              /* NICE shows this long, then the next card */
#define TR_HEAD_MS 2200u                           /* a new card: its number and headline this long, then the action */
#define TR_ALT_MS 1800u                            /* the action and the hint take turns */
static struct {
    uint8_t lvl;                                   /* the level running + 1, 0 = none */
    uint8_t card;                                  /* its card */
    uint8_t at[TR_NLEVELS];                        /* each level's card (kept) */
    uint8_t done;                                  /* the levels finished, a bit each (kept) */
    uint8_t seen;                                  /* the welcome was shown (kept) */
    uint8_t ok;                                    /* the goal held: NICE until ok_ms + TR_OK_MS */
    uint8_t pend;                                  /* a level to begin once the transport has stopped: 1 + the level */
    uint8_t dirty;                                 /* to be saved with the settings */
    uint32_t ok_ms, t0, saved_ms;
    uint32_t base;                                 /* TG_SAVED: the section's sum when the card came */
    uint32_t sig;                                  /* the band as last drawn */
    uint32_t keys;                                 /* the keys lit (hint) */
    char hint[32];
} tr;

UI_SMALL static const tr_card_t *tr_card(void)
{
    const tr_level_t *L;
    if (!tr.lvl)
        return 0;
    L = &TR_LEVELS[tr.lvl - 1u];
    return tr.card < L->n ? &L->cards[tr.card] : &L->cards[L->n - 1u];
}
UI_SMALL static int tr_on(void) { return tr.lvl != 0; }
UI_SMALL static int tr_running(void)                    /* a level on a card to do (not its DONE): the menu's controls */
{
    const tr_card_t *c = tr_card();
    return c && c->goal != TG_DONE;
}

/* ---------------------------------------------------------------- the goals --- */
UI_SMALL static void tr_say(const char *a, const char *b)
{
    str_cpy(tr.hint, a, sizeof tr.hint);
    str_cpy(tr.hint + str_len(tr.hint), b, sizeof tr.hint - str_len(tr.hint));
}
UI_SMALL static void tr_say_step(uint32_t i, const char *what)   /* "STEP 8: KICK MISSING" */
{
    char b[8];
    str_cpy(tr.hint, "STEP ", sizeof tr.hint);
    fmt_int(b, (int32_t)i + 1);
    str_cpy(tr.hint + str_len(tr.hint), b, sizeof tr.hint - str_len(tr.hint));
    str_cpy(tr.hint + str_len(tr.hint), ": ", sizeof tr.hint - str_len(tr.hint));
    str_cpy(tr.hint + str_len(tr.hint), what, sizeof tr.hint - str_len(tr.hint));
}
UI_SMALL static void tr_say_now(const param_desc_t *d, int32_t v)   /* "NOW 90 BPM" */
{
    char val[12];
    const char *unit = "";
    param_format(d, v, val, &unit);
    str_cpy(tr.hint, "NOW ", sizeof tr.hint);
    str_cpy(tr.hint + 4, val, sizeof tr.hint - 4u);
    if (unit[0]) {
        str_cpy(tr.hint + str_len(tr.hint), " ", sizeof tr.hint - str_len(tr.hint));
        str_cpy(tr.hint + str_len(tr.hint), unit, sizeof tr.hint - str_len(tr.hint));
    }
}
UI_SMALL static int tr_near(int32_t a, int32_t b, uint32_t tol) { return a - b <= (int32_t)tol && b - a <= (int32_t)tol; }

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
/* a step's notes as one name ("D4", "D4 CHORD") */
UI_SMALL static void tr_note_text(char *b, const uint8_t *c, uint32_t n)
{
    note_name(b, c[0]);
    if (n > 1u)
        str_cpy(b + str_len(b), " CHORD", 8);
}

/* TG_NOTES: the synth pattern of t against its target (TR_DATA: LEN, then per step 0 empty, 2 TIE, or 1 | flags << 2,
 * n, the notes). 1: as wanted; 0: tr.hint says the first thing off, tr.keys the keys to press */
UI_SMALL static int tr_notes(const tr_card_t *c, track_t *t)
{
    const uint8_t *d = &TR_DATA[c->data];
    uint32_t len = *d++, i, j;
    if ((uint32_t)t->p[P_SLEN] != len) {
        char b[6];
        fmt_int(b, (int32_t)len);
        tr_say("TIMING: LEN TO ", b);
        return 0;
    }
    for (i = 0; i < len; i++) {
        uint32_t kind = *d & 3u, fl = *d >> 2, n = 0, have, an;
        const uint8_t *note = 0;
        const step_t *s = &t->step[i];
        d++;
        if (kind == 1u) {
            n = *d++;
            note = d;
            d += n;
        }
        have = s->time == ST_TIE ? 2u : s->time == ST_NOTE && s->n ? 1u : 0u;
        an = have == 1u ? s->n : 0u;
        if (kind == 0u && have == 0u)
            continue;
        if (kind == 2u && have == 2u)
            continue;
        if (kind == 1u && have == 1u) {
            uint32_t pa = 0, pw = 0, same = an == n;
            for (j = 0; j < n; j++)
                pw |= 1u << (note[j] % 12u);
            for (j = 0; j < an && j < 4u; j++)
                pa |= 1u << (s->note[j] % 12u);
            if (same && n == 1u)
                same = s->note[0] == note[0];
            if (same && pa == pw && n > 1u)
                same = 1;
            else if (n > 1u)
                same = 0;
            if (same && (s->flags & SF_ACCENT) == (fl & 1u) && ((s->flags & SF_SLIDE) != 0) == ((fl & 2u) != 0))
                continue;
            if (same) {
                tr_say_step(i, (fl & 1u) != (s->flags & SF_ACCENT) ? ((fl & 1u) ? "KNOB 4 TO ACC" : "NO ACCENT")
                                                                  : ((fl & 2u) ? "SLIDE ON" : "NO SLIDE"));
                tr.keys = 0;
                return 0;
            }
            if (pa == pw && n == 1u) {                     /* the right note, another octave */
                tr_say_step(i, s->note[0] > note[0] ? "AN OCTAVE LOWER" : "AN OCTAVE HIGHER");
                tr.keys = 0;
                return 0;
            }
        }
        if (kind == 0u) {
            tr_say_step(i, have == 2u ? "SHORTER (KNOB 3)" : "SHOULD BE EMPTY");
            tr.keys = 0;
            if (c->flags == HOW_SEQ && ui.layer == LY_STEP && i / 16u == ui.step_page)
                tr.keys = 1u << key_of_white(i % 16u);
            return 0;
        }
        if (kind == 2u) {
            tr_say_step(i, "LONGER NOTE BEFORE");
            tr.keys = 0;
            return 0;
        }
        {   /* a note (or chord) wanted here: what to play, where */
            int32_t oct;
            char nb[16];
            uint32_t keys = tr_keys_for(t, note, n, &oct);
            tr_note_text(nb, note, n);
            if (oct) {
                tr_say_step(i, oct > 0 ? "PRESS OCT+" : "PRESS OCT-");
                tr.keys = 0;
                return 0;
            }
            if (c->flags == HOW_SEQ) {
                int pen = pen_n == n || (n == 1u && !pen_n);
                for (j = 0; j < n && pen; j++)
                    pen = (pen_n ? pen_note[j] : last_note) % 12u == note[j] % 12u;
                if (ui.layer == LY_STEP) {
                    if (!pen) {
                        tr_say_step(i, "LET GO OF SEQ, PLAY");
                        tr.keys = 0;
                    } else if (i / 16u != ui.step_page) {
                        tr_say_step(i, "SEQ + OCT+: NEXT 16");
                        tr.keys = 0;
                    } else {
                        tr_say_step(i, have ? "PRESS IT TWICE" : "PRESS THE LIT KEY");
                        tr.keys = 1u << key_of_white(i % 16u);
                    }
                } else if (pen) {
                    tr_say_step(i, "HOLD SEQ + LIT STEP");
                    tr.keys = 0;
                } else {
                    tr_say_step(i, nb);
                    tr.keys = keys;
                }
                return 0;
            }
            if (on_notes_page() && ui.cursor != i)
                tr_say_step(i, "KNOB 1 TO IT");
            else
                tr_say_step(i, nb);
            tr.keys = keys;
            return 0;
        }
    }
    return 1;
}

/* TG_LANES: a drum pattern against its target (TR_DATA: LEN, the lanes listed, then per lane its number and a byte a
 * step: 0x10 a hit | level | ratchet << 2); the lanes not listed must be empty */
UI_SMALL static int tr_lanes(const tr_card_t *c, track_t *t)
{
    const uint8_t *d = &TR_DATA[c->data];
    uint32_t len = d[0], nl = d[1], i, l, listed = 0;
    if ((uint32_t)t->p[P_SLEN] != len) {
        char b[6];
        fmt_int(b, (int32_t)len);
        tr_say("HOLD SEQ, KNOB 4 LEN ", b);
        return 0;
    }
    tr.keys = 0;
    for (l = 0; l < nl; l++) {
        const uint8_t *h = &d[2u + l * (len + 1u)];
        uint32_t lane = h[0];
        listed |= 1u << lane;
        for (i = 0; i < len; i++) {
            uint32_t w = h[1u + i], on = dstep_has(&t->dstep[i], lane);
            const char *what = 0;
            if ((w & 0x10u) && !on)
                what = "MISSING";
            else if (!(w & 0x10u) && on)
                what = "NOT HERE";
            else if (on && dstep_lvl(&t->dstep[i], lane) != (w & 3u))
                what = (w & 3u) == LV_GHOST ? "GHOST (KNOB 4)" : (w & 3u) == LV_HARD ? "HARD (KNOB 4)" :
                       (w & 3u) == LV_SOFT ? "SOFT (KNOB 4)" : "NORM (KNOB 4)";
            else if (on && dstep_rat(&t->dstep[i], lane) != ((w >> 2) & 3u)) {
                static const char *const R[4] = {"NO RATCHET", "RATCHET X2", "RATCHET X3", "RATCHET X4"};
                what = R[(w >> 2) & 3u];
            }
            if (what) {
                char b[24];
                str_cpy(b, LANE_NAME[lane], sizeof b);
                str_cpy(b + str_len(b), " ", sizeof b - str_len(b));
                str_cpy(b + str_len(b), what, sizeof b - str_len(b));
                tr_say_step(i, b);
                if (pen_lane == lane && i / 16u == drum_cursor / 16u && (grid_keys_on() || ui.layer == LY_STEP))
                    tr.keys = 1u << key_of_white(i % 16u);
                else if (pen_lane != lane)
                    tr.keys = 1u << drum_black_key(lane);   /* the black key that picks the sound */
                return 0;
            }
        }
    }
    for (i = 0; i < len; i++) {
        uint32_t extra = dstep_mask(&t->dstep[i]) & ~listed;
        if (extra) {
            for (l = 0; !((extra >> l) & 1u); l++)
                ;
            {
                char b[24];
                str_cpy(b, "NO ", sizeof b);
                str_cpy(b + 3, LANE_NAME[l], sizeof b - 3u);
                tr_say_step(i, b);
            }
            return 0;
        }
    }
    return 1;
}

UI_SMALL static int tr_goal(const tr_card_t *c)
{
    track_t *t = &trk[c->trk % NTRK];
    tr.hint[0] = 0;
    tr.keys = 0;
    switch (c->goal) {
    case TG_TRACK:
        if (song.sel == c->trk)
            return 1;
        {
            char b[4];
            fmt_int(b, song.sel + 1);
            tr_say("NOW TRACK ", b);
        }
        return 0;
    case TG_KIT:
        if (song.sel != c->trk && !(is_drum(t) && t->p[P_E0] == c->v))
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        if (is_drum(t) && t->p[P_E0] == c->v)
            return 1;
        tr_say("NOW ", is_drum(t) ? DRUM_KIT_NAMES[(uint32_t)t->p[P_E0] % DRUM_KITS] : "A SYNTH");
        return 0;
    case TG_SOUND:
        if (!is_drum(t) && t->eng_req == c->p && t->preset == (uint8_t)c->v && user_of(t) >= UP_SLOTS)
            return 1;
        if (song.sel != c->trk)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        tr_say("NOW ", is_drum(t) ? "DRUMS" : ENGINES[t->eng_req % NENGINES]->presets[t->preset %
                ENGINES[t->eng_req % NENGINES]->npresets].name);
        return 0;
    case TG_PARAM:
        if (tr_near(t->p[c->p], c->v, c->tol))
            return 1;
        if (song.sel != c->trk && c->p != P_MUTE)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        tr_say_now(track_desc(t, c->p), t->p[c->p]);
        return 0;
    case TG_GLOBAL:
        if (tr_near(song.g[c->p], c->v, c->tol))
            return 1;
        tr_say_now(&GP[c->p], song.g[c->p]);
        return 0;
    case TG_PLAY:
        return (song.playing != 0) == (c->v != 0);
    case TG_PAGE:
        return c->p == PG_DRUMS ? on_drum_page() && !drum_page && !ui.menu :
               c->p == PG_PATTERNS ? on_pats_page() && !ui.menu : on_song_page() && !ui.menu;
    case TG_OCT:
        if (song.octave == c->v)
            return 1;
        {
            char b[6];
            fmt_int(b, song.octave);
            tr_say("NOW OCTAVE ", b);
        }
        return 0;
    case TG_NOTES:
        if (song.sel != c->trk)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        return tr_notes(c, t);
    case TG_LANES:
        if (song.sel != c->trk)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        return tr_lanes(c, t);
    case TG_MUTES: {
        uint32_t k;
        for (k = 0; k < NTRK; k++)
            if (((c->p >> k) & 1u) && (trk[k].p[P_MUTE] != 0) != (((uint32_t)c->v >> k) & 1u)) {
                char b[16];
                str_cpy(b, "TRACK ", sizeof b);
                fmt_int(b + 6, (int32_t)k + 1);
                tr_say(b, trk[k].p[P_MUTE] ? ": UNMUTE" : ": MUTE");
                return 0;
            }
        return 1;
    }
    case TG_LOCK: {
        uint32_t k, step = TR_DATA[c->data];
        for (k = 0; k < NLOCK; k++)
            if (t->lock[k].step == step && (t->lock[k].param & LOCK_PID) == c->p) {
                if (!tr_near(t->lock[k].val, c->v, c->tol)) {
                    tr_say_now(lock_desc(t, c->p), t->lock[k].val);
                    return 0;
                }
                if ((c->flags & 1u) && !(t->lock[k].param & LOCK_SLIDE)) {
                    tr_say("THE LOCK: SLIDE ON", "");
                    return 0;
                }
                return 1;
            }
        if (song.sel != c->trk)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        tr_say_step(step, "NO LOCK YET");
        return 0;
    }
    case TG_PATSEL:
        if (t->pat == c->v && (!(c->flags & 1u) || !pat_empty(t)))
            return 1;
        if (t->pat == c->v)
            tr_say("EMPTY: COPY INTO IT FIRST", "");
        else if (song.sel != c->trk)
            return tr_goal(&(tr_card_t){0, 0, TG_TRACK, c->trk, 0, NB, 0, 0, 0, 0}), 0;
        else {
            char b[4];
            fmt_int(b, t->pat + 1);
            tr_say("NOW PATTERN ", b);
        }
        return 0;
    case TG_PATS: {
        uint32_t k;
        for (k = 0; k < NTRK; k++) {
            uint32_t w = TR_DATA[c->data + k];
            if (w != 255u && trk[k].pat != w) {
                char b[24];
                str_cpy(b, "TRACK ", sizeof b);
                fmt_int(b + 6, (int32_t)k + 1);
                str_cpy(b + str_len(b), ": PATTERN ", sizeof b - str_len(b));
                fmt_int(b + str_len(b), (int32_t)w + 1);
                tr_say(b, "");
                return 0;
            }
        }
        return 1;
    }
    case TG_PATHAS: {
        uint32_t k;
        for (k = 0; k < NTRK; k++)
            if ((((uint32_t)c->v >> k) & 1u) && pb_find(k, c->p) < 0 && !(trk[k].pat == c->p && !pat_empty(&trk[k]))) {
                char b[24];
                str_cpy(b, "TRACK ", sizeof b);
                fmt_int(b + 6, (int32_t)k + 1);
                tr_say(b, ": NOT COPIED YET");
                return 0;
            }
        return 1;
    }
    case TG_SAVED:
        return proj_ok(&proj_slot[c->v & 3]) && proj_slot[c->v & 3].sum != tr.base;
    case TG_SONG: {
        const uint8_t *d = &TR_DATA[c->data];
        uint32_t k;
        if (arrangement.count != d[0]) {
            char b[6];
            fmt_int(b, d[0]);
            tr_say("KNOB 4: STEPS TO ", b);
            return 0;
        }
        if (c->flags & 1u)
            return 1;
        for (k = 0; k < d[0]; k++)
            if (arrangement.entry[k].scene != d[1u + 2u * k] || arrangement.entry[k].bars != d[2u + 2u * k]) {
                char b[24];
                str_cpy(b, "STEP ", sizeof b);
                fmt_int(b + 5, (int32_t)k + 1);
                str_cpy(b + str_len(b), ": ", sizeof b - str_len(b));
                str_cpy(b + str_len(b), SEC_NAME[d[1u + 2u * k] & 3u], sizeof b - str_len(b));
                str_cpy(b + str_len(b), ", ", sizeof b - str_len(b));
                fmt_int(b + str_len(b), d[2u + 2u * k]);
                tr_say(b, " BARS");
                return 0;
            }
        return 1;
    }
    case TG_SONGMODE:
        return arrangement_enabled && song.playing;
    default:
        return 0;
    }
}

/* ------------------------------------------------------------- the levels --- */
UI_SMALL static void tr_card_begin(void)
{
    const tr_card_t *c = tr_card();
    tr.ok = 0;
    tr.t0 = fm1_ms;
    tr.sig = 0;
    if (c && c->goal == TG_SAVED)
        tr.base = proj_ok(&proj_slot[c->v & 3]) ? proj_slot[c->v & 3].sum : 0u;
    if (c && c->goal == TG_DONE)
        tr.done |= (uint8_t)(1u << (tr.lvl - 1u));
    tr.at[tr.lvl - 1u] = tr.card;
    tr.dirty = 1;
}
UI_SMALL static void tr_go(int32_t d)                    /* the next / the card before */
{
    const tr_level_t *L = &TR_LEVELS[tr.lvl - 1u];
    int32_t n = (int32_t)tr.card + d;
    tr.card = (uint8_t)clamp(n, 0, L->n - 1);
    tr_card_begin();
}
/* level l from its first card: a new project, in loop mode (when stopped: stopping a song puts the loop it kept back) */
UI_SMALL static void tr_begin(uint32_t l)
{
    arrangement_enabled = 0;
    project_new();
    tr.at[l] = 0;
    tr.done &= (uint8_t)~(1u << l);
    tr.lvl = (uint8_t)(l + 1u);
    tr.card = 0;
    tr_card_begin();
}
/* level l (0..): its card where it was left; again: from the start (a new project) */
UI_SMALL static void tr_start(uint32_t l, int again)
{
    if (again || !tr.at[l] || tr.at[l] >= TR_LEVELS[l].n - 1u) {
        menu_close();
        if (song.playing || transport_req) {           /* stopped first, then the new project (trainer_tick) */
            transport_req = 2;
            tr.pend = (uint8_t)(l + 1u);
            return;
        }
        tr_begin(l);
        return;
    }
    tr.lvl = (uint8_t)(l + 1u);
    tr.card = tr.at[l];
    tr_card_begin();
    menu_close();
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
 * REC, the visualiser) have a 40-row title in large type: there two lines (the headline or the hint, then the action);
 * the pages and the browser a 20-row header: one line, in turn */
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
    if (tr.dirty && !song.playing && !transport_req && !ui.menu && fm1_ms - tr.saved_ms > 8000u) {
        tr.dirty = 0;                                   /* (a flash write stops the audio ~50 ms: stopped only, and at */
        tr.saved_ms = fm1_ms;                           /* most every 8 s; a power-off loses a few steps at most) */
        settings_save();
    }
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
        tr.sig = 0;                                     /* (the menu drew over the line: again after it) */
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
    }
}

/* the band: the card's number and headline (then the hint, in turn), the action; a UI message; NICE; a progress bar */
UI_SMALL static void trainer_draw(void)
{
    const tr_card_t *c = tr_card();
    const tr_level_t *L;
    uint32_t el, sig, phase, h = lcd_clip_y, two = h > H_HEAD;
    char b[40];
    uint16_t col;
    if (!c || ui.menu || !h)
        return;
    L = &TR_LEVELS[tr.lvl - 1u];
    el = fm1_ms - tr.t0;
    /* line 1 (or the line): 0 number + headline, 1 the action (one line only), 2 the hint, 3 NICE, 4 a UI message */
    if (two)
        phase = el < TR_HEAD_MS || !tr.hint[0] ? 0u : ((el - TR_HEAD_MS) / TR_ALT_MS) & 1u ? 0u : 2u;
    else
        phase = el < TR_HEAD_MS ? 0u : !tr.hint[0] ? 1u : ((el - TR_HEAD_MS) / TR_ALT_MS) & 1u ? 2u : 1u;
    if (c->goal == TG_DONE)
        phase = two || el < TR_HEAD_MS ? 0u : 1u;
    if (tr.ok)
        phase = 3u;
    if (ui.msg_t && !tr.ok)
        phase = 4u;                                     /* a message of the UI (on a page its place is this line) */
    sig = str_hash(phase * 7919u + tr.card * 131u + tr.lvl * 31u + h, phase == 2u ? tr.hint : phase == 4u ? ui.msg : "");
    if (sig == tr.sig)
        return;
    tr.sig = sig;
    if (phase == 0u) {                              /* "4/31 THE KICK DRUM" */
        fmt_int(b, tr.card + 1);
        str_cpy(b + str_len(b), "/", 2);
        fmt_int(b + str_len(b), L->n);
        str_cpy(b + str_len(b), " ", 2);
        str_cpy(b + str_len(b), c->head, sizeof b - str_len(b));
        col = C_WHITE;
    } else if (phase == 1u) {
        str_cpy(b, c->act, sizeof b);
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
    lcd_clip_y = 0;
    cv_begin(240, h, C_BLACK);
    cv_text(2, 1, &FONT_S, b, col);
    if (two)
        cv_text(2, 19, &FONT_S, c->act, tr.ok ? C_DIM : C_HI);
    cv_rect(0, (int32_t)h - 2, 240, 2, C_LINE);
    cv_rect(0, (int32_t)h - 2, (int32_t)(240u * (tr.card + (tr.ok ? 1u : 0u)) / L->n), 2, UI_COL[(tr.lvl + 1u) & 7u]);
    cv_blit(0, 0);
    lcd_clip_y = (uint8_t)h;
}

/* the lights: the card's button blinks, the keys of the hint are lit */
UI_SMALL static void trainer_leds(uint8_t *nl)
{
    const tr_card_t *c = tr_card();
    uint32_t k, blink = (fm1_ms / 250u) & 1u;
    if (!c || ui.menu || tr.ok)
        return;
    if (c->btn < NB && blink)
        led_put(nl, panel.btn[c->btn], 1);
    for (k = 0; k < 27u; k++)
        if ((tr.keys >> k) & 1u)
            led_put(nl, 14u + k, 1);
}

/* the sound browser (ui_draw.c graph_browse): the sound or kit the step asks for, to mark it */
UI_SMALL static int tr_browse_target(uint32_t *kit, uint32_t *e, uint32_t *k)
{
    const tr_card_t *c = tr_card();
    if (!c || tr.ok || (c->goal != TG_SOUND && c->goal != TG_KIT) || song.sel != c->trk)
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

/* ------------------------------------------------------------- the menu --- */
/* the TRAINER section's four rows: the levels (none running), or the level's controls */
UI_SMALL static const char *tr_row_name(uint32_t r)
{
    static const char *const RUN[4] = {"SKIP THIS STEP", "STEP BACK", "RESTART THIS LEVEL", "QUIT THE LEVEL"};
    static char b[24];
    if (tr_running())
        return RUN[r & 3u];
    if (r >= TR_NLEVELS)
        return "HOW IT WORKS";
    str_cpy(b, "LEVEL ", sizeof b);
    fmt_int(b + 6, (int32_t)r + 1);
    str_cpy(b + 7, ": ", sizeof b - 7u);
    str_cpy(b + 9, TR_LEVELS[r].name, sizeof b - 9u);
    return b;
}
UI_SMALL static const char *tr_row_value(uint32_t r, uint16_t *c)
{
    static char b[16];
    *c = C_HI;
    if (tr_running()) {
        *c = C_DIM;
        return "";
    }
    if (r >= TR_NLEVELS) {
        *c = C_DIM;
        return "FOLLOW THE TOP LINE";
    }
    if ((tr.done >> r) & 1u)
        return "DONE: OCT+ AGAIN";
    if (!tr.at[r])
        return "NEW: OCT+";
    str_cpy(b, "STEP ", sizeof b);
    fmt_int(b + 5, tr.at[r] + 1);
    str_cpy(b + str_len(b), "/", 2);
    fmt_int(b + str_len(b), TR_LEVELS[r].n);
    return b;
}
UI_SMALL static void tr_row_do(uint32_t r)              /* OCT+ on row r */
{
    if (!tr_running()) {
        if (r < TR_NLEVELS)
            tr_start(r, ((tr.done >> r) & 1u) != 0u);
        return;
    }
    switch (r) {
    case 0: tr_go(1); menu_close(); break;
    case 1: tr_go(-1); menu_close(); break;
    case 2: tr_start(tr.lvl - 1u, 1); break;
    default: tr_quit(); break;
    }
}

/* ------------------------------------------------------------- kept --- */
#define TR_MAGIC 0x31525254u                          /* "TRR1" */
typedef struct {
    uint32_t magic;
    uint8_t at[TR_NLEVELS], done, seen, lvl, rsv[9 - TR_NLEVELS];
    uint32_t crc;
} tr_rec_t;
_Static_assert(sizeof(tr_rec_t) == 20u, "the TRAINER's record: ui.c side_rec_t trn[]");
UI_SMALL static void tr_fill(tr_rec_t *r)
{
    memset(r, 0, sizeof *r);
    r->magic = TR_MAGIC;
    memcpy(r->at, tr.at, sizeof tr.at);
    r->done = tr.done, r->seen = tr.seen, r->lvl = tr.lvl;
    r->crc = st_crc32(r, sizeof *r - 4u);
}
UI_SMALL static void tr_take(const tr_rec_t *r)
{
    uint32_t k;
    if (r->magic != TR_MAGIC || r->crc != st_crc32(r, sizeof *r - 4u))
        return;
    for (k = 0; k < TR_NLEVELS; k++)
        tr.at[k] = (uint8_t)(r->at[k] < TR_LEVELS[k].n ? r->at[k] : 0u);
    tr.done = r->done, tr.seen = r->seen;
    if (r->lvl && r->lvl <= TR_NLEVELS) {             /* a level was running: on where it was */
        tr.lvl = r->lvl;
        tr.card = tr.at[r->lvl - 1u];
        tr.t0 = fm1_ms;
        tr.sig = 0;
    }
}
UI_SMALL static void tr_fill_b(uint32_t *b) { tr_rec_t r; tr_fill(&r); memcpy(b, &r, sizeof r); }
UI_SMALL static void tr_take_b(const uint32_t *b) { tr_rec_t r; memcpy(&r, b, sizeof r); tr_take(&r); }

/* power-on: the first start opens the menu's TRAINER section (the levels) */
UI_SMALL static void trainer_boot(void)
{
    if (tr.seen)
        return;
    tr.seen = 1;
    tr.dirty = 1;
    ui.menu = 1;
    ui.menu_sel = MI_TR0;
    ui.force = 1;
}
