// SPDX-License-Identifier: GPL-3.0-only
// The Samples page (2.4): what the user slots USR1..n hold, then 1 the slot, 2 the sound (from files, one note each;
// or CHOP, one recording cut in pieces), 3 send it and play it on a track (greyed, saying why, until it can be done). One draft for the files (smpPage.draft),
// whichever slot it goes to. (The page shows only when the FM-1 reported its sample flash, dev.smp: App.jsx.)
import { useEffect, useRef, useState } from "react";
import { LEVEL_MIN, LOOP, SMP, matchGains, noteName, parseNote, withGain } from "../lib/proto.ts";
import { TCOL, hasTracks, notify, pickFile, sayK, t, tf, useApp } from "../core/app.ts";
import { Card, Ic, More, barVars } from "../ui/kit.tsx";
import { SB, draftBytes, decodeFile, holdToPlay, playInt16, playLoop, slotText, smpErase, smpUpload, smpUseOn, splitKeys } from "./samples/smp.ts";
import { CH, chopOver, chopSend, chopUsed } from "./samples/chop.ts";
import Chop from "./samples/Chop.tsx";
import { Meter, NameInput, ShortHelp, Step, useDrop } from "./samples/ui.tsx";
import { SlotTiles } from "./samples/SlotTiles.tsx";

export const smpPage = { slot: 0, mode: "files", draft: { name: "", files: [] } };
const ACCEPT = ".wav,audio/wav,audio/x-wav,audio/*";

