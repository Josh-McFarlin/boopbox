// SPDX-License-Identifier: GPL-3.0-only
export function parseKeyboardMessage(data) {
  if (!data || data.length !== 3) return null;
  const status = data[0] & 0xf0;
  const note = data[1];
  const velocity = data[2];
  if ((status !== 0x80 && status !== 0x90)
    || !Number.isInteger(note) || note < 0 || note > 127
    || !Number.isInteger(velocity) || velocity < 0 || velocity > 127) return null;
  return { note, on: status === 0x90 && velocity > 0, velocity: velocity || 64 };
}
