#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The instrument home screen: one picture a sound engine (and the drum kit), for approval before the firmware.

HOME shows the selected track's instrument; HOME again opens TRACKS. KNOB 1-4 are the engine's EDIT 1 values, and
each knob's colour (cyan, pink, orange, violet: UI_COL in the default SYNTHWAVE theme) paints the part of the picture
that it moves. The header is the real one (build/host/emu-env.ppm, from tests/emu_test.c); the text is Terminus Bold 16,
as on the FM-1.

  python3 instrument.py OUT.png      (run tests/emu_test.c first, for the header and the TRACKS screen)
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
BG = (16, 4, 40)
K = [(0, 228, 248), (248, 44, 208), (248, 140, 56), (160, 96, 248)]          # KNOB 1-4 (and tracks 1-4)
T2 = [(110, 140, 255), (255, 112, 168), (255, 214, 90), (224, 128, 255)]     # tracks 5-8
TRK = K + T2
G = [(36, 18, 70), (70, 38, 122), (150, 118, 210), (214, 196, 244)]          # SYNTH_G: tiles .. light text
HI = (128, 252, 255)
WHITE = (240, 236, 255)
SCENE = (42, 200)                                                              # the picture's rows

def mix(a, b, k): return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
def dim(c, k): return mix(BG, c, k)
def text(d, x, y, s, c): d.text((x, y - 1), s, font=FONT, fill=c)            # y: the top of the 16-row cell
def ctext(d, cx, y, s, c): text(d, cx - 4 * len(s), y, s, c)

def frame(track, sound, engine, knobs, playing=True, active=(0,)):
    """the screen: the real header (sound and track repainted), the engine line, and the four knobs at the bottom"""
    im = Image.new('RGB', (W, W), BG); d = ImageDraw.Draw(im)
    hdr = Image.open(EMU / 'emu-env.ppm').crop((0, 0, W, 22))
    im.paste(hdr, (0, 0))
    for x in range(64, 154):                                                   # clear the sound's name
        for y in range(22): im.putpixel((x, y), hdr.getpixel((150, y)))
    for x in range(0, 14):
        for y in range(22): im.putpixel((x, y), hdr.getpixel((150, y)))
    tc = TRK[track]
    text(d, 72, 2, sound[:10], tc if track < 4 else tc)
    d.rectangle([171, 1, 182, 18], fill=tc)
    text(d, 173, 2, str(track + 1), BG)
    if playing: d.polygon([(4, 4), (4, 13), (12, 8)], fill=HI)                 # (the real header's play mark)
    else: d.rectangle([4, 5, 11, 12], fill=K[1])
    # the engine line: its name, and the eight tracks (lit: playing; framed: this one)
    text(d, 4, 25, engine, G[2])
    for k in range(8):
        x = 150 + k * 11
        c = TRK[k]
        d.rectangle([x, 29, x + 7, 36], fill=c if k in active else dim(c, .28))
        if k == track: d.rectangle([x - 2, 27, x + 9, 38], outline=WHITE)
    # the knobs: a bar in the knob's colour, the name, the value
    for i, (lab, val) in enumerate(knobs):
        x0 = i * 60
        d.rectangle([x0 + 4, 203, x0 + 55, 204], fill=K[i])
        ctext(d, x0 + 30, 207, lab, K[i])
        ctext(d, x0 + 30, 223, val, G[3])
    return im, d

def floor(d, y0=172, y1=200, c=None):                                          # the synthwave floor under a picture
    c = c or dim(K[1], .35)
    for j in range(7):
        t = j / 6
        y = int(y0 + (y1 - y0) * t * t)
        d.line([(0, y), (W, y)], fill=mix(BG, c, .35 + .65 * t))
    for i in range(-8, 9):
        d.line([(120 + i * 6, y0), (120 + i * 34, y1)], fill=mix(BG, c, .6))

def stars(d, n=26, y0=44, y1=120, seed=3):
    r = random.Random(seed)
    for _ in range(n):
        d.point((r.randrange(W), r.randrange(y0, y1)), fill=mix(BG, G[3], r.random() * .7 + .2))

