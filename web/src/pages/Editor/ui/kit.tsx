// SPDX-License-Identifier: GPL-3.0-only
// The editor's building blocks: icons (the Fukiai font), cards, and the device's parameter controls (a knob per
// parameter, four a page, one track colour per knob: the FM-1's own pages on a big screen).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DetailedHTMLProps, HTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import { F, fmtValue } from "../lib/proto.ts";
import type { DevInfo, FmtDesc, ParamDesc } from "../lib/proto.ts";
import { GLYPH, HEAD_IC, PAGE_IC, WAVE_IC } from "../lib/glyphs.ts";
import { A, key, readyDev, t, useApp } from "../core/app.ts";
import { labelOf } from "../lib/labels.ts";
import { touched, userSet } from "../core/device.ts";
import { dim, help, icon, pri, tog, waveSelect } from "./styles.ts";

/* <selectedcontent> (customizable <select>: the chosen option's content, drawn in the select's button) */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements { selectedcontent: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> }
  }
}

/* the glyph tables by any name (a name they do not have: none) */
const GLYPHS: Record<string, number | undefined> = GLYPH;
const HEAD_ICS: Record<string, string | undefined> = HEAD_IC;
const PAGE_ICS: Record<string, string | undefined> = PAGE_IC;
const WAVE_ICS: Record<string, string | undefined> = WAVE_IC;

/* a value changed by a control: final when the user let go of it (a SET follows; while dragging, maybe not) */
export type OnValue = (v: number, final: boolean) => void;

/* icons stay hidden (html:not(.fk)) until the face has loaded; on failure, or from file://, words only */
export async function loadIconFont(): Promise<void> {
  try {
    const probe = "1em Fukiai", ch = String.fromCharCode(GLYPH.waveform_sine);
    const faces = await document.fonts.load(probe, ch);
    if (faces.length && faces.every((f) => f.status === "loaded") && document.fonts.check(probe, ch)) document.documentElement.classList.add("fk");
  } catch (e) { /* no icons */ }
}

export interface IconProps { name?: string | null }
/* (data-ic: for a parent that sizes its icons, [&_[data-ic]]:...) */
export function Icon({ name }: IconProps) {
  const g = name ? GLYPHS[name] : undefined;
  if (!name || g == null) return null;
  return <span className={icon} data-ic="" aria-hidden="true">{String.fromCharCode(g)}</span>;
}
/* an icon and its words (a button's, a heading's) */
export interface IcProps { ic?: string | null; children?: ReactNode }
export function Ic({ ic, children }: IcProps) {
  return <>{ic ? <Icon name={ic} /> : null}{children}</>;
}

/* a card: a box with its title in the big font (and an icon, a note on the right) */
export interface CardProps {
  title?: ReactNode; ic?: string | null; sub?: ReactNode; id?: string; className?: string; children?: ReactNode; hidden?: boolean;
}
export function Card({ title, ic, sub, id, className = "", children, hidden }: CardProps) {
  return (
    <div id={id} hidden={hidden} data-card="" className={`mb-4 min-w-0 border border-line bg-s1 px-4 pt-3.5 pb-4 ${className}`}>
      {title != null ? <CardTitle ic={ic} sub={sub}>{title}</CardTitle> : null}
      {children}
    </div>
  );
}
export interface CardTitleProps { ic?: string | null; sub?: ReactNode; children?: ReactNode }
export function CardTitle({ ic, sub, children }: CardTitleProps) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-big text-fg [&_[data-ic]]:text-[20px]">
      <Ic ic={ic}>{children}</Ic>
      {sub != null ? <span className="ml-auto text-[16px] leading-4 lowercase text-dim">{sub}</span> : null}
    </h2>
  );
}
/* the page's send state, in the page header's right corner (App.jsx #page-actions), the same place on every page
   that edits something the FM-1 only gets when sent: an "Unsent changes" badge while there is something to send, the
   Send button (disabled, with its reason, when there is nothing), and optionally Read and a note (the memory used) */
