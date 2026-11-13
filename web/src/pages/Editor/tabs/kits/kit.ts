// SPDX-License-Identifier: GPL-3.0-only
// The drum kit (2.4): 16 pads, one per drum lane (DRUM_LANES, the white keys F3..), each a sound kitPad tunes, cuts and
// levels; the kit goes to a USR slot as one zone per lane (kitZones) and the drum track plays it with KIT = USR1..USR3
import {
  A,
  downloadBytes,
  drumFocus,
  fileSlug,
  hasTracks,
  notify,
  op,
  rq,
  sayK,
  t,
} from '../../core/app.ts'
import { afterSoundChange, userSet } from '../../core/device.ts'
import {
  CMD,
  DRUM_LANES,
  SMP,
  kitBytes,
  kitPad,
  kitPlace,
  kitSplit,
  kitZones,
  matchGains,
  parse,
  req,
  wavFile,
  zipRead,
  zipStore,
} from '../../lib/proto.ts'
import type { KitPad } from '../../lib/proto.ts'
import { SB, decodeFile, smpEraseQuiet, smpUpload } from '../samples/smp.ts'

/* a pad of the kit: its sound, the file it came from, its tune (semitones), gain (dB), length (samples; 0: all) */
export interface KitDraftPad extends KitPad {
  fname: string
  tune: number
  gain: number
  len: number
}
/* the kit being made: its name, where it goes (0..3 a slot, KIT_PAIR USR3+4), the 16 pads, the pad selected, the pad
   sounding (-1: none) */
export interface KitDraft {
  name: string
  slot: number
  pads: (KitDraftPad | null)[]
  sel: number
  playing: number
}
export const kitDraft: KitDraft = {
  name: '',
  slot: 4,
  pads: Array(16).fill(null),
  sel: -1,
  playing: -1,
} /* slot 0..3: USR1..4; 4: USR3+4 (a big kit) */
export const KIT_PAIR = 4
export const kitSlots = (d: number = kitDraft.slot): number[] =>
  d === KIT_PAIR ? [2, 3] : [d]
export const kitDest = (d: number = kitDraft.slot): string =>
  d === KIT_PAIR ? 'USR3+4' : `USR${d + 1}`
export const kitRoom = (): number =>
  SMP.MAX_DATA -
  64 /* (a slot, less a margin: kitLen may undercount a sample) */
export const kitHas4 = (): boolean =>
  !!A.dev && !!A.dev.smp && A.dev.smp.nslots >= 4
export const KEY_OF_LANE = [
  'F3',
  'G3',
  'A3',
  'B3',
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
  'G5',
]
let kitAudio: AudioContext | null = null,
  kitSrc: AudioBufferSourceNode | null = null

export async function kitAddFiles(list: File[], lane = -1): Promise<void> {
  const done: string[] = []
  let full = false
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) {
      await kitOpenZip(f)
      continue
    }
    try {
      const z = await decodeFile(f)
      const pads =
        kitDraft.pads /* (after the decode: CLEAR ALL may have come meanwhile) */
      const l = kitPlace(pads, f.name, lane)
      if (l < 0) {
        full = true
        break
      }
      pads[l] = { s: z.s, fname: f.name, tune: 0, gain: 0, len: 0 }
      done.push(`${DRUM_LANES[l][1]} ← ${f.name}`)
      if (!kitDraft.name) kitDraft.name = 'KIT'
      if (lane >= 0)
        lane = -1 /* (more files dropped on one pad: the rest by name) */
    } catch (e) {
      sayK('smpDecodeFail', `${f.name} (${(e as Error).message})`)
    }
  }
  if (done.length)
    sayK('kitAssigned', done.join(', ') + (full ? ' — ' + t('kitFull') : ''))
  else if (full) sayK('kitFull')
  notify()
}
async function kitOpenZip(f: File): Promise<void> {
  try {
    const files = (await zipRead(await f.arrayBuffer())).filter((x) =>
      /\.(wav|aif|aiff|mp3|flac|ogg)$/i.test(x.name),
    )
    const base = f.name
      .replace(/\.zip$/i, '')
      .toUpperCase()
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 8)
    await kitAddFiles(
      files.map(
        (x) => new File([x.data as BlobPart], x.name.split('/').pop()!),
      ),
    )
    if (base) kitDraft.name = base
    sayK('kitLoaded', f.name)
  } catch (e) {
    sayK('smpDecodeFail', `${f.name} (${(e as Error).message})`)
  }
}
export function kitPlayPad(l: number): void {
  const p = kitDraft.pads[l]
  if (!p) return
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  if (!kitAudio) kitAudio = new Ctx()
  if (kitSrc)
    try {
      kitSrc.stop()
    } catch {
      /* ended */
    }
  const s = kitPad(p),
    buf = kitAudio.createBuffer(1, s.length, SMP.RATE),
    ch = buf.getChannelData(0)
  for (let i = 0; i < s.length; i++) ch[i] = s[i] / 32768
  const src = (kitSrc = kitAudio.createBufferSource())
  src.buffer = buf
  src.connect(kitAudio.destination)
  src.start()
  kitDraft.playing = l /* (the pad's wave outlined while it sounds) */
  src.onended = (): void => {
    if (kitDraft.playing === l && kitSrc === src) {
      kitDraft.playing = -1
      notify()
    }
  }
  notify()
}

