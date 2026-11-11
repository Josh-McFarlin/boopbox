// SPDX-License-Identifier: GPL-3.0-only
/* ---- (2.7) the drum track on the Sound page: the kit (heard), its level, pan, filter, sends and INSERT, and each pad's
   TUNE and DECAY (LIVE op 12: the DRUMS screen's SOUND page). The drum track is the selected one: its values go by SET.
   The Sound page renders it when the selected track is a drum track. */
import { useEffect } from "react";
import { CMD, DRUM_LANES, LIVE, fmtValue, parse, req } from "../../lib/proto.js";
import { A, P, drumFocus, drumLvGlobal, gDrLvl, getDescOrNull, isDrum, isDrumTrk, notify, report, rq, t, useApp } from "../../core/app.js";
import { userSet } from "../../core/device.js";
import { Card } from "../../ui/kit.jsx";
import { Hold, Knob, SyncSelect } from "./controls.jsx";
import { LV, lvDrumNote, lvNoteOff, lvNoteOn, lvP } from "./state.js";
import "./live.css";
import "./drumpanel.css";

const DP = { built: null, timer: 0, s: null, pad: 0, local: new Map(), kits: null };   /* local: lane -> {tune, dec, t}: what the hand set */
const DP_HOLD = 1500;                                 /* ms a pad's own value wins over what the FM-1 answers */
/* a state from the FM-1, with the pads just turned here kept as the hand set them (a reply to an older request, or
   the poll, never pulls a knob back while it moves) */
function drumPanelMerge(s) {
  const now = performance.now();
  if (s && s.dtw) for (const [lane, v] of DP.local) {
    if (now - v.t < DP_HOLD) s.dtw[lane] = { tune: v.tune, dec: v.dec };
    else DP.local.delete(lane);
  }
  return s;
}
async function drumPanelRead() {
  const dev = A.dev;
  if (!dev || !dev.info || dev.info.proto < 12) return;
  if (DP.s && (!dev.link.idle || [...DP.local.values()].some((v) => performance.now() - v.t < DP_HOLD))) return;   /* (not while turning) */
  try { DP.s = drumPanelMerge(parse[CMD.LIVE](await rq(req.live(LIVE.STATE), { key: "live:state", retries: 0, quiet: true }))); } catch (e) { return; }
  notify();
}
async function drumPanelTw(lane) {
  const d = DP.s.dtw[lane];
  notify();
  /* one request a pad in the queue (key): while one is on its way, the moves after it become the next one */
  try { DP.s = drumPanelMerge(parse[CMD.LIVE](await rq(req.live(LIVE.DRUM_TW, lane, d.tune + 8, d.dec + 4), { key: "dtw:" + lane, front: true }))); }
  catch (e) { report(e); }
  notify();
}
/* a pad heard: a MIDI note on the drum track's channel (as the LIVE page's pads) */
function drumHear(lane, on) {
  const dev = A.dev, tr = isDrumTrk(dev.sel) ? dev.sel : drumFocus(), tok = "dp:" + lane;
  const km = LV.kmode;
  LV.kmode = "play";                                    /* (always heard: not the LIVE page's roll / erase) */
  try { if (on) lvNoteOn(tok, tr, lvDrumNote(lane), 100); else lvNoteOff(tok); } finally { LV.kmode = km; }
}
/* the kits' names: the KIT parameter's list (once per connection) */
async function drumPanelKits(dev) {
  const pe0 = dev.info.pe0;
  let d = dev.pdesc[pe0];
  if (!d || d.label !== "KIT") d = await getDescOrNull(0, pe0).catch(() => null);
  if (dev !== A.dev) return;
  if (d && d.names) { DP.kits = d.names; notify(); }
}

const fmtOf = (d) => (v) => { const [x, u] = fmtValue(d, v); return u && u !== "%" ? `${x} ${u}`.toLowerCase() : x + (u || ""); };