export interface SendBarProps {
  dirty: boolean; onSend: () => void; onRead?: (() => void) | null; busy?: boolean; sendLabel?: ReactNode; readLabel?: ReactNode;
  note?: ReactNode; sendDisabled?: boolean; why?: string;
}
export function SendBar({ dirty, onSend, onRead, busy, sendLabel, readLabel, note, sendDisabled, why }: SendBarProps) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setEl(document.getElementById("page-actions")); }, []);
  if (!el) return null;
  return createPortal(
    <div className="flex items-center gap-2" data-sendbar="">
      {note ? <span className="text-dim">{note}</span> : null}
      {dirty ? <span className="bg-t7 px-2 py-0.5 text-black" role="status">{t("unsent")}</span> : null}
      {onRead ? <button type="button" disabled={busy} onClick={onRead}><Ic ic="symbol_download">{readLabel || t("readFm1")}</Ic></button> : null}
      <button type="button" className={pri} disabled={busy || sendDisabled || !dirty}
        title={busy ? t("whyBusy") : sendDisabled ? why || "" : !dirty ? t("whyNothing") : ""} onClick={onSend}>
        <Ic ic="symbol_upload">{sendLabel || t("sendFm1")}</Ic></button>
    </div>, el);
}

/* a card's line of help under its title */
export interface HelpProps { children?: ReactNode; className?: string }
export const Help = ({ children, className = "" }: HelpProps) => <p className={`${dim} mt-0 mb-3 max-w-[80ch] ${className}`}>{children}</p>;

/* a "?" that opens a card's longer explanation in place (instead of paragraphs always on the page) */
export interface MoreProps { children?: ReactNode; label?: string }
export function More({ children, label }: MoreProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* data-more: for a parent that places it ([&>button[data-more]]:...) */}
      <button type="button" data-more="" className={`${tog} ml-1 size-6 p-0 align-middle`} aria-pressed={open} aria-expanded={open} title={label || t("moreHelp")}
        onClick={() => setOpen(!open)}>?</button>
      {open ? <div className={`${help} my-2 max-w-[80ch] border-l-2 border-acc bg-bg px-3 py-2 text-fg2 [&_p]:my-1`}>{children}</div> : null}
    </>
  );
}
/* the parameter cards of a page: two columns on a wide screen */
export const Groups = ({ children }: { children?: ReactNode }) => <div className="groups columns-2 gap-4 [column-width:520px]">{children}</div>;
export interface GroupProps { title: ReactNode; ic?: string | null; sub?: ReactNode; children?: ReactNode }
export function Group({ title, ic, sub, children }: GroupProps) {
  return (
    <div data-card="" className="mb-4 min-w-0 break-inside-avoid border border-line bg-s1 px-4 pt-3.5 pb-3">
      <CardTitle ic={ic} sub={sub}>{title}</CardTitle>
      {children}
    </div>
  );
}
export function GroupPage({ title, ic }: { title: ReactNode; ic?: string | null }) {
  return <h3 className="mt-2.5 mb-1.5 flex items-center text-dim first:mt-0 [h2+&]:mt-0"><Ic ic={ic}>{title}</Ic></h3>;
}

/* the cards' and their rows' names in words (the device's page names: ENV DEST, LFO 2, SEL 2 ...) */
export const GROUP_NAME: Record<string, string> = { ENV: "Envelope", LFO: "LFO", EDIT: "Engine", VOICE: "Voice", FX: "Effects", SEL: "Key & chords", ARP: "Arpeggiator",
  "SEQ TIMING": "Timing", GLOBAL: "Tempo & tuning", MASTER: "Master effects", DRUMS: "Drums", MIDI: "MIDI", TEXTURE: "Texture (background bed)" };
