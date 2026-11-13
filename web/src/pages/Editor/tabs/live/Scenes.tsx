// SPDX-License-Identifier: GPL-3.0-only
/* ---- LIVE pro: the scenes (8: a tap recalls, "store" then a tap keeps the mix there, a double-click names it), the
   morph's length, what a scene brings (its sounds, its tempo), the A / B crossfader. Essentials: the pads and store;
   everything: + the morph, what a scene brings and the crossfader */
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { LVX } from "../../lib/proto.ts";
import { notify, sayK, t, useApp } from "../../core/app.ts";
import { dim, tog } from "../../ui/styles.ts";
import { adv, grp, hov, kbd } from "./styles.ts";
import { LvCard } from "./Guide.tsx";
import type { LvmNode } from "./pro.ts";
import { LVS, lvxCross, lvxName, lvxRecall, lvxSave, lvxStore } from "./pro.ts";

export default function Scenes() {
  useApp();
  const opt = (k: "sounds" | "tempo", lbl: string, tip: string) => (
    <button type="button" className={clsx(tog, adv, "px-2 py-0.5")} data-k={k} title={tip} aria-pressed={!!LVS[k]} onClick={() => { LVS[k] = !LVS[k]; lvxSave(); notify(); }}>{t(lbl)}</button>
  );
  const pick = (k: "xa" | "xb") => (
    <select className="py-0" aria-label={k === "xa" ? "A" : "B"} title={t("lvxTip_ab")} value={String(LVS[k])} onChange={(e) => { LVS[k] = +e.target.value; lvxSave(); notify(); }}>
      {Array.from({ length: LVX.NSCENE }, (_, j) => <option key={j} value={String(j)}>{String(j + 1)}</option>)}
    </select>
  );
  return (
    <LvCard k="scenes" title={t("lvxScenes")}
      head={<span className={grp} data-grp="">
        <button type="button" className={tog} data-lvm="scene:store" aria-pressed={LVS.store} onClick={() => { LVS.store = !LVS.store; notify(); }}>{t("lvxStore")}</button>
      </span>}>
      <div className="grid grid-cols-8 gap-1">
        {LVS.scenes.map((sc, k) => {
          const cur = LVS.cur === k, f = LVS.curF;
          return (
            <button key={k} type="button" data-lvm={"scene:" + k}
              className={clsx("relative flex h-11 flex-col items-start justify-between overflow-hidden border-2 px-1.5 py-0.5 leading-[18px] text-fg normal-case",
                hov, "hover:enabled:bg-none", LVS.store ? "border-dashed border-red" : sc ? "border-t1" : "border-s3",
                cur ? "bg-[linear-gradient(90deg,var(--t1)_var(--m,100%),var(--bg)_var(--m,100%))]" : "bg-bg")}
              style={{ "--m": cur && f != null && f < 1 ? (f * 100).toFixed(0) + "%" : "100%" } as CSSProperties}
              onClick={() => (LVS.store ? lvxStore(k) : LVS.scenes[k] ? lvxRecall(k) : sayK("lvxSceneEmpty"))}
              onDoubleClick={(e) => {
                if (!LVS.scenes[k]) return;
                e.preventDefault();
                const nm = prompt(t("lvxRename"), lvxName(k));
                if (nm != null) { LVS.names[k] = nm.trim().slice(0, 16); lvxSave(); notify(); }
              }}>
              <b className={clsx("font-normal", cur ? "text-black" : sc ? "text-t1" : "text-s3")}>{String(k + 1)}</b>
              <kbd className={clsx(kbd, "absolute top-0.5 right-1", cur ? "text-black" : "text-dim")}>{"F" + (k + 1)}</kbd>
              <small className={clsx("max-w-full overflow-hidden text-ellipsis whitespace-nowrap", cur ? "text-black" : "text-dim")}>{sc ? lvxName(k) + (sc.sounds ? " ♪" : "") + (sc.tempo ? " ♩" : "") : t(LVS.store ? "lvxStoreHere" : "lvSecEmpty")}</small>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-1.5">
        <label className={clsx(grp, adv)}><span className={dim}>{t("lvxMorph")}</span>
          <select className="py-0" aria-label={t("lvxMorph")} data-lvm="scene:morph" value={String(LVS.morph)} onChange={(e) => { LVS.morph = +e.target.value; lvxSave(); notify(); }}>
            {LVX.MORPH_BARS.map((b, k) => <option key={k} value={String(k)}>{b ? `${b} ${t(b > 1 ? "lvxBars" : "lvxBar")}` : t("lvxAtOnce")}</option>)}
          </select></label>
        {opt("sounds", "lvxWithSounds", t("lvxTip_wsounds"))}{opt("tempo", "lvxWithTempo", t("lvxTip_wtempo"))}
        <span className="flex min-w-0 flex-1 basis-[260px] items-center gap-1.5"><span className={dim}>{t("lvxCross")}</span><b>A</b><span className={adv}>{pick("xa")}</span>
          <input type="range" min="0" max="100" value={LVS.xf} className="min-w-[60px] flex-1" aria-label={t("lvxCross")} data-lvm="scene:xf"
            style={{ "--p": LVS.xf + "%" } as CSSProperties}
            ref={(n) => { if (n) (n as HTMLInputElement & LvmNode)._lvo = { min: 0, max: 100, set: (v) => lvxCross(v) }; }}
            onChange={(e) => lvxCross(+e.target.value)} />
          <span className={adv}>{pick("xb")}</span><b>B</b></span>
      </div>
    </LvCard>
  );
}
