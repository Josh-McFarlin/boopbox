// SPDX-License-Identifier: GPL-3.0-only
// Every control of the panel: what a tap (or a turn) and a hold do. From GUIDE.md, sections 2 and 5.

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
  PLAY: { name: "PLAY / STOP", kind: "button", tap: "Starts and stops all the tracks (in song mode: plays the song). Works inside every layer. Its light flashes on every beat, so you can keep time without a click.", hold: "—" },
  REC: { name: "REC", kind: "button", tap: "Playing: record the selected track now / stop recording. Stopped: arm (rec ready). In a free take: close the loop. In a count-in: cancel.", hold: "About 2 s: clear the selected track. A ring fills; let go before it is full and nothing happens." },
  WHITE: { name: "White keys", kind: "keys", tap: "16 keys, F3 (key 1) to G5 (key 16). A synth track plays notes; a drum track plays its 16 sounds. Inside a layer they do the layer's functions. Keys 1, 5, 9 and 13 glow dimly in a layer: the first key of each row of tiles." },
  BLACK: { name: "Black keys", kind: "keys", tap: "11 keys, F#3 to F#5. On a synth track: the sharps. On a drum track: the sound of the white key on their left (two fingers for fast rolls). In chord mode they change the chord (CHORD+). The labels printed on them belong to the stock firmware." },
};

/* what the keys and knobs do while a button is held (or with nothing held). white/black: one label a key ("" = nothing);
   knobs: four labels; more: the other controls of the layer; shot: the FM-1 screen of the layer */
