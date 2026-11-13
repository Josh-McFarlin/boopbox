// SPDX-License-Identifier: GPL-3.0-only
// The Sound page: on the left the preset browser (an engine filter, a search, the presets of the FM-1, the sound's
// actions: init, copy to the library, file); on the right the selected track's parameters in tabs, in the order the
// sound goes through them (engine, envelope, LFO, effects, voice, arp & key). The drum track gets its own card
// (DrumPanel) instead; the FM6 engine's patch (sound/Fm6.jsx, firmware protocol v9) is in the Engine tab.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import clsx from "clsx";
import { A, readyDev, t, useApp } from "../core/app.ts";
import { choosePreset, initSound } from "../core/device.ts";
import { H } from "../core/hooks.ts";
import { CHEVRON, Ic, More, ParamGroups, layoutKnown } from "../ui/kit.tsx";
import { seg, tog, warn } from "../ui/styles.ts";
import DrumPanel from "./live/DrumPanel.tsx";
import { factoryToLib } from "./library/lib.ts";
import Fm6Panel, { fm6Follow, fm6Later, fm6Names, fm6On } from "./sound/Fm6.tsx";
import { loadFile, saveFile } from "./sound/patchFile.ts";

export function init(): void {
  Object.assign(H, { fm6Names, fm6Follow, fm6Later, fm6On });
}

/* the parameter tabs: [id, name, the LAYOUT cards shown] */
type SoundTab = [id: string, name: string, only: string[]];
const TABS: SoundTab[] = [["engine", "sndTabEngine", ["EDIT"]], ["env", "sndTabEnv", ["ENV"]], ["lfo", "sndTabLfo", ["LFO"]],
  ["fx", "sndTabFx", ["FX"]], ["voice", "sndTabVoice", ["VOICE"]], ["arp", "sndTabArp", ["ARP", "SEL"]]];
const TAB_KEY = "felucca-editor-sound-tab";
const ENG_KEY = "felucca-editor-sound-engine";
const load = (k: string): string | null => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const store = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } };

/* the browser column stays in view under the page's sticky header, above the transport bar */
function useStickyBox() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const hd = document.querySelector<HTMLElement>("main > header"), tr = document.getElementById("transport");
      const top = (hd ? hd.offsetHeight : 0) + 16, bot = (tr ? tr.offsetHeight : 0) + 16;
      el.style.top = top + "px";
      /* (before the page scrolls the column starts lower: it ends above the transport bar all the same) */
      el.style.maxHeight = Math.max(240, window.innerHeight - Math.max(top, el.getBoundingClientRect().top) - bot) + "px";
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) {
      const hd = document.querySelector("main > header"), tr = document.getElementById("transport");
      if (hd) ro.observe(hd);
      if (tr) ro.observe(tr);
    }
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, { passive: true });
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", fit); window.removeEventListener("scroll", fit); };
  }, []);
  return ref;
}

/* the presets of the FM-1: an engine filter (or all engines), a search; a click loads one on the track */
/* a preset in the list: its engine, its number, its name, the engine's name */
interface PresetItem { e: number; p: number; n: string; en: string }