def wline(d, pts, c, w=2):
    for i in range(w):
        d.line([(x, y + i) for x, y in pts], fill=c)

# ---------------------------------------------------------------------------------------------------------- engines
def analog():
    im, d = frame(0, 'SUPERSAW', 'ANALOG  OSC', [('WAVE', 'SAW'), ('DTN', '14'), ('MIX', '60'), ('NOIS', '12')])
    floor(d)
    r = random.Random(1)
    saw = lambda p: 2 * (p % 1) - 1
    for x in range(8, 232):                                                    # noise: dust around the wave
        if r.random() < .55:
            y = 108 + int(28 * saw(x / 56)) + r.randint(-14, 14)
            d.point((x, y), fill=mix(BG, K[3], .45 + .5 * r.random()))
    o2 = [(x, 108 + int(30 * saw(x / 56 + .09 + x / 900))) for x in range(8, 232)]   # OSC 2, detuned: drifts away
    wline(d, o2, K[1], 2)
    o1 = [(x, 108 + int(34 * saw(x / 56))) for x in range(8, 232)]
    wline(d, o1, K[0], 3)
    # the mix: a crossfader OSC 1 <-> OSC 2
    d.rectangle([62, 182, 178, 185], fill=G[1])
    d.rectangle([62, 182, 62 + int(116 * .6), 185], fill=K[2])
    d.rectangle([62 + int(116 * .6) - 3, 178, 62 + int(116 * .6) + 3, 189], fill=K[2])
    text(d, 40, 176, '1', K[0]); text(d, 188, 176, '2', K[1])
    return im

