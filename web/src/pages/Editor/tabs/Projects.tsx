// SPDX-License-Identifier: GPL-3.0-only
// The Save & load page: the four sections A..D of the song on the FM-1, and files: a song as one file (2.7), the full
// backup (v6).
import { A, t, tf, useApp } from "../core/app.ts";
import { songExport } from "../core/shared.ts";
import { Card, Ic } from "../ui/kit.tsx";
import { HelpMore } from "./patterns/ui.tsx";
import { backupLoad, backupSave, project, songFileLoad } from "./projects/files.ts";

/* the sections: used, empty or unknown (PROJECT op 2 tells used / empty, nothing more) */
function Sections() {
  const { dev, busy } = useApp();
  return (
    <div id="slots" className="grid grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => {
        const u = dev.slotUsed[i], L = "ABCD"[i];
        return (
          <div key={i} style={{ "--c": `var(--t${i + 1})` }} className="flex flex-col gap-2 border border-line border-t-4 border-t-c bg-bg p-3">
            <div className="flex items-baseline gap-3">
              <b className="text-big font-normal text-c">{L}</b>
              <span className={u ? "text-fg" : "text-dim"}>{u == null ? t("secUnknown") : t(u ? "secUsed" : "secEmptyShort")}</span>
            </div>
            <button type="button" disabled={!!busy || (u != null && !u)} title={busy ? t("whyBusy") : (u != null && !u) ? tf("secLoadWhy", { n: L }) : tf("secLoadHint", { n: L })}
              onClick={() => project(0, i)}><Ic ic="symbol_folder_open">{t("secLoad")}</Ic></button>
            <button type="button" disabled={!!busy} title={busy ? t("whyBusy") : tf("secSaveHint", { n: L })}
              onClick={() => project(1, i)}><Ic ic="port_disk">{t("secSave")}</Ic></button>
          </div>
        );
      })}
    </div>
  );
}

/* a file row: what it holds, its two buttons */
function FileRow({ id, title, what, children }) {
  return (
    <div id={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <p className="help m-0 text-dim"><b className="text-fg">{title}</b>{" — " + what}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export default function Projects() {
  const { dev, bkProg, busy } = useApp();
  if (!dev || !dev.info) return null;
  const v6 = dev.info.proto >= 6;                      /* v6 firmware: backup / restore; (2.7) a song as one file: the same commands */
  const why = busy ? t("whyBusy") : "";
  return (
    <>
      <Card title={t("secTitle")} ic="symbol_folder">
        <HelpMore line={t("secHelp1")}>{t("projHelp")}</HelpMore>
        <Sections />
      </Card>
      <Card title={t("filesTitle")} ic="port_disk" id="bkgroup">
        {v6 ? (
          <>
            {/* 2.7: a song as one file (the LIVE page's playlist plays them) */}
            <FileRow id="sfgroup" title={t("sfTitle")} what={t("sfWhat")}>
              <button type="button" id="sf-save" disabled={!!busy} title={why} onClick={() => { if (A.dev) songExport(); }}>
                <Ic ic="symbol_download">{t("sfSave")}</Ic></button>
              <button type="button" id="sf-load" disabled={!!busy} title={why} onClick={songFileLoad}><Ic ic="symbol_upload">{t("sfLoad")}</Ic></button>
            </FileRow>
            <FileRow id="bkrow" title={t("bkTitle")} what={t("bkWhat")}>
              <button type="button" id="bk-save" disabled={!!busy} title={why} onClick={backupSave}><Ic ic="symbol_download">{t("bkSave")}</Ic></button>
              <button type="button" id="bk-load" disabled={!!busy} title={why} onClick={backupLoad}><Ic ic="symbol_upload">{t("bkLoad")}</Ic></button>
            </FileRow>
            {bkProg != null ? <progress id="bk-prog" className="mt-2 w-full" max="1" value={bkProg} /> : null}
          </>
        ) : <p className="help m-0 text-dim">{t("filesOld")}</p>}
      </Card>
    </>
  );
}
