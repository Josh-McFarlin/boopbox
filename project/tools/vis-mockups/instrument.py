#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The instrument home screen: one picture a sound engine (and the drum kit), for approval before the firmware.

HOME shows the selected track's instrument; HOME again opens TRACKS. KNOB 1-4 are the engine's EDIT 1 values. Each
picture is how the engine works, drawn as an instrument draws it: thin white lines and grey grids on black, and each
knob's colour (the built-in UI_COL: blue, green, yellow, orange) only on what that knob moves. Text is Terminus Bold 16, as on the FM-1.

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
# The look: an instrument's drawing, not a toy. Thin white lines, grey grids and ticks, and the knob colours only on
# what each knob moves. Every picture is how the engine works, drawn as a plot or a diagram would draw it.
GD = (22, 22, 26)                                                              # the grid's dots
def grid(d, x0, y0, x1, y1, step=12):
    for x in range(x0, x1 + 1, step):
        for y in range(y0, y1 + 1, step):
            d.point((x, y), fill=G2)
def ticks(d, x0, x1, y, n, c=G2, h=3):
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        d.line([(x, y), (x, y + (h if i % 4 else h + 2))], fill=c)
def dashed(d, p0, p1, c, on=2, off=3):
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); n = int(L / (on + off)) + 1
    for i in range(n):
        a = i * (on + off) / L; b = min(1, (i * (on + off) + on) / L)
        d.line([(p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a),
                (p0[0] + (p1[0] - p0[0]) * b, p0[1] + (p1[1] - p0[1]) * b)], fill=c)
def node(d, x, y, c, r=3): circ(d, x, y, r, fill=c)
def ring(d, x, y, c, r=4): circ(d, x, y, r, outline=c)

def analog():
    """two phasors, OSC 1 and the detuned OSC 2 (a little further round), projected into their sum; MIX the share of
    each, NOIS the grain on the line"""
    im, d = frame(0, 'SUPERSAW', [('WAVE', 'SAW'), ('DTN', '14'), ('MIX', '60'), ('NOIS', '12')])
    grid(d, 6, 30, 234, 196)
    saw = lambda p: 2 * (p % 1) - 1
    for k, (cy, r, a, c) in enumerate([(70, 22, 40, BL), (140, 18, 64, GR)]):
        cx = 36
        circ(d, cx, cy, r, outline=G2)
        d.line([(cx - r - 4, cy), (cx + r + 4, cy)], fill=G1)
        p = polar(cx, cy, r, -a)
        d.line([(cx, cy), p], fill=c, width=2); node(d, *p, c)
        dashed(d, p, (78, p[1]), G2)
        pts = [(78 + i, cy - r * saw(i / 52 + (.06 if k else 0) + (i / 1400 if k else 0))) for i in range(0, 150)]
        d.line(pts, fill=c)
    # the sum, at the right: MIX weighs them
    pts = []
    r = random.Random(5)
    for i in range(0, 150):
        v = .4 * saw(i / 52) + .6 * saw(i / 52 + .06 + i / 1400)
        pts.append((78 + i, 105 - 26 * v + r.uniform(-1.6, 1.6)))
    d.line([(78, 105), (228, 105)], fill=G1)
    d.line(pts, fill=WH)
    for i in range(0, 150, 3):                                                 # NOIS: the grain
        if r.random() < .5:
            d.point((78 + i, 105 + r.uniform(-34, 34)), fill=dim(OR, .9))
    # MIX: a balance scale
    x0, x1, y = 78, 228, 186
    d.line([(x0, y), (x1, y)], fill=G2); ticks(d, x0, x1, y - 6, 10)
    xm = x0 + (x1 - x0) * .6
    d.polygon([(xm - 4, y - 8), (xm + 4, y - 8), (xm, y - 2)], fill=YE)
    text(d, 52, y - 10, '1', BL); text(d, 232 - 8, y - 26, '2', GR)
    return im

