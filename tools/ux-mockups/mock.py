#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Mockups for the UX review (docs/ux-review/README.md): proposed screens drawn at the FM-1's 240 x 240 in its own
font (Terminus 16 bold, assets/fonts; the large size is it at 2x, as FONT_L) and its MONO colours, each beside the
screen as the firmware draws it today (assets/screens/all, tools/make_all_screens.py).

  python3 tools/ux-mockups/mock.py [OUT_DIR]      (default: docs/ux-review)
"""
import sys
import tempfile
from pathlib import Path

from PIL import BdfFontFile, Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "assets" / "screens" / "all"
W = 240
# the firmware's MONO colours (gfx.c): the knobs' / tracks' colours, the screen's greys, the five steps
KC = [(40, 124, 255), (30, 204, 112), (255, 198, 24), (255, 98, 26)]
T58 = [(137, 183, 255), (131, 227, 176), (255, 224, 128), (255, 169, 129)]
TILE, EMPTY, LABEL, SEC = (26, 26, 30), (54, 54, 60), (118, 118, 126), (196, 196, 204)
LINE, DIM, HI, WHITE, RED = (40, 40, 40), (80, 80, 80), (226, 226, 226), (255, 255, 255), (230, 40, 40)

_tmp = Path(tempfile.mkdtemp())
with open(ROOT / "assets" / "fonts" / "ter-u16b.bdf", "rb") as f:
    BdfFontFile.BdfFontFile(f).save(str(_tmp / "s"))
FS = ImageFont.load(str(_tmp / "s.pil"))


def dim(c, k):
    return tuple(int(x * k) for x in c)


class Screen:
    def __init__(self):
        self.im = Image.new("RGB", (W, W), (0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def text(self, x, y, s, c, big=False, anchor="l"):
        s = s.upper()
        w = len(s) * 8
        if not big:
            x = x - w // 2 if anchor == "c" else x - w if anchor == "r" else x
            self.d.text((x, y), s, font=FS, fill=c)
            return x + w
        m = Image.new("L", (w, 16))
        ImageDraw.Draw(m).text((0, 0), s, font=FS, fill=255)
        m = m.resize((w * 2, 32), Image.NEAREST)
        x = x - w if anchor == "c" else x - 2 * w if anchor == "r" else x
        self.im.paste(Image.new("RGB", m.size, c), (x, y), m)
        return x + 2 * w

    def rect(self, x, y, w, h, c):
        self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

    def head(self, track=0, name="808 BOOM", playing=True):
        """the proposed status bar: transport, BPM, and the track with its sound (no footer repeats it)"""
        if playing:
            for i in range(5):
                self.rect(4 + i * 2, 4 + i, 2, 10 - 2 * i, WHITE)
        self.text(20, 1, "92", HI)
        self.rect(54, 2, 14, 16, (KC + T58)[track])
        self.text(57, 1, str(track + 1), (0, 0, 0))
        self.text(74, 1, name, SEC)
        self.rect(0, 20, W, 1, LINE)

    def tabs(self, names, cur, y=222):
        """the proposed page tabs: the family's pages by name, the one shown lit (instead of 'ENV 1/2', the engine
        and the preset in the footer)"""
        self.rect(0, y - 3, W, 1, LINE)
        n = len(names)
        cw = W // n
        for i, t in enumerate(names):
            x = i * cw
            if i == cur:
                self.rect(x + 2, y, cw - 4, 17, EMPTY)
            self.text(x + cw // 2, y + 1, t, WHITE if i == cur else LABEL, anchor="c")

    def quad(self, k, label, value, unit="", hot=False):
        """one of the four values, in the corner of its knob (KNOB 1 top left .. 4 bottom right), its label in the
        knob's colour"""
        x0, y0 = (8 if k % 2 == 0 else 128), (34 if k < 2 else 120)
        self.rect(x0 - 6, y0 + 2, 3, 12, KC[k])
        self.text(x0, y0, label, KC[k])
        x = self.text(x0, y0 + 22, value, WHITE if hot else HI, big=True)
        if unit:
            self.text(x + 4, y0 + 36, unit, LABEL)

    def save(self, path):
        self.im.save(path)