export const PAGE_NAME: Record<string, string> = { ENV: "Shape", "ENV DEST": "Envelope moves", "ENV SYNC": "Tempo sync", LFO: "Wave", "LFO 2": "Timing", "LFO DEST": "LFO moves",
  LEVEL: "Level", VOICE: "Voices", "VOICE 2": "Unison, pan & level", FX: "Distortion, sends & filter", FILTER: "Filter", SLICER: "Slicer", INSERT: "Insert effect",
  "INSERT 2": "Insert mix", DLY: "Delay (all tracks)", "REV/CHO": "Reverb & chorus (all tracks)", SEL: "Key & scale", "SEL 2": "Chords", ARP: "Pattern",
  "ARP 2": "Feel", MIDI: "Channels", "MIDI 2": "Input", "MIDI 3": "Sync & remote", TEXTURE: "Bed", "TEXTURE 2": "Timing",
  /* the engines' own page titles (DESC titles) */
  OSC: "Oscillators", FLT: "Filter", OPS: "Operators", MOD: "Modulation", PHS: "Phase", LINE: "Line", CHIP: "Chip", MOTN: "Motion", SET: "Sample",
  TONE: "Tone", VOWL: "Vowels", BARS: "Drawbars", GRAN: "Grains", SPRY: "Spray", PATCH: "Patch", BODY: "Body", EXCT: "Exciter", SRC: "Source",
  MOVE: "Movement", PROGRAM: "Program", FILTER2: "Filter" };
/* a context for labelOf(): the row's device page name, or the card's */
const ctxOf = (group: string, page: string): string => ({ "ENV DEST": "ENV DEST", "LFO DEST": "LFO DEST", LFO: "LFO", "LFO 2": "LFO", SLICER: "SLICER", INSERT: "INSERT",
  "INSERT 2": "INSERT", DLY: "DLY", FX: "FX", FILTER: "FX" } as Record<string, string | undefined>)[page] || group;
/* a row of knobs: four a line, as the device's four knobs (a knob merged in from a one-knob page starts a new line) */
export const Knobs = ({ children }: { children?: ReactNode }) => (
  <div className="grid grid-cols-4 border-t border-line">{children}</div>
);

/* ------------------------------------------------------- a device parameter --- */
export const visible = (d: ParamDesc | null | undefined): d is ParamDesc => !!d && d.max > d.min && d.label !== "-";
export const RICH_SELECT = typeof CSS !== "undefined" && CSS.supports && CSS.supports("appearance", "base-select");
const KNOB_C = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)"];
/* the bar of a slider: from the left, or from 0 for a value either side of it (--a .. --p) */
export function barVars(d: { min: number; max: number }, v: number): CSSProperties {
  const pc = (x: number) => (d.max > d.min ? ((x - d.min) / (d.max - d.min)) * 100 : 0);
  const p = pc(v), z = d.min < 0 && d.max > 0 ? pc(0) : 0;
  return { "--a": Math.min(p, z).toFixed(1) + "%", "--p": Math.max(p, z).toFixed(1) + "%" } as CSSProperties;
}
/* a knob's look, given its place in the page (0..3: the device's four knob colours); `color` overrides it */
export interface KnobBoxProps {
  index?: number; color?: string; enumLike?: boolean; pushed?: boolean; children?: ReactNode; title?: string;
}
export function KnobBox({ index = 0, color, enumLike, pushed, children, title }: KnobBoxProps) {
  return (
    <div title={title} style={{ "--c": color || KNOB_C[index % 4] } as CSSProperties}
      className={`relative flex min-w-0 flex-col gap-1 border-l border-line px-2.5 pt-2 pb-2.5
        [&:nth-child(4n+1)]:border-l-0 [&:nth-child(4n+1)]:pl-0 [&:nth-child(n+5)]:border-t ${enumLike ? "enum" : ""} ${pushed ? "pushed" : ""}`}>
      {children}
    </div>
  );
}
/* the value as the device shows it, big; it turns like a knob: drag it up or down (the whole range over about 200 px,
   Shift: fine), double-click: the default */
