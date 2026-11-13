// SPDX-License-Identifier: GPL-3.0-only
// The LIVE page's own controls: a knob (drag up / down, the wheel, the arrow keys, double-click: its default), a fader
// (the same, and a click on its track) and a button that holds while pressed. The drum panel on the Sound page uses
// them too. Each control carries what MIDI learn drives (pro.js lvxMidi): node._lvo {min, max, set}, node.press /
// node.release, named by data-lvm. Ctl: a device parameter as a knob or a list.
import { useEffect, useRef, useState } from "react";
import { F, fmtValue } from "../../lib/proto.ts";
import { notify } from "../../core/app.ts";
import { LV, lvGlobal, lvGv, lvParam } from "./state.ts";

function lvArc(a0, a1, r = 18) {
  const p = (a) => [24 + r * Math.cos(a), 24 + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const clamp = (o, v) => Math.max(o.min, Math.min(o.max, v));

/* the slider behaviour both share: o {min, max, get, set(v, final), def, step}; px: the whole range over that many px */
function useSlider(o0, px) {
  /* (2.7) the control redraws itself at each move: what it drives need not redraw it (the drum card's values did not
     move until the next read: it felt like lag) */
  const o = { ...o0, set: (v, f) => { o0.set(v, f); notify(); } };
  const cur = useRef(o);
  cur.current = o;
  const ref = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const node = ref.current;
    const wheel = (e) => {
      const x = cur.current;
      e.preventDefault();
      x.set(clamp(x, x.get() + (e.deltaY < 0 ? 1 : -1) * (x.step || 1)), true);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    cur.current.set(d.last, true);
  };
  const handlers = {
    role: "slider", tabIndex: 0, "aria-valuemin": String(o.min), "aria-valuemax": String(o.max), "aria-valuenow": String(o.get()),
    onPointerDown: (e) => {
      if (e.button) return;
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = o.get();
      drag.current = { start, y0: e.clientY, last: start };
      setDragging(true);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const x = cur.current, span = x.max - x.min, dy = (d.y0 - e.clientY) * (e.shiftKey ? 0.25 : 1);
      const v = clamp(x, Math.round(d.start + dy * span / (px || 160)));
      if (v !== d.last) { d.last = v; x.set(v, false); }
    },
    onPointerUp: end, onPointerCancel: end,
    onDoubleClick: () => o.set(o.def, true),
    onKeyDown: (e) => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 8, PageDown: -8 }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      o.set(clamp(o, o.get() + d * (e.shiftKey ? 8 : o.step || 1)), true);
    },
  };
  /* MIDI learn sets it */
  const setRef = (node) => {
    ref.current = node;
    if (node) { node._lvo = cur.current; node.update = notify; }
  };
  return { o, handlers, setRef, dragging };
}

/* a knob: o {min, max, def, bip, get, set(v, final), fmt, mid} */
export function Knob({ label, o: o0, className = "", style }) {
  const { o, handlers, setRef, dragging } = useSlider(o0, 160);
  const v = o.get(), f = (v - o.min) / (o.max - o.min || 1), a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const z = o.bip ? (0 - o.min) / (o.max - o.min) : 0, az = a0 + z * (a1 - a0), av = a0 + f * (a1 - a0);
  const txt = o.fmt ? o.fmt(v) : String(v);
  return (
    <div ref={setRef} className={`lk ${dragging ? "drag" : ""} ${className}`} style={style} aria-label={label} data-lvm={o.mid}
      aria-valuetext={txt} {...handlers}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="kb" d={lvArc(a0, a1)} />
        <path className="kf" d={Math.abs(av - az) < 0.02 ? "" : lvArc(Math.min(az, av), Math.max(az, av))} />
      </svg>
      <span className="kl">{label}</span>
      <span className="kv">{txt}</span>
    </div>
  );
}

