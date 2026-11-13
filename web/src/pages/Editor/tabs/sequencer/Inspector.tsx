// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The Sequencer page's step inspector, beside the grid: the selected step's notes (chips, a two-octave piano, a field to
// type them), its type (note, hold previous, rest), velocity, accent and slide; on the drum grid its 16 sounds; then its
// nudge, when it plays (fills) and its parameter locks (v7, v8). The logic is in seq.js.
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";
import type { Lock, Step } from "../../lib/proto.ts";
import { DRUM_LANES, F, FC, LV_NAMES, LV_ORDER, MICRO, drumName, fmtValue, noteName, parseNotes } from "../../lib/proto.ts";
import { hasFill, hasLocks, isDrum, readyDev, t, tf, useApp } from "../../core/app.ts";
import { More } from "../../ui/kit.tsx";
import { bar, seg, tog } from "../../ui/styles.ts";
import Field from "./Field.tsx";
import { StepComponents } from "../patterns/StepComponents.tsx";
import {
  SQ, addLock, canAddLock, changeLockParam, drumSet, drumView, lockName, lockableIds, moveSel, notesOf, paint, setFlag,
  setNotes, setTime, setVel, stepFill, stepLen, toggleNote, writeFill, writeLock, writeMicro,
} from "./seq.ts";

interface HeadProps { children?: ReactNode; extra?: ReactNode }
const Head = ({ children, extra }: HeadProps) => (
  <h3 className="mt-4 mb-1.5 flex items-center gap-2 text-dim first:mt-0">{children}{extra ? <span className="ml-auto text-[14px]">{extra}</span> : null}</h3>
);
const BLACK = [1, 3, 6, 8, 10];

/* --------------------------------------------------- the two-octave piano --- */
/* the piano's lowest C, kept while the same step stays selected (it follows a newly selected step's notes) */
const KB: { base: number; step: number; trk: number | undefined } = { base: 48, step: -1, trk: -1 };
interface PianoProps { i: number; notes: number[]; onKey: (p: number) => void }
function Piano({ i, notes, onKey }: PianoProps) {
  useApp();
  const dev = readyDev();
  if (KB.step !== i || KB.trk !== dev.sel) {
    KB.step = i; KB.trk = dev.sel;
    const ref = notes.length ? notes : [SQ.last ?? 60];
    if (ref.some((n) => n < KB.base || n >= KB.base + 24)) KB.base = Math.max(0, Math.min(96, Math.floor(Math.min(...ref) / 12) * 12));
  }
  const [, redraw] = useState(0);
  const shift = (d: number) => { KB.base = Math.max(0, Math.min(96, KB.base + d)); redraw((x) => x + 1); };
  const whites: ReactNode[] = [], blacks: ReactNode[] = [];
  let w = 0;
  for (let p = KB.base; p < KB.base + 24 && p < 128; p++) {
    const on = notes.includes(p), black = BLACK.includes(p % 12);
    const key = (
      <button key={p} type="button" data-note={p} aria-pressed={on} title={tf("sqKeyTip", { n: noteName(p) })} aria-label={noteName(p)}
        onClick={() => onKey(p)}
        className={black
          ? `absolute top-0 z-10 h-[58%] w-[4.6%] -translate-x-1/2 border border-bg p-0 ${on ? "bg-acc" : "bg-bg hover:bg-s3"}`
          : `relative flex h-full min-w-0 flex-1 items-end justify-center border-r border-bg p-0 pb-0.5 text-[12px] leading-3 normal-case text-black ${on ? "bg-acc" : "bg-fg2 hover:bg-fg"}`}
        style={black ? { left: `${(w / 14) * 100}%` } : undefined}>
        {!black && p % 12 === 0 ? noteName(p) : ""}
      </button>
    );
    if (black) blacks.push(key); else { whites.push(key); w++; }
  }
  return (
    <div id="sqpiano">
      <div className="mb-1 flex items-center gap-1">
        <button type="button" id="sqoctdown" className="h-6 w-7 p-0" disabled={KB.base <= 0} title={t("sqOctDown")} aria-label={t("sqOctDown")}
          onClick={() => shift(-12)}>‹</button>
        <span className="flex-1 text-center text-dim">{`${noteName(KB.base)} – ${noteName(Math.min(127, KB.base + 23))}`}</span>
        <button type="button" id="sqoctup" className="h-6 w-7 p-0" disabled={KB.base >= 96} title={t("sqOctUp")} aria-label={t("sqOctUp")}
          onClick={() => shift(12)}>›</button>
      </div>
      <div className="relative flex h-[84px] border border-bg select-none">{whites}{blacks}</div>
    </div>
  );
}

