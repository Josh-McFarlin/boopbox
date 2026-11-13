// SPDX-License-Identifier: GPL-3.0-only
/* ---- a page a newcomer can read: each card's head (its name, one line, its "?" for how to use it), the first steps
   and the keyboard shortcuts (overlays over the page: the first steps once, both again from the "?" menu, the
   shortcuts with the ? key) */
import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { notify, t } from '../../core/app.ts'
import { pri } from '../../ui/styles.ts'

import { LVS } from './pro.ts'
import { LV } from './state.ts'
import type { LvUi } from './state.ts'
import { kbd, qBtn } from './styles.ts'

/* a card of the page: its head (title, what it is in one line, extra controls, its "?"), the longer help over the card */
/* (the head's own buttons: [&>button] and the ones of a group in it; headClass: the head's place, helpClass: the help's) */
export interface LvCardProps {
  k: string
  title?: ReactNode
  head?: ReactNode
  className?: string
  headClass?: string
  helpClass?: string
  style?: CSSProperties
  children?: ReactNode
}
export function LvCard({
  k,
  title,
  head,
  className = '',
  headClass = 'mb-1.5',
  helpClass = 'top-9',
  style,
  children,
}: LvCardProps) {
  const [open, setOpen] = useState(false)
  const sub = t('lvxSub_' + k)
  return (
    <div
      className={clsx(
        'bg-s1 relative min-w-0 border border-line px-2.5 pt-2 pb-2.5',
        LVS.lock && 'pointer-events-none [&>*]:opacity-85',
        className,
      )}
      style={style}
      data-card={k}
    >
      <div
        className={clsx(
          'flex min-h-6 min-w-0 items-center gap-2 [&_[data-grp]_button]:px-2.5 [&_[data-grp]_button]:py-0.5 [&>button]:px-2.5 [&>button]:py-0.5',
          headClass,
        )}
      >
        {title ? (
          <h2 className="m-0 flex-none text-fg uppercase">{title}</h2>
        ) : null}
        <span
          className="font-text min-w-0 flex-[1_1_0] overflow-hidden text-[14px] leading-5 text-ellipsis whitespace-nowrap text-dim"
          title={sub}
        >
          {sub}
        </span>
        {head}
        <button
          type="button"
          className={clsx(qBtn, 'h-6')}
          aria-expanded={open}
          title={t('lvxHelpShow')}
          aria-label={t('lvxHelpShow')}
          onClick={() => setOpen(!open)}
        >
          ?
        </button>
      </div>
      {open ? (
        <div
          className={clsx(
            'border-acc bg-s2 absolute inset-x-2 z-30 max-h-[60vh] overflow-y-auto border py-2.5 pr-9 pl-3 shadow-[0_8px_24px_rgb(0_0_0/.5)]',
            helpClass,
          )}
          role="note"
        >
          <button
            type="button"
            className="absolute top-1 right-1 px-1.5 py-0"
            aria-label={t('lvxClose')}
            title={t('lvxClose')}
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
          {String(t('lvxHelp_' + k))
            .split('\n')
            .map((x, i) => (
              <p key={i} className="mx-0 mt-0 mb-1.5 last-of-type:mb-0">
                {x}
              </p>
            ))}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/* the overlays: LV.ui.over is "guide", "keys" or null */
const GUIDE_KEY = 'sloop-live-guide'
const seenGuide = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false /* no storage */
  }
}
export function lvOverlay(which: NonNullable<LvUi['over']>): void {
  LV.ui.over = LV.ui.over === which ? null : which
  LV.ui.menu = false
  notify()
}
export function lvGuideFirst(): void {
  if (LV.ui.over == null && !LV.ui.guideAsked) {
    LV.ui.guideAsked = true
    if (!seenGuide()) LV.ui.over = 'guide'
  }
}
function guideDone(): void {
  try {
    localStorage.setItem(GUIDE_KEY, '1')
  } catch {
    /* no storage */
  }
  LV.ui.over = null
  notify()
}

interface OverlayProps {
  title: string
  onClose: () => void
  children?: ReactNode
  foot?: ReactNode
}
function Overlay({ title, onClose, children, foot }: OverlayProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const b =
      ref.current && ref.current.querySelector<HTMLElement>('[data-ovok]')
    if (b) b.focus({ preventScroll: true })
  }, [])
  return (
    <div
      className="fixed inset-0 z-60 grid place-items-center bg-black/60 p-6"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className="border-acc bg-s1 max-h-[calc(100vh-48px)] w-[min(680px,100%)] overflow-y-auto border px-5 py-4 shadow-[0_16px_48px_rgb(0_0_0/.6)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-acc uppercase">{title}</h2>
          <button
            type="button"
            aria-label={t('lvxClose')}
            title={t('lvxClose')}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
        <div className="mt-3.5 flex items-center justify-between gap-4 [&>p]:m-0">
          {foot}
        </div>
      </div>
    </div>
  )
}

