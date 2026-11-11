// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The Sequencer page: the pattern settings (SEQ TIMING), the selected track's steps as the device's tiles or a piano
// roll, LEN at hand, MIDI files in and out, the step list, the selected step's nudge / locks / fill (v7, v8), and on the
// drum track (v5) its 16 lanes. The logic is in sequencer/seq.js.
import { useEffect, useRef } from "react";
import { DRUM_LANES, F, FC, LV_NAMES, LV_ORDER, MICRO, ROLL, fmtValue, noteName } from "../lib/proto.js";
import { A, hasFill, hasLocks, isDrum, notify, pickFile, t, tf, useApp } from "../core/app.js";
import { H } from "../core/hooks.js";
import { Card, Ic, ParamGroups } from "../ui/kit.jsx";
import {
  MIDI, ROLL_LAB, ROLL_ROW, RV, SQ, TIMES, addLock, canAddLock, changeLockParam, clearSeq, curDiv, drumClick, drumView,
  kitDesc, lockName, lockableIds, midiCancel, midiDrum, midiExport, midiImport, midiOpen, midiPlan, paint, pDiv,
  refreshLocks, reloadSteps, roll, rollApply, rollFit, rollNoteAt, rollShift, selectStep, setKit, setLen, setPaint,
  setView, stepFill, stepLen, stepLocked, stepNotes, writeFill, writeLock, writeMicro, writeStep,
} from "./sequencer/seq.js";
import "./sequencer/seq.css";

export function init() {
  Object.assign(H, { refreshLocks });
}

/* a field the user types in: it shows `value` unless it has the focus (a value being typed stays), and reports the
   native change (Enter, leaving it, a spinner click, a choice), as the old page's fields did */
function Field({ as: Tag = "input", value, checked, onCommit, children, ...rest }) {
  const ref = useRef(null);
  const cb = useRef(onCommit);
  cb.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (checked != null) el.checked = !!checked;
    else if (value != null && el.value !== String(value)) el.value = String(value);
  });
  useEffect(() => {
    const el = ref.current, h = () => cb.current && cb.current(el);
    el.addEventListener("change", h);
    return () => el.removeEventListener("change", h);
  }, []);
  return <Tag ref={ref} {...rest}>{children}</Tag>;
}

/* the rows of the step list, by step: a grid cell jumps to its row */
const rows = new Map();
let listEl = null;
function focusStep(i) {
  const r = rows.get(i);
  selectStep(i);
  if (!r || !r.tr) return;
  if (listEl) listEl.open = true;                    /* (the list opens on the step clicked) */
  r.tr.scrollIntoView({ block: "center", behavior: "smooth" });
  r.notes.focus({ preventScroll: true });
  SQ.hl = i;
  notify();
  setTimeout(() => { if (SQ.hl === i) { SQ.hl = -1; notify(); } }, 1200);
}

