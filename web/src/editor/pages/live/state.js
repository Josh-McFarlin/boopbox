// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
/* ================================================================ LIVE (2.7) === */
/* The LIVE page: the whole FM-1 under the hands for a show, from the computer, a tablet or a phone. What the FM-1's own
   buttons do goes through LIVE (protocol v12, firmware editor_live.c: the same code as the buttons); the mix through
   TRACK_MIX / TRACK_PARAM / SET; the notes as plain MIDI notes on the tracks' channels (no SysEx between a key and its
   sound). The state (transport, sections, mutes, solos, the effect, the steps, the meters) is read about 8 times a
   second while the page shows. An FM-1 before 2.7 (protocol < 12): the mix and the notes only.

   This module: the page's state (LV) and its requests; the components render from LV and call notify(). */
import { CMD, DRUM_LANES, LIVE, mixer, parse, req } from "../../lib/proto.js";
import {
  A, drumFocus, drumLvGlobal, gEng, getDescOrNull, isDrumTrk, notify, nTrk, report, rq, sayK, selfLoad,
} from "../../core/app.js";
import { userSet } from "../../core/device.js";
import { H } from "../../core/hooks.js";

export const LV = {
  built: null, timer: 0, polling: false, s: null, at: 0,        /* s: the last state (parse[CMD.LIVE]) */
  tr: [],                 /* per track: {engine, preset, level, mute, p: [] (TRACK_DUMP)} */
  touch: new Map(),       /* "kind:i" -> time of the user's last change (their value wins for a moment) */
  target: 0, oct: 4, vel: 100, dlv: 2, latch: false, fxHeld: -1,
  held: new Map(),        /* token -> {ch, note, track} */
  lit: new Set(),         /* what shows pressed: "k:<semi>" (a key), "p:<lane>" (a pad), "fx:<n>", "fill", "throw:<bit>" ... */
  stale: false,           /* the selected track's values changed here: the other pages re-read when they show */
  dump: 0, kitNames: null, ui: {},
  kmode: "play", chain: [], solo: 0,
  pl: { songs: [], cur: -1, auto: true, loading: false, at: -1, pct: 0, restored: false },   /* the playlist */
};
/* the core's isDrumTrk reads the LIVE page's tracks too (A.lvTracks: as the old code read LV.tr) */
A.lvTracks = LV.tr;
export function setTracks(tr) { LV.tr = tr; A.lvTracks = tr; }

export const lvOk = () => !!A.dev && !!A.dev.info && A.dev.info.proto >= 12;
export const lvTouched = (k) => performance.now() - (LV.touch.get(k) || 0) < 900;
export const lvTouch = (k) => LV.touch.set(k, performance.now());
/* parameter ids by their labels (core.h P_* / params.c G_*; the numbers: 2.7's) */
export const lvP = (label, def) => { const dev = A.dev; const i = dev.pdesc.findIndex((d, k) => d && k < dev.info.pe0 && d.label === label); return i >= 0 ? i : def; };
export const lvG = (label, def) => { const i = A.dev.gdesc.findIndex((d, k) => d && k > gEng() && d.label === label); return i >= 0 ? i : def; };
export const lvGany = (label, def) => { const i = A.dev.gdesc.findIndex((d) => d && d.label === label); return i >= 0 ? i : def; };
export const LVP = () => ({ pan: lvP("PAN", 39), filt: lvP("FILT", 50), rev: lvP("REV", 36), dly: lvP("DLY", 35), cho: lvP("CHO", 34), dst: lvP("DST", 33),
  mode: lvP("MODE", 17), hold: lvP("HOLD", 23), mute: lvP("MUTE", 40) });
