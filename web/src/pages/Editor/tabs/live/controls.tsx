// SPDX-License-Identifier: GPL-3.0-only
// The LIVE page's own controls: a knob (drag up / down, the wheel, the arrow keys, double-click: its default), a fader
// (the same, and a click on its track) and a button that holds while pressed. The drum panel on the Sound page uses
// them too. Each control carries what MIDI learn drives (pro.js lvxMidi): node._lvo {min, max, set}, node.press /
// node.release, named by data-lvm. Ctl: a device parameter as a knob or a list.
import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

import { notify } from '../../core/app.ts'
import { F, fmtValue } from '../../lib/proto.ts'
import type { FmtDesc } from '../../lib/proto.ts'

import type { LvmNode } from './pro.ts'
import { LV, lvGlobal, lvGv, lvParam } from './state.ts'
import type { HoldNode } from './state.ts'

/** what a knob / fader drives: its range, its value, how it sets it (final: the move ended), its default, its MIDI
    learn id (mid), its text (fmt), bipolar (bip: the arc from 0) */
export interface SliderO {
  min: number
  max: number
  def?: number
  step?: number
  bip?: boolean
  mid?: string
  get: () => number
  set: (v: number, final?: boolean) => void
  fmt?: (v: number) => string
}

function lvArc(a0: number, a1: number, r = 18): string {
  const p = (a: number): [number, number] => [
    24 + r * Math.cos(a),
    24 + r * Math.sin(a),
  ]
  const [x0, y0] = p(a0),
    [x1, y1] = p(a1)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}
const clamp = (o: Pick<SliderO, 'min' | 'max'>, v: number): number =>
  Math.max(o.min, Math.min(o.max, v))

/* the slider behaviour both share: o {min, max, get, set(v, final), def, step}; px: the whole range over that many px */
function useSlider(o0: SliderO, px: number) {
  /* (2.7) the control redraws itself at each move: what it drives need not redraw it (the drum card's values did not
     move until the next read: it felt like lag) */
  const o: SliderO = {
    ...o0,
    set: (v, f) => {
      o0.set(v, f)
      notify()
    },
  }
  const cur = useRef(o)
  cur.current = o
  const ref = useRef<LvmNode | null>(null)
  const drag = useRef<{ start: number; y0: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    const node = ref.current!
    const wheel = (e: WheelEvent): void => {
      const x = cur.current
      e.preventDefault()
      x.set(clamp(x, x.get() + (e.deltaY < 0 ? 1 : -1) * (x.step || 1)), true)
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return (): void => node.removeEventListener('wheel', wheel)
  }, [])
  const end = (): void => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setDragging(false)
    cur.current.set(d.last, true)
  }
  const handlers = {
    role: 'slider' as const,
    tabIndex: 0,
    'aria-valuemin': o.min,
    'aria-valuemax': o.max,
    'aria-valuenow': o.get(),
    onPointerDown: (e: PointerEvent<HTMLDivElement>): void => {
      if (e.button) return
      e.preventDefault()
      e.currentTarget.focus({ preventScroll: true })
      e.currentTarget.setPointerCapture(e.pointerId)
      const start = o.get()
      drag.current = { start, y0: e.clientY, last: start }
      setDragging(true)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>): void => {
      const d = drag.current
      if (!d) return
      const x = cur.current,
        span = x.max - x.min,
        dy = (d.y0 - e.clientY) * (e.shiftKey ? 0.25 : 1)
      const v = clamp(x, Math.round(d.start + (dy * span) / (px || 160)))
      if (v !== d.last) {
        d.last = v
        x.set(v, false)
      }
    },
    onPointerUp: end,
    onPointerCancel: end,
    onDoubleClick: (): void => o.set(o.def!, true),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>): void => {
      const d = (
        {
          ArrowUp: 1,
          ArrowRight: 1,
          ArrowDown: -1,
          ArrowLeft: -1,
          PageUp: 8,
          PageDown: -8,
        } as Record<string, number>
      )[e.key]
      if (!d) return
      e.preventDefault()
      e.stopPropagation()
      o.set(clamp(o, o.get() + d * (e.shiftKey ? 8 : o.step || 1)), true)
    },
  }
  /* MIDI learn sets it */
  const setRef = (node: LvmNode | null): void => {
    ref.current = node
    if (node) {
      node._lvo = cur.current
      node.update = notify
    }
  }
  return { o, handlers, setRef, dragging }
}

/* a knob's looks: its dial over its name and value (stack: the drum panel, cell: a strip's "more" panel, pad: a drum
   pad's), or the dial then its name over its value on one line (row: the transport, the master fx; rowSm: the roll rate) */
