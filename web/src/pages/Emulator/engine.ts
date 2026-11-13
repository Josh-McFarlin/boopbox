// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator's engine: the firmware runs in emu-worklet.js (an AudioWorklet), with
// boopbox-emu.wasm (project/tools/build_emu.py). The flash (projects, songs, presets, settings) is kept in this browser
// (IndexedDB) between visits. No React here: Emulator.jsx draws the panel and calls these.
export const BUTTONS = ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO", "HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC", "OCT-", "OCT+"];
export const B: Record<string, number> = Object.fromEntries(BUTTONS.map((n, i) => [n, i]));
export const KNOBS: [name: string, encoder: number][] = [["SELECT", 0], ["ALGORITHM", 1], ["PRESETS", 2], ["K1", 3], ["K2", 4], ["K3", 5], ["K4", 6]];
export const NOTE = ["F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E"];
export const BLACK = (k: number) => [1, 3, 5, 8, 10].includes(k % 12);
export const NKEYS = 27;
const FS = 44100;

/* the two firmwares the page runs (project/tools/build_emu.py, with --trainer for the second), each with its own flash kept in
   this browser: their sample sets differ, so one's projects are not the other's */
/* a firmware the page runs: its name, its WebAssembly, its flash's key in IndexedDB, the flash's download name */
export interface Firmware {
  label: string;
  wasm: string;
  key: string;
  file: string;
}
export type FirmwareId = "main" | "trainer";

export const FIRMWARE: Record<FirmwareId, Firmware> = {
  main: { label: "BoopBox", wasm: "boopbox-emu.wasm", key: "fm1", file: "boopbox-emulator-flash.bin" },
  trainer: { label: "BoopBox Trainer", wasm: "boopbox-trainer-emu.wasm", key: "fm1-trainer",
             file: "boopbox-trainer-emulator-flash.bin" },
};
/* the firmware asked for in the address (?fw=trainer), else the main one */
export function firmwareFromUrl(): FirmwareId {
  const f = new URLSearchParams(location.search).get("fw");
  return f !== null && f in FIRMWARE ? (f as FirmwareId) : "main";
}
/* whether this site has the firmware's WebAssembly (the trainer's is optional in make_site.py) */
export async function hasFirmware(fw: FirmwareId): Promise<boolean> {
  try { return (await fetch(FIRMWARE[fw].wasm, { method: "HEAD" })).ok; } catch { return false; }
}

// the computer's keyboard: two rows of notes (Z.. from F3, Q.. from B4), the transport and the knobs
export const KEYMAP: Record<string, number> = {};
["KeyZ", "KeyS", "KeyX", "KeyD", "KeyC", "KeyF", "KeyV", "KeyB", "KeyH", "KeyN", "KeyJ", "KeyM", "Comma", "KeyL", "Period",
 "Semicolon", "Slash", "Quote"].forEach((c, i) => (KEYMAP[c] = i));                          // F3 .. A#4
([["KeyQ", 18], ["KeyW", 19], ["Digit3", 20], ["KeyE", 21], ["Digit4", 22], ["KeyR", 23], ["KeyT", 24], ["Digit6", 25],
 ["KeyY", 26]] as [string, number][]).forEach(([c, k]) => (KEYMAP[c] = k));                                          // B4 .. G5
export const BTNMAP: Record<string, number> = { Space: B.PLAY, Enter: B.REC, BracketLeft: B["OCT-"], BracketRight: B["OCT+"], Escape: B.HOME,
                        Digit1: B.FX, Digit2: B.SEL, Digit5: B.ENV, Digit7: B.LFO, Digit8: B.EDIT, Digit9: B.GLO,
                        Digit0: B.SAVE, Minus: B.ARP, Equal: B.SEQ };
export const KNOBMAP: Record<string, [encoder: number, step: number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 1], ArrowLeft: [1, -1], PageUp: [2, 1], PageDown: [2, -1] };

// ---- the flash, kept in this browser
function db(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    const r = indexedDB.open("boopbox-emu", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("flash");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
export async function flashLoad(fw: FirmwareId = "main"): Promise<ArrayBuffer | null> {
  try {
    const d = await db();
    return await new Promise<ArrayBuffer | null>((ok) => {
      const g = d.transaction("flash").objectStore("flash").get(FIRMWARE[fw].key);
      g.onsuccess = () => ok(g.result || null);
      g.onerror = () => ok(null);
    });
  } catch { return null; }
}
/* -> the line to show under the panel */
export async function flashSave(buf: ArrayBuffer, fw: FirmwareId = "main"): Promise<string> {
  try {
    const d = await db();
    d.transaction("flash", "readwrite").objectStore("flash").put(buf, FIRMWARE[fw].key);
    return "Saved in this browser " + new Date().toLocaleTimeString();
  } catch { return "This browser does not keep data: nothing is saved between visits"; }
}
export async function flashErase(fw: FirmwareId = "main"): Promise<void> {
  try { const d = await db(); d.transaction("flash", "readwrite").objectStore("flash").delete(FIRMWARE[fw].key); } catch { /* nothing kept */ }
}

export function download(buf: ArrayBuffer, fw: FirmwareId = "main") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
  a.download = FIRMWARE[fw].file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* the LCD's frame (RGB565, byte-swapped) into a 240x240 ImageData */
export function drawScreen(g: CanvasRenderingContext2D, img: ImageData, buf: ArrayBuffer) {
  const px = new Uint16Array(buf), d = img.data;
  for (let i = 0; i < 240 * 240; i++) {
    const v = px[i], c = ((v & 0xff) << 8) | (v >> 8);   // (the LCD's byte order)
    d[i * 4] = (c >> 11) << 3; d[i * 4 + 1] = ((c >> 5) & 63) << 2; d[i * 4 + 2] = (c & 31) << 3; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

/* power on: the worklet with the firmware fw (FIRMWARE's key) and its flash; on(message) gets its messages.
   -> {node, ctx, flash} */
/* a message from the worklet: t is its kind (screen, leds, flash, room-note, room-snapshot, room-snapshot-error) */
export type EmuMessage = { t: string; [field: string]: any };

export async function powerOn(onMessage: (data: EmuMessage) => void, fw: FirmwareId = "main", { roomMode = false } = {}):
  Promise<{ node: AudioWorkletNode; ctx: AudioContext; flash: ArrayBuffer | null }> {
  const ctx = new AudioContext({ sampleRate: FS, latencyHint: "interactive" });
  // Resume immediately while the Power On click/tap still carries user activation
  // (not after the firmware and worklet have finished loading).
  const resumed = ctx.resume();
  const [module, flash] = await Promise.all([
    fetch(FIRMWARE[fw].wasm).then((r) => { if (!r.ok) throw new Error(FIRMWARE[fw].wasm + ": " + r.status); return r.arrayBuffer(); })
      .then((b) => WebAssembly.compile(b)),
    flashLoad(fw),
    ctx.audioWorklet.addModule("emu-worklet.js"),
  ]);
  const node = new AudioWorkletNode(ctx, "boopbox-emu", { numberOfInputs: 0, outputChannelCount: [2],
                                                          processorOptions: { module, flash, roomMode } });
  node.port.onmessage = ({ data }) => onMessage(data);
  node.connect(ctx.destination);
  await resumed;
  return { node, ctx, flash };
}