/* --------------------------------------------------- a synth step's notes --- */
interface NotesFieldProps { i: number; s: Step; drum: boolean }
function NotesField({ i, s, drum }: NotesFieldProps) {
  const text = s.n ? s.notes.slice(0, s.n).map(drum ? drumName : noteName).join(" ") : "";
  const [draft, setDraft] = useState<string | null>(null);   /* what is being typed (null: the step's notes) */
  const [sel, setSel] = useState(i);
  if (sel !== i) { setSel(i); setDraft(null); }
  const v = draft ?? (s.time === 0 ? text : "");
  const bad = v.trim() !== "" && !parseNotes(v);
  const commit = () => {
    if (draft == null) return;
    const ns = parseNotes(draft);
    if (!ns) return;
    setNotes(i, ns);
    setDraft(null);
  };
  return (
    <div className="mt-3">
      <label htmlFor="sqnotes" className="mb-1 block text-dim">{t("sqTyping")}</label>
      <input type="text" id="sqnotes" spellCheck="false" value={v} placeholder={drum ? "KICK CHH" : t("sqNotesPh")} title={t("sqTypeTip")}
        aria-invalid={bad} aria-describedby="sqnotesmsg" className={`w-full ${bad ? "border-red text-red" : ""}`}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setDraft(null); }} />
      <p id="sqnotesmsg" className={`mt-1 mb-0 text-[14px] leading-5 ${bad ? "text-red" : "text-dim"}`} role={bad ? "alert" : undefined}>
        {bad ? t(drum ? "sqBadDrums" : "sqBadNotes") : t("sqTypeTip")}</p>
    </div>
  );
}

