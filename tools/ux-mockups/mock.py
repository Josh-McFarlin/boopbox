#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The UX review's pictures (docs/ux-review/README.md): a screen before the change and after it, side by side, both drawn
by the firmware's own code in SYNTHWAVE (tools/make_all_screens.py). The proposals were drawn by hand here before 1.2.0
built them; these are the real screens now.

  python3 tools/ux-mockups/mock.py BEFORE_DIR AFTER_DIR [OUT_DIR]      (default OUT_DIR: docs/ux-review)

BEFORE_DIR, AFTER_DIR: galleries of tools/make_all_screens.py (group/screen.png), the one before the change copied
aside first.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W = 240
# the review's pictures: (file, the screen before, the screen after, the caption before, the caption after)
PAIRS = [
    ("1-value-page.png", "engine-analog-edit1", "engine-analog-edit1", "1.1.0: EDIT 1, every value twice",
     "1.2.0: four corners, page tabs"),
    ("2-graph-page.png", "env-env", "env-env", "1.1.0: ENV", "1.2.0: the curve in the knobs' colours"),
    ("3-track-anywhere.png", "env-env", "env-algorithm", "1.1.0: ALGORITHM does nothing here",
     "1.2.0: ALGORITHM picks the track on any page"),
    ("4-mixer-layer.png", "layer-glo", "layer-glo", "1.1.0: GLO held", "1.2.0: GLO held, faders and mute / solo"),
    ("5-step-sheet.png", "seq-notes-sheet", "seq-notes-sheet", "1.1.0: a step's sheet", "1.2.0: OCT- / OCT+ written"),
    ("6-midi-setup.png", "glo-midi-2", "midi-midi-3", "1.1.0: GLO > MIDI 2, page 6 of 10",
     "1.2.0: MENU > SEQ > MIDI SETTINGS"),
    ("7-value-words.png", "fx-perf", "fx-perf", "1.1.0: FX > PERF, TARGE MASTE", "1.2.0: whole words"),
]


def shot(base, name):
    for p in Path(base).glob(f"*/{name}.png"):
        return Image.open(p).convert("RGB").resize((W, W), Image.NEAREST)
    raise FileNotFoundError(f"{base}: {name}")


def pair(before, after, title_b, title_a, out):
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except OSError:
        f = ImageFont.load_default()
    S, P = 480, 24
    im = Image.new("RGB", (P * 3 + 2 * S, P + S + 44), (28, 28, 32))
    d = ImageDraw.Draw(im)
    for k, (img, t) in enumerate(((before, title_b), (after, title_a))):
        x = P + k * (S + P)
        im.paste(img.resize((S, S), Image.NEAREST), (x, P))
        d.text((x, P + S + 12), t, font=f, fill=(200, 200, 208))
    im.save(out, optimize=True)
    print(f"pair: {out}")


def main():
    before, after = Path(sys.argv[1]), Path(sys.argv[2])
    out = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "docs" / "ux-review"
    out.mkdir(parents=True, exist_ok=True)
    for f, b, a, tb, ta in PAIRS:
        pair(shot(before, b), shot(after, a), tb, ta, out / f)


if __name__ == "__main__":
    main()
