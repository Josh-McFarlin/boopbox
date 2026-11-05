// SPDX-License-Identifier: GPL-3.0-only
//
// A song for the trainer's level 4, from a score: the steps the coach shows, in the shape tools/trainer/lessons.py
// gives the built-in levels (the same goals, buttons, pages and "why" topics), for web/trslot.js to encode. C is
// tools/trainer/consts.json: the firmware's own numbers.
//
// score: {
//   name, bpm, root (0..11, C = 0), scale ("MIN" | "MAJ"),
//   kit, sounds: { bass, chords, lead }, bassDiv ("1/4" | "1/8"), leadDiv ("1/8" | "1/16"),
//   sections: [ {                                              up to four: A, B, C, D (the song's parts)
//     drums:  { lanes: { KICK: [16 x 0/1], SNARE, CLAP, HAT, OHAT } }      track 4, a bar of sixteenths
//     bass:   { steps: [16 x null | note] }                               track 1
//     chords: { steps: [1..8 x [notes]] }                                 track 2, a chord a bar (as many in each)
//     lead:   { steps: [16 x null | note] }                               track 3
//   } ],                                                       a part a section has not: null (muted there)
//   song: [[section, bars], ...]                               up to 16 entries (one section: no song, a loop)
// }   Notes are MIDI numbers as the FM-1's keys play them (C4 = 60). The one-loop form of before (drums, bass, chords,
//     lead at the top, each with its sound or kit and div) is taken too.
// A section's parts are patterns of their tracks (the same part twice: the same pattern); section A is built first,
// then the other sections' new patterns, then each section is saved (its patterns and mutes) and the song entered on
// the SONG screen, as level 3 does.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SCALE_STEPS = { MAJ: [0, 2, 4, 5, 7, 9, 11], MIN: [0, 2, 3, 5, 7, 8, 10] };
const DIV_HEAD = { "1/4": "ONE STEP A BEAT", "1/8": "EIGHTH NOTES", "1/16": "SIXTEENTH NOTES", "1BAR": "ONE STEP A BAR" };
const LANE_HEAD = {                                   // (the lane as the FM-1's screen names it: drums.c LANE_NAME)
  KICK: ["KICK: KNOB 1 TO KICK", "KICK"], SNARE: ["SNARE: KNOB 1 TO SNARE", "BACKBEAT"],
  CLAP: ["CLAP: KNOB 1 TO CLAP", "BACKBEAT"], HAT: ["HATS: KNOB 1 TO HAT", "HATS"],
  OHAT: ["KNOB 1 TO OPEN HAT", "OPENHAT"],
};
export const DRUM_LANES = Object.keys(LANE_HEAD);
const PLAY_SEQ = "PLAY IT, THEN HOLD SEQ + STEP", PLAY_NOTES = "KNOB 1 TO A STEP, PLAY IT";   // (lessons.py)

function keyList(steps, C) {                          // lessons.py key_list (and as wide as the screen)
  const n = steps.map(String), fits = (t) => t.length <= 30 && (!C || width(t, C) <= C.TEXT_W);
  if (n.length === 1) return "PRESS KEY " + n[0];
  const t = "PRESS KEYS " + n.slice(0, -1).join(", ") + " AND " + n[n.length - 1];
  if (fits(t)) return t;
  const u = "PRESS KEYS " + n.join(" ");
  return fits(u) ? u : "PRESS THE BLINKING KEYS";
}
// a text's width on the FM-1's screen (FONT_S, as tools/trainer/lessons.py measures it)
export const width = (t, C) => [...t].reduce((w, ch) => w + (C.FONT_S?.adv[ch.charCodeAt(0) - C.FONT_S.first] ?? 8), 0);
// the keys play 27 notes, F to G (F3..G5 at octave 0), an octave up or down at a time: a line all in one such window
export const KEYS_LO = 53, KEYS_SPAN = 26;
export function keyWindow(notes) {
  const ns = notes.flat().filter((x) => x != null);
  if (!ns.length) return 0;
  for (let k = -3; k <= 3; k++) if (ns.every((n) => n >= KEYS_LO + 12 * k && n <= KEYS_LO + 12 * k + KEYS_SPAN)) return k;
  return null;
}
export function intoKeys(notes) {                     // a line into the window most of it is in (the rest by octaves)
  const ns = notes.filter((x) => x != null);
  if (!ns.length || keyWindow(notes) != null) return notes;
  let best = 0, bn = -1;
  for (let k = -3; k <= 3; k++) {
    const n = ns.filter((x) => x >= KEYS_LO + 12 * k && x <= KEYS_LO + 12 * k + KEYS_SPAN).length;
    if (n > bn) { bn = n; best = k; }
  }
  const lo = KEYS_LO + 12 * best, hi = lo + KEYS_SPAN;
  return notes.map((x) => { if (x == null) return x; while (x < lo) x += 12; while (x > hi) x -= 12; return x; });
}
export const inScale = (note, root, scale) => SCALE_STEPS[scale].includes(((note - root) % 12 + 12) % 12);

