// SPDX-License-Identifier: GPL-3.0-only
// 05 · Drums: the 16 sounds on the keys, the DRUMS screen's three pages, and beats from the keys.
import { pixelPanel } from '../../../components/styles.ts'
import KeyMap from '../components/KeyMap.tsx'
import { B, H3, Screen } from '../components/ui.tsx'
import { BEATS, DRUM_PAGES } from '../data/drums.ts'
import { DRUMS } from '../data/keys.ts'
import { shot } from '../data/screens.ts'

export default function Drums() {
  return (
    <>
      <KeyMap white={DRUMS} color="green" />
      <div className="mt-10 grid grid-cols-1 gap-8 min-[800px]:grid-cols-3">
        {DRUM_PAGES.map(([t, img, how, v]) => (
          <div key={t} className="min-w-0">
            <Screen
              src={shot(img)}
              alt={`The DRUMS ${t} page`}
              color="green"
              className="mb-6 max-w-[260px]"
            />
            <h3 className={H3}>
              {t}{' '}
              <span className="font-pixel text-[15px] text-green">· {how}</span>
            </h3>
            <p className="m-0 text-[15px]">{v}</p>
          </div>
        ))}
      </div>
      <div className={`mt-12 ${pixelPanel} p-6`}>
        <h3 className={`${H3} !text-green`}>Beats from the keys</h3>
        <p className="m-0 mb-4 text-[15px]">
          On a drum track's <B>SEQ → PLAY</B> page, hold one or more white keys
          and a whole pattern is written across the kit. The lowest key held
          picks the groove (keys 9–16: the same, busier); each other key adds
          detail; <B>KNOB 2 SEED</B> gives another set of variations. One hold
          is one undo.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BEATS.map((b, i) => (
            <span
              key={b}
              className="bg-deep px-2.5 py-1 font-pixel text-[14px]"
            >
              <span className="text-dim">key {i + 1}</span>{' '}
              <span className="text-fg">{b}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
