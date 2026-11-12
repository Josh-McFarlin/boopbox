// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The Sequencer page's piano roll (2.5): rows = notes C0..C8 in a box that scrolls (a keyboard on its left edge),
// columns = steps (bar lines from DIV), a chord = one bar per note. The logic is in seq.js.
import { useEffect, useRef } from "react";
import { ROLL, noteName } from "../../lib/proto.js";
import { A, notify, t, useApp } from "../../core/app.js";
import { ROLL_HI, ROLL_LAB, ROLL_LO, ROLL_ROW, RV, curDiv, roll, rollApply, rollCenter, rollNoteAt, stepLen } from "./seq.js";

const BLACK = [1, 3, 6, 8, 10];
function rollColors() {
  const cs = getComputedStyle(document.documentElement), g = (v) => cs.getPropertyValue(v).trim();
  return { bg: g("--bg"), s1: g("--s1"), s2: g("--s2"), s3: g("--s3"), dim: g("--dim"), fg: g("--fg"), fg2: g("--fg2"), trk: g("--trk"), line: g("--line") };
}
function drawRoll(cv) {
  const dev = A.dev;
  if (!cv || !dev || !dev.steps.length) return;
  const len = stepLen();
  const lo = ROLL_LO, hi = ROLL_HI, rows = hi - lo + 1;
  const avail = Math.max(320, (cv.parentElement.clientWidth || 800) - 2);
  const cw = Math.max(12, Math.floor((avail - ROLL_LAB) / len));
  const W = ROLL_LAB + cw * len, H = rows * ROLL_ROW, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d"), C = rollColors();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  RV.geo = { lo, hi, cw, len };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.font = '14px "BoopBox Terminus", monospace'; g.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    const p = hi - r, black = BLACK.includes(p % 12), y = r * ROLL_ROW, c = p % 12 === 0;
    g.fillStyle = black ? C.s1 : C.s2; g.fillRect(ROLL_LAB, y, W - ROLL_LAB, ROLL_ROW - 1);
    /* the keyboard on the left edge, a key a row: white keys light, black keys dark and shorter, every key named
       (a line between rows; a brighter one under each C, where an octave starts) */
    g.fillStyle = black ? C.bg : C.fg2; g.fillRect(0, y, black ? ROLL_LAB - 14 : ROLL_LAB - 2, ROLL_ROW - 1);
    if (black) { g.fillStyle = C.s3; g.fillRect(ROLL_LAB - 14, y, 12, ROLL_ROW - 1); }
    g.fillStyle = black ? C.fg2 : C.bg; g.fillText(noteName(p), 6, y + ROLL_ROW / 2 + 1);
    g.fillStyle = c ? C.dim : C.line; g.fillRect(0, y + ROLL_ROW - 1, c ? W : ROLL_LAB, 1);
  }
  const per = ROLL.DIV_PER_BAR[curDiv()], beat = per / 4;
  for (let i = 0; i <= len; i++) {
    const bar = per >= 1 && i % per === 0, bt = Number.isInteger(beat) && beat >= 1 && i % beat === 0;
    if (!bar && !bt) continue;
    g.fillStyle = bar ? C.dim : C.s3; g.fillRect(ROLL_LAB + i * cw - (bar ? 1 : 0), 0, bar ? 2 : 1, H);
  }
  for (const c of ROLL.chords(dev.steps, len)) {
    const dur = RV.drag && RV.drag.at === c.at ? RV.drag.dur : c.dur, acc = dev.steps[c.at].flags & 1;
    const x = ROLL_LAB + c.at * cw + 1, w = dur * cw - 2;
    for (const p of c.notes) {
      g.fillStyle = C.trk;
      if (p > hi || p < lo) { g.fillRect(x, p > hi ? 0 : H - 3, w, 3); continue; }   /* (outside the range: a mark at its edge) */
      const y = (hi - p) * ROLL_ROW + 1;
      g.fillRect(x, y, w, ROLL_ROW - 3);
      if (acc) { g.fillStyle = C.fg; g.fillRect(x, y, w, 2); }
      g.fillStyle = C.bg; g.fillRect(x + w - 4, y + 3, 1, ROLL_ROW - 9);   /* the grip: drag the end */
    }
  }
}

