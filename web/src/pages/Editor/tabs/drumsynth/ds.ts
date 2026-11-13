// SPDX-License-Identifier: GPL-3.0-only
/* ---- SLOOP 2.5: the DRUM SYNTH page (firmware v10, editor_dsyn.c): SYN1..SYN4, your synthesised kits ----
   Every change goes to the FM-1's RAM at once (the drum voices play from there); STORE keeps the four kits in flash
   (with the settings, the song stopped). A sound's values as the firmware's dsnd_t (DSYN.decode / encode). */
import { CMD, DSYN, parse, req } from "../../lib/proto.ts";
import type { DsynKit, DsynList, DsynSound } from "../../lib/proto.ts";
import type { Dev } from "../../core/app.ts";
import { A, downloadBytes, drumFocus, fileSlug, hasTracks, notify, op, pickFile, rq, sayK, t } from "../../core/app.ts";
import { afterSoundChange, userSet } from "../../core/device.ts";

/* from: the kit chosen to copy from (null: the one the kit started from); auto: play the sound after a change */
/* a value's look: the text and its unit */
export type DsShown = [txt: string | number, unit?: string];
/* a value of a sound: [key, label, min, max, format -> [value, unit], the names of a choice] */
export type DsSpec = [key: keyof DsynSound, label: string, min: number, max: number, fmt: (v: number, o: DsynSound) => DsShown, names?: string[]];
/* the page's state: the device the kits were read from, its list, the kit shown (k, kit), the sound (lane), the kit it
   started from (src), the sounds not sent yet (pend) */
