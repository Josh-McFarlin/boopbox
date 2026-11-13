// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator page: the FM-1 drawn, its screen, LEDs, keys, buttons and knobs, played with the mouse,
// a touch screen or the computer's keyboard (engine.js runs the firmware).
import type React from "react";
import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import SiteHeader from "../../components/SiteHeader.tsx";
import { arcadeButton, kbd, pixelPanel } from "../../components/styles.ts";
import {
  B, BLACK, BTNMAP, BUTTONS, FIRMWARE, KEYMAP, KNOBMAP, KNOBS, NKEYS, NOTE, download, drawScreen, firmwareFromUrl,
  flashErase, flashSave, hasFirmware, powerOn,
} from "./engine.ts";
import type { EmuMessage, FirmwareId } from "./engine.ts";
import * as K from "./classes.ts";

/* a message to the worklet */
type Send = (m: EmuMessage) => void;

/* what the FM-1 has printed: its knobs' names, the PLAY/STOP button, the upper keys' labels (the stock firmware's) */
const KNOB_LABEL: Record<string, string> = { K1: "KNOB1", K2: "KNOB2", K3: "KNOB3", K4: "KNOB4" };
const KEY_LABEL = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "PIT", "GLO", "MONO", "POLY", ""];
/* the computer's key for each control, printed faintly on it where there is a keyboard (classes.ts HINT shows them) */
const CODE_LABEL: Record<string, string> = { Comma: ",", Period: ".", Semicolon: ";", Slash: "/", Quote: "'", Space: "SPC", Enter: "↵",
                     BracketLeft: "[", BracketRight: "]", Escape: "ESC", Minus: "-", Equal: "=" };
const keyName = (code: string) => CODE_LABEL[code] ?? code.replace(/^(Key|Digit)/, "");
const KEY_HINT = Object.fromEntries(Object.entries(KEYMAP).map(([c, k]) => [k, keyName(c)]));
const BTN_HINT = Object.fromEntries(Object.entries(BTNMAP).map(([c, b]) => [b, keyName(c)]));
const KNOB_HINT: Record<number, string> = { 0: "↑ ↓", 1: "← →", 2: "PGUP PGDN" };
const OCTAVE_DOTS = [4, 7, 11, 14];                    // between B and C, E and F
/* the left edge of the gap before white key i, in a row of 16 pills with gaps of g units */
const gap = (i: number, g: string) => `calc(${i} * (100% - 15 * ${g} * var(--u)) / 16 + ${i - 0.5} * ${g} * var(--u))`;

interface PanelButtonProps {
  name: string;
  led: number;
  send: Send;
  latched: MutableRefObject<Set<number>>;
  /* its size: the OCT pair's or the pad's */
  className: string;
}

function PanelButton({ name, led, send, latched, className }: PanelButtonProps) {
  const [down, setDown] = useState(false);
  const [held, setHeld] = useState(false);
  const b = B[name];
  const onDown = (ev: ReactPointerEvent<HTMLButtonElement>) => {
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
      className={clsx(K.BTN, className, led === 2 ? "text-white" : led === 1 ? "text-[#ffb48a]" : led >= 3 ? "text-white" : "text-[#f4f4f4]",
        led === 2 ? K.BTN_LIT : K.BTN_RUBBER, down || held ? K.BTN_DOWN : led === 2 ? K.BTN_LIT_SHADOW : K.BTN_SHADOW,
        held && K.BTN_HELD, (led === 3 || led === 4) && K.BTN_DUTY, led === 4 && K.BTN_BREATHE)}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}>
      {name === "PLAY" ? <><span className={K.PLAY_LINE}>PLAY</span><span>STOP</span></> : name}
      {BTN_HINT[b] ? <kbd className={clsx(K.HINT, K.HINT_BTN)} aria-hidden="true">{BTN_HINT[b]}</kbd> : null}
    </button>
  );
}

/* a knob: endless (an encoder) unless value/onValue are given (MASTER, a potentiometer: 0..1023 over 300 degrees) */
interface KnobProps {
  name: string;
  e?: number;
  send?: Send;
  value?: number;
  onValue?: (s: number) => void;
}

