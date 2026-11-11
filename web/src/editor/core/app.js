// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The editor's shared state and the helpers every page uses.
//
// How the React editor is put together: the device logic (connect, the requests, polling, the pushes) works on plain
// mutable objects, as the editor always has: A (this file), dev (A.dev: what was read from the FM-1) and each page's
// own state object (LV, PT, SG, DS, TH ...). Whatever changes them calls notify(); every component that called
// useApp() then renders again from those objects. So a page's code reads like the old one minus its DOM work: where it
// built or patched elements it now returns JSX, and where it called renderX() it calls notify().
import { useSyncExternalStore } from "react";
import { CMD, DRUM_LANES, F, SetGate, parse, req } from "../lib/proto.js";
import { TEXT } from "../lib/text.js";

const QS = new URLSearchParams(typeof location !== "undefined" ? location.search : "");

export const A = {
  lang: "en",
  tab: "sound",         /* the page showing (core/tabs.js) */
  access: null,         /* MIDIAccess (or the mock's) */
  dev: null,            /* {link, input, output, info, pdesc[], gdesc[], names[][], titles[][], dump, steps[], dsteps[], slotUsed[],
                           keys[] (paramKeys), watch (pushes on), v4, bank ({total, slots[]} or null: no user bank), smp, fm6,
                           sel (the selected track), mix ({tracks[]}), kitNames, micro, locks, fill, built} */
  busy: 0,              /* multi-request operations in progress: no polling */
  dragging: null,       /* key of the control being dragged */
  focused: null,        /* key of the select that has the focus (its value must not move under it) */
  connecting: false,
  wantConnected: false,
  needReload: false,    /* a RELOAD push came: re-read DESC, DUMP and steps when free */
  lastDump: 0,          /* Date.now() of the last DUMP */
  rewatch: false,
  status: { key: null, arg: "", err: false },
  blink: new Map(),     /* key -> time a push changed it (the control flashes) */
  MOCK: QS.get("mock") === "1",
  LEGACY: QS.get("legacy") === "1",
  mock: null,           /* the simulated FM-1 (?mock=1) */
};
export const QUERY = QS;

/* SET coalescing per control: key -> {last: time of the user's last change, sent: the value last requested} */
export const sets = new SetGate();
/* the device also pushes RELOAD after loads the editor asked for (SET of G_ENGSEL, PRESET, PROJECT load, UP_LOAD); the
   editor re-reads after those anyway, so it skips that many RELOADs for a moment */
export const selfReload = { n: 0, until: 0 };
export function selfLoad() {
  const dev = A.dev;
  if (!dev || !dev.watch) return;
  const now = Date.now();
  selfReload.n = now < selfReload.until ? selfReload.n + 1 : 1;
  selfReload.until = now + 1500;
}
export const stepEdit = new Map();   /* step index -> time of the last edit */

/* ---------------------------------------------------------------- rendering --- */
let version = 0, queued = false;
const subs = new Set();
/* something in A, dev or a page's state changed: the components render again (once per task, however many calls) */
export function notify() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    version++;
    for (const f of subs) f();
  });
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
/* in a component: render again on notify(); -> A */
export function useApp() {
  useSyncExternalStore(subscribe, () => version);
  return A;
}

/* ------------------------------------------------------------------ strings --- */
export const t = (k) => TEXT[A.lang][k] ?? k;
/* t() with {name} placeholders filled */
export const tf = (k, vars) => String(t(k)).replace(/\{(\w+)\}/g, (m, n) => (vars && n in vars ? vars[n] : m));

const ERR_KEYS = /fail|error|denied|nomidi|nodevice|noreply|lost|refused|full|bad/i;
/* the status line (top right): a string key and what follows it,  */
export function sayK(k, arg = "") {
  A.status = { key: k, arg, err: ERR_KEYS.test(k) };
  notify();
}
export const statusText = () => (A.status.key ? t(A.status.key) + A.status.arg : "");
export function report(err) { if (err && err.message !== "closed") { console.warn(err); sayK("error", err.message); } }

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------- the device --- */
export const rq = (r, opt) => A.dev.link.request(r, opt);
export const rqf = (r, o) => rq(r, o);
export async function getDesc(scope, id) { return parse[CMD.DESC](await rq(req.desc(scope, id))); }
export async function getDescOrNull(s, i) { try { return await getDesc(s, i); } catch (e) { if (e.message === "closed") throw e; return null; } }
export async function getDump() { A.lastDump = Date.now(); return parse[CMD.DUMP](await rq(req.dump()), A.dev.info); }
export async function getStep(i) { return parse[CMD.STEP_GET](await rq(req.stepGet(i))); }
export async function getDrumStep(i) { return parse[CMD.DRUM_STEP](await rq(req.drumStep(i))); }
/* a drum step as an old step (firmware ed_dstep_old): for what still reads dev.steps */
export function drumAsStep(d) {
  const notes = [];
  for (let l = 0; l < 16 && notes.length < 4; l++) if ((d.on >> l) & 1) notes.push(DRUM_LANES[l][0]);
  return { index: d.index, n: notes.length, notes: [...notes, 0, 0, 0, 0].slice(0, 4), time: notes.length ? 0 : 2, flags: 0, vel: notes.length ? 100 : 0 };
}

