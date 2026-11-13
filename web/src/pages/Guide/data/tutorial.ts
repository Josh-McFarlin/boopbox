// SPDX-License-Identifier: GPL-3.0-only
// "Your first beat": [title, text, its screen]. From GUIDE.md, section 4.
export const FIRST_BEAT: [title: string, text: string, shot: string][] = [
  ["Pick the drums", "Turn ALGORITHM to track 4. The white keys play 16 drum sounds: F3 kick, A3 snare, C4 hat… Turn PRESETS for a kit: try 808 or BOOMBAP.", "drums/drums-kit"],
  ["Play freely", "Press REC (rec ready) and play a beat at your own tempo. No click, no count-in. Hold OCT− for ghost notes, OCT+ for hard hits.", "rec/rec-free"],
  ["Close the loop", "Press REC on the “1” after your last bar. Its length sets the tempo, the hits snap to the grid, and the loop plays at once.", "home/tracks-1-4"],
  ["Add on top", "Press REC again while it plays to overdub. Hold ARP and hold the hat key (C4) for a 1/16 roll, written as ratchets.", "layers/layer-arp"],
  ["A bass line", "Turn ALGORITHM to track 1 (808 BOOM), press REC and play a bass line.", "pages/seq-notes"],
  ["Chords with one finger", "Hold SEL and press the key of your song. Select track 2, hold SEL and turn KNOB 1 to 7TH: each white key now plays a chord of the key.", "layers/layer-scl"],
  ["Punch in", "Hold FX and hold a key for an effect. While you hold FX, turn KNOB 2 for DUST and KNOB 3 for DUCK.", "layers/layer-fx"],
  ["Undo", "EDIT + OCT− undoes. EDIT + OCT+ redoes.", "layers/layer-edit"],
];
