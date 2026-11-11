// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator page: the FM-1 drawn, its screen, LEDs, keys, buttons and knobs, played with the mouse,
// a touch screen or the computer's keyboard (engine.js runs the firmware).
import { useCallback, useEffect, useRef, useState } from "react";
import { Strip } from "../shared/Brand.jsx";
import {
  B, BLACK, BTNMAP, BUTTONS, KEYMAP, KNOBMAP, KNOBS, NKEYS, NOTE, download, drawScreen, flashErase, flashSave, powerOn,
} from "./engine.js";

const KNOB_COLOR = { 3: "var(--color-blue)", 4: "var(--color-green)", 5: "var(--color-yellow)", 6: "var(--color-orange)" };
const WHITE = Array.from({ length: NKEYS }, (_, k) => k).filter((k) => !BLACK(k)).length;

function PanelButton({ name, led, send, latched }) {
  const [down, setDown] = useState(false);
  const [held, setHeld] = useState(false);
  const b = B[name];
  const onDown = (ev) => {
    ev.preventDefault();
    if (ev.shiftKey) {                                  // latched: held until clicked again
      if (latched.current.has(b)) { latched.current.delete(b); send({ t: "button", b, down: false }); setHeld(false); }
      else { latched.current.add(b); send({ t: "button", b, down: true }); setHeld(true); }
      return;
    }
    if (latched.current.has(b)) { latched.current.delete(b); setHeld(false); }
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    send({ t: "button", b, down: true });
    setDown(true);
  };
  const onUp = () => {
    if (!down) return;
    setDown(false);
    if (!latched.current.has(b)) send({ t: "button", b, down: false });
  };
  return (
    <button type="button" data-led={led} title={`${name}: hold for its layer; Shift-click keeps it held`}
      className={`fm1-btn relative flex cursor-pointer touch-none flex-col items-center gap-1.5 border-0 bg-transparent p-0 text-[10.5px]
        font-semibold leading-none tracking-[.05em] text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg
        ${down ? "down" : ""} ${held ? "held" : ""}`}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}>
      <i className="block aspect-[1.35] w-full max-w-[46px] rounded-[7px]" /><span>{name}</span>
    </button>
  );
}

function Knob({ name, e, send }) {
  const [angle, setAngle] = useState(0);
  const drag = useRef({ y0: null, acc: 0 });
  const ref = useRef(null);
  const turn = useCallback((s) => {
    if (!s) return;
    setAngle((a) => a + s * 18);
    send({ t: "knob", e, s });
  }, [e, send]);
  useEffect(() => {                                     /* (a wheel listener that may preventDefault: not passive) */
    const cap = ref.current;
    const wheel = (ev) => { ev.preventDefault(); turn(ev.deltaY < 0 ? 1 : -1); };
    cap.addEventListener("wheel", wheel, { passive: false });
    return () => cap.removeEventListener("wheel", wheel);
  }, [turn]);
  const end = () => { drag.current.y0 = null; };
  return (
    <div className="flex flex-col items-center gap-1 text-[10.5px] tracking-[.06em] text-dim" style={{ "--kc": KNOB_COLOR[e] }}>
      <div ref={ref} tabIndex={0} role="slider" aria-label={name} aria-valuenow={0}
        className="fm1-cap relative size-[38px] cursor-ns-resize touch-none rounded-full min-[481px]:size-[46px]
          focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-fg"
        style={{ "--a": angle + "deg" }}
        onPointerDown={(ev) => { drag.current = { y0: ev.clientY, acc: 0 }; ev.currentTarget.setPointerCapture(ev.pointerId); }}
        onPointerMove={(ev) => {
          const d = drag.current;
          if (d.y0 === null) return;
          d.acc += d.y0 - ev.clientY;
          d.y0 = ev.clientY;
          while (Math.abs(d.acc) >= 10) { const s = Math.sign(d.acc); turn(s); d.acc -= s * 10; }
        }}
        onPointerUp={end} onPointerCancel={end}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowUp" || ev.key === "ArrowRight") { turn(1); ev.preventDefault(); ev.stopPropagation(); }
          if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") { turn(-1); ev.preventDefault(); ev.stopPropagation(); }
        }}>
        <b className="absolute top-[5px] left-1/2 -ml-[1.5px] h-3 w-[3px] rounded-[2px]" style={{ background: "var(--kc, #ddd)" }} />
      </div>
      <span>{name}</span>
    </div>
  );
}

