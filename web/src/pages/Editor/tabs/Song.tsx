// SPDX-License-Identifier: GPL-3.0-only
// The Song page: the order of the sections A..D (the device's SONG screen) as a timeline, and what happens at its end.
// (A song as one file: the Save & load page.)
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import type { Dev } from '../core/app.ts'
import { A, notify, op, rq, sayK, t, tf, useApp } from '../core/app.ts'
import { SG } from '../core/shared.ts'
import type { SongRow } from '../core/shared.ts'
import { ARR, CMD, crc32, parse, req } from '../lib/proto.ts'
import type { ArrRow } from '../lib/proto.ts'
import { Card, SendBar } from '../ui/kit.tsx'
import { bad, seg, tog, togId, warn } from '../ui/styles.ts'

import { HelpMore } from './patterns/ui.tsx'
import { Stepper } from './song/Num.tsx'

/* ---- SLOOP 2.5: the Song page: the order of the sections A..D (the device's SONG screen, from the browser) ----
   SG.rows: the entries grouped ({scene, bars, times}: the same section and bars in a row is one block played `times`);
   SG.loopFrom: the block the song starts again from when it loops (the loop region's first entry, BoopBox);
   SG.rawFirst / SG.keepEnd: a region set on the FM-1 that is not "from a block to the end", kept until changed here;
   SG.base: the song as read, to tell unsent changes */
const LET = 'ABCD'
const emptySec = (dev: Dev, s: number): boolean =>
  dev.slotUsed[s] != null &&
  !dev.slotUsed[s] /* (PROJECT: used 0 / 1; null: not known) */
const total = (rows: SongRow[]): number =>
  rows.reduce((a, r) => a + Math.max(1, r.times | 0), 0)
const startOf = (rows: SongRow[], k: number): number => total(rows.slice(0, k))

/* the loop region from the block picked: from its first entry to the end (null: the whole song) */
function regionOf(): { first: number; end: number } | null {
  const rows = SG.rows!,
    n = total(rows),
    k = Math.max(0, rows.indexOf(SG.loopFrom!))
  let first = startOf(rows, k)
  if (
    SG.rawFirst != null &&
    SG.rawFirst > first &&
    SG.rawFirst < first + rows[k].times
  )
    first = SG.rawFirst
  const end =
    SG.keepEnd != null && SG.keepEnd > first && SG.keepEnd <= n ? SG.keepEnd : n
  return first === 0 && end === n ? null : { first, end }
}
const songOf = () => ({
  loop: !!SG.loop,
  entries: ARR.expand(SG.rows!),
  region: regionOf(),
})
const sig = (): string => JSON.stringify(songOf())
const songDirty = (): boolean =>
  !!SG.rows && SG.base != null && sig() !== SG.base

