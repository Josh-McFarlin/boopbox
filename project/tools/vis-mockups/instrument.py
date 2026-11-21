#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The instrument home screen: one picture a sound engine (and the drum kit), for approval before the firmware.

HOME shows the selected track's instrument; HOME again opens TRACKS. KNOB 1-4 are the engine's EDIT 1 values. Each
picture is one bold object on black, in flat colours; each knob's colour (the built-in UI_COL: blue, green, yellow,
orange) paints the part of the object that it moves. Text is Terminus Bold 16, as on the FM-1.

  python3 instrument.py OUT.png      (run tests/emu_test.c first, for the TRACKS screen)
"""
import math, random, sys, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, BdfFontFile

HERE = Path(__file__).resolve().parent
PROJ = HERE.parents[1]
WORK = Path(os.environ.get('VIS_WORK', '/tmp/vis-mockups')); WORK.mkdir(parents=True, exist_ok=True)
if not (WORK / 'ter16b.pil').exists():
    BdfFontFile.BdfFontFile(open(PROJ / 'assets/fonts/ter-u16b.bdf', 'rb')).save(str(WORK / 'ter16b'))
FONT = ImageFont.load(str(WORK / 'ter16b.pil'))
EMU = PROJ / 'build/host'

W = 240
BG = (0, 0, 0)
BL, GR, YE, OR = (40, 124, 255), (30, 204, 112), (255, 198, 24), (255, 98, 26)   # KNOB 1-4 (gfx.c UI_COL_DEF)
K = [BL, GR, YE, OR]
TRK = K + [(137, 183, 255), (131, 227, 176), (255, 224, 128), (255, 169, 129)]
WH = (236, 236, 236)
G1, G2, G3 = (30, 30, 34), (64, 64, 70), (120, 120, 128)

def mix(a, b, k): return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
def dim(c, k): return mix(BG, c, k)
def text(d, x, y, s, c): d.text((x, y - 1), s, font=FONT, fill=c)
def ctext(d, cx, y, s, c): text(d, cx - 4 * len(s), y, s, c)
def circ(d, cx, cy, r, **kw): d.ellipse([cx - r, cy - r, cx + r, cy + r], **kw)

def frame(track, sound, knobs, beat=1, playing=True):
    """a quiet top line (the track, its sound, the beat, the tempo) and the four knobs at the bottom"""
    im = Image.new('RGB', (W, W), BG); d = ImageDraw.Draw(im)
    tc = TRK[track]
    d.rectangle([0, 0, 15, 15], fill=tc); text(d, 4, 0, str(track + 1), BG)
    text(d, 22, 0, sound, WH)
    for b in range(4):                                                         # the beat, a square each
        x = 168 + b * 8
        d.rectangle([x, 5, x + 5, 10], fill=WH if (playing and b == beat) else G2)
    text(d, 208, 0, '90', G3)
    for i, (lab, val) in enumerate(knobs):
        x0 = i * 60
        circ(d, x0 + 8, 214, 4, fill=K[i])
        text(d, x0 + 16, 206, lab, G3)
        text(d, x0 + 4, 223, val, WH)
    return im, d

def arc(d, cx, cy, r, a0, a1, c, w):                                          # degrees, 0 = right, clockwise
    d.arc([cx - r, cy - r, cx + r, cy + r], a0, a1, fill=c, width=w)

def polar(cx, cy, r, a): return (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))

# ------------------------------------------------------------------------------------------------------------ engines
def analog():
    """two gears whose teeth are the wave (OSC 1, OSC 2 a little turned: the detune), a seesaw between them (MIX),
    sparks off the teeth (NOISE)"""
    im, d = frame(0, 'SUPERSAW', [('WAVE', 'SAW'), ('DTN', '14'), ('MIX', '60'), ('NOIS', '12')])
    def gear(cx, cy, r, rot, c):
        pts = []
        n = 12
        for i in range(n * 8):
            t = i / (n * 8)
            saw = (t * n) % 1                                                  # the tooth: a ramp, then a drop
            rr = r + 13 * saw
            pts.append(polar(cx, cy, rr, t * 360 + rot))
        d.polygon(pts, fill=c)
        circ(d, cx, cy, r - 16, fill=BG)
        circ(d, cx, cy, 7, fill=c)
    gear(70, 96, 40, 0, BL)
    gear(170, 96, 40, 11, GR)
    # the seesaw: MIX tips it toward OSC 2
    tilt = (0.6 - .5) * 30
    a = math.radians(tilt)
    x0, y0 = 120 - 92 * math.cos(a), 168 - 92 * math.sin(a)
    x1, y1 = 120 + 92 * math.cos(a), 168 + 92 * math.sin(a)
    d.line([(x0, y0), (x1, y1)], fill=YE, width=7)
    d.polygon([(120, 168), (108, 192), (132, 192)], fill=YE)
    circ(d, x0, y0 - 11, 8, fill=BL); circ(d, x1, y1 - 13, 10, fill=GR)
    r = random.Random(2)
    for _ in range(26):                                                        # the noise: sparks
        ang = r.uniform(0, 360); cx = r.choice([70, 170])
        p = polar(cx, 96, r.uniform(56, 70), ang)
        d.rectangle([p[0], p[1], p[0] + 2, p[1] + 2], fill=OR)
    return im

def digital():
    """the carrier a planet, the modulators moons on orbits (ALG: who orbits whom), each moon's speed its ratio"""
    im, d = frame(1, 'RHODES', [('ALG', '5'), ('R2', '14.0'), ('R3', '1.00'), ('R4', '3.00')], beat=2)
    cx, cy = 104, 112
    circ(d, cx, cy, 30, fill=WH)
    d.chord([cx - 30, cy - 30, cx + 30, cy + 30], 20, 160, fill=(200, 200, 200))
    # algorithm 5: 2 -> 1, 4 -> 3 -> 1: moon 3 circles the planet, moon 4 circles moon 3, moon 2 on its own orbit
    for r, c in [(58, BL), (86, BL)]:
        d.ellipse([cx - r, cy - r * .42, cx + r, cy + r * .42], outline=c, width=2)
    m2 = (cx + 86 * math.cos(2.2), cy + 86 * .42 * math.sin(2.2))
    m3 = (cx + 58 * math.cos(-.6), cy + 58 * .42 * math.sin(-.6))
    circ(d, *m2, 9, fill=GR)
    circ(d, m3[0], m3[1], 26, outline=BL, width=2)
    circ(d, *m3, 11, fill=YE)
    m4 = (m3[0] + 26 * math.cos(-2.2), m3[1] + 26 * math.sin(-2.2))
    circ(d, *m4, 6, fill=OR)
    for k, (m, c) in enumerate([(m2, GR)]):                                    # speed lines: the ratio
        for j in range(5):
            a = 2.2 + .07 * (j + 1)
            p = (cx + 86 * math.cos(a), cy + 86 * .42 * math.sin(a))
            d.point(p, fill=dim(GR, .8 - j * .14))
    return im

