// SPDX-License-Identifier: GPL-3.0-only
// The six sections of the HOME menu. From GUIDE.md, section 20.

export const MENU: [name: string, shot: string, knobs: string[]][] = [
  ["SCREEN", "system/menu-screen", ["COLOR: the screen palette (SYNTHWAVE…)", "ZOOM: the value you touch, large", "KNOB ACCEL: fast turns sweep wider", "—"]],
  ["LIGHTS", "system/menu-lights", ["LIGHTS: OFF, LOW, MID, HIGH", "KEYS: OFF, C KEYS, WHITE, ALL", "NOTES: sounding notes light their keys", "—"]],
  ["AUDIO", "system/menu-audio", ["SPEAKER LOWCUT", "USB AUDIO: MASTER / FULL", "USB RATE: AUTO, 44.1, 48 kHz", "FILTER RESO of the track filter"]],
  ["KEYS", "system/menu-keys", ["VELOCITY: OFF, SOFT, NORMAL, HARD", "AFTERTOUCH: filter or vibrato", "VEL LEARN", "USB HOST: play a USB keyboard"]],
  ["SEQ", "system/menu-seq", ["STEP ADVANCE", "DRUM PREVIEW", "REC KNOBS: SOUND / LOCKS", "MIDI SETTINGS (OCT+ opens)"]],
  ["SYSTEM", "system/menu-system", ["2ND CORE", "HARDWARE CALIBRATION", "MIDI LEARN CLEAR", "ABOUT: the version"]],
];
