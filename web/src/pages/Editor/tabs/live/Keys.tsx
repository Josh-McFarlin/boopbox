// SPDX-License-Identifier: GPL-3.0-only
/* ---- the keys: a drawer fixed at the bottom of the window. Closed: a slim bar (the track the keys play, its octave or
   the drums' level, what the keys do); open: over the page, two octaves and a C (the drum track: 16 pads), the
   velocity, the arp and HOLD, the roll rate. The computer keyboard plays them open or closed (Live.jsx lvKeyDown) */
import { clsx } from 'clsx'
import type { CSSProperties } from 'react'

import { notify, readyDev, t, tcol, useApp } from '../../core/app.ts'
import { DRUM_LANES } from '../../lib/proto.ts'
import { bad, dim, seg, tog } from '../../ui/styles.ts'

import { Ctl, Hold, SyncSelect } from './controls.tsx'
import { LvCard } from './Guide.tsx'
import { LVS } from './pro.ts'
import type { KMode } from './state.ts'
import {
  LV,
  LVP,
  LV_KEYS,
  LV_VEL,
  lvAllOff,
  lvChan,
  lvDrum,
  lvDrumNote,
  lvNoteOff,
  lvNoteOn,
  lvNum,
  lvParam,
  lvPro,
  lvTarget,
} from './state.ts'
import { grp, kbd, xpro } from './styles.ts'

/* two octaves and a C: 15 white keys, the black ones over them */
interface PKey {
  semi: number
  x: number
}
const WHITES: PKey[] = [],
  BLACKS: PKey[] = []
{
  const W = [0, 2, 4, 5, 7, 9, 11],
    B = [
      [1, 0],
      [3, 1],
      [6, 3],
      [8, 4],
      [10, 5],
    ]
  for (let o = 0; o < 2; o++) {
    W.forEach((s, k) => WHITES.push({ semi: o * 12 + s, x: o * 7 + k }))
    B.forEach(([s, k]) => BLACKS.push({ semi: o * 12 + s, x: o * 7 + k }))
  }
  WHITES.push({ semi: 24, x: 14 })
}
/* (the keys' mode: ROLL / ERASE marks them) */
const modeMark = (): string | false =>
  LV.kmode === 'roll'
    ? 'shadow-[inset_0_-4px_var(--t3)]'
    : LV.kmode === 'erase' && 'shadow-[inset_0_-4px_var(--red)]'
interface PianoKeyProps {
  k: PKey
  black: boolean
}
function PianoKey({ k, black }: PianoKeyProps) {
  const tok = 'lvk:' + k.semi,
    ki = k.semi < 16 ? LV_KEYS[k.semi] : null
  const on = LV.lit.has('k:' + k.semi)
  return (
    <Hold
      lit={'k:' + k.semi}
      style={{ '--x': k.x } as CSSProperties}
      data-semi={k.semi}
      className={
        black
          ? clsx(
              'border-s3 absolute top-0 z-1 flex h-[90px] w-[calc(100%/15*.62)] items-end justify-center border px-0 pt-0 pb-1.5',
              'left-[calc((var(--x)_+_1)_*_100%_/_15_-_100%_/_15_*_.31)]',
              on
                ? 'bg-trk text-black'
                : 'hover:enabled:bg-s2 bg-black text-dim',
            )
          : clsx(
              'flex h-[150px] items-end justify-center border-0 border-b-4 border-b-dim px-0 pt-0 pb-2',
              modeMark(),
              on ? 'bg-trk text-black' : 'bg-fg2 text-s3 hover:enabled:bg-fg',
            )
      }
      down={() =>
        lvNoteOn(
          tok,
          LV.target,
          (LV.oct + 1) * 12 + k.semi,
          LV.vel,
          'k:' + k.semi,
        )
      }
      up={() => lvNoteOff(tok)}
    >
      {ki ? <kbd className={kbd}>{ki.toUpperCase()}</kbd> : null}
    </Hold>
  )
}

