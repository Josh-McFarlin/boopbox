/* SPDX-License-Identifier: GPL-3.0-only */
/* The PATTERNS and CHORDS screens.
 * PATTERNS (SEQ, a screen of its own, before SONG): the eight tracks' patterns (patbank.c) as a grid, a row a track,
 * a column a pattern: lit, the one playing; dim, one that holds something; dark, an empty one; a white frame blinking,
 * the one asked for (it waits for its boundary); a dot under it, a pattern of the track's chain.
 *   ALGORITHM the track, KNOB 1 the pattern (the cursor), OCT+ asks for it on the track, OCT- on every track (they
 *   change together on a bar quantization); KNOB 2 PAT Q (when a change happens: LOOP, 1, 2, 4 BAR); KNOB 3 the
 *   track's chain: OFF, or the cursor's pattern and the ones after it (2..8), each a loop, round; KNOB 4 right COPY
 *   (one detent arms, a second within 3 s copies the pattern playing into the cursor's), left CLEAR the cursor's
 *   (twice too). ENV / LFO open their pages, the layer buttons work as everywhere. Keys play. */
static uint8_t pats_cursor;
static uint8_t pats_arm;                         /* 1: COPY armed, 2: CLEAR armed (until pats_deadline) */
static uint32_t pats_deadline;
UI_SMALL static int on_pats_page(void) { return !ui.home && cur_page()->scope == SC_PATS; }
UI_SMALL static uint32_t pats_used(uint32_t k)   /* the patterns of track k that hold something, a bit each */
{
    return pb_used(k) | (pat_empty(&trk[k % NTRK]) ? 0u : 1u << trk[k % NTRK].pat);
}
UI_SMALL static void pats_poll(void)             /* (every frame) a change the ISR refused: said */
{
    if (pb_full) {
        pb_full = 0;
        ui_message("PATTERNS FULL: KEPT");
    }
}
UI_SMALL static void pats_screen_draw(void)
{
    static uint32_t previous;
    static const char *const QN[4] = {"loop", "1 bar", "2 bar", "4 bar"};
    uint32_t k, p, any = 0, blink = (fm1_ms / 250u) & 1u, sel = song.sel % NTRK;
    uint32_t sig = pats_cursor * 101u + sel * 103u + (uint32_t)song.g[G_PATQ] * 107u + song.playing * 109u + pb_n * 7u +
                   pats_arm * 113u;
    char b[24];
    for (k = 0; k < NTRK; k++) {
        const track_t *t = &trk[k];
        sig = sig * 31u + t->pat * 7u + t->pat_req * 13u + pats_used(k) * 17u + t->pat_nchain * 3u + t->pat_ci;
        for (p = 0; p < t->pat_nchain; p++)
            sig = sig * 5u + t->pat_chain[p];
        any |= t->pat_req;
    }
    if (any)
        sig += blink * 977u;
    if (!ui.force && !ui.msg_t && sig == previous)
        return;
    previous = ui.msg_t ? ~sig : sig;
    cv_begin(240, 40, C_BLACK);                  /* the head */
    cv_glow(20, 38);                             /* (1.1.0) SYNTHWAVE: a glow over the rule */
    cv_text(4, 4, &FONT_L, "PATTERNS", C_WHITE);
    str_cpy(b, "q ", 3);
    str_cpy(b + 2, QN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
    cv_text(236 - text_w(&FONT_S, b), 4, &FONT_S, b, UI_COL[2]);
    fmt_int(b, (int32_t)(pb_n * 100u / PB_SIZE));
    str_cpy(b + str_len(b), "% full", 8);
    cv_text(236 - text_w(&FONT_S, b), 20, &FONT_S, b, pb_n * 10u > PB_SIZE * 9u ? UI_RED : UI_G3);
    cv_rule(0, 39, 240, UI_G1);
    cv_blit(0, 0);
    for (k = 0; k < NTRK; k += 4u) {             /* the grid, four tracks a band (the canvas: 124 rows at most) */
        uint32_t r;
        cv_begin(240, 80, C_BLACK);
        for (r = 0; r < 4u; r++) {
            uint32_t ti = k + r, used = pats_used(ti);
            const track_t *t = &trk[ti];
            int32_t y = (int32_t)r * 20 + 1;
            fmt_int(b, (int32_t)ti + 1);
            cv_text(6, y + 1, &FONT_S, b, ti == sel ? C_WHITE : UI_COL[ti]);
            for (p = 0; p < NPAT; p++) {
                int32_t x = 22 + (int32_t)p * 27;
                uint32_t playing = p == t->pat, asked = t->pat_req && t->pat_req - 1u == p, inch = 0, c;
                uint16_t fill = playing ? UI_COL[ti] : ((used >> p) & 1u) ? UI_DIM[ti] : UI_G1;
                for (c = 0; c < t->pat_nchain; c++)
                    inch |= t->pat_chain[c] == p;
                cv_rect(x, y, 25, 16, fill);
                if (asked && blink) {
                    cv_rect(x, y, 25, 2, C_WHITE), cv_rect(x, y + 14, 25, 2, C_WHITE);
                    cv_rect(x, y, 2, 16, C_WHITE), cv_rect(x + 23, y, 2, 16, C_WHITE);
                }
                if (inch)
                    cv_rect(x + 10, y + 17, 5, 2, UI_G3);
                if (ti == sel && p == pats_cursor)
                    cv_rect(x, y + 17, 25, 2, C_WHITE);
                b[0] = (char)('1' + p), b[1] = 0;
                cv_text(x + 9, y, &FONT_S, b, playing ? C_BLACK : ((used >> p) & 1u) ? C_WHITE : UI_G3);
            }
        }
        cv_blit(0, 42u + k * 20u);
    }
    cv_begin(240, 38, C_BLACK);                  /* the knobs, or a message */
    if (ui.msg_t) {
        cv_rect(0, 4, 240, 30, C_WHITE);
        cv_text((240 - text_w(&FONT_S, ui.msg)) / 2, 11, &FONT_S, ui.msg, C_BLACK);
    } else {
        static const char *const L[4] = {"pattern", "quant", "chain", "copy/clr"};
        static char v[4][8];
        const track_t *t = &trk[sel];
        fmt_int(v[0], (int32_t)pats_cursor + 1);
        str_cpy(v[1], QN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
        if (t->pat_nchain)
            fmt_int(v[2], (int32_t)t->pat_nchain);
        else
            str_cpy(v[2], "off", 4);
        str_cpy(v[3], pats_arm ? "again" : "to ", 6);
        if (!pats_arm)
            fmt_int(v[3] + 3, (int32_t)pats_cursor + 1);
        for (k = 0; k < 4u; k++) {
            cv_rect((int32_t)k * 60 + 4, 2, 52, 3, UI_COL[k]);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, L[k]) / 2, 6, &FONT_S, L[k], UI_G3);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, v[k]) / 2, 21, &FONT_S, v[k],
                    ui.hot_t && ui.hot_col == k ? C_WHITE : UI_G4);
        }
    }
    cv_blit(0, 202);
}
UI_SMALL static void pats_ask(uint32_t k, uint32_t p)   /* a change of track k to pattern p (quantized: patbank.c) */
{
    trk[k % NTRK].pat_req = (uint8_t)(p % NPAT + 1u);
}
UI_SMALL static void pats_screen_input(uint32_t pressed, uint32_t home)
{
    uint32_t k, sel = song.sel % NTRK;
    int32_t s;
    track_t *t = &trk[sel];
    if (home == 1u) {
        go_home();
        return;
    }
    if (pats_arm && (int32_t)(fm1_ms - pats_deadline) > 0)
        pats_arm = 0;
    for (k = 0; k < NB; k++) {
        uint32_t b = k;
        if (!((pressed >> panel.btn[k]) & 1u))
            continue;
        if (b == B_PLAY) {
            if (!ft_owns_press())
                transport_req = song.playing ? 2 : 1;
        } else if (b == B_SEQ) {
            open_family(FAM_SEQ);                    /* (the next SEQ screen: SONG) */
            return;
        } else if (b == B_OCTUP) {
            pats_ask(sel, pats_cursor);
            ui_message(song.playing ? "PATTERN ASKED" : "PATTERN");
        } else if (b == B_OCTDN) {
            uint32_t i;
            for (i = 0; i < NTRK; i++)
                pats_ask(i, pats_cursor);
            ui_message(song.playing ? "EVERY TRACK ASKED" : "EVERY TRACK");
        } else if (b == B_ENV) {
            open_family(FAM_ENV);
            return;
        } else if (b == B_LFO) {
            open_family(FAM_LFO);
            return;
        }
    }
    if ((s = panel_enc(EN_ALGO)) != 0 && !ft_on)     /* (ALGORITHM picks the track here too, as on TRACKS) */
        track_select((uint32_t)clamp((int32_t)song.sel + s, 0, NTRK - 1));
    for (k = 0; k < 4u; k++) {
        if ((s = panel_enc(EN_K1 + k)) == 0)
            continue;
        ui.hot_col = (uint8_t)k;
        ui.hot_t = 40;
        if (k != 3u)
            pats_arm = 0;
        if (k == 0u) {
            pats_cursor = (uint8_t)clamp((int32_t)pats_cursor + s, 0, NPAT - 1);
        } else if (k == 1u) {
            song.g[G_PATQ] = (int16_t)clamp(song.g[G_PATQ] + s, PQ_LOOP, PQ_4BAR);
        } else if (k == 2u) {                        /* the chain: OFF, or 2..8 patterns from the cursor's */
            uint8_t ch[NPAT];
            uint32_t n = t->pat_nchain, i;
            int32_t m = (int32_t)n + s;
            m = m < 2 ? (s > 0 ? 2 : 0) : m > NPAT ? NPAT : m;
            if (n == 0u && s < 0)
                m = 0;
            for (i = 0; i < (uint32_t)m; i++)
                ch[i] = (uint8_t)((pats_cursor + i) % NPAT);
            fm1_irq_off();
            pat_chain_set(t, ch, (uint32_t)m);
            fm1_irq_on();
        } else if (s < 0) {                          /* CLEAR the cursor's pattern of the track: twice */
            if (pats_arm != 2u) {
                pats_arm = 2;
                pats_deadline = fm1_ms + 3000u;
                ui_message("TURN AGAIN: CLEAR");
            } else {
                pats_arm = 0;
                fm1_irq_off();
                if (pats_cursor == t->pat) {
                    locks_restore(t);
                    steps_clear(t);
                } else {
                    pb_drop(sel, pats_cursor);
                }
                fm1_irq_on();
                ui_message("PATTERN CLEARED");
            }
        } else {                                     /* COPY: the pattern playing into the cursor's */
            if (pats_arm != 1u) {
                pats_arm = 1;
                pats_deadline = fm1_ms + 3000u;
                ui_message("TURN AGAIN: COPY");
            } else {
                int ok = 1;
                pats_arm = 0;
                if (pats_cursor != t->pat) {
                    fm1_irq_off();
                    ok = pb_store(sel, pats_cursor);
                    fm1_irq_on();
                }
                ui_message(ok ? "PATTERN COPIED" : "PATTERNS FULL: NO COPY");
            }
        }
    }
    panel_enc(EN_SELECT);                            /* (no hidden action here) */
    panel_enc(EN_PRESET);
}

