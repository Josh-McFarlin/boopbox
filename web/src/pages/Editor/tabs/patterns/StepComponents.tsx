// SPDX-License-Identifier: GPL-3.0-only
// The step components of one step (BoopBox): the components of that step of the selected track's pattern playing, in
// the Patterns page's working copy (pages/patterns/state.js), with add / remove and their own Send. Made for the
// Sequencer's step inspector: <StepComponents step={k} /> (k: 0..63; optional trk, pat to show another).
import clsx from 'clsx'
import type { ReactNode } from 'react'

import { A, notify, op, t, tf, useApp } from '../../core/app.ts'
import { PROJ7, lockable } from '../../lib/proto.ts'
import type { P7Comp } from '../../lib/proto.ts'
import { pri } from '../../ui/styles.ts'
import { Num } from '../song/Num.tsx'

import {
  PT,
  ptCtx,
  ptDirty,
  ptDrum,
  ptEdit,
  ptOk,
  ptOwn,
  ptParamName,
  ptTidy,
  readPatterns,
  sendComps,
} from './state.ts'
import { Sel } from './ui.tsx'

const newComp = (ty: number, pe0: number): Omit<P7Comp, 'step'> => {
  const r = PROJ7.CP[ty]!
  return {
    type: ty,
    a: ty === PROJ7.CP_PARAM ? PROJ7.codeOf(r[5], pe0) : r[5],
    b: r[6],
  }
}