def fm6():
    """six blocks stacked as the algorithm builds them: carriers on the floor, modulators on them (MRAT: their
    stripes, MLVL: how tall), the feedback a spring on the top one"""
    im, d = frame(4, 'E.PIANO 1', [('ALG', '5'), ('FB', '6'), ('MLVL', '+0'), ('MRAT', '+0')], beat=3)
    d.line([(14, 186), (226, 186)], fill=BL, width=3)                         # the floor: the algorithm's output
    for k, x in enumerate([48, 120, 192]):
        d.rectangle([x - 28, 140, x + 28, 184], fill=WH)                      # the carrier
        ctext(d, x, 154, str(2 * k + 1), BG)
        h = 46
        d.rectangle([x - 22, 140 - h, x + 22, 138], fill=YE)                  # the modulator
        n = [1, 1, 14][k]
        for s in range(min(n, 7)):
            y = 140 - h + 5 + s * 6
            d.rectangle([x - 22, y, x + 22, y + 2], fill=OR)
        ctext(d, x, 100, str(2 * k + 2), BG)
        d.rectangle([x - 22, 138, x + 22, 139], fill=BL)
    # the feedback on 6: a spring on top
    x, y = 192, 92
    pts = [(x + 12 * math.sin(i / 3), y - i * 1.4) for i in range(0, 36)]
    d.line(pts, fill=GR, width=3)
    circ(d, x, y - 52, 6, fill=GR)
    return im

