#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""An estimate of the firmware's code and RAM size without the JieLi toolchain.

  tools/proxy_size.py [--json] [--obj OUT.o]

Compiles firmware/src/felucca.c (the whole firmware: one unit) with the host clang for a stand-in 32-bit target
(RISC-V RV32IMC, -Os, the build's flags), the HAL's inline assembly emptied (the pi32v2 instructions do not exist
there), and reports the sizes of the sections: code (.text*), constants (.rodata*), RAM (.data* + .bss* + .sbss*,
+ the noinit / lowram sections apart). The numbers are NOT the FM-1's: another instruction set packs code
differently (pi32v2 code is typically of the same order), but the struct and array sizes are exact for a 32-bit
target, and the difference between two versions of the tree is a fair measure of what a change costs. The real
figures come from tools/build.py (`image ... B; RAM .data+.bss ... B of 98304`)."""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
ASM = re.compile(r'(\b(?:__asm__|asm)\s*(?:volatile\s*|__volatile__\s*)?\(\s*)((?:"(?:[^"\\]|\\.)*"\s*)+)')


def sections(obj):
    out = subprocess.run(["llvm-objdump", "-h", str(obj)], capture_output=True, text=True, check=True).stdout
    sizes = {}
    for ln in out.splitlines():
        m = re.match(r"\s*\d+\s+(\S+)\s+([0-9a-f]+)\s", ln)
        if m:
            sizes[m.group(1)] = sizes.get(m.group(1), 0) + int(m.group(2), 16)
    return sizes


def main():
    res = subprocess.run(["clang", "-print-resource-dir"], capture_output=True, text=True, check=True).stdout.strip()
    flags = ["--target=riscv32-unknown-elf", "-march=rv32imc", "-ffreestanding", "-nostdinc", "-isystem",
             res + "/include", "-w", "-I" + str(SRC / "firmware/hal"), "-I" + str(SRC / "firmware/src"),
             "-I" + str(SRC / "build/gen")]
    with tempfile.TemporaryDirectory() as d:
        pre = Path(d) / "felucca.i"
        subprocess.run(["clang", *flags, "-E", str(SRC / "firmware/src/felucca.c"), "-o", str(pre)], check=True)
        pre.write_text(ASM.sub(lambda m: m.group(1) + '""', pre.read_text()))
        obj = Path(d) / "felucca.o"
        subprocess.run(["clang", *flags, "-Os", "-ffunction-sections", "-fdata-sections", "-fno-builtin", "-c",
                        str(pre), "-o", str(obj)], check=True)
        s = sections(obj)
        if "--obj" in sys.argv:                     # keep the object (tools/proxy_diff.py compares two)
            import shutil
            shutil.copy(obj, sys.argv[sys.argv.index("--obj") + 1])
    code = sum(v for k, v in s.items() if k.startswith(".text"))
    ro = sum(v for k, v in s.items() if k.startswith(".rodata") or k.startswith(".srodata"))
    ram = sum(v for k, v in s.items() if re.match(r"\.(s?data|s?bss)", k))
    other = {k: v for k, v in s.items() if v and not re.match(r"\.(text|s?rodata|s?data|s?bss|comment|riscv|note|"
                                                               r"llvm|rela|group|symtab|strtab|shstrtab)", k)}
    r = {"code": code, "rodata": ro, "ram": ram, "other": other}
    if "--json" in sys.argv:
        print(json.dumps(r))
    else:
        print(f"proxy (RV32IMC -Os, not the FM-1's toolchain): code {code} B, constants {ro} B, RAM {ram} B")
        for k, v in sorted(other.items()):
            print(f"  {k}: {v} B")


if __name__ == "__main__":
    main()
