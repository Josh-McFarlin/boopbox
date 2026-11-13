// SPDX-License-Identifier: GPL-3.0-only
// Every page of every button, knob by knob, with its screen. From GUIDE.md, section 16.

import type { Accent } from "./theme.ts";

/* button -> its pages: [name, shot, [KNOB 1..4], note] */
export type Page = [name: string, shot: string, knobs: string[], note: string];
export interface PageGroup {
  button: string;
  color: Accent;
  via?: string;
  pages: Page[];
}

export const PAGES: PageGroup[] = [
  { button: "ENV", color: "orange", pages: [
    ["ENV", "pages/env-env", ["ATK attack", "DEC decay", "SUS sustain", "REL release"], "The volume envelope of the track. FM6 ignores it: each operator has its own."],
    ["ENV DEST", "pages/env-env-dest", ["FLT: envelope → brightness", "PIT: envelope → pitch (the 808 punch)", "SHP: envelope → engine shape", "ESYNC: times as note values"], "With ESYNC ON, attack, decay and release follow the tempo (1/64T … 4BAR)."],
  ] },
  { button: "LFO", color: "blue", pages: [
    ["LFO", "pages/lfo-lfo", ["RATE (Hz)", "WAVE: SIN, TRI, SAW, SQR, S&H", "PHS phase", "FADE in time"], ""],
    ["LFO 2", "pages/lfo-lfo-2", ["SYNC: OFF, 4BAR … 1/32", "TRIG: NOTE / FREE", "POL: BI / UNI", "—"], "SYNC locks the LFO to the tempo; RATE then has no effect."],
    ["LFO DEST", "pages/lfo-lfo-dest", ["PIT: vibrato", "FLT: filter wobble", "SHP: shape", "AMP: tremolo"], ""],
  ] },
  { button: "FX", color: "orange", pages: [
    ["FX", "pages/fx-fx", ["DST drive", "CHO chorus send", "DLY delay send", "REV reverb send"], "The sends of the track."],
    ["FILTER", "pages/fx-filter", ["FILT: left LP, right HP, centre off", "MIX: the INSERT's dry / wet", "—", "—"], "The one-knob filter of the track. The drum track has it too."],
    ["SLICER", "pages/fx-slicer", ["SLCR: OFF, GATE, STUT", "PAT: pattern 1–16", "RATE: 1/8 … 32T", "DEPTH"], "A tempo gate or stutter on the track."],
    ["INSERT", "pages/fx-insert", ["INSRT: SOFT, HARD, FOLD, FUZZ, CRUSH, PHASR, FLANG, CHOR", "A", "B", "C"], "One effect on the track alone. Drive types: drive · tone · level. CRUSH: bits · rate · LPF. Modulation: rate · depth · feedback."],
    ["DLY", "pages/fx-dly", ["TIME: 1/4 … 1/4D", "FDBK feedback", "COLR tone of the repeats", "MIX"], "Global: the same for every track."],
    ["REV/CHO", "pages/fx-rev-cho", ["SIZE reverb size", "DAMP damping", "CRT chorus rate", "CDP chorus depth"], "Global."],
    ["PERF", "pages/fx-perf", ["TARGET: MASTER, SEL, DRUMS, SYNTHS", "LATCH: a tap toggles an effect", "Q: OFF, 1/16, 1/8, 1/4, BAR", "—"], "Global: how the punch-in effects behave."],
  ] },
  { button: "SEL", color: "green", pages: [
    ["SEL", "pages/scl-sel", ["ROOT: the key of the track", "SCL: the scale of the track", "QNT keys: OFF, SNAP, WHITE", "CHORD: OFF, TRIAD, 7TH, 9TH, SUS4, POWER"], ""],
    ["SEL 2", "pages/scl-sel-2", ["TRN transpose ±24", "STRUM ±60 ms", "VLEAD voice leading", "—"], "STRUM plays a chord's notes one after the other; VLEAD voices each chord nearest the last."],
    ["HARMONY", "pages/scl-harmony", ["KEY of the song", "SCALE (16)", "Q: NOW, BEAT, BAR", "PROG: progression OFF / ON"], "Global."],
    ["FOLLOW", "pages/scl-follow", ["FOLLOW: OFF, TRANS, SCALE", "—", "—", "—"], "How the track's sequenced notes follow the song's chord."],
    ["CHORDS", "pages/scl-chords", ["CHORD", "DEGREE", "BARS", "COUNT"], "The chord and progression of the song; the keys play the chord live."],
  ] },
  { button: "EDIT", color: "red", pages: [
    ["EDIT 1", "pages/edit-edit-1", ["engine parameter 1", "2", "3", "4"], "The engine's first four parameters (ANALOG: WAVE, DTN, MIX, NOIS)."],
    ["EDIT 2", "pages/edit-edit-2", ["engine parameter 5", "6", "7", "8"], "The next four (ANALOG: CUT, RES, DRV, KTR)."],
    ["FILTER", "pages/edit-filter", ["TYPE: LP, BP, HP", "CUT cutoff", "RES resonance", "KTR key tracking"], "ANALOG only."],
    ["VOICE", "pages/edit-voice", ["VCE: POLY, MONO, LEG, UNI", "GLD glide", "GLMOD: RATE / TIME", "PRIO: LAST, LOW, HIGH"], "Set POLY to hold a note under others."],
    ["VOICE 2", "pages/edit-voice-2", ["ALLOC: ROT / REUSE", "DTUNE unison detune", "PAN", "MUTE"], ""],
  ] },
  { button: "ARP", color: "yellow", pages: [
    ["ARP", "pages/arp-arp", ["MODE: UP, DN, UPDN, RND, ORD, REPEAT, CHORD…", "RATE: 1/4 … 16T", "OCT: 1–4 octaves", "GATE"], "15 modes, from UP to WALK and CHORD."],
    ["ARP 2", "pages/arp-arp-2", ["SWG swing", "PROB note probability", "HOLD latch (MODE OFF: KBD HOLD)", "ORD: NOTE / PLAY order"], "With HOLD ON and MODE OFF the keys hold a pad or drone after you let go."],
  ] },
  { button: "SEQ", color: "blue", pages: [
    ["NOTES", "pages/seq-notes", ["NOTE cursor", "PITCH", "LEN in steps", "FORCE: GHOST … ACC"], "A piano roll of the track. Hold OCT+ for the note's sheet: slide, nudge, fill, move, copy, delete, locks."],
    ["TIMING", "pages/seq-timing", ["LEN 1–64 steps", "DIV 1/4 … 2BAR", "SWG track swing", "GATE note length"], ""],
    ["PLAY", "pages/seq-play", ["DIR: FWD, REV, PEND, RAND", "SEED 0–255", "—", "—"], "On a drum track, hold white keys here to write a whole beat."],
    ["PATTERNS", "pages/seq-patterns", ["PATTERN cursor", "QUANT", "COPY (twice)", "CLEAR (twice)"], "Eight patterns per track; keys 1–8 are pads, 9–16 launch scenes."],
    ["CHAIN", "pages/seq-chain", ["SLOT", "its PATTERN", "REPEAT ×1–×16", "PLAY on / off"], "A playlist of the track's patterns."],
    ["SCENES", "pages/seq-scenes", ["SCENE", "QUANT", "NAME", "the PATTERN of the track"], "Every track's pattern at once. Also: hold SEQ, tap SAVE."],
    ["SONG", "pages/seq-song", ["song step", "its section A–D", "its length in bars", "steps in the song"], "The section chain. REC stores the loop, OCT− loop / song."],
  ] },
  { button: "GLO", color: "blue", pages: [
    ["GLOBAL", "pages/glo-global", ["BPM 40–240", "SWING (all tracks)", "CLICK: OFF, REC, ON", "TUNE ±50 cents"], ""],
    ["MASTER", "pages/glo-master", ["DUST old sampler", "DUCK kick pump", "FILT DJ filter", "ROLL note-repeat rate"], ""],
    ["DRUMS", "pages/glo-drums", ["LVL drum level", "REV drum reverb", "DLY drum delay", "—"], ""],
    ["TEXTURE", "pages/glo-texture", ["SRC: VINYL, TAPE, RAIN, WIND, RADIO, ROOM, USR1–4", "LEVEL", "TONE", "MOVE"], "A looping bed under the whole mix."],
    ["TEXTURE 2", "pages/glo-texture-2", ["RATE 1–16 bars", "WHEN: PLAY / ALWAYS", "DUCK: ON / OFF", "—"], ""],
  ] },
  { button: "SAVE", color: "yellow", pages: [
    ["USER", "pages/save-user", ["SLOT 1–32", "LOAD (GO)", "ERASE (GO)", "SAVE (GO)"], "Your own sounds. GO: one click arms, a second click within 1.5 s acts."],
    ["SECTION", "pages/save-section", ["SECT A–D", "ERASE (GO)", "LOAD (GO)", "SAVE (GO)"], "The song's four sections."],
    ["TOOLS", "pages/save-tools", ["CLRSQ clear the pattern", "INIT reset the sound", "KIND synth ↔ drum track", "NEW loop"], "All four are GO values."],
  ] },
  { button: "MIDI", color: "green", via: "hold HOME → SEQ → MIDI SETTINGS, OCT+", pages: [
    ["MIDI", "pages/midi-midi", ["CH1", "CH2", "CH3", "CH4 (drums, default 10)"], "The MIDI channel of each track."],
    ["MIDI 2", "pages/midi-midi-2", ["CH5", "CH6", "CH7", "CH8"], ""],
    ["MIDI 3", "pages/midi-midi-3", ["IN: NOTES / CLOCK / CH", "OTHER: SEL / OFF", "OUT: KEYS / SEQ", "BEND range 1–12"], ""],
    ["MIDI 4", "pages/midi-midi-4", ["FX CH: punch-ins over MIDI", "DR MAP: GM / 1-16", "REMOTE: buttons over MIDI", "CLOCK out"], ""],
    ["SYSTEM", "pages/midi-system", ["SYNC: INT, USB, TRS", "CPU load", "—", "—"], ""],
  ] },
];