def phase():
    """a ring that a clamp squeezes (DCW): the hand speeds through the pinch; out of it, the wave (WAVE, then WAVE2)
    and the envelope as an arc round the ring"""
    im, d = frame(2, 'CZ BRASS', [('WAVE', 'SAW'), ('WAVE2', 'RES'), ('DCW', '72'), ('ENV', '40')])
    cx, cy = 76, 104
    d.ellipse([cx - 52, cy - 44, cx + 40, cy + 44], outline=WH, width=8)       # the ring, pinched on the right
    d.rectangle([cx + 34, cy - 30, cx + 54, cy + 30], fill=YE)                 # the clamp
    d.rectangle([cx + 54, cy - 6, cx + 70, cy + 6], fill=YE)
    p = polar(cx - 6, cy, 34, -40)
    d.line([(cx - 6, cy), p], fill=WH, width=4); circ(d, cx - 6, cy, 5, fill=WH)
    arc(d, cx - 6, cy, 62, 150, 330, dim(OR, .35), 5)
    arc(d, cx - 6, cy, 62, 150, 250, OR, 5)
    # the wave out: one cycle WAVE (blue), the next WAVE2 (green)
    kx = .5 - .42 * .72
    def cz(t):
        t %= 1
        q = t / kx * .5 if t < kx else .5 + (t - kx) / (1 - kx) * .5
        return math.cos(2 * math.pi * q)
    for c in range(2):
        pts = []
        for i in range(44):
            t = i / 44
            v = cz(t) if c == 0 else math.cos(2 * math.pi * t * 3) * (1 - t)
            pts.append((140 + c * 46 + i, 104 - 30 * v))
        d.line(pts, fill=[BL, GR][c], width=4)
    return im

def lofi():
    """a chip that walks along its own wave, a wave of blocks (CRSH: how big), the duty a yellow span"""
    im, d = frame(4, 'GAMEBOY', [('CHIP', '8BIT'), ('WAVE', 'PLS'), ('DUTY', '25%'), ('CRSH', '3')])
    b = 10
    for i in range(0, 220, b):                                                 # the pulse, in blocks
        p = (i / 80) % 1
        y = 120 if p < .25 else 170
        d.rectangle([10 + i, y, 10 + i + b - 2, y + b - 2], fill=GR)
        if i and ((((i - b) / 80) % 1) < .25) != (p < .25):
            for yy in range(120, 171, b):
                d.rectangle([10 + i, yy, 10 + i + b - 2, yy + b - 2], fill=GR)
    for c in range(3):
        x = 10 + c * 80
        d.rectangle([x, 108, x + 18, 112], fill=YE)
    d.rectangle([180, 188, 186, 194], fill=OR); d.rectangle([190, 186, 198, 194], fill=OR); d.rectangle([202, 184, 212, 194], fill=OR)
    # the chip: a body, legs, two eyes, its name
    x, y = 96, 46
    d.rectangle([x, y, x + 62, y + 40], fill=BL)
    for k in range(5):
        lx = x + 4 + k * 12
        d.rectangle([lx, y + 40, lx + 4, y + 52 + (3 if k % 2 else 0)], fill=BL)
    d.rectangle([x + 10, y + 8, x + 18, y + 16], fill=WH); d.rectangle([x + 44, y + 8, x + 52, y + 16], fill=WH)
    d.rectangle([x + 13, y + 11, x + 17, y + 15], fill=BG); d.rectangle([x + 47, y + 11, x + 51, y + 15], fill=BG)
    ctext(d, x + 31, y + 22, '8BIT', WH)
    return im

