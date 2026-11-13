// SPDX-License-Identifier: GPL-3.0-only
// The visual guide's content: every control of the FM-1 panel, what the 27 keys and the knobs do in each layer, every
// page knob by knob, the menu, the effects and the "where is…?" list. All of it follows GUIDE.md (the firmware's own
// guide): when the firmware changes a control, change it there and here.

/* the FM-1's own screens, drawn by the firmware's code (project/tools/make_screens.py): shot("pages/env-env") */
const SHOTS = import.meta.glob("../../../project/assets/screens/all/*/*.png", { eager: true, import: "default" });
export const shot = (name) => SHOTS[`../../../project/assets/screens/all/${name}.png`];

/* the site's four accents (site.css): the track colours' names, drawn in magenta, cyan, lime and yellow */
export const C = { blue: "#3ee6ff", green: "#c6ff3d", yellow: "#ffd23f", orange: "#ff4fd8", red: "#ff6b8a" };

/* the 16 white keys (key 1 = F3) and the 11 black keys, low to high */
export const WHITE = ["F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5"];
export const BLACK = ["F#3", "G#3", "A#3", "C#4", "D#4", "F#4", "G#4", "A#4", "C#5", "D#5", "F#5"];
/* the white key each black key sits after (0-based) */
export const BLACK_AFTER = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12, 14];

export const DRUMS = ["KICK", "KICK 2", "SNARE", "CLAP", "HAT", "OPEN HAT", "PEDAL HAT", "RIM", "SNARE 2", "LOW TOM", "HI TOM",
  "CRASH", "RIDE", "SHAKER", "CONGA", "COWBELL"];