/* ------------------------------------------------------- the step grid --- */
/* the step grid: one cell per step up to LEN; a cell jumps to its row in the table */
function StepGrid() {
  const { dev } = useApp();
  const len = stepLen();
  const cells = [];
  for (let i = 0; i < len; i++) {
    const s = dev.steps[i];
    const on = !!s && s.n > 0 && s.time === 0, tie = !!s && s.time === 1;
    const txt = on ? stepNotes(s) : tie ? "—" : "";
    const marks = s && on ? (s.flags & 1 ? " >" : "") + (s.flags & 2 ? " ~" : "") : "";
    const lk = stepLocked(i), fc = stepFill(i), sel = i === SQ.sel && hasLocks();
    const acc = on && s.flags & 1;
    cells.push(
      <button key={i} type="button" data-i={i} onClick={() => focusStep(i)}
        title={`${i + 1}: ${on ? txt : tie ? "TIE" : "REST"}${marks}${fc ? " (" + FC.NAMES[fc] + ")" : ""}`}
        className={`flex h-[58px] min-w-0 flex-col justify-between overflow-hidden px-[5px] py-1 text-left normal-case hover:bg-s3
          ${on ? "on bg-trk" : tie ? "tie bg-[repeating-linear-gradient(-45deg,var(--s2)_0_6px,var(--s3)_6px_8px)]" : "bg-s2"}
          ${i % 4 === 0 ? "beat" : ""} ${lk ? "lk" : ""} ${fc ? "fc" + fc : ""} ${acc ? "acc shadow-[inset_0_3px_var(--fg)]" : ""} ${sel ? "sel outline-2 outline-offset-1 outline-fg" : ""}`}>
        <span className={on ? "text-black" : i % 4 === 0 ? "text-dim" : "text-s3"}>
          {fc === 1 ? "F " : fc === 2 ? "× " : ""}{String(i + 1) + marks}{lk ? " ▪" : ""}
        </span>
        <span className={`max-h-8 overflow-hidden leading-4 [overflow-wrap:anywhere] ${on ? "text-black" : "text-fg2"}`}>{txt}</span>
      </button>,
    );
  }
  return <div id="stepgrid" className="mt-2 mb-4 grid grid-cols-16 gap-[3px] max-wide:grid-cols-8">{cells}</div>;
}

/* ------------------------------------------------------- the step list --- */
function StepRow({ i, s }) {
  const ref = useRef({});
  const c = ref.current;
  const fill = () => {
    if (!c.tr || !s) return;
    c.notes.value = stepNotes(s);
    c.notes.classList.remove("bad");
    c.time.value = String(s.time);
    c.acc.checked = !!(s.flags & 1);
    c.sl.checked = !!(s.flags & 2);
    c.vel.value = String(s.vel);
  };
  const cur = useRef(fill);
  cur.current = fill;
  /* keep the row the user is typing in */
  useEffect(() => { if (!c.tr.contains(document.activeElement)) fill(); }, [s, A.lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    rows.set(i, c);
    return () => { if (rows.get(i) === c) rows.delete(i); };
  }, [i, c]);
  useEffect(() => {
    const send = async () => {
      const ok = await writeStep(i, { notes: c.notes.value, time: c.time.value, acc: c.acc.checked, sl: c.sl.checked, vel: c.vel.value });
      if (!ok) { c.notes.classList.add("bad"); return; }
      c.notes.classList.remove("bad");
      if (!c.tr.contains(document.activeElement) || document.activeElement === c.notes) setTimeout(() => cur.current(), 0);
    };
    const els = [c.notes, c.time, c.acc, c.sl, c.vel];
    for (const e of els) e.addEventListener("change", send);
    return () => { for (const e of els) e.removeEventListener("change", send); };
  }, [i, c]);
  const off = !s || !s.n || s.time === 2;
  return (
    <tr ref={(e) => { c.tr = e; }} data-i={i} onFocus={() => selectStep(i)}   /* (v7: the step detail follows the row being edited) */
      className={`${off ? "off [&_td]:text-s3" : ""} ${SQ.hl === i ? "hl" : ""} [&.hl_td]:bg-s2`}>
      <td className="i">{i + 1}</td>
      <td><input ref={(e) => { c.notes = e; }} type="text" placeholder="—" spellCheck="false"
        className="w-[140px] [&.bad]:border-red [&.bad]:text-red" /></td>
      <td><select ref={(e) => { c.time = e; }}>{TIMES.map((n, k) => <option key={k} value={k}>{n}</option>)}</select></td>
      <td><input ref={(e) => { c.acc = e; }} type="checkbox" /></td>
      <td><input ref={(e) => { c.sl = e; }} type="checkbox" /></td>
      <td><input ref={(e) => { c.vel = e; }} type="number" min="0" max="127" className="w-[60px]" /></td>
    </tr>
  );
}
function StepTables() {
  const { dev } = useApp();
  const len = stepLen();
  const tables = [];
  for (let b = 0; b < len; b += 16) {
    const rws = [];
    for (let i = b; i < Math.min(len, b + 16); i++) rws.push(<StepRow key={i} i={i} s={dev.steps[i]} />);
    tables.push(
      <table key={b} className="mb-3 break-inside-avoid">
        <tbody>
          <tr><th /><th>{t("notes")}</th><th>{t("time")}</th><th>{t("acc")}</th><th>{t("slide")}</th><th>{t("vel")}</th></tr>
          {rws}
        </tbody>
      </table>,
    );
  }
  return <div id="steptables" className="columns-[520px] gap-8">{tables}</div>;
}