async function readSong(): Promise<void> {
  const dev = A.dev
  if (!dev || !(dev.info!.proto >= 6)) {
    Object.assign(SG, { rows: null, err: 'songOld' })
    notify()
    return
  }
  const L = parse[CMD.BK_LIST](
    await rq(req.bkList(), { timeout: 5000, retries: 0 }),
  )
  const it = L.rc ? null : L.items.find((x) => x.id === 1)
  if (!it) throw new Error('the settings are not readable (rc ' + L.rc + ')')
  const data = new Uint8Array(it.len)
  for (let off = 0; off < it.len; off += 256) {
    const n = Math.min(256, it.len - off)
    const g = parse[CMD.BK_GET](
      await rq(req.bkGet(1, off, n), { timeout: 1500, retries: 2 }),
    )
    if (g.rc || g.data.length !== n) throw new Error(`settings: GET rc ${g.rc}`)
    data.set(g.data, off)
  }
  if (!ARR.ok(data)) {
    Object.assign(SG, { rows: null, err: 'songOld' })
    notify()
    return
  }
  const song = ARR.decode(data),
    rows: ArrRow[] = ARR.group(song.entries),
    n = song.entries.length,
    r = song.region
  let k = 0
  if (r) while (k + 1 < rows.length && startOf(rows, k + 1) <= r.first) k++
  Object.assign(SG, {
    bytes: data,
    rows,
    loop: song.loop,
    region: r,
    err: '',
    loopFrom: rows[k] || null,
    rawFirst: r && r.first !== startOf(rows, k) ? r.first : null,
    keepEnd: r && r.end < n ? r.end : null,
  })
  SG.sel = Math.min(SG.sel! | 0, rows.length - 1)
  SG.base = rows.length ? sig() : ''
  notify()
}
async function sendSong(): Promise<void> {
  if (!A.dev || !SG.rows) return
  const song = songOf()
  if (!ARR.valid(song)) {
    sayK('songBad')
    return
  }
  const d = ARR.encode(SG.bytes!, song)
  let r = parse[CMD.BK_PUT](
    await rq(req.bkBegin(1, d.length, crc32(d)), { timeout: 1500, retries: 1 }),
  )
  if (r.rc) throw new Error(`song: begin rc ${r.rc}`)
  for (let off = 0; off < d.length; off += 256) {
    r = parse[CMD.BK_PUT](
      await rq(req.bkData(1, off, d.subarray(off, off + 256)), {
        timeout: 1500,
        retries: 1,
      }),
    )
    if (r.rc) throw new Error(`song: data rc ${r.rc}`)
  }
  r = parse[CMD.BK_PUT](
    await rq(req.bkCommit(1), { timeout: 5000, retries: 0 }),
  )
  if (r.rc === 3) {
    sayK('songRefused')
    return
  } /* (project.c settings_restore: the song is playing) */
  if (r.rc) throw new Error(`song: commit rc ${r.rc}`)
  await readSong()
  sayK('songSent')
}
function songEdit(fn: () => void): void {
  fn()
  notify()
}
function move(from: number, to: number): void {
  const rows = SG.rows!
  if (to < 0 || to >= rows.length || from === to) return
  songEdit(() => {
    const [x] = rows.splice(from, 1)
    rows.splice(to, 0, x)
    SG.sel = to
  })
}
const blockLabel = (r: SongRow): string =>
  tf('songBlock', { s: LET[r.scene], b: r.bars, n: Math.max(1, r.times | 0) })