export type KnobLook = 'stack' | 'cell' | 'pad' | 'row' | 'rowSm'
const KNOB: Record<KnobLook, string> = {
  stack: 'w-16 justify-items-center',
  cell: 'w-full justify-items-center',
  pad: 'w-14 justify-items-center',
  row: 'w-auto grid-cols-[36px_auto] grid-rows-[18px_18px] items-center justify-items-start gap-x-1',
  rowSm:
    'w-auto grid-cols-[32px_auto] grid-rows-[16px_16px] justify-items-start gap-x-1',
}
const DIAL: Record<KnobLook, string> = {
  stack: 'size-12',
  cell: 'size-10',
  pad: 'size-10',
  row: 'row-span-2 size-9',
  rowSm: 'row-span-2 size-8',
}
const accC = '[color:var(--c,var(--acc))]'

/* a knob: o {min, max, def, bip, get, set(v, final), fmt, mid} */
export interface KnobProps {
  label: string
  o: SliderO
  look?: KnobLook
  className?: string
  style?: CSSProperties
}
export function Knob({
  label,
  o: o0,
  look = 'stack',
  className = '',
  style,
}: KnobProps) {
  const { o, handlers, setRef, dragging } = useSlider(o0, 160)
  const v = o.get(),
    f = (v - o.min) / (o.max - o.min || 1),
    a0 = Math.PI * 0.75,
    a1 = Math.PI * 2.25
  const z = o.bip ? (0 - o.min) / (o.max - o.min) : 0,
    az = a0 + z * (a1 - a0),
    av = a0 + f * (a1 - a0)
  const txt = o.fmt ? o.fmt(v) : String(v)
  const row = look === 'row'
  return (
    <div
      ref={setRef}
      className={clsx(
        'group grid cursor-ns-resize touch-none gap-0 select-none',
        KNOB[look],
        className,
      )}
      style={style}
      aria-label={label}
      data-lvm={o.mid}
      aria-valuetext={txt}
      {...handlers}
    >
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={clsx('block', DIAL[look])}
      >
        <path className="stroke-s3 fill-none stroke-4" d={lvArc(a0, a1)} />
        <path
          className="fill-none [stroke:var(--c,var(--acc))] stroke-4"
          d={
            Math.abs(av - az) < 0.02
              ? ''
              : lvArc(Math.min(az, av), Math.max(az, av))
          }
        />
      </svg>
      <span
        className={clsx(
          'max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-dim lowercase',
          row && 'leading-[18px]',
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          'whitespace-nowrap',
          dragging
            ? accC
            : 'text-fg group-focus-visible:[color:var(--c,var(--acc))]',
          row && 'min-w-[3ch] leading-[18px]',
        )}
      >
        {txt}
      </span>
    </div>
  )
}

/* a fader (vertical): o as a knob's; meter: 0..1 shown beside it */
export interface FaderProps {
  label: string
  o: SliderO
  meter?: number
}
export function Fader({ label, o: o0, meter = 0 }: FaderProps) {
  const { o, handlers, setRef } = useSlider(o0, 180)
  const f = (o.get() - o.min) / (o.max - o.min || 1)
  return (
    <div
      ref={setRef}
      className="group flex min-h-20 flex-1 cursor-ns-resize touch-none gap-1 select-none"
      aria-label={label}
      data-lvm={o.mid}
      {...handlers}
    >
      <span className="bg-s2 relative w-1.5">
        <i
          className="bg-t2 absolute inset-x-0 bottom-0 h-0 transition-[height] duration-80 ease-linear"
          style={{
            height: (Math.max(0, Math.min(1, meter)) * 100).toFixed(1) + '%',
          }}
        />
      </span>
      <div
        className="bg-s2 relative w-[22px]"
        onPointerDown={(e) => {
          /* a click on the track: the value there */
          if (e.button || (e.target as HTMLElement).dataset.fc != null) return
          const r = e.currentTarget.getBoundingClientRect()
          o.set(
            Math.round(
              o.min + (1 - (e.clientY - r.top) / r.height) * (o.max - o.min),
            ),
            true,
          )
        }}
      >
        <span
          className="bg-c absolute inset-x-0 bottom-0 opacity-85"
          style={{ height: (f * 100).toFixed(1) + '%' }}
        />
        <span
          data-fc=""
          className="group-focus-visible:bg-c absolute -inset-x-[3px] h-1.5 bg-fg"
          style={{ bottom: `calc(${(f * 100).toFixed(1)}% - 3px)` }}
        />
      </div>
    </div>
  )
}

