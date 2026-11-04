#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""SLOOP 2.6: the offline editor (web/make_site.py offline_editor): one file that needs nothing next to it; and the
site without internet (webapp/sw.js, the manifest): what sw.js keeps is all there and all it needs."""
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "web"))
import make_site  # noqa: E402

src = (ROOT / "web" / "editor.html").read_text(encoding="utf-8")
off = make_site.offline_editor(src)
bad = 0


def check(what, ok):
    global bad
    print(f"site: {what:<70} {'ok' if ok else 'FAIL'}")
    bad += not ok


check("the editor links the offline file (download)", src.count('download="boopbox-editor.html"') == 1)
check("the installer page links it too",
      (ROOT / "web" / "index_pkg.html").read_text(encoding="utf-8").count('href="../editor/boopbox-editor.html"') == 1)
check("offline: the icon font inlined", 'url("fukiai.ttf")' not in off and "font/ttf;base64," in off)
check("offline: no download link to itself", "<!--DL-->" not in off and 'id="offline"' not in off)
check("offline: the installer and the font licence online",
      'href="../installer/"' not in off and make_site.ONLINE + "webapp/installer/" in off
      and 'href="FUKIAI-LICENSE.txt"' not in off)
rel = [m for m in re.findall(r'(?:src|href)="([^"#]+)"', off) if not re.match(r"(https?:|data:|mailto:)", m)]
check("offline: no other file next to it (no relative src / href)", not rel)
check("offline: no url() to a file", not re.search(r'url\((?!data:)["\']?[A-Za-z]', off))
check("offline: no app, no service worker (a file has no site)",
      "serviceWorker" not in off and "webmanifest" not in off and 'id="install"' not in off)

# the site without internet: a site made from any package (a fake one with the identity make_site checks)
tmp = Path(tempfile.mkdtemp())
try:
    pkg = bytearray(4096)
    for i, ch in enumerate("FM-1_900"):
        pkg[i * make_site.BLK + make_site.KEEP] = (ord(ch) + i + 1) & 0xFF
    for i in range(8, make_site.BLOCKS):
        pkg[i * make_site.BLK + make_site.KEEP] = 0x7D
    pkg[2000:2016] = b"FELUCCA-LOADER-1"
    (tmp / "p.fwsc").write_bytes(bytes(pkg))
    make_site.main(tmp / "p.fwsc", "9.9", tmp / "site")
    app = tmp / "site" / "webapp"
    sw = (app / "sw.js").read_text(encoding="utf-8")
    files = json.loads(re.search(r"const FILES = (\[.*?\]);", sw).group(1))
    path = lambda f: (app / f / "index.html") if f.endswith("/") else (app / f)   # noqa: E731
    check("sw.js: stamped with the version", 'const STAMP = "9.9-' in sw and "/*" + "FILES*/" not in sw)
    check("sw.js keeps the installer, the editor, its font, the firmware",
          {"installer/", "editor/", "editor/fukiai.ttf", "../firmware/boopbox-9.9.fwsc"} <= set(files))
    check("sw.js: every file it keeps is in the site", all(path(f).is_file() for f in files))
    m = json.loads((app / "boopbox.webmanifest").read_text(encoding="utf-8"))
    check("manifest: standalone, starts at the editor, icons 192 and 512 (+ maskable)",
          m["display"] == "standalone" and m["start_url"] == "editor/" and
          {i["sizes"] for i in m["icons"]} == {"192x192", "512x512"} and
          any(i.get("purpose") == "maskable" for i in m["icons"]) and
          all((app / i["src"]).is_file() for i in m["icons"]))
    for page in ("editor", "installer"):
        h = (app / page / "index.html").read_text(encoding="utf-8")
        check(f"{page}: links the manifest, registers ../sw.js, an install button",
              'href="../boopbox.webmanifest"' in h and 'register("../sw.js")' in h and "beforeinstallprompt" in h)
    stamp = sw.split('const STAMP = "')[1].split('"')[0]
    (tmp / "site2").mkdir()
    make_site.main(tmp / "p.fwsc", "9.9", tmp / "site2")
    same = (tmp / "site2" / "webapp" / "sw.js").read_text(encoding="utf-8").split('const STAMP = "')[1].split('"')[0]
    pkg[3000] ^= 1
    (tmp / "p.fwsc").write_bytes(bytes(pkg))
    make_site.main(tmp / "p.fwsc", "9.9", tmp / "site2")
    other = (tmp / "site2" / "webapp" / "sw.js").read_text(encoding="utf-8").split('const STAMP = "')[1].split('"')[0]
    check("sw.js: the same site, the same stamp; a file changed, a new one", stamp == same and stamp != other)
    # BoopBox Trainer as the installer's second choice (make_site.py --trainer): its package in firmware/, its version,
    # path and SHA-256 in the installer's meta, kept offline; tools/check_site.py accepts the site with both
    (tmp / "t.fwsc").write_bytes(bytes(pkg[:4000]) + b"trainer" + bytes(pkg[4007:]))
    make_site.main(tmp / "p.fwsc", "9.9", tmp / "site3", trainer=tmp / "t.fwsc")
    inst = (tmp / "site3" / "webapp" / "installer" / "index.html").read_text(encoding="utf-8")
    meta = json.loads(re.search(r"^const meta = (\{.*\});$", inst, re.M).group(1))
    sw3 = (tmp / "site3" / "webapp" / "sw.js").read_text(encoding="utf-8")
    import hashlib
    sys.path.insert(0, str(ROOT / "tools"))
    import check_site
    check("trainer: its package beside BoopBox's, in the installer's meta (version, path, SHA-256), kept offline",
          (tmp / "site3" / "firmware" / "boopbox-trainer-9.9.fwsc").is_file() and
          meta["trainer"]["pkg"] == "../../firmware/boopbox-trainer-9.9.fwsc" and meta["trainer"]["version"] == "9.9" and
          meta["trainer"]["sha256"] == hashlib.sha256((tmp / "t.fwsc").read_bytes()).hexdigest() and
          "../firmware/boopbox-trainer-9.9.fwsc" in sw3 and 'id="pick"' in inst)
    check("trainer: tools/check_site.py passes the site with both packages, fails it with the trainer's changed",
          not check_site.problems(tmp / "site3" / "firmware" / "boopbox-9.9.fwsc", tmp / "site3") and
          ((tmp / "site3" / "firmware" / "boopbox-trainer-9.9.fwsc").write_bytes(b"x") or True) and
          bool(check_site.problems(tmp / "site3" / "firmware" / "boopbox-9.9.fwsc", tmp / "site3")))
    make_site.main(tmp / "p.fwsc", "9.9", tmp / "site3")
    check("trainer: a site made without it again leaves no trainer package or choice",
          not (tmp / "site3" / "firmware" / "boopbox-trainer-9.9.fwsc").exists() and
          "trainer" not in json.loads(re.search(r"^const meta = (\{.*\});$", (tmp / "site3" / "webapp" / "installer" /
                                                 "index.html").read_text(encoding="utf-8"), re.M).group(1)))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("site:", "FAILED" if bad else "offline editor and offline site test passed")
sys.exit(1 if bad else 0)
