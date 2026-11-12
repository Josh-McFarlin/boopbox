// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The LIVE page (2.7): the FM-1 under the hands. Its parts live in pages/live/: state.js (the state and the requests),
// pro.js (LIVE pro: scenes, MIDI learn, the stage tools), the cards (Transport, Strips, Keys, Effects, Scenes, Playlist,
// Guide) and controls.jsx (knob, fader, held button). One screen: the transport and the stage tools, the sections and
// the scenes, the mixer with the effects beside it; the keys in a drawer at the bottom; the first steps and the
// keyboard shortcuts as overlays.
import { useEffect, useRef } from "react";
import { CMD, LIVE, bank, parse } from "../lib/proto.js";
import { A, drumLvGlobal, gDrLvl, notify, nTrk, op, rqf, t, useApp } from "../core/app.js";
import { maybeReload } from "../core/device.js";
import { H } from "../core/hooks.js";
import {
  LV, LVP, LV_KEYS, LV_VEL, lvAllOff, lvDrum, lvDrumLv, lvDrumNote, lvFocused, lvFx, lvKey, lvKits, lvMute, lvNoteOff, lvNoteOn,
  lvOk, lvPro, lvReadTracks, lvSend, lvSolo, lvStart, lvStop, lvTap, lvTarget, lvTouched,
} from "./live/state.js";
import { LVS, lvxLearnPick, lvxMidi, lvxMidiOff, lvxMidiOn, lvxRecall, lvxRestore, lvxStop, lvxStore, lvxTips, lvxViewAll } from "./live/pro.js";
import { Overlays, lvGuideFirst, lvOverlay } from "./live/Guide.jsx";
import { Sections, Transport } from "./live/Transport.jsx";
import Scenes from "./live/Scenes.jsx";
import Mixer from "./live/Strips.jsx";
import Keys from "./live/Keys.jsx";
import { Effects, Master } from "./live/Effects.jsx";
import Playlist, { lvSongNext, plRestore } from "./live/Playlist.jsx";
import "./live/live.css";

/* the page shows / goes (renderPanels) */
let lvShown = false;
function lvShow() {
  const dev = A.dev;
  if (!dev || !dev.dump) return;
  if (!lvShown) {
    lvShown = true;
    LV.built = dev;
    LV.target = dev.sel ?? 0;
    if (!LV.pl.restored) { LV.pl.restored = true; plRestore(); }
    lvxRestore();
    op(async () => {
      await lvKits().catch(() => {});
      await lvReadTracks(true);
      if (lvOk() && !dev.bank) dev.bank = await bank.list(rqf).catch(() => null);   /* (the USER presets in the lists) */
      notify();
    });
  }
  lvStart();
  if (Object.keys(LVS.map).length) lvxMidiOn();         /* learned controls work as soon as the page shows */
}
function lvHide() {
  if (!lvShown) return;
  lvShown = false;
  lvStop();
  lvxStop();
  lvxMidiOff();
  LVS.learn = false;
  document.documentElement.classList.remove("lvfocus");
  if (LV.stale && A.dev && A.dev.dump) { LV.stale = false; A.needReload = true; maybeReload(); }   /* the other pages see what changed here */
  notify();
}
/* pushes while the page shows: a track's level, pan, mute or a parameter turned on the FM-1 */
function livePush(f) {
  const dev = A.dev;
  if (!LV.built) return;
  if (f.cmd === CMD.TRACK_CHANGED) {
    const c = parse[CMD.TRACK_CHANGED](f.a), o = LV.tr[c.track];
    if (!o) return;
    if (c.id === LVP().mute) { if (!lvTouched("lv:" + c.track)) o.mute = c.value ? 1 : 0; }
    else if (c.id === 0 && !lvDrumLv(c.track)) { if (!lvTouched("lv:" + c.track)) o.level = c.value; }
    else if (!lvTouched(`p:${c.track}:${c.id}`)) o.p[c.id] = c.value;
    notify();
  } else if (f.cmd === CMD.CHANGED) {
    const c = parse[CMD.CHANGED](f.a), o = LV.tr[dev.sel];
    if (c.scope) {
      if (c.id === gDrLvl() && drumLvGlobal()) { const ds = (dev.info.ntrk || 4) - 1; if (LV.tr[ds] && !lvTouched("lv:" + ds)) LV.tr[ds].level = c.value; }
      notify();
      return;
    }
    if (!o) return;
    if (c.id === 0 && !lvDrumLv(dev.sel)) { if (!lvTouched("lv:" + dev.sel)) o.level = c.value; }
    else if (c.id === LVP().mute) { if (!lvTouched("lv:" + dev.sel)) o.mute = c.value ? 1 : 0; }
    else if (!lvTouched(`p:${dev.sel}:${c.id}`)) o.p[c.id] = c.value;
    notify();
  } else if (f.cmd === CMD.RELOAD) {
    op(async () => { await lvReadTracks(true); });
  }
}

