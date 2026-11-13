// SPDX-License-Identifier: GPL-3.0-only
/* ---- the mixer (THE mixer of the editor): a narrow strip per track, all the same height: its number (a red dot: armed
   for recording on the FM-1), its sound (‹ › and ☆), its level fader and meter, mute, solo, "play" (the keys play it).
   Its pan, filter, sends and drive are in the strip's "more" panel (always in the page, hidden, so MIDI learn still
   finds them) */
import { clsx } from 'clsx'
import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import {
  A,
  drumLvGlobal,
  gDrLvl,
  notify,
  readyDev,
  t,
  tcol,
  useApp,
} from '../../core/app.ts'
import { showTab } from '../../core/tabs.ts'
import { dim } from '../../ui/styles.ts'

import { Fader, Knob, SyncSelect } from './controls.tsx'
import { LvCard } from './Guide.tsx'
import { LVS, lvxFav, lvxFavKey, lvxUser } from './pro.ts'
import {
  LV,
  LVG,
  LVP,
  lvDrum,
  lvDrumLv,
  lvGlobal,
  lvGv,
  lvLevel,
  lvMute,
  lvNum,
  lvOk,
  lvParam,
  lvSolo,
  lvSound,
  lvStep,
  lvTarget,
} from './state.ts'
import type { LvTrack } from './state.ts'

const num = 'relative flex-none bg-c px-1 leading-5 text-black'
const favCls = 'w-4 flex-none border-0 bg-transparent p-0 text-t3'