export interface StepComponentsProps {
  step: number
  trk?: number | null
  pat?: number | null
}
export function StepComponents({
  step,
  trk: trkIn,
  pat: patIn,
}: StepComponentsProps) {
  const { dev, busy } = useApp()
  if (!dev || !dev.info || !ptOk()) return null
  if (!PT.P) {
    return (
      <div id="stepcomps" className="flex flex-wrap items-center gap-2">
        <span className="text-dim">{t('cpNotRead')}</span>
        <button
          type="button"
          disabled={!!busy}
          title={busy ? t('whyBusy') : ''}
          onClick={async () =>
            op(async () => {
              PT.dev = A.dev
              await readPatterns()
            })
          }
        >
          {t('cpReadNow')}
        </button>
      </div>
    )
  }
  const P = PT.P,
    ctx = ptCtx(),
    pe0 = dev.info.pe0
  const trk =
    trkIn != null ? trkIn : PROJ7.track(P, dev.sel!) ? dev.sel! : PT.trk
  const tr = PROJ7.track(P, trk)
  if (!tr) return null
  const pat = patIn != null ? patIn : tr.cur
  const pv = PROJ7.patOf(P, trk, pat) || PROJ7.emptyPat(ptDrum(trk))
  const params = [...Array(pe0 + 8).keys()].filter((id) => lockable(id, pe0))
  const types = PROJ7.CP.map((r, i) =>
    r ? (
      <option key={i} value={i}>
        {r[0]}
      </option>
    ) : null,
  ).filter(Boolean)
  const seen = new Set<string>(),
    rows: [P7Comp, number, boolean][] = []
  pv.comps.forEach((c, k) => {
    const dup = seen.has(c.step + ':' + c.type)
    seen.add(c.step + ':' + c.type)
    if (c.step === step) rows.push([c, k, dup])
  })
  const addType = PT.addType || 10,
    full = pv.comps.length >= PROJ7.NCOMP,
    has = rows.some(([c]) => c.type === addType)
  const dirty = ptDirty()
  const own = () => ptOwn(P, trk, pat, ctx)
  return (
    <div id="stepcomps" data-step={step}>
      <div className="mb-1.5 text-dim">
        {tf('cpOf', { s: step + 1, t: trk + 1, n: pat + 1 })}
      </div>
      {rows.length ? (
        <table
          id="patcomps"
          className="mb-2 [&_input[type=number]]:w-16 [&_select]:max-w-[150px] [&_td]:py-0.5 [&_td]:pr-2 [&_th]:pr-2 [&_th]:text-left"
        >
          <thead>
            <tr>
              <th>{t('cpType')}</th>
              <th>A</th>
              <th>B</th>
              <th>{t('cpWhat')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(([c, k, dup]) => {
              const R = PROJ7.CP[c.type] || ['?', 0, 0, 0, 0]
              const set = (f: (c: P7Comp) => void): void =>
                ptEdit(() => {
                  f(own().comps[k])
                })
              const num = (
                v: number,
                lo: number,
                hi: number,
                f: (c: P7Comp, v: number) => void,
              ): ReactNode => (
                <Num
                  v={v}
                  min={lo}
                  max={hi}
                  disabled={lo === hi}
                  title={lo === hi ? t('cpNoValue') : ''}
                  onCommit={(x) =>
                    set((y) =>
                      f(y, Math.max(lo, Math.min(hi, Math.round(x) || 0))),
                    )
                  }
                />
              )
              const ok = PROJ7.compValid(c, pe0) && !dup
              return (
                <tr key={k} className={ok ? '' : '[&_td]:text-red'}>
                  <td>
                    <Sel
                      v={c.type}
                      aria-label={t('cpType')}
                      onPick={(v) =>
                        set((x) => Object.assign(x, newComp(v, pe0)))
                      }
                    >
                      {types}
                    </Sel>
                  </td>
                  <td>
                    {c.type === PROJ7.CP_PARAM ? (
                      <Sel
                        v={PROJ7.idOf(c.a, pe0)}
                        aria-label="A"
                        onPick={(v) =>
                          set((x) => {
                            x.a = PROJ7.codeOf(v, pe0)
                          })
                        }
                      >
                        {params.map((id) => (
                          <option key={id} value={id}>
                            {ptParamName(id)}
                          </option>
                        ))}
                      </Sel>
                    ) : (
                      num(c.a, R[1], R[2], (x, v) => {
                        x.a = c.type === 13 && !v ? 1 : v
                      })
                    )}
                  </td>
                  <td>
                    {num(c.b, R[3], R[4], (x, v) => {
                      x.b = v
                    })}
                  </td>
                  <td className="text-dim">
                    {ok ? t('cpH' + c.type) : t(dup ? 'cpDup' : 'cpBad')}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="px-1.5 py-0"
                      title={t('cpRemove')}
                      aria-label={t('cpRemove')}
                      onClick={() =>
                        ptEdit(() => {
                          own().comps.splice(k, 1)
                          ptTidy(P, trk, pat, ctx)
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="mb-2 text-dim">{t('cpNone')}</div>
      )}
      <div className="flex flex-wrap items-center gap-2" id="patcadd">
        <Sel
          v={addType}
          aria-label={t('cpType')}
          title={t('cpH' + addType)}
          onPick={(v) => {
            PT.addType = v
            notify()
          }}
        >
          {types}
        </Sel>
        <button
          type="button"
          disabled={full || has}
          title={
            full
              ? tf('cpFull', { max: PROJ7.NCOMP })
              : has
                ? t('cpHas')
                : t('cpH' + addType)
          }
          onClick={() =>
            ptEdit(() => {
              own().comps.push({ step, ...newComp(addType, pe0) })
            })
          }
        >
          {t('cpAddOne')}
        </button>
        <span className="text-dim">
          {tf('cpCount', { n: pv.comps.length, max: PROJ7.NCOMP })}
        </span>
        <button
          type="button"
          id="cpsend"
          className={clsx(pri, 'ml-auto')}
          disabled={!dirty || !!busy}
          title={
            busy ? t('whyBusy') : !dirty ? t('whyNothing') : t('cpSendHint')
          }
          onClick={async () =>
            op(async () =>
              sendComps(trk, pat, () => confirm(t('cpOtherUnsent'))),
            )
          }
        >
          {t('cpSend')}
        </button>
      </div>
    </div>
  )
}
export default StepComponents
