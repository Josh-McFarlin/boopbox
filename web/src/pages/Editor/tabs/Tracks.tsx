// SPDX-License-Identifier: GPL-3.0-only
// The mixer's logic (no page of its own since 1.9.5: the LIVE page's mixer is the editor's mixer, pages/live/Strips.jsx).
// dev.mix, read from the FM-1 for the core and the track selector (core/hooks.js: readMixer, mixFromDump, mixTouched,
// updateStrip, panning), and its writes (setLevel, setMute, setPan) for any strip that is not the LIVE page's own.
import { mixer } from "../lib/proto.ts";
import { A, P, drumLvGlobal, gDrLvl, hasTracks, isDrumTrk, notify, pMute, pPan, report, rq, sleep } from "../core/app.ts";
import { userSet } from "../core/device.ts";
import { H } from "../core/hooks.ts";
import type { MixKind } from "../core/hooks.ts";
import type { ReadyDev } from "../core/app.ts";

/* ---------------------------------------------------------- mixer (v3) --- */
/* dev.mix = TRACK reply + pan per track ({sel, ntrk, tracks: [{engine, preset, level, mute, armed, pan}]}).
   Read on connect, after every RELOAD / sound change, with the slow safety DUMP and when the tab opens.
   The selected track's level / pan / mute are also Sound parameters: both views follow each other. */
let mixDrag: string | null = null;                 /* "lv:i" / "pan:i" while a strip control is dragged (mixDragStart) */
const mixEdit = new Map();          /* "lv:i" / "pan:i" -> time of the user's last change */
let panning = false;                /* v3 firmware: another track is selected for a moment (pan of a track that is not selected) */
const panWant = new Map<number, number>();
const mixTouched = (kind: MixKind, i: number): boolean => {
  const dev = A.dev;
  return mixDrag === `${kind}:${i}` || performance.now() - (mixEdit.get(`${kind}:${i}`) || 0) < 600
    || (!!dev && kind === "lv" && dev.link.hasQueued("mix:" + i))
    || (kind === "pan" && (panWant.has(i) || (!!dev && dev.link.hasQueued("pan:" + i))));
};
const drumTrack = (i: number): boolean => !!A.dev && !!A.dev.mix && isDrumTrk(i);
const drumLv = (i: number): boolean => drumTrack(i) && drumLvGlobal();   /* its level is G_DRLVL (four-track firmware) */

async function readMixer(): Promise<void> {
  const d = A.dev;
  if (!d || !hasTracks()) return;
  const m = await mixer.read(rq, d.info!, { pan: pPan() });
  if (d !== A.dev) return;
  if (d.mix) m.tracks.forEach((x, i) => {           /* what the user is moving stays */
    const o = d.mix!.tracks[i];
    if (!o) return;
    if (mixTouched("lv", i)) { x.level = o.level; x.mute = o.mute; }
    if (mixTouched("pan", i)) x.pan = o.pan;
  });
  d.mix = m;
  if (m.sel !== d.sel && !panning) { d.sel = m.sel; A.needReload = true; }   /* selected on the device, push missed */
  notify();
}

/* the Sound view's values of the selected track (and the drum level, a global) -> the strips */
function mixFromDump(): void {
  const dev = A.dev;
  if (!dev || !dev.mix || !dev.dump || panning) return;
  const m = dev.mix, ds = drumLvGlobal() ? m.ntrk - 1 : -1, x = m.tracks[dev.sel!];
  if (ds >= 0 && !mixTouched("lv", ds)) m.tracks[ds].level = dev.dump.g[gDrLvl()];
  if (x) {
    if (!mixTouched("lv", dev.sel!)) {
      if (dev.sel !== ds) x.level = dev.dump.p[P.LEVEL];
      x.mute = dev.dump.p[pMute()] ? 1 : 0;
    }
    if (!mixTouched("pan", dev.sel!)) x.pan = dev.dump.p[pPan()];
  }
  notify();
}
/* a strip's values -> the Sound view (selected track; the drum level always) */
function mixToSound(i: number): void {
  const dev = A.dev as ReadyDev, x = dev.mix!.tracks[i];
  const put = (s: number, id: number, v: number | null | undefined) => { if (v == null) return; (s ? dev.dump.g : dev.dump.p)[id] = v; };
  if (drumLv(i)) put(1, gDrLvl(), x.level);
  if (i === dev.sel) {
    if (!drumLv(i)) put(0, P.LEVEL, x.level);
    put(0, pMute(), x.mute ? 1 : 0);
    put(0, pPan(), x.pan);
  }
  notify();
}