export default function Roll() {
  useApp();
  const cv = useRef(null), box = useRef(null);
  /* drawn after every render: the steps, LEN, DIV, the view or the selected track's colour may have changed */
  useEffect(() => {
    drawRoll(cv.current);
    const c = rollCenter(stepLen());                   /* a track shown the first time: its notes (or C3..C5) in the middle */
    if (c != null && box.current) box.current.scrollTop = (ROLL_HI - c + 0.5) * ROLL_ROW - box.current.clientHeight / 2;
  });
  useEffect(() => {
    const r = () => drawRoll(cv.current);
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("resize", r); RV.trk = -1; };   /* (opened again: on the notes again) */
  }, []);
  const rollAt = (e) => {
    const G = RV.geo, r = cv.current.getBoundingClientRect();
    if (!G) return null;
    const x = e.clientX - r.left - ROLL_LAB, y = e.clientY - r.top;
    const i = Math.floor(x / G.cw), p = G.hi - Math.floor(y / ROLL_ROW);
    return { i, p, fx: x / G.cw - i, inside: x >= 0 && i >= 0 && i < G.len && p >= G.lo && p <= G.hi };
  };
  const down = (e) => {
    if (!A.dev || roll.writing) return;
    const h = rollAt(e);
    if (!h || !h.inside) return;
    const c = rollNoteAt(h), len = stepLen();
    if (c) {
      if (h.i === c.at + c.dur - 1 && h.fx > 0.55) {      /* the end of a note: drag its length */
        RV.drag = { at: c.at, dur: c.dur };
        cv.current.setPointerCapture(e.pointerId);
        drawRoll(cv.current);
        return;
      }
      rollApply(ROLL.remove(A.dev.steps, len, c.at, h.p));
      return;
    }
    rollApply(ROLL.place(A.dev.steps, len, h.i, h.p, ROLL.steps(RV.frac, curDiv())));
  };
  const move = (e) => {
    const h = rollAt(e);
    if (RV.drag) {
      if (!h) return;
      const d = Math.max(1, Math.min(stepLen() - RV.drag.at, h.i - RV.drag.at + 1));
      if (d !== RV.drag.dur) { RV.drag.dur = d; drawRoll(cv.current); }
      return;
    }
    const c = h && h.inside ? rollNoteAt(h) : null;
    cv.current.style.cursor = c && h.i === c.at + c.dur - 1 && h.fx > 0.55 ? "ew-resize" : "pointer";
    cv.current.title = h && h.p >= ROLL_LO && h.p <= ROLL_HI ? noteName(h.p) + (h.inside ? ` · ${h.i + 1}` : "") : "";
  };
  const drop = () => {
    if (!RV.drag) return;
    const d = RV.drag;
    RV.drag = null;
    rollApply(ROLL.resize(A.dev.steps, stepLen(), d.at, d.dur));
  };
  return (
    <div id="roll" className="min-w-0 flex-1">
      <p className="bar">
        <span className="text-dim">{t("sqRollKeep")}</span>
        <span className="seg" id="rolllen">
          {ROLL.LENGTHS.map(([k, f]) => (
            <button key={k} type="button" data-f={String(f)} aria-pressed={f === RV.frac ? "true" : "false"}
              onClick={() => { RV.frac = f; notify(); }}>{t("len_" + k)}</button>
          ))}
        </span>
      </p>
      <div ref={box} id="rollbox" className="h-[500px] overflow-auto border border-line">
        <canvas id="rollcv" ref={cv} className="block touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={drop}
          onPointerCancel={() => { RV.drag = null; drawRoll(cv.current); }} />
      </div>
      <p className="help mt-2 text-dim">{t("rollHelp")}</p>
    </div>
  );
}