def sample():
    """a record: the sample is its groove (BITS: in steps), its label the set, the loop an arc, TUNE the speed"""
    im, d = frame(2, 'GRAND PNO', [('SET', 'PIANO'), ('TUNE', '+0'), ('BITS', '12'), ('LOOP', 'OFF')])
    cx, cy, R = 104, 116, 80
    circ(d, cx, cy, R, fill=(22, 22, 26))
    r = random.Random(3)
    for ring in range(9):                                                      # the groove: the note's wave, round
        rr = R - 6 - ring * 6
        pts = []
        for a in range(0, 361, 3):
            amp = math.exp(-(ring * 360 + a) / 1500) * 3
            v = round(amp * math.sin(a * .7 + ring) * 1.0)                     # stepped: BITS
            pts.append(polar(cx, cy, rr + v, a))
        d.line(pts, fill=mix(G2, YE, .55 if ring < 3 else .25), width=1)
    circ(d, cx, cy, 24, fill=BL)
    ctext(d, cx, cy - 8, 'PNO', WH)
    arc(d, cx, cy, R + 6, 300, 30, dim(OR, .35), 4)                           # the loop (off: dim)
    # the tone arm, and TUNE: the speed
    d.line([(214, 44), (206, 120), (160, 150)], fill=WH, width=5)
    circ(d, 214, 44, 9, fill=WH)
    d.rectangle([152, 144, 166, 156], fill=WH)
    for k in range(3):
        arc(d, cx, cy, R + 14, 200 + k * 14, 208 + k * 14, GR, 3)
    return im

def voice():
    """a head that sings: its mouth from A to O (TALK), the two vowels in bubbles, SHIFT the throat"""
    im, d = frame(5, 'CHOIR AH', [('VOWL', 'A'), ('VOWL2', 'O'), ('TALK', '45'), ('SHIFT', '+2')], beat=0)
    cx, cy = 104, 112
    d.rounded_rectangle([cx - 56, cy - 66, cx + 56, cy + 54], 22, fill=WH)
    circ(d, cx - 22, cy - 26, 9, fill=BG); circ(d, cx + 22, cy - 26, 9, fill=BG)
    circ(d, cx - 19, cy - 29, 3, fill=WH); circ(d, cx + 25, cy - 29, 3, fill=WH)
    t = .45
    rx = 30 * (1 - t) + 16 * t; ry = 14 * (1 - t) + 20 * t
    d.ellipse([cx - rx, cy + 14 - ry, cx + rx, cy + 14 + ry], fill=BG)
    d.ellipse([cx - rx * .6, cy + 14 + ry * .2, cx + rx * .6, cy + 14 + ry * .9], fill=OR)
    for k in range(4):                                                         # SHIFT: the throat, its rings
        d.rectangle([cx - 30 + k * 2, cy + 56 + k * 8, cx + 30 - k * 2, cy + 60 + k * 8], fill=OR if k < 3 else dim(OR, .4))
    # the bubbles: A (VOWL), O (VOWL2), the yellow arc from one to the other (TALK)
    d.rounded_rectangle([172, 40, 222, 76], 10, fill=BL); ctext(d, 197, 50, 'A', WH)
    d.polygon([(176, 70), (166, 84), (190, 74)], fill=BL)
    d.rounded_rectangle([172, 120, 222, 156], 10, fill=GR); ctext(d, 197, 130, 'O', WH)
    d.polygon([(176, 150), (166, 164), (190, 154)], fill=GR)
    arc(d, 197, 98, 30, -80, 80, dim(YE, .35), 4); arc(d, 197, 98, 30, -80, -8, YE, 4)
    return im

