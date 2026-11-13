// SPDX-License-Identifier: GPL-3.0-only
/* ---- the punch-in effects (hold, or LATCH; in four groups) and the master fx (filter, dust, duck; the master level and
   the THROWs) */
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import { notify, readyDev, t, useApp } from '../../core/app.ts'
import { LIVE } from '../../lib/proto.ts'
import { dim, tog } from '../../ui/styles.ts'

import { Hold, Knob } from './controls.tsx'
import { LvCard } from './Guide.tsx'
import {
  LV,
  LVG,
  LV_FX_GROUPS,
  LV_KEYS,
  lvFx,
  lvGlobal,
  lvGv,
  lvOk,
  lvSend,
} from './state.ts'
import { dis, hov, xpro } from './styles.ts'

export function Effects() {
  useApp()
  const cur = LV.s ? LV.s.fx : -1,
    ok = lvOk()
  return (
    <LvCard
      k="fx"
      title={t('lvFx')}
      head={
        <button
          type="button"
          className={tog}
          data-lvm="latch"
          aria-pressed={LV.latch}
          onClick={() => {
            LV.latch = !LV.latch
            if (!LV.latch && LV.fxHeld >= 0) lvFx(LV.fxHeld, false)
            notify()
          }}
        >
          {t('lvLatch')}
        </button>
      }
    >
      {LV_FX_GROUPS.map(([k, list], gi) => (
        <div key={k} className={gi ? 'mt-1' : undefined}>
          <span className={clsx(dim, 'block leading-4 lowercase')}>{t(k)}</span>
          <div className="grid grid-cols-6 gap-[3px]">
            {list.map((fx) => (
              <Hold
                key={fx}
                lit={'fx:' + fx}
                data-lvm={'fx:' + fx}
                disabled={!ok}
                title={
                  ok
                    ? fx < 16
                      ? `${LIVE.FX_NAMES[fx]} (Shift + ${LV_KEYS[fx].toUpperCase()})`
                      : LIVE.FX_NAMES[fx]
                    : t('lvNeeds')
                }
                className={clsx(
                  'relative flex h-[26px] items-center justify-center overflow-hidden border p-0 text-left whitespace-nowrap normal-case',
                  LV.lit.has('fx:' + fx) || fx === cur
                    ? 'border-t4 bg-t4 text-black'
                    : clsx('border-s3 bg-bg text-fg', hov, dis),
                )}
                down={() => {
                  if (LV.latch) lvFx(fx, LV.fxHeld !== fx)
                  else lvFx(fx, true)
                }}
                up={() => {
                  if (!LV.latch) lvFx(fx, false)
                }}
              >
                <b className="font-normal">{LIVE.FX_NAMES[fx]}</b>
              </Hold>
            ))}
          </div>
        </div>
      ))}
    </LvCard>
  )
}

export function Master() {
  useApp()
  const dev = readyDev()
  const g = LVG(),
    s = LV.s
  const mk = (lbl: string, id: number, bip?: boolean): ReactNode => {
    const d = dev.gdesc[id] || {
      min: bip ? -64 : 0,
      max: bip ? 63 : 127,
      def: 0,
    }
    return (
      <Knob
        look="row"
        label={lbl}
        o={{
          min: d.min,
          max: d.max,
          def: d.def,
          bip,
          get: () => lvGv(id),
          set: (v, f) => lvGlobal(id, v, f),
          mid: 'g:' + id,
        }}
      />
    )
  }
  /* (2.7) the master level from here (the MASTER knob takes it back when turned) and the THROWs (as FX + OCT- / OCT+) */
  const thr = (bit: number, lbl: string) => (
    <Hold
      lit={'throw:' + bit}
      data-lvm={'throw:' + bit}
      className={clsx(
        'border-t1 border px-1.5 py-0.5',
        LV.lit.has('throw:' + bit) || (s && ((s.throws ?? 0) >> (bit - 1)) & 1)
          ? 'bg-t1 text-black'
          : clsx('text-t1 bg-bg', hov),
      )}
      down={() => {
        LV.thr = (LV.thr || 0) | bit
        lvSend(LIVE.THROW, LV.thr)
      }}
      up={() => {
        LV.thr = (LV.thr || 0) & ~bit
        lvSend(LIVE.THROW, LV.thr)
      }}
    >
      {t(lbl)}
    </Hold>
  )
  return (
    <LvCard k="master" title={t('lvMaster')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {mk(t('lvFilter'), g.filt, true)}
        {mk(t('lvDust'), g.dust)}
        {mk(t('lvDuck'), g.duck)}
        <span className={clsx(xpro, 'flex items-center gap-2')}>
          <Knob
            look="row"
            label={t('lvxVolume')}
            o={{
              min: 0,
              max: 126,
              def: 100,
              mid: 'master',
              get: () =>
                LV.volAt && performance.now() - LV.volAt < 1500
                  ? LV.vol!
                  : LV.s && LV.s.master! >= 0
                    ? LV.s.master!
                    : (LV.vol ?? 100),
              set: (v) => {
                LV.vol = v
                LV.volAt = performance.now()
                lvSend(LIVE.MASTER, v)
              },
              fmt: (v) => (LV.s && LV.s.master! < 0 ? t('lvxKnob') : String(v)),
            }}
          />
          <span className="flex gap-[3px]">
            <button
              type="button"
              className={clsx(tog, 'px-1.5 py-0.5')}
              data-lvm="master:knob"
              aria-pressed={!!(s && s.master! < 0)}
              onClick={async () => lvSend(LIVE.MASTER, 127)}
            >
              {t('lvxKnob')}
            </button>
            {thr(1, 'lvxThrowRev')}
            {thr(2, 'lvxThrowEcho')}
          </span>
        </span>
      </div>
    </LvCard>
  )
}
