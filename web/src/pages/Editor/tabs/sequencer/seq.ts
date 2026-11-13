// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The Sequencer page's logic: the selected track's steps, LEN at hand, the piano roll's state, MIDI files, the selected
// step's nudge / locks / fill (v7, v8) and the drum track's 16 lanes (v5). What draws them is in ../Sequencer.jsx.
import {
  CMD, F, LV_ORDER, ROLL, SMF, drumName, emptyDrum, fillGet, fillSet, lockable, noteName, parse, parseNotes, req,
} from "../../lib/proto.ts";
import {
  A, devNlock, downloadBytes, drumAsStep, drumGrid, isDrum, notify, pById, pSlen, report, rq, sayK, stepEdit, t,
} from "../../core/app.ts";
import { loadLocks, loadSteps, userSet } from "../../core/device.ts";

/* ---------------------------------------------------------- steps --- */
export const TIMES = ["NOTE", "TIE", "REST"];
export const stepLen = () => { const dev = A.dev; return Math.max(1, Math.min(dev.info.nstep, dev.dump.p[pSlen()] || 16)); };
/* a step's notes as text: GM drum names on the drum track */
export const stepNotes = (s) => s.notes.slice(0, s.n).map(isDrum() ? drumName : noteName).join(" ");
/* the drum track as its 16 lanes (v5) once its DRUM_STEPs are read */
export const drumView = () => drumGrid() && !!A.dev.dstepsOk;

/* the page's own state: the selected step (v7), the piano roll (2.5), the MIDI file being imported, the drum paint */
export const SQ = {
  sel: 0,
  lane: -1,               /* the drum lane selected in the drum grid (its hit shows in the step inspector) */
  last: null,             /* the last note used on this page: what a click on an empty step puts there */
  added: -1,              /* the cell a click just filled (its double click must not take it away again) */
};
export const NEW_VEL = 100;                              /* a new note's velocity */
export const defNote = () => SQ.last ?? (isDrum() ? 36 : 60);
/* a step with nothing to play: REST, or NOTE with no notes (a TIE holds the step before it) */
export const stepEmpty = (s) => !s || s.time === 2 || (s.time === 0 && !s.n);
const REST = () => ({ n: 0, notes: [0, 0, 0, 0], time: 2, flags: 0, vel: 0 });

/* the row of the step list (its inputs) -> step i; v: {notes, time, acc, sl, vel} as typed. -> false: the notes are bad */
export async function writeStep(i, v) {
  const dev = A.dev;
  const notes = parseNotes(v.notes);
  if (!notes) return false;
  const old = dev.steps[i];
  const all = notes.concat(old.notes.slice(notes.length)).slice(0, 4);
  let time = +v.time;
  if (notes.length && !old.n && time === 2) time = 0;   /* typing notes into an empty step makes it play */
  const s = { n: notes.length, notes: all, time, flags: (v.acc ? 1 : 0) | (v.sl ? 2 : 0),
    vel: Math.max(0, Math.min(127, +v.vel || 0)), lvl: old.lvl, rat: old.rat };   /* v5: level / ratchet kept */
  if (s.n && !s.vel) s.vel = NEW_VEL;
  if (notes.length) SQ.last = notes[notes.length - 1];
  stepEdit.set(i, performance.now());
  try {
    const r = parse[CMD.STEP_SET](await rq(req.stepSet(i, s)));
    if (dev !== A.dev) return true;
    dev.steps[i] = r;
    notify();
  } catch (err) { report(err); }
  return true;
}

/* step i becomes s at once (drawn now), then STEP_SET; a newer edit of the same step queued replaces this one (Link
   coalesces by key), and only the last reply is kept */
