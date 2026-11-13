// SPDX-License-Identifier: GPL-3.0-only
// The guide's sections, in page order: the anchor, the name in the "on this page" list, the kicker, the heading and the
// lead paragraph. sections/index.js gives each id its component.
export interface GuideSection {
  id: string
  toc: string
  kicker: string
  title: string
  intro?: string
}

export const SECTIONS: GuideSection[] = [
  {
    id: 'panel',
    toc: 'The panel',
    kicker: 'The map',
    title: 'The panel',
    intro:
      'Four knobs and the octave buttons on the left, the screen, KNOB 1–4 and twelve buttons on the right, 11 black and 16 white keys below. KNOB 1–4 always set the four dials at the bottom of the screen.',
  },
  {
    id: 'basics',
    toc: 'Tap, hold, lock',
    kicker: 'Basics',
    title: 'Tracks, tap, hold and lock',
  },
  {
    id: 'first',
    toc: 'First beat',
    kicker: 'Tutorial',
    title: 'Your first beat',
    intro:
      'Eight steps from an empty FM-1 to a loop with drums, bass, chords and effects.',
  },
  {
    id: 'record',
    toc: 'Recording',
    kicker: 'Recording',
    title: 'Recording with REC',
    intro:
      "BoopBox records live and adds every pass on top of the last. Notes land where you heard them, because BoopBox makes up for the keys' latency. Punch-in effects, the click and notes played inside a layer are never recorded.",
  },
  {
    id: 'drums',
    toc: 'Drums',
    kicker: 'Drums',
    title: 'The drum track',
    intro:
      '16 sounds on the 16 white keys, four levels per hit (GHOST, SOFT, NORM, HARD) and ratchets up to x4. The closed and pedal hats choke the open hat. 46 kits: 37 level-matched factory kits plus your own sampled and synthesised ones.',
  },
  {
    id: 'steps',
    toc: 'Steps & locks',
    kicker: 'The sequencer',
    title: 'Steps, nudges, locks and fills',
    intro:
      'Each track has up to 64 steps with its own length and division, so tracks of different lengths loop on their own and stay in phase. Enter steps live with REC, with the SEQ layer, or on the NOTES page (a piano roll).',
  },
  {
    id: 'pages',
    toc: 'Every page',
    kicker: 'Reference',
    title: 'Every page, knob by knob',
    intro:
      'A page shows four values placed as the knobs are: 1 top left, 2 top right, 3 bottom left, 4 bottom right. Global pages (DLY, REV/CHO, PERF, HARMONY, GLOBAL, MASTER, DRUMS, TEXTURE, MIDI) are the same for every track; the others belong to the selected track.',
  },
  {
    id: 'effects',
    toc: 'Effects',
    kicker: 'Effects',
    title: 'Punch-ins, master and per track',
  },
  {
    id: 'chords',
    toc: 'Key & chords',
    kicker: 'Harmony',
    title: 'Key, scales, chords and CHORD+',
    intro:
      'Hold SEL and press any key: that is the key of the song for every synth track. SEL + KNOB 2 sets the scale (16 of them), SEL + KNOB 3 how the keys follow it: OFF (chromatic), SNAP (rounded to the scale) or WHITE (the white keys walk the scale from C4).',
  },
  {
    id: 'song',
    toc: 'Song mode',
    kicker: 'Arrange',
    title: 'Song mode: sections A–D',
    intro:
      'The FM-1 holds one song: four sections (A–D), each a full loop of the eight tracks, and up to 16 steps that play them in order. For more songs, keep an editor backup file for each.',
  },
  {
    id: 'sounds',
    toc: 'Sounds',
    kicker: 'Sounds',
    title: '223 sounds on thirteen engines',
    intro:
      'Turn PRESETS on TRACKS: the sound browser opens. KNOB 1 synth / drums, PRESETS or KNOB 2 the engine, ALGORITHM or KNOB 3 the sound, SELECT the view (by engine or by kind), KNOB 4 a favourite. SAVE keeps the sound, HOME puts back the one you had.',
  },
  {
    id: 'menu',
    toc: 'HOME menu',
    kicker: 'Settings',
    title: 'The HOME menu',
    intro:
      'Hold HOME for 0.7 s. Hold it again to leave. Six sections of FM-1 settings, with the MIDI pages inside SEQ.',
  },
  {
    id: 'visualiser',
    toc: 'Visualiser',
    kicker: 'Show',
    title: 'The visualiser',
    intro:
      'On TRACKS, tap HOME: the screen becomes a visualiser of what plays. SELECT picks the style; HOME or any page button closes it. The keys, PLAY, REC and the layers keep working.',
  },
  {
    id: 'special',
    toc: 'Power-on',
    kicker: 'Special',
    title: 'Power-on and other combinations',
  },
  { id: 'where', toc: 'Where is…?', kicker: 'Find it', title: 'Where is…?' },
]
