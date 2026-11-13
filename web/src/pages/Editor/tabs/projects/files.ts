// SPDX-License-Identifier: GPL-3.0-only
// The Save & load page's work: the sections A..D (PROJECT), the full backup (v6) and a song as one file (2.7).
import { CMD, backupCapture, backupObjects, backupRestore, parse, req, songObjects } from "../../lib/proto.ts";
import { A, download, notify, op, pickFile, report, rq, sayK, selfLoad, t, today } from "../../core/app.ts";
import { afterSoundChange } from "../../core/device.ts";
import { bkDone, bkProgress, bkReport, smpInfo, songLoadUI } from "../../core/shared.ts";

/* projects: the protocol cannot ask whether a slot is used without loading or saving it */
export async function project(o, slot) {
  const dev = A.dev;
  if (!dev) return;
  /* loading replaces the loop: always asked; saving only over a section that is (or may be) used */
  if ((!o || dev.slotUsed[slot] == null || dev.slotUsed[slot]) && !confirm(t(o ? "confirmSave" : "confirmLoad").replaceAll("{n}", "ABCD"[slot]))) return;
  A.busy++;
  notify();
  try {
    /* save writes flash: a long timeout and no retry */
    if (!o) selfLoad();
    const r = parse[CMD.PROJECT](await rq(req.project(o, slot), { timeout: 4000, retries: 0 }));
    if (r.busy) throw new Error("Stop playback before loading or saving a section.");
    dev.slotUsed[slot] = r.used;
    notify();
    if (!o && r.used) await afterSoundChange();
    sayK(o ? "secSaved" : r.used ? "secLoaded" : "secEmpty", "ABCD"[slot]);
  } catch (err) { report(err); } finally { A.busy--; notify(); }
}

/* v6: backup / restore (the work: backupCapture / backupRestore in lib/proto.js) */
export const backupSave = () => op(async () => {
  try {
    const arc = await backupCapture(rq, A.dev.info, bkProgress("bkSaving"));
    download(`BoopBox-backup-${today()}.json`, arc);
    sayK("bkSaved");
  } catch (e) { bkReport(e); } finally { bkDone(); }
});
export async function backupLoad() {
  if (!A.dev) return;
  const f = await pickFile(".json,application/json");
  const dev = A.dev;
  if (!f || !dev) return;
  let file;
  try { file = JSON.parse(await f.text()); backupObjects(file); }
  catch (e) { sayK("bkBad", e.message); return; }
  if (!confirm(t("bkConfirm"))) return;
  await op(async () => {
    try {
      selfLoad();
      await backupRestore(rq, file, bkProgress("bkRestoring"));
      dev.slotUsed = [null, null, null, null];
      notify();
      try { await smpInfo(); } catch (e) { /* shown by the next action */ }
      await afterSoundChange("bkRestored");
    } catch (e) { bkReport(e); } finally { bkDone(); }
  });
}

/* (2.7) a song as one file: load one (the export is songExport in core/shared.js) */
export async function songFileLoad() {
  if (!A.dev) return;
  const f = await pickFile(".sloopsong,.json,application/json");
  if (!f || !A.dev) return;
  let file;
  try { file = JSON.parse(await f.text()); songObjects(file); }
  catch (e) { sayK("songBadFile", ""); return; }
  if (!confirm(t("sfConfirm").replace("{name}", file.name || f.name))) return;
  await op(async () => {
    try {
      await songLoadUI(file, bkProgress("sfLoading"));
      await afterSoundChange("sfLoaded");
      sayK("sfLoaded", file.name || f.name);
    } catch (e) { bkReport(e); } finally { bkDone(); }
  });
}
