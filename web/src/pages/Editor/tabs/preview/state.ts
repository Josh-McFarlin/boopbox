// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The local audio preview (?mock=1): the firmware's own DSP and clock in the browser (lib/preview.js: WASM in an
// AudioWorklet) playing the mock device's state, its keys / pads, the computer keyboard, and the inline edits of the
// step sequence. The logic and its state (PV) live here; Preview.jsx draws them.
import { CMD, DRUM_LANES, parse, previewSnapshot, previewToggleDrum, previewToggleStep, req } from "../../lib/proto.ts";
import { A, drumAsStep, drumFocus, notify, report, stepEdit } from "../../core/app.ts";
import { afterSoundChange } from "../../core/device.ts";
import { H } from "../../core/hooks.ts";

/* ------------------------------------------------------- local browser audio --- */
export const PREVIEW_KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p"];
export const PV = {
  audio: null,          /* LocalPreview, once started */
  starting: null,       /* the start in progress (a promise) */
  playing: false,
  octave: 60,           /* the piano's lowest C */
  keysHidden: false,
  expanded: false,
  error: null,          /* the last error's message (the status shows it, in red) */
  volume: 50,
  positions: [],        /* each track's step playing (the worklet's transport), -1: none */
  held: new Map(),      /* token (pointer / key / button) -> {track, note, offset} */
  pressed: new Set(),   /* the keys / pads shown down (their offset) */
  /* the sequence */
  notes: [],            /* the note a click adds, per synth track */
  pages: [],            /* the first step shown, per track */
  follow: true,
  allDrums: new Set(),  /* drum tracks showing all 16 lanes */
  drumOpen: new Set(),  /* drum tracks whose lanes show */
  /* the note dialog */
  noteTarget: null,
  listen: true,         /* a key picked is heard */
  applying: false,
};
export const noteOf = (k) => PV.notes[k] ?? 60;
export const posOf = (k) => (PV.playing ? PV.positions[k] ?? -1 : -1);
/* the mock's selected track is a drum track (pads, not keys) */
export const selDrum = () => !!A.mock && !!A.mock.state.tracks[A.mock.state.sel]?.drum;

/* the output meter: set straight on the element (many times a second, no render) */
let meter = null;
export const setMeter = (el) => { meter = el; };

export function previewError(error) {
  stopPreview().then(() => { PV.error = error.message; notify(); }).catch(console.error);
  console.error(error);
}
/* the mock changed (its onChange): the panel, and the audio engine's copy of the state */
export function previewChanged(cmd, args) {
  notify();
  if (!PV.audio?.node) return;
  const samples = [CMD.SMP_END, CMD.SMP_ERASE, CMD.BK_PUT].includes(cmd);
  PV.audio.sync(samples);
  if (cmd === CMD.DSYN_PLAY) PV.audio.hit(args[0], args[1], args[2]);
}
export async function startPreview() {
  if (!A.dev?.dump || !A.mock) return false;
  PV.error = null;
  if (PV.audio?.node && PV.audio.context.state === "running") return true;
  if (!PV.starting) {
    PV.starting = (async () => {
      if (!PV.audio) {
        const { LocalPreview } = await import("../../lib/preview.ts");
        PV.audio = new LocalPreview((samples) => previewSnapshot(A.mock.state, samples), previewError,
          (peak) => { if (meter) meter.value = peak * PV.audio.volume; },
          ({ positions }) => { PV.positions = positions; notify(); });
      }
      await PV.audio.start();
      PV.audio.setVolume(PV.volume / 100);
      if (!A.dev?.dump) { await PV.audio.close(); return false; }
      return true;
    })().finally(() => { PV.starting = null; notify(); });
    notify();
  }
  return PV.starting;
}
export function releasePreviewKeys() {
  stopPreviewNoteAudition();
  for (const { track, note } of PV.held.values()) PV.audio?.note(track, note, false);
  PV.held.clear();
  PV.pressed.clear();
  notify();
}
export async function stopPreview() {
  releasePreviewKeys();
  PV.playing = false;
  PV.positions = [];
  if (A.mock) A.mock.sim.play(false);
  if (PV.starting) await PV.starting.catch(() => {});
  await PV.audio?.close();
  if (meter) meter.value = 0;
  notify();
}
export async function playPreview() {
  if (!await startPreview()) return;
  PV.playing = !PV.playing;
  A.mock.sim.play(PV.playing);
  PV.audio.play(PV.playing);
  notify();
}
/* the stop button: every note off, the loop stopped (the audio stays on) */
export function stopPlaying() {
  releasePreviewKeys(); PV.audio?.panic(); PV.playing = false; A.mock?.sim.play(false); notify();
}
export function setVolume(v) {
  PV.volume = v;
  PV.audio?.setVolume(v / 100);
  notify();
}
export async function previewNoteOn(token, offset) {
  if (!A.dev?.dump || PV.held.has(token)) return;
  const track = A.mock.state.sel;
  const drum = selDrum();
  const note = drum ? DRUM_LANES[offset][0] : PV.octave + offset;
  if (!drum) { PV.notes[track] = note; notify(); }
  const held = { track, note };
  PV.held.set(token, held);
  if (await startPreview() && PV.held.get(token) === held) {
    PV.audio.note(track, note, true);
    PV.pressed.add(offset);
    notify();
  }
}
export function previewNoteOff(token, offset) {
  const held = PV.held.get(token);
  if (!held) return;
  PV.audio?.note(held.track, held.note, false);
  PV.held.delete(token);
  PV.pressed.delete(offset);
  notify();
}
export function setOctave(delta) {
  PV.octave = Math.max(24, Math.min(84, PV.octave + delta));
  releasePreviewKeys();
}

