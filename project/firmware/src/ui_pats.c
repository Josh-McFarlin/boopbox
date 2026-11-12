/* SPDX-License-Identifier: GPL-3.0-only */
/* The PATTERNS, CHAIN and SCENES pages, and the CHORDS screen.
 * PATTERNS, CHAIN and SCENES are the last SEQ pages (NOTES, TIMING, PLAY, PATTERNS, CHAIN, SCENES, then SONG; SELECT
 * walks them, SEQ held + SAVE opens SCENES from anywhere). On all three the keys are pads (seq.c kb_pats, pats_key):
 * white keys 1..8 the selected track's patterns, white keys 9..16 the song's scenes 1..8; their lights show what plays
 * (lit) and what is asked for (blinking). ALGORITHM the track, ENV / LFO their pages, PLAY and HOME as everywhere.
 *   PATTERNS: the selected track's eight patterns as tiles (NOW playing, NEXT asked for, what each holds, empty). A key
 *     asks for its pattern (quantized: PAT Q). KNOB 1 the cursor, KNOB 2 PAT Q, KNOB 3 COPY the pattern playing into
 *     the cursor's (turned twice), KNOB 4 CLEAR the cursor's (twice). OCT+ asks for the cursor's pattern, OCT- the
 *     cursor's pattern on every track.
 *   CHAIN: the track's chain as a playlist of up to 16 slots, each a pattern played its repeats' loops, then the next,
 *     round (patbank.c). A key puts its pattern after the cursor (at the end: appends, so keys type the list). KNOB 1
 *     the slot (or the end), KNOB 2 its pattern, KNOB 3 its repeats (x1..x16), KNOB 4 PLAY on / off. OCT+ inserts a
 *     copy of the slot after it, OCT- removes the slot.
 *   SCENES: eight scenes, a row each: its name and each track's pattern in it (- the track keeps what it plays). A key
 *     (9..16) or OCT+ launches one: every track asked for its pattern at once (PAT Q). KNOB 1 the scene, KNOB 2 PAT Q,
 *     KNOB 3 its name, KNOB 4 the selected track's pattern in it; OCT- twice stores the patterns playing into it. */
enum { PV_PADS, PV_CHAIN, PV_SCENES };
static uint8_t pats_cursor;                      /* PATTERNS: the cursor's pattern */
static uint8_t chain_cursor;                     /* CHAIN: the slot (the chain's count: the end) */
static uint8_t scn_cursor;                       /* SCENES: the scene */
static uint8_t pats_arm;                         /* 1: COPY armed, 2: CLEAR armed, 3: STORE armed (until pats_deadline) */
static uint32_t pats_deadline;
static const char *const PQN[4] = {"loop", "1 bar", "2 bar", "4 bar"};
/* the four knobs' strip on a 38-px band: a colour bar, the label and the value of each (the hot one white) */
UI_SMALL static void knob_strip(const char *const *L, char (*v)[8])
{
    uint32_t k;
    for (k = 0; k < 4u; k++) {
        cv_rect((int32_t)k * 60 + 4, 2, 52, 3, UI_COL[k]);
        cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, L[k]) / 2, 6, &FONT_S, L[k], UI_G3);
        cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, v[k]) / 2, 21, &FONT_S, v[k],
                ui.hot_t && ui.hot_col == k ? C_WHITE : UI_G4);
    }
}
UI_SMALL static int on_pats_page(void) { return !ui.home && cur_page()->scope == SC_PATS; }
UI_SMALL static uint32_t pats_view(void)         /* PV_*: which of the three (their order in PAGES) */
{
    uint32_t i = ui.page, v = 0;
    while (i > 0u && PAGES[i - 1u].scope == SC_PATS)
        i--, v++;
    return v > PV_SCENES ? PV_SCENES : v;
}
UI_SMALL static uint32_t pats_used(uint32_t k)   /* the patterns of track k that hold something, a bit each */
{
    return pb_used(k) | (pat_empty(&trk[k % NTRK]) ? 0u : 1u << trk[k % NTRK].pat);
}
/* the steps of track k's pattern p that hold something (a bit each) and its LEN (0: empty), for a tile's picture */
UI_SMALL static uint64_t pats_map(uint32_t k, uint32_t p, uint32_t *len)
{
    const track_t *t = &trk[k % NTRK];
    uint64_t m = 0;
    uint32_t i;
    int o;
    *len = 0;
    if (p == t->pat) {
        for (i = 0; i < NSTEP; i++)
            if (!step_blank(t, i))
                m |= 1ull << i;
        *len = trk_len(t);
        return m;
    }
    if ((o = pb_find(k, p)) < 0)
        return 0;
    *len = clamp(pb_buf[o + 3], 1, NSTEP);
    if (pb_buf[o + 4] == 0u) {                   /* (the codec's sparse steps: their map first) */
        for (i = 0; i < NSTEP / 8u; i++)
            m |= (uint64_t)pb_buf[o + 5 + (int)i] << (8u * i);
    } else {
        m = ~0ull;                               /* (whole: dense, every step shown) */
    }
    return m;
}
UI_SMALL static void pats_poll(void)             /* (every frame) a change the ISR refused: said; a scene made */
{
    if (pb_full) {
        pb_full = 0;
        ui_message("PATTERNS FULL: KEPT");
    }
    scn_poll();
}
/* the white key of key k (0 = F3), -1 a black key */
UI_SMALL static int32_t white_of_key(uint32_t k)
{
    static const int8_t W[12] = {0, -1, 1, -1, 2, -1, 3, 4, -1, 5, -1, 6};   /* from F */
    int32_t i = W[k % 12u];
    return i < 0 ? -1 : (int32_t)(k / 12u) * 7 + i;
}
/* the pads' lights (keys_lit): 1..8 the selected track's pattern playing, the one asked for blinking; 9..16 the scene
 * playing, the one asked for blinking */
