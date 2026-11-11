// SPDX-License-Identifier: GPL-3.0-only
// The Library page: the patches kept in this browser, and the FM-1's user preset bank next to them (drag a patch onto
// a slot to put it there, a slot onto the library to copy it here). Works without an FM-1; the bank shows when one is
// connected. The logic: pages/library/lib.js.
import { useState } from "react";
import { A, notify, t, useApp } from "../core/app.js";
import { slotName } from "../core/shared.js";
import { Card, Help, Ic, Icon } from "../ui/kit.jsx";
import {
  LB, bankErase, bankExport, bankGet, bankLoad, bankRefresh, bankStore, libAudition, libDelete, libDuplicate, libEngines,
  libExportAll, libExportOne, libImport, libPut, libRename, libSave, libSetTags, libTags, libView, selPatch,
} from "./library/lib.js";

export { init } from "./library/lib.js";

/* a scrolling list (a table with a sticky head); rows: [data-id] / [data-slot], .sel, .empty, .over */
const LIST = "h-[360px] resize-y overflow-auto border border-line bg-bg";
const TABLE = "w-full table-fixed [&_th]:sticky [&_th]:top-0 [&_th]:bg-s1 [&_th]:px-2 [&_th]:py-1 "
  + "[&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-[3px] [&_td]:text-ellipsis [&_td]:whitespace-nowrap";
const row = (sel, extra = "") => `cursor-pointer ${sel ? "[&>td]:bg-trk [&>td]:text-black" : "hover:[&>td]:bg-s2"} ${extra}`;
const NONE = "p-3 text-dim";

