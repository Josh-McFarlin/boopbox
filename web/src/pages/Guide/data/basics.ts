// SPDX-License-Identifier: GPL-3.0-only
import type { Accent } from "./theme.ts";
// Basics: the eight tracks, and tap / hold / lock. From GUIDE.md, section 3.

/* [track, what it plays at power-on, its colour] */
export const TRACKS: [n: number, kind: string, color: Accent][] = [
  [1, "synth", "blue"], [2, "synth", "green"], [3, "synth", "yellow"], [4, "drums", "orange"],
  [5, "synth", "blue"], [6, "synth", "green"], [7, "synth", "yellow"], [8, "drums", "orange"],
];

/* [title, colour, text] */
export const IDEAS: [title: string, color: Accent, text: string][] = [
  ["Tap a button", "blue", "Its pages open: sound design and settings. Tap again for the next page, or turn SELECT both ways. From another page, a tap always opens its first page."],
  ["Hold a button", "orange", "A layer opens: while you hold it, the 16 white keys and KNOB 1–4 do other jobs, shown on the screen as 16 tiles. Seven buttons have layers: FX, EDIT, ARP, SEQ, SEL, GLO, SAVE."],
  ["Lock it open", "green", "Hold the layer button and tap HOME: the layer stays open (LOCK shows and the button blinks), so both hands are free. Any other button unlocks it. PLAY, REC and OCT keep working inside."],
];

/* how the guide writes a control: [as written, means] */
export const NOTATION: [written: string, means: string][] = [
  ["tap", "press and let go quickly"],
  ["hold", "keep it pressed"],
  ["FX + key 3", "hold FX, press white key 3"],
  ["key 1 … 16", "the white keys, F3 to G5"],
];
