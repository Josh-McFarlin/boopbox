// SPDX-License-Identifier: GPL-3.0-only
import { createRoot } from 'react-dom/client'

import '../../styles/site.css'
import ErrorBoundary from '../../components/ErrorBoundary.tsx'

import Guide from './index.tsx'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Guide />
  </ErrorBoundary>,
)