/* LIVE (pages/live) on the mock: its local audio follows PLAY, and the mutes / solo. s: the LIVE state read, was: the one
   before */
export function previewLiveState(s, was) {
  if (!A.MOCK || !PV.audio?.node) return;
  if (s.playing !== PV.playing) {
    PV.playing = s.playing; PV.audio.play(s.playing); PV.audio.sync(false); notify();
  } else if (was && (was.mutes !== s.mutes || was.solo !== s.solo)) PV.audio.sync(false);
}

/* ------------------------------------------------------------ the sequence --- */
/* Inline edits use the same editor commands as the full sequencer. Serialize clicks so
   two fast toggles (or two drum lanes on one step) cannot overwrite one another. */
let editQueue = Promise.resolve();
export function previewSequenceClick(k, index, lane = -1, replacement = null) {
  const d = A.dev, m = A.mock, note = noteOf(k);
  if (!d?.dump || !m) return;
  A.busy++;
  editQueue = editQueue.then(async () => {
    if (d !== A.dev || m !== A.mock || index >= m.state.tracks[k].p[29]) return;
    const drum = !!m.state.tracks[k].drum;
    /* DRUM_STEP edits the drum track the FM-1 shows (core.h drum_focus: the selected track if it is one, else the
       first): the eight-track mock has two, so the other one is selected first */
    if (drum && drumFocus() !== k) {
      d.sel = parse[CMD.TRACK](await d.link.request(req.track(k))).sel;
      await afterSoundChange();
      if (d !== A.dev) return false;
    }
    const track = m.state.tracks[k];
    const command = drum ? req.drumStep(index, previewToggleDrum(track.dstep[index], lane)) :
      req.trackStep(k, index, replacement || previewToggleStep(track.step[index], note));
    const response = await d.link.request(command);
    if (d !== A.dev) return false;
    if (d.sel === k) {
      if (drum) {
        const r = parse[CMD.DRUM_STEP](response);
        if (!d.dsteps) d.dsteps = [];
        d.dsteps[index] = r; d.steps[index] = drumAsStep(r);
      } else d.steps[index] = parse[CMD.TRACK_STEP](response);
      stepEdit.set(index, performance.now());
    }
    return true;
  }).catch(report).finally(() => { A.busy--; notify(); });
  return editQueue;
}
export const waitEdits = () => editQueue;

