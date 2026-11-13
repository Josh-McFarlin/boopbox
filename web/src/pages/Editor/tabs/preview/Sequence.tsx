// SPDX-License-Identifier: GPL-3.0-only
// The preview's step sequence: a row of 16 steps for each track (pages of 16 when it is longer), following playback; a
// click on an empty step adds a note, on a note opens the note dialog, a double click or Delete makes it a rest (as the
// Sequencer page's grid); a drum track shows its hits on one row and,
// opened, a row for each sound.
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'

import { A, notify, report, t, tcol } from '../../core/app.ts'
import { selectTrack } from '../../core/device.ts'
import { showTab } from '../../core/tabs.ts'
import { DRUM_LANES, noteName, previewSetStepNotes } from '../../lib/proto.ts'
import type { DrumStep, MockStep } from '../../lib/proto.ts'

import {
  PV,
  noteOf,
  posOf,
  previewCellClick,
  previewOpenNote,
  previewSequenceClick,
} from './state.ts'

/* a cell's step: a synth step, or a drum step on a drum track */
type CellStep = MockStep | DrumStep | undefined
const groups = new Map<
  number,
  HTMLDivElement
>() /* track -> its rows' element (hovered or focused: its page stays still) */
const ROW =
  'preview-seq-row grid grid-cols-[128px_minmax(0,1fr)] gap-2 mt-1 max-[680px]:grid-cols-[72px_minmax(0,1fr)] max-[680px]:gap-1'
const STEPS =
  'preview-seq-steps grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5'

interface TrackButtonProps {
  k: number
  name: string
  muted: boolean
  len: number
  position: number
}
function TrackButton({ k, name, muted, len, position }: TrackButtonProps) {
  const label = `${t('track')} ${k + 1}: ${name}${muted ? ' · ' + t('previewMuted') : ''}`
  return (
    <button
      type="button"
      aria-pressed={A.mock!.state.sel === k}
      aria-label={label}
      title={label}
      onClick={() => selectTrack(k)}
      className="preview-seq-track text-c aria-pressed:bg-s2 flex h-7 w-full min-w-0 items-center gap-1 bg-transparent p-0 text-left normal-case max-[680px]:gap-0"
    >
      <span className="seq-no w-6 flex-none text-center">{k + 1}</span>
      <span className="seq-name text-fg2 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap max-[680px]:hidden">
        {name}
      </span>
      <span className="seq-position ml-auto flex-none pr-1 text-[12px] whitespace-nowrap text-dim">{`${position < 0 ? '–' : position + 1}/${len}`}</span>
    </button>
  )
}

interface PageToolsProps {
  k: number
  len: number
  page: number
  children?: ReactNode
}
function PageTools({ k, len, page, children }: PageToolsProps) {
  const move = (delta: number): void => {
    PV.follow = false
    PV.pages[k] = Math.max(
      0,
      Math.min(
        Math.floor((A.mock!.state.tracks[k].p[29] - 1) / 16) * 16,
        (PV.pages[k] || 0) + delta,
      ),
    )
    notify()
  }
  const nav = (
    cls: string,
    key: string,
    text: string,
    delta: number,
    disabled: boolean,
  ) => {
    const label = `${t(key)} · ${t('track')} ${k + 1}`
    return (
      <button
        type="button"
        className={`${cls} h-6 w-6 p-0`}
        hidden={len <= 16}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => move(delta)}
      >
        {text}
      </button>
    )
  }
  return (
    <div className="preview-seq-tools mb-1 flex flex-wrap items-center gap-1">
      {children}
      {nav('seq-prev', 'previewPrevSteps', '‹', -16, page === 0)}
      <span
        className="preview-seq-pages text-[12px] whitespace-nowrap text-dim"
        hidden={len <= 16}
      >{`${page + 1}–${Math.min(page + 16, len)}`}</span>
      {nav('seq-next', 'previewNextSteps', '›', 16, page + 16 >= len)}
    </div>
  )
}

