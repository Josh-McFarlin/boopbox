// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The Sequencer page: a toolbar (the pattern's timing: LEN, DIV, swing, gate; the view; MIDI files in and out; reload,
// clear), then the selected track's steps in one of three views: Steps (the step grid, or on the drum track (v5) its 16
// lanes, with the step inspector beside it: sequencer/Inspector.jsx), Piano roll (sequencer/Roll.jsx) and List (a row a
// step to type in). The logic is in sequencer/seq.js.
import { useEffect, useRef } from "react";
import { DRUM_LANES, LV_NAMES, LV_ORDER } from "../lib/proto.ts";
import { A, hasLocks, isDrum, notify, pById, pSlen, pickFile, t, tf, useApp } from "../core/app.ts";
import { H } from "../core/hooks.ts";
import { Card, Ic, Param } from "../ui/kit.tsx";
import Field from "./sequencer/Field.tsx";
import Inspector from "./sequencer/Inspector.tsx";
import Roll from "./sequencer/Roll.tsx";
import {
  MIDI, RV, SQ, TIMES, clearSeq, curDiv, drumClick, drumDouble, drumSet, drumView, gridClick, gridDouble, kitDesc, midiCancel,
  midiDrum, midiExport, midiImport, midiOpen, midiPlan, moveSel, pDiv, paint, refreshLocks, reloadSteps, restStep, selectStep,
  setKit, setPaint, setView, stepFill, stepLen, stepLocked, stepNotes, writeStep,
} from "./sequencer/seq.ts";
import "./sequencer/seq.css";

export function init() {
  Object.assign(H, { refreshLocks });
}

/* the marks a step shows: > accent, ~ slide, ▪ a lock or a nudge, F only in fills, × not in fills */
const MARK = { acc: ">", slide: "~", lock: "▪", fill: "F", nofill: "×" };
const focusCell = (sel) => requestAnimationFrame(() => { const b = document.querySelector(sel); if (b) b.focus({ preventScroll: false }); });

/* ------------------------------------------------------- the step grid --- */
/* one cell per step up to LEN: a click on an empty step adds a note, on a note selects it (the inspector shows it), a
   double click or Delete makes it a rest; the arrow keys move the selection */
function StepGrid() {
  const { dev } = useApp();
  const len = stepLen();
  const cells = [];
  for (let i = 0; i < len; i++) {
    const s = dev.steps[i];
    const on = !!s && s.n > 0 && s.time === 0, tie = !!s && s.time === 1;
    const txt = on ? stepNotes(s) : "";
    const acc = on && s.flags & 1, sl = on && s.flags & 2;
    const lk = stepLocked(i), fc = stepFill(i), sel = i === SQ.sel;
    const marks = (acc ? " " + MARK.acc : "") + (sl ? " " + MARK.slide : "");
    const what = on ? txt : tie ? t("sqTTie") : t("sqTRest");
    cells.push(
      <button key={i} type="button" data-i={i} aria-pressed={sel} onClick={() => gridClick(i)} onDoubleClick={() => gridDouble(i)}
        title={`${tf("sqStep", { n: i + 1 })}: ${what}${acc ? " · " + t("acc") : ""}${sl ? " · " + t("slide") : ""}${lk ? " · " + t("sqLegLock") : ""}${fc ? " · " + t(fc === 1 ? "sqLegFill" : "sqLegNoFill") : ""}`}
        style={{ boxShadow: [acc ? "inset 0 3px var(--fg)" : "", sel ? "inset 0 0 0 2px var(--bg)" : ""].filter(Boolean).join(", ") || undefined }}
        className={`relative flex h-24 min-w-0 flex-col justify-start gap-0.5 overflow-hidden px-[5px] py-1 text-left normal-case
          ${on ? "on bg-trk hover:brightness-110" : tie ? "tie bg-[repeating-linear-gradient(-45deg,var(--s2)_0_6px,var(--s3)_6px_8px)] hover:bg-s3" : "bg-s2 hover:bg-s3"}
          ${i % 4 === 0 ? "beat" : ""} ${lk ? "lk" : ""} ${fc ? "fc" + fc : ""} ${acc ? "acc" : ""}
          ${sel ? "sel outline-2 outline-offset-2 outline-acc" : ""}`}>
        <span className={`whitespace-nowrap ${on ? "text-black" : i % 4 === 0 ? "text-dim" : "text-s3"}`}>
          {fc === 1 ? MARK.fill + " " : fc === 2 ? MARK.nofill + " " : ""}{String(i + 1) + marks}{lk ? " " + MARK.lock : ""}
        </span>
        <span className={`flex flex-col text-[13px] leading-[14px] ${on ? "text-black" : "text-dim"}`}>
          {on ? txt.split(" ").map((n, k) => <span key={k} className="truncate">{n}</span>) : null}</span>
        {on ? <span aria-hidden="true" className="absolute bottom-1 left-[5px] h-1 bg-black/40" style={{ width: `calc((100% - 10px) * ${s.vel / 127})` }} /> : null}
      </button>,
    );
  }
  const key = (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -16, ArrowDown: 16 }[e.key];
    if (d) { e.preventDefault(); focusCell(`#stepgrid [data-i="${moveSel(d)}"]`); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); restStep(SQ.sel); }
  };
  return <div id="stepgrid" className="grid grid-cols-16 gap-1" onKeyDown={key}>{cells}</div>;
}

