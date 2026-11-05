// SPDX-License-Identifier: GPL-3.0-only
// The web page's songs (web/songgen.js), before any audio: scores written as the analysis writes them become songs for
// level 4 that the firmware's checks accept; tests/trainer_test.c then plays each to DONE with the panel alone
// (TR_SONGS). Also: the steps are as lessons.py makes them (the same kinds), a wrong score is refused.
//   node tests/trainer_song_test.mjs CONSTS.json OUTDIR      (writes OUTDIR/song-*.bin, prints their paths)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { makeLesson, checkScore } from "../web/songgen.js";
import { encodeSong, describeSong } from "../web/trslot.js";
import { programOf, SongEngine, PART_TRACK } from "../web/songplay.js";
import { checkPalettes, styleFor } from "../web/songsounds.js";

const [consts, out] = process.argv.slice(2);
const C = JSON.parse(readFileSync(consts, "utf8"));
mkdirSync(out, { recursive: true });
let fails = 0;
const check = (ok, what) => { console.log(`song: ${what.padEnd(90)} ${ok ? "ok" : "FAIL"}`); fails += !ok; };
const lane = (s) => [...s.replace(/ /g, "")].map((c) => (c === "x" ? 1 : 0));
const n = (s) => (s === "." ? null : s);

// level 1's score, as the page would write it (tools/trainer/songs.py FIRST LIGHT; the chords as typed triads)
const first = {
  name: "FIRST LIGHT", bpm: 86, root: 9, scale: "MIN",
  drums: { kit: "LO-FI", lanes: { KICK: lane("x... ...x ..x. ...."), SNARE: lane(".... x... .... x..."),
                                  HAT: lane("x.x. x.x. x.x. x.x.") } },
  bass: { sound: "808 BOOM", div: "1/4", steps: [57, null, null, 57, 62, null, null, null, 65, null, null, 65, 64, null, 67, null] },
  chords: { sound: "RHODES", steps: [[57, 60, 64], [62, 65, 69], [65, 69, 72], [64, 67, 71]] },
  lead: { sound: "KALIMBA", div: "1/8", steps: [76, null, 79, 81, null, 79, 76, null, 74, null, 72, 74, null, 69, null, null] },
};
// a major song with every lane the page writes, sixteenth notes, two chords
const bright = {
  name: "Sunny side", bpm: 122, root: 7, scale: "MAJ",
  drums: { kit: "HOUSE", lanes: { KICK: lane("x... x... x... x..."), CLAP: lane(".... x... .... x..."),
                                  HAT: lane("..x. ..x. ..x. ..x."), OHAT: lane("...x ...x ...x ...x") } },
  bass: { sound: "FM BASS", div: "1/8", steps: [55, null, 55, 62, null, 55, 60, null, 52, null, 52, 59, null, 52, 57, 59] },
  chords: { sound: "SAW PAD", steps: [[55, 59, 62], [60, 64, 67]] },
  lead: { sound: "PWM LEAD", div: "1/16", steps: [74, null, 76, null, 78, null, 79, null, 78, 76, null, 74, null, null, 71, null] },
};
// drums and a bass only
const sparse = {
  name: "TWO PARTS", bpm: 92, root: 2, scale: "MIN",
  drums: { kit: "BOOMBAP", lanes: { KICK: lane("x... .... x.x. ...."), SNARE: lane(".... x... .... x...") } },
  bass: { sound: "SUB BASS", div: "1/8", steps: [50, null, null, 50, null, null, 53, null, 50, null, null, 57, null, 55, 53, null] },
};

// a whole song: three sections (an intro without drums or bass, a verse, a chorus with its own beat, bass and lead), a song
// of seven parts (patterns per section, the sections saved, the song in song mode: as level 3)
const L = (s) => lane(s), off = new Array(16).fill(0);
const whole = {
  name: "THREE PARTS", bpm: 100, root: 9, scale: "MIN", kit: "SYNTHWV",
  sounds: { bass: "SAW BASS", chords: "SAW PAD", lead: "PWM LEAD" }, bassDiv: "1/4", leadDiv: "1/8",
  sections: [
    { drums: null, bass: null, chords: { steps: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] }, lead: null },
    { drums: { lanes: { KICK: L("x...x...x...x..."), SNARE: L("....x.......x..."), CLAP: off, HAT: L("..x...x...x...x."), OHAT: off } },
      bass: { steps: [57, null, null, null, 53, null, null, null, 55, null, null, null, 52, null, null, null] },
      chords: { steps: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] }, lead: null },
    { drums: { lanes: { KICK: L("x...x...x...x..."), SNARE: L("....x.......x..."), CLAP: L("....x.......x..."), HAT: L("x.x.x.x.x.x.x.x."), OHAT: off } },
      bass: { steps: [57, null, 57, null, 53, null, 53, null, 55, null, 55, null, 52, null, 52, null] },
      chords: { steps: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] },
      lead: { steps: [76, null, 79, null, 81, null, 79, 76, 74, null, 72, null, 74, null, null, null] } },
  ],
  song: [[0, 4], [1, 8], [2, 8], [1, 8], [2, 8], [2, 8], [0, 4]],
};

// dubstep: half-time (the snare on beat 3, step 9), the DUBSTEP style's sounds (web/songsounds.js), an intro and a drop
const half = (s) => lane(s);
const dub = {
  name: "HALF TIME", bpm: 140, root: 5, scale: "MIN", kit: "DUBSTEP",
  sounds: { bass: "WOBBLE", chords: "DARK STR", lead: "SUPERSAW" }, bassDiv: "1/4", leadDiv: "1/8",
  sections: [
    { drums: null, bass: null, chords: { steps: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]] }, lead: null },
    { drums: { lanes: { KICK: half("x.........x....."), SNARE: half("........x......."), CLAP: off, HAT: half("..x...x...x...x."), OHAT: off } },
      bass: { steps: [53, null, null, null, 49, null, null, null, 56, null, null, null, 51, null, null, null] },
      chords: { steps: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]] },
      lead: { steps: [72, null, 75, null, 77, null, 75, 72, 70, null, 68, null, 70, null, null, null] } },
  ],
  song: [[0, 8], [1, 16], [0, 4], [1, 16]],
};

