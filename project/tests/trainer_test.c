/* SPDX-License-Identifier: GPL-3.0-only */
/* The TRAINER, end to end: each level played from the menu to its last card by a "person" who only uses the panel
 * (buttons pressed and held, knobs turned a detent at a time, keys played), doing what each card's action says, on the
 * real UI and sequencer (tests/trainer_host.c). Checks that every card's goal can be reached that way and that the coach
 * moves on, that the level ends on DONE with the picker showing it, that a level can be done again, that progress is kept
 * (the log, written while playing too, back after a power cycle), that a card about keys lights only its keys, and that the song the lessons build is the approved one (tools/trainer/songs.py, as the lessons'
 * targets: the sections and the song play in song mode). Writes the coach's line on some cards for review (DIR/*.ppm).
 *   cc -O1 -w -Ibuild/trainer-fw/gen -Ifirmware/src -Ifirmware/hal -Itests tests/trainer_test.c -lm   (after
 *   tools/build.py --trainer, or HOST_ONLY: tools/trainer/lessons.py into build/trainer-fw/gen) */
#define TR_WANT_CHECK
#include "trainer_host.c"

static int fails;
static const char *outdir = "build/host";
static void check(int ok, const char *what)
{
    printf("trainer: %-84s %s\n", what, ok ? "ok" : "FAIL");
    fails += !ok;
}

/* ---------------------------------------------------------------- helpers: a person at the panel --- */
static void slow(uint32_t e, int32_t s) { turn(e, s); frames(4); }   /* (detents 80 ms apart: no knob acceleration) */
static void home(void) { tap(B_HOME); frames(2); if (vis_shown()) tap(B_HOME); }
static void song_page(void)                         /* (1.9.9) the SONG page: SEQ tapped until it shows (the last SEQ page) */
{
    uint32_t g;
    home();
    for (g = 0; g < 9u && !on_song_page(); g++)
        tap(B_SEQ);
}
static void algo_to(uint32_t k)
{
    uint32_t guard = 20;
    while (song.sel != k && guard--)
        slow(EN_ALGO, song.sel < k ? 1 : -1);
}
static int open_page(uint32_t btn, const char *title)
{
    uint32_t guard = 12;
    if (ui.layer != LY_PLAY)
        frames(2);
    while (guard-- && !(!ui.home && !strcmp(cur_page()->title, title)))
        tap(btn);
    return !ui.home && !strcmp(cur_page()->title, title);
}
/* a knob (role) turned a detent at a time until *v is w */
static void knob_to(uint32_t role, volatile int16_t *v, int32_t w)
{
    uint32_t guard = 300;
    while (*v != w && guard--)
        slow(role, *v < w ? 1 : -1);
}
static void hold_layer(uint32_t b) { down(b); frames(25); }
static void seq_save(void)                     /* (1.9.7) SCENES: SEQ, then SELECT (SEQ held + SAVE is gone) */
{
    uint32_t g;
    tap(B_SEQ);
    frames(2);
    for (g = 0; g < 8u && !(on_pats_page() && pats_view() == PV_SCENES); g++) {
        turn(EN_SELECT, 1);
        frames(4);
    }
}
static void let_go(uint32_t b) { up(b); frames(2); }
/* the keys (bit k) that play these notes now, as the coach lights them */
static uint32_t keys_for(const track_t *t, const uint8_t *c, uint32_t n)
{
    int32_t oct;
    uint32_t m = tr_keys_for(t, c, n, &oct);
    return m;
}
static void octave_for(const track_t *t, const uint8_t *c, uint32_t n)
{
    int32_t oct;
    uint32_t guard = 8;
    while (!tr_keys_for(t, c, n, &oct) && oct && guard--)
        tap(oct > 0 ? B_OCTUP : B_OCTDN);
}

/* ---------------------------------------------------------------- the card's action --- */
static void do_param(const tr_card_t *c)
{
    track_t *t = &trk[c->trk];
    uint32_t id = c->p;
    if (c->data) {                                       /* a card with its page: open it (its button), its knob */
        const page_t *pg = &PAGES[c->data - 1u];
        uint32_t k;
        if (c->goal == TG_PARAM)
            algo_to(c->trk);
        if (!(!ui.home && ui.page == c->data - 1u)) {
            home();
            open_page(c->btn, pg->title);
        }
        for (k = 0; k < 4u && pg->id[k] != id; k++)
            ;
        knob_to(EN_K1 + k, c->goal == TG_GLOBAL ? &song.g[id] : &t->p[id], c->v);
        return;
    }
    if (c->goal == TG_GLOBAL) {
        if (id == G_BPM) {
            home();
            knob_to(EN_SELECT, &song.g[G_BPM], c->v);
        } else if (id == G_DTIME || id == G_DFDBK) {
            open_page(B_FX, "DLY");
            knob_to(id == G_DTIME ? EN_K1 : EN_K2, &song.g[id], c->v);
        } else if (id == G_DUCK) {
            open_page(B_GLO, "MASTER");
            knob_to(EN_K2, &song.g[id], c->v);
        }
        return;
    }
    algo_to(c->trk);
    switch (id) {
    case P_SSWING: case P_SDIV: case P_SLEN:
        hold_layer(B_SEQ);
        knob_to(id == P_SSWING ? EN_K3 : id == P_SDIV ? EN_K2 : EN_K4, &t->p[id], c->v);
        let_go(B_SEQ);
        break;
    case P_SGATE:
        open_page(B_SEQ, "TIMING");
        knob_to(EN_K4, &t->p[id], c->v);
        break;
    case P_ROOT: {                                       /* SEL held, a key of that note */
        uint32_t k;
        hold_layer(B_SCL);
        for (k = 0; k < 27u; k++)
            if ((53u + k) % 12u == (uint32_t)c->v) break;
        key(k);
        let_go(B_SCL);
        break;
    }
    case P_SCALE: case P_CHORD:
        hold_layer(B_SCL);
        knob_to(id == P_SCALE ? EN_K2 : EN_K1, &t->p[id], c->v);
        if (id == P_SCALE && !strcmp(tr.hint, "TURN KNOB 2 ONE WAY, THEN BACK")) {   /* (another synth track's scale) */
            slow(EN_K2, 1);
            slow(EN_K2, -1);
        }
        let_go(B_SCL);
        break;
    case P_DLY: case P_REV:
        open_page(B_FX, "FX");
        knob_to(id == P_DLY ? EN_K3 : EN_K4, &t->p[id], c->v);
        break;
    case P_ATK: case P_REL:
        open_page(B_ENV, "ENV");
        knob_to(id == P_ATK ? EN_K1 : EN_K4, &t->p[id], c->v);
        break;
    case P_LEVEL: case P_PAN:
        home();
        knob_to(id == P_LEVEL ? EN_K2 : EN_K4, &t->p[id], c->v);
        break;
    default:
        printf("  (no route for parameter %u)\n", id);
    }
}
/* PRESETS: the browser, scanned a detent at a time (KNOB 2 the group, KNOB 3 the sound) until the goal holds */
static uint32_t hints_scrolled;
static uint32_t pats_from_drum, hint_tries, browse_seen, keyed_cards, seq_unlit, seq_taps, algo_said, algo_home;
static int on_target(const tr_card_t *c)
{
    const track_t *t = &trk[c->trk];
    return c->goal == TG_KIT ? is_drum(t) && t->p[P_E0] == c->v :
           !is_drum(t) && t->eng_req == c->p && t->preset == (uint8_t)c->v && user_of(t) >= UP_SLOTS;
}
static void browse_find(const tr_card_t *c)
{
    uint32_t g, s;
    home();
    algo_to(c->trk);
    home();
    slow(EN_PRESET, 1);                                  /* (the first click opens the browser) */
    for (g = 0; g < 4u && (tr_goal(c), tr_prefix(tr.hint, "KNOB 1 ")); g++)   /* (the other side: KNOB 1, as it says) */
        slow(EN_K1, tr_prefix(tr.hint, "KNOB 1 RIGHT") ? 1 : -1);
    for (g = 0; g < 30u && !on_target(c); g++) {
        slow(EN_K2, -1);
    }
    for (g = 0; g < 40u && !on_target(c); g++) {
        for (s = 0; s < 40u && !on_target(c); s++)
            slow(EN_K3, -1);
        for (s = 0; s < 40u && !on_target(c); s++)
            slow(EN_K3, 1);
        if (!on_target(c))
            slow(EN_K2, 1);
    }
    frames(10);
}
static void do_browse(const tr_card_t *c)
{
    static uint8_t seen_kind[2];
    browse_seen++;
    if (!seen_kind[c->goal == TG_SOUND]++) {             /* the first kit, the first sound: the browser stays; HOME puts
                                                         * the sound back */
        const track_t *t = &trk[c->trk];
        uint8_t kind, eng, pre;
        int16_t e0;
        home();
        algo_to(c->trk);
        kind = t->kind, eng = t->eng_req, pre = t->preset, e0 = t->p[P_E0];
        browse_find(c);
        frames(300);                                     /* (4.8 s untouched: before 1.4.2 it went back by itself) */
        check(on_target(c) && !tr.ok && tr_browsing() && !strcmp(tr.hint, "THAT'S IT! TAP SAVE TO KEEP IT"),
              "the sound browser stays open untouched; on the sound: not done yet (SAVE keeps it)");
        tap(B_HOME);
        frames(5);
        check(!tr_browsing() && t->kind == kind && t->p[P_E0] == e0 &&
              (kind == TK_DRUM || (t->eng_req == eng && t->preset == pre)) && !on_target(c),
              c->goal == TG_SOUND ? "HOME closes the browser and puts back the synth sound it opened on" :
              "HOME closes the browser and puts back the kit it opened on");
    }
    browse_find(c);
    tap(B_SAVE);                                         /* "THAT'S IT! TAP SAVE TO KEEP IT" */
    frames(5);
    if (seen_kind[c->goal == TG_SOUND] == 1u)
        check(!tr_browsing() && on_target(c), "SAVE closes the browser and keeps the sound");
}
/* a synth pattern, as the card says: the SEQ layer (play the note, hold SEQ, the step key) or the NOTES page */
static void do_notes(const tr_card_t *c)
{
    track_t *t = &trk[c->trk];
    const uint8_t *d = &TR_D[c->data];
    uint32_t len = *d++, i, j;
    uint8_t want[NSTEP][5], kind[NSTEP], fl[NSTEP];
    algo_to(c->trk);
    if (t->p[P_SLEN] != (int16_t)len) {
        hold_layer(B_SEQ);
        knob_to(EN_K4, &t->p[P_SLEN], (int32_t)len);
        let_go(B_SEQ);
    }
    for (i = 0; i < len; i++) {
        kind[i] = *d & 3u, fl[i] = *d >> 2;
        d++;
        want[i][4] = 0;
        if (kind[i] == 1u) {
            want[i][4] = *d++;
            for (j = 0; j < want[i][4]; j++)
                want[i][j] = *d++;
        }
    }
    if (c->flags == HOW_SEQ) {
        if (on_notes_page()) {                           /* (the coach: the HOME screen first, NOTES would type the note in) */
            check(!strcmp(tr.go, "GO TO THE HOME SCREEN") && !strcmp(tr.hint, "TAP HOME"),
                  "SEQ-layer notes from the NOTES page: the page card, TAP HOME");
            home();
        }
        for (i = 0; i < len; i++) {
            if (kind[i] != 1u || (t->step[i].time == ST_NOTE && t->step[i].n))
                continue;
            octave_for(t, want[i], want[i][4]);
            keys(keys_for(t, want[i], want[i][4]));
            hold_layer(B_SEQ);
            while (ui.step_page != i / 16u)
                tap(B_OCTUP);
            {   /* as a person does: every step of the page wanting this note, one tap at a time; the ones left stay lit */
                uint32_t j, m, left = 0;
                for (j = i; j < len && j / 16u == i / 16u; j++)
                    if (kind[j] == 1u && want[j][4] == want[i][4] && !memcmp(want[j], want[i], want[i][4]) &&
                        !(t->step[j].time == ST_NOTE && t->step[j].n))
                        left |= 1u << (j % 16u);
                for (j = 0; j < 16u; j++) {
                    if (!((left >> j) & 1u))
                        continue;
                    key(key_of_white(j));
                    frames(2);
                    left &= ~(1u << j);
                    for (m = 0; m < 16u; m++)
                        if (((left >> m) & 1u) && !((tr.keys >> key_of_white(m)) & 1u)) {
                            printf("trainer: card %s: step %u wants the same note, no longer lit\n", c->head,
                                   (i / 16u) * 16u + m + 1u);
                            seq_unlit++;
                        }
                    seq_taps++;
                }
            }
            let_go(B_SEQ);
        }
        return;
    }
    open_page(B_SEQ, "NOTES");
    for (i = 0; i < len; i++) {
        uint32_t L = 1;
        if (kind[i] != 1u)
            continue;
        while (i + L < len && kind[i + L] == 2u)
            L++;
        {   /* KNOB 1 to the step (it walks the notes, then the steps) */
            uint32_t guard = 200;
            while (ui.cursor != i && guard--)
                slow(EN_K1, ui.cursor < i ? 1 : -1);
        }
        if (!(t->step[i].time == ST_NOTE && t->step[i].n == want[i][4])) {
            octave_for(t, want[i], want[i][4]);
            keys(keys_for(t, want[i], want[i][4]));
            while (ui.cursor != i)
                slow(EN_K1, ui.cursor < i ? 1 : -1);
        }
        if (note_span(t, i) != L) {
            uint32_t guard = 80;
            while (note_span(t, i) != L && guard--)
                slow(EN_K3, note_span(t, i) < L ? 1 : -1);
        }
        if ((t->step[i].flags & SF_ACCENT) != (fl[i] & 1u)) {
            uint32_t guard = 8;
            while ((t->step[i].flags & SF_ACCENT) != (fl[i] & 1u) && guard--)
                slow(EN_K4, (fl[i] & 1u) ? 1 : -1);
        }
    }
}
/* drum lanes on the DRUMS grid: KNOB 1 the sound, the keys the steps, KNOB 2 the step, KNOB 4 its level, OCT+ held:
 * the sheet (RATCHET) */