const TYPES = [["sqTNote", "sqTNoteTip"], ["sqTTie", "sqTTieTip"], ["sqTRest", "sqTRestTip"]];
function NoteStep({ i, s }: { i: number; s: Step }) {
  const drum = isDrum();
  const notes = notesOf(s), name = drum ? drumName : noteName;
  const [full, setFull] = useState(false);
  const key = (p: number) => setFull(!toggleNote(i, p));
  const silent = s.time !== 0 || !s.n;
  return (
    <>
      <Head>{t("sqType")}</Head>
      <div className={clsx(seg, "grid! grid-cols-[1fr_1.5fr_1fr]")} id="sqtype" role="group" aria-label={t("sqType")}>
        {TYPES.map(([k, tip], v) => (
          <button key={k} type="button" data-v={v} aria-pressed={s.time === v} title={t(tip)} onClick={() => setTime(i, v)}
            className={clsx(tog, "px-1 whitespace-nowrap")}>{t(k)}</button>
        ))}
      </div>
      <Head extra={tf("sqNotesOf", { n: notes.length })}>{t("sqNotes")}</Head>
      <div id="sqchips" className="mb-2 flex min-h-8 flex-wrap gap-1">
        {notes.length ? notes.map((p) => (
          <button key={p} type="button" className={clsx(tog, "flex items-center gap-1.5 px-2 py-0.5 normal-case")} aria-pressed="true"
            title={tf("sqRemove", { n: name(p) })} aria-label={tf("sqRemove", { n: name(p) })} onClick={() => setNotes(i, notes.filter((x) => x !== p))}>
            {name(p)}<span aria-hidden="true">×</span></button>
        )) : <span className="self-center text-dim">{s.time === 1 ? t("sqTTieTip") : t("sqNoNotes")}</span>}
      </div>
      {drum ? null : <Piano i={i} notes={notes} onKey={key} />}
      {full && notes.length >= 4 ? <p className="mt-1 mb-0 text-[14px] text-t3" role="status">{t("sqFull")}</p> : null}
      <NotesField i={i} s={s} drum={drum} />
      <Head extra={silent ? "" : String(s.vel)}>{t("sqVel")}</Head>
      <input type="range" id="sqvel" min="0" max="127" step="1" value={silent ? 0 : s.vel} disabled={silent}
        title={silent ? t("sqVelWhy") : t("sqVelTip")} aria-label={t("sqVel")} className="w-full"
        style={{ "--a": "0%", "--p": `${((silent ? 0 : s.vel) / 127) * 100}%`, "--c": "var(--acc)" } as CSSProperties}
        onChange={(e) => setVel(i, +e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-1">
        <button type="button" id="sqacc" className={tog} aria-pressed={!!(s.flags & 1)} disabled={silent} title={silent ? t("sqVelWhy") : t("sqAccTip")}
          onClick={() => setFlag(i, 1, !(s.flags & 1))}>{"> " + t("acc")}</button>
        <button type="button" id="sqslide" className={tog} aria-pressed={!!(s.flags & 2)} disabled={silent} title={silent ? t("sqVelWhy") : t("sqSlideTip")}
          onClick={() => setFlag(i, 2, !(s.flags & 2))}>{"~ " + t("slide")}</button>
      </div>
    </>
  );
}

/* --------------------------------------------------- a drum step's sounds --- */
function DrumStep({ i }: { i: number }) {
  useApp();
  const d = readyDev().dsteps![i];
  if (!d) return null;
  const l = SQ.lane, on = (k: number) => ((d.on >> k) & 1) === 1;
  return (
    <>
      <Head>{t("sqSounds")}</Head>
      <div id="sqlanes" className="grid grid-cols-4 gap-1">
        {DRUM_LANES.map(([, nm], k) => (
          <button key={k} type="button" data-l={k} aria-pressed={on(k)} title={tf("sqSoundTip", { n: nm })}
            className={clsx(tog, "truncate px-1 text-[14px] lowercase", k === l && "outline-2 outline-offset-1 outline-fg")}
            onClick={() => { SQ.lane = k; drumSet(i, k, on(k) ? { on: false } : { on: true, lvl: paint.lvl, rat: paint.rat }); }}>{nm}</button>
        ))}
      </div>
      {l >= 0 && on(l) ? (
        <>
          <Head>{tf("sqHit", { n: DRUM_LANES[l][1].toLowerCase() })}</Head>
          <p className={bar}>
            <span className="text-dim">{t("hitLevel")}</span>
            <span className={seg} id="sqlevel">{LV_ORDER.map((v) => (
              <button key={v} type="button" className={tog} aria-pressed={d.lvl[l] === v} onClick={() => drumSet(i, l, { lvl: v })}>{LV_NAMES[v]}</button>
            ))}</span>
          </p>
          <p className={bar}>
            <span className="text-dim">{t("ratchet")}</span>
            <span className={seg} id="sqrat">{[0, 1, 2, 3].map((v) => (
              <button key={v} type="button" className={tog} aria-pressed={d.rat[l] === v} onClick={() => drumSet(i, l, { rat: v })}>{"x" + (v + 1)}</button>
            ))}</span>
          </p>
        </>
      ) : <p className="mt-2 mb-0 text-[14px] text-dim">{t("sqNoHit")}</p>}
    </>
  );
}

/* ------------------------------------- nudge, fills and parameter locks (v7, v8) --- */
function LockRow({ i, l }: { i: number; l: Lock }) {
  useApp();
  const d = readyDev().pdesc[l.param] || { min: -8192, max: 8191, fmt: 0, names: [] as string[], unit: "" };
  const ids = lockableIds();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_64px_52px_28px] items-center gap-1">
      <Field as="select" value={l.param} title={lockName(l.param)} className="min-w-0" onCommit={(e) => changeLockParam(i, l.param, +e.value)}>
        {ids.map((id) => <option key={id} value={id}>{lockName(id)}</option>)}
      </Field>
      {d.fmt === F.ENUM && d.names.length ? (
        <Field as="select" key={"e" + l.param} value={l.value} className="col-span-2 min-w-0" onCommit={(e) => writeLock(i, l.param, +e.value)}>
          {d.names.map((n, k) => <option key={k} value={k + d.min}>{n}</option>)}
        </Field>
      ) : (
        <>
          <Field key={"n" + l.param} type="number" min={d.min} max={d.max} value={l.value} className="w-full min-w-0"
            onCommit={(e) => writeLock(i, l.param, +e.value)} />
          <span className="truncate text-[14px] text-dim">{fmtValue(d, l.value).join("")}</span>
        </>
      )}
      <button type="button" className="h-7 p-0" title={t("delete")} aria-label={t("delete")} onClick={() => writeLock(i, l.param, null)}>×</button>
    </div>
  );
}
const PLAYS = [["sqPAlways", "sqPAlwaysTip"], ["sqPFill", "sqPFillTip"], ["sqPNoFill", "sqPNoFillTip"]];
function StepExtras({ i }: { i: number }) {
  useApp();
  const dev = readyDev();
  const m = dev.micro![i] || 0;
  const locks = dev.locks!.filter((l) => l.step === i);
  const fc = stepFill(i);
  return (
    <>
      <Head extra={m ? `${m > 0 ? "+" : ""}${m}/64` : ""}>{t("sqNudge")}</Head>
      <div className="flex items-center gap-1" id="sqnudge" title={t("sqNudgeTip")}>
        <button type="button" className="h-7 flex-1 px-1" disabled={m <= MICRO.MIN} onClick={() => writeMicro(i, Math.max(MICRO.MIN, m - 1))}>{"− " + t("sqEarlier")}</button>
        <button type="button" className="h-7 w-12 p-0" disabled={!m} title={t("sqNudge0")} aria-label={t("sqNudge0")} onClick={() => writeMicro(i, 0)}>{m ? (m > 0 ? "+" : "") + m : "0"}</button>
        <button type="button" className="h-7 flex-1 px-1" disabled={m >= MICRO.MAX} onClick={() => writeMicro(i, Math.min(MICRO.MAX, m + 1))}>{t("sqLater") + " +"}</button>
      </div>
      {hasFill() && dev.fill ? (
        <>
          <Head>{t("sqPlays")}</Head>
          <div className={clsx(seg, "grid! grid-cols-3")} id="sqfill" role="group" aria-label={t("sqPlays")}>
            {PLAYS.map(([k, tip], c) => (
              <button key={k} type="button" data-v={c} aria-pressed={fc === c} title={`${t(tip)} (${FC.NAMES[c]})`} onClick={() => writeFill(i, c)}
                className={clsx(tog, "px-1 text-[14px] whitespace-nowrap")}>{t(k)}</button>
            ))}
          </div>
        </>
      ) : null}
      <Head>{t("locks")}<More>{t("lockHelp")}</More></Head>
      <p className="mt-0 mb-1.5 text-[14px] text-dim">{t("sqLocksShort")}</p>
      <div id="sdlocks" className="flex flex-col gap-1">
        {locks.map((l) => <LockRow key={l.param} i={i} l={l} />)}
      </div>
      <button type="button" id="sdadd" className="mt-1.5" disabled={!canAddLock(i)} title={canAddLock(i) ? "" : t("sqLockWhy")}
        onClick={() => addLock(i)}>{t("addLock")}</button>
    </>
  );
}

