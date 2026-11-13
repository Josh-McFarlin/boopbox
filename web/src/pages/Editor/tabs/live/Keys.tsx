// SPDX-License-Identifier: GPL-3.0-only
/* ---- the keys: a drawer fixed at the bottom of the window. Closed: a slim bar (the track the keys play, its octave or
   the drums' level, what the keys do); open: over the page, two octaves and a C (the drum track: 16 pads), the
   velocity, the arp and HOLD, the roll rate. The computer keyboard plays them open or closed (Live.jsx lvKeyDown) */
import { DRUM_LANES } from "../../lib/proto.ts";
import { notify, t, tcol, useApp } from "../../core/app.ts";
import { Ctl, Hold, SyncSelect } from "./controls.tsx";
import { LvCard } from "./Guide.tsx";
import {
  LV, LVP, LV_KEYS, LV_VEL, lvAllOff, lvChan, lvDrum, lvDrumNote, lvNoteOff, lvNoteOn, lvNum, lvParam, lvPro, lvTarget,
} from "./state.ts";

/* two octaves and a C: 15 white keys, the black ones over them */
const WHITES = [], BLACKS = [];
{
  const W = [0, 2, 4, 5, 7, 9, 11], B = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];
  for (let o = 0; o < 2; o++) {
    W.forEach((s, k) => WHITES.push({ semi: o * 12 + s, x: o * 7 + k }));
    B.forEach(([s, k]) => BLACKS.push({ semi: o * 12 + s, x: o * 7 + k }));
  }
  WHITES.push({ semi: 24, x: 14 });
}
function PianoKey({ k, black }) {
  const tok = "lvk:" + k.semi, ki = k.semi < 16 ? LV_KEYS[k.semi] : null;
  return (
    <Hold lit={"k:" + k.semi} className={black ? "bk" : "wk"} style={{ "--x": k.x }} data-semi={k.semi}
      down={() => lvNoteOn(tok, LV.target, (LV.oct + 1) * 12 + k.semi, LV.vel, "k:" + k.semi)} up={() => lvNoteOff(tok)}>
      {ki ? <kbd>{ki.toUpperCase()}</kbd> : null}
    </Hold>
  );
}

const KMODES = ["play", "roll", "erase"];
const oct = (d) => { LV.oct = Math.max(1, Math.min(7, LV.oct + d)); notify(); };

/* what stays in the slim bar */
function Bar() {
  const { dev } = useApp();
  const n = dev.info.ntrk || 4, drum = lvDrum(LV.target), open = !!LV.ui.keys;
  const lvls = t("lvLvl");
  return (
    <div className="lvdbar">
      <button type="button" className="tog lvdtog" aria-expanded={open} aria-pressed={open} title={t(open ? "lvxKeysClose" : "lvxKeysOpen")}
        onClick={() => { LV.ui.keys = !open; notify(); }}>{t("lvxKeysBar") + (open ? " ▼" : " ▲")}</button>
      <span className="lvgrp"><span className="dim">{t("lvTrack")}</span>
        <span className="seg lvdtrk">{Array.from({ length: n }, (_, i) => (
          <button key={i} type="button" className="tog" style={{ "--c": tcol(i) }} aria-pressed={i === LV.target} onClick={() => lvTarget(i)}>{lvNum(i)}</button>
        ))}</span></span>
      {drum ? (
        <span className="lvgrp seg lvdrumv">{LV_VEL.map((_, k) => (
          <button key={k} type="button" className="tog" aria-pressed={k === LV.dlv} onClick={() => { LV.dlv = k; notify(); }}>{Array.isArray(lvls) ? lvls[k] : k}</button>
        ))}</span>
      ) : (
        <span className="lvgrp"><span className="dim">{t("lvOct")}</span>
          <button type="button" aria-label={t("lvOct") + " −"} title="Z" onClick={() => oct(-1)}>−</button>
          <span className="lvoct">{`C${LV.oct}–C${LV.oct + 2}`}</span>
          <button type="button" aria-label={t("lvOct") + " +"} title="X" onClick={() => oct(1)}>+</button></span>
      )}
      {/* (2.7) what the keys do: play, ROLL (note repeat while held, as ARP + key) or ERASE (as EDIT + key) */}
      <span className="lvgrp lvxpro"><span className="seg">{KMODES.map((m) => (
        <button key={m} type="button" className="tog" data-lvm={"kmode:" + m} aria-pressed={m === LV.kmode} onClick={() => { lvAllOff(); LV.kmode = m; notify(); }}>{t("lvxK_" + m)}</button>
      ))}</span></span>
    </div>
  );
}

