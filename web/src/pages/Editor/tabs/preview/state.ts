// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The local audio preview (?mock=1): the firmware's own DSP and clock in the browser (lib/preview.js: WASM in an
// AudioWorklet) playing the mock device's state, its keys / pads, the computer keyboard, and the inline edits of the
// step sequence. The logic and its state (PV) live here; Preview.jsx draws them.
import { CMD, DRUM_LANES, parse, previewSnapshot, previewToggleDrum, previewToggleStep, req } from "../../lib/proto.ts";
import type { LiveState, MockDevice, MockStep } from "../../lib/proto.ts";
import type { LocalPreview } from "../../lib/preview.ts";
import type { Dev } from "../../core/app.ts";
import { A, drumAsStep, drumFocus, notify, report, stepEdit } from "../../core/app.ts";
import { afterSoundChange } from "../../core/device.ts";
import { H } from "../../core/hooks.ts";

/* ------------------------------------------------------- local browser audio --- */
export const PREVIEW_KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p"];
/* a note held (by a pointer, a key, a button): its track and note */
export interface HeldNote { track: number; note: number }
/* the note dialog's target: the step double-clicked, the notes being picked, the one being changed, the octave shown */
export interface NoteTarget {
  device: Dev; model: MockDevice; track: number; index: number; step: MockStep; notes: number[]; member: number; octave: number;
}
/* the preview's state (PV) */
export interface PreviewState {
  audio: LocalPreview | null; starting: Promise<boolean> | null; playing: boolean; octave: number; keysHidden: boolean;
  expanded: boolean; error: string | null; volume: number; positions: number[]; held: Map<string, HeldNote>; pressed: Set<number>;
  notes: number[]; pages: number[]; follow: boolean; allDrums: Set<number>; drumOpen: Set<number>; noteTarget: NoteTarget | null;
  listen: boolean; applying: boolean;
}
export const PV: PreviewState = {
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
export const noteOf = (k: number): number => PV.notes[k] ?? 60;
export const posOf = (k: number): number => (PV.playing ? PV.positions[k] ?? -1 : -1);
/* the mock's selected track is a drum track (pads, not keys) */
export const selDrum = (): boolean => !!A.mock && !!A.mock.state.tracks[A.mock.state.sel]?.drum;

/* the output meter: set straight on the element (many times a second, no render) */
let meter: HTMLMeterElement | HTMLProgressElement | null = null;
export const setMeter = (el: HTMLMeterElement | HTMLProgressElement | null): void => { meter = el; };

export function previewError(error: Error): void {
  stopPreview().then(() => { PV.error = error.message; notify(); }).catch(console.error);
  console.error(error);
}
/* the mock changed (its onChange): the panel, and the audio engine's copy of the state */
export function previewChanged(cmd: number, args: number[]): void {
  notify();
  if (!PV.audio?.node) return;
  const samples = ([CMD.SMP_END, CMD.SMP_ERASE, CMD.BK_PUT] as number[]).includes(cmd);
  PV.audio.sync(samples);
  if (cmd === CMD.DSYN_PLAY) PV.audio.hit(args[0], args[1], args[2]);
}
export async function startPreview(): Promise<boolean> {
  if (!A.dev?.dump || !A.mock) return false;
  PV.error = null;
  if (PV.audio?.node && PV.audio.context!.state === "running") return true;
  if (!PV.starting) {
    PV.starting = (async () => {
      if (!PV.audio) {
        const { LocalPreview } = await import("../../lib/preview.ts");
        const audio = new LocalPreview((samples) => previewSnapshot(A.mock!.state, samples), previewError,
          (peak) => { if (meter) meter.value = peak * audio.volume; },
          (tr) => { PV.positions = (tr as { positions: number[] }).positions; notify(); });
        PV.audio = audio;
      }
      const audio = PV.audio;
      await audio.start();
      audio.setVolume(PV.volume / 100);
      if (!A.dev?.dump) { await audio.close(); return false; }
      return true;
    })().finally(() => { PV.starting = null; notify(); });
    notify();
  }
  return PV.starting;
}
export function releasePreviewKeys(): void {
  stopPreviewNoteAudition();
  for (const { track, note } of PV.held.values()) PV.audio?.note(track, note, false);
  PV.held.clear();
  PV.pressed.clear();
  notify();
}
export async function stopPreview(): Promise<void> {
  releasePreviewKeys();
  PV.playing = false;
  PV.positions = [];
  if (A.mock) A.mock.sim.play(false);
  if (PV.starting) await PV.starting.catch(() => {});
  await PV.audio?.close();
  if (meter) meter.value = 0;
  notify();
}
export async function playPreview(): Promise<void> {
  if (!await startPreview()) return;
  PV.playing = !PV.playing;
  A.mock!.sim.play(PV.playing);
  PV.audio!.play(PV.playing);
  notify();
}
/* the stop button: every note off, the loop stopped (the audio stays on) */
export function stopPlaying(): void {
  releasePreviewKeys(); PV.audio?.panic(); PV.playing = false; A.mock?.sim.play(false); notify();
}
export function setVolume(v: number): void {
  PV.volume = v;
  PV.audio?.setVolume(v / 100);
  notify();
}
export async function previewNoteOn(token: string, offset: number): Promise<void> {
  if (!A.dev?.dump || PV.held.has(token)) return;
  const track = A.mock!.state.sel;
  const drum = selDrum();
  const note = drum ? DRUM_LANES[offset][0] : PV.octave + offset;
  if (!drum) { PV.notes[track] = note; notify(); }
  const held = { track, note };
  PV.held.set(token, held);
  if (await startPreview() && PV.held.get(token) === held) {
    PV.audio!.note(track, note, true);
    PV.pressed.add(offset);
    notify();
  }
}
export function previewNoteOff(token: string, offset: number): void {
  const held = PV.held.get(token);
  if (!held) return;
  PV.audio?.note(held.track, held.note, false);
  PV.held.delete(token);
  PV.pressed.delete(offset);
  notify();
}
export function setOctave(delta: number): void {
  PV.octave = Math.max(24, Math.min(84, PV.octave + delta));
  releasePreviewKeys();
}

/* LIVE (pages/live) on the mock: its local audio follows PLAY, and the mutes / solo. s: the LIVE state read, was: the one
   before */
export function previewLiveState(s: LiveState, was: LiveState | null | undefined): void {
  if (!A.MOCK || !PV.audio?.node) return;
  if (s.playing !== PV.playing) {
    PV.playing = s.playing; PV.audio.play(s.playing); PV.audio.sync(false); notify();
  } else if (was && (was.mutes !== s.mutes || was.solo !== s.solo)) PV.audio.sync(false);
}

/* ------------------------------------------------------------ the sequence --- */
/* Inline edits use the same editor commands as the full sequencer. Serialize clicks so
   two fast toggles (or two drum lanes on one step) cannot overwrite one another. */
let editQueue: Promise<boolean | void> = Promise.resolve();
export function previewSequenceClick(k: number, index: number, lane = -1, replacement: MockStep | null = null): Promise<boolean | void> | undefined {
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
    const command = drum ? req.drumStep(index, previewToggleDrum(track.dstep![index], lane)) :
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
interface Gesture { timer: ReturnType<typeof setTimeout>; original: MockStep; index: number; device: Dev | null; model: MockDevice | null }
const gestures = new Map<string, Gesture>();   /* cell key -> {timer, original, index, device, model} */
export function previewCellClick(e: { detail: number }, cell: string, k: number, lane: number, index: number): void {
  if (lane === -2) { PV.drumOpen.add(k); notify(); return; }
  const m = A.mock!;
  if (m.state.tracks[k].drum || e.detail === 0) { previewSequenceClick(k, index, lane); return; }
  const pending = gestures.get(cell);
  if (e.detail > 1) { clearTimeout(pending?.timer); return; }
  clearTimeout(pending?.timer);
  const s = m.state.tracks[k].step[index];
  const original = { ...s, notes: s.notes.slice() };
  const device = A.dev, model = A.mock;
  const timer = setTimeout(() => { if (device === A.dev && model === A.mock) previewSequenceClick(k, index); }, 250);
  gestures.set(cell, { timer, original, index, device, model });
}
export async function previewOpenNote(cell: string, k: number, cellIndex: number): Promise<void> {
  const gesture = gestures.get(cell);
  clearTimeout(gesture?.timer);
  gestures.delete(cell);
  if (gesture && (gesture.device !== A.dev || gesture.model !== A.mock)) return;
  const d = A.dev!, m = A.mock!, index = gesture?.index ?? cellIndex;
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
let dialog: HTMLDialogElement | null = null;
export const setDialog = (el: HTMLDialogElement | null): void => { dialog = el; };
export const closeDialog = () => dialog?.close();
interface Audition { track: number; pitch: number; active: boolean; timer?: ReturnType<typeof setTimeout> }
let audition: Audition | null = null;
export function stopPreviewNoteAudition(): void {
  const held = audition;
  audition = null;
  if (!held) return;
  clearTimeout(held.timer);
  if (held.active) PV.audio?.note(held.track, held.pitch, false);
}
export async function auditionPreviewNote(pitch: number): Promise<void> {
  stopPreviewNoteAudition();
  const target = PV.noteTarget;
  if (!target || !PV.listen) return;
  const held: Audition = audition = { track: target.track, pitch, active: false };
  if (await startPreview() && PV.noteTarget === target && audition === held) {
    held.active = true;
    PV.audio!.note(held.track, pitch, true);
    held.timer = setTimeout(() => { if (audition === held) stopPreviewNoteAudition(); }, 350);
  }
}
export function noteDialogClosed(): void { stopPreviewNoteAudition(); PV.noteTarget = null; notify(); }

/* ------------------------------------------------------------ the keyboard --- */
function previewEditing(e: Event): Element | null | undefined {
  return (e.target as Element | null)?.closest?.("input, select, textarea, [contenteditable='true'], .preview-sequence button, #preview-note-dialog, #preview-disclosure");
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

export function init(): void {
  Object.assign(H, {
    stopPreview: () => { stopPreview().catch(console.error); },
    previewChanged,
  });
  if (A.MOCK) installKeys();
}