/* CHORDS (SEL, a screen of its own, after FOLLOW): the song's harmony (harmony.c). Its key and scale, the chord playing
 * (live: the keys; else the progression's, or I); the progression's chords (a roman numeral, its bars) with the one
 * playing lit; the eight tracks and how each follows (- off, T trans, S scale).
 *   The keys play chords: a white key its degree (F IV, G V .. as C I), a black key none (back to the progression, or
 *   I): latched, on G_HQ's boundary. KNOB 1 the chord of the progression, KNOB 2 its degree, KNOB 3 its bars, KNOB 4
 *   how many (1..8); PRESETS the key, SELECT the scale; ALGORITHM the track, OCT+ its FOLLOW round (OFF TRANS SCALE),
 *   OCT- PROG on / off. ENV / LFO open their pages. */
static uint8_t chords_cursor;
UI_SMALL static int on_chords_page(void) { return !ui.home && cur_page()->scope == SC_HARM; }
UI_SMALL static void chords_screen_draw(void)
{
    static uint32_t previous;
    static const char *const QN[3] = {"now", "beat", "bar"};
    static const char *const FL[3] = {"-", "T", "S"};
    uint32_t k, sel = song.sel % NTRK, n = harm.n >= 1u && harm.n <= NHPROG ? harm.n : 1u;
    uint32_t sig = chords_cursor * 7u + sel * 11u + (uint32_t)song.g[G_HKEY] * 13u + (uint32_t)song.g[G_HSCL] * 17u +
                   (uint32_t)song.g[G_HQ] * 19u + (uint32_t)song.g[G_HPROG] * 23u + harm.deg * 29u + harm.live * 31u +
                   harm.idx * 37u + song.playing * 41u + n * 43u + harm.key * 47u + harm.scl * 53u;
    char b[24];
    for (k = 0; k < NHPROG; k++)
        sig = sig * 31u + harm.c[k].deg * 3u + harm.c[k].bars;
    for (k = 0; k < NTRK; k++)
        sig = sig * 3u + (uint32_t)trk[k].hfol + 5u * is_drum(&trk[k]);
    if (!ui.force && !ui.msg_t && sig == previous)
        return;
    previous = ui.msg_t ? ~sig : sig;
    cv_begin(240, 40, C_BLACK);                  /* the head: the key and scale asked for, when */
    cv_glow(20, 38);                             /* (1.1.0) SYNTHWAVE: a glow over the rule */
    cv_text(4, 4, &FONT_L, "CHORDS", C_WHITE);
    str_cpy(b, N_HKEY[(uint32_t)clamp(song.g[G_HKEY], 0, 11)], 4);
    str_cpy(b + str_len(b), " ", 2);
    str_cpy(b + str_len(b), N_SCALE[(uint32_t)clamp(song.g[G_HSCL], 0, NSCALES - 1)], 6);
    cv_text(236 - text_w(&FONT_S, b), 4, &FONT_S, b, UI_COL[2]);
    str_cpy(b, "q ", 3);
    str_cpy(b + 2, QN[(uint32_t)clamp(song.g[G_HQ], 0, 2)], 6);
    cv_text(236 - text_w(&FONT_S, b), 20, &FONT_S, b, UI_G3);
    cv_rule(0, 39, 240, UI_G1);
    cv_blit(0, 0);
    cv_begin(240, 124, C_BLACK);                 /* the chord now, the progression, the tracks */
    cv_text(4, 2, &FONT_L, H_ROMAN[harm.deg % 7u], C_WHITE);
    cv_text(84, 4, &FONT_S, harm.live ? "live" : song.g[G_HPROG] ? "progression" : "no progression", harm.live ? UI_COL[0] : UI_G3);
    str_cpy(b, "in ", 4);
    str_cpy(b + 3, N_HKEY[harm.key % 12u], 4);
    str_cpy(b + str_len(b), " ", 2);
    str_cpy(b + str_len(b), N_SCALE[harm.scl % NSCALES], 6);
    cv_text(84, 20, &FONT_S, b, UI_G4);
    for (k = 0; k < NHPROG; k++) {               /* the progression: two rows of four */
        int32_t x = 2 + (int32_t)(k % 4u) * 60, y = 40 + (int32_t)(k / 4u) * 30;
        uint32_t used = k < n, on = used && song.g[G_HPROG] && !harm.live && k == harm.idx;
        cv_rect(x, y, 56, 26, on ? UI_COL[1] : used ? UI_G2 : UI_G1);
        if (used) {
            cv_text(x + 4, y + 5, &FONT_S, H_ROMAN[harm.c[k].deg % 7u], on ? C_BLACK : C_WHITE);
            fmt_int(b, harm.c[k].bars);
            str_cpy(b + str_len(b), "b", 2);
            cv_text(x + 52 - text_w(&FONT_S, b), y + 5, &FONT_S, b, on ? C_BLACK : UI_G4);
        }
        if (k == chords_cursor)
            cv_rect(x, y + 27, 56, 2, C_WHITE);
    }
    for (k = 0; k < NTRK; k++) {                 /* the tracks: how each follows */
        int32_t x = 2 + (int32_t)k * 30;
        uint32_t f = (uint32_t)trk[k].hfol < HF_COUNT ? (uint32_t)trk[k].hfol : 0u;
        cv_rect(x, 104, 26, 18, k == sel ? UI_COL[k] : UI_G1);
        fmt_int(b, (int32_t)k + 1);
        cv_text(x + 2, 105, &FONT_S, b, k == sel ? C_BLACK : UI_COL[k]);
        cv_text(x + 16, 105, &FONT_S, is_drum(&trk[k]) ? " " : FL[f], k == sel ? C_BLACK : f ? C_WHITE : UI_G3);
    }
    cv_blit(0, 42);
    lcd_fill(0, 166, 240, 36, C_BLACK);          /* (1.1.0) the rows under the tracks: what the page before drew there
                                                  * (a graph, SYNTHWAVE's floor on FOLLOW) went on showing */
    cv_begin(240, 38, C_BLACK);                  /* the knobs, or a message */
    if (ui.msg_t) {
        cv_rect(0, 4, 240, 30, C_WHITE);
        cv_text((240 - text_w(&FONT_S, ui.msg)) / 2, 11, &FONT_S, ui.msg, C_BLACK);
    } else {
        static const char *const L[4] = {"chord", "degree", "bars", "count"};
        static char v[4][8];
        fmt_int(v[0], (int32_t)chords_cursor + 1);
        str_cpy(v[1], H_ROMAN[harm.c[chords_cursor % NHPROG].deg % 7u], 4);
        fmt_int(v[2], harm.c[chords_cursor % NHPROG].bars);
        fmt_int(v[3], (int32_t)n);
        for (k = 0; k < 4u; k++) {
            cv_rect((int32_t)k * 60 + 4, 2, 52, 3, UI_COL[k]);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, L[k]) / 2, 6, &FONT_S, L[k], UI_G3);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, v[k]) / 2, 21, &FONT_S, v[k],
                    ui.hot_t && ui.hot_col == k ? C_WHITE : UI_G4);
        }
    }
    cv_blit(0, 202);
}
UI_SMALL static void chords_screen_input(uint32_t pressed, uint32_t home)
{
    uint32_t k, sel = song.sel % NTRK;
    int32_t s;
    track_t *t = &trk[sel];
    if (home == 1u) {
        go_home();
        return;
    }
    if (harm.n < 1u || harm.n > NHPROG)
        harm.n = 1;
    if (chords_cursor >= harm.n)
        chords_cursor = (uint8_t)(harm.n - 1u);
    for (k = 0; k < NB; k++) {
        uint32_t b = k;
        if (!((pressed >> panel.btn[k]) & 1u))
            continue;
        if (b == B_PLAY) {
            if (!ft_owns_press())
                transport_req = song.playing ? 2 : 1;
        } else if (b == B_OCTUP) {
            if (is_drum(t)) {
                ui_message("DRUM TRACK: NO FOLLOW");
            } else {
                t->hfol = (int16_t)((t->hfol + 1) % HF_COUNT);
                ui_say("FOLLOW ", N_HFOL[(uint32_t)t->hfol % HF_COUNT]);
            }
        } else if (b == B_OCTDN) {
            song.g[G_HPROG] = (int16_t)!song.g[G_HPROG];
            ui_message(song.g[G_HPROG] ? "PROGRESSION ON" : "PROGRESSION OFF");
        } else if (b == B_ENV) {
            open_family(FAM_ENV);
            return;
        } else if (b == B_LFO) {
            open_family(FAM_LFO);
            return;
        }
    }
    if ((s = panel_enc(EN_ALGO)) != 0 && !ft_on)     /* (ALGORITHM picks the track here too, as on TRACKS) */
        track_select((uint32_t)clamp((int32_t)song.sel + s, 0, NTRK - 1));
    if ((s = panel_enc(EN_PRESET)) != 0)
        song.g[G_HKEY] = (int16_t)(((int32_t)song.g[G_HKEY] + s % 12 + 24) % 12);
    if ((s = panel_enc(EN_SELECT)) != 0)
        song.g[G_HSCL] = (int16_t)clamp(song.g[G_HSCL] + s, 0, NSCALES - 1);
    for (k = 0; k < 4u; k++) {
        hchord_t *c = &harm.c[chords_cursor % NHPROG];
        if ((s = panel_enc(EN_K1 + k)) == 0)
            continue;
        ui.hot_col = (uint8_t)k;
        ui.hot_t = 40;
        if (k == 0u)
            chords_cursor = (uint8_t)clamp((int32_t)chords_cursor + s, 0, harm.n - 1);
        else if (k == 1u)
            c->deg = (uint8_t)clamp((int32_t)c->deg + s, 0, 6);
        else if (k == 2u)
            c->bars = (uint8_t)clamp((int32_t)c->bars + s, 1, 16);
        else
            harm.n = (uint8_t)clamp((int32_t)harm.n + s, 1, NHPROG);
    }
}
