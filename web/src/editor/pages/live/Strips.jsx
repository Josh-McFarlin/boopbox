// SPDX-License-Identifier: GPL-3.0-only
/* ---- the mixer: a strip per track (its sound, level and meter, filter, pan, sends, mute, solo, "play" for the keys) */
import { drumLvGlobal, gDrLvl, t, tcol, useApp } from "../../core/app.js";
import { Fader, Knob, SyncSelect } from "./controls.jsx";
import { LvCard } from "./Guide.jsx";
import {
  LV, LVG, LVP, lvDrum, lvDrumLv, lvGlobal, lvGv, lvLevel, lvMute, lvNum, lvOk, lvParam, lvSolo, lvSound, lvStep, lvTarget,
} from "./state.js";
import { LVS, lvxFav, lvxFavKey, lvxUser } from "./pro.js";

/* the option groups before the engines' presets: the favourites, the USER presets */
function SoundOptions() {
  const { dev } = useApp();
  const favs = [...LVS.favs].map((k) => k.split(":").map(Number)).filter(([e, p]) => dev.names[e] && dev.names[e][p] != null);
  const us = dev.bank ? dev.bank.slots.filter((s) => s.used) : [];
  return (
    <>
      {favs.length ? <optgroup label={"★ " + t("lvxFavs")}>{favs.map(([e, p]) => <option key={`${e}:${p}`} value={`${e}:${p}`}>{"★ " + dev.names[e][p]}</option>)}</optgroup> : null}
      {us.length ? <optgroup label="USER">{us.map((s) => <option key={s.slot} value={`u:${s.slot}`}>{`U${String(s.slot + 1).padStart(2, "0")} ${s.name}`}</option>)}</optgroup> : null}
    </>
  );
}

