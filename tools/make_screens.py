#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The README's screenshots of the FM-1's screen, from the firmware's own drawing code.

  tools/make_screens.py [OUT_DIR]      (default: assets/screens)

Builds and runs tools/screens_demo.c (the host tests' harness, a demo project on the eight tracks playing; it needs
the generated headers in build/gen: ./build.sh, or HOST_ONLY=1 tests/run_tests.sh), then lays the screens out at 2x
with a title and a line under each:
  boopbox-screens.png      the main screens
  boopbox-visualiser.png   the boot screen, a sound page, the menu and the visualiser's six styles
  boopbox-synthwave.png    the main screens again in the SYNTHWAVE palette (MENU > SCREEN > COLOR)
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "build" / "screens"

MAIN = [
    ("tracks-1-4", "TRACKS 1–4", "bass, keys, flute and the 808 kit playing"),
    ("tracks-5-8", "TRACKS 5–8", "the second bank, each track in its own shade"),
    ("patterns", "PATTERNS", "eight patterns a track, chains, quantized changes"),
    ("drums", "DRUMS", "16 sounds × 16 steps, levels and rolls"),
    ("notes", "SEQ → NOTES", "the piano roll of a synth track"),
    ("chords", "CHORDS", "a progression the tracks follow (S scale, T transpose)"),
    ("layer-fx", "FX held: PUNCH-IN", "27 effects on the keys, with a target"),
    ("layer-mix-5-8", "GLO held: MIX", "mute, solo and levels of the bank shown"),
    ("song", "SONG", "sections A–D, played live or in order"),
]
MORE = [
    ("boot", "BOOT", "the name as text, the version"),
    ("page-env", "ENV", "a sound page: the curve and four knobs"),
    ("menu", "MENU (HOME held)", "screen, lights, audio, sequencer, system"),
    ("vis-palms", "PALMS", "the visualiser: tap HOME on TRACKS"),
    ("vis-night-drive", "NIGHT DRIVE", "the city is the spectrum, the road the beat"),
    ("vis-horizon", "HORIZON", "the spectrum; tiles light up on the beat"),
    ("vis-flyover", "FLYOVER", "the spectrum over time, bass in the middle"),
    ("vis-dense-city", "DENSE CITY", "the eight tracks and the mix, peaks held"),
    ("vis-key-city", "KEY CITY", "a tower a key, lit in its track's colour"),
]

SYNTH = [
    ("boot", "BOOT", "a sun setting on a neon horizon"),
    ("tracks-1-4", "TRACKS 1–4", "the tracks in cyan, magenta, orange, violet"),
    ("patterns", "PATTERNS", "neon rules, a glow under the title"),
    ("page-env", "ENV", "a sound page: the curve in the track's colour"),
    ("chords", "CHORDS", "a progression the tracks follow"),
    ("layer-mix-5-8", "GLO held: MIX", "tracks 5–8 in colours of their own"),
    ("drums", "DRUMS", "16 sounds × 16 steps"),
    ("notes", "SEQ → NOTES", "the piano roll"),
    ("menu", "MENU (HOME held)", "large values from pink to orange"),
]

BG, BEZEL, TITLE, SUB = (28, 28, 32), (10, 10, 12), (236, 236, 240), (150, 150, 158)
S, PAD, BZ, R = 480, 30, 8, 14            # a screen at 2x, the gap, the bezel, its corner


def font(bold, size):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for d in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu", "/Library/Fonts"):
        try:
            return ImageFont.truetype(str(Path(d) / name), size)
        except OSError:
            pass
    return ImageFont.load_default()


def sheet(items, cols, out, work=WORK):
    ft, fs = font(True, 21), font(False, 16)
    rows = (len(items) + cols - 1) // cols
    cw, ch = S + 2 * BZ, S + 2 * BZ + 70
    im = Image.new("RGB", (PAD + cols * (cw + PAD), PAD + rows * (ch + PAD // 2)), BG)
    d = ImageDraw.Draw(im)
    for k, (name, title, line) in enumerate(items):
        x, y = PAD + (k % cols) * (cw + PAD), PAD + (k // cols) * (ch + PAD // 2)
        d.rounded_rectangle([x, y, x + cw - 1, y + cw - 1], R, fill=BEZEL)
        im.paste(Image.open(work / f"{name}.ppm").convert("RGB").resize((S, S), Image.NEAREST), (x + BZ, y + BZ))
        d.text((x, y + cw + 14), title, font=ft, fill=TITLE)
        d.text((x, y + cw + 42), line, font=fs, fill=SUB)
    im.save(out, optimize=True)
    print(f"screens: {out} ({im.width}x{im.height})")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "screens"
    WORK.mkdir(parents=True, exist_ok=True)
    for f in WORK.glob("*.ppm"):
        f.unlink()
    exe = WORK / "demo"
    subprocess.run(["cc", "-O2", "-w", f"-I{ROOT / 'build' / 'gen'}", f"-I{ROOT / 'firmware' / 'src'}",
                    f"-I{ROOT / 'firmware' / 'hal'}", f"-I{ROOT / 'tests'}", "-o", str(exe),
                    str(ROOT / "tools" / "screens_demo.c"), "-lm"], check=True)
    subprocess.run([str(exe), str(WORK)], check=True, stdout=subprocess.DEVNULL)
    synth = WORK / "synthwave"
    synth.mkdir(exist_ok=True)
    subprocess.run([str(exe), str(synth), "5"], check=True, stdout=subprocess.DEVNULL)   # (gfx.c PAL_SYNTH)
    out.mkdir(parents=True, exist_ok=True)
    sheet(MAIN, 3, out / "boopbox-screens.png")
    sheet(MORE, 3, out / "boopbox-visualiser.png")
    sheet(SYNTH, 3, out / "boopbox-synthwave.png", synth)


if __name__ == "__main__":
    main()