/* one multi-request operation; polling waits for it */
export async function op(fn) {
  if (!A.dev) return;
  A.busy++;
  notify();
  try { await fn(); } catch (err) { report(err); } finally { A.busy--; notify(); }
}

/* what the firmware has */
export const hasTracks = () => !!A.dev && !!A.dev.info && !!A.dev.info.ntrk;
export const nTrk = () => (A.dev && A.dev.info && A.dev.info.ntrk) || 0;
export const ready = () => !!A.dev && !!A.dev.dump;
export const hasLocks = () => !!A.dev && !!A.dev.info && A.dev.info.proto >= 7;
export const hasFill = () => !!A.dev && !!A.dev.info && A.dev.info.proto >= 8;
export const devNlock = () => (A.dev && A.dev.info && A.dev.info.ntrk >= 8 ? 32 : 24);   /* locks a track: 32 on the eight-track firmware */
/* four-track firmware: the drum track's level and sends are globals (GLO > DRUMS: G_DRLVL, G_DRREV, G_DRDLY). BoopBox's
   drum tracks have their own (P_LEVEL, P_REV, P_DLY: those globals only name the focused drum track's on the FM-1's
   screen, so the editor sets the track's own) */
export const drumLvGlobal = () => nTrk() < 8;

/* a track's kind: its engine byte (NENGINES = drums), from TRACK (dev.mix), the LIVE page's reads (A.lvTracks) or the
   selected track's DUMP. BoopBox has eight tracks, drums on 4 and 8 by default, and any track may be either (SAVE >
   TOOLS > KIND); a four-track firmware (SLOOP, Felucca) has its one drum track last */
export function isDrumTrk(i) {
  const dev = A.dev;
  if (!dev || !dev.info) return false;
  const ne = dev.info.nengines, x = (dev.mix && dev.mix.tracks && dev.mix.tracks[i]) || (A.lvTracks && A.lvTracks[i]);
  if (i === dev.sel && dev.dump && dev.dump.engine !== undefined) return dev.dump.engine >= ne;
  if (x && x.engine !== undefined) return x.engine >= ne;
  const n = nTrk() || 4;
  return n >= 8 ? i % 4 === 3 : i === n - 1;
}
/* the drum track the FM-1's drum screens show (core.h drum_focus): the selected track if it is one, else the first */
export function drumFocus() {
  const dev = A.dev;
  if (!dev) return -1;
  if (isDrumTrk(dev.sel)) return dev.sel;
  for (let i = 0; i < (nTrk() || 4); i++) if (isDrumTrk(i)) return i;
  return -1;
}

/* parameter ids by their DESC label (firmware/src/core.h), with the usual id when the firmware does not name it */
export const P = { LEVEL: 0, SLEN: 29, CHORD: 49 };
export const key = (s, id) => s + ":" + id;
export const gEng = () => { const i = A.dev.gdesc.findIndex((d) => d && d.label === "ENG"); return i >= 0 ? i : 20; };
export const pSlen = () => { const i = A.dev.pdesc.findIndex((d) => d && d.fmt === F.STEPS); return i >= 0 ? i : P.SLEN; };
export const pById = (label, def) => { const d = A.dev; const i = d.pdesc.findIndex((x, k) => x && k < d.info.pe0 && x.label === label); return i >= 0 ? i : def; };
export const pPan = () => pById("PAN", 39), pMute = () => pById("MUTE", 40);
export const gDrLvl = () => { const i = A.dev.gdesc.findIndex((d, k) => d && k > gEng() && (d.label === "LVL" || d.label === "LEVEL")); return i >= 0 ? i : 25; };
export const isDrum = () => !!A.dev && !!A.dev.dump && A.dev.dump.engine >= A.dev.info.nengines;
/* v5 (SLOOP 2.0): the drum track is edited as its 16 lanes (DRUM_STEP); older firmware: as GM notes */
export const drumGrid = () => isDrum() && !!A.dev.info.proto && A.dev.info.proto >= 5;

/* the device's track colours (ui_studio.c UI_COL): the selected one is the editor's accent (--trk) */
export const TCOL = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)", "var(--t5)", "var(--t6)", "var(--t7)", "var(--t8)"];
export const tcol = (i) => TCOL[(i | 0) % TCOL.length];

/* ------------------------------------------------------------------- files --- */
function save(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const download = (name, obj) => save(name, new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" }));
export const downloadBytes = (name, bytes, type = "application/octet-stream") => save(name, bytes instanceof Blob ? bytes : new Blob([bytes], { type }));
export const fileSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patch";
export const today = () => new Date().toISOString().slice(0, 10);
/* a file chosen by the user: opens the browser's picker, -> the File (or null) */
export function pickFile(accept, multiple = false) {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = accept;
    i.multiple = multiple;
    i.onchange = () => res(multiple ? [...i.files] : i.files[0] || null);
    i.click();
  });
}
