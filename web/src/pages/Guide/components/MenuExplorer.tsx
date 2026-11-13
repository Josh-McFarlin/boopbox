// SPDX-License-Identifier: GPL-3.0-only
// The HOME menu: pick a section and see its screen and its knobs.
import { useState } from 'react'

import { MENU } from '../data/menu.ts'
import { shot } from '../data/screens.ts'

import { B, Knobs, Screen, Tabs } from './ui.tsx'
import type { TabItem } from './ui.tsx'

export default function MenuExplorer() {
  const [i, setI] = useState(0)
  const [name, img, knobs] = MENU[i]
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-8">
      <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
        <Screen
          src={shot(img)}
          alt={`The menu's ${name} section`}
          color="green"
        />
      </figure>
      <div className="min-w-0 flex-[1_1_420px]">
        <Tabs
          label="Menu section"
          value={i}
          onChange={setI}
          color="green"
          items={MENU.map((m, k): TabItem<number> => [k, m[0]])}
        />
        <Knobs values={knobs} />
        <p className="m-0 mt-4 text-[15px]">
          <B>SELECT</B> moves between sections · <B>PRESETS</B> moves the cursor
          · <B>OCT+</B> changes or opens the setting · <B>OCT−</B> closes ·{' '}
          <B>hold HOME</B> leaves. These are settings of the FM-1: loading a
          project never changes them.
        </p>
      </div>
    </div>
  )
}