/* ------------------------------------------------------- the piano roll --- */
/* the roll: rows = notes (black keys darker), columns = steps (bar lines from DIV), a chord = one bar per note */
function rollColors() {
  const cs = getComputedStyle(document.documentElement), g = (v) => cs.getPropertyValue(v).trim();
  return { bg: g("--bg"), s1: g("--s1"), s2: g("--s2"), s3: g("--s3"), dim: g("--dim"), fg: g("--fg"), trk: g("--trk") };
}
function drawRoll(cv) {
  const dev = A.dev;
  if (!cv || !dev || !dev.steps.length) return;
  const len = stepLen();
  rollFit(len);
  const lo = RV.lo, rows = RV.rows, hi = lo + rows - 1;
  const avail = Math.max(320, cv.parentElement.clientWidth || 800);
  const cw = Math.max(12, Math.floor((avail - ROLL_LAB) / len));
  const W = ROLL_LAB + cw * len, H = rows * ROLL_ROW, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d"), C = rollColors();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  RV.geo = { lo, hi, cw, len };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.font = '16px "BoopBox Terminus", monospace'; g.textBaseline = "top";
  for (let r = 0; r < rows; r++) {
    const p = hi - r, black = [1, 3, 6, 8, 10].includes(p % 12);
    g.fillStyle = black ? C.s1 : C.s2; g.fillRect(ROLL_LAB, r * ROLL_ROW, W - ROLL_LAB, ROLL_ROW - 1);
    if (p % 12 === 0) { g.fillStyle = C.dim; g.fillText(noteName(p), 2, r * ROLL_ROW); }
  }
  const per = ROLL.DIV_PER_BAR[curDiv()], beat = per / 4;
  for (let i = 0; i <= len; i++) {
    const bar = per >= 1 && i % per === 0, bt = Number.isInteger(beat) && beat >= 1 && i % beat === 0;
    if (!bar && !bt) continue;
    g.fillStyle = bar ? C.dim : C.s3; g.fillRect(ROLL_LAB + i * cw - (bar ? 1 : 0), 0, bar ? 2 : 1, H);
  }
  for (const c of ROLL.chords(dev.steps, len)) {
    const dur = RV.drag && RV.drag.at === c.at ? RV.drag.dur : c.dur, acc = dev.steps[c.at].flags & 1;
    const x = ROLL_LAB + c.at * cw + 1, w = dur * cw - 2;
    for (const p of c.notes) {
      g.fillStyle = C.trk;
      if (p > hi || p < lo) { g.fillRect(x, p > hi ? 0 : H - 3, w, 3); continue; }   /* (outside the view: a mark at its edge) */
      const y = (hi - p) * ROLL_ROW + 1;
      g.fillRect(x, y, w, ROLL_ROW - 3);
      if (acc) { g.fillStyle = C.fg; g.fillRect(x, y, w, 2); }
      g.fillStyle = C.bg; g.fillRect(x + w - 4, y + 3, 1, ROLL_ROW - 9);   /* the grip: drag the end */
    }
  }
}
function Roll() {
  useApp();
  const cv = useRef(null);
  rollFit(stepLen());
  /* drawn after every render: the steps, LEN, DIV, the view or the selected track's colour may have changed */
  useEffect(() => { drawRoll(cv.current); });
  useEffect(() => {
    const r = () => drawRoll(cv.current);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const rollAt = (e) => {
    const G = RV.geo, r = cv.current.getBoundingClientRect();
    if (!G) return null;
    const x = e.clientX - r.left - ROLL_LAB, y = e.clientY - r.top;
    const i = Math.floor(x / G.cw), p = G.hi - Math.floor(y / ROLL_ROW);
    return { i, p, fx: x / G.cw - i, inside: x >= 0 && i >= 0 && i < G.len && p >= G.lo && p <= G.hi };
  };
  const down = (e) => {
    if (!A.dev || roll.writing) return;
    const h = rollAt(e);
    if (!h || !h.inside) return;
    const c = rollNoteAt(h), len = stepLen();
    if (c) {
      if (h.i === c.at + c.dur - 1 && h.fx > 0.55) {      /* the end of a note: drag its length */
        RV.drag = { at: c.at, dur: c.dur };
        cv.current.setPointerCapture(e.pointerId);
        drawRoll(cv.current);
        return;
      }
      rollApply(ROLL.remove(A.dev.steps, len, c.at, h.p));
      return;
    }
    rollApply(ROLL.place(A.dev.steps, len, h.i, h.p, ROLL.steps(RV.frac, curDiv())));
  };
  const move = (e) => {
    const h = rollAt(e);
    if (RV.drag) {
      if (!h) return;
      const d = Math.max(1, Math.min(stepLen() - RV.drag.at, h.i - RV.drag.at + 1));
      if (d !== RV.drag.dur) { RV.drag.dur = d; drawRoll(cv.current); }
      return;
    }
    const c = h && h.inside ? rollNoteAt(h) : null;
    cv.current.style.cursor = c && h.i === c.at + c.dur - 1 && h.fx > 0.55 ? "ew-resize" : "pointer";
  };
  const drop = () => {
    if (!RV.drag) return;
    const d = RV.drag;
    RV.drag = null;
    rollApply(ROLL.resize(A.dev.steps, stepLen(), d.at, d.dur));
  };
  return (
    <div id="roll">
      <p className="bar">
        <span className="dim">{t("rollLen")}</span>{" "}
        <span className="seg" id="rolllen">
          {ROLL.LENGTHS.map(([k, f]) => (
            <button key={k} type="button" data-f={String(f)} aria-pressed={f === RV.frac ? "true" : "false"}
              onClick={() => { RV.frac = f; notify(); }}>{t("len_" + k)}</button>
          ))}
        </span>
        <button type="button" id="rolldown" onClick={() => rollShift(-12)}>{t("rollDown")}</button>{" "}
        <span className="dim" id="rollrange">{RV.lo != null ? `${noteName(RV.lo)} – ${noteName(RV.lo + RV.rows - 1)}` : ""}</span>{" "}
        <button type="button" id="rollup" onClick={() => rollShift(12)}>{t("rollUp")}</button>
      </p>
      <div className="my-2 overflow-x-auto border border-line">
        <canvas id="rollcv" ref={cv} className="block touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={drop}
          onPointerCancel={() => { RV.drag = null; drawRoll(cv.current); }} />
      </div>
      <p className="dim">{t("rollHelp")}</p>
    </div>
  );
}

/* ------------------------------------------------- the MIDI file's preview --- */
function MidiPrev() {
  const { dev } = useApp();
  const MI = MIDI.MI;
  if (!MI || !dev || !dev.dump) return null;
  const srcs = MI.smf.tracks.map((x, k) => [x, k]).filter(([x]) => x.notes.length);
  const box = "my-2 mb-4 border border-line p-3";
  const cancel = <button type="button" onClick={midiCancel}>{t("midiCancel")}</button>;
  if (!srcs.length) {
    return (
      <div className={box} id="midiprev">
        <h3>{`${t("midiPreview")}: ${MI.name}`}</h3>
        <p>{t("midiNoNotes")}</p>
        <p className="bar">{cancel}</p>
      </div>
    );
  }
  if (!srcs.some(([, k]) => k === MI.src)) MI.src = srcs[0][1];
  const plan = midiPlan(), R = plan.report;
  const dd = dev.pdesc[pDiv()], divName = dd && dd.names && dd.names[curDiv()] ? dd.names[curDiv()] : "";
  const info = [tf("midiNotes", { n: R.notes }), tf("midiGrid", { div: divName }), tf("midiSteps", { n: plan.len, max: dev.info.nstep })];
  const warn = [];
  if (R.moved) warn.push(tf("midiMoved", { n: R.moved }));
  if (R.chordCut) warn.push(tf("midiChord", { n: R.chordCut }));
  if (R.overlap) warn.push(tf("midiOverlap", { n: R.overlap }));
  if (R.merged) warn.push(tf("midiMerged", { n: R.merged }));
  if (R.dropped) warn.push(tf("midiDropped", { n: R.dropped, max: dev.info.nstep }));
  const ul = "my-1.5 pl-5";
  return (
    <div className={box} id="midiprev">
      <h3>{`${t("midiPreview")}: ${MI.name}`}</h3>
      <p className="bar">
        <span>{t("midiSource")}</span>
        <select value={MI.src} onChange={(e) => { MI.src = +e.target.value; MI.setlen = true; notify(); }}>
          {srcs.map(([x, k]) => <option key={k} value={k}>{`${k + 1}: ${x.name || t("midiTrack")} (${x.notes.length})`}</option>)}
        </select>
      </p>
      <ul className={ul}>{info.map((s) => <li key={s}>{s}</li>)}</ul>
      {warn.length
        ? <ul className={`${ul} warn [&_li]:text-t3`}>{warn.map((s) => <li key={s}>{s}</li>)}</ul>
        : <p className="dim">{t("midiClean")}</p>}
      <p className="dim">{t(midiDrum() ? "midiHowDrum" : "midiHow")}</p>
      <p className="bar">
        <label><input type="checkbox" id="midisetlen" checked={MI.setlen} onChange={(e) => { MI.setlen = e.target.checked; notify(); }} />
          {" " + tf("midiSetLen", { n: plan.len })}</label>
        <button type="button" className="pri" onClick={midiImport}>{t("midiImport")}</button>
        {cancel}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- the drum lanes --- */
function DrumBar() {
  const { dev } = useApp();
  const kd = kitDesc();
  const seg = (label, vals, name, k) => (
    <span className="seg" role="group" aria-label={label}>
      {vals.map((v) => (
        <button key={v} type="button" data-k={k} data-v={v} aria-pressed={paint[k] === v ? "true" : "false"}
          onClick={() => setPaint(k, v)}>{name(v)}</button>
      ))}
    </span>
  );
  return (
    <div className="bar" id="drumbar">
      <label hidden={!kd}>{t("kit") + " "}
        <Field as="select" id="drumkit" title={t("kit")} value={dev.dump.p[dev.info.pe0]} onCommit={(e) => setKit(+e.value)}>
          {kd ? kd.names.map((n, i) => <option key={i} value={i + kd.min}>{n}</option>) : null}
        </Field>
      </label>
      <span className="dim">{t("hitLevel")}</span>
      {seg(t("hitLevel"), LV_ORDER, (v) => LV_NAMES[v], "lvl")}
      <span className="dim">{t("ratchet")}</span>
      {seg(t("ratchet"), [0, 1, 2, 3], (v) => "x" + (v + 1), "rat")}
    </div>
  );
}
const LVC = ["bg-t4", "bg-[color-mix(in_srgb,var(--t4)_35%,var(--s2))]", "bg-[color-mix(in_srgb,var(--t4)_65%,var(--s2))]", "bg-fg"];
function DrumGrid() {
  const { dev } = useApp();
  const len = stepLen(), cols = Math.min(16, len);
  const kids = [];
  for (let b0 = 0; b0 < len; b0 += 16) {
    if (b0) kids.push(<span key={`g${b0}`} className="col-span-full h-3" />);
    kids.push(<span key={`h${b0}`} className="text-dim" />);
    for (let i = b0; i < b0 + cols; i++) kids.push(<span key={`h${b0}:${i}`} className="text-dim">{i < len && i % 4 === 0 ? String(i + 1) : ""}</span>);
    for (let l = 0; l < 16; l++) {
      kids.push(<span key={`l${b0}:${l}`} className="self-center pr-2.5 whitespace-nowrap lowercase text-fg2">{DRUM_LANES[l][1]}</span>);
      for (let i = b0; i < b0 + cols; i++) {
        if (i >= len) { kids.push(<span key={`${i}:${l}`} />); continue; }
        const d = dev.dsteps[i], on = !!d && ((d.on >> l) & 1) === 1;
        kids.push(
          <button key={`${i}:${l}`} type="button" data-i={i} data-l={l} onClick={(e) => drumClick(i, l, e.shiftKey)}
            title={`${i + 1} ${DRUM_LANES[l][1]}${on ? ` ${LV_NAMES[d.lvl[l]]} x${d.rat[l] + 1}` : ""}`}
            className={`h-[22px] min-w-[18px] p-0 text-center leading-[22px] text-black hover:outline-1 hover:outline-dim
              ${on ? `on l${d.lvl[l]} ${LVC[d.lvl[l]] || "bg-t4"}` : i % 4 === 0 ? "beat bg-s3" : "bg-s2 hover:bg-s3"}`}>
            {on && d.rat[l] ? String(d.rat[l] + 1) : ""}
          </button>,
        );
      }
    }
  }
  return (
    <div id="drumgrid" className="mt-2 mb-4 grid gap-0.5 overflow-x-auto" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(16px, 1fr))` }}>
      {kids}
    </div>
  );
}

/* ------------------------------------------------- the selected step's detail --- */
function LockRow({ i, l }) {
  const { dev } = useApp();
  const d = dev.pdesc[l.param] || { min: -8192, max: 8191, fmt: 0, names: [] };
  const ids = lockableIds();
  return (
    <tr>
      <td>
        <Field as="select" value={l.param} onCommit={(e) => changeLockParam(i, l.param, +e.value)}>
          {ids.map((id) => <option key={id} value={id}>{lockName(id)}</option>)}
        </Field>
      </td>
      <td>
        {d.fmt === F.ENUM && d.names.length ? (
          <Field as="select" key={"e" + l.param} value={l.value} onCommit={(e) => writeLock(i, l.param, +e.value)}>
            {d.names.map((n, k) => <option key={k} value={k + d.min}>{n}</option>)}
          </Field>
        ) : (
          <Field key={"n" + l.param} type="number" min={d.min} max={d.max} value={l.value} className="w-[70px]"
            onCommit={(e) => writeLock(i, l.param, +e.value)} />
        )}
      </td>
      <td className="dim">{fmtValue(d, l.value).join("")}</td>
      <td><button type="button" title={t("delete")} onClick={() => writeLock(i, l.param, null)}>{"×"}</button></td>
    </tr>
  );
}
function StepDetail() {
  const { dev } = useApp();
  if (!hasLocks() || !dev.micro) return null;
  const len = stepLen(), i = Math.min(SQ.sel, len - 1);
  if (i !== SQ.sel) SQ.sel = i;
  const locks = dev.locks.filter((l) => l.step === i);
  return (
    <div id="stepdetail" className="mb-4 border-t border-line pt-3">
      <p className="bar">
        <label>{t("stepDetail") + " "}
          <Field type="number" id="sdstep" min="1" max={len} title={t("stepDetail")} value={i + 1} className="w-[70px]"
            onCommit={(e) => selectStep(Math.max(0, Math.min(stepLen() - 1, (+e.value || 1) - 1)))} />
        </label>
        <label>{t("nudge") + " "}
          <Field type="number" id="sdnudge" min={MICRO.MIN} max={MICRO.MAX} title={t("nudge")} value={dev.micro[i] || 0} className="w-[70px]"
            onCommit={(e) => writeMicro(SQ.sel, +e.value || 0)} />
        </label>
        {hasFill() ? (
          <label>{t("fillCond") + " "}
            <Field as="select" id="sdfill" title={t("fillCond")} value={dev.fill ? stepFill(i) : null} onCommit={(e) => writeFill(SQ.sel, +e.value || 0)}>
              {["fcNorm", "fcFill", "fcNoFill"].map((k, c) => <option key={k} value={c}>{t(k)}</option>)}
            </Field>
          </label>
        ) : null}
        <span className="dim">{t("locks")}</span>
        <button type="button" id="sdadd" disabled={!canAddLock(i)} onClick={() => addLock(SQ.sel)}>{t("addLock")}</button>
      </p>
      <table id="sdlocks">
        <tbody>
          {locks.length ? locks.map((l) => <LockRow key={l.param} i={i} l={l} />) : <tr><td className="dim">{t("noLock")}</td></tr>}
        </tbody>
      </table>
      <p className="dim">{t("lockHelp")}</p>
    </div>
  );
}

/* ------------------------------------------------------------ the page --- */
function Steps() {
  const { dev } = useApp();
  const has = dev.steps.length > 0;
  const dg = has && drumView();
  const len = stepLen();
  const synth = !isDrum();
  const rollOn = has && !dg && synth && RV.view === "roll";   /* (2.5) the piano roll instead of the tiles */
  return (
    <Card id="steps" className="mt-4" title={t("steps")} ic="note_eight" sub={has ? tf("stepsOf", { n: len }) : ""}>
      <p className="bar">
        <button type="button" id="reloadsteps" onClick={reloadSteps}><Ic ic="control_arrow_loop">{t("reload")}</Ic></button>
        <button type="button" id="clearseq" className="warn" onClick={clearSeq}><Ic ic="symbol_trash">{t("clearSeq")}</Ic></button>
        <span className="dim" id="noteshelp">{has ? t(dg ? "drumGridHelp" : isDrum() ? "drumHelp" : "notesHelp") : ""}</span>
      </p>
      <p className="bar seqtools">
        <span>{t("lenLabel")}</span>
          <button type="button" id="lenminus" className="min-w-[34px] px-2" onClick={() => setLen(stepLen() - 1)}>&minus;</button>
          <Field type="number" id="lenval" min="1" max={dev.info.nstep} value={len} className="w-16 text-center"
            onCommit={(e) => { setLen(+e.value); e.value = String(Math.max(1, Math.min(A.dev.info.nstep, Math.round(+e.value) || 1))); }} />
          <button type="button" id="lenplus" className="min-w-[34px] px-2" onClick={() => setLen(stepLen() + 1)}>+</button>
        <span className="seg" id="viewseg" hidden={!synth}>
          <button type="button" data-v="grid" aria-pressed={RV.view === "grid" ? "true" : "false"} onClick={() => setView("grid")}>{t("viewGrid")}</button>
          <button type="button" data-v="roll" aria-pressed={RV.view === "roll" ? "true" : "false"} onClick={() => setView("roll")}>{t("viewRoll")}</button>
        </span>
        <button type="button" id="midiexp" onClick={midiExport}><Ic ic="symbol_download">{t("midiExport")}</Ic></button>
        <button type="button" id="midiimp" onClick={async () => midiOpen(await pickFile(".mid,.midi,audio/midi"))}>
          <Ic ic="symbol_upload">{t("midiImportBtn")}</Ic>
        </button>
      </p>
      <MidiPrev />
      {dg ? <DrumBar /> : null}
      {dg ? <DrumGrid /> : null}
      {has && !dg && !rollOn ? <StepGrid /> : null}
      {rollOn ? <Roll /> : null}
      {has ? <StepDetail /> : null}
      <details className="seq-more" id="steplist" hidden={!has || dg} ref={(e) => { listEl = e; }}>
        <summary>{t("stepList")}</summary>
        {has && !dg ? <StepTables /> : null}
      </details>
    </Card>
  );
}

export default function Sequencer() {
  const { dev } = useApp();
  if (!dev || !dev.dump) return null;
  return (
    <>
      <ParamGroups where="seqgroups" />
      <Steps />
    </>
  );
}