export const LVG = () => ({ bpm: lvGany("BPM", 0), swing: lvGany("SWING", 1), filt: lvG("FILT", 29), dust: lvG("DUST", 27), duck: lvG("DUCK", 28),
  drRev: lvG("REV", 26), drDly: lvG("DLY", 32), ch: [lvG("CH1", 33), lvG("CH2", 34), lvG("CH3", 35)], drCh: lvG("CH4", 24),
  other: lvG("OTHER", 36), route: lvGany("IN", 14), fxCh: lvG("FX CH", 45), drMap: lvG("DR MAP", 46), remote: lvG("REMOTE", 47) });
export const lvDrum = (i) => isDrumTrk(i);
export const lvDrumLv = (i) => lvDrum(i) && drumLvGlobal();   /* a level that is G_DRLVL (four-track firmware) */
export const lvNum = (i) => (lvDrum(i) ? (nTrk() >= 8 ? "D" + (i + 1) : "D") : String(i + 1));   /* (eight tracks: two drum tracks) */
export const lvGv = (id) => (A.dev && A.dev.dump ? A.dev.dump.g[id] : 0);

/* ---- requests: the buttons' ones go first in the queue and are never sent twice (a mute is a toggle) */
export async function lvSend(op, ...a) {
  if (!lvOk()) return null;
  try {
    const s = parse[CMD.LIVE](await rq(req.live(op, ...a), { front: true, retries: 0 }));
    lvApply(s);
    return s;
  } catch (e) { report(e); return null; }
}
export const lvKey = (layer, w, down) => lvSend(LIVE.KEY, layer, w, down ? 1 : 0);
export async function lvTap(layer, w) { await lvKey(layer, w, true); return lvKey(layer, w, false); }

/* ---- the state, read while the page shows */
/* (LIVE pro: each state read also moves the set's timer and the steps' grid; pro.js sets it) */
export const lvTicks = { state: () => {} };
async function lvPoll() {
  const d = A.dev;
  if (!d || !d.dump || A.tab !== "live" || document.hidden || LV.polling || LV.pl.loading) return;
  LV.polling = true;
  try {
    if (lvOk()) lvApply(parse[CMD.LIVE](await rq(req.live(LIVE.STATE), { key: "live:state", retries: 0, quiet: true })));
    else if (Date.now() - LV.at > 600) { LV.at = Date.now(); await lvReadTracks(false); }
    if (d === A.dev && Date.now() - LV.dump > 1500) {   /* one track's sound a time: what the FM-1 changed shows */
      LV.dump = Date.now();
      LV.next = ((LV.next ?? -1) + 1) % (d.info.ntrk || 4);
      await lvReadTrack(LV.next);
      if (LV.next === 0) await lvReadTracks(false);
    }
  } catch (e) { if (e.message !== "closed" && !/^timeout/.test(e.message)) report(e); }
  finally { LV.polling = false; }
}
export function lvStart() {
  if (LV.timer) return;
  LV.timer = setInterval(lvPoll, 120);
  lvPoll();
}
export function lvStop() {
  clearInterval(LV.timer);
  LV.timer = 0;
  lvAllOff();
  if (LV.fxHeld >= 0) { lvSend(LIVE.FX, LV.fxHeld, 0); LV.fxHeld = -1; }   /* (a latched effect too: the page is gone) */
}
export async function lvReadTracks(dumps = true) {
  const d = A.dev;
  const tr = parse[CMD.TRACK](await rq(req.track(), { key: "live:track" }));
  if (d !== A.dev) return;
  tr.tracks.forEach((x, i) => {
    const o = LV.tr[i] || (LV.tr[i] = { p: [] });
    o.engine = x.engine; o.preset = x.preset;
    if (!lvTouched("lv:" + i)) { o.level = x.level; o.mute = x.mute; }
  });
  LV.solo = tr.solo;
  d.sel = tr.sel;
  if (dumps) for (let i = 0; i < tr.ntrk; i++) await lvReadTrack(i);
  notify();
}
export async function lvReadTrack(i) {
  const d = A.dev;
  const r = parse[CMD.TRACK_DUMP](await rq(req.trackDump(i), { key: "live:dump:" + i }), d.info);
  if (d !== A.dev) return;
  const o = LV.tr[i] || (LV.tr[i] = { p: [] });
  r.p.forEach((v, k) => { if (!lvTouched(`p:${i}:${k}`)) o.p[k] = v; });
  o.engine = r.engine; o.preset = r.preset;
  notify();
}
/* the drum kits' names: the drum track's KIT (DESC of P_E0 with the drum track selected) */
export async function lvKits() {
  const dev = A.dev;
  if (dev.kitNames && dev.kitNames.length) { LV.kitNames = dev.kitNames; return; }
  const ds = drumFocus(), sel = dev.sel;
  if (ds < 0) return;
  try {
    if (sel !== ds) await rq(req.track(ds));
    const kd = await getDescOrNull(0, dev.info.pe0);
    if (kd && kd.label === "KIT") LV.kitNames = dev.kitNames = kd.names;
  } finally { if (sel !== ds) await rq(req.track(sel)).catch(() => {}); }
}

