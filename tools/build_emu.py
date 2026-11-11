#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Compile the BoopBox emulator for the browser: the whole firmware (UI, sequencer, sound, storage) as WebAssembly
(firmware/host/emu.c), run by the site's emulator page (web/src/emu/, 1.8, after JIANT FM's emulator).

python3 tools/build_emu.py
Writes build/emu/boopbox-emu.wasm (the Vite dev server serves it at /emu/: cd web && npm run dev; web/make_site.py
puts it in the site). Needs clang with the wasm32 target and wasm-ld (lld),
or Emscripten. No JieLi SDK, Docker or FM-1.
"""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / 'build/gen'
OUT = ROOT / 'build/emu'
EXPORTS = ['init', 'boot', 'render', 'frames', 'rate', 'screen', 'screen_n', 'leds', 'led', 'flash', 'flash_size',
           'flash_dirty', 'key', 'button', 'knob', 'master']
GENERATED = [('gen_tables.py', 'felucca_tables.h'), ('gen_samples.py', 'felucca_samples.h'),
             ('gen_drumkits.py', 'felucca_drumkits.h'), ('gen_fm6_patches.py', 'felucca_fm6.h'),
             ('gen_obv.py', 'felucca_obv.h'), ('gen_font.py', 'felucca_font.h'), ('gen_icon_art.py', 'felucca_icons.h'),
             ('gen_logo.py', 'boopbox_logo.h')]


def main():
    emcc = shutil.which('emcc')
    if not emcc and not (shutil.which('clang') and shutil.which('wasm-ld')):
        sys.exit('Install clang and lld (wasm-ld), or Emscripten (macOS: brew install emscripten).')
    GEN.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for script, header in GENERATED:              # (the firmware build's generated headers, if not there yet)
        if not (GEN / header).exists():
            subprocess.run([sys.executable, str(ROOT / 'tools' / script), str(GEN / header)], cwd=ROOT, check=True)
    src = str(ROOT / 'firmware/host/emu.c')
    wasm = OUT / 'boopbox-emu.wasm'
    flags = ['-O2', '-fwrapv', '-fno-strict-aliasing', '-w', '-I' + str(GEN), '-I' + str(ROOT / 'firmware/src')]
    if not emcc:                                  # clang + wasm-ld, freestanding, with tools/wasm_shim
        shim = ROOT / 'tools' / 'wasm_shim'
        mem = OUT / 'mem.o'
        subprocess.run(['clang', '--target=wasm32', '-O2', '-fno-builtin', '-ffreestanding', '-c', str(shim / 'mem.c'),
                        '-o', str(mem)], cwd=ROOT, check=True)
        subprocess.run(['clang', '--target=wasm32', '-ffreestanding', '-nostdlib', '-I' + str(shim)] + flags +
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