/* what a value control needs of its parameter */
export type ValueDesc = FmtDesc & { def: number };
export interface BigValueProps { d: ValueDesc; v: number; onChange: OnValue; onDragKey?: string; pushed?: boolean }
export function BigValue({ d, v, onChange, onDragKey, pushed }: BigValueProps) {
  const ref = useRef({ y0: 0, v0: 0, on: false });
  const [txt, unit] = fmtValue(d, v);
  const long = String(txt).length + (unit ? Math.ceil(unit.length / 2) : 0) > 6;
  return (
    <span title={t("tipValue")}
      className={`cursor-ns-resize touch-none overflow-hidden whitespace-nowrap select-none ${long ? "text-[16px] leading-8" : "text-big"} ${pushed ? "text-acc" : "text-fg"}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        ref.current = { y0: e.clientY, v0: v, on: true };
        if (onDragKey) A.dragging = onDragKey;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const r = ref.current;
        if (!r.on) return;
        const per = (d.max - d.min) / (e.shiftKey ? 800 : 200);
        const nv = Math.max(d.min, Math.min(d.max, Math.round(r.v0 + (r.y0 - e.clientY) * Math.max(per, e.shiftKey ? 0.05 : 0.12))));
        if (nv !== v) onChange(nv, false);
      }}
      onPointerUp={() => { if (ref.current.on) { ref.current.on = false; A.dragging = null; onChange(v, true); } }}
      onPointerCancel={() => { ref.current.on = false; A.dragging = null; }}
      onDoubleClick={() => onChange(d.def, true)}>
      {String(txt)}{unit ? <small className="ml-1 text-[16px] leading-4 text-dim">{unit}</small> : null}
    </span>
  );
}
/* a slider for d (a DESC): wheel over it when focused, Shift+arrows in steps of 10 (plain arrows are native),
   double-click: the default */
export interface SliderProps {
  d: { min: number; max: number; def: number; label?: string }; v: number; onChange: OnValue; onDragKey?: string; style?: CSSProperties;
}
export function Slider({ d, v, onChange, onDragKey, style }: SliderProps) {
  const ref = useRef<HTMLInputElement>(null);
  const cur = useRef({ v, onChange });
  cur.current = { v, onChange };
  useEffect(() => {
    const input = ref.current!;
    let acc = 0;
    const wheel = (e: WheelEvent) => {
      if (document.activeElement !== input) return;
      e.preventDefault();
      acc += (e.deltaMode === 1 ? 33 : 1) * (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX);
      const n = Math.trunc(acc / 50);
      if (n) {
        acc -= n * 50;
        const nv = Math.max(d.min, Math.min(d.max, cur.current.v + n * (e.shiftKey ? 10 : 1)));
        if (nv !== cur.current.v) cur.current.onChange(nv, true);
      }
    };
    input.addEventListener("wheel", wheel, { passive: false });
    return () => input.removeEventListener("wheel", wheel);
  }, [d]);
  return (
    <input ref={ref} type="range" min={d.min} max={d.max} step="1" value={v} title={t("tipSlider")} style={{ ...barVars(d, v), ...style }}
      onPointerDown={() => { if (onDragKey) A.dragging = onDragKey; }}
      onChange={(e) => onChange(+e.target.value, false)}
      onPointerUp={(e) => onChange(+(e.target as HTMLInputElement).value, true)}
      onKeyUp={(e) => onChange(+(e.target as HTMLInputElement).value, true)}
      onDoubleClick={() => onChange(d.def, true)}
      onKeyDown={(e) => {
        const dir = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number | undefined>)[e.key];
        if (!dir || !e.shiftKey) return;
        e.preventDefault();
        const nv = Math.max(d.min, Math.min(d.max, v + dir * 10));
        if (nv !== v) onChange(nv, true);
      }} />
  );
}
/* a select's chevron (its own layers, so a select's background colour class stays) */
const CHEV_L = "linear-gradient(45deg, transparent 50%, var(--fg2) 50%)", CHEV_R = "linear-gradient(-45deg, transparent 50%, var(--fg2) 50%)";
export const CHEVRON: CSSProperties = { backgroundImage: `${CHEV_L}, ${CHEV_R}`, backgroundRepeat: "no-repeat",
  backgroundPosition: "calc(100% - 13px) 55%, calc(100% - 7px) 55%", backgroundSize: "6px 6px, 6px 6px", paddingRight: 26 };
/* a choice for d (ENUM / NOTE / ON-OFF): a select; WAVE choices with their icons where the browser can */
/* what a choice needs of its parameter */
export type ChoiceDesc = FmtDesc & { label: string };
export interface ChoiceProps { d: ChoiceDesc; v: number; onChange: OnValue; focusKey?: string; className?: string }
export function Choice({ d, v, onChange, focusKey, className = "" }: ChoiceProps) {
  const wave = RICH_SELECT && d.fmt === F.ENUM && /^WAVE2?$/.test(d.label);
  const opts: ReactNode[] = [];
  for (let x = d.min; x <= d.max; x++) {
    const [txt] = fmtValue(d, x);
    const name = d.fmt === F.ENUM && d.names![x - d.min] == null ? String(x) : txt;
    opts.push(<option key={x} value={x}>{wave && WAVE_ICS[name] ? <Icon name={WAVE_ICS[name]} /> : null}{name}</option>);
  }
  return (
    <select title={d.label} value={v} className={`${wave ? waveSelect : ""} ${className}`} style={wave ? undefined : CHEVRON}
      onFocus={() => { if (focusKey) A.focused = focusKey; }} onBlur={() => { if (A.focused === focusKey) A.focused = null; }}
      onChange={(e) => onChange(+e.target.value, true)}>
      {wave ? <button type="button"><selectedcontent /></button> : null}
      {opts}
    </select>
  );
}
export const isChoice = (d: { fmt: number }): boolean => d.fmt === F.ENUM || d.fmt === F.NOTE || d.fmt === F.ONOFF;

/* a parameter's name: the whole name, the device's short name beside it (small), what it does as the tooltip */
export function ParamName({ label, ctx }: { label: string; ctx?: string }) {
  const [name, what] = labelOf(label, ctx);
  const same = name.toUpperCase() === String(label).toUpperCase();
  return (
    <span className="line-clamp-2 min-h-10 min-w-0 cursor-help text-c" title={what ? `${name} (${label}): ${what}` : name}>
      {name}{same ? null : <small className="ml-1.5 text-[16px] leading-4 whitespace-nowrap text-dim opacity-70">{label}</small>}
    </span>
  );
}

/* one of the device's parameters (s 0: the selected track's, 1: a global): its name, its value, its control. It sends
   SET as the user moves it (device.js userSet); pushes and polling move it otherwise. ctx: where it is (labels.js) */
export interface ParamProps { s: number; id: number; index?: number; ctx?: string }
export function Param({ s, id, index, ctx }: ParamProps) {
  useApp();
  const dev = readyDev();
  const d = s ? dev.gdesc[id] : dev.pdesc[id];
  if (!visible(d)) return null;
  const k = key(s, id), v = (s ? dev.dump.g : dev.dump.p)[id] ?? d.def;
  const pushed = performance.now() - (A.blink.get(k) || 0) < 400;
  const set: OnValue = (nv, final) => userSet(s, id, nv, final);
  const choice = isChoice(d);
  return (
    <KnobBox index={index} enumLike={choice} pushed={pushed}>
      <ParamName label={d.label} ctx={ctx} />
      {choice ? (
        <Choice d={d} v={v} focusKey={k} onChange={set}
          className={`mt-1.5 h-[34px] w-full border-line bg-s2 text-[16px] ${pushed ? "text-acc" : "text-c"}`} />
      ) : (
        <>
          <BigValue d={d} v={v} onChange={set} onDragKey={k} pushed={pushed && !touched(k)} />
          <Slider d={d} v={v} onChange={set} onDragKey={k} />
        </>
      )}
    </KnobBox>
  );
}

/* a device parameter as a line of a settings list: its name as words (and its sentence under it), its control on the
   right. name / hint: given, else from labels.js (ctx) */
export interface ParamRowProps { s: number; id: number; ctx?: string; name?: string; hint?: ReactNode; chip?: ReactNode }
export function ParamRow({ s, id, ctx, name, hint, chip }: ParamRowProps) {
  useApp();
  const dev = readyDev();
  const d = s ? dev.gdesc[id] : dev.pdesc[id];
  if (!visible(d)) return null;
  const [full, what] = labelOf(d.label, ctx);
  const k = key(s, id), v = (s ? dev.dump.g : dev.dump.p)[id] ?? d.def;
  const pushed = performance.now() - (A.blink.get(k) || 0) < 400;
  const set: OnValue = (nv, final) => userSet(s, id, nv, final);
  const nm = name || full, sub = hint === undefined ? what : hint;
  return (
    <div data-param={d.label} className="grid grid-cols-[minmax(0,1fr)_240px] items-center gap-6 border-t border-line py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-fg" title={`${nm} (${d.label})`}>
          {chip}{nm}<small className="text-[16px] leading-4 text-dim opacity-70">{d.label}</small></div>
        {sub ? <p className="m-0 text-dim">{sub}</p> : null}
      </div>
      {isChoice(d) ? (
        <Choice d={d} v={v} focusKey={k} onChange={set} className={`h-[34px] w-full ${pushed ? "text-acc" : ""}`} />
      ) : (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
          <BigValue d={d} v={v} onChange={set} onDragKey={k} pushed={pushed && !touched(k)} />
          <Slider d={d} v={v} onChange={set} onDragKey={k} />
        </div>
      )}
    </div>
  );
}
/* a global's id by its device name (the settings that are not on a knob page of their own: MIDI) */
export const gid = (label: string): number => (A.dev && A.dev.gdesc ? A.dev.gdesc.findIndex((d) => d && d.label === label) : -1);

/* ----------------------------------------------------- the parameter pages --- */
/* the device's pages (firmware/src/core.h ids; used only when P_COUNT / G_COUNT / PE0 match the firmware's):
   pcount 71 / pe0 63: 2.6's INSERT, filter TYPE, ENV SYNC, LFO 2 (P_ITYPE 53 .. P_LPOL 62, after Felucca 1.4 / 1.5) */
export const EXPECT = { pcount: [61, 71], gcount: [32, 33, 45, 46, 47, 48, 49, 50], pe0: [53, 63] };   /* gcount 33: 2.5's drum DLY (G_DRDLY); 45: 2.6's MIDI, TEXTURE, BEND; 46: 2.7's FX CH; 47: DR MAP; 48: REMOTE; 49: CLK OUT; 50: 2.7.2's FX FADE */
/* a page of the device: its title, its scope (0 the track, 1 globals), its parameter ids, and the only engine it shows
   with */
export type LayoutPage = [title: string, scope: number, ids: number[], onlyEng?: number];
/* a card: a button of the device (t), its pages; engine: the engine's own (EDIT); tab: the editor page it is on */
export interface LayoutGroup { t: string; engine?: boolean; tab?: string; pages: LayoutPage[] }
export const LAYOUT = (pe0: number): LayoutGroup[] => {
  const v251 = pe0 >= 63;                         /* (2.6: the pages the device has for the new parameters) */
  const opt = <T extends LayoutPage | LayoutGroup>(yes: boolean, ...pages: T[]): T[] => (yes ? pages : []);
  return [
    /* (a one-knob page joins the row before it: ENV SYNC the shape, FILTER the sends, INSERT 2 the insert) */
    { t: "ENV", pages: [["ENV", 0, [1, 2, 3, 4]], ...opt(v251, ["ENV SYNC", 0, [59]]), ["ENV DEST", 0, [5, 6, 7, 8]]] },
    { t: "LFO", pages: [["LFO", 0, [9, 10, 11, 12]], ...opt(v251, ["LFO 2", 0, [60, 61, 62]]), ["LFO DEST", 0, [13, 14, 15, 16]]] },
    { t: "EDIT", engine: true, pages: [["EDIT 1", 0, [pe0, pe0 + 1, pe0 + 2, pe0 + 3]], ["EDIT 2", 0, [pe0 + 4, pe0 + 5, pe0 + 6, pe0 + 7]],
      ...opt(v251, ["FILTER", 0, [58], 0])] },     /* (4th: the engine it is shown with: ANALOG's filter TYPE) */
    { t: "VOICE", pages: [["VOICE", 0, [37, 38, 41, 42]], ["VOICE 2", 0, [43, 44, 39, 40]], ["LEVEL", 0, [0]]] },
    { t: "FX", pages: [["FX", 0, [33, 34, 35, 36]], ["FILTER", 0, [50]], ["SLICER", 0, [45, 46, 47, 48]],
      ...opt(v251, ["INSERT", 0, [53, 54, 55, 56]], ["INSERT 2", 0, [57]]), ["DLY", 1, [4, 5, 6, 7]], ["REV/CHO", 1, [8, 9, 10, 11]]] },
    { t: "SEL", pages: [["SEL", 0, [25, 26, 27, 49]], ["SEL 2", 0, [28, 51, 52]]] },
    { t: "ARP", pages: [["ARP", 0, [17, 18, 19, 20]], ["ARP 2", 0, [21, 22, 23, 24]]] },
    { t: "SEQ TIMING", tab: "seqgroups", pages: [["TIMING", 0, [29, 30, 31, 32]]] },
    { t: "GLOBAL", tab: "setgroups", pages: [["GLOBAL", 1, [0, 1, 2, 3]]] },
    { t: "MASTER", tab: "setgroups", pages: [["MASTER", 1, [27, 28, 29, 30, 49]]] },   /* (49: 2.7.2's FX FADE) */
    /* (the drums' channel, CH4, is with the other channels once the device has them) */
    { t: "DRUMS", tab: "setgroups", pages: [["DRUMS", 1, v251 ? [25, 26, 32] : [24, 25, 26, 32]]] },
    ...opt(v251, { t: "MIDI", tab: "setgroups", pages: [["MIDI", 1, [33, 34, 35, 24]], ["MIDI 2", 1, [14, 36, 12, 44]], ["MIDI 3", 1, [45, 46, 47, 48]]] }),   /* CH1 CH2 CH3 CH4 (drums);
                                                     * IN OTHER OUT BEND (settings of the FM-1; IN and OUT: the FM-1 only, G_SKIP) */
    ...opt(v251, { t: "TEXTURE", tab: "setgroups", pages: [["TEXTURE", 1, [37, 38, 39, 40]], ["TEXTURE 2", 1, [41, 42, 43]]] }),   /* the bed */
  ];
};
/* globals that are actions or placeholders on the device: buttons instead, or hidden */
export const G_SKIP = new Set(["SLOT", "SECT", "NAME", "LOAD", "SAVE", "ENG", "SET", "CLRSQ", "INIT", "MIDI", "OUT", "SYNC", "ROUT", "IN", "CPU", "NEW"]);
const shown = (s: number, id: number) => { const d = s ? A.dev!.gdesc[id] : A.dev!.pdesc[id]; return visible(d) && !(s === 1 && G_SKIP.has(d.label)); };

/* the parameter cards of one page of the editor: "groups" (Sound: the selected track's), "seqgroups" (Sequencer: its
   pattern settings), "setgroups" (Settings: globals and drums); a card per button of the device (ENV, LFO, EDIT ...),
   its pages as rows of four knobs. only: these cards (LAYOUT t), in that order; flat: one under the other, full width
   (no columns) */
export const layoutKnown = (info: DevInfo): boolean => {
  const known = EXPECT.pcount.indexOf(info.pcount);
  return known >= 0 && EXPECT.gcount.includes(info.gcount) && info.pe0 === EXPECT.pe0[known];
};
export interface ParamGroupsProps { where?: string; only?: string[]; flat?: boolean }
export function ParamGroups({ where, only, flat }: ParamGroupsProps) {
  useApp();
  const dev = readyDev();
  const { info } = dev;
  const out: ReactNode[] = [];
  if (layoutKnown(info)) {
    const groups = LAYOUT(info.pe0).filter((g) => (only ? only.includes(g.t) : (g.tab || "groups") === where));
    if (only) groups.sort((a, b) => only.indexOf(a.t) - only.indexOf(b.t));
    for (const g of groups) {
      const eng = info.engines[dev.dump.engine] || "";
      const head = g.engine ? `${GROUP_NAME.EDIT}: ${eng}` : GROUP_NAME[g.t] || g.t;
      const rows: { title: string; ic?: string; items: { s: number; id: number; ctx: string }[] }[] = [];
      g.pages.forEach(([title, s, ids, onlyEng], pi) => {
        if (onlyEng != null && dev.dump.engine !== onlyEng) return;
        const live = ids.filter((id) => shown(s, id));
        if (!live.length) return;
        const tt = g.engine && (dev.titles![dev.dump.engine] || [])[pi];
        const ctx = g.engine ? eng : ctxOf(g.t, title);
        const items = live.map((id) => ({ s, id, ctx }));
        const prev = rows[rows.length - 1];
        /* a page of one knob joins the row before it (its name says what it is) */
        if (items.length === 1 && prev && prev.items.length % 4 === 0) prev.items.push(...items);
        else rows.push({ title: PAGE_NAME[tt || title] || tt || title, ic: PAGE_ICS[tt || title], items });
      });
      if (!rows.length) continue;
      /* a row's heading only when the card has several rows, and not the card's own name again */
      const heads = rows.length > 1;
      out.push(
        <Group key={g.t} ic={HEAD_ICS[g.t]} title={head}>
          {rows.map((r, ri) => (
            <div key={ri}>
              {heads && r.title.toLowerCase() !== head.toLowerCase() ? <GroupPage ic={r.ic} title={r.title} /> : null}
              <Knobs>{r.items.map((x, i) => <Param key={x.s + ":" + x.id} s={x.s} id={x.id} index={i} ctx={x.ctx} />)}</Knobs>
            </div>
          ))}
        </Group>,
      );
    }
  } else {
    /* unknown firmware layout: everything in id order, four knobs a row */
    const ids = (n: number, s: number, f: (i: number) => boolean) => Array.from({ length: n }, (_, i) => i).filter((i) => f(i) && shown(s, i));
    const box = (name: string, s: number, list: number[], pre?: ReactNode) => (
      <Group key={name} ic={HEAD_ICS[name]} title={GROUP_NAME[name] || name}>{pre}<Knobs>{list.map((id, i) => <Param key={id} s={s} id={id} index={i} />)}</Knobs></Group>
    );
    if (where === "groups") {
      out.push(box("INSTRUMENT", 0, ids(info.pcount, 0, (i) => i < info.pe0), <p className={dim}>{t("layout")}</p>));
      out.push(box("EDIT", 0, ids(info.pcount, 0, (i) => i >= info.pe0)));
    } else if (where === "setgroups") out.push(box("GLOBAL", 1, ids(info.gcount, 1, () => true)));
  }
  return flat ? <div className="groups">{out}</div> : <Groups>{out}</Groups>;
}
