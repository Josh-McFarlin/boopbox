// SPDX-License-Identifier: GPL-3.0-only
// What several pages share: the browser's storage for the library (IndexedDB), flash results, the backup / song file
// progress, a song as one file (the Save & load page and the LIVE page's playlist), the Song page's state.
import { CMD, parse, req, songCapture, songLoad } from "../lib/proto.js";
import { TEXT } from "../lib/text.js";
import { A, download, fileSlug, notify, op, report, rq, sayK, selfLoad, t, today } from "./app.js";

/* ------------------------------------------------------------ the library's storage --- */
/* Patches live in IndexedDB "felucca-editor": store "patches" (by id), store "meta" ("layout": the parameter keys /
   engine names the stored values are in). Without IndexedDB (some private windows) the library is kept in memory only.
   Other pages keep their own things in "meta" too (LIVE: the playlist, scenes, MIDI learn ...). */
export const store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res) => {
    try {
      const r = indexedDB.open("felucca-editor", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("patches", { keyPath: "id" }); r.result.createObjectStore("meta"); };
      r.onsuccess = () => res(r.result);
      r.onerror = r.onblocked = () => res(null);
    } catch (e) { res(null); }
  }));
  const tx = async (name, mode, fn) => {
    const db = await open();
    if (!db) return undefined;
    return new Promise((res, rej) => {
      const x = db.transaction(name, mode);
      let out;
      const r = fn(x.objectStore(name));
      if (r) r.onsuccess = () => { out = r.result; };
      x.oncomplete = () => res(out);
      x.onerror = x.onabort = () => rej(x.error || new Error("IndexedDB"));
    });
  };
  return {
    ok: async () => !!(await open()),
    all: () => tx("patches", "readonly", (os) => os.getAll()),
    putMany: (ps) => tx("patches", "readwrite", (os) => { ps.forEach((p) => os.put(p)); }),
    del: (id) => tx("patches", "readwrite", (os) => os.delete(id)),
    getMeta: (k) => tx("meta", "readonly", (os) => os.get(k)),
    setMeta: (k, v) => tx("meta", "readwrite", (os) => os.put(v, k)),
  };
})();

/* the user bank's slot names (U01 ..) and a flash write's result code */
export const slotName = (i) => "U" + String(i + 1).padStart(2, "0");
export const checkRc = (rc) => { if (rc === 3) throw new Error(t("bkStop")); if (rc) throw new Error(t("flashFail").replace("{rc}", rc)); };

/* the sample flash's size and slots again (after a restore, a kit sent ...) */
export async function smpInfo() { A.dev.smp = parse[CMD.SMP_INFO](await rq(req.smpInfo())); notify(); }

/* ------------------------------------------------------- backup / song file progress --- */
/* A.bkProg: the fraction done of a backup, a restore or a song file (null: none running); the Save & load page's bar */
A.bkProg = null;
export function bkProgress(key) {
  A.bkProg = 0;
  notify();
  return (d, n) => { A.bkProg = d / n; sayK(key, `${Math.round((100 * d) / n)} %`); };
}
export function bkDone() { A.bkProg = null; notify(); }
export function bkReport(e) {
  if (e && e.code && TEXT[A.lang][e.code]) sayK(e.code, e.code === "bkStop" ? "" : e.message);
  else report(e);
}

/* ------------------------------------------------------------- the Song page's state --- */
/* the song order (the device's SONG screen): read once per connection (SG.dev), edited here, sent back */
export const SG = { dev: null, rows: null, loop: false, bytes: null, err: "", dirty: false };

/* --------------------------------------------------------------- a song as one file --- */
/* (2.7) a song as one file: export it; load one (also from the LIVE page's playlist) */
export async function songExport() {
  const name = prompt(t("sfName"), "SONG " + today());
  if (name == null) return;
  await op(async () => {
    try {
      const f = await songCapture(rq, A.dev.info, name.trim() || "SONG", bkProgress("sfSaving"));
      download(`${fileSlug(f.name) || "song"}.sloopsong`, f);
      sayK("sfSaved", f.name);
    } catch (e) { bkReport(e); } finally { bkDone(); }
  });
}
export async function songLoadUI(file, progress) {
  const dev = A.dev;
  selfLoad();
  await songLoad(rq, file, progress);
  dev.slotUsed = [null, null, null, null];
  for (let k = 0; k < 4; k++) {
    try { dev.slotUsed[k] = parse[CMD.PROJECT](await rq(req.project(2, k))).used; } catch (e) { if (e.message === "closed") throw e; }
  }
  SG.dev = null;                                    /* (the Song order page reads it again) */
  notify();
}