function Knob({ name, e, send, value, onValue }: KnobProps) {
  const pot = onValue !== undefined;
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ y0: number | null; acc: number }>({ y0: null, acc: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const turn = useCallback((s: number) => {
    if (!s) return;
    if (pot) { onValue(s); return; }
    setAngle((a) => a + s * 18);
    send!({ t: "knob", e, s });
  }, [e, send, pot, onValue]);
  useEffect(() => {                                     /* (a wheel listener that may preventDefault: not passive) */
    const cap = ref.current!;
    const wheel = (ev: WheelEvent) => { ev.preventDefault(); turn(ev.deltaY < 0 ? 1 : -1); };
    cap.addEventListener("wheel", wheel, { passive: false });
    return () => cap.removeEventListener("wheel", wheel);
  }, [turn]);
  const end = () => { drag.current.y0 = null; };
  const a = pot ? -150 + (300 * value!) / 1023 : angle;
  return (
    <div className={K.KNOB}>
      <span className={K.PRINT}>{name}</span>
      <div ref={ref} tabIndex={0} role="slider" aria-label={name} aria-valuenow={pot ? value : 0}
        {...(pot ? { "aria-valuemin": 0, "aria-valuemax": 1023 } : {})}
        className={K.CAP} style={{ "--a": a + "deg" } as CSSProperties}
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
        <b className={K.CAP_MARK} />
        {e !== undefined && KNOB_HINT[e] ? <kbd className={clsx(K.HINT, K.HINT_CAP)} aria-hidden="true">{KNOB_HINT[e]}</kbd> : null}
      </div>
    </div>
  );
}

/* which firmware runs: BoopBox or BoopBox Trainer (shown when the site has the trainer's WebAssembly) */
interface FirmwareSwitchProps {
  fw: FirmwareId;
  onPick: (fw: FirmwareId) => void;
  disabled: boolean;
}

function FirmwareSwitch({ fw, onPick, disabled }: FirmwareSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Firmware" className="inline-flex flex-wrap gap-2.5">
      {(Object.entries(FIRMWARE) as [FirmwareId, (typeof FIRMWARE)[FirmwareId]][]).map(([k, f]) => (
        <button key={k} type="button" role="radio" aria-checked={fw === k} disabled={disabled}
          onClick={() => fw !== k && onPick(k)}
          className={`min-h-11 cursor-pointer px-4 font-pixel text-[18px] font-bold uppercase ${fw === k
            ? "border-0 bg-orange text-ink shadow-[4px_4px_0_var(--color-blue)]" : "border-[3px] border-line bg-transparent text-body hover:text-fg"}`}>
          {f.label}</button>
      ))}
    </div>
  );
}