/* ------------------------------------------------------------ the panel --- */
export default function Inspector() {
  useApp();
  const dev = readyDev();
  const len = stepLen();
  if (SQ.sel >= len) SQ.sel = len - 1;
  const i = SQ.sel, s = dev.steps[i];
  if (!s) return null;
  const lanes = drumView();
  const what = lanes ? "" : s.time === 1 ? t("sqTTie") : s.time === 2 || !s.n ? t("sqTRest") : notesOf(s).map(isDrum() ? drumName : noteName).join(" ");
  return (
    <aside id="stepinspector" aria-label={tf("sqStep", { n: i + 1 })}
      className="w-[320px] flex-none self-start border border-line bg-s1 px-3 pt-2.5 pb-3">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" className="h-7 w-7 p-0" disabled={i <= 0} title={t("sqPrev")} aria-label={t("sqPrev")} onClick={() => moveSel(-1)}>‹</button>
        <h3 className="m-0 min-w-0 flex-1 truncate text-center text-fg">{tf("sqStep", { n: i + 1 })}
          {what ? <span className="ml-2 text-dim">{what}</span> : null}</h3>
        <button type="button" className="h-7 w-7 p-0" disabled={i >= len - 1} title={t("sqNext")} aria-label={t("sqNext")} onClick={() => moveSel(1)}>›</button>
      </div>
      {lanes ? <DrumStep i={i} /> : <NoteStep i={i} s={s} />}
      {hasLocks() && dev.micro ? <StepExtras i={i} /> : null}
      {/* the step's components (BoopBox: how the step plays each time the sequencer reaches it; pages/patterns) */}
      {!lanes ? <><Head>{t("sqComps")}</Head><StepComponents step={i} /></> : null}
    </aside>
  );
}
