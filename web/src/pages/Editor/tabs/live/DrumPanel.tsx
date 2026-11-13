// SPDX-License-Identifier: GPL-3.0-only
/* ---- (2.7) the drum track on the Sound page: the kit (heard), its level, pan, filter, sends and INSERT, and each pad's
   TUNE and DECAY (LIVE op 12: the DRUMS screen's SOUND page). The drum track is the selected one: its values go by SET.
   The Sound page renders it when the selected track is a drum track. */
import { clsx } from 'clsx'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import {
  A,
  P,
  drumFocus,
  drumLvGlobal,
  gDrLvl,
  getDescOrNull,
  isDrum,
  isDrumTrk,
  notify,
  report,
  rq,
  t,
  useApp,
} from '../../core/app.ts'
import type { Dev, ReadyDev } from '../../core/app.ts'
import { userSet } from '../../core/device.ts'
import { CMD, DRUM_LANES, LIVE, fmtValue, parse, req } from '../../lib/proto.ts'
import type { FmtDesc, LiveState } from '../../lib/proto.ts'
import { Card } from '../../ui/kit.tsx'
import { bar, dim } from '../../ui/styles.ts'

import { Hold, Knob, SyncSelect } from './controls.tsx'
import { LV, lvDrumNote, lvNoteOff, lvNoteOn, lvP } from './state.ts'
import { knobs, needs } from './styles.ts'

interface DpState {
  built: Dev | null
  timer: ReturnType<typeof setInterval> | 0
  s: LiveState | null
  pad: number
  local: Map<number, { tune: number; dec: number; t: number }>
  kits: string[] | null
}
const DP: DpState = {
  built: null,
  timer: 0,
  s: null,
  pad: 0,
  local: new Map(),
  kits: null,
} /* local: lane -> {tune, dec, t}: what the hand set */
const DP_HOLD = 1500 /* ms a pad's own value wins over what the FM-1 answers */
/* a state from the FM-1, with the pads just turned here kept as the hand set them (a reply to an older request, or
   the poll, never pulls a knob back while it moves) */
function drumPanelMerge(s: LiveState): LiveState {
  const now = performance.now()
  if (s && s.dtw)
    for (const [lane, v] of DP.local) {
      if (now - v.t < DP_HOLD) s.dtw[lane] = { tune: v.tune, dec: v.dec }
      else DP.local.delete(lane)
    }
  return s
}
async function drumPanelRead(): Promise<void> {
  const dev = A.dev
  if (!dev || !dev.info || dev.info.proto < 12) return
  if (
    DP.s &&
    (!dev.link.idle ||
      [...DP.local.values()].some((v) => performance.now() - v.t < DP_HOLD))
  )
    return /* (not while turning) */
  try {
    DP.s = drumPanelMerge(
      parse[CMD.LIVE](
        await rq(req.live(LIVE.STATE), {
          key: 'live:state',
          retries: 0,
          quiet: true,
        }),
      ),
    )
  } catch {
    return
  }
  notify()
}
async function drumPanelTw(lane: number): Promise<void> {
  const d = DP.s!.dtw![lane]
  notify()
  /* one request a pad in the queue (key): while one is on its way, the moves after it become the next one */
  try {
    DP.s = drumPanelMerge(
      parse[CMD.LIVE](
        await rq(req.live(LIVE.DRUM_TW, lane, d.tune + 8, d.dec + 4), {
          key: 'dtw:' + lane,
          front: true,
        }),
      ),
    )
  } catch (e) {
    report(e)
  }
  notify()
}
/* a pad heard: a MIDI note on the drum track's channel (as the LIVE page's pads) */
function drumHear(lane: number, on: boolean): void {
  const dev = A.dev!,
    tr = isDrumTrk(dev.sel) ? dev.sel! : drumFocus(),
    tok = 'dp:' + lane
  const km = LV.kmode
  LV.kmode = 'play' /* (always heard: not the LIVE page's roll / erase) */
  try {
    if (on) lvNoteOn(tok, tr, lvDrumNote(lane), 100)
    else lvNoteOff(tok)
  } finally {
    LV.kmode = km
  }
}
/* the kits' names: the KIT parameter's list (once per connection) */
async function drumPanelKits(dev: Dev): Promise<void> {
  const pe0 = dev.info!.pe0
  let d = dev.pdesc[pe0]
  if (!d || d.label !== 'KIT') d = await getDescOrNull(0, pe0).catch(() => null)
  if (dev !== A.dev) return
  if (d && d.names) {
    DP.kits = d.names
    notify()
  }
}

/* a row of the panel */
const row = 'my-2.5 flex flex-wrap items-center gap-x-6 gap-y-3'

const fmtOf =
  (d: FmtDesc) =>
  (v: number): string => {
    const [x, u] = fmtValue(d, v)
    return u && u !== '%' ? `${x} ${u}`.toLowerCase() : x + (u || '')
  }

