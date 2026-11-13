#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The BoopBox logo, in pixels like the website's (web/src/components/Brand.tsx): a pixel-art boombox (a handle, a body
with notched corners, two speakers) whose display holds eight level bars, the eight tracks: 1..4 on top in the four
track colours (blue, green, yellow, orange), 5..8 below in their shades (as the firmware draws tracks 5..8: gfx.c
ui_shade); and the wordmark "boopbox" in Pixelify Sans Bold, the website's font, drawn from its pixels (GLYPHS).
Both are pixel grids (ICON_ART, GLYPHS), drawn as squares: crisp at any whole-pixel scale.

  tools/gen_logo.py OUT.h          firmware boot splash (RLE, 16-colour palette, RGB565) and the wordmark (1 bit a pixel)
  tools/gen_logo.py --assets DIR   boopbox-logo.svg/png, boopbox-icon.svg/png, boopbox-splash.png
  tools/gen_logo.py --web DIR      the web app's icons: icon-192.png, icon-512.png, icon-maskable-512.png
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BLUE, GREEN, YELLOW, ORANGE = (40, 124, 255), (30, 204, 112), (255, 198, 24), (255, 98, 26)
WHITE, BLACK = (242, 242, 242), (0, 0, 0)
HEX = lambda c: "#%02X%02X%02X" % c
BARS = [BLUE, GREEN, YELLOW, ORANGE]