/* a fader (vertical): o as a knob's; meter: 0..1 shown beside it */
export function Fader({ label, o: o0, meter = 0 }) {
  const { o, handlers, setRef } = useSlider(o0, 180);
  const f = (o.get() - o.min) / (o.max - o.min || 1);
  return (
    <div ref={setRef} className="lfd" aria-label={label} data-lvm={o.mid} {...handlers}>
      <span className="fm"><i style={{ height: (Math.max(0, Math.min(1, meter)) * 100).toFixed(1) + "%" }} /></span>
      <div className="ft" onPointerDown={(e) => {            /* a click on the track: the value there */
        if (e.button || e.target.classList.contains("fc")) return;
        const r = e.currentTarget.getBoundingClientRect();
        o.set(Math.round(o.min + (1 - (e.clientY - r.top) / r.height) * (o.max - o.min)), true);
      }}>
        <span className="ff" style={{ height: (f * 100).toFixed(1) + "%" }} />
        <span className="fc" style={{ bottom: `calc(${(f * 100).toFixed(1)}% - 3px)` }} />
      </div>
    </div>
  );
}

/* a button that holds while pressed (pointer, touch, Enter / Space): down(), up(). lit: its name in LV.lit (it shows
   pressed while there: the computer keyboard lights it too); api(node): the caller keeps press / release */
export function Hold({ lit, down, up, className = "", children, api, ...rest }) {
  const on = useRef(false);
  const fns = useRef({ down, up });
  fns.current = { down, up };
  const go = (e) => { if (on.current) return; on.current = true; LV.lit.add(lit); notify(); fns.current.down(e); };
  const stop = () => { if (!on.current) return; on.current = false; LV.lit.delete(lit); notify(); fns.current.up(); };
  const setRef = (node) => {
    if (!node) return;
    node.press = () => go({});                            /* (LIVE pro: a learned MIDI pad holds it) */
    node.release = stop;
    if (api) api(node);
  };
  return (
    <button ref={setRef} type="button" className={`${className} ${LV.lit.has(lit) ? "on" : ""}`} {...rest}
      onPointerDown={(e) => { if (e.button) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat) { e.preventDefault(); e.stopPropagation(); go(e); } }}
      onKeyUp={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); stop(); } }}>
      {children}
    </button>
  );
}

/* a list whose value follows the device, except while it has the focus (the user's choice is on its way) */
export function SyncSelect({ value, children, selRef, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const n = ref.current;
    if (n && document.activeElement !== n && n.value !== String(value)) n.value = String(value);
  });
  return (
    <select ref={(n) => { ref.current = n; if (selRef) selRef(n); }} defaultValue={String(value)} {...rest}>{children}</select>
  );
}

/* a device parameter: a list (enum) or a knob. scope 0: track tr's P_*, 1: a global; d: its DESC */
export function Ctl({ scope, id, tr, d, lbl }) {
  if (!d) return null;
  const get = () => (scope ? lvGv(id) : (LV.tr[tr] || { p: [] }).p[id] ?? d.def ?? 0);
  const set = (v, f = true) => { if (scope) lvGlobal(id, v, f); else lvParam(tr, id, v); };
  const mid = scope ? `g:${id}` : `s${tr}:${id}`;
  if (d.fmt === F.ENUM && d.names && d.names.length) {
    return (
      <label className="lvxsel"><span className="dim">{(lbl || d.label).toLowerCase()}</span>
        <SyncSelect aria-label={lbl || d.label} data-lvm={mid} value={get()} onChange={(e) => set(+e.target.value)}
          selRef={(s) => { if (s) s._lvo = { min: d.min, max: d.max, set: (v) => { s.value = String(v); set(v); } }; }}>
          {d.names.map((n, k) => <option key={k} value={String(d.min + k)}>{n}</option>)}
        </SyncSelect>
      </label>
    );
  }
  return <Knob label={(lbl || d.label).toLowerCase()} o={{ min: d.min, max: d.max, def: d.def, bip: d.min < 0, get, set, mid,
    fmt: (v) => { const [x, u] = fmtValue(d, v); return u && u !== "%" ? `${x} ${u}`.toLowerCase() : x + (u || ""); } }} />;
}
