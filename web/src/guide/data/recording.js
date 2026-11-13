// SPDX-License-Identifier: GPL-3.0-only
// What REC does, and the REC screen's four knobs. From GUIDE.md, section 8.
export const REC_STATES = [
  ["Playing", "REC records the selected track at once. REC again stops recording; the loop plays on."],
  ["Stopped, with notes", "REC arms (rec ready, the light blinks). Your first note starts the loop and is step 1."],
  ["Stopped, empty project", "REC arms a free take: play freely, then press REC on the “1” to close the loop. Its length sets the tempo."],
  ["Hold REC ~2 s", "Clears the selected track. A ring fills; let go early and nothing happens. Undo brings it back."],
];

export const REC_KNOBS = [
  ["MODE", "free: the tempo follows you · tempo: record at the set tempo"],
  ["LENGTH", "the loop: 1, 2 or 4 bars"],
  ["START", "note: your first note starts it · count: PLAY gives one bar of clicks"],
  ["QUANT", "on: notes go on the steps · off: your timing is kept as nudges"],
];
