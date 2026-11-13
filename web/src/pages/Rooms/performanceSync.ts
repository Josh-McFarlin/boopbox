// SPDX-License-Identifier: GPL-3.0-only

const RETRY_DELAY_MS = 400;
const MAX_RETRIES = 2;

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
}) {
  if (!performance) return null;
  const key = JSON.stringify(performance);
  let state = states.get(playerId);

  if (state?.key !== key) {
    if (state?.retryTimer) clearTimeout(state.retryTimer);
    state = {
      key,
      performance,
      clock,
      applied: false,
      attempts: 0,
      inFlight: false,
      failed: false,
      retryTimer: null,
    };
    states.set(playerId, state);
  } else {
    state.performance = performance;
    if (clock) state.clock = clock;
  }

  if (!shouldApply) {
    state.applied = true;
    return state;
  }
  if (!audio || state.applied || state.inFlight || state.failed || state.retryTimer) return state;

  const attempt = () => {
    if (states.get(playerId) !== state) return;
    state.attempts += 1;
    state.inFlight = true;
    Promise.resolve()
      .then(() => audio.setPerformance(slot, state.performance, state.clock))
      .then(() => {
        if (states.get(playerId) !== state) return;
        state.inFlight = false;
        state.applied = true;
      })
      .catch((error) => {
        if (states.get(playerId) !== state) return;
        state.inFlight = false;
        if (state.attempts <= maxRetries) {
          state.retryTimer = setTimeout(() => {
            state.retryTimer = null;
            if (states.get(playerId) === state) attempt();
          }, retryDelayMs);
          return;
        }
        state.failed = true;
        onError(error);
      });
  };

  attempt();
  return state;
}