static uint32_t grid_hints, grid_lost;
static int hint_num(const char *h, const char *after);
static void do_lanes(const tr_card_t *c)
{
    track_t *t = &trk[c->trk];
    const uint8_t *d = &TR_D[c->data];
    uint32_t len = d[0], nl = d[1], l, i, g;
    for (g = 0; g < 12u && !(on_drum_page() && !drum_page) && t->p[P_SLEN] == (int16_t)len; g++) {
        int n;                                           /* to the grid as the hints say, from where the step before left */
        frames(2);
        if (tr_goal(c))
            return;
        grid_hints++;
        if ((n = hint_num(tr.hint, "ALGORITHM TO TRACK ")) > 0 || (n = hint_num(tr.hint, "ALGORITHM TO ")) > 0) {
            if (tr_prefix(tr.hint, "TAP HOME"))
                tap(B_HOME);
            else
                slow(EN_ALGO, song.sel < (uint32_t)n - 1u ? 1 : -1);
        } else if (tr_prefix(tr.hint, "TAP HOME"))
            tap(B_HOME);
        else if (tr_prefix(tr.hint, "TAP SEQ"))
            tap(B_SEQ);
        else {
            printf("trainer: %s: off the grid, the hint says: \"%s\"\n", c->head, tr.hint);
            grid_lost++;
            break;
        }
    }
    home();
    algo_to(c->trk);
    if (t->p[P_SLEN] != (int16_t)len) {
        hold_layer(B_SEQ);
        knob_to(EN_K4, &t->p[P_SLEN], (int32_t)len);
        let_go(B_SEQ);
    }
    if (!(on_drum_page() && !drum_page)) {
        home();
        tap(B_SEQ);
        for (g = 0; g < 6u && !(on_drum_page() && !drum_page); g++)
            tap(B_SEQ);                                  /* (GRID KIT SOUND PATTERNS, round) */
    }
    for (l = 0; l < DRUM_LANES; l++) {                   /* (the sounds the step does not list: their hits out, as
                                                         * the hints say: a track just made a drum track has some) */
        uint32_t k, listed = 0, guard = 40;
        for (k = 0; k < nl; k++)
            listed |= d[2u + k * (len + 1u)] == l;
        for (i = 0; i < len && (listed || !dstep_has(&t->dstep[i], l)); i++)
            ;
        if (i == len)
            continue;
        while (pen_lane != l && guard--)
            slow(EN_K1, pen_lane < l ? 1 : -1);
        for (i = 0; i < len; i++)
            if (dstep_has(&t->dstep[i], l)) {
                while (drum_cursor / 16u != i / 16u)
                    tap(drum_cursor / 16u < i / 16u ? B_OCTUP : B_OCTDN);
                key(key_of_white(i % 16u));
            }
    }
    for (l = 0; l < nl; l++) {
        const uint8_t *h = &d[2u + l * (len + 1u)];
        uint32_t lane = h[0], guard = 40;
        while (pen_lane != lane && guard--)
            slow(EN_K1, pen_lane < lane ? 1 : -1);
        for (i = 0; i < len; i++) {
            uint32_t w = h[1u + i], on = dstep_has(&t->dstep[i], lane);
            if (((w & 0x10u) != 0) == (on != 0))
                continue;
            while (drum_cursor / 16u != i / 16u)
                tap(drum_cursor / 16u < i / 16u ? B_OCTUP : B_OCTDN);
            key(key_of_white(i % 16u));
        }
        for (i = 0; i < len; i++) {
            uint32_t w = h[1u + i], g2 = 60;
            if (!(w & 0x10u))
                continue;
            if (dstep_lvl(&t->dstep[i], lane) == (w & 3u) && dstep_rat(&t->dstep[i], lane) == ((w >> 2) & 3u))
                continue;
            while (drum_cursor != i && g2--)
                slow(EN_K2, drum_cursor < i ? 1 : -1);
            g2 = 8;
            while (dstep_lvl(&t->dstep[i], lane) != (w & 3u) && g2--)
                slow(EN_K4, lvl_rank(dstep_lvl(&t->dstep[i], lane)) < lvl_rank(w & 3u) ? 1 : -1);
            if (dstep_rat(&t->dstep[i], lane) != ((w >> 2) & 3u)) {
                down(B_OCTUP);                           /* held: the hit's sheet */
                frames(30);
                up(B_OCTUP);
                g2 = 10;
                while (ui.sheet != 1u && g2--)
                    slow(EN_K1, -1);
                g2 = 8;
                while (dstep_rat(&t->dstep[i], lane) != ((w >> 2) & 3u) && g2--)
                    slow(EN_K2, dstep_rat(&t->dstep[i], lane) < ((w >> 2) & 3u) ? 1 : -1);
                tap(B_OCTDN);
            }
        }
    }
}
static void do_mutes(const tr_card_t *c)
{
    uint32_t k;
    for (k = 0; k < NTRK; k++) {
        if (!((c->p >> k) & 1u) || (trk[k].p[P_MUTE] != 0) == (((uint32_t)c->v >> k) & 1u))
            continue;
        home();
        algo_to(k);                                      /* (GLO's keys 1-4: the bank of the selected track) */
        hold_layer(B_GLO);
        key(key_of_white(k % 4u));
        let_go(B_GLO);
    }
}
static void pats_screen(void)                           /* (from a synth track: on a drum track SEQ opens the DRUMS screen,
                                                         * whose SEQ walks its own pages; ALGORITHM then picks any track) */
{
    if (on_pats_page() && pats_view() == PV_PADS)
        return;
    home();
    if (is_drum(TSEL))
        algo_to(song.sel ? song.sel - 1u : 0u);
    open_page(B_SEQ, "PATTERNS");
}
static void pat_select(uint32_t k, uint32_t pat)
{
    pats_screen();
    algo_to(k);
    while (pats_cursor != pat)
        slow(EN_K1, pats_cursor < pat ? 1 : -1);
    tap(B_OCTUP);
    frames(3);
}
static void pat_copy_to(uint32_t k, uint32_t pat)          /* KNOB 3 right twice: the pattern playing into the cursor's */
{
    pats_screen();
    algo_to(k);
    while (pats_cursor != pat)
        slow(EN_K1, pats_cursor < pat ? 1 : -1);
    slow(EN_K3, 1);
    slow(EN_K3, 1);
}
static void do_lock(const tr_card_t *c)
{
    track_t *t = &trk[c->trk];
    uint32_t step = TR_D[c->data], g = 60;
    int k;
    algo_to(c->trk);
    open_page(B_SEQ, "NOTES");
    while (ui.cursor != step && g--)
        slow(EN_K1, ui.cursor < step ? 1 : -1);
    down(B_OCTUP);                                       /* the sheet */
    frames(30);
    up(B_OCTUP);
    g = 10;
    while (ui.sheet != 8u && g--)
        slow(EN_K1, 1);                                  /* LOCKS, the last row */
    tap(B_OCTUP);                                        /* its strip */
    if ((k = lock_find(t, step, c->p, 0)) < 0) {
        g = 10;
        while (ui.lsheet != 1u + lock_items(t, step, (uint8_t[NLOCK]){0}) && g--)
            slow(EN_K1, 1);                              /* ADD */
        g = 80;
        while (ui.lock_par != c->p && g--)
            slow(EN_K2, 1);
        tap(B_OCTUP);
        k = lock_find(t, step, c->p, 0);
    }
    g = 140;
    while (k >= 0 && t->lock[k].val != c->v && g--)
        slow(EN_K2, t->lock[k].val < c->v ? 1 : -1);
    if (c->flags & 1u)
        slow(EN_K3, 1);
    tap(B_OCTDN);
    tap(B_OCTDN);
}
/* the PATTERNS steps done as the hints say, from where the step before left the FM-1 (nothing else known): each hint
 * read, the one press it asks for */
