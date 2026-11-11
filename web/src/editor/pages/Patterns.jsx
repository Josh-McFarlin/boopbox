// SPDX-License-Identifier: GPL-3.0-only
// The Patterns page (BoopBox): the working project read from the FM-1, its patterns, chains, scenes, a pattern's step
// components and the chord progression, edited here and sent back whole.
import { useEffect, useRef } from "react";
import { CMD, PROJ7, bkReadObj, bkWriteObj, lockable, parse, req } from "../lib/proto.js";
import { A, notify, op, rq, sayK, t, tcol, useApp } from "../core/app.js";
import { afterSoundChange } from "../core/device.js";
import { Card, Help, Ic } from "../ui/kit.jsx";
import { ACTS, Num, SONG_TABLE, TD_I } from "./song/Num.jsx";

/* ---- BoopBox: the Patterns page. The working project (backup object 0, format 7: PROJ7) read from the FM-1, its
   patterns 1..8 of each track, the chains, a pattern's step components, direction and seed, the tracks' FOLLOW and the
   chord progression changed here, and sent back whole (BK_PUT; the FM-1 loads it at once, stopped only). Nothing is
   sent until Send: the page edits a copy. */
export const PT = { dev: null, P: null, err: "", dirty: false, trk: 0, pat: 0, step: 0, addType: 10 };
const ptOk = () => { const dev = A.dev; return !!dev && !!dev.info && dev.info.ntrk >= 8 && dev.info.proto >= 6; };
const ptCtx = () => { const dev = A.dev; const id = Math.max(0, dev.pdesc.findIndex((d, k) => d && k < dev.info.pe0 && d.label === "LEN")) || 29;
  return { len: id, def: (x) => (dev.pdesc[x] ? dev.pdesc[x].def : 16) }; };
const ptDrum = (i) => { const x = PT.P && PROJ7.track(PT.P, i); return !!x && x.kind === PROJ7.DRUM; };
async function readPatterns() {
  if (!ptOk()) { Object.assign(PT, { P: null, err: "patOld" }); notify(); return; }
  const L = parse[CMD.BK_LIST](await rq(req.bkList(), { timeout: 5000, retries: 0 }));
  const it = L.rc ? null : L.items.find((x) => x.id === 0);
  if (!it) throw new Error("the project is not readable (rc " + L.rc + ")");
  const P = PROJ7.decode(await bkReadObj(rq, it));
  Object.assign(PT, { P, err: P ? "" : "patBad", dirty: false });
  if (P && !PROJ7.track(P, PT.trk)) PT.trk = 0;
  if (P) { const tr = PROJ7.track(P, PT.trk); if (tr && PT.pat === undefined) PT.pat = tr.cur; }
  notify();
}
async function sendPatterns() {
  const dev = A.dev;
  if (!dev || !PT.P) return;
  if (!PROJ7.fits(PT.P)) { sayK("patFull"); return; }
  try { await bkWriteObj(rq, 0, PROJ7.encode(PT.P)); }
  catch (e) { if (e.code === "bkStop") { sayK("patStop"); return; } throw e; }
  PT.dirty = false;
  await readPatterns();
  dev.sel = parse[CMD.TRACK](await rq(req.track())).sel;   /* (the FM-1 loaded it: the other pages read it again) */
  await afterSoundChange("patSent");
}
function ptEdit(fn) { fn(); PT.dirty = true; notify(); }
const ptPatUsed = (i, n) => { const p = PROJ7.patOf(PT.P, i, n); return !!p && !PROJ7.patIsEmpty(p, ptDrum(i)); };
const ptHits = (p, drum, k) => (drum ? (p.steps[k].on[0] | p.steps[k].on[1]) !== 0 : p.steps[k].n > 0 && p.steps[k].time === 0);
const ptParamName = (id) => { const dev = A.dev; return id < dev.info.pe0 ? (dev.pdesc[id] || { label: String(id) }).label : "E" + (id - dev.info.pe0 + 1); };
const clampIn = (v, lo, hi, def) => Math.max(lo, Math.min(hi, Math.round(v) || def));

