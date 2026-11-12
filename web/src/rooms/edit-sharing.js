// SPDX-License-Identifier: GPL-3.0-only

export function createSoundEditSharingController() {
  let paused = false;
  let device = null;

  return {
    get paused() {
      return paused;
    },
    setPaused(value) {
      paused = !!value;
      device?.setSoundEditsPaused(paused);
      return paused;
    },
    attachDevice(nextDevice) {
      device = nextDevice;
      device?.setSoundEditsPaused(paused);
    },
  };
}
