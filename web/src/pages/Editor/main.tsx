// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox editor: the FM-1's sounds, sequences, songs, samples and settings from the computer, over USB MIDI
// (EDITOR_PROTOCOL.md). ?mock=1: a simulated FM-1 (and the firmware's own audio in the browser, when built).
import { createRoot } from 'react-dom/client'

import '@fontsource/jersey-10/latin-400.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '../../styles/editor.css'
import ErrorBoundary from '../../components/ErrorBoundary.tsx'
import { registerServiceWorker } from '../../lib/pwa.ts'

import { A, sayK } from './core/app.ts'
import { startDeviceLoops } from './core/device.ts'
import { initTabs } from './core/tabs.ts'
import Editor from './index.tsx'
import { initPages } from './tabs/index.ts'
import { loadIconFont } from './ui/kit.tsx'

document.documentElement.lang = A.lang
initTabs()
initPages()
startDeviceLoops()
loadIconFont()
registerServiceWorker()
if (!A.MOCK && !navigator.requestMIDIAccess) sayK('nomidi')
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Editor />
  </ErrorBoundary>,
)