export async function putStep(i, s) {
  const dev = A.dev;
  if (!dev || !dev.steps[i]) return;
  const old = dev.steps[i];
  const v = { n: s.n, notes: s.notes.concat([0, 0, 0, 0]).slice(0, 4), time: s.time, flags: s.flags, vel: s.vel, lvl: old.lvl || 0, rat: old.rat || 0 };
  dev.steps[i] = { ...old, ...v, index: i };
  stepEdit.set(i, performance.now());
  notify();
  try {
    const r = parse[CMD.STEP_SET](await rq(req.stepSet(i, v), { key: "step:" + i }));
    if (dev !== A.dev || dev.link.hasQueued("step:" + i)) return;
    dev.steps[i] = r;
    notify();
  } catch (err) { report(err); }
}
/* the notes a step plays (a REST or a TIE: none) */
export const notesOf = (s) => (s && s.time === 0 ? s.notes.slice(0, s.n) : []);
/* the notes of step i are `notes` now: none makes it a rest, some make it play (a new note at NEW_VEL) */
export function setNotes(i, notes) {
  const s = A.dev.steps[i];
  if (!notes.length) { putStep(i, REST()); return; }
  SQ.last = notes[notes.length - 1];
  const was = !stepEmpty(s) && s.time === 0;
  putStep(i, { n: notes.length, notes, time: 0, flags: was ? s.flags : 0, vel: was && s.vel ? s.vel : NEW_VEL });
}
/* a key of the inspector's piano: the note goes into the step's chord, or out of it (4 at most) */
export function toggleNote(i, p) {
  const cur = notesOf(A.dev.steps[i]);
  if (cur.includes(p)) { setNotes(i, cur.filter((x) => x !== p)); return true; }
  if (cur.length >= 4) return false;
  setNotes(i, cur.concat(p));
  return true;
}
/* the step's type: 0 NOTE (a step with no notes gets the last note used), 1 TIE, 2 REST (the notes are kept) */
export function setTime(i, time) {
  const s = A.dev.steps[i];
  if (time === 0 && !s.n) { setNotes(i, [defNote()]); return; }
  putStep(i, { ...s, notes: s.notes.slice(), time, vel: time === 0 && !s.vel ? NEW_VEL : s.vel });
}
export const setFlag = (i, bit, on) => { const s = A.dev.steps[i]; putStep(i, { ...s, notes: s.notes.slice(), flags: on ? s.flags | bit : s.flags & ~bit }); };
export const setVel = (i, v) => { const s = A.dev.steps[i]; putStep(i, { ...s, notes: s.notes.slice(), vel: Math.max(0, Math.min(127, v | 0)) }); };
export const restStep = (i) => { if (!stepEmpty(A.dev.steps[i])) putStep(i, REST()); };

/* the step grid: a click on an empty step puts the last note used there (and selects it), on a step with notes it
   selects it; a double click (not the one that just filled it) or Delete makes it a rest */
let addedTimer = 0;
const justAdded = (k) => { SQ.added = k; clearTimeout(addedTimer); addedTimer = setTimeout(() => { SQ.added = -1; }, 500); };
export function gridClick(i) {
  const dev = A.dev;
  if (!dev || !dev.steps[i]) return;
  SQ.sel = i;
  if (stepEmpty(dev.steps[i])) { justAdded(i); setNotes(i, [defNote()]); } else notify();
}
export function gridDouble(i) {
  if (SQ.added !== i) restStep(i);
}
/* the arrow keys: the selection moves by d steps */
export function moveSel(d) {
  SQ.sel = Math.max(0, Math.min(stepLen() - 1, SQ.sel + d));
  notify();
  return SQ.sel;
}

/* ---- SLOOP 2.5: LEN at hand, the piano roll of a synth track, MIDI files ---- */
export const RV = { view: "grid", frac: 1 / 16, trk: -1, drag: null, geo: null };   /* view: grid (steps) | roll | list */
try { const v = localStorage.getItem("sloop-seq-view"); if (["grid", "roll", "list"].includes(v)) RV.view = v; } catch (e) { /* no storage */ }
/* the roll's pitches: C0 .. C8, scrolled inside its box */
export const ROLL_ROW = 20, ROLL_LAB = 60, ROLL_LO = 12, ROLL_HI = 108;
export const pDiv = () => pById("DIV", 30);
export const curDiv = () => Math.max(0, Math.min(ROLL.DIV_PER_BAR.length - 1, A.dev.dump.p[pDiv()] | 0));
const gBpm = () => { const dev = A.dev; const i = dev.gdesc.findIndex((d) => d && d.label === "BPM"); return i >= 0 ? dev.dump.g[i] : 120; };
export function setLen(v) {
  const dev = A.dev;
  if (!dev || !dev.dump) return;
  v = Math.max(1, Math.min(dev.info.nstep, Math.round(v) || 1));
  if (v !== stepLen()) userSet(0, pSlen(), v, true);
  else notify();
}
export function setView(v) {
  RV.view = v;
  try { localStorage.setItem("sloop-seq-view", v); } catch (e) { /* no storage */ }
  notify();
}
/* the pitch the roll opens on (in the middle of its box): the middle of the track's notes, else between C3 and C5;
   null when this track already showed (the box stays where the user scrolled it) */
