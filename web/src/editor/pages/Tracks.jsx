// SPDX-License-Identifier: GPL-3.0-only
// The Tracks page: the mixer, a strip per track (the device's TRACKS screen): level, mute, pan, the sound it plays.
import { useEffect, useRef } from "react";
import { F, fmtValue, mixer } from "../lib/proto.js";
import { A, P, drumLvGlobal, gDrLvl, hasTracks, isDrumTrk, notify, pMute, pPan, report, rq, sleep, t, tcol, useApp } from "../core/app.js";
import { selectTrack, userSet } from "../core/device.js";
import { H } from "../core/hooks.js";
import { Card, Help, Icon, Ic, barVars } from "../ui/kit.jsx";
import "./tracks/tracks.css";

/* ---------------------------------------------------------- mixer (v3) --- */
/* dev.mix = TRACK reply + pan per track ({sel, ntrk, tracks: [{engine, preset, level, mute, armed, pan}]}).
   Read on connect, after every RELOAD / sound change, with the slow safety DUMP and when the tab opens.
   The selected track's level / pan / mute are also Sound parameters: both views follow each other. */
let mixDrag = null;                 /* "lv:i" / "pan:i" while a strip control is dragged */
const mixEdit = new Map();          /* "lv:i" / "pan:i" -> time of the user's last change */
let panning = false;                /* v3 firmware: another track is selected for a moment (pan of a track that is not selected) */
const panWant = new Map();
const mixTouched = (kind, i) => {
  const dev = A.dev;
  return mixDrag === `${kind}:${i}` || performance.now() - (mixEdit.get(`${kind}:${i}`) || 0) < 600
    || (!!dev && kind === "lv" && dev.link.hasQueued("mix:" + i))
    || (kind === "pan" && (panWant.has(i) || (!!dev && dev.link.hasQueued("pan:" + i))));
};
const drumTrack = (i) => !!A.dev && !!A.dev.mix && isDrumTrk(i);
const drumLv = (i) => drumTrack(i) && drumLvGlobal();   /* its level is G_DRLVL (four-track firmware) */
function trackName(x) {
  const dev = A.dev;
  if (x.engine >= dev.info.nengines) return ["DRUMS", (dev.kitNames || [])[x.e0]].filter(Boolean).join(" ");
  return [dev.info.engines[x.engine], (dev.names[x.engine] || [])[x.preset]].filter(Boolean).join(" ");
}

async function readMixer() {
  const d = A.dev;
  if (!d || !hasTracks()) return;
  const m = await mixer.read(rq, d.info, { pan: pPan() });
  if (d !== A.dev) return;
  if (d.mix) m.tracks.forEach((x, i) => {           /* what the user is moving stays */
    const o = d.mix.tracks[i];
    if (!o) return;
    if (mixTouched("lv", i)) { x.level = o.level; x.mute = o.mute; }
    if (mixTouched("pan", i)) x.pan = o.pan;
  });
  d.mix = m;
  if (m.sel !== d.sel && !panning) { d.sel = m.sel; A.needReload = true; }   /* selected on the device, push missed */
  notify();
}

/* the Sound view's values of the selected track (and the drum level, a global) -> the strips */
function mixFromDump() {
  const dev = A.dev;
  if (!dev || !dev.mix || !dev.dump || panning) return;
  const m = dev.mix, ds = drumLvGlobal() ? m.ntrk - 1 : -1, x = m.tracks[dev.sel];
  if (ds >= 0 && !mixTouched("lv", ds)) m.tracks[ds].level = dev.dump.g[gDrLvl()];
  if (x) {
    if (!mixTouched("lv", dev.sel)) {
      if (dev.sel !== ds) x.level = dev.dump.p[P.LEVEL];
      x.mute = dev.dump.p[pMute()] ? 1 : 0;
    }
    if (!mixTouched("pan", dev.sel)) x.pan = dev.dump.p[pPan()];
  }
  notify();
}
/* a strip's values -> the Sound view (selected track; the drum level always) */
function mixToSound(i) {
  const dev = A.dev, x = dev.mix.tracks[i];
  const put = (s, id, v) => { if (v == null) return; (s ? dev.dump.g : dev.dump.p)[id] = v; };
  if (drumLv(i)) put(1, gDrLvl(), x.level);
  if (i === dev.sel) {
    if (!drumLv(i)) put(0, P.LEVEL, x.level);
    put(0, pMute(), x.mute ? 1 : 0);
    put(0, pPan(), x.pan);
  }
  notify();
}

