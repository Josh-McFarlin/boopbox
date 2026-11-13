// SPDX-License-Identifier: GPL-3.0-only
/* ------------------------------------------------------------ files --- */
/* the selected track's sound as a file (felucca-patch): its engine, preset, every value and its steps */
import { A, download, fileSlug, getDump, notify, pickFile, rq, sayK, report, selfLoad } from "../../core/app.ts";
import { rereadEngineDesc } from "../../core/device.ts";
import { CMD, parse, patchByCount, req } from "../../lib/proto.ts";
import type { Step } from "../../lib/proto.ts";
import { visible } from "../../ui/kit.tsx";

/* a felucca-patch file (saveFile); as read back, any field may be missing or of another type until checked */
export interface PatchFile {
  format: string; version: number; firmware: string; pCount: number; pE0: number; engineName: string; presetName: string;
  engine: number; preset: number; p: number[]; g: number[]; steps: Step[];
}
type PatchFileIn = Partial<Omit<PatchFile, "p" | "steps">> & { p: unknown[]; steps?: (Partial<Step> | null)[] };

export function saveFile(): void {
  const dev = A.dev;
  if (!dev || !dev.dump || !dev.info) return;
  const engine = dev.dump.engine, preset = dev.dump.preset;
  const data: PatchFile = { format: "felucca-patch", version: 1, firmware: dev.info.version,
    pCount: dev.info.pcount, pE0: dev.info.pe0,      /* (2.6: read by count on another version, patchByCount) */
    engineName: dev.info.engines[engine], presetName: (dev.names[engine] || [])[preset],
    engine, preset, p: dev.dump.p.slice(), g: dev.dump.g.slice(),
    steps: dev.steps.map((s) => ({ n: s.n, notes: s.notes.slice(), time: s.time, flags: s.flags, vel: s.vel })) };
  download(`felucca-${fileSlug(data.engineName || "patch")}-${fileSlug(data.presetName || preset)}.json`, data);
}

export async function loadFile(): Promise<void> {
  const f = await pickFile(".json,application/json");
  const dev = A.dev;
  if (!f || !dev || !dev.info) return;
  const info = dev.info;
  let data: PatchFileIn;
  try {
    data = JSON.parse(await f.text());
    if (!Number.isInteger(data.engine) || !Number.isInteger(data.preset) || !Array.isArray(data.p)) throw new Error("engine / preset / p");
    if (data.engine! < 0 || data.engine! >= info.nengines) throw new Error("engine " + data.engine);
  } catch (e) { sayK("badfile", (e as Error).message); return; }
  A.busy++;
  notify();
  try {
    selfLoad();
    await rq(req.preset(data.engine!, data.preset!));
    dev.dump = await getDump();
    await rereadEngineDesc();
    const pv = patchByCount(data.p, data.pE0, info.pcount), n = pv.length;   /* (a file of another version) */
    for (let i = 0; i < n; i++) {
      const d = dev.pdesc[i];
      if (!visible(d) || !Number.isFinite(pv[i])) continue;
      if (i % 8 === 0) sayK("applying", `${i}/${n}`);
      await rq(req.set(0, i, pv[i] as number));
    }
    if (Array.isArray(data.steps)) {
      const m = Math.min(data.steps.length, info.nstep);
      for (let i = 0; i < m; i++) {
        const s = data.steps[i] || {};
        if (i % 8 === 0) sayK("applying", `steps ${i}/${m}`);
        dev.steps[i] = parse[CMD.STEP_SET](await rq(req.stepSet(i, {
          n: s.n! | 0, notes: Array.isArray(s.notes) ? s.notes : [0, 0, 0, 0], time: s.time ?? 2, flags: s.flags! | 0, vel: s.vel! | 0 })));
      }
    }
    dev.dump = await getDump();
    notify();                                         /* the browser, the controls, the step tables */
    sayK("applied");
  } catch (err) { report(err); } finally { A.busy--; notify(); }
}