static uint32_t hint_steps, hint_lost;
static int hint_num(const char *h, const char *after)
{
    const char *p = strstr(h, after);
    return p ? atoi(p + strlen(after)) : -1;
}
static void follow_hints(const tr_card_t *c)
{
    uint32_t g;
    for (g = 0; g < 120u; g++) {
        static char act[40];
        const char *h = tr.hint;
        int n;
        frames(2);
        if (tr.card != (uint32_t)(c - tr_level(tr.lvl - 1u)->cards) || tr.ok || tr_goal(c))
            return;
        if (!h[0]) {                                     /* (no hint: the action says it) */
            tr_act(c, act, sizeof act);
            h = act;
        }
        hint_steps++;
        if (tr_prefix(h, "TAP SEQ, SELECT TO "))      /* (1.9.7) the SEQ pages from anywhere: SEQ, then SELECT */
            tap(B_SEQ);
        else if (tr_prefix(h, "TAP HOME"))
            tap(B_HOME);
        else if ((n = hint_num(h, "ALGORITHM TO TRACK ")) > 0 || (n = hint_num(h, "ALGORITHM TO ")) > 0) {
            if (song.sel != (uint32_t)n - 1u)
                slow(EN_ALGO, song.sel < (uint32_t)n - 1u ? 1 : -1);
            else if (strstr(h, "THEN SEQ"))
                tap(B_SEQ);
        } else if ((n = hint_num(h, "KNOB 1 TO PATTERN ")) > 0)
            slow(EN_K1, pats_cursor < (uint32_t)n - 1u ? 1 : -1);
        else if (tr_prefix(h, "KNOB 3 RIGHT"))
            slow(EN_K3, 1);
        else if (tr_prefix(h, "TURN SELECT LEFT"))
            slow(EN_SELECT, -1);
        else if (tr_prefix(h, "TURN SELECT RIGHT"))
            slow(EN_SELECT, 1);
        else if ((n = hint_num(h, "PRESS WHITE KEY ")) > 0) {   /* (the coach lights that key: it says so) */
            if (!((tr.keys >> key_of_white((uint32_t)n - 1u)) & 1u)) {
                printf("trainer: %s: \"%s\" without its key lit\n", c->head, h);
                hint_lost++;
            }
            key(key_of_white((uint32_t)n - 1u));
        } else if ((n = hint_num(h, "KNOB 1 TO SCENE ")) > 0)
            slow(EN_K1, scn_cursor < (uint32_t)n - 1u ? 1 : -1);
        else if ((n = hint_num(h, "KNOB 1 TO SLOT ")) > 0)
            slow(EN_K1, chain_cursor < (uint32_t)n - 1u ? 1 : -1);
        else if (!strcmp(h, "KNOB 1 TO THE END"))
            slow(EN_K1, 1);
        else if ((n = hint_num(h, "KNOB 2 TO PATTERN ")) > 0)
            slow(EN_K2, CH_PAT(TSEL->pat_chain[chain_cursor % NCHAIN]) < (uint32_t)n - 1u ? 1 : -1);
        else if ((n = hint_num(h, "KNOB 3 TO X")) > 0)
            slow(EN_K3, CH_REP(TSEL->pat_chain[chain_cursor % NCHAIN]) < (uint32_t)n ? 1 : -1);
        else if ((n = hint_num(h, "KNOB 4 TO PATTERN ")) > 0) {
            uint32_t p = scn_pat[scn_cursor % NSCENE][song.sel % NTRK];
            slow(EN_K4, p >= NPAT || p < (uint32_t)n - 1u ? 1 : -1);   /* (KEEP is below pattern 1) */
        } else if (!strcmp(h, "KNOB 4 DOWN TO KEEP"))
            slow(EN_K4, -1);
        else if (tr_prefix(h, "KNOB 4 RIGHT"))
            slow(EN_K4, 1);
        else if (tr_prefix(h, "KNOB 3 TO ")) {           /* (a scene's name) */
            uint32_t w = 0;
            while (w < NSCN_NAMES && strcmp(N_SCN[w], h + 10))
                w++;
            slow(EN_K3, scn_name[scn_cursor % NSCENE] < w ? 1 : -1);
        }
        else if (tr_prefix(h, "PRESS OCT+"))
            tap(B_OCTUP);
        else if (tr_prefix(h, "PRESS OCT-"))
            tap(B_OCTDN);
        else if (!strcmp(h, "WAIT FOR THE BAR"))
            frames(20);
        else {
            printf("trainer: %s: a hint that says no press: \"%s\"\n", c->head, h);
            hint_lost++;
            return;
        }
    }
    printf("trainer: %s: the hints went round\n", c->head);
    hint_lost++;
}
static void do_card(const tr_card_t *c)
{
    switch (c->goal) {
    case TG_TRACK: home(); algo_to(c->trk); break;
    case TG_KIT: case TG_SOUND: do_browse(c); break;
    case TG_PARAM: case TG_GLOBAL: do_param(c); break;
    case TG_PLAY: if ((song.playing != 0) != (c->v != 0)) tap(B_PLAY); break;
    case TG_PAGE:
        if (c->trk < NTRK && song.sel != c->trk) {       /* (the DRUMS grid's: its drum track first) */
            home();
            algo_to(c->trk);
        }
        if (PAGES[c->p].scope == SC_PATS && hint_tries++ == 0u) {   /* (as the step and its hints say, from anywhere) */
            if (pats_from_drum++ == 0u && !is_drum(TSEL) && !on_pats_page()) {
                home();                                  /* (once: from a drum track's grid) */
                algo_to(3);
                tap(B_SEQ);
                check(is_drum(TSEL) && on_drum_page() && !tr_goal(c) && !strcmp(tr.hint, "TURN SELECT RIGHT: PATTERNS"),
                      "PATTERNS from a drum track's grid (1.9.7): TURN SELECT RIGHT: PATTERNS");
            }
            follow_hints(c);
            break;
        }
        home();
        if (PAGES[c->p].scope == SC_DRUM) {
            tap(B_SEQ);
            uint32_t g;
            for (g = 0; g < 6u && !(on_drum_page() && !drum_page); g++)
                tap(B_SEQ);
        } else if (PAGES[c->p].scope == SC_PATS)
            pats_screen();
        else if (PAGES[c->p].scope == SC_SONG)
            song_page();
        else
            open_page(c->btn, PAGES[c->p].title);
        break;
    case TG_OCT: {
        uint32_t g = 8;
        while (song.octave != c->v && g--)
            tap(song.octave < c->v ? B_OCTUP : B_OCTDN);
        break;
    }
    case TG_NOTES: do_notes(c); break;
    case TG_LANES: do_lanes(c); break;
    case TG_MUTES: do_mutes(c); break;
    case TG_LOCK: do_lock(c); break;
    case TG_SCENE: case TG_SCNPLAY: case TG_CHAIN:      /* (scenes and chains: the hints alone, every time) */
        follow_hints(c);
        break;
    case TG_PATSEL: case TG_PATS: case TG_PATHAS:
        if (hint_tries++ == 0u) {                        /* (the first try: the hints alone) */
            follow_hints(c);
            break;
        }
        if (c->goal == TG_PATS) goto pats;
        if (c->goal == TG_PATHAS) goto pathas;
        if (c->flags & 1u)                               /* a pattern to play that holds something: copy into it first */
            pat_copy_to(c->trk, (uint32_t)c->v);
        pat_select(c->trk, (uint32_t)c->v);
        break;
    pats: {
        uint32_t k, all = 1, w0 = TR_D[c->data];
        for (k = 0; k < NTRK; k++)
            all &= TR_D[c->data + k] == 255u || TR_D[c->data + k] == w0;
        for (k = 0; k < 5u; k++)
            all &= TR_D[c->data + k] != 255u;
        if (all && song.playing) {                       /* playing, every track: OCT- on the PATTERNS screen */
            pats_screen();
            while (pats_cursor != w0)
                slow(EN_K1, pats_cursor < w0 ? 1 : -1);
            tap(B_OCTDN);
            frames(300);
        } else
            for (k = 0; k < NTRK; k++)
                if (TR_D[c->data + k] != 255u && trk[k].pat != TR_D[c->data + k])
                    pat_select(k, TR_D[c->data + k]);
        break;
    }
    pathas: {
        uint32_t k;
        for (k = 0; k < NTRK; k++)
            if (((uint32_t)c->v >> k) & 1u)
                pat_copy_to(k, c->p);
        break;
    }
    case TG_SAVED:
        home();
        hold_layer(B_SAVE);
        key(key_of_white(4u + (uint32_t)c->v));
        frames(2);
        if (!tr.ok && tr_card() == c)                    /* a used section (AGAIN: ...): the key again */
            key(key_of_white(4u + (uint32_t)c->v));
        let_go(B_SAVE);
        break;
    case TG_SONG: {
        const uint8_t *d = &TR_D[c->data];
        uint32_t k, g = 40;
        if ((c->flags & 1u) && arrangement.count != d[0]) {   /* back on HOME (KNOB 4 there: the pan, KNOB 3 the track's steps): the hint says the way back */
            uint32_t was = arrangement.count;
            home();
            frames(3);
            slow(EN_K4, 1);
            check(!tr_goal(c) && !strcmp(tr.go, "GO TO THE SONG PAGE") && !strcmp(tr.hint, "TAP SEQ UNTIL YOU SEE SONG") &&
                  tr.btn == B_SEQ && arrangement.count == was, "the song's steps from HOME: the page card, TAP SEQ (1.9.9)");
        }
        if (!on_song_page()) song_page();
        while (arrangement.count != d[0] && g--)
            slow(EN_K4, arrangement.count < d[0] ? 1 : -1);
        if (c->flags & 1u)
            break;
        for (k = 0; k < d[0]; k++) {
            g = 40;
            while (song_cursor != k && g--)
                slow(EN_K1, song_cursor < k ? 1 : -1);
            g = 8;
            while (arrangement.entry[k].scene != d[1u + 2u * k] && g--)
                slow(EN_K2, arrangement.entry[k].scene < d[1u + 2u * k] ? 1 : -1);
            g = 80;
            while (arrangement.entry[k].bars != d[2u + 2u * k] && g--)
                slow(EN_K3, arrangement.entry[k].bars < d[2u + 2u * k] ? 1 : -1);
        }
        break;
    }
    case TG_SONGMODE:
        if (!on_song_page()) song_page();
        if (!arrangement_enabled)
            tap(B_OCTDN);
        if (!song.playing)
            tap(B_PLAY);
        frames(10);
        break;
    default:
        break;
    }
}