/* level and mute: TRACK_MIX, one in flight per track and one queued with the latest values (as SET) */
function setLevel(i, v) {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].level = v;
  mixEdit.set("lv:" + i, performance.now());
  mixToSound(i);
  sendMix(i);
}
function setMute(i, on) {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].mute = on ? 1 : 0;
  mixEdit.set("lv:" + i, performance.now());
  mixToSound(i);
  sendMix(i);
}
async function sendMix(i) {
  const d = A.dev, x = d.mix.tracks[i];
  try {
    const r = await mixer.setMix(rq, i, x.level, x.mute, { key: "mix:" + i });
    if (d !== A.dev || !d.mix || mixDrag === "lv:" + i || d.link.hasQueued("mix:" + i)) return;
    const y = d.mix.tracks[i];                      /* the device's values after clamping */
    y.level = r.level; y.mute = r.mute;
    mixToSound(i);
  } catch (e) { report(e); }
}
/* pan: the selected track as any Sound parameter; another track with TRACK_PARAM (v4: while dragging, one in
   flight and one queued with the latest value), or with v3 firmware on release (it is selected for a moment) */
function setPan(i, v, final) {
  const dev = A.dev;
  if (!dev || !dev.mix) return;
  dev.mix.tracks[i].pan = v;
  mixEdit.set("pan:" + i, performance.now());
  notify();
  if (i === dev.sel) { userSet(0, pPan(), v, final); return; }
  if (dev.v4) panTrack(i, v);
  else if (final) panOther(i, v);
}
async function panTrack(i, v) {
  const d = A.dev;
  try {
    const r = await mixer.setPan(rq, i, d.sel, pPan(), v, true);
    if (d !== A.dev || !d.mix || mixDrag === "pan:" + i || d.link.hasQueued("pan:" + i)) return;
    d.mix.tracks[i].pan = r;                        /* the device's value after clamping */
    if (i === d.sel) mixToSound(i); else notify();
  } catch (e) { report(e); }
}
async function panOther(i, v) {
  panWant.set(i, v);
  if (panOther.run) return;
  panOther.run = true;
  const d = A.dev;
  try {
    while (A.busy && d === A.dev) await sleep(20);  /* not in the middle of another multi-request operation */
    A.busy++;
    panning = true;
    try {
      while (panWant.size && d === A.dev) {
        const [tr, val] = panWant.entries().next().value;
        panWant.delete(tr);
        const r = await mixer.setPan(rq, tr, d.sel, pPan(), val);
        if (d.mix && !panWant.has(tr)) { d.mix.tracks[tr].pan = r; notify(); }
      }
    } finally { panning = false; A.busy--; notify(); }
  } catch (e) { report(e); } finally { panOther.run = false; panWant.clear(); }
}

export function init() {
  Object.assign(H, {
    readMixer,
    mixFromDump,
    mixTouched,
    updateStrip: () => notify(),
    panning: () => panning,
  });
  if (typeof window !== "undefined") {
    window.addEventListener("pointerup", () => { mixDrag = null; });
    window.addEventListener("pointercancel", () => { mixDrag = null; });
  }
}

/* a slider whose "input" moves it and whose "change" (release, a key) ends the move, as the native events */
function Range({ onMove, onEnd, onDown, onDbl, ...rest }) {
  const ref = useRef(null);
  const cb = useRef({});
  cb.current = { onEnd };
  useEffect(() => {
    const el = ref.current;
    const f = () => cb.current.onEnd(+el.value);
    el.addEventListener("change", f);
    return () => el.removeEventListener("change", f);
  }, []);
  return <input ref={ref} type="range" step="1" onPointerDown={onDown} onChange={(e) => onMove(+e.target.value)} onDoubleClick={onDbl} {...rest} />;
}

