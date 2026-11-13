// SPDX-License-Identifier: GPL-3.0-only
/* ---- the mixer (THE mixer of the editor): a narrow strip per track, all the same height: its number (a red dot: armed
   for recording on the FM-1), its sound (‹ › and ☆), its level fader and meter, mute, solo, "play" (the keys play it).
   Its pan, filter, sends and drive are in the strip's "more" panel (always in the page, hidden, so MIDI learn still
   finds them) */
import { useEffect } from "react";
import { A, drumLvGlobal, gDrLvl, notify, t, tcol, useApp } from "../../core/app.ts";
import { showTab } from "../../core/tabs.ts";
import { Fader, Knob, SyncSelect } from "./controls.tsx";
import { LvCard } from "./Guide.tsx";
import {
  LV, LVG, LVP, lvDrum, lvDrumLv, lvGlobal, lvGv, lvLevel, lvMute, lvNum, lvOk, lvParam, lvSolo, lvSound, lvStep, lvTarget,
} from "./state.ts";
import { LVS, lvxFav, lvxFavKey, lvxUser } from "./pro.ts";

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

/* the strip's "more" panel: one open at a time (LV.ui.more), closed by a click elsewhere or Esc */
function useMoreClose(open) {
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!e.target.closest || !e.target.closest(".lsmorebox, .lsmore")) { LV.ui.more = -1; notify(); } };
    const esc = (e) => { if (e.key === "Escape") { LV.ui.more = -1; notify(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
}

function Strip({ i, n }) {
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
    ? [kn(t("lsPan"), P.pan, true), kn(t("lsFilt"), P.filt, true), kn(t("lsRev"), g.drRev, false, true), kn(t("lsDly"), g.drDly, false, true)]
    : drum ? [kn(t("lsPan"), P.pan, true), kn(t("lsFilt"), P.filt, true), kn(t("lsRev"), P.rev), kn(t("lsDly"), P.dly)]
    : [kn(t("lsPan"), P.pan, true), kn(t("lsFilt"), P.filt, true), kn(t("lsRev"), P.rev), kn(t("lsDly"), P.dly), kn(t("lsCho"), P.cho), kn(t("lsDrv"), P.dst)];
  const eng = drum ? "drums" : String(dev.info.engines[o.engine] || "").toLowerCase();
  const nm = drum ?(LV.kitNames || [])[o.p[dev.info.pe0]] || "DRUMS" : (dev.names[o.engine] || [])[o.preset] || "";
  const muted = !!o.mute, solo = !!((LV.solo >> i) & 1), target = LV.target === i;
  const fav = !drum && LVS.favs.has(lvxFavKey(o.engine, o.preset));
  const s = LV.s && LV.s.tracks[i], playing = !!(LV.s && LV.s.playing);
  const mx = dev.mix && dev.mix.tracks[i];
  const armed = !!((mx && mx.armed) || (LV.s && (LV.s.rec >> i) & 1));   /* (REC armed on the FM-1's TRACKS page, or recording here) */
  const want = drum ? String(o.p[dev.info.pe0] ?? 0) : `${o.engine}:${o.preset}`;
  const more = LV.ui.more === i;
  return (
    <div className={`lstrip ${drum ? "drum" : ""} ${target ? "target" : ""} ${muted || (!!LV.solo && !solo) ? "muted" : ""} ${armed ? "rec" : ""}`}
      style={{ "--c": tcol(i) }} role="group" aria-label={`${t("lvTrack")} ${i + 1}`}>
      <div className="lshead">
        <span className="lsnum" title={armed ? t("lvxArmed") : `${t("lvTrack")} ${i + 1}`}>{lvNum(i)}{armed ? <i className="lsdot" aria-label={t("lvxArmed")} /> : null}</span>
        <span className="lsname" />
        {drum ? <span className="lsfav" aria-hidden="true" /> : <button type="button" className="lsfav" title={t("lvxTip_fav")} aria-label={t("lvxFavToggle")} aria-pressed={fav}
          onClick={() => lvxFav(i)}>{fav ? "★" : "☆"}</button>}
      </div>
      {/* the sound picker: the engine's presets (any engine: grouped), the drum track: the kits */}
      <SyncSelect className="lssound" aria-label={t(drum ? "lvKit" : "lvSound")} title={`${eng} · ${nm}`} value={want} onChange={(e) => {
        const v = e.target.value;
        if (drum) lvParam(i, dev.info.pe0, +v);
        else if (v.startsWith("u:")) lvxUser(i, +v.slice(2));
        else { const [en, p] = v.split(":").map(Number); lvSound(i, en, p); }
      }}>
        {drum ? (LV.kitNames || []).map((x, k) => <option key={k} value={String(k)}>{x}</option>)
          : <><SoundOptions />{dev.names.map((names, e) => <optgroup key={e} label={dev.info.engines[e]}>
            {(names || []).map((x, p) => <option key={p} value={`${e}:${p}`}>{x}</option>)}</optgroup>)}</>}
      </SyncSelect>
      <div className="lsnavrow">
        <button type="button" className="lsnav" aria-label="previous" data-lvm={`s${i}:prev`} onClick={() => lvStep(i, -1)}>‹</button>
        <button type="button" className="lsmore" aria-expanded={more} title={t("lvxMoreTip")} aria-label={`${t("lvxMore")} ${i + 1}`}
          onClick={() => { LV.ui.more = more ? -1 : i; notify(); }}>⋯</button>
        <button type="button" className="lsnav" aria-label="next" data-lvm={`s${i}:next`} onClick={() => lvStep(i, 1)}>›</button>
      </div>
      <div className={`lsmorebox ${i >= n / 2 ? "right" : ""}`} hidden={!more}>
        <div className="lsmorehead"><span className="lsnum">{lvNum(i)}</span><span className="dim">{t("lvxMoreTip")}</span></div>
        <div className="lsknobs">{knobs}</div>
      </div>
      <div className="lsprog"><i style={{ width: (playing && s ? ((s.step + 1) / Math.max(1, s.len)) * 100 : 0).toFixed(1) + "%" }} /></div>
      <div className="lsbody">
        <Fader label={t("lvLevel") + " " + (i + 1)} meter={s && s.meter ? Math.max(0, (s.meter - 48) / 80) : 0}
          o={{ min: 0, max: 127, def: lvD.def ?? 100, get: () => tr().level ?? 0, set: (v) => lvLevel(i, v), mid: `s${i}:lvl` }} />
        <span className="lslvl">{o.level ?? ""}</span>
      </div>
      <div className="lsbtns">
        <button type="button" className="tog lsmute" data-lvm={`s${i}:mute`} aria-pressed={muted} onClick={() => lvMute(i, !tr().mute)}>{t("lvMute")}</button>
        {/* (solo: the GLO keys, 2.7) */}
        <button type="button" className="tog lssolo" data-lvm={`s${i}:solo`} aria-pressed={solo} disabled={!lvOk()} title={lvOk() ? undefined : t("lvNeeds")}
          onClick={() => lvSolo(i)}>{t("lvSolo")}</button>
        <button type="button" className="tog lssel" data-lvm={`s${i}:sel`} aria-pressed={target} onClick={() => lvTarget(i)}>{t(target ? "lvSelOn" : "lvSel")}</button>
      </div>
    </div>
  );
}

export default function Mixer() {
  const { dev } = useApp();
  const n = dev.info.ntrk || 4;
  useMoreClose(LV.ui.more >= 0);
  return (
    <LvCard k="mixer" className="lvmix" title={t("lvMixer")}
      head={<button type="button" className="lvsoundlink" title={t("lvxSoundLinkTip")}
        onClick={() => { if (A.dev && A.dev.sel !== LV.target) lvTarget(LV.target); showTab("sound"); }}>{t("lvxSoundLink")}</button>}>
      <div className="lvstrips" style={{ "--n": n }}>{Array.from({ length: n }, (_, i) => <Strip key={i} i={i} n={n} />)}</div>
    </LvCard>
  );
}
