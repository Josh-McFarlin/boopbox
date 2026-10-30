#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""BoopBox's parameter icons, drawn from code: writes the atlas assets/icons.png that tools/gen_icons.py
turns into the firmware header.

  tools/gen_icon_art.py [ASSETS_DIR]      (default: assets)   also: --preview OUT.png (8x, labelled)

Each icon is 12 x 12 px, drawn 1:1 with ImageDraw (no anti-aliasing: crisp at the screen's size) in three
inks: FULL, MID (two thirds) and DIM (a third). The cells follow icons.json's names, row-major.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

FULL, MID, DIM = 255, 170, 85
N = 12


class Pen:
    def __init__(self, img):
        self.im = img
        self.d = ImageDraw.Draw(img)

    def px(self, x, y, c=FULL):
        if 0 <= x < N and 0 <= y < N:
            self.im.putpixel((x, y), c)

    def line(self, pts, c=FULL):
        self.d.line(pts, fill=c, width=1)

    def rect(self, x0, y0, x1, y1, c=FULL, fill=None):
        self.d.rectangle([x0, y0, x1, y1], outline=c, fill=fill)

    def box(self, x0, y0, x1, y1, c=FULL):
        self.d.rectangle([x0, y0, x1, y1], fill=c)

    def circle(self, cx, cy, r, c=FULL, fill=None):
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, fill=fill)

    def disc(self, cx, cy, r, c=FULL):
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

    def arc(self, cx, cy, r, a0, a1, c=FULL):
        self.d.arc([cx - r, cy - r, cx + r, cy + r], a0, a1, fill=c)

    def plot(self, f, x0=1, x1=10, c=FULL):
        """y = f(t), t 0..1 across x0..x1, joined"""
        pts = [(x, round(f((x - x0) / (x1 - x0)))) for x in range(x0, x1 + 1)]
        self.line(pts, c)


def sine(cy=5.5, a=3.5, cycles=1.0, ph=0.0):
    return lambda t: cy - a * math.sin(2 * math.pi * (cycles * t + ph))


# ---- the icons --------------------------------------------------------------------------------
def generic(p):
    p.circle(5.5, 5.5, 4.5)
    p.line([(5, 5), (5, 2)])
    p.line([(6, 5), (6, 2)])


def attack(p):
    p.line([(1, 10), (10, 10)], DIM)
    p.line([(1, 10), (6, 1)])
    p.line([(6, 1), (10, 1)], MID)


def decay(p):
    p.line([(1, 10), (10, 10)], DIM)
    p.line([(1, 1), (2, 1)], MID)
    p.plot(lambda t: 1 + 5 * (1 - math.exp(-4 * t)), 2, 10)


def sustain(p):
    p.line([(1, 10), (10, 10)], DIM)
    p.line([(1, 4), (10, 4)])
    p.line([(1, 5), (1, 9)], DIM)
    p.line([(10, 5), (10, 9)], DIM)


def release(p):
    p.line([(1, 10), (10, 10)], DIM)
    p.line([(1, 3), (2, 3)], MID)
    p.plot(lambda t: 3 + 7 * (1 - math.exp(-3 * t)) / (1 - math.exp(-3)), 2, 10)


def env(p):
    p.line([(0, 10), (11, 10)], DIM)
    p.line([(1, 10), (3, 1), (5, 5), (8, 5), (10, 10)])


def cutoff(p):
    p.line([(1, 3), (6, 3)])
    p.plot(lambda t: 3 + 7 * t * t, 6, 10)
    p.line([(6, 1), (6, 10)], DIM)


def reso(p):
    p.line([(1, 5), (5, 5)])
    p.line([(5, 5), (6, 1), (7, 1), (8, 5), (10, 10)])


def rate(p):
    p.line([(1, 2), (5, 5), (1, 9)])
    p.line([(5, 2), (9, 5), (5, 9)])
    p.line([(2, 2), (6, 5), (2, 9)], DIM)


def lfo_wave(p):
    p.line([(0, 10), (11, 10)], DIM)
    p.plot(sine(4.5, 3.5, 1.0), 0, 11)


def wave(p):
    p.plot(sine(5.5, 4, 1.5), 0, 11)


def pulse(p):
    p.line([(0, 9), (3, 9), (3, 2), (5, 2), (5, 9), (11, 9)])


def shape(p):
    p.plot(sine(5.5, 4, 0.5), 0, 5)
    p.line([(6, 5), (6, 9), (10, 9), (10, 2)], MID)


