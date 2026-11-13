// SPDX-License-Identifier: GPL-3.0-only
export interface KeyboardNote {
  note: number
  on: boolean
  velocity: number
}

export function parseKeyboardMessage(
  data: ArrayLike<number> | null | undefined,
): KeyboardNote | null {
  if (!data || data.length !== 3) return null
  const status = data[0] & 0xf0
  const note = data[1]
  const velocity = data[2]
  if (
    (status !== 0x80 && status !== 0x90) ||
    !Number.isInteger(note) ||
    note < 0 ||
    note > 127 ||
    !Number.isInteger(velocity) ||
    velocity < 0 ||
    velocity > 127
  )
    return null
  return { note, on: status === 0x90 && velocity > 0, velocity: velocity || 64 }
}
