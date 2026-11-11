// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The editor's frame: the side bar (logo, pages, the device), the page's title and status, the track selector, the
// page itself, the footer.
import { useEffect } from "react";
import logo from "../../../assets/logo/boopbox-logo.svg?raw";
import { A, hasTracks, isDrumTrk, ready, setLang, statusText, t, tcol, useApp } from "./core/app.js";
import { selectTrack, toggleConnect } from "./core/device.js";
import { DEV_TABS, NAV, TABS, TAB_NAME, TRACK_TABS, shownTab, showTab, tracksTabOk } from "./core/tabs.js";
import { useInstallPrompt } from "../shared/pwa.js";
import { Ic } from "./ui/kit.jsx";
import { PAGES, Preview } from "./pages/index.js";

/* the logo, cropped to its drawing, on the page's black */
const BRAND = logo.replace(/viewBox="[^"]*"/, 'viewBox="20 40 866 188"').replace(/ width="\d+" height="\d+"/, "")
  .replace(/<rect width="900" height="260" fill="#000"\/>\s*/, "");

/* the offline file's name: with the site's version (make_site.py writes window.BOOPBOX_VERSION) */
const OFFLINE_NAME = typeof window !== "undefined" && window.BOOPBOX_VERSION
  ? `boopbox-editor-${String(window.BOOPBOX_VERSION).replace(/[^A-Za-z0-9.-]/g, "-")}.html` : "boopbox-editor.html";

function Brand() {
  return (
    <a href="#sound" aria-label="BoopBox" className="flex items-end gap-2.5 text-fg no-underline">
      <span className="block w-24 wide:w-[150px] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BRAND }} />
      <span className="pb-0.5 lowercase text-dim">editor</span>
    </a>
  );
}

function Tabs() {
  const app = useApp();
  const want = shownTab();
  const visible = TABS.filter((x) => x !== "tracks" || tracksTabOk());
  const onKey = (e) => {                                   /* arrow keys move between the tabs */
    const dir = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    const i = visible.indexOf(want);
    const n = visible[(i + dir + visible.length) % visible.length];
    e.preventDefault();
    showTab(n);
    document.querySelector(`[data-tab="${n}"]`)?.focus();
  };
  return (
    <nav role="tablist" aria-orientation="vertical" onKeyDown={onKey}
      className="order-3 flex w-full flex-row gap-0.5 overflow-x-auto wide:order-none wide:flex-col">
      {NAV.map(([head, tabs]) => (
        <div key={head} className="contents">
          <div className="mt-3.5 mb-1 ml-3 hidden lowercase text-s3 first:mt-0 wide:block">{t(head)}</div>
          {tabs.map(([tab, name, ic]) => (tab === "tracks" && !tracksTabOk() ? null : (
            <button key={tab} type="button" role="tab" data-tab={tab} aria-selected={tab === want} tabIndex={tab === want ? 0 : -1}
              title={t("tabh_" + tab)} onClick={() => showTab(tab)}
              className="group border-0 border-b-[3px] border-transparent bg-transparent px-3 py-1.5 text-left text-dim hover:bg-s1 hover:text-fg
                aria-selected:border-trk aria-selected:bg-s2 aria-selected:text-fg wide:border-b-0 wide:border-l-4">
              <Ic ic={ic}>{t(name)}</Ic>
              <span className="mt-0.5 ml-[22px] hidden text-[13px] leading-4 whitespace-normal normal-case text-dim opacity-80
                group-hover:opacity-100 group-aria-selected:opacity-100 wide:block">{t("tabd_" + tab)}</span>
            </button>
          )))}
        </div>
      ))}
    </nav>
  );
}

function DeviceCard() {
  const app = useApp();
  const dev = app.dev;
  const [canInstall, install] = useInstallPrompt();
  return (
    <div className="ml-auto flex flex-row flex-wrap items-center gap-2 bg-bg wide:sticky wide:-bottom-5 wide:mt-auto wide:-mb-5 wide:ml-0 wide:flex-col
      wide:items-stretch wide:border-t wide:border-line wide:pt-4 wide:pb-5">
      <div className="flex items-center gap-2 text-fg">
        <span className={`size-2.5 flex-none ${dev && dev.dump ? "bg-t2 shadow-[0_0_8px_var(--t2)]" : dev ? "bg-t3" : "bg-s3"}`} />
        <span>{t("fm1")}</span>
      </div>
      <span className="[overflow-wrap:anywhere] text-fg2">{dev && dev.info ? dev.info.version : ""}</span>
      <span className="text-dim">{!dev || !dev.dump ? "" : t(dev.watch ? "live" : "polling")}</span>
      {app.MOCK ? <span className="text-dim">{t("mock")}</span> : null}
      <button id="connect" type="button" className="pri wide:w-full" disabled={app.connecting} onClick={toggleConnect}>
        <Ic ic="port_usb_c">{t(dev ? "disconnect" : "connect")}</Ic>
      </button>
      <div className="flex justify-between gap-2">
        <a className="dim" href={__OFFLINE__ ? "https://josh-mcfarlin.github.io/boopbox/webapp/installer/" : "../installer/"}
          {...(__OFFLINE__ ? { target: "_blank", rel: "noopener" } : {})}>{t("installer")}</a>
        <button type="button" className="bg-transparent p-0 normal-case text-dim underline hover:bg-transparent hover:text-fg"
          onClick={() => setLang(app.lang === "ja" ? "en" : "ja")}>{t("other")}</button>
      </div>
      {canInstall ? <button type="button" className="pri" onClick={install}>{t("install")}</button> : null}
      {__OFFLINE__ ? null : <a className="dim" href="boopbox-editor.html" download={OFFLINE_NAME}>{t("offline")}</a>}
    </div>
  );
}

