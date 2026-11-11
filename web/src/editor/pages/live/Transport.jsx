// SPDX-License-Identifier: GPL-3.0-only
/* ---- the transport (play, REC, undo, tempo, the position, loop / song, fill, all off, full screen), the stage tools
   (the view, the clock, the set recorded, MIDI learn, lock) and the sections A..D with their chain */
import { useRef } from "react";
import { LIVE, LVX } from "../../lib/proto.js";
import { TCOL, drumFocus, notify, sayK, t, useApp } from "../../core/app.js";
import { Ic } from "../../ui/kit.jsx";
import { Hold, Knob } from "./controls.jsx";
import { LvCard } from "./Guide.jsx";
import { LV, LVG, lvFocused, lvFull, lvGlobal, lvGv, lvKey, lvOk, lvPanic, lvSend, lvStore, lvTap } from "./state.js";
import { LVS, lvxLearn, lvxLock, lvxRecStart, lvxRecStop, lvxSave, lvxView, lvxViewAll } from "./pro.js";

function Tools() {
  const lockT = useRef(0);
  const now = new Date(), r = LVS.rec, all = lvxViewAll();
  let lv = "0%";
  if (r) { lv = Math.min(100, r.peak * 100).toFixed(0) + "%"; r.peak *= 0.6; }
  return (
    <div className="lvgrp lvtools">
      <button type="button" className="tog lvviewbtn" aria-pressed={all} title={t("lvxTip_view")} onClick={() => lvxView(!all)}>{t(all ? "lvxViewAll" : "lvxViewSimple")}</button>
      <button type="button" className="lvclock" title={t("lvxTip_clock")} onClick={() => { LVS.setStart = 0; notify(); }}>
        <b>{`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}</b>
        <span className="dim">{`${t("lvxSet")} ${LVS.setStart ? LVX.clock(Date.now() - LVS.setStart) : "–:––"}`}</span>
      </button>
      <button type="button" className={`lvrecset lvadv ${r ? "on" : ""}`} aria-pressed={!!r} style={{ "--lv": lv }} title={t("lvxTip_recset")}
        onClick={() => (LVS.rec ? lvxRecStop() : lvxRecStart())}>{r ? `${t("lvxRecStop")} ${LVX.clock(Date.now() - r.t0)}` : t("lvxRecSet")}</button>
      <button type="button" className="tog lvlearnbtn lvadv" aria-pressed={LVS.learn} title={t("lvxTip_learn")} onClick={lvxLearn}>{t("lvxLearn")}</button>
      <Hold lit="lock" className="tog lvlockbtn" aria-pressed={LVS.lock} title={t("lvxTip_lock")}
        down={() => {
          if (!LVS.lock) { lvxLock(true); return; }
          lockT.current = setTimeout(() => lvxLock(false), 800);   /* unlocking: hold it a moment (no accident on stage) */
        }} up={() => clearTimeout(lockT.current)}>{t(LVS.lock ? "lvxUnlock" : "lvxLock")}</Hold>
    </div>
  );
}

export function Transport() {
  const { dev } = useApp();
  const g = LVG(), s = LV.s, ok = lvOk();
  const playing = !!(s && s.playing);
  const armed = !!(s && (s.rec || s.recWait || s.freeTake));   /* (a free take: REC again closes the loop) */
  const bpmD = dev.gdesc[g.bpm] || { min: 40, max: 240, def: 90 };
  const swD = dev.gdesc[g.swing] || { min: 0, max: 100, def: 0 };
  /* the position: the drum track's step as bar.beat (16 steps a bar), the song's part */
  const ds = s && (s.tracks[drumFocus()] || s.tracks[s.tracks.length - 1]);
  const st = ds ? ds.step : 0;
  return (
    <LvCard k="transport" className="lvtrans">
      <div className="lvgrp">
        <button type="button" className={`lvbig lvplay ${playing ? "on" : ""}`} aria-pressed={playing} data-lvm="play" disabled={!ok}
          onClick={() => lvSend(LIVE.PLAY, LV.s && LV.s.playing ? 0 : 1)}>{t(playing ? "lvStop" : "lvPlay")}</button>
        <button type="button" className={`lvrec ${armed ? "on" : ""} ${s && s.recWait && !s.rec ? "wait" : ""}`} data-lvm="rec" disabled={!ok}
          onClick={() => lvSend(LIVE.REC)}>
          <Ic ic="control_rec_f">{t(s && s.freeTake ? "lvRecFree" : s && s.recWait && !s.rec ? "lvRecArm" : "lvRec")}</Ic></button>
        <span className="lvundo">
          <button type="button" data-lvm="undo" disabled={!ok || !(s && s.canUndo)} onClick={() => lvSend(LIVE.UNDO, 0)}>{t("lvUndo")}</button>
          <button type="button" data-lvm="redo" disabled={!ok || !(s && s.canRedo)} onClick={() => lvSend(LIVE.UNDO, 1)}>{t("lvRedo")}</button>
        </span>
      </div>
      <div className="lvgrp">
        <Knob className="lvbpm" label={t("lvBpm")} o={{ min: bpmD.min, max: bpmD.max, def: bpmD.def, get: () => lvGv(g.bpm), set: (v, f) => lvGlobal(g.bpm, v, f), mid: "g:0" }} />
        <button type="button" data-lvm="tap" disabled={!ok} onClick={() => lvTap(LIVE.LY_MIX, LIVE.TAP)}>{t("lvTap")}</button>
        <Knob label={t("lvSwing")} o={{ min: swD.min, max: swD.max, def: swD.def, get: () => lvGv(g.swing), set: (v, f) => lvGlobal(g.swing, v, f), mid: "g:1" }} />
        <div className="lvpos">
          <b>{playing && ds ? `${Math.floor(st / 16) + 1}.${Math.floor((st % 16) / 4) + 1}` : "–.–"}</b>
          <span className="dim">{s && s.songRuns ? `${t("lvSong")} ${s.songAt + 1}/${s.songLen} · ${t("lvBar")} ${s.songBar + 1}/${s.songBars}` : t("lvBar")}</span>
          <span className="lvbeat">{[0, 1, 2, 3].map((k) => <i key={k} className={playing && Math.floor((st % 16) / 4) === k ? "on" : ""} />)}</span>
        </div>
      </div>
      <div className="lvgrp">
        <span className="seg">
          <button type="button" className="tog" data-lvm="loop" disabled={!ok} aria-pressed={!!(s && !s.songMode)}
            onClick={() => { if (!LV.s || LV.s.songMode) lvTap(LIVE.LY_SONG, LIVE.SONG); }}>{t("lvLoop")}</button>
          <button type="button" className="tog" data-lvm="song" disabled={!ok} aria-pressed={!!(s && s.songMode)}
            onClick={() => { if (!LV.s || !LV.s.songMode) lvTap(LIVE.LY_SONG, LIVE.SONG); }}>{t("lvSong")}</button>
        </span>
        <button type="button" className="tog" data-lvm="songrec" disabled={!ok} aria-pressed={!!(s && s.songRec)}
          onClick={() => lvTap(LIVE.LY_SONG, LIVE.SONG_REC)}>{t("lvSongRec")}</button>
        <Hold lit="fill" className={`lvfill ${s && s.fillNow ? "act" : ""}`} data-lvm="fill" disabled={!ok} api={(n) => { LV.ui.fill = n; }}
          down={() => lvKey(LIVE.LY_MIX, LIVE.FILL, true)} up={() => lvKey(LIVE.LY_MIX, LIVE.FILL, false)}>
          <b>{t("lvFill")}</b><small>{t("lvFillHold")}</small></Hold>
        <button type="button" className="tog" data-lvm="fillbar" disabled={!ok} aria-pressed={!!(s && s.fillBar)}
          onClick={() => lvTap(LIVE.LY_MIX, LIVE.FILL_BAR)}>{t("lvFillBar")}</button>
      </div>
      <div className="lvgrp lvright">
        <span className="lvcpu dim">{s ? `${t("lvCpu")} ${s.cpu}%` : ""}</span>
        <button type="button" className="warn" data-lvm="panic" onClick={lvPanic}>{t("lvPanic")}</button>
        <button type="button" className="lvfull" onClick={lvFull}>{t(lvFocused() ? "lvFullOff" : "lvFull")}</button>
      </div>
      <Tools />
      {LVS.learn ? (
        <div className="lvlearnbar">
          <span className="lvlearnmsg">{LVS.target ? t("lvxLearnWait").replace("{x}", LVS.target) : t("lvxLearnPick")}</span>
          <button type="button" onClick={() => { if (confirm(t("lvxLearnClearAsk"))) { LVS.map = {}; lvxSave(); notify(); } }}>{t("lvxLearnClear")}</button>
        </div>
      ) : null}
    </LvCard>
  );
}

/* sections */
export function Sections() {
  const { dev } = useApp();
  const s = LV.s, ok = lvOk(), run = s && s.chainN >= 2;
  const storeTip = t("lvxTip_storesec");
  return (
    <LvCard k="sections" className="lvsecs" head={<h2>{t("lvSections")}</h2>}>
      <div className="lvsecrow">
        {[0, 1, 2, 3].map((k) => {
          const used = s ? (s.ready >> k) & 1 : dev.slotUsed[k];
          const cur = s && s.sec === k, next = s && s.next === k;
          return (
            <button key={k} type="button" className={`lvsec ${cur ? "cur" : ""} ${next ? "next" : ""} ${used ? "" : "empty"}`} style={{ "--c": TCOL[k] }}
              data-lvm={"sec:" + k} disabled={!ok} onClick={() => lvTap(LIVE.LY_SONG, LIVE.SEC + k)}>
              <b>{"ABCD"[k]}</b><small>{t(next ? "lvSecNext" : cur ? "lvSecPlaying" : used ? "" : "lvSecEmpty")}</small>
            </button>
          );
        })}
      </div>
      <p className="lvstorerow dim"><span>{t("lvStore")}</span>
        {[0, 1, 2, 3].map((k) => <button key={k} type="button" className="lvstore" title={storeTip} disabled={!ok} onClick={() => lvStore(k, t)}>{"ABCD"[k]}</button>)}
      </p>
      {/* (2.7) a chain: sections in a row, each for its bars, looped (as SAVE + several keys) */}
      <p className="lvstorerow dim lvxpro"><span>{t("lvxChain")}</span>
        {[0, 1, 2, 3].map((k) => <button key={k} type="button" className="lvstore" title={storeTip} data-lvm={"chain:" + k}
          onClick={() => { if (LV.chain.length < LIVE.CHAIN_MAX) LV.chain.push(k); notify(); }}>{"ABCD"[k]}</button>)}
        <span className={`lvchainlist ${run ? "run" : ""}`}>{LV.chain.length ? LV.chain.map((k) => "ABCD"[k]).join(" ") : t("lvxChainEmpty")}</span>
        <button type="button" aria-label={t("lvxChainClear")} title={t("lvxChainClear")} onClick={() => { LV.chain = []; notify(); }}>✕</button>
        <button type="button" className="pri" data-lvm="chain:play" disabled={LV.chain.length < 2} onClick={() => {
          if (!LV.s || !LV.s.playing) { sayK("lvxChainStopped"); return; }
          lvSend(LIVE.CHAIN, LV.chain.length, ...LV.chain);
        }}>{t("lvxChainPlay")}</button>
        <button type="button" data-lvm="chain:stop" disabled={!run} onClick={() => lvSend(LIVE.CHAIN, 0)}>{t("lvxChainStop")}</button>
      </p>
      <p className="dim lvhint">{t("lvSecHint")}</p>
    </LvCard>
  );
}
