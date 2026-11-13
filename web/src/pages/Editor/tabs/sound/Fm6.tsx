// SPDX-License-Identifier: GPL-3.0-only
/* ------------------------------------------------------------------ FM6 --- */
/* The FM6 engine's patch (firmware v9, EDITOR_PROTOCOL.md "FM6 patches"), in the Sound tab while the selected
   track plays FM6: the device's eight EDIT values are macros on top of it. "Send to track" makes it the track's own
   patch at once (a project keeps PTCH only: the patch stays until PTCH turns or a sound loads), "Store in bank"
   keeps it in a PTCH slot B1..B27 (flash; the song must be stopped). SysEx files (.syx): a single voice or a 32-voice
   bank (pick a voice). */
import { useEffect, useRef } from "react";
import type { DragEvent, ReactNode } from "react";
import clsx from "clsx";
import type { Dev } from "../../core/app.ts";
import { A, downloadBytes, fileSlug, notify, op, pickFile, rq, sayK, t, today, useApp } from "../../core/app.ts";
import { checkRc, slotName } from "../../core/shared.ts";
import { CMD, F, FM6, bank, fm6CartPreset, fm6CartPresets, fm6CartSlots, fm6CartWrite, parse, req } from "../../lib/proto.ts";
import type { Fm6Sysex, PatchIn } from "../../lib/proto.ts";
import { Card, Help, Ic } from "../../ui/kit.tsx";
import { bar, dim, pri, warn } from "../../ui/styles.ts";

/* the FM6 editor's state (the old fm6v, fm6Imported ... globals) */
/* an imported voice: its name, its 155 values */
export interface Fm6Voice { name: string; v: Uint8Array }
/* where Store cartridge also puts user presets: nowhere, the free ones, or from a slot on */
export type Fm6Up = "none" | "free" | number;
export interface Fm6State {
  v: Uint8Array; ver: number; imported: Fm6Voice[]; tick: Set<number>; file: string; up: Fm6Up; live: boolean; slot: number | null; drop: boolean;
}
export const FS: Fm6State = {
  v: FM6.init(),        /* the patch being edited (155 bytes) */
  ver: 0,               /* bumped when v is replaced or reset (the old renderFm6: its fields are built again) */
  imported: [],         /* voices of the last imported file: [{name, v}] */
  tick: new Set(),      /* the imported voices that go to the bank (2.5: Store cartridge, B1.. in order) */
  file: "",
  up: "none",           /* also as user presets? "none", "free" or a first slot */
  live: false,          /* send while editing */
  slot: null,           /* the slot chosen in the slot list (null: not shown yet; it starts on the track's PTCH) */
  drop: false,          /* a file dragged over the panel */
};
let fm6Timer: ReturnType<typeof setTimeout> | undefined, fm6Pending = false;
const fm6Eng = (): number => { const dev = A.dev; return dev && dev.info ? dev.info.engines.indexOf("FM6") : -1; };
export const fm6Ok = (): boolean => { const dev = A.dev; return !!dev && !!dev.info && dev.info.proto >= 9 && !!dev.fm6 && fm6Eng() >= 0; };
export const fm6On = (): boolean => fm6Ok() && !!A.dev!.dump && A.dev!.dump.engine === fm6Eng();   /* the selected track plays FM6 */
const fm6Track = (): number => (A.dev && A.dev.sel != null ? A.dev.sel : 0);
const fm6SlotName = (i: number, d: Dev = A.dev!): string => (i < d.fm6!.factory ? "F" : "B") + (i < d.fm6!.factory ? i + 1 : i - d.fm6!.factory + 1);
const FM6_WAVES = ["TRI", "SAW-", "SAW+", "SQR", "SIN", "S&H"];
const FM6_CURVES = ["-LIN", "-EXP", "+EXP", "+LIN"];
/* the patch was replaced: its fields show it */
function renderFm6(): void { FS.ver++; notify(); }

