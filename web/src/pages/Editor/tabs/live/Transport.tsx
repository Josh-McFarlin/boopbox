// SPDX-License-Identifier: GPL-3.0-only
/* ---- the top of the page: the transport in one row (play, REC, undo, tempo, tap, swing, the position, loop / song,
   fill, all off, the help menu), the stage tools in a slim row under it (the view, the clock, the set recorded, MIDI
   learn, lock, CPU, full screen); then the sections A..D with "save the loop into" and their chain */
import { useRef } from "react";
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { LIVE, LVX } from "../../lib/proto.ts";
import { TCOL, drumFocus, notify, readyDev, sayK, t, useApp } from "../../core/app.ts";
import { Ic } from "../../ui/kit.tsx";
import { dim, pri, seg, tog, warn } from "../../ui/styles.ts";
import { adv, blink, dis, headBtn, hov, xpro } from "./styles.ts";
import { Hold, Knob } from "./controls.tsx";
import { HelpMenu, LvCard } from "./Guide.tsx";
import { LV, LVG, lvFocused, lvFull, lvGlobal, lvGv, lvKey, lvOk, lvPanic, lvSend, lvStore, lvTap } from "./state.ts";
import { LVS, lvxLearn, lvxLock, lvxRecStart, lvxRecStop, lvxSave, lvxView, lvxViewAll } from "./pro.ts";

const sep = "mx-0.5 w-px self-stretch bg-line";

