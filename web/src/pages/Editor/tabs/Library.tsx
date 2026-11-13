// SPDX-License-Identifier: GPL-3.0-only
// The Library page: the sounds kept in this browser (left), the FM-1's 32 user preset slots (right, a 4 x 8 grid of
// tiles), and between them the two moves: send the selected sound to a slot, keep a slot's sound in the library. Drag a
// sound onto a slot, or a slot onto the library, to do the same. Each row and tile has its actions in a "⋯" menu (and on
// a right-click). Works without an FM-1; the slots show when one is connected. The logic: pages/library/lib.js.
import { useCallback, useState } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from "react";
import clsx from "clsx";
import type { UpSlot } from "../lib/proto.ts";
import { A, notify, t, tf, useApp } from "../core/app.ts";
import { slotName } from "../core/shared.ts";
import { Card, Help, Ic, Icon } from "../ui/kit.tsx";
import { bar, dim, pri } from "../ui/styles.ts";
import type { StoredPatch } from "../core/shared.ts";
import {
  LB, bankErase, bankExport, bankGet, bankLoad, bankRefresh, bankStore, libAudition, libDelete, libDuplicate, libEngines,
  libExportAll, libExportOne, libImport, libPut, libRename, libSave, libSetTags, libTags, libView, selPatch,
} from "./library/lib.ts";
import { Menu, menuAt } from "./library/Menu.tsx";
import type { MenuItem, MenuProps } from "./library/Menu.tsx";

/* an open menu: where, its title, its items */
type MenuOpen = Omit<MenuProps, "onClose">;
interface PaneProps { onMenu: (m: MenuOpen) => void }

export { init } from "./library/lib.ts";

const DRAG_LIB = "text/x-felucca-lib", DRAG_SLOT = "text/x-felucca-slot";
const TABLE = "w-full table-fixed [&_th]:bg-s1 [&_th]:px-2 [&_th]:py-1 "
  + "[&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-[3px] [&_td]:text-ellipsis [&_td]:whitespace-nowrap";
const NONE = "p-3 text-dim";
const DOTS = "size-7 p-0 leading-none";

/* -------------------------------------------------------- what is possible, and why not --- */
const hasBank = () => !!(A.dev && A.dev.bank);
/* the slot a library sound goes to: the selected one, else the first empty one */
function sendTarget(): number | null {
  if (!hasBank()) return null;
  if (LB.bankSel != null) return LB.bankSel;
  const e = A.dev!.bank!.slots.find((x) => !x.used);
  return e ? e.slot : null;
}
const whyBank = (): string => (!A.dev ? t("libWhyNoDev") : !A.dev.bank ? t("bankNone") : LB.busy ? t("whyBusy") : "");
function whySend(): string {
  if (!selPatch()) return t("libWhyNoSound");
  return whyBank() || (sendTarget() == null ? t("libWhyFull") : "");
}
function whyKeep(): string {
  const w = whyBank();
  if (w) return w;
  const s = LB.bankSel == null ? null : A.dev!.bank!.slots[LB.bankSel];
  return !s ? t("libWhyNoSlot") : !s.used ? t("libWhyEmptySlot") : "";
}