export const PARTS = [["drums", 4], ["bass", 1], ["chords", 2], ["lead", 3]];
const SEC = "ABCD";
export function normalize(score) {                    // (the one-loop form: one section)
  if (score.sections) return score;
  const one = {};
  for (const [k] of PARTS) one[k] = score[k] ? { steps: score[k].steps, lanes: score[k].lanes } : null;
  return { ...score, kit: score.drums?.kit, sounds: { bass: score.bass?.sound, chords: score.chords?.sound, lead: score.lead?.sound },
           bassDiv: score.bass?.div || "1/4", leadDiv: score.lead?.div || "1/8", sections: [one], song: [] };
}
const contentKey = (k, p) => JSON.stringify(k === "drums" ? DRUM_LANES.map((l) => p.lanes[l] || []) : p.steps);

export function makeLesson(score0, C) {
  const score = normalize(score0), secs = score.sections, multi = secs.length > 1;
  const cards = [], blob = [], offs = new Map();
  const B = (n) => C.B["B_" + n], P = (n) => C.P["P_" + n], G = (n) => C.G["G_" + n], TG = (n) => C.TG["TG_" + n];
  const page = (title, fam) => {
    const i = C.PAGES.findIndex((p) => p.title === title && p.fam === fam);
    if (i < 0) throw new Error(`no page ${title} (${fam})`);
    return i;
  };
  const topic = (k) => {
    const i = C.TOPICS.indexOf(k);
    if (i < 0) throw new Error(`no topic ${k}`);
    return i;
  };
  const target = (bytes) => {                         // lessons.py c_data: each target once
    const k = bytes.join(",");
    if (!offs.has(k)) { offs.set(k, blob.length); blob.push(...bytes); }
    return offs.get(k);
  };
  const add = (head, act, goal, why, f = {}) => {
    if (head.length > C.HEAD_MAX) throw new Error(`headline too long: ${head}`);
    const shown = goal === TG("PARAM") || goal === TG("GLOBAL") ? act.replace("@", "#".repeat(C.VAL_MAX)) : act;
    if (shown.length > C.ACT_MAX) throw new Error(`action too long: ${act}`);
    if (width(head, C) > C.HEAD_W || width(shown, C) > C.TEXT_W) throw new Error(`too wide for the screen: ${head} / ${act}`);
    cards.push({ head, act, goal, trk: f.trk ?? 255, p: f.p ?? 0, btn: f.btn ?? C.B.NB, v: f.v ?? 0, tol: f.tol ?? 0,
                 flags: f.flags ?? 0, data: f.data ?? 0, why: topic(why) });
  };
  const ON_PAGE = { SGATE: ["TIMING", "SEQ"], DLY: ["FX", "FX"], REV: ["FX", "FX"] };
  const param = (n, pid, v, head, act, why, o = {}) => {   // lessons.py Level.param
    const pg = ON_PAGE[pid];
    add(head, act, TG("PARAM"), why, { trk: n - 1, p: P(pid), v, tol: o.tol, btn: o.btn ? B(o.btn) : o.held || !pg ? C.B.NB : B(pg[1]),
                                       data: o.held || !pg ? 0 : 1 + page(pg[0], pg[1]) });
  };
  const track = (n, head) => add(head, `TURN ALGORITHM TO TRACK ${n}`, TG("TRACK"), "PARTS", { trk: n - 1 });
  const sound = (n, name, head) => {
    const s = C.SOUNDS[name];
    if (!s) throw new Error(`no sound ${name}`);
    add(head, "TURN PRESETS, FOLLOW THE DOTS", TG("SOUND"), "SOUNDS", { trk: n - 1, p: s.engine, v: s.trainer });
  };
  const notes = (n, steps, head, act, how, why) => {
    const b = [steps.length];
    for (const x of steps) {
      if (x == null) b.push(0);
      else { const ns = [].concat(x); b.push(1, ns.length, ...ns); }
    }
    add(head, act, TG("NOTES"), why, { trk: n - 1, flags: C.HOW["HOW_" + how], data: target(b) });
  };
  const divCard = (n, div) => param(n, "SDIV", C.DIVS.indexOf(div), DIV_HEAD[div], "HOLD SEQ, TURN KNOB 2 TO @", "VALUES",
                                    { btn: "SEQ", held: true });
  const keyName = NOTE_NAMES[score.root], minor = score.scale === "MIN";

  // each part's patterns: its contents in the order the song needs them (the same content: the same pattern)
  const pat = secs.map(() => ({})), patsOf = {};
  for (const [k] of PARTS) {
    patsOf[k] = [];
    secs.forEach((s, i) => {
      if (!s[k]) return;
      const key = contentKey(k, s[k]);
      let n = patsOf[k].findIndex((x) => x.key === key);
      if (n < 0) { n = patsOf[k].length; patsOf[k].push({ key, part: s[k], sec: i }); }
      pat[i][k] = n + 1;
    });
    if (patsOf[k].length > 8) throw new Error(`${k}: more than 8 patterns`);
  }
  const used = PARTS.filter(([k]) => patsOf[k].length);
  const setUp = {}, built = new Set(), cur = { drums: 1, bass: 1, chords: 1, lead: 1 };
  let onPatterns = false, heard = false;
  const label = (i) => (multi ? `SECTION ${SEC[i]}` : "");
  function build(k, n, i) {                            // pattern n of part k (first needed by section i)
    const t = PARTS.find(([x]) => x === k)[1], part = patsOf[k][n - 1].part, first = !setUp[k];
    if (first) {
      setUp[k] = true;
      if (k === "drums") {
        track(4, "THE DRUMS: TRACK 4");
        if (!C.KITS.includes(score.kit)) throw new Error(`no kit ${score.kit}`);
        add(`DRUM KIT: ${score.kit}`, "TURN PRESETS, FOLLOW THE DOTS", TG("KIT"), "SOUNDS", { trk: 3, v: C.KITS.indexOf(score.kit) });
      } else {
        track(t, { bass: "THE BASS: TRACK 1", chords: "THE CHORDS: TRACK 2", lead: "THE LEAD: TRACK 3" }[k]);
        sound(t, score.sounds[k], `${{ bass: "BASS", chords: "CHORD", lead: "LEAD" }[k]} SOUND: ${score.sounds[k]}`);
        divCard(t, k === "bass" ? score.bassDiv : k === "lead" ? score.leadDiv : "1BAR");
        if (k === "chords") {
          const nb = part.steps.length;
          param(2, "SLEN", nb, `${nb} BARS, ${nb} STEPS`, "HOLD SEQ, KNOB 4 TO @", "VALUES", { btn: "SEQ", held: true });
        }
      }
    }
    const of = n > 1 || multi ? ` ${multi ? SEC[i] : ""}`.trimEnd() : "";
    let chose = false;
    if (cur[k] !== n) {
      if (!onPatterns) add(`PATTERNS: ${label(i)}`, "TAP SEQ UNTIL PATTERNS", TG("PAGE"), "SECTIONS", { p: page("PATTERNS", "SEQ"), btn: B("SEQ") });
      add(`${label(i)}: PATTERN ${n}`, `TRACK ${t}: KNOB 1 TO ${n}, OCT+`, TG("PATSEL"), "SECTIONS", { trk: t - 1, v: n - 1 });
      cur[k] = n;
      chose = true;
    }
    // (off PATTERNS before a line: there OCT+ picks a pattern, not the octave; as level 3 does, a page after the choice)
    if (chose && (k === "bass" || k === "lead"))
      add(`THE ${k === "bass" ? "BASS" : "LEAD"}${of || ""}: NOTES`, "TAP SEQ UNTIL YOU SEE NOTES", TG("PAGE"), k === "bass" ? "BASS1" : "LEAD",
          { p: page("NOTES", "SEQ"), btn: B("SEQ") });
    if (k === "drums") {
      add("THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", TG("PAGE"), "GRID", { p: page("DRUMS", "TRK"), btn: B("SEQ") });
      const have = DRUM_LANES.filter((l) => part.lanes[l]?.some(Boolean));
      have.forEach((l, j) => {
        const lanes = have.slice(0, j + 1), b = [16, lanes.length];
        for (const x of lanes) { b.push(C.LANES.indexOf(x)); for (let s = 0; s < 16; s++) b.push(part.lanes[x][s] ? 0x10 : 0); }
        const keys = part.lanes[l].map((h, s) => (h ? s + 1 : 0)).filter(Boolean);
        const half = l === "SNARE" && keys.length === 1 && keys[0] === 9;   // (half-time: the snare on beat 3 alone)
        const own = half ? "HALF-TIME: SNARE ON 9" : LANE_HEAD[l][0], pre = `${of.trim()}: ${own}`;
        const head = of && pre.length <= C.HEAD_MAX && width(pre, C) <= C.HEAD_W ? pre : own;
        add(head, half ? "KNOB 1 TO SNARE, PRESS KEY 9" : keyList(keys, C), TG("LANES"), half ? "HALFTIME" : LANE_HEAD[l][1],
            { trk: 3, data: target(b) });
      });
      if (!heard && have.length) { add("HEAR IT", "PRESS PLAY", TG("PLAY"), "GRID", { v: 1, btn: B("PLAY") }); heard = true; }
    } else if (k === "chords") {
      add(`THE CHORDS${of}`, "TAP SEQ UNTIL YOU SEE NOTES", TG("PAGE"), "PROG2", { p: page("NOTES", "SEQ"), btn: B("SEQ") });
      notes(2, part.steps, `THE CHORDS${of}`, "PRESS THE LIT KEYS TOGETHER", "NOTES", "PROG2");
    } else if (chose)                                  // (on the NOTES page: typed there, as level 2 does)
      notes(t, part.steps, `THE ${k === "bass" ? "BASS LINE" : "LEAD LINE"}${of}`, PLAY_NOTES, "NOTES", k === "bass" ? "BASS1" : "LEAD");
    else notes(t, part.steps, `THE ${k === "bass" ? "BASS LINE" : "LEAD LINE"}${of}`, PLAY_SEQ, "SEQ", k === "bass" ? "BASS1" : "LEAD");
    onPatterns = false;
    if (first && k === "chords") {
      param(2, "SGATE", 120, "LET THEM RING", "TURN KNOB 4 (GATE) TO @", "GATE", { tol: 4 });
      param(2, "REV", 40, "SOME ROOM", "TAP FX, TURN KNOB 4 TO @", "SPACE", { tol: 4 });
    }
    if (first && k === "lead") param(3, "DLY", 30, "AN ECHO", "TAP FX, TURN KNOB 3 TO @", "ECHO", { tol: 4 });
    built.add(`${k}:${n}`);
  }

  // the tempo and the key
  add(`THE TEMPO: ${score.bpm} BPM`, "TAP HOME, SELECT TO @", TG("GLOBAL"), "TEMPO", { p: G("BPM"), v: score.bpm, btn: B("HOME") });
  param(1, "ROOT", score.root, `THE SONG IS IN ${keyName}`, "HOLD SEL, PRESS A LIT KEY", "KEY", { btn: "SCL", held: true });
  param(1, "SCALE", C.SCALES.indexOf(score.scale), `${keyName} ${minor ? "MINOR" : "MAJOR"}`, "HOLD SEL, TURN KNOB 2 TO @",
        minor ? "MINOR" : "KEY", { btn: "SCL", held: true });
  // every pattern, section by section (section A's first: the loop to start from)
  secs.forEach((s, i) => { for (const [k] of PARTS) if (pat[i][k] && !built.has(`${k}:${pat[i][k]}`)) build(k, pat[i][k], i); });
  if (multi) {
    // each section: its patterns, its mutes, saved as A..D; then the song
    const care = used.reduce((m, [, t]) => m | (1 << (t - 1)), 0);
    let muted = 0;
    add("STOP TO SAVE", "PRESS PLAY TO STOP", TG("PLAY"), "SECTIONS", { v: 0, btn: B("PLAY") });
    add("THE SECTIONS", "TAP SEQ UNTIL PATTERNS", TG("PAGE"), "SECTIONS", { p: page("PATTERNS", "SEQ"), btn: B("SEQ") });
    secs.forEach((s, i) => {
      const b = new Array(8).fill(255), on = used.filter(([k]) => pat[i][k]);
      for (const [k, t] of on) { b[t - 1] = pat[i][k] - 1; cur[k] = pat[i][k]; }
      const ps = new Set(on.map(([k]) => pat[i][k])), list = on.map(([, t]) => t).sort();
      const tracks = list.length === 1 ? `TRACK ${list[0]}` : list.join("") === "1234" ? "TRACKS 1-4" : `TRACKS ${list.join(" ")}`;
      let act = ps.size === 1 ? `${tracks} ON PATTERN ${[...ps][0]}` : on.map(([k, t]) => `T${t}:P${pat[i][k]}`).sort().join(" ");
      if (act.length > C.ACT_MAX || width(act, C) > C.TEXT_W) act = "EACH TRACK TO ITS PATTERN";
      add(`SECTION ${SEC[i]}: PATTERNS`, act, TG("PATS"), "SECTIONS", { data: target(b) });
      const m = used.filter(([k]) => !pat[i][k]).reduce((x, [, t]) => x | (1 << (t - 1)), 0);
      if (m !== muted) {
        const ts = used.filter(([, t]) => (m >> (t - 1)) & 1).map(([, t]) => t).sort();
        add(`SECTION ${SEC[i]}: MUTES`, ts.length ? `HOLD GLO: MUTE ${ts.length > 1 ? "TRACKS" : "TRACK"} ${ts.join(" ")}` : "HOLD GLO: UNMUTE EVERY TRACK",
            TG("MUTES"), "MUTES", { p: care, v: m, btn: B("GLO") });
        muted = m;
      }
      add(`SAVE IT AS ${SEC[i]}`, `HOLD SAVE, PRESS KEY ${5 + i}`, TG("SAVED"), "SECTIONS", { v: i, btn: B("SAVE") });
    });
    const song = score.song, seq = song.map(([g, n]) => SEC[g] + n).join(" ");
    if (song.length < 1 || song.length > 16) throw new Error(`a song of 1 to 16 parts (${song.length})`);
    add("THE SONG", "TAP HOME, THEN TAP SAVE", TG("PAGE"), "FORM", { p: page("SONG", "SEQ"), btn: B("SAVE") });
    add(`THE SONG: ${song.length} PARTS`, `TURN KNOB 4 TO ${song.length} STEPS`, TG("SONG"), "FORM", { flags: 1, data: target([song.length]) });
    add(seq.length <= C.HEAD_MAX ? seq : "EACH PART AND ITS BARS", "KNOB 1 STEP, 2 PART, 3 BARS", TG("SONG"), "FORM",
        { data: target([song.length, ...song.flatMap(([g, n]) => [g, n])]) });
    add("PLAY THE SONG", "OCT-: SONG MODE, THEN PLAY", TG("SONGMODE"), "FORM", { btn: B("PLAY") });
  }
  add("YOUR SONG IS DONE!", multi ? "HOLD SAVE, KEYS 5-8: SECTIONS" : "PLAY IT, MUTE PARTS WITH GLO", TG("DONE"), "FORM");
  const parts = used.map(([k]) => ({ drums: "DRUMS", bass: "BASS", chords: "CHORDS", lead: "A LEAD" }[k]));
  return {
    name: (score.name || "YOUR SONG").toUpperCase().replace(/[^ -~]/g, "").slice(0, 16) || "YOUR SONG",
    style: `${score.bpm} BPM, ${keyName} ${minor ? "MINOR" : "MAJOR"}`,
    learn1: (multi ? `${secs.length} SECTIONS: ` + parts.join(", ") : parts.join(", ")).slice(0, 28) || "A SONG",
    learn2: multi ? `THE SONG: ${score.song.reduce((a, [, n]) => a + n, 0)} BARS, SONG MODE`.slice(0, 28) : "MADE FROM YOUR AUDIO FILE",
    targets: blob, cards,
  };
}