/* ---------------------------------------------------------------- a level --- */
static void pick(uint32_t page, uint32_t act)              /* HOME held: the picker; SELECT to the page, KNOB 1 to the
                                                         * action, OCT+ */
{
    uint8_t a[8];
    uint32_t n, i, g = 20;
    if (ui.menu != 3u) {
        down(B_HOME);
        frames(60);                                      /* (held 0.7 s) */
        up(B_HOME);
    }
    while (tr.wp && g--)                                 /* (in a level: the step's "why" pages first) */
        slow(EN_SELECT, 1);
    g = 20;
    while (tr.page != page && g--)
        slow(EN_SELECT, tr.page < page ? 1 : -1);
    n = tr_actions(tr.page, a);
    for (i = 0; i < n && a[i] != act; i++)
        ;
    g = 10;
    while (tr.sel != i && g--)
        slow(EN_K1, tr.sel < i ? 1 : -1);
    tap(B_OCTUP);
}
static uint32_t keys_lit_now(void)                      /* the keys' LEDs on (full or dim) */
{
    uint32_t k, m = 0;
    for (k = 0; k < 27u; k++) {
        uint32_t id = 14u + k, col = led_pos[id] >> 3, bit = 1u << (led_pos[id] & 7u);
        if (led_pos[id] != 0xFFu && (fm1_led[col] | fm1_led_dim[col] | fm1_led_bg[col]) & bit)
            m |= 1u << k;
    }
    return m;
}
/* ---------------------------------------------------------------- the wrong page --- */
/* the detour pass: each card not done yet, first from each wrong screen (WRONG, below). A card that
 * needs its own screen shows only the page card ("GO TO ...", the way there): its way followed press by press reaches
 * that screen, where the step's own card is back */
static uint32_t detour, detour_cards, detour_shots, resumes;
static int follow_go(const tr_card_t *c)
{
    uint32_t g, b, at = tr.card;
    for (g = 0; g < 12u && tr.go[0]; g++) {
        if (tr.card != at)
            return 1;                                    /* (the level went back: a track's kind put back, its steps) */
        if (c->goal == TG_LANES)
            grid_hints++;                                /* (to the grid by the page card's way) */
        const char *h = tr.hint;
        if (tr_prefix(h, "TURN SELECT LEFT"))
            slow(EN_SELECT, -1);
        else if (tr_prefix(h, "TURN SELECT RIGHT"))
            slow(EN_SELECT, 1);
        else if (tr_prefix(h, "PRESS PLAY") && tr.btn == B_PLAY)
            tap(B_PLAY);
        else if (tr_prefix(h, "LET GO")) {
            fm1_in.buttons = 0;
            frames(3);
        } else if (!strcmp(h, "HOLD HOME") && tr.btn == B_HOME) {
            down(B_HOME);
            frames(60);
            up(B_HOME);
        } else if (!strcmp(h, "TURN PRESETS"))
            slow(EN_PRESET, 1);
        else if (tr_prefix(h, "KNOB 1 RIGHT") || tr_prefix(h, "KNOB 1 LEFT"))
            slow(EN_K1, tr_prefix(h, "KNOB 1 RIGHT") ? 1 : -1);
        else if (!strcmp(h, "FOLLOW THE DOTS: KNOB 2, 3")) {   /* (the kind card: the track's own sound) */
            uint32_t g2, s2;
            for (g2 = 0; g2 < 30u && !tr_def_sound(); g2++)
                slow(EN_K2, -1);
            for (g2 = 0; g2 < 40u && !tr_def_sound(); g2++) {
                for (s2 = 0; s2 < 40u && !tr_def_sound(); s2++) slow(EN_K3, -1);
                for (s2 = 0; s2 < 40u && !tr_def_sound(); s2++) slow(EN_K3, 1);
                if (!tr_def_sound()) slow(EN_K2, 1);
            }
        }
        else if (tr_prefix(h, "TAP ")) {
            for (b = 0; b < NB; b++) {
                size_t n = strlen(B_NAME[b]);
                if (!strncmp(h + 4, B_NAME[b], n) && (h[4 + n] == 0 || h[4 + n] == ' ' || h[4 + n] == ','))
                    break;
            }
            if (b == NB) {
                printf("trainer: %s: a page card's way without a button: \"%s\"\n", c->head, h);
                return 0;
            }
            if (tr.btn != b) {
                printf("trainer: %s: \"%s\", but button %u lit\n", c->head, h, tr.btn);
                return 0;
            }
            tap(b);
        } else {
            printf("trainer: %s: a page card's way that says no press: \"%s\"\n", c->head, h);
            return 0;
        }
        frames(3);
        if (tr_goal(c))
            return 1;
    }
    return !tr.go[0];
}
/* the states of the detour: each from HOME's screen (stopped as the card found it, or playing). Every screen, the sound
 * browser, the visualiser, REC armed, playing */
static const char *const WRONG[] = {"TRACKS", "ENV", "SEL", "CHORDS", "FX", "SEQ", "TIMING", "PATTERNS", "CHAIN", "SCENES",
                                    "SONG", "BROWSER", "VISUALISER", "REC ARMED", "TRACKS PLAYING", "SONG PLAYING",
                                    "SCENES PLAYING", "RECORDING", "OTHER TRACK", "STEP MENU", "DRUM STEP MENU",
                                    "HOLD SEQ", "HOLD SEL", "HOLD GLO", "HOLD SAVE", "HOLD FX", "HOLD EDIT", "HOLD ARP",
                                    "HOLD REC", "MENU", "KIND CHANGED", "COPY ARMED", "STORE ARMED", "LOAD ARMED",
                                    "LOCK STRIP", "ZOOMED", "BROWSER VIEW"};
static const uint8_t HELD[8] = {B_SEQ, B_SCL, B_GLO, B_SAVE, B_FX, B_EDIT, B_ARP, B_REC};   /* (states 21..28) */
static int was_playing;
static uint32_t was_sel;
static const tr_card_t *wrong_card;                /* (KIND CHANGED: the card's track) */
static uint8_t kind_tried[TR_NLEVELS][NTRK];       /* (KIND CHANGED once a track a level: it sends the level back to
                                                    * redo the track's steps) */