async function addSmpFiles(list) {
  const d = smpPage.draft;
  let full = false;
  for (const f of list) {
    try {
      const z = await decodeFile(f);
      if (d.files.length >= SMP.MAX_ZONES) { full = true; break; }
      d.files.push(z);
      if (!d.name) d.name = slotText(f.name.replace(/\.[^.]*$/, ""));
    } catch (e) { sayK("smpDecodeFail", `${f.name} (${e.message})`); }
  }
  if (full) sayK("smpFull");
  notify();
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* the keyboard C1..C7 and which file each key plays (its root: a bright mark) */
function drawKeymap(cv, files, keys) {
  const lo = 24, hi = 108, n = hi - lo + 1, w = cv.width = Math.max(300, cv.clientWidth || 600), h = cv.height = 44, g = cv.getContext("2d");
  const col = ["--t1", "--t2", "--t3", "--t4"].map(css), S2 = css("--s2"), S3 = css("--s3"), DIM = css("--dim");
  g.clearRect(0, 0, w, h);
  const kw = w / n, black = (k) => [1, 3, 6, 8, 10].includes(k % 12);
  for (let k = lo; k <= hi; k++) {
    const x = (k - lo) * kw;
    g.fillStyle = black(k) ? S2 : S3;
    g.fillRect(x, 20, Math.max(1, kw - 1), 24);
    if (k % 12 === 0) { g.fillStyle = DIM; g.font = '16px "BoopBox Terminus", monospace'; g.fillText("C" + (k / 12 - 1), x + 1, 14); }
  }
  files.forEach((f, i) => {
    const [a, b] = keys[i], c = col[i % 4];
    const x0 = (Math.max(lo, a) - lo) * kw, x1 = (Math.min(hi, b) - lo + 1) * kw;
    if (x1 <= x0) return;
    g.fillStyle = c; g.globalAlpha = 0.45; g.fillRect(x0, 20, x1 - x0 - 1, 24); g.globalAlpha = 1;
    if (f.root >= lo && f.root <= hi) { g.fillStyle = c; g.fillRect((f.root - lo) * kw, 20, Math.max(2, kw - 1), 24); }
  });
}
/* LOOP+TAIL: the file's wave, its loop lit */
function drawLoopWave(cv, f) {
  const w = cv.width = Math.max(120, cv.clientWidth || 600), h = cv.height = 48, g = cv.getContext("2d");
  const cs = getComputedStyle(cv), s = f.s, n = s.length, [ls, le] = LOOP.range(f);
  const col = cs.getPropertyValue("--c").trim(), dim = css("--s3");
  g.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x++) {
    const a = Math.floor(x / w * n), b = Math.max(a + 1, Math.floor((x + 1) / w * n));
    let pk = 0;
    for (let i = a; i < b && i < n; i += 2) pk = Math.max(pk, Math.abs(s[i]));
    const y = Math.max(1, Math.round(pk / 32768 * (h / 2 - 2)));
    g.fillStyle = b > ls && a <= le ? col : dim;
    g.fillRect(x, h / 2 - y, 1, y * 2);
  }
  g.fillStyle = col;
  for (const i of [ls, le + 1]) g.fillRect(Math.min(w - 2, Math.round(i / n * w)), 0, 2, h);
}
/* a canvas drawn by draw(cv) after each render and when the window changes size */
function Drawn({ draw, className, title }) {
  const ref = useRef(null);
  const cur = useRef(draw);
  cur.current = draw;
  useEffect(() => { cur.current(ref.current); });
  useEffect(() => {
    const r = () => { if (ref.current) cur.current(ref.current); };
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  return <canvas ref={ref} className={className} title={title} />;
}

/* ---- 1: the slots */
function Slots() {
  const { dev } = useApp();
  const P = smpPage, n = dev.smp.nslots;
  const tiles = Array.from({ length: n }, (_, k) => {
    const x = dev.smp.slots[k];
    return { id: k, title: `USR${k + 1}`, full: !!x.zones, now: x.zones ? `${x.name || "—"} · ${x.zones} ${t("zones")}` : "",
      kib: x.kib, max: dev.smp.slotKiB };
  });
  return <SlotTiles label={t("smpStep1")} tiles={tiles} sel={P.slot} onPick={(k) => { P.slot = k; notify(); }} />;
}

/* ---- 2: a file of the slot */
function RootInput({ f }) {
  const [txt, setTxt] = useState(null);             /* (what is typed, until it is a note) */
  return (
    <input type="text" className={`root ${txt != null ? "bad" : ""}`} spellCheck="false" title={t("smpNoteHelp")}
      value={txt ?? noteName(f.root)}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); }} />
  );
  function commit(v) {
    const nn = parseNote(v.trim());
    if (nn == null) return;                         /* (stays red) */
    f.root = nn;
    setTxt(null);
    notify();
  }
}
const ms = (x) => `${Math.round(x / SMP.RATE * 1000)} ms`;
function LoopPoint({ f, k, idx }) {
  const n = f.s.length, v = LOOP.range(f)[idx];
  const snap = () => { [f.ls, f.le] = LOOP.snapRange(f.s, ...LOOP.range(f)); notify(); };
  return (
    <label className="lpt">
      <span className="dim">{t(k)}</span>
      <input type="range" min="0" max={n - 1} step="1" value={v} aria-label={t(k)} style={barVars({ min: 0, max: n - 1 }, v)}
        onChange={(e) => {
          const r = +e.target.value;
          if (idx) f.le = Math.max(r, (f.ls ?? 0) + LOOP.MIN - 1); else f.ls = Math.min(r, (f.le ?? n - 1) - LOOP.MIN + 1);
          notify();
        }}
        onPointerUp={snap} onKeyUp={snap} />
      <span className="text-right text-fg2">{ms(v)}</span>
    </label>
  );
}
function FileRow({ f, i, keys }) {
  const d = smpPage.draft, c = { "--c": TCOL[i % 4] }, g = f.gain || 0;
  const play = f.loop
    ? holdToPlay(() => { const [a, b] = LOOP.range(f); playLoop(withGain(f.s, f.gain), a, b); })
    : { onClick: () => playInt16(withGain(f.s, f.gain)) };
  const row = (
    <div className="frow" style={c}>
      <button type="button" title={t(f.loop ? "smpHoldPlay" : "kitPlay")} {...play}>▶</button>
      <span className="fn" title={f.fname}>{f.fname}</span>
      <RootInput key={f.root} f={f} />
      <span>{`${noteName(keys[i][0])}–${noteName(keys[i][1])}`}</span>
      <span className="dim">{`${(f.s.length / SMP.RATE).toFixed(2)} s`}</span>
      {/* 2.7: ONE SHOT, LOOP (the whole file while held), LOOP+TAIL (its points below) */}
      <select title={t("smpLoopHelp")} aria-label={t("smpLoop")} value={String(f.loop || 0)}
        onChange={(e) => {
          f.loop = +e.target.value;
          if (f.loop === 2 && f.ls == null) [f.ls, f.le] = LOOP.snapRange(f.s, Math.round(f.s.length / 4), Math.round(f.s.length * 3 / 4));
          notify();
        }}>
        {LOOP.NAMES.map((nm, k) => <option key={k} value={String(k)} disabled={k === 2 && f.s.length < 4 * LOOP.MIN}>{nm}</option>)}
      </select>
      <div className="grid grid-cols-[1fr_52px] items-center gap-1.5">
        <input type="range" min={LEVEL_MIN} max="0" step="1" value={g} title={t("smpGainHelp")} style={barVars({ min: LEVEL_MIN, max: 0 }, g)}
          onChange={(e) => { f.gain = +e.target.value; notify(); }}
          onPointerUp={() => playInt16(withGain(f.s, f.gain))} onKeyUp={() => playInt16(withGain(f.s, f.gain))} />
        <span className="text-right text-fg2">{`${g} dB`}</span>
      </div>
      <button type="button" className="warn" title={t("remove")} disabled={SB.busy} onClick={() => { d.files.splice(i, 1); notify(); }}>×</button>
    </div>
  );
  if (f.loop !== 2) return row;
  /* LOOP+TAIL: where the loop starts and ends, snapped to a zero crossing when let go */
  return (
    <div className="grid gap-0.5">
      {row}
      <div className="floop" style={c}>
        <Drawn className="loopwave block h-12 w-full" draw={(cv) => drawLoopWave(cv, f)} />
        <LoopPoint f={f} k="smpLoopStart" idx={0} />
        <LoopPoint f={f} k="smpLoopEnd" idx={1} />
        <span className="dim">{t("smpLoopTail")}</span>
      </div>
    </div>
  );
}
function FilesPane() {
  useApp();
  const d = smpPage.draft, keys = splitKeys(d.files), bytes = draftBytes(d);
  const pick = async () => { const fs = await pickFile(ACCEPT, true); if (fs && fs.length) addSmpFiles(fs); };
  const [over, drop] = useDrop((fs) => { if (!SB.busy) addSmpFiles(fs); });
  return (
    <div className="pane">
      <div tabIndex="0" role="button" onClick={pick} {...drop}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
        className={`dropzone mb-3 grid cursor-pointer place-items-center gap-1.5 border border-dashed bg-bg px-4 py-7 text-center hover:border-acc
          ${over ? "over border-acc outline-2 -outline-offset-2 outline-acc outline-dashed" : "border-s3"}`}>
        <b className="font-normal text-fg">{t("smpDrop")}</b>
        <span className="dim">{t("smpDropHint")}</span>
      </div>
      <div className="kithead grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 gap-y-3">
        <div className="bar m-0"><span className="dim">{t("smpKeymap")}</span></div>
        <Meter max={SMP.MAX_DATA} value={Math.min(bytes, SMP.MAX_DATA)} over={bytes > SMP.MAX_DATA}>
          {(bytes > SMP.MAX_DATA ? t("smpTooBig") + " · " : "") +
            t("kitUsed").replace("{s}", (d.files.reduce((a, f) => a + f.s.length, 0) / SMP.RATE).toFixed(1)).replace("{t}", (SMP.MAX_DATA * 2 / SMP.RATE).toFixed(1))}
        </Meter>
      </div>
      {d.files.length ? (
        <>
          <Drawn className="keymap mt-2 mb-3 block h-11 w-full" title={t("smpKeymap")} draw={(cv) => drawKeymap(cv, d.files, keys)} />
          <div className="flist mb-2 grid gap-0.5">
            <div className="frow fhead">
              <span /><span>{t("file")}</span><span>{t("smpNote")}</span><span>{t("keys")}</span><span>{t("length")}</span>
              <span>{t("smpLoop")}</span><span>{t("kitGain")}</span><span />
            </div>
            {d.files.map((f, i) => <FileRow key={i + ":" + f.fname} f={f} i={i} keys={keys} />)}
          </div>
        </>
      ) : null}
      <p className="bar">
        <button type="button" disabled={d.files.length < 2} title={d.files.length < 2 ? t("smpWhyTwo") : t("matchHelp")} onClick={() => {
          const g = matchGains(d.files.map((f) => f.s));
          d.files.forEach((f, i) => { f.gain = g[i]; });
          sayK("levelsMatched");
          notify();
        }}><Ic ic="symbol_audio">{t("matchLevels")}</Ic></button>
        <button type="button" className="warn" disabled={!d.files.length || SB.busy} title={!d.files.length ? t("smpWhyNoList") : SB.busy ? t("whyBusy") : ""}
          onClick={() => { d.files = []; notify(); }}><Ic ic="symbol_trash">{t("clearList")}</Ic></button>
      </p>
    </div>
  );
}

