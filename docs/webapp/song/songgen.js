// SPDX-License-Identifier: GPL-3.0-only
//
// A song for the trainer's level 4, from a score: the steps the coach shows, in the shape tools/trainer/lessons.py
// gives the built-in levels (the same goals, buttons, pages and "why" topics), for web/trslot.js to encode. C is
// tools/trainer/consts.json: the firmware's own numbers.
//
// score: {
//   name, bpm, root (0..11, C = 0), scale ("MIN" | "MAJ"),
//   drums:  { kit, lanes: { KICK: [16 x 0/1], SNARE, CLAP, HAT, OHAT } }        track 4, 16 sixteenths
//   bass:   { sound, div: "1/4" | "1/8", steps: [16 x null | note] }             track 1
//   chords: { sound, steps: [1..8 x [notes]] }                                   track 2, a chord a bar
//   lead:   { sound, div: "1/8" | "1/16", steps: [16 x null | note] }            track 3
// }   (any part may be left out; notes are MIDI numbers as the FM-1's keys play them, C4 = 60)

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SCALE_STEPS = { MAJ: [0, 2, 4, 5, 7, 9, 11], MIN: [0, 2, 3, 5, 7, 8, 10] };
const DIV_HEAD = { "1/4": "ONE STEP A BEAT", "1/8": "EIGHTH NOTES", "1/16": "SIXTEENTH NOTES", "1BAR": "ONE STEP A BAR" };
const LANE_HEAD = {                                   // (the lane as the FM-1's screen names it: drums.c LANE_NAME)
  KICK: ["KICK: KNOB 1 TO KICK", "KICK"], SNARE: ["SNARE: KNOB 1 TO SNARE", "BACKBEAT"],
  CLAP: ["CLAP: KNOB 1 TO CLAP", "BACKBEAT"], HAT: ["HATS: KNOB 1 TO HAT", "HATS"],
  OHAT: ["KNOB 1 TO OPEN HAT", "OPENHAT"],
};
export const DRUM_LANES = Object.keys(LANE_HEAD);
const PLAY_SEQ = "PLAY IT, THEN HOLD SEQ + STEP";

function keyList(steps) {                             // lessons.py key_list
  const n = steps.map(String);
  if (n.length === 1) return "PRESS KEY " + n[0];
  const t = "PRESS KEYS " + n.slice(0, -1).join(", ") + " AND " + n[n.length - 1];
  if (t.length <= 30) return t;
  const u = "PRESS KEYS " + n.join(" ");
  return u.length <= 30 ? u : "PRESS THE BLINKING KEYS";
}
export const inScale = (note, root, scale) => SCALE_STEPS[scale].includes(((note - root) % 12 + 12) % 12);

