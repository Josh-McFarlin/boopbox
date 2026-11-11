// SPDX-License-Identifier: GPL-3.0-only
/* ---- (2.7) the playlist: song files (Save & load → Export this song), loaded one after the other. A song loads
   with the FM-1 stopped (a few seconds of flash), then plays if "play when loaded" is on. The list is kept in this
   browser (IndexedDB), and saved / opened as one file to take to a gig */
import { LIVE, LVX, songObjects } from "../../lib/proto.js";
import { A, download, notify, pickFile, sayK, sleep, t, today, useApp } from "../../core/app.js";
import { bkReport, songLoadUI, store } from "../../core/shared.js";
import { LV, lvAllOff, lvGlobal, lvOk, lvReadTracks, lvSend } from "./state.js";
import { LVS, lvxSave } from "./pro.js";
import { LvCard } from "./Guide.jsx";

const PLF = { FORMAT: "sloop-playlist", VERSION: 1 };
async function plStore() {
  try { await store.setMeta("playlist", { songs: LV.pl.songs, cur: LV.pl.cur, auto: LV.pl.auto }); } catch (e) { console.warn(e); }
}
export async function plRestore() {
  try {
    const v = await store.getMeta("playlist");
    if (v && Array.isArray(v.songs)) Object.assign(LV.pl, { songs: v.songs.filter((f) => { try { songObjects(f); return true; } catch (e) { return false; } }),
      cur: v.cur ?? -1, auto: v.auto !== false });
  } catch (e) { /* no storage: the list lives in this page only */ }
  notify();
}
async function plAddFiles(files) {
  let bad = 0;
  for (const f of files) {
    try {
      const obj = JSON.parse(await f.text());
      if (obj && obj.format === PLF.FORMAT && Array.isArray(obj.songs)) {
        for (const x of obj.songs) { songObjects(x); LV.pl.songs.push(x); }
        if (Array.isArray(obj.scenes) && obj.scenes.some(Boolean) && confirm(t("lvxSetScenes"))) {   /* LIVE pro: the set's scenes */
          obj.scenes.slice(0, LVX.NSCENE).forEach((x, k) => { LVS.scenes[k] = x && x.v === 1 ? x : null; });
          LVS.names = Array.isArray(obj.sceneNames) ? obj.sceneNames.slice(0, LVX.NSCENE) : [];
          if (obj.midiMap && typeof obj.midiMap === "object") LVS.map = obj.midiMap;
          lvxSave();
        }
      } else {
        songObjects(obj);
        if (!obj.name) obj.name = f.name.replace(/\.(sloopsong|json)$/i, "");
        LV.pl.songs.push(obj);
      }
    } catch (e) { bad++; }
  }
  if (bad) sayK("songBadFile", ` (${bad})`);
  plStore();
  notify();
}
async function lvSongGo(i) {
  const pl = LV.pl, f = pl.songs[i];
  if (!f || pl.loading || !A.dev || !A.dev.dump) return;
  pl.loading = true;
  pl.at = i;
  pl.pct = 0;
  notify();
  try {
    if (LV.s && LV.s.playing) { await lvSend(LIVE.PLAY, 0); await sleep(150); }
    lvAllOff();
    A.busy++;                                       /* (the editor's own polling waits) */
    try { await songLoadUI(f, (d, n) => { pl.pct = Math.round(100 * d / n); notify(); }); }
    finally { A.busy--; }
    pl.cur = i;
    LV.stale = true;
    plStore();
    await lvReadTracks(true);
    if (f.live && f.live.bpm) lvGlobal(LVX.BPM, f.live.bpm, true);   /* (LIVE pro: the setlist's tempo for this song) */
    sayK("sfLoaded", f.name || "");
    if (pl.auto && lvOk()) await lvSend(LIVE.PLAY, 1);
  } catch (e) { bkReport(e); }
  finally { pl.loading = false; pl.at = -1; notify(); }
}
export const lvSongNext = () => { const n = LV.pl.songs.length; if (n) lvSongGo(LV.pl.cur + 1 < n ? LV.pl.cur + 1 : 0); };
/* LIVE pro: a song's tempo (set when it loads) and its cue (a note for the stage), kept in the setlist */
function lvxSongEdit(i) {
  const f = LV.pl.songs[i];
  if (!f) return;
  const bpm = prompt(t("lvxSongBpm"), f.live && f.live.bpm ? String(f.live.bpm) : "");
  if (bpm == null) return;
  const note = prompt(t("lvxSongNote"), f.live && f.live.note ? f.live.note : "");
  if (note == null) return;
  const b = Math.round(+bpm);
  f.live = { bpm: b >= 40 && b <= 240 ? b : null, note: note.trim().slice(0, 120) };
  plStore();
  notify();
}

