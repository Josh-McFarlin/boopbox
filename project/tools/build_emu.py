#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Compile the BoopBox emulator for the browser: the whole firmware (UI, sequencer, sound, storage) as WebAssembly
(firmware/host/emu.c), run by the site's emulator page (web/src/pages/Emulator/, 1.8, after JIANT FM's emulator).

python3 tools/build_emu.py [--trainer]
Writes build/emu/boopbox-emu.wasm (with --trainer: build/emu/boopbox-trainer-emu.wasm, BoopBox Trainer: the lessons,
three sample sets fewer, its generated headers in build/emu/trainer-gen/) (the Vite dev server serves it at /emu/: cd ../web && npm run dev from project/; web/make_site.py
puts it in the site). Needs clang with the wasm32 target and wasm-ld (lld),
or Emscripten. No JieLi SDK, Docker or FM-1.
"""
from pathlib import Path
import glob
import os
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / 'build/gen'
OUT = ROOT / 'build/emu'
EXPORTS = ['init', 'boot', 'render', 'frames', 'rate', 'screen', 'screen_n', 'leds', 'led', 'flash', 'flash_size',
           'flash_dirty', 'room_capture', 'room_project_ptr', 'room_engine', 'room_preset', 'room_param', 'room_tempo',
           'room_playing', 'room_selected_track', 'room_note', 'key', 'button', 'knob', 'master']
GENERATED = [('gen_tables.py', 'felucca_tables.h'), ('gen_samples.py', 'felucca_samples.h'),
             ('gen_drumkits.py', 'felucca_drumkits.h'), ('gen_fm6_patches.py', 'felucca_fm6.h'),
             ('gen_obv.py', 'felucca_obv.h'), ('gen_font.py', 'felucca_font.h'), ('gen_icons.py', 'felucca_icons.h'),
             ('gen_logo.py', 'boopbox_logo.h')]


def main():
    global GEN
    trainer = '--trainer' in sys.argv[1:]
    if trainer:                                   # (gen_samples.py and lessons.py read it; its own headers)
        os.environ['FELUCCA_TRAINER'] = '1'
        GEN = OUT / 'trainer-gen'
    emcc = shutil.which('emcc')
    if not emcc and not (shutil.which('clang') and shutil.which('wasm-ld')):
        sys.exit('Install clang and lld (wasm-ld), or Emscripten (macOS: brew install emscripten).')
    GEN.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for script, header in GENERATED:              # (the firmware build's generated headers, if not there yet)
        if not (GEN / header).exists():
            subprocess.run([sys.executable, str(ROOT / 'tools' / script), str(GEN / header)], cwd=ROOT, check=True)
    if trainer:                                   # the lessons, from the approved songs (tools/build.py's)
        subprocess.run([sys.executable, str(ROOT / 'tools/trainer/lessons.py'), str(GEN / 'trainer_lessons.h')],
                       cwd=ROOT, check=True)
    src = str(ROOT / 'firmware/host/emu.c')
    wasm = OUT / ('boopbox-trainer-emu.wasm' if trainer else 'boopbox-emu.wasm')
    flags = ['-O2', *(['-DFELUCCA_TRAINER=1'] if trainer else []), '-fwrapv', '-fno-strict-aliasing', '-w', '-I' + str(GEN), '-I' + str(ROOT / 'firmware/src')]
    if not emcc:                                  # clang + wasm-ld, freestanding, with tools/wasm_shim
        clang = shutil.which('clang')
        resource_args = []
        if clang and 'clang-wrapper' in clang:
            version = re.search(r'clang version ([0-9.]+)', subprocess.check_output(
                [clang, '--version'], text=True)).group(1)
            raw = sorted(path for path in glob.glob(f'/nix/store/*-clang-{version}/bin/clang')
                         if os.path.isfile(path))
            resources = sorted(path for path in glob.glob(f'/nix/store/*-clang-{version}-lib/lib/clang/*')
                               if os.path.isdir(path))
            if raw and resources:
                clang = raw[0]
                resource_args = ['-resource-dir', resources[0]]
        shim = ROOT / 'tools' / 'wasm_shim'
        mem = OUT / ('mem-trainer.o' if trainer else 'mem.o')
        subprocess.run([clang, '--target=wasm32'] + resource_args + ['-O2', '-fno-builtin', '-ffreestanding', '-c', str(shim / 'mem.c'),
                        '-o', str(mem)], cwd=ROOT, check=True)
        subprocess.run([clang, '--target=wasm32'] + resource_args + ['-ffreestanding', '-nostdlib', '-I' + str(shim)] + flags +
                       [src, str(mem), '-Wl,--no-entry', '-Wl,--export-memory', '-Wl,--initial-memory=33554432',
                        '-Wl,-z,stack-size=262144'] + ['-Wl,--export=emu_' + n for n in EXPORTS] + ['-o', str(wasm)],
                       cwd=ROOT, check=True)
        mem.unlink()
    else:
        subprocess.run(['emcc', src] + flags + ['--no-entry', '-sSTANDALONE_WASM=1', '-sFILESYSTEM=0',
                                                '-sINITIAL_MEMORY=33554432', '-sSTACK_SIZE=262144',
                                                '-sEXPORTED_FUNCTIONS=' + str(['_emu_' + n for n in EXPORTS]),
                                                '-o', str(wasm)], cwd=ROOT, check=True)
    print('Emulator built:', wasm, f'({wasm.stat().st_size} B)')


if __name__ == '__main__':
    main()