export function rollCenter(len) {
  const dev = A.dev, tr = dev.sel || 0;
  if (RV.trk === tr) return null;
  RV.trk = tr;
  const ns = ROLL.chords(dev.steps, len).flatMap((c) => c.notes);
  return ns.length ? (Math.min(...ns) + Math.max(...ns)) / 2 : 60;
}
export function rollNoteAt(h) {                          /* the chord (and its note) under the pointer */
  const dev = A.dev, own = ROLL.owner(dev.steps, h.i);
  if (own < 0) return null;
  const c = ROLL.chords(dev.steps, stepLen()).find((x) => x.at === own);
  return c && c.notes.includes(h.p) ? c : null;
}
export const roll = { writing: false };
export async function rollApply(ch) {
  const dev = A.dev;
  if (!ch.size || roll.writing) { notify(); return; }
  roll.writing = true;
  for (const [i, s] of ch) dev.steps[i] = { ...dev.steps[i], ...s, index: i };   /* (drawn at once, the device follows) */
  notify();
  try { await writeSteps([...ch.keys()].sort((a, b) => a - b)); } catch (err) { report(err); }
  finally { roll.writing = false; notify(); }
}
/* dev.steps[i] -> the device, keeping what it answers */
async function writeSteps(idx) {
  const dev = A.dev;
  A.busy++;
  try {
    for (const i of idx) {
      const s = dev.steps[i];
      stepEdit.set(i, performance.now());
      dev.steps[i] = parse[CMD.STEP_SET](await rq(req.stepSet(i, { n: s.n, notes: s.notes, time: s.time, flags: s.flags,
        vel: s.vel, lvl: s.lvl || 0, rat: s.rat || 0 })));
    }
  } finally { A.busy--; notify(); }
}

/* MIDI files: the selected track's pattern out as a .mid, a .mid in (a preview first) */
export function midiExport() {
  const dev = A.dev;
  if (!dev || !dev.steps.length) return;
  const len = stepLen(), div = curDiv(), tr = dev.sel || 0, drum = isDrum();
  const notes = drum && drumGrid() && dev.dstepsOk ? SMF.fromDrums(dev.dsteps, len, div) : SMF.fromSteps(dev.steps, len, div);
  if (!notes.length) { sayK("midiEmpty"); return; }
  downloadBytes(`boopbox-track${tr + 1}.mid`, SMF.write(notes, { bpm: gBpm(), ch: drum ? 9 : tr, name: `BoopBox track ${tr + 1}` }));
  sayK("midiSaved", String(notes.length));
}
export const MIDI = { MI: null };                        /* the file being imported: {name, smf, src, setlen} */
export const midiDrum = () => isDrum() && drumGrid() && !!A.dev.dstepsOk;
export const midiPlan = () => { const MI = MIDI.MI; return SMF.toSteps(MI.smf.tracks[MI.src].notes, MI.smf.ppq, curDiv(), A.dev.info.nstep, midiDrum()); };
export async function midiOpen(f) {
  if (!f || !A.dev) return;
  try {
    MIDI.MI = { name: f.name, smf: SMF.read(new Uint8Array(await f.arrayBuffer())), src: 0, setlen: true };
    notify();
  } catch (err) { MIDI.MI = null; notify(); sayK("midiBad", err.message); }
}
export function midiCancel() { MIDI.MI = null; notify(); }
export async function midiImport() {
  const dev = A.dev, MI = MIDI.MI;
  if (!MI || !dev) return;
  if (!confirm(t("midiConfirm"))) return;
  const plan = midiPlan(), setlen = MI.setlen;
  A.busy++;
  try {
    if (plan.dsteps) {
      for (let i = 0; i < dev.info.nstep; i++) {
        const r = parse[CMD.DRUM_STEP](await rq(req.drumStep(i, plan.dsteps[i])));
        dev.dsteps[i] = r;
        dev.steps[i] = drumAsStep(r);
      }
    } else {
      for (let i = 0; i < dev.info.nstep; i++) dev.steps[i] = { ...plan.steps[i], index: i };
      await writeSteps([...Array(dev.info.nstep).keys()]);
    }
    MIDI.MI = null;
    if (setlen) setLen(plan.len);
    RV.trk = -1;                                     /* (the roll opens on the new notes) */
    sayK("midiDone", String(plan.report.notes));
  } catch (err) { report(err); } finally { A.busy--; notify(); }
}

