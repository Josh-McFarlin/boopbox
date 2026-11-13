// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
/* ============================================================ LIVE pro === */
/* Editor only: the 2.7 firmware as it is. Scenes (8, recalled at once or morphed over bars, the A / B crossfader), sounds with
   favourites and the USER presets, MIDI learn (any control on any controller), and the stage tools (lock, the clock and
   the set's time, the set recorded from the FM-1's USB audio, the setlist's tempo and cue). Kept in this browser
   (IndexedDB "lvpro"); the scenes travel with a saved setlist */
import {
  A,
  downloadBytes,
  notify,
  report,
  rq,
  rqf,
  sayK,
  selfLoad,
  t,
  today,
} from '../../core/app.ts'
import { store } from '../../core/shared.ts'
import { FM1_PORT, LVX, bank, req } from '../../lib/proto.ts'
import type { Scene, SceneMix, SceneTrackIn } from '../../lib/proto.ts'

import {
  LV,
  lvDrum,
  lvGlobal,
  lvGv,
  lvParam,
  lvReadTrack,
  lvReadTracks,
  lvSetMix,
  lvSound,
  lvTicks,
  lvTouch,
} from './state.ts'

/** what MIDI learn drives on a knob, a fader, a list (controls.tsx: node._lvo) */
export interface LvoTarget {
  min: number
  max: number
  set: (v: number, final?: boolean) => void
}
/** a learnable control's node (data-lvm): a slider's _lvo / update, a held button's press / release */
export interface LvmNode extends HTMLElement {
  _lvo?: LvoTarget
  update?: () => void
  press?: () => void
  release?: () => void
  disabled?: boolean
}
/** the set being recorded from the FM-1's USB audio */
export interface LvRec {
  ctx: AudioContext
  stream: MediaStream
  src: MediaStreamAudioSourceNode
  node: AudioWorkletNode
  mute: GainNode
  chunks: Int16Array[]
  n: number
  peak: number
  t0: number
  name: string
}
/** a scene's values on their way to the FM-1 (a mix, with the tempo) */
type SceneSend = SceneMix & { bpm?: number | null }
export interface LvsState {
  scenes: (Scene | null)[]
  names: string[]
  morph: number
  store: boolean
  sounds: boolean
  tempo: boolean
  xa: number
  xb: number
  xf: number
  anim: ReturnType<typeof setInterval> | 0
  cur: number
  curF: number | null
  busy: boolean
  learn: boolean
  target: string | null
  map: Record<string, string>
  edge: Map<string, boolean>
  ins: Set<MIDIInput>
  lock: boolean
  rec: LvRec | null
  setStart: number
  favs: Set<string>
  all: boolean | null
  restored: boolean
  saveT: ReturnType<typeof setTimeout> | 0
}

export const LVS: LvsState = {
  scenes: new Array(LVX.NSCENE).fill(null),
  names: [],
  morph: 0,
  store: false,
  sounds: false,
  tempo: false,
  xa: 0,
  xb: 1,
  xf: 0,
  anim: 0,
  cur: -1,
  curF: null,
  busy: false,
  learn: false,
  target: null,
  map: {},
  edge: new Map(),
  ins: new Set(),
  lock: false,
  rec: null,
  setStart: 0,
  favs: new Set(),
  all: null,
  restored: false,
  saveT: 0,
}
export async function lvxRestore(): Promise<void> {
  if (LVS.restored) return
  LVS.restored = true
  try {
    const v = await store.getMeta('lvpro')
    if (v) {
      if (Array.isArray(v.scenes))
        v.scenes.slice(0, LVX.NSCENE).forEach((s: Scene | null, k: number) => {
          LVS.scenes[k] = s && s.v === 1 ? s : null
        })
      LVS.names = Array.isArray(v.names) ? v.names.slice(0, LVX.NSCENE) : []
      for (const k of ['morph', 'xa', 'xb'] as const)
        if (Number.isInteger(v[k])) LVS[k] = v[k]
      LVS.sounds = !!v.sounds
      LVS.tempo = !!v.tempo
      if (v.map && typeof v.map === 'object') LVS.map = v.map
      if (Array.isArray(v.favs)) LVS.favs = new Set(v.favs)
    }
  } catch {
    /* no storage: this page only */
  }
  notify()
}
export function lvxSave(): void {
  clearTimeout(LVS.saveT)
  LVS.saveT = setTimeout(() => {
    store
      .setMeta('lvpro', {
        scenes: LVS.scenes,
        names: LVS.names,
        morph: LVS.morph,
        xa: LVS.xa,
        xb: LVS.xb,
        sounds: LVS.sounds,
        tempo: LVS.tempo,
        map: LVS.map,
        favs: [...LVS.favs],
      })
      .catch((e) => console.warn(e))
  }, 300)
}

