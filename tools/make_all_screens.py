#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Every screen of the FM-1's firmware, from its own drawing code.

  tools/make_all_screens.py [--palette N] [OUT_DIR]      (default: assets/screens/all)

--palette: the menu's COLOR, its number in gfx.c PALETTES (0 GREEN .. 4 MONO, the default, 5 SYNTHWAVE).

Builds and runs tools/screens_all.c (tools/screens_demo.c's demo project on the eight tracks playing; it needs the
generated headers in build/gen: ./build.sh, or HOST_ONLY=1 tests/run_tests.sh) and writes:
  OUT_DIR/<group>/<screen>.png   each screen at 2x
  OUT_DIR/<group>.png            a contact sheet a group (home, pages, drums, engines, layers, rec, system, visualiser)
  OUT_DIR/README.md              the list, with every screen
"""
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

from PIL import Image, ImageDraw

from make_screens import BEZEL, BG, SUB, TITLE, font

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "build" / "screens-all"
S, PAD, BZ, R, COLS = 240, 20, 6, 10, 6       # a screen at 1x on the sheets, the gap, the bezel, its corner
PALETTE_NAMES = {"0": "GREEN", "1": "AMBER", "2": "CYAN", "3": "RED", "4": "MONO", "5": "SYNTHWAVE"}
GROUPS = {
    "home": "The home screen (TRACKS), both banks of four",
    "pages": "Every page of the page table (params.c PAGES), on track 1 (ANALOG); DRUMS on the drum track",
    "drums": "The drum track: the grid's KIT and SOUND views, a hit's sheet, and the pages it shares",
    "engines": "EDIT 1 and EDIT 2 of every engine (its first factory preset, on track 2)",
    "layers": "Each function button held: the layer the keys and knobs become",
    "rec": "REC: armed, the free take's screens, the clear ring",
    "system": "The boot screen, the menu's five sections (HOME held) and ABOUT",
    "visualiser": "The visualiser's six styles (tap HOME on TRACKS)",
}


def sheet(items, out):
    ft, fs = font(True, 14), font(False, 11)
    cols = min(COLS, len(items))
    rows = (len(items) + cols - 1) // cols
    cw, ch = S + 2 * BZ, S + 2 * BZ + 46
    im = Image.new("RGB", (PAD + cols * (cw + PAD), PAD + rows * (ch + PAD // 2)), BG)
    d = ImageDraw.Draw(im)
    for k, (name, title, line) in enumerate(items):
        x, y = PAD + (k % cols) * (cw + PAD), PAD + (k // cols) * (ch + PAD // 2)
        d.rounded_rectangle([x, y, x + cw - 1, y + cw - 1], R, fill=BEZEL)
        im.paste(Image.open(WORK / f"{name}.ppm").convert("RGB"), (x + BZ, y + BZ))
        d.text((x, y + cw + 8), title, font=ft, fill=TITLE)
        d.text((x, y + cw + 27), line, font=fs, fill=SUB)
    im.save(out, optimize=True)
    print(f"screens: {out} ({im.width}x{im.height}, {len(items)} screens)")


def main():
    args, palette = sys.argv[1:], "4"
    if args[:1] == ["--palette"]:
        palette, args = args[1], args[2:]
    out = Path(args[0]) if args else ROOT / "assets" / "screens" / "all"
    WORK.mkdir(parents=True, exist_ok=True)
    for f in WORK.glob("*.ppm"):
        f.unlink()
    exe = WORK / "all"
    subprocess.run(["cc", "-O2", "-w", f"-I{ROOT / 'build' / 'gen'}", f"-I{ROOT / 'firmware' / 'src'}",
                    f"-I{ROOT / 'firmware' / 'hal'}", f"-I{ROOT / 'tests'}", f"-I{ROOT / 'tools'}", "-o", str(exe),
                    str(ROOT / "tools" / "screens_all.c"), "-lm"], check=True)
    subprocess.run([str(exe), str(WORK), palette], check=True, stdout=subprocess.DEVNULL)
    groups = OrderedDict((g, []) for g in GROUPS)
    for row in (WORK / "index.txt").read_text().splitlines():
        g, name, title, line = row.split("\t")
        groups.setdefault(g, []).append((name, title, line))
    out.mkdir(parents=True, exist_ok=True)
    md = ["# Every screen of the firmware", "",
          "Drawn by the firmware's own code on the host (`python3 tools/make_all_screens.py`), with the demo project",
          "of `tools/screens_demo.c` on the eight tracks playing. Each screen is 240 × 240 on the FM-1, 2x here.",
          f"MENU → SCREEN → COLOR: **{PALETTE_NAMES.get(palette, palette)}**"
          f" (`python3 tools/make_all_screens.py --palette {palette}`).", ""]
    total = 0
    for g, items in groups.items():
        if not items:
            continue
        (out / g).mkdir(exist_ok=True)
        for f in (out / g).glob("*.png"):
            f.unlink()
        for name, _, _ in items:
            Image.open(WORK / f"{name}.ppm").convert("RGB").resize((2 * S, 2 * S), Image.NEAREST).save(
                out / g / f"{name}.png", optimize=True)
        sheet(items, out / f"{g}.png")
        total += len(items)
        md += [f"## {g.capitalize()} ({len(items)})", "", GROUPS.get(g, ""), "", f"![{g}]({g}.png)", "",
               "| Screen | File | |", "|---|---|---|"]
        md += [f"| {t} | [`{g}/{n}.png`]({g}/{n}.png) | {ln} |" for n, t, ln in items]
        md.append("")
    md.insert(6, f"{total} screens in {sum(1 for v in groups.values() if v)} groups.\n")
    (out / "README.md").write_text("\n".join(md))
    print(f"screens: {total} in {out}")


if __name__ == "__main__":
    main()