/* ---- v7 (SLOOP 2.4): the selected step's nudge and parameter locks (a grid cell or a drum column picks it) */
export const stepLocked = (i) => { const dev = A.dev; return !!dev && !!dev.micro && (dev.micro[i] !== 0 || dev.locks.some((l) => l.step === i)); };
export const stepFill = (i) => { const dev = A.dev; return dev && dev.fill ? fillGet(dev.fill, i) % 3 : 0; };   /* v8: 0 normal, 1 fill only, 2 no fill */
export function selectStep(i) {
  if (!A.dev || i === SQ.sel) return;
  SQ.sel = i;
  notify();
}
/* the parameters a lock may hold on this track, by id (the device's DESC labels; the engine's 8 as their current names) */
export function lockableIds() {
  const dev = A.dev, ids = [];
  for (let id = 0; id < dev.info.pcount; id++) if (lockable(id, dev.info.pe0) && dev.pdesc[id] && dev.pdesc[id].max > dev.pdesc[id].min) ids.push(id);
  return ids;
}
export const lockName = (id) => { const dev = A.dev, d = dev.pdesc[id]; return d ? `${d.label}${id >= dev.info.pe0 ? " (E" + (id - dev.info.pe0 + 1) + ")" : ""}` : String(id); };
export const canAddLock = (i) => {
  const dev = A.dev, rows = dev.locks.filter((l) => l.step === i);
  return dev.locks.length < devNlock() && lockableIds().some((id) => !rows.some((l) => l.param === id));
};
export function addLock(i) {                             /* a new lock at the track's value: ENV > FLT (5), else the first free parameter */
  const dev = A.dev;
  const taken = dev.locks.filter((l) => l.step === i).map((l) => l.param);
  const id = [5, ...lockableIds()].find((x) => lockableIds().includes(x) && !taken.includes(x));
  if (id == null) return;
  writeLock(i, id, dev.dump.p[id]);
}
export async function changeLockParam(i, from, id) {     /* another parameter: the old lock goes, a new one at the track's value */
  await writeLock(i, from, null);
  await writeLock(i, id, A.dev.dump.p[id]);
}
export async function writeMicro(i, m) {
  const d = A.dev;
  stepEdit.set(i, performance.now());
  try {
    const r = parse[CMD.MICRO_SET](await rq(req.microSet(d.sel, i, m), { key: "micro:" + i }));
    if (d !== A.dev || !d.micro) return;
    d.micro[i] = r.micro;
    notify();
  } catch (err) { report(err); }
}
export async function writeFill(i, c) {                  /* v8: the step's fill condition */
  const d = A.dev;
  stepEdit.set(i, performance.now());
  try {
    const r = parse[CMD.FILL_SET](await rq(req.fillSet(d.sel, i, c), { key: "fill:" + i }));
    if (d !== A.dev || !d.fill) return;
    fillSet(d.fill, i, r.cond);
    notify();
  } catch (err) { report(err); }
}
export async function writeLock(i, param, v) {
  const d = A.dev;
  stepEdit.set(i, performance.now());
  try {
    const r = parse[CMD.LOCK_SET](await rq(req.lockSet(d.sel, i, param, v), { key: `lock:${i}:${param}` }));
    if (d !== A.dev || !d.locks) return;
    if (r.rc) sayK(r.rc === 3 ? "lockFull" : "lockRefused");
    const k = d.locks.findIndex((l) => l.step === i && l.param === param);
    if (r.has && k < 0) d.locks.push({ step: i, param, value: r.value });
    else if (r.has) d.locks[k].value = r.value;
    else if (k >= 0) d.locks.splice(k, 1);
    notify();
  } catch (err) { report(err); }
}
export async function refreshLocks() {                   /* a STEP_CHANGED push: the device's nudges / locks may have moved */
  const d = A.dev;
  try {
    await loadLocks();
    if (d !== A.dev) return;
    notify();
  } catch (err) { report(err); }
}