/* the computer keyboard on the page (not in a field): see lvxShortcutList (the ? key shows it) */
const lvEditing = (e) => e.target.closest && e.target.closest("input:not([type=range]), select, textarea, [contenteditable='true']");
const lvDown = new Map();                  /* e.code -> what its keyup ends */
function lvKeyDown(e) {
  const dev = A.dev;
  if (A.tab !== "live" || !dev || !dev.dump || e.ctrlKey || e.metaKey || e.altKey || lvEditing(e)) return;
  if (e.repeat) { if (lvDown.has(e.code) || e.code === "Space") e.preventDefault(); return; }
  if (e.key === "?") { e.preventDefault(); lvOverlay("keys"); return; }
  if (LV.ui.over) { if (e.key === "Escape") { e.preventDefault(); LV.ui.over = null; notify(); } return; }   /* (an overlay: the page waits) */
  const k = e.key.toLowerCase(), digit = /^Digit(\d)$/.exec(e.code), li = LV_KEYS.indexOf(k);
  let up = null;
  const fk = /^F([1-8])$/.exec(e.key);
  if (fk) { const k = +fk[1] - 1; if (e.shiftKey) lvxStore(k); else lvxRecall(k); }   /* LIVE pro: scenes (Shift: store) */
  else if (e.code === "Space") lvSend(LIVE.PLAY, LV.s && LV.s.playing ? 0 : 1);   /* (always: a focused button takes Enter) */
  else if (digit) {
    const d = +digit[1];
    if (d >= 1 && d <= 4) lvTap(LIVE.LY_SONG, LIVE.SEC + d - 1);
    else if (d >= 5 && d <= 8) {                   /* the bank of four of the track played (as GLO on the FM-1) */
      const i = (nTrk() >= 8 ? (LV.target >> 2) * 4 : 0) + d - 5;
      if (e.shiftKey) lvSolo(i); else if (LV.tr[i]) lvMute(i, !LV.tr[i].mute);
    }
    else if (d === 9) { lvKey(LIVE.LY_MIX, LIVE.FILL, true); up = () => lvKey(LIVE.LY_MIX, LIVE.FILL, false); }
    else if (d === 0) lvTap(LIVE.LY_MIX, LIVE.FILL_BAR);
  } else if (k === "b") lvTap(LIVE.LY_MIX, LIVE.TAP);
  else if (k === "c") lvSend(LIVE.REC);
  else if (k === "n") lvSongNext();
  else if (k === "z" || k === "x") { LV.oct = Math.max(1, Math.min(7, LV.oct + (k === "z" ? -1 : 1))); notify(); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if (e.target.closest && e.target.closest("[role=slider]")) return;
    const n = dev.info.ntrk || 4; lvTarget((LV.target + (e.key === "ArrowLeft" ? n - 1 : 1)) % n);
  } else if (e.key === "Escape") { lvAllOff(); if (LV.s && LV.s.fx >= 0) lvSend(LIVE.FX, LV.s.fx, 0); }
  else if (li >= 0 && e.shiftKey) {
    lvFx(li, LV.latch ? LV.fxHeld !== li : true);
    const lit = "fx:" + li;
    LV.lit.add(lit);
    notify();
    up = () => { LV.lit.delete(lit); notify(); if (!LV.latch) lvFx(li, false); };
  } else if (li >= 0) {
    const tok = "lvkb:" + e.code, drum = lvDrum(LV.target), lit = (drum ? "p:" : "k:") + li;
    LV.lit.add(lit);
    notify();
    lvNoteOn(tok, LV.target, drum ? lvDrumNote(li) : (LV.oct + 1) * 12 + li, drum ? LV_VEL[LV.dlv] : LV.vel, lit);
    up = () => { lvNoteOff(tok); LV.lit.delete(lit); notify(); };
  } else return;
  e.preventDefault();
  if (up) lvDown.set(e.code, up);
}
function lvKeyUp(e) { const up = lvDown.get(e.code); if (up) { lvDown.delete(e.code); up(); } }
function lvLetGo() { for (const up of lvDown.values()) up(); lvDown.clear(); if (A.dev) lvAllOff(); }