/* the option groups before the engines' presets: the favourites, the USER presets */
function SoundOptions() {
  useApp()
  const dev = readyDev()
  const favs = [...LVS.favs]
    .map((k) => k.split(':').map(Number))
    .filter(([e, p]) => dev.names[e] && dev.names[e][p] != null)
  const us = dev.bank ? dev.bank.slots.filter((s) => s.used) : []
  return (
    <>
      {favs.length ? (
        <optgroup label={'★ ' + t('lvxFavs')}>
          {favs.map(([e, p]) => (
            <option key={`${e}:${p}`} value={`${e}:${p}`}>
              {'★ ' + dev.names[e][p]}
            </option>
          ))}
        </optgroup>
      ) : null}
      {us.length ? (
        <optgroup label="USER">
          {us.map((s) => (
            <option
              key={s.slot}
              value={`u:${s.slot}`}
            >{`U${String(s.slot + 1).padStart(2, '0')} ${s.name}`}</option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
}

/* the strip's "more" panel: one open at a time (LV.ui.more), closed by a click elsewhere or Esc */
function useMoreClose(open: boolean): void {
  useEffect(() => {
    if (!open) return undefined
    const away = (e: PointerEvent): void => {
      const el = e.target as Element
      if (!el.closest || !el.closest('[data-lsmore]')) {
        LV.ui.more = -1
        notify()
      }
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        LV.ui.more = -1
        notify()
      }
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return (): void => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
}

/* a strip's buttons: mute (red), solo (white), play (its colour) */
const sBtn = 'h-[26px] bg-s2 px-0.5 py-0 text-dim aria-pressed:text-black'

interface StripProps {
  i: number
  n: number
}
interface KnobD {
  min: number
  max: number
  def: number
}
function Strip({ i, n }: StripProps) {
  useApp()
  const dev = readyDev()
  const drum = lvDrum(i),
    P = LVP(),
    g = LVG()
  const tr = (): LvTrack => LV.tr[i] || { p: [] }
  const o = tr()
  const pd = (id: number, d: KnobD): KnobD => dev.pdesc[id] || d
  const lvD = (lvDrumLv(i) ? dev.gdesc[gDrLvl()] : dev.pdesc[0]) || {
    min: 0,
    max: 127,
    def: 100,
  }
  const kn = (
    lbl: string,
    id: number,
    bip?: boolean,
    glob?: boolean,
  ): ReactNode => {
    const d: KnobD = glob
      ? dev.gdesc[id] || { min: 0, max: 127, def: 0 }
      : pd(id, { min: bip ? -64 : 0, max: bip ? 63 : 127, def: 0 })
    return (
      <Knob
        key={lbl}
        look="cell"
        label={lbl}
        o={{
          min: d.min,
          max: d.max,
          def: d.def,
          bip,
          get: () => (glob ? lvGv(id) : (tr().p[id] ?? 0)),
          set: async (v, f) => (glob ? lvGlobal(id, v, f) : lvParam(i, id, v)),
          mid: glob ? `g:${id}` : `s${i}:${id}`,
        }}
      />
    )
  }
  const knobs =
    drum && drumLvGlobal()
      ? [
          kn(t('lsPan'), P.pan, true),
          kn(t('lsFilt'), P.filt, true),
          kn(t('lsRev'), g.drRev, false, true),
          kn(t('lsDly'), g.drDly, false, true),
        ]
      : drum
        ? [
            kn(t('lsPan'), P.pan, true),
            kn(t('lsFilt'), P.filt, true),
            kn(t('lsRev'), P.rev),
            kn(t('lsDly'), P.dly),
          ]
        : [
            kn(t('lsPan'), P.pan, true),
            kn(t('lsFilt'), P.filt, true),
            kn(t('lsRev'), P.rev),
            kn(t('lsDly'), P.dly),
            kn(t('lsCho'), P.cho),
            kn(t('lsDrv'), P.dst),
          ]
  const eng = drum
    ? 'drums'
    : String(dev.info.engines[o.engine!] || '').toLowerCase()
  const nm = drum
    ? (LV.kitNames || [])[o.p[dev.info.pe0]] || 'DRUMS'
    : (dev.names[o.engine!] || [])[o.preset!] || ''
  const muted = !!o.mute,
    solo = !!((LV.solo >> i) & 1),
    target = LV.target === i
  const fav = !drum && LVS.favs.has(lvxFavKey(o.engine, o.preset))
  const s = LV.s && LV.s.tracks[i],
    playing = !!(LV.s && LV.s.playing)
  const mx = dev.mix && dev.mix.tracks[i]
  const armed = !!(
    (mx && mx.armed) ||
    (LV.s && (LV.s.rec >> i) & 1)
  ) /* (REC armed on the FM-1's TRACKS page, or recording here) */
  const want = drum ? String(o.p[dev.info.pe0] ?? 0) : `${o.engine}:${o.preset}`
  const more = LV.ui.more === i
  return (
    <div
      className={clsx(
        'relative flex min-w-0 flex-col gap-1 border border-t-3 bg-bg p-1',
        target ? 'border-c' : 'border-t-c border-line',
      )}
      style={{ '--c': tcol(i) } as CSSProperties}
      role="group"
      aria-label={`${t('lvTrack')} ${i + 1}`}
    >
      <div className="flex h-5 min-w-0 items-center gap-1">
        <span
          className={num}
          title={armed ? t('lvxArmed') : `${t('lvTrack')} ${i + 1}`}
        >
          {lvNum(i)}
          {armed ? (
            <i
              className="absolute -top-[5px] -right-[5px] size-2.5 rounded-full border-2 border-bg bg-red"
              aria-label={t('lvxArmed')}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-dim" />
        {drum ? (
          <span className={favCls} aria-hidden="true" />
        ) : (
          <button
            type="button"
            className={favCls}
            title={t('lvxTip_fav')}
            aria-label={t('lvxFavToggle')}
            aria-pressed={fav}
            onClick={() => lvxFav(i)}
          >
            {fav ? '★' : '☆'}
          </button>
        )}
      </div>
      {/* the sound picker: the engine's presets (any engine: grouped), the drum track: the kits */}
      <SyncSelect
        className="w-full min-w-0 [background-position:right_1px_center] py-0.5 pr-3 pl-1 text-fg"
        aria-label={t(drum ? 'lvKit' : 'lvSound')}
        title={`${eng} · ${nm}`}
        value={want}
        onChange={(e) => {
          const v = e.target.value
          if (drum) lvParam(i, dev.info.pe0, +v)
          else if (v.startsWith('u:')) lvxUser(i, +v.slice(2))
          else {
            const [en, p] = v.split(':').map(Number)
            lvSound(i, en, p)
          }
        }}
      >
        {drum ? (
          (LV.kitNames || []).map((x, k) => (
            <option key={k} value={String(k)}>
              {x}
            </option>
          ))
        ) : (
          <>
            <SoundOptions />
            {dev.names.map((names, e) => (
              <optgroup key={e} label={dev.info.engines[e]}>
                {(names || []).map((x, p) => (
                  <option key={p} value={`${e}:${p}`}>
                    {x}
                  </option>
                ))}
              </optgroup>
            ))}
          </>
        )}
      </SyncSelect>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-0.5 [&>button]:h-6 [&>button]:p-0">
        <button
          type="button"
          aria-label="previous"
          data-lvm={`s${i}:prev`}
          onClick={() => lvStep(i, -1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="aria-expanded:bg-acc aria-expanded:text-black"
          data-lsmore=""
          aria-expanded={more}
          title={t('lvxMoreTip')}
          aria-label={`${t('lvxMore')} ${i + 1}`}
          onClick={() => {
            LV.ui.more = more ? -1 : i
            notify()
          }}
        >
          ⋯
        </button>
        <button
          type="button"
          aria-label="next"
          data-lvm={`s${i}:next`}
          onClick={() => lvStep(i, 1)}
        >
          ›
        </button>
      </div>
      <div
        className={clsx(
          'border-c bg-s1 absolute top-[76px] z-25 w-[228px] border p-2 shadow-[0_8px_24px_rgb(0_0_0/.55)]',
          i >= n / 2 ? '-right-px' : '-left-px',
        )}
        data-lsmore=""
        hidden={!more}
      >
        <div className="font-text mb-1.5 flex items-center gap-1.5 text-[13px] leading-[18px]">
          <span className={num}>{lvNum(i)}</span>
          <span className={dim}>{t('lvxMoreTip')}</span>
        </div>
        <div className="grid grid-cols-3 justify-items-center gap-x-1 gap-y-1.5">
          {knobs}
        </div>
      </div>
      <div className="bg-s2 h-[3px]">
        <i
          className="bg-c block h-full w-0"
          style={{
            width:
              (playing && s
                ? ((s.step + 1) / Math.max(1, s.len)) * 100
                : 0
              ).toFixed(1) + '%',
          }}
        />
      </div>
      <div
        className={clsx(
          'flex min-h-24 flex-1 flex-col items-center gap-0.5',
          (muted || (!!LV.solo && !solo)) && 'opacity-40',
        )}
      >
        <Fader
          label={t('lvLevel') + ' ' + (i + 1)}
          meter={s && s.meter ? Math.max(0, (s.meter - 48) / 80) : 0}
          o={{
            min: 0,
            max: 127,
            def: lvD.def ?? 100,
            get: () => tr().level ?? 0,
            set: (v) => lvLevel(i, v),
            mid: `s${i}:lvl`,
          }}
        />
        <span className="text-fg2 leading-4">{o.level ?? ''}</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-0.5">
        <button
          type="button"
          className={clsx(sBtn, 'aria-pressed:bg-red')}
          data-lvm={`s${i}:mute`}
          aria-pressed={muted}
          onClick={() => lvMute(i, !tr().mute)}
        >
          {t('lvMute')}
        </button>
        {/* (solo: the GLO keys, 2.7) */}
        <button
          type="button"
          className={clsx(sBtn, 'aria-pressed:bg-fg')}
          data-lvm={`s${i}:solo`}
          aria-pressed={solo}
          disabled={!lvOk()}
          title={lvOk() ? undefined : t('lvNeeds')}
          onClick={async () => lvSolo(i)}
        >
          {t('lvSolo')}
        </button>
        <button
          type="button"
          className={clsx(sBtn, 'aria-pressed:bg-c col-span-2')}
          data-lvm={`s${i}:sel`}
          aria-pressed={target}
          onClick={async () => lvTarget(i)}
        >
          {t(target ? 'lvSelOn' : 'lvSel')}
        </button>
      </div>
    </div>
  )
}

export default function Mixer() {
  useApp()
  const dev = readyDev()
  const n = dev.info.ntrk || 4
  useMoreClose((LV.ui.more ?? -1) >= 0)
  return (
    <LvCard
      k="mixer"
      className="flex flex-col"
      title={t('lvMixer')}
      head={
        <button
          type="button"
          className="text-acc flex-none bg-transparent normal-case hover:underline"
          title={t('lvxSoundLinkTip')}
          onClick={() => {
            if (A.dev && A.dev.sel !== LV.target) lvTarget(LV.target)
            showTab('sound')
          }}
        >
          {t('lvxSoundLink')}
        </button>
      }
    >
      <div
        className="grid flex-1 grid-cols-[repeat(var(--n,8),minmax(0,1fr))] gap-1"
        style={{ '--n': n } as CSSProperties}
      >
        {Array.from({ length: n }, (_, i) => (
          <Strip key={i} i={i} n={n} />
        ))}
      </div>
    </LvCard>
  )
}