def trio():
    """a staircase of semitones; three blocks stand on it at their intervals (the root, INT2, INT3), shaped as the
    wave, each shaking with the detune"""
    im, d = frame(6, 'POWER LEAD', [('WAVE', 'SAW'), ('INT2', '+7'), ('INT3', '+12'), ('DTN', '8')], beat=3)
    x0, y0, sw, sh = 12, 192, 8, 6
    for s in range(26):
        d.rectangle([x0 + s * sw, y0 - s * sh, x0 + s * sw + sw - 1, y0], fill=G1 if s % 12 else G2)
    for semi, c in [(0, BL), (7, GR), (12, YE)]:
        sx = x0 + (semi + 2) * sw + 4
        sy = y0 - (semi + 2) * sh
        d.polygon([(sx - 15, sy), (sx + 15, sy), (sx + 15, sy - 34)], fill=c)  # a saw: a ramp
        d.line([(sx - 19, sy - 6), (sx - 19, sy - 26)], fill=OR, width=2)      # DTN: it shakes
        d.line([(sx + 19, sy - 14), (sx + 19, sy - 34)], fill=OR, width=2)
    return im

def wheel():
    """nine thick drawbars (SUB, BODY, TOP: their tips' colours), and the spinning horn of the rotary speaker"""
    im, d = frame(1, 'GOSPEL B3', [('REG', 'GOSPL'), ('SUB', '+2'), ('BODY', '+0'), ('TOP', '-3')], beat=2)
    pulls = [8, 8, 8, 6, 4, 2, 3, 1, 4]
    grp = [GR, GR, YE, YE, YE, OR, OR, OR, OR]
    for i, (p, c) in enumerate(zip(pulls, grp)):
        x = 12 + i * 16
        h = 18 + p * 16
        d.rectangle([x + 4, 30, x + 8, 30 + h], fill=G2)
        d.rectangle([x, 30 + h, x + 12, 30 + h + 20], fill=c)
        d.rectangle([x, 30 + h + 20, x + 12, 30 + h + 22], fill=dim(c, .5))
    # the horn: two bells on a spinning bar
    cx, cy = 196, 92
    circ(d, cx, cy, 34, outline=G2, width=2)
    a = 25
    p0, p1 = polar(cx, cy, 30, a), polar(cx, cy, 30, a + 180)
    d.line([p0, p1], fill=WH, width=5)
    for p, s in [(p0, 1), (p1, -1)]:
        circ(d, *p, 8, fill=WH)
    circ(d, cx, cy, 5, fill=BG)
    d.rounded_rectangle([168, 152, 224, 174], 6, fill=BL)
    ctext(d, 196, 155, 'GOSPL', WH)
    return im

def grain():
    """the sample a hill; a nozzle at the position sprays grains (SIZE: how big, DENS: how many)"""
    im, d = frame(0, 'CLOUDS', [('SRC', 'STRGS'), ('POS', '38'), ('SIZE', '60'), ('DENS', '72')], beat=1)
    pts = [(x, 182 - 22 * (.5 + .5 * math.sin(x / 26)) * (.6 + .4 * math.sin(x / 9))) for x in range(0, 241, 2)]
    d.polygon(pts + [(240, 196), (0, 196)], fill=BL)
    px = int(240 * .38)
    d.rectangle([px - 8, 150, px + 8, 172], fill=GR)
    d.polygon([(px - 12, 150), (px + 12, 150), (px + 5, 138), (px - 5, 138)], fill=GR)
    r = random.Random(11)
    for _ in range(34):                                                        # DENS: the count
        t = r.random()
        y = 134 - t * 100
        x = px + r.gauss(0, 6 + 46 * t)
        s = 3 + 5 * r.random() * (1 - .4 * t)                                  # SIZE
        circ(d, x, y, s, fill=YE if r.random() < .7 else OR)
    return im

