// SPDX-License-Identifier: GPL-3.0-only
// The CHOP block (the Samples page's step 2 when CHOP is chosen): the wave with its markers, the ways to place them,
// the chops kept or left out, the selected chop's length. Sending is step 3 of the page.
import { useEffect, useRef, useState } from "react";
import { CHOP, SMP, chopEqual, chopGrid, chopHits, chopSnap, noteName } from "../../lib/proto.js";
import { notify, pickFile, t, useApp } from "../../core/app.js";
import { Ic, barVars } from "../../ui/kit.jsx";
import {
  CH, chSecs, chopAdd, chopAudition, chopChops, chopDraw, chopFitAll, chopKeep, chopKeepAll, chopKeyName, chopLoad, chopOpt, chopOver,
  chopPlay, chopPlaying, chopRegion, chopSetLen, chopSetMarks, chopStop, chopTap, chopTransport, chopUsed, chopZip,
} from "./chop.js";

const ACCEPT = "audio/*,.wav,.mp3,.aif,.aiff,.flac,.ogg,.m4a";
const openFile = async () => { const f = await pickFile(ACCEPT); if (f) chopLoad(f); };
const DIVS = [["1 bar", 4], ["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25]];
const NS = [2, 3, 4, 6, 8, 12, 16];
const MAXES = [["—", 0], ["0.25 s", 0.25], ["0.5 s", 0.5], ["1 s", 1], ["2 s", 2]];
const KEYS = Array.from({ length: 49 }, (_, i) => 36 + i);

/* a row of the block */
const Head = ({ children, className = "" }) => <div className={`mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>{children}</div>;
const Sep = () => <span className="w-3" />;

/* the wave: click = select + listen, double-click = a marker, drag a marker, wheel = zoom */
function Wave() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    CH.cv = cv;
    const wheel = (e) => {
      if (!CH.x) return;
      e.preventDefault();
      const n = CH.x.length, span = CH.v1 - CH.v0;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = (e.deltaX || e.deltaY) / 400 * span, v0 = Math.max(0, Math.min(n - span, CH.v0 + d));
        CH.v0 = v0; CH.v1 = v0 + span;
      } else {
        const p = posAt(e), z = Math.exp(e.deltaY / 300), ns = Math.max(SMP.RATE * 0.05, Math.min(n, span * z));
        CH.v0 = Math.max(0, Math.min(n - ns, p - (p - CH.v0) / span * ns));
        CH.v1 = CH.v0 + ns;
      }
      chopDraw();
    };
    const resize = () => chopDraw();
    cv.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => { cv.removeEventListener("wheel", wheel); window.removeEventListener("resize", resize); if (CH.cv === cv) CH.cv = null; };
  }, []);
  useEffect(() => chopDraw());                      /* (after every render: the block changed) */
  const posAt = (e) => { const r = ref.current.getBoundingClientRect(); return CH.v0 + (e.clientX - r.left) / r.width * (CH.v1 - CH.v0); };
  const markAt = (e) => {
    const r = ref.current.getBoundingClientRect(), per = (CH.v1 - CH.v0) / r.width;
    return CH.marks.findIndex((m) => Math.abs(m - posAt(e)) < 5 * per);
  };
  const endAt = (e) => {                            /* on the selected chop's end handle (the bottom of the wave)? */
    const c = chopChops()[CH.sel];
    if (!c) return false;
    const r = ref.current.getBoundingClientRect(), per = (CH.v1 - CH.v0) / r.width;
    return e.clientY - r.top > r.height - 40 && Math.abs(c.end - posAt(e)) < 7 * per;
  };
  const cv = () => ref.current;
  return (
    <canvas ref={ref} className="my-2 block h-[150px] w-full cursor-default touch-none border border-line bg-bg" tabIndex="0" title={t("chopHint")}
      onPointerDown={(e) => {
        if (!CH.x) { openFile(); return; }
        cv().focus();
        if (endAt(e)) { CH.dragEnd = true; cv().setPointerCapture(e.pointerId); return; }
        const k = markAt(e);
        if (k >= 0) { CH.drag = k; CH.sel = k; cv().setPointerCapture(e.pointerId); chopDraw(); return; }
        const p = posAt(e), i = chopChops().findIndex((c) => p >= c.start && p < c.end);
        if (i >= 0) chopAudition(i);
      }}
      onPointerMove={(e) => {
        if (CH.dragEnd) {                            /* the selected chop's length; up to the next marker = full */
          const c = chopChops()[CH.sel];
          if (!c) return;
          const n = Math.round(Math.max(0.01 * SMP.RATE, Math.min(c.full - c.start, posAt(e) - c.start)));
          chopOpt(CH.sel).len = n >= c.full - c.start ? 0 : n;
          chopDraw();
          return;
        }
        if (CH.drag < 0) { cv().style.cursor = CH.x && (markAt(e) >= 0 || endAt(e)) ? "ew-resize" : "default"; return; }
        const m = CH.marks, k = CH.drag, lo = k ? m[k - 1] + 1 : 0, hi = k + 1 < m.length ? m[k + 1] - 1 : CH.x.length - 1;
        m[k] = Math.round(Math.max(lo, Math.min(hi, posAt(e))));
        chopDraw();
      }}
      onPointerUp={() => {
        if (CH.dragEnd) { CH.dragEnd = false; notify(); }
        if (CH.drag >= 0) { CH.drag = -1; notify(); }
      }}
      onDoubleClick={(e) => { if (CH.x) chopAdd(CH.snap ? chopSnap(CH.x, CH.nov, posAt(e), 0.02) : Math.round(posAt(e))); }}
      onKeyDown={(e) => {
        if (!CH.x) return;
        const k = e.key;
        if (k === " ") { e.preventDefault(); if (chopPlaying()) chopTap(e.nativeEvent); else chopPlay(Math.round(CH.v0), CH.x.length, true); }
        else if (k === "Enter" || k === "Escape") { e.preventDefault(); if (CH.src) chopStop(); else chopPlay(Math.round(CH.v0), CH.x.length, true); }
        else if (/^[0-9]$/.test(k)) { e.preventDefault(); chopAudition(k === "0" ? 9 : +k - 1); }
        else if ((k === "Delete" || k === "Backspace") && CH.sel >= 0) {
          e.preventDefault();
          chopSetMarks(CH.marks.filter((_, i) => i !== CH.sel), CH.marks.map((_, i) => CH.opt[i]).filter((_, i) => i !== CH.sel));
        }
        else if ((k === "k" || k === "K") && CH.sel >= 0) { e.preventDefault(); chopKeep(CH.sel); }
        else if ((k === "ArrowLeft" || k === "ArrowRight") && CH.sel >= 0) {   /* nudge the selected marker: 2 ms, shift 20 ms */
          e.preventDefault();
          const m = CH.marks.slice();
          m[CH.sel] += (k === "ArrowLeft" ? -1 : 1) * Math.round((e.shiftKey ? 0.02 : 0.002) * SMP.RATE);
          const keep = CH.sel;
          chopSetMarks(m, CH.marks.map((_, i) => CH.opt[i]));
          CH.sel = keep;
        }
      }} />
  );
}

export default function Chop() {
  useApp();
  const [over, setOver] = useState(false);
  const U = chopUsed(), { all, use, n } = U, room = SMP.MAX_DATA * 2, tooLong = chopOver(use);
  const kept = all.filter((c) => !c.off).length;
  const c = all[CH.sel];                             /* the selected chop's row */
  const full = c ? c.full - c.start : 0, lenMax = Math.max(10, Math.floor(full / SMP.RATE * 1000)), lenV = c ? Math.round((c.end - c.start) / SMP.RATE * 1000) : 10;
  return (
    <div id="chop" className={`smp chop ${over ? "outline-2 -outline-offset-2 outline-trk outline-dashed" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) chopLoad(e.dataTransfer.files[0]); }}>
      <Head>
        <b className="min-w-12 text-big font-normal text-trk">CHOP</b>
        <button type="button" onClick={openFile}><Ic ic="symbol_folder_open">{t("chopOpen")}</Ic></button>
        <span className="dim">{CH.x ? `${CH.name} · ${chSecs(CH.x.length)} · ${all.length} ${t("chopChops")}` +
          (kept < all.length ? ` (${kept} ${t("chopKept")})` : "") : t("chopHelp")}</span>
      </Head>
      <Wave />
      <Head>
        <button type="button" onClick={chopTransport}>{chopPlaying() ? t("chopStop") : t("chopPlay")}</button>
        <button type="button" className="min-w-20" onPointerDown={(e) => { e.preventDefault(); chopTap(e.nativeEvent); }}>{t("chopTap")}</button>
        <label><input type="checkbox" checked={CH.snap} onChange={(e) => { CH.snap = e.target.checked; notify(); }} /> {t("chopSnap")}</label>
        <button type="button" onClick={() => { if (CH.x) chopSetMarks([]); }}>{t("chopClear")}</button>
        <span className="dim">{t("chopHint")}</span>
      </Head>
      <Head>
        <button type="button" onClick={() => { if (CH.x) chopSetMarks(chopHits(CH.x, CH.nov, CH.sens)); }}>{t("chopHits")}</button>
        <input type="range" className="w-[110px]" min="1" max="10" value={CH.sens} title={t("chopSens")} style={barVars({ min: 1, max: 10 }, CH.sens)}
          onChange={(e) => { CH.sens = +e.target.value; notify(); }} />
        <Sep />
        <button type="button" onClick={() => { if (CH.x) { const [a, b] = chopRegion(); chopSetMarks(chopGrid(a, b, Math.max(40, +CH.bpm || 90), CH.div)); } }}>{t("chopGrid")}</button>
        <input type="number" className="w-[70px]" min="40" max="240" step="0.1" value={CH.bpm} onChange={(e) => { CH.bpm = e.target.value; notify(); }} />
        <span>BPM</span>
        <select value={CH.div} onChange={(e) => { CH.div = +e.target.value; notify(); }}>
          {DIVS.map(([nm, v]) => <option key={v} value={v}>{nm}</option>)}
        </select>
        <Sep />
        <button type="button" onClick={() => { if (CH.x) { const [a, b] = chopRegion(); chopSetMarks(chopEqual(a, b, CH.n)); } }}>{t("chopEqual")}</button>
        <select value={CH.n} onChange={(e) => { CH.n = +e.target.value; notify(); }}>
          {NS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </Head>
      <Head>
        <span>{t("chopKey")}</span>
        <select value={CH.key0} onChange={(e) => { CH.key0 = +e.target.value; notify(); }}>
          {KEYS.map((x) => <option key={x} value={x}>{noteName(x)}</option>)}
        </select>
        <select value={CH.mode} onChange={(e) => { CH.mode = +e.target.value; notify(); }}>
          <option value="0">{t("chopModeKeys")}</option><option value="1">{t("chopModeOne")}</option>
        </select>
        <span>{t("chopMax")}</span>
        <select value={CH.maxLen} onChange={(e) => { CH.maxLen = +e.target.value; notify(); }}>
          {MAXES.map(([nm, v]) => <option key={v} value={v}>{nm}</option>)}
        </select>
        <progress className="w-[180px]" max={room} value={Math.min(room, n)} />
        <span className={tooLong ? "bad" : "dim"}>{`${chSecs(n)} / ${chSecs(room)}` + (tooLong ? " " + t("chopTooLong") + " " + t("chopOverHint") : "") +
          (CH.mode === 0 && kept > CHOP.MAX ? " " + t("chopTooMany") : "")}</span>
      </Head>
      <Head>
        <button type="button" onClick={() => chopKeepAll(true)}>{t("chopAll")}</button>
        <button type="button" onClick={() => chopKeepAll(false)}>{t("chopNone")}</button>
        <button type="button" disabled={!tooLong} onClick={chopFitAll}>{t("chopFit")}</button>
        <span className="dim">{t("chopKeepHint")}</span>
      </Head>
      <div className="my-2 flex flex-wrap gap-[3px]">
        {all.map((q, i) => {                         /* a chip per chop: the box keeps it, the rest listens */
          const on = i === CH.sel, off = !use.includes(q);
          return (
            <span key={i} onClick={() => chopAudition(i)}
              title={`${chSecs(q.start)} · ${chSecs(q.end - q.start)}` + (q.end < q.full ? ` / ${chSecs(q.full - q.start)}` : "")}
              className={`chip inline-flex cursor-pointer items-center gap-1 px-2 py-[3px] normal-case select-none
                ${on ? "on bg-trk" : "bg-s2"} ${off ? "off text-s3 line-through" : on ? "text-black" : "text-fg2"}`}>
              <input type="checkbox" title={t("chopKeep")} checked={!q.off} onClick={(e) => e.stopPropagation()} onChange={(e) => chopKeep(i, e.target.checked)} />
              {`${i + 1}` + chopKeyName(U, i)}
            </span>
          );
        })}
      </div>
      {c ? (
        <Head className="selrow">
          <b className="selname min-w-12 font-normal text-fg">{`${t("chopSel")} ${CH.sel + 1}${chopKeyName(U, CH.sel)}`}</b>
          <label><input type="checkbox" checked={!c.off} onChange={(e) => chopKeep(CH.sel, e.target.checked)} /> {t("chopKeep")}</label>
          <span>{t("chopLen")}</span>
          <input type="range" className="len w-[180px]" min="10" max={lenMax} step="1" title={t("chopLen")} value={lenV} style={barVars({ min: 10, max: lenMax }, lenV)}
            onChange={(e) => { const ms = +e.target.value; chopSetLen(CH.sel, ms >= Math.floor(full / SMP.RATE * 1000) ? 0 : ms * SMP.RATE / 1000); }} />
          <span className="dim">{`${chSecs(c.end - c.start)} / ${chSecs(full)}`}</span>
          <button type="button" onClick={() => chopAudition(CH.sel)}>▶</button>
          <button type="button" disabled={c.end >= c.full} onClick={() => chopSetLen(CH.sel, 0)}>{t("chopFull")}</button>
        </Head>
      ) : null}
      <Head>
        <button type="button" onClick={chopZip}><Ic ic="symbol_download">{t("chopZip")}</Ic></button>
        <span className="dim">{t("chopSendBelow")}</span>{/* (sending: step 3 of the page) */}
      </Head>
    </div>
  );
}
