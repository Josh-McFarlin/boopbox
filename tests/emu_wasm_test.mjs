// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The browser emulator's WebAssembly (tools/build_emu.py -> build/emu/boopbox-emu.wasm), as the page's worklet
// runs it: no imports; it powers on and draws; a key sounds; the screen changes with a button; it keeps up (faster
// than real time here). Run after python3 tools/build_emu.py (and --trainer): node tests/emu_wasm_test.mjs
import fs from "fs";
import config from "../shared/room-config.json" with { type: "json" };
let fails = 0, ran = 0;
/* the main firmware and BoopBox Trainer's (tools/build_emu.py --trainer), each when built */
for (const [name, wasm] of [["emu wasm", "build/emu/boopbox-emu.wasm"], ["trainer emu wasm", "build/emu/boopbox-trainer-emu.wasm"]]) {
  if (!fs.existsSync(wasm)) { console.log(`${name}: not built (python3 tools/build_emu.py${name.startsWith("trainer") ? " --trainer" : ""}): skipped`); continue; }
  ran++;
  const trainer = name.startsWith("trainer");
  const mod = new WebAssembly.Module(fs.readFileSync(wasm));
  const check = (ok, what) => { console.log(`${name}: ${what.padEnd(86 - name.length)} ${ok ? "ok" : "FAIL"}`); fails += !ok; };
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
  if (trainer) {                                  // (the first start: the level picker; SELECT turns its pages)
    e.emu_knob(0, 1); energy(600);
    check(screen().some((v, i) => v !== a[i]), "boots into the level picker, SELECT turns its page");
  } else {
    e.emu_button(2, 1); energy(100); e.emu_button(2, 0); energy(600);
    check(screen().some((v, i) => v !== a[i]), "ENV opens its page");
  }
  check(e.emu_led(7 + 14) >= 0 && e.emu_flash_size() === 1 << 20, "LEDs and the 1 MiB flash exported");
  if (!trainer) {
    const size = e.emu_room_capture();
    const project = new Uint8Array(e.memory.buffer, e.emu_room_project_ptr(), size);
    const projectSize = new DataView(project.buffer, project.byteOffset, project.byteLength).getUint32(4, true);
    check(size >= 12 && project[0] === 0x37 && project[1] === 0x4e && project[2] === 0x55 && project[3] === 0x46
      && projectSize === size, "room snapshot exports the current firmware project");
    check(e.emu_room_tempo() >= 40 && e.emu_room_tempo() <= 240
      && e.emu_room_selected_track() < 8 && e.emu_room_note(7) < 128,
    "room snapshot exports tempo, selected track, and mapped keyboard notes");
    check(e.emu_room_engine(0) < config.engineNames.length
      && e.emu_room_engine(3) === config.engineNames.length
      && config.shareableDrumKits.includes(e.emu_room_param(3, 63)),
    "room snapshot distinguishes synth voices from factory drum kits");
  }
  console.log(`${name}: ${speed.toFixed(1)}x real time`);
  check(speed > 2, "faster than real time");
}
if (!ran) process.exit(0);
console.log(fails ? "emu wasm: FAILED" : "emu wasm: all passed");
process.exit(fails ? 1 : 0);