def digital():
    im, d = frame(1, 'RHODES', 'DIGITAL  FM', [('ALG', '5'), ('R2', '14.0'), ('R3', '1.00'), ('R4', '3.00')],
                  active=(0, 1, 3))
    stars(d, 18)
    # algorithm 5: 4 -> 3 -> 1, 2 -> 1; operator 1 the carrier
    ops = {4: (52, 64), 3: (52, 112), 2: (164, 88), 1: (108, 158)}
    col = {1: WHITE, 2: K[1], 3: K[2], 4: K[3]}
    cyc = {1: 1, 2: 14, 3: 1, 4: 3}
    def box(n):
        x, y = ops[n]
        d.rectangle([x - 26, y - 17, x + 26, y + 17], fill=G[0], outline=col[n])
        pts = [(x - 22 + i, y + 2 - int(9 * math.sin(i / 44 * cyc[n] * 2 * math.pi))) for i in range(45)]
        d.line(pts, fill=col[n])
        text(d, x - 24, y - 16, str(n), col[n])
    for a, b in [(4, 3), (3, 1), (2, 1)]:                                      # the wiring: KNOB 1's algorithm
        (xa, ya), (xb, yb) = ops[a], ops[b]
        wline(d, [(xa, ya + 17), (xa, (ya + yb) // 2 + 4), (xb + (xa - xb) // 3, (ya + yb) // 2 + 4),
                  (xb + (xa - xb) // 3, yb - 17)], K[0], 2)
    for n in ops: box(n)
    d.line([(108, 175), (108, 196)], fill=WHITE); d.polygon([(104, 192), (112, 192), (108, 198)], fill=WHITE)
    text(d, 176, 150, 'ALG', K[0]); text(d, 208, 150, '5', K[0])
    return im

def phase():
    im, d = frame(2, 'CZ BRASS', 'PHASE  CZ', [('WAVE', 'SAW'), ('WAVE2', 'RES'), ('DCW', '72'), ('ENV', '40')])
    # left: the phase map, a straight line bent at DCW's knee
    x0, y0, s = 12, 54, 84
    d.rectangle([x0, y0, x0 + s, y0 + s], outline=G[1])
    kx = .5 - .42 * .72
    knee = (x0 + int(s * kx), y0 + s - int(s * .5))
    d.line([(x0, y0 + s), (x0 + s, y0)], fill=G[1])
    wline(d, [(x0, y0 + s), knee, (x0 + s, y0)], K[2], 2)
    d.ellipse([knee[0] - 4, knee[1] - 4, knee[0] + 4, knee[1] + 4], fill=K[2])
    text(d, x0, y0 + s + 4, 'PHASE', G[2])
    # right: the bent sine, one cycle WAVE, the next WAVE2
    def cz(p):
        p %= 1
        q = p / kx * .5 if p < kx else .5 + (p - kx) / (1 - kx) * .5
        return math.cos(2 * math.pi * q)
    for c in range(2):
        pts = []
        for i in range(60):
            p = i / 60
            v = cz(p) if c == 0 else math.cos(2 * math.pi * p * 3.4) * (1 - p)
            pts.append((108 + c * 62 + i, 96 - int(30 * v)))
        wline(d, pts, K[c], 2)
    d.line([(108, 96), (230, 96)], fill=G[0])
    # the DCW envelope under it
    env = [(108 + i, 192 - int(36 * (min(1, i / 10) * math.exp(-max(0, i - 10) / 40)))) for i in range(122)]
    d.polygon(env + [(229, 192), (108, 192)], fill=dim(K[3], .35))
    d.line(env, fill=K[3])
    text(d, 12, 176, 'DCW ENV', K[3])
    return im

def lofi():
    im, d = frame(4, 'GAMEBOY', 'LOFI  CHIP', [('CHIP', '8BIT'), ('WAVE', 'PLS'), ('DUTY', '25%'), ('CRSH', '3')],
                  active=(0, 4))
    # a chip on a board, its name in KNOB 1's colour
    d.rectangle([60, 48, 180, 80], fill=(24, 14, 46), outline=G[1])
    for i in range(8):
        d.rectangle([66 + i * 15, 44, 72 + i * 15, 47], fill=G[2]); d.rectangle([66 + i * 15, 81, 72 + i * 15, 84], fill=G[2])
    d.ellipse([64, 60, 70, 66], fill=G[1])
    ctext(d, 124, 56, '8BIT', K[0])
    # the wave in fat pixels (CRSH: the size of the pixels), its duty marked
    px = 6
    for i in range(0, 216, px):
        p = (i / 72) % 1
        y = 112 if p < .25 else 160
        for yy in range(min(112, y), 161, px):
            if yy == y or (p < .25 and yy == 160):
                pass
        d.rectangle([12 + i, y, 12 + i + px - 2, y + px - 2], fill=K[1])
        if i > 0:
            pp = ((i - px) / 72) % 1
            if (pp < .25) != (p < .25):
                for yy in range(112, 161, px):
                    d.rectangle([12 + i, yy, 12 + i + px - 2, yy + px - 2], fill=K[1])
    for c in range(3):                                                         # the duty: 25 % of each cycle
        x = 12 + c * 72
        d.line([(x, 104), (x + 17, 104)], fill=K[2]); d.line([(x, 101), (x, 107)], fill=K[2])
        d.line([(x + 17, 101), (x + 17, 107)], fill=K[2])
    text(d, 12, 176, 'CRUSH', K[3])
    for i in range(3):
        d.rectangle([60 + i * 9, 180, 60 + i * 9 + 6, 186], fill=K[3])
    return im

def sample():
    im, d = frame(2, 'GRAND PNO', 'SAMPLE', [('SET', 'PIANO'), ('TUNE', '+0'), ('BITS', '12'), ('LOOP', 'OFF')])
    r = random.Random(4)
    ctext(d, 120, 46, 'PIANO', K[0])
    # the sample: a struck note that fades, in steps (BITS)
    mid, x0 = 118, 10
    for i in range(220):
        a = math.exp(-i / 70) * (min(1, i / 3))
        v = a * (0.6 + 0.4 * r.random())
        h = int(46 * v / 4) * 4                                                # the bit steps
        c = K[0] if i < 96 else dim(K[0], .45)
        d.line([(x0 + i, mid - h), (x0 + i, mid + h)], fill=c)
    for k in range(-3, 4):
        d.line([(x0, mid + k * 12), (x0 + 220, mid + k * 12)], fill=dim(K[2], .5))
    d.line([(x0 + 96, 64), (x0 + 96, 170)], fill=WHITE)                       # the playhead
    d.polygon([(x0 + 92, 64), (x0 + 100, 64), (x0 + 96, 69)], fill=WHITE)
    # TUNE: the key it plays, as a little keyboard; LOOP off: the loop's bracket dim
    for i in range(14):
        x = 50 + i * 10
        d.rectangle([x, 178, x + 8, 196], fill=G[3] if i != 7 else K[1])
    for i in [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]:
        d.rectangle([56 + i * 10, 178, 61 + i * 10, 188], fill=G[0])
    d.line([(160, 172), (226, 172)], fill=dim(K[3], .5))
    d.line([(160, 168), (160, 172)], fill=dim(K[3], .5)); d.line([(226, 168), (226, 172)], fill=dim(K[3], .5))
    return im

def voice():
    im, d = frame(5, 'CHOIR AH', 'VOICE', [('VOWL', 'A'), ('VOWL2', 'O'), ('TALK', '45'), ('SHIFT', '+2')],
                  active=(1, 3, 5))
    # the mouth between A (open, wide) and O (round), TALK of the way
    t = .45
    cx, cy = 120, 98
    rx = int(58 * (1 - t) + 30 * t); ry = int(28 * (1 - t) + 34 * t)
    d.ellipse([cx - 58, cy - 28, cx + 58, cy + 28], outline=dim(K[0], .45))
    d.ellipse([cx - 30, cy - 34, cx + 30, cy + 34], outline=dim(K[1], .45))
    d.ellipse([cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4], fill=(120, 30, 110))
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(30, 4, 30))
    d.chord([cx - rx + 6, cy - ry + 4, cx + rx - 6, cy + ry], 200, 340, fill=WHITE)
    d.ellipse([cx - rx // 2, cy + ry // 3, cx + rx // 2, cy + ry - 2], fill=(150, 40, 90))
    text(d, 20, 90, 'A', K[0]); text(d, 212, 90, 'O', K[1])
    d.rectangle([40, 140, 200, 141], fill=G[1]); d.rectangle([40, 140, 40 + int(160 * t), 141], fill=K[2])
    d.ellipse([36 + int(160 * t), 136, 44 + int(160 * t), 145], fill=K[2])
    # the three formants, moved by SHIFT
    pts = []
    for i in range(220):
        f = i / 220
        v = sum(a * math.exp(-((f - c - .03) ** 2) / .0012) for a, c in [(1, .12), (.7, .30), (.45, .55)])
        pts.append((10 + i, 196 - int(40 * v)))
    d.polygon(pts + [(229, 196), (10, 196)], fill=dim(K[3], .3))
    d.line(pts, fill=K[3])
    return im

def trio():
    im, d = frame(6, 'POWER LEAD', 'TRIO  3 OSC', [('WAVE', 'SAW'), ('INT2', '+7'), ('INT3', '+12'), ('DTN', '8')],
                  active=(0, 6))
    # three waves, stacked, at their intervals
    for k, (semi, c) in enumerate([(0, K[0]), (7, K[1]), (12, K[2])]):
        f = 2 ** (semi / 12)
        y0 = 62 + k * 30
        pts = [(10 + i, y0 - int(11 * (2 * ((i / 44 * f + k * .07) % 1) - 1))) for i in range(220)]
        if k: d.line([(x, y + 2) for x, y in pts], fill=dim(K[3], .6))       # DTN: a ghost each
        wline(d, pts, c, 2)
    # where they sit: two octaves of keys, a dot a note
    x0, y0 = 22, 150
    white = [0, 2, 4, 5, 7, 9, 11]
    for i in range(14):
        d.rectangle([x0 + i * 14, y0, x0 + i * 14 + 12, y0 + 44], fill=G[3])
    for o in range(2):
        for j, s in enumerate([1, 3, 6, 8, 10]):
            wi = [1, 2, 4, 5, 6][j]
            x = x0 + (o * 7 + wi) * 14 - 5
            d.rectangle([x, y0, x + 8, y0 + 26], fill=G[0])
    for semi, c in [(0, K[0]), (7, K[1]), (12, K[2])]:
        o, s = divmod(semi, 12)
        wi = white.index(s)
        x = x0 + (o * 7 + wi) * 14 + 6
        d.ellipse([x - 4, y0 + 34, x + 4, y0 + 42], fill=c)
    return im

def wheel():
    im, d = frame(1, 'GOSPEL B3', 'WHEEL  ORGAN', [('REG', 'GOSPL'), ('SUB', '+2'), ('BODY', '+0'), ('TOP', '-3')],
                  active=(1, 3))
    # the nine drawbars, pulled out; SUB (16', 5 1/3'), BODY (8', 4', 2 2/3'), TOP (2', 1 3/5', 1 1/3', 1')
    pulls = [8, 8, 8, 6, 4, 2, 3, 1, 4]
    grp = [1, 1, 2, 2, 2, 3, 3, 3, 3]
    names = ["16", "5", "8", "4", "2", "2", "1", "1", "1"]
    for i, (p, g) in enumerate(zip(pulls, grp)):
        x = 18 + i * 23
        d.rectangle([x, 46, x + 14, 52], fill=G[1])
        h = 12 + p * 13
        d.rectangle([x + 3, 52, x + 11, 52 + h], fill=dim(K[g], .5))
        for m in range(1, p + 1):
            d.line([(x + 3, 52 + 12 + m * 13 - 13), (x + 11, 52 + 12 + m * 13 - 13)], fill=dim(K[g], .8))
        d.rectangle([x, 52 + h, x + 14, 52 + h + 12], fill=K[g])
    # REG: the registration, in KNOB 1's colour, and the rotary speaker (ROTR SLOW) as a little Leslie
    text(d, 150, 166, 'GOSPL', K[0])
    d.rectangle([200, 160, 230, 196], outline=G[2])
    d.ellipse([205, 166, 225, 186], outline=G[2]); d.line([(208, 176), (222, 176)], fill=WHITE)
    return im

def grain():
    im, d = frame(0, 'CLOUDS', 'GRAIN', [('SRC', 'STRGS'), ('POS', '38'), ('SIZE', '60'), ('DENS', '72')],
                  active=(0, 2))
    r = random.Random(9)
    # the source at the bottom, the position on it; grains rise from there
    y = 178
    for i in range(220):
        a = .4 + .6 * abs(math.sin(i / 30)) * (.6 + .4 * r.random())
        d.line([(10 + i, y - int(14 * a)), (10 + i, y + int(14 * a))], fill=dim(K[0], .75))
    px = 10 + int(220 * .38)
    d.rectangle([px - 1, 52, px + 1, 196], fill=K[1])
    for g in range(46):                                                        # DENS: how many; SIZE: how big
        t = r.random()
        gx = px + r.gauss(0, 10 + 40 * t)
        gy = 160 - t * 108
        s = 2 + r.random() * 4.5
        c = mix(K[2], K[3], t)
        d.ellipse([gx - s, gy - s * .7, gx + s, gy + s * .7], fill=mix(BG, c, 1 - .55 * t))
    return im

def fm6():
    im, d = frame(4, 'E.PIANO 1', 'FM6  DX7', [('ALG', '5'), ('FB', '6'), ('MLVL', '+0'), ('MRAT', '+0')],
                  active=(0, 4, 3))
    # DX7 algorithm 5: three stacks of two, the feedback on 6
    cols = [52, 120, 188]
    for k, x in enumerate(cols):
        top, bot = 2 * k + 2, 2 * k + 1
        for n, y in [(top, 70), (bot, 128)]:
            car = n % 2 == 1
            c = WHITE if car else K[2]
            d.rectangle([x - 20, y - 15, x + 20, y + 15], fill=G[0] if car else dim(K[2], .3), outline=c)
            ctext(d, x, y - 8, str(n), c)
            if not car:                                                        # MRAT: the modulator's ratio
                text(d, x + 22, y - 16, '1' if n != 6 else '14', K[3])
        d.line([(x, 85), (x, 112)], fill=K[0]); d.line([(x + 1, 85), (x + 1, 112)], fill=K[0])
        d.line([(x, 143), (x, 166)], fill=K[0]); d.line([(x + 1, 143), (x + 1, 166)], fill=K[0])
    d.line([(cols[0], 166), (cols[2], 166)], fill=K[0]); d.line([(120, 166), (120, 188)], fill=K[0])
    d.polygon([(116, 184), (124, 184), (120, 190)], fill=K[0])
    # the feedback loop on 6
    x = cols[2]
    wline(d, [(x + 6, 55), (x + 6, 48), (x + 34, 48), (x + 34, 92), (x + 20, 92)], K[1], 2)
    text(d, 8, 176, 'ALG 5', K[0]); text(d, 176, 176, 'FB 6', K[1])
    return im

def phys():
    im, d = frame(2, 'NYLON GTR', 'PHYS  STRNG', [('MODEL', 'STRNG'), ('STRC', '40'), ('BRIT', '55'), ('DAMP', '30')],
                  active=(2, 3))
    # the four models, STRNG chosen
    for i, m in enumerate(['MODAL', 'STRNG', 'MEMB', 'SYMP']):
        x = 6 + i * 58
        on = m == 'STRNG'
        d.rectangle([x, 44, x + 54, 60], fill=dim(K[0], .35) if on else G[0], outline=K[0] if on else G[1])
        ctext(d, x + 27, 45, m, WHITE if on else G[2])
    # the string between its bridges, its modes; BRIT: the high ones glow
    x0, x1, y = 16, 224, 116
    d.rectangle([x0 - 6, y - 22, x0, y + 22], fill=G[2]); d.rectangle([x1, y - 22, x1 + 6, y + 22], fill=G[2])
    for m, (a, c) in enumerate([(26, K[1]), (12, mix(K[1], K[2], .5)), (8, K[2]), (5, K[2])]):
        pts = [(x, y - int(a * math.sin(math.pi * (m + 1) * (x - x0) / (x1 - x0)))) for x in range(x0, x1 + 1)]
        d.line(pts, fill=mix(BG, c, 1 - m * .12))
    d.line([(x0, y), (x1, y)], fill=WHITE)
    # where it is plucked (STRC), and DAMP: how fast it dies
    px = x0 + int((x1 - x0) * .4)
    d.polygon([(px - 5, y - 36), (px + 5, y - 36), (px, y - 28)], fill=K[1])
    env = [(16 + i, 196 - int(30 * math.exp(-i / 70))) for i in range(208)]
    d.polygon(env + [(223, 196), (16, 196)], fill=dim(K[3], .3)); d.line(env, fill=K[3])
    return im

def noise():
    im, d = frame(3, 'OCEAN', 'NOISE  ANLG', [('MODE', 'ANLG'), ('COLR', 'PINK'), ('FREQ', '2.4K'), ('RES', '58')],
                  active=(3, 0))
    r = random.Random(5)
    # the noise as a field of static, thinner up high (pink: falls 3 dB an octave)
    for x in range(0, 240, 2):
        for y in range(44, 196, 2):
            f = x / 240
            peak = math.exp(-((f - .62) ** 2) / .003) * .58
            lvl = (1 - .55 * f) * .7 + peak
            top = 196 - lvl * 110
            if y > top and r.random() < .55:
                c = K[2] if peak > .12 and y < top + 20 else K[1]
                d.rectangle([x, y, x, y], fill=mix(BG, c, .35 + .6 * r.random()))
    d.line([(0, 196 - .7 * 110), (240, 196 - .7 * .45 * 110 - 0)], fill=K[1])
    fx = int(240 * .62)
    d.line([(fx, 52), (fx, 196)], fill=K[2])
    d.rectangle([fx - 3, 196 - int(1.28 * 110) - 3, fx + 3, 196 - int(1.28 * 110) + 3], outline=K[3])
    ctext(d, 50, 46, 'ANLG', K[0])
    return im

def obervave():
    im, d = frame(0, 'OB BRASS', 'OBERVAVE', [('PROG', '12'), ('TYPE', 'LP24'), ('XMOD', '20'), ('DTN', '6')],
                  active=(0, 2))
    # eight voice modules, the ones sounding lit, each with two oscillators (XMOD between) and its filter
    for v in range(8):
        x = 6 + v * 29
        on = v in (0, 2, 3, 5)
        d.rectangle([x, 46, x + 25, 160], fill=(26, 10, 52), outline=G[2] if on else G[1])
        for k in range(2):
            cy = 64 + k * 26
            d.ellipse([x + 5, cy - 8, x + 21, cy + 8], outline=WHITE if on else G[1])
            ang = -2.4 + (v * 37 % 7) * .2 + (k * .5)
            d.line([(x + 13, cy), (x + 13 + int(6 * math.cos(ang)), cy + int(6 * math.sin(ang)))], fill=WHITE if on else G[1])
        if on:
            d.line([(x + 23, 64), (x + 23, 90)], fill=K[2]); d.line([(x + 21, 64), (x + 23, 64)], fill=K[2])
        # the filter: its curve in TYPE's colour
        pts = [(x + 3 + i, 132 - (12 if i < 11 else int(12 - (i - 11) ** 1.4))) for i in range(20)]
        d.line(pts, fill=K[1] if on else dim(K[1], .3))
        lv = .8 if on else .1
        d.rectangle([x + 4, 150 - int(10 * lv), x + 21, 150], fill=K[0] if on else G[1])
        ctext(d, x + 13, 162, str(v + 1), WHITE if on else G[2])
    text(d, 8, 182, 'PROG 12  OB BRASS', K[0])
    return im

def drums():
    im, d = frame(3, '808 DRUMS', 'DRUMS  KIT', [('KIT', '808'), ('LEVEL', '104'), ('VERB', '20'), ('PAN', '0%')],
                  active=(0, 3))
    tc = K[3]
    hit = {'KICK', 'HAT'}
    def drum(cx, cy, rx, ry, name, shell=G[2]):
        on = name in hit
        d.ellipse([cx - rx, cy - ry + 4, cx + rx, cy + ry + 4], fill=G[0])
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=mix(BG, tc, .9) if on else (40, 22, 74), outline=WHITE if on else shell)
        if on:
            d.ellipse([cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4], outline=dim(tc, .6))
    # the kit from the drummer's seat: cymbals, toms, snare, kick, hats
    drum(46, 66, 26, 9, 'CRASH', (200, 170, 60)); drum(196, 70, 28, 9, 'RIDE', (200, 170, 60))
    drum(96, 84, 20, 11, 'TOM1'); drum(146, 84, 20, 11, 'TOM2')
    drum(120, 150, 34, 30, 'KICK')
    drum(66, 128, 22, 12, 'SNARE'); drum(194, 136, 24, 13, 'FLOOR')
    drum(30, 110, 20, 7, 'HAT', (200, 170, 60))
    # the 16 pads as a strip: those that played this beat lit
    for i in range(16):
        x = 8 + i * 14
        on = i in (0, 4, 8)
        d.rectangle([x, 186, x + 11, 196], fill=tc if on else G[1])
    return im

def tracks():
    return Image.open(EMU / 'emu-tracks.ppm').convert('RGB')

ITEMS = [
    (analog, 'ANALOG', 'OSC 1 and the detuned OSC 2; noise as dust'),
    (digital, 'DIGITAL', 'the four operators in their algorithm'),
    (phase, 'PHASE', 'the phase bent at DCW; WAVE then WAVE2'),
    (lofi, 'LOFI', 'the chip, its wave in fat pixels, the duty'),
    (sample, 'SAMPLE', 'the sample in bit steps, the playhead, the key'),
    (voice, 'VOICE', 'the mouth from A to O; the formants below'),
    (trio, 'TRIO', 'three oscillators and where they sit on the keys'),
    (wheel, 'WHEEL', 'the nine drawbars, coloured by SUB, BODY, TOP'),
    (grain, 'GRAIN', 'grains rise from the position on the sample'),
    (fm6, 'FM6', 'the DX7 algorithm; feedback, modulator ratios'),
    (phys, 'PHYS', 'the string, where it is plucked, how it dies'),
    (noise, 'NOISE', 'the noise by pitch; colour slope, filter peak'),
    (obervave, 'OBERVAVE', 'the eight voice modules, lit as they play'),
    (drums, 'DRUMS', 'the kit; drums flash on their hits'),
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