/* ---- scenes */
function lvxNow(): Scene {
  /* the page's values as a scene */
  const dev = A.dev!,
    n = dev.info!.ntrk || 4
  const tracks: SceneTrackIn[] = []
  for (let i = 0; i < n; i++) {
    const o = LV.tr[i] || { p: [] }
    tracks.push({
      level: o.level,
      mute: o.mute,
      engine: o.engine,
      preset: o.preset,
      kit: lvDrum(i) ? (o.p[dev.info!.pe0] ?? null) : null,
      p: o.p,
    })
  }
  return LVX.capture(tracks, dev.dump!.g, {
    sounds: LVS.sounds,
    tempo: LVS.tempo,
  })
}
export const lvxName = (k: number): string =>
  LVS.names[k] || `${t('lvxScene')} ${k + 1}`
export async function lvxStore(k: number): Promise<void> {
  if (!A.dev || !A.dev.dump) return
  if (LVS.scenes[k] && !confirm(t('lvxReplace').replace('{x}', lvxName(k))))
    return
  await lvReadTracks(true) /* (the values as the FM-1 has them now) */
  LVS.scenes[k] = lvxNow()
  LVS.store = false
  lvxSave()
  sayK('lvxStored', lvxName(k))
  notify()
}
/* the values of v onto the FM-1: only what differs from the page's (TRACK_MIX, TRACK_PARAM, SET; queued by key, so a
   morph's later value replaces one not sent yet) */
function lvxSend(v: SceneSend, final: boolean): void {
  v.tracks.forEach((x, i) => {
    const o = LV.tr[i]
    if (!o) return
    if (o.level !== x.level || (o.mute ? 1 : 0) !== x.mute) {
      o.level = x.level
      o.mute = x.mute
      lvTouch('lv:' + i)
      lvSetMix(i)
    }
    for (const [id, val] of Object.entries(x.p))
      if (o.p[+id] !== val) lvParam(i, +id, val)
    if (x.e && !lvDrum(i))
      x.e.forEach((val, k) => {
        if (val != null && o.p[LVX.E0 + k] !== val) lvParam(i, LVX.E0 + k, val)
      })
  })
  for (const [id, val] of Object.entries(v.g))
    if (lvGv(+id) !== val) lvGlobal(+id, val, final)
  if (v.bpm != null && lvGv(LVX.BPM) !== v.bpm) lvGlobal(LVX.BPM, v.bpm, final)
  notify()
}
/* a scene's sounds first (a sound brings its own values: the scene's go over them after) */
async function lvxSounds(sc: Scene): Promise<void> {
  for (let i = 0; i < sc.tracks.length; i++) {
    const x = sc.tracks[i],
      o = LV.tr[i]
    if (!o) continue
    if (lvDrum(i)) {
      if (x.kit != null && o.p[A.dev!.info!.pe0] !== x.kit)
        await lvParam(i, A.dev!.info!.pe0, x.kit)
    } else if (o.engine !== x.engine || o.preset !== x.preset)
      await lvSound(i, x.engine, x.preset)
  }
}
export function lvxStop(): void {
  clearInterval(LVS.anim)
  LVS.anim = 0
  LVS.curF = null
}
export async function lvxRecall(k: number): Promise<void> {
  const sc = LVS.scenes[k]
  if (!sc || !A.dev || !A.dev.dump || LVS.busy) return
  lvxStop()
  LVS.busy = true
  try {
    if (sc.sounds) await lvxSounds(sc)
    const from = lvxNow(),
      bars = LVX.MORPH_BARS[LVS.morph] || 0
    const to = { ...sc, bpm: sc.tempo ? sc.bpm : null }
    const ms = LVX.morphMs(bars, lvGv(LVX.BPM))
    LVS.cur = k
    if (!ms) {
      lvxSend({ ...LVX.mix(from, to, 1), bpm: to.bpm }, true)
      return
    }
    const t0 = performance.now(),
      b0 = lvGv(LVX.BPM)
    LVS.anim = setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / ms)
      const v: SceneSend = LVX.mix(from, to, f)
      v.bpm = to.bpm == null ? null : Math.round(b0 + (to.bpm - b0) * f)
      LVS.curF = f /* (the scene's pad fills as the morph goes) */
      lvxSend(v, f >= 1)
      if (f >= 1) lvxStop()
    }, 90)
  } finally {
    LVS.busy = false
    notify()
  }
}
/* the crossfader: the mix of scenes A and B, as it moves */
export function lvxCross(f: number): void {
  LVS.xf = f
  const a = LVS.scenes[LVS.xa],
    b = LVS.scenes[LVS.xb]
  if (!a || !b) {
    sayK('lvxNoAB')
    notify()
    return
  }
  lvxStop()
  const v: SceneSend = LVX.mix(a, b, f / 100)
  v.bpm =
    a.tempo && b.tempo && a.bpm != null && b.bpm != null
      ? Math.round(a.bpm + ((b.bpm - a.bpm) * f) / 100)
      : null
  lvxSend(v, false)
}

