// SPDX-License-Identifier: GPL-3.0-only
// The Drum synth page (protocol v10): the FM-1's four synthesised kits SYN1..SYN4, a sound per lane, its knobs as the
// device's own. The logic: pages/drumsynth/ds.js.
import { useEffect, useRef, useState } from "react";
import { DSYN, F } from "../lib/proto.js";
import { A, notify, op, t, useApp } from "../core/app.js";
import { Card, Choice, GroupPage, Groups, Help, Ic, KnobBox, Knobs, Slider, barVars } from "../ui/kit.jsx";
import {
  DS, DS_GROUPS, dsCopy, dsCrush, dsDefault, dsKitName, dsLane, dsName, dsOk, dsOpen, dsPick, dsPlay, dsSave, dsSet, dsShown,
  dsSound, dsStore, dsUse,
} from "./drumsynth/ds.js";

const C = "var(--t4)";

/* the value as a big number; it turns like a knob: drag it up or down (Shift: fine), double-click: the default */
function DsValue({ k, min, max, v, txt, unit, def }) {
  const ref = useRef({ y0: 0, v0: 0, on: false });
  const long = String(txt).length + (unit ? Math.ceil(unit.length / 2) : 0) > 6;
  return (
    <span className={`cursor-ns-resize touch-none overflow-hidden whitespace-nowrap text-fg select-none ${long ? "text-[16px] leading-8" : "text-big"}`}
      onPointerDown={(e) => {
        if (e.button) return;
        ref.current = { y0: e.clientY, v0: v, on: true };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const r = ref.current;
        if (!r.on) return;
        const per = Math.max((max - min) / (e.shiftKey ? 800 : 200), e.shiftKey ? 0.05 : 0.12);
        const nv = Math.max(min, Math.min(max, Math.round(r.v0 + (r.y0 - e.clientY) * per)));
        if (nv !== v) dsSet(k, nv, false);
      }}
      onPointerUp={() => { if (ref.current.on) { ref.current.on = false; dsSet(k, v, true); } }}
      onPointerCancel={() => { if (ref.current.on) { ref.current.on = false; dsSet(k, v, true); } }}
      onDoubleClick={() => dsSet(k, def, true)}>
      {String(txt)}{unit ? <small className="ml-1 text-[16px] leading-4 text-dim">{unit}</small> : null}
    </span>
  );
}

function DsKnob({ spec: [k, label, min, max, fmt, names], o, index }) {
  const v = o[k];
  const set = (nv, done) => dsSet(k, nv, done);
  if (names) {
    const d = { fmt: F.ENUM, names, min, max, label };
    return (
      <KnobBox index={index} color={C} enumLike>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap uppercase text-c">{label}</span>
        <Choice d={d} v={v} onChange={set} className="mt-1.5 h-[34px] w-full border-line bg-s2 text-[16px] text-c" />
      </KnobBox>
    );
  }
  const def = dsDefault(k);
  const [txt, unit] = fmt(v, o);
  return (
    <KnobBox index={index} color={C}>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap uppercase text-c">{label}</span>
      <DsValue k={k} min={min} max={max} v={v} txt={txt} unit={unit} def={def} />
      <Slider d={{ min, max, def, label }} v={v} onChange={set} />
    </KnobBox>
  );
}

function DsGroups() {
  useApp();
  const o = dsSound();
  return (
    <div id="dsgroups"><Groups>
      {DS_GROUPS.map(([title, ks]) => (
        <div key={title} className="mb-4 min-w-0 break-inside-avoid border border-line bg-s1 px-4 pt-3.5 pb-3">
          <GroupPage title={t(title)} />
          <Knobs>{ks.map((spec, i) => <DsKnob key={spec[0]} spec={spec} o={o} index={i} />)}</Knobs>
        </div>
      ))}
    </Groups></div>
  );
}

function Range({ id, min, max, v, onChange, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text[0]} <input id={id} type="range" min={min} max={max} step="1" value={v} className="w-[110px]"
        style={{ "--c": C, ...barVars({ min: 0, max: max - min }, v - min) }} onChange={(e) => onChange(+e.target.value)} />
      <span className="dim">{text[1]}</span>
    </span>
  );
}