static uint32_t wrong_l, wrong_at;
static int kind_last(const tr_card_t *c)           /* the track's last note / drum / octave step of the level (there the
                                                    * steps checked again do not reach its sound: the kind card) */
{
    const tr_level_t *L = tr_level(wrong_l);
    uint32_t i;
    for (i = wrong_at + 1u; i < L->n; i++)
        if (L->cards[i].trk == c->trk && (L->cards[i].goal == TG_NOTES || L->cards[i].goal == TG_LANES ||
                                         L->cards[i].goal == TG_OCT))
            return 0;
    return 1;
}
static int wrong_screen(uint32_t w)                 /* 0: this state cannot be made here */
{
    uint32_t g;
    const tr_card_t *c = wrong_card;
    was_playing = song.playing != 0;
    was_sel = song.sel;
    home();
    frames(3);
    if ((w >= 14u && w <= 17u) != (song.playing != 0)) {          /* (the transport as the state wants it) */
        if (w == 13u || (w >= 14u && arrangement_enabled))
            return 0;
        tap(B_PLAY);
        frames(4);
        if ((w >= 14u && w <= 17u) != (song.playing != 0))
            return 0;
    }
    switch (w) {
    case 1: tap(B_ENV); break;
    case 2: tap(B_SCL); break;
    case 3: for (g = 0; g < 8u && !on_chords_page(); g++) tap(B_SCL); break;
    case 4: tap(B_FX); break;
    case 5: tap(B_SEQ); break;
    case 6: for (g = 0; g < 8u && strcmp(cur_page()->title, "TIMING"); g++) tap(B_SEQ); break;
    case 7: seq_save(); slow(EN_SELECT, -1); slow(EN_SELECT, -1); break;
    case 8: seq_save(); slow(EN_SELECT, -1); break;
    case 9: case 16: seq_save(); break;
    case 10: case 15: tap(B_SAVE); break;
    case 11: slow(EN_PRESET, 1); break;
    case 12: tap(B_HOME); break;
    case 13: if (song.playing || song.rec || rec_wait) return 0; tap(B_REC); break;
    case 17: if (song.rec) return 0; tap(B_REC); break;     /* (playing: REC records at once) */
    case 18: slow(EN_ALGO, song.sel < NTRK - 1u ? 1 : -1); break;
    case 21: case 22: case 23: case 24: case 25: case 26: case 27: case 28:   /* a button held (REC: as a hold) */
        down(HELD[w - 21u]);
        frames(w == 28u ? 50u : 25u);
        return ui.layer != LY_PLAY || ui.hold_kind;
    case 29:
        pick(TR_NLEVELS, TA_MENU);
        return ui.menu == 1u;
    case 30:                                              /* the card's track, the other kind (TOOLS > KIND) */
        if (c->trk >= NTRK || song.sel != c->trk || (c->goal != TG_NOTES && c->goal != TG_LANES && c->goal != TG_OCT) ||
            !kind_last(c) || kind_tried[wrong_l][c->trk]++)
            return 0;
        track_kind_switch(is_drum(TSEL) ? TK_SYNTH : TK_DRUM, 0u);
        break;
    case 31: seq_save(); slow(EN_SELECT, -1); slow(EN_SELECT, -1); slow(EN_K3, 1); return pats_arm == 1u;
    case 32: seq_save(); tap(B_OCTDN); return pats_arm == 3u;
    case 33: if (song.playing) return 0; song_page(); tap(B_OCTUP); return on_song_page() && song_load_armed;
    case 34: case 35:                                     /* (a synth track's NOTES: the lock strip; zoomed) */
        if (is_drum(TSEL))
            return 0;
        tap(B_SEQ);
        if (w == 35u) {
            slow(EN_PRESET, 1);
            return on_notes_page();
        }
        down(B_OCTUP);
        frames(40);
        up(B_OCTUP);
        for (g = 0; g < 10u && ui.sheet != 1u + SH_LOCKS; g++)
            slow(EN_K1, 1);
        tap(B_OCTUP);
        return ui.lsheet != 0;
    case 36: slow(EN_PRESET, 1); slow(EN_SELECT, 1); return tr_browsing() && br_kind;
    case 19: case 20:                                     /* (a synth track's NOTES, the drum grid: OCT+ held, its menu) */
        if ((w == 20u) != (is_drum(TSEL) != 0))
            return 0;
        tap(B_SEQ);
        down(B_OCTUP);
        frames(40);
        up(B_OCTUP);
        break;
    default: break;
    }
    frames(4);
    return w == 3u ? on_chords_page() : w == 6u ? !strcmp(cur_page()->title, "TIMING") : w == 11u ? tr_browsing() :
           w == 12u ? vis_shown() : w == 13u ? rec_wait != 0 : w == 17u ? song.rec != 0 : w >= 19u ? ui.sheet != 0 : 1;
}
static void wrong_restore(void)                     /* back to HOME's screen, the transport as it was, not armed */
{
    if (fm1_in.buttons) {                                /* (a button held: let go) */
        fm1_in.buttons = 0;
        frames(3);
    }
    if (ui.menu == 1u || ui.menu == 2u)
        menu_close();
    /* (KIND CHANGED: not put back here; the level goes back to the steps it undid, and the coach's cards put it back) */
    if (tr_browsing())
        tap(B_HOME);                                     /* (the browser closed: the sound it opened on) */
    if ((rec_wait && !song.playing) || song.rec) {
        home();
        tap(B_REC);
    }
    home();
    algo_to(was_sel);                                    /* (OTHER TRACK: the card's track again) */
    if ((song.playing != 0) != was_playing && !arrangement_enabled)
        tap(B_PLAY);
    frames(4);
}
/* a card with no page card here: its controls work on every screen (a held button's layer, PLAY, ALGORITHM), or this
 * is its own screen. Anything else would name a control that does nothing here, or something else */
static int own_screen(const tr_card_t *c)
{
    int plain = !on_pats_page() && !on_chords_page() && !on_song_page() && !on_drum_page();   /* (keys: notes, OCT) */
    if (c->goal == TG_PARAM && c->p == P_ROOT)
        return 1;                                        /* (SEL held + a key: the song's, any track, any screen) */
    if (c->trk < NTRK && song.sel != c->trk)             /* (ALGORITHM first: works here, and the coach says it) */
        return tr_algo_ok() && tr_prefix(tr.hint, "TURN ALGORITHM TO TRACK ");
    switch (c->goal) {
    case TG_TRACK: case TG_PLAY: case TG_PAGE: case TG_DONE: case TG_MUTES: case TG_SAVED:
        return 1;
    case TG_SONGMODE:
        return arrangement_enabled || (on_song_page() && !song.playing);
    case TG_SONG:
        return on_song_page() && !song.playing;
    case TG_KIT: case TG_SOUND:
        return on_home() || tr_browsing();
    case TG_OCT:
        return plain && !(ui.sheet && (on_notes_page() || on_drum_page()));
    case TG_PARAM: case TG_GLOBAL:
        if (c->data)
            return !ui.home && ui.page == c->data - 1u;
        return c->btn != B_HOME || on_home();
    case TG_NOTES:                                       /* (the step's menu open: only for SLIDE and RATCHET) */
        return c->flags == HOW_SEQ ? plain && !on_notes_page() :
               on_notes_page() && (!ui.sheet || strstr(tr.hint, "SLIDE"));
    case TG_LANES:
        return on_drum_page() && !drum_page && (!ui.sheet || strstr(tr.hint, "RATCHET"));
    case TG_LOCK:
        return !ui.home && cur_page()->scope == SC_STEP;
    default:                                             /* (PATTERNS, CHAIN, SCENES: the view is checked as it goes) */
        return on_pats_page();
    }
}
/* no page card here: the card's own control, once, as its action / hint says it. 1: it moved toward the card (or did
 * it), 0: it did nothing (the bug: a control named where it does nothing), -1: a card of many presses (its own screen
 * is checked by own_screen) */
