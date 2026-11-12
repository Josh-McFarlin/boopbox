#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
"""Make the site (GitHub Pages):

  index.html                  the home page (webapp/home/index.html with <base href="webapp/home/">): what BoopBox is
  firmware/boopbox-VER.fwsc   the package
  firmware/boopbox-trainer-VER.fwsc  with --trainer: BoopBox Trainer's package (tools/build.py --trainer), offered as a
                              second choice in the installer
  webapp/home/, webapp/installer/, webapp/editor/, webapp/emu/, webapp/assets/
                              the React pages (web/site/, web/src/), built by Vite (npm run build, into
                              build/webapp-vite/); the installer's meta (the package, its version and SHA-256) and the
                              editor's version are written into their index.html here
  webapp/emu/                 (1.8) the browser emulator: only with build/emu/boopbox-emu.wasm (tools/build_emu.py);
                              BoopBox Trainer's too, to switch to, with build/emu/boopbox-trainer-emu.wasm
                              (tools/build_emu.py --trainer)
  webapp/editor/boopbox-editor.html  the editor in one file, for offline use (SLOOP 2.6; npm run build:offline): its
                              fonts and scripts inlined, its links to the installer and the font licence online;
                              opened from the disk in Chrome / Edge (file:// is a secure context: Web MIDI asks for
                              permission)
  webapp/sw.js, webapp/boopbox.webmanifest, webapp/icon-*.png  the site without internet (SLOOP 2.6): an app to
                              install; opened once online, the installer, the editor and the firmware are kept
                              by the browser and work offline, still on https (on Android a downloaded file opens
                              as content://, where Chrome refuses Web MIDI)
  src/                        not touched

  web/make_site.py build/felucca-X.Y.fwsc X.Y OUT_DIR [--beta] [--trainer build/trainer-fw/felucca-trainer-X.Y.fwsc]
  (--beta: web/beta_banner.html at the top of the installer: the beta channel, docs/beta)
  Needs Node.js: the pages are built with npm (npm ci in web/ the first time).

The package identity (FM-1_9xx) is read from the package; the device reports it
after the install.
"""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


BUILD = HERE.parent / "build"
_built = False


def build_pages():
    """the React pages with Vite: build/webapp-vite/ (the site's webapp/) and build/webapp-offline/editor/index.html
    (the editor in one file); once per run"""
    global _built
    if _built:
        return
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        raise SystemExit("make_site: Node.js (npm) is needed to build the pages")
    if not (HERE / "node_modules").is_dir():
        subprocess.run([npm, "ci"], cwd=HERE, check=True)
    for script in ("build", "build:offline"):
        subprocess.run([npm, "run", "--silent", script], cwd=HERE, check=True, stdout=subprocess.DEVNULL)
    _built = True


def emu_page(emu):
    """(1.8) webapp/emu: the browser emulator (its page from Vite, build/emu/boopbox-emu.wasm from tools/build_emu.py);
    without its wasm none at all, never an old one"""
    wasm = BUILD / "emu" / "boopbox-emu.wasm"
    if not wasm.exists():
        if emu.exists():
            shutil.rmtree(emu)
        print("site: no emulator (python3 tools/build_emu.py first)")
        return
    shutil.copy(wasm, emu / wasm.name)
    trainer = BUILD / "emu" / "boopbox-trainer-emu.wasm"   # (the page offers it when it is there)
    if trainer.exists():
        shutil.copy(trainer, emu / trainer.name)
    else:
        print("site: no trainer in the emulator (python3 tools/build_emu.py --trainer first)")


def offline_editor(html, version):
    """the one-file editor (Vite's offline build: fonts and scripts inlined) for the disk: no app to install, no copy
    kept (a file has no site around it), its version for the download name"""
    html, n = re.subn(r"<!--PWA-->.*?<!--/PWA-->", "", html, flags=re.S)
    if n != 1:
        raise SystemExit("the offline editor must contain <!--PWA-->...<!--/PWA--> once; update make_site.py")
    return set_version(html, version)