// the score made playable on the FM-1: notes in the key (the keys play the scale), its sounds known, the song's form
export function checkScore(score0, C) {
  const score = normalize(score0), bad = [];
  if (!(score.bpm >= 40 && score.bpm <= 240)) bad.push(`tempo ${score.bpm}`);
  if (score.sections.length < 1 || score.sections.length > 4) bad.push("1 to 4 sections");
  const nb = new Set();
  score.sections.forEach((s, i) => {
    for (const k of ["bass", "lead"]) {
      const p = s[k];
      if (!p) continue;
      if (p.steps.length !== 16) bad.push(`${SEC[i]} ${k}: 16 steps`);
      p.steps.forEach((x, j) => { if (x != null && !inScale(x, score.root, score.scale)) bad.push(`${SEC[i]} ${k} step ${j + 1}: not in the key`); });
      if (keyWindow(p.steps) == null) bad.push(`${SEC[i]} ${k}: wider than the keys (27 notes, F to G)`);
    }
    if (s.chords) nb.add(s.chords.steps.length);
    if (s.chords && keyWindow(s.chords.steps) == null) bad.push(`${SEC[i]} chords: wider than the keys`);
  });
  if (nb.size > 1 || [...nb].some((n) => n < 1 || n > 8)) bad.push("chords: 1 to 8 bars, as many in each section");
  for (const k of ["bass", "chords", "lead"]) if (score.sections.some((s) => s[k]) && !C.SOUNDS[score.sounds?.[k]]) bad.push(`${k}: no sound ${score.sounds?.[k]}`);
  if (score.sections.some((s) => s.drums) && !C.KITS.includes(score.kit)) bad.push(`no kit ${score.kit}`);
  if (score.sections.length > 1) {
    if (score.song.length < 1 || score.song.length > 16) bad.push("a song of 1 to 16 parts");
    for (const [g, n] of score.song) if (!(g >= 0 && g < score.sections.length && n >= 1 && n <= 64)) bad.push(`song part ${SEC[g]}${n}`);
  }
  return bad;
}