/* ---- 3: send it */
async function smpSendPage() {
  const P = smpPage, k = P.slot;
  if (P.mode === "chop") { await chopSend(k); }
  else if (await smpUpload(k, "smp", true, P.draft)) sayK("smpDone", `${k + 1}`);
  notify();
}
/* why the sound cannot be sent yet ("" when it can) */
function whySend() {
  const P = smpPage;
  if (SB.busy) return t("whyBusy");
  if (P.mode === "files") {
    const d = P.draft;
    return !d.files.length ? t("smpWhyNoFiles") : draftBytes(d) > SMP.MAX_DATA ? t("smpWhyTooBig") : !d.name ? t("smpWhyName") : "";
  }
  const U = chopUsed();
  return !CH.x ? t("smpWhyNoChop") : !U.use.length ? t("smpWhyNoPiece") : chopOver(U.use) ? t("smpWhyTooBig") : !CH.name ? t("smpWhyName") : "";
}

/* ---- 3: play it on a track */
function UseOn({ k, zones }) {
  const [trk, setTrk] = useState(0);
  const why = SB.busy ? t("whyBusy") : !zones ? tf("smpWhyEmpty", { n: k + 1 }) : !hasTracks() ? t("smpNoEngine") : "";
  return (
    <div className="bar">
      <label htmlFor="smpuse" className="dim">{t("smpUseOn")}</label>
      <select id="smpuse" value={trk} disabled={!!why} title={why} style={{ color: TCOL[trk] }} onChange={(e) => setTrk(+e.target.value)}>
        {[0, 1, 2].map((i) => <option key={i} value={i}>{`${t("track")} ${i + 1}`}</option>)}
      </select>
      <button type="button" id="smpapply" disabled={!!why} title={why || tf("smpApplyHint", { n: k + 1, i: trk + 1 })}
        onClick={() => smpUseOn(trk, k)}>{t("smpApply")}</button>
    </div>
  );
}