def set_version(html, version):
    if html.count("/*VERSION*/null") != 1:
        raise SystemExit("the editor must contain /*VERSION*/null once; update make_site.py")
    return html.replace("/*VERSION*/null", json.dumps(version))


ICONS = ("icon-192.png", "icon-512.png", "icon-maskable-512.png")


def page_assets(app, page):
    """the built files a page needs (webapp/assets/...): its scripts, styles and fonts, and theirs, by name"""
    names = {f.name for f in (app / "assets").iterdir()} if (app / "assets").is_dir() else set()
    todo, seen = [app / page / "index.html"], set()
    while todo:
        text = todo.pop().read_text(encoding="utf-8", errors="replace")
        for n in set(re.findall(r"[\w.-]+\.(?:js|css|ttf|woff2?|svg|png)", text)) & names:
            if n not in seen:
                seen.add(n)
                if n.endswith((".js", ".css")):
                    todo.append(app / "assets" / n)
    return ["assets/" + n for n in sorted(seen)]


def app_files(out, version, fw_name, more=()):
    """webapp/: the manifest, the icons and sw.js with the list of what it keeps (relative to webapp/) and a
    stamp of their contents, so any change makes a new sw.js and the browser takes the new site"""
    app = out / "webapp"
    for f in ICONS:
        shutil.copy(HERE / f, app / f)
    manifest = {
        "name": "BoopBox", "short_name": "BoopBox", "id": "editor/", "start_url": "editor/", "scope": "./",
        "display": "standalone", "background_color": "#160d2b", "theme_color": "#160d2b",
        "description": "BoopBox for the M-VAVE FM-1: the editor and the installer, also without internet",
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
    }
    (app / "boopbox.webmanifest").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    keep = {"installer/": app / "installer" / "index.html", "editor/": app / "editor" / "index.html",
            "../firmware/" + fw_name: out / "firmware" / fw_name, "boopbox.webmanifest": app / "boopbox.webmanifest"}
    for f in more:                                   # (the trainer's package)
        keep["../firmware/" + f] = out / "firmware" / f
    for page in ("installer", "editor"):             # their scripts, styles and fonts
        for f in page_assets(app, page):
            keep[f] = app / f
    for f in ("FUKIAI-LICENSE.txt", "preview-worklet.js", "boopbox-preview.wasm"):
        if (app / "editor" / f).exists():
            keep["editor/" + f] = app / "editor" / f
    for f in ICONS:
        keep[f] = app / f
    h = hashlib.sha256()
    for k in sorted(keep):
        h.update(k.encode() + b"\0" + keep[k].read_bytes())
    sw = (HERE / "sw.js").read_text(encoding="utf-8")
    for mark in ("/*STAMP*/", "/*FILES*/[]"):
        if sw.count(mark) != 1:
            raise SystemExit(f"sw.js must contain {mark} once; update make_site.py")
    sw = sw.replace("/*STAMP*/", f"{version}-{h.hexdigest()[:12]}").replace("/*FILES*/[]", json.dumps(sorted(keep)))
    (app / "sw.js").write_text(sw, encoding="utf-8")
    return sorted(keep)
BLOCKS, BLK, KEEP = 20, 0x30, 0x2F


def product_of(raw):
    """the package identity: one marker byte after each of the first 20 blocks (fm1pkg.js productOf)"""
    return "".join(chr((m - i - 1) & 0xFF) for i in range(BLOCKS) if (m := raw[i * BLK + KEEP]) != 0x7D)


def check_pkg(pkg):
    raw = Path(pkg).read_bytes()
    product = product_of(raw)
    if not re.fullmatch(r"FM-1_9\d\d", product):
        raise SystemExit(f"{pkg}: identity {product!r} is not a Felucca package (FM-1_9xx)")
    if b"FELUCCA-LOADER-1" not in raw:              # marker of firmware/loader
        raise SystemExit(f"{pkg}: no Felucca update loader in it")
    return raw, product