static int probe_took(void)                        /* the coach took the step on the probe's press: not undone (it went on) */
{
    frames(2);
    return tr.ok || tr.card != wrong_at;
}
static int knob_of(const char *a)
{
    const char *k = strstr(a, "KNOB ");
    return strstr(a, "SELECT") && !k ? EN_SELECT : k ? EN_K1 + (k[5] - '1') : -1;
}
static int probe_act(const tr_card_t *c)
{
    char act[40];
    int32_t was, want;
    int e;
    tr_act(c, act, sizeof act);
    if (tr_prefix(tr.hint, "TURN ALGORITHM TO TRACK ")) {
        int n = hint_num(tr.hint, "TRACK "), r;
        was = (int32_t)song.sel;
        slow(EN_ALGO, (int32_t)song.sel < n - 1 ? 1 : -1);
        r = (int32_t)song.sel != was;
        if (r && !probe_took())
            slow(EN_ALGO, (int32_t)song.sel > was ? -1 : 1);   /* (undone: every state tries the card as it came) */
        return r;
    }
    switch (c->goal) {
    case TG_KIT: case TG_SOUND:
        if (tr_browsing())
            return -1;
        slow(EN_PRESET, 1);
        return tr_browsing();
    case TG_OCT:
        was = song.octave;
        tap(song.octave < c->v ? B_OCTUP : B_OCTDN);
        if (song.octave == was)
            return 0;
        if (!probe_took())
            song.octave = (int8_t)was;
        return 1;
    case TG_PLAY:
        was = song.playing != 0;
        tap(B_PLAY);
        frames(4);
        if ((song.playing != 0) == was)
            return 0;
        if (!probe_took()) {
            tap(B_PLAY);
            frames(4);
        }
        return 1;
    case TG_SAVED:
        was = sec_stores[c->v & 3];
        hold_layer(B_SAVE);
        key(key_of_white(4u + (uint32_t)c->v));
        if (sec_stores[c->v & 3] == (uint8_t)was)
            key(key_of_white(4u + (uint32_t)c->v));
        let_go(B_SAVE);
        return sec_stores[c->v & 3] != (uint8_t)was;
    case TG_MUTES: {
        uint32_t m0 = 0, m1 = 0, k, n = (uint32_t)hint_num(tr.hint, "KEY ");
        for (k = 0; k < NTRK; k++) m0 |= (trk[k].p[P_MUTE] != 0) << k;
        if (!n)
            return -1;
        hold_layer(B_GLO);
        key(key_of_white(n - 1u));
        let_go(B_GLO);
        for (k = 0; k < NTRK; k++) m1 |= (trk[k].p[P_MUTE] != 0) << k;
        if (m0 == m1)
            return 0;
        if (probe_took())
            return 1;
        hold_layer(B_GLO);
        key(key_of_white(n - 1u));
        let_go(B_GLO);
        return 1;
    }
    case TG_SONGMODE:
        if (arrangement_enabled) {
            tap(B_PLAY);
            frames(4);
            return song.playing != 0;
        }
        tap(B_OCTDN);
        was = arrangement_enabled != 0;
        if (was && !probe_took())
            tap(B_OCTDN);                                /* (back: the other states find it as the card did) */
        return was;
    case TG_SONG: {
        const uint8_t *d = &TR_D[c->data];
        if (arrangement.count == d[0])
            return -1;
        was = arrangement.count;
        slow(EN_K4, arrangement.count < d[0] ? 1 : -1);
        return arrangement.count != (uint32_t)was;
    }
    case TG_PARAM: case TG_GLOBAL: {
        int16_t *v = c->goal == TG_GLOBAL ? &song.g[c->p] : &trk[c->trk % NTRK].p[c->p];
        int held = tr_prefix(act, "HOLD SEQ") ? B_SEQ : tr_prefix(act, "HOLD SEL") ? B_SCL : -1;
        if (c->goal == TG_PARAM && c->p == P_ROOT) {     /* (every synth track's key) */
            uint32_t k = 0, i, moved = 0;
            int16_t r0[NTRK];
            for (i = 0; i < NTRK; i++) r0[i] = trk[i].p[P_ROOT];
            while (k < 27u && !((tr.keys >> k) & 1u)) k++;
            if (k == 27u)
                return 0;
            hold_layer(B_SCL);
            key(k);
            let_go(B_SCL);
            for (i = 0; i < NTRK; i++) moved |= trk[i].p[P_ROOT] != r0[i];
            if (!moved)
                return 0;
            if (!probe_took())
                for (i = 0; i < NTRK; i++) trk[i].p[P_ROOT] = r0[i];
            return 1;
        }
        if ((e = knob_of(act)) < 0)
            return -1;
        was = *v, want = c->v;
        if (held >= 0) hold_layer((uint32_t)held);
        slow((uint32_t)e, was < want ? 1 : -1);
        slow((uint32_t)e, was < want ? 1 : -1);
        if (held >= 0) let_go((uint32_t)held);
        if (*v == was)
            return 0;
        if (!probe_took())
            *v = (int16_t)was;
        return 1;
    }
    default:
        return -1;
    }
}
static uint32_t probe_acts, probe_bad;
static void wrong_page(const tr_card_t *c, uint32_t l, uint32_t at)
{
    uint32_t w, wi;
    char name[64];
    wrong_card = c, wrong_l = l, wrong_at = at;
    for (wi = 0; wi < NELEM(WRONG) && tr.card == at; wi++) {
        int r;
        w = wi == 0u ? 18u : wi <= 18u ? wi - 1u : wi;   /* (OTHER TRACK first: a state's own presses can do a page step) */
        if (!wrong_screen(w)) {
            wrong_restore();
            continue;
        }
        if (tr.card != at)
            return;                                      /* (KIND CHANGED: the level went back to redo the track) */
        if (tr_goal(c))
            return;
        if (!tr.go[0] && w >= 21u && w <= 28u) {          /* a button held, no card: the step uses that button */
            uint32_t b = HELD[w - 21u];
            if (!tr_holds(c, B_NAME[b]) && !(b == B_SEQ && (c->goal == TG_LANES || (c->goal == TG_NOTES && c->flags == HOW_SEQ)))) {
                printf("trainer: level %u card %u (%s): %s: no LET GO card: \"%s\"\n", l + 1u, at + 1u, c->head, WRONG[w],
                       tr.hint);
                probe_bad++;
                fails++;
            }
            wrong_restore();
            continue;
        }
        if (!tr.go[0] && w >= 31u && w <= 33u && on_pats_page() &&
            (c->goal == TG_PATS || c->goal == TG_PATSEL || c->goal == TG_PATHAS || c->goal == TG_SCENE ||
             c->goal == TG_SCNPLAY || c->goal == TG_CHAIN)) {   /* armed: the hints alone get there */
            follow_hints(c);
            if (tr.card == at && !tr_goal(c)) {
                printf("trainer: level %u card %u (%s): %s: the hints alone did not get there: \"%s\"\n", l + 1u, at + 1u,
                       c->head, WRONG[w], tr.hint);
                fails++;
            }
            return;
        }
        if (!tr.go[0]) {
            char hint[48];
            strcpy(hint, tr.hint);
            r = probe_act(c);
            probe_acts += r >= 0;
            if (r == 0 || (r < 0 && !own_screen(c))) {
                printf("trainer: level %u card %u (%s): %s: no page card, %s: \"%s\"\n", l + 1u, at + 1u, c->head,
                       WRONG[w], r == 0 ? "its control does nothing here" : "not its screen", hint);
                probe_bad++;
                fails++;
            }
            wrong_restore();
            continue;
        }
        detour_cards++;
        if (text_w(&FONT_S, tr.go) > 236 || str_len(tr.hint) + 1u >= sizeof tr.hint) {
            printf("trainer: level %u card %u: the page card too wide: %s / %s\n", l + 1u, at + 1u, tr.go, tr.hint);
            fails++;
        }
        if ((detour_shots < 2u && w == detour_shots) || (w == 29u && !(detour_shots & 4u))) {   /* (the page card on a
                                                          * two-line and a one-line band, in the menu's header) */
            frames(10);
            ui.force = 1;
            frame();
            snprintf(name, sizeof name, "trainer-go-%s", w == 29u ? "menu" : w ? "env" : "tracks");
            ppm(outdir, name);
            detour_shots += w == 29u ? 4u : 1u;
        }
        if (!follow_go(c)) {
            printf("trainer: level %u card %u (%s): from %s the page card's way did not get there: %s / %s\n", l + 1u,
                   at + 1u, c->head, WRONG[w], tr.go, tr.hint);
            fails++;
            wrong_restore();
            return;
        }
        if (wi + 1u < NELEM(WRONG))
            wrong_restore();
    }
    if (song.rec || rec_wait) {                          /* (the last state: recording, not the card's) */
        home();
        tap(B_REC);
    }
}
static void song_settings(uint32_t l, const char *how)   /* every setting of the approved song is on the FM-1 (the
                                                         * lessons left none out) */
{
    uint32_t i, bad = 0;
    char what[120];
    for (i = 0; i < NELEM(TR_CHECK); i++) {
        int32_t have;
        if (TR_CHECK[i].lvl != l + 1u)
            continue;
        have = TR_CHECK[i].trk == 255u ? song.g[TR_CHECK[i].id] : trk[TR_CHECK[i].trk].p[TR_CHECK[i].id];
        if (have - TR_CHECK[i].v > 4 || TR_CHECK[i].v - have > 4) {
            printf("  level %u: %s%u parameter %u is %d, the song has %d\n", l + 1u,
                   TR_CHECK[i].trk == 255u ? "global " : "track ", TR_CHECK[i].trk == 255u ? 0u : TR_CHECK[i].trk + 1u,
                   TR_CHECK[i].id, have, TR_CHECK[i].v);
            bad++;
        }
    }
    snprintf(what, sizeof what, "level %u%s: every setting of the approved song is on the FM-1", l + 1u, how);
    check(!bad, what);
}
static int play_level(uint32_t l, const char *shots)
{
    const tr_level_t *L = tr_level(l);
    uint32_t n = 0, tries;
    char name[64];
    pick(l, (tr.done >> l) & 1u ? TA_AGAIN : tr.at[l] ? TA_OVER : TA_START);
    frames(30);
    if (!tr_on() || tr.lvl != l + 1u) {
        check(0, "the level starts from the picker");
        return 0;
    }
    uint32_t visits = 0;
    while (tr.card < L->n - 1u) {
        const tr_card_t *c = tr_card();
        uint32_t at = tr.card;
        if (!detour && c->goal != TG_DONE) {             /* resuming here (power on, a track's kind changed): the steps
                                                          * done hold, nothing goes back (a later step that adds to a
                                                          * pattern or sets a value again does not undo an earlier one) */
            tr_resume();
            if (tr.card != at) {
                printf("trainer: level %u card %u: resuming goes back to card %u (%s)\n", l + 1u, at + 1u, tr.card + 1u,
                       tr_card()->head);
                fails++;
                return 0;
            }
            resumes++;
        }
        if (++visits > 8u * L->n) {                      /* (sent back again and again: a loop) */
            printf("trainer: level %u: card %u, %u cards visited: the level goes round\n", l + 1u, at + 1u, visits);
            fails++;
            return 0;
        }
        frames(3);
        if (shots && (at < 3u || at % 9u == 0u)) {
            frames(5);
            snprintf(name, sizeof name, "%s-%02u-head", shots, at + 1u);
            ppm(outdir, name);
        }
        {   /* the card's text fits the screen; a card about keys: only its keys lit */
            char act[40];
            tr_act(c, act, sizeof act);
            /* (1.5.1) a line wider than the screen scrolls (tr_marquee): the headline and the action still fit (the
             * lessons are written so), a hint may not, but none is cut short (it fits its buffer) */
            if (text_w(&FONT_S, act) > 236 || text_w(&FONT_S, c->head) > 236 - 6 * 8 ||
                (tr_goal(c), str_len(tr.hint) + 1u >= sizeof tr.hint)) {
                printf("trainer: level %u card %u: too wide or cut short: %s / %s / %s\n", l + 1u, at + 1u, c->head, act, tr.hint);
                fails++;
            }
            if (tr.hint[0] && tr_mq_over(tr.hint) > 0)
                hints_scrolled++;
            if ((c->goal == TG_LANES || c->goal == TG_NOTES) && song.sel == c->trk) {
                frames(2);
                keyed_cards += tr.keys != 0;
                if (tr.keys && (keys_lit_now() & ~tr.keys)) {
                    printf("trainer: level %u card %u: keys lit %07x, the card's %07x\n", l + 1u, at + 1u,
                           keys_lit_now(), tr.keys);
                    fails++;
                }
            }
        }
        if (c->trk < NTRK && song.sel != c->trk) {   /* "TURN ALGORITHM": a detent changes the track (else HOME first) */
            char act[40];
            int turn, home_first;
            tr_act(c, act, sizeof act);
            tr_goal(c);
            home_first = !strcmp(tr.go, "GO TO THE HOME SCREEN") && !strcmp(tr.hint, "TAP HOME");   /* (the page card) */
            turn = !tr.go[0] && (tr_prefix(act, "TURN ALGORITHM") || tr_prefix(tr.hint, "TURN ALGORITHM"));
            if (turn) {
                uint32_t was = song.sel;
                if (!tr_home_ok()) {                     /* (1.9.7) the track changed from HOME's screen only */
                    printf("trainer: level %u card %u: says TURN ALGORITHM off HOME's screen (%s)\n", l + 1u, at + 1u,
                           cur_page()->title);
                    fails++;
                }
                slow(EN_ALGO, song.sel < c->trk ? 1 : -1);
                algo_said++;
                if (song.sel == was) {
                    printf("trainer: level %u card %u: says TURN ALGORITHM, the track stays (%s)\n", l + 1u, at + 1u,
                           cur_page()->title);
                    fails++;
                }
            } else if (home_first) {
                algo_home++;
                tap(B_HOME);
                frames(2);
                if (!tr_algo_ok()) {
                    printf("trainer: level %u card %u: HOME tapped, ALGORITHM still does nothing\n", l + 1u, at + 1u);
                    fails++;
                }
            }
        }
        if (detour && c->goal != TG_DONE && !tr_goal(c))
            wrong_page(c, l, at);
        hint_tries = 0;
        for (tries = 0; tries < 3u && tr.card == at; tries++) {
            tr_goal(c);
            if (tr.go[0] && !follow_go(c)) {             /* (a page card first, as a person follows it) */
                printf("trainer: level %u card %u (%s): the page card's way did not get there: %s / %s\n", l + 1u,
                       at + 1u, c->head, tr.go, tr.hint);
                fails++;
            }
            if (tr.card != at)
                break;
            if ((hint_tries == 1u && tries == 1u && (c->goal == TG_PATSEL || c->goal == TG_PATS || c->goal == TG_PATHAS ||
                                                     c->goal == TG_PAGE)) ||
                (tries == 1u && (c->goal == TG_SCENE || c->goal == TG_SCNPLAY || c->goal == TG_CHAIN))) {
                printf("trainer: level %u card %u (%s): the hints alone did not get there: %s\n", l + 1u, at + 1u,
                       c->head, tr.hint);
                hint_lost++;
            }
            do_card(c);
            frames(70);                                  /* (NICE, then the next card) */
        }
        if (tr.card == at) {
            tr_goal(c);
            printf("trainer: level %u card %u (%s / %s): stuck: %s\n", l + 1u, at + 1u, c->head, c->act, tr.hint);
            fails++;
            return 0;
        }
        n++;
    }
    frames(150);
    if (shots) {
        snprintf(name, sizeof name, "%s-done", shots);
        ppm(outdir, name);
    }
    printf("trainer: level %u: %u cards done by the panel alone\n", l + 1u, n);
    return (tr.done >> l) & 1u;
}

