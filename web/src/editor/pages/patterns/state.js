// SPDX-License-Identifier: GPL-3.0-only
// The Patterns page's working copy (BoopBox): the project read from the FM-1 (backup object 0, format 7: PROJ7), edited
// here (the Patterns page, the step components in the Sequencer's step inspector) and sent back whole.
import { CMD, PROJ7, bkReadObj, bkWriteObj, parse, req } from "../../lib/proto.js";
import { A, notify, rq, sayK } from "../../core/app.js";
import { afterSoundChange } from "../../core/device.js";

/* PT.P: the working copy; PT.base: its bytes as read (or sent): the page has unsent changes while they differ */
export const PT = { dev: null, P: null, base: null, err: "", trk: 0, pat: 0, addType: 10 };
export const ptOk = () => { const dev = A.dev; return !!dev && !!dev.info && dev.info.ntrk >= 8 && dev.info.proto >= 6; };
export const ptCtx = () => { const dev = A.dev; const id = Math.max(0, dev.pdesc.findIndex((d, k) => d && k < dev.info.pe0 && d.label === "LEN")) || 29;
  return { len: id, def: (x) => (dev.pdesc[x] ? dev.pdesc[x].def : 16) }; };
export const ptDrum = (i) => { const x = PT.P && PROJ7.track(PT.P, i); return !!x && x.kind === PROJ7.DRUM; };
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, k) => x === b[k]);
/* the working copy differs from what was read or sent */
export const ptDirty = () => !!PT.P && !!PT.base && !same(PROJ7.encode(PT.P), PT.base);

async function readProject() {
  const L = parse[CMD.BK_LIST](await rq(req.bkList(), { timeout: 5000, retries: 0 }));
  const it = L.rc ? null : L.items.find((x) => x.id === 0);
  if (!it) throw new Error("the project is not readable (rc " + L.rc + ")");
  return PROJ7.decode(await bkReadObj(rq, it));
}
export async function readPatterns() {
  if (!ptOk()) { Object.assign(PT, { P: null, base: null, err: "patOld" }); notify(); return; }
  const P = await readProject();
  Object.assign(PT, { P, base: P ? PROJ7.encode(P) : null, err: P ? "" : "patBad" });
  if (P && !PROJ7.track(P, PT.trk)) PT.trk = 0;
  if (P) { const tr = PROJ7.track(P, PT.trk); if (tr && PT.pat === undefined) PT.pat = tr.cur; }
  notify();
}
async function sendProject(P) {
  const dev = A.dev;
  if (!PROJ7.fits(P)) { sayK("patFull"); return; }
  try { await bkWriteObj(rq, 0, PROJ7.encode(P)); }
  catch (e) { if (e.code === "bkStop") { sayK("patStop"); return; } throw e; }
  await readPatterns();
  dev.sel = parse[CMD.TRACK](await rq(req.track())).sel;   /* (the FM-1 loaded it: the other pages read it again) */
  await afterSoundChange("patSent");
}
export async function sendPatterns() { if (A.dev && PT.P) await sendProject(PT.P); }

/* the step components only (the Sequencer's step inspector): the FM-1's project read again (its steps as they are now,
   edited live since the read), this pattern's components put in it, sent. Other unsent changes of the working copy are
   lost: asked first */
export async function sendComps(trk, pat, ask) {
  if (!A.dev || !PT.P) return;
  const mine = PROJ7.patOf(PT.P, trk, pat), base = PROJ7.decode(PT.base);
  const W = PROJ7.decode(PROJ7.encode(PT.P)), wb = PROJ7.patOf(W, trk, pat), bb = base && PROJ7.patOf(base, trk, pat);
  if (wb) wb.comps = bb ? bb.comps : [];
  if (base && !same(PROJ7.encode(W), PT.base) && !ask()) return;
  const Q = await readProject();
  if (!Q) { Object.assign(PT, { err: "patBad" }); notify(); return; }
  const q = PROJ7.patOf(Q, trk, pat);
  const comps = mine ? PROJ7.patClone(mine).comps : [];
  if (q) q.comps = comps;
  else if (comps.length) Q.bank.push({ trk, pat, len: PROJ7.lenOf(PT.P, trk, pat, ptCtx()), p: { ...PROJ7.emptyPat(ptDrum(trk)), comps } });
  await sendProject(Q);
}

export function ptEdit(fn) { fn(); notify(); }
export const ptPatUsed = (i, n) => { const p = PROJ7.patOf(PT.P, i, n); return !!p && !PROJ7.patIsEmpty(p, ptDrum(i)); };
export const ptHits = (p, drum, k) => (drum ? (p.steps[k].on[0] | p.steps[k].on[1]) !== 0 : p.steps[k].n > 0 && p.steps[k].time === 0);
export const ptParamName = (id) => { const dev = A.dev; return id < dev.info.pe0 ? (dev.pdesc[id] || { label: String(id) }).label : "E" + (id - dev.info.pe0 + 1); };
export const clampIn = (v, lo, hi, def) => Math.max(lo, Math.min(hi, Math.round(v) || def));

/* a pattern to change (an empty one: made to hold what is added), and tidied again when it is left empty */
export function ptOwn(P, trk, pat, ctx) {
  const drum = ptDrum(trk), len = PROJ7.lenOf(P, trk, pat, ctx);
  if (!PROJ7.patOf(P, trk, pat)) PROJ7.setPat(P, trk, pat, PROJ7.emptyPat(drum), len, ctx);
  let q = PROJ7.patOf(P, trk, pat);
  if (!q) { P.bank.push({ trk, pat, len, p: PROJ7.emptyPat(drum) }); q = PROJ7.patOf(P, trk, pat); }
  return q;
}
export function ptTidy(P, trk, pat, ctx) {
  const tr = PROJ7.track(P, trk), q = PROJ7.patOf(P, trk, pat);
  if (q && pat !== tr.cur && PROJ7.patIsEmpty(q, ptDrum(trk))) PROJ7.setPat(P, trk, pat, null, 0, ctx);
}
