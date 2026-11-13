// SPDX-License-Identifier: GPL-3.0-only
// The editor's pages: a component for each tab (core/tabs.js TABS). A page module may also export init(), run once when
// the editor starts (to register its hooks for the core, core/hooks.js, or to open its storage).
import type { ComponentType } from 'react'

import type { Tab } from '../core/tabs.ts'

import * as library from './Library.tsx'
import * as live from './Live.tsx'
import * as patterns from './Patterns.tsx'
import * as preview from './Preview.tsx'
import * as save from './Projects.tsx'
import * as sequencer from './Sequencer.tsx'
import * as settings from './Settings.tsx'
import * as slots from './Slots.tsx'
import * as song from './Song.tsx'
import * as sound from './Sound.tsx'
import * as theme from './Theme.tsx'
import * as mixer from './Tracks.tsx'

/* a page module: its component, and maybe its init() */
export interface PageModule {
  default: ComponentType
  init?: () => void
}
const MODULES: Record<Tab, PageModule> = {
  live,
  sound,
  sequencer,
  patterns,
  song,
  save,
  library,
  slots,
  settings,
  theme,
}
export const PAGES = Object.fromEntries(
  Object.entries(MODULES).map(([k, m]) => [k, m.default]),
) as Record<Tab, ComponentType>
/* the local audio preview (?mock=1): in the transport bar's drawer at the bottom of every page but LIVE */
export const Preview = preview.default
export function initPages(): void {
  /* (the mixer's logic: the strips' reads and writes, for LIVE and the track bar; core/hooks.js H.readMixer ...) */
  for (const m of [...Object.values(MODULES), preview, mixer] as PageModule[])
    if (m.init) m.init()
}