def digital():
    """the algorithm as a small graph (top left), and what it makes: the carrier's circle bent by the modulators, a
    polar plot (R2, R3, R4: the petals' counts)"""
    im, d = frame(1, 'RHODES', [('ALG', '5'), ('R2', '14.0'), ('R3', '1.00'), ('R4', '3.00')], beat=2)
    # the graph: 4 -> 3 -> 1 <- 2
    P = {4: (20, 46), 3: (20, 80), 2: (52, 80), 1: (36, 114)}
    C = {4: OR, 3: YE, 2: GR, 1: WH}
    for a, b in [(4, 3), (3, 1), (2, 1)]:
        d.line([P[a], P[b]], fill=BL)
    for n, (x, y) in P.items():
        d.rectangle([x - 8, y - 10, x + 8, y + 10], fill=BG, outline=C[n])
        ctext(d, x + 1, y - 8, str(n), C[n])
    # the plot
    cx, cy, R = 146, 116, 58
    for rr in (20, 40, 60, 78):
        circ(d, cx, cy, rr, outline=G1)
    for a in range(0, 360, 30):
        d.line([polar(cx, cy, 8, a), polar(cx, cy, 82, a)], fill=G1)
    def curve(f, c, w=1):
        pts = [polar(cx, cy, R * f(math.radians(a)), a) for a in range(0, 361, 1)]
        d.line(pts, fill=c, width=w)
    curve(lambda t: 1 + .12 * math.sin(14 * t), dim(GR, .9))
    curve(lambda t: 1 + .22 * math.sin(3 * t + .3), dim(OR, .9))
    curve(lambda t: 1 + .22 * math.sin(3 * t + .3 + .16 * math.sin(3 * t)) * (1 + .1 * math.sin(14 * t)) - .02, WH, 2)
    text(d, 8, 180, 'ALG 5', BL)
    return im

def fm6():
    """six operators round a hexagon, joined as the algorithm joins them, the feedback a loop on 6; under it the
    spectrum that it makes (MLVL: how far it reaches; MRAT: where its lines fall)"""
    im, d = frame(4, 'E.PIANO 1', [('ALG', '5'), ('FB', '6'), ('MLVL', '+0'), ('MRAT', '+0')], beat=3)
    cx, cy, R = 120, 88, 46
    pos = {n: polar(cx, cy, R, -90 + (n - 1) * 60) for n in range(1, 7)}
    for a, b in [(2, 1), (4, 3), (6, 5)]:
        d.line([pos[a], pos[b]], fill=BL, width=2)
    for n in (1, 3, 5):                                                        # the carriers to the output
        dashed(d, pos[n], (cx, cy), G2)
    circ(d, cx, cy, 3, fill=WH)
    for n, (x, y) in pos.items():
        car = n % 2 == 1
        circ(d, x, y, 10, fill=BG, outline=WH if car else YE)
        if not car: circ(d, x, y, 6, fill=dim(YE, .55))
        ctext(d, x + 1, y - 8, str(n), WH if car else YE)
    x6, y6 = pos[6]
    d.arc([x6 - 22, y6 - 22, x6 + 2, y6 + 2], 90, 360, fill=GR, width=2)
    # the spectrum
    y0 = 192
    d.line([(14, y0), (226, y0)], fill=G2); ticks(d, 14, 226, y0 + 2, 16)
    for h in range(1, 30):
        a = math.exp(-h / 6) * (1 if h in (1, 2, 3) else .55 if h % 2 else .3)
        if h in (14, 15, 13): a = .35
        x = 14 + h * 7
        d.line([(x, y0), (x, y0 - 6 - 44 * a)], fill=OR if h in (13, 14, 15) else WH)
    return im

