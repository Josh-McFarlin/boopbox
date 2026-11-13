// SPDX-License-Identifier: GPL-3.0-only
// What the keys and knobs do with nothing held, on a drum track, and while each layer button is held. From GUIDE.md, section 9.
import { BLACK, BLACK_AFTER, DRUMS, WHITE } from "./keys.ts";
import type { Accent } from "./theme.ts";

const EMPTY = (n: number): string[] => Array(n).fill("");

/* a layer: its id, the button held (null: none), its names and accent, its screen, the labels of its keys (one a key, ""
   for nothing) and knobs, and the other controls of the layer as [control, what it does] */
export interface Layer {
  id: string;
  button: string | null;
  name: string;
  title: string;
  color: Accent;
  shot: string;
  blurb: string;
  white: string[];
  black: string[];
  knobs: string[];
  more: [control: string, what: string][];
}

export const LAYERS: Layer[] = [
  { id: "PLAY", button: null, name: "Nothing held", title: "Play", color: "blue", shot: "home/tracks-1-4",
    blurb: "With no button held, the keys play the selected track and the knobs follow the screen. On TRACKS: KNOB 1 global swing, KNOB 2 the level of the track, KNOB 3 its steps, KNOB 4 its pan.",
    white: WHITE, black: BLACK, knobs: ["SWING", "LEVEL", "STEPS", "PAN"],
    more: [["OCT− / OCT+", "octave −3 … +3 (both: 0)"], ["SELECT", "the tempo"], ["ALGORITHM", "the track, 1–8"], ["PRESETS", "the sound browser"]] },
  { id: "DRUM", button: null, name: "Nothing held, drum track", title: "Drums", color: "green", shot: "drums/drums-kit",
    blurb: "A drum track has 16 sounds, one per white key. A black key plays the sound of the white key on its left, so two fingers can roll one sound. Hold OCT− for ghost hits and OCT+ for hard ones.",
    white: DRUMS, black: BLACK_AFTER.map((w) => DRUMS[w]), knobs: ["SWING", "LEVEL", "STEPS", "PAN"],
    more: [["OCT− held", "ghost hits"], ["OCT+ held", "hard hits"], ["PRESETS", "the kit (46 of them)"], ["tap SEQ / EDIT", "the DRUMS grid / the kit page"]] },
  { id: "FX", button: "FX", name: "Hold FX", title: "PUNCH", color: "orange", shot: "layers/layer-fx",
    blurb: "Every key is a punch-in effect on the whole mix, for as long as you hold it. Loops and the gate lock to the tempo. The keys never play or record notes here.",
    white: ["LOOP 1/4", "LOOP 1/8", "LOOP 1/16", "LOOP 1/32", "STUTTER", "REVERSE", "TAPE STOP", "HALF SPEED", "LP SWEEP", "HP SWEEP", "PHONE", "BIT CRUSH", "ALIAS", "GATE 1/16", "ECHO", "WOBBLE"],
    black: ["KILL LOW", "KILL MID", "KILL HIGH", "REWIND", "OCT UP", "FLANGER", "AUTO-PAN", "FREEZE", "LOOP 8T", "MONO", "FADE OUT"],
    knobs: ["FILTER", "DUST", "DUCK", "TRK FILT"],
    more: [["OCT− held", "REV THROW: every reverb send to full"], ["OCT+ held", "ECHO THROW: every delay send to full"], ["SELECT", "the punch-in fade, 0–15"], ["HOME", "lock the layer open"]] },
  { id: "EDIT", button: "EDIT", name: "Hold EDIT", title: "ERASE", color: "red", shot: "layers/layer-edit",
    blurb: "Hold a key while it plays and its sound (drums) or note (synths) is erased from every step the playhead passes. Stopped: erased from the whole pattern at once.",
    white: Array(16).fill("ERASE"), black: Array(11).fill("DRUM MUTE"),
    knobs: ["SHIFT", "LENGTH ×2/½", "TRANSPOSE", "—"],
    more: [["OCT−", "undo"], ["OCT+", "redo"], ["a black key (drums)", "MUTE mode: the white keys mute / unmute their sound"], ["HOME", "lock the layer open"]] },
  { id: "ARP", button: "ARP", name: "Hold ARP", title: "ROLL", color: "yellow", shot: "layers/layer-arp",
    blurb: "Note repeat: a held key repeats on the grid at the RATE, locked to the tempo and the swing. When you record, a roll is written as ratchets.",
    white: Array(16).fill("ROLL"), black: Array(11).fill("ROLL"),
    knobs: ["RATE", "—", "—", "—"],
    more: [["OCT− / OCT+ (drums)", "ghost / hard rolls"], ["KNOB 1 RATE", "1/8, 1/16, 1/32, 32T, 1/64"]] },
  { id: "SEQ", button: "SEQ", name: "Hold SEQ", title: "STEPS", color: "blue", shot: "layers/layer-seq",
    blurb: "The white keys are the 16 steps of the page; the lit ones play. Tap an empty step to set it, a set step to clear it. Hold a step and turn the knobs to edit it.",
    white: Array.from({ length: 16 }, (_, i) => `STEP ${i + 1}`), black: ["1–16", "17–32", "33–48", "49–64", ...EMPTY(7)],
    knobs: ["SOUND / NOTE", "DIV", "SWING", "LENGTH"],
    more: [["step + KNOB 1–4", "note (or sound) · level / velocity · ratchet x1–x4 · nudge"], ["step + PRESETS", "a parameter lock on the step"], ["step + ALGORITHM", "which parameter the lock is on"], ["step + OCT+", "fill condition: FILL ONLY, NO FILL"], ["step + OCT−", "clear nudge, locks and condition"], ["OCT− / OCT+", "the page of steps"], ["black keys (drums)", "pick the sound the steps are for"], ["SAVE (tap)", "the SCENES page"]] },
  { id: "SEL", button: "SEL", name: "Hold SEL", title: "KEY", color: "green", shot: "layers/layer-scl",
    blurb: "Any key sets the key of the song: the root of every synth track. The knobs set the chord mode, the scale and how the keys follow it.",
    white: WHITE.map((n) => `KEY ${n.slice(0, -1)}`), black: BLACK.map((n) => `KEY ${n.slice(0, -1)}`),
    knobs: ["CHORD", "SCALE", "KEYS", "TRANSPOSE"],
    more: [["KNOB 1 CHORD", "OFF, TRIAD, 7TH, 9TH, SUS4, POWER"], ["KNOB 2 SCALE", "16 scales, every synth track"], ["KNOB 3 KEYS", "OFF, SNAP, WHITE"], ["KNOB 4", "transpose the track ±24"]] },
  { id: "GLO", button: "GLO", name: "Hold GLO", title: "MIX", color: "blue", shot: "layers/layer-glo",
    blurb: "Mute and solo the four tracks of the bank (1–4, or 5–8 when one of them is selected), call fills, tap the tempo. The knobs are the four levels.",
    white: ["MUTE 1", "MUTE 2", "MUTE 3", "MUTE 4", "SOLO 1", "SOLO 2", "SOLO 3", "SOLO 4", "FILL (hold)", "FILL BAR", "", "", "", "", "", "TAP TEMPO"],
    black: ["MIDI LEARN", ...EMPTY(10)],
    knobs: ["LEVEL 1", "LEVEL 2", "LEVEL 3", "LEVEL 4"],
    more: [["SELECT", "the tempo (also in the visualiser)"], ["HOME", "lock the layer open"]] },
  { id: "SAVE", button: "SAVE", name: "Hold SAVE", title: "SONG", color: "yellow", shot: "layers/layer-save",
    blurb: "The song is four sections, A–D. Play one from the next bar, save the loop into one, tap several for a quick chain, or record the song as you play it.",
    white: ["PLAY A", "PLAY B", "PLAY C", "PLAY D", "SAVE A", "SAVE B", "SAVE C", "SAVE D", "", "", "", "", "LOOP / SONG", "SONG REC", "", "SONG SCREEN"],
    black: EMPTY(11), knobs: ["—", "—", "—", "—"],
    more: [["keys 1–4, several", "a quick chain (A B B C…), up to 8"], ["keys 5–8 on a used section", "press again within 3 s"]] },
];