/* each state read: the set's time starts with PLAY */
lvTicks.state = (): void => {
  if (LV.s && LV.s.playing && !LVS.setStart) LVS.setStart = Date.now()
}

/* ---- sounds: favourites (this browser) and the USER presets (the FM-1's bank) in each track's list */
export const lvxFavKey = (
  e: number | undefined,
  p: number | undefined,
): string => `${e}:${p}`
export function lvxFav(i: number): void {
  const o = LV.tr[i]
  if (!o || lvDrum(i)) return
  const k = lvxFavKey(o.engine, o.preset)
  if (LVS.favs.has(k)) LVS.favs.delete(k)
  else LVS.favs.add(k)
  lvxSave()
  notify()
}
export async function lvxUser(i: number, slot: number): Promise<void> {
  const dev = A.dev!,
    sel = dev.sel ?? 0
  try {
    if (sel !== i) await rq(req.track(i), { front: true })
    selfLoad()
    const rc = await bank.load(rqf, slot)
    if (rc) sayK('lvxUserEmpty')
    if (sel !== i && LV.target !== i) await rq(req.track(sel)).catch(() => {})
    else dev.sel = i
    LV.stale = true
    await lvReadTrack(i)
  } catch (e) {
    report(e)
  }
}

/* ---- MIDI learn: any control of the page (data-lvm) on a controller's CC or note */
export function lvxMidiOn(): void {
  const access = A.access
  if (!access || A.MOCK) return
  for (const inp of access.inputs.values()) {
    if (
      LVS.ins.has(inp) ||
      (A.dev && inp === A.dev.input) ||
      FM1_PORT.test(inp.name || '')
    )
      continue
    inp.addEventListener('midimessage', lvxMidiIn)
    LVS.ins.add(inp)
  }
}
export function lvxMidiOff(): void {
  for (const inp of LVS.ins) inp.removeEventListener('midimessage', lvxMidiIn)
  LVS.ins.clear()
}
function lvxMidiIn(e: MIDIMessageEvent): void {
  lvxMidi(e.data)
}
export function lvxMidi(data: Uint8Array | null): void {
  if (A.tab !== 'live' || !LV.built) return
  const m = LVX.midiKey(data)
  if (!m) return
  if (LVS.learn && LVS.target) {
    if (!m.on && m.kind === 'note') return
    for (const [k, v] of Object.entries(LVS.map))
      if (v === LVS.target) delete LVS.map[k]
    LVS.map[m.key] = LVS.target
    sayK('lvxLearned', `${LVS.target} ← ${m.key.replace(/:/g, ' ')}`)
    LVS.target = null
    lvxSave()
    notify()
    return
  }
  const id = LVS.map[m.key]
  if (!id) return
  const node = document.querySelector<LvmNode>(
    `#lv [data-lvm="${CSS.escape(id)}"]`,
  )
  if (!node) return
  const was = LVS.edge.get(m.key) || false
  LVS.edge.set(m.key, m.on)
  if (node._lvo) {
    /* a knob, a fader, a list: the value */
    if (m.kind === 'note' && !m.on) return
    node._lvo.set(LVX.midiValue(m, node._lvo.min, node._lvo.max), true)
    if (node.update) node.update()
  } else if (node.press) {
    /* a held button: while the pad / key is down */
    if (m.on) node.press()
    else node.release!()
  } else if (m.on && !was && !node.disabled)
    node.click() /* a button: on the press (a CC: crossing 64) */
}
/* in learn mode a tap picks the control instead of using it; a right-click forgets its mapping */
export function lvxLearnPick(e: Event): void {
  if (!LVS.learn) return
  const n = (e.target as Element).closest<HTMLElement>('[data-lvm]')
  if (!n || n.closest('[data-lvlearn]')) return
  e.preventDefault()
  e.stopPropagation()
  if (e.type === 'contextmenu') {
    for (const [k, v] of Object.entries(LVS.map))
      if (v === n.dataset.lvm) delete LVS.map[k]
    lvxSave()
  } else if (e.type === 'pointerdown') LVS.target = n.dataset.lvm ?? null
  notify()
}
export function lvxLearn(): void {
  LVS.learn = !LVS.learn
  LVS.target = null
  if (LVS.learn) lvxMidiOn()
  notify()
}