/* the room over the kit's slot(s): over when it does not fit (a pair: when the pads cannot be shared out) */
export const kitOver = (): boolean =>
  kitDraft.slot === KIT_PAIR
    ? !kitSplit(kitDraft.pads, kitRoom())
    : kitBytes(kitDraft.pads) > kitRoom()

/* KIT's value for USRn on the drum track (its names come with the drum track's DESC: -1 while not known) */
export const kitIndexOf = (d: number): number =>
  A.dev && A.dev.kitNames ? A.dev.kitNames.indexOf(kitDest(d)) : -1

/* the pads to the same heard level (as they sound with their pitch and length): Gain set on each, by ear after */
export function kitMatch(): void {
  const g = matchGains(
    kitDraft.pads.map((p) => (p ? kitPad({ ...p, gain: 0 }) : null)),
  )
  kitDraft.pads.forEach((p, l) => {
    if (p) p.gain = g[l]!
  })
  sayK('levelsMatched')
  notify()
}
/* the kit to its slot, or shared out over USR3 and USR4 (kitSplit); a slot of the pair that gets no pad is erased, so
   nothing old plays on a lane the kit leaves empty */
export async function kitSend(): Promise<void> {
  const d = kitDraft.slot,
    ks = kitSlots(d)
  if (!kitDraft.pads.some(Boolean)) {
    sayK('kitNone')
    return
  }
  const parts =
    ks.length > 1
      ? kitSplit(kitDraft.pads, kitRoom())
      : [kitDraft.pads.map((p, l) => (p ? l : -1)).filter((l) => l >= 0)]
  if (!parts) {
    sayK('kitOver')
    return
  }
  if (
    !confirm(
      t('kitConfirm').replace('{x}', ks.map((k) => `USR${k + 1}`).join(' + ')),
    )
  )
    return
  let done = true
  for (let j = 0; j < ks.length && done; j++) {
    const k = ks[j]
    if (!parts[j].length) {
      done = await smpEraseQuiet(k)
      continue
    }
    const sub = kitDraft.pads.map((p, l) => (parts[j].includes(l) ? p : null))
    done = await smpUpload(k, 'kit', false, {
      name: kitDraft.name || 'KIT',
      files: kitZones(sub),
    })
  }
  notify()
  if (done) sayK('kitSent', kitDest(d))
}
/* the drum track on that kit (the selected one, else the first: drumFocus), then its KIT (P_E0) = USRn */
export function kitUse(k: number): void {
  const dev = A.dev
  if (!dev || !dev.info || !hasTracks()) return
  const info = dev.info
  op(async () => {
    const drum = drumFocus()
    if (drum < 0) {
      sayK('kitNoKit')
      return
    }
    if (dev.sel !== drum) {
      dev.sel = parse[CMD.TRACK](await rq(req.track(drum))).sel
      await afterSoundChange()
    }
    const d = dev.pdesc[info.pe0],
      i =
        d && d.names
          ? d.names.indexOf(kitDest(k))
          : -1 /* (the drum track's DESC now) */
    if (i < 0) {
      sayK('kitNoKit')
      return
    }
    userSet(0, info.pe0, i + d!.min, true)
    notify() /* (the sequencer's drum bar: the kit's names) */
    sayK('kitUsing', kitDest(k))
  })
}
export function kitZip(): void {
  const files = kitZones(kitDraft.pads).map((z) => ({
    name: `${kitDraft.name || 'KIT'}/${String(z.lane + 1).padStart(2, '0')} ${DRUM_LANES[z.lane][1]}.wav`,
    data: wavFile(z.s),
  }))
  if (!files.length) return
  downloadBytes(
    `${fileSlug(kitDraft.name || 'kit')}-drumkit.zip`,
    zipStore(files),
  )
}
export const kitBusy = (): boolean => SB.busy
