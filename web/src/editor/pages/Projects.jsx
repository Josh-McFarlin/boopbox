// SPDX-License-Identifier: GPL-3.0-only
// The Save & load page: the four sections A..D on the FM-1, the full backup (v6), a song as one file (2.7).
import { A, t, useApp } from "../core/app.js";
import { songExport } from "../core/shared.js";
import { Card, Help, Ic } from "../ui/kit.jsx";
import { backupLoad, backupSave, project, songFileLoad } from "./projects/files.js";

/* the sections: used, empty or unknown (the protocol cannot ask without loading or saving one ... or PROJECT op 2) */
function Slots() {
  const { dev } = useApp();
  return (
    <div id="slots" className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {[0, 1, 2, 3].map((i) => {
        const u = dev.slotUsed[i];
        return (
          <div key={i} className="flex flex-col gap-2 border border-line bg-bg p-3">
            <b className="text-big font-normal text-fg">{"ABCD"[i]}</b>
            <span className={`lowercase ${u ? "text-t2" : "text-dim"}`}>{u == null ? t("unknown") : t(u ? "used" : "empty")}</span>
            <p className="bar m-0!">
              <button type="button" className={u ? "pri" : ""} onClick={() => project(0, i)}><Ic ic="symbol_folder_open">{t("load")}</Ic></button>
              <button type="button" onClick={() => project(1, i)}><Ic ic="port_disk">{t("save")}</Ic></button>
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function Projects() {
  const { dev, bkProg } = useApp();
  if (!dev || !dev.info) return null;
  const v6 = dev.info.proto >= 6;                      /* v6 firmware: backup / restore; (2.7) a song as one file: the same commands */
  return (
    <>
      <Card title={t("projects")} ic="symbol_folder">
        <Help>{t("projHelp")}</Help>
        <Slots />
      </Card>
      {v6 ? (
        <Card title={t("bkTitle")} ic="port_disk" id="bkgroup">
          <Help>{t("bkHelp")}</Help>
          <p className="bar">
            <button type="button" id="bk-save" className="pri" onClick={backupSave}>{t("bkSave")}</button>{" "}
            <button type="button" id="bk-load" onClick={backupLoad}>{t("bkLoad")}</button>
          </p>
          {bkProg != null ? <progress id="bk-prog" max="1" value={bkProg} /> : null}
        </Card>
      ) : null}
      {/* 2.7: a song as one file (the LIVE page's playlist plays them) */}
      {v6 ? (
        <Card title={t("sfTitle")} ic="control_arrow_loop" id="sfgroup">
          <Help>{t("sfHelp")}</Help>
          <p className="bar">
            <button type="button" id="sf-save" className="pri" onClick={() => { if (A.dev) songExport(); }}><Ic ic="symbol_download">{t("sfSave")}</Ic></button>{" "}
            <button type="button" id="sf-load" onClick={songFileLoad}><Ic ic="symbol_upload">{t("sfLoad")}</Ic></button>
          </p>
        </Card>
      ) : null}
    </>
  );
}
