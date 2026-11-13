// SPDX-License-Identifier: GPL-3.0-only
// The site's accents (site.css): the track colours' names, drawn in magenta, cyan, lime and yellow, and red for erase.
/* an accent's name */
export type Accent = 'blue' | 'green' | 'yellow' | 'orange' | 'red'

export const C: Record<Accent, string> = {
  blue: '#3ee6ff',
  green: '#c6ff3d',
  yellow: '#ffd23f',
  orange: '#ff4fd8',
  red: '#ff6b8a',
}

/* the colour of each of KNOB 1–4's dials on the FM-1's screen */
export const KNOB_C = [C.blue, C.green, C.yellow, C.orange]

/* Tailwind text classes for the accent names (written out, so Tailwind sees them) */
export const TEXT: Record<Accent, string> = {
  blue: 'text-blue',
  green: 'text-green',
  yellow: 'text-yellow',
  orange: 'text-orange',
  red: 'text-red',
}
