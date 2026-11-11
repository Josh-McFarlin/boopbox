// SPDX-License-Identifier: GPL-3.0-only
/* ---- LIVE pro: PERFORM, the track the keys play: its sound, arp and key, INSERT and the master bus, its steps */
import { useEffect } from "react";
import { DRUM_LANES, F, LIVE, fillGet, fmtValue, noteName } from "../../lib/proto.js";
import { nTrk, notify, op, t, tcol, useApp } from "../../core/app.js";
import { Knob, SyncSelect } from "./controls.jsx";
import { LvCard } from "./Guide.jsx";
import { LV, lvDrum, lvGlobal, lvGv, lvParam, lvReadTrack, lvSend } from "./state.js";
import { LVS, LVX_TABS, lvxEdesc, lvxFill, lvxGridFor, lvxLoadGrid, lvxSave, lvxToggle } from "./pro.js";

/* a control for a parameter: a list (enum) or a knob. scope 0: track tr's P_*, 1: a global; d: its DESC */
export function Ctl({ scope, id, tr, d, lbl, after }) {
  if (!d) return null;
  const get = () => (scope ? lvGv(id) : (LV.tr[tr] || { p: [] }).p[id] ?? d.def ?? 0);
  const set = (v, f = true) => { if (scope) lvGlobal(id, v, f); else lvParam(tr, id, v); if (after) after(v); };
  const mid = scope ? `g:${id}` : `perf:${id}`;
  if (d.fmt === F.ENUM && d.names && d.names.length) {
    return (
      <label className="lvxsel"><span className="dim">{(lbl || d.label).toLowerCase()}</span>
        <SyncSelect aria-label={lbl || d.label} data-lvm={mid} value={get()} onChange={(e) => set(+e.target.value)}
          selRef={(s) => { if (s) s._lvo = { min: d.min, max: d.max, set: (v) => { s.value = String(v); set(v); } }; }}>
          {d.names.map((n, k) => <option key={k} value={String(d.min + k)}>{n}</option>)}
        </SyncSelect>
      </label>
    );
  }
  return <Knob label={(lbl || d.label).toLowerCase()} o={{ min: d.min, max: d.max, def: d.def, bip: d.min < 0, get, set, mid,
    fmt: (v) => { const [x, u] = fmtValue(d, v); return u && u !== "%" ? `${x} ${u}`.toLowerCase() : x + (u || ""); } }} />;
}

function Row({ title, ctls }) {
  const xs = ctls.filter(Boolean);
  return xs.length ? <div className="lvxgrp"><span className="dim">{t(title)}</span><div className="lvknobs">{xs}</div></div> : null;
}

