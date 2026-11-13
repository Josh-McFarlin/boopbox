// SPDX-License-Identifier: GPL-3.0-only
// CHOP: one recording cut into chops (the Samples page's step 2, "CHOP").
//
// Load a recording, mark the chops (live: TAP / space while it plays, each tap moved to the hit it
// meant; or by hits, a tempo grid, equal parts; double-click adds, drag moves, Delete removes),
// audition them (click, keys 1-9 0), keep or leave out each one and set its length (a recording longer
// than a slot: keep the chops you want, shorten them, or Fit to slot), then one chop per key into
// USR1..4 or as WAV files. CH.opt[i] = {off, len} goes with marker i.
import { CHOP, SMP, chopFit, chopList, chopNovelty, chopPick, chopSnap, chopZones, noteName, parseWav, resample, wavFile, zipStore } from "../../lib/proto.ts";
import { downloadBytes, notify, sayK, t } from "../../core/app.ts";
import { SB, browserDecode, smpUpload } from "./smp.ts";

export const CH = { x: null, nov: null, name: "", marks: [], opt: [], sel: -1, v0: 0, v1: 1, ctx: null, src: null, t0: 0, raf: 0,
  drag: -1, dragEnd: false, key0: 60, mode: 0, maxLen: 0,
  /* the page's controls (the old block's inputs) */
  snap: true, sens: 5, bpm: 90, div: 1, n: 8,
  cv: null };                                       /* the wave's canvas while the page shows */
const chR = () => SMP.RATE;
export const chSecs = (n) => (n / SMP.RATE).toFixed(2) + " s";
/* the block changed: the page renders again (and draws the wave after) */
const chopRender = () => notify();

export function chopChops() { return CH.x ? chopList(CH.marks, CH.x.length, Math.round(CH.maxLen * SMP.RATE), CH.opt) : []; }
export function chopUsed() {                         /* the chops the slot gets, their samples, and each chop's key */
  const c = chopChops(), use = chopPick(c, CH.mode, Math.max(0, CH.sel)), key = new Map();
  if (CH.mode === 0) use.forEach((q, j) => key.set(q.i, Math.min(127, CH.key0 + j)));
  return { all: c, use, n: use.reduce((a, q) => a + (q.end - q.start), 0), key };
}
/* the bytes the kept chops take over a slot's room */
export const chopOver = (use) => use.reduce((a, q) => a + ((q.end - q.start + 1) >> 1), 0) > SMP.MAX_DATA;
/* the label of chop i: its key, "—" when left out, nothing past the 16 kept ones or over the whole keyboard */
export function chopKeyName(u, i) {
  if (CH.mode === 1) return "";
  const c = u.all[i];
  return c && c.off ? " —" : u.key.has(i) ? " " + noteName(u.key.get(i)) : "";
}
export function chopOpt(i) { return CH.opt[i] || (CH.opt[i] = { off: false, len: 0 }); }
export function chopKeep(i, keep) {                  /* keep / leave out chop i (keep undefined: toggle) */
  if (!CH.x || i < 0 || i >= CH.marks.length) return;
  const o = chopOpt(i);
  o.off = keep === undefined ? !o.off : !keep;
  chopRender();
}
export function chopKeepAll(keep) { if (CH.x) { CH.opt = CH.marks.map((_, i) => ({ ...chopOpt(i), off: !keep })); chopRender(); } }
export function chopSetLen(i, len) {                 /* the length of chop i in samples (0: up to the next marker) */
  if (!CH.x || i < 0 || i >= CH.marks.length) return;
  chopOpt(i).len = Math.max(0, Math.round(len));
  chopRender();
}
export function chopFitAll() {                       /* shorten the longest kept chops so they all fit the slot */
  const { use } = chopUsed(), L = chopFit(use, SMP.MAX_DATA * 2 - use.length);   /* (an odd chop takes half a byte more) */
  if (!isFinite(L)) return;
  for (const c of use) if (c.end - c.start > L) chopOpt(c.i).len = L;
  sayK("chopFitted", chSecs(L));
  chopRender();
}

async function chopDecode(buf) {                    /* any file the browser decodes -> mono Float64 at SMP.RATE */
  try { const w = parseWav(buf); return resample(w.x, w.sr, SMP.RATE); } catch (e) { /* not a plain WAV */ }
  return browserDecode(buf);
}