export function makeLesson(score, C) {
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
    cards.push({ head, act, goal, trk: f.trk ?? 255, p: f.p ?? 0, btn: f.btn ?? C.B.NB, v: f.v ?? 0, tol: f.tol ?? 0,
                 flags: f.flags ?? 0, data: f.data ?? 0, why: topic(why) });
  };
  const ON_PAGE = { SGATE: ["TIMING", "SEQ"], DLY: ["FX", "FX"], REV: ["FX", "FX"] };
  const param = (n, pid, v, head, act, why, o = {}) => {   // lessons.py Level.param
    const pg = ON_PAGE[pid];
    add(head, act, TG("PARAM"), why, { trk: n - 1, p: P(pid), v, tol: o.tol, btn: o.held ? B(o.btn) : (o.btn ? B(o.btn) : pg ? B(pg[1]) : C.B.NB),
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

  // the tempo and the key
  add(`THE TEMPO: ${score.bpm} BPM`, "TAP HOME, SELECT TO @", TG("GLOBAL"), "TEMPO", { p: G("BPM"), v: score.bpm, btn: B("HOME") });
  param(1, "ROOT", score.root, `THE SONG IS IN ${keyName}`, "HOLD SEL, PRESS A LIT KEY", "KEY", { btn: "SCL", held: true });
  param(1, "SCALE", C.SCALES.indexOf(score.scale), `${keyName} ${minor ? "MINOR" : "MAJOR"}`, "HOLD SEL, TURN KNOB 2 TO @",
        minor ? "MINOR" : "KEY", { btn: "SCL", held: true });
  // the drums: track 4, a bar of sixteenths, lane by lane
  if (score.drums) {
    const d = score.drums, have = DRUM_LANES.filter((l) => d.lanes[l]?.some(Boolean));
    track(4, "THE DRUMS: TRACK 4");
    if (!C.KITS.includes(d.kit)) throw new Error(`no kit ${d.kit}`);
    add(`DRUM KIT: ${d.kit}`, "TURN PRESETS, FOLLOW THE DOTS", TG("KIT"), "SOUNDS", { trk: 3, v: C.KITS.indexOf(d.kit) });
    add("THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", TG("PAGE"), "GRID", { p: page("DRUMS", "TRK"), btn: B("SEQ") });
    have.forEach((l, i) => {
      const lanes = have.slice(0, i + 1), b = [16, lanes.length];
      for (const x of lanes) { b.push(C.LANES.indexOf(x)); for (let s = 0; s < 16; s++) b.push(d.lanes[x][s] ? 0x10 : 0); }
      const keys = d.lanes[l].map((h, s) => (h ? s + 1 : 0)).filter(Boolean);
      add(LANE_HEAD[l][0], keyList(keys), TG("LANES"), LANE_HEAD[l][1], { trk: 3, data: target(b) });
    });
    if (have.length) add("HEAR IT", "PRESS PLAY", TG("PLAY"), "GRID", { v: 1, btn: B("PLAY") });
  }
  // the bass: track 1, the SEQ layer
  if (score.bass) {
    const b = score.bass;
    track(1, "THE BASS: TRACK 1");
    sound(1, b.sound, `BASS SOUND: ${b.sound}`);
    divCard(1, b.div);
    notes(1, b.steps, "THE BASS LINE", PLAY_SEQ, "SEQ", "BASS1");
  }
  // the chords: track 2, a chord a bar, typed on the NOTES page
  if (score.chords) {
    const c = score.chords, n = c.steps.length;
    track(2, "THE CHORDS: TRACK 2");
    sound(2, c.sound, `CHORD SOUND: ${c.sound}`);
    divCard(2, "1BAR");
    param(2, "SLEN", n, `${n} BARS, ${n} STEPS`, "HOLD SEQ, KNOB 4 TO @", "VALUES", { btn: "SEQ", held: true });
    add("THE CHORDS", "TAP SEQ UNTIL YOU SEE NOTES", TG("PAGE"), "PROG2", { p: page("NOTES", "SEQ"), btn: B("SEQ") });
    notes(2, c.steps, "THE CHORDS", "PRESS THE LIT KEYS TOGETHER", "NOTES", "PROG2");
    param(2, "SGATE", 120, "LET THEM RING", "TURN KNOB 4 (GATE) TO @", "GATE", { tol: 4 });
    param(2, "REV", 40, "SOME ROOM", "TAP FX, TURN KNOB 4 TO @", "SPACE", { tol: 4 });
  }
  // the lead: track 3, the SEQ layer, an echo
  if (score.lead) {
    const l = score.lead;
    track(3, "THE LEAD: TRACK 3");
    sound(3, l.sound, `LEAD SOUND: ${l.sound}`);
    divCard(3, l.div);
    notes(3, l.steps, "THE LEAD LINE", PLAY_SEQ, "SEQ", "LEAD");
    param(3, "DLY", 30, "AN ECHO", "TAP FX, TURN KNOB 3 TO @", "ECHO", { tol: 4 });
  }
  add("YOUR SONG IS DONE!", "PLAY IT, MUTE PARTS WITH GLO", TG("DONE"), "FORM");
  const parts = [score.drums && "DRUMS", score.bass && "BASS", score.chords && "CHORDS", score.lead && "A LEAD"].filter(Boolean);
  return {
    name: (score.name || "YOUR SONG").toUpperCase().replace(/[^ -~]/g, "").slice(0, 16) || "YOUR SONG",
    style: `${score.bpm} BPM, ${keyName} ${minor ? "MINOR" : "MAJOR"}`,
    learn1: parts.join(", ").slice(0, 28) || "A SONG",
    learn2: "MADE FROM YOUR AUDIO FILE",
    targets: blob, cards,
  };
}

// the score made playable on the FM-1: notes in the key (the keys play the scale), the parts' sounds known
export function checkScore(score, C) {
  const bad = [];
  if (!(score.bpm >= 40 && score.bpm <= 240)) bad.push(`tempo ${score.bpm}`);
  for (const k of ["bass", "lead"]) {
    const p = score[k];
    if (!p) continue;
    if (p.steps.length !== 16) bad.push(`${k}: 16 steps`);
    p.steps.forEach((x, i) => { if (x != null && !inScale(x, score.root, score.scale)) bad.push(`${k} step ${i + 1}: not in the key`); });
    if (!C.SOUNDS[p.sound]) bad.push(`${k}: no sound ${p.sound}`);
  }
  if (score.chords) {
    if (score.chords.steps.length < 1 || score.chords.steps.length > 8) bad.push("chords: 1 to 8 bars");
    if (!C.SOUNDS[score.chords.sound]) bad.push(`chords: no sound ${score.chords.sound}`);
  }
  if (score.drums && !C.KITS.includes(score.drums.kit)) bad.push(`no kit ${score.drums.kit}`);
  return bad;
}
