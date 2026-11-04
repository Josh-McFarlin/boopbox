// SPDX-License-Identifier: GPL-3.0-only
// The web page's listening (web/songanalyze.js, Basic Pitch included) on the trainer's own renders, whose scores are
// known (tools/trainer/songs.py): the tempo, the key, the drums, the notes it hears, the song it writes; then that song
// for the FM-1 (web/songgen.js), for tests/trainer_test.c to play (TR_SONGS).
//   node tests/trainer_analyze_test.mjs CONSTS.json OUTDIR build/trainer/1-first-light.wav ...
//   (python3 tools/trainer/render.py writes the renders)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import vm from "vm";
import { createRequire } from "module";
import * as A from "../web/songanalyze.js";
import { makeLesson, checkScore } from "../web/songgen.js";
import { encodeSong } from "../web/trslot.js";
import { defaultSounds } from "../web/songsounds.js";

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
// what the trainer's songs are (tools/trainer/songs.py): level 1, level 2 (its verse)
const TRUTH = {
  "1-first-light": { bpm: 86, root: 9, scale: "MIN", KICK: [0, 7, 10], SNARE: [4, 12], drums: true },
  // (a saw bass on eighths under a four-on-the-floor kick: its onsets are in the kick's band; the drums are reported)
  "2-neon-avenue": { bpm: 104, root: 2, scale: "MIN", KICK: [0, 4, 8, 12], SNARE: [4, 12], drums: false },
};
const bp = { BasicPitch: BP.BasicPitch, outputToNotesPoly: TM.outputToNotesPoly, noteFramesToTime: TM.noteFramesToTime };
const m = model();
const paths = [];
for (const path of wavs) {
  const name = path.split("/").pop().replace(/\.wav$/, ""), truth = TRUTH[name];
  const { rate, chans } = wav(path), x = A.resample(A.mono(chans), rate).subarray(0, 30 * A.RATE);
  const t = Date.now();
  const r = await A.analyze(x, { ...bp, model: m });
  const score = A.scoreOf(r);
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  console.log(`analyze: ${name}: ${secs} s for 30 s, ${r.notes.length} notes, ${score.bpm} BPM, key ${score.root} ${score.scale}`);
  for (const l of ["KICK", "SNARE", "HAT"])
    console.log(`  ${l.padEnd(5)} ${score.drums.lanes[l].map((h) => (h ? "x" : ".")).join("")}`);
  console.log(`  bass  ${JSON.stringify(score.bass?.steps)}`);
  console.log(`  chord ${JSON.stringify(score.chords?.steps)}`);
  console.log(`  lead  ${JSON.stringify(score.lead?.steps)}`);
  if (truth) {
    check(Math.abs(score.bpm - truth.bpm) <= 1, `${name}: the tempo (${score.bpm}, the song ${truth.bpm})`);
    check(score.root === truth.root && score.scale === truth.scale, `${name}: the key (${score.root} ${score.scale})`);
    for (const l of ["KICK", "SNARE"]) {
      const got = score.drums.lanes[l].flatMap((h, i) => (h ? [i] : [])), want = truth[l];
      const hit = got.filter((i) => want.includes(i)).length, f1 = (2 * hit) / (got.length + want.length);
      const what = `${name}: the ${l.toLowerCase()} (steps ${got.map((i) => i + 1).join(" ")}; F1 ${f1.toFixed(2)})`;
      if (truth.drums) check(f1 >= 0.7, what);
      else console.log(`analyze: ${what} (reported)`);
    }
  }
  const full = { ...score, name, ...defaultSounds(score, C) };
  full.drums = { ...full.drums, kit: full.kit };
  const bad = checkScore(full, C);
  check(!bad.length, `${name}: a score the FM-1 can play ${bad.join("; ")}`);
  const area = encodeSong(makeLesson(full, C)), p = `${out}/heard-${name}.bin`;
  writeFileSync(p, area);
  paths.push(p);
}
console.log(`analyze: ${fails ? "FAIL" : "PASS"}`);
console.log("SONGS=" + paths.join(":"));
process.exit(fails ? 1 : 0);
