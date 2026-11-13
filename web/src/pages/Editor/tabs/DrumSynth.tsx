// SPDX-License-Identifier: GPL-3.0-only
// The Drum synth page (protocol v10): the FM-1's four synthesised kits SYN1..SYN4, a sound per lane, its knobs as the
// device's own (named in whole words: labels.js DRUMSYNTH). The header: the kit, its name and whether it is stored, the
// file and FM-1 buttons; then the 16 sounds as pads (a click plays one and selects it). The kit-wide CRUSH and S&H in
// the Kit card, next to Out. The logic: pages/drumsynth/ds.js.
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'

import { A, notify, t, useApp } from '../core/app.ts'
import { DSYN, F } from '../lib/proto.ts'
import type { DsynSound } from '../lib/proto.ts'
import {
  Card,
  Choice,
  GroupPage,
  Groups,
  Ic,
  KnobBox,
  Knobs,
  ParamName,
  Slider,
} from '../ui/kit.tsx'
import type { OnValue } from '../ui/kit.tsx'
import { bad, bar, dim, pri, seg, tog } from '../ui/styles.ts'

import {
  DS,
  DS_GROUPS,
  dsCopy,
  dsCrush,
  dsDefault,
  dsKitName,
  dsLane,
  dsName,
  dsOk,
  dsOpen,
  dsPick,
  dsSave,
  dsSet,
  dsShown,
  dsSound,
  dsStore,
  dsUse,
} from './drumsynth/ds.ts'
import type { DsSpec } from './drumsynth/ds.ts'
import { ShortHelp } from './samples/ui.tsx'

const C = 'var(--t4)',
  CTX = 'DRUMSYNTH'

/* the value as a big number; it turns like a knob: drag it up or down (Shift: fine), double-click: the default */
interface DsValueProps {
  min: number
  max: number
  v: number
  txt: string | number
  unit?: string
  def: number
  set: OnValue
}
function DsValue({ min, max, v, txt, unit, def, set }: DsValueProps) {
  const ref = useRef({ y0: 0, v0: 0, on: false })
  const long = String(txt).length + (unit ? Math.ceil(unit.length / 2) : 0) > 6
  return (
    <span
      className={`cursor-ns-resize touch-none overflow-hidden whitespace-nowrap text-fg select-none ${long ? 'text-[16px] leading-8' : 'text-big'}`}
      onPointerDown={(e) => {
        if (e.button) return
        ref.current = { y0: e.clientY, v0: v, on: true }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
      }}
      onPointerMove={(e) => {
        const r = ref.current
        if (!r.on) return
        const per = Math.max(
          (max - min) / (e.shiftKey ? 800 : 200),
          e.shiftKey ? 0.05 : 0.12,
        )
        const nv = Math.max(
          min,
          Math.min(max, Math.round(r.v0 + (r.y0 - e.clientY) * per)),
        )
        if (nv !== v) set(nv, false)
      }}
      onPointerUp={() => {
        if (ref.current.on) {
          ref.current.on = false
          set(v, true)
        }
      }}
      onPointerCancel={() => {
        if (ref.current.on) {
          ref.current.on = false
          set(v, true)
        }
      }}
      onDoubleClick={() => set(def, true)}
    >
      {String(txt)}
      {unit ? (
        <small className="ml-1 text-[16px] leading-4 text-dim">{unit}</small>
      ) : null}
    </span>
  )
}

interface DsKnobProps {
  spec: DsSpec
  o: DsynSound
  index: number
}
function DsKnob({
  spec: [k, label, min, max, fmt, names],
  o,
  index,
}: DsKnobProps) {
  const v = o[k]
  const set: OnValue = (nv, done) => dsSet(k, nv, done)
  if (names) {
    const d = { fmt: F.ENUM, names, min, max, label, unit: '' }
    return (
      <KnobBox index={index} color={C} enumLike>
        <ParamName label={label} ctx={CTX} />
        <Choice
          d={d}
          v={v}
          onChange={set}
          className="bg-s2 text-c mt-1.5 h-[34px] w-full border-line text-[16px]"
        />
      </KnobBox>
    )
  }
  const def = dsDefault(k)
  const [txt, unit] = fmt(v, o)
  return (
    <KnobBox index={index} color={C}>
      <ParamName label={label} ctx={CTX} />
      <DsValue
        min={min}
        max={max}
        v={v}
        txt={txt}
        unit={unit}
        def={def}
        set={set}
      />
      <Slider d={{ min, max, def, label }} v={v} onChange={set} />
    </KnobBox>
  )
}