function Browser() {
  useApp();
  const dev = readyDev();
  const cur = dev.dump.engine, curP = dev.dump.preset;
  const [eng, setEng] = useState(() => { const s = load(ENG_KEY); return s === "all" ? "all" : String(cur); });
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const box = useStickyBox();
  /* a sound of another engine loaded from elsewhere (the library, the device): the filter follows it */
  const last = useRef(cur);
  useEffect(() => { if (last.current !== cur) { last.current = cur; if (eng !== "all") setEng(String(cur)); } }, [cur, eng]);
  const engines = dev.info.engines.slice(0, dev.info.nengines);
  const needle = q.trim().toLowerCase();
  const list: PresetItem[] = [];
  engines.forEach((en, e) => {
    if (eng !== "all" && +eng !== e) return;
    (dev.names[e] || []).forEach((n, p) => {
      if (!needle || n.toLowerCase().includes(needle) || (eng === "all" && en.toLowerCase().includes(needle))) list.push({ e, p, n, en });
    });
  });
  /* the current preset scrolled into view (in the list only: the page does not move) */
  useEffect(() => {
    const ul = listRef.current, b = ul && ul.querySelector<HTMLElement>('[aria-current="true"]');
    if (ul && b && (b.offsetTop < ul.scrollTop || b.offsetTop + b.offsetHeight > ul.scrollTop + ul.clientHeight))
      ul.scrollTop = b.offsetTop - ul.clientHeight / 2;
  }, [cur, curP, eng]);
  const pick = (x: PresetItem) => choosePreset(x.e, x.p);
  /* arrows move through the list and load each preset, as the old list box did */
  const keys = (ev: KeyboardEvent<HTMLDivElement>) => {
    const dir = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number | undefined>)[ev.key];
    if (!dir) return;
    const bs = [...listRef.current!.querySelectorAll("button")];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    const nb = bs[Math.max(0, Math.min(bs.length - 1, (i < 0 ? 0 : i + dir)))];
    if (!nb) return;
    ev.preventDefault();
    nb.focus();
    nb.click();
  };
  return (
    <aside ref={box} id="browser" className="sticky flex min-h-0 flex-col gap-3 self-start border border-line bg-s1 p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-dim">{t("engine")}</span>
        <select id="engine" value={eng} className="h-[34px] w-full" style={CHEVRON}
          onChange={(ev) => { setEng(ev.target.value); store(ENG_KEY, ev.target.value === "all" ? "all" : ""); }}>
          <option value="all">{t("sndAllEngines")}</option>
          {engines.map((n, i) => <option key={i} value={String(i)}>{n}</option>)}
        </select>
      </label>
      <input id="presetsearch" type="search" placeholder={t("sndSearch")} aria-label={t("sndSearch")} value={q}
        className="h-[34px] w-full" onChange={(ev) => setQ(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === "Enter" && list.length) pick(list[0]); }} />
      <div ref={listRef} id="presets" role="list" aria-label={t("presets")} onKeyDown={keys}
        className="relative min-h-[160px] flex-1 overflow-y-auto border border-line bg-bg">
        {list.length ? list.map((x) => {
          const on = x.e === cur && x.p === curP;
          return (
            <button key={x.e + ":" + x.p} type="button" role="listitem" aria-current={on} data-preset={x.p}
              title={on ? t("sndCurrent") : t("sndPresetTip")} onClick={() => pick(x)}
              className={`flex w-full items-center justify-between gap-2 border-0 px-2.5 py-1 text-left normal-case ${on ? "bg-acc text-black" : "bg-transparent text-fg hover:bg-s2"}`}>
              <span className="min-w-0 truncate">{x.n}</span>
              {eng === "all" ? <small className={`text-[16px] leading-4 ${on ? "text-black" : "text-dim"}`}>{x.en}</small> : null}
            </button>
          );
        }) : <p className="m-0 p-2.5 text-dim">{t("sndNoMatch")}</p>}
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="grid grid-cols-2 gap-2 [&_button]:w-full">
          <button id="factlib" className="col-span-2" onClick={() => factoryToLib(readyDev().dump.preset)}><Ic ic="symbol_books">{t("factoryToLib")}</Ic></button>
          <button id="savefile" onClick={saveFile}><Ic ic="symbol_download">{t("saveFile")}</Ic></button>
          <button id="loadfile" onClick={loadFile}><Ic ic="symbol_upload">{t("loadFile")}</Ic></button>
          <button id="init" className={clsx(warn, "col-span-2")} onClick={() => initSound(t("confirmInit"))}>{t("initSound")}</button>
        </div>
      </div>
    </aside>
  );
}

function Params() {
  useApp();
  const dev = readyDev();
  const [tab, setTab] = useState(() => { const s = load(TAB_KEY); return s !== null && TABS.some((x) => x[0] === s) ? s : "engine"; });
  if (!layoutKnown(dev.info)) return <div className="min-w-0"><ParamGroups where="groups" flat /><Fm6Panel /></div>;
  const [, , only] = TABS.find((x) => x[0] === tab)!;
  return (
    <div className="min-w-0">
      <div id="ctlhelp" className="mb-4 flex flex-wrap items-center gap-2 [&>[data-more]+div]:my-0 [&>[data-more]+div]:basis-full [&>button[data-more]]:ml-auto">
        <div role="tablist" aria-label={t("sndTabsLabel")} className={seg} id="soundtabs">
          {TABS.map(([id, k]) => (
            <button key={id} type="button" role="tab" data-tab={id} aria-selected={id === tab} aria-pressed={id === tab} className={tog}
              onClick={() => { setTab(id); store(TAB_KEY, id); }}>{t(k)}</button>
          ))}
        </div>
        <More label={t("sndCtlTitle")}><p>{t("ctlHelp")}</p><p>{t("ctlDrag")}</p></More>
      </div>
      <div role="tabpanel">
        <ParamGroups where="groups" only={only} flat />
        {/* the FM6 engine's patch (firmware protocol v9): only while the selected track plays FM6 */}
        {tab === "engine" ? <Fm6Panel /> : null}
      </div>
    </div>
  );
}

export default function Sound() {
  const { dev } = useApp();
  if (!dev || !dev.dump || !dev.info) return null;
  const drum = dev.dump.engine >= dev.info.nengines;   /* the drum track: no engine, no presets */
  /* (2.7) the drum track's sound: what the FM-1's DRUMS screen sets (the kit page, the SOUND page) */
  if (drum) return <DrumPanel />;
  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)] items-start gap-5">
      <Browser />
      <Params />
    </div>
  );
}
