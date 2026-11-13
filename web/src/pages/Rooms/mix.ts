// SPDX-License-Identifier: GPL-3.0-only
const PLAYER_COUNT = 8

function validSlot(slot: number) {
  return Number.isInteger(slot) && slot >= 0 && slot < PLAYER_COUNT
}

export interface RoomMixState {
  mutedSlots: number[]
  soloSlot: number | null
}

/* the part of the room audio (RoomAudio) the mix drives */
export interface RoomMixAudio {
  setMix(mutedSlots: boolean[], soloSlot: number | null): void
}

export interface RoomMixOptions {
  getAudio: () => RoomMixAudio | null | undefined
  onChange?: (state: RoomMixState) => void
}

export interface RoomMixController {
  getState(): RoomMixState
  toggleMute(slot: number): RoomMixState
  toggleSolo(slot: number): RoomMixState
  retainSlots(slots: Iterable<number>): RoomMixState
  reset(): RoomMixState
}

export function createRoomMixController({
  getAudio,
  onChange = (): void => {},
}: RoomMixOptions): RoomMixController {
  const mutedSlots = new Set<number>()
  let soloSlot: number | null = null

  const snapshot = (): RoomMixState => ({
    mutedSlots: [...mutedSlots].sort((a, b) => a - b),
    soloSlot,
  })

  const publish = () => {
    const state = snapshot()
    onChange(state)
    return state
  }

  const apply = (): void => {
    getAudio()?.setMix(
      Array.from({ length: PLAYER_COUNT }, (_, slot) => mutedSlots.has(slot)),
      soloSlot,
    )
  }

  return {
    getState: snapshot,

    toggleMute(slot) {
      if (!validSlot(slot)) return snapshot()
      if (mutedSlots.has(slot)) mutedSlots.delete(slot)
      else mutedSlots.add(slot)
      if (mutedSlots.has(slot) && soloSlot === slot) soloSlot = null
      apply()
      return publish()
    },

    toggleSolo(slot) {
      if (!validSlot(slot)) return snapshot()
      soloSlot = soloSlot === slot ? null : slot
      if (soloSlot !== null) mutedSlots.delete(soloSlot)
      apply()
      return publish()
    },

    retainSlots(slots) {
      const occupied = new Set([...slots].filter(validSlot))
      for (const slot of mutedSlots) {
        if (!occupied.has(slot)) mutedSlots.delete(slot)
      }
      if (soloSlot !== null && !occupied.has(soloSlot)) soloSlot = null
      apply()
      return publish()
    },

    reset() {
      mutedSlots.clear()
      soloSlot = null
      apply()
      return publish()
    },
  }
}