const Sel = ({ v, onPick, children, ...rest }) => (
  <select value={String(v)} onChange={(e) => onPick(+e.target.value)} {...rest}>{children}</select>
);

/* the tracks, the selected one's eight patterns, what to do with the pattern picked, its chain */
function PatternsCard({ P, tr, drum, ctx }) {
  const toRef = useRef(null);
  const sel = PT.pat, selUsed = ptPatUsed(PT.trk, sel);
  /* the chain: its slots (a pattern, its repeats), PLAY on / off */
  const setSlot = (k, x) => ptEdit(() => { const c = tr.chain.slice(); c[k] = x; PROJ7.setChain(P, PT.trk, c); });
  return (
    <Card title={t("patPatterns")} ic="symbol_grid">
      <div id="pattrk" className="my-2 flex flex-wrap gap-1.5" role="group">
        {P.tracks.map((x) => {
          const name = x.kind === PROJ7.DRUM ? "DRUMS" : A.dev.info.engines[x.eng] || "";
          return (
            <button key={x.i} type="button" style={{ "--c": tcol(x.i) }} aria-pressed={x.i === PT.trk}
              className="min-w-[110px] border-l-4 border-c text-left aria-pressed:bg-c! aria-pressed:text-black"
              onClick={() => { PT.trk = x.i; PT.pat = x.cur; notify(); }}>{`${x.i + 1} ${name} · P${x.cur + 1}`}</button>
          );
        })}
      </div>
      <div id="patcells" className="my-2 flex flex-wrap gap-1.5" role="group">
        {Array.from({ length: PROJ7.NPAT }, (_, n) => {
          const used = ptPatUsed(PT.trk, n), play = n === tr.cur, p = PROJ7.patOf(P, PT.trk, n);
          const hits = p ? p.steps.reduce((a, _, k) => a + (ptHits(p, drum, k) ? 1 : 0), 0) : 0;
          return (
            <button key={n} type="button" aria-pressed={n === PT.pat} onClick={() => { PT.pat = n; notify(); }}
              className={`grid min-w-[92px] gap-0.5 border px-2 py-1.5 text-left aria-pressed:bg-s3! ${!used ? "text-dim" : ""}
                ${play ? "border-trk shadow-[inset_0_0_0_1px_var(--trk)]" : "border-line"}`}>
              <span className="text-[18px]">{"P" + (n + 1)}</span>
              <span className="dim">{play ? t("patPlaying") : used ? t("patSteps").replace("{n}", hits) : t("empty")}</span>
              <span className="dim">{"LEN " + PROJ7.lenOf(P, PT.trk, n, ctx)}</span>
            </button>
          );
        })}
      </div>
      {/* what to do with the pattern picked */}
      <p className="bar" id="patacts">
        <button type="button" disabled={sel === tr.cur} onClick={() => ptEdit(() => PROJ7.play(P, PT.trk, sel, ctx))}>{t("patPlay").replace("{n}", sel + 1)}</button>
        <span>{" " + t("patCopyTo") + " "}</span>
        <select key={`${PT.trk}:${sel}`} ref={toRef} aria-label={t("patCopyTo")}>
          {Array.from({ length: 8 }, (_, n) => n).filter((n) => n !== sel)
            .map((n) => <option key={n} value={n}>{"P" + (n + 1) + (ptPatUsed(PT.trk, n) ? " ●" : "")}</option>)}
        </select>
        <button type="button" disabled={!selUsed} onClick={() => {
          const n = +toRef.current.value;
          if (ptPatUsed(PT.trk, n) && !confirm(t("patReplace").replace("{n}", n + 1))) return;
          ptEdit(() => PROJ7.setPat(P, PT.trk, n, PROJ7.patOf(P, PT.trk, sel), PROJ7.lenOf(P, PT.trk, sel, ctx), ctx));
        }}>{t("patCopy")}</button>
        <button type="button" disabled={!selUsed} onClick={() => {
          if (!confirm(t("patClearAsk").replace("{n}", sel + 1))) return;
          ptEdit(() => PROJ7.setPat(P, PT.trk, sel, null, 0, ctx));
        }}>{t("patClear")}</button>
        {drum ? null : (
          <>
            <span>{" " + t("patFollow") + " "}</span>
            <Sel v={tr.hfol | 0} onPick={(v) => ptEdit(() => { tr.hfol = v; tr.tail = 2; })}>
              {PROJ7.HFOL.map((h, k) => <option key={k} value={k}>{h}</option>)}
            </Sel>
          </>
        )}
      </p>
      <p className="bar"><span>{t("patChain")}</span>{" "}
        <span id="patchain">
          {tr.chain.length ? tr.chain.map((x, k) => {
            const pat = PROJ7.slotPat(x), rep = PROJ7.slotRep(x);
            return (
              <span key={k} className={`mr-1 mb-1 inline-flex items-center gap-0.5 border py-0 pr-0.5 pl-1.5 ${pat === tr.cur ? "border-trk" : "border-line"}`}>
                {"P" + (pat + 1) + " "}
                <Sel v={rep} aria-label={t("patRepeat")} className="px-0.5! py-0!" onPick={(r) => setSlot(k, PROJ7.slot(pat, r))}>
                  {Array.from({ length: 16 }, (_, r) => <option key={r} value={r + 1}>{"×" + (r + 1)}</option>)}
                </Sel>
                <button type="button" title={t("songDel")} aria-label={t("songDel")}
                  onClick={() => ptEdit(() => { const c = tr.chain.slice(); c.splice(k, 1); PROJ7.setChain(P, PT.trk, c); })}>×</button>
              </span>
            );
          }) : <span className="dim">{t("patNoChain")}</span>}
        </span>
      </p>
      <p className="bar" id="patchainadd">
        {Array.from({ length: 8 }, (_, n) => (
          <button key={n} type="button" disabled={tr.chain.length >= PROJ7.NCHAIN}
            onClick={() => ptEdit(() => { const c = tr.chain.slice(); c.push(PROJ7.slot(n)); PROJ7.setChain(P, PT.trk, c); })}>{"+P" + (n + 1)}</button>
        ))}
        <button type="button" disabled={!tr.chain.length} onClick={() => ptEdit(() => PROJ7.setChain(P, PT.trk, []))}>{t("patChainClear")}</button>
        <label><input type="checkbox" checked={!tr.coff}
          onChange={(e) => ptEdit(() => { tr.coff = e.target.checked ? 0 : 1; if (tr.tail < 1) tr.tail = 1; })} />{" " + t("patChainPlay")}</label>
        <span className="dim">{tr.chain.length === 1 ? " " + t("patChainOne") : ""}</span>
      </p>
      <Help>{t("patChainHelp")}</Help>
    </Card>
  );
}