/* the marks in words, under the grid */
function Legend({ drum }) {
  const item = (mark, k) => (
    <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">{mark}<span>{t(k)}</span></span>
  );
  const box = (cls) => <span aria-hidden="true" className={`inline-block h-3.5 w-5 ${cls}`} />;
  return (
    <div id="seqlegend" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-dim">
      <span className="text-fg2">{t("sqLegend")}</span>
      {drum ? null : item(<b className="text-fg">{MARK.acc}</b>, "sqLegAcc")}
      {drum ? null : item(<b className="text-fg">{MARK.slide}</b>, "sqLegSlide")}
      {hasLocks() ? item(<b className="text-fg">{MARK.lock}</b>, "sqLegLock") : null}
      {hasLocks() ? item(<b className="text-fg">{MARK.fill}</b>, "sqLegFill") : null}
      {hasLocks() ? item(<b className="text-fg">{MARK.nofill}</b>, "sqLegNoFill") : null}
      {drum ? null : item(<span aria-hidden="true" className="inline-flex h-3.5 w-5 items-end bg-trk p-0.5"><span className="h-1 w-3 bg-black/40" /></span>, "sqLegVel")}
      {drum ? null : item(box("bg-[repeating-linear-gradient(-45deg,var(--s2)_0_4px,var(--s3)_4px_6px)]"), "sqLegTie")}
      {item(box("outline-2 outline-offset-1 outline-acc"), "sqLegSel")}
    </div>
  );
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
    const send = async () => {
      const ok = await writeStep(i, { notes: c.notes.value, time: c.time.value, acc: c.acc.checked, sl: c.sl.checked, vel: c.vel.value });
      if (!ok) { c.notes.classList.add("bad"); c.msg.hidden = false; return; }
      c.notes.classList.remove("bad");
      c.msg.hidden = true;
      if (!c.tr.contains(document.activeElement) || document.activeElement === c.notes) setTimeout(() => cur.current(), 0);
    };
    const els = [c.notes, c.time, c.acc, c.sl, c.vel];
    for (const e of els) e.addEventListener("change", send);
    return () => { for (const e of els) e.removeEventListener("change", send); };
  }, [i, c]);
  const off = !s || !s.n || s.time === 2;
  return (
    <tr ref={(e) => { c.tr = e; }} data-i={i} onFocus={() => selectStep(i)}
      className={`${off ? "off [&_td]:text-s3" : ""} ${i === SQ.sel ? "[&_td.i]:text-acc" : ""}`}>
      <td className="i">{i + 1}</td>
      <td>
        <input ref={(e) => { c.notes = e; }} type="text" placeholder={t("sqTRest")} spellCheck="false" title={t("sqTypeTip")}
          className="w-[150px] [&.bad]:border-red [&.bad]:text-red" />
        <span ref={(e) => { c.msg = e; }} hidden className="ml-2 text-[14px] text-red">{t(isDrum() ? "sqBadDrums" : "sqBadNotes")}</span>
      </td>
      <td><select ref={(e) => { c.time = e; }} title={t("sqTNoteTip")}>{TIMES.map((n, k) => <option key={k} value={k}>{t(["sqTNote", "sqTTie", "sqTRest"][k])}</option>)}</select></td>
      <td><input ref={(e) => { c.acc = e; }} type="checkbox" title={t("sqAccTip")} /></td>
      <td><input ref={(e) => { c.sl = e; }} type="checkbox" title={t("sqSlideTip")} /></td>
      <td><input ref={(e) => { c.vel = e; }} type="number" min="0" max="127" title={t("sqVelTip")} className="w-[64px]" /></td>
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
          <tr><th /><th>{t("notes")}</th><th>{t("sqType")}</th><th>{t("acc")}</th><th>{t("slide")}</th><th>{t("vel")}</th></tr>
          {rws}
        </tbody>
      </table>,
    );
  }
  return (
    <div id="steplist">
      <p className="help mt-0 text-dim">{t(isDrum() ? "sqListHintDrum" : "sqListHint")}</p>
      <div id="steptables" className="columns-[560px] gap-8">{tables}</div>
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
      <span className="text-dim">{t("sqNewHits")}:</span>
      <span className="text-dim">{t("hitLevel")}</span>
      {seg(t("hitLevel"), LV_ORDER, (v) => LV_NAMES[v], "lvl")}
      <span className="text-dim">{t("ratchet")}</span>
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
    for (let i = b0; i < b0 + cols; i++) {
      const lk = i < len && stepLocked(i), fc = i < len ? stepFill(i) : 0;
      kids.push(
        <span key={`h${b0}:${i}`} className={`whitespace-nowrap text-[14px] ${i === SQ.sel ? "text-acc" : "text-dim"}`}>
          {i < len ? (fc === 1 ? MARK.fill : fc === 2 ? MARK.nofill : "") + (i % 4 === 0 || i === SQ.sel ? String(i + 1) : "") + (lk ? MARK.lock : "") : ""}
        </span>,
      );
    }
    for (let l = 0; l < 16; l++) {
      kids.push(<span key={`l${b0}:${l}`} className={`self-center pr-2.5 whitespace-nowrap lowercase ${l === SQ.lane ? "text-acc" : "text-fg2"}`}>{DRUM_LANES[l][1]}</span>);
      for (let i = b0; i < b0 + cols; i++) {
        if (i >= len) { kids.push(<span key={`${i}:${l}`} />); continue; }
        const d = dev.dsteps[i], on = !!d && ((d.on >> l) & 1) === 1, sel = i === SQ.sel && l === SQ.lane;
        kids.push(
          <button key={`${i}:${l}`} type="button" data-i={i} data-l={l} aria-pressed={on}
            onClick={(e) => drumClick(i, l, e.shiftKey)} onDoubleClick={() => drumDouble(i, l)}
            title={`${i + 1} ${DRUM_LANES[l][1]}${on ? ` ${LV_NAMES[d.lvl[l]]} x${d.rat[l] + 1}` : ""}`}
            className={`h-[22px] min-w-[18px] p-0 text-center leading-[22px] text-black hover:outline-1 hover:outline-dim
              ${on ? `on l${d.lvl[l]} ${LVC[d.lvl[l]] || "bg-t4"}` : i === SQ.sel ? "bg-s3" : i % 4 === 0 ? "beat bg-s3/70" : "bg-s2 hover:bg-s3"}
              ${sel ? "outline-2! outline-offset-1 outline-acc!" : ""}`}>
            {on && d.rat[l] ? String(d.rat[l] + 1) : ""}
          </button>,
        );
      }
    }
  }
  const key = (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) {
      e.preventDefault();
      SQ.lane = Math.max(0, Math.min(15, (SQ.lane < 0 ? 0 : SQ.lane) + d[1]));
      focusCell(`#drumgrid [data-i="${moveSel(d[0])}"][data-l="${SQ.lane}"]`);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && SQ.lane >= 0) { e.preventDefault(); drumSet(SQ.sel, SQ.lane, { on: false }); }
  };
  return (
    <div id="drumgrid" className="grid gap-0.5 overflow-x-auto" onKeyDown={key} style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(16px, 1fr))` }}>
      {kids}
    </div>
  );
}

/* ------------------------------------------------------------ the toolbar --- */
const VIEWS = [["grid", "sqViewSteps", "sqViewStepsTip"], ["roll", "sqViewRoll", "sqViewRollTip"], ["list", "sqViewList", "sqViewListTip"]];
/* the views this track has (and why not the others) */
function viewWhy(v) {
  if (v === "roll" && isDrum()) return t("sqRollWhyDrum");
  if (v === "list" && drumView()) return t("sqListWhyDrum");
  return "";
}
const curView = () => (viewWhy(RV.view) ? "grid" : RV.view);
function Toolbar() {
  const { dev } = useApp();
  const has = dev.steps.length > 0;
  const view = curView();
  /* the pattern's timing (LAYOUT "SEQ TIMING": LEN, DIV, SWG, GATE), as the device's knobs, in one row */
  const ids = [pSlen(), pDiv(), pById("SWG", 31), pById("GATE", 32)];
  return (
    <div id="seqbar" data-card="" className="mb-4 flex min-w-0 items-stretch gap-4 border border-line bg-s1 px-4 py-2">
      <div id="seqtiming" className="grid min-w-0 flex-1 grid-cols-4 [&>div]:border-l [&>div]:pl-2.5 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0">
        {ids.map((id, k) => <Param key={id} s={0} id={id} index={k} ctx="SEQ TIMING" />)}
      </div>
      <div className="flex flex-none flex-col justify-center gap-2 border-l border-line pl-4">
        <div className="flex items-center gap-2">
          <span className="text-dim">{t("sqView")}</span>
          <span className="seg" id="viewseg" role="group" aria-label={t("sqView")}>
            {VIEWS.map(([v, k, tip]) => (
              <button key={v} type="button" data-v={v} aria-pressed={view === v ? "true" : "false"} disabled={!has || !!viewWhy(v)}
                title={viewWhy(v) || t(tip)} onClick={() => setView(v)}>{t(k)}</button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" id="midiimp" onClick={async () => midiOpen(await pickFile(".mid,.midi,audio/midi"))}>
            <Ic ic="symbol_upload">{t("midiImportBtn")}</Ic></button>
          <button type="button" id="midiexp" onClick={midiExport}><Ic ic="symbol_download">{t("midiExport")}</Ic></button>
          <button type="button" id="reloadsteps" title={t("sqReloadTip")} onClick={reloadSteps}><Ic ic="control_arrow_loop">{t("reload")}</Ic></button>
          <button type="button" id="clearseq" className="warn" title={t("sqClearTip")} onClick={clearSeq}><Ic ic="symbol_trash">{t("clearSeq")}</Ic></button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the page --- */
function Steps() {
  const { dev } = useApp();
  const has = dev.steps.length > 0;
  const dg = has && drumView();
  const len = stepLen();
  const view = curView();
  return (
    <Card id="steps" title={t("steps")} ic="note_eight" sub={has ? tf("stepsOf", { n: len }) : ""}>
      <MidiPrev />
      {has && view === "grid" ? (
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {dg ? <DrumBar /> : null}
            {dg ? <DrumGrid /> : <StepGrid />}
            <Legend drum={dg} />
            <p className="help mt-2 mb-0 text-[14px] text-dim" id="noteshelp">{t(dg ? "sqDrumHint" : "sqGridHint")}</p>
          </div>
          <Inspector />
        </div>
      ) : null}
      {has && view === "roll" ? <Roll /> : null}
      {has && view === "list" ? <StepTables /> : null}
    </Card>
  );
}

export default function Sequencer() {
  const { dev } = useApp();
  if (!dev || !dev.dump) return null;
  return (
    <>
      <Toolbar />
      <Steps />
    </>
  );
}
