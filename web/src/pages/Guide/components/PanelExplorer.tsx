// SPDX-License-Identifier: GPL-3.0-only
// The panel as a map: pick a layer (or press a layer button on the drawing) and the keys and knobs show their jobs; select
// any control for its tap and hold, and what it does in the layer shown.
import { useState } from 'react'

import { pixelPanel, pixelScreen } from '../../../components/styles.ts'
import { CONTROLS } from '../data/controls.ts'
import type { Control } from '../data/controls.ts'
import { BLACK, WHITE } from '../data/keys.ts'
import { LAYERS } from '../data/layers.ts'
import type { Layer } from '../data/layers.ts'
import { shot } from '../data/screens.ts'
import { C, KNOB_C, TEXT } from '../data/theme.ts'

import KeyMap from './KeyMap.tsx'
import Panel from './Panel.tsx'
import { B, Tabs } from './ui.tsx'
import type { TabItem } from './ui.tsx'

/* a control as the card shows it: what it is, and what it does in the layer shown (now) */
interface ControlInfo extends Control {
  now: string | null
}

/* what to say about the selected control (W0..W15, B0..B10, or a control's id) in this layer */
function describe(sel: string, layer: Layer): ControlInfo {
  if (sel[0] === 'W' || sel[0] === 'B') {
    const white = sel[0] === 'W',
      i = +sel.slice(1)
    const fn = white ? layer.white[i] : layer.black[i]
    return {
      ...CONTROLS[white ? 'WHITE' : 'BLACK'],
      name: white
        ? `White key ${i + 1} · ${WHITE[i]}`
        : `Black key · ${BLACK[i]}`,
      now: fn || 'nothing in this layer',
    }
  }
  const k = sel.startsWith('KNOB') ? layer.knobs[+sel[4] - 1] : null
  return { ...CONTROLS[sel], now: k && k !== '—' ? k : null }
}

function ControlCard({ info, layer }: { info: ControlInfo; layer: Layer }) {
  return (
    <div className={`${pixelPanel} p-5`} aria-live="polite">
      <p className="m-0 mb-1 font-pixel text-[14px] text-dim">Selected</p>
      <h3 className="m-0 mb-4 font-pixel text-[28px] leading-none font-bold text-fg">
        {info.name}
      </h3>
      {info.now ? (
        <p
          className="m-0 mb-4 border-l-4 pl-3"
          style={{ borderColor: C[layer.color] }}
        >
          <span
            className="block font-pixel text-[14px]"
            style={{ color: C[layer.color] }}
          >
            {layer.button ? `With ${layer.button} held` : 'Right now'}
          </span>
          <span className="text-fg">{info.now}</span>
        </p>
      ) : null}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
        <dt className="font-pixel text-blue">
          {info.kind === 'knob'
            ? 'Turn'
            : info.kind === 'keys'
              ? 'Play'
              : 'Tap'}
        </dt>
        <dd className="m-0">{info.tap}</dd>
        {info.hold ? (
          <>
            <dt className="font-pixel text-orange">Hold</dt>
            <dd className="m-0">{info.hold}</dd>
          </>
        ) : null}
      </dl>
    </div>
  )
}

function LayerCard({ layer }: { layer: Layer }) {
  return (
    <div className={`${pixelPanel} p-5`}>
      <div className="mb-4 flex items-start gap-5">
        <img
          src={shot(layer.shot)}
          alt={`The ${layer.title} screen`}
          width="240"
          height="240"
          className={`${pixelScreen} !w-[120px] shrink-0 !border-4`}
        />
        <div className="min-w-0">
          <p className="m-0 font-pixel text-[14px] text-dim">{layer.name}</p>
          <h3
            className={`m-0 mb-2 font-pixel text-[28px] leading-none font-bold ${TEXT[layer.color]}`}
          >
            {layer.title}
          </h3>
          <p className="m-0 text-[15px]">{layer.blurb}</p>
        </div>
      </div>
      <KeyMap white={layer.white} black={layer.black} color={layer.color} />
      <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[15px]">
        {layer.knobs.some((k) => k !== '—') ? (
          <li>
            <span className="font-pixel text-dim">KNOBS </span>
            {layer.knobs.map((k, i) => (
              <span
                key={i}
                className="mr-3 font-pixel text-[15px]"
                style={{ color: KNOB_C[i] }}
              >
                {i + 1}·{k}
              </span>
            ))}
          </li>
        ) : null}
        {layer.more.map(([k, v]) => (
          <li key={k}>
            <B>{k}</B>: {v}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PanelExplorer() {
  const [layerId, setLayer] = useState('PLAY')
  const [sel, setSel] = useState('FX')
  const layer = LAYERS.find((l) => l.id === layerId)!
  const onSel = (id: string): void => {
    setSel(id)
    const l = LAYERS.find((x) => x.button === id)
    if (l)
      setLayer(
        layerId === l.id ? 'PLAY' : l.id,
      ) /* a layer button: press to hold it, again to let go */
  }
  return (
    <div>
      <Tabs
        label="Layer"
        value={layerId}
        onChange={setLayer}
        items={LAYERS.map((l): TabItem<string> => [
          l.id,
          l.button ? `hold ${l.button}` : l.title,
          l.color,
        ])}
      />
      <div className={`${pixelPanel} p-2 min-[700px]:p-4`}>
        <Panel
          layer={layer}
          sel={sel}
          onSel={onSel}
          screen={shot(layer.shot)}
        />
      </div>
      <p className="m-0 mt-3 text-[14px] text-dim">
        Select any knob, button or key. Press a layer button (FX, SEL, EDIT,
        GLO, SAVE, ARP, SEQ) on the drawing to hold it; press it again to let
        go.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_1.25fr]">
        <ControlCard info={describe(sel, layer)} layer={layer} />
        <LayerCard layer={layer} />
      </div>
    </div>
  )
}
