// SPDX-License-Identifier: GPL-3.0-only
// The Sound page: the selected track's engine and its presets, init, the sound as a file, its parameter cards; the
// drum track's sound (DrumPanel); the FM6 engine's patch (sound/Fm6.jsx, firmware protocol v9).
import { useLayoutEffect, useRef } from "react";
import { A, t, useApp } from "../core/app.js";
import { choosePreset, initSound } from "../core/device.js";
import { H } from "../core/hooks.js";
import { Card, Ic, ParamGroups } from "../ui/kit.jsx";
import DrumPanel from "./live/DrumPanel.jsx";
import { factoryToLib } from "./library/lib.js";
import Fm6Panel, { fm6Follow, fm6Later, fm6Names, fm6On } from "./sound/Fm6.jsx";
import { loadFile, saveFile } from "./sound/patchFile.js";

export function init() {
  Object.assign(H, { fm6Names, fm6Follow, fm6Later, fm6On });
}

/* a select that shows the device's value unless it has the focus (arrowing through the presets loads each one: the
   list must not jump back to the old one while the device loads) */
function useShown(value) {
  const r = useRef(null);
  useLayoutEffect(() => { if (r.current && document.activeElement !== r.current) r.current.value = value; });
  return r;
}

/* engine / preset browser */
function Browser() {
  const { dev } = useApp();
  const e = dev.dump.engine;
  const names = dev.names[e] || [];
  const eng = useShown(String(e)), ps = useShown(String(dev.dump.preset));
  return (
    <div id="browser" className="grid grid-cols-1 items-start gap-4 wide:grid-cols-[200px_minmax(220px,360px)_1fr]">
      <label className="flex flex-col gap-1.5 text-dim lowercase">
        <span>{t("engine")}</span>
        <select id="engine" ref={eng} defaultValue={String(e)} className="h-[34px] w-full"
          onChange={(ev) => choosePreset(+ev.target.value, 0)}>
          {dev.info.engines.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-dim lowercase">
        <span>{t("presets")}</span>
        <select id="preset" size={10} ref={ps} defaultValue={String(dev.dump.preset)} className="h-[200px] w-full"
          onChange={(ev) => { if (A.dev) choosePreset(A.dev.dump.engine, +ev.target.value); }}>
          {names.map((n, i) => <option key={e + ":" + i} value={i}>{n}</option>)}
        </select>
      </label>
      <div className="flex flex-col items-start gap-2 wide:pt-[26px]">
        <p className="bar m-0">
          <button id="init" className="warn" onClick={() => initSound(t("confirmInit"))}>{t("initSound")}</button>
          <button id="factlib" onClick={() => factoryToLib()}><Ic ic="symbol_books">{t("factoryToLib")}</Ic></button>
        </p>
        <p className="bar m-0">
          <button id="savefile" onClick={saveFile}><Ic ic="symbol_download">{t("saveFile")}</Ic></button>
          <button id="loadfile" onClick={loadFile}><Ic ic="symbol_upload">{t("loadFile")}</Ic></button>
        </p>
        <p className="dim my-4" id="ctlhelp"><span>{t("ctlHelp")}</span> <span>{t("ctlDrag")}</span></p>
      </div>
    </div>
  );
}

export default function Sound() {
  const { dev } = useApp();
  if (!dev || !dev.dump) return null;
  const drum = dev.dump.engine >= dev.info.nengines;   /* the drum track: no engine, no presets */
  return (
    <>
      {/* (the drum track's note, drumNote, gave way to its card (2.7): the old page hid it whenever the card showed) */}
      {drum ? null : <Card><Browser /></Card>}
      {/* (2.7) the drum track's sound: what the FM-1's DRUMS screen sets (the kit page, the SOUND page) */}
      {drum ? <DrumPanel /> : null}
      {drum ? null : <ParamGroups where="groups" />}
      {/* the FM6 engine's patch (firmware protocol v9): only while the selected track plays FM6 */}
      <Fm6Panel />
    </>
  );
}
