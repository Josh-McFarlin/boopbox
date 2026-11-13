// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The editor's frame: the site's header; the side bar (the pages, one line each, then the links); the top bar (the
// page's title and purpose, its actions corner #page-actions, the status, the FM-1 and Connect); the track selector;
// the page itself; the transport bar at the bottom of the window. The editor is for a desktop browser: narrower than
// 1000 px, a note says so instead.
import { useEffect } from "react";
import type React from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { hasTracks, isDrumTrk, readyDev, ready, statusText, t, tcol, useApp } from "./core/app.ts";
import { selectTrack, toggleConnect } from "./core/device.ts";
import { DEV_TABS, NAV, TABS, TAB_NAME, TRACK_TABS, shownTab, showTab } from "./core/tabs.ts";
import { useInstallPrompt } from "../../lib/pwa.ts";
import SiteHeader from "../../components/SiteHeader.tsx";
import { PUBLIC_SITE_URL } from "../../lib/siteConfig.ts";
import { Ic } from "./ui/kit.tsx";
import { PAGES } from "./tabs/index.ts";
import TransportBar from "./ui/TransportBar.tsx";
import { dim, pri, title } from "./ui/styles.ts";

declare global {
  /* the site's version (make_site.py) */
  interface Window { BOOPBOX_VERSION?: string }
}

/* the offline file's name: with the site's version (make_site.py writes window.BOOPBOX_VERSION) */
const OFFLINE_NAME = typeof window !== "undefined" && window.BOOPBOX_VERSION
  ? `boopbox-editor-${String(window.BOOPBOX_VERSION).replace(/[^A-Za-z0-9.-]/g, "-")}.html` : "boopbox-editor.html";
const SITE = __OFFLINE__ ? `${PUBLIC_SITE_URL}/` : "../";
const HOME = __OFFLINE__ ? new URL("../", SITE).href : "/";

