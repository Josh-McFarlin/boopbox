// SPDX-License-Identifier: GPL-3.0-only
/* ------------------------------------------------------------ files --- */
/* the selected track's sound as a file (felucca-patch): its engine, preset, every value and its steps */
import { A, download, fileSlug, getDump, notify, pickFile, rq, sayK, report, selfLoad } from "../../core/app.ts";
import { rereadEngineDesc } from "../../core/device.ts";
import { CMD, parse, patchByCount, req } from "../../lib/proto.ts";
import { visible } from "../../ui/kit.tsx";

export function saveFile() {
  const dev = A.dev;
  if (!dev) return;
  const engine = dev.dump.engine, preset = dev.dump.preset;
  const data = { format: "felucca-patch", version: 1, firmware: dev.info.version,
    pCount: dev.info.pcount, pE0: dev.info.pe0,      /* (2.6: read by count on another version, patchByCount) */
    engineName: dev.info.engines[engine], presetName: (dev.names[engine] || [])[preset],
    engine, preset, p: dev.dump.p.slice(), g: dev.dump.g.slice(),
    steps: dev.steps.map((s) => ({ n: s.n, notes: s.notes.slice(), time: s.time, flags: s.flags, vel: s.vel })) };
  download(`felucca-${fileSlug(data.engineName || "patch")}-${fileSlug(data.presetName || preset)}.json`, data);
}

export async function loadFile() {
  const f = await pickFile(".json,application/json");
  const dev = A.dev;
  if (!f || !dev) return;
  let data;
  try {
    data = JSON.parse(await f.text());
    if (!Number.isInteger(data.engine) || !Number.isInteger(data.preset) || !Array.isArray(data.p)) throw new Error("engine / preset / p");
    if (data.engine < 0 || data.engine >= dev.info.nengines) throw new Error("engine " + data.engine);
  } catch (e) { sayK("badfile", e.message); return; }
  A.busy++;
  notify();
  try {
    selfLoad();
    await rq(req.preset(data.engine, data.preset));
    dev.dump = await getDump();
    await rereadEngineDesc();
    const pv = patchByCount(data.p, data.pE0, dev.info.pcount), n = pv.length;   /* (a file of another version) */
    for (let i = 0; i < n; i++) {
      const d = dev.pdesc[i];
      if (!visible(d) || !Number.isFinite(pv[i])) continue;
      if (i % 8 === 0) sayK("applying", `${i}/${n}`);
      await rq(req.set(0, i, pv[i]));
    }
    if (Array.isArray(data.steps)) {
      const m = Math.min(data.steps.length, dev.info.nstep);
      for (let i = 0; i < m; i++) {
        const s = data.steps[i] || {};
        if (i % 8 === 0) sayK("applying", `steps ${i}/${m}`);
        dev.steps[i] = parse[CMD.STEP_SET](await rq(req.stepSet(i, {
          n: s.n | 0, notes: Array.isArray(s.notes) ? s.notes : [0, 0, 0, 0], time: s.time ?? 2, flags: s.flags | 0, vel: s.vel | 0 })));
      }
    }
    dev.dump = await getDump();
    notify();                                         /* the browser, the controls, the step tables */
    sayK("applied");
  } catch (err) { report(err); } finally { A.busy--; notify(); }
}