/* ---- the steps of the track the keys play: 16 a page (a drum lane a row), a tap toggles, a right-click its fill */
function Steps({ i }) {
  const { dev } = useApp();
  const drum = lvDrum(i), g = LVS.grid, pd = (id) => dev.pdesc[id];
  useEffect(() => { lvxGridFor(i); }, [i]);
  const gt = g.track === i;
  const len = (LV.tr[i] || { p: [] }).p[29] ?? 16, pages = Math.max(1, Math.ceil(len / 16));
  /* (2.7) the pattern's tools, as EDIT + KNOB 1..3: shift it, x2 / half, transpose (each one undo) */
  const pt = (tool, up, lbl) => <button key={lbl} type="button" data-lvm={`pat:${tool}:${up}`}
    onClick={async () => { await lvSend(LIVE.PATTERN, i, tool, up ? 1 : 0); await lvReadTrack(i); g.at = 0; lvxLoadGrid(); }}>{t(lbl)}</button>;
  /* the play head: the column of the step playing */
  const play = LV.s && LV.s.playing && LV.s.tracks[i] ? LV.s.tracks[i].step - g.page * 16 : -1;
  const cell = (k, on, txt, lane) => {
    const idx = g.page * 16 + k;
    const fc = g.fill ? fillGet(g.fill, idx) % 3 : 0;
    return <button key={k} type="button" aria-pressed={!!on} aria-label={`${idx + 1}`}
      className={`lvgc ${on ? "on" : ""} ${idx >= len ? "out" : ""} ${k % 4 === 0 ? "beat" : ""} ${fc ? (fc === 1 ? "fillonly" : "nofill") : ""} ${k === play ? "ph" : ""}`}
      onClick={() => lvxToggle(idx, lane)} onContextMenu={(e) => { e.preventDefault(); lvxFill(idx); }}>{txt || ""}</button>;
  };
  const steps = gt ? g.steps : [];
  return (
    <div className="lvxsteps">
      <div className="lvhead"><span className="dim">{t("lvxPage")}</span>
        <span className="seg">{Array.from({ length: pages }, (_, k) => (
          <button key={k} type="button" aria-pressed={k === g.page} onClick={() => { g.page = k; notify(); lvxLoadGrid(); }}>{String(k + 1)}</button>
        ))}</span>
        <div className="lvknobs">{[29, 30, 31, 32].map((id) => <Ctl key={id} scope={0} id={id} tr={i} d={pd(id)} />)}</div></div>
      <div className="lvgrp lvxpro lvpattools"><span className="dim">{t("lvxPattern")}</span>
        {pt(0, 0, "lvxShiftL")}{pt(0, 1, "lvxShiftR")}{pt(1, 0, "lvxHalf")}{pt(1, 1, "lvxDouble")}
        {drum ? null : <>{pt(2, 0, "lvxTrDown")}{pt(2, 1, "lvxTrUp")}</>}</div>
      <div className={`lvgrid ${drum ? "drum" : ""}`}>
        {drum ? DRUM_LANES.map(([, name], lane) => (
          <div key={lane} className="lvgr"><span className="lvgl">{name}</span>
            {Array.from({ length: 16 }, (_, k) => { const st = steps[k]; return cell(k, st && (st.on >> lane) & 1, "", lane); })}</div>
        )) : (
          <div className="lvgr">{Array.from({ length: 16 }, (_, k) => {
            const st = steps[k], tie = st && st.time === 1, on = st && st.n > 0 && (st.time === 0 || tie);
            return cell(k, on, st && st.n > 0 && st.time !== 2 ? (tie ? "—" : noteName(st.notes[0])) : "", 0);
          })}</div>
        )}
      </div>
      <p className="dim lvhint">{t(drum ? "lvxGridDrumHint" : "lvxGridHint")}</p>
    </div>
  );
}

