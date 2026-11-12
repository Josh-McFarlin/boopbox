#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p build
exec 9>build/.build.lock
flock -x 9
npm ci --no-audit --no-fund
BOOPBOX_BUILD_LOCK_HELD=1 npm run build
