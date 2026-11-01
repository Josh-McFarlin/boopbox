#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Check that the website in docs/ is built for a firmware binary.

  tools/check_site.py docs/firmware/boopbox-X.Y.Z.fwsc [--site docs]

The site is built by web/make_site.py and committed: the installer and the offline
cache (webapp/sw.js) name the package they install. A binary copied into
docs/firmware/ without rebuilding the site would be released while the website still
installs the old one. This checks, for the given binary:
  - it is the only package in docs/firmware/ (make_site.py removes the old ones),
  - the installer's meta names it, with its version and its SHA-256,
  - sw.js keeps it offline, under a stamp for its version.
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

    others = sorted(p.name for p in (site / "firmware").glob("*.fwsc") if p.name != name)
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

    sw = site / "webapp" / "sw.js"
    text = sw.read_text(encoding="utf-8")
    m = re.search(r'^const STAMP = "([^"]*)";', text, re.M)
    if not m or not m.group(1).startswith(ver + "-"):
        out.append((sw, f"STAMP is {m.group(1) if m else None!r}, not one for {ver}"))
    m = re.search(r"^const FILES = (\[.*?\]);", text, re.M)
    if not m or "../firmware/" + name not in json.loads(m.group(1)):
        out.append((sw, f"FILES does not keep ../firmware/{name}"))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("binary", type=Path)
    ap.add_argument("--site", type=Path, default=Path("docs"))
    a = ap.parse_args()
    found = problems(a.binary, a.site)
    for where, msg in found:
        print(f"::error file={where}::{msg}")
    if found:
        print(f"Rebuild the site: python3 web/make_site.py build/felucca-VER.fwsc VER {a.site}", file=sys.stderr)
        return 1
    print(f"{a.site}/ is built for {a.binary.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
