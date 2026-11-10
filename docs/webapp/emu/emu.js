// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator page: the FM-1 drawn, its screen, LEDs, keys, buttons and knobs, played with the mouse,
// a touch screen or the computer's keyboard; the firmware itself runs in emu-worklet.js. The flash (projects, songs,
// presets, settings) is kept in this browser (IndexedDB) between visits.
const $ = (id) => document.getElementById(id);
const BUTTONS = ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO", "HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC", "OCT-", "OCT+"];
const B = Object.fromEntries(BUTTONS.map((n, i) => [n, i]));
const KNOBS = [["SELECT", 0], ["ALGORITHM", 1], ["PRESETS", 2], ["K1", 3], ["K2", 4], ["K3", 5], ["K4", 6]];
const NOTE = ["F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E"];
const BLACK = (k) => [1, 3, 5, 8, 10].includes(k % 12);
const FS = 44100;

// the computer's keyboard: two rows of notes (Z.. from F3, Q.. from B4), the transport and the knobs
const KEYMAP = {};
["KeyZ", "KeyS", "KeyX", "KeyD", "KeyC", "KeyF", "KeyV", "KeyB", "KeyH", "KeyN", "KeyJ", "KeyM", "Comma", "KeyL", "Period",
 "Semicolon", "Slash", "Quote"].forEach((c, i) => (KEYMAP[c] = i));                          // F3 .. A#4
[["KeyQ", 18], ["KeyW", 19], ["Digit3", 20], ["KeyE", 21], ["Digit4", 22], ["KeyR", 23], ["KeyT", 24], ["Digit6", 25],
 ["KeyY", 26]].forEach(([c, k]) => (KEYMAP[c] = k));                                          // B4 .. G5
const BTNMAP = { Space: B.PLAY, Enter: B.REC, BracketLeft: B["OCT-"], BracketRight: B["OCT+"], Escape: B.HOME,
                 Digit1: B.FX, Digit2: B.SEL, Digit5: B.ENV, Digit7: B.LFO, Digit8: B.EDIT, Digit9: B.GLO,
                 Digit0: B.SAVE, Minus: B.ARP, Equal: B.SEQ };
const KNOBMAP = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 1], ArrowLeft: [1, -1], PageUp: [2, 1], PageDown: [2, -1] };

let node = null, ctx = null, latched = new Set(), held = new Set();
const send = (m) => node && node.port.postMessage(m);

