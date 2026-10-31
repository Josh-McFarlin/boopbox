#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The BoopBox logo: a boombox face (a handle, a rounded body, two speakers) whose display holds eight
level bars, the eight tracks: 1..4 on top in the four track colours (blue, green, yellow, orange), 5..8 below in
their shades (as the firmware draws tracks 5..8: gfx.c ui_shade), and a geometric monoline wordmark.

  tools/gen_logo.py OUT.h          firmware boot splash (RLE, 16-colour palette, RGB565)
  tools/gen_logo.py --assets DIR   boopbox-logo.svg/png, boopbox-icon.svg/png, boopbox-splash.png
  tools/gen_logo.py --web DIR      the web app's icons: icon-192.png, icon-512.png, icon-maskable-512.png
"""
import math
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

# ---- geometry (units: the icon is 240 x 240, the wordmark x-height is 72) -------------------
# the body (outline), the handle above it, the display's four bars, the two speakers (ring + cone)
ICON = dict(w=12, body=(18, 74, 222, 210), body_r=28, handle=(70, 38, 170), handle_r=16,
            bars=(44, 88, 196, 98), bar_row=14, bar_gap=8, spk=((78, 158), (162, 158)), spk_r=29, cone_r=10)
XH, SW = 72, 12                                  # wordmark x-height, stroke
WORD = "boopbox"


def bar_boxes(ox, oy, k):
    """the display's eight bars, two rows of four (tracks 1..4, then 5..8): (colour, x0, y0, x1, y1)"""
    x0, y0, x1, y1 = ICON["bars"]
    g, dy = ICON["bar_gap"], ICON["bar_row"]
    bw = (x1 - x0 - 3 * g) / 4
    return [(c, ox + (x0 + i * (bw + g)) * k, oy + (y0 + r * dy) * k, ox + (x0 + i * (bw + g) + bw) * k,
             oy + (y1 + r * dy) * k)
            for r, row in enumerate((BARS, SHADES)) for i, c in enumerate(row)]


def rrect(d, box, r, fill):
    """filled rounded rectangle (ImageDraw.rounded_rectangle needs Pillow 8.2)"""
    x0, y0, x1, y1 = box
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    d.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    d.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def ring(d, cx, cy, r, w, col, bg):
    """a ring of radius r (to the stroke's centre), stroke w"""
    d.ellipse([cx - r - w / 2, cy - r - w / 2, cx + r + w / 2, cy + r + w / 2], fill=col)
    d.ellipse([cx - r + w / 2, cy - r + w / 2, cx + r - w / 2, cy + r - w / 2], fill=bg)


def draw_icon(d, ox, oy, k, bg=BLACK):
    g = ICON
    w = g["w"] * k
    # the handle: two posts and a bar, rounded corners, drawn as a thick rounded outline cut by the body
    hx0, hy, hx1 = g["handle"]
    hb = g["body"][1]
    rrect(d, [ox + hx0 * k - w / 2, oy + hy * k - w / 2, ox + hx1 * k + w / 2, oy + hb * k], g["handle_r"] * k + w / 2,
          WHITE)
    rrect(d, [ox + hx0 * k + w / 2, oy + hy * k + w / 2, ox + hx1 * k - w / 2, oy + hb * k], g["handle_r"] * k - w / 2,
          bg)
    # the body
    x0, y0, x1, y1 = g["body"]
    rrect(d, [ox + x0 * k - w / 2, oy + y0 * k - w / 2, ox + x1 * k + w / 2, oy + y1 * k + w / 2], g["body_r"] * k + w / 2,
          WHITE)
    rrect(d, [ox + x0 * k + w / 2, oy + y0 * k + w / 2, ox + x1 * k - w / 2, oy + y1 * k - w / 2], g["body_r"] * k - w / 2,
          bg)
    # the display
    for c, bx0, by0, bx1, by1 in bar_boxes(ox, oy, k):
        rrect(d, [bx0, by0, bx1, by1], (by1 - by0) / 2, c)
    # the speakers
    for cx, cy in g["spk"]:
        ring(d, ox + cx * k, oy + cy * k, g["spk_r"] * k, w, WHITE, bg)
        r = g["cone_r"] * k
        d.ellipse([ox + cx * k - r, oy + cy * k - r, ox + cx * k + r, oy + cy * k + r], fill=WHITE)