/* a button that holds while pressed (pointer, touch, Enter / Space): down(), up(). lit: its name in LV.lit (it shows
   pressed while there: the computer keyboard lights it too); api(node): the caller keeps press / release */
export interface HoldProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onPointerDown' | 'onPointerUp' | 'onKeyDown' | 'onKeyUp'
> {
  lit: string
  down: (e: unknown) => void
  up: () => void
  api?: (node: HoldNode) => void
  [data: `data-${string}`]: string | number | boolean | undefined
}
/* (it shows pressed with data-on: the caller's data-on: classes) */
export function Hold({
  lit,
  down,
  up,
  className = '',
  children,
  api,
  ...rest
}: HoldProps) {
  const on = useRef(false)
  const fns = useRef({ down, up })
  fns.current = { down, up }
  const go = (e: unknown): void => {
    if (on.current) return
    on.current = true
    LV.lit.add(lit)
    notify()
    fns.current.down(e)
  }
  const stop = (): void => {
    if (!on.current) return
    on.current = false
    LV.lit.delete(lit)
    notify()
    fns.current.up()
  }
  const setRef = (node: HoldNode | null): void => {
    if (!node) return
    node.press = (): void =>
      go({}) /* (LIVE pro: a learned MIDI pad holds it) */
    node.release = stop
    if (api) api(node)
  }
  return (
    <button
      ref={setRef}
      type="button"
      className={className}
      data-on={LV.lit.has(lit) ? '' : undefined}
      {...rest}
      onPointerDown={(e) => {
        if (e.button) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        go(e)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onBlur={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.repeat) {
          e.preventDefault()
          e.stopPropagation()
          go(e)
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          stop()
        }
      }}
    >
      {children}
    </button>
  )
}

/* a list whose value follows the device, except while it has the focus (the user's choice is on its way) */
export interface SyncSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue'
> {
  value: string | number
  selRef?: (n: (HTMLSelectElement & LvmNode) | null) => void
  [data: `data-${string}`]: string | number | undefined
}
export function SyncSelect({
  value,
  children,
  selRef,
  ...rest
}: SyncSelectProps) {
  const ref = useRef<HTMLSelectElement | null>(null)
  useEffect(() => {
    const n = ref.current
    if (n && document.activeElement !== n && n.value !== String(value))
      n.value = String(value)
  })
  return (
    <select
      ref={(n) => {
        ref.current = n
        if (selRef) selRef(n)
      }}
      defaultValue={String(value)}
      {...rest}
    >
      {children}
    </select>
  )
}

/* a device parameter: a list (enum) or a knob. scope 0: track tr's P_*, 1: a global; d: its DESC */
export interface CtlDesc extends FmtDesc {
  label: string
  def?: number
  names?: string[] | null
}
export interface CtlProps {
  scope: number
  id: number
  tr: number
  d: CtlDesc | null | undefined
  lbl?: string
  look?: KnobLook
}
export function Ctl({ scope, id, tr, d, lbl, look }: CtlProps): ReactNode {
  if (!d) return null
  const get = () =>
    scope ? lvGv(id) : ((LV.tr[tr] || { p: [] }).p[id] ?? d.def ?? 0)
  const set = (v: number, f = true): void => {
    if (scope) lvGlobal(id, v, f)
    else lvParam(tr, id, v)
  }
  const mid = scope ? `g:${id}` : `s${tr}:${id}`
  if (d.fmt === F.ENUM && d.names && d.names.length) {
    return (
      <label className="grid min-w-20 gap-0.5 self-center">
        <span className="text-dim lowercase">
          {(lbl || d.label).toLowerCase()}
        </span>
        <SyncSelect
          aria-label={lbl || d.label}
          data-lvm={mid}
          value={get()}
          onChange={(e) => set(+e.target.value)}
          selRef={(s) => {
            if (s)
              s._lvo = {
                min: d.min,
                max: d.max,
                set: (v: number): void => {
                  s.value = String(v)
                  set(v)
                },
              }
          }}
        >
          {d.names.map((n, k) => (
            <option key={k} value={String(d.min + k)}>
              {n}
            </option>
          ))}
        </SyncSelect>
      </label>
    )
  }
  return (
    <Knob
      look={look}
      label={(lbl || d.label).toLowerCase()}
      o={{
        min: d.min,
        max: d.max,
        def: d.def,
        bip: d.min < 0,
        get,
        set,
        mid,
        fmt: (v) => {
          const [x, u] = fmtValue(d, v)
          return u && u !== '%' ? `${x} ${u}`.toLowerCase() : x + (u || '')
        },
      }}
    />
  )
}