/* ---- what the state shows */
export function lvApply(s) {
  const dev = A.dev;
  if (!s || !dev) return;
  const was = LV.s;
  LV.s = s;
  if (!lvTouched("g:bpm")) { const id = LVG().bpm; if (dev.dump.g[id] !== s.bpm) dev.dump.g[id] = s.bpm; }
  s.tracks.forEach((x, i) => {
    const o = LV.tr[i];
    if (o && !lvTouched("lv:" + i)) o.mute = (s.mutes >> i) & 1;
  });
  LV.solo = s.solo;
  if (s.sel !== dev.sel) { dev.sel = s.sel; LV.stale = true; }
  /* the mock: its local audio follows PLAY, the mutes and solos (the Preview page's, when it offers it) */
  if (A.MOCK && H.previewLive) H.previewLive(s, was);
  lvTicks.state();
  notify();
}

/* ---- the mix: level / mute (TRACK_MIX), the rest (TRACK_PARAM; the drum track's sends are globals) */
export async function lvSetMix(i) {
  const o = LV.tr[i], dev = A.dev;
  try {
    const r = await mixer.setMix(rq, i, o.level, o.mute, { key: "mix:" + i, front: true });
    if (!dev.link.hasQueued("mix:" + i) && !lvTouched("lv:" + i)) { o.level = r.level; o.mute = r.mute; notify(); }
  } catch (e) { report(e); }
  if (i === dev.sel) LV.stale = true;
  if (dev.mix && dev.mix.tracks[i]) { dev.mix.tracks[i].level = o.level; dev.mix.tracks[i].mute = o.mute; }
}
export function lvLevel(i, v) { LV.tr[i].level = v; lvTouch("lv:" + i); notify(); lvSetMix(i); }
export function lvMute(i, on) { LV.tr[i].mute = on ? 1 : 0; lvTouch("lv:" + i); notify(); lvSetMix(i); }
export async function lvParam(i, id, v) {
  const o = LV.tr[i], dev = A.dev;
  o.p[id] = v;
  lvTouch(`p:${i}:${id}`);
  notify();
  if (i === dev.sel) { LV.stale = true; dev.dump.p[id] = v; }
  try {
    const r = parse[CMD.TRACK_PARAM](await rq(req.trackParam(i, id, v), { key: `tp:${i}:${id}`, front: true }));
    if (!dev.link.hasQueued(`tp:${i}:${id}`) && !lvTouched(`p:${i}:${id}`)) { o.p[id] = r.value; notify(); }
  } catch (e) { report(e); }
}
export function lvGlobal(id, v, final = true) {
  lvTouch("g:" + id);
  if (id === LVG().bpm) lvTouch("g:bpm");
  userSet(1, id, v, final);
  notify();
}
export async function lvSolo(i) {
  const dev = A.dev;
  if (!lvOk()) return;
  if (dev.info.proto >= 13) { LV.solo ^= 1 << i; notify(); await lvSend(LIVE.SOLO_TRK, i); return; }   /* v13: any track */
  if ((i >> 2) !== ((dev.sel | 0) >> 2)) return;      /* (before v13 the GLO keys solo the selected track's bank of four) */
  LV.solo ^= 1 << i;
  notify();
  await lvTap(LIVE.LY_MIX, LIVE.SOLO + (i & 3));
}
/* the keys play this track: it is selected on the FM-1 too (REC records it; OTHER = SEL channels reach it) */
export async function lvTarget(i) {
  const dev = A.dev;
  lvAllOff();
  LV.target = i;
  notify();
  if (dev.sel === i) return;
  try { dev.sel = parse[CMD.TRACK](await rq(req.track(i), { front: true })).sel; LV.stale = true; } catch (e) { report(e); }
  notify();
}
export async function lvSound(i, e, p) {         /* a sound for track i (PRESET acts on the selected track) */
  const dev = A.dev, sel = dev.sel;
  try {
    if (sel !== i) await rq(req.track(i), { front: true });
    selfLoad();
    await rq(req.preset(e, p), { front: true });
    if (sel !== i && LV.target !== i) await rq(req.track(sel)).catch(() => {});
    else dev.sel = i;
    LV.stale = true;
    await lvReadTrack(i);
  } catch (err) { report(err); }
}
/* the next / previous sound of the track's engine (the drum track: kit) */
export function lvStep(i, d) {
  const o = LV.tr[i], dev = A.dev;
  if (!o) return;
  if (lvDrum(i)) {
    const nk = (LV.kitNames || []).length || 46, v = ((o.p[dev.info.pe0] ?? 0) + d + nk) % nk;
    lvParam(i, dev.info.pe0, v);
    return;
  }
  const names = dev.names[o.engine] || [];
  if (!names.length) return;
  lvSound(i, o.engine, ((o.preset ?? 0) + d + names.length) % names.length);
}
export async function lvStore(k, t) {
  if (!lvOk()) return;
  const used = LV.s && (LV.s.ready >> k) & 1;
  if (used && !confirm(t("lvStoreAsk").replace("{x}", "ABCD"[k]))) return;
  if (used) await lvTap(LIVE.LY_SONG, LIVE.STORE + k);     /* (over a used section the FM-1 asks for a second press) */
  const s = await lvTap(LIVE.LY_SONG, LIVE.STORE + k);
  A.dev.slotUsed[k] = true;
  sayK("lvStored", "ABCD"[k]);
  return s;
}

