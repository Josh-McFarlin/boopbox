/* SPDX-License-Identifier: GPL-3.0-only */
/* The screen font (gfx.c cv_text, tools/gen_font.py). SLOOP 2.6: Terminus Bold, in capitals only; (1.8) stored as raw
 * 1-bit glyphs, 8 x 16, only the 70 the screen can draw (1,120 bytes, read in place: no table, no RAM copy). Checked
 * against the BDF itself (assets/fonts/ter-u16b.bdf, read here): every character 32..255 draws exactly the pixels of
 * the glyph it maps to (its capital; an accented capital its letter; the U umlaut its own; anything else '?') and
 * nothing around it, also clipped at every edge and with a graph y offset; FONT_L the same at 2x; every glyph advances
 * 8 (16 at 2x), as the layout always had. Exit status: the number of failed checks. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
static void lcd_sync(void) {}
static void lcd_blit(uint32_t x, uint32_t y, uint32_t w, uint32_t h, const uint16_t *p) { (void)x; (void)y; (void)w; (void)h; (void)p; }
#define __attribute__(x)         /* (as tests/hostsim.c: gfx.c puts its canvas in the pool section, which clang on
                                 * macOS refuses for a host build; sloop-lab, 11/10/2026) */
#define memset felucca_memset
#define memcpy felucca_memcpy
#define memcmp felucca_memcmp
#include "../firmware/src/libc.c"
#undef memset
#undef memcpy
#undef memcmp
#include "../firmware/src/gfx.c"
static int bad;
static void check(int ok, const char *what) { printf("font: %-78s %s\n", what, ok ? "ok" : "FAIL"); bad += !ok; }
/* the BDF's bitmaps, 16 rows of 8 pixels a character */
static uint8_t bdf[256][16], bdf_has[256];
static int bdf_read(const char *path)
{
    FILE *f = fopen(path, "r");
    char ln[128];
    int enc = -1, row = -1;
    if (!f) return 0;
    while (fgets(ln, sizeof ln, f)) {
        unsigned v;
        if (!strncmp(ln, "ENCODING ", 9)) enc = atoi(ln + 9), row = -1;
        else if (!strncmp(ln, "BITMAP", 6)) row = 0;
        else if (!strncmp(ln, "ENDCHAR", 7)) { if (enc >= 0 && enc < 256 && row == 16) bdf_has[enc] = 1; row = -1; }
        else if (row >= 0 && row < 16 && enc >= 0 && enc < 256 && sscanf(ln, "%x", &v) == 1) bdf[enc][row++] = (uint8_t)v;
    }
    fclose(f);
    return 1;
}
/* the character whose BDF glyph c draws, written out independently of gfx.c */
static uint32_t shown(uint32_t c, uint32_t last)
{
    static const char *const ACC[] = {"\xc0\xc1\xc2\xc3\xc4\xc5\xc6" "A", "\xc7" "C", "\xc8\xc9\xca\xcb" "E", "\xcc\xcd\xce\xcf" "I",
                                      "\xd0" "D", "\xd1" "N", "\xd2\xd3\xd4\xd5\xd6\xd8" "O", "\xd7" "X", "\xd9\xda\xdb" "U",
                                      "\xdd" "Y", "\xde" "P"};
    uint32_t i;
    if ((c >= 'a' && c <= 'z') || (c >= 0xE0u && c <= 0xFEu && c != 0xF7u))
        c -= 32u;
    for (i = 0; i < sizeof ACC / sizeof ACC[0]; i++)
        if (strchr(ACC[i], (int)c) && c != (uint8_t)ACC[i][strlen(ACC[i]) - 1u])
            c = (uint8_t)ACC[i][strlen(ACC[i]) - 1u];
    if (c > last)
        return '?';
    return (c >= 32u && c <= 96u) || (c >= 123u && c <= 126u) || c == 0xDCu ? c : '?';
}
/* character c drawn alone at (x0, y0 + oy) in a w x h canvas with graph offset oy: exactly glyph k's pixels at scale s */
static uint32_t wrong_px(const felucca_font_t *f, uint32_t c, uint32_t k, int32_t x0, int32_t y0, int32_t oy, uint32_t w, uint32_t h)
{
    char s[2] = {(char)c, 0};
    uint32_t x, y, n = 0, sc = f->sh ? 2u : 1u;
    cv_begin(w, h, 0);
    cv_oy = oy;
    cv_text(x0, y0, f, s, 0xFFFFu);
    cv_oy = 0;
    for (y = 0; y < h; y++)
        for (x = 0; x < w; x++) {
            int32_t gx = (int32_t)x - x0, gy = (int32_t)y - (y0 + oy);
            int on = gx >= 0 && gy >= 0 && gx < (int32_t)(8u * sc) && gy < (int32_t)(16u * sc) &&
                     ((bdf[k][gy / (int32_t)sc] >> (7 - gx / (int32_t)sc)) & 1);
            n += (cv_px[y * w + x] != 0) != on;
        }
    return n;
}

int main(void)
{
    static const int32_t XY[6][3] = {{2, 0, 0}, {5, 3, 0}, {-3, 0, 0}, {10, -5, 0}, {8, 6, 0}, {4, 4, -3}};
    uint32_t c, i, wrong = 0, n = 0;
    int got = bdf_read("assets/fonts/ter-u16b.bdf");
    check(got, "the BDF read (assets/fonts/ter-u16b.bdf)");
    for (c = 32; got && c < 256u; c++) {
        uint32_t k = shown(c, 255u);
        if (c >= 127u && c < 160u)
            k = '?';                                    /* (C1 controls) */
        if (!bdf_has[k])
            k = '?';
        for (i = 0; i < 6u; i++)
            wrong += wrong_px(&FONT_S, c, k, XY[i][0], XY[i][1], XY[i][2], 12u, 18u);
        n++;
    }
    check(got && n == 224u && wrong == 0 && bdf_has[0xDC], "FONT_S: every character 32..255 draws its glyph's BDF pixels (U umlaut too), nothing else");
    for (c = 32, wrong = 0; got && c < 256u; c++) {
        uint32_t k = shown(c, 95u);
        if (c >= 127u && c < 160u)
            k = '?';
        for (i = 0; i < 6u; i++)
            wrong += wrong_px(&FONT_L, c, k, XY[i][0] * 2, XY[i][1] * 2, XY[i][2], 24u, 36u);
    }
    check(got && wrong == 0, "FONT_L: the same glyphs at 2x (past '_': '?')");
    {
        uint32_t h1;
        cv_begin(240, 16, 0); cv_text(0, 0, &FONT_S, "kick snare h\xfcgelton \xe9t\xe9", 0xFFFFu);
        h1 = 0; for (i = 0; i < 240u * 16u; i++) h1 = h1 * 31u + cv_px[i];
        cv_begin(240, 16, 0); cv_text(0, 0, &FONT_S, "KICK SNARE H\xdcGELTON ETE", 0xFFFFu);
        for (c = 0, i = 0; i < 240u * 16u; i++) c = c * 31u + cv_px[i];
        check(c == h1, "lower case shows as capitals, accented letters as their letter, in the same place");
    }
    check(text_w(&FONT_S, "BPM 120") == 56 && text_w(&FONT_L, "120") == 48 && text_w(&FONT_S, "\xdc\xe9") == 16,
          "every glyph advances 8 (16 at 2x): the layout as before");
    check(sizeof FONT_S_DATA == 70u * 16u, "70 glyphs, 16 bytes each: 1,120 bytes");
    printf("%s\n", bad ? "FONT TEST FAILED" : "font test passed");
    return bad;
}