const edPending = new Set();   /* the engines whose DESC is on its way */
export default function Perform() {
  const { dev } = useApp();
  const i = LV.target, drum = lvDrum(i), o = LV.tr[i] || { p: [] }, pd = (id) => dev.pdesc[id], gd = (id) => dev.gdesc[id];
  const ed = !drum ? LVS.edesc[o.engine] : null;
  useEffect(() => {
    const e = o.engine;
    if (LVS.tab !== "sound" || drum || ed || dev.sel !== i || !LV.tr[i] || edPending.has(e)) return;
    edPending.add(e);
    op(async () => { try { await lvxEdesc(i); } finally { edPending.delete(e); } });
  });
  const C = (scope, id, d, lbl, after) => (d ? <Ctl key={`${scope}:${id}`} scope={scope} id={id} tr={i} d={d} lbl={lbl} after={after} /> : null);
  let body = null;
  if (LVS.tab === "sound") {
    if (drum) {
      /* (2.7) each pad's TUNE and DECAY, as the DRUMS screen's SOUND page */
      LV.padSel = LV.padSel ?? 0;
      const tw = (k, lbl, min, max) => <Knob label={t(lbl)} o={{ min, max, def: 0, bip: true, mid: "pad:" + k,
        get: () => (LV.s && LV.s.dtw ? LV.s.dtw[LV.padSel][k] : 0),
        set: (v) => { if (!LV.s || !LV.s.dtw) return; const d = LV.s.dtw[LV.padSel]; d[k] = v; lvSend(LIVE.DRUM_TW, LV.padSel, d.tune + 8, d.dec + 4); },
        fmt: (v) => (v > 0 ? "+" + v : String(v)) }} />;
      body = <>
        <div className="lvxgrp lvxpro"><span className="dim">{t("lvxPadSound")}</span>
          <div className="lvknobs">
            <label className="lvxsel"><span className="dim">{t("lvxPad")}</span>
              <SyncSelect aria-label={t("lvxPad")} value={LV.padSel} onChange={(e) => { LV.padSel = +e.target.value; notify(); }}>
                {DRUM_LANES.map(([, n], k) => <option key={k} value={String(k)}>{n}</option>)}</SyncSelect></label>
            {tw("tune", "lvxTune", -8, 7)}{tw("dec", "lvxDecay", -4, 3)}
          </div></div>
        <Row title="lvxIns" ctls={[53, 54, 55, 56, 57].map((id) => C(0, id, pd(id)))} />
        <Row title="lvxTrkFilt" ctls={[C(0, 50, pd(50))]} />
      </>;
    } else {
      body = <>
        <Row title="lvxEngine" ctls={(ed || []).map((d, k) => (d && d.label && d.label !== "--" ? C(0, dev.info.pe0 + k, { ...d }, d.label) : null))} />
        <Row title="lvxMacro" ctls={[5, 6, 7].map((id) => C(0, id, pd(id)))} />
        <Row title="lvxEnv" ctls={[1, 2, 3, 4, 38].map((id) => C(0, id, pd(id)))} />
        <Row title="lvxLfo" ctls={[9, 13, 14, 15, 16].map((id) => C(0, id, pd(id), id === 9 ? "lfo rate" : "lfo " + (pd(id) || {}).label))} />
      </>;
    }
  } else if (LVS.tab === "arp") {
    if (drum) body = <p className="dim lvhint">{t("lvxDrumArp")}</p>;
    else {
      /* "every synth track": the key's values go to the other synth tracks too */
      const keyCtl = (id) => C(0, id, pd(id), null, (v) => {
        if (LVS.keyAll) for (let k = 0; k < (dev.info.ntrk || 4); k++) if (k !== i && !lvDrum(k)) lvParam(k, id, v);
      });
      body = <>
        <Row title="lvxArp" ctls={[17, 18, 19, 20, 21, 24, 23].map((id) => C(0, id, pd(id)))} />
        <div className="lvxgrp"><span className="dim">{t("lvxKey")}</span><div className="lvknobs">
          {[25, 26, 49, 28].map(keyCtl)}
          <button type="button" className="tog" aria-pressed={LVS.keyAll} onClick={() => { LVS.keyAll = !LVS.keyAll; lvxSave(); notify(); }}>{t("lvxKeyAll")}</button>
        </div></div>
      </>;
    }
  } else if (LVS.tab === "fx") {
    body = <>
      <Row title="lvxIns" ctls={[53, 54, 55, 56, 57].map((id) => C(0, id, pd(id)))} />
      <Row title="lvxTrkFilt" ctls={[C(0, 50, pd(50))]} />
      <Row title="lvxDelay" ctls={[4, 5, 6, 7].map((id) => C(1, id, gd(id)))} />
      <Row title="lvxReverb" ctls={[8, 9].map((id) => C(1, id, gd(id)))} />
      <Row title="lvxChorus" ctls={[10, 11].map((id) => C(1, id, gd(id)))} />
      <Row title="lvxTexture" ctls={[37, 38, 39, 40, 41, 42, 43].map((id) => C(1, id, gd(id)))} />
      <Row title="lvxClick" ctls={[C(1, 2, gd(2))]} />
    </>;
  } else body = <Steps i={i} />;
  /* the title follows the track's sound (read after the card was built) */
  const title = drum ? (nTrk() >= 8 ? `DRUMS ${i + 1}` : "DRUMS") : `${t("lvTrack")} ${i + 1} · ${dev.info.engines[o.engine] || ""}`;
  return (
    <LvCard k="perform" className="lvperf lvadv" style={{ "--c": tcol(i) }}
      head={<div className="lvhead"><h2>{t("lvxPerform")}</h2><span className="lvperftrk">{title}</span>
        <span className="lvptabs" role="tablist">{LVX_TABS.map((k) => (
          <button key={k} type="button" role="tab" className="lvptab" data-ptab={k} aria-selected={k === LVS.tab}
            onClick={() => { LVS.tab = k; notify(); }}>{t("lvxTab_" + k)}</button>
        ))}</span></div>}>
      <div className="lvperfbody" key={LVS.tab + ":" + i}>
        <p className="dim lvtabsub">{t("lvxTabSub_" + LVS.tab)}</p>
        {body}
      </div>
    </LvCard>
  );
}