def phase():
    """the phase map (a straight line, bent at DCW's knee), the wave that reading a cosine through it makes (one cycle
    WAVE, the next WAVE2), and the DCW envelope under it"""
    im, d = frame(2, 'CZ BRASS', [('WAVE', 'SAW'), ('WAVE2', 'RES'), ('DCW', '72'), ('ENV', '40')])
    x0, y0, s = 14, 40, 88
    grid(d, x0, y0, x0 + s, y0 + s, 11)
    d.rectangle([x0, y0, x0 + s, y0 + s], outline=G2)
    dashed(d, (x0, y0 + s), (x0 + s, y0), G2)
    kx = .5 - .42 * .72
    knee = (x0 + s * kx, y0 + s * .5)
    d.line([(x0, y0 + s), knee, (x0 + s, y0)], fill=YE, width=2)
    ring(d, *knee, YE, 4)
    def cz(t):
        t %= 1
        q = t / kx * .5 if t < kx else .5 + (t - kx) / (1 - kx) * .5
        return math.cos(2 * math.pi * q)
    x1, cyw = 116, 84
    d.line([(x1, cyw), (230, cyw)], fill=G1)
    for c in range(2):
        pts = []
        for i in range(57):
            t = i / 57
            v = cz(t) if c == 0 else math.cos(2 * math.pi * t * 3.2) * (1 - t)
            pts.append((x1 + c * 57 + i, cyw - 34 * v))
        d.line(pts, fill=[BL, GR][c], width=2)
    dashed(d, (x1 + 57, 44), (x1 + 57, 124), G2)
    # DCW's envelope
    yb = 194
    d.line([(14, yb), (226, yb)], fill=G2)
    env = [(14 + i, yb - 46 * min(1, i / 12) * math.exp(-max(0, i - 12) / 60)) for i in range(212)]
    d.line(env, fill=OR, width=2)
    return im

def lofi():
    """quantising: the smooth wave (grey), what the chip makes of it (CHIP's steps), the pulse's duty marked, CRSH the
    coarse grid it snaps to"""
    im, d = frame(4, 'GAMEBOY', [('CHIP', '8BIT'), ('WAVE', 'PLS'), ('DUTY', '25%'), ('CRSH', '3')])
    x0, x1, y0, y1 = 14, 226, 44, 176
    st = 12
    for x in range(x0, x1 + 1, st):                                            # CRSH: the coarse grid
        for y in range(y0, y1 + 1, st):
            d.point((x, y), fill=dim(OR, .7))
    pts = [(x0 + i, 110 - 52 * math.sin(i / 212 * 2 * math.pi * 2)) for i in range(213)]
    d.line(pts, fill=G2)
    q = []
    for i in range(0, 213, st):                                                # the steps, held a cell each
        v = 110 - 52 * math.sin(i / 212 * 2 * math.pi * 2)
        v = y0 + round((v - y0) / st) * st
        q += [(x0 + i, v), (x0 + min(i + st, 212), v)]
    d.line(q, fill=BL, width=2)
    # the pulse (WAVE) and its duty
    yp = 194
    pp = []
    for c in range(4):
        xa = x0 + c * 53
        pp += [(xa, yp), (xa, yp - 12), (xa + 13, yp - 12), (xa + 13, yp)]
        d.line([(xa, yp - 16), (xa + 13, yp - 16)], fill=YE)
    pp.append((x1, yp))
    d.line(pp, fill=GR, width=2)
    return im