/* one cell: what it shows and says (the old renderPreviewSequence's cell pass) */
function cellView(
  k: number,
  drum: boolean,
  lane: number,
  cs: CellStep,
  index: number,
  len: number,
) {
  const s = drum ? undefined : (cs as MockStep | undefined),
    d = drum ? (cs as DrumStep | undefined) : undefined
  const notes = s && s.time === 0 ? s.notes.slice(0, s.n).map(noteName) : []
  const tie = s?.time === 1
  const hits =
    lane === -2 && d
      ? DRUM_LANES.filter((_, l) => d.on & (1 << l)).map(([, name]) => name)
      : []
  const on = drum
    ? lane === -2
      ? hits.length > 0
      : !!((d?.on ?? 0) & (1 << lane))
    : notes.length > 0 || tie
  const text = drum
    ? lane === -2
      ? hits.length > 1
        ? String(hits.length)
        : on
          ? '●'
          : ''
      : on
        ? '●'
        : ''
    : tie
      ? '→'
      : notes.length
        ? notes[0] + (notes.length > 1 ? '+' + (notes.length - 1) : '')
        : '+'
  const content = drum
    ? lane === -2
      ? hits.join(', ') || t('previewRest')
      : DRUM_LANES[lane][1]
    : tie
      ? t('previewTie')
      : on
        ? notes.join(', ')
        : noteName(noteOf(k))
  /* what a click does (the same words as the Sequencer page's grid) */
  const act =
    lane === -2
      ? t('previewShowDrumGrid')
      : !on
        ? t('previewAdd')
        : drum
          ? t('sqPvHitDouble')
          : `${t('sqPvClick')} · ${t('sqPvDouble')}`
  const description = `${act} · ${content} · ${t('track')} ${k + 1} · ${t('previewStep')} ${index + 1}`
  return { on, text, description, unused: index >= len }
}

/* the clicks, as the Sequencer page's grid: an empty step gets a note (the one chosen beside the track), a note opens
   the note dialog (this grid's "selected step"), a double click or Delete makes it a rest; a drum cell: an empty one
   gets a hit, a double click or Delete takes the hit away */
const pending = new Map<
  string,
  ReturnType<typeof setTimeout>
>() /* cell key -> the timer of a click that may become a double click */
let added = '' /* the cell a click just filled: its double click keeps it */
function filledOf(
  k: number,
  drum: boolean,
  lane: number,
  cs: CellStep,
): boolean {
  if (drum) return !!(((cs as DrumStep | undefined)?.on ?? 0) & (1 << lane))
  const s = cs as MockStep | undefined
  return !!s && (s.time === 1 || (s.time === 0 && s.n > 0))
}
/* the step a cell edits */
const stepAt = (k: number, drum: boolean, index: number): CellStep => {
  const tr = A.mock!.state.tracks[k]
  return drum ? tr.dstep![index] : tr.step[index]
}
function clearCell(
  k: number,
  drum: boolean,
  lane: number,
  index: number,
): void {
  const s = stepAt(k, drum, index)
  if (!filledOf(k, drum, lane, s)) return
  if (drum) previewSequenceClick(k, index, lane)
  else {
    const x = s as MockStep
    previewSequenceClick(k, index, -1, {
      ...x,
      notes: x.notes.slice(),
      time: 2,
    })
  }
}
function cellClick(
  e: ReactMouseEvent,
  key: string,
  k: number,
  drum: boolean,
  lane: number,
  index: number,
): void {
  if (lane === -2) {
    previewCellClick(e, key, k, lane, index)
    return
  }
  const s = stepAt(k, drum, index)
  if (e.detail > 1) return /* (the double click handles it) */
  if (!filledOf(k, drum, lane, s)) {
    added = key
    setTimeout(() => {
      if (added === key) added = ''
    }, 500)
    if (drum) previewSequenceClick(k, index, lane)
    else
      previewSequenceClick(
        k,
        index,
        -1,
        previewSetStepNotes(s as MockStep, [noteOf(k)]),
      )
    return
  }
  if (drum) return /* a hit: focused (selected) */
  clearTimeout(pending.get(key))
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      previewOpenNote(key, k, index).catch(report)
    }, 250),
  )
}
function cellDouble(
  key: string,
  k: number,
  drum: boolean,
  lane: number,
  index: number,
): void {
  if (lane === -2) return
  clearTimeout(pending.get(key))
  pending.delete(key)
  if (added === key) return
  clearCell(k, drum, lane, index)
}