UI_SMALL static uint32_t pats_keys_lit(uint32_t blink)
{
    const track_t *t = TSEL;
    uint32_t m = 1u << key_of_lane(t->pat % NPAT);
    if (t->pat_req && blink)
        m |= 1u << key_of_lane((t->pat_req - 1u) % NPAT);
    if (scn_cur < NSCENE)
        m |= 1u << key_of_lane(8u + scn_cur);
    if (scn_ask < NSCENE && blink)
        m |= 1u << key_of_lane(8u + scn_ask);
    return m;
}
UI_SMALL static void pats_ask(uint32_t k, uint32_t p)   /* a change of track k to pattern p (quantized: patbank.c) */
{
    trk[k % NTRK].pat_req = (uint8_t)(p % NPAT + 1u);
}
UI_SMALL static void chain_put(track_t *t, uint32_t pos, uint8_t slot)   /* a slot into the chain at pos */
{
    uint8_t ch[NCHAIN];
    uint32_t n = t->pat_nchain, i, j = 0;
    if (n >= NCHAIN) {
        ui_message("CHAIN FULL: 16 SLOTS");
        return;
    }
    for (i = 0; i <= n; i++)
        ch[i] = i == pos ? slot : t->pat_chain[j++];
    fm1_irq_off();
    pat_chain_set(t, ch, n + 1u);
    fm1_irq_on();
}
UI_SMALL static void chain_add(track_t *t, uint32_t p)   /* pattern p after the cursor (at the end: appended) */
{
    uint32_t n = t->pat_nchain, at = chain_cursor < n ? chain_cursor + 1u : n;
    if (n >= NCHAIN) {
        ui_message("CHAIN FULL: 16 SLOTS");
        return;
    }
    chain_put(t, at, CH_SLOT(p, 1u));
    chain_cursor = (uint8_t)(chain_cursor < n ? at : n + 1u);
}
/* a pad: white keys 1..8 the track's patterns (CHAIN: into the chain), 9..16 the scenes (seq.c lk_q, KB_PATS) */
UI_SMALL static void pats_key(uint32_t k)
{
    int32_t w = white_of_key(k);
    uint32_t sel = song.sel % NTRK;
    char b[20];
    if (w < 0 || w > 15)
        return;
    if (w >= 8) {
        scn_cursor = (uint8_t)(w - 8);
        scn_launch(scn_cursor);
        str_cpy(b, "SCENE ", 7);
        fmt_int(b + 6, w - 7);
        ui_say(b, song.playing ? " NEXT" : "");
        return;
    }
    if (pats_view() == PV_CHAIN) {
        chain_add(&trk[sel], (uint32_t)w);
        return;
    }
    pats_cursor = (uint8_t)w;
    pats_ask(sel, (uint32_t)w);
    str_cpy(b, "PATTERN ", 9);
    fmt_int(b + 8, w + 1);
    ui_say(b, song.playing ? " NEXT" : "");
}
/* the head: the title, two lines on the right */
UI_SMALL static void pats_head(const char *title, const char *r1, uint16_t c1, const char *r2, uint16_t c2)
{
    cv_begin(240, 42, C_BLACK);
    cv_glow(20, 38);                             /* (1.1.0) SYNTHWAVE: a glow over the rule */
    cv_text(4, 4, &FONT_L, title, C_WHITE);
    ui_text_r(4, r1, c1);
    ui_text_r(20, r2, c2);
    cv_rule(0, 39, 240, UI_G1);
    cv_blit(0, 0);
}
/* a tile with its corners cut (rounded at this size) */
UI_SMALL static void pats_tile(int32_t x, int32_t y, int32_t w, int32_t h, uint16_t c)
{
    cv_rect(x + 2, y, w - 4, h, c);
    cv_rect(x, y + 2, w, h - 4, c);
    cv_rect(x + 1, y + 1, w - 2, h - 2, c);
}
UI_SMALL static void pats_frame(int32_t x, int32_t y, int32_t w, int32_t h, uint16_t c)   /* a frame, 2 px */
{
    cv_rect(x + 2, y, w - 4, 2, c), cv_rect(x + 2, y + h - 2, w - 4, 2, c);
    cv_rect(x, y + 2, 2, h - 4, c), cv_rect(x + w - 2, y + 2, 2, h - 4, c);
    cv_rect(x + 1, y + 1, 1, 1, c), cv_rect(x + w - 2, y + 1, 1, 1, c);
    cv_rect(x + 1, y + h - 2, 1, 1, c), cv_rect(x + w - 2, y + h - 2, 1, 1, c);
}
/* a pattern's picture: up to 16 columns over its LEN, a column lit when one of its steps holds something; the
 * columns on a beat taller (the rhythm at a glance) */
