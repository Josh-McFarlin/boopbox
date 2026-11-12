#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p build

if [[ "${BOOPBOX_BUILD_LOCK_HELD:-0}" != "1" ]]; then
  exec 9>build/.build.lock
  flock -x 9
fi

python3 tools/build_emu.py
python3 tools/build_emu.py --trainer
python3 tools/build_preview.py
npm --prefix web ci

shopt -s nullglob
packages=(firmware/releases/boopbox-[0-9]*.fwsc)
if ((${#packages[@]} == 0)); then
  echo "build-site: no release firmware package found in firmware/releases" >&2
  exit 1
fi
mapfile -t packages < <(printf '%s\n' "${packages[@]}" | sort -V)
package="${packages[${#packages[@]}-1]}"
version="${package##*/boopbox-}"
version="${version%.fwsc}"
trainer="firmware/releases/boopbox-trainer-${version}.fwsc"
trainer_args=()
if [[ -f "$trainer" ]]; then
  trainer_args=(--trainer "$trainer")
fi
python3 web/make_site.py "$package" "$version" build/replit-site "${trainer_args[@]}"