def shot(name):
    for p in SHOTS.glob(f"*/{name}.png"):
        return Image.open(p).convert("RGB").resize((W, W), Image.NEAREST)
    raise FileNotFoundError(name)


# ---------------------------------------------------------------------------------------------------- the mockups --
def m_param():
    """a value page: four values in the knobs' corners, nothing twice; the page's place as tabs"""
    s = Screen()
    s.head(0, "808 BOOM  ANALOG")
    s.quad(0, "WAVE", "SIN")
    s.quad(1, "DETUNE", "0", "CT")
    s.quad(2, "MIX", "0", "%")
    s.quad(3, "NOISE", "0", "%", hot=True)
    s.rect(119, 30, 1, 176, LINE)
    s.rect(4, 112, 232, 1, LINE)
    s.tabs(["OSC", "FLT", "TYPE", "VOICE", "VC 2"], 0)
    return s


def m_env():
    """a graph page: the graph is the display; each part of it in the colour of the knob that moves it"""
    s = Screen()
    s.head(0, "808 BOOM  ANALOG")
    vals = [("ATK", "1.0", "MS"), ("DEC", "3.36", "S"), ("SUS", "0", "%"), ("REL", "43", "MS")]
    for k, (l, v, u) in enumerate(vals):
        x = 4 + k * 59
        s.text(x, 26, l, KC[k])
        e = s.text(x, 44, v, HI)
        s.text(e + 2, 44, u, LABEL)
    top, bot = 80, 196
    a = (10, bot, 22, top)
    s.d.line(a, fill=KC[0], width=2)
    pts = [(22 + i, top + (bot - top) * (1 - 2.718 ** (-i / 9))) for i in range(0, 60)]
    s.d.line(pts, fill=KC[1], width=2)
    s.d.line([(82, bot - 1), (170, bot - 1)], fill=KC[2], width=2)
    s.d.ellipse([18, top - 4, 26, top + 4], outline=KC[0], width=2)
    s.d.ellipse([78, bot - 5, 86, bot + 3], outline=KC[1], width=2)
    s.d.line([(170, bot - 1), (230, bot - 1)], fill=dim(KC[3], 0.8), width=2)
    s.rect(0, bot + 2, W, 1, LINE)
    s.tabs(["ENV", "DEST"], 0)
    return s


def m_track():
    """ALGORITHM turned on any page: the track changes there, a band says which, the page stays"""
    s = Screen()
    s.im.paste(shot("env-env"), (0, 0))
    s.im = Image.blend(s.im, Image.new("RGB", (W, W)), 0.55)
    s.d = ImageDraw.Draw(s.im)
    s.rect(0, 86, W, 68, (0, 0, 0))
    s.rect(0, 86, W, 2, KC[2])
    s.rect(0, 152, W, 2, KC[2])
    s.rect(10, 96, 48, 48, KC[2])
    s.text(34, 104, "3", (0, 0, 0), big=True, anchor="c")
    s.text(68, 98, "LOFI FLUTE", WHITE)
    s.text(68, 118, "SAMPLE", LABEL)
    for i in range(8):
        s.rect(68 + i * 20, 138, 16, 6, (KC + T58)[i] if i == 2 else EMPTY)
    return s


