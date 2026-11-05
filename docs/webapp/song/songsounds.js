// SPDX-License-Identifier: GPL-3.0-only
//
// The sounds a song from the web page starts with: by its tempo, a style the trainer's own songs use (a kit and a sound
// for each part, all of them factory sounds of the trainer build); the page offers the others of each list too.

export const STYLES = [
  { name: "LO-FI", upto: 95, kit: "LO-FI", bass: "808 BOOM", chords: "RHODES", lead: "KALIMBA" },
  { name: "BOOM BAP", upto: 100, kit: "BOOMBAP", bass: "SUB BASS", chords: "WURLI", lead: "FLUTE DUST" },
  { name: "SYNTHWAVE", upto: 115, kit: "SYNTHWV", bass: "SAW BASS", chords: "SAW PAD", lead: "PWM LEAD" },
  { name: "HOUSE", upto: 130, kit: "HOUSE", bass: "FM BASS", chords: "HOUSE ORGN", lead: "FM PLUCK" },
  { name: "TECHNO", upto: 145, kit: "TECHNO", bass: "REESE", chords: "WARM PAD", lead: "SQR LEAD" },
  { name: "DRUM AND BASS", upto: 999, kit: "JUNGLE", bass: "REESE", chords: "GLASS PAD", lead: "SUPERSAW" },
];
export const CHOICES = {
  bass: ["808 BOOM", "SUB BASS", "SAW BASS", "FM BASS", "REESE", "PLUCK BASS", "ROUND BASS", "FUNK BASS", "MONO BASS",
         "ACID 303", "BASS GTR", "WOBBLE"],
  chords: ["RHODES", "WURLI", "SAW PAD", "WARM PAD", "GLASS PAD", "SOFT KEYS", "HOUSE ORGN", "DX RHODES", "M1 PIANO",
           "80S POLY", "STR PLUCK", "CHOIR AAH"],
  lead: ["KALIMBA", "PWM LEAD", "FM PLUCK", "SQR LEAD", "SUPERSAW", "FLUTE DUST", "MARIMBA", "MUSIC BOX", "SYNC LEAD",
         "GLOCKEN", "PAN FLUTE", "TRAP BELL"],
};
export const styleFor = (bpm) => STYLES.find((s) => bpm <= s.upto);

// the score with its sounds: { kit, bass, chords, lead } (each part with its sound; a part not heard stays null)
export function defaultSounds(score, C, style = styleFor(score.bpm)) {
  const has = (n) => !!C.SOUNDS[n];
  for (const s of STYLES) for (const k of ["bass", "chords", "lead"]) if (!has(s[k])) throw new Error(`no sound ${s[k]}`);
  const part = (k) => (score[k] ? { ...score[k], sound: style[k] } : null);
  return { kit: style.kit, style: style.name, bass: part("bass"), chords: part("chords"), lead: part("lead") };
}
// a whole song's sounds (web/songgen.js sections): the style's kit and one sound a part
export const styleSounds = (style) => ({ kit: style.kit, style: style.name,
                                         sounds: { bass: style.bass, chords: style.chords, lead: style.lead } });
export function checkPalettes(C) {                     // (tests: every name is a sound or a kit of the trainer)
  const bad = [];
  for (const s of STYLES) {
    if (!C.KITS.includes(s.kit)) bad.push(s.kit);
    for (const k of ["bass", "chords", "lead"]) if (!C.SOUNDS[s[k]]) bad.push(s[k]);
  }
  for (const [k, list] of Object.entries(CHOICES)) for (const n of list) if (!C.SOUNDS[n]) bad.push(`${k}: ${n}`);
  return bad;
}
