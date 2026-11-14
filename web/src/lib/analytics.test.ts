import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  trackEmulatorInteraction,
  trackFirmwareInstallOutcome,
} from './analytics.ts'

afterEach(() => {
  delete window.umami
})

describe('anonymous analytics events', () => {
  it('does nothing safely when the published tracker is absent', () => {
    expect(() => trackEmulatorInteraction('power')).not.toThrow()

    const track = vi.fn()
    window.umami = { track }
    trackEmulatorInteraction('power')
    expect(track).toHaveBeenCalledWith('emulator_interaction', {
      control: 'power',
    })
  })

  it('deduplicates emulator control categories for one page visit', () => {
    const track = vi.fn()
    window.umami = { track }

    trackEmulatorInteraction('button')
    trackEmulatorInteraction('button')
    trackEmulatorInteraction('key')

    expect(track).toHaveBeenCalledTimes(2)
    expect(track).toHaveBeenNthCalledWith(1, 'emulator_interaction', {
      control: 'button',
    })
    expect(track).toHaveBeenNthCalledWith(2, 'emulator_interaction', {
      control: 'key',
    })
  })

  it('reports only successful installs with product and version', () => {
    const track = vi.fn()
    window.umami = { track }

    trackFirmwareInstallOutcome('stopped', 'boopbox', '1.9.4')
    trackFirmwareInstallOutcome('failed', 'trainer', '1.9.4')
    expect(track).not.toHaveBeenCalled()

    trackFirmwareInstallOutcome('success', 'trainer', '1.9.4')
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('firmware_install_succeeded', {
      product: 'trainer',
      version: '1.9.4',
    })
  })

  it('rejects invalid install products and versions', () => {
    const track = vi.fn()
    window.umami = { track }

    trackFirmwareInstallOutcome(
      'success',
      'other' as 'boopbox',
      '1.9.4',
    )
    trackFirmwareInstallOutcome('success', 'boopbox', '1.9.4 beta')

    expect(track).not.toHaveBeenCalled()
  })

  it('does not let tracker errors break the app', () => {
    window.umami = {
      track: () => {
        throw new Error('analytics unavailable')
      },
    }

    expect(() => trackEmulatorInteraction('utility')).not.toThrow()
    expect(() =>
      trackFirmwareInstallOutcome('success', 'boopbox', '1.9.4'),
    ).not.toThrow()
  })
})
