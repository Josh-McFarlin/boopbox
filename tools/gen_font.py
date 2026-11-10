#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
"""Render the bitmap fonts to a C header (assets/fonts/):
  S  labels / units / status   Latin-1 32..255 at 1x
  L  large values / titles     32..95 (digits, signs, capitals), the same glyphs at 2x
Terminus Bold 8x16 (BDF, SIL OFL 1.1). TTF fonts also work through render()
(anti-aliased, tabular figures via the OpenType `tnum` feature).

Glyph format: per glyph an advance width, a bitmap width and an offset; the
bitmap starts FONT_PAD pixels left of the pen position (room for side
bearings); rows top to bottom. A font whose pixels are all on or off (the
Terminus pixel font) is stored at 1 bit a pixel (SLOOP 2.6: 5376 bytes
instead of 21504), the glyph's rows one after the other, high bit first, each
glyph from a whole byte, and marked bits = 1; an anti-aliased one (TTF) stays at
2 pixels per byte (high nibble first), alpha 0..15, bits = 0 (gfx.c cv_text).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lz4blk  # noqa: E402

from PIL import Image, ImageDraw, ImageFont

FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"
# (name, file, px, scale, pixel, first, last): pixel fonts are rendered without
# anti-aliasing at their design size and enlarged by an integer factor
# SLOOP 2.6: Terminus Bold (the same 8 x 16 cell and advances as the regular one: no layout moves), drawn in
# capitals only (gfx.c glyph); the regular ter-u16n.bdf stays for the web editor's font (gen_webfont.py)
SIZES = [("S", "ter-u16b.bdf", 16, 1, True, 32, 255),   # Latin-1 (Hügelton needs the umlaut)
         ("L", "ter-u16b.bdf", 16, 2, True, 32, 95)]   # values / titles: digits, signs, capitals
PAD = 2


def upscale(px_, w, h, scale):
    """integer nearest-neighbour enlargement of a w x h glyph"""
    if scale == 1:
        return px_
    big = []
    for y in range(h):
        row = []
        for x in range(w):
            row += [px_[y * w + x]] * scale
        big += row * scale
    return big


def render_bdf(path, scale, first, last):
    """BDF bitmap font (Terminus 8x16): exact pixels, cell = the font bounding box."""
    lines = path.read_text(errors="replace").splitlines()
    fbb = next(l for l in lines if l.startswith("FONTBOUNDINGBOX")).split()
    cw, ch, fx, fy = int(fbb[1]), int(fbb[2]), int(fbb[3]), int(fbb[4])
    base = ch + fy                                     # rows above the baseline
    glyphs, i = {}, 0
    while i < len(lines):
        if lines[i].startswith("ENCODING"):
            code = int(lines[i].split()[1])
            j = i
            while not lines[j].startswith("BBX"):
                j += 1
            bw, bh, bx, by = map(int, lines[j].split()[1:5])
            dw = cw
            k = i
            while not lines[k].startswith("BITMAP"):
                if lines[k].startswith("DWIDTH"):
                    dw = int(lines[k].split()[1])
                k += 1
            rows = [int(r, 16) for r in lines[k + 1:k + 1 + bh]]
            nbits = ((bw + 7) // 8) * 8
            cell = [0] * (cw * ch)
            top = base - (by + bh)
            for r, bits in enumerate(rows):
                for c in range(bw):
                    if bits >> (nbits - 1 - c) & 1:
                        x, y = bx + c, top + r
                        if 0 <= x < cw and 0 <= y < ch:
                            cell[y * cw + x] = 15
            glyphs[code] = (dw, cell)
            i = k + bh
        i += 1
    if 0xDC not in glyphs and ord("U") in glyphs:      # Ü for "HÜGELTON": U with dots on its top row
        dw, cell = glyphs[ord("U")]
        cell = cell[:]
        lit = [x for y in range(ch) for x in range(cw) if cell[y * cw + x]]
        if lit:
            top = min(y for y in range(ch) for x in range(cw) if cell[y * cw + x])
            for x in range(cw):
                cell[top * cw + x] = 15 if x in (min(lit), max(lit)) else 0
            for x in range(cw):
                cell[(top + 1) * cw + x] = 0
            glyphs[0xDC] = (dw, cell)
    missing = [chr(c) for c in range(first, min(last, 126) + 1) if c not in glyphs]
    if missing:
        print(f"font {path.name}: no glyph for {''.join(missing)!r} (drawn as '?')")
    out = []
    for c in range(first, last + 1):
        dw, cell = glyphs.get(c, glyphs[ord("?")])
        bw = cw + 2 * PAD                              # keep the PAD convention of the TTF path
        px_ = []
        for y in range(ch):
            px_ += [0] * PAD + cell[y * cw:(y + 1) * cw] + [0] * PAD
        out.append((dw * scale, bw * scale, upscale(px_, bw, ch, scale)))
    return ch * scale, out


def render(ttf, px, scale, pixel, first, last):
    if ttf.endswith(".bdf"):
        return render_bdf(FONTS / ttf, scale, first, last)
    font = ImageFont.truetype(str(FONTS / ttf), px)
    feats = None if pixel else ["tnum"]
    asc, desc = font.getmetrics()
    top = max(0, font.getbbox("A8|(", features=feats)[1] - 1)
    h = asc + desc - top
    glyphs = []
    for c in range(first, last + 1):
        ch = chr(c)
        adv = int(round(font.getlength(ch, features=feats)))
        bw = adv + 2 * PAD
        img = Image.new("L", (bw, asc + desc), 0)
        ImageDraw.Draw(img).text((PAD, 0), ch, font=font, fill=255, features=feats)
        img = img.crop((0, top, bw, top + h))
        px_ = [(15 if v >= 128 else 0) if pixel else min(15, (v + 8) // 17) for v in img.tobytes()]
        glyphs.append((adv * scale, bw * scale, upscale(px_, bw, h, scale)))
    return h * scale, glyphs


# (1.8) The glyphs the screen can draw (gfx.c glyph): 32..96, 123..126 and the U umlaut (HÜGELTON); lower case folds
# to capitals, Latin-1 accented capitals to their letter (É -> E), everything else draws as '?'. 70 glyphs.
CODES = list(range(32, 97)) + list(range(123, 127)) + [0xDC]


def main(out):
    """the screen font as raw 1-bit glyphs: 16 rows of 8 pixels (high bit left), 16 bytes a glyph, read in place from
    flash (no table, no RAM copy: 1.8, docs/memory-savings-analysis.md F4). The Terminus cell is 8 x 16 and every glyph
    advances 8, so a glyph's bitmap is its cell at the pen; FONT_L is the same bitmaps drawn at 2x"""
    name, ttf, px, scale, pixel, first, last = SIZES[0]
    assert ttf.endswith(".bdf") and scale == 1 and pixel
    h, glyphs = render_bdf(FONTS / ttf, 1, first, last)
    data = []
    for c in CODES:
        adv, bw, g = glyphs[c - first]
        assert adv == 8 and bw == 8 + 2 * PAD and h == 16, f"glyph {c}: an 8 x 16 cell"
        for y in range(h):
            row = g[y * bw:(y + 1) * bw]
            assert not any(row[:PAD]) and not any(row[PAD + 8:]), f"glyph {c}: nothing outside its 8 columns"
            data.append(sum(1 << (7 - x) for x in range(8) if row[PAD + x]))
    lines = [f"/* generated by tools/gen_font.py from {ttf} */", "#pragma once", "#include <stdint.h>",
             "#define FONT_PAD 0                       /* (the glyphs start at the pen) */", "",
             f"/* {len(CODES)} glyphs (gfx.c glyph): " + " ".join(str(c) for c in CODES) + " */",
             f"static const uint8_t FONT_S_DATA[{len(data)}] = {{"]
    for i in range(0, len(data), 16):
        lines.append("    " + ", ".join(f"0x{b:02x}" for b in data[i:i + 16]) + ",")
    lines.append("};")
    # (tools/trainer reads the advances from here; the firmware does not: every glyph advances 8)
    lines.append(f"static const uint8_t FONT_S_ADV[{last - first + 1}] = {{" + ", ".join("8" for _ in range(first, last + 1)) + "};")
    lines.append(f"static const felucca_font_t FONT_S = {{ 16, {first}, {last}, 0 }};")
    lines.append(f"static const felucca_font_t FONT_L = {{ 32, {first}, 95, 1 }};   /* the S bitmaps at 2x */")
    lines.append("static void font_fill(void) {}       /* (nothing to unpack since 1.8) */")
    Path(out).write_text("\n".join(lines) + "\n")
    print(f"font S: {ttf} {px}px h {h}, {len(CODES)} glyphs, {len(data)} B; font L: the same at 2x (0 B)")


if __name__ == "__main__":
    main(sys.argv[1])