/* the kit-wide values: CRUSH (bits off) and S&H (samples held), one byte (ds.js dsCrush) */
function KitCard() {
  useApp()
  const kit = DS.kit!,
    bits = kit.crush & 15,
    sh = (kit.crush >> 4) + 1
  const knob = (
    label: string,
    min: number,
    max: number,
    v: number,
    txt: string,
    set: (x: number) => void,
    i: number,
  ) => (
    <KnobBox index={i} color={C}>
      <ParamName label={label} ctx={CTX} />
      <DsValue min={min} max={max} v={v} txt={txt} def={min} set={set} />
      <Slider d={{ min, max, def: min, label }} v={v} onChange={set} />
    </KnobBox>
  )
  return (
    <Card1 title={t('dsKit')} id="dskitcard">
      {knob(
        'CRUSH',
        0,
        15,
        bits,
        bits ? `-${bits} bits` : t('dsOff'),
        (b) => dsCrush(b, sh),
        0,
      )}
      {knob(
        'S&H',
        1,
        16,
        sh,
        sh > 1 ? `1/${sh}` : t('dsOff'),
        (x) => dsCrush(bits, x),
        1,
      )}
    </Card1>
  )
}
/* a card of two knobs, half a column wide (Out, Kit) */
function Card1({
  title,
  id,
  children,
}: {
  title: string
  id: string
  children?: ReactNode
}) {
  return (
    <div
      id={id}
      data-card=""
      className="bg-s1 min-w-0 border border-line px-4 pt-3.5 pb-3"
    >
      <GroupPage title={title} />
      <div className="grid grid-cols-2 border-t border-line">{children}</div>
    </div>
  )
}

function DsGroups() {
  useApp()
  const o = dsSound()
  const card = ([title, ks]: [string, DsSpec[]]) => (
    <div
      key={title}
      data-card=""
      className="bg-s1 mb-4 min-w-0 break-inside-avoid border border-line px-4 pt-3.5 pb-3"
    >
      <GroupPage title={t(title)} />
      <Knobs>
        {ks.map((spec, i) => (
          <DsKnob key={spec[0]} spec={spec} o={o} index={i} />
        ))}
      </Knobs>
    </div>
  )
  const out = DS_GROUPS.find(([g]) => g === 'dsOut')!
  return (
    <div id="dsgroups">
      <Groups>
        {DS_GROUPS.filter((g) => g !== out).map(card)}
        <div className="mb-4 grid break-inside-avoid grid-cols-2 gap-4">
          <Card1 title={t(out[0])} id="dsout">
            {out[1].map((spec, i) => (
              <DsKnob key={spec[0]} spec={spec} o={o} index={i} />
            ))}
          </Card1>
          <KitCard />
        </div>
      </Groups>
    </div>
  )
}

