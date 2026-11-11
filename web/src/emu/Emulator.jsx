// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator page: the FM-1 drawn, its screen, LEDs, keys, buttons and knobs, played with the mouse,
// a touch screen or the computer's keyboard (engine.js runs the firmware).
import { useCallback, useEffect, useRef, useState } from "react";
import { Strip } from "../shared/Brand.jsx";
import {
  B, BLACK, BTNMAP, BUTTONS, KEYMAP, KNOBMAP, KNOBS, NKEYS, NOTE, download, drawScreen, flashErase, flashSave, powerOn,
} from "./engine.js";

/* what the FM-1 has printed: its knobs' names, the PLAY/STOP button, the upper keys' labels (the stock firmware's) */
const KNOB_LABEL = { K1: "KNOB1", K2: "KNOB2", K3: "KNOB3", K4: "KNOB4" };
const KEY_LABEL = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "PIT", "GLO", "MONO", "POLY", ""];
const OCTAVE_DOTS = [4, 7, 11, 14];                    // between B and C, E and F
/* the left edge of the gap before white key i, in a row of 16 pills with gaps of g units */
const gap = (i, g) => `calc(${i} * (100% - 15 * ${g} * var(--u)) / 16 + ${i - 0.5} * ${g} * var(--u))`;

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
    <button type="button" data-led={led} aria-label={name} title={`${name}: hold for its layer; Shift-click keeps it held`}
      className={`fm1-btn ${down ? "down" : ""} ${held ? "held" : ""}`}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}>
      {name === "PLAY" ? <><span className="play">PLAY</span><span>STOP</span></> : name}
    </button>
  );
}