def sample():
    """the whole sample in a strip, its loop and the playhead; under it, the part around the playhead magnified, in
    BITS' steps; TUNE the playhead's speed"""
    im, d = frame(2, 'GRAND PNO', [('SET', 'PIANO'), ('TUNE', '+0'), ('BITS', '12'), ('LOOP', 'OFF')])
    r = random.Random(3)
    y = 48
    amp = [math.exp(-i / 60) * min(1, i / 2) * (.7 + .3 * r.random()) for i in range(212)]
    for i, a in enumerate(amp):
        d.line([(14 + i, y - 12 * a), (14 + i, y + 12 * a)], fill=BL if i < 74 else dim(BL, .5))
    ph = 14 + 74
    d.line([(ph, 32), (ph, 64)], fill=WH)
    d.rectangle([ph - 10, 33, ph + 10, 63], outline=G3)                        # the window magnified below
    dashed(d, (ph - 10, 64), (14, 88), G2); dashed(d, (ph + 10, 64), (226, 88), G2)
    d.line([(130, 70), (226, 70)], fill=dim(OR, .4)); d.line([(130, 66), (130, 74)], fill=dim(OR, .4))
    d.line([(226, 66), (226, 74)], fill=dim(OR, .4))
    # magnified, in steps
    x0, x1, yc = 14, 226, 140
    grid(d, x0, 92, x1, 188, 8)
    d.rectangle([x0, 88, x1, 192], outline=G2)
    pts = []
    stp = 8
    for i in range(0, 212, 4):
        v = 38 * (.6 * math.sin(i / 11) + .3 * math.sin(i / 4.7 + 1) + .1 * math.sin(i / 2.1))
        v = round(v / stp) * stp
        pts += [(x0 + i, yc - v), (x0 + i + 4, yc - v)]
    d.line(pts, fill=YE)
    d.line([(120, 92), (120, 188)], fill=WH)
    for k in range(3):                                                         # TUNE: its speed
        d.line([(124 + k * 5, 96), (128 + k * 5, 100), (124 + k * 5, 104)], fill=GR)
    return im

def voice():
    """the vowel chart (F1 down, F2 across): A and O are points on it, the voice moves between them (TALK); under it,
    the spectrum with the formants, moved by SHIFT"""
    im, d = frame(5, 'CHOIR AH', [('VOWL', 'A'), ('VOWL2', 'O'), ('TALK', '45'), ('SHIFT', '+2')], beat=0)
    x0, y0, x1, y1 = 24, 36, 216, 120
    grid(d, x0, y0, x1, y1, 12)
    # the vowel space, a trapezium
    V = {'I': (206, 42), 'U': (46, 42), 'E': (176, 80), 'O': (70, 82), 'A': (128, 116)}
    d.line([V['I'], V['U'], V['O'], V['A'], V['E'], V['I']], fill=G2)
    for v, (x, y) in V.items():
        if v in 'AO': continue
        ring(d, x, y, G3, 2); text(d, x + 4, y - 14, v, G3)
    a, o = V['A'], V['O']
    d.line([a, o], fill=dim(YE, .45))
    t = .45
    p = (a[0] + (o[0] - a[0]) * t, a[1] + (o[1] - a[1]) * t)
    d.line([a, p], fill=YE, width=2)
    node(d, *a, BL, 4); text(d, a[0] + 8, a[1] - 14, 'A', BL)
    node(d, *o, GR, 4); text(d, o[0] - 16, o[1] - 14, 'O', GR)
    circ(d, *p, 5, outline=WH); node(d, *p, WH, 2)
    # the spectrum: harmonics under the formants
    yb = 194
    d.line([(14, yb), (226, yb)], fill=G2)
    env = lambda f: sum(h * math.exp(-((f - c) ** 2) / .0016) for h, c in [(1, .17), (.65, .36), (.4, .6)])
    for k in range(1, 42):
        f = k / 42
        d.line([(14 + f * 212, yb), (14 + f * 212, yb - 4 - 56 * env(f))], fill=WH)
    d.line([(14 + i, yb - 4 - 56 * env(i / 212) - 3) for i in range(212)], fill=OR)
    return im