UI_SMALL static void pats_pic(int32_t x, int32_t y, int32_t w, int32_t h, uint64_t m, uint32_t len, uint16_t c)
{
    uint32_t cols = len < 16u ? len : 16u, i;
    int32_t cw;
    if (!cols)
        return;
    cw = w / (int32_t)cols;
    for (i = 0; i < cols; i++) {
        uint32_t a = i * len / cols, b = (i + 1u) * len / cols, j, on = 0;
        int32_t hh = (a % 4u) == 0u ? h : (a % 2u) == 0u ? h * 3 / 4 : h / 2;
        for (j = a; j < b && j < NSTEP; j++)
            on |= (uint32_t)(m >> j) & 1u;
        if (on)
            cv_rect(x + (int32_t)i * cw, y + h - hh, cw > 2 ? cw - 1 : 1, hh, c);
    }
}
/* the knobs at 188 (or a message), the buttons' line under them */
UI_SMALL static void pats_foot(const char *const *L, char (*v)[8], const char *hint)
{
    uint32_t k;
    cv_begin(240, 52, C_BLACK);
    if (ui.msg_t) {
        cv_rect(0, 2, 240, 30, C_WHITE);
        ui_text_mid(9, ui.msg, C_BLACK);
    } else {
        for (k = 0; k < 4u; k++) {
            cv_rect((int32_t)k * 60 + 4, 0, 52, 3, UI_COL[k]);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, L[k]) / 2, 3, &FONT_S, L[k], UI_G3);
            cv_text((int32_t)k * 60 + 30 - text_w(&FONT_S, v[k]) / 2, 17, &FONT_S, v[k],
                    ui.hot_t && ui.hot_col == k ? C_WHITE : UI_G4);
        }
    }
    cv_rect(0, 34, 240, 1, UI_G1);
    cv_text(4, 36, &FONT_S, hint, UI_G4);
    cv_blit(0, 188);
}
/* the keyboard: white keys 1..16 (F3 .. G5) and the black keys between, 1..8 the track's patterns, 9..16 the scenes;
 * each white key in what it does now (the pattern playing in the track's colour, one asked for white, one that holds
 * something dim; the scene playing light, one asked for white) */