/* the names the device shows for ALG (PAT, 1..32) and PTCH (F1..F8, B1..B27): DESC sends none for F_INT */
export function fm6Names(d: Dev | null = A.dev): void {
  if (!d || !d.pdesc || !d.info || !d.dump || d.dump.engine !== (d.info.engines || []).indexOf("FM6") || !d.fm6) return;
  const pe0 = d.info.pe0, alg = d.pdesc[pe0], ptch = d.pdesc[pe0 + 7];
  if (alg && alg.label === "ALG" && alg.fmt === F.INT) alg.names = ["PAT", ...Array.from({ length: 32 }, (_, k) => String(k + 1))];
  if (ptch && ptch.label === "PTCH" && ptch.fmt === F.INT) ptch.names = Array.from({ length: d.fm6.factory + d.fm6.bank }, (_, i) => fm6SlotName(i, d));
}
function fm6Set(i: number, val: string | number): void {
  FS.v[i] = Math.max(0, Math.min(FM6.max(i), Math.round(+val || 0)));
  if (FS.live && fm6On()) {
    clearTimeout(fm6Timer);
    fm6Timer = setTimeout(() => op(() => fm6Send(true)), 150);
  }
}
async function fm6Refresh(d: Dev = A.dev!): Promise<void> {
  d.fm6 = parse[CMD.FM6_LIST](await rq(req.fm6List()));
  fm6Names(d);
  notify();
}
/* the selected track's patch into the editor (after a sound change: a PTCH value loaded one) */
async function fm6ReadTrack(quiet: boolean): Promise<void> {
  const r = parse[CMD.FM6_GET](await rq(req.fm6Get(FM6.TARGET.TRACK, fm6Track())));
  if (r.rc) { if (!quiet) checkRc(r.rc); return; }
  FS.v = FM6.unpack(r.packed!);
  renderFm6();
  if (!quiet) sayK("fm6Read", ` ${fm6Track() + 1}: ${FM6.name(FS.v)}`);
}
export async function fm6Follow(): Promise<void> { if (fm6On()) await fm6ReadTrack(true); }
export function fm6Later(): void {           /* a PTCH change: read the new patch once the queue is quiet */
  if (fm6Pending) return;
  fm6Pending = true;
  setTimeout(() => { fm6Pending = false; op(fm6Follow); }, 250);
}
async function fm6Send(quiet: boolean): Promise<void> {
  const r = parse[CMD.FM6_PUT](await rq(req.fm6Put(FM6.TARGET.TRACK, fm6Track(), FM6.pack(FS.v))));
  checkRc(r.rc);
  if (!quiet) sayK("fm6Sent", ` ${fm6Track() + 1}`);
}

/* the slot list: F1..F8 (factory), B1..B27 (the bank) */
const curSlot = (): number => {
  const dev = A.dev!, n = dev.fm6!.factory + dev.fm6!.bank;
  if (FS.slot == null || FS.slot >= n) FS.slot = dev.dump ? Math.min(n - 1, dev.dump.p[dev.info!.pe0 + 7] | 0) : 0;
  return FS.slot;
};
const fm6Load = (): Promise<void> => op(async () => {
  const dev = A.dev!, i = curSlot(), nf = dev.fm6!.factory;
  const r = parse[CMD.FM6_GET](await rq(i < nf ? req.fm6Get(FM6.TARGET.FACTORY, i) : req.fm6Get(FM6.TARGET.BANK, i - nf)));
  if (r.rc === 2) { sayK("emptySlot", fm6SlotName(i)); return; }
  checkRc(r.rc);
  FS.v = FM6.unpack(r.packed!);
  renderFm6();
  sayK("fm6Loaded", ` ${fm6SlotName(i)}: ${FM6.name(FS.v)}`);
});
function fm6Store(): void {
  if (!fm6Ok()) return;
  const dev = A.dev!, fm6 = dev.fm6!, i = curSlot(), nf = fm6.factory;
  if (i < nf) { sayK("fm6Factory"); return; }
  const x = fm6.slots[i];
  if (x && x.used && !confirm(t("confirmOverwrite").replace("{n}", fm6SlotName(i)).replace("{name}", x.name))) return;
  op(async () => {
    checkRc(parse[CMD.FM6_PUT](await rq(req.fm6Put(FM6.TARGET.BANK, i - nf, FM6.pack(FS.v)), { timeout: 3000 })).rc);
    await fm6Refresh();
    sayK("storedSlot", fm6SlotName(i));
  });
}
function fm6Erase(): void {
  if (!fm6Ok()) return;
  const fm6 = A.dev!.fm6!, i = curSlot(), nf = fm6.factory, x = fm6.slots[i];
  if (i < nf || !x || !x.used || !confirm(t("confirmEraseSlot").replace("{n}", fm6SlotName(i)).replace("{name}", x.name))) return;
  op(async () => {
    checkRc(parse[CMD.FM6_ERASE](await rq(req.fm6Erase(i - nf), { timeout: 3000 })).rc);
    await fm6Refresh();
    sayK("erasedSlot", fm6SlotName(i));
  });
}