function Strip({ i }) {
  const dev = A.dev, x = dev.mix.tracks[i];
  const lvDesc = (drumLv(i) ? dev.gdesc[gDrLvl()] : dev.pdesc[P.LEVEL]) || { fmt: F.INT, min: 0, max: 127, def: 100 };
  const pDesc = dev.pdesc[pPan()] || { fmt: F.BIPCT, min: -64, max: 63, def: 0 };
  const sel = i === dev.sel, nm = trackName(x), muted = !!x.mute || !x.level;
  const [lt, lu] = fmtValue(lvDesc, x.level);
  const [pt, pu] = x.pan != null ? fmtValue(pDesc, x.pan) : ["", ""];
  const solo = !!((dev.mix.solo >> i) & 1);         /* v5: soloed on the device (GLO + key) */
  return (
    <div role="group" aria-label={`${t("track")} ${i + 1}`} style={{ "--c": tcol(i) }}
      className={`flex min-w-0 flex-col items-center gap-2 border bg-bg px-2.5 py-3 ${sel ? "border-c" : "border-line"}`}>
      <button type="button" className={`tog size-12 p-0 text-big ${sel ? "bg-c! text-black!" : "bg-s2! text-c!"}`} aria-pressed={sel}
        title={t("selectTrack")} onClick={() => selectTrack(i)}>{String(i + 1)}</button>
      <div className="min-h-10 w-full text-center [overflow-wrap:anywhere] text-fg" title={nm}>{nm}</div>
      <span className={`lowercase ${x.armed ? "bg-red px-1.5 text-black" : "text-s3 [&_.ic]:invisible"}`} title={t("rec")}>
        <Icon name="control_rec_f" />{t("rec")}</span>
      <span className={`lowercase ${solo ? "visible bg-fg px-1.5 text-black" : "invisible text-s3"}`}>{t("solo")}</span>
      <Range className={`fader ${muted ? "opacity-35" : ""}`} min={0} max={127} value={x.level} aria-label={`${t("level")} ${i + 1}`}
        style={{ "--p": ((x.level / 127) * 100).toFixed(1) + "%" }}
        onDown={() => { mixDrag = "lv:" + i; }} onMove={(v) => setLevel(i, v)} onEnd={(v) => setLevel(i, v)}
        onDbl={() => setLevel(i, Math.max(0, Math.min(127, lvDesc.def)))} />
      <span className={`whitespace-nowrap text-big text-fg ${muted ? "opacity-35" : ""}`}>{lu ? `${lt} ${lu}` : lt}</span>
      <button type="button" className="tog w-full aria-pressed:bg-c! aria-pressed:text-black!" aria-pressed={!!x.mute}
        onClick={() => setMute(i, !A.dev.mix.tracks[i].mute)}><Ic ic="control_speaker_mute">{t("mute")}</Ic></button>
      <span className="whitespace-nowrap text-dim"><Ic ic="symbol_pan">{t("pan")}</Ic></span>
      <Range className="w-full" min={pDesc.min} max={pDesc.max} value={x.pan ?? pDesc.def} disabled={x.pan == null} aria-label={`${t("pan")} ${i + 1}`}
        style={x.pan != null ? barVars(pDesc, x.pan) : undefined}
        onDown={() => { mixDrag = "pan:" + i; }} onMove={(v) => setPan(i, v, false)} onEnd={(v) => setPan(i, v, true)}
        onDbl={() => setPan(i, pDesc.def, true)} />
      <span className="whitespace-nowrap">{pu ? `${pt} ${pu}` : pt}</span>
      <button type="button" className="w-full disabled:bg-transparent! disabled:text-c!" disabled={sel} onClick={() => selectTrack(i)}>
        {t(sel ? "selectedTrack" : "selectTrack")}</button>
    </div>
  );
}

export default function Tracks() {
  const { dev } = useApp();
  if (!dev) return null;
  return (
    <Card title={t("mixer")} ic="ui_slider_vertical">
      <div id="mixer" className="mt-1 mb-3 grid grid-cols-2 gap-3 wide:grid-cols-[repeat(4,minmax(0,170px))]">
        {dev.mix ? dev.mix.tracks.map((_, i) => <Strip key={i} i={i} />) : null}
      </div>
      <Help>{t("mixHelp")}</Help>
    </Card>
  );
}