def phys():
    """the model as an object, struck: MODAL a bell, its rings the modes (STRC: their spacing), sparks of the bright
    partials (BRIT), the rings fading (DAMP)"""
    im, d = frame(2, 'BELLS', [('MODEL', 'MODAL'), ('STRC', '40'), ('BRIT', '55'), ('DAMP', '30')], beat=0)
    cx = 104
    for k, rr in enumerate([48, 60, 72]):                                      # the rings out of the bell
        arc(d, cx, 104, rr, 205, 335, dim(GR, .9 - k * .25), 3)
    for k in range(4):                                                         # DAMP: how long they last
        d.rectangle([20 + k * 14, 186, 30 + k * 14, 190], fill=OR if k < 2 else dim(OR, .3))
    d.polygon([(cx - 22, 52), (cx + 22, 52), (cx + 30, 110), (cx + 50, 148), (cx - 50, 148), (cx - 30, 110)], fill=BL)
    d.rectangle([cx - 54, 146, cx + 54, 154], fill=BL)
    d.rounded_rectangle([cx - 8, 40, cx + 8, 54], 4, fill=BL)
    circ(d, cx, 160, 9, fill=WH)
    d.line([(204, 70), (cx + 46, 132)], fill=WH, width=5)                      # the mallet
    circ(d, cx + 46, 132, 10, fill=WH)
    r = random.Random(4)
    for _ in range(12):
        p = polar(cx + 46, 132, r.uniform(16, 30), r.uniform(-80, 40))
        d.line([p, (p[0] + 3, p[1] - 3)], fill=YE, width=2)
    return im

def noise():
    """a cloud that rains the noise (COLR: the drops from fine to fat), a cup that catches the filter's band (FREQ)
    and splashes (RES)"""
    im, d = frame(3, 'OCEAN', [('MODE', 'ANLG'), ('COLR', 'PINK'), ('FREQ', '2.4K'), ('RES', '58')], beat=2)
    for cx, cy, rr in [(70, 66, 26), (104, 54, 32), (146, 60, 30), (176, 72, 22), (120, 78, 26), (84, 82, 18)]:
        circ(d, cx, cy, rr, fill=BL)
    d.rectangle([48, 80, 196, 96], fill=BL)
    r = random.Random(8)
    for _ in range(90):
        x = r.uniform(52, 194); y = r.uniform(102, 186)
        f = (x - 52) / 142                                                     # pink: drops get fatter to the left
        s = 1 + int(2.5 * (1 - f) * r.random())
        d.rectangle([x, y, x + s - 1, y + s + 1], fill=GR)
    fx = 52 + int(142 * .62)
    d.polygon([(fx - 18, 160), (fx + 18, 160), (fx + 11, 190), (fx - 11, 190)], fill=YE)
    for k in range(5):
        a = -150 + k * 30
        p0, p1 = polar(fx, 158, 6, a), polar(fx, 158, 24, a)
        d.line([p0, p1], fill=OR, width=3)
    d.line([(10, 194), (230, 194)], fill=G2, width=2)
    return im

def obervave():
    """eight lamps hanging from a rail, one a voice: lit when it plays, swaying with the drift (DTN); in each, the
    filter's shape (TYPE); the cross-mod a spark between the two playing next to each other"""
    im, d = frame(0, 'OB BRASS', [('PROG', '12'), ('TYPE', 'LP24'), ('XMOD', '20'), ('DTN', '6')], beat=1)
    d.rectangle([4, 30, 236, 35], fill=BL)
    on = {0, 2, 3, 5}
    for v in range(8):
        x = 18 + v * 29
        sway = [3, -2, 4, -3, 2, -4, 3, -1][v]
        bx = x + sway
        d.line([(x, 35), (bx, 96)], fill=OR if v in on else G2, width=2)
        lit = v in on
        c = WH if lit else G2
        d.rectangle([bx - 4, 96, bx + 4, 102], fill=G3)
        if lit:
            d.polygon([(bx - 10, 122), (bx + 10, 122), (bx + 13, 186), (bx - 13, 186)], fill=(44, 38, 12))
        d.pieslice([bx - 11, 100, bx + 11, 142], 180, 360, fill=c)
        d.rectangle([bx - 11, 118, bx + 11, 121], fill=c)
        if lit:
            pts = [(bx - 7 + i, 112 - (0 if i < 7 else min(9, (i - 7) ** 1.5 / 2))) for i in range(15)]
            d.line(pts, fill=GR, width=2)
    d.line([(76, 146), (84, 156), (90, 146), (98, 158)], fill=YE, width=3)
    return im

