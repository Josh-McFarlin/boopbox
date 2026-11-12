// SPDX-License-Identifier: GPL-3.0-only
/* ---- LIVE pro: the scenes (8: a tap recalls, "store" then a tap keeps the mix there, a double-click names it), the
   morph's length, what a scene brings (its sounds, its tempo), the A / B crossfader. Essentials: the pads and store;
   everything: + the morph, what a scene brings and the crossfader */
import { LVX } from "../../lib/proto.js";
import { notify, sayK, t, useApp } from "../../core/app.js";
import { LvCard } from "./Guide.jsx";
import { LVS, lvxCross, lvxName, lvxRecall, lvxSave, lvxStore } from "./pro.js";

export default function Scenes() {
  useApp();
  const opt = (k, lbl, tip) => (
    <button type="button" className="tog lvadv" data-k={k} title={tip} aria-pressed={!!LVS[k]} onClick={() => { LVS[k] = !LVS[k]; lvxSave(); notify(); }}>{t(lbl)}</button>
  );
  const pick = (k) => (
    <select aria-label={k === "xa" ? "A" : "B"} title={t("lvxTip_ab")} value={String(LVS[k])} onChange={(e) => { LVS[k] = +e.target.value; lvxSave(); notify(); }}>
      {Array.from({ length: LVX.NSCENE }, (_, j) => <option key={j} value={String(j)}>{String(j + 1)}</option>)}
    </select>
  );
  return (
    <LvCard k="scenes" className="lvscnbox" title={t("lvxScenes")}
      head={<span className="lvgrp">
        <button type="button" className="tog" data-lvm="scene:store" aria-pressed={LVS.store} onClick={() => { LVS.store = !LVS.store; notify(); }}>{t("lvxStore")}</button>
      </span>}>
      <div className="lvscnrow">
        {LVS.scenes.map((sc, k) => {
          const cur = LVS.cur === k, f = LVS.curF;
          return (
            <button key={k} type="button" data-lvm={"scene:" + k} className={`lvscn ${sc ? "" : "empty"} ${cur ? "cur" : ""} ${LVS.store ? "store" : ""}`}
              style={{ "--m": cur && f != null && f < 1 ? (f * 100).toFixed(0) + "%" : "100%" }}
              onClick={() => (LVS.store ? lvxStore(k) : LVS.scenes[k] ? lvxRecall(k) : sayK("lvxSceneEmpty"))}
              onDoubleClick={(e) => {
                if (!LVS.scenes[k]) return;
                e.preventDefault();
                const nm = prompt(t("lvxRename"), lvxName(k));
                if (nm != null) { LVS.names[k] = nm.trim().slice(0, 16); lvxSave(); notify(); }
              }}>
              <b>{String(k + 1)}</b><kbd>{"F" + (k + 1)}</kbd>
              <small>{sc ? lvxName(k) + (sc.sounds ? " ♪" : "") + (sc.tempo ? " ♩" : "") : t(LVS.store ? "lvxStoreHere" : "lvSecEmpty")}</small>
            </button>
          );
        })}
      </div>
      <div className="lvxrow">
        <label className="lvgrp lvadv"><span className="dim">{t("lvxMorph")}</span>
          <select aria-label={t("lvxMorph")} data-lvm="scene:morph" value={String(LVS.morph)} onChange={(e) => { LVS.morph = +e.target.value; lvxSave(); notify(); }}>
            {LVX.MORPH_BARS.map((b, k) => <option key={k} value={String(k)}>{b ? `${b} ${t(b > 1 ? "lvxBars" : "lvxBar")}` : t("lvxAtOnce")}</option>)}
          </select></label>
        {opt("sounds", "lvxWithSounds", t("lvxTip_wsounds"))}{opt("tempo", "lvxWithTempo", t("lvxTip_wtempo"))}
        <span className="lvxf-wrap"><span className="dim">{t("lvxCross")}</span><b>A</b><span className="lvadv">{pick("xa")}</span>
          <input type="range" min="0" max="100" value={LVS.xf} className="lvxf" aria-label={t("lvxCross")} data-lvm="scene:xf"
            style={{ "--p": LVS.xf + "%" }}
            ref={(n) => { if (n) n._lvo = { min: 0, max: 100, set: (v) => lvxCross(v) }; }}
            onChange={(e) => lvxCross(+e.target.value)} />
          <span className="lvadv">{pick("xb")}</span><b>B</b></span>
      </div>
    </LvCard>
  );
}
