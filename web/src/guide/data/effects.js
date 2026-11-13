// SPDX-License-Identifier: GPL-3.0-only
// The master and per-track effects: [name, where, what it does]. From GUIDE.md, section 18. (The 27 punch-in effects are
// the FX layer's keys, in layers.js.)
export const EFFECTS = [
  ["DUST", "FX + KNOB 2 · GLO → MASTER", "The mix through an old sampler and a record: drive, a lower sample rate, fewer bits, a closing low-pass."],
  ["DUCK", "FX + KNOB 3 · GLO → MASTER", "Every kick pushes the synth tracks down and they come back over a 1/8 note, like sidechain compression, at any tempo."],
  ["FILTER / TRK FILT", "FX + KNOB 1 / KNOB 4", "One-knob DJ filters: left a low-pass closes, right a high-pass opens. KNOB 1 the mix, KNOB 4 the selected track."],
  ["REV / ECHO THROW", "FX + OCT− / OCT+ held", "Every reverb (or delay) send goes to full while held, and glides back. Never saved or recorded."],
  ["Per track", "FX pages", "Sends (drive, chorus, delay, reverb), SLICER gate / stutter, and an INSERT: clip, fold, fuzz, crush, phaser, flanger, chorus."],
  ["TEXTURE", "GLO → TEXTURE", "A looping bed under the mix: vinyl, tape, rain, wind, radio, room or your own sample, changing slowly over 1–16 bars."],
];