UI_SMALL static void pats_keyboard(int32_t y, uint32_t blink)
{
    uint32_t i, sel = song.sel % NTRK, used = pats_used(sel);
    const track_t *t = &trk[sel];
    char b[4];
    for (i = 0; i < 16u; i++) {
        int32_t x = (int32_t)i * 15;
        uint16_t c, tc;
        if (i < 8u) {
            uint32_t asked = t->pat_req == i + 1u, has = (used >> i) & 1u;
            c = i == t->pat ? UI_COL[sel] : asked && blink ? C_WHITE : has ? UI_DIM[sel] : UI_G1;
            tc = i == t->pat || (asked && blink) ? C_BLACK : has ? C_WHITE : UI_G3;
            fmt_int(b, (int32_t)i + 1);
        } else {
            uint32_t sc = i - 8u;
            c = sc == scn_cur ? UI_G4 : sc == scn_ask && blink ? C_WHITE : UI_G2;
            tc = sc == scn_cur || (sc == scn_ask && blink) ? C_BLACK : UI_G4;
            fmt_int(b, (int32_t)sc + 1);
        }
        cv_rect(x, y, 14, 27, c);
        cv_text(x + 7 - text_w(&FONT_S, b) / 2, y + 12, &FONT_S, b, tc);
    }
    for (i = 0; i < 15u; i++)                    /* (from F: a black key after F, G, A, C and D) */
        if (i % 7u != 3u && i % 7u != 6u)
            cv_rect((int32_t)i * 15 + 10, y, 9, 11, C_BLACK);
}
/* when the change asked for happens: "next in 3 beats", "at loop end" (playing), else "" */
UI_SMALL static void pats_when(char *b)
{
    uint32_t q = (uint32_t)clamp(song.g[G_PATQ], PQ_LOOP, PQ_4BAR), span, left;
    static const uint8_t QB[4] = {0, 1, 2, 4};
    b[0] = 0;
    if (!song.playing)
        return;
    if (q == PQ_LOOP) {
        str_cpy(b, "at loop end", 12);
        return;
    }
    span = 4u * QB[q];
    left = span - clk_beat % span;
    str_cpy(b, "next in ", 9);
    fmt_int(b + 8, (int32_t)left);
    str_cpy(b + str_len(b), left == 1u ? " beat" : " beats", 7);
}
UI_SMALL static void pads_draw(uint32_t blink)
{
    uint32_t p, sel = song.sel % NTRK, used = pats_used(sel);
    const track_t *t = &trk[sel];
    char b[20], q[12];
    static const char *const L[4] = {"pattern", "quant", "copy", "clear"};
    static char v[4][8];
    str_cpy(b, "track ", 7);
    fmt_int(b + 6, (int32_t)sel + 1);
    fmt_int(q, (int32_t)(pb_n * 100u / PB_SIZE));       /* (how full the pattern store is) */
    str_cpy(q + str_len(q), "% full", 8);
    pats_head("PATTERNS", b, UI_COL[sel], q, pb_n * 10u > PB_SIZE * 9u ? UI_RED : UI_G3);
    cv_begin(240, 98, C_BLACK);                  /* the eight tiles, two rows of four */
    for (p = 0; p < NPAT; p++) {
        int32_t x = 4 + (int32_t)(p % 4u) * 59, y = 2 + (int32_t)(p / 4u) * 50;
        uint32_t playing = p == t->pat, asked = t->pat_req == p + 1u, has = (used >> p) & 1u, len = 0;
        uint64_t m = has ? pats_map(sel, p, &len) : 0;
        uint16_t bg = playing ? UI_COL[sel] : has ? UI_G2 : UI_G1, fg = playing ? C_BLACK : has ? C_WHITE : UI_G3;
        pats_tile(x, y, 54, 44, bg);
        if (asked && blink)
            pats_frame(x, y, 54, 44, C_WHITE);
        fmt_int(b, (int32_t)p + 1);
        cv_text(x + 4, y + 2, &FONT_S, b, fg);
        if (playing || asked)
            cv_text(x + 50 - text_w(&FONT_S, playing ? "now" : "next"), y + 2, &FONT_S, playing ? "now" : "next",
                    playing ? C_BLACK : C_WHITE);
        if (has)
            pats_pic(x + 5, y + 19, 45, 21, m, len, playing ? C_BLACK : UI_COL[sel]);
        else
            cv_text(x + 27 - text_w(&FONT_S, "empty") / 2, y + 22, &FONT_S, "empty", UI_G3);
        if (p == pats_cursor)
            cv_rect(x, y + 46, 54, 2, C_WHITE);
    }
    cv_blit(0, 42);
    cv_begin(240, 48, C_BLACK);                  /* the keys: what each does */
    pats_keyboard(0, blink);
    cv_text(4, 28, &FONT_S, "keys: patterns", UI_G3);
    ui_text_r(28, "scenes", UI_G3);
    cv_blit(0, 140);
    fmt_int(v[0], (int32_t)pats_cursor + 1);
    str_cpy(v[1], PQN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
    if (pats_arm == 1u) {
        str_cpy(v[2], "again", 6);
    } else {
        fmt_int(v[2], (int32_t)t->pat + 1);
        str_cpy(v[2] + str_len(v[2]), ">", 2);
        fmt_int(v[2] + str_len(v[2]), (int32_t)pats_cursor + 1);
    }
    if (pats_arm == 2u)
        str_cpy(v[3], "again", 6);
    else
        fmt_int(v[3], (int32_t)pats_cursor + 1);
    pats_foot(L, v, "oct+ this track  oct- all");
}
UI_SMALL static void chain_draw(uint32_t blink)
{
    uint32_t sel = song.sel % NTRK, n = trk[sel].pat_nchain, used = pats_used(sel), i, w0, tot, p;
    const track_t *t = &trk[sel];
    char b[24];
    static const char *const L[4] = {"slot", "pattern", "repeat", "play"};
    static char v[4][8];
    (void)blink;
    if (chain_cursor > n)
        chain_cursor = (uint8_t)n;
    str_cpy(b, "track ", 7);
    fmt_int(b + 6, (int32_t)sel + 1);
    pats_head("CHAIN", b, UI_COL[sel], !n ? "no chain" : n < 2u ? "1 slot" : t->pat_coff ? "loops: off" : "loops: on",
              n >= 2u && !t->pat_coff ? UI_G4 : UI_G3);
    tot = n < NCHAIN ? n + 1u : n;               /* (the slots and the end) */
    w0 = chain_cursor > 2u ? chain_cursor - 2u : 0u;   /* (six at a time, the cursor's third) */
    if (w0 + 6u > tot)
        w0 = tot > 6u ? tot - 6u : 0u;
    cv_begin(240, 72, C_BLACK);                  /* the slots in order, an arc back to the first */
    cv_text(4, 0, &FONT_S, n >= 2u ? "plays in order, then round" : "keys add patterns", UI_G3);
    for (i = w0; i < w0 + 6u && i < tot; i++) {
        int32_t x = 4 + (int32_t)(i - w0) * 39, y = 17;
        if (i < n) {
            uint32_t sl = t->pat_chain[i], on = chain_on(t) && i == t->pat_ci && CH_PAT(sl) == t->pat, len = 0;
            uint64_t m = ((used >> CH_PAT(sl)) & 1u) ? pats_map(sel, CH_PAT(sl), &len) : 0;
            pats_tile(x, y, 34, 42, on ? UI_COL[sel] : UI_G2);
            fmt_int(b, (int32_t)CH_PAT(sl) + 1);
            cv_text(x + 17 - text_w(&FONT_L, b) / 2, y - 3, &FONT_L, b, on ? C_BLACK : C_WHITE);
            if (CH_REP(sl) > 1u) {                /* (its repeats in the picture's place) */
                str_cpy(b, "x", 2);
                fmt_int(b + 1, (int32_t)CH_REP(sl));
                cv_text(x + 17 - text_w(&FONT_S, b) / 2, y + 26, &FONT_S, b, on ? C_BLACK : C_WHITE);
            } else {
                pats_pic(x + 4, y + 30, 26, 9, m, len, on ? C_BLACK : UI_DIM[sel]);
            }
            if (on)                              /* (the loops played of its repeats) */
                cv_rect(x, y + 44, (int32_t)(34u * (t->pat_cr + 1u) / CH_REP(sl)), 2, C_WHITE);
            if (i + 1u < n) {                    /* (an arrow to the next) */
                cv_rect(x + 35, y + 19, 2, 4, UI_G3);
                cv_rect(x + 37, y + 20, 1, 2, UI_G3);
            }
        } else {
            pats_tile(x, y, 34, 42, UI_G1);
            cv_text(x + 17 - text_w(&FONT_L, "+") / 2, y + 3, &FONT_L, "+", UI_G3);
        }
        if (i == chain_cursor)
            pats_frame(x, y, 34, 42, C_WHITE);
    }
    if (n >= 2u) {                               /* (round: an arc under the slots back to the first) */
        int32_t xe = 4 + (int32_t)((n - 1u < w0 + 5u ? n - 1u : w0 + 5u) - w0) * 39 + 17;
        uint16_t c = chain_on(t) ? UI_G3 : UI_G1;
        cv_rect(20, 68, xe - 20, 1, c);
        cv_rect(20, 64, 1, 4, c), cv_rect(xe, 64, 1, 4, c);
        cv_rect(18, 64, 5, 1, c), cv_rect(19, 63, 3, 1, c);
    }
    cv_blit(0, 42);
    cv_begin(240, 74, C_BLACK);                  /* the patterns to add, where the cursor is */
    cv_text(4, 2, &FONT_S, "add a pattern: keys 1-8", UI_G3);
    for (p = 0; p < NPAT; p++) {
        int32_t x = 4 + (int32_t)p * 29;
        uint32_t has = (used >> p) & 1u;
        pats_tile(x, 20, 26, 24, has ? UI_DIM[sel] : UI_G1);
        fmt_int(b, (int32_t)p + 1);
        cv_text(x + 13 - text_w(&FONT_S, b) / 2, 24, &FONT_S, b, has ? C_WHITE : UI_G3);
        if (chain_cursor < n && CH_PAT(t->pat_chain[chain_cursor]) == p)
            pats_frame(x, 20, 26, 24, C_WHITE);
    }
    if (chain_cursor < n) {
        str_cpy(b, "slot ", 6);
        fmt_int(b + 5, (int32_t)chain_cursor + 1);
        str_cpy(b + str_len(b), " of ", 5);
        fmt_int(b + str_len(b), (int32_t)n);
        str_cpy(b + str_len(b), "  x", 4);
        fmt_int(b + str_len(b), (int32_t)CH_REP(t->pat_chain[chain_cursor]));
    } else {
        str_cpy(b, n ? "the end: a key appends" : "empty: a key starts it", 23);
    }
    cv_text(4, 52, &FONT_S, b, C_WHITE);
    cv_blit(0, 114);
    if (chain_cursor < n) {
        uint32_t sl = t->pat_chain[chain_cursor];
        fmt_int(v[0], (int32_t)chain_cursor + 1);
        fmt_int(v[1], (int32_t)CH_PAT(sl) + 1);
        str_cpy(v[2], "x", 2);
        fmt_int(v[2] + 1, (int32_t)CH_REP(sl));
    } else {
        str_cpy(v[0], "end", 4);
        str_cpy(v[1], "-", 2);
        str_cpy(v[2], "-", 2);
    }
    str_cpy(v[3], t->pat_coff ? "off" : "on", 4);
    pats_foot(L, v, "oct+ insert  oct- remove");
}
UI_SMALL static void scenes_draw(uint32_t blink)
{
    uint32_t s, k, sel = song.sel % NTRK, used[NTRK];
    char b[20], q[12];
    static const char *const L[4] = {"scene", "quant", "name", "pattern"};
    static char v[4][8];
    for (k = 0; k < NTRK; k++)
        used[k] = pats_used(k);
    str_cpy(q, "q ", 3);
    str_cpy(q + 2, PQN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
    if (scn_ask < NSCENE)
        pats_when(b);
    else
        b[0] = 0;
    pats_head("SCENES", q, UI_COL[2], b, C_WHITE);
    for (k = 0; k < 2u; k++) {                   /* the rows, four a band */
        uint32_t r;
        cv_begin(240, 73, C_BLACK);
        for (r = 0; r < 4u; r++) {
            int32_t y = (int32_t)r * 18 + 1;
            uint32_t tk, named;
            s = k * 4u + r;
            named = scn_name[s] != 0u;
            cv_rect(2, y, 236, 16, s == scn_cur ? UI_G2 : UI_G1);
            if (s == scn_cursor) {
                cv_rect(2, y, 236, 1, C_WHITE), cv_rect(2, y + 15, 236, 1, C_WHITE);
                cv_rect(2, y, 1, 16, C_WHITE), cv_rect(237, y, 1, 16, C_WHITE);
            }
            if (s == scn_cur || (s == scn_ask && blink)) {   /* (a play triangle: playing, or asked, blinking) */
                uint16_t c = s == scn_cur ? UI_COL[0] : C_WHITE;
                cv_rect(5, y + 3, 2, 10, c), cv_rect(7, y + 4, 2, 8, c);
                cv_rect(9, y + 5, 2, 6, c), cv_rect(11, y + 7, 2, 2, c);
            }
            fmt_int(b, (int32_t)s + 1);
            cv_text(17, y + 1, &FONT_S, b, named || s == scn_cur ? C_WHITE : UI_G3);
            cv_text(30, y + 1, &FONT_S, N_SCN[scn_name[s] % NSCN_NAMES], named ? C_WHITE : UI_G3);
            for (tk = 0; tk < NTRK; tk++) {      /* each track: its pattern holds something (in its colour) or not */
                int32_t x = 96 + (int32_t)tk * 18;
                uint32_t p = scn_pat[s][tk], has = p < NPAT && ((used[tk] >> p) & 1u);
                uint16_t c = p >= NPAT ? UI_G1 : !has ? UI_G2 : s == scn_cur ? UI_COL[tk] : UI_DIM[tk];
                cv_rect(x, y + 2, 15, 12, c);
                if (p >= NPAT)
                    cv_rect(x + 5, y + 7, 5, 2, UI_G3);   /* (keep: a dash) */
                else if (p != s) {               /* (another pattern than the scene's number: said) */
                    fmt_int(b, (int32_t)p + 1);
                    cv_text(x + 8 - text_w(&FONT_S, b) / 2, y, &FONT_S, b, has && s == scn_cur ? C_BLACK : C_WHITE);
                }
                if (s == scn_cursor && tk == sel)
                    cv_rect(x, y + 14, 15, 2, C_WHITE);
            }
        }
        if (k && scn_ask < NSCENE && song.playing && song.g[G_PATQ] > PQ_LOOP) {   /* (how far to the change) */
            static const uint8_t QB[4] = {0, 1, 2, 4};
            uint32_t span = 4u * QB[(uint32_t)clamp(song.g[G_PATQ], 0, 3)];
            cv_rect(2, 72, 236, 1, UI_G1);
            cv_rect(2, 72, (int32_t)(236u * (clk_beat % span + 1u) / span), 1, C_WHITE);
        }
        cv_blit(0, k ? 115 : 42);
    }
    fmt_int(v[0], (int32_t)scn_cursor + 1);
    str_cpy(v[1], PQN[(uint32_t)clamp(song.g[G_PATQ], 0, 3)], 8);
    str_cpy(v[2], N_SCN[scn_name[scn_cursor % NSCENE] % NSCN_NAMES], 8);
    if (pats_arm == 3u) {
        str_cpy(v[3], "again", 6);
    } else if (scn_pat[scn_cursor % NSCENE][sel] < NPAT) {
        fmt_int(v[3], (int32_t)scn_pat[scn_cursor % NSCENE][sel] + 1);
    } else {
        str_cpy(v[3], "keep", 5);
    }
    pats_foot(L, v, "oct+ launch  oct- store");
}
UI_SMALL static void pats_screen_draw(void)
{
    static uint32_t previous;
    uint32_t k, p, view = pats_view(), blink = (fm1_ms / 250u) & 1u, sel = song.sel % NTRK, any = scn_ask < NSCENE;
    uint32_t sig = view * 997u + pats_cursor * 101u + chain_cursor * 89u + scn_cursor * 83u + sel * 103u +
                   (uint32_t)song.g[G_PATQ] * 107u + song.playing * 109u + pb_n * 7u + pats_arm * 113u +
                   scn_cur * 127u + scn_ask * 131u;
    for (k = 0; k < NTRK; k++) {
        const track_t *t = &trk[k];
        sig = sig * 31u + t->pat * 7u + t->pat_req * 13u + pats_used(k) * 17u + t->pat_nchain * 3u + t->pat_ci +
              t->pat_cr * 19u + t->pat_coff * 23u;
        for (p = 0; p < t->pat_nchain; p++)
            sig = sig * 5u + t->pat_chain[p];
        any |= t->pat_req;
    }
    for (k = 0; k < NSCENE; k++) {
        sig = sig * 37u + scn_name[k];
        for (p = 0; p < NTRK; p++)
            sig = sig * 3u + scn_pat[k][p];
    }
    if (any)
        sig += blink * 977u + (song.playing ? clk_beat * 59u : 0u);
    if (!ui.force && !ui.msg_t && sig == previous)
        return;
    previous = ui.msg_t ? ~sig : sig;
    if (view == PV_PADS)
        pads_draw(blink);
    else if (view == PV_CHAIN)
        chain_draw(blink);
    else
        scenes_draw(blink);
}
UI_SMALL static void pats_arm_now(uint32_t a, const char *msg)
{
    pats_arm = (uint8_t)a;
    pats_deadline = fm1_ms + 3000u;
    ui_message(msg);
}
UI_SMALL static void pads_knob(uint32_t k, int32_t s, track_t *t, uint32_t sel)
{
    char b[24];
    if (k == 0u) {
        pats_cursor = (uint8_t)clamp((int32_t)pats_cursor + s, 0, NPAT - 1);
    } else if (k == 1u) {
        song.g[G_PATQ] = (int16_t)clamp(song.g[G_PATQ] + s, PQ_LOOP, PQ_4BAR);
    } else if (k == 2u) {                        /* COPY: the pattern playing into the cursor's (turned twice) */
        if (pats_arm != 1u) {
            str_cpy(b, "COPY ", 6);
            fmt_int(b + 5, (int32_t)t->pat + 1);
            str_cpy(b + str_len(b), " > ", 4);
            fmt_int(b + str_len(b), (int32_t)pats_cursor + 1);
            str_cpy(b + str_len(b), ": AGAIN", 8);
            pats_arm_now(1, b);
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
    } else {                                     /* CLEAR the cursor's pattern (twice) */
        if (pats_arm != 2u) {
            str_cpy(b, "CLEAR ", 7);
            fmt_int(b + 6, (int32_t)pats_cursor + 1);
            str_cpy(b + str_len(b), ": TURN AGAIN", 13);
            pats_arm_now(2, b);
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
    }
}
UI_SMALL static void chain_knob(uint32_t k, int32_t s, track_t *t)
{
    uint32_t n = t->pat_nchain;
    if (k == 0u) {
        chain_cursor = (uint8_t)clamp((int32_t)chain_cursor + s, 0, (int32_t)(n < NCHAIN ? n : NCHAIN - 1u));
    } else if (k == 3u) {
        t->pat_coff = (uint8_t)(s < 0);
        ui_message(n < 2u ? "A CHAIN PLAYS WITH 2 SLOTS" : s < 0 ? "CHAIN OFF" : "CHAIN ON");
    } else if (chain_cursor < n) {
        uint8_t ch[NCHAIN];
        uint32_t i, sl = t->pat_chain[chain_cursor], p = CH_PAT(sl), r = CH_REP(sl);
        for (i = 0; i < n; i++)
            ch[i] = t->pat_chain[i];
        if (k == 1u)
            p = (uint32_t)clamp((int32_t)p + s, 0, NPAT - 1);
        else
            r = (uint32_t)clamp((int32_t)r + s, 1, 16);
        ch[chain_cursor] = CH_SLOT(p, r);
        fm1_irq_off();
        {                                        /* (the slot playing and its loops kept when only repeats change) */
            uint8_t ci = t->pat_ci, cr = t->pat_cr;
            pat_chain_set(t, ch, n);
            if (k == 2u)
                t->pat_ci = ci, t->pat_cr = cr;
        }
        fm1_irq_on();
    }
}
UI_SMALL static void scenes_knob(uint32_t k, int32_t s, uint32_t sel)
{
    uint32_t c = scn_cursor % NSCENE;
    if (k == 0u) {
        scn_cursor = (uint8_t)clamp((int32_t)scn_cursor + s, 0, NSCENE - 1);
    } else if (k == 1u) {
        song.g[G_PATQ] = (int16_t)clamp(song.g[G_PATQ] + s, PQ_LOOP, PQ_4BAR);
    } else if (k == 2u) {
        scn_name[c] = (uint8_t)clamp((int32_t)scn_name[c] + s, 0, NSCN_NAMES - 1);
    } else {                                     /* the track's pattern in it: KEEP (-), 1 .. 8 */
        int32_t p = scn_pat[c][sel] >= NPAT ? -1 : scn_pat[c][sel];
        p = clamp(p + s, -1, NPAT - 1);
        scn_pat[c][sel] = (uint8_t)(p < 0 ? SCN_KEEP : (uint32_t)p);
    }
}
UI_SMALL static void pats_screen_input(uint32_t pressed, uint32_t home)
{
    uint32_t k, sel = song.sel % NTRK, view = pats_view();
    int32_t s;
    track_t *t = &trk[sel];
    char b[24];
    if (home == 1u) {
        go_home();
        return;
    }
    if (pats_arm && (int32_t)(fm1_ms - pats_deadline) > 0)
        pats_arm = 0;
    for (k = 0; k < NB; k++) {
        uint32_t bt = k;
        if (!((pressed >> panel.btn[k]) & 1u))
            continue;
        if (bt == B_PLAY) {
            if (!ft_owns_press())
                transport_req = song.playing ? 2 : 1;
        } else if (bt == B_OCTUP) {                  /* (SEQ tapped: the next SEQ screen, SONG: ui_input.c layer_tap) */
            if (view == PV_PADS) {
                pats_ask(sel, pats_cursor);
                ui_message(song.playing ? "PATTERN ASKED" : "PATTERN");
            } else if (view == PV_CHAIN) {
                chain_add(t, chain_cursor < t->pat_nchain ? CH_PAT(t->pat_chain[chain_cursor]) : t->pat);
            } else {
                scn_launch(scn_cursor);
                str_cpy(b, "SCENE ", 7);
                fmt_int(b + 6, (int32_t)scn_cursor + 1);
                ui_say(b, song.playing ? " NEXT" : "");
            }
            if (view != PV_SCENES || pats_arm != 3u)
                pats_arm = 0;
        } else if (bt == B_OCTDN) {
            if (view == PV_PADS) {
                uint32_t i;
                for (i = 0; i < NTRK; i++)
                    pats_ask(i, pats_cursor);
                ui_message(song.playing ? "EVERY TRACK ASKED" : "EVERY TRACK");
            } else if (view == PV_CHAIN) {
                uint32_t n = t->pat_nchain, i, j = 0;
                if (chain_cursor < n) {
                    uint8_t ch[NCHAIN];
                    for (i = 0; i < n; i++)
                        if (i != chain_cursor)
                            ch[j++] = t->pat_chain[i];
                    fm1_irq_off();
                    pat_chain_set(t, ch, j);
                    fm1_irq_on();
                    ui_message("SLOT REMOVED");
                }
            } else if (pats_arm != 3u) {
                str_cpy(b, "OCT- AGAIN: STORE ", 19);
                fmt_int(b + str_len(b), (int32_t)scn_cursor + 1);
                pats_arm_now(3, b);
            } else {
                pats_arm = 0;
                scn_store(scn_cursor);
                ui_message("SCENE STORED");
            }
        } else if (bt == B_ENV) {
            open_family(FAM_ENV);
            return;
        } else if (bt == B_LFO) {
            open_family(FAM_LFO);
            return;
        }
    }
    if ((s = panel_enc(EN_SELECT)) != 0 && (rec_wait || ft_on)) {
        sel_tempo(s);                                /* (the REC screen, a take: SELECT the tempo, as on every page) */
    } else if (s && page_walk(s) && !on_pats_page())
        return;                                      /* (1.7) SELECT: the SEQ pages, as on NOTES, TIMING, PLAY (left
                                                      * from PATTERNS: PLAY; SCENES is the last of them) */
    view = pats_view();
    if ((s = panel_enc(EN_ALGO)) != 0 && !ft_on) {   /* (ALGORITHM picks the track here too, as on TRACKS) */
        track_select((uint32_t)clamp((int32_t)song.sel + s, 0, NTRK - 1));
        sel = song.sel % NTRK;
        t = &trk[sel];
    }
    for (k = 0; k < 4u; k++) {
        if ((s = panel_enc(EN_K1 + k)) == 0)
            continue;
        ui.hot_col = (uint8_t)k;
        ui.hot_t = 40;
        if (!(view == PV_PADS && (k == 2u || k == 3u) && pats_arm == k - 1u))
            pats_arm = 0;
        if (view == PV_PADS)
            pads_knob(k, s, t, sel);
        else if (view == PV_CHAIN)
            chain_knob(k, s, t);
        else
            scenes_knob(k, s, sel);
    }
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
    cv_begin(240, 42, C_BLACK);                  /* the head: the key and scale asked for, when (42 rows: the two over the list too) */
    cv_glow(20, 38);                             /* (1.1.0) SYNTHWAVE: a glow over the rule */
    cv_text(4, 4, &FONT_L, "CHORDS", C_WHITE);
    str_cpy(b, N_HKEY[(uint32_t)clamp(song.g[G_HKEY], 0, 11)], 4);
    str_cpy(b + str_len(b), " ", 2);
    str_cpy(b + str_len(b), N_SCALE[(uint32_t)clamp(song.g[G_HSCL], 0, NSCALES - 1)], 6);
    ui_text_r(4, b, UI_COL[2]);
    str_cpy(b, "q ", 3);
    str_cpy(b + 2, QN[(uint32_t)clamp(song.g[G_HQ], 0, 2)], 6);
    ui_text_r(20, b, UI_G3);
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
        ui_text_mid(11, ui.msg, C_BLACK);
    } else {
        static const char *const L[4] = {"chord", "degree", "bars", "count"};
        static char v[4][8];
        fmt_int(v[0], (int32_t)chords_cursor + 1);
        str_cpy(v[1], H_ROMAN[harm.c[chords_cursor % NHPROG].deg % 7u], 4);
        fmt_int(v[2], harm.c[chords_cursor % NHPROG].bars);
        fmt_int(v[3], (int32_t)n);
        knob_strip(L, v);
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
