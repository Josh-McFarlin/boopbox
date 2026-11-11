// SPDX-License-Identifier: GPL-3.0-only
/* ---- the punch-in effects (hold, or LATCH) and the master fx (filter, dust, duck; the master level and the THROWs) */
import { LIVE } from "../../lib/proto.js";
import { notify, t, useApp } from "../../core/app.js";
import { Hold, Knob } from "./controls.jsx";
import { LvCard } from "./Guide.jsx";
import { LV, LVG, LV_FX_GROUPS, LV_KEYS, lvFx, lvGlobal, lvGv, lvOk, lvSend } from "./state.js";

export function Effects() {
  useApp();
  const cur = LV.s ? LV.s.fx : -1, ok = lvOk();
  return (
    <LvCard k="fx" className="lvfxbox"
      head={<div className="lvhead"><h2>{t("lvFx")}</h2>
        <button type="button" className="tog" data-lvm="latch" aria-pressed={LV.latch}
          onClick={() => { LV.latch = !LV.latch; if (!LV.latch && LV.fxHeld >= 0) lvFx(LV.fxHeld, false); notify(); }}>{t("lvLatch")}</button></div>}>
      <p className="dim lvhint">{t("lvFxHint")}</p>
      {LV_FX_GROUPS.map(([k, list]) => (
        <div key={k} className="lvfxg"><span className="dim">{t(k)}</span>
          <div className="lvfxpads">
            {list.map((fx) => (
              <Hold key={fx} lit={"fx:" + fx} className={`lvfx ${fx === cur ? "act" : ""}`} data-lvm={"fx:" + fx} disabled={!ok}
                down={() => { if (LV.latch) lvFx(fx, LV.fxHeld !== fx); else lvFx(fx, true); }} up={() => { if (!LV.latch) lvFx(fx, false); }}>
                <b>{LIVE.FX_NAMES[fx]}</b>{fx < 16 ? <kbd>{"⇧" + LV_KEYS[fx].toUpperCase()}</kbd> : null}
              </Hold>
            ))}
          </div>
        </div>
      ))}
    </LvCard>
  );
}

export function Master() {
  const { dev } = useApp();
  const g = LVG(), s = LV.s;
  const mk = (lbl, id, bip) => {
    const d = dev.gdesc[id] || { min: bip ? -64 : 0, max: bip ? 63 : 127, def: 0 };
    return <Knob label={lbl} o={{ min: d.min, max: d.max, def: d.def, bip, get: () => lvGv(id), set: (v, f) => lvGlobal(id, v, f), mid: "g:" + id }} />;
  };
  /* (2.7) the master level from here (the MASTER knob takes it back when turned) and the THROWs (as FX + OCT- / OCT+) */
  const thr = (bit, lbl) => (
    <Hold lit={"throw:" + bit} className={`lvthrow ${s && (s.throws >> (bit - 1)) & 1 ? "act" : ""}`} data-lvm={"throw:" + bit}
      down={() => { LV.thr = (LV.thr || 0) | bit; lvSend(LIVE.THROW, LV.thr); }} up={() => { LV.thr = (LV.thr || 0) & ~bit; lvSend(LIVE.THROW, LV.thr); }}>{t(lbl)}</Hold>
  );
  return (
    <LvCard k="master" className="lvmaster" head={<h2>{t("lvMaster")}</h2>}>
      <div className="lvknobs">{mk(t("lvFilter"), g.filt, true)}{mk(t("lvDust"), g.dust)}{mk(t("lvDuck"), g.duck)}</div>
      <div className="lvknobs lvxpro">
        <Knob label={t("lvxVolume")} o={{ min: 0, max: 126, def: 100, mid: "master",
          get: () => (LV.volAt && performance.now() - LV.volAt < 1500 ? LV.vol : LV.s && LV.s.master >= 0 ? LV.s.master : LV.vol ?? 100),
          set: (v) => { LV.vol = v; LV.volAt = performance.now(); lvSend(LIVE.MASTER, v); }, fmt: (v) => (LV.s && LV.s.master < 0 ? t("lvxKnob") : String(v)) }} />
        <button type="button" className="tog" data-lvm="master:knob" aria-pressed={!!(s && s.master < 0)} onClick={() => lvSend(LIVE.MASTER, 127)}>{t("lvxKnob")}</button>
        {thr(1, "lvxThrowRev")}{thr(2, "lvxThrowEcho")}
      </div>
    </LvCard>
  );
}