/* ---- files ---- */
export async function fm6ImportFile(f: File | null): Promise<void> {
  if (!f) return;
  try {
    const dev = A.dev;
    const r = FM6.parseSysex(new Uint8Array(await f.arrayBuffer()));
    if (!r.voices.length) { const [k, x] = fm6Why(r); sayK(k, `${x}: ${f.name}`); return; }
    FS.imported = r.voices;
    FS.file = f.name;
    FS.tick = new Set(r.voices.length > 1 ? r.voices.slice(0, dev && dev.fm6 ? dev.fm6.bank : FM6.BANK_N).map((_, k) => k) : []);
    if (r.voices.length === 1) FS.v = Uint8Array.from(r.voices[0].v);
    renderFm6();
    const notes = [r.badSum && t("fm6BadSum"), r.short && t("fm6Short"), r.skipped && t("fm6Skipped").replace("{x}", String(r.skipped))].filter(Boolean);
    sayK("imported", `${f.name}: ${r.voices.length}` + (notes.length ? ` (${notes.join(", ")})` : ""));
  } catch (err) { sayK("badfile", (err as Error).message); }
}
/* why a file had no 6-operator voice: [message key, what to add before the file name] (after Felucca 1.0.3) */
function fm6Why(r: Fm6Sysex): [key: string, x: string] {
  const mk = r.kinds.find((k) => k.startsWith("maker:"));
  if (r.kinds.includes("fm4")) return ["fm6Is4op", ""];
  if (r.kinds.includes("other43")) return ["fm6OtherBlocks", ""];
  if (mk) return ["fm6OtherMaker", ` (ID ${mk.slice(6)})`];
  if (r.kinds.includes("universal")) return ["fm6Universal", ""];
  return [r.sysex ? "fm6NoVoice" : "fm6NotSysex", ""];
}
const fm6Export = (): void => downloadBytes(`${fileSlug(FM6.name(FS.v))}.syx`, FM6.singleSysex(FS.v));
const fm6BankExport = (): Promise<void> => op(async () => {
  const dev = A.dev!, out: (Uint8Array | null)[] = [];
  for (let k = 0; k < dev.fm6!.bank; k++) {
    const r = parse[CMD.FM6_GET](await rq(req.fm6Get(FM6.TARGET.BANK, k)));
    out.push(r.rc ? null : FM6.unpack(r.packed!));
  }
  downloadBytes(`boopbox-fm6-bank-${today()}.syx`, FM6.bankSysex(out));
  sayK("fm6Exported");
});

/* the ticked voices into B1..Bn in one write: the bank is read whole (backup object 8), those slots replaced, the rest
   kept, and written back whole (BK_PUT: one flash write, stopped only, as a restore) */
