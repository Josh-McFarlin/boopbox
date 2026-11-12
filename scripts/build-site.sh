#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p build

if [[ "${BOOPBOX_BUILD_LOCK_HELD:-0}" != "1" ]]; then
  exec 9>build/.build.lock
  flock -x 9
fi

python3 tools/build_emu.py
npm --prefix web ci
npm --prefix web run build
cp build/emu/boopbox-emu.wasm build/webapp-vite/emu/boopbox-emu.wasm
