// SPDX-License-Identifier: GPL-3.0-only
// The web page's listening (web/songanalyze.js, Basic Pitch included) on the trainer's own renders, whole, whose scores
// are known (tools/trainer/songs.py): the tempo, the key, the sections and the song, the drums; then that song
// for the FM-1 (web/songgen.js), for tests/trainer_test.c to play (TR_SONGS).
//   node tests/trainer_analyze_test.mjs CONSTS.json OUTDIR build/trainer/1-first-light.wav ...
//   (python3 tools/trainer/render.py writes the renders)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import vm from "vm";
import { createRequire } from "module";
import * as A from "../web/songanalyze.js";
import { fitLesson, checkScore } from "../web/songgen.js";
import { encodeSong } from "../web/trslot.js";
import { styleSounds, styleFor } from "../web/songsounds.js";

globalThis.require = createRequire(import.meta.url);                 // (TensorFlow.js asks for it in Node)
vm.runInThisContext(readFileSync(new URL("../web/vendor/tfjs/tf.min.js", import.meta.url), "utf8"));   // (as <script>: globalThis.tf)
const BP = await import("../web/vendor/basic-pitch/inference.js");
const TM = await import("../web/vendor/basic-pitch/toMidi.js");
const [consts, out, ...wavs] = process.argv.slice(2);
const C = JSON.parse(readFileSync(consts, "utf8"));
mkdirSync(out, { recursive: true });
let fails = 0;
const check = (ok, what) => { console.log(`analyze: ${what.padEnd(88)} ${ok ? "ok" : "FAIL"}`); fails += !ok; };

function model() {
  const dir = new URL("../web/vendor/basic-pitch/", import.meta.url), mj = JSON.parse(readFileSync(new URL("model.json", dir)));
  const w = readFileSync(new URL(mj.weightsManifest[0].paths[0], dir));
  return tf.loadGraphModel(tf.io.fromMemory({ modelTopology: mj.modelTopology, weightSpecs: mj.weightsManifest[0].weights,
    weightData: w.buffer.slice(w.byteOffset, w.byteOffset + w.length), format: mj.format }));
}
function wav(path) {                                   // 16-bit PCM
  const b = readFileSync(path);
  let o = 12, rate = 0, ch = 0, data = null;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(o + 10); rate = b.readUInt32LE(o + 12); }
    if (id === "data") data = b.subarray(o + 8, o + 8 + n);
    o += 8 + n + (n & 1);
  }
  const frames = data.length / 2 / ch, chans = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) chans[c][i] = data.readInt16LE((i * ch + c) * 2) / 32768;
  return { rate, chans };
}
// what the trainer's songs are (tools/trainer/songs.py): the tempo, the key, level 1's beat, the sections at least
const TRUTH = {
  "1-first-light": { bpm: 86, root: 9, scale: "MIN", KICK: [0, 7, 10], SNARE: [4, 12], sections: 1, halftime: false },
  "2-neon-avenue": { bpm: 104, root: 2, scale: "MIN", sections: 2, halftime: false },   // VERSE 4, CHORUS 8, VERSE 4, CHORUS 8
  "3-lanterns-cinematic-dm-one-chord": { bpm: 150, root: 2, scale: "MIN", sections: 3, halftime: true },   // melodic dubstep
};
const bp = { BasicPitch: BP.BasicPitch, outputToNotesPoly: TM.outputToNotesPoly, noteFramesToTime: TM.noteFramesToTime };
const m = model();
const paths = [];
const lanes = (d) => (l) => d.lanes[l].map((h) => (h ? "x" : ".")).join("");
for (const path of wavs) {
  const name = path.split("/").pop().replace(/\.wav$/, ""), truth = TRUTH[name];
  const { rate, chans } = wav(path), x = A.resample(A.mono(chans), rate);
  const t = Date.now();
  const r = await A.analyzeSong(x, { ...bp, model: m });
  const score = A.songScoreOf(r), secs = ((Date.now() - t) / 1000).toFixed(1);
  const form = score.song.map(([g, n]) => "ABCD"[g] + n).join(" ");
  console.log(`analyze: ${name}: ${secs} s for ${(x.length / A.RATE).toFixed(0)} s, ${score.bpm} BPM, key ${score.root} ${score.scale}, ` +
              `${score.sections.length} sections, the song ${form}`);
  score.sections.forEach((sc, i) => {
    console.log(`  ${"ABCD"[i]}: drums ${sc.drums ? ["KICK", "SNARE", "HAT"].map(lanes(sc.drums)).join(" ") : "-"}`);
    console.log(`     bass ${JSON.stringify(sc.bass?.steps || null)} chords ${JSON.stringify(sc.chords?.steps || null)}`);
    console.log(`     lead ${JSON.stringify(sc.lead?.steps || null)}`);
  });
  if (truth) {
    check(Math.abs(score.bpm - truth.bpm) <= 1, `${name}: the tempo (${score.bpm}, the song ${truth.bpm})`);
    check(score.root === truth.root && score.scale === truth.scale, `${name}: the key (${score.root} ${score.scale})`);
    check(score.sections.length >= truth.sections, `${name}: ${score.sections.length} sections (at least ${truth.sections}): ${form}`);
    const style = styleFor(score.bpm, score.halftime).name;
    check(score.halftime === truth.halftime && (style === "DUBSTEP") === truth.halftime,
          `${name}: ${score.halftime ? "half-time" : "a backbeat"}, the style ${style}`);
    if (truth.KICK) {                                   // (the best section's beat: level 1 opens without drums)
      const f1 = (got, want) => (2 * got.filter((i) => want.includes(i)).length) / (got.length + want.length || 1);
      const hits = (d, l) => d.lanes[l].flatMap((h, i) => (h ? [i] : []));
      const best = Math.max(...score.sections.filter((s) => s.drums).map((s) => Math.min(f1(hits(s.drums, "KICK"), truth.KICK),
                                                                                      f1(hits(s.drums, "SNARE"), truth.SNARE))));
      check(best >= 0.7, `${name}: the kick and the snare (the best section: F1 ${best.toFixed(2)})`);
    }
  }
  const full = { ...score, name, ...styleSounds(styleFor(score.bpm, score.halftime)), bassDiv: "1/4", leadDiv: "1/8" };
  const bad = checkScore(full, C);
  check(!bad.length, `${name}: a score the FM-1 can play ${bad.join("; ")}`);
  const fit = fitLesson(full, C, encodeSong), p = `${out}/heard-${name}.bin`;
  console.log(`analyze: ${name}: ${fit.lesson.cards.length} steps, ${fit.area[8] | (fit.area[9] << 8)} B${fit.notes.length ? " (" + fit.notes.join("; ") + ")" : ""}`);
  writeFileSync(p, fit.area);
  paths.push(p);
}
console.log(`analyze: ${fails ? "FAIL" : "PASS"}`);
console.log("SONGS=" + paths.join(":"));
process.exit(fails ? 1 : 0);