# ---- the wordmark: b, o, p, x from circles and strokes ----------------------------------------
def letters():
    """-> [(letter, x offset)], total width (units)"""
    out, x = [], 0
    for i, ch in enumerate(WORD):
        out.append((ch, x))
        x += (60 if ch == "x" else XH) + (18 if i < len(WORD) - 1 else 0)
    return out, x


def word_width(k):
    return letters()[1] * k


def draw_word(d, ox, oy, k, col=WHITE):
    w, xh = SW * k, XH * k
    R = xh / 2

    def cap(x, y):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)

    def line(x0, y0, x1, y1):
        d.line([(x0, y0), (x1, y1)], fill=col, width=max(1, round(w)))
        cap(x0, y0)
        cap(x1, y1)

    for ch, dx in letters()[0]:
        x = ox + dx * k
        if ch == "x":
            xw = 60 * k
            line(x + w / 2, oy + w / 2, x + xw - w / 2, oy + xh - w / 2)
            line(x + xw - w / 2, oy + w / 2, x + w / 2, oy + xh - w / 2)
            continue
        d.ellipse([x, oy, x + 2 * R, oy + 2 * R], outline=col, width=max(1, round(w)))
        if ch == "b":
            line(x + w / 2, oy - 32 * k, x + w / 2, oy + R)
        elif ch == "p":
            line(x + w / 2, oy + R, x + w / 2, oy + xh + 36 * k)


def render(kind, W, H, k, bg=BLACK, ss=4, pad=0.0):
    im = Image.new("RGB", (W * ss, H * ss), bg)
    d = ImageDraw.Draw(im)
    K = k * ss
    if kind == "h":                                   # icon + wordmark side by side
        draw_icon(d, 10 * K, (H * ss - 240 * K) / 2, K, bg)
        draw_word(d, 280 * K, H * ss / 2 - 26 * K, K)
    elif kind == "v":                                 # icon over the wordmark (the boot splash): the word scaled to fit
        draw_icon(d, (W * ss - 240 * K) / 2, 0, K, bg)
        kw = min(K, (W * ss - 16 * ss) / letters()[1])
        draw_word(d, (W * ss - word_width(kw)) / 2, 240 * K + 40 * kw, kw)
    else:
        K *= 1 - pad
        draw_icon(d, (W * ss - 240 * K) / 2, (H * ss - 240 * K) / 2, K, bg)
    return im.resize((W, H), Image.LANCZOS)


# ---- SVG (stroke centred on the path) ---------------------------------------------------------
def svg_icon(ox, oy):
    g, col = ICON, HEX(WHITE)
    w = g["w"]
    hx0, hy, hx1 = g["handle"]
    hb, r = g["body"][1], g["handle_r"]
    s = [f'<path d="M{ox + hx0} {oy + hb} V{oy + hy + r} A{r} {r} 0 0 1 {ox + hx0 + r} {oy + hy} '
         f'H{ox + hx1 - r} A{r} {r} 0 0 1 {ox + hx1} {oy + hy + r} V{oy + hb}" fill="none" stroke="{col}" '
         f'stroke-width="{w}"/>']
    x0, y0, x1, y1 = g["body"]
    s.append(f'<rect x="{ox + x0}" y="{oy + y0}" width="{x1 - x0}" height="{y1 - y0}" rx="{g["body_r"]}" fill="#000" '
             f'stroke="{col}" stroke-width="{w}"/>')
    for c, bx0, by0, bx1, by1 in bar_boxes(ox, oy, 1.0):
        s.append(f'<rect x="{bx0:.2f}" y="{by0:.2f}" width="{bx1 - bx0:.2f}" height="{by1 - by0:.2f}" '
                 f'rx="{(by1 - by0) / 2:.2f}" fill="{HEX(c)}"/>')
    for cx, cy in g["spk"]:
        s.append(f'<circle cx="{ox + cx}" cy="{oy + cy}" r="{g["spk_r"]}" fill="none" stroke="{col}" stroke-width="{w}"/>')
        s.append(f'<circle cx="{ox + cx}" cy="{oy + cy}" r="{g["cone_r"]}" fill="{col}"/>')
    return s