export default function Samples() {
  const { dev } = useApp();
  if (!dev || !dev.smp) return null;                /* (the tab says when there are no slots: App.jsx) */
  const P = smpPage, n = dev.smp.nslots;
  if (P.slot >= n) P.slot = 0;
  const k = P.slot, cur = dev.smp.slots[k], up = SB.up && SB.up.where === "smp" ? SB.up : null;
  const why = whySend();
  return (
    <div id="smpslots">
      <Card title={t("samples")} ic="symbol_waves">
        <ShortHelp text={t("smpIntro")} />
        <Step n={1} title={t("smpStep1")}>
          <Slots />
          <div className="bar">
            <button type="button" className="warn" disabled={SB.busy || !cur.zones} title={SB.busy ? t("whyBusy") : !cur.zones ? tf("smpWhyEmpty", { n: k + 1 }) : ""}
              onClick={() => smpErase(k)}>
              <Ic ic="symbol_trash">{t("smpEraseSlot").replace("{n}", k + 1)}</Ic>
            </button>
            <span className="destnote text-fg2">
              {(cur.zones ? t("smpReplaces").replace("{n}", k + 1).replace("{x}", cur.name || "—") : t("smpSlotFree").replace("{n}", k + 1))
                + (n >= 4 && k >= 2 ? " " + t("smpKitHint") : "")}
            </span>
          </div>
        </Step>
        <Step n={2} title={t("smpStep2")}>
          <div className="seg modes mb-2.5" role="tablist">
            {[["files", "smpModeFiles"], ["chop", "smpModeChop"]].map(([m, key]) => (
              <button key={m} type="button" role="tab" data-m={m} aria-selected={m === P.mode ? "true" : "false"} aria-pressed={m === P.mode ? "true" : "false"}
                className="px-4 py-2 normal-case" onClick={() => { P.mode = m; notify(); }}>{t(key)}</button>
            ))}
          </div>
          <ShortHelp className="modehelp" text={t(P.mode === "files" ? "smpFilesHelp" : "smpChopHelp")} />
          {P.mode === "files" ? <FilesPane /> : <div className="pane"><Chop /></div>}
        </Step>
        <Step n={3} title={t("smpStep3")} off={!!why && !cur.zones} why={why && why !== t("whyBusy") ? why : ""}>
          <div className="bar">
            <span className="dim">{t("smpName")}</span>
            <NameInput value={P.mode === "chop" ? CH.name || "" : P.draft.name}
              onChange={(v) => { if (P.mode === "chop") CH.name = v; else P.draft.name = v; notify(); }} />
            <button type="button" className="pri" disabled={!!why} title={why} onClick={smpSendPage}>
              <Ic ic="symbol_upload">{t("smpSendTo").replace("{n}", k + 1)}</Ic>
            </button>
            <progress className="w-[180px]" max="1" value={up ? up.v : 0} hidden={!up} />
          </div>
          <UseOn k={k} zones={cur.zones} />
          <div className="my-3"><span className="dim">{t("smpWhereShort")}</span><More><p>{t("smpWhere").replace(/\{n\}/g, k + 1)}</p></More></div>
        </Step>
      </Card>
    </div>
  );
}