let inited = false;
export function init() {
  if (inited) return;
  inited = true;
  Object.assign(H, { livePush });
  window.addEventListener("keydown", lvKeyDown);
  window.addEventListener("keyup", lvKeyUp);
  window.addEventListener("blur", lvLetGo);
  document.addEventListener("visibilitychange", () => { if (document.hidden) lvLetGo(); });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && lvFocused()) { document.documentElement.classList.remove("lvfocus"); notify(); }
  });
  /* MIDI learn: in learn mode a tap on a control picks it (its own action does not happen) */
  for (const ev of ["pointerdown", "mousedown", "click", "contextmenu", "change"]) document.addEventListener(ev, (e) => {
    if (!LVS.learn || A.tab !== "live" || !e.target.closest || !e.target.closest("#lv")) return;
    if (ev === "click" || ev === "change" || ev === "mousedown") { if (e.target.closest("[data-lvm]") && !e.target.closest(".lvlearnbtn, .lvlearnbar")) { e.preventDefault(); e.stopPropagation(); } return; }
    lvxLearnPick(e);
  }, true);
  if (A.MOCK) { window.__lvxMidi = (d) => lvxMidi(Uint8Array.from(d)); window.__lvs = LVS; window.__mockState = () => A.mock && A.mock.state; }   /* (the mock has no controller: the tests play one) */
}

/* in learn mode: every control that can be learned, the mapped ones, the one waiting for a message */
function LearnStyle() {
  if (!LVS.learn) return null;
  const q = (id) => `#lv.learn [data-lvm="${CSS.escape(id)}"]`;
  const mapped = [...new Set(Object.values(LVS.map))];
  return (
    <style>{(mapped.length ? `${mapped.map(q).join(",")} { outline: 2px solid var(--t2); }\n` : "")
      + (LVS.target ? `${q(LVS.target)} { outline: 3px solid var(--t3); }` : "")}</style>
  );
}

export default function Live() {
  const app = useApp();
  const dev = app.dev;
  const ref = useRef(null);
  useEffect(() => {                                   /* (2.7) the LIVE page reads the FM-1 while it shows */
    if (dev && dev.dump) lvShow();
    return lvHide;
  }, [dev]);
  useEffect(() => { lvxTips(ref.current); });
  if (dev && dev.dump) lvGuideFirst();                /* the first steps: once, over the page */         /* a tip on every control (a hover on a computer) */
  const all = lvxViewAll();
  const cls = ["", LVS.learn ? "learn" : "", LVS.lock ? "locked" : "", all ? "" : "simple", lvPro() ? "" : "nopro"].join(" ");
  return (
    <div id="lv" ref={ref} className={cls}>
      <LearnStyle />
      {lvOk() ? null : <p className="lvneeds">{t("lvNeeds")}</p>}
      <Transport />
      <div className="lvrow2"><Sections /><Scenes /></div>
      <div className="lvcols">
        <Mixer />
        <div className="lvside"><Effects /><Master /></div>
      </div>
      <Playlist />
      <Keys />
      <Overlays />
    </div>
  );
}
