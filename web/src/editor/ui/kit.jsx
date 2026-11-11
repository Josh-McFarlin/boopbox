// SPDX-License-Identifier: GPL-3.0-only
// The editor's building blocks: icons (the Fukiai font), cards, and the device's parameter controls (a knob per
// parameter, four a page, one track colour per knob: the FM-1's own pages on a big screen).
import { useEffect, useRef } from "react";
import { F, fmtValue } from "../lib/proto.js";
import { GLYPH, HEAD_IC, PAGE_IC, WAVE_IC } from "../lib/glyphs.js";
import { A, key, t, useApp } from "../core/app.js";
import { touched, userSet } from "../core/device.js";

/* icons stay hidden (html:not(.fk)) until the face has loaded; on failure, or from file://, words only */
export async function loadIconFont() {
  try {
    const probe = "1em Fukiai", ch = String.fromCharCode(GLYPH.waveform_sine);
    const faces = await document.fonts.load(probe, ch);
    if (faces.length && faces.every((f) => f.status === "loaded") && document.fonts.check(probe, ch)) document.documentElement.classList.add("fk");
  } catch (e) { /* no icons */ }
}

export function Icon({ name }) {
  if (!name || GLYPH[name] == null) return null;
  return <span className="ic" aria-hidden="true">{String.fromCharCode(GLYPH[name])}</span>;
}
/* an icon and its words (a button's, a heading's) */
export function Ic({ ic, children }) {
  return <>{ic ? <Icon name={ic} /> : null}{children}</>;
}

/* a card: a box with its title in the big font (and an icon, a note on the right) */
export function Card({ title, ic, sub, id, className = "", children, hidden }) {
  return (
    <div id={id} hidden={hidden} data-card="" className={`mb-4 min-w-0 border border-line bg-s1 px-4 pt-3.5 pb-4 ${className}`}>
      {title != null ? <CardTitle ic={ic} sub={sub}>{title}</CardTitle> : null}
      {children}
    </div>
  );
}
export function CardTitle({ ic, sub, children }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-big uppercase text-fg [&_.ic]:text-[20px]">
      <Ic ic={ic}>{children}</Ic>
      {sub != null ? <span className="ml-auto text-[16px] leading-4 lowercase text-dim">{sub}</span> : null}
    </h2>
  );
}
/* a card's line of help under its title */
export const Help = ({ children, className = "" }) => <p className={`dim mt-0 mb-3 ${className}`}>{children}</p>;
/* the parameter cards of a page: two columns on a wide screen */
export const Groups = ({ children }) => <div className="groups columns-2 gap-4 [column-width:520px]">{children}</div>;
export function Group({ title, ic, sub, children }) {
  return (
    <div data-card="" className="mb-4 min-w-0 break-inside-avoid border border-line bg-s1 px-4 pt-3.5 pb-3">
      <CardTitle ic={ic} sub={sub}>{title}</CardTitle>
      {children}
    </div>
  );
}
export function GroupPage({ title, ic }) {
  return <h3 className="mt-2.5 mb-1.5 flex items-center uppercase text-dim first:mt-0 [h2+&]:mt-0"><Ic ic={ic}>{title}</Ic></h3>;
}
export const Knobs = ({ children }) => (
  <div className="grid grid-cols-2 border-t border-line wide:grid-cols-4">{children}</div>
);

