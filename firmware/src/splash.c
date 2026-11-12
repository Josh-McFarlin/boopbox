/* SPDX-License-Identifier: GPL-3.0-only */
/* BoopBox boot splash: the logo (tools/gen_logo.py -> boopbox_logo.h: 16 colours, RLE runs of
 * (run - 1) << 4 | colour), drawn into the canvas in bands of at most 120 rows; or the wordmark alone (1 bit a pixel). */
#ifndef UI_SMALL                 /* (2.7) compiled for size: not the audio path (gfx.c UI_SMALL); the host tests: nothing */
#define UI_SMALL
#endif
#ifndef FELUCCA_LOGO_TEXT       /* (2.7) 1: the boot logo as text, the wordmark "boopbox" (Pixelify Sans Bold, the website's
                                 * font: tools/gen_logo.py), "boop" in the four track colours and "box" white (over 4 KB of
                                 * flash less); the default since the groovebox upgrade (the flash is full); 0: the bitmap logo */
#define FELUCCA_LOGO_TEXT 1
#endif
#include "boopbox_logo.h"
/* the wordmark "boopbox" into the canvas, its top left at (x, y), each of the glyphs' pixels 2 x 2 (190 x 38): "boop" in
 * the tracks' colours, "box" white (the boot logo; MENU > ABOUT, ui_menu.c) */
UI_SMALL static void boopbox_word(int32_t x, int32_t y)
{
    uint32_t i, r, c, bits;
    for (i = 0; i < BOOPBOX_WORD_N; i++) {
        uint16_t col = i < 4u ? (pal_neon ? UI_COL[i] : UI_COL_DEF[i]) : C_WHITE;
        int32_t gx = x + (int32_t)(i * BOOPBOX_GLYPH_ADV * 2u);
        for (r = 0; r < BOOPBOX_GLYPH_H; r++)
            for (bits = BOOPBOX_GLYPHS[BOOPBOX_WORD[i]][r], c = 0; c < BOOPBOX_GLYPH_W; c++)
                if (bits >> (BOOPBOX_GLYPH_W - 1u - c) & 1u)
                    cv_rect(gx + (int32_t)(c * 2u), y + (int32_t)(r * 2u), 2, 2, col);
    }
}
#if FELUCCA_LOGO_TEXT
UI_SMALL static void boopbox_logo_draw(uint32_t y0)
{
    cv_begin(240, BOOPBOX_GLYPH_H * 2u, C_BLACK);
    boopbox_word((240 - BOOPBOX_WORD_W * 2) / 2, 0);   /* centred */
    cv_blit(0, y0 + 73u);
}
#else
UI_SMALL static void boopbox_logo_draw(uint32_t y0)
{
    uint32_t r0;
    for (r0 = 0; r0 < BOOPBOX_SPLASH_H; r0 += 120u) {
        uint32_t rows = BOOPBOX_SPLASH_H - r0 > 120u ? 120u : BOOPBOX_SPLASH_H - r0;
        uint32_t lo = r0 * BOOPBOX_SPLASH_W, hi = (r0 + rows) * BOOPBOX_SPLASH_W, pos = 0, i;
        cv_begin(BOOPBOX_SPLASH_W, rows, C_BLACK);
        for (i = 0; i < sizeof BOOPBOX_SPLASH_RLE && pos < hi; i++) {
            uint32_t run = (BOOPBOX_SPLASH_RLE[i] >> 4) + 1u, c = BOOPBOX_SPLASH_RLE[i] & 15u, p;
            if (c && pos + run > lo)
                for (p = pos < lo ? lo : pos; p < pos + run && p < hi; p++)
                    cv_px[p - lo] = swap16(BOOPBOX_SPLASH_PAL[c]);
            pos += run;
        }
        cv_blit((240u - BOOPBOX_SPLASH_W) / 2u, y0 + r0);
    }
}
#endif

/* (1.1.0) SYNTHWAVE: a sun setting on a neon horizon under the logo (rows 168..201), yellow to pink, cut by bands that
 * widen toward the horizon */
UI_SMALL static void boopbox_sun(void)
{
    int32_t y, dy, hw;
    cv_begin(240, 34, C_BLACK);
    for (y = 0; y < 32; y++) {
        dy = 32 - y;                                    /* above the horizon */
        if (dy < 18 && dy % 6 < (18 - dy) / 6 + 1)
            continue;                                   /* a band */
        for (hw = 0; (hw + 1) * (hw + 1) + dy * dy <= 30 * 30;)
            hw++;
        if (hw > 2)                                     /* (not a lone pixel on top) */
            cv_rect(120 - hw, y, 2 * hw + 1, 1, rgb565_mix(RGB(255, 222, 90), RGB(255, 46, 150), (uint32_t)y, 32u));
    }
    cv_rule(0, 32, 240, C_LINE);
    cv_blit(0, 168);
}

/* the boot screen: the logo, the version, where it comes from */
UI_SMALL static void boopbox_splash(void)
{
    const char *v = FELUCCA_VERSION, *p;
    lcd_clear();
    boopbox_logo_draw(10);
    if (pal_neon)
        boopbox_sun();
    for (p = v; *p && *p != ' '; p++)
        ;
    if (*p && p - v == 7 && v[0] == 'B' && v[3] == 'P' && v[6] == 'X')
        v = p + 1;                                      /* "BOOPBOX 1.0" -> "1.0" under the wordmark */
    cv_begin(240, 36, C_BLACK);
    cv_text(120 - text_w(&FONT_S, v) / 2, 0, &FONT_S, v, RGB(196, 196, 204));
    cv_text(120 - text_w(&FONT_S, "based on sloop & felucca") / 2, 18, &FONT_S, "based on sloop & felucca",
            RGB(96, 96, 104));
    cv_blit(0, 202);
}
