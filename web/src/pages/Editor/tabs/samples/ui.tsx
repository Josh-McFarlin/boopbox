// SPDX-License-Identifier: GPL-3.0-only
// Pieces the Samples and Drum kit pages share: a numbered step, the meter of a slot's room, a drop target's state,
// a help text cut to its first line (the rest under More). The slot tiles: SlotTiles.jsx.
import clsx from 'clsx'
import { useState } from 'react'
import type { DragEvent, ReactNode } from 'react'

import { More } from '../../ui/kit.tsx'
import { bad, dim } from '../../ui/styles.ts'

/* a numbered step of the page (1 the slot, 2 the sound, 3 send it); off: it cannot be done yet (greyed, why says
   what to do first) */
export interface StepProps {
  n: number
  title: ReactNode
  children?: ReactNode
  off?: boolean
  why?: string
}
export function Step({ n, title, children, off, why }: StepProps) {
  return (
    <section
      className={clsx(
        'mt-2 border-t border-line pt-4 pb-1',
        off && '[&>:not(h3):not([data-why])]:opacity-45',
      )}
      aria-disabled={off ? 'true' : undefined}
    >
      <h3
        className={`mb-2.5 flex items-center gap-3 uppercase ${off ? 'text-dim' : 'text-fg'}`}
      >
        <span
          className={`text-big grid size-8 place-content-center ${off ? 'bg-s2 text-dim' : 'bg-acc text-black'}`}
        >
          {n}
        </span>
        {title}
      </h3>
      {why ? (
        <p data-why="" className="text-t7 mt-0 mb-2.5">
          {why}
        </p>
      ) : null}
      {children}
    </section>
  )
}

/* the room the sound takes in its slot(s); red when over */
export interface MeterProps {
  max: number
  value: number
  over?: boolean
  children?: ReactNode
}
export function Meter({ max, value, over, children }: MeterProps) {
  return (
    <div className="flex items-center gap-2.5">
      <progress
        className={clsx(
          'h-2 w-[220px]',
          over &&
            '[&::-moz-progress-bar]:bg-red [&::-webkit-progress-value]:bg-red',
        )}
        max={max}
        value={value}
      />
      <span className={over ? bad : dim}>{children}</span>
    </div>
  )
}

/* a drop target: [over, its handlers]; onFiles(files, event) gets what was dropped */
/* a drop target's handlers */
export interface DropHandlers {
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent) => void
}
export function useDrop(
  onFiles: (files: File[]) => void,
  stop = false,
): [boolean, DropHandlers] {
  const [over, setOver] = useState(false)
  return [
    over,
    {
      onDragOver: (e): void => {
        e.preventDefault()
        if (stop) e.stopPropagation()
        setOver(true)
      },
      onDragLeave: (): void => setOver(false),
      onDrop: (e): void => {
        e.preventDefault()
        if (stop) e.stopPropagation() /* (not the card's drop too) */
        setOver(false)
        if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files])
      },
    },
  ]
}

/* the text of a slot's name: 8 printable characters, upper case */
export interface NameInputProps {
  value: string
  onChange: (v: string) => void
}
export function NameInput({ value, onChange }: NameInputProps) {
  return (
    <input
      type="text"
      maxLength={8}
      spellCheck="false"
      placeholder="NAME"
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value
            .toUpperCase()
            .replace(/[^\x20-\x7E]/g, '')
            .slice(0, 8),
        )
      }
    />
  )
}

/* a help text: its first sentence on the page, the rest (its lines) behind the "?" */
export interface ShortHelpProps {
  text: string
  className?: string
}
export function ShortHelp({ text, className = '' }: ShortHelpProps) {
  const [line, ...lines] = String(text).split('\n')
  const m = /^(.+?[.!?])\s+(.+)$/.exec(line)
  const rest = [...(m ? [m[2]] : []), ...lines]
  return (
    <div className={`mb-3 max-w-[90ch] ${className}`}>
      <p className={clsx(dim, 'm-0 inline')}>{m ? m[1] : line}</p>{' '}
      {rest.length ? (
        <More>
          {rest.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </More>
      ) : null}
    </div>
  )
}