/* a knob: endless (an encoder) unless value/onValue are given (MASTER, a potentiometer: 0..1023 over 300 degrees) */
function Knob({ name, e, send, value, onValue }) {
  const pot = onValue !== undefined;
  const [angle, setAngle] = useState(0);
  const drag = useRef({ y0: null, acc: 0 });
  const ref = useRef(null);
  const turn = useCallback((s) => {
    if (!s) return;
    if (pot) { onValue(s); return; }
    setAngle((a) => a + s * 18);
    send({ t: "knob", e, s });
  }, [e, send, pot, onValue]);
  useEffect(() => {                                     /* (a wheel listener that may preventDefault: not passive) */
    const cap = ref.current;
    const wheel = (ev) => { ev.preventDefault(); turn(ev.deltaY < 0 ? 1 : -1); };
    cap.addEventListener("wheel", wheel, { passive: false });
    return () => cap.removeEventListener("wheel", wheel);
  }, [turn]);
  const end = () => { drag.current.y0 = null; };
  const a = pot ? -150 + (300 * value) / 1023 : angle;
  return (
    <div className="fm1-knob">
      <span className="fm1-print">{name}</span>
      <div ref={ref} tabIndex={0} role="slider" aria-label={name} aria-valuenow={pot ? value : 0}
        {...(pot ? { "aria-valuemin": 0, "aria-valuemax": 1023 } : {})}
        className="fm1-cap" style={{ "--a": a + "deg" }}
        onPointerDown={(ev) => { drag.current = { y0: ev.clientY, acc: 0 }; ev.currentTarget.setPointerCapture(ev.pointerId); }}
        onPointerMove={(ev) => {
          const d = drag.current;
          if (d.y0 === null) return;
          d.acc += d.y0 - ev.clientY;
          d.y0 = ev.clientY;
          const step = pot ? 3 : 10;
          while (Math.abs(d.acc) >= step) { const s = Math.sign(d.acc); turn(s); d.acc -= s * step; }
        }}
        onPointerUp={end} onPointerCancel={end}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowUp" || ev.key === "ArrowRight") { turn(1); ev.preventDefault(); ev.stopPropagation(); }
          if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") { turn(-1); ev.preventDefault(); ev.stopPropagation(); }
        }}>
        <b />
      </div>
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
  const masterRef = useRef(master);
  const setMasterBy = useCallback((s) => {
    const v = Math.max(0, Math.min(1023, masterRef.current + s * 24));
    masterRef.current = v;
    setMaster(v);
    send({ t: "master", v });
  }, [send]);

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
  /* the keybed: white keys in the lower row, the black ones above, each over the gap it sits on */
  let wi = 0, bi = 0;
  const top = [], bottom = [];
  for (let k = 0; k < NKEYS; k++) {
    const black = BLACK(k);
    const label = black ? KEY_LABEL[bi++] : "";
    const key = (
      <button key={k} type="button" data-led={leds[14 + k]} aria-label={NOTE[k % 12] + (3 + Math.floor((k + 5) / 12))}
        className={`fm1-key ${label ? "labelled" : ""} ${held.has(k) ? "down" : ""}`} style={black ? { left: gap(wi, "var(--kg)") } : undefined}
        onPointerDown={keyDown(k)} onPointerUp={() => noteOff(k)} onPointerCancel={() => noteOff(k)}>
        <i />{label ? <span>{label}</span> : null}
      </button>
    );
    if (black) top.push(key);
    else { bottom.push(key); wi++; }
  }
  const btn = (name) => <PanelButton key={name} name={name} led={leds[B[name]]} send={send} latched={latched} />;
  const help = "text-fg font-semibold";

  return (
    <main className="mx-auto max-w-[1280px] px-4 pt-6 pb-12">
      <h1 className="m-0 mb-1.5 text-[13px] font-medium uppercase tracking-[.12em] text-dim">BoopBox emulator</h1>
      <p className="mb-[18px] max-w-[46em] text-[17px] leading-[1.35] min-[481px]:text-[19px]">The real BoopBox firmware, running in your browser:
        the same screen, sequencer and sound engines as on the M-VAVE FM-1. Try it before you install, or work on a beat away from the device.</p>
      <Strip className="mb-5" />

      <div className="fm1-wrap relative">
        <div className="fm1 touch-manipulation select-none">
          <div className="fm1-left">
            <div className="fm1-knobs4">
              <Knob name="MASTER" value={master} onValue={setMasterBy} />
              {["SELECT", "PRESETS", "ALGORITHM"].map((n) => <Knob key={n} name={n} e={Object.fromEntries(KNOBS)[n]} send={send} />)}
            </div>
            <div className="fm1-oct fm1-well">{btn("OCT-")}{btn("OCT+")}</div>
          </div>
          <div className="fm1-screen">
            <canvas ref={canvas} width="240" height="240" aria-label="The FM-1's screen" />
          </div>
          <div className="fm1-right">
            <div className="fm1-knobrow">
              {KNOBS.filter(([, e]) => e >= 3).map(([n, e]) => <Knob key={n} name={KNOB_LABEL[n]} e={e} send={send} />)}
            </div>
            <div className="fm1-pad fm1-well">{BUTTONS.slice(0, 12).map(btn)}</div>
          </div>
          <div className="fm1-keyscroll">
            <div className="fm1-keys fm1-well">
              <div className="fm1-row top">{top}</div>
              <div className="fm1-row">
                {OCTAVE_DOTS.map((i) => <b key={i} className="fm1-dot" style={{ left: gap(i, "var(--kg)") }} />)}
                {bottom}
              </div>
            </div>
          </div>
        </div>
        {!on ? (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 rounded-[24px] bg-[#0b0b0dcc] p-4 text-center">
            <button type="button" disabled={starting} onClick={power}
              className="cursor-pointer border-0 bg-orange px-8 py-4 text-[15px] font-semibold uppercase leading-none tracking-[.08em] text-black">
              {starting ? "Starting…" : "Power on"}</button>
            <p className="m-0 text-[13px] text-dim">Sound needs a click to start. Best with headphones.</p>
          </div>
        ) : null}
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
          <kbd>Z</kbd> <kbd>S</kbd> <kbd>X</kbd> … <kbd>'</kbd> from F3 and <kbd>Q</kbd> <kbd>W</kbd> <kbd>3</kbd> … <kbd>Y</kbd> up to G5. On a phone, swipe the case under the keys to scroll them.</div>
        <div><b className={help}>Buttons</b>: hold them for their layer. <kbd>Shift</kbd>-click keeps one held, so the keyboard can play its
          layer. <kbd>Space</kbd> PLAY, <kbd>Enter</kbd> REC, <kbd>Esc</kbd> HOME, <kbd>[</kbd> <kbd>]</kbd> OCT− OCT+.</div>
        <div><b className={help}>Knobs</b>: drag up or down, or scroll (MASTER is the volume). <kbd>↑</kbd> <kbd>↓</kbd> SELECT, <kbd>←</kbd> <kbd>→</kbd> ALGORITHM,{" "}
          <kbd>PgUp</kbd> <kbd>PgDn</kbd> PRESETS.</div>
        <div><b className={help}>More buttons</b>: <kbd>1</kbd> FX, <kbd>2</kbd> SEL, <kbd>5</kbd> ENV, <kbd>7</kbd> LFO, <kbd>8</kbd> EDIT,{" "}
          <kbd>9</kbd> GLO, <kbd>0</kbd> SAVE, <kbd>-</kbd> ARP, <kbd>=</kbd> SEQ.</div>
      </div>
      <p className="mt-[22px] text-[12.5px] text-dim">The panel is drawn, not photographed, to the FM-1's own layout and proportions. Not here:
        USB and MIDI, USB audio, the web editor's link, your own samples, the keys' own velocity sensing. After JIANT FM's
        emulator. <a href="../installer/">Install BoopBox on your FM-1</a> · GPL-3.0.</p>
    </main>
  );
}