/* level and mute: TRACK_MIX, one in flight per track and one queued with the latest values (as SET) */
export function setLevel(i: number, v: number): void {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].level = v;
  mixEdit.set("lv:" + i, performance.now());
  mixToSound(i);
  sendMix(i);
}
export function setMute(i: number, on: boolean): void {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].mute = on ? 1 : 0;
  mixEdit.set("lv:" + i, performance.now());
  mixToSound(i);
  sendMix(i);
}
async function sendMix(i: number): Promise<void> {
  const d = A.dev!, x = d.mix!.tracks[i];
  try {
    const r = await mixer.setMix(rq, i, x.level, x.mute, { key: "mix:" + i });
    if (d !== A.dev || !d.mix || mixDrag === "lv:" + i || d.link.hasQueued("mix:" + i)) return;
    const y = d.mix.tracks[i];                      /* the device's values after clamping */
    y.level = r.level; y.mute = r.mute;
    mixToSound(i);
  } catch (e) { report(e); }
}
/* pan: the selected track as any Sound parameter; another track with TRACK_PARAM (v4: while dragging, one in
   flight and one queued with the latest value), or with v3 firmware on release (it is selected for a moment) */
export function setPan(i: number, v: number, final: boolean): void {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].pan = v;
  mixEdit.set("pan:" + i, performance.now());
  notify();
  if (i === dev.sel) { userSet(0, pPan(), v, final); return; }
  if (dev.v4) panTrack(i, v);
  else if (final) panOther(i, v);
}
async function panTrack(i: number, v: number): Promise<void> {
  const d = A.dev!;
  try {
    const r = await mixer.setPan(rq, i, d.sel!, pPan(), v, true);
    if (d !== A.dev || !d.mix || mixDrag === "pan:" + i || d.link.hasQueued("pan:" + i)) return;
    d.mix.tracks[i].pan = r;                        /* the device's value after clamping */
    if (i === d.sel) mixToSound(i); else notify();
  } catch (e) { report(e); }
}
async function panOther(i: number, v: number): Promise<void> {
  panWant.set(i, v);
  if (panOther.run) return;
  panOther.run = true;
  const d = A.dev!;
  try {
    while (A.busy && d === A.dev) await sleep(20);  /* not in the middle of another multi-request operation */
    A.busy++;
    panning = true;
    try {
      while (panWant.size && d === A.dev) {
        const [tr, val] = panWant.entries().next().value!;
        panWant.delete(tr);
        const r = await mixer.setPan(rq, tr, d.sel!, pPan(), val);
        if (d.mix && !panWant.has(tr)) { d.mix.tracks[tr].pan = r; notify(); }
      }
    } finally { panning = false; A.busy--; notify(); }
  } catch (e) { report(e); } finally { panOther.run = false; panWant.clear(); }
}
panOther.run = false;

/* a strip's control is held: its value is the user's until the pointer is let go */
export function mixDragStart(kind: MixKind, i: number): void { mixDrag = `${kind}:${i}`; }

export function init(): void {
  Object.assign(H, {
    readMixer,
    mixFromDump,
    mixTouched,
    updateStrip: () => notify(),
    panning: () => panning,
  });
  if (typeof window !== "undefined") {
    window.addEventListener("pointerup", () => { mixDrag = null; });
    window.addEventListener("pointercancel", () => { mixDrag = null; });
  }
}