async function fm6StoreCart(): Promise<void> {
  if (!fm6Ok()) return;
  const dev = A.dev!, info = dev.info!, fm6 = dev.fm6!;
  const order = [...FS.tick].sort((a, b) => a - b), n = order.length, nf = fm6.factory;
  if (!n) return;
  const busyN = order.filter((_, i) => fm6.slots[nf + i] && fm6.slots[nf + i].used).length;
  op(async () => {
    let puts: { slot: number; pt: PatchIn }[] = [], upTxt = "";
    if (FS.up !== "none") {                       /* the user presets: read the slots now, then ask */
      const list = await bank.list(rq);
      const slots = fm6CartSlots(list, n, FS.up);
      if (!slots) {
        sayK(FS.up === "free" ? "fm6UpNoRoom" : "fm6UpPast", FS.up === "free" ? ` ${list.slots.filter((x) => !x.used).length}` : ` ${slotName(FS.up as number)} + ${n}`);
        return;
      }
      const base = dev.pdesc.slice(0, info.pcount).map((d) => (d ? d.def : 0));
      puts = order.map((k, i) => ({ slot: slots[i], pt: fm6CartPreset(info, base, nf, i, FS.imported[k].name) }));
      const over = slots.map((s) => list.slots[s]).filter((x) => x && x.used);
      upTxt = "\n" + t("fm6UpAsk").replace("{n}", String(n)).replace("{u}", fm6SlotsTxt(slots))
        + (over.length ? "\n" + t("fm6UpOver").replace("{k}", String(over.length)).replace("{names}", over.slice(0, 6).map((x) => `${slotName(x.slot)} ${x.name}`).join(", ") + (over.length > 6 ? "…" : "")) : "");
    }
    if (!confirm(t("fm6CartAsk").replace("{n}", String(n)).replace("{b}", `B1–B${n}`).replace("{x}", FS.file || "SysEx")
      + (busyN ? "\n" + t("fm6CartOver").replace("{k}", String(busyN)) : "") + upTxt)) return;
    const rc = await fm6CartWrite(rq, order.map((k) => FM6.pack(Uint8Array.from(FS.imported[k].v))));
    if (rc === "old") { sayK("fm6CartOld"); return; }
    if (rc === 3) { sayK("fm6CartStop"); return; }
    await fm6Refresh();
    if (!puts.length) { sayK("fm6CartDone", ` ${n} → B1–B${n}`); return; }
    const ru = await fm6CartPresets(rq, puts);
    try { dev.bank = await bank.list(rq); notify(); } catch (e) { /* (the list comes back at the next connect) */ }
    if (ru === 3) { sayK("fm6UpStop"); return; }
    checkRc(ru);
    sayK("fm6UpDone", ` ${n} → B1–B${n}, ${fm6SlotsTxt(puts.map((x) => x.slot))}`);
  });
}
/* U04–U08 when they follow each other, else U04, U05, U07… */
function fm6SlotsTxt(sl: number[]): string {
  if (sl.length > 1 && sl.every((x, i) => !i || x === sl[i - 1] + 1)) return `${slotName(sl[0])}–${slotName(sl[sl.length - 1])}`;
  return sl.slice(0, 8).map(slotName).join(", ") + (sl.length > 8 ? "…" : "");
}

/* ------------------------------------------------------------- the panel --- */
/* a value of the patch: sent when it changes (on Enter, on leaving the field, by its arrows); the field shows it
   clamped. It is built again (key) when the whole patch is replaced, as the old page rebuilt its tables */
function Num({ i, title }: { i: number; title: string }) {
  const r = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = r.current!;
    const f = () => { fm6Set(i, el.value); el.value = String(FS.v[i]); notify(); };
    el.addEventListener("change", f);
    return () => el.removeEventListener("change", f);
  }, [i]);
  return <input ref={r} type="number" min={0} max={FM6.max(i)} defaultValue={FS.v[i]} title={title}
    className="fm6n w-[3.6em] px-[3px] py-0.5" />;
}
function Sel({ i, names, title }: { i: number; names: string[]; title: string }) {
  return (
    <select title={title} value={FS.v[i]} onChange={(e) => { fm6Set(i, e.target.value); notify(); }}>
      {names.map((n, k) => <option key={k} value={k}>{n}</option>)}
    </select>
  );
}
function NameField() {
  const r = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = r.current!;
    const f = () => { FM6.setName(FS.v, el.value); fm6Set(0, FS.v[0]); el.value = FM6.name(FS.v); notify(); };
    el.addEventListener("change", f);
    return () => el.removeEventListener("change", f);
  }, []);
  return <input ref={r} type="text" maxLength={10} size={11} defaultValue={FM6.name(FS.v)} />;
}

