// SPDX-License-Identifier: GPL-3.0-only
// The user sample slots (USR1..n): what the Samples page and the Drum kit page share. Decoding a file, the computer's
// preview, sending a slot to the FM-1 (SMP_BEGIN / SMP_WRITE / SMP_END) and erasing one, a track on a slot.
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import {
  A,
  hasTracks,
  notify,
  op,
  report,
  rq,
  sayK,
  selfLoad,
  t,
} from '../../core/app.ts'
import { afterSoundChange, userSet } from '../../core/device.ts'
import { smpInfo } from '../../core/shared.ts'
import {
  CMD,
  LOOP,
  SMP,
  buildSlot,
  normalize,
  parse,
  parseWav,
  req,
  resample,
  rootFromName,
  withGain,
} from '../../lib/proto.ts'
import type { SlotZoneIn } from '../../lib/proto.ts'

/* a slot being written or erased (the old smpBusy); up: the progress of a send ({where: "smp" | "kit", k, v}) */
/* a file of a slot's list (a draft): a zone as buildSlot takes it, its file's name, its gain (dB; null: none) */
export interface SmpFile extends SlotZoneIn {
  fname: string
  gain?: number | null
}
/* what goes into a slot: its name, its files */
export interface SmpDraft {
  name: string
  files: SmpFile[]
}
/* the page whose bar shows a send's progress */
export type UpWhere = 'smp' | 'kit'
export interface SmpBusy {
  busy: boolean
  up: { where: UpWhere; k: number; v: number } | null
}
export const SB: SmpBusy = { busy: false, up: null }
const SMP_RC: Record<number, string | undefined> = {
  1: 'size',
  2: 'header',
  3: 'data CRC',
  4: 'flash',
  5: 'zones',
}
const kib = (n: number) => (n / 1024).toFixed(1)

/* auto key split, as in buildSlot (for the preview) */
export function splitKeys(
  files: Pick<SlotZoneIn, 'root' | 'lo' | 'hi'>[],
): [number, number][] {
  const z = files
    .map((f, i) => ({ i, root: f.root }))
    .sort((a, b) => a.root - b.root)
  const out: [number, number][] = []
  z.forEach((x, j) => {
    out[x.i] = [
      j === 0 ? 0 : Math.floor((z[j - 1].root + x.root) / 2) + 1,
      j === z.length - 1 ? 127 : Math.floor((x.root + z[j + 1].root) / 2),
    ]
  })
  files.forEach((f, i) => {
    if (f.lo != null) out[i] = [f.lo, f.hi!]
  }) /* (chops: their own keys) */
  return out
}

export const draftBytes = (d: { files: Pick<SlotZoneIn, 's'>[] }): number =>
  d.files.reduce((a, f) => a + ((f.s.length + 1) >> 1), 0)

/* any file the browser decodes -> mono Float64 at SMP.RATE (the browser's decoder when it is not a plain WAV) */
export async function browserDecode(buf: ArrayBuffer): Promise<Float64Array> {
  const Ctx =
    window.OfflineAudioContext ||
    (
      window as unknown as {
        webkitOfflineAudioContext: typeof OfflineAudioContext
      }
    ).webkitOfflineAudioContext
  const ab = await new Ctx(1, 1, SMP.RATE).decodeAudioData(buf.slice(0))
  const x = new Float64Array(ab.length)
  for (let c = 0; c < ab.numberOfChannels; c++) {
    const d = ab.getChannelData(c)
    for (let i = 0; i < d.length; i++) x[i] += d[i] / ab.numberOfChannels
  }
  return x
}