/* ------------------------------------------------------- a device parameter --- */
export const visible = (d) => d && d.max > d.min && d.label !== "-";
export const RICH_SELECT = typeof CSS !== "undefined" && CSS.supports && CSS.supports("appearance", "base-select");
const KNOB_C = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)"];
/* the bar of a slider: from the left, or from 0 for a value either side of it (--a .. --p) */
export function barVars(d, v) {
  const pc = (x) => (d.max > d.min ? ((x - d.min) / (d.max - d.min)) * 100 : 0);
  const p = pc(v), z = d.min < 0 && d.max > 0 ? pc(0) : 0;
  return { "--a": Math.min(p, z).toFixed(1) + "%", "--p": Math.max(p, z).toFixed(1) + "%" };
}
/* a knob's look, given its place in the page (0..3: the device's four knob colours); `color` overrides it */
export function KnobBox({ index = 0, color, enumLike, pushed, children, title }) {
  return (
    <div title={title} style={{ "--c": color || KNOB_C[index % 4] }}
      className={`relative flex min-w-0 flex-col gap-1 border-l border-line px-2.5 pt-2 pb-2.5 max-wide:odd:border-l-0 max-wide:odd:pl-0
        wide:[&:nth-child(4n+1)]:border-l-0 wide:[&:nth-child(4n+1)]:pl-0 ${enumLike ? "enum" : ""} ${pushed ? "pushed" : ""}`}>
      {children}
    </div>
  );
}
/* the value as the device shows it, big; it turns like a knob: drag it up or down (the whole range over about 200 px,
   Shift: fine), double-click: the default */