/* a library sound's actions */
function libItems(p: StoredPatch): MenuItem[] {
  const sel = (fn: () => void) => () => { LB.sel = p.id; notify(); fn(); };
  const tgt = sendTarget();
  const whyAud = !A.dev ? t("libWhyNoDev") : LB.busy ? t("whyBusy") : "";
  return [
    { label: t("audition"), ic: "symbol_audio", run: sel(() => libAudition(p.id)), why: whyAud },
    { label: tgt == null ? t("toSlot") : tf("libToSlotN", { n: slotName(tgt) }), ic: "symbol_upload",
      run: sel(() => libPut(p.id, sendTarget())), why: whyBank() || (tgt == null ? t("libWhyFull") : "") },
    { label: t("rename"), run: sel(libRename) },
    { label: t("tags"), run: sel(libSetTags) },
    { label: t("duplicate"), run: sel(libDuplicate) },
    { label: t("exportPatch"), ic: "symbol_download", run: sel(libExportOne) },
    { label: t("delete"), ic: "symbol_trash", run: sel(libDelete), warn: true },
  ];
}
/* a device slot's actions */
function slotItems(x: UpSlot): MenuItem[] {
  const sel = (fn: () => void) => () => { LB.bankSel = x.slot; notify(); fn(); };
  const busy = LB.busy ? t("whyBusy") : "", empty = x.used ? "" : t("libWhyEmptySlot");
  return [
    { label: t("bankLoad"), ic: "symbol_folder_open", run: sel(() => bankLoad(x.slot)), why: empty || busy },
    { label: t("bankStore"), ic: "port_disk", run: sel(bankStore), why: busy },
    { label: t("bankGet"), ic: "symbol_download", run: sel(() => bankGet(x.slot)), why: empty || busy },
    { label: t("erase"), ic: "symbol_trash", run: sel(bankErase), why: empty || busy, warn: true },
  ];
}