function Tools() {
  const lockT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const now = new Date(), r = LVS.rec, all = lvxViewAll(), s = LV.s;
  let lv = "0%";
  if (r) { lv = Math.min(100, r.peak * 100).toFixed(0) + "%"; r.peak *= 0.6; }
  return (
    <span className="flex flex-none items-center gap-1.5">
      <button type="button" className={clsx(tog, headBtn)} aria-pressed={all} title={t("lvxTip_view")} onClick={() => lvxView(!all)}>{t(all ? "lvxViewAll" : "lvxViewSimple")}</button>
      <button type="button" className={clsx("flex items-baseline gap-2 bg-transparent text-left normal-case", headBtn)} title={t("lvxTip_clock")} onClick={() => { LVS.setStart = 0; notify(); }}>
        <b className="font-normal text-fg">{`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}</b>
        <span className={dim}>{`${t("lvxSet")} ${LVS.setStart ? LVX.clock(Date.now() - LVS.setStart) : "–:––"}`}</span>
      </button>
      <button type="button" aria-pressed={!!r} style={{ "--lv": lv } as CSSProperties} title={t("lvxTip_recset")}
        className={clsx("border border-red bg-[linear-gradient(90deg,var(--s3)_var(--lv,0%),var(--s2)_var(--lv,0%))] hover:enabled:bg-none", hov, headBtn, adv,
          r ? "animate-lvblink text-fg" : "text-red")}
        onClick={() => (LVS.rec ? lvxRecStop() : lvxRecStart())}>{r ? `${t("lvxRecStop")} ${LVX.clock(Date.now() - r.t0)}` : t("lvxRecSet")}</button>
      <button type="button" className={clsx("bg-s2 text-dim aria-pressed:bg-t3 aria-pressed:text-black", headBtn, adv)} data-lvlearn="" aria-pressed={LVS.learn} title={t("lvxTip_learn")} onClick={lvxLearn}>{t("lvxLearn")}</button>
      <Hold lit="lock" className={clsx("bg-s2 text-dim aria-pressed:bg-red aria-pressed:text-black", headBtn, LVS.lock && "pointer-events-auto")} aria-pressed={LVS.lock} title={t("lvxTip_lock")}
        down={() => {
          if (!LVS.lock) { lvxLock(true); return; }
          lockT.current = setTimeout(() => lvxLock(false), 800);   /* unlocking: hold it a moment (no accident on stage) */
        }} up={() => clearTimeout(lockT.current)}>{t(LVS.lock ? "lvxUnlock" : "lvxLock")}</Hold>
      <span className="min-w-[7ch] text-right text-dim">{s ? `${t("lvCpu")} ${s.cpu}%` : ""}</span>
      <button type="button" className={headBtn} onClick={lvFull}>{t(lvFocused() ? "lvFullOff" : "lvFull")}</button>
    </span>
  );
}

export function Transport() {
  useApp();
  const dev = readyDev();
  const g = LVG(), s = LV.s, ok = lvOk();
  const playing = !!(s && s.playing);
  const fillOn = LV.lit.has("fill") || !!(s && s.fillNow);
  const armed = !!(s && (s.rec || s.recWait || s.freeTake));   /* (a free take: REC again closes the loop) */
  const bpmD = dev.gdesc[g.bpm] || { min: 40, max: 240, def: 90 };
  const swD = dev.gdesc[g.swing] || { min: 0, max: 100, def: 0 };
  /* the position: the drum track's step as bar.beat (16 steps a bar), the song's part */
  const ds = s && (s.tracks[drumFocus()] || s.tracks[s.tracks.length - 1]);
  const st = ds ? ds.step : 0;
  const why = ok ? undefined : t("lvNeeds");
  const songAt = s && s.songRuns ? `${t("lvSong")} ${s.songAt + 1}/${s.songLen} · ${t("lvBar")} ${s.songBar + 1}/${s.songBars}` : t("lvBar");
  return (
    <LvCard k="transport" className="flex flex-col gap-1.5 in-[html.lvfocus]:sticky in-[html.lvfocus]:top-0 in-[html.lvfocus]:z-4" headClass="order-2 m-0"
      helpClass="top-auto bottom-[34px]" head={<Tools />}>
      <div className="flex min-w-0 items-center gap-1.5">
        <button type="button" aria-pressed={playing}
          className={clsx("h-11 min-w-24 border-2 border-t2 px-3 py-0 text-[32px] leading-8", hov, playing ? "bg-t2 text-black" : clsx("bg-s2 text-t2", dis))} data-lvm="play" disabled={!ok} title={why}
          onClick={() => lvSend(LIVE.PLAY, LV.s && LV.s.playing ? 0 : 1)}>{t(playing ? "lvStop" : "lvPlay")}</button>
        <button type="button" data-lvm="rec"
          className={clsx("h-11 min-w-[72px] border-2 border-red px-2.5 py-0", hov, armed ? "bg-red text-black" : clsx("bg-s2 text-red", dis), s && s.recWait && !s.rec && blink)} disabled={!ok} title={why}
          onClick={() => lvSend(LIVE.REC)}>
          <Ic ic="control_rec_f">{t(s && s.freeTake ? "lvRecFree" : s && s.recWait && !s.rec ? "lvRecArm" : "lvRec")}</Ic></button>
        <span className="flex flex-col gap-0.5 [&>button]:h-[21px] [&>button]:px-2 [&>button]:py-0 [&>button]:leading-5">
          <button type="button" data-lvm="undo" disabled={!ok || !(s && s.canUndo)} title={why} onClick={() => lvSend(LIVE.UNDO, 0)}>{t("lvUndo")}</button>
          <button type="button" data-lvm="redo" disabled={!ok || !(s && s.canRedo)} title={why} onClick={() => lvSend(LIVE.UNDO, 1)}>{t("lvRedo")}</button>
        </span>
        <span className={sep} />
        <Knob look="row" label={t("lvBpm")} o={{ min: bpmD.min, max: bpmD.max, def: bpmD.def, get: () => lvGv(g.bpm), set: (v, f) => lvGlobal(g.bpm, v, f), mid: "g:0" }} />
        <button type="button" data-lvm="tap" disabled={!ok} title={why} onClick={() => lvTap(LIVE.LY_MIX, LIVE.TAP)}>{t("lvTap")}</button>
        <Knob look="row" label={t("lvSwing")} o={{ min: swD.min, max: swD.max, def: swD.def, get: () => lvGv(g.swing), set: (v, f) => lvGlobal(g.swing, v, f), mid: "g:1" }} />
        <div className="grid w-[132px] grid-cols-[auto_auto] grid-rows-[24px_16px] items-center gap-x-2" title={songAt}>
          <b className="row-span-2 text-[32px] leading-6 font-normal text-fg">{playing && ds ? `${Math.floor(st / 16) + 1}.${Math.floor((st % 16) / 4) + 1}` : "–.–"}</b>
          <span className="flex gap-[3px]">{[0, 1, 2, 3].map((k) => <i key={k} className={clsx("h-1.5 w-3", playing && Math.floor((st % 16) / 4) === k ? "bg-fg" : "bg-s3")} />)}</span>
          <span className="overflow-hidden leading-4 text-ellipsis whitespace-nowrap text-dim">{songAt}</span>
        </div>
        <span className={sep} />
        <span className={seg}>
          <button type="button" className={tog} data-lvm="loop" disabled={!ok} title={why} aria-pressed={!!(s && !s.songMode)}
            onClick={() => { if (!LV.s || LV.s.songMode) lvTap(LIVE.LY_SONG, LIVE.SONG); }}>{t("lvLoop")}</button>
          <button type="button" className={tog} data-lvm="song" disabled={!ok} title={why} aria-pressed={!!(s && s.songMode)}
            onClick={() => { if (!LV.s || !LV.s.songMode) lvTap(LIVE.LY_SONG, LIVE.SONG); }}>{t("lvSong")}</button>
        </span>
        <button type="button" className={tog} data-lvm="songrec" disabled={!ok} title={why} aria-pressed={!!(s && s.songRec)}
          onClick={() => lvTap(LIVE.LY_SONG, LIVE.SONG_REC)}>{t("lvSongRec")}</button>
        <Hold lit="fill" data-lvm="fill"
          className={clsx("grid h-11 min-w-16 place-content-center border-2 border-s3 px-2 py-0 text-center leading-4", hov,
            fillOn ? "bg-t3 text-black" : clsx("bg-s2 text-t3", dis))} disabled={!ok} title={why} api={(n) => { LV.ui.fill = n; }}
          down={() => lvKey(LIVE.LY_MIX, LIVE.FILL, true)} up={() => lvKey(LIVE.LY_MIX, LIVE.FILL, false)}>
          <b>{t("lvFill")}</b><small className={fillOn ? "text-black" : "text-dim"}>{t("lvFillHold")}</small></Hold>
        <button type="button" className={tog} data-lvm="fillbar" disabled={!ok} title={why} aria-pressed={!!(s && s.fillBar)}
          onClick={() => lvTap(LIVE.LY_MIX, LIVE.FILL_BAR)}>{t("lvFillBar")}</button>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" className={warn} data-lvm="panic" onClick={lvPanic}>{t("lvPanic")}</button>
          <HelpMenu />
        </span>
      </div>
      {LVS.learn ? (
        <div className="order-3 flex flex-wrap items-center gap-2" data-lvlearn="">
          <span className="text-t3">{LVS.target ? t("lvxLearnWait").replace("{x}", LVS.target) : t("lvxLearnPick")}</span>
          <button type="button" onClick={() => { if (confirm(t("lvxLearnClearAsk"))) { LVS.map = {}; lvxSave(); notify(); } }}>{t("lvxLearnClear")}</button>
        </div>
      ) : null}
    </LvCard>
  );
}

/* sections */
const storeRow = "mt-1.5 flex min-h-6 flex-wrap items-center gap-1";
const storeLbl = "mr-1 text-dim";
const storeBtn = "px-2 py-0.5";
export function Sections() {
  useApp();
  const dev = readyDev();
  const s = LV.s, ok = lvOk(), run = s && s.chainN >= 2;
  const storeTip = t("lvxTip_storesec"), why = ok ? undefined : t("lvNeeds");
  return (
    <LvCard k="sections" title={t("lvSections")}>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((k) => {
          const used = s ? (s.ready >> k) & 1 : dev.slotUsed[k];
          const cur = s && s.sec === k, next = s && s.next === k;
          return (
            <button key={k} type="button" style={{ "--c": TCOL[k] } as CSSProperties}
              className={clsx("flex h-11 items-center justify-between border-2 px-2.5 py-0 text-fg normal-case", hov, used ? "border-c" : "border-s3",
                cur ? "bg-c" : clsx("bg-bg", dis), next && blink)}
              data-lvm={"sec:" + k} disabled={!ok} title={why} onClick={() => lvTap(LIVE.LY_SONG, LIVE.SEC + k)}>
              <b className={clsx("text-[32px] leading-8 font-normal", !used ? "text-s3" : cur ? "text-black" : "text-c")}>{"ABCD"[k]}</b>
              <small className={clsx("lowercase", cur ? "text-black" : "text-dim")}>{t(next ? "lvSecNext" : cur ? "lvSecPlaying" : used ? "" : "lvSecEmpty")}</small>
            </button>
          );
        })}
      </div>
      <div className={storeRow}><span className={storeLbl}>{t("lvStore")}</span>
        {[0, 1, 2, 3].map((k) => <button key={k} type="button" className={storeBtn} title={ok ? storeTip : why} disabled={!ok} onClick={() => lvStore(k, t)}>{"ABCD"[k]}</button>)}
      </div>
      {/* (2.7) a chain: sections in a row, each for its bars, looped (as SAVE + several keys) */}
      <div className={clsx(storeRow, xpro, adv)}><span className={storeLbl}>{t("lvxChain")}</span>
        {[0, 1, 2, 3].map((k) => <button key={k} type="button" className={storeBtn} data-lvm={"chain:" + k}
          onClick={() => { if (LV.chain.length < LIVE.CHAIN_MAX) LV.chain.push(k); notify(); }}>{"ABCD"[k]}</button>)}
        <span className={clsx("min-w-[8ch] px-1", run ? "text-t2" : "text-fg")}>{LV.chain.length ? LV.chain.map((k) => "ABCD"[k]).join(" ") : t("lvxChainEmpty")}</span>
        <button type="button" className={storeBtn} aria-label={t("lvxChainClear")} title={t("lvxChainClear")} onClick={() => { LV.chain = []; notify(); }}>✕</button>
        <button type="button" className={clsx(pri, storeBtn)} data-lvm="chain:play" disabled={LV.chain.length < 2} title={LV.chain.length < 2 ? t("lvxChainEmpty") : undefined}
          onClick={() => {
            if (!LV.s || !LV.s.playing) { sayK("lvxChainStopped"); return; }
            lvSend(LIVE.CHAIN, LV.chain.length, ...LV.chain);
          }}>{t("lvxChainPlay")}</button>
        <button type="button" className={storeBtn} data-lvm="chain:stop" disabled={!run} title={run ? undefined : t("lvxChainNotRun")} onClick={() => lvSend(LIVE.CHAIN, 0)}>{t("lvxChainStop")}</button>
      </div>
    </LvCard>
  );
}
