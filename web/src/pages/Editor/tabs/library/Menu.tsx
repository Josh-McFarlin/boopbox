// SPDX-License-Identifier: GPL-3.0-only
// A small pop-up menu of a row's actions (the Library's "⋯" buttons and right-click): items { label, ic, run, why, warn }.
// An item with a `why` is off and says why in its tooltip and in small text. Escape, a click outside or a scroll close it.
import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

import { Ic } from '../../ui/kit.tsx'
import { warn } from '../../ui/styles.ts'

/* an item: its words, its icon, what it does, why it is off (it is on without one), red under the pointer (warn) */
export interface MenuItem {
  label: string
  ic?: string | null
  run: () => void
  why?: string
  warn?: boolean
}
/* where the menu opens */
export interface MenuPos {
  x: number
  y: number
}
export interface MenuProps extends MenuPos {
  title?: string
  items: MenuItem[]
  onClose: () => void
}
export function Menu({ x, y, title, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  /* kept inside the window */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.left =
      Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px'
    el.style.top =
      Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px'
    const first = el.querySelector<HTMLButtonElement>('button:not(:disabled)')
    if (first) first.focus()
  }, [x, y])
  useEffect(() => {
    const down = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return (): void => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  const move = (e: KeyboardEvent<HTMLDivElement>): void => {
    const bs = [
        ...ref.current!.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)',
        ),
      ],
      i = bs.indexOf(document.activeElement as HTMLButtonElement)
    const d = (
      { ArrowDown: 1, ArrowUp: -1 } as Record<string, number | undefined>
    )[e.key]
    if (!d || !bs.length) return
    e.preventDefault()
    bs[(i + d + bs.length) % bs.length].focus()
  }
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      onKeyDown={move}
      style={{ left: x, top: y }}
      className="border-s3 bg-s1 fixed z-50 flex min-w-[220px] flex-col border py-1 shadow-[0_6px_24px_rgba(0,0,0,.5)]"
    >
      {title ? (
        <div className="truncate px-3 pt-1 pb-1.5 text-dim">{title}</div>
      ) : null}
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          disabled={!!it.why}
          title={it.why || ''}
          className={clsx(
            'flex flex-col items-start bg-transparent px-3 py-1.5 text-left',
            it.warn && warn,
          )}
          onClick={() => {
            onClose()
            it.run()
          }}
        >
          <span>
            <Ic ic={it.ic}>{it.label}</Ic>
          </span>
          {it.why ? (
            <small className="text-[16px] leading-4 text-dim normal-case">
              {it.why}
            </small>
          ) : null}
        </button>
      ))}
    </div>
  )
}

/* the props that open a menu: on the "⋯" button (under it), or at the pointer on a right-click */
export const menuAt = (e: ReactMouseEvent<HTMLElement>): MenuPos => {
  if (e.type === 'contextmenu') return { x: e.clientX, y: e.clientY }
  const r = e.currentTarget.getBoundingClientRect()
  return { x: r.right - 220, y: r.bottom + 2 }
}