/* ---------------------------------------------------------------- the panel's controls --- */
/* id -> what it is, and what a tap (or a turn) and a hold do. `kind`: knob, button, keys */
export const CONTROLS = {
  MASTER: { name: "MASTER", kind: "knob", tap: "The output volume (headphones and line out). The visualiser ignores it." },
  SELECT: { name: "SELECT", kind: "knob", tap: "On TRACKS, inside a layer and on the REC screen: the tempo. On a page: the previous / next page of its button. DRUMS kit / sound: kit ↔ sound. Visualiser: the style. Menu: the section." },
  PRESETS: { name: "PRESETS", kind: "knob", tap: "On TRACKS: opens the sound browser (the first click opens it, the sound stays), then the next / previous engine in it. On a drum track: the kit. With SEQ + a step held: a parameter lock on that step." },
  ALGORITHM: { name: "ALGORITHM", kind: "knob", tap: "Selects the track, 1–8, on every screen except SONG (there: its loop start) and the sound browser (there: its sounds). Inside a layer it waits. Turn it while you record to move the take to the next track." },
  KNOB1: { name: "KNOB 1", kind: "knob", tap: "The value the first dial at the bottom of the screen shows (top left on a page of values)." },
  KNOB2: { name: "KNOB 2", kind: "knob", tap: "The second dial at the bottom of the screen." },
  KNOB3: { name: "KNOB 3", kind: "knob", tap: "The third dial at the bottom of the screen." },
  KNOB4: { name: "KNOB 4", kind: "knob", tap: "The fourth dial at the bottom of the screen." },
  OCTM: { name: "OCT−", kind: "button", tap: "Synth track: one octave down (to −3). With OCT+: back to 0. Pages: the previous page of steps.", hold: "Drum track: ghost hits while held. With EDIT: undo. Held at power-on: USB rescue." },
  OCTP: { name: "OCT+", kind: "button", tap: "Synth track: one octave up (to +3). With OCT−: back to 0. In the menu: changes or opens the setting.", hold: "Drum track: hard hits while held. With EDIT: redo. On the NOTES page or DRUMS grid (0.4 s): the step's sheet." },
  FX: { name: "FX", kind: "button", layer: "FX", tap: "The FX pages: FX, FILTER, SLICER, INSERT, DLY, REV/CHO, PERF.", hold: "The PUNCH layer: 27 punch-in effects on the keys, master filter, DUST, DUCK and the track filter on the knobs." },
  SEL: { name: "SEL", kind: "button", layer: "SEL", tap: "The SEL pages: SEL, SEL 2, HARMONY, FOLLOW, then the CHORDS screen. (Not the SELECT knob.)", hold: "The KEY layer: a key sets the key of the song; the knobs set chord, scale, keys and transpose." },
  ENV: { name: "ENV", kind: "button", tap: "The envelope pages: ENV (attack, decay, sustain, release) and ENV DEST.", hold: "No layer: ENV only opens pages." },
  LFO: { name: "LFO", kind: "button", tap: "The LFO pages: LFO, LFO 2 (sync, trigger, polarity) and LFO DEST.", hold: "No layer: LFO only opens pages." },
  EDIT: { name: "EDIT", kind: "button", layer: "EDIT", tap: "The engine pages: EDIT 1, EDIT 2, FILTER (ANALOG), VOICE, VOICE 2. On a drum track: the DRUMS kit page (again: the sound page). On NOTES: deletes the note.", hold: "The ERASE layer: a key erases its sound / note as the pattern plays. With OCT− / OCT+: undo / redo." },
  GLO: { name: "GLO", kind: "button", layer: "GLO", tap: "The global pages: GLOBAL, MASTER, DRUMS, TEXTURE, TEXTURE 2.", hold: "The MIX layer: mute, solo, fill, tap tempo on the keys; the four levels of the bank on the knobs." },
  HOME: { name: "HOME", kind: "button", tap: "The TRACKS screen. On TRACKS: the visualiser (HOME again closes it). In the sound browser: puts back the sound you had.", hold: "0.7 s: the menu (SCREEN, LIGHTS, AUDIO, KEYS, SEQ, SYSTEM). While you hold a layer, a tap on HOME locks that layer open." },
  SAVE: { name: "SAVE", kind: "button", layer: "SAVE", tap: "On TRACKS or DRUMS: the SONG screen. On SONG: saves the song. Elsewhere: the SAVE pages (USER, SECTION, TOOLS). In the sound browser: keeps the sound.", hold: "The SONG layer: play or save sections A–D, a quick chain, loop / song mode, SONG REC." },
  ARP: { name: "ARP", kind: "button", layer: "ARP", tap: "The arpeggiator pages: ARP and ARP 2.", hold: "The ROLL layer: a held key repeats on the grid (note repeat), recorded as ratchets." },
  SEQ: { name: "SEQ", kind: "button", layer: "SEQ", tap: "The SEQ pages: NOTES (or the DRUMS grid), TIMING, PLAY, PATTERNS, CHAIN, SCENES, then the SONG screen.", hold: "The STEPS layer: the white keys are the 16 steps of the page. Held + SAVE tapped: the SCENES page." },
  PLAY: { name: "PLAY / STOP", kind: "button", tap: "Starts and stops all the tracks (in song mode: plays the song). Works inside every layer. Its light flashes on every beat: a silent metronome.", hold: "—" },
  REC: { name: "REC", kind: "button", tap: "Playing: record the selected track now / stop recording. Stopped: arm (rec ready). In a free take: close the loop. In a count-in: cancel.", hold: "About 2 s: clear the selected track. A ring fills; let go before it is full and nothing happens." },
  WHITE: { name: "White keys", kind: "keys", tap: "16 keys, F3 (key 1) to G5 (key 16). A synth track plays notes; a drum track plays its 16 sounds. Inside a layer they do the layer's functions. Keys 1, 5, 9 and 13 glow dimly in a layer: the first key of each row of tiles." },
  BLACK: { name: "Black keys", kind: "keys", tap: "11 keys, F#3 to F#5. On a synth track: the sharps. On a drum track: the sound of the white key on their left (two fingers for fast rolls). In chord mode they change the chord (CHORD+). The labels printed on them belong to the stock firmware." },
};

/* ------------------------------------------------------------------------- layers --- */
/* what the keys and knobs do while a button is held (or with nothing held). white/black: one label a key ("" = nothing);
   knobs: four labels; more: the other controls of the layer; shot: the FM-1 screen of the layer */