/* the song as a timeline: a block per entry, as wide as it plays (bars × times), the colour of its section */
function Timeline({ dev }: { dev: Dev }) {
  const [drag, setDrag] = useState<number | null>(null),
    [over, setOver] = useState<number | null>(null)
  const rows = SG.rows!
  let bar = 1
  return (
    <div
      id="songrows"
      className="flex min-h-[76px] w-full gap-1 overflow-x-auto pb-1"
      role="listbox"
      aria-label={t('songTimeline')}
    >
      {rows.map((r, k) => {
        const len = r.bars * Math.max(1, r.times | 0),
          from = bar,
          empty = emptySec(dev, r.scene)
        bar += len
        return (
          <button
            key={k}
            type="button"
            role="option"
            aria-selected={k === SG.sel}
            draggable
            title={t('songDragHint')}
            style={
              {
                '--c': `var(--t${r.scene + 1})`,
                flexGrow: len,
                flexBasis: 0,
              } as CSSProperties
            }
            onClick={() => {
              SG.sel = k
              notify()
            }}
            onDragStart={(e) => {
              setDrag(k)
              e.dataTransfer.setData('text/plain', 'song:' + k)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              setDrag(null)
              setOver(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(k)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const m = /^song:(\d+)$/.exec(
                e.dataTransfer.getData('text/plain'),
              )
              setOver(null)
              if (m) move(+m[1], k)
            }}
            className={`border-c relative flex min-w-[96px] cursor-grab flex-col items-start justify-between gap-1 border-2 border-l-[6px] bg-[color-mix(in_srgb,var(--c)_22%,var(--bg))] px-2 py-1.5 text-left normal-case hover:bg-[color-mix(in_srgb,var(--c)_34%,var(--bg))]! ${k === SG.sel ? 'outline-acc outline-2 outline-offset-2' : ''} ${drag === k ? 'opacity-50' : ''} ${over === k && drag !== k ? 'shadow-[inset_4px_0_0_var(--acc)]' : ''} ${empty ? 'border-dashed' : ''}`}
          >
            <span className="whitespace-nowrap text-fg">{blockLabel(r)}</span>
            <span className="text-[14px] whitespace-nowrap text-dim">
              {tf('songBarAt', { n: from })}
              {empty ? (
                <span className="text-red">{' · ' + t('songEmptyShort')}</span>
              ) : null}
            </span>
            {SG.loop &&
            r === rows[Math.max(0, rows.indexOf(SG.loopFrom!))] &&
            rows.length > 1 ? (
              <span
                className="text-acc absolute top-1 right-1.5"
                title={t('songLoopMark')}
              >
                {'↻'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* the block picked: its section, its bars, how many times it plays, its place */
function EntryEditor({ dev, n }: { dev: Dev; n: number }) {
  const rows = SG.rows!,
    k = SG.sel!,
    r = rows[k]
  if (!r) return null
  const full = n >= ARR.STEPS
  return (
    <div id="songentry" className="mt-4 border border-line bg-bg p-3">
      <div className="mb-3 flex items-center gap-3">
        <b className="text-big font-normal text-fg">
          {tf('songEntryN', { n: k + 1 })}
        </b>
        <span className="text-dim">{blockLabel(r)}</span>
        <span className="ml-auto inline-flex gap-1.5">
          <button
            type="button"
            disabled={k === 0}
            title={k === 0 ? t('songFirst') : t('songEarlier')}
            onClick={() => move(k, k - 1)}
          >
            {'← ' + t('songEarlier')}
          </button>
          <button
            type="button"
            disabled={k === rows.length - 1}
            title={k === rows.length - 1 ? t('songLast') : t('songLater')}
            onClick={() => move(k, k + 1)}
          >
            {t('songLater') + ' →'}
          </button>
          <button
            type="button"
            className={warn}
            id="songdel"
            disabled={rows.length < 2}
            title={rows.length < 2 ? t('songOneLeft') : ''}
            onClick={() =>
              songEdit(() => {
                rows.splice(k, 1)
                SG.sel = Math.max(0, k - 1)
              })
            }
          >
            {t('songDel')}
          </button>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <span className="inline-flex items-center gap-2">
          <span>{t('songSection')}</span>
          <span
            className={seg}
            id="songsec"
            role="group"
            aria-label={t('songSection')}
          >
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={r.scene === s}
                style={{ '--c': `var(--t${s + 1})` } as CSSProperties}
                className={clsx(togId, 'border-c min-w-[44px] border-b-4')}
                title={emptySec(dev, s) ? t('songSecEmpty') : ''}
                onClick={() =>
                  songEdit(() => {
                    r.scene = s
                  })
                }
              >
                {LET[s] + (emptySec(dev, s) ? '°' : '')}
              </button>
            ))}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Stepper
            id="songbars"
            v={r.bars}
            min={1}
            max={ARR.MAX_BARS}
            label={t('songBars')}
            fmt={(v) => tf('songBarsN', { n: v })}
            whyMin={t('songBarsMin')}
            whyMax={tf('songBarsMax', { n: ARR.MAX_BARS })}
            onChange={(v) =>
              songEdit(() => {
                r.bars = v
              })
            }
          />
          <span>×</span>
          <Stepper
            id="songtimes"
            v={Math.max(1, r.times | 0)}
            min={1}
            max={Math.max(1, r.times | 0) + (full ? 0 : ARR.STEPS - n)}
            label={t('songTimes')}
            fmt={(v) => tf('songTimesN', { n: v })}
            whyMin={t('songTimesMin')}
            whyMax={tf('songFull', { max: ARR.STEPS })}
            onChange={(v) =>
              songEdit(() => {
                r.times = v
              })
            }
          />
        </span>
      </div>
      <p className="mt-3 mb-0 text-dim">{t('songTimesHelp')}</p>
    </div>
  )
}

function SongBody() {
  const dev = A.dev!,
    rows = SG.rows!
  const n = total(rows),
    bars = rows.reduce((a, r) => a + r.bars * Math.max(1, r.times | 0), 0)
  if (SG.sel == null || SG.sel >= rows.length)
    SG.sel = Math.max(0, Math.min(SG.sel! | 0, rows.length - 1))
  if (SG.loopFrom && !rows.includes(SG.loopFrom)) SG.loopFrom = rows[0]
  const lk = Math.max(0, rows.indexOf(SG.loopFrom!))
  const full = n >= ARR.STEPS
  return (
    <div id="songbody">
      <Timeline dev={dev} />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          id="songadd"
          disabled={full}
          title={full ? tf('songFull', { max: ARR.STEPS }) : t('songAddHint')}
          onClick={() =>
            songEdit(() => {
              const at = Math.min(SG.sel! + 1, rows.length),
                last = rows[at - 1]
              rows.splice(at, 0, {
                scene: last ? (last.scene + 1) % 4 : 0,
                bars: last ? last.bars : 4,
                times: 1,
              })
              SG.sel = at
            })
          }
        >
          {t('songAdd')}
        </button>
        <span id="songsum" className={n > ARR.STEPS ? bad : 'text-dim'}>
          {tf('songSum', { n, max: ARR.STEPS, bars })}
        </span>
      </div>
      {rows.some((r) => emptySec(dev, r.scene)) ? (
        <p className={clsx(bad, 'mt-2 mb-0')} id="songempty">
          {t('songEmpty')}
        </p>
      ) : null}
      <EntryEditor dev={dev} n={n} />
      <div className="mt-4 flex flex-wrap items-center gap-3" id="songend">
        <span>{t('songEnds')}</span>
        <span className={seg} id="songloop">
          <button
            type="button"
            className={tog}
            aria-pressed={!SG.loop}
            onClick={() =>
              songEdit(() => {
                SG.loop = false
              })
            }
          >
            {t('songLoopOff')}
          </button>
          <button
            type="button"
            className={tog}
            aria-pressed={!!SG.loop}
            onClick={() =>
              songEdit(() => {
                SG.loop = true
              })
            }
          >
            {t('songLoopOn')}
          </button>
        </span>
        <select
          id="songrf"
          aria-label={t('songLoopFrom')}
          disabled={!SG.loop}
          title={!SG.loop ? t('songLoopFromWhy') : ''}
          value={String(lk)}
          onChange={(e) =>
            songEdit(() => {
              SG.loopFrom = rows[+e.target.value]
              SG.rawFirst = null
              SG.keepEnd = null
            })
          }
        >
          {rows.map((r, k) => (
            <option key={k} value={k}>
              {tf('songEntryOpt', { n: k + 1, l: blockLabel(r) })}
            </option>
          ))}
        </select>
        {SG.loop && SG.keepEnd != null ? (
          <span className="text-dim" id="songrhint">
            {tf('songKeepEnd', { n: SG.keepEnd })}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function Song() {
  const { dev, busy } = useApp()
  useEffect(() => {
    /* (2.5) read the song order once per connection (when free) */
    if (!dev || !dev.dump || SG.dev === dev || busy) return
    Object.assign(SG, { dev, rows: null, err: '', base: null, sel: 0 })
    op(readSong)
  })
  if (!dev || !dev.dump) return null
  const dirty = songDirty(),
    n = SG.rows ? total(SG.rows) : 0
  return (
    <>
      <SendBar
        dirty={dirty}
        busy={!!busy}
        sendDisabled={!SG.rows || n > ARR.STEPS || !n}
        why={!SG.rows ? t('songNotRead') : tf('songFull', { max: ARR.STEPS })}
        onSend={async () => op(sendSong)}
        onRead={() => {
          if (dirty && !confirm(t('songDiscard'))) return
          op(readSong)
        }}
      />
      <Card title={t('songTitle')} ic="control_arrow_loop">
        <HelpMore line={t('songHelp1')}>{t('songHelp')}</HelpMore>
        {SG.err ? (
          <p className={bad} id="songerr">
            {t(SG.err)}
          </p>
        ) : null}
        {SG.rows ? <SongBody /> : null}
      </Card>
    </>
  )
}
