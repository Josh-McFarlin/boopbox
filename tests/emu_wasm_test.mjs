// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The browser emulator's WebAssembly (tools/build_emu.py -> build/emu/boopbox-emu.wasm), as the page's worklet
// runs it: no imports; it powers on and draws; a key sounds; the screen changes with a button; it keeps up (faster
// than real time here). Run after python3 tools/build_emu.py: node tests/emu_wasm_test.mjs
import fs from "fs";
const wasm = "build/emu/boopbox-emu.wasm";
if (!fs.existsSync(wasm)) { console.log("emu wasm: not built (python3 tools/build_emu.py): skipped"); process.exit(0); }
const mod = new WebAssembly.Module(fs.readFileSync(wasm));
let fails = 0;
const check = (ok, what) => { console.log(`emu wasm: ${what.padEnd(70)} ${ok ? "ok" : "FAIL"}`); fails += !ok; };
check(WebAssembly.Module.imports(mod).length === 0, "no imports (freestanding)");
const e = new WebAssembly.Instance(mod, {}).exports;
e.emu_init(); e.emu_boot();
const N = e.emu_frames(), screen = () => new Uint16Array(e.memory.buffer, e.emu_screen(), 240 * 240);
const energy = (blocks) => { let s = 0; for (let i = 0; i < blocks; i++) { const o = new Float32Array(e.memory.buffer, e.emu_render(), N * 2); for (const v of o) s += v * v; } return s; };
const t0 = performance.now();
energy(4000);
const speed = (4000 * N / e.emu_rate()) / ((performance.now() - t0) / 1000);
check(screen().some((v) => v), "powers on and draws");
check(energy(200) === 0, "silent at rest");
e.emu_key(7, 1, 100);
check(energy(300) > 1, "a key sounds");
e.emu_key(7, 0, 0); energy(2000);
const a = screen().slice();
e.emu_button(2, 1); energy(100); e.emu_button(2, 0); energy(600);
check(screen().some((v, i) => v !== a[i]), "ENV opens its page");
check(e.emu_led(7 + 14) >= 0 && e.emu_flash_size() === 1 << 20, "LEDs and the 1 MiB flash exported");
console.log(`emu wasm: ${speed.toFixed(1)}x real time`);
check(speed > 2, "faster than real time");
console.log(fails ? "emu wasm: FAILED" : "emu wasm: all passed");
process.exit(fails ? 1 : 0);
