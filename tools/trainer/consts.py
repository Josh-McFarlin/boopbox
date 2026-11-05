#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The trainer's numbers for the web page that makes songs (web/songgen.js): the goals, parameters, buttons and pages
as the firmware numbers them, the drum kits, the factory sounds (as the trainer and as BoopBox number them: the cards
use the first, the page's player the second) and the "why" topics. Read from the sources, so the page always has the
firmware's own numbers.

  python3 tools/trainer/consts.py OUT.json         (web/make_site.py runs it; tests/trainer_song_test.mjs too)
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "tools"))
import lessons as LS  # noqa: E402
import songs as S  # noqa: E402
import theory as T  # noqa: E402


def enum_of(text, first):
    """the names of the enum that starts with `first`, in order (an enum with values set is refused)"""
    for m in re.finditer(r"enum\s*\{(.*?)\}", text, re.S):
        body = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
        body = re.sub(r"//[^\n]*", "", body)
        names = [x.strip() for x in body.split(",") if x.strip()]
        if names and names[0] == first:
            assert not any("=" in n for n in names), f"enum {first}: a value set ({names})"
            return {n: i for i, n in enumerate(names)}
    raise SystemExit(f"consts: no enum starting with {first}")


def kits():
    """the drum kits, as drums.c numbers them: five sampled, then tools/gen_drumkits.py's"""
    with tempfile.TemporaryDirectory() as d:
        h = os.path.join(d, "felucca_drumkits.h")
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_drumkits.py"), h], check=True,
                       stdout=subprocess.DEVNULL)
        line = [l for l in open(h).read().splitlines() if l.startswith("#define DS_KIT_NAME_LIST")][0]
    return ["ACOUSTIC", "DEEP", "TIGHT", "BRIGHT", "DUST"] + [x.strip().strip('"') for x in line.split(" ", 2)[2].split(",")]


def font_s():
    """FONT_S's first character and each character's advance (tools/gen_font.py's felucca_font.h)"""
    with tempfile.TemporaryDirectory() as d:
        h = os.path.join(d, "felucca_font.h")
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_font.py"), h], check=True, stdout=subprocess.DEVNULL)
        text = open(h).read()
    adv = [int(x) for x in re.search(r"FONT_S_ADV\[\d+\] = \{([^}]*)\}", text).group(1).split(",") if x.strip()]
    return {"first": int(re.search(r"FONT_S = \{ \d+, \d+, (\d+),", text).group(1)), "adv": adv}


def main(out):
    src = os.path.join(ROOT, "firmware", "src")
    core = open(os.path.join(src, "core.h")).read()
    trainer = open(os.path.join(src, "trainer.c")).read()
    panel = open(os.path.join(src, "panel.c")).read()
    params = open(os.path.join(src, "params.c")).read()
    body = params[params.index("static const page_t PAGES[] = {"):]
    body = body[:body.index("\n};")]
    pages = [{"title": t, "fam": f[4:]} for t, f in re.findall(r'^\s*\{"([^"]+)", (FAM_\w+),', body, re.M)]
    trainer_sounds = LS.presets_from_sources(ROOT, trainer=True)
    normal_sounds = LS.presets_from_sources(ROOT, trainer=False)
    sounds = {}
    for name, (e, i) in trainer_sounds.items():
        if name in normal_sounds and normal_sounds[name][0] == e and LS.ENGINE_ORDER[e] != "SAMPLE":
            sounds[name] = {"engine": e, "trainer": i, "boopbox": normal_sounds[name][1]}
    C = {
        "TG": enum_of(trainer, "TG_TRACK"),
        "HOW": enum_of(trainer, "HOW_ANY"),
        "P": enum_of(core, "P_LEVEL"),
        "G": enum_of(core, "G_BPM"),
        "B": enum_of(panel, "B_FX"),
        "ST": enum_of(core, "ST_NOTE"),
        "PAGES": pages,
        "DIVS": S.DIVS, "LANES": S.LANES, "SCALES": S.SCALES,
        "KITS": kits(),
        "ENGINES": LS.ENGINE_ORDER,
        "SOUNDS": sounds,
        "TOPICS": list(T.TOPICS),
        "HEAD_MAX": LS.HEAD_MAX, "ACT_MAX": LS.ACT_MAX, "VAL_MAX": LS.VAL_MAX,
        "NSTEP": int(re.search(r"#define NSTEP (\d+)", core).group(1)),
        "FONT_S": font_s(),                          # the screen's small font: what a step's text takes (pixels)
        "TEXT_W": 236, "HEAD_W": 236 - 6 * 8,        # (the band's width; a headline after its step's number)
    }
    for k in ("TG_DONE", "TG_NOTES", "TG_LANES"):
        assert k in C["TG"], k
    assert "NB" in C["B"] and C["B"]["NB"] == len(C["B"]) - 1
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "w").write(json.dumps(C, indent=0, sort_keys=True) + "\n")
    print(f"consts: {len(C['P'])} parameters, {len(C['PAGES'])} pages, {len(C['KITS'])} kits, {len(sounds)} sounds "
          f"-> {out}")


if __name__ == "__main__":
    main(sys.argv[1])