#ifndef TRAINER_NO_MAIN
int main(int argc, char **argv)
{
    uint32_t l;
    if (argc > 1)
        outdir = argv[1];
    host_boot();
    trainer_boot();
    frames(5);
    check(ui.menu == 3u && tr.page == 0u, "first start: the level picker opens on level 1");
    ui.force = 1; frame(); ppm(outdir, "trainer-picker");
    tap(B_OCTDN);
    check(!ui.menu, "OCT- closes the picker");
    {   /* the studio screens' head covers the two rows over their list: nothing left there from HOME (its labels) */
        uint32_t x, y, bad = 0, w;
        for (w = 0; w < 3u; w++) {
            home();
            frames(5);
            if (w == 0u) pats_screen();
            else if (w == 1u) song_page();
            else open_page(B_SCL, "CHORDS");
            frames(10);
            for (y = 40; y < 42u; y++)
                for (x = 0; x < 240u; x++)
                    bad += screen[y * 240 + x] != screen[y * 240];   /* (each row one colour: no text) */
        }
        check(!bad, "PATTERNS, SONG, CHORDS: nothing left over the list from the screen before (rows 40-41)");
        home();
    }
    {   /* (1.9.7) SEL + KNOB 2 a detent at a time with a drum track selected: every scale in turn (it went from the drum
         * track's own scale, never set: CHR or MAJ again each detent) */
        uint32_t k, d, ok = 1;
        int16_t was[NTRK];
        for (k = 0; k < NTRK; k++)
            was[k] = trk[k].p[P_SCALE];
        algo_to(3);
        down(B_SCL);
        frames(3);
        for (d = 1; d < 5u; d++) {
            slow(EN_K2, 1);
            for (k = 0; k < NTRK; k++)
                ok &= is_drum(&trk[k]) || trk[k].p[P_SCALE] == (int16_t)d;
        }
        let_go(B_SCL);
        check(is_drum(TSEL) && ok, "SEL + KNOB 2 on a drum track: each detent the next scale on every synth track");
        for (k = 0; k < NTRK; k++)
            trk[k].p[P_SCALE] = was[k];
        algo_to(0);
        home();
    }
    {   /* the "why" pages: HOME held in a level opens the step's topic; SELECT its pages, then the level's page */
        uint32_t i, ok = 1, t, n;
        pick(0, TA_START);
        frames(30);
        tr_go(1); tr_go(1); tr_go(1);                    /* (the kick: KICK) */
        frames(3);
        down(B_HOME); frames(60); up(B_HOME);
        t = tr_card()->why;
        n = TR_WHY[t].n;
        ok = ui.menu == 3u && tr.wp == 1u && !strcmp(TR_WHY[t].title, "THE KICK");
        ui.force = 1; frame(); ppm(outdir, "trainer-why-1");
        for (i = 1; i < n; i++)
            slow(EN_SELECT, 1);
        ok &= tr.wp == n;
        ui.force = 1; frame(); ppm(outdir, "trainer-why-2");
        slow(EN_SELECT, 1);
        ok &= tr.wp == 0u && tr.page == 0u;
        slow(EN_SELECT, -1);
        ok &= tr.wp == 0u && tr.page == 0u;                /* (the levels: no way back into "why") */
        tap(B_OCTDN);
        ok &= !ui.menu && tr.lvl == 1u && tr.card == 3u;
        check(ok, "HOME held in a level: the step's why (THE KICK), SELECT its pages, then the level; OCT- closes");
        for (i = 0, ok = 1; i < TR_NWHY; i++)
            ok &= TR_WHY[i].n >= 1u && TR_WHY[i].first + TR_WHY[i].n <= NELEM(TR_WHY_PG);
        for (i = 0; i < NELEM(TR_WHY_PG); i++) {          /* every line fits the screen */
            const char *l = TR_WHY_PG[i];
            uint32_t lines = 0;
            while (*l) {
                char b[40];
                uint32_t k = 0;
                while (l[k] && l[k] != '\n' && k < 39u)
                    b[k] = l[k], k++;
                b[k] = 0;
                ok &= text_w(&FONT_S, b) <= 232 && k < 39u;
                lines++;
                l += k + (l[k] == '\n');
            }
            ok &= lines >= 1u && lines <= 10u;
        }
        check(ok, "every why page: its lines fit the screen, 10 at most");
        pick(0, TA_QUIT);
    }
    {   /* (1.4.2) a drum track: ALGORITHM on its grid, SEQ on to PATTERNS and round */
        uint32_t g, ok;
        home();
        algo_to(3);
        tap(B_SEQ);
        ok = on_drum_page() && !drum_page;
        slow(EN_ALGO, 1);
        ok = ok && song.sel == 4u && on_notes_page();
        check(ok, "the DRUMS grid: ALGORITHM changes the track (a synth track: its NOTES)");
        slow(EN_ALGO, -1);
        check(song.sel == 3u && on_drum_page() && !drum_page, "NOTES: ALGORITHM onto a drum track opens its grid");
        for (g = 0; g < 3u; g++)
            tap(B_SEQ);
        ok = on_pats_page() && pats_view() == PV_PADS && song.sel == 3u;
        tap(B_SEQ);
        ok = ok && on_pats_page() && pats_view() == PV_CHAIN;
        tap(B_SEQ);
        ok = ok && on_pats_page() && pats_view() == PV_SCENES;
        tap(B_SEQ);
        ok = ok && on_song_page();
        tap(B_SEQ);
        check(ok && on_drum_page() && !drum_page,
              "a drum track: SEQ walks GRID, TIMING, PLAY, PATTERNS, CHAIN, SCENES, SONG and back to the GRID");
        home();
    }
    {   /* "@": the value as the card's screen shows it (HOME: LEVEL 0..100 and PAN as is; SEQ held: LEN a number) */
        static const struct { uint32_t lvl; const char *head, *act; } V[] = {
            {3, "A BIT QUIETER", "TURN KNOB 2 (LEVEL) TO "}, {2, "TO THE LEFT", "TURN KNOB 4 (PAN) TO "},
            {2, "A BIT QUIETER", "TURN KNOB 2 (LEVEL) TO "}, {1, "FOUR BARS, FOUR STEPS", "HOLD SEQ, KNOB 4 TO 4"},
            {1, "LONGER NOTES", "TURN KNOB 4 (GATE) TO 79%"}, {1, "LAID BACK: 86 BPM", "TURN SELECT TO 86 BPM"},
        };
        uint32_t i, j, bad = 0;
        char act[40], want[48];
        for (i = 0; i < NELEM(V); i++) {
            const tr_level_t *L = &TR_LEVELS[V[i].lvl - 1u];
            for (j = 0; j < L->n && !(!strcmp(L->cards[j].head, V[i].head) &&
                                      (L->cards[j].goal == TG_PARAM || L->cards[j].goal == TG_GLOBAL)); j++)
                ;
            act[0] = 0;
            if (j < L->n)
                tr_act(&L->cards[j], act, sizeof act);
            strcpy(want, V[i].act);
            if (j < L->n && L->cards[j].btn == B_HOME && L->cards[j].goal == TG_PARAM) {   /* HOME's dial (ui_studio.c) */
                mix_fmt(want + strlen(want), &trk[L->cards[j].trk], L->cards[j].p, L->cards[j].v);
            }
            if (strcmp(act, want)) {
                printf("  level %u %s: \"%s\", the screen shows \"%s\"\n", V[i].lvl, V[i].head, act, want);
                bad++;
            }
        }
        check(!bad, "a value to turn to reads as its screen shows it (HOME's LEVEL and PAN as their pages)");
    }
    for (l = 0; l < TR_NLEVELS; l++) {
        char what[96];
        snprintf(what, sizeof what, "level %u (%s): every card reached with the panel, DONE", l + 1u, TR_LEVELS[l].name);
        check(play_level(l, l == 0u ? "trainer-l1" : l == 1u ? "trainer-l2" : "trainer-l3"), what);
        song_settings(l, "");
        if (l == 1u) {                                   /* the verse and the chorus as the score has them */
            check(trk[2].pat == 0u && song.playing && scn_cur == 0u && !strcmp(N_SCN[scn_name[0]], "VERSE") &&
                  !strcmp(N_SCN[scn_name[1]], "CHORUS") && trk[3].pat_nchain == 2u && trk[3].pat_chain[0] == CH_SLOT(0, 3) &&
                  trk[3].pat_chain[1] == CH_SLOT(1, 1) && chain_on(&trk[3]),
                  "level 2 ends in the verse (scene 1 VERSE, scene 2 CHORUS), playing, the drums' chain 1 x3, 2");
        }
    }
    {
        char what[96];
        snprintf(what, sizeof what, "the cards about keys (%u): only their keys lit, no landmarks, no old steps", keyed_cards);
        check(keyed_cards > 20u, what);
        snprintf(what, sizeof what, "SEQ held, a note in hand: its steps stay lit until all are in (%u taps)", seq_taps);
        check(!seq_unlit && seq_taps > 10u, what);
        snprintf(what, sizeof what, "PATTERNS steps done by their hints alone (%u presses), from the track left on",
                 hint_steps);
        check(!hint_lost && hint_steps > 20u, what);
        snprintf(what, sizeof what, "drum steps: to the grid by their hints (%u presses)", grid_hints);
        check(!grid_lost && grid_hints > 1u, what);
        snprintf(what, sizeof what, "TURN ALGORITHM said only where it picks the track (%u), else TAP HOME first (%u)",
                 algo_said, algo_home);
        check(algo_said > 5u, what);
    }
    {   /* level 3's song as the lessons built it, from its start in song mode, to DIR/trainer-l3-song.wav (to compare with
         * the approved render, build/trainer/3-*.wav: tests/trainer_song_compare.py) */
        char path[512];
        FILE *f;
        uint32_t fr, i, n = (uint32_t)(40u * 4u * 60u * FS / 150u) / CTL * CTL;
        static int32_t o[CTL * 2];
        snprintf(path, sizeof path, "%s/trainer-l3-song.wav", outdir);
        transport_req = 2;
        frames(10);
        transport_req = 1;
        f = fopen(path, "wb");
        wav_hdr(f, n);
        for (fr = 0; fr < n; fr += CTL) {
            mix_block(o, CTL);
            for (i = 0; i < CTL; i++)
                wav_put(f, o[2u * i], o[2u * i + 1u]);
        }
        fclose(f);
        transport_req = 2;
        frames(5);
        transport_req = 1;
        frames(5);
    }
    {   /* level 3's song in song mode: the four sections saved, seven entries, it plays */
        uint32_t k, ok = 1;
        for (k = 0; k < 4u; k++)
            ok &= proj_ok(&proj_slot[k]);
        check(ok && arrangement.count == 7u && arrangement_enabled, "level 3: sections A-D saved, a song of 7 entries, song mode");
    }
    {   /* the picker: the levels done; one again from the start, progress in the log, back after a power cycle */
        uint8_t a[8];
        check(tr.done == 7u && tr_actions(0, a) == 1u && a[0] == TA_AGAIN, "the picker: three levels done, PLAY IT AGAIN");
        pick(0, TA_AGAIN);
        frames(30);                                      /* (the song stops, then the new project) */
        check(tr_on() && tr.lvl == 1u && tr.card == 0u && track_empty(&trk[3]),
              "a finished level, again: from its first card, a new project (no question)");
        pick(0, TA_SKIP);
        pick(0, TA_SKIP);
        frames(3);
        transport_req = 1;                               /* playing: progress is written all the same */
        frames(10);
        pick(0, TA_SKIP);
        frames(3);
        {
            uint8_t at = tr.card, done = tr.done;
            check(at == 3u && song.playing && !tr.dirty, "skipped to card 4 while playing: written to the log");
            memset(&tr, 0, sizeof tr);                   /* power off, power on */
            tr_log_boot();
            check(tr.lvl == 1u && tr.card == at && tr.done == done && tr.seen,
                  "after a power cycle: the level, its card, the levels done");
            tr_resume();
            check(tr.lvl == 1u, "resume keeps the level running");
        }
        {   /* the log filling its sector: erased once stopped, then written again */
            uint32_t e0 = tr_erases, i, at = tr.card;
            transport_req = 2;
            frames(5);
            for (i = 0; i < 300u; i++) {
                tr.dirty = 1;
                trainer_tick();
            }
            memset(&tr, 0, sizeof tr);
            tr_log_boot();
            check(tr_erases > e0 && tr.lvl == 1u && tr.card == at, "the log full: erased (stopped), the last record kept");
        }
        pick(0, TA_QUIT);
        check(!tr_on(), "QUIT THE LEVEL: the coach goes, the header is the page's again");
        pick(TR_NLEVELS, TA_MENU);
        check(ui.menu == 1u, "the picker's last page: BoopBox's menu");
        menu_close();
    }
    {   /* (1.9.1) level 4 is gone: a log record from before, in level 4 (its card and DONE bit), opens as three levels,
         * the others' progress kept */
        tr_rec_t r;
        uint8_t a[8];
        uint32_t done3 = tr.done & 7u;
        memset(&r, 0, sizeof r);
        r.mark = TR_MARK, r.lvl = TR_NLEVELS + 1u, r.card = 5, r.done = (uint8_t)(done3 | 1u << TR_NLEVELS), r.seen = 1;
        memcpy(r.at, tr.at, sizeof r.at);
        r.rsv[0] = 5;                                           /* (level 4's card, where the record kept it) */
        r.crc = st_crc32(&r, TR_REC - 4u);
        st_prog(TR_LOG + tr.log_at, &r, TR_REC);
        memset(&tr, 0, sizeof tr);
        tr_log_boot();
        check(tr.lvl == 0u && tr.done == done3 && tr.seen, "a record from level 4 (gone): three levels, their progress kept");
        tr_actions(TR_NLEVELS, a);
        check(a[0] == TA_MENU, "the picker's fourth page is BoopBox's menu");
    }
    {   /* (1.5.1) a line wider than the screen scrolls as a ticker: still first, to its end, still, then again; the band
         * redrawn as it moves, its last character on the screen at the end */
        static const char *const T = "STEP 12: PLAY F#5 (LIT KEY), THEN HOLD SEQ";
        int32_t over = tr_mq_over(T), w = text_w(&FONT_S, T);
        uint32_t len = tr_mq_len(T), run = (uint32_t)over * TR_MQ_PX, t, moves = 0, back = 0;
        int32_t last = 0, o;
        int ok = over > 0 && tr_marquee(T, 0) == 0 && tr_marquee(T, TR_MQ_HOLD - 1u) == 0 &&
                 tr_marquee(T, TR_MQ_HOLD + run) == over && 2 - over + w <= 238 && 2 - over + w >= 234 &&
                 tr_marquee(T, len) == 0 && tr_mq_len("A SHORT LINE") == 0 && tr_marquee("A SHORT LINE", 5000) == 0;
        for (t = 0; t < len; t += 10) {
            o = tr_marquee(T, t);
            moves += o != last && o > last, back += o < last;
            ok &= o >= 0 && o <= over && (o & 1) == 0;
            last = o;
        }
        ok &= moves >= (uint32_t)over / 2u - 1u && !back;
        char what[160];
        snprintf(what, sizeof what, "a line too wide scrolls: %d px over, %u ms a turn, its end on the screen (%u hints scrolled)",
                 over, len, hints_scrolled);
        check(ok, what);
    }
    {   /* the wrong page: every level again, each card first from seven screens (HOME's TRACKS, ENV, SEL, FX, SEQ's first
         * page, SCENES, SONG). A card that needs its own screen shows only the page card there, and its way gets there
         * (then the card is done as before) */
        uint32_t f0 = fails;
        char what[120];
        detour = 1;
        check(proj_ok(&proj_slot[0]) && proj_ok(&proj_slot[1]) && proj_ok(&proj_slot[2]) && proj_ok(&proj_slot[3]),
              "level 3 again: its sections A-D are still saved (SAVE IT AS: the same loop stored again counts)");
        arr_defaults(&arrangement);                     /* (the song as new: level 3's song steps from the wrong page too) */
        arrangement_enabled = 0;
        for (l = 0; l < TR_NLEVELS; l++) {
            snprintf(what, sizeof what, "level %u from the wrong page: done", l + 1u);
            check(play_level(l, NULL), what);
            song_settings(l, " from the wrong page");
        }
        detour = 0;
        snprintf(what, sizeof what, "resumed at each of %u steps of the first play: none goes back", resumes);
        check(resumes > 100u, what);
        snprintf(what, sizeof what, "the wrong page: %u page cards, each only the way to its screen, each got there",
                 detour_cards);
        check(fails == f0 && detour_cards > 0u, what);   /* (from TRACKS, ENV, SEL, FX, SEQ, SCENES and SONG) */
    }
    printf("trainer: %s\n", fails ? "FAIL" : "PASS");
    return fails != 0;
}
#endif
