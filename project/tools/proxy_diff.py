#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The functions and objects whose size changed between two proxy builds (tools/proxy_size.py --obj).

  tools/proxy_diff.py OLD.o NEW.o [N]"""
import subprocess
import sys


def syms(o):
    out = subprocess.run(["llvm-nm", "-S", "--size-sort", o], capture_output=True, text=True, check=True).stdout
    d = {}
    for ln in out.splitlines():
        p = ln.split()
        if len(p) == 4:
            d[p[3]] = d.get(p[3], 0) + int(p[1], 16)
    return d


a, b = syms(sys.argv[1]), syms(sys.argv[2])
n = int(sys.argv[3]) if len(sys.argv) > 3 else 40
rows = sorted(((b.get(k, 0) - a.get(k, 0), k) for k in set(a) | set(b)), key=lambda r: -abs(r[0]))
for dlt, k in rows[:n]:
    if dlt:
        print(f"{dlt:+7d} {b.get(k, 0):7d} {k}")
print(f"total {sum(b.values()) - sum(a.values()):+d}")
