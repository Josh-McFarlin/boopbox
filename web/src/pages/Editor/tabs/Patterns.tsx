// SPDX-License-Identifier: GPL-3.0-only
// The Patterns page (BoopBox): the working project read from the FM-1, its patterns and chains, the scenes and the chord
// progression, as three sub-pages, edited here and sent back whole. (A step's components: pages/patterns/StepComponents.jsx,
// in the Sequencer's step inspector.)
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { A, notify, op, t, tcol, tf, useApp } from '../core/app.ts'
import { PROJ7 } from '../lib/proto.ts'
import type {
  P7Harm,
  P7LenCtx,
  P7Scenes,
  P7Track,
  Proj7,
} from '../lib/proto.ts'
import { Card, Help, SendBar } from '../ui/kit.tsx'
import { bad, bar, dim, seg, tog, warn } from '../ui/styles.ts'

import {
  PT,
  clampIn,
  ptCtx,
  ptDirty,
  ptEdit,
  ptHits,
  ptOwn,
  ptPatUsed,
  ptTidy,
  readPatterns,
  sendPatterns,
} from './patterns/state.ts'
import { HelpMore, MemBar, Sel, SubTabs } from './patterns/ui.tsx'
import { Num } from './song/Num.tsx'

export { PT }
const SUB_KEY = 'boopbox-patterns-sub'
type Sub = 'pat' | 'scn' | 'ch'
const SUBS: [Sub, string][] = [
  ['pat', 'patSubPat'],
  ['scn', 'patSubScn'],
  ['ch', 'patSubCh'],
]
const loadSub = (): Sub => {
  try {
    const v = localStorage.getItem(SUB_KEY)
    return SUBS.some(([k]) => k === v) ? (v as Sub) : 'pat'
  } catch {
    return 'pat'
  }
}
const P_N = (n: number): string => 'P' + (n + 1)