/* ---- notes: plain MIDI on the track's channel; the drum track: its 16 sounds as GM notes, or 36.. with DR MAP 1-16 */
export function lvChan(i) {
  const g = LVG(), route = lvGv(g.route);
  if (route === 1) return { err: "lvClock" };
  if (route >= 2) return { ch: route - 2 };      /* IN = CH n: that channel, on the selected track */
  const own = lvDrum(i) ? lvGv(g.drCh) : lvGv(g.ch[i]);
  if (own) return { ch: own - 1 };
  if (lvGv(g.other)) return { err: "lvNoChan" };  /* OTHER = OFF */
  const used = new Set([...g.ch.map(lvGv), lvGv(g.drCh), lvGv(g.fxCh), lvGv(g.remote)].filter(Boolean).map((c) => c - 1));
  for (let c = 15; c >= 0; c--) if (!used.has(c)) return { ch: c, sel: true };   /* a free channel plays the selected track */
  return { err: "lvNoChan" };
}
export const lvPro = () => lvOk() && !!(LV.s && LV.s.pro);   /* (2.7) the firmware has the page's own ops 6..12 */
const LV_ROLL_LVL = [1, 2, 0, 3];          /* GHOST SOFT NORM HARD -> the FM-1's levels (core.h LV_*) */
const lvxLaneOf = (note) => (lvGv(LVG().drMap) ? (note - 36) & 15 : DRUM_LANES.findIndex(([n]) => n === note));
/* lit: what shows pressed while the note sounds (LV.lit) */
export function lvNoteOn(token, track, note, vel, lit) {
  const dev = A.dev;
  if (!dev || LV.held.has(token)) return;
  if (LV.kmode && LV.kmode !== "play" && lvPro()) {    /* (2.7) ROLL / ERASE while held, on the FM-1 itself */
    const drum = lvDrum(track), nt = drum ? lvxLaneOf(note) : note & 127;
    if (nt < 0) return;
    if (LV.kmode === "roll") lvSend(LIVE.ROLL, track, nt, drum ? LV_ROLL_LVL[LV.dlv] : 0, 1);
    else lvSend(LIVE.ERASE, track, nt, 1);
    LV.held.set(token, { op: LV.kmode, track, note: nt, lit });
    return;
  }
  const c = lvChan(track);
  if (c.err) { sayK(c.err); return; }
  if (c.sel && dev.sel !== track) { lvTarget(track); return; }
  dev.output.send([0x90 | c.ch, note & 127, Math.max(1, Math.min(127, vel | 0))]);
  LV.held.set(token, { ch: c.ch, note, track, lit });
  if (!lvDrum(track)) LV.lastNote = note & 127;          /* (LIVE pro: a step the grid adds plays this note) */
  if (A.MOCK && H.previewNote) H.previewNote(track, note, true, () => LV.held.has(token));
}
export function lvNoteOff(token) {
  const h = LV.held.get(token);
  if (!h) return;
  LV.held.delete(token);
  if (h.lit) { LV.lit.delete(h.lit); notify(); }
  if (h.op) {
    if (h.op === "roll") lvSend(LIVE.ROLL, h.track, h.note, 0, 0); else lvSend(LIVE.ERASE, h.track, h.note, 0);
    return;
  }
  try { if (A.dev) A.dev.output.send([0x80 | h.ch, h.note & 127, 0]); } catch (e) { /* unplugged */ }
  if (A.MOCK && H.previewNote) H.previewNote(h.track, h.note, false);
}
export function lvAllOff() {
  for (const tok of [...LV.held.keys()]) lvNoteOff(tok);
  if (LV.fxHeld >= 0 && !LV.latch) { lvSend(LIVE.FX, LV.fxHeld, 0); LV.fxHeld = -1; }
  if (LV.ui.fill && LV.ui.fill.release) LV.ui.fill.release();
}
export const lvDrumNote = (lane) => (lvGv(LVG().drMap) ? 36 + lane : DRUM_LANES[lane][0]);
export const LV_KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p"];
export const LV_VEL = [40, 70, 100, 127];        /* GHOST SOFT NORM HARD */

/* ---- the effects: hold, or LATCH (one at a time, as on the FM-1) */
export function lvFx(fx, on) {
  if (!lvOk()) return;
  if (on) { LV.fxHeld = fx; lvSend(LIVE.FX, fx, 1); }
  else if (LV.fxHeld === fx) { LV.fxHeld = -1; lvSend(LIVE.FX, fx, 0); }
}
export const LV_FX_GROUPS = [["lvFxLoops", [0, 1, 2, 3, 24, 4, 5, 6, 7, 19, 23]], ["lvFxTone", [8, 9, 16, 17, 18, 10]],
  ["lvFxColour", [11, 12, 20, 21, 14]], ["lvFxMove", [13, 15, 22, 25, 26]]];
export function lvPanic() { lvAllOff(); if (LV.s && LV.s.fx >= 0) lvSend(LIVE.FX, LV.s.fx, 0); }

/* full screen: the side bar and the header go, the page fills the screen (and the display, where the browser can) */
export const lvFocused = () => document.documentElement.classList.contains("lvfocus");
export function lvFull() {
  const on = !lvFocused();
  document.documentElement.classList.toggle("lvfocus", on);
  try {
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) { /* no full screen API (iPhone): the page alone */ }
  notify();
}