def svg_word(ox, oy):
    w, xh, col = SW, XH, HEX(WHITE)
    R = xh / 2
    st = f'stroke="{col}" stroke-width="{w}" stroke-linecap="round"'
    s = []
    for ch, dx in letters()[0]:
        x = ox + dx
        if ch == "x":
            s.append(f'<line x1="{x + w / 2:.2f}" y1="{oy + w / 2:.2f}" x2="{x + 60 - w / 2:.2f}" y2="{oy + xh - w / 2:.2f}" {st}/>')
            s.append(f'<line x1="{x + 60 - w / 2:.2f}" y1="{oy + w / 2:.2f}" x2="{x + w / 2:.2f}" y2="{oy + xh - w / 2:.2f}" {st}/>')
            continue
        s.append(f'<circle cx="{x + R:.2f}" cy="{oy + R:.2f}" r="{R - w / 2:.2f}" fill="none" stroke="{col}" stroke-width="{w}"/>')
        if ch == "b":
            s.append(f'<line x1="{x + w / 2:.2f}" y1="{oy - 32 + w / 2:.2f}" x2="{x + w / 2:.2f}" y2="{oy + R:.2f}" {st}/>')
        elif ch == "p":
            s.append(f'<line x1="{x + w / 2:.2f}" y1="{oy + R:.2f}" x2="{x + w / 2:.2f}" y2="{oy + xh + 36 - w / 2:.2f}" {st}/>')
    return s


def svg(kind):
    if kind == "h":
        W, H = 900, 260
        body = svg_icon(10, 10) + svg_word(280, H / 2 - 26)
    else:
        W, H = 240, 240
        body = svg_icon(0, 0)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
            f'aria-label="BoopBox">\n<rect width="{W}" height="{H}" fill="#000"/>\n' + "\n".join(body) + "\n</svg>\n")


# ---- firmware splash ---------------------------------------------------------------------------
SPLASH_W, SPLASH_H = 240, 188
SPLASH_K = 0.5                                    # the icon 120 px; the wordmark scaled to the width (splash "v")


def rgb565(c):
    r, g, b = c
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)


def splash_header(path):
    im = render("v", SPLASH_W, SPLASH_H, SPLASH_K)
    # a fixed palette of 16: black, white at 1/3, 2/3 and full (the anti-aliased edges of the outlines and the
    # wordmark), each track colour at 1/2 and full, and the four shades (tracks 5..8)
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
         f"#define BOOPBOX_SPLASH_W {SPLASH_W}", f"#define BOOPBOX_SPLASH_H {SPLASH_H}",
         "static const uint16_t BOOPBOX_SPLASH_PAL[16] = {" + ", ".join(f"0x{rgb565(c):04X}" for c in cols) + "};",
         f"static const uint8_t BOOPBOX_SPLASH_RLE[{len(rle)}] = {{"]
    for k in range(0, len(rle), 24):
        L.append("    " + ", ".join(str(b) for b in rle[k:k + 24]) + ",")
    L.append("};")
    Path(path).write_text("\n".join(L) + "\n")
    print(f"logo: splash {SPLASH_W}x{SPLASH_H}, {len(rle)} B RLE -> {path}")


def assets(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "boopbox-logo.svg").write_text(svg("h"))
    (out / "boopbox-icon.svg").write_text(svg("i"))
    render("h", 1800, 520, 2.0).save(out / "boopbox-logo.png")
    render("i", 512, 512, 512 / 240).save(out / "boopbox-icon.png")
    render("v", SPLASH_W, SPLASH_H, SPLASH_K).resize((SPLASH_W * 2, SPLASH_H * 2), Image.NEAREST).save(out / "boopbox-splash.png")
    print(f"logo: assets in {out}")


def web(out):
    """the web app's icons: 'any' with a small margin, 'maskable' inside the 80 % safe circle"""
    out = Path(out)
    render("i", 192, 192, 192 / 240, pad=0.08).save(out / "icon-192.png", optimize=True)
    render("i", 512, 512, 512 / 240, pad=0.08).save(out / "icon-512.png", optimize=True)
    render("i", 512, 512, 512 / 240, pad=0.26).save(out / "icon-maskable-512.png", optimize=True)
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
