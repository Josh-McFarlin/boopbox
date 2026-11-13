// SPDX-License-Identifier: GPL-3.0-only
/* Fukiai glyphs by their names in hugelton-plugin-rules lib/include/hugelton/Glyphs.h */
export const GLYPH = {
  port_usb_c: 0xEA3F, symbol_audio: 0xEA40, symbol_download: 0xEAD4, symbol_upload: 0xEAD5,
  symbol_folder: 0xEAB8, symbol_folder_open: 0xEAB9, port_disk: 0xEAB3, symbol_trash: 0xEAC1,
  control_arrow_loop: 0xEAD6, note_eight: 0xEAEF, symbol_waves: 0xEAE6, function_env_adsr_exp: 0xEA12,
  ui_knob: 0xEA70, symbol_keyboard: 0xEABC, symbol_effector: 0xEAB7, symbol_echo: 0xEAB5, symbol_spring: 0xEAD1,
  symbol_tuning: 0xEAA7, control_arrow_up_down: 0xEACF, symbol_grid: 0xEABA, symbol_cog: 0xEA46, symbol_drum: 0xEA66,
  function_filter_lpf_peak: 0xEAA0, ui_slider_vertical: 0xEA73, symbol_books: 0xEADC, control_rec_f: 0xEA09,
  symbol_pan: 0xEA53, control_speaker_mute: 0xEAEB,
  waveform_sine: 0xEA85, waveform_triangle_ac: 0xEA89, waveform_sawtooth_ac: 0xEA81, waveform_square: 0xEA87,
  waveform_pulse_quarter: 0xEA7F, waveform_pulse_eighth: 0xEA7B, waveform_noise_step: 0xEA79,
  waveform_noise_white: 0xEA7A, waveform_harmonic: 0xEAC5,
};
/** a glyph's name (a key of GLYPH) */
export type GlyphName = keyof typeof GLYPH;
/* section headings (LAYOUT titles) and page titles */
export const HEAD_IC: Record<string, GlyphName> = { ENV: "function_env_adsr_exp", LFO: "waveform_sine", EDIT: "ui_knob", VOICE: "symbol_keyboard",
  FX: "symbol_effector", SEL: "symbol_tuning", ARP: "control_arrow_up_down", "SEQ TIMING": "symbol_grid",
  GLOBAL: "symbol_cog", MASTER: "ui_slider_vertical", DRUMS: "symbol_drum", INSTRUMENT: "symbol_keyboard" };
export const PAGE_IC: Record<string, GlyphName> = { FLT: "function_filter_lpf_peak", FILT: "function_filter_lpf_peak", DLY: "symbol_echo", "REV/CHO": "symbol_spring", SLICER: "symbol_grid" };
/* WAVE / WAVE2 choices; phase-distortion shapes without a close glyph (SPLS, RSAW, RTRI, RTRP) get none */
export const WAVE_IC: Record<string, GlyphName> = { SIN: "waveform_sine", TRI: "waveform_triangle_ac", SAW: "waveform_sawtooth_ac", SQR: "waveform_square",
  PLS: "waveform_pulse_quarter", PWM: "waveform_pulse_eighth", "S&H": "waveform_noise_step", NOIS: "waveform_noise_white",
  DSIN: "waveform_harmonic" };
/* options can hold an icon only where the browser draws the picker itself; a native menu would show a box */
