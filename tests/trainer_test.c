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
    if (on_pats_page())
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
static void pat_copy_to(uint32_t k, uint32_t pat)          /* KNOB 4 right twice: the pattern playing into the cursor's */
{
    pats_screen();
    algo_to(k);
    while (pats_cursor != pat)
        slow(EN_K1, pats_cursor < pat ? 1 : -1);
    slow(EN_K4, 1);
    slow(EN_K4, 1);
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
        if (!strcmp(h, "TAP SEQ UNTIL PATTERNS"))
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
        else if (tr_prefix(h, "KNOB 4 RIGHT"))
            slow(EN_K4, 1);
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
        if (PAGES[c->p].scope == SC_PATS && hint_tries++ == 0u) {   /* (as the step and its hints say, from anywhere) */
            if (pats_from_drum++ == 0u && !is_drum(TSEL) && !on_pats_page()) {
                home();                                  /* (once: from a drum track, where SEQ has no way there) */
                algo_to(3);
                tap(B_SEQ);
                check(is_drum(TSEL) && on_drum_page() && !tr_goal(c) && (!tr.hint[0] || !strcmp(tr.hint, "TAP SEQ UNTIL PATTERNS")),
                      "PATTERNS from a drum track's grid: TAP SEQ UNTIL PATTERNS (GRID, KIT, SOUND, PATTERNS)");
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
            tap(B_SAVE);
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
        if (proj_slot[c->v].sum == tr.base)              /* a used section: the key again */
            key(key_of_white(4u + (uint32_t)c->v));
        let_go(B_SAVE);
        break;
    case TG_SONG: {
        const uint8_t *d = &TR_D[c->data];
        uint32_t k, g = 40;
        if (!on_song_page()) { home(); tap(B_SAVE); }
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
        if (!on_song_page()) { home(); tap(B_SAVE); }
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
    while (tr.card < L->n - 1u) {
        const tr_card_t *c = tr_card();
        uint32_t at = tr.card;
        frames(3);
        if (shots && (at < 3u || at % 9u == 0u)) {
            frames(5);
            snprintf(name, sizeof name, "%s-%02u-head", shots, at + 1u);
            ppm(outdir, name);
        }
        {   /* the card's text fits the screen; a card about keys: only its keys lit */
            char act[40];
            tr_act(c, act, sizeof act);
            if (text_w(&FONT_S, act) > 236 || text_w(&FONT_S, c->head) > 236 - 6 * 8 ||
                (tr_goal(c), text_w(&FONT_S, tr.hint) > 236)) {
                printf("trainer: level %u card %u: too wide: %s / %s / %s\n", l + 1u, at + 1u, c->head, act, tr.hint);
                fails++;
            }
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
            turn = tr_prefix(act, "TURN ALGORITHM") || tr_prefix(tr.hint, "TURN ALGORITHM");
            home_first = tr_prefix(act, "TAP HOME, ALGORITHM") || tr_prefix(tr.hint, "TAP HOME, ALGORITHM");
            if (turn) {
                uint32_t was = song.sel;
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
        hint_tries = 0;
        for (tries = 0; tries < 3u && tr.card == at; tries++) {
            if (hint_tries == 1u && tries == 1u && (c->goal == TG_PATSEL || c->goal == TG_PATS || c->goal == TG_PATHAS ||
                                                    c->goal == TG_PAGE)) {
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

/* ---------------------------------------------------------------- level 4: a song in the song area --- */
static uint32_t tg_size(const tr_card_t *c, const uint8_t *d)   /* a card's target in the targets: its bytes */
{
    uint32_t n, i;
    switch (c->goal) {
    case TG_NOTES:
        for (n = 1, i = 0; i < d[0]; i++)
            n += (d[n] & 3u) == 1u ? 2u + d[n + 1u] : 1u;
        return n;
    case TG_LANES: return 2u + d[1] * (d[0] + 1u);
    case TG_LOCK: return 1;
    case TG_PATS: return NTRK;
    case TG_SONG: return c->flags & 1u ? 1u : 1u + 2u * d[0];
    default: return 0;
    }
}
static void put16(uint8_t *b, uint32_t o, uint32_t v) { b[o] = (uint8_t)v, b[o + 1u] = (uint8_t)(v >> 8); }
static void json_str(FILE *f, const char *k, const char *v, const char *end)
{
    fprintf(f, "\"%s\": \"", k);
    for (; *v; v++)
        fprintf(f, *v == '"' || *v == '\\' ? "\\%c" : "%c", *v);
    fprintf(f, "\"%s", end);
}
/* level l as a song in the area b (TR_SLOT_SIZE): its cards, the targets they use (each once, in card order), the
 * strings (each once: the picker's four lines, then each card's headline and action). DIR/trainer-song.json is the
 * same song for web/trslot.js (tests/run_tests.sh: the two encodings agree) */
static uint32_t song_of(uint32_t l, uint8_t *b, const char *json)
{
    const tr_level_t *L = &TR_LEVELS[l];
    static uint8_t tg[TR_SLOT_SIZE];
    static uint16_t dat[TR_C4MAX];
    static const char *str[2u * TR_C4MAX + 4u];
    static uint16_t at[2u * TR_C4MAX + 4u];
    const char *mine[4];
    uint32_t i, k, ns = 0, nt = 0, o, toff = 32u + 16u * L->n;
    FILE *f;
    mine[0] = L->name, mine[1] = L->style, mine[2] = L->learn1, mine[3] = L->learn2;
    for (i = 0; i < L->n; i++) {
        const tr_card_t *c = &L->cards[i];
        uint32_t sz = tg_size(c, &TR_DATA[c->data]);
        dat[i] = c->data;
        if (sz) {
            memcpy(tg + nt, &TR_DATA[c->data], sz);
            dat[i] = (uint16_t)nt;
            nt += sz;
        }
    }
    o = toff + nt;
#define STR(x) do { for (k = 0; k < ns && strcmp(str[k], (x)); k++) ; if (k == ns) { str[ns] = (x); at[ns++] = (uint16_t)o; o += strlen(x) + 1u; } } while (0)
    for (i = 0; i < 4u; i++)
        STR(mine[i]);
    for (i = 0; i < L->n; i++) {
        STR(L->cards[i].head);
        STR(L->cards[i].act);
    }
    memset(b, 0xFF, TR_SLOT_SIZE);
    memcpy(b, "BOOPSONG", 8);
    memset(b + 16, 0, o - 16u);
    b[16] = L->n;
    put16(b, 18, toff), put16(b, 20, nt);
#define AT(x) ({ uint32_t j_; for (j_ = 0; strcmp(str[j_], (x)); j_++) ; at[j_]; })
    for (i = 0; i < 4u; i++)
        put16(b, 22u + 2u * i, AT(mine[i]));
    for (i = 0; i < L->n; i++) {
        const tr_card_t *c = &L->cards[i];
        uint8_t *q = b + 32u + 16u * i;
        put16(q, 0, AT(c->head)), put16(q, 2, AT(c->act));
        q[4] = c->goal, q[5] = c->trk, q[6] = c->p, q[7] = c->btn;
        put16(q, 8, (uint16_t)c->v);
        q[10] = c->tol, q[11] = c->flags;
        put16(q, 12, dat[i]);
        q[14] = c->why;
    }
    memcpy(b + toff, tg, nt);
    for (k = 0; k < ns; k++)
        memcpy(b + at[k], str[k], strlen(str[k]));
    put16(b, 8, o), put16(b, 10, 1);
    {
        uint32_t crc = st_crc32(b + 16, o - 16u);
        put16(b, 12, crc), put16(b, 14, crc >> 16);
    }
    if (json && (f = fopen(json, "w"))) {
        fprintf(f, "{");
        json_str(f, "name", mine[0], ", "), json_str(f, "style", mine[1], ", ");
        json_str(f, "learn1", mine[2], ", "), json_str(f, "learn2", mine[3], ",\n");
        fprintf(f, "\"targets\": [");
        for (i = 0; i < nt; i++)
            fprintf(f, "%s%u", i ? "," : "", tg[i]);
        fprintf(f, "],\n\"cards\": [\n");
        for (i = 0; i < L->n; i++) {
            const tr_card_t *c = &L->cards[i];
            fprintf(f, " {");
            json_str(f, "head", c->head, ", "), json_str(f, "act", c->act, ", ");
            fprintf(f, "\"goal\": %u, \"trk\": %u, \"p\": %u, \"btn\": %u, \"v\": %d, \"tol\": %u, \"flags\": %u, "
                       "\"data\": %u, \"why\": %u}%s\n", c->goal, c->trk, c->p, c->btn, c->v, c->tol, c->flags, dat[i],
                    c->why, i + 1u < L->n ? "," : "");
        }
        fprintf(f, "]}\n");
        fclose(f);
    }
    return o;
#undef STR
#undef AT
}
static void reseal(uint8_t *b)                            /* the CRC again after a change */
{
    uint32_t used = b[8] | b[9] << 8, crc = st_crc32(b + 16, used - 16u);
    put16(b, 12, crc), put16(b, 14, crc >> 16);
}
static int damaged(const uint8_t *good, uint32_t at, uint8_t v, int crc)   /* one byte changed: refused? */
{
    static uint8_t b[TR_SLOT_SIZE];
    memcpy(b, good, sizeof b);
    b[at] = v;
    if (crc)
        reseal(b);
    return !tr_slot_load(b) && tr_nlv == TR_NLEVELS && tr_l4.n == 0;
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
            else if (w == 1u) tap(B_SAVE);
            else open_page(B_SCL, "CHORDS");
            frames(10);
            for (y = 40; y < 42u; y++)
                for (x = 0; x < 240u; x++)
                    bad += screen[y * 240 + x] != screen[y * 240];   /* (each row one colour: no text) */
        }
        check(!bad, "PATTERNS, SONG, CHORDS: nothing left over the list from the screen before (rows 40-41)");
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
        ok = on_pats_page() && song.sel == 3u;
        tap(B_SEQ);
        check(ok && on_drum_page() && !drum_page, "a drum track: SEQ walks GRID, KIT, SOUND, PATTERNS and back to the GRID");
        home();
    }
    {   /* "@": the value as the card's screen shows it (HOME: LEVEL 0..100 and PAN as is; SEQ held: LEN a number) */
        static const struct { uint32_t lvl; const char *head, *act; } V[] = {
            {3, "A BIT QUIETER", "TAP HOME, KNOB 2 TO "}, {2, "TO THE LEFT", "ON HOME: KNOB 4 TO "},
            {2, "A BIT QUIETER", "ON HOME: KNOB 2 TO "}, {1, "FOUR BARS, FOUR STEPS", "HOLD SEQ, KNOB 4 TO 4"},
            {1, "LONGER NOTES", "TURN KNOB 4 (GATE) TO 79%"}, {1, "LAID BACK: 86 BPM", "TAP HOME, SELECT TO 86 BPM"},
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
        {   /* every setting of the approved song is on the FM-1 (the lessons left none out) */
            uint32_t i, bad = 0;
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
            snprintf(what, sizeof what, "level %u: every setting of the approved song is on the FM-1", l + 1u);
            check(!bad, what);
        }
        if (l == 1u) {                                   /* the verse and the chorus as the score has them */
            check(trk[3].pat == 1u && trk[2].pat == 1u && song.playing, "level 2 ends in the chorus (pattern 2), playing");
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
        check(!grid_lost && grid_hints > 3u, what);
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
    {   /* level 4: the image's song area is empty; a song written there (level 2, as the web page writes one) is level 4,
         * played to DONE with the panel like the others; a damaged area is refused; the progress is its song's */
        static uint8_t slot[TR_SLOT_SIZE], other[TR_SLOT_SIZE];
        char path[512], what[128];
        uint32_t used, i, bad = 0, ok, want, done3;
        uint8_t a[8];
        FILE *f;
        check(!tr_slot_load(tr_slot()) && tr_nlv == TR_NLEVELS && !memcmp(tr_slot(), "BOOPSONG", 8),
              "the image's song area: the magic, no song (three levels)");
        snprintf(path, sizeof path, "%s/trainer-song.json", outdir);
        used = song_of(1, slot, path);
        snprintf(path, sizeof path, "%s/trainer-song.bin", outdir);
        if ((f = fopen(path, "wb")))
            fwrite(slot, 1, sizeof slot, f), fclose(f);
        snprintf(what, sizeof what, "level 2 as a song: %u cards in %u of %u B", TR_LEVELS[1].n, used, TR_SLOT_SIZE);
        check(used <= TR_SLOT_SIZE, what);
        check(tr_slot_load(slot) && tr_nlv == TR_NLV && tr_l4.n == TR_LEVELS[1].n && !strcmp(tr_l4.name, "NEON AVENUE"),
              "the song area with a song: level 4");
        {   /* the three levels built in, as songs: the biggest fits */
            static uint8_t b[TR_SLOT_SIZE];
            for (i = 0, ok = 1; i < TR_NLEVELS; i++) {
                uint32_t u = song_of(i, b, 0);
                printf("trainer: level %u as a song: %u B\n", i + 1u, u);
                ok &= u <= TR_SLOT_SIZE;
            }
            check(ok, "each level built in fits the song area as a song");
            tr_slot_load(slot);
        }
        ok = 1;
        ok &= damaged(slot, 0, 'X', 0);                         /* the magic */
        ok &= damaged(slot, 40, slot[40] ^ 1u, 0);               /* a byte: the CRC */
        ok &= damaged(slot, 10, 2, 1);                           /* another format */
        ok &= damaged(slot, 16, 1, 1);                           /* one card */
        ok &= damaged(slot, 16, 200, 1);                         /* more cards than RAM for them */
        ok &= damaged(slot, 32u + 4u, TG_DONE + 1u, 1);          /* a goal */
        ok &= damaged(slot, 32u + 5u, 9, 1);                     /* a track */
        ok &= damaged(slot, 32u + 14u, TR_NWHY, 1);              /* a topic */
        ok &= damaged(slot, 32u + 16u * (TR_LEVELS[1].n - 1u) + 4u, TG_PLAY, 1);   /* the last card not DONE */
        for (i = 0, want = 0; i < TR_LEVELS[1].n; i++)           /* the kinds of target the song has */
            want |= tr_c4[i].goal == TG_LANES ? 1u : tr_c4[i].goal == TG_NOTES ? 2u : tr_c4[i].goal == TG_PATS ? 4u :
                    tr_c4[i].goal == TG_PARAM ? 8u : 0u;
        for (i = 0; i < TR_LEVELS[1].n; i++) {                   /* a target out of range, each kind */
            const tr_card_t *c = &tr_c4[i];
            uint32_t t = (slot[18] | slot[19] << 8) + c->data;
            if (c->goal == TG_LANES && !(bad & 1))
                ok &= damaged(slot, t, NSTEP + 1u, 1) && damaged(slot, t + 2u, DRUM_LANES, 1), bad |= 1;
            if (c->goal == TG_NOTES && !(bad & 2))
                ok &= damaged(slot, t, 0, 1) && damaged(slot, t + 1u, 3, 1), bad |= 2;
            if (c->goal == TG_PATS && !(bad & 4))
                ok &= damaged(slot, t, NPAT, 1), bad |= 4;
            if (c->goal == TG_PARAM && !(bad & 8))
                ok &= damaged(slot, 32u + 16u * i + 6u, 255, 1), bad |= 8;
        }
        ok &= damaged(slot, slot[22] | slot[23] << 8, 0x80, 1);  /* a string not printable */
        {   /* a string with no end within the song */
            static uint8_t b[TR_SLOT_SIZE];
            memcpy(b, slot, sizeof b);
            put16(b, 32, used);
            reseal(b);
            ok &= !tr_slot_load(b);
        }
        check(ok && bad == want && want >= 11u, "a damaged song area is refused field by field (no level 4)");
        check(tr_slot_load(slot) && tr_nlv == TR_NLV, "the song again: level 4");
        snprintf(what, sizeof what, "level 4 (%s, the song area): every card reached with the panel, DONE", tr_l4.name);
        check(play_level(TR_NLEVELS, "trainer-l4"), what);
        for (i = 0, bad = 0; i < NELEM(TR_CHECK); i++) {
            int32_t have;
            if (TR_CHECK[i].lvl != 2u)
                continue;
            have = TR_CHECK[i].trk == 255u ? song.g[TR_CHECK[i].id] : trk[TR_CHECK[i].trk].p[TR_CHECK[i].id];
            bad += have - TR_CHECK[i].v > 4 || TR_CHECK[i].v - have > 4;
        }
        check(!bad && trk[3].pat == 1u && trk[2].pat == 1u, "level 4: every setting of its song (level 2's) is on the FM-1");
        done3 = tr.done & 7u;
        check(((tr.done >> TR_NLEVELS) & 1u) && tr_actions(TR_NLEVELS, a) == 1u && a[0] == TA_AGAIN,
              "the picker: level 4 done, PLAY IT AGAIN");
        pick(TR_NLEVELS, TA_AGAIN);
        frames(30);
        pick(TR_NLEVELS, TA_SKIP);
        pick(TR_NLEVELS, TA_SKIP);
        frames(3);
        {
            uint8_t at = tr.card;
            memset(&tr, 0, sizeof tr);                         /* power off, the same song: level 4 where it was */
            tr_slot_load(slot);
            tr_log_boot();
            check(tr.lvl == TR_NLV && tr.card == at && tr.at[TR_NLEVELS] == at, "after a power cycle: level 4, its card");
            memcpy(other, slot, sizeof other);                 /* another song installed: level 4 from its start */
            other[(other[22] | other[23] << 8)] = 'M';
            reseal(other);
            memset(&tr, 0, sizeof tr);
            tr_slot_load(other);
            tr_log_boot();
            check(tr.lvl == 0u && tr.at[TR_NLEVELS] == 0u && !((tr.done >> TR_NLEVELS) & 1u) && (tr.done & 7u) == done3,
                  "another song in the area: its progress from the start (the other levels' kept)");
            memset(&tr, 0, sizeof tr);                         /* no song: three levels, level 4's progress gone */
            tr_slot_load(tr_slot());
            tr_log_boot();
            check(tr_nlv == TR_NLEVELS && tr.lvl == 0u && tr.at[TR_NLEVELS] == 0u, "the song area emptied: three levels");
            tr_actions(TR_NLEVELS, a);
            check(a[0] == TA_MENU, "no song: the picker's fourth page is BoopBox's menu");
        }
        tr_slot_load(slot);
        pick(TR_NLEVELS + 1u, TA_MENU);
        check(ui.menu == 1u, "with a song: the menu is the fifth page");
        menu_close();
        ui.force = 1;
    }
    printf("trainer: %s\n", fails ? "FAIL" : "PASS");
    return fails != 0;
}
#endif
