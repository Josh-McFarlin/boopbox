// SPDX-License-Identifier: GPL-3.0-only
/* ---- the keys: two octaves and a C; the drum track: 16 pads. The track they play, its octave and velocity (the
   drums: the four levels), its arp and HOLD; (2.7) what the keys do: play, ROLL or ERASE */
import { DRUM_LANES } from "../../lib/proto.js";
import { notify, t, tcol, useApp } from "../../core/app.js";
import { Hold, SyncSelect } from "./controls.jsx";
import { LvCard } from "./Guide.jsx";
import { Ctl } from "./Perform.jsx";
import {
  LV, LVP, LV_KEYS, LV_VEL, lvAllOff, lvChan, lvDrum, lvDrumNote, lvNoteOff, lvNoteOn, lvNum, lvParam, lvPro, lvTarget,
} from "./state.js";

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
export default function Keys() {
  const { dev } = useApp();
  const n = dev.info.ntrk || 4, drum = lvDrum(LV.target), o = LV.tr[LV.target] || { p: [] }, P = LVP();
  const md = dev.pdesc[P.mode];
  const c = lvChan(LV.target);
  const mcls = LV.kmode === "roll" ? "roll" : LV.kmode === "erase" ? "erase" : "";
  const lvls = t("lvLvl");
  return (
    <LvCard k="keys" className="lvplaybox"
      head={<div className="lvhead"><h2>{t("lvKeys")}</h2>
        <span className="lvgrp"><span className="dim">{t("lvTrack")}</span>
          <span className="seg">{Array.from({ length: n }, (_, i) => (
            <button key={i} type="button" className="tog" style={{ "--trk": tcol(i) }} aria-pressed={i === LV.target} onClick={() => lvTarget(i)}>{lvNum(i)}</button>
          ))}</span></span>
        {drum ? null : <>
          <span className="lvgrp lvsynth"><span className="dim">{t("lvOct")}</span>
            <button type="button" aria-label={t("lvOct") + " −"} onClick={() => { LV.oct = Math.max(1, LV.oct - 1); notify(); }}>−</button>
            <span className="lvoct">{`C${LV.oct}–C${LV.oct + 2}`}</span>
            <button type="button" aria-label={t("lvOct") + " +"} onClick={() => { LV.oct = Math.min(7, LV.oct + 1); notify(); }}>+</button></span>
          <label className="lvgrp lvsynth"><span className="dim">{t("lvVel")}</span>
            <input type="range" min="1" max="127" value={LV.vel} aria-label={t("lvVel")} style={{ "--p": (LV.vel / 127 * 100).toFixed(1) + "%" }}
              onChange={(e) => { LV.vel = +e.target.value; notify(); }} /></label>
        </>}
        {drum ? <span className="lvgrp lvdrumv seg">{LV_VEL.map((_, k) => (
          <button key={k} type="button" aria-pressed={k === LV.dlv} onClick={() => { LV.dlv = k; notify(); }}>{Array.isArray(lvls) ? lvls[k] : k}</button>
        ))}</span> : null}
        {drum ? null : <>
          <label className="lvgrp lvsynth"><span className="dim">{t("lvArp")}</span>
            <SyncSelect aria-label={t("lvArp")} value={o.p[P.mode] ?? 0} onChange={(e) => lvParam(LV.target, P.mode, +e.target.value)}>
              {(md && md.names ? md.names : []).map((x, k) => <option key={k} value={String(k)}>{x}</option>)}
            </SyncSelect></label>
          <span className="lvsynth"><button type="button" className="tog" aria-pressed={!!o.p[P.hold]}
            onClick={() => lvParam(LV.target, P.hold, LV.tr[LV.target].p[P.hold] ? 0 : 1)}>{t("lvHold")}</button></span>
        </>}
        {/* (2.7) what the keys do: play, ROLL (note repeat while held, as ARP + key) or ERASE (as EDIT + key) */}
        <span className="lvgrp lvxpro"><span className="seg">{KMODES.map((m) => (
          <button key={m} type="button" data-lvm={"kmode:" + m} aria-pressed={m === LV.kmode} onClick={() => { lvAllOff(); LV.kmode = m; notify(); }}>{t("lvxK_" + m)}</button>
        ))}</span></span>
        {LV.kmode === "roll" && dev.gdesc[30] ? <span className="lvxpro lvrollrate"><Ctl scope={1} id={30} tr={LV.target} d={dev.gdesc[30]} lbl={t("lvxRollRate")} /></span> : null}
      </div>}>
      {c.err && !(LV.kmode !== "play" && lvPro()) ? <p className="bad lvchan">{t(c.err)}</p> : null}
      {drum ? (
        <div className={`lvpads ${mcls}`} style={{ "--trk": tcol(LV.target) }}>
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
        <div className={`lvkeys ${mcls}`} style={{ "--trk": tcol(LV.target) }}>
          {WHITES.map((k) => <PianoKey key={"w" + k.semi} k={k} black={false} />)}
          {BLACKS.map((k) => <PianoKey key={"b" + k.semi} k={k} black />)}
        </div>
      )}
    </LvCard>
  );
}
