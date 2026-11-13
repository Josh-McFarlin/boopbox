// SPDX-License-Identifier: GPL-3.0-only
// The DRUMS screen's three pages and the grooves of "beats from the keys". From GUIDE.md, sections 7 and 10.

/* [page, its screen, how to open it, what it does] */
export const DRUM_PAGES: [
  page: string,
  shot: string,
  how: string,
  what: string,
][] = [
  [
    'Grid',
    'drums/drums-sheet',
    'tap SEQ',
    '16 sounds × 16 steps. KNOB 1 sound · 2 step · 3 hit · 4 level. The white keys are the steps of the sound, the black keys pick the sound, OCT−/OCT+ turn the page of steps.',
  ],
  [
    'Kit',
    'drums/drums-kit',
    'tap EDIT',
    '16 pads that flash on every hit. KNOB 1 kit · 2 level · 3 reverb · 4 pan.',
  ],
  [
    'Sound',
    'drums/drums-sound',
    'tap EDIT again',
    'Tune each sound −8…+7 semitones and make it shorter or longer. KNOB 1 sound · 2 tune · 3 decay · 4 level.',
  ],
]

/* the groove of the lowest key held on a drum track's PLAY page, keys 1–8 (9–16: the same, busier) */
export const BEATS = [
  'HOUSE',
  'ROCK',
  'BOOM BAP',
  'TRAP',
  'BREAK',
  'DEMBOW',
  'DNB',
  'ELECTRO',
]