// the lesson, made to fit the FM-1 (128 steps, 8 KiB): if it does not, the later sections take section A's lead, then
// its chords, then the last section goes into the one most like it, until it fits
export function fitLesson(score0, C, encode) {
  let score = normalize(score0), notes = [];
  for (let round = 0; round < 12; round++) {
    try {
      const lesson = makeLesson(score, C), area = encode(lesson);
      if (lesson.cards.length <= 128) return { lesson, area, score, notes };
    } catch (e) { if (!/room for|steps|patterns/.test(e.message)) throw e; }
    const secs = score.sections.map((s) => ({ ...s }));
    const k = ["lead", "chords"].find((x) => secs.slice(1).some((s) => s[x] && contentKey(x, s[x]) !== (secs[0][x] && contentKey(x, secs[0][x]))));
    if (k) { for (const s of secs.slice(1)) if (s[k]) s[k] = secs[0][k] || null; notes.push(`the ${k} of section A in every section`); }
    else if (secs.length > 1) {
      const g = secs.length - 1;
      secs.pop();
      score = { ...score, song: score.song.map(([x, n]) => [x === g ? 0 : x, n]) };
      notes.push(`section ${SEC[g]} played as A`);
    } else throw new Error("the song does not fit the FM-1");
    score = { ...score, sections: secs };
  }
  throw new Error("the song does not fit the FM-1");
}