const EMPTY = (n) => Array(n).fill("");
export const LAYERS = [
  { id: "PLAY", button: null, name: "Nothing held", title: "Play", color: "blue", shot: "home/tracks-1-4",
    blurb: "With no button held, the keys play the selected track and the knobs follow the screen. On TRACKS: KNOB 1 global swing, KNOB 2 the level of the track, KNOB 3 its steps, KNOB 4 its pan.",
    white: WHITE, black: BLACK, knobs: ["SWING", "LEVEL", "STEPS", "PAN"],
    more: [["OCT− / OCT+", "octave −3 … +3 (both: 0)"], ["SELECT", "the tempo"], ["ALGORITHM", "the track, 1–8"], ["PRESETS", "the sound browser"]] },
  { id: "DRUM", button: null, name: "Nothing held, drum track", title: "Drums", color: "green", shot: "drums/drums-kit",
    blurb: "A drum track has 16 sounds, one a white key. A black key plays the sound of the white key on its left, so two fingers can roll one sound. Hold OCT− for ghost hits and OCT+ for hard ones.",
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

/* ---------------------------------------------------------------------------- pages --- */
/* button -> its pages: [name, shot, [KNOB 1..4], note] */
export const PAGES = [
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
    ["PATTERNS", "pages/seq-patterns", ["PATTERN cursor", "QUANT", "COPY (twice)", "CLEAR (twice)"], "Eight patterns a track; keys 1–8 are pads, 9–16 launch scenes."],
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

/* ------------------------------------------------------------------------ the menu --- */
export const MENU = [
  ["SCREEN", "system/menu-screen", ["COLOR: the screen palette (SYNTHWAVE…)", "ZOOM: the value you touch, large", "KNOB ACCEL: fast turns sweep wider", "—"]],
  ["LIGHTS", "system/menu-lights", ["LIGHTS: OFF, LOW, MID, HIGH", "KEYS: OFF, C KEYS, WHITE, ALL", "NOTES: sounding notes light their keys", "—"]],
  ["AUDIO", "system/menu-audio", ["SPEAKER LOWCUT", "USB AUDIO: MASTER / FULL", "USB RATE: AUTO, 44.1, 48 kHz", "FILTER RESO of the track filter"]],
  ["KEYS", "system/menu-keys", ["VELOCITY: OFF, SOFT, NORMAL, HARD", "AFTERTOUCH: filter or vibrato", "VEL LEARN", "USB HOST: play a USB keyboard"]],
  ["SEQ", "system/menu-seq", ["STEP ADVANCE", "DRUM PREVIEW", "REC KNOBS: SOUND / LOCKS", "MIDI SETTINGS (OCT+ opens)"]],
  ["SYSTEM", "system/menu-system", ["2ND CORE", "HARDWARE CALIBRATION", "MIDI LEARN CLEAR", "ABOUT: the version"]],
];

/* ---------------------------------------------------------------------- the basics --- */
export const TRACKS = [
  [1, "synth", "blue"], [2, "synth", "green"], [3, "synth", "yellow"], [4, "drums", "orange"],
  [5, "synth", "blue"], [6, "synth", "green"], [7, "synth", "yellow"], [8, "drums", "orange"],
];

export const FIRST_BEAT = [
  ["Pick the drums", "Turn ALGORITHM to track 4. The white keys play 16 drum sounds: F3 kick, A3 snare, C4 hat… Turn PRESETS for a kit: try 808 or BOOMBAP.", "drums/drums-kit"],
  ["Play freely", "Press REC (rec ready) and play a beat at your own tempo. No click, no count-in. Hold OCT− for ghost notes, OCT+ for hard hits.", "rec/rec-free"],
  ["Close the loop", "Press REC on the “1” after your last bar. Its length sets the tempo, the hits snap to the grid, and the loop plays at once.", "home/tracks-1-4"],
  ["Add on top", "Press REC again while it plays to overdub. Hold ARP and hold the hat key (C4) for a 1/16 roll, written as ratchets.", "layers/layer-arp"],
  ["A bass line", "Turn ALGORITHM to track 1 (808 BOOM), press REC and play a bass line.", "pages/seq-notes"],
  ["Chords with one finger", "Hold SEL and press the key of your song. Select track 2, hold SEL and turn KNOB 1 to 7TH: each white key now plays a chord of the key.", "layers/layer-scl"],
  ["Punch in", "Hold FX and hold a key for an effect. While you hold FX, turn KNOB 2 for DUST and KNOB 3 for DUCK.", "layers/layer-fx"],
  ["Oops?", "EDIT + OCT− undoes. EDIT + OCT+ redoes.", "layers/layer-edit"],
];

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

export const CHORDS_PLUS = [["F#", "major ↔ minor"], ["G#", "adds the 7th"], ["A#", "sus4"], ["C#", "adds the 9th"], ["D#", "an inversion"]];
export const CHORD_MODES = [["OFF", "single notes"], ["TRIAD", "1-3-5"], ["7TH", "1-3-5-7"], ["9TH", "1-3-7-9"], ["SUS4", "1-4-5"], ["POWER", "1-5-8"]];

export const BEATS = ["HOUSE", "ROCK", "BOOM BAP", "TRAP", "BREAK", "DEMBOW", "DNB", "ELECTRO"];

export const ENGINES = [
  ["ANALOG", "virtual analogue: two oscillators, filter"], ["DIGITAL", "4-operator FM"], ["PHASE", "phase distortion"],
  ["LOFI", "8-bit chip"], ["SAMPLE", "sampler: piano, bass, vibes, horns, your own"], ["VOICE", "formant voice, choirs, talkbox"],
  ["TRIO", "three oscillators"], ["WHEEL", "tonewheel organ"], ["GRAIN", "granular clouds"], ["FM6", "six-operator FM, DX7 patches"],
  ["PHYS", "physical models: strings, bars, drum heads"], ["NOISE", "noise, crackle, metallic tones"], ["OBERVAVE", "8-voice analog polysynth, 70 programs"],
];

export const VISUALISER = [
  ["PALMS", "the wave of the mix as the sea at sunset", "visualiser/vis-palms"],
  ["NIGHT DRIVE", "a car at night; the city is the spectrum", "visualiser/vis-night-drive"],
  ["HORIZON", "a neon range of 32 bands over a grid", "visualiser/vis-horizon"],
  ["FLYOVER", "the spectrum over time as a terrain", "visualiser/vis-flyover"],
  ["DENSE CITY", "the eight tracks as towers, VU meters", "visualiser/vis-dense-city"],
  ["KEY CITY", "two octaves of keys lit by the notes", "visualiser/vis-key-city"],
];

export const SPECIAL = [
  ["OCT− held at power-on", "USB rescue: install again from the browser"],
  ["OCT− + OCT+ held at power-on", "hardware calibration: teach every button and knob"],
  ["OCT− + OCT+ held 5 s, stopped", "update mode (your work is saved first)"],
  ["Any layer + tap HOME", "locks the layer open: both hands free. Any other button unlocks it"],
  ["GO values (LOAD, SAVE, NEW…)", "one click arms (TURN AGAIN), a second within ~1.5 s acts"],
  ["SAVE + key 5–8 on a used section", "press again within 3 s to save over it"],
];

/* "where is…?": [looking for, where] */
export const WHERE = [
  ["tempo", "SELECT on TRACKS · GLO + key 16 (tap) · GLO → GLOBAL → BPM"],
  ["swing", "TRACKS KNOB 1 (global) · SEQ + KNOB 3 (track) · GLO → GLOBAL"],
  ["metronome / click", "GLO → GLOBAL → CLICK"],
  ["the level / pan of a track", "TRACKS KNOB 2 / KNOB 4 · GLO + KNOB 1–4"],
  ["the drum kit", "PRESETS on the drum track · DRUMS kit page KNOB 1"],
  ["the drum level / reverb", "DRUMS kit page KNOB 2 / 3 · GLO → DRUMS"],
  ["the drum delay", "GLO → DRUMS → DLY"],
  ["tune a drum sound", "tap EDIT twice on the drum track: the sound page"],
  ["the filter of a track", "FX + KNOB 4 · FX → FILTER"],
  ["delay time", "FX → DLY → TIME"],
  ["chords", "SEL + KNOB 1 · SEL page"],
  ["strum, voice leading", "SEL 2"],
  ["the key and scale of the song", "SEL + a key · SEL + KNOB 2 · SEL → HARMONY"],
  ["sections A–D", "SAVE + keys 1–4 (play) / 5–8 (save) · SAVE → SECTION"],
  ["your sounds", "SAVE → USER · PRESETS: the sound browser (USER, at the end)"],
  ["favourite sounds", "sound browser: KNOB 4 right adds, left removes"],
  ["undo / redo", "EDIT + OCT− / EDIT + OCT+"],
  ["clear a track", "hold REC about 2 s"],
  ["new loop", "SAVE → TOOLS → NEW"],
  ["synth ↔ drum track", "SAVE → TOOLS → KIND · KNOB 1 in the sound browser"],
  ["the length of a note", "SEQ → NOTES page, KNOB 3 on the note"],
  ["parameter locks", "hold SEQ, hold a step, turn PRESETS"],
  ["fills", "SEQ + step + OCT+ (condition) · GLO + key 9 / 10 (play a fill)"],
  ["drum mutes", "EDIT + a black key, then the keys of the sounds"],
  ["a beat from the keys", "drum track: SEQ → PLAY page, hold white keys"],
  ["patterns, chain, scenes", "the SEQ pages after PLAY · hold SEQ + tap SAVE (SCENES)"],
  ["a vinyl / tape / rain bed", "GLO → TEXTURE"],
  ["tempo-synced envelope / LFO", "ENV DEST → ESYNC · LFO 2 → SYNC"],
  ["the MIDI pages", "hold HOME → SEQ → MIDI SETTINGS, OCT+"],
  ["MIDI channels", "MIDI (CH1–CH4) · MIDI 2 (CH5–CH8)"],
  ["clock in / out", "SYSTEM → SYNC · MIDI 4 → CLOCK"],
  ["MIDI learn", "GLO + F#3 · forget: hold HOME → SYSTEM → MIDI LEARN CLEAR"],
  ["key velocity, aftertouch, USB keyboards", "hold HOME → KEYS"],
  ["lights, screen colours, USB audio", "hold HOME (menu)"],
  ["the visualiser", "tap HOME on TRACKS · SELECT picks the style"],
  ["the version", "hold HOME → SYSTEM → ABOUT"],
];