// ---- the flash, kept in this browser
function db() {
  return new Promise((ok, no) => {
    const r = indexedDB.open("boopbox-emu", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("flash");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function flashLoad() {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const g = d.transaction("flash").objectStore("flash").get("fm1");
      g.onsuccess = () => ok(g.result || null);
      g.onerror = () => ok(null);
    });
  } catch { return null; }
}
async function flashSave(buf) {
  try {
    const d = await db();
    d.transaction("flash", "readwrite").objectStore("flash").put(buf, "fm1");
    $("saved").textContent = "Saved in this browser " + new Date().toLocaleTimeString();
  } catch { $("saved").textContent = "This browser does not keep data: nothing is saved between visits"; }
}
async function flashErase() {
  try { const d = await db(); d.transaction("flash", "readwrite").objectStore("flash").delete("fm1"); } catch {}
}

// ---- the panel
function buildPanel() {
  const btns = $("buttons");
  for (const name of BUTTONS.slice(0, 12)) btns.append(makeButton(name));
  $("octs").append(makeButton("OCT-"), makeButton("OCT+"));
  for (const [name, e] of KNOBS) (e >= 3 ? $("knobs4") : $("knobs3")).append(makeKnob(name, e));
  const kb = $("keys");
  let white = 0;
  for (let k = 0; k < 27; k++) if (!BLACK(k)) white++;
  let wi = 0;
  for (let k = 0; k < 27; k++) {
    const el = document.createElement("button");
    el.className = "key " + (BLACK(k) ? "black" : "white");
    el.dataset.k = k;
    el.setAttribute("aria-label", NOTE[k % 12] + (3 + Math.floor((k + 5) / 12)));
    if (BLACK(k)) el.style.left = `calc(${(wi / white) * 100}% - var(--bw) / 2)`;
    else wi++;
    keyEvents(el, k);
    kb.append(el);
  }
  kb.style.setProperty("--n", white);
}
function makeButton(name) {
  const el = document.createElement("button");
  el.className = "btn";
  el.dataset.b = B[name];
  el.innerHTML = `<i></i><span>${name}</span>`;
  el.title = `${name}: hold for its layer; Shift-click keeps it held`;
  const down = (ev) => {
    ev.preventDefault();
    const b = B[name];
    if (ev.shiftKey) {                                  // latched: held until clicked again
      if (latched.has(b)) { latched.delete(b); send({ t: "button", b, down: false }); el.classList.remove("held"); }
      else { latched.add(b); send({ t: "button", b, down: true }); el.classList.add("held"); }
      return;
    }
    if (latched.has(b)) { latched.delete(b); el.classList.remove("held"); }
    el.setPointerCapture?.(ev.pointerId);
    send({ t: "button", b, down: true });
    el.classList.add("down");
  };
  const up = () => {
    const b = B[name];
    if (!el.classList.contains("down")) return;
    el.classList.remove("down");
    if (!latched.has(b)) send({ t: "button", b, down: false });
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return el;
}
function makeKnob(name, e) {
  const wrap = document.createElement("div");
  wrap.className = "knob k" + e;
  wrap.innerHTML = `<div class="cap" tabindex="0" role="slider" aria-label="${name}"><b></b></div><span>${name}</span>`;
  const cap = wrap.firstChild;
  let angle = 0, y0 = null, acc = 0;
  const turn = (s) => {
    if (!s) return;
    angle += s * 18;
    cap.style.setProperty("--a", angle + "deg");
    send({ t: "knob", e, s });
  };
  cap.addEventListener("wheel", (ev) => { ev.preventDefault(); turn(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
  cap.addEventListener("pointerdown", (ev) => { y0 = ev.clientY; acc = 0; cap.setPointerCapture(ev.pointerId); });
  cap.addEventListener("pointermove", (ev) => {
    if (y0 === null) return;
    acc += y0 - ev.clientY;
    y0 = ev.clientY;
    while (Math.abs(acc) >= 10) { const s = Math.sign(acc); turn(s); acc -= s * 10; }
  });
  const end = () => (y0 = null);
  cap.addEventListener("pointerup", end);
  cap.addEventListener("pointercancel", end);
  cap.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") { turn(1); ev.preventDefault(); ev.stopPropagation(); }
    if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") { turn(-1); ev.preventDefault(); ev.stopPropagation(); }
  });
  return wrap;
}
function keyEvents(el, k) {
  const down = (ev) => {
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const vel = Math.max(1, Math.min(127, Math.round(20 + 107 * ((ev.clientY - r.top) / r.height))));   // lower: harder
    el.setPointerCapture?.(ev.pointerId);
    noteOn(k, vel);
  };
  const up = () => noteOff(k);
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
function noteOn(k, vel) {
  if (held.has(k)) return;
  held.add(k);
  send({ t: "key", k, down: true, vel });
  document.querySelector(`.key[data-k="${k}"]`)?.classList.add("down");
}
function noteOff(k) {
  if (!held.delete(k)) return;
  send({ t: "key", k, down: false });
  document.querySelector(`.key[data-k="${k}"]`)?.classList.remove("down");
}

// ---- the screen and the LEDs
const canvas = $("screen"), g = canvas.getContext("2d"), img = g.createImageData(240, 240);
function drawScreen(buf) {
  const px = new Uint16Array(buf), d = img.data;
  for (let i = 0; i < 240 * 240; i++) {
    const v = px[i], c = ((v & 0xff) << 8) | (v >> 8);   // (the LCD's byte order)
    d[i * 4] = (c >> 11) << 3; d[i * 4 + 1] = ((c >> 5) & 63) << 2; d[i * 4 + 2] = (c & 31) << 3; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function drawLeds(s) {
  document.querySelectorAll(".btn").forEach((el) => (el.dataset.led = s[+el.dataset.b]));
  document.querySelectorAll(".key").forEach((el) => (el.dataset.led = s[14 + +el.dataset.k]));
}

// ---- power on
async function powerOn() {
  $("power").disabled = true;
  $("power").textContent = "Starting…";
  try {
    ctx = new AudioContext({ sampleRate: FS, latencyHint: "interactive" });
    const [module, flash] = await Promise.all([
      fetch("boopbox-emu.wasm").then((r) => { if (!r.ok) throw new Error("boopbox-emu.wasm: " + r.status); return r.arrayBuffer(); })
        .then((b) => WebAssembly.compile(b)),
      flashLoad(),
      ctx.audioWorklet.addModule("emu-worklet.js"),
    ]);
    node = new AudioWorkletNode(ctx, "boopbox-emu", { numberOfInputs: 0, outputChannelCount: [2],
                                                       processorOptions: { module, flash } });
    node.onprocessorerror = () => { $("saved").textContent = "The emulator stopped. Reload the page to start it again."; };
    node.port.onmessage = ({ data }) => {
      if (data.t === "screen") drawScreen(data.px);
      else if (data.t === "leds") drawLeds(data.leds);
      else if (data.t === "flash") {
        if (data.ask) download(data.flash);
        else flashSave(data.flash);
      }
    };
    node.connect(ctx.destination);
    await ctx.resume();
    $("cover").hidden = true;
    send({ t: "master", v: +$("master").value });
    $("saved").textContent = flash ? "Your projects from last time are back" : "Nothing saved yet: your work is kept in this browser";
  } catch (err) {
    $("power").disabled = false;
    $("power").textContent = "Power on";
    $("saved").textContent = "Could not start: " + (err.message || err) + ". Try Chrome, Edge, Firefox or Safari.";
  }
}
function download(buf) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
  a.download = "boopbox-emulator-flash.bin";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener("keydown", (ev) => {
  if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey || !node) return;
  if (ev.target.closest?.("input, .cap")) return;
  if (ev.code in KEYMAP) { noteOn(KEYMAP[ev.code], ev.shiftKey ? 127 : 100); ev.preventDefault(); }
  else if (ev.code in BTNMAP) { send({ t: "button", b: BTNMAP[ev.code], down: true }); ev.preventDefault(); }
  else if (ev.code in KNOBMAP) { const [e, s] = KNOBMAP[ev.code]; send({ t: "knob", e, s }); ev.preventDefault(); }
});
document.addEventListener("keyup", (ev) => {
  if (!node) return;
  if (ev.code in KEYMAP) noteOff(KEYMAP[ev.code]);
  else if (ev.code in BTNMAP && !latched.has(BTNMAP[ev.code])) send({ t: "button", b: BTNMAP[ev.code], down: false });
});
window.addEventListener("blur", () => { for (const k of [...held]) noteOff(k); });
$("master").addEventListener("input", (ev) => send({ t: "master", v: +ev.target.value }));
$("power").addEventListener("click", powerOn);
$("dl").addEventListener("click", () => send({ t: "flash" }));
$("erase").addEventListener("click", async () => {
  if (!confirm("Erase everything this emulator saved in this browser (projects, songs, presets, settings)?")) return;
  await flashErase();
  location.reload();
});
buildPanel();
g.fillStyle = "#000"; g.fillRect(0, 0, 240, 240);