/* a chain slot: its pattern, its repeats (click: one more, wheel / − +: up and down), × removes it; dragged to move */
interface SlotProps {
  x: number
  k: number
  cur: number
  onRep: (r: number) => void
  onDel: () => void
  onDrop: (data: string, at: number) => void
}
function Slot({ x, k, cur, onRep, onDel, onDrop }: SlotProps) {
  const ref = useRef<HTMLButtonElement>(null),
    pat = PROJ7.slotPat(x),
    rep = PROJ7.slotRep(x)
  const st = useRef({ rep, onRep })
  st.current = { rep, onRep }
  useEffect(() => {
    const el = ref.current!
    const f = (e: WheelEvent): void => {
      e.preventDefault()
      const s = st.current
      s.onRep(Math.max(1, Math.min(16, s.rep + (e.deltaY < 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', f, { passive: false })
    return (): void => el.removeEventListener('wheel', f)
  }, [])
  const [over, setOver] = useState(false)
  return (
    <span
      draggable
      data-slot={k}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', 'slot:' + k)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onDrop(e.dataTransfer.getData('text/plain'), k)
      }}
      className={`inline-flex cursor-grab items-center border bg-bg ${pat === cur ? 'border-trk' : 'border-line'} ${over ? 'shadow-[inset_3px_0_0_var(--acc)]' : ''}`}
    >
      <span className="px-2 text-[18px]">{P_N(pat)}</span>
      <button
        type="button"
        className="px-1.5! py-0!"
        disabled={rep <= 1}
        title={rep <= 1 ? t('patRepMin') : t('patRepLess')}
        aria-label={t('patRepLess')}
        onClick={() => onRep(rep - 1)}
      >
        −
      </button>
      <button
        type="button"
        ref={ref}
        className="text-acc min-w-[38px] bg-transparent! px-1! py-0!"
        title={t('patRepHint')}
        aria-label={t('patRepeat')}
        onClick={() => onRep(rep >= 16 ? 1 : rep + 1)}
      >
        {'×' + rep}
      </button>
      <button
        type="button"
        className="px-1.5! py-0!"
        disabled={rep >= 16}
        title={rep >= 16 ? t('patRepMax') : t('patRepMore')}
        aria-label={t('patRepMore')}
        onClick={() => onRep(rep + 1)}
      >
        +
      </button>
      <button
        type="button"
        className="px-1.5! py-0!"
        title={t('patSlotDel')}
        aria-label={t('patSlotDel')}
        onClick={onDel}
      >
        ×
      </button>
    </span>
  )
}

/* the tracks, the selected one's eight patterns, what to do with the pattern picked, its chain */
interface PatternsTabProps {
  P: Proj7
  tr: P7Track
  drum: boolean
  ctx: P7LenCtx
}
function PatternsTab({ P, tr, drum, ctx }: PatternsTabProps) {
  const [to, setTo] = useState<number | null>(null)
  const [overEnd, setOverEnd] = useState(false)
  const sel = PT.pat!,
    selUsed = ptPatUsed(PT.trk, sel)
  const chainSet = (c: number[]): void =>
    ptEdit(() => PROJ7.setChain(P, PT.trk, c))
  const full = tr.chain.length >= PROJ7.NCHAIN
  /* a drop on the chain: a pattern tile ("pat:n") is put in, a slot ("slot:k") moved; before slot `at` (or at the end) */
  const drop = (data: string, at: number): void => {
    const c = tr.chain.slice(),
      m = /^(pat|slot):(\d+)$/.exec(data || '')
    if (!m) return
    if (m[1] === 'pat') {
      if (full) return
      c.splice(at, 0, PROJ7.slot(+m[2]))
    } else {
      const from = +m[2],
        [x] = c.splice(from, 1)
      c.splice(from < at ? at - 1 : at, 0, x)
    }
    chainSet(c)
  }
  const toN = to != null && to !== sel ? to : sel === 0 ? 1 : 0
  const pv = PROJ7.patOf(P, PT.trk, sel) || PROJ7.emptyPat(drum)
  return (
    <>
      <Card title={t('patPatterns')} ic="symbol_grid">
        <div
          id="pattrk"
          className="mb-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label={t('patTracks')}
        >
          {P.tracks.map((x) => {
            const name =
              x.kind === PROJ7.DRUM
                ? 'DRUMS'
                : A.dev!.info!.engines[x.eng] || ''
            return (
              <button
                key={x.i}
                type="button"
                style={{ '--c': tcol(x.i) } as CSSProperties}
                aria-pressed={x.i === PT.trk}
                className="border-c aria-pressed:bg-c! min-w-[110px] border-l-4 text-left aria-pressed:text-black"
                onClick={() => {
                  PT.trk = x.i
                  PT.pat = x.cur
                  notify()
                }}
              >{`${x.i + 1} ${name} · ${P_N(x.cur)}`}</button>
            )
          })}
        </div>
        <div
          id="patcells"
          className="mb-3 grid grid-cols-8 gap-1.5"
          role="group"
          aria-label={t('patPatterns')}
        >
          {Array.from({ length: PROJ7.NPAT }, (_, n) => {
            const used = ptPatUsed(PT.trk, n),
              play = n === tr.cur,
              p = PROJ7.patOf(P, PT.trk, n)
            const hits = p
              ? p.steps.reduce((a, _, k) => a + (ptHits(p, drum, k) ? 1 : 0), 0)
              : 0
            return (
              <button
                key={n}
                type="button"
                aria-pressed={n === PT.pat}
                draggable
                title={t('patTileHint')}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', 'pat:' + n)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => {
                  PT.pat = n
                  notify()
                }}
                className={`aria-pressed:bg-s3! aria-pressed:outline-acc grid cursor-grab gap-0.5 border px-2 py-1.5 text-left normal-case aria-pressed:outline-2 ${!used ? 'text-dim' : ''} ${play ? 'border-trk shadow-[inset_0_0_0_1px_var(--trk)]' : 'border-line'}`}
              >
                <span className="flex items-center justify-between text-[18px]">
                  {P_N(n)}
                  {play ? (
                    <span className="text-trk text-[14px]">{'▶'}</span>
                  ) : null}
                </span>
                <span className={dim}>
                  {play
                    ? t('patPlaying')
                    : used
                      ? tf('patSteps', { n: hits })
                      : t('empty')}
                </span>
                <span className={dim}>
                  {tf('patLen', { n: PROJ7.lenOf(P, PT.trk, n, ctx) })}
                </span>
              </button>
            )
          })}
        </div>
        {/* what to do with the pattern picked */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3"
          id="patacts"
        >
          <b className="font-normal text-fg">
            {tf('patPicked', { n: sel + 1 })}
          </b>
          <button
            type="button"
            disabled={sel === tr.cur}
            title={
              sel === tr.cur
                ? tf('patPlayWhy', { n: sel + 1 })
                : t('patPlayHint')
            }
            onClick={() => ptEdit(() => PROJ7.play(P, PT.trk, sel, ctx))}
          >
            {tf('patPlay', { n: sel + 1 })}
          </button>
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={!selUsed}
              title={
                !selUsed ? tf('patEmptyWhy', { n: sel + 1 }) : t('patCopyHint')
              }
              onClick={() => {
                if (
                  ptPatUsed(PT.trk, toN) &&
                  !confirm(tf('patReplace', { n: toN + 1 }))
                )
                  return
                ptEdit(() =>
                  PROJ7.setPat(
                    P,
                    PT.trk,
                    toN,
                    PROJ7.patOf(P, PT.trk, sel),
                    PROJ7.lenOf(P, PT.trk, sel, ctx),
                    ctx,
                  ),
                )
              }}
            >
              {t('patCopy')}
            </button>
            <Sel
              id="patcopyto"
              v={toN}
              onPick={setTo}
              aria-label={t('patCopyTo')}
            >
              {Array.from({ length: 8 }, (_, n) => n)
                .filter((n) => n !== sel)
                .map((n) => (
                  <option key={n} value={n}>
                    {P_N(n) + (ptPatUsed(PT.trk, n) ? ' ●' : '')}
                  </option>
                ))}
            </Sel>
          </span>
          <button
            type="button"
            className={warn}
            disabled={!selUsed}
            title={
              !selUsed ? tf('patEmptyWhy', { n: sel + 1 }) : t('patClearHint')
            }
            onClick={() => {
              if (!confirm(tf('patClearAsk', { n: sel + 1 }))) return
              ptEdit(() => PROJ7.setPat(P, PT.trk, sel, null, 0, ctx))
            }}
          >
            {t('patClear')}
          </button>
          <span
            className="inline-flex items-center gap-1.5"
            id="patdir"
            title={t('cpDirHint')}
          >
            <span>{t('cpDir')}</span>
            <span className={seg}>
              {PROJ7.DIRS.map((d, k) => (
                <button
                  key={k}
                  type="button"
                  className={tog}
                  aria-pressed={(pv.dir | 0) === k}
                  onClick={() =>
                    ptEdit(() => {
                      ptOwn(P, PT.trk, sel, ctx).dir = k
                      ptTidy(P, PT.trk, sel, ctx)
                    })
                  }
                >
                  {d}
                </button>
              ))}
            </span>
            <label htmlFor="patseed" title={t('cpSeedHint')}>
              {t('cpSeed')}
            </label>
            <Num
              id="patseed"
              v={pv.seed | 0}
              min={0}
              max={255}
              className="w-16"
              title={t('cpSeedHint')}
              onCommit={(v) =>
                ptEdit(() => {
                  ptOwn(P, PT.trk, sel, ctx).seed = clampIn(v, 0, 255, 0)
                  ptTidy(P, PT.trk, sel, ctx)
                })
              }
            />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" id="patfollow">
          {drum ? (
            <span className="text-dim">{t('patFollowDrum')}</span>
          ) : (
            <>
              <label htmlFor="pathfol" title={t('patFollowHint')}>
                {tf('patFollow', { t: PT.trk + 1 })}
              </label>
              <Sel
                id="pathfol"
                v={tr.hfol | 0}
                title={t('patFollowHint')}
                onPick={(v) =>
                  ptEdit(() => {
                    tr.hfol = v
                    tr.tail = 2
                  })
                }
              >
                {PROJ7.HFOL.map((h, k) => (
                  <option key={k} value={k}>
                    {t('patHfol' + k)}
                  </option>
                ))}
              </Sel>
              <span className="text-dim">{t('patHfolH' + (tr.hfol | 0))}</span>
            </>
          )}
        </div>
      </Card>
      <Card
        title={tf('patChainOf', { t: PT.trk + 1 })}
        ic="control_arrow_loop"
        sub={tf('patSlots', { n: tr.chain.length, max: PROJ7.NCHAIN })}
      >
        <Help>{t('patChainHelp')}</Help>
        <div
          id="patchain"
          onDragOver={(e) => {
            e.preventDefault()
            setOverEnd(true)
          }}
          onDragLeave={() => setOverEnd(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOverEnd(false)
            drop(e.dataTransfer.getData('text/plain'), tr.chain.length)
          }}
          className={`mb-3 flex min-h-[48px] flex-wrap items-center gap-1.5 border border-dashed p-2 ${overEnd ? 'border-acc bg-s2' : 'border-line'}`}
        >
          {tr.chain.map((x, k) => (
            <Slot
              key={k}
              x={x}
              k={k}
              cur={tr.cur}
              onDrop={drop}
              onRep={(r) => {
                const c = tr.chain.slice()
                c[k] = PROJ7.slot(PROJ7.slotPat(x), r)
                chainSet(c)
              }}
              onDel={() => {
                const c = tr.chain.slice()
                c.splice(k, 1)
                chainSet(c)
              }}
            />
          ))}
          <span className="text-dim">
            {tr.chain.length
              ? full
                ? t('patChainFull')
                : t('patDropMore')
              : t('patNoChain')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" id="patchainadd">
          {Array.from({ length: 8 }, (_, n) => (
            <button
              key={n}
              type="button"
              className="normal-case"
              disabled={full}
              title={full ? t('patChainFull') : tf('patAddSlot', { n: n + 1 })}
              onClick={() => chainSet([...tr.chain, PROJ7.slot(n)])}
            >
              {'+' + P_N(n)}
            </button>
          ))}
          <button
            type="button"
            className={clsx(warn, 'ml-2')}
            disabled={!tr.chain.length}
            title={!tr.chain.length ? t('patNoChainWhy') : ''}
            onClick={() => chainSet([])}
          >
            {t('patChainClear')}
          </button>
          <label
            className="ml-2 inline-flex items-center gap-1.5"
            title={t('patChainPlayHint')}
          >
            <input
              type="checkbox"
              checked={!tr.coff}
              onChange={(e) =>
                ptEdit(() => {
                  tr.coff = e.target.checked ? 0 : 1
                  if (tr.tail < 1) tr.tail = 1
                })
              }
            />
            {t('patChainPlay')}
          </label>
          <span className="text-dim">
            {tr.chain.length === 1 ? t('patChainOne') : ''}
          </span>
        </div>
      </Card>
    </>
  )
}

/* the scenes: a row each, its name and each track's pattern in it (keep); a cell off the default (scene N = pattern N) shows */
function ScenesTab({ P }: { P: Proj7 }) {
  const S = P.scenes || PROJ7.scenesDefault()
  const edit = (f: (s: P7Scenes) => void): void =>
    ptEdit(() => {
      if (!P.scenes) P.scenes = PROJ7.scenesDefault()
      f(P.scenes)
    })
  const isDef = !P.scenes || PROJ7.scenesIsDefault(P.scenes)
  return (
    <Card title={t('scnTitle')} ic="symbol_grid">
      <HelpMore line={t('scnHelp1')}>{t('scnHelp')}</HelpMore>
      <table
        id="scntab"
        className="border-separate border-spacing-1 [&_select]:w-full [&_select]:py-0.5 [&_select]:pl-1.5 [&_th]:px-1 [&_th]:text-center [&_th]:normal-case"
      >
        <thead>
          <tr>
            <th>{t('scnScene')}</th>
            <th className="text-left!">{t('scnName')}</th>
            {P.tracks.map((x) => (
              <th key={x.i} style={{ color: tcol(x.i) }}>
                {tf('scnTrack', { n: x.i + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: PROJ7.NSCENE }, (_, k) => (
            <tr key={k}>
              <td className="text-center text-dim">{String(k + 1)}</td>
              <td className="w-[130px]">
                <Sel
                  v={S.names[k]}
                  aria-label={tf('scnNameOf', { n: k + 1 })}
                  className={S.names[k] ? 'border-acc! text-acc' : ''}
                  onPick={(v) =>
                    edit((Z) => {
                      Z.names[k] = v
                    })
                  }
                >
                  {PROJ7.SCN_NAMES.map((n, j) => (
                    <option key={j} value={j}>
                      {n}
                    </option>
                  ))}
                </Sel>
              </td>
              {P.tracks.map((x) => {
                const v = S.pats[k][x.i],
                  off = v !== k
                return (
                  <td key={x.i} className="w-[76px]">
                    <Sel
                      v={v}
                      aria-label={tf('scnCell', { s: k + 1, t: x.i + 1 })}
                      title={off ? t('scnChanged') : t('scnDefault')}
                      className={off ? 'border-acc! text-acc' : 'text-dim'}
                      onPick={(nv) =>
                        edit((Z) => {
                          Z.pats[k][x.i] = nv
                        })
                      }
                    >
                      <option value={PROJ7.SCN_KEEP}>{t('scnKeep')}</option>
                      {Array.from({ length: 8 }, (_, n) => (
                        <option key={n} value={n}>
                          {P_N(n)}
                        </option>
                      ))}
                    </Sel>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={clsx(bar, 'mt-3')}>
        <button
          type="button"
          id="scnreset"
          className={warn}
          disabled={isDef}
          title={isDef ? t('scnResetWhy') : ''}
          onClick={() => {
            if (confirm(t('scnResetAsk')))
              ptEdit(() => {
                P.scenes = null
              })
          }}
        >
          {t('scnReset')}
        </button>
        <span className="text-dim">{t('scnLegend')}</span>
      </p>
    </Card>
  )
}

/* the song's chord progression: up to 8 chords, a degree of the key's scale (I..VII) for 1..16 bars */
function ChordsTab({ P }: { P: Proj7 }) {
  const h = P.harm || [{ deg: 0, bars: 4 }]
  const edit = (f: (h: P7Harm[]) => void): void =>
    ptEdit(() => {
      const x = (P.harm || [{ deg: 0, bars: 4 }]).map((c) => ({ ...c }))
      f(x)
      P.harm = x
    })
  const total = h.reduce((a, c) => a + c.bars, 0),
    isDef = PROJ7.harmDefault(P.harm)
  return (
    <Card
      title={t('chTitle')}
      ic="symbol_tuning"
      sub={tf('chSum', { n: h.length, max: PROJ7.NHPROG, bars: total })}
    >
      <HelpMore line={t('chHelp1')}>{t('chHelp')}</HelpMore>
      <div
        className="mb-3 flex h-9 max-w-[720px] border border-line"
        aria-hidden="true"
      >
        {h.map((c, k) => (
          <span
            key={k}
            style={{ flexGrow: c.bars }}
            className="bg-s2 flex basis-0 items-center justify-center border-r border-line text-[18px] last:border-r-0"
          >
            {PROJ7.ROMAN[c.deg % 7]}
          </span>
        ))}
      </div>
      <ol id="chrows" className="m-0 mb-3 grid list-none gap-1.5 p-0">
        {h.map((c, k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="w-6 text-right text-dim">{String(k + 1)}</span>
            <Sel
              v={c.deg % 7}
              aria-label={tf('chChordN', { n: k + 1 })}
              onPick={(v) =>
                edit((x) => {
                  x[k].deg = v
                })
              }
            >
              {PROJ7.ROMAN.map((r, i) => (
                <option key={i} value={i}>
                  {tf('chDeg', { r, n: i + 1 })}
                </option>
              ))}
            </Sel>
            <Num
              v={c.bars}
              min={1}
              max={16}
              className="w-16"
              aria-label={t('songBars')}
              onCommit={(v) =>
                edit((x) => {
                  x[k].bars = clampIn(v, 1, 16, 1)
                })
              }
            />
            <span className="text-dim">{t('chBarsUnit')}</span>
            <span className="ml-2 inline-flex gap-1 [&_button]:min-w-[34px] [&_button]:px-1.5 [&_button]:py-0">
              <button
                type="button"
                title={k === 0 ? t('chFirst') : t('songUp')}
                aria-label={t('songUp')}
                disabled={k === 0}
                onClick={() =>
                  edit((x) => {
                    x.splice(k - 1, 0, x.splice(k, 1)[0])
                  })
                }
              >
                ↑
              </button>
              <button
                type="button"
                title={k === h.length - 1 ? t('chLast') : t('songDown')}
                aria-label={t('songDown')}
                disabled={k === h.length - 1}
                onClick={() =>
                  edit((x) => {
                    x.splice(k + 1, 0, x.splice(k, 1)[0])
                  })
                }
              >
                ↓
              </button>
              <button
                type="button"
                title={h.length < 2 ? t('chOneLeft') : t('songDel')}
                aria-label={t('songDel')}
                disabled={h.length < 2}
                onClick={() =>
                  edit((x) => {
                    x.splice(k, 1)
                  })
                }
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className={bar}>
        <button
          type="button"
          id="chadd"
          disabled={h.length >= PROJ7.NHPROG}
          title={
            h.length >= PROJ7.NHPROG ? tf('chFull', { max: PROJ7.NHPROG }) : ''
          }
          onClick={() =>
            edit((x) => {
              const l = x[x.length - 1]
              x.push({ deg: (l.deg + 3) % 7, bars: l.bars })
            })
          }
        >
          {t('chAdd')}
        </button>
        <button
          type="button"
          id="chreset"
          className={warn}
          disabled={isDef}
          title={isDef ? t('chResetWhy') : ''}
          onClick={() =>
            ptEdit(() => {
              P.harm = null
            })
          }
        >
          {t('chReset')}
        </button>
      </p>
    </Card>
  )
}

export default function Patterns() {
  const { dev, busy } = useApp()
  const [sub, setSub] = useState(loadSub)
  useEffect(() => {
    /* (BoopBox) the project, read once per connection (when free) */
    if (!dev || !dev.dump || PT.dev === dev || busy) return
    Object.assign(PT, {
      dev,
      P: null,
      base: null,
      err: '',
      trk: dev.sel || 0,
      pat: undefined,
    })
    op(readPatterns)
  })
  if (!dev || !dev.dump) return null
  const pick = (k: Sub): void => {
    setSub(k)
    try {
      localStorage.setItem(SUB_KEY, k)
    } catch {
      /* no storage */
    }
  }
  let note: ReactNode = null,
    fits = true,
    body: ReactNode = null
  const dirty = ptDirty()
  if (PT.P) {
    const P = PT.P,
      ctx = ptCtx(),
      tr = PROJ7.track(P, PT.trk)!,
      drum = tr.kind === PROJ7.DRUM
    const bank = PROJ7.bankBytes(P),
      size = PROJ7.HDR + PROJ7.encodeBody(P).length
    fits = bank <= PROJ7.PB_SIZE && size <= PROJ7.MAX
    note = (
      <span id="patsize" className="inline-flex gap-3">
        <MemBar label={t('patMemPat')} used={bank} max={PROJ7.PB_SIZE} />
        <MemBar label={t('patMemProj')} used={size} max={PROJ7.MAX} />
      </span>
    )
    if (PT.pat === undefined) PT.pat = tr.cur
    body =
      sub === 'scn' ? (
        <ScenesTab P={P} />
      ) : sub === 'ch' ? (
        <ChordsTab P={P} />
      ) : (
        <PatternsTab P={P} tr={tr} drum={drum} ctx={ctx} />
      )
  }
  /* the accent: the track picked here */
  return (
    <div
      style={PT.P ? ({ '--trk': tcol(PT.trk) } as CSSProperties) : undefined}
      id="patbody"
    >
      <SendBar
        dirty={dirty}
        busy={!!busy}
        note={note}
        sendDisabled={!PT.P || !fits}
        why={!PT.P ? t('patNotRead') : t('patFull')}
        onSend={async () => op(sendPatterns)}
        onRead={() => {
          if (dirty && !confirm(t('patDiscard'))) return
          op(readPatterns)
        }}
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SubTabs tabs={SUBS} value={sub} onPick={pick} id="patsub" />
        <HelpMore className="m-0 flex-1" line={t('patHelp1')}>
          {t('patHelp')}
        </HelpMore>
      </div>
      {PT.err ? (
        <p className={bad} id="paterr">
          {t(PT.err)}
        </p>
      ) : null}
      {body}
    </div>
  )
}
