// SPDX-License-Identifier: GPL-3.0-only
// The step sequencer in six cards: [title, text]. From GUIDE.md, section 10.
export const SEQ_CARDS: [title: string, text: string][] = [
  ["Set and clear", "Hold SEQ: the white keys are steps 1–16 of the page. An empty step is set with the last note or sound you played; a tap on a set step clears it. Hold several to edit them together."],
  ["Edit a step", "Hold SEQ, hold a step and turn: KNOB 1 its note (or sound), KNOB 2 level or velocity, KNOB 3 ratchet x1–x4, KNOB 4 nudge (−32…+31 in 1/64 of a step)."],
  ["Parameter locks", "Turn the parameter on its page first. Then hold SEQ + the step and turn PRESETS: that step alone gets its own value. ALGORITHM picks another locked parameter. 32 locks a track."],
  ["Fill conditions", "SEQ + step + OCT+ cycles normal → FILL ONLY (F) → NO FILL (×). Play a fill with GLO + key 9 (held) or GLO + key 10 (the next bar). SEQ + step + OCT− clears it all."],
  ["The NOTES page", "Tap SEQ on a synth track. KNOB 1 note · 2 pitch · 3 length · 4 force. Hold OCT+ for the note's sheet: slide, nudge, fill, move, copy, delete, locks."],
  ["Divisions", "SEQ + KNOB 2: 1/4, 1/8, 1/16, 1/32, 8T, 16T, 1/2, 1BAR, 2BAR. A 64-step track at 2BAR lasts 128 bars: drones and slow chord changes."],
];
