// SPDX-License-Identifier: GPL-3.0-only
// The Drum kit page (2.4): 1 the 16 pads (files dropped on them, or a ZIP opened), 2 where the kit goes (one slot, or
// USR3+4: the big kit), 3 send it and play it on the drum track. (Shows only when the FM-1 reported its sample flash.)
import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

import { hasTracks, notify, pickFile, t, tf, useApp } from '../core/app.ts'
import { DRUM_LANES, KIT, SMP, kitBytes, kitFit, kitLen } from '../lib/proto.ts'
import type { SmpSlotInfo } from '../lib/proto.ts'
import { Card, Ic, barVars } from '../ui/kit.tsx'
import { bar, dim, pri, warn } from '../ui/styles.ts'

import {
  KEY_OF_LANE,
  KIT_PAIR,
  kitAddFiles,
  kitDest,
  kitDraft,
  kitHas4,
  kitIndexOf,
  kitMatch,
  kitOver,
  kitPlayPad,
  kitRoom,
  kitSend,
  kitSlots,
  kitUse,
  kitZip,
} from './kits/kit.ts'
import type { KitDraftPad } from './kits/kit.ts'
import { SlotTiles } from './samples/SlotTiles.tsx'
import { SB } from './samples/smp.ts'
import { Meter, NameInput, ShortHelp, Step, useDrop } from './samples/ui.tsx'