function Panel() {
  const { dev } = useApp();
  const drum = lvDrum(LV.target), o = LV.tr[LV.target] || { p: [] }, P = LVP();
  const md = dev.pdesc[P.mode];
  const c = lvChan(LV.target);
  const mcls = LV.kmode === "roll" ? "roll" : LV.kmode === "erase" ? "erase" : "";
  return (
    <LvCard k="keys" className="lvplaybox" style={{ "--c": tcol(LV.target) }} title={t("lvKeys")}
      head={<>
        {drum ? null : <>
          <label className="lvgrp"><span className="dim">{t("lvVel")}</span>
            <input type="range" min="1" max="127" value={LV.vel} aria-label={t("lvVel")} style={{ "--p": (LV.vel / 127 * 100).toFixed(1) + "%" }}
              onChange={(e) => { LV.vel = +e.target.value; notify(); }} /><span className="lvvel">{LV.vel}</span></label>
          <label className="lvgrp"><span className="dim">{t("lvArp")}</span>
            <SyncSelect aria-label={t("lvArp")} value={o.p[P.mode] ?? 0} onChange={(e) => lvParam(LV.target, P.mode, +e.target.value)}>
              {(md && md.names ? md.names : []).map((x, k) => <option key={k} value={String(k)}>{x}</option>)}
            </SyncSelect></label>
          <button type="button" className="tog" aria-pressed={!!o.p[P.hold]} title={t("lvxTip_hold")}
            onClick={() => lvParam(LV.target, P.hold, LV.tr[LV.target].p[P.hold] ? 0 : 1)}>{t("lvHold")}</button>
        </>}
        {LV.kmode === "roll" && dev.gdesc[30] ? <span className="lvxpro lvrollrate"><Ctl scope={1} id={30} tr={LV.target} d={dev.gdesc[30]} lbl={t("lvxRollRate")} /></span> : null}
      </>}>
      {c.err && !(LV.kmode !== "play" && lvPro()) ? <p className="bad lvchan">{t(c.err)}</p> : null}
      {drum ? (
        <div className={`lvpads ${mcls}`}>
          {DRUM_LANES.map(([, name], lane) => {
            const tok = "lvp:" + lane;
            return (
              <Hold key={lane} lit={"p:" + lane} className="lvpad" data-lvm={"pad:" + lane}
                down={() => lvNoteOn(tok, LV.target, lvDrumNote(lane), LV_VEL[LV.dlv], "p:" + lane)} up={() => lvNoteOff(tok)}>
                <b>{name}</b><kbd>{LV_KEYS[lane].toUpperCase()}</kbd>
              </Hold>
            );
          })}
        </div>
      ) : (
        <div className={`lvkeys ${mcls}`}>
          {WHITES.map((k) => <PianoKey key={"w" + k.semi} k={k} black={false} />)}
          {BLACKS.map((k) => <PianoKey key={"b" + k.semi} k={k} black />)}
        </div>
      )}
    </LvCard>
  );
}

export default function Keys() {
  useApp();
  const open = !!LV.ui.keys;
  return (
    <div className={`lvdrawer ${open ? "open" : ""}`} style={{ "--trk": tcol(LV.target) }}>
      {/* (closed: the panel stays in the page, hidden, so the learned pads still play) */}
      <div className="lvdpanel" hidden={!open}><Panel /></div>
      <Bar />
    </div>
  );
}
