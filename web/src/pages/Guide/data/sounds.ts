// SPDX-License-Identifier: GPL-3.0-only
// The thirteen synth engines. From GUIDE.md, section 17.
export const ENGINES: [engine: string, what: string][] = [
  ["ANALOG", "virtual analogue: two oscillators, filter"], ["DIGITAL", "4-operator FM"], ["PHASE", "phase distortion"],
  ["LOFI", "8-bit chip"], ["SAMPLE", "sampler: piano, bass, vibes, horns, your own"], ["VOICE", "formant voice, choirs, talkbox"],
  ["TRIO", "three oscillators"], ["WHEEL", "tonewheel organ"], ["GRAIN", "granular clouds"], ["FM6", "six-operator FM, DX7 patches"],
  ["PHYS", "physical models: strings, bars, drum heads"], ["NOISE", "noise, crackle, metallic tones"], ["OBERVAVE", "8-voice analog polysynth, 70 programs"],
];