def trio():
    """a circle of the twelve semitones; the three oscillators are points on it (the root, INT2, INT3; an octave a ring
    further out), joined as the chord they make; DTN spreads each point"""
    im, d = frame(6, 'POWER LEAD', [('WAVE', 'SAW'), ('INT2', '+7'), ('INT3', '+12'), ('DTN', '8')], beat=3)
    cx, cy = 120, 110
    for r in (40, 64):
        circ(d, cx, cy, r, outline=G1)
    names = ['C', '', 'D', '', 'E', 'F', '', 'G', '', 'A', '', 'B']
    for s in range(12):
        a = -90 + s * 30
        d.line([polar(cx, cy, 72, a), polar(cx, cy, 78 if names[s] else 75, a)], fill=G3 if names[s] else G2)
        if names[s]:
            q = polar(cx, cy, 86, a); text(d, q[0] - 4, q[1] - 8, names[s], G3)
    pts = []
    for semi, c in [(0, BL), (7, GR), (12, YE)]:
        o, s = divmod(semi, 12)
        a = -90 + s * 30
        p = polar(cx, cy, 40 + 24 * o, a)
        pts.append(p)
        arc(d, cx, cy, 40 + 24 * o, a - 6, a + 6, OR, 3)                    # DTN
        node(d, *p, c, 4)
    d.line(pts + [pts[0]], fill=WH)
    # the wave each one plays (WAVE), small, at the bottom left
    w = [(14 + i, 194 - 10 * ((i / 16) % 1)) for i in range(48)]
    d.line(w, fill=BL)
    return im

def wheel():
    """the nine drawbars with their scales 0-8 (SUB, BODY, TOP their groups), and the rotary horn seen from above,
    turning"""
    im, d = frame(1, 'GOSPEL B3', [('REG', 'GOSPL'), ('SUB', '+2'), ('BODY', '+0'), ('TOP', '-3')], beat=2)
    pulls = [8, 8, 8, 6, 4, 2, 3, 1, 4]
    grp = [GR, GR, YE, YE, YE, OR, OR, OR, OR]
    lab = ['16', '5', '8', '4', '2', '2', '1', '1', '1']
    y0 = 40
    for i, (p, c) in enumerate(zip(pulls, grp)):
        x = 18 + i * 15
        for m in range(9):
            d.line([(x - 4, y0 + m * 16), (x - 2, y0 + m * 16)], fill=G2)
        d.line([(x, y0), (x, y0 + p * 16)], fill=c, width=2)
        d.rectangle([x - 4, y0 + p * 16, x + 4, y0 + p * 16 + 6], outline=c)
    # the horn, from above: its arm, its sweep
    cx, cy = 190, 92
    circ(d, cx, cy, 30, outline=G2)
    for a in range(0, 360, 15):
        d.point(polar(cx, cy, 36, a), fill=G2)
    a = 25
    d.line([polar(cx, cy, 26, a), polar(cx, cy, 26, a + 180)], fill=WH, width=2)
    d.pieslice([cx - 30, cy - 30, cx + 30, cy + 30], a - 40, a, fill=dim(WH, .18))
    circ(d, cx, cy, 2, fill=WH)
    text(d, 166, 140, 'SLOW', G3)
    text(d, 166, 170, 'GOSPL', BL)
    return im

def grain():
    """the source, and the grains as their windows laid over it: each a bell curve, as wide as SIZE, as many as DENS,
    round the position POS"""
    im, d = frame(0, 'CLOUDS', [('SRC', 'STRGS'), ('POS', '38'), ('SIZE', '60'), ('DENS', '72')], beat=1)
    r = random.Random(11)
    yb = 194
    for i in range(212):                                                       # the source
        a = .35 + .65 * abs(math.sin(i / 34)) * (.6 + .4 * r.random())
        d.line([(14 + i, yb - 14 * a), (14 + i, yb)], fill=dim(BL, .8))
    px = 14 + 212 * .38
    d.line([(px, 40), (px, yb)], fill=GR)
    d.polygon([(px - 4, 36), (px + 4, 36), (px, 42)], fill=GR)
    for g in range(22):                                                        # the grains, as windows
        gx = px + r.gauss(0, 30)
        y = 160 - r.random() * 110
        w = 14 + r.random() * 8
        h = 16 + r.random() * 12
        pts = [(gx - w + j, y - h * (.5 - .5 * math.cos(math.pi * j / w))) for j in range(int(2 * w) + 1)]
        d.line(pts, fill=YE if g % 3 else OR)
        dashed(d, (gx, y), (gx, yb - 16), G1, 1, 4)
    return im