export default function DrumPanel() {
  const { dev } = useApp()
  useEffect(() => {
    if (DP.built !== dev) {
      DP.built = dev
      DP.kits = null
      DP.s = null
      DP.local.clear()
      drumPanelKits(dev!)
    }
    if (!DP.timer)
      DP.timer = setInterval(() => {
        if (A.tab === 'sound' && A.dev && A.dev.dump && isDrum() && !A.busy)
          drumPanelRead()
      }, 1500)
    drumPanelRead()
    return (): void => {
      clearInterval(DP.timer)
      DP.timer = 0
    }
  }, [dev])
  if (!dev || !dev.dump) return null
  const rd = dev as ReadyDev
  const pe0 = rd.info.pe0
  const knob = (
    lbl: string,
    s: number,
    id: number,
    d0?: FmtDesc & { def: number },
  ): ReactNode => {
    const d =
      d0 ||
      (s ? rd.gdesc[id] : rd.pdesc[id]) ||
      ({ min: 0, max: 127, def: 0 } as FmtDesc & { def: number })
    return (
      <Knob
        key={lbl + id}
        label={lbl}
        o={{
          min: d.min,
          max: d.max,
          def: d.def,
          bip: d.min < 0,
          get: () => (s ? rd.dump.g[id] : rd.dump.p[id]) ?? 0,
          set: (v, f) => userSet(s, id, v, f!),
          fmt: fmtOf(d),
        }}
      />
    )
  }
  const kits = DP.kits || []
  const step = (d: number): void => {
    const n = kits.length || 1
    userSet(0, pe0, ((rd.dump.p[pe0] ?? 0) + d + n) % n, true)
  }
  const gl = drumLvGlobal()
    ? 1
    : 0 /* (BoopBox: the drum track's own level and sends) */
  const itd = dev.pdesc[53]
  const pro = !!(DP.s && DP.s.pro)
  return (
    <Card
      id="drumpanel"
      className="[--c:var(--t4)]"
      title="DRUMS"
      ic="symbol_drum"
    >
      <p className={dim}>{t('dpHelp')}</p>
      <div className={row}>
        <label className="min-w-[220px]">
          <span>{t('lvKit')}</span>
          <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-0.5">
            <button
              type="button"
              aria-label="previous"
              onClick={() => step(-1)}
            >
              ‹
            </button>
            <SyncSelect
              aria-label={t('lvKit')}
              value={dev.dump.p[pe0] ?? 0}
              onChange={(e) => userSet(0, pe0, +e.target.value, true)}
            >
              {kits.map((n, k) => (
                <option key={k} value={String(k)}>
                  {n}
                </option>
              ))}
            </SyncSelect>
            <button type="button" aria-label="next" onClick={() => step(1)}>
              ›
            </button>
          </span>
        </label>
        <div className={knobs}>
          {knob(t('lvLevel'), gl, gl ? gDrLvl() : P.LEVEL)}
          {knob(t('lvPan'), 0, 39)}
          {knob(t('lvFilter'), 0, 50)}
          {knob(t('lvRev'), gl, gl ? 26 : lvP('REV', 36))}
          {knob(t('lvDly'), gl, gl ? 32 : lvP('DLY', 35))}
        </div>
      </div>
      <div className={row}>
        <label className="min-w-[220px]">
          <span>insert</span>
          <SyncSelect
            aria-label="INSERT"
            value={dev.dump.p[53] ?? 0}
            onChange={(e) => userSet(0, 53, +e.target.value, true)}
          >
            {((itd && itd.names) || ['OFF']).map((n, k) => (
              <option key={k} value={String(k)}>
                {n}
              </option>
            ))}
          </SyncSelect>
        </label>
        <div className={knobs}>
          {[54, 55, 56, 57].map(async (id) =>
            knob((dev.pdesc[id] || { label: '' }).label.toLowerCase(), 0, id),
          )}
        </div>
      </div>
      <h3>{t('dpPads')}</h3>
      {pro ? null : (
        <p className={clsx(needs, 'mx-0 mt-0 mb-3 py-2')}>{t('dpNeeds')}</p>
      )}
      {/* the 16 pads: a tap plays it; TUNE and DECAY as on the FM-1 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
        {DRUM_LANES.map(([, name], lane) => {
          const tw = (
            k: 'tune' | 'dec',
            lbl: string,
            min: number,
            max: number,
          ) => (
            <Knob
              look="pad"
              className={pro ? '' : 'pointer-events-none opacity-35'}
              label={t(lbl)}
              o={{
                min,
                max,
                def: 0,
                bip: true,
                get: () => (DP.s && DP.s.dtw ? DP.s.dtw[lane][k] : 0),
                set: (v) => {
                  if (!DP.s || !DP.s.dtw) return
                  const d = DP.s.dtw[lane]
                  if (d[k] === v) return
                  d[k] = v
                  DP.local.set(lane, {
                    tune: d.tune,
                    dec: d.dec,
                    t: performance.now(),
                  })
                  drumPanelTw(lane)
                },
                fmt: (v) => (v > 0 ? '+' + v : String(v)),
              }}
            />
          )
          const tweaked = pro && (DP.s!.dtw![lane].tune || DP.s!.dtw![lane].dec)
          return (
            <div
              key={lane}
              className={clsx(
                'grid gap-1 border p-1.5',
                tweaked ? 'border-t4' : 'border-s3',
              )}
            >
              <Hold
                lit={'dp:' + lane}
                className="data-on:bg-t4 touch-none text-left normal-case data-on:text-black"
                title={t('dpHear')}
                down={() => drumHear(lane, true)}
                up={() => drumHear(lane, false)}
              >
                {name}
              </Hold>
              <div className="flex justify-around">
                {tw('tune', 'lvxTune', -8, 7)}
                {tw('dec', 'lvxDecay', -4, 3)}
              </div>
            </div>
          )
        })}
      </div>
      <p className={bar}>
        <button
          type="button"
          disabled={!pro}
          onClick={async () => {
            if (!DP.s || !DP.s.dtw || !confirm(t('dpResetAsk'))) return
            for (let l = 0; l < 16; l++) {
              DP.s.dtw[l] = { tune: 0, dec: 0 }
              DP.local.set(l, { tune: 0, dec: 0, t: performance.now() })
              await drumPanelTw(l)
            }
          }}
        >
          {t('dpReset')}
        </button>
        <span className={dim}>{' ' + t('dpPadsHelp')}</span>
      </p>
    </Card>
  )
}
