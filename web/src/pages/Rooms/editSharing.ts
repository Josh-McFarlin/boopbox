// SPDX-License-Identifier: GPL-3.0-only

/* the part of a connected device (an FM-1 from connectFm1) that live sound-edit sharing drives */
export interface SoundEditSharingDevice {
  setSoundEditsPaused(paused: boolean): void
}

export interface SoundEditSharingController {
  readonly paused: boolean
  setPaused(value: boolean): boolean
  attachDevice(nextDevice: SoundEditSharingDevice | null): void
}

export function createSoundEditSharingController(): SoundEditSharingController {
  let paused = false
  let device: SoundEditSharingDevice | null = null

  return {
    get paused() {
      return paused
    },
    setPaused(value) {
      paused = !!value
      device?.setSoundEditsPaused(paused)
      return paused
    },
    attachDevice(nextDevice): void {
      device = nextDevice
      device?.setSoundEditsPaused(paused)
    },
  }
}
