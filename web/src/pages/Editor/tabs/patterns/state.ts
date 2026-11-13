// SPDX-License-Identifier: GPL-3.0-only
// The Patterns page's working copy (BoopBox): the project read from the FM-1 (backup object 0, format 7: PROJ7), edited
// here (the Patterns page, the step components in the Sequencer's step inspector) and sent back whole.
import { CMD, PROJ7, bkReadObj, bkWriteObj, parse, req } from "../../lib/proto.ts";
import type { P7AnyStep, P7DrumStep, P7LenCtx, P7Pat, P7Step, Proj7 } from "../../lib/proto.ts";
import type { Dev } from "../../core/app.ts";
import { A, notify, rq, sayK } from "../../core/app.ts";
import { afterSoundChange } from "../../core/device.ts";

/* PT.P: the working copy; PT.base: its bytes as read (or sent): the page has unsent changes while they differ */
/* the Patterns page's state: the device it was read from, the working copy and its bytes as read, the error (a string
   key), the track and pattern shown (undefined: the one playing, once read), the step component type the next "add" makes */
export interface PatternsState { dev: Dev | null; P: Proj7 | null; base: Uint8Array | null; err: string; trk: number; pat: number | undefined; addType: number }
export const PT: PatternsState = { dev: null, P: null, base: null, err: "", trk: 0, pat: 0, addType: 10 };
export const ptOk = (): boolean => { const dev = A.dev; return !!dev && !!dev.info && dev.info.ntrk >= 8 && dev.info.proto >= 6; };
export const ptCtx = (): P7LenCtx => { const dev = A.dev!; const id = Math.max(0, dev.pdesc.findIndex((d, k) => d && k < dev.info!.pe0 && d.label === "LEN")) || 29;
  return { len: id, def: (x) => (dev.pdesc[x] ? dev.pdesc[x]!.def : 16) }; };
export const ptDrum = (i: number): boolean => { const x = PT.P && PROJ7.track(PT.P, i); return !!x && x.kind === PROJ7.DRUM; };
const same = (a: Uint8Array | null, b: Uint8Array | null): boolean => !!a && !!b && a.length === b.length && a.every((x, k) => x === b[k]);
/* the working copy differs from what was read or sent */
export const ptDirty = (): boolean => !!PT.P && !!PT.base && !same(PROJ7.encode(PT.P), PT.base);

async function readProject(): Promise<Proj7 | null> {
  const L = parse[CMD.BK_LIST](await rq(req.bkList(), { timeout: 5000, retries: 0 }));
  const it = L.rc ? null : L.items.find((x) => x.id === 0);
  if (!it) throw new Error("the project is not readable (rc " + L.rc + ")");
  return PROJ7.decode(await bkReadObj(rq, it));
}
export async function readPatterns(): Promise<void> {
  if (!ptOk()) { Object.assign(PT, { P: null, base: null, err: "patOld" }); notify(); return; }
  const P = await readProject();
  Object.assign(PT, { P, base: P ? PROJ7.encode(P) : null, err: P ? "" : "patBad" });
  if (P && !PROJ7.track(P, PT.trk)) PT.trk = 0;
  if (P) { const tr = PROJ7.track(P, PT.trk); if (tr && PT.pat === undefined) PT.pat = tr.cur; }
  notify();
}
async function sendProject(P: Proj7): Promise<void> {
  const dev = A.dev!;
  if (!PROJ7.fits(P)) { sayK("patFull"); return; }
  try { await bkWriteObj(rq, 0, PROJ7.encode(P)); }
  catch (e) { if ((e as { code?: string }).code === "bkStop") { sayK("patStop"); return; } throw e; }
  await readPatterns();
  dev.sel = parse[CMD.TRACK](await rq(req.track())).sel;   /* (the FM-1 loaded it: the other pages read it again) */
  await afterSoundChange("patSent");
}
export async function sendPatterns(): Promise<void> { if (A.dev && PT.P) await sendProject(PT.P); }

/* the step components only (the Sequencer's step inspector): the FM-1's project read again (its steps as they are now,
   edited live since the read), this pattern's components put in it, sent. Other unsent changes of the working copy are
   lost: asked first */
export async function sendComps(trk: number, pat: number, ask: () => boolean): Promise<void> {
  if (!A.dev || !PT.P) return;
  const mine = PROJ7.patOf(PT.P, trk, pat), base = PT.base && PROJ7.decode(PT.base);
  const W = PROJ7.decode(PROJ7.encode(PT.P))!, wb = PROJ7.patOf(W, trk, pat), bb = base && PROJ7.patOf(base, trk, pat);
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

export function ptEdit(fn: () => void): void { fn(); notify(); }
export const ptPatUsed = (i: number, n: number): boolean => { const p = PROJ7.patOf(PT.P!, i, n); return !!p && !PROJ7.patIsEmpty(p, ptDrum(i)); };
export const ptHits = (p: P7Pat, drum: boolean, k: number): boolean => {
  const s: P7AnyStep = p.steps[k];
  return drum ? ((s as P7DrumStep).on[0] | (s as P7DrumStep).on[1]) !== 0 : (s as P7Step).n > 0 && (s as P7Step).time === 0;
};
export const ptParamName = (id: number): string => { const dev = A.dev!, info = dev.info!; return id < info.pe0 ? (dev.pdesc[id] || { label: String(id) }).label : "E" + (id - info.pe0 + 1); };
export const clampIn = (v: number, lo: number, hi: number, def: number): number => Math.max(lo, Math.min(hi, Math.round(v) || def));

/* a pattern to change (an empty one: made to hold what is added), and tidied again when it is left empty */
export function ptOwn(P: Proj7, trk: number, pat: number, ctx: P7LenCtx): P7Pat {
  const drum = ptDrum(trk), len = PROJ7.lenOf(P, trk, pat, ctx);
  if (!PROJ7.patOf(P, trk, pat)) PROJ7.setPat(P, trk, pat, PROJ7.emptyPat(drum), len, ctx);
  let q = PROJ7.patOf(P, trk, pat);
  if (!q) { P.bank.push({ trk, pat, len, p: PROJ7.emptyPat(drum) }); q = PROJ7.patOf(P, trk, pat); }
  return q!;
}
export function ptTidy(P: Proj7, trk: number, pat: number, ctx: P7LenCtx): void {
  const tr = PROJ7.track(P, trk), q = PROJ7.patOf(P, trk, pat);
  if (q && pat !== tr!.cur && PROJ7.patIsEmpty(q, ptDrum(trk))) PROJ7.setPat(P, trk, pat, null, 0, ctx);
}