/* the track selector (v3): the editor shows the selected track; its colour is the editor's accent (--trk) */
function TrackBar() {
  const { dev } = useApp();
  const n = dev.info.ntrk;
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      <span className="mr-1 lowercase text-dim">{t("track")}</span>
      <span className="seg gap-2" role="group">
        {Array.from({ length: n }, (_, i) => {
          const x = dev.mix && dev.mix.tracks[i];
          const nm = !x ? [isDrumTrk(i) ? "DRUMS" : "", ""] : x.engine >= dev.info.nengines ? [(dev.kitNames || [])[x.e0] || "", "drums"]
            : [(dev.names[x.engine] || [])[x.preset] || "", String(dev.info.engines[x.engine] || "").toLowerCase()];
          const on = i === (dev.sel || 0);
          return (
            <button key={i} type="button" aria-pressed={on} title={`${t("track")} ${i + 1}`} onClick={() => selectTrack(i)} style={{ "--c": tcol(i) }}
              className={`flex max-w-60 min-w-[150px] items-center gap-2.5 overflow-hidden py-0 pr-3 pl-0 normal-case
                ${on ? "bg-s2! text-fg! shadow-[inset_0_-2px_var(--c)]" : "bg-s1! text-fg2!"}`}>
              <span className={`grid size-8 flex-none place-content-center text-[16px] ${on ? "bg-c text-black" : "bg-s2 text-c"}`}>{i + 1}</span>
              <span className="overflow-hidden text-ellipsis">{nm[0]} <span className="dim">{nm[1]}</span></span>
            </button>
          );
        })}
      </span>
    </div>
  );
}

export default function App() {
  const app = useApp();
  const dev = app.dev;
  const want = shownTab();
  const isReady = ready();
  useEffect(() => {                                        /* the accent: the selected track's colour */
    document.documentElement.style.setProperty("--trk", tcol(dev && dev.info && dev.info.ntrk ? dev.sel || 0 : 0));
  });
  /* what the page needs before it can show: an FM-1 (and, for samples and kits, its sample flash) */
  let hint = "", show = true;
  if (DEV_TABS.has(want)) {
    show = isReady;
    if (!dev) hint = "needDevice";
    if (show && (want === "samples" || want === "kits") && !dev.smp) { show = false; hint = "smpNone"; }
  }
  const Page = PAGES[want];
  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)] wide:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="flex flex-row flex-wrap items-center gap-3 border-b border-line px-4 py-3 wide:sticky wide:top-0 wide:h-screen wide:flex-col
        wide:flex-nowrap wide:items-stretch wide:gap-4 wide:overflow-y-auto wide:border-r wide:border-b-0 wide:px-4 wide:py-5">
        <Brand />
        <Tabs />
        <DeviceCard />
      </aside>

      <main className="min-w-0 px-4 pb-6 wide:px-8 wide:pb-8">
        <header className="z-5 border-b border-line bg-bg pt-5 pb-3 wide:sticky wide:top-0">
          <div className="flex min-h-8 items-end gap-4">
            <h1 className="flex-none text-big whitespace-nowrap uppercase text-trk">{t(TAB_NAME[want])}</h1>
            <div id="status" role="status" aria-live="polite"
              className={`ml-auto line-clamp-2 min-h-5 max-w-[70%] overflow-hidden text-right [overflow-wrap:anywhere] ${app.status.err ? "text-red" : "text-dim"}`}>
              {statusText()}</div>
          </div>
          <p className="mt-1.5 mb-0 max-w-[75ch] text-dim empty:hidden">{t("tabh_" + want)}</p>
          {isReady && hasTracks() && TRACK_TABS.has(want) ? <TrackBar /> : null}
        </header>
        {hint ? <p className="my-8 text-dim">{t(app.MOCK && hint === "needDevice" ? "previewLocalConnect" : hint)}</p> : null}
        {app.MOCK && want !== "live" ? <Preview /> : null}
        {show && Page ? <section className="pt-5" id={`p-${want}`} data-tab={want}><Page /></section> : null}
        <footer className="mt-10 border-t border-line pt-4 text-s3 [&_a]:text-dim">
          BoopBox, based on <a href="https://github.com/isod89/sloop-fm1" target="_blank" rel="noopener">SLOOP</a> and on Felucca by Leo
          Kuroshita (@kurogedelic), <a href="https://hugelton.com" target="_blank" rel="noopener">Hügelton Instruments</a>. GPL-3.0.<br />
          {t("foot")} M-VAVE and FM-1 are trademarks of their respective owners.<br />
          <a href={__OFFLINE__ ? "https://josh-mcfarlin.github.io/boopbox/webapp/editor/FUKIAI-LICENSE.txt" : "FUKIAI-LICENSE.txt"}
            {...(__OFFLINE__ ? { target: "_blank", rel: "noopener" } : {})}>{t("iconsCredit")}</a> · {t("fontCredit")}
        </footer>
      </main>
    </div>
  );
}