export default function DrumSynth() {
  const { dev } = useApp();
  const [name, setName] = useState(null);     /* the name being typed (sent when it is done) */
  useEffect(() => { if (A.dev && A.dev.dump) dsShown(); }, [dev]);
  const ok = dsOk(), kit = DS.kit;
  const body = ok && kit;
  const bits = kit ? kit.crush & 15 : 0, sh = kit ? (kit.crush >> 4) + 1 : 1;
  const done = (e) => { if (name != null) dsName(e.target.value); setName(null); };
  return (
    <>
      <Card title={t("dsTitle")} ic="symbol_waves">
        <Help>{t("dsHelp")}</Help>
        {ok ? null : <p className="bad" id="dsold">{t("dsOld")}</p>}
        {body ? (
          <div id="dsbody">
            <p className="bar"><span className="seg" id="dsk">
              {[0, 1, 2, 3].map((k) => (
                <button key={k} type="button" data-v={k} aria-pressed={k === DS.k ? "true" : "false"} onClick={() => dsPick(k)}>{dsKitName(k)}</button>
              ))}</span>
              <span>{t("name")}</span>
              <input id="dsname" type="text" maxLength={8} size={9} spellCheck="false" value={name ?? kit.name}
                onChange={(e) => setName(e.target.value)} onBlur={done}
                onKeyDown={(e) => { if (e.key === "Enter") done(e); }} />
              <span className="dim" id="dsstate">{DS.list && !DS.list.stored ? t("dsNotStored") : t("dsStored")}</span></p>
            <p className="bar"><span>{t("dsFrom")}</span>
              <select id="dsfrom" value={String(DS.from ?? kit.src)} onChange={(e) => { DS.from = +e.target.value; notify(); }}>
                {DS.list.names.map((n, i) => <option key={i} value={String(i)}>{n}</option>)}
              </select>
              <button type="button" id="dscopy" onClick={dsCopy}>{t("dsCopy")}</button>
              <Range id="dsbits" min={0} max={15} v={bits} onChange={(b) => dsCrush(b, sh)}
                text={[t("dsBits"), bits ? `-${bits} bits` : t("dsOff")]} />
              <Range id="dssh" min={1} max={16} v={sh} onChange={(s) => dsCrush(bits, s)}
                text={[t("dsHoldS"), sh > 1 ? `1/${sh}` : t("dsOff")]} /></p>
            <p className="bar">
              <button type="button" id="dsstore" className={DS.list && !DS.list.stored ? "pri" : ""} onClick={dsStore}>
                <Ic ic="symbol_upload">{t("dsStore")}</Ic></button>
              <button type="button" id="dsuse" onClick={dsUse}><Ic ic="symbol_drum">{t("dsUse")}</Ic></button>
              <button type="button" id="dssave" onClick={dsSave}><Ic ic="symbol_download">{t("dsSave")}</Ic></button>
              <button type="button" id="dsopen" onClick={dsOpen}><Ic ic="symbol_folder_open">{t("dsOpen")}</Ic></button></p>
            <div id="dslanes" className="mt-1.5 mb-2.5 grid grid-cols-4 gap-1 wide:grid-cols-8">
              {DSYN.LANES_N.map((n, l) => (
                <button key={l} type="button" data-l={l} aria-pressed={l === DS.lane ? "true" : "false"} onClick={() => dsLane(l)}
                  className={`overflow-hidden px-1 py-2 text-ellipsis whitespace-nowrap ${l === DS.lane ? "bg-t4 text-black" : ""}`}>{n}</button>
              ))}
            </div>
            <p className="bar">
              <button type="button" id="dsplay" className="pri" onClick={() => { if (DS.kit) op(() => dsPlay()); }}>
                <Ic ic="symbol_audio">{t("dsPlay")}</Ic></button>
              <label><input type="checkbox" id="dsauto" checked={DS.auto} onChange={(e) => { DS.auto = e.target.checked; notify(); }} /> <span>{t("dsAuto")}</span></label>
              <span className="dim ml-auto" id="dslane">{`${dsKitName()} · ${DSYN.LANES_N[DS.lane]}`}</span></p>
          </div>
        ) : null}
      </Card>
      {body ? <DsGroups /> : null}
    </>
  );
}
