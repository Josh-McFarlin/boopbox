// Replit injects the Umami tracker only for published apps with analytics enabled.
// Keep calls optional so local development and tracker failures never affect the site.
type AnalyticsData = Record<string, string | number | boolean>
type EmulatorControl =
  | 'button'
  | 'firmware'
  | 'key'
  | 'knob'
  | 'power'
  | 'utility'
type FirmwareProduct = 'boopbox' | 'trainer'
type InstallOutcome = 'success' | 'stopped' | 'failed'
export type InstallFailureReason =
  | 'permission_denied'
  | 'unsupported_browser'
  | 'notfound'
  | 'model'
  | 'stopped'
  | 'noloader'
  | 'lost'
  | 'noreturn'
  | 'mismatch'
  | 'badreq'
  | 'foreign'
  | 'other'

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void
    }
  }
}

const EMULATOR_CONTROLS = new Set<string>([
  'button',
  'firmware',
  'key',
  'knob',
  'power',
  'utility',
])
const seenEmulatorControls = new Set<EmulatorControl>()
const INSTALL_PRODUCTS = new Set<string>(['boopbox', 'trainer'])
const INSTALL_FAILURE_REASONS = new Set<string>([
  'permission_denied',
  'unsupported_browser',
  'notfound',
  'model',
  'stopped',
  'noloader',
  'lost',
  'noreturn',
  'mismatch',
  'badreq',
  'foreign',
  'other',
])
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/

function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined' || typeof window.umami?.track !== 'function')
    return

  try {
    window.umami.track(name, data)
  } catch {
    // Analytics must never interrupt a user action.
  }
}

export function trackEmulatorInteraction(
  control: EmulatorControl,
): void {
  if (
    !EMULATOR_CONTROLS.has(control) ||
    seenEmulatorControls.has(control) ||
    typeof window === 'undefined' ||
    typeof window.umami?.track !== 'function'
  )
    return

  seenEmulatorControls.add(control)
  trackEvent('emulator_interaction', { control })
}

export function trackFirmwareInstallOutcome(
  outcome: InstallOutcome,
  product: FirmwareProduct,
  version: string,
): void {
  if (
    outcome !== 'success' ||
    typeof product !== 'string' ||
    !INSTALL_PRODUCTS.has(product) ||
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version)
  )
    return

  trackEvent('firmware_install_succeeded', { product, version })
}

export function trackFirmwareInstallStarted(
  product: FirmwareProduct,
  version: string,
): void {
  if (
    typeof product !== 'string' ||
    !INSTALL_PRODUCTS.has(product) ||
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version)
  )
    return

  trackEvent('firmware_install_started', { product, version })
}

export function trackFirmwareInstallFailed(
  product: FirmwareProduct,
  version: string,
  reason: InstallFailureReason,
): void {
  if (
    typeof product !== 'string' ||
    !INSTALL_PRODUCTS.has(product) ||
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version) ||
    !INSTALL_FAILURE_REASONS.has(reason)
  )
    return

  trackEvent('firmware_install_failed', { product, version, reason })
}