def pitch(p):
    p.disc(3, 9, 2)
    p.line([(5, 1), (5, 9)])
    p.line([(6, 1), (9, 3), (9, 5)])


def tune(p):
    p.line([(3, 1), (3, 6)])
    p.line([(8, 1), (8, 6)])
    p.line([(3, 6), (4, 7), (7, 7), (8, 6)])
    p.line([(5, 8), (5, 11)])
    p.line([(6, 8), (6, 11)])


def detune(p):
    p.plot(sine(5.5, 3.5, 1.0), 0, 11)
    p.plot(sine(6.5, 3.5, 1.0, 0.12), 0, 11, DIM)


def transpose(p):
    p.line([(3, 10), (3, 1)])
    p.line([(1, 3), (3, 1), (5, 3)])
    p.line([(8, 1), (8, 10)])
    p.line([(6, 8), (8, 10), (10, 8)])


def octave(p):
    p.circle(5.5, 3, 2)
    p.circle(5.5, 8, 2.5)
    p.line([(0, 1), (0, 10)], DIM)
    p.line([(11, 1), (11, 10)], DIM)


def level(p):
    p.line([(5, 0), (5, 11)], DIM)
    p.line([(6, 0), (6, 11)], DIM)
    p.box(2, 4, 9, 6)
    p.line([(3, 5), (8, 5)], DIM)


def pan(p):
    p.line([(1, 5), (10, 5)])
    p.line([(3, 3), (1, 5), (3, 7)])
    p.line([(8, 3), (10, 5), (8, 7)])
    p.line([(5, 8), (5, 10)], MID)
    p.line([(6, 8), (6, 10)], MID)


def speaker(p):
    p.box(0, 4, 2, 7)
    p.line([(3, 4), (6, 1), (6, 10), (3, 7)])


def mute(p):
    speaker(p)
    p.line([(8, 4), (11, 7)])
    p.line([(11, 4), (8, 7)])


def dist(p):
    p.line([(0, 5), (1, 2), (4, 2), (5, 5), (6, 9), (9, 9), (10, 5), (11, 2)])
    p.line([(0, 1), (11, 1)], DIM)
    p.line([(0, 10), (11, 10)], DIM)


def drive(p):
    p.arc(5.5, 7, 5, 180, 360)
    p.line([(1, 7), (1, 9)])
    p.line([(10, 7), (10, 9)])
    p.line([(5, 8), (8, 3)])
    p.disc(5, 8, 1, MID)


def fold(p):
    p.line([(0, 10), (2, 2), (4, 7), (6, 1), (8, 7), (10, 2), (11, 10)])


def bits(p):
    p.line([(0, 11), (0, 9), (3, 9), (3, 6), (6, 6), (6, 3), (9, 3), (9, 0), (11, 0)])
    p.line([(1, 11), (11, 1)], DIM)


def chorus(p):
    p.plot(sine(3, 2, 1.0), 0, 11)
    p.plot(sine(6, 2, 1.0, 0.1), 0, 11, MID)
    p.plot(sine(9, 2, 1.0, 0.2), 0, 11, DIM)


def delay(p):
    p.box(0, 2, 1, 10)
    p.box(4, 4, 5, 10, MID)
    p.box(8, 6, 9, 10, DIM)
    p.line([(0, 11), (11, 11)], DIM)


def reverb(p):
    p.disc(1, 10, 1)
    p.arc(1, 10, 4, 270, 360)
    p.arc(1, 10, 7, 270, 360, MID)
    p.arc(1, 10, 10, 270, 360, DIM)


def feedback(p):
    p.arc(5.5, 5.5, 4.5, 40, 340)
    p.line([(9, 1), (9, 4), (6, 4)])


def arp(p):
    for i, (x, y) in enumerate(((0, 8), (3, 5), (6, 2), (9, 5))):
        p.box(x, y, x + 2, y + 2, (FULL, FULL, FULL, MID)[i])
    p.line([(0, 11), (11, 11)], DIM)


def gate(p):
    p.line([(0, 9), (2, 9), (2, 2), (8, 2), (8, 9), (11, 9)])
    p.line([(3, 9), (7, 9)], DIM)


def swing(p):
    p.line([(5, 0), (6, 0)])
    p.line([(5, 1), (3, 7)])
    p.disc(3, 8, 2)
    p.line([(6, 1), (9, 6)], DIM)


def tempo(p):
    p.line([(2, 11), (4, 1), (7, 1), (9, 11), (2, 11)])
    p.line([(3, 8), (8, 8)], DIM)
    p.line([(5, 8), (9, 1)])
    p.box(8, 2, 9, 3, MID)