export default function DrumSynth() {
  const { dev } = useApp()
  const [name, setName] = useState<string | null>(
    null,
  ) /* the name being typed (sent when it is done) */
  useEffect(() => {
    if (A.dev && A.dev.dump) dsShown()
  }, [dev])
  const ok = dsOk(),
    kit = DS.kit
  const body = ok && kit
  const done = (
    e: FocusEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (name != null) dsName(e.currentTarget.value)
    setName(null)
  }
  const stored = !(DS.list && !DS.list.stored)
  return (
    <>
      <Card title={t('dsTitle')} ic="symbol_waves">
        <ShortHelp text={t('dsHelp')} />
        {ok ? null : (
          <p className={bad} id="dsold">
            {t('dsOld')}
          </p>
        )}
        {body ? (
          <div id="dsbody">
            <div
              className={clsx(
                bar,
                'flex-nowrap! items-start! justify-between gap-x-6',
              )}
            >
              <div className="flex shrink-0 items-center gap-2 pt-px">
                <span
                  className={clsx(seg, 'flex-nowrap!')}
                  id="dsk"
                  role="group"
                  aria-label={t('dsKits')}
                >
                  {[0, 1, 2, 3].map((k) => (
                    <button
                      key={k}
                      type="button"
                      data-v={k}
                      aria-pressed={k === DS.k ? 'true' : 'false'}
                      className={tog}
                      onClick={() => dsPick(k)}
                    >
                      {dsKitName(k)}
                    </button>
                  ))}
                </span>
                <label htmlFor="dsname" className="ml-2">
                  {t('name')}
                </label>
                <input
                  id="dsname"
                  type="text"
                  maxLength={8}
                  size={9}
                  spellCheck="false"
                  value={name ?? kit.name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={done}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') done(e)
                  }}
                />
                <span
                  className={stored ? dim : 'text-t7'}
                  id="dsstate"
                  title={stored ? '' : t('dsNotStoredHint')}
                >
                  {stored ? t('dsStored') : t('dsNotStored')}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  id="dsstore"
                  className={stored ? '' : pri}
                  title={t('dsStoreHint')}
                  onClick={dsStore}
                >
                  <Ic ic="symbol_upload">{t('dsStore')}</Ic>
                </button>
                <button
                  type="button"
                  id="dsuse"
                  title={t('dsUseHint')}
                  onClick={dsUse}
                >
                  <Ic ic="symbol_drum">{t('dsUse')}</Ic>
                </button>
                <button
                  type="button"
                  id="dssave"
                  title={t('dsSaveHint')}
                  onClick={dsSave}
                >
                  <Ic ic="symbol_download">{t('dsSave')}</Ic>
                </button>
                <button
                  type="button"
                  id="dsopen"
                  title={t('dsOpenHint')}
                  onClick={dsOpen}
                >
                  <Ic ic="symbol_folder_open">{t('dsOpen')}</Ic>
                </button>
                <span className="inline-flex items-center gap-1">
                  <label htmlFor="dsfrom" className={dim}>
                    {t('dsFrom')}
                  </label>
                  <select
                    id="dsfrom"
                    value={String(DS.from ?? kit.src)}
                    onChange={(e) => {
                      DS.from = +e.target.value
                      notify()
                    }}
                  >
                    {DS.list!.names.map((n, i) => (
                      <option key={i} value={String(i)}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    id="dscopy"
                    title={t('dsCopyHint')}
                    onClick={dsCopy}
                  >
                    {t('dsCopy')}
                  </button>
                </span>
              </div>
            </div>
            <div
              id="dslanes"
              className="mt-3 mb-2 grid grid-cols-16 gap-1"
              role="group"
              aria-label={t('dsSounds')}
            >
              {DSYN.LANES_N.map((n, l) => (
                <button
                  key={l}
                  type="button"
                  data-l={l}
                  aria-pressed={l === DS.lane ? 'true' : 'false'}
                  title={`${n}: ${t('dsPadHint')}`}
                  onClick={() => dsLane(l)}
                  className={`flex h-14 min-w-0 flex-col items-center justify-center px-0.5 text-center leading-4 whitespace-normal ${l === DS.lane ? 'bg-acc hover:bg-acc! text-black' : 'border border-line bg-bg'}`}
                >
                  <span className="line-clamp-2">{n}</span>
                </button>
              ))}
            </div>
            <p className={clsx(bar, 'mb-0!')}>
              <label>
                <input
                  type="checkbox"
                  id="dsauto"
                  checked={DS.auto}
                  onChange={(e) => {
                    DS.auto = e.target.checked
                    notify()
                  }}
                />{' '}
                <span>{t('dsAuto')}</span>
              </label>
              <span
                className={clsx(dim, 'ml-auto')}
                id="dslane"
              >{`${dsKitName()} · ${DSYN.LANES_N[DS.lane]}`}</span>
            </p>
          </div>
        ) : null}
      </Card>
      {body ? <DsGroups /> : null}
    </>
  )
}