function Tabs() {
  useApp();
  const want = shownTab();
  const onKey = (e: KeyboardEvent) => {                    /* arrow keys move between the pages */
    const dir = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number | undefined>)[e.key];
    if (!dir) return;
    const i = TABS.indexOf(want);
    const n = TABS[(i + dir + TABS.length) % TABS.length];
    e.preventDefault();
    showTab(n);
    document.querySelector<HTMLElement>(`[data-tab="${n}"]`)?.focus();
  };
  return (
    <nav role="tablist" aria-orientation="vertical" onKeyDown={onKey} className="flex flex-col gap-0.5">
      {NAV.map(([head, tabs]) => (
        <div key={head} className="contents">
          <div className="mt-4 mb-1 ml-4 text-dim uppercase opacity-80 first:mt-0">{t(head)}</div>
          {tabs.map(([tab, name, ic]) => (
            <button key={tab} type="button" role="tab" data-tab={tab} aria-selected={tab === want} tabIndex={tab === want ? 0 : -1}
              title={t("tabh_" + tab)} onClick={() => showTab(tab)}
              className="border-0 border-l-4 border-transparent bg-transparent px-3 py-1.5 text-left normal-case text-fg2 hover:bg-s1 hover:text-fg
                aria-selected:border-acc aria-selected:bg-s2 aria-selected:text-fg">
              <Ic ic={ic}>{t(name)}</Ic>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

/* the side bar's foot: the installer, the app, the offline file */
function SideLinks() {
  const [canInstall, install] = useInstallPrompt();
  return (
    <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3 text-dim [&_a]:text-dim [&_a:hover]:text-fg">
      <a href={__OFFLINE__ ? `${PUBLIC_SITE_URL}/installer/` : "../installer/"} {...(__OFFLINE__ ? { target: "_blank", rel: "noopener" } : {})}>{t("installer")}</a>
      {__OFFLINE__ ? null : <a href="boopbox-editor.html" download={OFFLINE_NAME} title={t("offline")}>{t("offlineShort")}</a>}
      {canInstall ? <button id="install" type="button" onClick={install}>{t("install")}</button> : null}
    </div>
  );
}

/* the FM-1 in the top bar: a light (green: live, orange: connected without pushes, grey: none), its firmware, Connect */
function Device() {
  const app = useApp();
  const dev = app.dev;
  const light = dev && dev.dump ? "bg-t2" : dev ? "bg-t3" : "bg-s3";
  const what = !dev ? t("notConnected") : [dev.info ? dev.info.version : "", dev.dump ? t(dev.watch ? "live" : "polling") : "", app.MOCK && !/MOCK/.test(dev.info?.version || "") ? t("mock") : ""]
    .filter(Boolean).join(" · ");
  return (
    <div className="flex flex-none items-center gap-3">
      <span className={`size-2.5 flex-none ${light}`} aria-hidden="true" />
      <span className="max-w-[460px] overflow-hidden text-ellipsis whitespace-nowrap text-fg2" title={what}>
        <span className="text-fg">{t("fm1")}</span> <span className="text-dim">{what}</span></span>
      <button id="connect" type="button" className={dev ? "" : pri} disabled={app.connecting} onClick={toggleConnect}>
        <Ic ic="port_usb_c">{t(dev ? "disconnect" : "connect")}</Ic>
      </button>
    </div>
  );
}

/* the track selector (v3): the pages of one track edit the selected one; its colour marks it (only here) */
function TrackBar() {
  useApp();
  const dev = readyDev();
  const n = dev.info.ntrk;
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="mr-1 text-dim">{t("track")}</span>
      <span className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} role="group">
        {Array.from({ length: n }, (_, i) => {
          const x = dev.mix && dev.mix.tracks[i];
          const nm = !x ? [isDrumTrk(i) ? "DRUMS" : "", ""] : x.engine >= dev.info.nengines ? [(dev.kitNames || [])[x.e0!] || "", "drums"]
            : [(dev.names[x.engine] || [])[x.preset] || "", String(dev.info.engines[x.engine] || "").toLowerCase()];
          const on = i === (dev.sel || 0);
          return (
            <button key={i} type="button" aria-pressed={on} title={`${t("track")} ${i + 1}: ${nm[0]} ${nm[1]}`} onClick={() => selectTrack(i)}
              style={{ "--c": tcol(i) } as CSSProperties}
              className={`flex min-w-0 items-center gap-2 overflow-hidden py-0 pr-2 pl-0 normal-case
                ${on ? "bg-s2! text-fg! shadow-[inset_0_-2px_var(--c)]" : "bg-s1! text-fg2!"}`}>
              <span className={`grid size-8 flex-none place-content-center ${on ? "bg-c text-black" : "bg-s2 text-c"}`}>{i + 1}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{nm[0]} <span className={dim}>{nm[1]}</span></span>
            </button>
          );
        })}
      </span>
    </div>
  );
}

/* narrower than 1000 px: the editor needs a desktop browser */
function DesktopOnly() {
  return (
    <div className="hidden min-h-[70vh] items-center justify-center p-6 max-[999px]:flex">
      <div className="max-w-[480px] border border-line bg-s1 p-6 text-center">
        <h1 className={`mb-3 text-acc ${title}`}>{t("deskTitle")}</h1>
        <p className="mb-4 text-fg2">{t("deskText")}</p>
        <p className="m-0 flex justify-center gap-4 [&_a]:text-acc">
          <a href={HOME}>{t("deskGuide")}</a><a href={SITE + "emu/"}>{t("deskEmu")}</a>
        </p>
      </div>
    </div>
  );
}

const Editor: React.FC = () => {
  const app = useApp();
  const dev = app.dev;
  const want = shownTab();
  const isReady = ready();
  useEffect(() => {                                        /* the selected track's colour, for the places that show a track */
    document.documentElement.style.setProperty("--trk", tcol(dev && dev.info && dev.info.ntrk ? dev.sel || 0 : 0));
    /* the site header's height (--hdr): the editor below it is one window tall, not one window plus the header */
    const h = document.querySelector<HTMLElement>("body > #root > header, #root > header");
    if (h) document.documentElement.style.setProperty("--hdr", h.offsetHeight + "px");
  });
  /* what the page needs before it can show: an FM-1 */
  let hint = "", show = true;
  if (DEV_TABS.has(want)) {
    show = isReady;
    if (!dev) hint = "needDevice";
  }
  const Page = PAGES[want];
  const status = statusText();
  return (
    <>
    <SiteHeader current="editor" base={SITE} />
    <DesktopOnly />
    <div className="grid min-h-[calc(100vh-var(--hdr,88px))] grid-cols-[200px_minmax(0,1fr)] max-[999px]:hidden in-[html.lvfocus]:grid-cols-[minmax(0,1fr)]">
      <aside className="sticky top-0 flex in-[html.lvfocus]:hidden h-[calc(100vh-var(--hdr,88px))] flex-col gap-4 overflow-y-auto border-r border-line px-3 py-5">
        <Tabs />
        <SideLinks />
      </aside>

      <main className={`min-w-0 px-8 ${want === "live" ? "pb-14" : "pb-28"} in-[html.lvfocus]:px-4 in-[html.lvfocus]:pt-3 in-[html.lvfocus]:pb-[52px]`}>
        <header className="sticky top-0 z-5 in-[html.lvfocus]:hidden border-b border-line bg-bg pt-4 pb-3">
          <div className="flex min-h-9 items-center gap-4">
            <h1 className={`flex-none whitespace-nowrap text-acc ${title}`}>{t(TAB_NAME[want])}</h1>
            <div id="status" role="status" aria-live="polite"
              className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${app.status.err ? "text-red" : "text-dim"}`} title={status}>
              {status}</div>
            <Device />
          </div>
          <div className="mt-1 flex min-h-8 items-center gap-4">
            <p className="m-0 min-w-0 flex-1 text-dim">{t("tabh_" + want)}</p>
            <div id="page-actions" className="flex flex-none items-center gap-2" />
          </div>
          {isReady && hasTracks() && TRACK_TABS.has(want) ? <TrackBar /> : null}
        </header>
        {hint ? <p className="my-8 text-dim">{t(app.MOCK && hint === "needDevice" ? "previewLocalConnect" : hint)}</p> : null}
        {show && Page ? <section key={want} className="pt-5" id={`p-${want}`} data-tab={want}><Page /></section> : null}
        {/* (not on LIVE: one screen, its keys drawer at the bottom) */}
        <footer hidden={want === "live"} className="mt-10 border-t border-line pt-4 text-dim [&_a]:text-fg2">
          <p className="m-0">BoopBox, based on <a href="https://github.com/isod89/sloop-fm1" target="_blank" rel="noopener">SLOOP</a> and on Felucca by Leo
          Kuroshita (@kurogedelic), <a href="https://hugelton.com" target="_blank" rel="noopener">Hügelton Instruments</a>. GPL-3.0.
          {" "}{t("foot")} M-VAVE and FM-1 are trademarks of their respective owners.{" "}
          <a href={__OFFLINE__ ? `${SITE}editor/FUKIAI-LICENSE.txt` : "FUKIAI-LICENSE.txt"}
            {...(__OFFLINE__ ? { target: "_blank", rel: "noopener" } : {})}>{t("iconsCredit")}</a> · {t("fontCredit")}</p>
        </footer>
      </main>
    </div>
    {want !== "live" ? <TransportBar /> : null}
    </>
  );
};
Editor.displayName = "Editor";
export default Editor;