const Emulator: React.FC = () => {
  const roomMode = new URLSearchParams(location.search).get("room") === "1";
  const [fw, setFw] = useState<FirmwareId>(() => roomMode ? "main" : firmwareFromUrl());
  const [hasTrainer, setHasTrainer] = useState(() => !roomMode && firmwareFromUrl() === "trainer");
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState("Your projects, songs and settings are kept in this browser.");
  const [leds, setLeds] = useState<number[]>(() => new Array(14 + NKEYS).fill(0));
  const [held, setHeld] = useState<Set<number>>(() => new Set());
  const [master, setMaster] = useState(900);
  const node = useRef<AudioWorkletNode | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const latched = useRef(new Set<number>());
  const heldRef = useRef(held);
  heldRef.current = held;
  const canvas = useRef<HTMLCanvasElement>(null);
  const screen = useRef<{ g: CanvasRenderingContext2D; img: ImageData } | null>(null);

  const send = useCallback<Send>((m) => { if (node.current) node.current.port.postMessage(m); }, []);
  const masterRef = useRef(master);
  const setMasterBy = useCallback((s: number) => {
    const v = Math.max(0, Math.min(1023, masterRef.current + s * 24));
    masterRef.current = v;
    setMaster(v);
    send({ t: "master", v });
  }, [send]);

  useEffect(() => { hasFirmware("trainer").then((ok) => ok && setHasTrainer(true)); }, []);

  useEffect(() => {
    const g = canvas.current!.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, 240, 240);
    screen.current = { g, img: g.createImageData(240, 240) };
  }, []);

  const noteOn = useCallback((k: number, vel: number) => {
    if (heldRef.current.has(k)) return;
    heldRef.current = new Set(heldRef.current).add(k);
    setHeld(heldRef.current);
    send({ t: "key", k, down: true, vel });
  }, [send]);
  const noteOff = useCallback((k: number) => {
    if (!heldRef.current.has(k)) return;
    const n = new Set(heldRef.current); n.delete(k);
    heldRef.current = n;
    setHeld(n);
    send({ t: "key", k, down: false });
  }, [send]);

  /* the computer's keyboard */
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey || !node.current) return;
      if ((ev.target as Element | null)?.closest?.("input, [role=slider]")) return;
      if (ev.code in KEYMAP) { noteOn(KEYMAP[ev.code], ev.shiftKey ? 127 : 100); ev.preventDefault(); }
      else if (ev.code in BTNMAP) { send({ t: "button", b: BTNMAP[ev.code], down: true }); ev.preventDefault(); }
      else if (ev.code in KNOBMAP) { const [e, s] = KNOBMAP[ev.code]; send({ t: "knob", e, s }); ev.preventDefault(); }
    };
    const up = (ev: KeyboardEvent) => {
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

  const power = async (f: FirmwareId = fw) => {
    setStarting(true);
    try {
      const r = await powerOn((data) => {
        if (data.t === "screen") drawScreen(screen.current!.g, screen.current!.img, data.px);
        else if (data.t === "leds") setLeds(Array.from(data.leds));
        else if (data.t === "flash") {
          if (data.ask) download(data.flash, f);
          else flashSave(data.flash, f).then(setSaved);
        }
      }, f, { roomMode });
      node.current = r.node;
      ctx.current = r.ctx;
      setStarting(false);
      r.node.onprocessorerror = () => setSaved("The emulator stopped. Reload the page to start it again.");
      setOn(true);
      if (roomMode) window.parent.postMessage({ type: "boopbox-room-ready" }, location.origin);
      send({ t: "master", v: master });
      setSaved(`${FIRMWARE[f].label}: ` + (r.flash ? "your work from last time is back" : "nothing saved yet: your work is kept in this browser"));
    } catch (err) {
      setStarting(false);
      setSaved("Could not start: " + ((err as Error).message || err) + ". Try Chrome, Edge, Firefox or Safari.");
    }
  };

  useEffect(() => {
    if (!on || !roomMode || !node.current) return undefined;
    const timer = window.setInterval(() => node.current?.port.postMessage({ t: "room-snapshot" }), 1200);
    return () => window.clearInterval(timer);
  }, [on, roomMode]);

  useEffect(() => {
    if (!roomMode) return undefined;
    const handle = ({ data }: MessageEvent) => {
      if (data?.t === "room-note") {
        window.parent.postMessage({
          type: "boopbox-room-note", track: data.track, note: data.note,
          down: data.down, velocity: data.velocity,
        }, location.origin);
      } else if (data?.t === "room-snapshot") {
        window.parent.postMessage({
          type: "boopbox-room-snapshot", project: data.project, tracks: data.tracks,
          tempo: data.tempo, playing: data.playing,
        }, location.origin, [data.project]);
      } else if (data?.t === "room-snapshot-error") {
        window.parent.postMessage({ type: "boopbox-room-error", error: data.error }, location.origin);
      }
    };
    node.current?.port.addEventListener("message", handle);
    node.current?.port.start();
    const panic = () => window.parent.postMessage({ type: "boopbox-room-panic" }, location.origin);
    window.addEventListener("pagehide", panic);
    return () => {
      node.current?.port.removeEventListener("message", handle);
      window.removeEventListener("pagehide", panic);
      panic();
    };
  }, [on, roomMode]);

  /* the other firmware: the running one is switched off (its flash is already kept) and the new one powered on */
  const pick = async (f: FirmwareId) => {
    setFw(f);
    const u = new URL(location.href);
    if (f === "main") u.searchParams.delete("fw"); else u.searchParams.set("fw", f);
    history.replaceState(null, "", u);
    if (!node.current) return;
    for (const k of [...heldRef.current]) noteOff(k);
    latched.current.clear();
    node.current.port.onmessage = null;
    node.current = null;
    await ctx.current?.close();
    ctx.current = null;
    setOn(false);
    setLeds(new Array(14 + NKEYS).fill(0));
    const g = screen.current!.g;
    g.fillStyle = "#000"; g.fillRect(0, 0, 240, 240);
    await power(f);
  };

  const keyDown = (k: number) => (ev: ReactPointerEvent<HTMLButtonElement>) => {
    ev.preventDefault();
    const r = ev.currentTarget.getBoundingClientRect();
    const vel = Math.max(1, Math.min(127, Math.round(20 + 107 * ((ev.clientY - r.top) / r.height))));   // lower: harder
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    noteOn(k, vel);
  };
  /* the keybed: white keys in the lower row, the black ones above, each over the gap it sits on */
  let wi = 0, bi = 0;
  const top: React.ReactElement[] = [], bottom: React.ReactElement[] = [];
  for (let k = 0; k < NKEYS; k++) {
    const black = BLACK(k);
    const label = black ? KEY_LABEL[bi++] : "";
    const down = held.has(k);
    const key = (
      <button key={k} type="button" data-led={leds[14 + k]} aria-label={NOTE[k % 12] + (3 + Math.floor((k + 5) / 12))}
        className={clsx(K.KEY, black ? K.KEY_TOP : "relative", down ? K.KEY_DOWN_SHADOW : K.KEY_SHADOW,
          black ? (down ? "[transform:translate(-50%,calc(2*var(--u)))]" : "[transform:translateX(-50%)]")
            : down && "[transform:translateY(calc(2*var(--u)))]")}
        style={black ? { left: gap(wi, "var(--kg)") } : undefined}
        onPointerDown={keyDown(k)} onPointerUp={() => noteOff(k)} onPointerCancel={() => noteOff(k)}>
        <i className={clsx(K.STRIP, K.STRIP_LED[leds[14 + k]] ?? K.STRIP_LED[0], black && label ? "top-[20%] h-[40%]" : "top-[22%] h-[56%]")} />
        {label ? <span className={K.KEY_LABEL}>{label}</span> : null}
        {KEY_HINT[k] ? <kbd className={clsx(K.HINT, K.HINT_KEY)} aria-hidden="true">{KEY_HINT[k]}</kbd> : null}
      </button>
    );
    if (black) top.push(key);
    else { bottom.push(key); wi++; }
  }
  const btn = (name: string, size: string) => <PanelButton key={name} name={name} led={leds[B[name]]} send={send} latched={latched} className={size} />;
  const help = "font-pixel text-[17px] font-bold text-fg";

  return (
    <>
    {!roomMode && <SiteHeader current="emu" />}
    <main className={`mx-auto max-w-[1280px] ${roomMode ? "w-full p-2" : "px-4 pt-6 pb-12"}`}>
      {!roomMode && (
        <>
          <p className="m-0 mb-3 inline-block bg-tile px-2.5 py-1 font-pixel text-[16px] font-medium text-blue">▶ Play it</p>
          <h1 className="m-0 mb-3 font-pixel text-[40px] leading-none font-bold min-[600px]:text-[52px]">BoopBox emulator</h1>
          <p className="mb-6 max-w-[46em] text-[17px] leading-[1.45]">The real BoopBox firmware, running in your browser:
            the same screen, sequencer and sound engines as on the M-VAVE FM-1. Try it before you install, or work on a beat away from the device.</p>
        </>
      )}
      {hasTrainer && !roomMode ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-[14px] text-dim">
          <span className="font-pixel text-[18px] text-dim">SELECT GAME</span>
          <FirmwareSwitch fw={fw} onPick={pick} disabled={starting} />
          <span>{fw === "trainer"
            ? "Lessons that teach three songs on the FM-1. Hold HOME for the level picker."
            : "The full BoopBox firmware."} Each keeps its own projects in this browser.</span>
        </div>
      ) : null}

      <div className={K.WRAP}>
        <div className={`${K.CASE} touch-manipulation select-none`}>
          <div className={K.LEFT}>
            <div className={K.KNOBS4}>
              <Knob name="MASTER" value={master} onValue={setMasterBy} />
              {["SELECT", "PRESETS", "ALGORITHM"].map((n) => <Knob key={n} name={n} e={Object.fromEntries(KNOBS)[n]} send={send} />)}
            </div>
            <div className={`${K.OCT} ${K.WELL}`}>{btn("OCT-", K.OCT_BTN)}{btn("OCT+", K.OCT_BTN)}</div>
          </div>
          <div className={K.SCREEN}>
            <canvas ref={canvas} width="240" height="240" aria-label="The FM-1's screen" className={K.CANVAS} />
          </div>
          <div className={K.RIGHT}>
            <div className={K.KNOBROW}>
              {KNOBS.filter(([, e]) => e >= 3).map(([n, e]) => <Knob key={n} name={KNOB_LABEL[n]} e={e} send={send} />)}
            </div>
            <div className={`${K.PAD} ${K.WELL}`}>{BUTTONS.slice(0, 12).map((n) => btn(n, K.PAD_BTN))}</div>
          </div>
          <div className={K.KEYSCROLL}>
            <div className={`${K.KEYS} ${K.WELL}`}>
              <div className={K.ROW}>{top}</div>
              <div className={K.ROW}>
                {OCTAVE_DOTS.map((i) => <b key={i} className={K.DOT} style={{ left: gap(i, "var(--kg)") }} />)}
                {bottom}
              </div>
            </div>
          </div>
        </div>
        {!on ? (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 rounded-[24px] bg-[#160d2bcc] p-4 text-center">
            <button type="button" disabled={starting} onClick={() => power()}
              className={`${arcadeButton} min-h-[60px] bg-green px-9 text-[24px] [--shadow:var(--color-orange)]`}>
              {starting ? "Starting…" : "▶ Power on"}</button>
            <p className="m-0 text-[14px] text-body">Tap or click to enable sound. Best with headphones.</p>
          </div>
        ) : null}
      </div>

      {!roomMode && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-dim">
            <span className="mr-auto">{saved}</span>
            <button type="button" className={`${pixelPanel} min-h-11 cursor-pointer border-0 px-4 font-pixel text-[16px] text-fg hover:text-blue`} onClick={() => send({ t: "flash" })}>Download the flash</button>
            <button type="button" className={`${pixelPanel} min-h-11 cursor-pointer border-0 px-4 font-pixel text-[16px] text-fg hover:text-blue`} onClick={async () => {
              if (!confirm(`Erase everything ${FIRMWARE[fw].label} saved in this browser (projects, songs, presets, settings${fw === "trainer" ? ", lesson progress" : ""})?`)) return;
              await flashErase(fw);
              location.reload();
            }}>Erase what is saved</button>
          </div>

          <h2 className="m-0 mt-10 mb-4 font-pixel text-[28px] leading-none text-green">HOW TO PLAY</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 text-[14px] leading-[1.75] text-body [&>div]:bg-tile [&>div]:p-4 [&>div]:shadow-[inset_0_0_0_3px_var(--line)]">
            <div><b className={help}>Keys</b>: click them (lower on a key plays harder, with MENU › KEYS › VELOCITY on), or{" "}
              <kbd className={kbd}>Z</kbd> <kbd className={kbd}>S</kbd> <kbd className={kbd}>X</kbd> … <kbd className={kbd}>'</kbd> from F3 and <kbd className={kbd}>Q</kbd> <kbd className={kbd}>W</kbd> <kbd className={kbd}>3</kbd> … <kbd className={kbd}>Y</kbd> up to G5. On a phone, swipe the case under the keys to scroll them.</div>
            <div><b className={help}>Buttons</b>: hold them for their layer. <kbd className={kbd}>Shift</kbd>-click keeps one held, so the keyboard can play its
              layer. <kbd className={kbd}>Space</kbd> PLAY, <kbd className={kbd}>Enter</kbd> REC, <kbd className={kbd}>Esc</kbd> HOME, <kbd className={kbd}>[</kbd> <kbd className={kbd}>]</kbd> OCT− OCT+.</div>
            <div><b className={help}>Knobs</b>: drag up or down, or scroll (MASTER is the volume). <kbd className={kbd}>↑</kbd> <kbd className={kbd}>↓</kbd> SELECT, <kbd className={kbd}>←</kbd> <kbd className={kbd}>→</kbd> ALGORITHM,{" "}
              <kbd className={kbd}>PgUp</kbd> <kbd className={kbd}>PgDn</kbd> PRESETS.</div>
            <div><b className={help}>More buttons</b>: <kbd className={kbd}>1</kbd> FX, <kbd className={kbd}>2</kbd> SEL, <kbd className={kbd}>5</kbd> ENV, <kbd className={kbd}>7</kbd> LFO, <kbd className={kbd}>8</kbd> EDIT,{" "}
              <kbd className={kbd}>9</kbd> GLO, <kbd className={kbd}>0</kbd> SAVE, <kbd className={kbd}>-</kbd> ARP, <kbd className={kbd}>=</kbd> SEQ.</div>
          </div>
          <p className="mt-8 text-[13px] text-dim">The panel is drawn, not photographed, to the FM-1's own layout and proportions. Not here:
            USB and MIDI, USB audio, the web editor's link, your own samples, the keys' own velocity sensing. After JIANT FM's
            emulator. <a href="../installer/">Install BoopBox on your FM-1</a> · GPL-3.0.</p>
        </>
      )}
    </main>
    </>
  );
};
Emulator.displayName = "Emulator";

export default Emulator;
