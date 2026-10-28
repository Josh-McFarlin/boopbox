/* SPDX-License-Identifier: GPL-3.0-only */
/* PATTERNS (SEQ, a screen of its own, before SONG): the eight tracks' patterns (patbank.c) as a grid, a row a track,
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
        ui_message("PATTERNS FULL: NOT CHANGED");
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
    cv_text(4, 4, &FONT_L, "PATTERNS", C_WHITE);
    str_cpy(b, "q ", 3);
    str_cpy(b + 2, QN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
    cv_text(236 - text_w(&FONT_S, b), 4, &FONT_S, b, TE_COL[2]);
    fmt_int(b, (int32_t)(pb_n * 100u / PB_SIZE));
    str_cpy(b + str_len(b), "% full", 8);
    cv_text(236 - text_w(&FONT_S, b), 20, &FONT_S, b, pb_n * 10u > PB_SIZE * 9u ? TE_RED : TE_G3);
    cv_rect(0, 39, 240, 1, TE_G1);
    cv_blit(0, 0);
    for (k = 0; k < NTRK; k += 4u) {             /* the grid, four tracks a band (the canvas: 124 rows at most) */
        uint32_t r;
        cv_begin(240, 80, C_BLACK);
        for (r = 0; r < 4u; r++) {
            uint32_t ti = k + r, used = pats_used(ti);
            const track_t *t = &trk[ti];
            int32_t y = (int32_t)r * 20 + 1;
            fmt_int(b, (int32_t)ti + 1);
            cv_text(6, y + 1, &FONT_S, b, ti == sel ? C_WHITE : TE_COL[ti & 3u]);
            for (p = 0; p < NPAT; p++) {
                int32_t x = 22 + (int32_t)p * 27;
                uint32_t playing = p == t->pat, asked = t->pat_req && t->pat_req - 1u == p, inch = 0, c;
                uint16_t fill = playing ? TE_COL[ti & 3u] : ((used >> p) & 1u) ? TE_DIM[ti & 3u] : TE_G1;
                for (c = 0; c < t->pat_nchain; c++)
                    inch |= t->pat_chain[c] == p;
                cv_rect(x, y, 25, 16, fill);
                if (asked && blink) {
                    cv_rect(x, y, 25, 2, C_WHITE), cv_rect(x, y + 14, 25, 2, C_WHITE);
                    cv_rect(x, y, 2, 16, C_WHITE), cv_rect(x + 23, y, 2, 16, C_WHITE);
                }
                if (inch)
                    cv_rect(x + 10, y + 17, 5, 2, TE_G3);
                if (ti == sel && p == pats_cursor)
                    cv_rect(x, y + 17, 25, 2, C_WHITE);
                b[0] = (char)('1' + p), b[1] = 0;
                cv_text(x + 9, y, &FONT_S, b, playing ? C_BLACK : ((used >> p) & 1u) ? C_WHITE : TE_G3);
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
            cv_rect((int32_t)k * 60 + 4, 2, 52, 3, TE_COL[k]);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, L[k]) / 2, 6, &FONT_S, L[k], TE_G3);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, v[k]) / 2, 21, &FONT_S, v[k],
                    ui.hot_t && ui.hot_col == k ? C_WHITE : TE_G4);
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
    if ((s = panel_enc(EN_ALGO)) != 0 && !ft_on)
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
                ui_message("AGAIN: CLEAR");
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
                ui_message("AGAIN: COPY");
            } else {
                int ok = 1;
                pats_arm = 0;
                if (pats_cursor != t->pat) {
                    fm1_irq_off();
                    ok = pb_store(sel, pats_cursor);
                    fm1_irq_on();
                }
                ui_message(ok ? "PATTERN COPIED" : "PATTERNS FULL: NOT COPIED");
            }
        }
    }
    panel_enc(EN_SELECT);                            /* (no hidden action here) */
    panel_enc(EN_PRESET);
}