const paths = [];
for (const [i, s] of [first, bright, sparse, whole, dub].entries()) {
  const bad = checkScore(s, C);
  check(!bad.length, `score ${s.name}: playable on the FM-1 ${bad.join("; ")}`);
  const song = makeLesson(s, C), area = encodeSong(song), d = describeSong(area);
  check(d && d.cards === song.cards.length && d.used <= 8192,
        `${song.name}: ${song.cards.length} steps, ${d && d.used} of 8192 B`);
  const kinds = new Set(song.cards.map((c) => c.goal));
  const kindsOk = s.sections ? [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 18] : [0, 1, 2, 3, 4, 5, 6, 8, 9, 18];
  check([...kinds].every((g) => kindsOk.includes(g)), `${song.name}: only the kinds of step the built-in levels have`);
  if (s === dub) {
    const h = song.cards.find((c) => c.head === "HALF-TIME: SNARE ON 9");
    check(!!h && C.TOPICS[h.why] === "HALFTIME" && checkPalettes(C).length === 0 && styleFor(140, true).name === "DUBSTEP" &&
          styleFor(140).name !== "DUBSTEP", `${song.name}: the half-time snare step (why: HALFTIME); DUBSTEP for a half-time 140`);
  }
  if (s.sections && s !== dub) {
    const n = (g) => song.cards.filter((c) => c.goal === C.TG[g]).length;
    check(n("TG_SAVED") === 3 && n("TG_SONG") === 2 && n("TG_SONGMODE") === 1 && n("TG_PATSEL") >= 2,
          `${song.name}: ${n("TG_PATSEL")} patterns chosen, 3 sections saved, the song, song mode`);
  }
  const p = `${out}/song-${i + 1}.bin`;
  writeFileSync(p, area);
  paths.push(p);
}
{
  const wrong = { ...first, bass: { ...first.bass, steps: [58, ...first.bass.steps.slice(1)] } };   // A# in A minor
  check(checkScore(wrong, C).length === 1, "a note out of the key is refused");
  let threw = false;
  try { makeLesson({ ...first, bass: { ...first.bass, sound: "NO SUCH" } }, C); } catch { threw = true; }
  check(threw, "a sound the trainer does not have is refused");
}
// the page's FM-1 player (BoopBox's engines in WebAssembly, build/preview: tools/build_preview.py): each part sounds
const wasm = process.env.PREVIEW_WASM;
if (wasm) {
  const mod = new WebAssembly.Module(readFileSync(wasm)), song = makeLesson(first, C);
  const rms = (solo) => {
    const e = new SongEngine(mod, C);
    e.load(programOf(song, C));
    for (const [part, k] of Object.entries(PART_TRACK)) e.mute(k, solo && part !== solo);
    e.play(true);
    const L = new Float32Array(44100 * 6), R = new Float32Array(L.length);
    e.render(L, R);
    let s = 0;
    for (let i = 0; i < L.length; i++) s += L[i] * L[i] + R[i] * R[i];
    return 20 * Math.log10(Math.sqrt(s / (2 * L.length)) + 1e-9);
  };
  {   // rendered before any song is loaded (the audio thread starts at once): no trap, silence
    const e = new SongEngine(mod, C), L = new Float32Array(44100), R = new Float32Array(L.length);
    let ok = true;
    try { e.render(L, R); } catch { ok = false; }
    check(ok && L.every((x) => x === 0), "the FM-1 player before a song: silence, no trap");
  }
  const all = rms(null);
  check(all > -40, `the FM-1 player: the whole song plays (${all.toFixed(1)} dBFS rms)`);
  for (const part of Object.keys(PART_TRACK)) {
    const v = rms(part);
    check(v > -50 && v < all + 1, `  ${part} on its own (the others muted): ${v.toFixed(1)} dBFS`);
  }
  {   // the whole song in song mode: no drums in the intro (section A), drums in the verse (B); the song ends
    const e = new SongEngine(mod, C), prog = programOf(makeLesson(whole, C), C);
    check(prog.sections.length === 3 && prog.song.length === 7, `the FM-1 player: ${prog.sections.length} sections, a song of ${prog.song.length} parts`);
    e.load(prog);
    e.setMode(true);
    for (const k of [0, 1, 2]) e.mute(k, true);          // (the drums alone)
    e.play(true);
    const bar = Math.round((240 / 100) * 44100), part = (bars) => {
      const L = new Float32Array(bar * bars), R = new Float32Array(L.length);
      e.render(L, R);
      return 20 * Math.log10(Math.sqrt(L.reduce((a, x) => a + x * x, 0) / L.length) + 1e-9);
    };
    const intro = part(4), verse = part(4);
    check(intro < -60 && verse > -40, `  the intro without drums (${intro.toFixed(0)} dBFS), then the verse with them (${verse.toFixed(0)} dBFS)`);
    part(48 - 8 + 2);                                    // (to the end: 48 bars)
    check(!e.want, "  the song ends after its 48 bars");
  }
} else console.log("song: (the player not checked: PREVIEW_WASM unset)");
console.log(`song: ${fails ? "FAIL" : "PASS"}`);
console.log("SONGS=" + paths.join(":"));
process.exit(fails ? 1 : 0);