def drums():
    """the kit from above, flat: the kick in the middle; the drums that hit this beat flash, with rings round them
    (VERB: how far they go)"""
    im, d = frame(3, '808 DRUMS', [('KIT', '808'), ('LEVEL', '104'), ('VERB', '20'), ('PAN', '0%')], beat=0)
    def drum(cx, cy, r, c, hit=False, rim=G2):
        if hit:
            for k in range(2):
                circ(d, cx, cy, r + 6 + k * 7, outline=dim(YE, .8 - k * .35), width=2)
        circ(d, cx, cy, r, fill=rim)
        circ(d, cx, cy, r - 4, fill=c)
    drum(120, 124, 36, WH, hit=True)
    circ(d, 120, 124, 12, fill=G2)
    drum(54, 166, 20, G3)                                                      # snare
    drum(84, 64, 17, G3); drum(156, 64, 17, G3)                                # toms
    drum(194, 164, 22, G3)                                                     # floor
    drum(34, 106, 18, YE, hit=True, rim=(120, 92, 10))                         # hat
    drum(210, 96, 20, (150, 116, 14), rim=(120, 92, 10))                       # ride
    d.rounded_rectangle([12, 38, 52, 56], 5, fill=BL); ctext(d, 32, 39, '808', WH)
    d.rectangle([110, 192, 130, 196], fill=G2); d.rectangle([118, 190, 122, 198], fill=OR)   # PAN
    return im

def tracks():
    return Image.open(EMU / 'emu-tracks.ppm').convert('RGB')

ITEMS = [
    (analog, 'ANALOG', 'two gears: teeth = the wave, turned = detune'),
    (digital, 'DIGITAL', 'a planet and its moons: who circles whom'),
    (fm6, 'FM6', 'six blocks stacked as the algorithm builds'),
    (phase, 'PHASE', 'a ring the DCW clamp squeezes'),
    (lofi, 'LOFI', 'a chip that walks on its wave of blocks'),
    (sample, 'SAMPLE', 'a record: the sample is the groove'),
    (voice, 'VOICE', 'a head that sings from A to O'),
    (trio, 'TRIO', 'three blocks on a staircase of semitones'),
    (wheel, 'WHEEL', 'nine drawbars and the spinning horn'),
    (grain, 'GRAIN', 'a nozzle on the sample sprays grains'),
    (phys, 'PHYS', 'the model, struck: here MODAL, a bell'),
    (noise, 'NOISE', 'a cloud rains the noise; the cup is the filter'),
    (obervave, 'OBERVAVE', 'eight lamps, one a voice, lit as they play'),
    (drums, 'DRUMS', 'the kit from above; hits flash and ring'),
    (tracks, 'HOME again: TRACKS', 'the real TRACKS screen, as today'),
]

def sheet(out):
    BGS, BEZEL, TITLE, SUB = (28, 28, 32), (10, 10, 12), (236, 236, 240), (150, 150, 158)
    S, PAD, BZ, R = 480, 30, 8, 14
    def font(b, s): return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if b else ""), s)
    cols = 3; rows = (len(ITEMS) + cols - 1) // cols; cw = S + 2 * BZ; ch = cw + 70
    sh = Image.new("RGB", (PAD + cols * (cw + PAD), PAD + rows * (ch + PAD // 2)), BGS); dd = ImageDraw.Draw(sh)
    for k, (fn, title, line) in enumerate(ITEMS):
        x, y = PAD + (k % cols) * (cw + PAD), PAD + (k // cols) * (ch + PAD // 2)
        dd.rounded_rectangle([x, y, x + cw - 1, y + cw - 1], R, fill=BEZEL)
        im = fn()
        im.save(WORK / ('inst-%02d.png' % (k + 1)))
        sh.paste(im.resize((S, S), Image.NEAREST), (x + BZ, y + BZ))
        dd.text((x, y + cw + 14), f"{k + 1}  {title}", font=font(True, 21), fill=TITLE)
        dd.text((x, y + cw + 42), line, font=font(False, 16), fill=SUB)
    sh.save(out, optimize=True)
    print(out, sh.size)

if __name__ == '__main__':
    sheet(sys.argv[1] if len(sys.argv) > 1 else str(WORK / 'instrument-sheet.png'))