/* ---- v5: the drum track's 16 lanes. A click puts a hit with the level / roll chosen above, or takes it
   away when it already has them; Shift+click steps the level of a hit. One DRUM_STEP per step in flight
   and one queued with the latest lanes (Link coalesces by key). */
export const paint = { lvl: 0, rat: 0 };
export function setPaint(k, v) { paint[k] = v; notify(); }
/* the drum grid's clicks, as the step grid's: an empty cell gets a hit (the level / roll chosen above) and is selected,
   a hit is selected (Shift: one level louder), a double click or Delete takes it away */
export function drumClick(i, l, shift) {
  const dev = A.dev;
  if (!dev || !dev.dsteps[i]) return;
  SQ.sel = i; SQ.lane = l;
  const on = (dev.dsteps[i].on >> l) & 1;
  if (on && shift) drumSet(i, l, { lvl: LV_ORDER[(LV_ORDER.indexOf(dev.dsteps[i].lvl[l]) + 1) % 4] });   /* louder, then GHOST again */
  else if (on) notify();
  else { justAdded(i * 16 + l); drumSet(i, l, { on: true, lvl: paint.lvl, rat: paint.rat }); }
}
export function drumDouble(i, l) {
  if (SQ.added !== i * 16 + l) drumSet(i, l, { on: false });
}
/* lane l of drum step i: on or off, its level, its roll */
export function drumSet(i, l, v) {
  const dev = A.dev;
  if (!dev || !dev.dsteps[i]) return;
  const d = { ...dev.dsteps[i], lvl: dev.dsteps[i].lvl.slice(), rat: dev.dsteps[i].rat.slice() };
  const on = v.on ?? !!((d.on >> l) & 1);
  if (!on) { d.on &= ~(1 << l); d.lvl[l] = d.rat[l] = 0; }
  else { d.on |= 1 << l; if (v.lvl != null) d.lvl[l] = v.lvl; if (v.rat != null) d.rat[l] = v.rat; }
  dev.dsteps[i] = d;
  dev.steps[i] = drumAsStep(d);
  stepEdit.set(i, performance.now());
  notify();
  writeDrum(i);
}
async function writeDrum(i) {
  const d = A.dev;
  try {
    const r = parse[CMD.DRUM_STEP](await rq(req.drumStep(i, d.dsteps[i]), { key: "dstep:" + i }));
    if (d !== A.dev || d.link.hasQueued("dstep:" + i) || r.index !== i) return;
    d.dsteps[i] = r;                                 /* what the device has now */
    d.steps[i] = drumAsStep(r);
    notify();
  } catch (err) { report(err); }
}
/* the drum track's kit (its engine's first parameter, when the device names the kits) */
export const kitDesc = () => { const dev = A.dev, kd = dev.pdesc[dev.info.pe0]; return kd && kd.fmt === F.ENUM && kd.names.length ? kd : null; };
export const setKit = (v) => userSet(0, A.dev.info.pe0, v, true);

export async function reloadSteps() {
  if (!A.dev) return;
  A.busy++;
  try { await loadSteps(); sayK("ready"); } catch (err) { report(err); } finally { A.busy--; notify(); }
}
export async function clearSeq() {
  const dev = A.dev;
  if (!dev || !confirm(t("confirmClear"))) return;
  A.busy++;
  try {
    const drum = drumGrid() && dev.dstepsOk;
    for (let i = 0; i < dev.info.nstep; i++) {
      if (i % 8 === 0) sayK("applying", `${i}/${dev.info.nstep}`);
      if (drum) { dev.dsteps[i] = parse[CMD.DRUM_STEP](await rq(req.drumStep(i, emptyDrum()))); dev.steps[i] = drumAsStep(dev.dsteps[i]); }
      else dev.steps[i] = parse[CMD.STEP_SET](await rq(req.stepSet(i, { n: 0, notes: [0, 0, 0, 0], time: 2, flags: 0, vel: 0 })));
    }
    notify();
    sayK("ready");
  } catch (err) { report(err); } finally { A.busy--; notify(); }
}