export async function chopLoad(f) {
  chopStop();
  try {
    const x = await chopDecode(await f.arrayBuffer());
    if (!x.length) throw new Error("no audio");
    CH.x = x;
    CH.nov = chopNovelty(x);
    CH.name = f.name.replace(/\.[^.]*$/, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CHOP";
    CH.marks = [];
    CH.opt = [];
    CH.sel = -1;
    CH.v0 = 0;
    CH.v1 = x.length;
    sayK("chopLoaded", `${f.name} (${chSecs(x.length)})`);
  } catch (e) { sayK("smpDecodeFail", `${f.name} (${e.message})`); }
  chopRender();
}

/* new markers; opt (aligned with m) their options, else each keeps the options of the marker it was */
export function chopSetMarks(m, opt = null) {
  const was = new Map(CH.marks.map((v, i) => [v, CH.opt[i]])), seen = new Set(), pairs = [];
  m.forEach((v, i) => {
    const p = Math.max(0, Math.min(CH.x.length - 1, Math.round(v)));
    if (seen.has(p)) return;
    seen.add(p);
    const o = opt ? opt[i] : was.get(p);
    pairs.push([p, o ? { ...o } : { off: false, len: 0 }]);
  });
  pairs.sort((a, b) => a[0] - b[0]);
  CH.marks = pairs.map((q) => q[0]);
  CH.opt = pairs.map((q) => q[1]);
  if (CH.sel >= CH.marks.length) CH.sel = CH.marks.length - 1;
  chopRender();
}
export function chopAdd(pos) {                       /* a new marker; one within 30 ms is moved there instead */
  const near = CH.marks.findIndex((m) => Math.abs(m - pos) < 0.03 * chR());
  const m = CH.marks.slice(), opt = CH.marks.map((_, i) => CH.opt[i]);
  if (near >= 0) m[near] = pos; else { m.push(pos); opt.push(null); }
  chopSetMarks(m, opt);
  CH.sel = CH.marks.indexOf(Math.round(pos));
  chopDraw();
}
/* first..last marker when there are two, else all */
export function chopRegion() {
  const m = CH.marks;
  return m.length >= 2 ? [m[0], m[m.length - 1]] : [m[0] || 0, CH.x.length];
}

/* ---- audio */
function chopCtx() {
  if (!CH.ctx) CH.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (CH.ctx.state === "suspended") CH.ctx.resume();
  return CH.ctx;
}
function chopBuffer(a, b) {
  const ctx = chopCtx(), n = Math.max(1, b - a), buf = ctx.createBuffer(1, n, SMP.RATE), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = CH.x[a + i];
  return buf;
}
export const chopPlaying = () => !!CH.src && !!CH.src.whole;
export function chopStop() {
  if (CH.src) { try { CH.src.stop(); } catch (e) { /* ended */ } CH.src = null; }
  cancelAnimationFrame(CH.raf);
  chopRender();                                     /* (the ▶ button's words) */
  chopDraw();
}
/* play a..b; whole = the transport (a playhead, TAP marks), else an audition */
export function chopPlay(a, b, whole) {
  if (!CH.x) return;
  chopStop();
  const ctx = chopCtx(), src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = chopBuffer(a, b);
  src.connect(g).connect(ctx.destination);
  if (!whole) {                                     /* the fades the slot will have */
    const n = b - a, fo = Math.min(CHOP.FADE_OUT, n >> 2) / SMP.RATE, now = ctx.currentTime + 0.005, end = now + n / SMP.RATE;
    g.gain.setValueAtTime(1, now);
    g.gain.setValueAtTime(1, Math.max(now, end - fo));
    g.gain.linearRampToValueAtTime(0, end);
  }
  CH.t0 = ctx.currentTime + 0.005 - a / SMP.RATE;
  src.start(ctx.currentTime + 0.005);
  src.onended = () => { if (CH.src === src) { CH.src = null; if (whole) chopStop(); } };
  CH.src = src;
  CH.src.whole = whole;
  if (whole) {
    chopRender();
    const tick = () => { chopDraw(); if (CH.src === src) CH.raf = requestAnimationFrame(tick); };
    CH.raf = requestAnimationFrame(tick);
  }
}
export function chopTransport() {                    /* ▶ / ■ */
  if (chopPlaying()) chopStop(); else if (CH.x) chopPlay(Math.round(CH.v0), CH.x.length, true);
}
/* where the listener is now, in samples (what comes out of the speakers, not what is computed) */
function chopHeard(ev) {
  const ctx = CH.ctx;
  let ct = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  if (ev && ctx.getOutputTimestamp) {
    const ts = ctx.getOutputTimestamp();
    if (ts.performanceTime > 0) ct = ts.contextTime + (ev.timeStamp - ts.performanceTime) / 1000;
  }
  return (ct - CH.t0) * SMP.RATE;
}
export function chopTap(ev) {                        /* TAP while it plays: a marker on the hit you meant */
  if (!chopPlaying()) return;
  const p = chopHeard(ev);
  if (p < 0 || p >= CH.x.length) return;
  chopAdd(CH.snap ? chopSnap(CH.x, CH.nov, p) : Math.round(p));
}
export function chopAudition(i) {
  const c = chopChops()[i];
  if (!c) return;
  CH.sel = i;
  chopPlay(c.start, c.end, false);
  chopRender();
}

/* ---- drawing (the page's own two colours) */
export function chopDraw() {
  const cv = CH.cv;
  if (!cv || !cv.isConnected) return;
  const dpr = window.devicePixelRatio || 1, W = Math.max(200, cv.clientWidth), Hh = 150;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
  const g = cv.getContext("2d"), cs = getComputedStyle(document.documentElement);
  const FG = cs.getPropertyValue("--fg").trim(), DIM = cs.getPropertyValue("--dim").trim(), LINE = cs.getPropertyValue("--line").trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, Hh);
  const PIX = '16px "BoopBox Terminus", monospace', TRK = cs.getPropertyValue("--t1").trim() || FG;
  if (!CH.x) { g.fillStyle = DIM; g.font = PIX; g.fillText(t("chopDrop"), 12, Hh / 2 + 4); return; }
  const x = CH.x, v0 = CH.v0, span = CH.v1 - CH.v0, X = (p) => (p - v0) / span * W, mid = Hh / 2 + 6;
  const U = chopUsed(), { all: chops, use } = U;
  const hatch = (a, b) => {                          /* what the slot does not get */
    g.save(); g.beginPath(); g.rect(a, 12, b - a, Hh - 12); g.clip(); g.strokeStyle = LINE;
    for (let q = Math.floor(a / 8) * 8 - 8; q < b; q += 8) { g.beginPath(); g.moveTo(q, Hh); g.lineTo(q + 8, 12); g.stroke(); }
    g.restore();
  };
  if (chops.length && chops[0].start > 0) hatch(X(0), X(chops[0].start));
  chops.forEach((c, i) => {                          /* the chops: the selected one filled, left-out parts hatched */
    const a = X(c.start), b = X(c.end), f = X(c.full);
    if (f < 0 || a > W) return;
    if (i === CH.sel) { g.fillStyle = LINE; g.fillRect(a, 12, b - a, Hh - 12); }
    if (!use.includes(c)) hatch(a, f); else if (c.end < c.full) hatch(b, f);
  });
  g.fillStyle = TRK;
  for (let px = 0; px < W; px++) {                   /* the wave: min / max per pixel */
    const a = Math.floor(v0 + px / W * span), b = Math.min(x.length, Math.max(a + 1, Math.floor(v0 + (px + 1) / W * span)));
    let lo = 0, hi = 0;
    for (let i = a; i < b; i += Math.max(1, (b - a) >> 6)) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; }
    g.fillRect(px, mid - hi * (Hh / 2 - 8), 1, Math.max(1, (hi - lo) * (Hh / 2 - 8)));
  }
  g.font = PIX;
  CH.marks.forEach((m, i) => {                       /* the markers, numbered; the chop's key above */
    const px = X(m);
    if (px < -1 || px > W + 1) return;
    g.fillStyle = FG;
    g.fillRect(Math.round(px), 0, i === CH.sel ? 2 : 1, Hh);
    g.fillText(String(i + 1) + chopKeyName(U, i), px + 3, 12);
  });
  const sc = chops[CH.sel];
  if (sc) {                                          /* the selected chop's end: a handle at the bottom, drag it */
    const px = Math.round(X(sc.end));
    g.fillStyle = FG;
    g.fillRect(px - 1, Hh - 30, 2, 30);
    g.beginPath(); g.moveTo(px, Hh - 30); g.lineTo(px - 7, Hh - 38); g.lineTo(px - 7, Hh - 22); g.closePath(); g.fill();
  }
  if (chopPlaying() && CH.ctx) {                     /* the playhead, as heard */
    const p = X(chopHeard());
    g.fillStyle = DIM;
    g.fillRect(Math.round(p), 12, 1, Hh - 12);
  }
}

/* the chops into slot k's list (it shows below), then the usual upload */
export async function chopSend(k) {
  if (!CH.x || SB.busy) return;
  const { use } = chopUsed();
  if (!use.length) return;
  const zones = chopZones(CH.x, chopChops(), CH.key0, CH.mode, Math.max(0, CH.sel));   /* (the kept ones) */
  if (await smpUpload(k, "smp", true, { name: CH.name || "CHOP", files: zones })) sayK("chopSent", `USR${k + 1}: ${zones.length} ${t("chopChops")}, ${noteName(zones[0].lo === 0 ? zones[0].root : zones[0].lo)}…`);
}

export function chopZip() {
  if (!CH.x) return;
  const zones = chopZones(CH.x, chopChops(), CH.key0, CH.mode, Math.max(0, CH.sel));
  if (!zones.length) return;
  downloadBytes(`${CH.name}-chops.zip`, zipStore(zones.map((z) => ({ name: `${CH.name}/${z.fname}`, data: wavFile(z.s) }))), "application/zip");
}