export interface DsState {
  dev: Dev | null; list: DsynList | null; k: number; kit: DsynKit | null; lane: number; src: { sounds: Uint8Array[] } | null; err: string;
  timer: ReturnType<typeof setTimeout> | number; pend: Set<number>; from: number | null; auto: boolean;
}
export const DS: DsState = { dev: null, list: null, k: 0, kit: null, lane: 0, src: null, err: "", timer: 0, pend: new Set(), from: null, auto: true };
export const dsOk = () => !!A.dev && !!A.dev.info && A.dev.info.proto >= 10;
export const dsKitName = (k: number = DS.k): string => `SYN${k + 1}`;
const dsMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}` : `${Math.round(ms)}`);
const dsHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k` : `${Math.round(hz)}`);
const NOTE12 = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const dsNote = (n: number) => `${NOTE12[n % 12]}${Math.floor(n / 12) - 1}`;
/* the page's values: [key, label, min, max, format -> [value, unit]] by group */
export const DS_GROUPS: [title: string, specs: DsSpec[]][] = [
  ["dsTone", [
    ["wave", "WAVE", 0, 5, (v) => [DSYN.WAVES[v]], DSYN.WAVES],
    ["pitch", "PITCH", 0, 127, (v, o) => [dsNote(v), `${dsHz(DSYN.hz(v, o.fine))} Hz`]],
    ["fine", "FINE", 0, 15, (v) => [`+${v}`, "/16"]],
    ["bend", "BEND", 0, 96, (v) => [v, "st"]],
    ["btime", "B.TIME", 0, 127, (v) => [dsMs(DSYN.decayMs(v)), DSYN.decayMs(v) >= 1000 ? "s" : "ms"]],
    ["hold", "HOLD", 0, 255, (v) => [v * 2, "ms"]],
    ["decay", "DECAY", 0, 127, (v) => [dsMs(DSYN.decayMs(v)), DSYN.decayMs(v) >= 1000 ? "s" : "ms"]],
    ["tlev", "LEVEL", 0, 127, (v) => [v]],
    ["t2", "2ND", 0, 255, (v) => (v ? [`×${(v / 32).toFixed(2)}`] : ["OFF"])],
    ["t2lev", "2ND LVL", 0, 127, (v) => [v]],
    ["click", "CLICK", 0, 127, (v) => [v]]]],
  ["dsNoise", [
    ["noise", "NOISE", 0, 4, (v) => [DSYN.NOISES[v]], DSYN.NOISES],
    ["clap", "CLAP", 0, 1, (v) => [v ? "ON" : "OFF"], ["OFF", "ON"]],
    ["nlev", "LEVEL", 0, 127, (v) => [v]],
    ["nhold", "HOLD", 0, 255, (v) => [v * 2, "ms"]],
    ["ndec", "DECAY", 0, 127, (v) => [dsMs(DSYN.decayMs(v)), DSYN.decayMs(v) >= 1000 ? "s" : "ms"]],
    ["hpf", "HPF", 0, 127, (v) => (v ? [dsHz(DSYN.cutHz(v)), "Hz"] : ["OFF"])],
    ["chip", "CHIP", 0, 127, (v) => (v ? [dsHz(DSYN.hz(v) * 8), "Hz"] : ["-"])]]],
  ["dsFilter", [
    ["fmode", "FILTER", 0, 3, (v) => [DSYN.FMODES[v]], DSYN.FMODES],
    ["fall", "ON", 0, 1, (v) => [v ? "ALL" : "NOISE"], ["NOISE", "ALL"]],
    ["fcut", "CUTOFF", 0, 127, (v) => [dsHz(DSYN.cutHz(v)), "Hz"]],
    ["res", "RES", 0, 31, (v) => [Math.round((v * 100) / 31), "%"]],
    ["fenv", "ENV", -128, 127, (v) => [`${v > 0 ? "+" : ""}${(v / DSYN.STEPS_PER_OCT).toFixed(1)}`, "oct"]]]],
  ["dsOut", [
    ["drive", "DRIVE", 0, 127, (v) => [v]],
    ["level", "LEVEL", 0, 255, (v) => [`${v >= 128 ? "+" : ""}${DSYN.db(v).toFixed(1)}`, "dB"]]]],
];
export function dsSound(): DsynSound { return DSYN.decode(DS.kit!.sounds[DS.lane]); }
/* the value of the sound the kit started from (a double-click puts it back) */
export function dsDefault(key: keyof DsynSound): number {
  const f = DS.src && DS.src.sounds[DS.lane];
  return f ? DSYN.decode(f)[key] : dsSound()[key];
}
export function dsSet(key: keyof DsynSound, v: number, done: boolean): void {
  const o = dsSound();
  o[key] = v;
  DS.kit!.sounds[DS.lane] = DSYN.encode(o);
  DS.pend.add(DS.lane);
  dsDirty(true);
  clearTimeout(DS.timer);
  DS.timer = setTimeout(() => op(() => dsFlush(done && DS.auto)), done ? 0 : 80);
}
async function dsFlush(play: boolean): Promise<void> {
  const k = DS.k;
  for (const l of [...DS.pend]) {
    DS.pend.delete(l);
    const r = parse[CMD.DSYN_PUT](await rq(req.dsynSound(k, l, DS.kit!.sounds[l])));
    if (r.rc) { sayK("dsBad"); return; }
  }
  if (play) await dsPlay();
}
export async function dsPlay(lane: number = DS.lane): Promise<void> {
  const r = parse[CMD.DSYN_PLAY](await rq(req.dsynPlay(DS.k, lane, 110)));
  if (r.rc) sayK("dsBad");
}
function dsDirty(on: boolean): void {
  if (DS.list) DS.list.stored = !on && DS.list.stored;
  if (on && DS.list) DS.list.stored = false;
  notify();
}
export async function dsLoad(k: number = DS.k): Promise<void> {
  DS.list = parse[CMD.DSYN_LIST](await rq(req.dsynList()));
  const r = parse[CMD.DSYN_GET](await rq(req.dsynGet(DSYN.USER + k)));
  if (r.rc) throw new Error(`DSYN_GET rc ${r.rc}`);
  DS.k = k;
  DS.kit = { name: r.name!, crush: r.crush!, src: r.src!, sounds: r.sounds! };
  const f = parse[CMD.DSYN_GET](await rq(req.dsynGet(r.src!)));   /* the kit it started from: double-click resets to it */
  DS.src = f.rc ? null : { sounds: f.sounds! };
  notify();
}
/* the page shows (and the FM-1 is ready): the SYN kits, read once per connection */
export function dsShown(): void {
  if (DS.dev === A.dev) return;
  Object.assign(DS, { dev: A.dev, kit: null, list: null, k: 0, lane: 0, from: null });
  if (dsOk()) op(() => dsLoad(0));
  notify();
}
async function dsHead(): Promise<void> {
  const kit = DS.kit!;
  const r = parse[CMD.DSYN_PUT](await rq(req.dsynHead(DS.k, kit.name, kit.crush, kit.src)));
  if (r.rc) sayK("dsBad");
}