const KMODES: KMode[] = ['play', 'roll', 'erase']
const oct = (d: number): void => {
  LV.oct = Math.max(1, Math.min(7, LV.oct + d))
  notify()
}

/* what stays in the slim bar (its buttons: bb) */
const bb = 'px-2 py-0.5'
function Bar() {
  useApp()
  const dev = readyDev()
  const n = dev.info.ntrk || 4,
    drum = lvDrum(LV.target),
    open = !!LV.ui.keys
  const lvls = t('lvLvl')
  return (
    <div className="flex min-h-11 items-center gap-4 px-8 py-1.5">
      <button
        type="button"
        className={clsx(tog, 'px-3.5 py-1')}
        aria-expanded={open}
        aria-pressed={open}
        title={t(open ? 'lvxKeysClose' : 'lvxKeysOpen')}
        onClick={() => {
          LV.ui.keys = !open
          notify()
        }}
      >
        {t('lvxKeysBar') + (open ? ' ▼' : ' ▲')}
      </button>
      <span className={grp}>
        <span className={dim}>{t('lvTrack')}</span>
        <span className={seg}>
          {Array.from({ length: n }, (_, i) => (
            <button
              key={i}
              type="button"
              className={clsx(
                bb,
                'bg-s2 text-c aria-pressed:bg-c min-w-8 aria-pressed:text-black',
              )}
              style={{ '--c': tcol(i) } as CSSProperties}
              aria-pressed={i === LV.target}
              onClick={async () => lvTarget(i)}
            >
              {lvNum(i)}
            </button>
          ))}
        </span>
      </span>
      {drum ? (
        <span className={clsx(seg, 'items-center')}>
          {LV_VEL.map((_, k) => (
            <button
              key={k}
              type="button"
              className={clsx(tog, bb)}
              aria-pressed={k === LV.dlv}
              onClick={() => {
                LV.dlv = k
                notify()
              }}
            >
              {Array.isArray(lvls) ? lvls[k] : k}
            </button>
          ))}
        </span>
      ) : (
        <span className={grp}>
          <span className={dim}>{t('lvOct')}</span>
          <button
            type="button"
            className={bb}
            aria-label={t('lvOct') + ' −'}
            title="Z"
            onClick={() => oct(-1)}
          >
            −
          </button>
          <span className="min-w-[8ch] text-center text-fg">{`C${LV.oct}–C${LV.oct + 2}`}</span>
          <button
            type="button"
            className={bb}
            aria-label={t('lvOct') + ' +'}
            title="X"
            onClick={() => oct(1)}
          >
            +
          </button>
        </span>
      )}
      {/* (2.7) what the keys do: play, ROLL (note repeat while held, as ARP + key) or ERASE (as EDIT + key) */}
      <span className={clsx(grp, xpro)}>
        <span className={seg}>
          {KMODES.map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(tog, bb)}
              data-lvm={'kmode:' + m}
              aria-pressed={m === LV.kmode}
              onClick={() => {
                lvAllOff()
                LV.kmode = m
                notify()
              }}
            >
              {t('lvxK_' + m)}
            </button>
          ))}
        </span>
      </span>
    </div>
  )
}