const ACCEPT = '.wav,.zip,audio/*'
const pick = async (lane = -1): Promise<void> => {
  const fs = await pickFile(ACCEPT, true)
  if (fs && fs.length) kitAddFiles(fs, lane)
}
const css = (v: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(v).trim()

function kitDrawWave(cv: HTMLCanvasElement, p: KitDraftPad): void {
  const w = (cv.width = Math.max(60, cv.clientWidth || 200)),
    h = (cv.height = 48),
    g = cv.getContext('2d')!
  g.clearRect(0, 0, w, h)
  const s = p.s,
    n = s.length,
    keep = kitLen(p) * (p.tune ? Math.pow(2, p.tune / 12) : 1)
  const col =
      getComputedStyle(cv).getPropertyValue('--c').trim() || css('--t4'),
    S3 = css('--s3')
  for (let x = 0; x < w; x++) {
    const a = Math.floor((x / w) * n),
      b = Math.max(a + 1, Math.floor(((x + 1) / w) * n))
    let pk = 0
    for (let i = a; i < b && i < n; i += 4) pk = Math.max(pk, Math.abs(s[i]))
    const y = Math.max(1, Math.round((pk / 32768) * (h / 2 - 2)))
    g.fillStyle = a < keep ? col : S3
    g.fillRect(x, h / 2 - y, 1, y * 2)
  }
}

/* a pad's control: a label, a slider, its value */
interface Row3Props {
  label: string
  min: number
  max: number
  step: number
  value: number
  onInput: (v: number, max: number) => void
  onDone: () => void
  text: string
}
function Row3({
  label,
  min,
  max,
  step,
  value,
  onInput,
  onDone,
  text,
}: Row3Props) {
  return (
    <div className="row3 grid grid-cols-[auto_1fr_auto] items-center gap-1.5 text-dim">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={barVars({ min, max }, value)}
        onChange={(e) => onInput(+e.target.value, +e.target.max)}
        onPointerUp={onDone}
        onKeyUp={onDone}
      />
      <span className="val text-fg2 min-w-16 text-right">{text}</span>
    </div>
  )
}

function Pad({ l }: { l: number }) {
  useApp()
  const p = kitDraft.pads[l],
    cv = useRef<HTMLCanvasElement>(null)
  const [over, drop] = useDrop(async (fs) => kitAddFiles(fs, l), true)
  useEffect(() => {
    if (p && cv.current) kitDrawWave(cv.current, p)
  })
  useEffect(() => {
    const r = (): void => {
      const q = kitDraft.pads[l]
      if (q && cv.current) kitDrawWave(cv.current, q)
    }
    window.addEventListener('resize', r)
    return (): void => window.removeEventListener('resize', r)
  }, [l])
  let body = null
  if (!p) {
    body = (
      <button
        type="button"
        className="empty border-s3 hover:text-fg2 grid flex-1 place-content-center border border-dashed bg-transparent py-1 text-center text-dim normal-case hover:border-dim"
        title={t('kitEmptyPadHint')}
        onClick={async () => pick(l)}
      >
        {t('kitEmptyPad').replace('\n', ' ')}
      </button>
    )
  } else {
    const full = kitLen({ ...p, len: 0 })
    const lenMax =
      10 +
      Math.max(0, Math.ceil(((full / SMP.RATE) * 1000 - 10) / 5)) *
        5 /* (on the step grid: the end reachable) */
    const lenV = p.len ? Math.round((p.len / SMP.RATE) * 1000) : lenMax
    const play = (): void => kitPlayPad(l)
    body = (
      <>
        <canvas
          ref={cv}
          title={t('kitPlay')}
          onClick={play}
          className={`bg-s1 block h-12 w-full cursor-pointer ${kitDraft.playing === l ? 'outline-c outline' : ''}`}
        />
        <div className="fn text-fg2 truncate" title={p.fname}>
          {p.fname}
        </div>
        <div>
          <Row3
            label={t('kitTune')}
            min={-KIT.TUNE}
            max={KIT.TUNE}
            step={1}
            value={p.tune}
            onDone={play}
            onInput={(v) => {
              p.tune = v
              notify()
            }}
            text={(p.tune > 0 ? '+' : '') + p.tune + ' st'}
          />
          <Row3
            label={t('kitGain')}
            min={KIT.GAIN_MIN}
            max={0}
            step={1}
            value={p.gain}
            onDone={play}
            onInput={(v) => {
              p.gain = v
              notify()
            }}
            text={p.gain + ' dB'}
          />
          <Row3
            label={t('kitLen')}
            min={10}
            max={lenMax}
            step={5}
            value={lenV}
            onDone={play}
            onInput={(v, mx) => {
              p.len = v >= mx ? 0 : Math.round((v / 1000) * SMP.RATE)
              notify()
            }}
            text={(kitLen(p) / SMP.RATE).toFixed(2) + ' s'}
          />
        </div>
        <div className="acts flex gap-1">
          <button type="button" className="px-2 py-[3px]" onClick={play}>
            {'▶ ' + t('kitPlay')}
          </button>
          <button
            type="button"
            className={clsx(warn, 'px-2 py-[3px]')}
            onClick={() => {
              kitDraft.pads[l] = null
              notify()
            }}
          >
            ×
          </button>
        </div>
      </>
    )
  }
  return (
    <div
      data-l={l}
      {...drop}
      style={{ '--c': 'var(--t4)' } as CSSProperties}
      className={`pad relative flex ${p ? 'min-h-[170px]' : 'min-h-[85px]'} min-w-0 flex-col gap-1.5 border border-line bg-bg p-2.5 ${over ? 'over outline-c outline-2 -outline-offset-2 outline-dashed' : ''}`}
    >
      <div className="ph flex items-baseline gap-2">
        <b className="text-c font-normal uppercase">{DRUM_LANES[l][1]}</b>
        <span className="key text-s3 ml-auto">{KEY_OF_LANE[l]}</span>
      </div>
      {body}
    </div>
  )
}

function Meter2() {
  useApp()
  const n = kitSlots().length,
    cap = SMP.MAX_DATA * n,
    bytes = kitBytes(kitDraft.pads),
    secs = kitDraft.pads.reduce((a, p) => a + (p ? kitLen(p) : 0), 0) / SMP.RATE
  const over = kitOver()
  return (
    <Meter max={cap} value={Math.min(bytes, cap)} over={over}>
      {(over ? t('kitOver') + ' · ' : '') +
        t('kitUsed')
          .replace('{s}', secs.toFixed(1))
          .replace('{t}', ((cap * 2) / SMP.RATE).toFixed(1))}
    </Meter>
  )
}

/* where the kit goes: one slot (about 7 s), or USR3+4 (about 15 s, the big kit); the same tiles as the Samples page */
function Dest() {
  const { dev } = useApp()
  const ok = !!dev && !!dev.smp
  const smp = ok ? dev.smp! : null
  const tiles = [KIT_PAIR, 0, 1, 2, 3].map((d) => {
    const ks = kitSlots(d),
      sl = ks.map((k) => smp && smp.slots[k])
    const full = sl.filter((x): x is SmpSlotInfo => !!x && !!x.zones)
    return {
      id: d,
      title: kitDest(d),
      big: d === KIT_PAIR,
      full: !!full.length,
      now: full
        .map((x) => x.name || '—')
        .filter((x, i, a) => a.indexOf(x) === i)
        .join(' + '),
      kib: sl.reduce((a, x) => a + ((x && x.kib) || 0), 0),
      max: (smp ? smp.slotKiB : 0) * ks.length,
      cap: t(d === KIT_PAIR ? 'kitCapBig' : 'kitCapOne'),
      why: ok && !kitHas4() && (d === KIT_PAIR || d === 3) ? t('kitNo4') : '',
    }
  })
  return (
    <SlotTiles
      label={t('kitStep2')}
      tiles={tiles}
      sel={kitDraft.slot}
      onPick={(d) => {
        kitDraft.slot = d
        notify()
      }}
      className="grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]"
    />
  )
}

/* why the kit cannot be sent yet ("" when it can) */
function whySend(ok: boolean, any: boolean, over: boolean): string {
  return !ok
    ? t('libWhyNoDev')
    : SB.busy
      ? t('whyBusy')
      : !any
        ? t('kitWhyNoPads')
        : over
          ? t('kitWhyOver')
          : !kitDraft.name
            ? t('kitWhyName')
            : !kitHas4() && kitDraft.slot >= 3
              ? t('kitNo4')
              : ''
}

export default function Kits() {
  const { dev } = useApp()
  const ok = !!dev && !!dev.smp
  if (!kitHas4() && ok && kitDraft.slot >= 3)
    kitDraft.slot = 2 /* (a firmware without USR4) */
  const any = kitDraft.pads.some(Boolean),
    over = kitOver()
  const smp = ok ? dev.smp! : null
  const sl = kitSlots().map((k) => smp && smp.slots[k])
  const used = sl.filter((x): x is SmpSlotInfo => !!x && !!x.zones)
  const up = SB.up && SB.up.where === 'kit' ? SB.up : null
  const [, cardDrop] = useDrop(async (fs) => kitAddFiles(fs))
  const why = whySend(ok, any, over)
  const whyUse = !ok
    ? t('libWhyNoDev')
    : SB.busy
      ? t('whyBusy')
      : !used.length
        ? tf('smpWhyEmptyX', { x: kitDest() })
        : !hasTracks() || (dev.kitNames && kitIndexOf(kitDraft.slot) < 0)
          ? t('kitNoKit')
          : ''
  return (
    <div id="kit">
      <Card title={t('kitTitle')} ic="symbol_drum">
        <div onDragOver={(e) => e.preventDefault()} onDrop={cardDrop.onDrop}>
          <ShortHelp text={t('kitHelp')} />
          <Step n={1} title={t('kitStep1')}>
            <ShortHelp text={t('kitStep1Help')} />
            <div className="kithead grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 gap-y-3">
              <div className={clsx(bar, 'mb-0!')}>
                <button type="button" onClick={async () => pick(-1)}>
                  <Ic ic="symbol_folder_open">{t('kitAdd')}</Ic>
                </button>
                <button
                  type="button"
                  disabled={!any}
                  title={any ? '' : t('kitWhyNoPads1')}
                  onClick={kitZip}
                >
                  <Ic ic="symbol_download">{t('kitZip')}</Ic>
                </button>
                <button
                  type="button"
                  className={warn}
                  disabled={!any}
                  title={any ? '' : t('kitWhyNoPads1')}
                  onClick={() => {
                    kitDraft.pads = Array(16).fill(null)
                    kitDraft.sel = -1
                    notify()
                  }}
                >
                  <Ic ic="symbol_trash">{t('kitClear')}</Ic>
                </button>
              </div>
              <Meter2 />
            </div>
            <div className="pads my-4 grid grid-cols-4 gap-2.5">
              {Array.from({ length: 16 }, (_, l) => (
                <Pad key={l} l={l} />
              ))}
            </div>
            <div className={bar}>
              <button
                type="button"
                disabled={kitDraft.pads.filter(Boolean).length < 2}
                title={
                  kitDraft.pads.filter(Boolean).length < 2
                    ? t('kitWhyTwo')
                    : t('matchHelp')
                }
                onClick={kitMatch}
              >
                <Ic ic="symbol_audio">{t('matchLevels')}</Ic>
              </button>
              <button
                type="button"
                disabled={!over}
                title={over ? t('kitFitHelp') : t('kitWhyFit')}
                onClick={() => {
                  if (kitFit(kitDraft.pads, kitRoom(), kitSlots().length))
                    notify()
                }}
              >
                {t('kitFit')}
              </button>
            </div>
          </Step>
          <Step n={2} title={t('kitStep2')}>
            <Dest />
            <p className="destnote text-fg2 mt-0 mb-2.5">
              {t(
                kitDraft.slot === KIT_PAIR ? 'kitNotePair' : 'kitNoteOne',
              ).replace('{x}', kitDest())}
              {used.length ? (
                <>
                  {' '}
                  <span className="text-t3">
                    {t('kitReplaces').replace(
                      '{x}',
                      used.map((x) => x.name || '—').join(' + '),
                    )}
                  </span>
                </>
              ) : null}
              {ok && !kitHas4() ? (
                <>
                  {' '}
                  <span className={dim}>{t('kitNo4')}</span>
                </>
              ) : null}
            </p>
            <div className={bar}>
              <span className={dim}>{t('kitName')}</span>
              <NameInput
                value={kitDraft.name}
                onChange={(v) => {
                  kitDraft.name = v
                  notify()
                }}
              />
            </div>
          </Step>
          <Step
            n={3}
            title={t('kitStep3')}
            off={!any && !used.length}
            why={!any ? t('kitWhyNoPads') : ''}
          >
            <div className={bar}>
              <button
                type="button"
                className={pri}
                onClick={kitSend}
                disabled={!!why}
                title={why}
              >
                <Ic ic="symbol_upload">
                  {t('kitSend').replace('{x}', kitDest())}
                </Ic>
              </button>
              <progress
                className="w-[180px]"
                max={1}
                value={up ? up.v : 0}
                hidden={!up}
              />
              <button
                type="button"
                onClick={() => kitUse(kitDraft.slot)}
                disabled={!!whyUse}
                title={whyUse}
              >
                <Ic ic="symbol_drum">
                  {t('kitUse').replace('{x}', kitDest())}
                </Ic>
              </button>
            </div>
            <p className={clsx(dim, 'my-4')}>
              {t('kitWhereFM1').replace('{x}', kitDest())}
            </p>
          </Step>
        </div>
      </Card>
    </div>
  )
}
