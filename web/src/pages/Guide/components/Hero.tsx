// SPDX-License-Identifier: GPL-3.0-only
// The page's opening: what the guide is, and how it writes taps, holds and keys.
import { NOTATION } from '../data/basics.ts'

import { KICKER, Kbd } from './ui.tsx'

export default function Hero() {
  return (
    <header className="border-b-4 border-b-orange bg-tile">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <p className={KICKER}>▶ Visual guide</p>
        <h1 className="m-0 mb-5 max-w-[18em] font-pixel text-[42px] leading-[1] font-bold text-balance min-[600px]:text-[60px]">
          What every <span className="text-orange">control</span> does
        </h1>
        <p className="m-0 mb-6 max-w-[40em] text-[19px] leading-[1.5]">
          This guide shows where everything in BoopBox is on the FM-1 and what
          it does. Start with the panel: pick a layer and the keys and knobs
          show their jobs. Every screen on this page is drawn by the firmware
          itself.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          {NOTATION.map(([k, v]) => (
            <span key={k}>
              <Kbd>{k}</Kbd> {v}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
