// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The installer: BoopBox (or BoopBox Trainer) onto the FM-1 over USB MIDI, in the browser (fm1ota.js). The package is
// fetched, checked against its identity and SHA-256 (meta, written by make_site.py), and written; the bar follows.
import { useCallback, useEffect, useRef, useState } from "react";
import { logicalImage, productOf } from "../lib/fm1pkg.js";
import { Updater } from "../lib/fm1ota.js";
import { useInstallPrompt } from "../shared/pwa.js";
import SiteHeader from "../shared/SiteHeader.jsx";
import { TEXT } from "./text.js";

const NAMES = { boopbox: "BoopBox", trainer: "BoopBox Trainer" };
const TOTAL = 74 + 1179;                               /* reads: step 1, step 2 (head + app area, SLOOP 2.0 loader) */
const sha = async (pkg) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", pkg))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");

const A = (props) => <a target="_blank" rel="noopener" className="underline" {...props} />;

export default function Installer({ meta }) {
  const lang = "en";
  const t = useCallback((k) => TEXT[lang][k], [lang]);
  /* the status line: a string key (+ an argument) shown in the language chosen, or a plain text */
  const [status, setStatus] = useState({ key: null, arg: "", text: "" });
  const sayK = useCallback((key, arg = "") => setStatus({ key, arg, text: "" }), []);
  const say = useCallback((text) => setStatus({ key: null, arg: "", text }), []);
  const [log, setLog] = useState("");
  const addLog = useCallback((s) => setLog((l) => l + s + "\n"), []);
  const [bar, setBar] = useState(0);
  const [writing, setWriting] = useState(false);
  const [image, setImage] = useState(null);
  const [canInstallApp, installApp] = useInstallPrompt();
  /* the choice (meta.trainer: the site has BoopBox Trainer's package too): BoopBox, or the trainer (#trainer picks it) */
  const [choice, setChoice] = useState(() => (meta && meta.trainer && location.hash === "#trainer" ? "trainer" : "boopbox"));
  const loading = useRef(0);
  const writingRef = useRef(false);
  writingRef.current = writing;

  useEffect(() => {
    const leave = (e) => { if (writingRef.current) { e.preventDefault(); e.returnValue = TEXT[lang].leave; } };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [lang]);

  const cur = meta ? (choice === "trainer" ? meta.trainer : meta) : null;

  /* the package: never the browser's old copy (a new build keeps the file's name, and a copy kept from the build
     before is "damaged" here); no-cache asks the server first, a mismatch is fetched once more bypassing the cache */
  useEffect(() => {
    const me = ++loading.current, m = cur;
    setImage(null);
    if (!m) { say("dev server: no package (web/make_site.py writes the installer's meta)"); return; }
    if (!navigator.requestMIDIAccess) { sayK("nomidi"); return; }
    (async () => {
      try {
        const get = async (cache) => {
          const r = await fetch(m.pkg, { cache });
          if (!r.ok) throw new Error(`${m.pkg}: HTTP ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        };
        const check = m.sha256 && self.crypto && crypto.subtle;
        let pkg = await get("no-cache");
        if (check && (await sha(pkg)) !== m.sha256) pkg = await get("reload");
        if (me !== loading.current) return;                 /* (another choice since) */
        if (productOf(pkg) !== m.product) { sayK("badpkg"); return; }
        if (check) {                                        /* a damaged download is never offered (the loader checks its CRC too) */
          const h = await sha(pkg);
          if (h !== m.sha256) { sayK("badpkg"); addLog(`sha256 ${h}, expected ${m.sha256}`); return; }
        }
        if (me !== loading.current) return;
        setImage(logicalImage(pkg));
        say(`${NAMES[choice]} ${m.version}`);
      } catch (e) { if (me === loading.current) sayK("loadfail", e.message); }
    })();
  }, [choice]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (value) => {
    if (writing) return;
    setChoice(value);
    history.replaceState(null, "", value === "trainer" ? "#trainer" : location.pathname + location.search);
  };

  const step = (k, a) => {
    addLog(`${k} ${a ?? ""}`);
    if (k === "start") sayK("start");
    if (k === "verify") { sayK("verify"); setBar(Math.min(100, (a / TOTAL) * 100)); }
    if (k === "loader") sayK("loader");
    if (k === "write") { sayK("write"); setBar(Math.min(100, ((74 + a) / TOTAL) * 100)); }
    if (k === "reboot") sayK("reboot");
    if (k === "done") { setBar(100); sayK("done"); }
  };
  const failed = (e) => {
    if (e && e.code && TEXT[lang][e.code]) sayK(e.code, e.detail || "");
    else sayK("error", e && e.message);
    addLog(String((e && e.stack) || e));
  };

  const install = async () => {
    if (writing) return;
    setWriting(true);
    let midi;
    try { midi = await navigator.requestMIDIAccess({ sysex: true }); }
    catch (e) { sayK("denied"); setWriting(false); return; }
    try {
      const up = new Updater(midi, addLog);
      const ota = await up.find((id) => /^ota-/i.test(id.model), true);
      if (ota) {
        ota.link.close();
        sayK((await up.resume(image, step)) ? "done" : "stopped");
      } else {
        await up.install(image, cur.product, step);
      }
    } catch (e) { failed(e); }
    setWriting(false);
  };

  const statusText = status.key ? t(status.key) + status.arg : status.text;
  const dl = meta ? `boopbox-editor-${String(meta.version).replace(/[^A-Za-z0-9.-]/g, "-")}.html` : "boopbox-editor.html";
  const small = "text-[13px] text-dim mb-3.5";
  const tileBtn = "pixel-panel inline-flex min-h-11 items-center mt-2 px-4 py-2 font-pixel text-[17px] text-fg no-underline cursor-pointer hover:text-blue";
  const bad = status.key && /fail|error|denied|nomidi|notfound|lost|bad/.test(status.key);

  return (
    <>
    <SiteHeader current="installer" />
    <main className="mx-auto max-w-[640px] px-4 pt-12 pb-16">
      {meta && meta.banner ? <div dangerouslySetInnerHTML={{ __html: meta.banner }} /> : null}
      <p className="m-0 mb-4 inline-block bg-tile px-2.5 py-1 font-pixel text-[16px] font-medium text-blue">{meta ? `▶ Installer · ${meta.version}` : "▶ Installer"}</p>
      <h1 className="m-0 mb-5 font-pixel text-[36px] leading-none font-bold text-balance min-[480px]:text-[44px]">{t("title")}</h1>
      <p className="mb-3.5">{t("intro")}</p>
      <p className="mb-3.5">{t("warn")}</p>
      {meta && meta.trainer ? (
        <div id="pick" role="radiogroup" className="mt-6 mb-6 grid grid-cols-1 gap-3 min-[421px]:grid-cols-2">
          {[["boopbox", "BoopBox", "pickBoop"], ["trainer", "BoopBox Trainer", "pickTrainer"]].map(([v, name, k]) => (
            <label key={v} className="group pixel-panel relative block cursor-pointer px-4 pt-3 pb-3.5 has-checked:bg-green has-checked:text-ink
              has-checked:shadow-[5px_5px_0_var(--color-orange)] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg">
              <input type="radio" name="fw" value={v} className="pointer-events-none absolute opacity-0" checked={choice === v}
                disabled={writing} onChange={() => pick(v)} />
              <b className="block font-pixel text-[20px] text-fg group-has-checked:text-ink">{name}</b><span className="block text-[13.5px] leading-[1.4] text-dim group-has-checked:text-ink">{t(k)}</span>
            </label>
          ))}
        </div>
      ) : null}
      <p className="mb-3.5">
        <button id="go" type="button" disabled={writing || !image} onClick={install}
          className="arcade-btn min-h-[64px] w-full bg-orange text-[26px]">{t("install")}</button>
      </p>
      {/* the bar in pixel blocks: magenta segments over the dark well */}
      <progress max="100" value={bar} aria-label="Installed" className="mt-6 h-7 w-full appearance-none border-0 bg-deep p-1 shadow-[inset_0_0_0_3px_var(--line)]
        [&::-moz-progress-bar]:bg-[repeating-linear-gradient(90deg,var(--color-orange)_0_16px,transparent_16px_20px)]
        [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-[repeating-linear-gradient(90deg,var(--color-orange)_0_16px,transparent_16px_20px)]" />
      <p id="status" className={`mt-4 mb-4 min-h-[1.6em] font-pixel text-[20px] tabular-nums ${bad ? "text-red" : "text-fg"}`}>{statusText}</p>
      {log ? <pre className="mt-3 mb-6 max-h-40 overflow-auto whitespace-pre-wrap bg-deep p-3 text-[11px] text-dim">{log}</pre> : null}
      <a className={tileBtn} href="../editor/">{t("editor")}</a>
      <p className={small}><a href="../editor/boopbox-editor.html" download={dl} className="underline">{t("edOffline")}</a></p>
      {canInstallApp ? <p className="mb-3.5"><button type="button" className={`${tileBtn} border-0`} onClick={installApp}>{t("appInstall")}</button></p> : null}
      <hr className="mt-8 mb-6 border-0 border-t-4 border-line" />
      <p className={small}>{t("direct")}</p>
      <p className={small}>{t("beta")}</p>
      <p className={small}>{t("brick")} <A href="https://github.com/kurogedelic/FM-1-transporter">FM-1-transporter</A></p>
      <p className={small}>{t("back")}</p>
      <p className={small}><A href="https://www.m-vave.com/download">www.m-vave.com/download</A></p>
      <p className={small}>BoopBox is based on <A href="https://github.com/isod89/sloop-fm1">SLOOP</A>, itself based on Felucca by Leo
        Kuroshita (@kurogedelic), <A href="https://hugelton.com">Hügelton Instruments</A>.{" "}
        Hold OCT− alone while switching on for USB rescue.<br />
        Font: Terminus (Dimitar Toshkov Zhekov, SIL OFL 1.1). Samples: Versilian Studios VSCO-2 Community Edition and VCSL, Sonic Pi (CC0 1.0).<br />
        M-VAVE and FM-1 are trademarks of their respective owners; BoopBox is not affiliated with them.<br />
        {t("license")} <A href="https://github.com/josh-mcfarlin/boopbox">github.com/josh-mcfarlin/boopbox</A></p>
    </main>
    </>
  );
}
