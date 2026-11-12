#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Check that a generated site is built for a firmware binary.

  tools/check_site.py firmware/releases/boopbox-X.Y.Z.fwsc [--site build/replit-site]

The site is built by web/make_site.py from the firmware package and source pages.
This checks, for the given binary:
  - it is the only matching package in the generated firmware directory, together with BoopBox Trainer's package of
    the same version (boopbox-trainer-X.Y.Z.fwsc, the installer's second choice),
  - the installer's meta names it, with its version and its SHA-256 (and the trainer's, when there is one),
  - sw.js keeps it (and the trainer's) offline, under a stamp for its version.
Prints each problem as a GitHub error annotation and exits 1 if there is any.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


def problems(fw, site):
    name = fw.name
    ver = name[len("boopbox-"):-len(".fwsc")]
    out = []

    tname = f"boopbox-trainer-{ver}.fwsc"
    tpath = site / "firmware" / tname
    others = sorted(p.name for p in (site / "firmware").glob("*.fwsc") if p.name not in (name, tname))
    if others:
        out.append((site / "firmware", f"old packages still in {site}/firmware/: {', '.join(others)}"))

    inst = site / "webapp" / "installer" / "index.html"
    m = re.search(r"^const meta = (\{.*\});$", inst.read_text(encoding="utf-8"), re.M)
    if not m:
        out.append((inst, "no 'const meta = {...};' line"))
    else:
        meta = json.loads(m.group(1))
        if re.sub(r"[^A-Za-z0-9.-]", "-", str(meta.get("version"))) != ver:
            out.append((inst, f"installer is built for {meta.get('version')!r}, the binary is {ver}"))
        if meta.get("pkg") != "../../firmware/" + name:
            out.append((inst, f"installer installs {meta.get('pkg')!r}, not {name}"))
        if meta.get("sha256") != hashlib.sha256(fw.read_bytes()).hexdigest():
            out.append((inst, f"installer's SHA-256 is not the SHA-256 of {name}"))
        tm = meta.get("trainer")
        if tpath.exists() != bool(tm):
            out.append((inst, f"the trainer's package and the installer's trainer choice do not go together ({tname})"))
        elif tm:
            if tm.get("pkg") != "../../firmware/" + tname or str(tm.get("version")) != str(meta.get("version")):
                out.append((inst, f"installer's trainer choice is {tm.get('pkg')!r}, not {tname}"))
            if tm.get("sha256") != hashlib.sha256(tpath.read_bytes()).hexdigest():
                out.append((inst, f"installer's trainer SHA-256 is not the SHA-256 of {tname}"))

    sw = site / "webapp" / "sw.js"
    text = sw.read_text(encoding="utf-8")
    m = re.search(r'^const STAMP = "([^"]*)";', text, re.M)
    if not m or not m.group(1).startswith(ver + "-"):
        out.append((sw, f"STAMP is {m.group(1) if m else None!r}, not one for {ver}"))
    m = re.search(r"^const FILES = (\[.*?\]);", text, re.M)
    if not m or "../firmware/" + name not in json.loads(m.group(1)):
        out.append((sw, f"FILES does not keep ../firmware/{name}"))
    if m and tpath.exists() and "../firmware/" + tname not in json.loads(m.group(1)):
        out.append((sw, f"FILES does not keep ../firmware/{tname}"))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("binary", type=Path)
    ap.add_argument("--site", type=Path, default=Path("build/replit-site"))
    a = ap.parse_args()
    found = problems(a.binary, a.site)
    for where, msg in found:
        print(f"::error file={where}::{msg}")
    if found:
        print(f"Rebuild the site: python3 web/make_site.py BINARY VERSION {a.site}", file=sys.stderr)
        return 1
    print(f"{a.site}/ is built for {a.binary.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