function Voice() {
  const V = FM6.VI, alg = FS.v[V.ALG], fb = FM6.feedbackOp(alg);
  const row = (label: string, ...kids: ReactNode[]) => <tr><th>{label}</th><td>{kids}</td></tr>;
  const N = (i: number, title: string) => <Num key={title} i={i} title={title} />;
  return (
    <table><tbody>
      {row(t("name"), <NameField key="n" />)}
      {row("ALG", <Sel key="a" i={V.ALG} names={Array.from({ length: 32 }, (_, k) => String(k + 1))} title="ALG" />,
        <span key="s" className={dim}>{` ${t("fm6Carriers")} ${FM6.carriers(alg).join(" ")}, ${t("fm6Feedback")} OP${fb}`}</span>)}
      {row("FB", N(V.FB, "FB"), " OKS ", N(V.OKS, "OKS"), " TRNSP ", N(V.TRNSP, "TRNSP"))}
      {row("LFO", <Sel key="w" i={V.LFW} names={FM6_WAVES} title="WAVE" />, " SPD ", N(V.LFS, "SPEED"), " DLY ", N(V.LFD, "DELAY"),
        " PMD ", N(V.LPMD, "PMD"), " AMD ", N(V.LAMD, "AMD"), " PMS ", N(V.LPMS, "PMS"), " SYNC ", N(V.LKS, "SYNC"))}
      {row(t("fm6PitchEg"), "R ", ...[0, 1, 2, 3].map((k) => N(V.PR1 + k, "R" + (k + 1))),
        " L ", ...[0, 1, 2, 3].map((k) => N(V.PL1 + k, "L" + (k + 1))))}
    </tbody></table>
  );
}
function Ops() {
  const car = FM6.carriers(FS.v[FM6.VI.ALG]);
  return (
    <>
      <div className="fm6ops overflow-x-auto [&_td]:px-[3px] [&_td]:py-px [&_th]:px-[3px] [&_th]:py-px">
        <table><tbody>
          <tr><th>OP</th>{FM6.OP.map(([n]) => <th key={n}>{n}</th>)}<th>{t("fm6Freq")}</th></tr>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <tr key={n}>
              <td>{`${n}${car.includes(n) ? " ●" : ""}`}</td>
              {FM6.OP.map(([f]) => (
                <td key={f}>{f === "LC" || f === "RC" ? <Sel i={FM6.at(n, f)} names={FM6_CURVES} title={f} />
                  : f === "MODE" ? <Sel i={FM6.at(n, f)} names={["RATIO", "FIXED"]} title={f} />
                  : <Num i={FM6.at(n, f)} title={`OP${n} ${f}`} />}</td>
              ))}
              <td className={dim}>{FM6.freqText(FS.v, n)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <p className={clsx(dim, "my-4")}>{t("fm6Legend")}</p>
    </>
  );
}
/* 2.5: the choice before the store: the bank only (PTCH), or also user presets (PRESETS / SELECT on the FM-1) */
function UpSelect() {
  const dev = A.dev, b = dev && dev.bank, free = b ? b.slots.filter((x) => !x.used).length : 0, total = b ? b.total : 32;
  return (
    <select id="fm6up" value={String(FS.up)}
      onChange={(e) => { FS.up = e.target.value === "none" || e.target.value === "free" ? e.target.value : +e.target.value; notify(); }}>
      <option value="none">{t("fm6UpNone")}</option>
      <option value="free">{t("fm6UpFree").replace("{k}", b ? String(free) : "?")}</option>
      {Array.from({ length: total }, (_, i) => <option key={i} value={String(i)}>{t("fm6UpFrom").replace("{u}", slotName(i))}</option>)}
    </select>
  );
}
/* the imported voices: click one to edit it; tick the ones that go to the bank (2.5: Store cartridge, B1.. in order) */
function Imported() {
  if (!FS.imported.length) return null;
  const dev = A.dev, nb = dev && dev.fm6 ? dev.fm6.bank : FM6.BANK_N, order = [...FS.tick].sort((a, b) => a - b), n = order.length;
  const tick = (k: number, on: boolean) => {
    if (on && FS.tick.size >= nb) { sayK("fm6CartFull", ` ${nb}`); notify(); return; }
    if (on) FS.tick.add(k); else FS.tick.delete(k);
    notify();
  };
  return (
    <div id="fm6imported">
      <p className={clsx(dim, "my-4")}>{t(FS.imported.length > 1 ? "fm6PickMany" : "fm6Pick")}</p>
      <div className="fm6list mt-1.5 mb-2.5 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1">
        {FS.imported.map((x, k) => {
          const at = order.indexOf(k);
          return (
            <span key={k} className={"fm6v flex min-w-0 items-center gap-1.5" + (at >= 0 ? " on" : "")}>
              <input type="checkbox" title={t("fm6CartTick")} checked={FS.tick.has(k)} onChange={(e) => tick(k, e.target.checked)} />
              <button type="button" className="min-w-0 flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap normal-case"
                onClick={() => { FS.v = Uint8Array.from(x.v); renderFm6(); sayK("fm6Picked", ` ${x.name}`); }}>{`${k + 1} ${x.name}`}</button>
              <span className={clsx(dim, "w-[2.6em]")}>{at >= 0 ? `B${at + 1}` : ""}</span>
            </span>
          );
        })}
      </div>
      {FS.imported.length > 1 || n ? (
        <>
          <p className={bar}><label htmlFor="fm6up">{t("fm6UpWhere") + " "}</label><UpSelect /></p>
          <p className={bar}>
            <button type="button" onClick={() => { FS.tick = new Set(FS.imported.slice(0, nb).map((_, k) => k)); notify(); }}>
              {t("fm6CartFirst").replace("{n}", String(Math.min(nb, FS.imported.length)))}</button>
            <button type="button" onClick={() => { FS.tick.clear(); notify(); }}>{t("fm6CartNone")}</button>
            <button type="button" className={pri} disabled={!n || !fm6Ok()} onClick={fm6StoreCart}>
              {t("fm6Cart").replace("{n}", String(n)).replace("{b}", n ? `B1–B${n}` : "B1")}</button>
          </p>
        </>
      ) : null}
    </div>
  );
}
function Slots() {
  const fm6 = A.dev!.fm6!, n = fm6.factory + fm6.bank, cur = curSlot();
  return (
    <select id="fm6slot" value={cur} onChange={(e) => { FS.slot = +e.target.value; notify(); }}>
      {Array.from({ length: n }, (_, i) => {
        const x = fm6.slots[i];
        return <option key={i} value={i}>{`${fm6SlotName(i)} ${x && x.used ? x.name : t("empty")}`}</option>;
      })}
    </select>
  );
}

const H3 = ({ children }: { children?: ReactNode }) => <h3 className="mt-4 mb-1.5 uppercase text-dim">{children}</h3>;
const hasFiles = (e: DragEvent) => [...(e.dataTransfer.types || [])].includes("Files");

/* the panel: only while the selected track plays FM6 */
export default function Fm6Panel() {
  useApp();
  if (!fm6On()) return null;
  return (
    <div id="fm6panel"
      /* 2.5: drop a .syx on the FM6 panel */
      onDragOver={(e) => { if (!hasFiles(e)) return; e.preventDefault(); if (!FS.drop) { FS.drop = true; notify(); } }}
      onDragLeave={(e) => { if (e.target === e.currentTarget) { FS.drop = false; notify(); } }}
      onDrop={(e) => {
        e.preventDefault();
        FS.drop = false;
        notify();
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) fm6ImportFile(f);
      }}>
      <Card title={t("fm6Title")} ic="ui_knob" className={FS.drop ? "outline-2 outline-dashed outline-trk [outline-offset:-6px]" : ""}>
        <Help>{t("fm6Help")}</Help>
        <p className={bar}>
          <button id="fm6read" onClick={() => op(() => fm6ReadTrack(false))}>{t("fm6ReadBtn")}</button>{" "}
          <button id="fm6send" className={pri} onClick={() => op(() => fm6Send(false))}>{t("fm6SendBtn")}</button>
          <label><input type="checkbox" id="fm6live" checked={FS.live} onChange={(e) => { FS.live = e.target.checked; notify(); }} />{" "}
            <span>{t("fm6Live")}</span></label>
        </p>
        <p className={bar}>
          <label><span>{t("fm6Slot")}</span> <Slots /></label>
          <button id="fm6load" onClick={fm6Load}>{t("load")}</button>{" "}
          <button id="fm6store" onClick={fm6Store}>{t("fm6StoreBtn")}</button>
          <button id="fm6erase" className={warn} onClick={fm6Erase}>{t("erase")}</button>
        </p>
        <p className={bar}>
          <button id="fm6import" onClick={async () => fm6ImportFile(await pickFile(".syx,.SYX,.bin,application/octet-stream"))}>
            <Ic ic="symbol_upload">{t("fm6Import")}</Ic></button>
          <button id="fm6export" onClick={fm6Export}><Ic ic="symbol_download">{t("fm6Export")}</Ic></button>
          <button id="fm6bankexp" onClick={fm6BankExport}><Ic ic="symbol_download">{t("fm6BankExport")}</Ic></button>
          <button id="fm6init" onClick={() => { FS.v = FM6.init(); renderFm6(); }}>{t("fm6Init")}</button>{" "}
          <span className={dim}>{t("fm6Drop")}</span>
        </p>
        <Imported />
        <H3>{t("fm6Voice")}</H3>
        <div id="fm6voice" key={"v" + FS.ver}><Voice /></div>
        <H3>{t("fm6Ops")}</H3>
        <div id="fm6ops" key={"o" + FS.ver}><Ops /></div>
      </Card>
    </div>
  );
}