def shade(c):
    """tracks 5..8's colour from 1..4's: 45 % of the way to white (gfx.c ui_shade, on a dark background)"""
    return tuple(v + (255 - v) * 9 // 20 for v in c)


SHADES = [shade(c) for c in BARS]

# ---- the icon: 30 x 29 pixels. '#' the outline (white), 1..4 the tracks' bars, 5..8 their shades ----------------------
ICON_ART = [
    ".........############.........",
    "........##############........",
    "........###........###........",
    "........##..........##........",
    "........##..........##........",
    ".############################.",
    "##############################",
    "###........................###",
    "##..........................##",
    "##..1111..2222..3333..4444..##",
    "##..1111..2222..3333..4444..##",
    "##..........................##",
    "##..5555..6666..7777..8888..##",
    "##..5555..6666..7777..8888..##",
    "##..........................##",
    "##....######......######....##",
    "##...########....########...##",
    "##..###....###..###....###..##",
    "##..##......##..##......##..##",
    "##..##..##..##..##..##..##..##",
    "##..##..##..##..##..##..##..##",
    "##..##......##..##......##..##",
    "##..###....###..###....###..##",
    "##...########....########...##",
    "##....######......######....##",
    "##..........................##",
    "###........................###",
    "##############################",
    ".############################.",
]
IW, IH = len(ICON_ART[0]), len(ICON_ART)
COLOUR = {"#": WHITE, **{str(i + 1): c for i, c in enumerate(BARS + SHADES)}}

WORD = "boopbox"
# The wordmark's letters in Pixelify Sans Bold (SIL OFL 1.1, the website's font: web/site/public/fonts/PixelifySans-OFL.txt).
# Its outlines sit on a grid of 44 font units (1000 to the em): these are the four glyphs' pixels on that grid, read
# from the font (11 wide; 4 rows of ascender, 11 of x-height, 4 of descender). The letters advance 14 (the font: 13.7).
GLYPHS = {
    "b": ["###........", "###........", "###........", "###........",
          "#########..", "#########..", "###########", "###.....###", "###.....###", "###.....###", "###.....###",
          "###.....###", "###########", "..#######..", "..#######..",
          "...........", "...........", "...........", "..........."],
    "o": ["...........", "...........", "...........", "...........",
          "..#######..", "..#######..", "###########", "###.....###", "###.....###", "###.....###", "###.....###",
          "###.....###", "###########", "..#######..", "..#######..",
          "...........", "...........", "...........", "..........."],
    "p": ["...........", "...........", "...........", "...........",
          "..#######..", "..#######..", "###########", "###.....###", "###.....###", "###.....###", "###.....###",
          "###.....###", "###########", "#########..", "#########..",
          "###........", "###........", "###........", "###........"],
    "x": ["...........", "...........", "...........", "...........",
          "###.....###", "###.....###", "#####.#####", "..###.###..", "..#######..", "....###....", "..#######..",
          "..###.###..", "#####.#####", "###.....###", "###.....###",
          "...........", "...........", "...........", "..........."],
}
GW, GH, GADV, ASC, XROWS = 11, 19, 14, 4, 11        # glyph width, rows, advance; ascender rows, x-height rows
WORD_W = GADV * (len(WORD) - 1) + GW                # the word's width in glyph pixels (95)


# ---- drawing: a grid's pixels as runs of one colour ----------------------------------------------------------------
def runs(art, dx=0):
    """[(colour, x, y, length)] of a grid of characters ('.' empty)"""
    out = []
    for y, row in enumerate(art):
        for m in re.finditer(r"([^.])\1*", row):
            out.append((COLOUR.get(m.group(1), WHITE), dx + m.start(), y, m.end() - m.start()))
    return out


def icon_runs():
    return runs(ICON_ART)


def word_runs():
    """the word's runs, y from the ascender's top"""
    out = []
    for i, ch in enumerate(WORD):
        out += runs(GLYPHS[ch], i * GADV)
    return out


def draw(d, rs, ox, oy, p):
    """runs drawn with their top left at (ox, oy), p image pixels a grid pixel"""
    for c, x, y, n in rs:
        d.rectangle([ox + x * p, oy + y * p, ox + (x + n) * p - 1, oy + (y + 1) * p - 1], fill=c)


# the side-by-side logo, in grid pixels: a margin, the icon, a gap, the word; the word's x-height centred on the body
LOGO_M, LOGO_GAP = 2, 6
LOGO_W, LOGO_H = 2 * LOGO_M + IW + LOGO_GAP + WORD_W, 2 * LOGO_M + IH
WORD_Y = LOGO_M + (5 + IH) // 2 - (XROWS + 1) // 2 - ASC    # (the body: rows 5..IH-1)


def render(kind, W, H, p=None, bg=BLACK, pad=0.0):
    """kind "h": the logo, p image pixels a grid pixel; "v": the icon over the word (the boot splash); "i": the icon
    alone, centred, as big as fits in (1 - pad) of the square"""
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    if kind == "h":
        draw(d, icon_runs(), LOGO_M * p, LOGO_M * p, p)
        draw(d, word_runs(), (LOGO_M + IW + LOGO_GAP) * p, WORD_Y * p, p)
    elif kind == "v":
        pi, pw = 4, max(1, (W - 16) // WORD_W)
        draw(d, icon_runs(), (W - IW * pi) // 2, 0, pi)
        draw(d, word_runs(), (W - WORD_W * pw) // 2, IH * pi + 8, pw)
    else:
        p = max(1, int(W * (1 - pad)) // max(IW, IH))
        draw(d, icon_runs(), (W - IW * p) // 2, (H - IH * p) // 2, p)
    return im


# ---- SVG: one path a colour, of the pixels' runs ----------------------------------------------------------------------
def svg_paths(rs, ox, oy, p):
    by = {}
    for c, x, y, n in rs:
        by.setdefault(c, []).append(f"M{ox + x * p:g} {oy + y * p:g}h{n * p:g}v{p:g}h{-n * p:g}z")
    return [f'<path d="{"".join(v)}" fill="{HEX(c)}"/>' for c, v in by.items()]


def svg(kind):
    P = 8
    if kind == "h":
        W, H = LOGO_W * P, LOGO_H * P
        body = (svg_paths(icon_runs(), LOGO_M * P, LOGO_M * P, P) +
                svg_paths(word_runs(), (LOGO_M + IW + LOGO_GAP) * P, WORD_Y * P, P))
    else:
        W = H = max(IW, IH) * P
        body = svg_paths(icon_runs(), (W - IW * P) // 2, (H - IH * P) // 2, P)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
            f'aria-label="BoopBox" shape-rendering="crispEdges">\n<rect width="{W}" height="{H}" fill="#000"/>\n' +
            "\n".join(body) + "\n</svg>\n")


# ---- firmware splash ---------------------------------------------------------------------------
SPLASH_W, SPLASH_H = 240, 188                     # the icon 4 px a pixel, the wordmark 2 (splash "v")


def rgb565(c):
    r, g, b = c
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)


def splash_header(path):
    im = render("v", SPLASH_W, SPLASH_H)
    # a fixed palette of 16: black, white at 1/3, 2/3 and full, each track colour at 1/2 and full, and the four shades
    # (tracks 5..8); (the pixels are only black, white, the track colours and the shades: the others stay unused)
    cols = [BLACK] + [tuple(round(v * f) for v in WHITE) for f in (1 / 3, 2 / 3, 1.0)]
    for c in BARS:
        cols += [tuple(round(v * f) for v in c) for f in (1 / 2, 1.0)]
    cols += SHADES
    assert len(cols) == 16
    src = im.tobytes()
    px = []
    cache = {}
    for i in range(0, len(src), 3):
        p = (src[i], src[i + 1], src[i + 2])
        if p not in cache:
            cache[p] = min(range(16), key=lambda k: sum((p[j] - cols[k][j]) ** 2 for j in range(3)))
        px.append(cache[p])
    rle = bytearray()                                 # (run - 1) << 4 | index, runs of 1..16
    i = 0
    while i < len(px):
        j = i
        while j < len(px) and px[j] == px[i] and j - i < 16:
            j += 1
        rle.append(((j - i - 1) << 4) | px[i])
        i = j
    L = ["/* generated by tools/gen_logo.py: the BoopBox boot splash */", "#pragma once", "#include <stdint.h>",
         "/* the logo, icon over wordmark (FELUCCA_LOGO_TEXT 0) */", "#if !defined(FELUCCA_LOGO_TEXT) || !FELUCCA_LOGO_TEXT",
         f"#define BOOPBOX_SPLASH_W {SPLASH_W}", f"#define BOOPBOX_SPLASH_H {SPLASH_H}",
         "static const uint16_t BOOPBOX_SPLASH_PAL[16] = {" + ", ".join(f"0x{rgb565(c):04X}" for c in cols) + "};",
         f"static const uint8_t BOOPBOX_SPLASH_RLE[{len(rle)}] = {{"]
    for k in range(0, len(rle), 24):
        L.append("    " + ", ".join(str(b) for b in rle[k:k + 24]) + ",")
    L.append("};")
    # the wordmark alone, 1 bit a pixel (the default boot logo and MENU > ABOUT, splash.c): the four glyphs' rows (bit
    # GW - 1 the leftmost pixel) and the word as glyph indices
    gl = sorted(set(WORD))
    L += ["#endif", "/* the wordmark \"boopbox\" in Pixelify Sans Bold: glyphs of W x H pixels, each ADV to the",
          "   right of the last; the boot logo (FELUCCA_LOGO_TEXT 1) and MENU > ABOUT's title */",
          f"#define BOOPBOX_WORD_N {len(WORD)}", f"#define BOOPBOX_GLYPH_W {GW}", f"#define BOOPBOX_GLYPH_H {GH}",
          f"#define BOOPBOX_GLYPH_ADV {GADV}", f"#define BOOPBOX_WORD_W {WORD_W}",
          f"static const uint8_t BOOPBOX_WORD[{len(WORD)}] = {{" + ", ".join(str(gl.index(c)) for c in WORD) + "};",
          f"static const uint16_t BOOPBOX_GLYPHS[{len(gl)}][{GH}] = {{"]
    for c in gl:
        rows = ", ".join("0x%03X" % int(r.replace("#", "1").replace(".", "0"), 2) for r in GLYPHS[c])
        L.append(f"    {{{rows}}},  /* {c} */")
    L.append("};")
    Path(path).write_text("\n".join(L) + "\n")
    print(f"logo: splash {SPLASH_W}x{SPLASH_H}, {len(rle)} B RLE -> {path}")


def assets(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "boopbox-logo.svg").write_text(svg("h"))
    (out / "boopbox-icon.svg").write_text(svg("i"))
    render("h", LOGO_W * 16, LOGO_H * 16, 16).save(out / "boopbox-logo.png")
    render("i", 512, 512).save(out / "boopbox-icon.png")
    render("v", SPLASH_W, SPLASH_H).resize((SPLASH_W * 2, SPLASH_H * 2), Image.NEAREST).save(out / "boopbox-splash.png")
    print(f"logo: assets in {out}")


def web(out):
    """the web app's icons: 'any' with a small margin, 'maskable' inside the 80 % safe circle"""
    out = Path(out)
    render("i", 192, 192, pad=0.08).save(out / "icon-192.png", optimize=True)
    render("i", 512, 512, pad=0.08).save(out / "icon-512.png", optimize=True)
    render("i", 512, 512, pad=0.26).save(out / "icon-maskable-512.png", optimize=True)
    print(f"logo: web icons in {out}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--assets":
        assets(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == "--web":
        web(sys.argv[2])
    elif len(sys.argv) == 2:
        splash_header(sys.argv[1])
    else:
        sys.exit(__doc__)
