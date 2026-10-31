/* SPDX-License-Identifier: GPL-3.0-only */
/* BoopBox boot splash: the logo (tools/gen_logo.py -> boopbox_logo.h: 16 colours, RLE runs of
 * (run - 1) << 4 | colour), drawn into the canvas in bands of at most 120 rows. */
#ifndef UI_SMALL                 /* (2.7) compiled for size: not the audio path (gfx.c UI_SMALL); the host tests: nothing */
#define UI_SMALL
#endif
#ifndef FELUCCA_LOGO_TEXT       /* (2.7) 1: the boot logo as text, "BOOP" in the four track colours and "BOX" white (4.6 KB
                                 * of flash less); the default since the groovebox upgrade (the flash is full); 0: the bitmap logo */
#define FELUCCA_LOGO_TEXT 1
#endif
#if FELUCCA_LOGO_TEXT
UI_SMALL static void boopbox_logo_draw(uint32_t y0)
{
    static const char L[7] = {'B', 'O', 'O', 'P', 'B', 'O', 'X'};
    uint32_t i, w = text_w(&FONT_L, "BOOPBOX"), k = w * 3u <= 232u ? 3u : 2u, h = 32u, off, y, x;
    int32_t px = 0;
    char c[2] = {0, 0};
    cv_begin(240, h * k, C_BLACK);
    for (i = 0; i < 7u; i++) {                          /* small, at the top left: B O O P the tracks' colours, B O X white */
        c[0] = L[i];
        px = cv_text(px, 0, &FONT_L, c, i < 4u ? UI_COL_DEF[i] : C_WHITE);
    }
    off = (240u - w * k) / 2u;
    for (y = h * k; y-- > 0;)                           /* then k times as big, in place (from the end: nothing read is
                                                         * overwritten before) */
        for (x = w * k; x-- > 0;)
            cv_px[y * 240u + off + x] = cv_px[(y / k) * 240u + x / k];
    for (y = 0; y < h * k; y++)                         /* (the small one's left-over columns) */
        for (x = 0; x < off; x++)
            cv_px[y * 240u + x] = swap16(C_BLACK);
    cv_blit(0, y0 + 60u);
}
#else
#include "boopbox_logo.h"
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

/* the boot screen: the logo, the version, where it comes from */
UI_SMALL static void boopbox_splash(void)
{
    const char *v = FELUCCA_VERSION, *p;
    lcd_fill(0, 0, 240, 240, C_BLACK);
    boopbox_logo_draw(10);
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