def phys():
    """the string's modes, one above the other (1, 2, 3, 4, 5: their nodes dotted), where it is struck (STRC), how bright
    the high ones ring (BRIT: their weight), how fast it dies (DAMP)"""
    im, d = frame(2, 'NYLON GTR', [('MODEL', 'STRNG'), ('STRC', '40'), ('BRIT', '55'), ('DAMP', '30')], beat=0)
    x0, x1 = 26, 214
    for m in range(1, 6):
        y = 30 + m * 26
        d.line([(x0, y), (x1, y)], fill=G1)
        amp = 10 * abs(math.sin(math.pi * m * .4)) + 1.5
        c = WH if m == 1 else mix(G3, YE, (m - 1) / 4 * .9)
        for sgn in (1, -1):
            pts = [(x, y - sgn * amp * math.sin(math.pi * m * (x - x0) / (x1 - x0))) for x in range(x0, x1 + 1)]
            d.line(pts, fill=c if sgn > 0 else dim(c, .45))
        for k in range(m + 1):
            node(d, x0 + (x1 - x0) * k / m, y, G3, 1)
        text(d, 8, y - 8, str(m), G3)
    xs = x0 + (x1 - x0) * .4
    dashed(d, (xs, 44), (xs, 170), GR)
    d.polygon([(xs - 4, 40), (xs + 4, 40), (xs, 46)], fill=GR)
    yb = 194
    d.line([(26, yb), (214, yb)], fill=G2)
    d.line([(26 + i, yb - 18 * math.exp(-i / 50)) for i in range(188)], fill=OR, width=2)
    text(d, 174, 180, 'STRNG', BL)
    return im

def noise():
    """an analyser's view: the noise's spectrum (its jagged line), the slope of its colour (pink: 3 dB an octave), the
    filter laid over it (FREQ: where, RES: how high its peak)"""
    im, d = frame(3, 'OCEAN', [('MODE', 'ANLG'), ('COLR', 'PINK'), ('FREQ', '2.4K'), ('RES', '58')], beat=2)
    x0, x1, y0, y1 = 14, 226, 40, 186
    for k in range(6):                                                         # the grid: decades and 10 dB
        y = y0 + k * (y1 - y0) / 5
        d.line([(x0, y), (x1, y)], fill=G1)
    for f in [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]:
        x = x0 + (x1 - x0) * math.log10(f / 20) / 3
        d.line([(x, y0), (x, y1)], fill=G1)
    for lab, f in [('100', 100), ('1K', 1000), ('10K', 10000)]:
        x = x0 + (x1 - x0) * math.log10(f / 20) / 3; text(d, x - 4 * len(lab), 188, lab, G2)
    r = random.Random(8)
    fc = .62
    pts = []
    for i in range(0, 213):
        f = i / 212
        slope = 70 + 70 * f
        peak = 48 * math.exp(-((f - fc) ** 2) / .0025)
        hp = 0
        pts.append((x0 + i, min(y1, slope - peak + r.uniform(-7, 7) + 10)))
    d.line(pts, fill=WH)
    d.line([(x0, 80), (x1, 150)], fill=GR)
    filt = [(x0 + i, 80 + 70 * (i / 212) - 48 * math.exp(-((i / 212 - fc) ** 2) / .0025)) for i in range(213)]
    d.line(filt, fill=YE, width=2)
    xf = x0 + 212 * fc
    d.line([(xf - 6, 80 + 70 * fc - 48 - 6), (xf + 6, 80 + 70 * fc - 48 - 6)], fill=OR, width=2)
    text(d, 16, 42, 'ANLG', BL)
    return im

