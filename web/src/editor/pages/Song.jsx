// SPDX-License-Identifier: GPL-3.0-only
// The Song page: the order of the sections A..D (the device's SONG screen), its loop and region; a song as one file.
import { useEffect } from "react";
import { ARR, CMD, crc32, parse, req } from "../lib/proto.js";
import { A, notify, op, rq, sayK, t, useApp } from "../core/app.js";
import { SG, songExport } from "../core/shared.js";
import { Card, Help, Ic } from "../ui/kit.jsx";
import { songFileLoad } from "./projects/files.js";
import { ACTS, Num, SONG_TABLE, TD_I } from "./song/Num.jsx";

/* ---- SLOOP 2.5: the Song page: the order of the sections A..D (the device's SONG screen, from the browser) ---- */
async function readSong() {
  const dev = A.dev;
  if (!dev || !(dev.info.proto >= 6)) { Object.assign(SG, { rows: null, err: "songOld" }); notify(); return; }
  const L = parse[CMD.BK_LIST](await rq(req.bkList(), { timeout: 5000, retries: 0 }));
  const it = L.rc ? null : L.items.find((x) => x.id === 1);
  if (!it) throw new Error("the settings are not readable (rc " + L.rc + ")");
  const data = new Uint8Array(it.len);
  for (let off = 0; off < it.len; off += 256) {
    const n = Math.min(256, it.len - off);
    const g = parse[CMD.BK_GET](await rq(req.bkGet(1, off, n), { timeout: 1500, retries: 2 }));
    if (g.rc || g.data.length !== n) throw new Error(`settings: GET rc ${g.rc}`);
    data.set(g.data, off);
  }
  if (!ARR.ok(data)) { Object.assign(SG, { rows: null, err: "songOld" }); notify(); return; }
  const song = ARR.decode(data);
  Object.assign(SG, { bytes: data, rows: ARR.group(song.entries), loop: song.loop, region: song.region, err: "", dirty: false });
  notify();
}
async function sendSong() {
  if (!A.dev || !SG.rows) return;
  const song = { loop: SG.loop, entries: ARR.expand(SG.rows), region: SG.region };
  if (!ARR.valid(song)) { sayK("songBad"); return; }
  const d = ARR.encode(SG.bytes, song);
  let r = parse[CMD.BK_PUT](await rq(req.bkBegin(1, d.length, crc32(d)), { timeout: 1500, retries: 1 }));
  if (r.rc) throw new Error(`song: begin rc ${r.rc}`);
  for (let off = 0; off < d.length; off += 256) {
    r = parse[CMD.BK_PUT](await rq(req.bkData(1, off, d.subarray(off, off + 256)), { timeout: 1500, retries: 1 }));
    if (r.rc) throw new Error(`song: data rc ${r.rc}`);
  }
  r = parse[CMD.BK_PUT](await rq(req.bkCommit(1), { timeout: 5000, retries: 0 }));
  if (r.rc === 3) { sayK("songRefused"); return; }          /* (project.c settings_restore: the song is playing) */
  if (r.rc) throw new Error(`song: commit rc ${r.rc}`);
  await readSong();
  sayK("songSent");
}
const songCount = () => (SG.rows || []).reduce((a, r) => a + Math.max(1, r.times | 0), 0);
function songEdit(fn) { fn(); SG.dirty = true; notify(); }
const clamp1 = (v, max) => Math.max(1, Math.min(max, Math.round(v) || 1));

