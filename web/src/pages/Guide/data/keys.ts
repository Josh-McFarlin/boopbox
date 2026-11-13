// SPDX-License-Identifier: GPL-3.0-only
// The 27 keys: the white keys (key 1 = F3), the black keys, and the 16 sounds of a drum track.

/* the 16 white keys (key 1 = F3) and the 11 black keys, low to high */
export const WHITE = [
  'F3',
  'G3',
  'A3',
  'B3',
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
  'G5',
]
export const BLACK = [
  'F#3',
  'G#3',
  'A#3',
  'C#4',
  'D#4',
  'F#4',
  'G#4',
  'A#4',
  'C#5',
  'D#5',
  'F#5',
]

/* the white key each black key sits after (0-based) */
export const BLACK_AFTER = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12, 14]

/* the 16 sounds of a drum track, one per white key */
export const DRUMS = [
  'KICK',
  'KICK 2',
  'SNARE',
  'CLAP',
  'HAT',
  'OPEN HAT',
  'PEDAL HAT',
  'RIM',
  'SNARE 2',
  'LOW TOM',
  'HI TOM',
  'CRASH',
  'RIDE',
  'SHAKER',
  'CONGA',
  'COWBELL',
]