def main(pkg, version, out, trainer=None):
    pkg, out = Path(pkg), Path(out)
    raw, product = check_pkg(pkg)
    name = f"boopbox-{re.sub(r'[^A-Za-z0-9.-]', '-', version)}.fwsc"
    meta = {"version": version, "product": product, "pkg": "../../firmware/" + name,
            "sha256": hashlib.sha256(raw).hexdigest()}   # the page checks the download against it
    tname = None
    if trainer:                                     # BoopBox Trainer: a second choice, the same version
        traw, tproduct = check_pkg(trainer)
        tname = f"boopbox-trainer-{re.sub(r'[^A-Za-z0-9.-]', '-', version)}.fwsc"
        meta["trainer"] = {"version": version, "product": tproduct, "pkg": "../../firmware/" + tname,
                           "sha256": hashlib.sha256(traw).hexdigest()}
    if "--beta" in sys.argv:                       # the beta channel (docs/beta): what it is, what it implies
        notes = HERE / "beta_banner.html"
        meta["banner"] = notes.read_text(encoding="utf-8") if notes.exists() else "<p><b>BETA</b></p>"

    build_pages()
    app, fw = out / "webapp", out / "firmware"
    for d in ("home", "installer", "editor", "emu", "assets", "song"):   # (song: the trainer's song page, gone in 1.9.1)
        if (app / d).exists():
            shutil.rmtree(app / d)
    shutil.copytree(BUILD / "webapp-vite", app, dirs_exist_ok=True)
    fw.mkdir(parents=True, exist_ok=True)

    inst = app / "installer" / "index.html"          # the package it installs (tools/check_site.py reads this line)
    html = inst.read_text(encoding="utf-8")
    if html.count("const meta = /*META*/null;") != 1:
        raise SystemExit("installer/index.html must contain 'const meta = /*META*/null;' once; update make_site.py")
    inst.write_text(html.replace("const meta = /*META*/null;", "const meta = " + json.dumps(meta) + ";"), encoding="utf-8")
    ed = app / "editor" / "index.html"
    ed.write_text(set_version(ed.read_text(encoding="utf-8"), version), encoding="utf-8")
    offline = (BUILD / "webapp-offline" / "editor" / "index.html").read_text(encoding="utf-8")
    (app / "editor" / "boopbox-editor.html").write_text(offline_editor(offline, version), encoding="utf-8")

    for old in list(fw.glob("felucca-*.fwsc")) + list(fw.glob("sloop-*.fwsc")) + list(fw.glob("boopbox-*.fwsc")):   # one package: the current one
        old.unlink()
    shutil.copy(pkg, fw / name)
    if tname:
        shutil.copy(trainer, fw / tname)
    dsp = BUILD / "preview" / "boopbox-preview.wasm"   # optional browser DSP, built separately without the hardware toolchain
    if dsp.exists():
        shutil.copy(dsp, app / "editor" / dsp.name)
    emu_page(app / "emu")
    app_files(out, version, name, (tname,) if tname else ())
    home = (app / "home" / "index.html").read_text(encoding="utf-8")   # the home page, at the root too: its links and
    if home.count("<head>") != 1:                                      # assets are relative to webapp/home/
        raise SystemExit("home/index.html must contain <head> once; update make_site.py")
    (out / "index.html").write_text(home.replace("<head>", '<head>\n<base href="webapp/home/">'), encoding="utf-8")
    print(f"site: {out}: webapp/installer, webapp/editor, firmware/{name} ({len(raw)} B, {product})"
          + (f", firmware/{tname}" if tname else ""))


if __name__ == "__main__":
    argv, trainer = sys.argv[1:], None
    if "--trainer" in argv:
        i = argv.index("--trainer")
        if i + 1 >= len(argv):
            sys.exit(__doc__)
        trainer = argv[i + 1]
        del argv[i:i + 2]
    args = [a for a in argv if a not in ("--studio-guide", "--beta")]
    if len(args) != 3:
        sys.exit(__doc__)
    main(*args, trainer=trainer)