def scale(p):
    p.rect(0, 1, 11, 10)
    for x in (3, 6, 9):
        p.line([(x, 6), (x, 10)])
    for x in (2, 4, 8):
        p.box(x, 1, x + 1, 5)


def quantize(p):
    for x in (1, 5, 9):
        for y in (1, 5, 9):
            p.px(x, y, DIM)
    p.box(4, 4, 6, 6)
    p.line([(8, 9), (6, 7)], MID)


def glide(p):
    p.disc(1, 9, 1)
    p.disc(10, 2, 1)
    p.plot(lambda t: 9 - 7 * (3 * t * t - 2 * t * t * t), 2, 9)


def slide(p):
    p.line([(1, 10), (10, 1)])
    p.line([(6, 1), (10, 1), (10, 5)])
    p.line([(1, 10), (4, 10)], DIM)


def voice(p):
    p.circle(5.5, 3.5, 2.5)
    p.arc(5.5, 12, 5, 180, 360)
    p.line([(1, 11), (10, 11)])


def mod(p):
    p.circle(2, 2, 1.5)
    p.circle(9, 9, 1.5)
    p.plot(lambda t: 3 + 6 * t + 2 * math.sin(math.pi * t), 3, 8, MID)


def noise(p):
    ys = (3, 8, 1, 6, 9, 2, 5, 10, 4, 7, 2, 8)
    for x, y in enumerate(ys):
        p.line([(x, 5), (x, y)], FULL if x % 2 else MID)


def sub(p):
    p.plot(sine(3, 2, 2.0), 0, 11, MID)
    p.line([(0, 10), (3, 10), (3, 7), (8, 7), (8, 10), (11, 10)])


def ratio(p):
    p.circle(2.5, 8.5, 2)
    p.circle(7.5, 4.5, 3.5)
    p.line([(3, 6), (5, 4)], DIM)


def algorithm(p):
    p.rect(0, 0, 3, 3)
    p.rect(8, 0, 11, 3)
    p.rect(4, 8, 7, 11)
    p.line([(2, 4), (5, 7)], MID)
    p.line([(9, 4), (6, 7)], MID)


def sample(p):
    hs = (1, 3, 5, 4, 3, 2, 3, 2, 1, 1, 0)
    for x, h in enumerate(hs):
        p.line([(x, 5 - h), (x, 6 + h)], FULL if h > 1 else MID)


def steps(p):
    for i in range(4):
        x = i * 3
        if i in (0, 2):
            p.box(x, 3, x + 1, 8)
        else:
            p.rect(x, 3, x + 1, 8, DIM)


def accent(p):
    p.line([(1, 2), (10, 5), (1, 8)])
    p.line([(1, 3), (8, 5), (1, 7)], MID)


def time(p):
    p.circle(5.5, 5.5, 5)
    p.line([(5, 2), (5, 5), (8, 5)])


def phase(p):
    p.circle(5.5, 5.5, 4)
    p.line([(1, 11), (10, 0)])