export function BigValue({ d, v, onChange, onDragKey, pushed }) {
  const ref = useRef({ y0: 0, v0: 0, on: false });
  const [txt, unit] = fmtValue(d, v);
  const long = String(txt).length + (unit ? Math.ceil(unit.length / 2) : 0) > 6;
  return (
    <span title={d.label}
      className={`cursor-ns-resize touch-none overflow-hidden whitespace-nowrap select-none ${long ? "text-[16px] leading-8" : "text-big"} ${pushed ? "text-trk" : "text-fg"}`}
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
export function Slider({ d, v, onChange, onDragKey, style }) {
  const ref = useRef(null);
  const cur = useRef({ v, onChange });
  cur.current = { v, onChange };
  useEffect(() => {
    const input = ref.current;
    let acc = 0;
    const wheel = (e) => {
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
    <input ref={ref} type="range" min={d.min} max={d.max} step="1" value={v} title={d.label} style={{ ...barVars(d, v), ...style }}
      onPointerDown={() => { if (onDragKey) A.dragging = onDragKey; }}
      onChange={(e) => onChange(+e.target.value, false)}
      onPointerUp={(e) => onChange(+e.target.value, true)}
      onKeyUp={(e) => onChange(+e.target.value, true)}
      onDoubleClick={() => onChange(d.def, true)}
      onKeyDown={(e) => {
        const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (!dir || !e.shiftKey) return;
        e.preventDefault();
        const nv = Math.max(d.min, Math.min(d.max, v + dir * 10));
        if (nv !== v) onChange(nv, true);
      }} />
  );
}
/* a choice for d (ENUM / NOTE / ON-OFF): a select; WAVE choices with their icons where the browser can */
export function Choice({ d, v, onChange, focusKey, className = "" }) {
  const wave = RICH_SELECT && d.fmt === F.ENUM && /^WAVE2?$/.test(d.label);
  const opts = [];
  for (let x = d.min; x <= d.max; x++) {
    const [txt] = fmtValue(d, x);
    const name = d.fmt === F.ENUM && d.names[x - d.min] == null ? String(x) : txt;
    opts.push(<option key={x} value={x}>{wave && WAVE_IC[name] ? <Icon name={WAVE_IC[name]} /> : null}{name}</option>);
  }
  return (
    <select title={d.label} value={v} className={`${wave ? "wave" : ""} ${className}`}
      onFocus={() => { if (focusKey) A.focused = focusKey; }} onBlur={() => { if (A.focused === focusKey) A.focused = null; }}
      onChange={(e) => onChange(+e.target.value, true)}>
      {wave ? <button type="button"><selectedcontent /></button> : null}
      {opts}
    </select>
  );
}
export const isChoice = (d) => d.fmt === F.ENUM || d.fmt === F.NOTE || d.fmt === F.ONOFF;

/* one of the device's parameters (s 0: the selected track's, 1: a global): its name, its value, its control. It sends
   SET as the user moves it (device.js userSet); pushes and polling move it otherwise */
export function Param({ s, id, index }) {
  useApp();
  const dev = A.dev;
  const d = s ? dev.gdesc[id] : dev.pdesc[id];
  if (!visible(d)) return null;
  const k = key(s, id), v = (s ? dev.dump.g : dev.dump.p)[id] ?? d.def;
  const pushed = performance.now() - (A.blink.get(k) || 0) < 400;
  const set = (nv, final) => userSet(s, id, nv, final);
  const choice = isChoice(d);
  return (
    <KnobBox index={index} enumLike={choice} pushed={pushed}>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap uppercase text-c">{d.label}</span>
      {choice ? (
        <Choice d={d} v={v} focusKey={k} onChange={set}
          className={`mt-1.5 h-[34px] w-full border-line bg-s2 text-[16px] ${pushed ? "text-trk" : "text-c"}`} />
      ) : (
        <>
          <BigValue d={d} v={v} onChange={set} onDragKey={k} pushed={pushed && !touched(k)} />
          <Slider d={d} v={v} onChange={set} onDragKey={k} />
        </>
      )}
    </KnobBox>
  );
}

/* ----------------------------------------------------- the parameter pages --- */
/* the device's pages (firmware/src/core.h ids; used only when P_COUNT / G_COUNT / PE0 match the firmware's):
   pcount 71 / pe0 63: 2.6's INSERT, filter TYPE, ENV SYNC, LFO 2 (P_ITYPE 53 .. P_LPOL 62, after Felucca 1.4 / 1.5) */
export const EXPECT = { pcount: [61, 71], gcount: [32, 33, 45, 46, 47, 48, 49, 50], pe0: [53, 63] };   /* gcount 33: 2.5's drum DLY (G_DRDLY); 45: 2.6's MIDI, TEXTURE, BEND; 46: 2.7's FX CH; 47: DR MAP; 48: REMOTE; 49: CLK OUT; 50: 2.7.2's FX FADE */
export const LAYOUT = (pe0) => {
  const v251 = pe0 >= 63;                         /* (2.6: the pages the device has for the new parameters) */
  const opt = (yes, ...pages) => (yes ? pages : []);
  return [
    { t: "ENV", pages: [["ENV", 0, [1, 2, 3, 4]], ["ENV DEST", 0, [5, 6, 7, 8]], ...opt(v251, ["ENV SYNC", 0, [59]])] },
    { t: "LFO", pages: [["LFO", 0, [9, 10, 11, 12]], ...opt(v251, ["LFO 2", 0, [60, 61, 62]]), ["LFO DEST", 0, [13, 14, 15, 16]]] },
    { t: "EDIT", engine: true, pages: [["EDIT 1", 0, [pe0, pe0 + 1, pe0 + 2, pe0 + 3]], ["EDIT 2", 0, [pe0 + 4, pe0 + 5, pe0 + 6, pe0 + 7]],
      ...opt(v251, ["FILTER", 0, [58], 0])] },     /* (4th: the engine it is shown with: ANALOG's filter TYPE) */
    { t: "VOICE", pages: [["LEVEL", 0, [0]], ["VOICE", 0, [37, 38, 41, 42]], ["VOICE 2", 0, [43, 44, 39, 40]]] },
    { t: "FX", pages: [["FX", 0, [33, 34, 35, 36]], ["FILTER", 0, [50]], ["SLICER", 0, [45, 46, 47, 48]],
      ...opt(v251, ["INSERT", 0, [53, 54, 55, 56]], ["INSERT 2", 0, [57]]), ["DLY", 1, [4, 5, 6, 7]], ["REV/CHO", 1, [8, 9, 10, 11]]] },
    { t: "SEL", pages: [["SEL", 0, [25, 26, 27, 49]], ["SEL 2", 0, [28, 51, 52]]] },
    { t: "ARP", pages: [["ARP", 0, [17, 18, 19, 20]], ["ARP 2", 0, [21, 22, 23, 24]]] },
    { t: "SEQ TIMING", tab: "seqgroups", pages: [["TIMING", 0, [29, 30, 31, 32]]] },
    { t: "GLOBAL", tab: "setgroups", pages: [["GLOBAL", 1, [0, 1, 2, 3]]] },
    { t: "MASTER", tab: "setgroups", pages: [["MASTER", 1, [27, 28, 29, 30]]] },
    { t: "DRUMS", tab: "setgroups", pages: [["DRUMS", 1, [24, 25, 26, 32]]] },
    ...opt(v251, { t: "MIDI", tab: "setgroups", pages: [["MIDI", 1, [33, 34, 35, 24]], ["MIDI 2", 1, [14, 36, 12, 44]], ["MIDI 3", 1, [45, 46, 47, 48]]] }),   /* CH1 CH2 CH3 CH4 (drums);
                                                     * IN OTHER OUT BEND (settings of the FM-1; IN and OUT: the FM-1 only, G_SKIP) */
    ...opt(v251, { t: "TEXTURE", tab: "setgroups", pages: [["TEXTURE", 1, [37, 38, 39, 40]], ["TEXTURE 2", 1, [41, 42, 43]]] }),   /* the bed */
  ];
};
/* globals that are actions or placeholders on the device: buttons instead, or hidden */
export const G_SKIP = new Set(["SLOT", "SECT", "NAME", "LOAD", "SAVE", "ENG", "SET", "CLRSQ", "INIT", "MIDI", "OUT", "SYNC", "ROUT", "IN", "CPU", "NEW"]);
const shown = (s, id) => { const d = s ? A.dev.gdesc[id] : A.dev.pdesc[id]; return visible(d) && !(s === 1 && G_SKIP.has(d.label)); };

/* the parameter cards of one page of the editor: "groups" (Sound: the selected track's), "seqgroups" (Sequencer: its
   pattern settings), "setgroups" (Settings: globals and drums); a card per button of the device (ENV, LFO, EDIT ...),
   its pages as rows of four knobs */
export function ParamGroups({ where }) {
  const { lang, dev } = useApp();
  const { info } = dev;
  const known = EXPECT.pcount.indexOf(info.pcount);
  const out = [];
  if (known >= 0 && EXPECT.gcount.includes(info.gcount) && info.pe0 === EXPECT.pe0[known]) {
    for (const g of LAYOUT(info.pe0)) {
      if ((g.tab || "groups") !== where) continue;
      const pages = [];
      for (const [title, s, ids, onlyEng] of g.pages) {
        if (onlyEng != null && dev.dump.engine !== onlyEng) continue;
        const live = ids.filter((id) => shown(s, id));
        if (!live.length) continue;
        const tt = g.engine && (dev.titles[dev.dump.engine] || [])[g.pages.findIndex((x) => x[0] === title)];
        pages.push(
          <div key={title}>
            {g.pages.length > 1 ? <GroupPage ic={PAGE_IC[tt || title]} title={tt || title} /> : null}
            <Knobs>{live.map((id, i) => <Param key={id} s={s} id={id} index={i} />)}</Knobs>
          </div>,
        );
      }
      if (!pages.length) continue;
      out.push(
        <Group key={g.t} ic={HEAD_IC[g.t]} title={g.engine ? `EDIT ${info.engines[dev.dump.engine] || ""}` : g.t}
          sub={pages.length > 1 ? `${pages.length} ${lang === "ja" ? "ページ" : "pages"}` : null}>{pages}</Group>,
      );
    }
  } else {
    /* unknown firmware layout: everything in id order, four knobs a row */
    const ids = (n, s, f) => Array.from({ length: n }, (_, i) => i).filter((i) => f(i) && shown(s, i));
    const box = (name, s, list, pre) => (
      <Group key={name} ic={HEAD_IC[name]} title={name}>{pre}<Knobs>{list.map((id, i) => <Param key={id} s={s} id={id} index={i} />)}</Knobs></Group>
    );
    if (where === "groups") {
      out.push(box("INSTRUMENT", 0, ids(info.pcount, 0, (i) => i < info.pe0), <p className="dim">{t("layout")}</p>));
      out.push(box("EDIT", 0, ids(info.pcount, 0, (i) => i >= info.pe0)));
    } else if (where === "setgroups") out.push(box("GLOBAL", 1, ids(info.gcount, 1, () => true)));
  }
  return <Groups>{out}</Groups>;
}