function LibPane() {
  const { dev, lang } = useApp();
  const [over, setOver] = useState(false);
  const engs = libEngines(), tags = libTags();
  const v = libView();
  const sel = selPatch();
  const set = (k) => (e) => { LB[k] = e.target.value; notify(); };
  return (
    <Card title={t("library")} ic="symbol_books" className="mb-0!" id="libpane">
      <div className="bar">
        <input type="search" id="libq" spellCheck="false" placeholder={t("libSearch")} className="flex-[1_1_140px]" value={LB.q} onChange={set("q")} />
        <select id="libeng" value={LB.eng} onChange={set("eng")}>
          <option value="">{t("allEngines")}</option>
          {engs.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select id="libtag" value={LB.tag} onChange={set("tag")}>
          <option value="">{t("allTags")}</option>
          {tags.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select id="libsort" value={LB.sort} onChange={set("sort")}>
          <option value="modified">{t("sortModified")}</option>
          <option value="created">{t("sortCreated")}</option>
          <option value="name">{t("sortName")}</option>
          <option value="engine">{t("sortEngine")}</option>
        </select>
      </div>
      {/* a slot dropped on the library: copy it there */}
      <div id="liblist" className={`${LIST} ${over ? "outline outline-trk" : ""}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-felucca-slot")) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const s = e.dataTransfer.getData("text/x-felucca-slot");
          if (s !== "") bankGet(+s);
        }}>
        {!LB.lib.length ? <div className={NONE}>{t("libEmpty")}</div> : (
          <>
            <table className={TABLE}>
              <colgroup><col /><col className="w-24" /><col /><col className="w-[110px]" /></colgroup>
              <thead><tr><th>{t("name")}</th><th>{t("engine")}</th><th>{t("tagsCol")}</th><th>{t("date")}</th></tr></thead>
              <tbody>
                {v.map((p) => (
                  <tr key={p.id} data-id={p.id} draggable="true" title={p.name} className={row(p.id === LB.sel, "[&>td]:text-fg2")}
                    onClick={() => { LB.sel = p.id; notify(); }}
                    onDoubleClick={() => libAudition(p.id)}
                    onDragStart={(e) => { LB.sel = p.id; e.dataTransfer.setData("text/x-felucca-lib", p.id); e.dataTransfer.effectAllowed = "copy"; }}>
                    <td>{p.pattern ? <Icon name="note_eight" /> : null}{p.name}</td>
                    <td>{p.engineName || String(p.engine)}</td>
                    <td>{p.tags.join(", ")}</td>
                    <td>{new Date(p.modified).toLocaleDateString(lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {v.length ? null : <div className={NONE}>{t("noMatch")}</div>}
          </>
        )}
      </div>
      <p className="bar mt-2.5">
        <button id="libaud" className="pri" disabled={!sel || !dev || LB.busy} onClick={() => libAudition(LB.sel)}>
          <Ic ic="symbol_audio">{t("audition")}</Ic></button>
        <button id="libput" disabled={!sel || !dev || !dev.bank || LB.bankSel == null || LB.busy} onClick={() => libPut(LB.sel, LB.bankSel)}>
          <Ic ic="symbol_upload">{t("toSlot")}</Ic></button>
        <button id="libren" disabled={!sel} onClick={libRename}>{t("rename")}</button>
        <button id="libtags" disabled={!sel} onClick={libSetTags}>{t("tags")}</button>
        <button id="libdup" disabled={!sel} onClick={libDuplicate}>{t("duplicate")}</button>
        <button id="libdel" className="warn" disabled={!sel} onClick={libDelete}><Ic ic="symbol_trash">{t("delete")}</Ic></button>
        <button id="libexp1" disabled={!sel} onClick={libExportOne}><Ic ic="symbol_download">{t("exportPatch")}</Ic></button>
      </p>
      <p className="bar">
        <button id="libsave" disabled={!dev || LB.busy} onClick={libSave}><Ic ic="port_disk">{t("saveToLib")}</Ic></button>
        <button id="libimport" onClick={libImport}><Ic ic="symbol_upload">{t("import")}</Ic></button>
        <button id="libexport" disabled={!LB.lib.length} onClick={libExportAll}><Ic ic="symbol_download">{t("exportLib")}</Ic></button>
        <span className="dim" id="libcount">{`${v.length} / ${LB.lib.length}` + (LB.persistent ? "" : " " + t("noLibDB"))}</span>
      </p>
    </Card>
  );
}

function BankPane() {
  const { dev } = useApp();
  const [over, setOver] = useState(null);
  const has = !!(dev && dev.bank);
  return (
    <Card title={t("bank")} ic="port_disk" className="mb-0!">
      {has ? null : <Help>{t(!dev || !dev.dump ? "bankConnect" : "bankNone")}</Help>}
      {has ? <BankList over={over} setOver={setOver} /> : null}
    </Card>
  );
}
function BankList({ over, setOver }) {
  const dev = A.dev, b = dev.bank, used = b.slots.filter((x) => x.used).length;
  const s = LB.bankSel == null ? null : b.slots[LB.bankSel];
  const idle = !LB.busy;
  return (
    <div id="bankpane">
      <div className="bar"><b id="bankhead" className="dim">{`${used} / ${b.total} ${t("used")}`}</b></div>
      <div className={LIST} id="banklist">
        <table className={TABLE}>
          <colgroup><col className="w-[52px]" /><col /><col className="w-24" /></colgroup>
          <thead><tr><th>#</th><th>{t("name")}</th><th>{t("engine")}</th></tr></thead>
          <tbody>
            {b.slots.map((x) => (
              <tr key={x.slot} data-slot={x.slot} draggable={x.used ? "true" : undefined}
                className={row(x.slot === LB.bankSel, `${x.used ? "[&>td]:text-fg2" : "[&>td]:text-s3"} ${over === x.slot ? "[&>td]:outline [&>td]:outline-dashed [&>td]:outline-trk [&>td]:-outline-offset-1" : ""}`)}
                onClick={() => { LB.bankSel = x.slot; notify(); }}
                onDoubleClick={() => { if (x.used) bankLoad(x.slot); }}
                onDragStart={(e) => { e.dataTransfer.setData("text/x-felucca-slot", String(x.slot)); e.dataTransfer.effectAllowed = "copy"; }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-felucca-lib")) { e.preventDefault(); setOver(x.slot); } }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/x-felucca-lib");
                  if (id) { LB.bankSel = x.slot; notify(); libPut(id, x.slot); }
                }}>
                <td>{slotName(x.slot)}</td>
                <td>{x.used ? x.name : t("empty")}</td>
                <td>{x.used ? dev.info.engines[x.engine] || String(x.engine) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bar mt-2.5">
        <button id="bkload" className="pri" disabled={!s || !s.used || !idle} onClick={() => bankLoad(LB.bankSel)}>
          <Ic ic="symbol_folder_open">{t("bankLoad")}</Ic></button>
        <button id="bkstore" disabled={!s || !idle} onClick={bankStore}><Ic ic="port_disk">{t("bankStore")}</Ic></button>
        <button id="bkget" disabled={!s || !s.used || !idle} onClick={() => bankGet(LB.bankSel)}><Ic ic="symbol_download">{t("bankGet")}</Ic></button>
        <button id="bkerase" className="warn" disabled={!s || !s.used || !idle} onClick={bankErase}><Ic ic="symbol_trash">{t("erase")}</Ic></button>
      </p>
      <p className="bar">
        <button id="bkrefresh" disabled={!idle} onClick={bankRefresh}><Ic ic="control_arrow_loop">{t("reload")}</Ic></button>
        <button id="bkexport" disabled={!used || !idle} onClick={bankExport}><Ic ic="symbol_download">{t("exportBank")}</Ic></button>
        <span className="dim">{t("dndHelp")}</span>
      </p>
    </div>
  );
}

export default function Library() {
  useApp();
  return (
    <div id="libsec" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
      <LibPane />
      <BankPane />
    </div>
  );
}