def fade(p):
    for x in range(12):
        h = round(x * 9 / 11)
        p.line([(x, 10 - h), (x, 10)], (DIM, MID, FULL)[min(2, x // 4)])


def mix(p):
    p.line([(1, 1), (5, 6)])
    p.line([(1, 10), (5, 6)], MID)
    p.line([(5, 6), (10, 6)])
    p.line([(8, 4), (10, 6), (8, 8)])


def keytrack(p):
    p.rect(0, 6, 7, 11)
    p.line([(2, 6), (2, 11)])
    p.line([(5, 6), (5, 11)])
    p.line([(6, 4), (11, 0)])
    p.line([(8, 0), (11, 0), (11, 3)])


def size(p):
    p.rect(3, 3, 8, 8, DIM)
    for x0, y0, dx, dy in ((0, 0, 1, 1), (11, 0, -1, 1), (0, 11, 1, -1), (11, 11, -1, -1)):
        p.line([(x0, y0 + 3 * dy), (x0, y0), (x0 + 3 * dx, y0)])


def damp(p):
    p.plot(lambda t: 5.5 - 5 * math.exp(-3 * t) * math.sin(2 * math.pi * 2.5 * t), 0, 11)


def tone(p):
    p.line([(0, 9), (11, 2)])
    p.disc(5.5, 5.5, 1.5)
    p.line([(0, 11), (11, 11)], DIM)


def sweep(p):
    p.arc(5.5, 8, 5, 200, 340)
    p.line([(9, 2), (10, 4), (8, 5)])
    p.line([(0, 11), (11, 11)], DIM)


def vibrato(p):
    p.line([(0, 6), (2, 6)], MID)
    p.plot(sine(6, 2, 3.0), 2, 11)


def loop(p):
    p.arc(3, 5.5, 3, 90, 270)
    p.arc(8, 5.5, 3, 270, 450)
    p.line([(3, 2), (8, 2)])
    p.line([(3, 9), (8, 9)])
    p.line([(6, 0), (8, 2), (6, 4)])


def hold(p):
    p.arc(5.5, 4, 3, 180, 360)
    p.line([(2, 4), (2, 5)])
    p.line([(9, 4), (9, 5)])
    p.box(1, 5, 10, 11)
    p.box(5, 7, 6, 9, 0)


def order(p):
    for y in (1, 5, 9):
        p.box(0, y, 1, y + 1)
        p.line([(3, y), (11, y)], MID)
        p.line([(3, y + 1), (8, y + 1)], DIM)


def prob(p):
    p.rect(0, 0, 11, 11)
    for x, y in ((3, 3), (8, 8), (5, 5)):
        p.box(x - 1 + (x == 5) * 1, y - 1 + (y == 5) * 1, x - (x == 5) * 0, y - (y == 5) * 0)


def length(p):
    p.line([(0, 2), (0, 9)])
    p.line([(11, 2), (11, 9)])
    p.line([(1, 5), (10, 5)])
    p.line([(3, 3), (1, 5), (3, 7)])
    p.line([(8, 3), (10, 5), (8, 7)])


def division(p):
    p.box(5, 1, 6, 2)
    p.line([(1, 5), (10, 5)])
    p.line([(1, 6), (10, 6)])
    p.box(5, 9, 6, 10)


def chip(p):
    p.rect(2, 2, 9, 9)
    p.disc(4, 4, 0.5, MID)
    for k in (3, 5, 7):
        p.px(0, k), p.px(1, k), p.px(10, k), p.px(11, k)
        p.px(k, 0), p.px(k, 1), p.px(k, 10), p.px(k, 11)


def midi(p):
    p.circle(5.5, 5.5, 5.5)
    for x, y in ((2, 6), (9, 6), (3, 3), (8, 3), (5, 2), (6, 2)):
        p.px(x, y)
    p.box(5, 10, 6, 11, 0)
    p.line([(5, 9), (6, 9)], MID)


def save(p):
    p.line([(0, 0), (9, 0), (11, 2), (11, 11), (0, 11), (0, 0)])
    p.box(3, 1, 7, 3, MID)
    p.rect(2, 6, 9, 11)


def load(p):
    p.line([(0, 2), (4, 2), (5, 3), (11, 3), (11, 10), (0, 10), (0, 2)])
    p.line([(1, 5), (10, 5)], MID)


def clear(p):
    p.line([(0, 2), (11, 2)])
    p.line([(4, 0), (7, 0)])
    p.line([(1, 3), (2, 11), (9, 11), (10, 3)])
    p.line([(4, 5), (4, 9)], MID)
    p.line([(7, 5), (7, 9)], MID)


# the oscillator's waves (one cycle and a bit)
def w_sin(p):
    p.plot(sine(5.5, 4.5, 1.0), 0, 11)


def w_tri(p):
    p.line([(0, 5), (3, 1), (8, 10), (11, 5)])


def w_saw(p):
    p.line([(0, 10), (5, 1), (5, 10), (11, 1), (11, 10)])


def w_sqr(p):
    p.line([(0, 9), (0, 2), (5, 2), (5, 9), (11, 9), (11, 2)])


def w_pls(p):
    p.line([(0, 9), (0, 2), (2, 2), (2, 9), (6, 9), (6, 2), (8, 2), (8, 9), (11, 9)])


def w_pwm(p):
    p.line([(0, 9), (0, 2), (2, 2), (2, 9), (5, 9), (5, 2), (9, 2), (9, 9), (11, 9)])
    p.line([(3, 2), (4, 2)], DIM)


def w_sh(p):
    p.line([(0, 6), (2, 6), (2, 2), (4, 2), (4, 9), (6, 9), (6, 4), (8, 4), (8, 7), (10, 7), (10, 1), (11, 1)])


def w_dsin(p):
    p.plot(lambda t: 10 - 9 * abs(math.sin(2 * math.pi * t)), 0, 11)


def w_spls(p):
    p.line([(0, 9), (2, 9)])
    p.plot(lambda t: 9 - 8 * math.sin(math.pi * t), 2, 6)
    p.line([(6, 9), (11, 9)])
    p.plot(lambda t: 9 - 8 * math.sin(math.pi * t), 2, 6)


def w_rsaw(p):
    p.line([(0, 1), (5, 10), (5, 1), (11, 10), (11, 1)])


def w_rtri(p):
    p.plot(lambda t: 5.5 - 4.5 * math.copysign(abs(math.sin(2 * math.pi * t)) ** 0.5, math.sin(2 * math.pi * t)), 0, 11)


def w_rtrp(p):
    p.line([(0, 9), (2, 2), (5, 2), (7, 9), (11, 9)])
    p.line([(8, 9), (11, 9)], MID)


def tape(p):
    p.rect(0, 1, 11, 10)
    p.circle(3.5, 5, 1.5)
    p.circle(8.5, 5, 1.5)
    p.line([(4, 8), (7, 8)], MID)
    p.line([(3, 10), (4, 8)], DIM)
    p.line([(8, 10), (7, 8)], DIM)


def drum(p):
    p.d.ellipse([0, 2, 11, 5], outline=FULL)
    p.line([(0, 4), (0, 9)])
    p.line([(11, 4), (11, 9)])
    p.arc(5.5, 4, 5.5, 20, 160)
    p.line([(2, 0), (5, 3)], MID)
    p.line([(9, 0), (6, 3)], MID)


def mouth(p):
    p.line([(0, 5), (2, 3), (4, 3), (5.5, 4), (7, 3), (9, 3), (11, 5)])
    p.line([(0, 5), (2, 8), (9, 8), (11, 5)])
    p.line([(2, 5), (9, 5)], MID)


def trio(p):
    p.disc(5.5, 2, 1.5)
    p.disc(2, 9, 1.5)
    p.disc(9, 9, 1.5)
    p.line([(5, 3), (2, 8), (9, 8), (6, 3)], DIM)


def drawbar(p):
    for x, h in ((0, 6), (3, 9), (6, 4), (9, 7)):
        p.line([(x + 1, 0), (x + 1, h - 1)], MID)
        p.box(x, h - 1, x + 2, h + 1)


def slice(p):
    hs = (1, 3, 4, 2, 1, 3, 4, 2, 1, 2, 3, 1)
    for x, h in enumerate(hs):
        if x in (4, 8):
            for y in range(0, 12, 2):
                p.px(x, y)
        else:
            p.line([(x, 6 - h), (x, 5 + h)], MID)


def grain(p):
    for i, (x, y) in enumerate(((1, 2), (5, 1), (9, 3), (3, 6), (7, 5), (10, 8), (1, 10), (5, 9), (8, 11))):
        p.box(x, y, x + (i % 3 != 2), y + (i % 3 == 0), (FULL, MID, DIM)[i % 3])


def draw(name):
    im = Image.new("L", (N, N), 0)
    globals()[name](Pen(im))
    return im


def atlas(names, cols):
    rows = (len(names) + cols - 1) // cols
    img = Image.new("L", (cols * N, rows * N), 0)
    for i, n in enumerate(names):
        img.paste(draw(n), ((i % cols) * N, (i // cols) * N))
    return img


def main():
    args = sys.argv[1:]
    preview = None
    if args[:1] == ["--preview"]:
        preview, args = args[1], args[2:]
    assets = Path(args[0]) if args else Path(__file__).resolve().parents[1] / "assets"
    meta = json.loads((assets / "icons.json").read_text())
    names, cols = meta["names"], int(meta.get("cols", 16))
    missing = [n for n in names if not callable(globals().get(n))]
    if missing:
        sys.exit("gen_icon_art: no drawing for " + ", ".join(missing))
    img = atlas(names, cols)
    if preview:
        S, W = 8, 8
        big = Image.new("RGB", (W * (N * S + 70), ((len(names) + W - 1) // W) * (N * S + 14)), (24, 24, 28))
        d = ImageDraw.Draw(big)
        for i, n in enumerate(names):
            x, y = (i % W) * (N * S + 70), (i // W) * (N * S + 14)
            big.paste(draw(n).resize((N * S, N * S), Image.NEAREST).convert("RGB"), (x + 4, y + 4))
            d.text((x + N * S + 8, y + 40), n, fill=(200, 200, 200))
        big.save(preview)
        print(f"icons: preview -> {preview}")
        return
    img.save(assets / "icons.png", optimize=True)
    print(f"icons: {len(names)} drawn -> {assets / 'icons.png'} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