export default function Emulator() {
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState("Your projects, songs and settings are kept in this browser.");
  const [leds, setLeds] = useState(() => new Array(14 + NKEYS).fill(0));
  const [held, setHeld] = useState(() => new Set());
  const [master, setMaster] = useState(900);
  const node = useRef(null);
  const latched = useRef(new Set());
  const heldRef = useRef(held);
  heldRef.current = held;
  const canvas = useRef(null);
  const screen = useRef(null);

  const send = useCallback((m) => { if (node.current) node.current.port.postMessage(m); }, []);

  useEffect(() => {
    const g = canvas.current.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 240, 240);
    screen.current = { g, img: g.createImageData(240, 240) };
  }, []);

  const noteOn = useCallback((k, vel) => {
    if (heldRef.current.has(k)) return;
    heldRef.current = new Set(heldRef.current).add(k);
    setHeld(heldRef.current);
    send({ t: "key", k, down: true, vel });
  }, [send]);
  const noteOff = useCallback((k) => {
    if (!heldRef.current.has(k)) return;
    const n = new Set(heldRef.current); n.delete(k);
    heldRef.current = n;
    setHeld(n);
    send({ t: "key", k, down: false });
  }, [send]);

  /* the computer's keyboard */
  useEffect(() => {
    const down = (ev) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey || !node.current) return;
      if (ev.target.closest?.("input, [role=slider]")) return;
      if (ev.code in KEYMAP) { noteOn(KEYMAP[ev.code], ev.shiftKey ? 127 : 100); ev.preventDefault(); }
      else if (ev.code in BTNMAP) { send({ t: "button", b: BTNMAP[ev.code], down: true }); ev.preventDefault(); }
      else if (ev.code in KNOBMAP) { const [e, s] = KNOBMAP[ev.code]; send({ t: "knob", e, s }); ev.preventDefault(); }
    };
    const up = (ev) => {
      if (!node.current) return;
      if (ev.code in KEYMAP) noteOff(KEYMAP[ev.code]);
      else if (ev.code in BTNMAP && !latched.current.has(BTNMAP[ev.code])) send({ t: "button", b: BTNMAP[ev.code], down: false });
    };
    const blur = () => { for (const k of [...heldRef.current]) noteOff(k); };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { document.removeEventListener("keydown", down); document.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [noteOn, noteOff, send]);

  const power = async () => {
    setStarting(true);
    try {
      const r = await powerOn((data) => {
        if (data.t === "screen") drawScreen(screen.current.g, screen.current.img, data.px);
        else if (data.t === "leds") setLeds(Array.from(data.leds));
        else if (data.t === "flash") {
          if (data.ask) download(data.flash);
          else flashSave(data.flash).then(setSaved);
        }
      });
      node.current = r.node;
      r.node.onprocessorerror = () => setSaved("The emulator stopped. Reload the page to start it again.");
      setOn(true);
      send({ t: "master", v: master });
      setSaved(r.flash ? "Your projects from last time are back" : "Nothing saved yet: your work is kept in this browser");
    } catch (err) {
      setStarting(false);
      setSaved("Could not start: " + (err.message || err) + ". Try Chrome, Edge, Firefox or Safari.");
    }
  };

  const keyDown = (k) => (ev) => {
    ev.preventDefault();
    const r = ev.currentTarget.getBoundingClientRect();
    const vel = Math.max(1, Math.min(127, Math.round(20 + 107 * ((ev.clientY - r.top) / r.height))));   // lower: harder
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    noteOn(k, vel);
  };
  let wi = 0;
  const keys = Array.from({ length: NKEYS }, (_, k) => {
    const black = BLACK(k);
    const style = black ? { left: `calc(${(wi / WHITE) * 100}% - var(--bw) / 2)` } : undefined;
    if (!black) wi++;
    return (
      <button key={k} type="button" data-led={leds[14 + k]} aria-label={NOTE[k % 12] + (3 + Math.floor((k + 5) / 12))} style={style}
        className={`cursor-pointer touch-none border-0 p-0 ${black ? "fm1-black absolute top-0 z-[1] h-[60%] rounded-b" : "fm1-white h-full rounded-b-md"}
          ${held.has(k) ? "down" : ""}`}
        onPointerDown={keyDown(k)} onPointerUp={() => noteOff(k)} onPointerCancel={() => noteOff(k)} />
    );
  });
  const btn = (name) => <PanelButton key={name} name={name} led={leds[B[name]]} send={send} latched={latched} />;
  const help = "text-fg font-semibold";

  return (
    <main className="mx-auto max-w-[1040px] px-4 pt-6 pb-12">
      <h1 className="m-0 mb-1.5 text-[13px] font-medium uppercase tracking-[.12em] text-dim">BoopBox emulator</h1>
      <p className="mb-[18px] max-w-[46em] text-[17px] leading-[1.35] min-[481px]:text-[19px]">The real BoopBox firmware, running in your browser:
        the same screen, sequencer and sound engines as on the M-VAVE FM-1. Try it before you install, or work on a beat away from the device.</p>
      <Strip className="mb-5" />

      <div className="fm1-body relative touch-manipulation select-none rounded-[18px] p-3.5 min-[861px]:p-[22px]">
        {!on ? (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 rounded-[18px] bg-[#0b0b0dd9] p-4 text-center">
            <button type="button" disabled={starting} onClick={power}
              className="cursor-pointer border-0 bg-orange px-8 py-4 text-[15px] font-semibold uppercase leading-none tracking-[.08em] text-black">
              {starting ? "Starting…" : "Power on"}</button>
            <p className="m-0 text-[13px] text-dim">Sound needs a click to start. Best with headphones.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 items-start gap-[22px] min-[861px]:grid-cols-[auto_minmax(0,480px)_1fr]">
          <div className="order-2 flex flex-row items-center justify-center gap-[22px] min-[861px]:order-none min-[861px]:flex-col min-[861px]:gap-3.5">
            {KNOBS.filter(([, e]) => e < 3).map(([n, e]) => <Knob key={n} name={n} e={e} send={send} />)}
          </div>
          <div className="order-1 mx-auto w-full max-w-[480px] min-[861px]:order-none">
            <canvas ref={canvas} width="240" height="240" aria-label="The FM-1's screen" className="fm1-screen block aspect-square w-full rounded bg-black" />
            <div className="mt-[18px] grid grid-cols-4 gap-2">
              {KNOBS.filter(([, e]) => e >= 3).map(([n, e]) => <Knob key={n} name={n} e={e} send={send} />)}
            </div>
          </div>
          <div className="order-3 flex flex-col gap-4 min-[861px]:order-none">
            <div className="grid grid-cols-6 gap-x-1.5 gap-y-2 min-[481px]:gap-x-2 min-[481px]:gap-y-2.5">{BUTTONS.slice(0, 12).map(btn)}</div>
            <label className="flex items-center gap-2.5 text-[10.5px] tracking-[.06em] text-dim">MASTER
              <input type="range" min="0" max="1023" value={master} className="flex-1 accent-orange"
                onChange={(ev) => { setMaster(+ev.target.value); send({ t: "master", v: +ev.target.value }); }} /></label>
          </div>
        </div>
        <div className="mt-[22px] grid grid-cols-[auto_1fr] items-end gap-[18px]">
          <div className="flex w-20 flex-col gap-2 min-[861px]:w-[110px] min-[861px]:flex-row">{btn("OCT-")}{btn("OCT+")}</div>
          <div className="relative grid h-24 gap-[3px] min-[481px]:h-[120px] min-[861px]:h-[150px]" style={{ gridTemplateColumns: `repeat(${WHITE}, 1fr)` }}>{keys}</div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-dim">
        <span className="mr-auto">{saved}</span>
        <button type="button" className="cursor-pointer border border-line bg-tile px-3 py-1.5 text-fg" onClick={() => send({ t: "flash" })}>Download the flash</button>
        <button type="button" className="cursor-pointer border border-line bg-tile px-3 py-1.5 text-fg" onClick={async () => {
          if (!confirm("Erase everything this emulator saved in this browser (projects, songs, presets, settings)?")) return;
          await flashErase();
          location.reload();
        }}>Erase what is saved</button>
      </div>

      <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-[22px] gap-y-1.5 text-[13px] text-dim">
        <div><b className={help}>Keys</b>: click them (lower on a key plays harder, with MENU › KEYS › VELOCITY on), or{" "}
          <kbd>Z</kbd> <kbd>S</kbd> <kbd>X</kbd> … <kbd>'</kbd> from F3 and <kbd>Q</kbd> <kbd>W</kbd> <kbd>3</kbd> … <kbd>Y</kbd> up to G5.</div>
        <div><b className={help}>Buttons</b>: hold them for their layer. <kbd>Shift</kbd>-click keeps one held, so the keyboard can play its
          layer. <kbd>Space</kbd> PLAY, <kbd>Enter</kbd> REC, <kbd>Esc</kbd> HOME, <kbd>[</kbd> <kbd>]</kbd> OCT− OCT+.</div>
        <div><b className={help}>Knobs</b>: drag up or down, or scroll. <kbd>↑</kbd> <kbd>↓</kbd> SELECT, <kbd>←</kbd> <kbd>→</kbd> ALGORITHM,{" "}
          <kbd>PgUp</kbd> <kbd>PgDn</kbd> PRESETS.</div>
        <div><b className={help}>More buttons</b>: <kbd>1</kbd> FX, <kbd>2</kbd> SEL, <kbd>5</kbd> ENV, <kbd>7</kbd> LFO, <kbd>8</kbd> EDIT,{" "}
          <kbd>9</kbd> GLO, <kbd>0</kbd> SAVE, <kbd>-</kbd> ARP, <kbd>=</kbd> SEQ.</div>
      </div>
      <p className="mt-[22px] text-[12.5px] text-dim">The panel is drawn, not photographed: the controls are the FM-1's, their places close to it. Not here:
        USB and MIDI, USB audio, the web editor's link, your own samples, the keys' own velocity sensing. After JIANT FM's
        emulator. <a href="../installer/">Install BoopBox on your FM-1</a> · GPL-3.0.</p>
    </main>
  );
}