/* the scenes: a row each, its name and each track's pattern in it (- keep) */
function ScenesCard({ P }) {
  const S = P.scenes || PROJ7.scenesDefault();
  const edit = (f) => ptEdit(() => { if (!P.scenes) P.scenes = PROJ7.scenesDefault(); f(P.scenes); });
  return (
    <Card title={t("scnTitle")} ic="symbol_grid">
      <Help>{t("scnHelp")}</Help>
      <div className="max-w-full overflow-x-auto">
      <table id="scntab" className="[&_select]:px-0.5 [&_select]:py-0 [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-center [&_th]:px-1 [&_th]:py-0.5 [&_th]:text-center">
        <thead><tr><th>#</th><th>{t("scnName")}</th>
          {P.tracks.map((x) => <th key={x.i} style={{ color: tcol(x.i) }}>{String(x.i + 1)}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: PROJ7.NSCENE }, (_, k) => (
            <tr key={k}><td>{String(k + 1)}</td>
              <td><Sel v={S.names[k]} aria-label={t("scnName")} onPick={(v) => edit((Z) => { Z.names[k] = v; })}>
                {PROJ7.SCN_NAMES.map((n, j) => <option key={j} value={j}>{n}</option>)}</Sel></td>
              {P.tracks.map((x) => (
                <td key={x.i}><Sel v={S.pats[k][x.i]} aria-label={`${k + 1} / ${x.i + 1}`} onPick={(v) => edit((Z) => { Z.pats[k][x.i] = v; })}>
                  <option value={PROJ7.SCN_KEEP}>{t("scnKeep")}</option>
                  {Array.from({ length: 8 }, (_, n) => <option key={n} value={n}>{"P" + (n + 1)}</option>)}
                </Sel></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="bar"><button type="button" id="scnreset" disabled={!P.scenes || PROJ7.scenesIsDefault(P.scenes)}
        onClick={() => ptEdit(() => { P.scenes = null; })}>{t("scnReset")}</button></p>
    </Card>
  );
}

/* the pattern picked: its steps (a dot: a component), direction, seed, components */
function DetailCard({ P, tr, drum, ctx }) {
  const dev = A.dev;
  const p = PROJ7.patOf(P, PT.trk, PT.pat);
  const len = PROJ7.lenOf(P, PT.trk, PT.pat, ctx);
  const own = () => {                                   /* (an empty pattern: one made to hold what is added) */
    if (!PROJ7.patOf(P, PT.trk, PT.pat)) PROJ7.setPat(P, PT.trk, PT.pat, PROJ7.emptyPat(drum), len, ctx);
    let q = PROJ7.patOf(P, PT.trk, PT.pat);
    if (!q) { P.bank.push({ trk: PT.trk, pat: PT.pat, len, p: PROJ7.emptyPat(drum) }); q = PROJ7.patOf(P, PT.trk, PT.pat); }
    return q;
  };
  const tidy = () => { const q = PROJ7.patOf(P, PT.trk, PT.pat); if (q && PT.pat !== tr.cur && PROJ7.patIsEmpty(q, drum)) PROJ7.setPat(P, PT.trk, PT.pat, null, 0, ctx); };
  const pv = p || PROJ7.emptyPat(drum);
  /* the components: the firmware keeps 16 a pattern, one of a type a step, each value in its range (else drops it) */
  const pe0 = dev.info.pe0, params = [...Array(pe0 + 8).keys()].filter((id) => lockable(id, pe0));
  const seen = new Set();
  const types = PROJ7.CP.map((r, i) => (r ? <option key={i} value={i}>{r[0]}</option> : null)).filter(Boolean);
  return (
    <Card title={t("patDetail").replace("{t}", PT.trk + 1).replace("{n}", PT.pat + 1)}>
      <div id="patsteps" className="my-2 grid max-w-[720px] grid-cols-[repeat(16,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 64 }, (_, k) => {
          const on = ptHits(pv, drum, k), cp = pv.comps.some((c) => c.step === k);
          return (
            <button key={k} type="button" title={`${t("cpStep")} ${k + 1}`} onClick={() => { PT.step = k; notify(); }}
              className={`relative h-[26px] border p-0 text-[11px] ${k % 4 === 0 ? "border-line border-l-dim" : "border-line"} ${on ? "bg-[color-mix(in_srgb,var(--trk)_60%,var(--bg))]" : "bg-bg"}
                ${k >= len ? "opacity-35" : ""}
                ${cp ? "after:absolute after:top-0.5 after:right-0.5 after:size-[5px] after:bg-t3 after:content-['']" : ""}`}>{String(k + 1)}</button>
          );
        })}
      </div>
      <p className="bar" id="patdir">
        <span>{t("cpDir") + " "}</span>
        <span className="seg">
          {PROJ7.DIRS.map((d, k) => (
            <button key={k} type="button" aria-pressed={(pv.dir | 0) === k} onClick={() => ptEdit(() => { own().dir = k; tidy(); })}>{d}</button>
          ))}
        </span>
        <span>{" " + t("cpSeed") + " "}</span>
        <Num v={pv.seed | 0} min={0} max={255} aria-label={t("cpSeed")}
          onCommit={(v) => ptEdit(() => { own().seed = clampIn(v, 0, 255, 0); tidy(); })} />
      </p>
      <table id="patcomps" className={`${SONG_TABLE} [&_select]:max-w-[150px]`}>
        <thead><tr><th>{t("cpStep")}</th><th>{t("cpType")}</th><th>A</th><th>B</th><th>{t("cpWhat")}</th><th /></tr></thead>
        <tbody>
          {pv.comps.map((c, k) => {
            const R = PROJ7.CP[c.type] || ["?", 0, 0, 0, 0], dup = seen.has(c.step + ":" + c.type);
            seen.add(c.step + ":" + c.type);
            const set = (f) => ptEdit(() => { f(own().comps[k]); });
            const num = (v, lo, hi, f) => (
              <Num v={v} min={lo} max={hi} disabled={lo === hi} onCommit={(x) => set((y) => f(y, Math.max(lo, Math.min(hi, Math.round(x) || 0))))} />
            );
            const ok = PROJ7.compValid(c, pe0) && !dup;
            return (
              <tr key={k} className={ok ? "" : "[&_td]:text-red"}>
                <td>{num(c.step + 1, 1, 64, (x, v) => { x.step = v - 1; })}</td>
                <td><Sel v={c.type} onPick={(v) => set((x) => { const r = PROJ7.CP[v]; x.type = v;
                  x.a = x.type === PROJ7.CP_PARAM ? PROJ7.codeOf(r[5], pe0) : r[5]; x.b = r[6]; })}>{types}</Sel></td>
                <td>{c.type === PROJ7.CP_PARAM
                  ? <Sel v={PROJ7.idOf(c.a, pe0)} onPick={(v) => set((x) => { x.a = PROJ7.codeOf(v, pe0); })}>
                    {params.map((id) => <option key={id} value={id}>{ptParamName(id)}</option>)}</Sel>
                  : num(c.a, R[1], R[2], (x, v) => { x.a = c.type === 13 && !v ? 1 : v; })}</td>
                <td>{num(c.b, R[3], R[4], (x, v) => { x.b = v; })}</td>
                <td className="text-dim">{ok ? t("cpH" + c.type) : t(dup ? "cpDup" : "cpBad")}</td>
                <td className={ACTS}><button type="button" title={t("songDel")} onClick={() => ptEdit(() => { own().comps.splice(k, 1); tidy(); })}>✕</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="bar" id="patcadd">
        <button type="button" disabled={pv.comps.length >= PROJ7.NCOMP} onClick={() => ptEdit(() => {
          const ty = PT.addType, r = PROJ7.CP[ty];
          own().comps.push({ step: PT.step, type: ty, a: ty === PROJ7.CP_PARAM ? PROJ7.codeOf(r[5], pe0) : r[5], b: r[6] });
        })}>{t("cpAdd").replace("{s}", PT.step + 1)}</button>
        <Sel v={PT.addType || 10} aria-label={t("cpType")} onPick={(v) => { PT.addType = v; notify(); }}>{types}</Sel>
        <span className="dim">{" " + t("cpCount").replace("{n}", pv.comps.length).replace("{max}", PROJ7.NCOMP)}</span>
      </p>
      <Help>{t("cpHelp")}</Help>
    </Card>
  );
}

/* the song's chord progression: up to 8 chords, a degree of the key's scale (I..VII) for 1..16 bars */
function ChordsCard({ P }) {
  const h = P.harm || [{ deg: 0, bars: 4 }];
  const edit = (f) => ptEdit(() => { const x = (P.harm || [{ deg: 0, bars: 4 }]).map((c) => ({ ...c })); f(x); P.harm = x; });
  return (
    <Card title={t("chTitle")} ic="symbol_tuning">
      <Help>{t("chHelp")}</Help>
      <table className={SONG_TABLE}>
        <thead><tr><th>#</th><th>{t("chChord")}</th><th>{t("songBars")}</th><th /></tr></thead>
        <tbody id="chrows">
          {h.map((c, k) => (
            <tr key={k}><td className={TD_I}>{String(k + 1)}</td>
              <td><Sel v={c.deg % 7} onPick={(v) => edit((x) => { x[k].deg = v; })}>{PROJ7.ROMAN.map((r, i) => <option key={i} value={i}>{r}</option>)}</Sel></td>
              <td><Num v={c.bars} min={1} max={16} onCommit={(v) => edit((x) => { x[k].bars = clampIn(v, 1, 16, 1); })} /></td>
              <td className={ACTS}>
                <button type="button" title={t("songUp")} disabled={k === 0} onClick={() => edit((x) => { x.splice(k - 1, 0, x.splice(k, 1)[0]); })}>▲</button>
                <button type="button" title={t("songDown")} disabled={k === h.length - 1} onClick={() => edit((x) => { x.splice(k + 1, 0, x.splice(k, 1)[0]); })}>▼</button>
                <button type="button" title={t("songDel")} disabled={h.length < 2} onClick={() => edit((x) => { x.splice(k, 1); })}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bar">
        <button type="button" id="chadd" disabled={h.length >= PROJ7.NHPROG}
          onClick={() => ptEdit(() => { const x = (P.harm || [{ deg: 0, bars: 4 }]).map((c) => ({ ...c })); const l = x[x.length - 1]; x.push({ deg: (l.deg + 3) % 7, bars: l.bars }); P.harm = x; })}>{t("songAdd")}</button>{" "}
        <button type="button" id="chreset" onClick={() => ptEdit(() => { P.harm = null; })}>{t("chReset")}</button>
        <span className="dim">{t("chSum").replace("{n}", h.length).replace("{max}", PROJ7.NHPROG).replace("{bars}", h.reduce((a, c) => a + c.bars, 0))}</span>
      </p>
    </Card>
  );
}

export default function Patterns() {
  const { dev, busy } = useApp();
  useEffect(() => {                                    /* (BoopBox) the project, read once per connection (when free) */
    if (!dev || !dev.dump || PT.dev === dev || busy) return;
    Object.assign(PT, { dev, P: null, err: "", dirty: false, trk: dev.sel || 0, pat: undefined, step: 0 });
    op(readPatterns);
  });
  if (!dev || !dev.dump) return null;
  let head = "", fits = true, body = null;
  if (PT.P) {
    const P = PT.P, ctx = ptCtx(), tr = PROJ7.track(P, PT.trk), drum = tr.kind === PROJ7.DRUM;
    const bank = PROJ7.bankBytes(P), size = PROJ7.HDR + PROJ7.encodeBody(P).length;
    fits = bank <= PROJ7.PB_SIZE && size <= PROJ7.MAX;
    head = t("patSize").replace("{b}", bank).replace("{bm}", PROJ7.PB_SIZE).replace("{p}", size).replace("{pm}", PROJ7.MAX)
      + (PT.dirty ? " · " + t("patUnsent") : "");
    if (PT.pat === undefined) PT.pat = tr.cur;
    body = (
      <div id="patbody">
        <PatternsCard P={P} tr={tr} drum={drum} ctx={ctx} />
        <ScenesCard P={P} />
        <DetailCard P={P} tr={tr} drum={drum} ctx={ctx} />
        <ChordsCard P={P} />
      </div>
    );
  }
  /* the accent: the track picked here (the old page set it for the whole document) */
  return (
    <div style={PT.P ? { "--trk": tcol(PT.trk) } : undefined}>
      <Card title={t("patTitle")} ic="symbol_folder">
        <Help>{t("patHelp")}</Help>
        {PT.err ? <p className="bad" id="paterr">{t(PT.err)}</p> : null}
        <p className="bar">
          <button type="button" id="patread" onClick={() => { if (PT.dirty && !confirm(t("patDiscard"))) return; op(readPatterns); }}>
            <Ic ic="control_arrow_loop">{t("patRead")}</Ic></button>
          <button type="button" id="patsend" className={PT.dirty ? "pri" : ""} disabled={!PT.P || !fits} onClick={() => op(sendPatterns)}>
            <Ic ic="symbol_upload">{t("patSend")}</Ic></button>
          <span id="patsize" className={fits ? "dim" : "bad"}>{head}</span>
        </p>
      </Card>
      {body}
    </div>
  );
}