/* ---- the page's controls ---- */
export const dsPick = (k: number): void => { if (A.dev) op(() => dsLoad(k)); };
export function dsLane(l: number): void { DS.lane = l; notify(); op(() => dsPlay(l)); }
export function dsName(s: string): void {
  if (!DS.kit) return;
  DS.kit.name = s.replace(/[^\x20-\x7E]/g, "").slice(0, 8) || dsKitName();
  dsDirty(true);
  op(dsHead);
}
export function dsCrush(bits: number, sh: number): void {
  if (!DS.kit) return;
  DS.kit.crush = (bits & 15) | ((sh - 1) & 15) << 4;
  dsDirty(true);
  clearTimeout(DS.timer);
  DS.timer = setTimeout(() => op(dsHead), 80);
}
export function dsCopy(): void {
  if (!DS.kit) return;
  const i = DS.from ?? DS.kit.src;
  if (!confirm(t("dsCopyAsk").replace("{x}", DS.list!.names[i]).replace("{k}", dsKitName()))) return;
  op(async () => {
    const r = parse[CMD.DSYN_PUT](await rq(req.dsynCopy(DS.k, i)));
    if (r.rc) { sayK("dsBad"); return; }
    await dsLoad(DS.k);
    dsDirty(true);
    sayK("dsCopied", ` ${DS.list!.names[i]}`);
  });
}
export const dsStore = (): Promise<void> => op(async () => {
  const r = parse[CMD.DSYN_STORE](await rq(req.dsynStore(), { timeout: 5000, retries: 0 }));
  if (r.rc === 3) { sayK("dsStop"); return; }
  if (r.rc) { sayK("dsFlash"); return; }
  if (DS.list) DS.list.stored = true;
  dsDirty(false);
  sayK("dsSaved");
});
export function dsUse(): void {
  const dev = A.dev;
  if (!dev || !dev.info || !hasTracks() || !DS.kit) return;
  const info = dev.info;
  op(async () => {
    const drum = drumFocus();
    if (drum < 0) { sayK("kitNoKit"); return; }
    if (dev.sel !== drum) { dev.sel = parse[CMD.TRACK](await rq(req.track(drum))).sel; await afterSoundChange(); }
    const d = dev.pdesc[info.pe0], i = d && d.names ? d.names.indexOf(dsKitName()) : -1;
    if (i < 0) { sayK("kitNoKit"); return; }
    userSet(0, info.pe0, i + d!.min, true);
    sayK("kitUsing", dsKitName());
  });
}
export function dsSave(): void {
  if (!DS.kit) return;
  downloadBytes(`${fileSlug(DS.kit.name || dsKitName())}.sloopdrums.json`, new TextEncoder().encode(JSON.stringify(DSYN.toFile(DS.kit))));
}
export async function dsOpen(): Promise<void> {
  const f = await pickFile(".json,application/json");
  if (!f || !DS.kit) return;
  let kit: ReturnType<typeof DSYN.fromFile>;
  try { kit = DSYN.fromFile(JSON.parse(await f.text())); } catch (err) { sayK("dsFileBad"); return; }
  if (!confirm(t("dsOpenAsk").replace("{x}", kit.name).replace("{k}", dsKitName()))) return;
  op(async () => {
    DS.kit!.name = kit.name;
    DS.kit!.crush = kit.crush;
    for (let l = 0; l < DSYN.LANES; l++) {
      DS.kit!.sounds[l] = kit.sounds[l];
      const r = parse[CMD.DSYN_PUT](await rq(req.dsynSound(DS.k, l, kit.sounds[l])));
      if (r.rc) { sayK("dsBad"); return; }
    }
    await dsHead();
    dsDirty(true);
    sayK("dsOpened", ` ${kit.name}`);
  });
}