function Panel() {
  useApp()
  const dev = readyDev()
  const drum = lvDrum(LV.target),
    o = LV.tr[LV.target] || { p: [] },
    P = LVP()
  const md = dev.pdesc[P.mode]
  const c = lvChan(LV.target)
  return (
    <LvCard
      k="keys"
      className="border-t-c border-t-3"
      style={{ '--c': tcol(LV.target) } as CSSProperties}
      title={t('lvKeys')}
      head={
        <>
          {drum ? null : (
            <>
              <label className={grp} data-grp="">
                <span className={dim}>{t('lvVel')}</span>
                <input
                  type="range"
                  min="1"
                  max="127"
                  value={LV.vel}
                  aria-label={t('lvVel')}
                  className="w-[120px]"
                  style={
                    {
                      '--p': ((LV.vel / 127) * 100).toFixed(1) + '%',
                    } as CSSProperties
                  }
                  onChange={(e) => {
                    LV.vel = +e.target.value
                    notify()
                  }}
                />
                <span className="min-w-[3ch] text-fg">{LV.vel}</span>
              </label>
              <label className={grp} data-grp="">
                <span className={dim}>{t('lvArp')}</span>
                <SyncSelect
                  aria-label={t('lvArp')}
                  value={o.p[P.mode] ?? 0}
                  onChange={async (e) =>
                    lvParam(LV.target, P.mode, +e.target.value)
                  }
                >
                  {(md && md.names ? md.names : []).map((x, k) => (
                    <option key={k} value={String(k)}>
                      {x}
                    </option>
                  ))}
                </SyncSelect>
              </label>
              <button
                type="button"
                className={tog}
                aria-pressed={!!o.p[P.hold]}
                title={t('lvxTip_hold')}
                onClick={async () =>
                  lvParam(LV.target, P.hold, LV.tr[LV.target].p[P.hold] ? 0 : 1)
                }
              >
                {t('lvHold')}
              </button>
            </>
          )}
          {LV.kmode === 'roll' && dev.gdesc[30] ? (
            <span className={xpro}>
              <Ctl
                scope={1}
                id={30}
                tr={LV.target}
                d={dev.gdesc[30]}
                lbl={t('lvxRollRate')}
                look="rowSm"
              />
            </span>
          ) : null}
        </>
      }
    >
      {c.err && !(LV.kmode !== 'play' && lvPro()) ? (
        <p className={clsx(bad, 'mx-0 mt-0 mb-2')}>{t(c.err)}</p>
      ) : null}
      {drum ? (
        <div className="grid grid-cols-8 gap-1.5">
          {DRUM_LANES.map(([, name], lane) => {
            const tok = 'lvp:' + lane,
              on = LV.lit.has('p:' + lane)
            return (
              <Hold
                key={lane}
                lit={'p:' + lane}
                data-lvm={'pad:' + lane}
                className={clsx(
                  'flex h-16 flex-col items-start justify-between border px-2 py-1.5 normal-case',
                  modeMark(),
                  on
                    ? 'border-trk bg-trk text-black'
                    : 'border-s3 hover:enabled:bg-s3 bg-bg text-fg',
                )}
                down={() =>
                  lvNoteOn(
                    tok,
                    LV.target,
                    lvDrumNote(lane),
                    LV_VEL[LV.dlv],
                    'p:' + lane,
                  )
                }
                up={() => lvNoteOff(tok)}
              >
                <b className="font-normal">{name}</b>
                <kbd className={clsx(kbd, on ? 'text-black' : 'text-dim')}>
                  {LV_KEYS[lane].toUpperCase()}
                </kbd>
              </Hold>
            )
          })}
        </div>
      ) : (
        <div className="relative grid h-[150px] touch-none grid-cols-15 gap-0.5">
          {WHITES.map((k) => (
            <PianoKey key={'w' + k.semi} k={k} black={false} />
          ))}
          {BLACKS.map((k) => (
            <PianoKey key={'b' + k.semi} k={k} black />
          ))}
        </div>
      )}
    </LvCard>
  )
}

export default function Keys() {
  useApp()
  const open = !!LV.ui.keys
  return (
    <div
      className={clsx(
        'fixed right-0 bottom-0 left-[200px] z-20 border-t border-line bg-bg shadow-[0_-8px_24px_rgb(0_0_0/.35)] in-[html.lvfocus]:left-0',
        LVS.lock && 'pointer-events-none',
      )}
      style={{ '--trk': tcol(LV.target) } as CSSProperties}
    >
      {/* (closed: the panel stays in the page, hidden, so the learned pads still play) */}
      <div
        className="max-h-[70vh] overflow-y-auto px-8 pt-2 pb-0"
        hidden={!open}
      >
        <Panel />
      </div>
      <Bar />
    </div>
  )
}