interface CellsProps {
  k: number
  drum: boolean
  lane?: number
  source: CellStep[]
  page: number
  len: number
  position: number
}
function Cells({
  k,
  drum,
  lane = -1,
  source,
  page,
  len,
  position,
}: CellsProps) {
  return (
    <div className={`${STEPS} self-center`}>
      {Array.from({ length: 16 }, (_, i) => {
        const index = page + i,
          v = cellView(k, drum, lane, source[i], index, len),
          cur = index === position
        const look =
          v.on && cur
            ? 'bg-c text-black border-c'
            : v.on
              ? 'bg-s2 text-c border-s3'
              : cur
                ? 'bg-s1 text-c border-c'
                : `bg-s1 text-dim border-line ${i % 4 === 0 ? 'border-l-s3' : ''}`
        const key = `${k}:${lane}:${i}`
        return (
          <button
            key={i}
            type="button"
            data-track={k}
            data-lane={lane}
            data-step={index}
            disabled={v.unused}
            aria-pressed={lane !== -2 ? v.on : undefined}
            aria-controls={
              lane === -2 ? `preview-drum-details-${k}` : undefined
            }
            aria-expanded={lane === -2 ? PV.drumOpen.has(k) : undefined}
            aria-label={v.description}
            title={v.description}
            className={`preview-seq-cell hover:enabled:border-c hover:enabled:bg-s3 focus-visible:outline-c flex h-7 items-center justify-center overflow-hidden border p-0 normal-case focus-visible:outline-2 focus-visible:outline-offset-1 ${look} ${v.unused ? 'invisible' : ''} ${v.on ? 'on' : ''} ${cur ? 'is-current' : ''} ${lane === -2 ? 'seq-drum-brief' : ''}`}
            onClick={(e) => cellClick(e, key, k, drum, lane, index)}
            onDoubleClick={() => cellDouble(key, k, drum, lane, index)}
            onKeyDown={(e) => {
              if (
                (e.key === 'Delete' || e.key === 'Backspace') &&
                lane !== -2
              ) {
                e.preventDefault()
                clearCell(k, drum, lane, index)
              }
            }}
          >
            <span
              className="preview-seq-note max-[680px]:hidden"
              aria-hidden="true"
            >
              {v.text}
            </span>
            <span
              className={`seq-hit h-3 w-1 bg-current ${v.on ? 'hidden max-[680px]:block' : 'hidden'}`}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}

function TrackRows({ k }: { k: number }) {
  const st = A.mock!.state,
    track = st.tracks[k],
    dev = A.dev!,
    drum = !!track.drum
  const len = Math.max(1, Math.min(64, track.p[29] || 16))
  const position = posOf(k)
  // Keep the page still under the pointer or keyboard focus while editing.
  const el = groups.get(k)
  if (
    PV.follow &&
    position >= 0 &&
    !(el && el.matches(':hover, :focus-within'))
  )
    PV.pages[k] = Math.floor(position / 16) * 16
  const page = (PV.pages[k] = Math.min(
    PV.pages[k] || 0,
    Math.floor((len - 1) / 16) * 16,
  ))
  const name = drum
    ? t('drum')
    : (dev.names[track.engine] || [])[track.preset] || t('track')
  const muted = !!track.p[40] || !!(st.solo && !(st.solo & (1 << k)))
  const source: CellStep[] = (drum ? track.dstep! : track.step).slice(
    page,
    page + 16,
  )
  const setRef = (e: HTMLDivElement | null): void => {
    if (e) groups.set(k, e)
    else groups.delete(k)
  }
  const cells = (lane: number) => (
    <Cells
      k={k}
      drum={drum}
      lane={lane}
      source={source}
      page={page}
      len={len}
      position={position}
    />
  )
  const mutedCls = muted ? 'is-muted [&_.preview-seq-steps]:opacity-40' : ''
  if (!drum) {
    const label = `${t('previewNewNote')} · ${t('track')} ${k + 1}`
    return (
      <div
        ref={setRef}
        className={`${ROW} ${mutedCls}`}
        data-seq-track={k}
        style={{ '--c': tcol(k) } as CSSProperties}
      >
        <div className="preview-seq-label min-w-0">
          <TrackButton
            k={k}
            name={name}
            muted={muted}
            len={len}
            position={position}
          />
          <PageTools k={k} len={len} page={page}>
            <select
              className="seq-pitch h-6 w-16 min-w-0 px-1 py-0 max-[680px]:w-[72px]"
              value={String(noteOf(k))}
              aria-label={label}
              title={label}
              onChange={(e) => {
                PV.notes[k] = +e.target.value
                notify()
              }}
            >
              {Array.from({ length: 128 }, (_, n) => (
                <option key={n} value={n}>
                  {noteName(n)}
                </option>
              ))}
            </select>
          </PageTools>
        </div>
        {cells(-1)}
      </div>
    )
  }
  const open = PV.drumOpen.has(k),
    all = PV.allDrums.has(k)
  const active = track.dstep!.slice(0, len).reduce((mask, d) => mask | d.on, 0)
  const toggle = (set: Set<number>, on: boolean): void => {
    if (on) set.delete(k)
    else set.add(k)
    notify()
  }
  return (
    <div
      ref={setRef}
      className={`preview-seq-drums mt-2 border-t border-line pt-1 ${mutedCls}`}
      data-seq-track={k}
      style={{ '--c': tcol(k) } as CSSProperties}
    >
      <div className={ROW}>
        <div className="preview-seq-label min-w-0">
          <TrackButton
            k={k}
            name={name}
            muted={muted}
            len={len}
            position={position}
          />
          <PageTools k={k} len={len} page={page} />
          <button
            type="button"
            aria-controls={`preview-drum-details-${k}`}
            aria-expanded={open}
            onClick={() => toggle(PV.drumOpen, open)}
            className="seq-drum-toggle text-c focus-visible:outline-c max-w-full bg-transparent p-0 text-left whitespace-normal normal-case focus-visible:outline-1 focus-visible:outline-offset-2 hover:enabled:bg-transparent hover:enabled:text-fg"
          >
            {(open ? '▾ ' : '▸ ') +
              t(open ? 'previewHideDrumGrid' : 'previewShowDrumGrid')}
          </button>
        </div>
        {cells(-2)}
      </div>
      <div id={`preview-drum-details-${k}`} hidden={!open}>
        <div className="preview-seq-drumhead flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="preview-seq-legend seq-drum-help mt-1.5 mb-0 text-dim">
            {t('previewDrumHint')}
          </p>
          <button
            type="button"
            className="seq-all-drums ml-auto bg-transparent p-0 text-dim underline"
            aria-expanded={all}
            onClick={() => toggle(PV.allDrums, all)}
          >
            {t(all ? 'previewFewerDrums' : 'previewAllDrums')}
          </button>
        </div>
        {DRUM_LANES.map((l, lane) => (
          <div
            key={lane}
            className={ROW}
            data-drum-lane={lane}
            hidden={
              !(all || [0, 2, 3, 4, 5].includes(lane) || active & (1 << lane))
            }
          >
            <span className="preview-seq-lane text-fg2 self-center overflow-hidden pl-6 text-ellipsis whitespace-nowrap max-[680px]:pl-0 max-[680px]:text-[12px]">
              {l[1]}
            </span>
            {cells(lane)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Sequence() {
  const st = A.mock!.state
  return (
    <div
      id="preview-sequence"
      className="preview-sequence col-span-2 mt-3 border-t border-line pt-2"
    >
      <div className="preview-seq-head mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="mr-auto">{t('previewSequence')}</span>
        <label className="text-dim">
          <input
            type="checkbox"
            id="preview-follow"
            checked={PV.follow}
            onChange={(e) => {
              PV.follow = e.target.checked
              notify()
            }}
          />{' '}
          <span>{t('previewFollow')}</span>
        </label>
        <button
          type="button"
          id="preview-edit"
          className="bg-transparent p-0 text-dim underline hover:text-fg"
          onClick={() => showTab('sequencer')}
        >
          {t('previewEdit')}
        </button>
      </div>
      <div id="preview-sequence-rows">
        <div
          className={`${ROW} preview-seq-numbers text-center text-[12px] text-dim`}
        >
          <span />
          <div className={STEPS}>
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </div>
        {st.tracks.map((_, k) => (
          <TrackRows key={k} k={k} />
        ))}
      </div>
      <p className="preview-seq-legend mt-1.5 mb-0 text-dim">
        {t('previewSequenceHint')}
      </p>
    </div>
  )
}