export async function decodeFile(f: File): Promise<SmpFile> {
  const buf = await f.arrayBuffer()
  let x: number[] | Float64Array,
    wl: number[] | null = null
  try {
    const w = parseWav(buf)
    x = resample(w.x, w.sr, SMP.RATE)
    if (w.loop)
      wl = w.loop.map((p) =>
        Math.round((p * SMP.RATE) / w.sr),
      ) /* (2.7) the file's own loop: LOOP+TAIL */
  } catch {
    /* not a plain WAV: let the browser decode it */
    x = await browserDecode(buf)
  }
  if (!x.length) throw new Error('no audio')
  const z: SmpFile = {
    fname: f.name,
    s: normalize(x),
    root: rootFromName(f.name.replace(/\.[^.]*$/, '')),
  }
  if (
    wl &&
    wl[1] > wl[0] &&
    wl[1] - wl[0] + 1 >= LOOP.MIN &&
    z.s.length >= 4 * LOOP.MIN
  )
    [z.loop, z.ls, z.le] = [
      2,
      ...LOOP.range({ s: z.s, loop: 2, ls: wl[0], le: wl[1] }),
    ]
  return z
}

/* ---- the preview in the computer (22050 Hz mono) */
let smpAudio: AudioContext | null = null,
  smpSrc: AudioBufferSourceNode | null = null
export function playInt16(s: ArrayLike<number>, onend?: () => void): void {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  if (!smpAudio) smpAudio = new Ctx()
  if (smpSrc)
    try {
      smpSrc.stop()
    } catch {
      /* ended */
    }
  const buf = smpAudio.createBuffer(1, s.length, SMP.RATE),
    ch = buf.getChannelData(0)
  for (let i = 0; i < s.length; i++) ch[i] = s[i] / 32768
  smpSrc = smpAudio.createBufferSource()
  smpSrc.buffer = buf
  smpSrc.connect(smpAudio.destination)
  if (onend) smpSrc.onended = onend
  smpSrc.start()
}
/* 2.7: a file with a loop, heard as the FM-1 plays it: held, the loop goes round; let go, the rest to the end */
export function playLoop(s: ArrayLike<number>, ls: number, le: number): void {
  playInt16(s)
  smpSrc!.loop = true
  smpSrc!.loopStart = ls / SMP.RATE
  smpSrc!.loopEnd = (le + 1) / SMP.RATE
}
export function releaseLoop(): void {
  if (smpSrc) smpSrc.loop = false
}
/* the ▶ of a looped file: hold it (mouse, touch, or Enter / Space held); -> the button's handlers */
export function holdToPlay(start: () => void) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>): void => {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* gone */
      }
      start()
    },
    onPointerUp: releaseLoop,
    onPointerCancel: releaseLoop,
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>): void => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault()
        start()
      }
    },
    onKeyUp: (e: ReactKeyboardEvent<HTMLElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        releaseLoop()
      }
    },
  }
}

/* the name of a slot: 8 printable characters, upper case */
export const slotText = (v: string): string =>
  v
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 8)