function Strip({ i }) {
  const { dev } = useApp();
  const drum = lvDrum(i), P = LVP(), g = LVG();
  const tr = () => LV.tr[i] || { p: [] };
  const o = tr();
  const pd = (id, d) => dev.pdesc[id] || d;
  const lvD = (lvDrumLv(i) ? dev.gdesc[gDrLvl()] : dev.pdesc[0]) || { min: 0, max: 127, def: 100 };
  const kn = (lbl, id, bip, glob) => {
    const d = glob ? (dev.gdesc[id] || { min: 0, max: 127, def: 0 }) : pd(id, { min: bip ? -64 : 0, max: bip ? 63 : 127, def: 0 });
    return <Knob key={lbl} label={lbl} o={{ min: d.min, max: d.max, def: d.def, bip,
      get: () => (glob ? lvGv(id) : tr().p[id] ?? 0), set: (v, f) => (glob ? lvGlobal(id, v, f) : lvParam(i, id, v)), mid: glob ? `g:${id}` : `s${i}:${id}` }} />;
  };
  const knobs = drum && drumLvGlobal()
    ? [kn(t("lsFilt"), P.filt, true), kn(t("lsPan"), P.pan, true), kn(t("lsRev"), g.drRev, false, true), kn(t("lsDly"), g.drDly, false, true)]
    : drum ? [kn(t("lsFilt"), P.filt, true), kn(t("lsPan"), P.pan, true), kn(t("lsRev"), P.rev), kn(t("lsDly"), P.dly)]
    : [kn(t("lsFilt"), P.filt, true), kn(t("lsPan"), P.pan, true), kn(t("lsRev"), P.rev), kn(t("lsDly"), P.dly), kn(t("lsCho"), P.cho), kn(t("lsDrv"), P.dst)];
  const nm = drum ? (LV.kitNames || [])[o.p[dev.info.pe0]] || "DRUMS" : (dev.names[o.engine] || [])[o.preset] || "";
  const muted = !!o.mute, solo = !!((LV.solo >> i) & 1), target = LV.target === i;
  const fav = !drum && LVS.favs.has(lvxFavKey(o.engine, o.preset));
  const s = LV.s && LV.s.tracks[i], playing = !!(LV.s && LV.s.playing);
  const want = drum ? String(o.p[dev.info.pe0] ?? 0) : `${o.engine}:${o.preset}`;
  return (
    <div className={`lstrip ${drum ? "drum" : ""} ${target ? "target" : ""} ${muted || (!!LV.solo && !solo) ? "muted" : ""} ${LV.s && (LV.s.rec >> i) & 1 ? "rec" : ""}`}
      style={{ "--c": tcol(i) }} role="group" aria-label={`${t("lvTrack")} ${i + 1}`}>
      <div className="lshead"><span className="lsnum">{lvNum(i)}</span><div className="lsname">{drum ? "DRUMS" : dev.info.engines[o.engine] || ""}</div>
        {drum ? null : <button type="button" className="lsfav" title={t("lvxTip_fav")} aria-label={t("lvxFavToggle")} aria-pressed={fav}
          onClick={() => lvxFav(i)}>{fav ? "★" : "☆"}</button>}</div>
      <div className="lssnd">
        <button type="button" className="lsnav" aria-label="previous" data-lvm={`s${i}:prev`} onClick={() => lvStep(i, -1)}>‹</button>
        {/* the sound picker: the engine's presets (any engine: grouped), the drum track: the kits */}
        <SyncSelect className="lssound" aria-label={t(drum ? "lvKit" : "lvSound")} title={nm} value={want} onChange={(e) => {
          const v = e.target.value;
          if (drum) lvParam(i, dev.info.pe0, +v);
          else if (v.startsWith("u:")) lvxUser(i, +v.slice(2));
          else { const [en, p] = v.split(":").map(Number); lvSound(i, en, p); }
        }}>
          {drum ? (LV.kitNames || []).map((n, k) => <option key={k} value={String(k)}>{n}</option>)
            : <><SoundOptions />{dev.names.map((names, e) => <optgroup key={e} label={dev.info.engines[e]}>
              {(names || []).map((n, p) => <option key={p} value={`${e}:${p}`}>{n}</option>)}</optgroup>)}</>}
        </SyncSelect>
        <button type="button" className="lsnav" aria-label="next" data-lvm={`s${i}:next`} onClick={() => lvStep(i, 1)}>›</button>
      </div>
      <div className="lsprog"><i style={{ width: (playing && s ? ((s.step + 1) / Math.max(1, s.len)) * 100 : 0).toFixed(1) + "%" }} /></div>
      <div className="lsbody">
        <Fader label={t("lvLevel") + " " + (i + 1)} meter={s && s.meter ? Math.max(0, (s.meter - 48) / 80) : 0}
          o={{ min: 0, max: 127, def: lvD.def ?? 100, get: () => tr().level ?? 0, set: (v) => lvLevel(i, v), mid: `s${i}:lvl` }} />
        <div className="lsknobs">{knobs}</div>
      </div>
      <div className="lsbtns">
        <button type="button" className="tog lsmute" data-lvm={`s${i}:mute`} aria-pressed={muted} onClick={() => lvMute(i, !tr().mute)}>{t("lvMute")}</button>
        {/* (solo: the GLO keys, 2.7) */}
        <button type="button" className="tog lssolo" data-lvm={`s${i}:solo`} aria-pressed={solo} disabled={!lvOk()} onClick={() => lvSolo(i)}>{t("lvSolo")}</button>
        <button type="button" className="tog lssel" data-lvm={`s${i}:sel`} aria-pressed={target} onClick={() => lvTarget(i)}>{t(target ? "lvSelOn" : "lvSel")}</button>
      </div>
    </div>
  );
}

export default function Mixer() {
  const { dev } = useApp();
  const n = dev.info.ntrk || 4;
  return (
    <LvCard k="mixer" className="lvmix" head={<h2>{t("lvMixer")}</h2>}>
      <div className="lvstrips">{Array.from({ length: n }, (_, i) => <Strip key={i} i={i} />)}</div>
    </LvCard>
  );
}
