#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The TRAINER's song area (level 4) on the way to the FM-1: the package the web page installs is the package the build
would make with that song in its app, and the browser (web/trslot.js) and tools/trainer/slot.py write the same bytes.

  tests/trainer_slot_test.py BUILD/trainer-fw HOSTDIR
    BUILD/trainer-fw: felucca.bin, loader/ota.bin, felucca-trainer.fwsc (./build.sh --trainer)
    HOSTDIR: trainer-song.bin / .json (tests/trainer_test.c: level 2 as a song, the area and the fields)

  1. web/trslot.js encodeSong(trainer-song.json) is trainer-song.bin, byte for byte (the C test's encoding);
  2. slot.py patch of the package is fm1pkg_make.py's package of the app with the song in its area;
  3. web/trslot.js patchPackage gives the same bytes; songAreaOf reads the song back; clearing it gives the package back;
  4. a package with no song area (a BoopBox package) is refused by both."""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.path.insert(0, os.path.join(ROOT, "tools", "trainer"))
import fm1pkg_make as P  # noqa: E402
import slot  # noqa: E402

fails = 0


def check(ok, what):
    global fails
    print(f"trainer slot: {what:<92} {'ok' if ok else 'FAIL'}")
    fails += not ok


def node(script, *args):
    r = subprocess.run(["node", "--input-type=module", "-e", script, *args], capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        print(r.stderr)
    return r.returncode == 0, r.stdout


def main(fw, host):
    os.environ.setdefault("AC79_SDK", os.path.expanduser("~/fw-AC79_AIoT_SDK"))   # (as build.sh: the package's SDK files)
    app = open(os.path.join(fw, "felucca.bin"), "rb").read()
    ota = open(os.path.join(fw, "loader", "ota.bin"), "rb").read()
    pkg = open(os.path.join(fw, "felucca-trainer.fwsc"), "rb").read()
    song = open(os.path.join(host, "trainer-song.bin"), "rb").read()
    product = "".join(chr((pkg[i * 0x30 + 0x2F] - i - 1) & 0xFF) for i in range(20) if pkg[i * 0x30 + 0x2F] != 0x7D)
    at = slot.find(app)
    inpkg = slot.app_of(pkg)
    check(app[at:at + slot.SLOT_SIZE] == slot.empty() and inpkg[:len(app)] == app and
          set(inpkg[len(app):]) <= {0xFF},
          f"the package's app is the build's; its song area (app 0x{at:x}) is empty")
    check(slot.describe(song).startswith("NEON AVENUE"), f"the C test's song: {slot.describe(song)}")
    tmp = tempfile.mkdtemp()
    out_js, area_js = os.path.join(tmp, "js.fwsc"), os.path.join(tmp, "js-song.bin")
    ok, _ = node("""
import { readFileSync, writeFileSync } from "fs";
import * as S from "./web/trslot.js";
const [ , json, pkg, out, area] = process.argv;
const song = S.encodeSong(JSON.parse(readFileSync(json, "utf8")));
writeFileSync(area, song);
const p = S.patchPackage(new Uint8Array(readFileSync(pkg)), song);
writeFileSync(out, p);
const back = S.songAreaOf(p);
if (back.some((x, i) => x !== song[i])) throw new Error("songAreaOf");
const d = S.describeSong(back);
if (d.name !== "NEON AVENUE" || S.describeSong(S.emptySong()) !== null) throw new Error("describeSong");
const cards = JSON.parse(readFileSync(json, "utf8")).cards;
if (cards[cards.length - 1].goal !== S.TG_DONE) throw new Error("TG_DONE is not the firmware's");
const clear = S.patchPackage(p, S.emptySong()), orig = readFileSync(pkg);
if (clear.length !== orig.length || clear.some((x, i) => x !== orig[i])) throw new Error("clear");
""", os.path.join(host, "trainer-song.json"), os.path.join(fw, "felucca-trainer.fwsc"), out_js, area_js)
    check(ok, "web/trslot.js: encode, patch, read back, clear (the package as it was)")
    if ok:
        check(open(area_js, "rb").read() == song, "web/trslot.js encodeSong(the song's fields) is the C test's song area")
    # slot.py patch vs the package built from the app with the song (fm1pkg_make.py: what ./build.sh would make)
    built_app = app[:at] + song + app[at + slot.SLOT_SIZE:]
    ref = P.ufw(P.flash_image(built_app, P.KEY), ota, product)
    mine = slot.patch(pkg, song)
    check(mine == ref, "slot.py patch: the package fm1pkg_make.py builds from the app with the song in it")
    check(slot.patch(mine, slot.empty()) == pkg, "slot.py clear: the package as built")
    if ok:
        check(open(out_js, "rb").read() == mine, "web/trslot.js patchPackage: the same bytes as slot.py")
    # the CLI
    cli = os.path.join(tmp, "cli.fwsc")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "trainer", "slot.py"), "patch",
                        os.path.join(fw, "felucca-trainer.fwsc"), os.path.join(host, "trainer-song.bin"), cli],
                       capture_output=True, text=True)
    check(r.returncode == 0 and open(cli, "rb").read() == mine, "slot.py patch (the command line)")
    # a BoopBox package (no song area): refused
    normal = os.path.join(ROOT, "build", "felucca.fwsc")
    if os.path.exists(normal):
        try:
            slot.patch(open(normal, "rb").read(), song)
            refused = False
        except SystemExit:
            refused = True
        ok2, _ = node("""
import { readFileSync } from "fs";
import * as S from "./web/trslot.js";
try { S.patchPackage(new Uint8Array(readFileSync(process.argv[1])), S.emptySong()); process.exit(1); }
catch (e) { if (!/no song area/.test(e.message)) throw e; }
""", normal)
        check(refused and ok2, "a BoopBox package (no song area): refused by both")
    # a song too big, or text the screen cannot show: refused by the encoder
    ok3, _ = node("""
import * as S from "./web/trslot.js";
const card = (h, last) => ({ head: h, act: "PRESS PLAY", goal: last ? S.TG_DONE : 5, trk: 255, p: 0, btn: 10, v: 1 });
const base = { name: "X", style: "Y", learn1: "A", learn2: "B", targets: [], cards: [card("GO"), card("DONE", 1)] };
S.encodeSong(base);
for (const bad of [{ ...base, name: "lower" }, { ...base, cards: [card("A".repeat(24)), card("B", 1)] },
                   { ...base, cards: Array.from({ length: 129 }, (_, i) => card("S" + i, i === 128)) },
                   { ...base, targets: new Array(8200).fill(0) },
                   { ...base, cards: [card("GO"), { ...card("NOT DONE"), goal: 5 }] }]) {
  let threw = false;
  try { S.encodeSong(bad); } catch (e) { threw = true; }
  if (!threw) throw new Error("accepted " + JSON.stringify(bad).slice(0, 60));
}
""")
    check(ok3, "web/trslot.js refuses a song too big, too many steps, unshowable text, no DONE at the end")
    print(f"trainer slot: {'FAIL' if fails else 'PASS'}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