/* ---- the FM-1 */
/* a list of sounds ({name, files}) into slot k; where: the page whose bar shows the progress */
export async function smpUpload(
  k: number,
  where: UpWhere,
  ask: boolean,
  d: { name: string; files: (SlotZoneIn & { gain?: number | null })[] },
): Promise<boolean> {
  let built: ReturnType<typeof buildSlot>,
    done = false
  try {
    built = buildSlot(
      d.name,
      d.files.map((f) => ({
        s: withGain(f.s, f.gain),
        root: f.root,
        lo: f.lo,
        hi: f.hi,
        loop: f.loop || 0,
        ls: f.ls,
        le: f.le,
      })),
    )
  } catch (e) {
    sayK('smpFail', (e as Error).message)
    return false
  }
  if (ask && !confirm(t('confirmUpload').replace('{n}', String(k + 1))))
    return false
  const { hdr, data } = built
  A.busy++
  SB.busy = true
  SB.up = { where, k, v: 0 }
  notify()
  try {
    const t0 = performance.now()
    let r = parse[CMD.SMP_BEGIN](
      await rq(req.smpBegin(k), { timeout: 1000, retries: 0 }),
    )
    if (r.rc) throw new Error('begin rc ' + r.rc)
    for (let off = 0; off < data.length; off += 256) {
      const a = SMP.DATA_OFF + off
      const w = parse[CMD.SMP_WRITE](
        await rq(req.smpWrite(k, a, data.subarray(off, off + 256)), {
          timeout: 1000,
          retries: 1,
        }),
      )
      if (w.rc) throw new Error(`write at 0x${a.toString(16)} rc ${w.rc}`)
      SB.up.v = (off + 256) / data.length
      sayK(
        'smpUploading',
        `${k + 1}  ${kib(Math.min(data.length, off + 256))} / ${kib(data.length)} KiB`,
      )
    }
    r = parse[CMD.SMP_END](
      await rq(req.smpEnd(k, hdr), { timeout: 2000, retries: 0 }),
    )
    if (r.rc) throw new Error(`end rc ${r.rc} (${SMP_RC[r.rc] || '?'})`)
    sayK(
      'smpDone',
      `${k + 1}  ${((performance.now() - t0) / 1000).toFixed(1)} s`,
    )
    done = true
  } catch (e) {
    if ((e as Error).message !== 'closed') sayK('smpFail', (e as Error).message)
  } finally {
    try {
      if (A.dev) await smpInfo()
    } catch {
      /* shown by the next action */
    }
    SB.busy = false
    SB.up = null
    A.busy--
    notify()
  }
  return done
}

export async function smpErase(k: number): Promise<void> {
  if (!A.dev || !confirm(t('confirmErase').replace('{n}', String(k + 1))))
    return
  A.busy++
  SB.busy = true
  notify()
  try {
    const r = parse[CMD.SMP_ERASE](
      await rq(req.smpErase(k), { timeout: 2500, retries: 0 }),
    )
    if (r.rc) throw new Error('erase rc ' + r.rc)
    sayK('smpErased', String(k + 1))
  } catch (e) {
    if ((e as Error).message !== 'closed') sayK('smpFail', (e as Error).message)
  } finally {
    try {
      if (A.dev) await smpInfo()
    } catch {
      /* ignore */
    }
    SB.busy = false
    A.busy--
    notify()
  }
}
/* slot k erased without asking (a kit over USR3+4 that leaves one of them empty); -> done */
export async function smpEraseQuiet(k: number): Promise<boolean> {
  A.busy++
  try {
    const r = parse[CMD.SMP_ERASE](
      await rq(req.smpErase(k), { timeout: 2500, retries: 0 }),
    )
    if (r.rc) throw new Error('erase rc ' + r.rc)
    await smpInfo()
    return true
  } catch (e) {
    report(e)
    return false
  } finally {
    A.busy--
    notify()
  }
}

/* track i plays slot k: the track selected, engine SAMPLE (its first preset), SET = USRk */
export function smpUseOn(i: number, k: number): void {
  const dev = A.dev
  if (!dev || !dev.info || !dev.dump || !hasTracks()) return
  const info = dev.info
  op(async () => {
    if (dev.sel !== i) {
      dev.sel = parse[CMD.TRACK](await rq(req.track(i))).sel
      await afterSoundChange()
    }
    const e = info.engines.indexOf('SAMPLE')
    if (e < 0) {
      sayK('smpNoEngine')
      return
    }
    if (dev.dump!.engine !== e) {
      selfLoad()
      parse[CMD.PRESET](await rq(req.preset(e, 0)))
      await afterSoundChange()
    }
    const d = dev.pdesc[info.pe0],
      v = d && d.names ? d.names.indexOf(`USR${k + 1}`) : -1
    if (v < 0) {
      sayK('smpNoEngine')
      return
    }
    userSet(0, info.pe0, v + d!.min, true)
    sayK('smpPlaying', ` ${i + 1}: SAMPLE, SET = USR${k + 1}`)
  })
}
