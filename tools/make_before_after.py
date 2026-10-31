#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Every screen before and after a change, side by side, in one large image.

  tools/make_before_after.py BEFORE_DIR AFTER_DIR OUT.png [TITLE]

BEFORE_DIR and AFTER_DIR are galleries made by tools/make_all_screens.py (group/screen.png at 2x, and its README.md):
for example the one in assets/screens/all copied aside before the change, and the one made after it. Screens are
paired by name; a page that moved to another family is paired by what it holds (MOVED below); a screen that is gone
or new is shown alone, so marked.
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# (1.2) pages that moved: the old name -> the new one (the MIDI setup out of GLO, INSERT 2 into FX > FILTER)
MOVED = {
    "glo-midi": "midi-midi",
    "glo-midi-4": "midi-midi-2",        # CH5..CH8
    "glo-midi-2": "midi-midi-3",        # IN, OTHER, OUT, BEND
    "glo-midi-3": "midi-midi-4",        # FX CH, DR MAP, REMOTE, CLOCK
    "glo-system": "midi-system",
    "glo-drums": "glo-drums",
}
GROUPS = ["home", "pages", "drums", "engines", "layers", "rec", "system", "visualiser"]
S, GAP, PAD, CAP = 240, 6, 18, 40          # a screen at 1x, between a pair, between pairs, the caption
BG, CARD, TXT, SUB, OLD, NEW = (24, 24, 28), (34, 34, 40), (236, 236, 240), (150, 150, 158), (255, 120, 120), (120, 230, 150)


def font(bold, size):
    for d in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu"):
        try:
            return ImageFont.truetype(f"{d}/DejaVuSans{'-Bold' if bold else ''}.ttf", size)
        except OSError:
            pass
    return ImageFont.load_default()


def gallery(d):
    """name -> (group, title) from a gallery's README table, in its order"""
    out = {}
    for ln in (Path(d) / "README.md").read_text().splitlines():
        m = re.match(r"\| (.+?) \| \[`(\w+)/([\w-]+)\.png`\]", ln)
        if m:
            out[m.group(3)] = (m.group(2), m.group(1))
    return out


def main():
    before, after, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    title = sys.argv[4] if len(sys.argv) > 4 else "Every screen: before and after"
    gb, ga = gallery(before), gallery(after)
    back = {v: k for k, v in MOVED.items()}
    pairs, used = [], set()
    for g in GROUPS:                                  # the new screens in their order, each with its old one
        for name, (grp, t) in ga.items():
            if grp != g:
                continue
            old = back.get(name, name) if back.get(name, name) in gb else None
            pairs.append((old, name, t))
            used.add(old)
        for name, (grp, t) in gb.items():             # the old ones that are gone, after their group
            if grp == g and name not in used and MOVED.get(name, name) not in ga:
                pairs.append((name, None, t))
    cols = 4
    pw = 2 * S + GAP
    rows = (len(pairs) + cols - 1) // cols
    W = PAD + cols * (pw + PAD)
    H = 110 + rows * (S + CAP + PAD)
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((PAD, 24), title, font=font(True, 34), fill=TXT)
    d.text((PAD, 70), "each pair: before (left), after (right), drawn by the firmware's own code in SYNTHWAVE",
           font=font(False, 18), fill=SUB)
    ft, fs = font(True, 15), font(False, 13)
    for k, (old, new, t) in enumerate(pairs):
        x, y = PAD + (k % cols) * (pw + PAD), 110 + (k // cols) * (S + CAP + PAD)
        d.rectangle([x - 4, y - 4, x + pw + 3, y + S + CAP - 4], fill=CARD)
        for j, (name, base, gal) in enumerate(((old, before, gb), (new, after, ga))):
            px = x + j * (S + GAP)
            if name:
                im.paste(Image.open(base / gal[name][0] / f"{name}.png").convert("RGB").resize((S, S), Image.NEAREST),
                         (px, y))
            else:
                d.rectangle([px, y, px + S - 1, y + S - 1], fill=BG)
                d.text((px + S // 2, y + S // 2), "new" if j == 0 else "gone", font=ft, fill=NEW if j == 0 else OLD,
                       anchor="mm")
        d.text((x, y + S + 6), t, font=ft, fill=TXT)
        note = "moved" if old and new and old != new else "new" if not old else "gone" if not new else ""
        if note:
            d.text((x + pw, y + S + 6), note, font=fs, fill=NEW if note != "gone" else OLD, anchor="ra")
    im.save(out, optimize=True)
    print(f"before / after: {out} ({W}x{H}, {len(pairs)} screens)")


if __name__ == "__main__":
    main()