def m_mixer():
    """GLO held: the bank's four levels as faders over the keys that mute and solo them"""
    s = Screen()
    s.text(4, 2, "MIX", WHITE, big=True)
    s.text(72, 18, "TRACKS 1-4", LABEL)
    lv = [81, 81, 81, 78]
    mute = [False, False, True, False]
    solo = [False, True, False, False]
    for k in range(4):
        x = 8 + k * 58
        s.rect(x, 42, 50, 100, TILE)
        h = int(90 * lv[k] / 100)
        c = dim(KC[k], 0.35) if mute[k] else KC[k]
        s.rect(x + 17, 47 + 90 - h, 16, h, c)
        s.text(x + 25, 146, str(lv[k]), HI, anchor="c")
        s.rect(x, 166, 24, 16, RED if mute[k] else EMPTY)
        s.text(x + 12, 166, "M", WHITE if mute[k] else LABEL, anchor="c")
        s.rect(x + 26, 166, 24, 16, (255, 198, 24) if solo[k] else EMPTY)
        s.text(x + 38, 166, "S", (0, 0, 0) if solo[k] else LABEL, anchor="c")
    s.text(120, 190, "KEYS 1-4 MUTE  5-8 SOLO", LABEL, anchor="c")
    for i, (k, t) in enumerate((("9", "FILL"), ("10", "BAR"), ("16", "TAP 92"))):
        x = 4 + i * 79
        s.rect(x, 214, 75, 22, TILE)
        e = s.text(x + 4, 217, k, LABEL)
        s.text(e + 6, 217, t, SEC)
    return s


def m_hint():
    """the step's sheet as pages a tap of OCT+ steps through, with what OCT- and OCT+ do written at the bottom"""
    s = Screen()
    s.head(0, "808 BOOM  ANALOG", playing=False)
    s.text(4, 26, "STEP 5", WHITE)
    s.text(236, 26, "C2", KC[0], anchor="r")
    t = ["NOTE", "LOCKS", "COMP"]
    for i, n in enumerate(t):
        x = 4 + i * 78
        s.rect(x, 46, 74, 18, EMPTY if i == 2 else TILE)
        s.text(x + 37, 47, n, WHITE if i == 2 else LABEL, anchor="c")
    rows = [("PULSE", "+2", ""), ("VEL", "96", "±8"), ("+ ADD", "RAMP", "")]
    for r, (a, b, c) in enumerate(rows):
        y = 76 + r * 36
        if r == 1:
            s.rect(0, y - 4, W, 32, TILE)
        s.text(8, y, a, KC[0] if r == 1 else SEC)
        s.text(120, y, b, KC[1] if r == 1 else HI)
        if c:
            s.text(180, y, c, KC[2] if r == 1 else HI)
    s.rect(0, 190, W, 1, LINE)
    s.text(8, 196, "K1 PICK  K2 VALUE  K3 SPREAD", LABEL)
    s.rect(0, 216, W, 24, TILE)
    s.text(8, 220, "OCT- BACK", SEC)
    s.text(232, 220, "OCT+ REMOVE", KC[3], anchor="r")
    return s


def pair(before, after, title_b, title_a, out):
    from PIL import ImageFont as IF
    try:
        f = IF.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except OSError:
        f = IF.load_default()
    S, P = 480, 24
    im = Image.new("RGB", (P * 3 + 2 * S, P + S + 44), (28, 28, 32))
    d = ImageDraw.Draw(im)
    for k, (img, t) in enumerate(((before, title_b), (after, title_a))):
        x = P + k * (S + P)
        im.paste(img.resize((S, S), Image.NEAREST), (x, P))
        d.text((x, P + S + 12), t, font=f, fill=(200, 200, 208))
    im.save(out, optimize=True)
    print(f"mockup: {out}")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "ux-review"
    out.mkdir(parents=True, exist_ok=True)
    pair(shot("engine-analog-edit1"), m_param().im, "Today: EDIT 1, every value twice", "Proposed: four corners, page tabs",
         out / "1-value-page.png")
    pair(shot("env-env"), m_env().im, "Today: ENV", "Proposed: the curve in the knobs' colours", out / "2-graph-page.png")
    pair(shot("env-env"), m_track().im, "Today: ALGORITHM does nothing here", "Proposed: ALGORITHM picks the track on any page",
         out / "3-track-anywhere.png")
    pair(shot("layer-glo"), m_mixer().im, "Today: GLO held", "Proposed: GLO held, faders and mute / solo",
         out / "4-mixer-layer.png")
    pair(shot("seq-notes-sheet"), m_hint().im, "Today: a step's sheet", "Proposed: sheet tabs, OCT- / OCT+ written",
         out / "5-step-sheet.png")


if __name__ == "__main__":
    main()