/* ---- stage tools: lock, the clock and the set's time, the set recorded from the FM-1's USB audio */
export function lvxLock(on: boolean): void {
  LVS.lock = on
  notify()
}
export async function lvxRecStart(): Promise<void> {
  if (LVS.rec) return
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    !window.AudioWorkletNode
  ) {
    sayK('lvxRecNo')
    return
  }
  try {
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    )
    const fm = devs.find((d) =>
      /fm-?1|m-?vave|boopbox|sloop|felucca/i.test(d.label),
    )
    const want =
      fm ||
      devs.find(
        (d) => d.deviceId === stream.getAudioTracks()[0].getSettings().deviceId,
      )
    stream.getTracks().forEach((x) => x.stop())
    // eslint-disable-next-line require-atomic-updates -- replaces the stream it just stopped
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: want ? { exact: want.deviceId } : undefined,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const ctx = new AudioContext()
    const code = `class R extends AudioWorkletProcessor{process(i){const x=i[0];if(x&&x.length){const l=x[0],r=x[1]||x[0],o=new Float32Array(l.length*2);
      for(let k=0;k<l.length;k++){o[2*k]=l[k];o[2*k+1]=r[k];}this.port.postMessage(o,[o.buffer]);}return true;}}registerProcessor("lvx-rec",R);`
    const url = URL.createObjectURL(
      new Blob([code], { type: 'text/javascript' }),
    )
    await ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const src = ctx.createMediaStreamSource(stream),
      node = new AudioWorkletNode(ctx, 'lvx-rec'),
      mute = ctx.createGain()
    mute.gain.value = 0
    const rec: LvRec = {
      ctx,
      stream,
      src,
      node,
      mute,
      chunks: [],
      n: 0,
      peak: 0,
      t0: Date.now(),
      name: want ? want.label : '',
    }
    node.port.onmessage = (ev: MessageEvent<Float32Array>): void => {
      const pc = LVX.pcm16(ev.data)
      rec.chunks.push(pc)
      rec.n += pc.length
      for (let k = 0; k < ev.data.length; k += 8)
        rec.peak = Math.max(rec.peak, Math.abs(ev.data[k]))
    }
    src.connect(node)
    node.connect(mute)
    mute.connect(ctx.destination)
    LVS.rec = rec
    if (!fm) sayK('lvxRecOther', rec.name)
    else sayK('lvxRecOn', rec.name)
  } catch (e) {
    sayK('lvxRecNo', (e as Error).message || '')
  }
  notify()
}
export function lvxRecStop(): void {
  const r = LVS.rec
  if (!r) return
  LVS.rec = null
  try {
    r.src.disconnect()
    r.node.disconnect()
    r.stream.getTracks().forEach((x) => x.stop())
    r.ctx.close()
  } catch {
    /* gone */
  }
  if (r.n) {
    const d = new Date(),
      stamp = `${today()}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
    downloadBytes(
      `BoopBox-live-${stamp}.wav`,
      LVX.wav(r.chunks, r.ctx.sampleRate, 2),
    )
    sayK('lvxRecSaved', LVX.clock(Date.now() - r.t0))
  }
  notify()
}

/* ---- a tip on every control (a hover on a computer; the "?" of each card says more) */
export function lvxTipOf(id: string): string | undefined {
  const P: Record<number, string> = {
    39: 'pan',
    50: 'filt',
    36: 'send',
    35: 'send',
    34: 'send',
    33: 'drive',
  }
  const G: Record<number, string> = {
    0: 'bpm',
    1: 'swing',
    29: 'mfilt',
    27: 'dust',
    28: 'duck',
    26: 'send',
    32: 'send',
  }
  let m: RegExpExecArray | null
  if ((m = /^g:(\d+)$/.exec(id))) return G[+m[1]]
  if ((m = /^s\d+:(\d+)$/.exec(id))) return P[+m[1]]
  if ((m = /^s\d+:(\w+)$/.exec(id)))
    return (
      {
        lvl: 'lvl',
        mute: 'mute',
        solo: 'solo',
        sel: 'sel',
        prev: 'snd',
        next: 'snd',
      } as Record<string, string>
    )[m[1]]
  if ((m = /^(sec|scene|fx|pad):\d+$/.exec(id))) return m[1]
  if (/^chain:\d$/.test(id)) return 'chain'
  if (/^kmode:/.test(id)) return 'kmode'
  if (/^throw:/.test(id)) return 'throw'
  return (
    {
      master: 'vol',
      'master:knob': 'volknob',
      'chain:play': 'chainplay',
      'chain:stop': 'chainplay',
      play: 'play',
      rec: 'rec',
      undo: 'undo',
      redo: 'undo',
      tap: 'tap',
      loop: 'loop',
      song: 'loop',
      songrec: 'songrec',
      fill: 'fill',
      fillbar: 'fillbar',
      panic: 'panic',
      latch: 'latch',
      'pl:next': 'next',
      'scene:store': 'store',
      'scene:morph': 'morph',
      'scene:xf': 'xf',
    } as Record<string, string>
  )[id]
}
/* the tips on the page's controls (data-lvm) that have no title of their own */
export function lvxTips(root: HTMLElement | null): void {
  if (!root) return
  root.querySelectorAll<HTMLElement>('[data-lvm]').forEach((n) => {
    const k = lvxTipOf(n.dataset.lvm!),
      tip = k ? t('lvxTip_' + k) : ''
    if (tip && !n.title) n.title = tip
  })
}

/* the view: the essentials (a first visit's) or everything (+ the scenes' options, the playlist, record set, MIDI learn);
   the user's choice is kept */
export function lvxViewAll(): boolean {
  if (LVS.all == null) {
    let v: string | null = null
    try {
      v = localStorage.getItem('sloop-live-view')
    } catch {
      /* no storage */
    }
    LVS.all = v === 'all'
  }
  return LVS.all
}
export function lvxView(all: boolean): void {
  LVS.all = all
  try {
    localStorage.setItem('sloop-live-view', all ? 'all' : 'simple')
  } catch {
    /* no storage */
  }
  notify()
}