function SongBody() {
  const dev = A.dev;
  const LET = "ABCD", n = songCount(), bars = SG.rows.reduce((a, r) => a + r.bars * Math.max(1, r.times | 0), 0);
  /* (BoopBox) the loop region, in entries (a row played n times is n entries) */
  if (SG.region && !ARR.regionOk(SG.region, n)) SG.region = null;
  const entries = (from) => Array.from({ length: n }, (_, k) => <option key={k} value={k} disabled={k < from}>{String(k + 1)}</option>);
  return (
    <div id="songbody">
      <table className={SONG_TABLE}>
        <thead><tr><th>#</th><th>{t("songSection")}</th><th>{t("songBars")}</th><th>{t("songTimes")}</th><th /></tr></thead>
        <tbody id="songrows">
          {SG.rows.map((r, k) => {
            const empty = dev.slotUsed[r.scene] === false;
            return (
              <tr key={k} className={empty ? "[&_td]:text-red" : ""}>
                <td className={TD_I}>{String(k + 1)}</td>
                <td><select value={String(r.scene)} onChange={(e) => songEdit(() => { r.scene = +e.target.value; })}>
                  {[0, 1, 2, 3].map((s) => <option key={s} value={s}>{LET[s] + (dev.slotUsed[s] === false ? ` (${t("empty")})` : "")}</option>)}
                </select></td>
                <td><Num v={r.bars} min={1} max={ARR.MAX_BARS} onCommit={(v) => songEdit(() => { r.bars = clamp1(v, ARR.MAX_BARS); })} /></td>
                <td><Num v={r.times} min={1} max={ARR.STEPS} onCommit={(v) => songEdit(() => { r.times = clamp1(v, ARR.STEPS); })} /></td>
                <td className={ACTS}>
                  <button type="button" title={t("songUp")} disabled={k === 0} onClick={() => songEdit(() => { SG.rows.splice(k - 1, 0, SG.rows.splice(k, 1)[0]); })}>▲</button>
                  <button type="button" title={t("songDown")} disabled={k === SG.rows.length - 1} onClick={() => songEdit(() => { SG.rows.splice(k + 1, 0, SG.rows.splice(k, 1)[0]); })}>▼</button>
                  <button type="button" title={t("songDel")} disabled={SG.rows.length < 2} onClick={() => songEdit(() => { SG.rows.splice(k, 1); })}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {SG.rows.some((r) => dev.slotUsed[r.scene] === false) ? <p className="bad" id="songempty">{t("songEmpty")}</p> : null}
      <p className="bar">
        <button type="button" id="songadd" disabled={n >= ARR.STEPS} onClick={() => songEdit(() => {
          const last = SG.rows[SG.rows.length - 1];
          SG.rows.push({ scene: last ? (last.scene + 1) % 4 : 0, bars: last ? last.bars : 4, times: 1 });
        })}>{t("songAdd")}</button>{" "}
        <span id="songsum" className={n > ARR.STEPS ? "bad" : "dim"}>{t("songSum").replace("{n}", n).replace("{max}", ARR.STEPS).replace("{bars}", bars)}</span>
      </p>
      <p className="bar"><span>{t("songLoop")}</span>{" "}
        <span className="seg" id="songloop">
          <button type="button" aria-pressed={!SG.loop} onClick={() => songEdit(() => { SG.loop = false; })}>{t("songLoopOff")}</button>
          <button type="button" aria-pressed={SG.loop} onClick={() => songEdit(() => { SG.loop = true; })}>{t("songLoopOn")}</button>
        </span>
      </p>
      <p className="bar"><span>{t("songRegion")}</span>{" "}
        <select id="songrf" aria-label="from" value={String(SG.region ? SG.region.first : -1)} onChange={(e) => songEdit(() => {
          const f = +e.target.value;
          SG.region = f < 0 ? null : { first: f, end: Math.max(f + 1, SG.region ? SG.region.end : n) };
          if (SG.region && SG.region.end > n) SG.region.end = n;
        })}>
          <option value={-1}>{t("songRegionAll")}</option>
          {entries(0)}
        </select> – <select id="songre" aria-label="to" disabled={!SG.region} value={String(SG.region ? SG.region.end - 1 : Math.max(0, n - 1))}
          onChange={(e) => songEdit(() => { if (SG.region) SG.region.end = Math.max(SG.region.first + 1, +e.target.value + 1); })}>
          {entries(SG.region ? SG.region.first : 0)}
        </select>{" "}
        <span className="dim" id="songrhint">{SG.region ? t(SG.loop ? "songRegionOn" : "songRegionOff") : ""}</span>
      </p>
      <p className="bar">
        <button type="button" id="songread" onClick={() => op(readSong)}><Ic ic="control_arrow_loop">{t("songRead")}</Ic></button>
        <button type="button" id="songsend" className={SG.dirty ? "pri" : ""} disabled={n > ARR.STEPS || !n} onClick={() => op(sendSong)}>
          <Ic ic="symbol_upload">{t("songSend")}</Ic></button>
      </p>
      <p className="bar">
        <button type="button" id="songexp" onClick={() => { if (A.dev) songExport(); }}><Ic ic="symbol_download">{t("sfSave")}</Ic></button>
        <button type="button" id="songimp" onClick={songFileLoad}><Ic ic="symbol_upload">{t("sfLoad")}</Ic></button>
      </p>
    </div>
  );
}

export default function Song() {
  const { dev, busy } = useApp();
  useEffect(() => {                                    /* (2.5) read the song order once per connection (when free) */
    if (!dev || !dev.dump || SG.dev === dev || busy) return;
    Object.assign(SG, { dev, rows: null, err: "", dirty: false });
    op(readSong);
  });
  if (!dev || !dev.dump) return null;
  return (
    <Card title={t("songTitle")} ic="control_arrow_loop">
      <Help>{t("songHelp")}</Help>
      {SG.err ? <p className="bad" id="songerr">{t(SG.err)}</p> : null}
      {SG.rows ? <SongBody /> : null}
    </Card>
  );
}
