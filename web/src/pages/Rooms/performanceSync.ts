// SPDX-License-Identifier: GPL-3.0-only
import type { RoomClock, RoomPerformance } from './types.ts'

const RETRY_DELAY_MS = 400
const MAX_RETRIES = 2

/* one player's shared performance, as last received, and how far applying it to the room audio got */
export interface PerformanceState {
  key: string
  performance: RoomPerformance
  clock: RoomClock | null
  applied: boolean
  attempts: number
  inFlight: boolean
  failed: boolean
  retryTimer: ReturnType<typeof setTimeout> | null
}

/* the part of the room audio (RoomAudio) a performance is applied to */
export interface PerformanceAudio {
  setPerformance(
    slot: number,
    performance: RoomPerformance,
    clock?: RoomClock | null,
  ): Promise<unknown>
}

export interface ApplyPerformanceOptions {
  states: Map<string, PerformanceState>
  audio: PerformanceAudio | null | undefined
  playerId: string
  slot: number
  performance: RoomPerformance | null | undefined
  clock?: RoomClock | null
  onError: (error: Error) => void
  shouldApply?: boolean
  retryDelayMs?: number
  maxRetries?: number
}

export function applyPerformanceWithRetry({
  states,
  audio,
  playerId,
  slot,
  performance,
  clock = null,
  onError,
  shouldApply = true,
  retryDelayMs = RETRY_DELAY_MS,
  maxRetries = MAX_RETRIES,
}: ApplyPerformanceOptions): PerformanceState | null {
  if (!performance) return null
  const key = JSON.stringify(performance)
  let state = states.get(playerId)

  if (state?.key !== key) {
    if (state?.retryTimer) clearTimeout(state.retryTimer)
    state = {
      key,
      performance,
      clock,
      applied: false,
      attempts: 0,
      inFlight: false,
      failed: false,
      retryTimer: null,
    }
    states.set(playerId, state)
  } else {
    state.performance = performance
    if (clock) state.clock = clock
  }

  if (!shouldApply) {
    state.applied = true
    return state
  }
  if (
    !audio ||
    state.applied ||
    state.inFlight ||
    state.failed ||
    state.retryTimer
  )
    return state

  const attempt = (): void => {
    if (states.get(playerId) !== state) return
    state.attempts += 1
    state.inFlight = true
    Promise.resolve()
      .then(async () =>
        audio.setPerformance(slot, state.performance, state.clock),
      )
      .then(() => {
        if (states.get(playerId) !== state) return
        state.inFlight = false
        state.applied = true
      })
      .catch((error) => {
        if (states.get(playerId) !== state) return
        state.inFlight = false
        if (state.attempts <= maxRetries) {
          state.retryTimer = setTimeout(() => {
            state.retryTimer = null
            if (states.get(playerId) === state) attempt()
          }, retryDelayMs)
          return
        }
        state.failed = true
        onError(error)
      })
  }

  attempt()
  return state
}