export function Overlays() {
  const over = LV.ui.over
  if (over === 'guide') {
    const steps = t('lvxGuideSteps')
    return (
      <Overlay
        title={t('lvxGuideTitle')}
        onClose={guideDone}
        foot={
          <>
            <p className="text-dim">{t('lvxGuideFoot')}</p>
            <button
              type="button"
              className={pri}
              data-ovok=""
              onClick={guideDone}
            >
              {t('lvxGuideOk')}
            </button>
          </>
        }
      >
        <ol className="font-text m-0 grid list-decimal gap-2 pl-[22px] text-[15px] leading-[22px]">
          {(Array.isArray(steps) ? steps : []).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      </Overlay>
    )
  }
  if (over === 'keys') {
    const rows = t('lvxShortcutList')
    const close = (): void => {
      LV.ui.over = null
      notify()
    }
    return (
      <Overlay
        title={t('lvxShortcuts')}
        onClose={close}
        foot={
          <>
            <p className="text-dim">{t('lvxShortcutsHint')}</p>
            <button type="button" className={pri} data-ovok="" onClick={close}>
              {t('lvxClose')}
            </button>
          </>
        }
      >
        <table className="w-full border-collapse">
          <tbody>
            {(Array.isArray(rows) ? rows : []).map(([k, a]) => (
              <tr key={k}>
                <th
                  scope="row"
                  className="w-2/5 border-b border-line px-2 py-1 text-left align-top font-normal normal-case"
                >
                  <kbd className={clsx(kbd, 'text-fg normal-case')}>{k}</kbd>
                </th>
                <td className="font-text text-fg2 border-b border-line px-2 py-1 text-left align-top text-[15px] leading-5">
                  {a}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Overlay>
    )
  }
  return null
}

/* the "?" of the top row: the first steps, the keyboard shortcuts */
const menuItem =
  'flex justify-between bg-transparent px-3 py-2 text-left normal-case hover:bg-s2'
export function HelpMenu() {
  const ref = useRef<HTMLSpanElement | null>(null)
  const open = !!LV.ui.menu
  useEffect(() => {
    if (!open) return undefined
    const away = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        LV.ui.menu = false
        notify()
      }
    }
    document.addEventListener('pointerdown', away)
    return (): void => document.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        className={clsx(qBtn, 'h-8 px-2.5 py-0')}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('lvxHelpMenu')}
        aria-label={t('lvxHelpMenu')}
        onClick={() => {
          LV.ui.menu = !open
          notify()
        }}
      >
        {'? ' + t('lvxHelpBtn')}
      </button>
      {open ? (
        <span
          className="border-s3 absolute top-[calc(100%+4px)] right-0 z-40 flex min-w-[260px] flex-col border bg-bg shadow-[0_8px_24px_rgb(0_0_0/.5)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className={menuItem}
            onClick={() => lvOverlay('guide')}
          >
            {t('lvxGuideTitle')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItem}
            onClick={() => lvOverlay('keys')}
          >
            {t('lvxShortcuts')} <kbd className={clsx(kbd, 'text-dim')}>?</kbd>
          </button>
        </span>
      ) : null}
    </span>
  )
}