export default function DrumPanel() {
  const { dev } = useApp();
  useEffect(() => {
    if (DP.built !== dev) { DP.built = dev; DP.kits = null; DP.s = null; DP.local.clear(); drumPanelKits(dev); }
    if (!DP.timer) DP.timer = setInterval(() => { if (A.tab === "sound" && A.dev && A.dev.dump && isDrum() && !A.busy) drumPanelRead(); }, 1500);
    drumPanelRead();
    return () => { clearInterval(DP.timer); DP.timer = 0; };
  }, [dev]);
  if (!dev || !dev.dump) return null;
  const pe0 = dev.info.pe0;
  const knob = (lbl, s, id, d) => {
    d = d || (s ? dev.gdesc[id] : dev.pdesc[id]) || { min: 0, max: 127, def: 0 };
    return <Knob key={lbl + id} label={lbl} o={{ min: d.min, max: d.max, def: d.def, bip: d.min < 0, get: () => (s ? dev.dump.g[id] : dev.dump.p[id]) ?? 0,
      set: (v, f) => userSet(s, id, v, f), fmt: fmtOf(d) }} />;
  };
  const kits = DP.kits || [];
  const step = (d) => { const n = kits.length || 1; userSet(0, pe0, ((dev.dump.p[pe0] ?? 0) + d + n) % n, true); };
  const gl = drumLvGlobal() ? 1 : 0;                    /* (BoopBox: the drum track's own level and sends) */
  const itd = dev.pdesc[53];
  const pro = !!(DP.s && DP.s.pro);
  return (
    <Card id="drumpanel" title="DRUMS" ic="symbol_drum">
      <p className="dim">{t("dpHelp")}</p>
      <div className="dprow">
        <label className="dpkit"><span>{t("lvKit")}</span>
          <span className="dpkitsel">
            <button type="button" aria-label="previous" onClick={() => step(-1)}>‹</button>
            <SyncSelect aria-label={t("lvKit")} value={dev.dump.p[pe0] ?? 0} onChange={(e) => userSet(0, pe0, +e.target.value, true)}>
              {kits.map((n, k) => <option key={k} value={String(k)}>{n}</option>)}
            </SyncSelect>
            <button type="button" aria-label="next" onClick={() => step(1)}>›</button>
          </span></label>
        <div className="lvknobs">
          {knob(t("lvLevel"), gl, gl ? gDrLvl() : P.LEVEL)}{knob(t("lvPan"), 0, 39)}{knob(t("lvFilter"), 0, 50)}
          {knob(t("lvRev"), gl, gl ? 26 : lvP("REV", 36))}{knob(t("lvDly"), gl, gl ? 32 : lvP("DLY", 35))}
        </div>
      </div>
      <div className="dprow">
        <label className="dpkit"><span>insert</span>
          <SyncSelect aria-label="INSERT" value={dev.dump.p[53] ?? 0} onChange={(e) => userSet(0, 53, +e.target.value, true)}>
            {((itd && itd.names) || ["OFF"]).map((n, k) => <option key={k} value={String(k)}>{n}</option>)}
          </SyncSelect></label>
        <div className="lvknobs">{[54, 55, 56, 57].map((id) => knob((dev.pdesc[id] || { label: "" }).label.toLowerCase(), 0, id))}</div>
      </div>
      <h3>{t("dpPads")}</h3>
      {pro ? null : <p className="lvneeds">{t("dpNeeds")}</p>}
      {/* the 16 pads: a tap plays it; TUNE and DECAY as on the FM-1 */}
      <div className="dppads">
        {DRUM_LANES.map(([, name], lane) => {
          const tw = (k, lbl, min, max) => <Knob className={pro ? "" : "dpoff"} label={t(lbl)} o={{ min, max, def: 0, bip: true,
            get: () => (DP.s && DP.s.dtw ? DP.s.dtw[lane][k] : 0),
            set: (v) => {
              if (!DP.s || !DP.s.dtw) return;
              const d = DP.s.dtw[lane];
              if (d[k] === v) return;
              d[k] = v;
              DP.local.set(lane, { tune: d.tune, dec: d.dec, t: performance.now() });
              drumPanelTw(lane);
            },
            fmt: (v) => (v > 0 ? "+" + v : String(v)) }} />;
          const tweaked = pro && (DP.s.dtw[lane].tune || DP.s.dtw[lane].dec);
          return (
            <div key={lane} className={`dpcell ${tweaked ? "tweaked" : ""}`}>
              <Hold lit={"dp:" + lane} className="dppad" title={t("dpHear")} down={() => drumHear(lane, true)} up={() => drumHear(lane, false)}>{name}</Hold>
              <div className="dpk">{tw("tune", "lvxTune", -8, 7)}{tw("dec", "lvxDecay", -4, 3)}</div>
            </div>
          );
        })}
      </div>
      <p className="bar">
        <button type="button" disabled={!pro} onClick={async () => {
          if (!DP.s || !DP.s.dtw || !confirm(t("dpResetAsk"))) return;
          for (let l = 0; l < 16; l++) { DP.s.dtw[l] = { tune: 0, dec: 0 }; DP.local.set(l, { tune: 0, dec: 0, t: performance.now() }); await drumPanelTw(l); }
        }}>{t("dpReset")}</button>
        <span className="dim">{" " + t("dpPadsHelp")}</span>
      </p>
    </Card>
  );
}
