// SPDX-License-Identifier: GPL-3.0-only
/* Fukiai glyphs by their names in hugelton-plugin-rules lib/include/hugelton/Glyphs.h */
export const GLYPH = {
  port_usb_c: 0xea3f,
  symbol_audio: 0xea40,
  symbol_download: 0xead4,
  symbol_upload: 0xead5,
  symbol_folder: 0xeab8,
  symbol_folder_open: 0xeab9,
  port_disk: 0xeab3,
  symbol_trash: 0xeac1,
  control_arrow_loop: 0xead6,
  note_eight: 0xeaef,
  symbol_waves: 0xeae6,
  function_env_adsr_exp: 0xea12,
  ui_knob: 0xea70,
  symbol_keyboard: 0xeabc,
  symbol_effector: 0xeab7,
  symbol_echo: 0xeab5,
  symbol_spring: 0xead1,
  symbol_tuning: 0xeaa7,
  control_arrow_up_down: 0xeacf,
  symbol_grid: 0xeaba,
  symbol_cog: 0xea46,
  symbol_drum: 0xea66,
  function_filter_lpf_peak: 0xeaa0,
  ui_slider_vertical: 0xea73,
  symbol_books: 0xeadc,
  control_rec_f: 0xea09,
  symbol_pan: 0xea53,
  control_speaker_mute: 0xeaeb,
  waveform_sine: 0xea85,
  waveform_triangle_ac: 0xea89,
  waveform_sawtooth_ac: 0xea81,
  waveform_square: 0xea87,
  waveform_pulse_quarter: 0xea7f,
  waveform_pulse_eighth: 0xea7b,
  waveform_noise_step: 0xea79,
  waveform_noise_white: 0xea7a,
  waveform_harmonic: 0xeac5,
}
/** a glyph's name (a key of GLYPH) */
export type GlyphName = keyof typeof GLYPH
/* section headings (LAYOUT titles) and page titles */
export const HEAD_IC: Record<string, GlyphName> = {
  ENV: 'function_env_adsr_exp',
  LFO: 'waveform_sine',
  EDIT: 'ui_knob',
  VOICE: 'symbol_keyboard',
  FX: 'symbol_effector',
  SEL: 'symbol_tuning',
  ARP: 'control_arrow_up_down',
  'SEQ TIMING': 'symbol_grid',
  GLOBAL: 'symbol_cog',
  MASTER: 'ui_slider_vertical',
  DRUMS: 'symbol_drum',
  INSTRUMENT: 'symbol_keyboard',
}
export const PAGE_IC: Record<string, GlyphName> = {
  FLT: 'function_filter_lpf_peak',
  FILT: 'function_filter_lpf_peak',
  DLY: 'symbol_echo',
  'REV/CHO': 'symbol_spring',
  SLICER: 'symbol_grid',
}
/* WAVE / WAVE2 choices; phase-distortion shapes without a close glyph (SPLS, RSAW, RTRI, RTRP) get none */
export const WAVE_IC: Record<string, GlyphName> = {
  SIN: 'waveform_sine',
  TRI: 'waveform_triangle_ac',
  SAW: 'waveform_sawtooth_ac',
  SQR: 'waveform_square',
  PLS: 'waveform_pulse_quarter',
  PWM: 'waveform_pulse_eighth',
  'S&H': 'waveform_noise_step',
  NOIS: 'waveform_noise_white',
  DSIN: 'waveform_harmonic',
}
/* options can hold an icon only where the browser draws the picker itself; a native menu would show a box */