/* ------------------------------------------------------------------- the library --- */
function LibPane({ onMenu }: PaneProps) {
  const { dev, lang } = useApp();
  const [over, setOver] = useState(false);
  const engs = libEngines(), tags = libTags();
  const v = libView();
  const set = (k: "q" | "eng" | "tag" | "sort") => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { LB[k] = e.target.value; notify(); };
  const menu = (p: StoredPatch) => (e: ReactMouseEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); LB.sel = p.id; notify(); onMenu({ ...menuAt(e), title: p.name, items: libItems(p) }); };
  return (
    <Card title={t("library")} ic="symbol_books" className="mb-0!" id="libpane" sub={`${v.length} / ${LB.lib.length}`}>
      <div className={bar}>
        <button type="button" id="libsave" disabled={!dev || LB.busy} title={!dev ? t("libWhyNoDev") : LB.busy ? t("whyBusy") : t("libSaveHint")}
          onClick={libSave}><Ic ic="port_disk">{t("saveToLib")}</Ic></button>
        <button type="button" id="libimport" title={t("libImportHint")} onClick={libImport}><Ic ic="symbol_upload">{t("import")}</Ic></button>
        <button type="button" id="libexport" disabled={!LB.lib.length} title={LB.lib.length ? t("libExportHint") : t("libWhyEmpty")}
          onClick={libExportAll}><Ic ic="symbol_download">{t("exportLib")}</Ic></button>
      </div>
      <div className={bar}>
        <input type="search" id="libq" spellCheck="false" placeholder={t("libSearch")} className="flex-[1_1_140px]" value={LB.q} onChange={set("q")} />
        <select id="libeng" value={LB.eng} onChange={set("eng")} aria-label={t("engine")}>
          <option value="">{t("allEngines")}</option>
          {engs.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select id="libtag" value={LB.tag} onChange={set("tag")} aria-label={t("tagsCol")}>
          <option value="">{t("allTags")}</option>
          {tags.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select id="libsort" value={LB.sort} onChange={set("sort")} aria-label={t("libSort")}>
          <option value="modified">{t("sortModified")}</option>
          <option value="created">{t("sortCreated")}</option>
          <option value="name">{t("sortName")}</option>
          <option value="engine">{t("sortEngine")}</option>
        </select>
      </div>
      {/* a slot dropped on the library: a copy of it here */}
      <div id="liblist" className={`min-h-[360px] border bg-bg ${over ? "border-acc outline-2 -outline-offset-2 outline-acc outline-dashed" : "border-line"}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_SLOT)) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const s = e.dataTransfer.getData(DRAG_SLOT);
          if (s !== "") bankGet(+s);
        }}>
        {!LB.lib.length ? <div className={NONE}>{t("libEmpty")}</div> : (
          <>
            <table className={TABLE}>
              <colgroup><col /><col className="w-24" /><col className="w-28" /><col className="w-[104px]" /><col className="w-9" /></colgroup>
              <thead><tr><th>{t("name")}</th><th>{t("engine")}</th><th>{t("tagsCol")}</th><th>{t("date")}</th><th><span className="sr-only">{t("libActions")}</span></th></tr></thead>
              <tbody>
                {v.map((p) => {
                  const on = p.id === LB.sel;
                  return (
                    <tr key={p.id} data-id={p.id} draggable="true" title={tf("libRowHint", { name: p.name })}
                      className={`cursor-grab ${on ? "[&>td]:bg-acc [&>td]:text-black" : "[&>td]:text-fg2 hover:[&>td]:bg-s2"}`}
                      onClick={() => { LB.sel = p.id; notify(); }}
                      onDoubleClick={() => libAudition(p.id)}
                      onContextMenu={menu(p)}
                      onDragStart={(e) => { LB.sel = p.id; notify(); e.dataTransfer.setData(DRAG_LIB, p.id); e.dataTransfer.effectAllowed = "copy"; }}>
                      <td>{p.pattern ? <Icon name="note_eight" /> : null}{p.name}</td>
                      <td>{p.engineName || String(p.engine)}</td>
                      <td>{p.tags.join(", ")}</td>
                      <td>{new Date(p.modified).toLocaleDateString(lang)}</td>
                      <td className="px-0.5! py-0! text-right">
                        <button type="button" className={`${DOTS} ${on ? "bg-black/20 text-black" : "bg-transparent"}`} aria-haspopup="menu"
                          aria-label={tf("libActionsOf", { name: p.name })} title={t("libActions")} onClick={menu(p)}>⋯</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {v.length ? null : <div className={NONE}>{t("noMatch")}</div>}
          </>
        )}
      </div>
      {LB.persistent ? null : <p className={clsx(dim, "mt-2 mb-0")}>{t("noLibDB")}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------- the two moves --- */
function Moves() {
  useApp();
  const ws = whySend(), wk = whyKeep(), tgt = sendTarget();
  const s = LB.bankSel != null && hasBank() ? A.dev!.bank!.slots[LB.bankSel] : null;
  return (
    <div className="flex w-[168px] flex-col gap-3 pt-[118px]" id="libmoves">
      <button type="button" id="libsend" className={clsx(pri, "flex flex-col items-center gap-0.5 py-2.5")} disabled={!!ws}
        title={ws || tf("libSendHint", { name: selPatch()!.name, n: slotName(tgt!) })}
        onClick={() => libPut(LB.sel, sendTarget())}>
        <span className="text-big leading-6">→</span>
        <span>{t("libSend")}</span>
        <small className="text-[16px] leading-4 normal-case opacity-80">{!ws && tgt != null ? slotName(tgt) : " "}</small>
      </button>
      <button type="button" id="libkeep" className="flex flex-col items-center gap-0.5 py-2.5" disabled={!!wk}
        title={wk || tf("libKeepHint", { n: slotName(LB.bankSel!), name: s!.name })}
        onClick={() => bankGet(LB.bankSel)}>
        <span className="text-big leading-6">←</span>
        <span>{t("libKeep")}</span>
        <small className="text-[16px] leading-4 normal-case opacity-80">{!wk ? slotName(LB.bankSel!) : " "}</small>
      </button>
      <p className={clsx(dim, "m-0 text-center text-[13px] leading-[18px]")}>{ws && wk ? t("libMovesHint") : ""}</p>
    </div>
  );
}

/* ------------------------------------------------------------ the device's slots --- */
function BankPane({ onMenu }: PaneProps) {
  const { dev } = useApp();
  const has = !!(dev && dev.bank);
  const used = has ? dev!.bank!.slots.filter((x) => x.used).length : 0;
  const idle = !LB.busy;
  return (
    <Card title={t("bank")} ic="port_disk" className="mb-0!" sub={has ? `${used} / ${dev!.bank!.total} ${t("used")}` : null}>
      {has ? (
        <div id="bankpane">
          <div className={bar}>
            <button type="button" id="bkrefresh" disabled={!idle} title={idle ? t("libReloadHint") : t("whyBusy")} onClick={bankRefresh}>
              <Ic ic="control_arrow_loop">{t("reload")}</Ic></button>
            <button type="button" id="bkexport" disabled={!used || !idle} title={!used ? t("libWhyBankEmpty") : !idle ? t("whyBusy") : t("libExportBankHint")}
              onClick={bankExport}><Ic ic="symbol_download">{t("exportBank")}</Ic></button>
          </div>
          <SlotGrid onMenu={onMenu} />
        </div>
      ) : <Help>{t(!dev || !dev.dump ? "bankConnect" : "bankNone")}</Help>}
    </Card>
  );
}
function SlotGrid({ onMenu }: PaneProps) {
  const dev = A.dev!, b = dev.bank!;
  const [over, setOver] = useState<number | null>(null);
  return (
    <div id="banklist" role="listbox" aria-label={t("bank")} className="grid grid-cols-4 gap-1.5">
      {b.slots.map((x) => {
        const on = x.slot === LB.bankSel, eng = x.used ? dev.info!.engines[x.engine] || String(x.engine) : "";
        const menu = (e: ReactMouseEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); LB.bankSel = x.slot; notify(); onMenu({ ...menuAt(e), title: `${slotName(x.slot)} ${x.used ? x.name : t("empty")}`, items: slotItems(x) }); };
        return (
          <div key={x.slot} data-slot={x.slot} role="option" aria-selected={on} tabIndex={0} draggable={x.used ? "true" : undefined}
            title={x.used ? tf("libSlotHint", { n: slotName(x.slot), name: x.name }) : tf("libSlotEmptyHint", { n: slotName(x.slot) })}
            className={`group relative flex h-[72px] min-w-0 cursor-pointer flex-col justify-center border px-2 py-1 select-none
              ${on ? "border-acc bg-s2 shadow-[inset_0_0_0_1px_var(--acc)]" : "border-line bg-bg hover:border-s3"}
              ${over === x.slot ? "outline-2 -outline-offset-2 outline-acc outline-dashed" : ""} ${x.used ? "cursor-grab" : ""}`}
            onClick={() => { LB.bankSel = on ? null : x.slot; notify(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); LB.bankSel = x.slot; notify(); } }}
            onDoubleClick={() => { if (x.used) bankLoad(x.slot); }}
            onContextMenu={menu}
            onDragStart={(e) => { e.dataTransfer.setData(DRAG_SLOT, String(x.slot)); e.dataTransfer.effectAllowed = "copy"; }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_LIB)) { e.preventDefault(); setOver(x.slot); } }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData(DRAG_LIB);
              if (id) { LB.bankSel = x.slot; notify(); libPut(id, x.slot); }
            }}>
            <span className={on ? "text-acc" : "text-dim"}>{slotName(x.slot)}</span>
            <span className={`truncate ${x.used ? "text-fg" : "text-s3"}`}>{x.used ? x.name : t("empty")}</span>
            <span className="truncate text-dim opacity-80">{eng || "\u00a0"}</span>
            <button type="button" className={`${DOTS} absolute top-1 right-1 bg-transparent opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 ${on ? "opacity-100" : ""}`}
              aria-haspopup="menu" aria-label={tf("libActionsOf", { name: slotName(x.slot) })} title={t("libActions")} onClick={menu}>⋯</button>
          </div>
        );
      })}
    </div>
  );
}

export default function Library() {
  useApp();
  const [menu, setMenu] = useState<MenuOpen | null>(null);
  const close = useCallback(() => setMenu(null), []);
  return (
    <div id="libsec">
      <Help>{t("libDnd")}</Help>
      <div className="grid grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1fr)] items-start gap-4">
        <LibPane onMenu={setMenu} />
        <Moves />
        <BankPane onMenu={setMenu} />
      </div>
      {menu ? <Menu {...menu} onClose={close} /> : null}
    </div>
  );
}