def obervave():
    """the eight voices round a ring, as the allocator hands them out: lit while they play, their envelopes as arcs;
    the program in the middle"""
    im, d = frame(0, 'OB BRASS', [('PROG', '12'), ('TYPE', 'LP24'), ('XMOD', '20'), ('DTN', '6')], beat=1)
    cx, cy = 120, 112
    lv = [.9, 0, .55, .75, 0, .3, 0, 0]
    for v in range(8):
        a0 = -90 + v * 45 + 3; a1 = a0 + 39
        arc(d, cx, cy, 74, a0, a1, G1, 10)
        if lv[v]:
            arc(d, cx, cy, 74, a0, a0 + 39 * lv[v], WH, 10)
            arc(d, cx, cy, 60, a0, a1, dim(OR, .8), 2)                         # DTN: it drifts
        q = polar(cx, cy, 92, (a0 + a1) / 2)
        text(d, q[0] - 4, q[1] - 8, str(v + 1), WH if lv[v] else G2)
    circ(d, cx, cy, 44, outline=G1)
    ctext(d, cx, cy - 26, 'PROG', G3)
    ctext(d, cx, cy - 10, '12', BL)
    # TYPE: the filter's curve, small
    pts = [(cx - 22 + i, cy + 18 - (0 if i < 22 else min(14, (i - 22) ** 1.6 / 4))) for i in range(44)]
    d.line(pts, fill=GR, width=2)
    return im

def drums():
    """the pattern round a circle: a ring a sound (KICK out, HATS in), sixteen steps round; the playhead a hand; the
    hits on it flash"""
    im, d = frame(3, '808 DRUMS', [('KIT', '808'), ('LEVEL', '104'), ('VERB', '20'), ('PAN', '0%')], beat=0)
    cx, cy = 120, 114
    lanes = [(82, [0, 6, 8, 11]), (68, [4, 12]), (54, [2, 6, 10, 14]), (40, list(range(0, 16, 2)))]
    names = ['KICK', 'SNARE', 'CLAP', 'HAT']
    step = 8
    for k, (r, hits) in enumerate(lanes):
        circ(d, cx, cy, r, outline=G1)
        for s in range(16):
            p = polar(cx, cy, r, -90 + s * 22.5)
            if s in hits:
                on = s == step
                circ(d, *p, 4 if on else 3, fill=WH if on else G3)
                if on: circ(d, *p, 8, outline=dim(YE, .7))                     # VERB: the ring round a hit
            else:
                d.point(p, fill=G2)
    a = -90 + step * 22.5
    d.line([polar(cx, cy, 30, a), polar(cx, cy, 92, a)], fill=BL)
    for s in range(16):
        d.line([polar(cx, cy, 90, -90 + s * 22.5), polar(cx, cy, 94 if s % 4 == 0 else 92, -90 + s * 22.5)], fill=G2)
    ctext(d, cx, cy - 8, '808', BL)
    return im

def tracks():
    return Image.open(EMU / 'emu-tracks.ppm').convert('RGB')

ITEMS = [
    (analog, 'ANALOG', 'two phasors (OSC 1, OSC 2 detuned) and their sum'),
    (digital, 'DIGITAL', 'the algorithm, and the carrier bent by it'),
    (fm6, 'FM6', 'six operators on a hexagon; the spectrum'),
    (phase, 'PHASE', 'the phase map bent at DCW; the wave it reads'),
    (lofi, 'LOFI', 'the wave snapped to the chip\'s steps'),
    (sample, 'SAMPLE', 'the sample, and its playhead magnified'),
    (voice, 'VOICE', 'the vowel chart, A to O; the formants'),
    (trio, 'TRIO', 'three oscillators on the circle of semitones'),
    (wheel, 'WHEEL', 'nine drawbars and the horn from above'),
    (grain, 'GRAIN', 'grains as windows round the position'),
    (phys, 'PHYS', 'the string\'s five modes; where it is struck'),
    (noise, 'NOISE', 'an analyser: the colour\'s slope, the filter'),
    (obervave, 'OBERVAVE', 'the eight voices round a ring'),
    (drums, 'DRUMS', 'the pattern round a circle, a ring a sound'),
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