/* a single click on a synth step waits for a possible double click (which opens the note dialog instead) */
const gestures = new Map();   /* cell key -> {timer, original, index, device, model} */
export function previewCellClick(e, cell, k, lane, index) {
  if (lane === -2) { PV.drumOpen.add(k); notify(); return; }
  if (A.mock.state.tracks[k].drum || e.detail === 0) { previewSequenceClick(k, index, lane); return; }
  const pending = gestures.get(cell);
  if (e.detail > 1) { clearTimeout(pending?.timer); return; }
  clearTimeout(pending?.timer);
  const s = A.mock.state.tracks[k].step[index];
  const original = { ...s, notes: s.notes.slice() };
  const device = A.dev, model = A.mock;
  const timer = setTimeout(() => { if (device === A.dev && model === A.mock) previewSequenceClick(k, index); }, 250);
  gestures.set(cell, { timer, original, index, device, model });
}
export async function previewOpenNote(cell, k, cellIndex) {
  const gesture = gestures.get(cell);
  clearTimeout(gesture?.timer);
  gestures.delete(cell);
  if (gesture && (gesture.device !== A.dev || gesture.model !== A.mock)) return;
  const d = A.dev, m = A.mock, index = gesture?.index ?? cellIndex;
  await editQueue;
  if (d !== A.dev || m !== A.mock || index >= m.state.tracks[k].p[29]) return;
  const current = m.state.tracks[k].step[index], step = gesture?.original || { ...current, notes: current.notes.slice() };
  // A slow double click can arrive after the single-click delay. Restore its starting state.
  if (JSON.stringify(current) !== JSON.stringify(step) && !await previewSequenceClick(k, index, -1, step)) return;
  if (dialog?.open) dialog.close();
  const notes = step.n > 0 ? step.notes.slice(0, step.n) : [noteOf(k)];
  PV.noteTarget = { device: d, model: m, track: k, index, step, notes, member: 0, octave: Math.floor(notes[0] / 12) * 12 };
  notify();
  dialog?.showModal();
}

/* ------------------------------------------------------------ the note dialog --- */
let dialog = null;
export const setDialog = (el) => { dialog = el; };
export const closeDialog = () => dialog?.close();
let audition = null;
export function stopPreviewNoteAudition() {
  const held = audition;
  audition = null;
  if (!held) return;
  clearTimeout(held.timer);
  if (held.active) PV.audio?.note(held.track, held.pitch, false);
}
export async function auditionPreviewNote(pitch) {
  stopPreviewNoteAudition();
  const target = PV.noteTarget;
  if (!target || !PV.listen) return;
  const held = audition = { track: target.track, pitch, active: false };
  if (await startPreview() && PV.noteTarget === target && audition === held) {
    held.active = true;
    PV.audio.note(held.track, pitch, true);
    held.timer = setTimeout(() => { if (audition === held) stopPreviewNoteAudition(); }, 350);
  }
}
export function noteDialogClosed() { stopPreviewNoteAudition(); PV.noteTarget = null; notify(); }

/* ------------------------------------------------------------ the keyboard --- */
function previewEditing(e) {
  return e.target?.closest?.("input, select, textarea, [contenteditable='true'], .preview-sequence button, #preview-note-dialog, #preview-disclosure");
}
let installed = false;
function installKeys() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", (e) => {
    if (!A.MOCK || !A.dev?.dump || A.tab === "live" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || previewEditing(e)) return;
    if (e.code === "Space") { e.preventDefault(); playPreview().catch(previewError); return; }
    const i = PREVIEW_KEYS.indexOf(String(e.key).toLowerCase());
    if (i < 0) return;
    e.preventDefault(); previewNoteOn(`key:${e.code}`, i).catch(previewError);
  });
  window.addEventListener("keyup", (e) => {
    const i = PREVIEW_KEYS.indexOf(String(e.key).toLowerCase());
    if (i >= 0) previewNoteOff(`key:${e.code}`, i);
  });
  window.addEventListener("blur", releasePreviewKeys);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && PV.audio?.node) {
      releasePreviewKeys(); PV.audio.panic(); PV.playing = false; A.mock?.sim.play(false); notify();
    }
  });
  window.addEventListener("pagehide", () => { PV.audio?.panic(); });
}

export function init() {
  Object.assign(H, {
    stopPreview: () => { stopPreview().catch(console.error); },
    previewChanged,
  });
  if (A.MOCK) installKeys();
}