export default function Playlist() {
  useApp();
  const pl = LV.pl;
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= pl.songs.length || pl.loading) return;
    [pl.songs[i], pl.songs[j]] = [pl.songs[j], pl.songs[i]];
    if (pl.cur === i) pl.cur = j; else if (pl.cur === j) pl.cur = i;
    plStore(); notify();
  };
  /* the cue: the song playing and its note, then the next one */
  const cur = pl.songs[pl.cur], nx = pl.songs.length ? pl.songs[pl.cur + 1 < pl.songs.length ? pl.cur + 1 : 0] : null;
  return (
    <LvCard k="playlist" className="lvplbox lvadv"
      head={<div className="lvhead"><h2>{t("plTitle")}</h2>
        <button type="button" className="pri" data-lvm="pl:next" disabled={!pl.songs.length || pl.loading} onClick={lvSongNext}>{t("plNext")} ▶</button></div>}>
      {cur || nx ? (
        <div className="lvcue">
          {cur ? <p><b>{cur.name || "SONG"}</b><span>{cur.live && cur.live.note ? " — " + cur.live.note : ""}</span></p> : null}
          {nx && nx !== cur ? <p className="dim"><span>{t("lvxNext") + " "}</span><b>{nx.name || "SONG"}</b>
            <span>{nx.live && nx.live.note ? " — " + nx.live.note : ""}</span></p> : null}
        </div>
      ) : null}
      <ol className="lvpl">
        {pl.songs.map((f, i) => {
          const isCur = i === pl.cur, at = pl.loading && pl.at === i;
          const secs = (f.objects || []).filter((o) => o.id >= 2).map((o) => "ABCD"[o.id - 2]).join("");
          return (
            <li key={i} className={(isCur ? "cur" : "") + (at ? " at" : "")}>
              <button type="button" className="lvplgo" disabled={pl.loading} onClick={() => lvSongGo(i)} title={t("plLoad")}>
                <b>{f.name || "SONG"}</b><small>{at ? `${t("sfLoading")}${pl.pct} %` : secs + (f.live && f.live.bpm ? ` · ${f.live.bpm}` : "")}</small>
              </button>
              <span className="lvplact">
                <button type="button" title={t("lvxSongEdit")} aria-label={t("lvxSongEdit")} disabled={pl.loading} onClick={() => lvxSongEdit(i)}>✎</button>
                <button type="button" title={t("plUp")} aria-label={t("plUp")} disabled={!i || pl.loading} onClick={() => move(i, -1)}>▲</button>
                <button type="button" title={t("plDown")} aria-label={t("plDown")} disabled={i === pl.songs.length - 1 || pl.loading} onClick={() => move(i, 1)}>▼</button>
                <button type="button" title={t("plRemove")} aria-label={t("plRemove")} disabled={pl.loading}
                  onClick={() => { pl.songs.splice(i, 1); if (pl.cur === i) pl.cur = -1; else if (pl.cur > i) pl.cur--; plStore(); notify(); }}>✕</button>
              </span>
            </li>
          );
        })}
      </ol>
      {pl.songs.length ? null : <p className="dim lvhint">{t("plEmpty")}</p>}
      <p className="bar lvplbar">
        <button type="button" onClick={async () => { const fs = await pickFile(".sloopsong,.sloopset,.json,application/json", true); if (fs && fs.length) plAddFiles(fs); }}>{t("plAdd")}</button>
        <button type="button" onClick={() => download(`boopbox-playlist-${today()}.sloopset`,
          { format: PLF.FORMAT, version: PLF.VERSION, songs: LV.pl.songs, scenes: LVS.scenes, sceneNames: LVS.names, midiMap: LVS.map })}>{t("plSave")}</button>
        <button type="button" className="tog" aria-pressed={pl.auto} onClick={() => { LV.pl.auto = !LV.pl.auto; plStore(); notify(); }}>{t("plAuto")}</button>
      </p>
    </LvCard>
  );
}
