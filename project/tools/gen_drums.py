#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Synthesize BoopBox's own drum one-shots (no third-party material, no recordings).

  gen_drums.py OUTDIR

Writes 16-bit mono WAVs at 32 kHz, "D <NAME>.wav": KICK, SNARE, CHAT, OHAT, CLAP, TOM LO, TOM HI, RIM, COWBELL,
CRASH, RIDE. tools/gen_samples.py takes them for SLICE's built-in BREAK, and for a GM kit role the CC0 kit
(assets/samples-cc0/KIT) lacks. Every sound is made by the code in this file and is GPL-3.0-only with it.

The building blocks: sines with a pitch sweep, a bank of detuned square waves for the metal, white noise, and a
Chamberlin state-variable filter. The random generator is seeded: the same files every run.
"""
import math
import random
import struct
import sys
from pathlib import Path

SR = 32000
TWO_PI = 2 * math.pi


def write_wav(path, samples):
    data = b"".join(struct.pack("<h", max(-32768, min(32767, int(v)))) for v in samples)
    fmt = struct.pack("<HHIIHH", 1, 1, SR, SR * 2, 2, 16)
    chunks = b"fmt " + struct.pack("<I", len(fmt)) + fmt + b"data" + struct.pack("<I", len(data)) + data
    path.write_bytes(b"RIFF" + struct.pack("<I", 4 + len(chunks)) + b"WAVE" + chunks)


def normalise(s, peak=30000, fade=0.03):
    """to the peak, the last 30 ms faded out (no click where the sound is cut)"""
    m = max(1e-9, max(abs(v) for v in s))
    n, nf = len(s), n_of(fade)
    return [v * peak / m * (min(1.0, (n - 1 - i) / nf)) for i, v in enumerate(s)]


class SVF:
    """Chamberlin state-variable filter: step(x) -> (low, band, high)"""

    def __init__(self, hz, q=0.7):
        self.f = 2 * math.sin(math.pi * min(hz, SR / 6) / SR)
        self.damp = 1 / q
        self.lo = self.bd = 0.0

    def step(self, x):
        hi = x - self.lo - self.damp * self.bd
        self.bd += self.f * hi
        self.lo += self.f * self.bd
        return self.lo, self.bd, hi


def env(t, decay, attack=0.001):
    return (t / attack if t < attack else 1.0) * math.exp(-t / decay)


def n_of(secs):
    return int(secs * SR)


def kick(rng):
    out, ph = [], 0.0
    for i in range(n_of(0.5)):
        t = i / SR
        f = 48 + 120 * math.exp(-t / 0.035)               # 168 Hz down to 48 Hz
        ph += f / SR
        body = math.sin(TWO_PI * ph) * env(t, 0.22, 0.0015)
        click = rng.uniform(-1, 1) * math.exp(-t / 0.002) * 0.5
        out.append(math.tanh(1.6 * (body + click)))
    return out


def snare(rng):
    out, p1, p2 = [], 0.0, 0.0
    hp = SVF(1800, 0.8)
    for i in range(n_of(0.32)):
        t = i / SR
        p1 += 190 * (1 + 0.3 * math.exp(-t / 0.01)) / SR
        p2 += 335 / SR
        tone = (math.sin(TWO_PI * p1) + 0.6 * math.sin(TWO_PI * p2)) * env(t, 0.055)
        _, _, hi = hp.step(rng.uniform(-1, 1))
        out.append(0.55 * tone + 0.8 * hi * env(t, 0.11))
    return out


def metal_bank(rng, base, n=6):
    """detuned square oscillators (inharmonic): the shimmer of hats and cymbals"""
    return [base * (1 + 0.37 * k + rng.uniform(-0.06, 0.06)) for k in range(n)]


def hat(rng, decay, secs):
    fr, ph = metal_bank(rng, 410), [0.0] * 6
    hp1, hp2 = SVF(7000, 0.9), SVF(9000, 0.7)
    out = []
    for i in range(n_of(secs)):
        t = i / SR
        m = 0.0
        for k in range(6):
            ph[k] = (ph[k] + fr[k] / SR) % 1.0
            m += 1.0 if ph[k] < 0.5 else -1.0
        x = 0.6 * m / 6 + 0.4 * rng.uniform(-1, 1)
        _, _, h = hp1.step(x)
        _, _, h = hp2.step(h)
        out.append(h * env(t, decay, 0.0005))
    return out


def clap(rng):
    bp = SVF(1250, 2.5)
    out = []
    for i in range(n_of(0.36)):
        t = i / SR
        a = 0.0
        for k, at in enumerate((0.0, 0.009, 0.019, 0.028)):      # four hands, then the room
            if t >= at:
                a = max(a, math.exp(-(t - at) / 0.0045) * (0.8 if k < 3 else 1.0))
        a = max(a, 0.55 * math.exp(-(t - 0.028) / 0.12) if t >= 0.028 else 0.0)
        _, b, _ = bp.step(rng.uniform(-1, 1))
        out.append(b * a)
    return out


def tom(rng, f0):
    out, ph = [], 0.0
    lp = SVF(2500, 0.7)
    for i in range(n_of(0.55)):
        t = i / SR
        ph += f0 * (1 + 0.45 * math.exp(-t / 0.05)) / SR
        lo, _, _ = lp.step(rng.uniform(-1, 1))
        out.append(math.sin(TWO_PI * ph) * env(t, 0.2, 0.001) + 0.25 * lo * math.exp(-t / 0.012))
    return out


def rim(rng):
    out, p1, p2 = [], 0.0, 0.0
    bp = SVF(3200, 1.5)
    for i in range(n_of(0.09)):
        t = i / SR
        p1 += 1650 / SR
        p2 += 510 / SR
        _, b, _ = bp.step(rng.uniform(-1, 1))
        out.append((0.6 * math.sin(TWO_PI * p1) + 0.5 * math.sin(TWO_PI * p2)) * env(t, 0.014, 0.0003)
                   + 0.7 * b * math.exp(-t / 0.004))
    return out


def cowbell(rng):
    out, p1, p2 = [], 0.0, 0.0
    bp = SVF(760, 1.8)
    for i in range(n_of(0.42)):
        t = i / SR
        p1 = (p1 + 565 / SR) % 1.0
        p2 = (p2 + 845 / SR) % 1.0
        x = (1.0 if p1 < 0.5 else -1.0) + (1.0 if p2 < 0.5 else -1.0)
        _, b, _ = bp.step(x)
        out.append(b * (0.6 * math.exp(-t / 0.018) + 0.4 * math.exp(-t / 0.14)))
    return out


def cymbal(rng, decay, bell):
    fr, ph = metal_bank(rng, 330, 8), [0.0] * 8
    hp1, hp2 = SVF(4800, 0.8), SVF(6500, 0.7)
    out, pb = [], [0.0, 0.0]
    for i in range(n_of(decay * 3.5)):
        t = i / SR
        m = 0.0
        for k in range(8):
            ph[k] = (ph[k] + fr[k] / SR) % 1.0
            m += 1.0 if ph[k] < 0.5 else -1.0
        x = 0.5 * m / 8 + 0.5 * rng.uniform(-1, 1)
        _, _, h = hp1.step(x)
        _, _, h = hp2.step(h)
        y = h * env(t, decay, 0.0015)
        if bell:                                          # the ride's bell: two partials of its own
            pb[0] += 1180 / SR
            pb[1] += 1770 / SR
            y += 0.35 * (math.sin(TWO_PI * pb[0]) + 0.6 * math.sin(TWO_PI * pb[1])) * math.exp(-t / 0.18)
        out.append(y)
    return out


def main(outdir):
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(0xB00B)
    kit = [("KICK", kick(rng)), ("SNARE", snare(rng)), ("CHAT", hat(rng, 0.035, 0.2)), ("OHAT", hat(rng, 0.24, 1.0)),
           ("CLAP", clap(rng)), ("TOM LO", tom(rng, 98)), ("TOM HI", tom(rng, 152)), ("RIM", rim(rng)),
           ("COWBELL", cowbell(rng)), ("CRASH", cymbal(rng, 0.3, False)), ("RIDE", cymbal(rng, 0.34, True))]
    for name, s in kit:
        write_wav(out / f"D {name}.wav", normalise(s))
    print(f"drums: {len(kit)} generated into {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
