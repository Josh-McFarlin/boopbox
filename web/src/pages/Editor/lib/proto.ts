// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The editor's protocol, file formats, sample pipeline and mock device: no DOM. Moved verbatim out of the old
// editor.html (between PROTO-BEGIN and PROTO-END, before the React editor); web/test_web.mjs runs this file in a vm context (the export
// list at the end is stripped there), the React editor imports it.
/*PROTO-BEGIN*/
/* ------------------------------------------------------------------- types --- */
/* (types only: erased when Node strips them) */
/** a request: [cmd, data bytes] (req.*) */
export type Req = [cmd: number, args: number[]]
/** Link.request's options */
export interface RequestOpt {
  timeout?: number
  retries?: number
  key?: string
  front?: boolean
  quiet?: boolean
}
/** a request function (Link.request bound): -> the reply's data bytes */
export type Rq = (r: Req, opt?: RequestOpt) => Promise<number[]>
/** an editor frame, unframed: {cmd, a: the data bytes} */
export interface Frame {
  cmd: number
  a: number[]
}
/** bytes as they come: an array, a typed array */
export type Bytes = number[] | Uint8Array
/** INFO: the firmware */
export interface DevInfo {
  version: string
  nengines: number
  pcount: number
  gcount: number
  nstep: number
  pe0: number
  engines: string[]
  ntrk: number
  proto: number
}
/** DESC: one parameter */
export interface ParamDesc {
  scope: number
  id: number
  fmt: number
  min: number
  max: number
  def: number
  label: string
  unit: string
  names: string[]
}
/** what fmtValue needs of a parameter */
export type FmtDesc = Pick<ParamDesc, 'fmt' | 'min' | 'max' | 'unit'> & {
  names?: string[] | null
}
/** GET / SET / CHANGED: one value */
export interface ParamValue {
  scope: number
  id: number
  value: number
}
/** DUMP: the selected track's sound */
export interface Dump {
  engine: number
  preset: number
  p: number[]
  g: number[]
}
/** a sequencer step (STEP_GET / STEP_SET; time 0 note, 1 tie, 2 rest; flags 1 accent 2 slide; lvl / rat: v5, 2 bits per note) */
export interface Step {
  n: number
  notes: number[]
  time: number
  flags: number
  vel: number
  lvl?: number
  rat?: number
}
export interface StepReply extends Step {
  index: number
}
export interface TrackStepReply extends StepReply {
  track: number
}
/** a drum step: the lanes on (16 bits), their levels and ratchets */
export interface DrumStep {
  on: number
  lvl: number[]
  rat: number[]
}
export interface DrumStepReply extends DrumStep {
  index: number
}
/** an rc reply (SMP_*, UP_PUT ...) */
export interface SlotRc {
  slot: number
  rc: number
}
export interface SmpWriteReply extends SlotRc {
  offset: number
}
export interface SmpSlotInfo {
  zones: number
  name: string
  kib: number
}
export interface SmpInfo {
  nslots: number
  slotKiB: number
  slots: SmpSlotInfo[]
}
export interface ProjectReply {
  op: number
  slot: number
  used: number
  busy: boolean
}
export interface NamesReply {
  engine: number
  names: string[]
  titles: string[]
}
/** a user preset slot (UP_LIST) */
export interface UpSlot {
  slot: number
  used: number
  engine: number
  name: string
}
export interface UpList {
  start: number
  count: number
  total: number
  slots: UpSlot[]
}
/** a 16-step pattern: [note, flags] each */
export type PatStep = number[]
export interface UpGet {
  slot: number
  used: number
  engine: number
  name: string
  p: number[]
  pattern: PatStep[]
}
export interface ReloadPush {
  engine: number
  preset: number
  track: number
}
export interface StepChangedPush {
  index: number
  track: number
}
/** TRACK: a track (engine === NENGINES: the drum track); pan / e0 filled in by mixer.read */
export interface TrackState {
  engine: number
  preset: number
  level: number
  mute: number
  armed: number
  pan?: number | null
  e0?: number
}
export interface TrackReply {
  sel: number
  ntrk: number
  tracks: TrackState[]
  solo: number
}
export interface TrackMix {
  track: number
  level: number
  mute: number
}
export interface TrackDump {
  track: number
  engine: number
  preset: number
  p: number[]
}
export interface TrackParam {
  track: number
  id: number
  value: number
}
/** LIVE: the live state (firmware editor_live.c) */
export interface LiveTrack {
  step: number
  len: number
  meter: number
}
export interface LiveState {
  op: number
  playing: boolean
  asked: boolean
  songMode: boolean
  songRuns: boolean
  fillNow: boolean
  fillBar: boolean
  songRec: boolean
  recWait: boolean
  canUndo: boolean
  canRedo: boolean
  freeTake: boolean
  bpm: number
  sec: number
  next: number
  chainN: number
  chainI: number
  mutes: number
  solo: number
  rec: number
  sel: number
  fx: number
  cpu: number
  songAt: number
  songLen: number
  songBar: number
  songBars: number
  ready: number
  tracks: LiveTrack[]
  pro?: boolean
  master?: number
  throws?: number
  dtw?: { tune: number; dec: number }[]
}
export interface BkItem {
  id: number
  len: number
  crc: number
}
export interface BkList {
  rc: number
  items: BkItem[]
}
export interface BkGet {
  id: number
  rc: number
  off: number
  count: number
  data: Uint8Array
}
export interface BkPut {
  op: number
  id: number
  rc: number
}
export interface Lock {
  step: number
  param: number
  value: number
}
export interface LockGet {
  track: number
  locks: Lock[]
}
export interface LockSet {
  track: number
  step: number
  param: number
  rc: number
  has: number
  value: number | null
}
export interface MicroGet {
  track: number
  micro: number[]
}
export interface MicroSet {
  track: number
  step: number
  micro: number
}
export interface FillGet {
  track: number
  fill: number[]
}
export interface FillSet {
  track: number
  step: number
  cond: number
}
export interface Fm6Get {
  target: number
  index: number
  rc: number
  packed: number[] | null
}
export interface Fm6Put {
  target: number
  index: number
  rc: number
}
export interface Fm6List {
  factory: number
  bank: number
  slots: { used: number; name: string }[]
}
export interface DsynList {
  factory: number
  user: number
  stored: boolean
  names: string[]
  kits: { name: string; src: number }[]
}
export interface DsynGet {
  which: number
  rc: number
  name?: string
  crush?: number
  src?: number
  sounds?: Uint8Array[]
}
/** the reply parsers by command (parse[CMD.X](a)) */
export interface Parsers {
  [k: number]: (a: number[], info?: any) => unknown
  1(a: number[]): DevInfo
  2(a: number[]): ParamValue
  3(a: number[]): ParamValue
  4(a: number[], info: Pick<DevInfo, 'pcount' | 'gcount'>): Dump
  5(a: number[]): ParamDesc
  6(a: number[]): StepReply
  7(a: number[]): StepReply
  8(a: number[]): { engine: number; preset: number }
  9(a: number[]): ProjectReply
  10(a: number[]): NamesReply
  11(a: number[]): SlotRc
  12(a: number[]): SmpWriteReply
  13(a: number[]): SlotRc
  14(a: number[]): SlotRc
  15(a: number[]): SmpInfo
  16(a: number[]): UpList
  17(a: number[], info: Pick<DevInfo, 'pcount'>): UpGet
  18(a: number[]): SlotRc
  19(a: number[]): SlotRc
  20(a: number[]): SlotRc
  21(a: number[]): SlotRc
  22(a: number[]): { on: number }
  23(a: number[]): ParamValue
  24(a: number[]): ReloadPush
  25(a: number[]): Record<string, never>
  26(a: number[]): StepChangedPush
  27(a: number[]): TrackReply
  28(a: number[]): TrackMix
  29(a: number[], info: Pick<DevInfo, 'pcount'>): TrackDump
  30(a: number[]): TrackStepReply
  31(a: number[]): TrackParam
  32(a: number[]): TrackParam
  33(a: number[]): DrumStepReply
  34(a: number[]): BkList
  35(a: number[]): BkGet
  36(a: number[]): BkPut
  37(a: number[]): LockGet
  38(a: number[]): LockSet
  39(a: number[]): MicroGet
  40(a: number[]): MicroSet
  41(a: number[]): FillGet
  42(a: number[]): FillSet
  68(a: number[]): Fm6Get
  69(a: number[]): Fm6Put
  70(a: number[]): Fm6List
  71(a: number[]): { index: number; rc: number }
  72(a: number[]): DsynList
  73(a: number[]): DsynGet
  74(a: number[]): { k: number; part: number; rc: number }
  75(a: number[]): { rc: number }
  76(a: number[]): { k: number; lane: number; rc: number }
  77(a: number[]): LiveState
}
/** a parameter's values by id (a sparse record) */
export type IdValues = Record<number, number>
/** LVX: a scene's track / a scene */
export interface SceneTrackIn {
  level?: number
  mute?: number | boolean
  engine?: number
  preset?: number
  kit?: number | null
  p?: Record<number, number | null | undefined>
}
export interface SceneTrack {
  level: number
  mute: number
  engine: number
  preset: number
  kit: number | null
  p: IdValues
  e: (number | null)[]
}
export interface Scene {
  v: number
  tracks: SceneTrack[]
  g: IdValues
  bpm: number | null
  sounds: boolean
  tempo: boolean
}
export interface SceneMix {
  tracks: {
    level: number
    mute: number
    p: IdValues
    e: (number | null)[] | null
  }[]
  g: IdValues
}
/** LVX.midiKey: a learned MIDI message */
export interface MidiKey {
  key: string
  kind: 'cc' | 'note'
  value: number
  on: boolean
  raw: number
}
/* the device the page talks to, when there is one (lockable's default pe0) */
declare const dev: { info?: DevInfo | null } | null | undefined
/* ---------------------------------------------------------------- protocol --- */
const HDR = [0x7d, 0x46, 0x4c]
const CMD = {
  INFO: 1,
  GET: 2,
  SET: 3,
  DUMP: 4,
  DESC: 5,
  STEP_GET: 6,
  STEP_SET: 7,
  PRESET: 8,
  PROJECT: 9,
  NAMES: 10,
  SMP_BEGIN: 11,
  SMP_WRITE: 12,
  SMP_END: 13,
  SMP_ERASE: 14,
  SMP_INFO: 15,
  UP_LIST: 16,
  UP_GET: 17,
  UP_PUT: 18,
  UP_STORE: 19,
  UP_LOAD: 20,
  UP_ERASE: 21,
  WATCH: 22,
  CHANGED: 23,
  RELOAD: 24,
  PING: 25,
  STEP_CHANGED: 26,
  TRACK: 27,
  TRACK_MIX: 28,
  TRACK_DUMP: 29,
  TRACK_STEP: 30,
  TRACK_PARAM: 31,
  TRACK_CHANGED: 32,
  DRUM_STEP: 33,
  BK_LIST: 34,
  BK_GET: 35,
  BK_PUT: 36 /* v6: backup / restore */,
  LOCK_GET: 37,
  LOCK_SET: 38,
  MICRO_GET: 39,
  MICRO_SET: 40 /* v7 (SLOOP 2.4): parameter locks, nudges */,
  FILL_GET: 41,
  FILL_SET: 42 /* v8 (SLOOP 2.4): the steps' fill conditions */,
  FM6_GET: 68,
  FM6_PUT: 69,
  FM6_LIST: 70,
  FM6_ERASE: 71 /* v9 (SLOOP 2.4): the FM6 engine's patches (Felucca 1.0's numbers) */,
  DSYN_LIST: 72,
  DSYN_GET: 73,
  DSYN_PUT: 74,
  DSYN_STORE: 75,
  DSYN_PLAY: 76 /* v10 (SLOOP 2.5): the SYN drum kits */,
  LIVE: 77,
} as const /* v12 (SLOOP 2.7): the LIVE page (firmware editor_live.c) */
/* v12: LIVE ops (firmware editor_live.c) and the layers its keys reach (seq.c LY_*: 5 SEL, 6 GLO, 7 SAVE) */
const LIVE = {
  STATE: 0,
  PLAY: 1,
  KEY: 2,
  FX: 3,
  REC: 4,
  UNDO: 5,
  LY_KEY: 5,
  LY_MIX: 6,
  LY_SONG: 7,
  NFX: 27,
  /* (2.7) the page's own (editor_live.c 6..12): ROLL and ERASE while held, the pattern's tools, a chain of sections, THROW,
     the master level, a drum sound's TUNE / DECAY; a state with them is 50 bytes (s.pro) */
  ROLL: 6,
  ERASE: 7,
  PATTERN: 8,
  CHAIN: 9,
  THROW: 10,
  MASTER: 11,
  DRUM_TW: 12,
  CHAIN_MAX: 8,
  /* v13 (BoopBox): tracks 5..8 in the state (65 bytes), SOLO_TRK solos any track (GLO keys solo the selected one's bank) */
  SOLO_TRK: 13,
  /* the 27 punch-in effects (punch.c PUNCH_NAME): 16 on the white keys, 11 on the black keys */
  FX_NAMES: [
    'LOOP 4',
    'LOOP 8',
    'LOOP 16',
    'LOOP 32',
    'STUTTER',
    'REVERSE',
    'STOP',
    'HALF',
    'LOW',
    'HIGH',
    'PHONE',
    'CRUSH',
    'ALIAS',
    'GATE',
    'ECHO',
    'WOBBLE',
    'KILL LOW',
    'KILL MID',
    'KILL HIGH',
    'REWIND',
    'OCT UP',
    'FLANGER',
    'AUTO-PAN',
    'FREEZE',
    'LOOP 8T',
    'MONO',
    'FADE OUT',
  ],
  /* the GLO keys (ui_layers.c layer_key): 1..4 mute, 5..8 solo, 9 fill while held, 10 fill next bar, 16 tap tempo;
     the SAVE keys: 1..4 play A..D, 5..8 store into A..D, 13 loop / song, 14 SONG REC */
  MUTE: 0,
  SOLO: 4,
  FILL: 8,
  FILL_BAR: 9,
  TAP: 15,
  SEC: 0,
  STORE: 4,
  SONG: 12,
  SONG_REC: 13,
}
/* ---- LIVE pro (editor only: the 2.7 firmware as it is, every value through TRACK_MIX / TRACK_PARAM / SET).
   Scenes: what a track and the master sound like, kept in the browser, recalled at once or morphed over bars, or mixed
   with the A / B crossfader. Ids: core.h P_* and G_* (2.7: P_E0 = 63). cont: values that glide in a morph; the others
   (switches, lists) change at its start. A track's engine values (E0..E7) come back only onto the same engine */
const LVX = {
  /* per track: pan, filter, sends, drive, the sound's FLT PIT SHP, the envelope, glide, LFO, the INSERT, the arp */
  TP: [
    39, 50, 36, 35, 34, 33, 5, 6, 7, 1, 2, 3, 4, 38, 9, 13, 14, 15, 16, 53, 54,
    55, 56, 57, 17, 18, 19, 20, 21, 23, 24,
  ],
  TP_STEP: [
    53, 17, 18, 19, 23, 24,
  ] /* INSERT TYPE, arp MODE RATE OCT HOLD ORD: switched, not glided */,
  /* the master: FILT DUST DUCK, the drums' REV DLY, the delay (TIME is a list), the reverb, the chorus, TEXTURE, SWING */
  GP: [
    29, 27, 28, 26, 32, 4, 5, 6, 7, 8, 9, 10, 11, 37, 38, 39, 40, 41, 42, 43, 1,
  ],
  GP_STEP: [4, 37, 41, 42, 43],
  BPM: 0,
  E0: 63,
  NE: 8,
  NSCENE: 8,
  MORPH_BARS: [0, 1, 2, 4, 8, 16],
  /* a scene from the page's values: tracks [{level, mute, engine, preset, p: {id: v}, e: [8]}], g: {id: v}, bpm */
  capture(
    tracks: SceneTrackIn[],
    g: Record<number, number | null | undefined>,
    opt: { sounds?: boolean; tempo?: boolean } = {},
  ): Scene {
    return {
      v: 1,
      tracks: tracks.map((o) => ({
        level: o.level ?? 0,
        mute: o.mute ? 1 : 0,
        engine: o.engine ?? 0,
        preset: o.preset ?? 0,
        kit: o.kit ?? null,
        p: Object.fromEntries(
          LVX.TP.filter((id) => o.p && o.p[id] != null).map((id) => [
            id,
            o.p![id],
          ]),
        ) as IdValues,
        e: Array.from({ length: LVX.NE }, (_, k) =>
          o.p && o.p[LVX.E0 + k] != null ? o.p[LVX.E0 + k]! : null,
        ),
      })),
      g: Object.fromEntries(
        LVX.GP.filter((id) => g[id] != null).map((id) => [id, g[id]]),
      ) as IdValues,
      bpm: g[LVX.BPM] ?? null,
      sounds: !!opt.sounds,
      tempo: !!opt.tempo,
    }
  },
  /* the values f (0..1) of the way from a to b: glided ones in between (rounded), switched ones b's as soon as f > 0.
     -> {tracks: [{level, mute, p: {id: v}, e: [] | null}], g: {id: v}} (only what both scenes have) */
  mix(
    a: Pick<Scene, 'tracks' | 'g'>,
    b: Pick<Scene, 'tracks' | 'g'>,
    f: number,
  ): SceneMix {
    f = Math.max(0, Math.min(1, f))
    const lerp = (x: number, y: number) => Math.round(x + (y - x) * f),
      sw = (x: number, y: number) => (f > 0 ? y : x)
    const out: SceneMix = { tracks: [], g: {} }
    const n = Math.min(a.tracks.length, b.tracks.length)
    for (let i = 0; i < n; i++) {
      const ta = a.tracks[i],
        tb = b.tracks[i],
        p: IdValues = {}
      for (const id of LVX.TP) {
        if (ta.p[id] == null || tb.p[id] == null) continue
        p[id] = LVX.TP_STEP.includes(id)
          ? sw(ta.p[id], tb.p[id])
          : lerp(ta.p[id], tb.p[id])
      }
      const sameEngine = ta.engine === tb.engine
      out.tracks.push({
        level: lerp(ta.level, tb.level),
        mute: f >= 1 ? tb.mute : f > 0 ? (ta.mute && tb.mute ? 1 : 0) : ta.mute,
        p,
        e: sameEngine
          ? ta.e.map((x, k) =>
              x == null || tb.e[k] == null ? null : lerp(x, tb.e[k]),
            )
          : null,
      })
    }
    for (const id of LVX.GP) {
      if (a.g[id] == null || b.g[id] == null) continue
      out.g[id] = LVX.GP_STEP.includes(id)
        ? sw(a.g[id], b.g[id])
        : lerp(a.g[id], b.g[id])
    }
    return out
  },
  /* a morph's length in ms: bars of 4 beats at bpm (0 bars: at once) */
  morphMs: (bars: number, bpm: number) =>
    bars > 0 ? Math.round((bars * 4 * 60000) / Math.max(20, bpm || 120)) : 0,
  /* MIDI learn: an incoming message -> {key, kind: "cc" | "note", value 0..1, on} (key: "cc:ch:num" / "note:ch:num");
     null for what cannot drive a control (clock, SysEx, aftertouch...) */
  midiKey(d: Bytes | null | undefined): MidiKey | null {
    if (!d || d.length < 3) return null
    const st = d[0] & 0xf0,
      ch = d[0] & 15
    if (st === 0xb0)
      return {
        key: `cc:${ch}:${d[1]}`,
        kind: 'cc',
        value: d[2] / 127,
        on: d[2] >= 64,
        raw: d[2],
      }
    if (st === 0x90 && d[2] > 0)
      return {
        key: `note:${ch}:${d[1]}`,
        kind: 'note',
        value: d[2] / 127,
        on: true,
        raw: d[2],
      }
    if (st === 0x80 || (st === 0x90 && d[2] === 0))
      return {
        key: `note:${ch}:${d[1]}`,
        kind: 'note',
        value: 0,
        on: false,
        raw: 0,
      }
    return null
  },
  /* a control's value from a learned message: a knob / fader takes the CC's (or the note's velocity) as min..max */
  midiValue: (m: Pick<MidiKey, 'value'>, min: number, max: number) =>
    Math.round(min + m.value * (max - min)),
  /* a WAV file (16-bit PCM, interleaved) from Int16Array chunks */
  wav(chunks: ArrayLike<number>[], rate: number, ch = 2) {
    const n = chunks.reduce((s, c) => s + c.length, 0),
      buf = new ArrayBuffer(44 + 2 * n),
      v = new DataView(buf)
    const str = (o: number, s: string): void => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
    }
    str(0, 'RIFF')
    v.setUint32(4, 36 + 2 * n, true)
    str(8, 'WAVE')
    str(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, ch, true)
    v.setUint32(24, rate, true)
    v.setUint32(28, rate * ch * 2, true)
    v.setUint16(32, ch * 2, true)
    v.setUint16(34, 16, true)
    str(36, 'data')
    v.setUint32(40, 2 * n, true)
    let o = 44
    for (const c of chunks) {
      new Int16Array(buf, o, c.length).set(c)
      o += 2 * c.length
    }
    return new Uint8Array(buf)
  },
  /* float samples (-1..1) to 16 bits */
  pcm16(f: ArrayLike<number>) {
    const o = new Int16Array(f.length)
    for (let i = 0; i < f.length; i++) {
      const x = Math.max(-1, Math.min(1, f[i]))
      o[i] = x < 0 ? x * 32768 : x * 32767
    }
    return o
  },
  /* the set timer / a duration as m:ss or h:mm:ss */
  clock(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000)),
      h = Math.floor(s / 3600),
      m = Math.floor(s / 60) % 60,
      x = String(s % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`
  },
}
/* v7: the parameters a step can lock (firmware seq.c p_lockable: the sound, not the sequencer / arp / key / voice
   mode); ids as core.h: LEVEL .. LFO dests, GATE, the sends, GLIDE, PAN, DETUNE, the SLICER, FILTER, the engine's 8;
   from 2.6 (pe0 63) also the INSERT's A B C and MIX (54..57). pe0: the device's (the newest when none) */
const lockable = (
  id: number,
  pe0: number = typeof dev !== 'undefined' && dev && dev.info
    ? dev.info.pe0
    : 63,
) =>
  id <= 16 ||
  id === 32 ||
  (id >= 33 && id <= 36) ||
  id === 38 ||
  id === 39 ||
  id === 44 ||
  (id >= 45 && id <= 48) ||
  id === 50 ||
  (pe0 >= 63 && id >= 54 && id <= 57) ||
  (id >= pe0 && id <= pe0 + 7)
const MICRO = {
  MIN: -32,
  MAX: 31,
} /* a step's nudge in 1/64 of a step (- early, + late), sent + 64 */
/* v8: a step's fill condition (firmware core.h FC_*): 0 normal, 1 plays only during a fill, 2 silent during one; 2 bits a
   step, 4 steps a byte (step i: byte i >> 2, bits 2 (i & 3)..), the 16 bytes sent pack7 */
const FC = {
  NORM: 0,
  FILL: 1,
  NOFILL: 2,
  NAMES: ['normal', 'fill only', 'no fill'],
}
const fillGet = (bytes: ArrayLike<number>, i: number) =>
  ((bytes[i >> 2] || 0) >> (2 * (i & 3))) & 3
const fillSet = (bytes: number[] | Uint8Array, i: number, c: number): void => {
  bytes[i >> 2] =
    (bytes[i >> 2] & ~(3 << (2 * (i & 3)))) | ((c & 3) << (2 * (i & 3)))
}
/* frames the device sends on its own (while WATCH is on); never replies */
const PUSH = new Set<number>([
  CMD.CHANGED,
  CMD.RELOAD,
  CMD.STEP_CHANGED,
  CMD.TRACK_CHANGED,
])
/* user preset bank: name 1..12 printable ASCII, a 16-step pattern of (note, flags 1 acc 2 slide 4 tie) */
const UP = { NAME_MAX: 12, PAT: 16, LIST_MAX: 16 }
const F = {
  INT: 0,
  PCT: 1,
  BIPCT: 2,
  TIME: 3,
  LFOHZ: 4,
  CUTOFF: 5,
  DB: 6,
  SEMI: 7,
  ENUM: 8,
  BPM: 9,
  NOTE: 10,
  ONOFF: 11,
  OCT: 12,
  STEPS: 13,
  SWING: 14,
  FILT: 15,
}
/* v5 (SLOOP 2.0): the drum track's 16 sounds (firmware drums.c LANE_NOTE / LANE_NAME), one per white key
   F3..G5; a hit has a level (NORM, GHOST, SOFT, HARD: OCT- / OCT+ held on the device) and a ratchet x1..x4 */
const DRUM_LANES: [note: number, name: string][] = [
  [36, 'KICK'],
  [35, 'KICK 2'],
  [38, 'SNARE'],
  [39, 'CLAP'],
  [42, 'HAT'],
  [46, 'OPEN HAT'],
  [44, 'PEDAL'],
  [37, 'RIM'],
  [40, 'SNARE 2'],
  [43, 'LOW TOM'],
  [48, 'HI TOM'],
  [49, 'CRASH'],
  [51, 'RIDE'],
  [70, 'SHAKER'],
  [63, 'CONGA'],
  [56, 'COWBELL'],
]
const LV_NAMES = ['NORM', 'GHOST', 'SOFT', 'HARD']
const LV_ORDER = [
  1, 2, 0, 3,
] /* by loudness: GHOST SOFT NORM HARD (as the device's LEVEL knob) */
/* an empty drum step: no lane on */
const emptyDrum = (): DrumStep => ({
  on: 0,
  lvl: new Array(16).fill(0),
  rat: new Array(16).fill(0),
})

const v14enc = (v: number) => {
  const u = Math.max(-8192, Math.min(8191, Math.round(v))) + 8192
  return [u & 0x7f, (u >> 7) & 0x7f]
}
const v14dec = (lo: number, hi: number) => (lo | (hi << 7)) - 8192
function strEnc(s: unknown) {
  const a: number[] = []
  for (const c of String(s)) a.push(c.charCodeAt(0) & 0x7f)
  a.push(0)
  return a
}

/* only ever builds F0 7D 46 4C ... F7 */
function frame(cmd: number, args: Bytes = []): number[] {
  for (const b of args)
    if (!(Number.isInteger(b) && b >= 0 && b <= 0x7f))
      throw new Error('bad data byte ' + b)
  return [0xf0, ...HDR, cmd & 0x7f, ...args, 0xf7]
}
/* -> {cmd, a} or null when it is not an editor frame */
function unframe(d: Bytes | null | undefined): Frame | null {
  if (!d || d.length < 6 || d[0] !== 0xf0 || d[d.length - 1] !== 0xf7)
    return null
  if (d[1] !== HDR[0] || d[2] !== HDR[1] || d[3] !== HDR[2]) return null
  return { cmd: d[4], a: Array.from(d.slice(5, d.length - 1)) }
}

class Reader {
  a: ArrayLike<number>
  i: number
  constructor(a: ArrayLike<number>) {
    this.a = a
    this.i = 0
  }
  b() {
    if (this.i >= this.a.length) throw new Error('short reply')
    return this.a[this.i++]
  }
  v() {
    const lo = this.b()
    return v14dec(lo, this.b())
  }
  s() {
    let s = ''
    for (;;) {
      const c = this.b()
      if (!c) return s
      s += String.fromCharCode(c)
    }
  }
}

/* v5 steps end with level / ratchet (2 bits per note, 7-bit bytes: lvl, hi (bit 0 lvl, bit 1 rat), rat) */
function stepExt<T extends Step>(r: Reader, a: ArrayLike<number>, o: T): T {
  if (r.i + 3 <= a.length) {
    const lo = r.b(),
      hi = r.b(),
      rt = r.b()
    o.lvl = lo | ((hi & 1) << 7)
    o.rat = rt | (((hi >> 1) & 1) << 7)
  }
  return o
}

const parse: Parsers = {
  [CMD.INFO](a) {
    const r = new Reader(a)
    const o: DevInfo = {
      version: r.s(),
      nengines: r.b(),
      pcount: r.b(),
      gcount: r.b(),
      nstep: r.b(),
      pe0: r.b(),
      engines: [],
      ntrk: 0,
      proto: 0,
    }
    for (let i = 0; i < o.nengines; i++) o.engines.push(r.s())
    o.ntrk =
      r.i < a.length
        ? r.b()
        : 0 /* v3: tracks (0 = older firmware, one instrument) */
    o.proto =
      r.i < a.length
        ? r.b()
        : 0 /* v5: the protocol version (0 = older firmware) */
    return o
  },
  [CMD.GET](a) {
    const r = new Reader(a)
    return { scope: r.b(), id: r.b(), value: r.v() }
  },
  [CMD.SET](a) {
    return parse[CMD.GET](a)
  },
  /* needs the counts from INFO */
  [CMD.DUMP](a, info) {
    const r = new Reader(a)
    const o: Dump = { engine: r.b(), preset: r.b(), p: [], g: [] }
    for (let i = 0; i < info.pcount; i++) o.p.push(r.v())
    for (let i = 0; i < info.gcount; i++) o.g.push(r.v())
    return o
  },
  [CMD.DESC](a) {
    const r = new Reader(a)
    const o: ParamDesc = {
      scope: r.b(),
      id: r.b(),
      fmt: r.b(),
      min: r.v(),
      max: r.v(),
      def: r.v(),
      label: r.s(),
      unit: r.s(),
      names: [],
    }
    if (o.fmt === F.ENUM)
      for (let i = 0; i <= o.max - o.min && i < 64 && r.i < a.length; i++)
        o.names.push(r.s())
    return o
  },
  [CMD.STEP_GET](a) {
    const r = new Reader(a)
    const o: StepReply = {
      index: r.b(),
      n: r.b(),
      notes: [r.b(), r.b(), r.b(), r.b()],
      time: r.b(),
      flags: r.b(),
      vel: r.b(),
    }
    return stepExt(r, a, o)
  },
  [CMD.STEP_SET](a) {
    return parse[CMD.STEP_GET](a)
  },
  [CMD.PRESET](a) {
    const r = new Reader(a)
    return { engine: r.b(), preset: r.b() }
  },
  [CMD.PROJECT](a) {
    const r = new Reader(a)
    return {
      op: r.b(),
      slot: r.b(),
      used: r.b(),
      busy: a.length > 3 && a[3] === 1,
    }
  },
  [CMD.NAMES](a) {
    const r = new Reader(a)
    const o: NamesReply = { engine: r.b(), names: [], titles: [] }
    const n = r.b()
    for (let i = 0; i < n; i++) o.names.push(r.s())
    o.titles = []
    try {
      o.titles.push(r.s(), r.s())
    } catch {
      o.titles = []
    } /* older firmware: no page titles */
    return o
  },
  [CMD.SMP_BEGIN](a) {
    const r = new Reader(a)
    return { slot: r.b(), rc: r.b() }
  },
  [CMD.SMP_WRITE](a) {
    const r = new Reader(a)
    return {
      slot: r.b(),
      offset: r.b() | (r.b() << 7) | (r.b() << 14),
      rc: r.b(),
    }
  },
  [CMD.SMP_END](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.SMP_ERASE](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.SMP_INFO](a) {
    const r = new Reader(a)
    const o: SmpInfo = { nslots: r.b(), slotKiB: r.b(), slots: [] }
    for (let i = 0; i < o.nslots; i++)
      o.slots.push({ zones: r.b(), name: r.s(), kib: r.b() })
    return o
  },
  [CMD.UP_LIST](a) {
    const r = new Reader(a)
    const o: UpList = { start: r.b(), count: r.b(), total: r.b(), slots: [] }
    for (let i = 0; i < o.count; i++)
      o.slots.push({
        slot: o.start + i,
        used: r.b(),
        engine: r.b(),
        name: r.s(),
      })
    return o
  },
  /* needs P_COUNT from INFO */
  [CMD.UP_GET](a, info) {
    const r = new Reader(a)
    const o: UpGet = {
      slot: r.b(),
      used: r.b(),
      engine: r.b(),
      name: r.s(),
      p: [],
      pattern: [],
    }
    for (let i = 0; i < info.pcount; i++) o.p.push(r.v())
    for (let i = 0; i < UP.PAT; i++) o.pattern.push([r.b(), r.b()])
    return o
  },
  [CMD.UP_PUT](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.UP_STORE](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.UP_LOAD](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.UP_ERASE](a) {
    return parse[CMD.SMP_BEGIN](a)
  },
  [CMD.WATCH](a) {
    return { on: new Reader(a).b() }
  },
  [CMD.CHANGED](a) {
    return parse[CMD.GET](a)
  },
  [CMD.RELOAD](a) {
    const r = new Reader(a)
    return { engine: r.b(), preset: r.b(), track: r.i < a.length ? r.b() : 0 }
  },
  [CMD.PING](_a) {
    return {}
  },
  [CMD.STEP_CHANGED](a) {
    const r = new Reader(a)
    return { index: r.b(), track: r.i < a.length ? r.b() : 0 }
  },
  /* v3: tracks. engine === NENGINES: the drum track */
  [CMD.TRACK](a) {
    const r = new Reader(a)
    const o: TrackReply = { sel: r.b(), ntrk: r.b(), tracks: [], solo: 0 }
    for (let i = 0; i < o.ntrk; i++)
      o.tracks.push({
        engine: r.b(),
        preset: r.b(),
        level: r.v(),
        mute: r.b(),
        armed: r.b(),
      })
    o.solo =
      r.i < a.length ? r.b() : 0 /* v5: the tracks soloed (bit per track) */
    if (r.i < a.length)
      o.solo |= r.b() << 7 /* (eight tracks: track 8's in a byte of its own) */
    return o
  },
  [CMD.TRACK_MIX](a) {
    const r = new Reader(a)
    return { track: r.b(), level: r.v(), mute: r.b() }
  },
  /* v12: the live state (firmware editor_live.c): per track its step, its length and its meter (8 log2 |peak|: 48 = -54 dB,
     128 = +6 dB, 0 = silent) */
  [CMD.LIVE](a) {
    const r = new Reader(a)
    const op = r.b(),
      f = r.b(),
      f2 = r.b()
    const o: LiveState = {
      op,
      playing: !!(f & 1),
      asked: !!(f & 2),
      songMode: !!(f & 4),
      songRuns: !!(f & 8),
      fillNow: !!(f & 16),
      fillBar: !!(f & 32),
      songRec: !!(f & 64),
      recWait: !!(f2 & 1),
      canUndo: !!(f2 & 2),
      canRedo: !!(f2 & 4),
      freeTake: !!(f2 & 8),
      bpm: r.v(),
      sec: r.b() - 1,
      next: r.b() - 1,
      chainN: r.b(),
      chainI: r.b(),
      mutes: r.b(),
      solo: r.b(),
      rec: r.b(),
      sel: r.b(),
      fx: r.b() - 1,
      cpu: r.b(),
      songAt: r.b(),
      songLen: r.b(),
      songBar: r.b(),
      songBars: r.b(),
      ready: r.b(),
      tracks: [],
    }
    for (let k = 0; k < 4 && r.i + 3 <= a.length; k++)
      o.tracks.push({ step: r.b(), len: r.b(), meter: r.b() })
    if (r.i + 18 <= a.length) {
      /* (2.7, ops 6..12) the master, the THROWs, the drum sounds' TUNE / DECAY */
      const m = r.b()
      o.pro = true
      o.master = m ? m - 1 : -1
      o.throws = r.b()
      o.dtw = Array.from({ length: 16 }, () => {
        const v = r.b()
        return { tune: (v & 15) - 8, dec: ((v >> 4) & 7) - 4 }
      })
    }
    if (r.i + 15 <= a.length) {
      /* v13 (BoopBox): tracks 5..8 (the bytes before hold 1..4 in bits 0..3) */
      o.mutes = (o.mutes & 15) | (r.b() << 4)
      o.solo = (o.solo & 15) | (r.b() << 4)
      o.rec = (o.rec & 15) | (r.b() << 4)
      for (let k = 0; k < 4; k++)
        o.tracks.push({ step: r.b(), len: r.b(), meter: r.b() })
    }
    return o
  },
  [CMD.TRACK_DUMP](a, info) {
    const r = new Reader(a)
    const o: TrackDump = { track: r.b(), engine: r.b(), preset: r.b(), p: [] }
    for (let i = 0; i < info.pcount; i++) o.p.push(r.v())
    return o
  },
  [CMD.TRACK_STEP](a) {
    const r = new Reader(a)
    return stepExt<TrackStepReply>(r, a, {
      track: r.b(),
      index: r.b(),
      n: r.b(),
      notes: [r.b(), r.b(), r.b(), r.b()],
      time: r.b(),
      flags: r.b(),
      vel: r.b(),
    })
  },
  /* v6: backup. LIST: rc, then per object id, length, CRC-32 (5 x 7 bit each) */
  [CMD.BK_LIST](a) {
    const r = new Reader(a),
      rc = r.b(),
      n = r.b(),
      items = []
    for (let i = 0; i < n; i++)
      items.push({ id: r.b(), len: u35dec(r), crc: u35dec(r) >>> 0 })
    return { rc, items }
  },
  [CMD.BK_GET](a) {
    const r = new Reader(a),
      id = r.b(),
      rc = r.b(),
      off = u35dec(r),
      count = r.b() | (r.b() << 7)
    return { id, rc, off, count, data: unpack7(a.slice(r.i)) }
  },
  [CMD.BK_PUT](a) {
    const r = new Reader(a)
    return { op: r.b(), id: r.b(), rc: r.b() }
  },
  /* v5: the drum track's step: the lanes on (16 bits), their levels and ratchets (2 bits each) */
  [CMD.DRUM_STEP](a) {
    const r = new Reader(a)
    const o: DrumStepReply = {
      index: r.b(),
      on: r.b() | (r.b() << 7) | ((r.b() & 3) << 14),
      lvl: [],
      rat: [],
    }
    let lv = 0,
      rt = 0
    for (let k = 0; k < 5; k++) lv += r.b() * 2 ** (7 * k)
    for (let k = 0; k < 5; k++) rt += r.b() * 2 ** (7 * k)
    for (let l = 0; l < 16; l++) {
      const on = (o.on >> l) & 1
      o.lvl.push(on ? Math.floor(lv / 4 ** l) % 4 : 0)
      o.rat.push(on ? Math.floor(rt / 4 ** l) % 4 : 0)
    }
    return o
  },
  /* v4: a parameter of any track (the selection stays), and its push for a track that is not selected */
  [CMD.TRACK_PARAM](a) {
    const r = new Reader(a)
    return { track: r.b(), id: r.b(), value: r.v() }
  },
  [CMD.TRACK_CHANGED](a) {
    return parse[CMD.TRACK_PARAM](a)
  },
  /* v7: a track's parameter locks: n x {step, param, value}; a set: rc (0 ok, 1 arguments, 2 not lockable, 3 full) */
  [CMD.LOCK_GET](a) {
    const r = new Reader(a),
      o: LockGet = { track: r.b(), locks: [] },
      n = r.b()
    for (let i = 0; i < n; i++)
      o.locks.push({ step: r.b(), param: r.b(), value: r.v() })
    return o
  },
  [CMD.LOCK_SET](a) {
    const r = new Reader(a)
    const o: LockSet = {
      track: r.b(),
      step: r.b(),
      param: r.b(),
      rc: r.b(),
      has: r.b(),
      value: null,
    }
    o.value = r.v()
    if (!o.has) o.value = null
    return o
  },
  /* v7: a track's nudges (NSTEP bytes, each + 64) */
  [CMD.MICRO_GET](a) {
    const r = new Reader(a),
      o: MicroGet = { track: r.b(), micro: [] }
    while (r.i < a.length) o.micro.push(r.b() - 64)
    return o
  },
  [CMD.MICRO_SET](a) {
    const r = new Reader(a)
    return { track: r.b(), step: r.b(), micro: r.b() - 64 }
  },
  /* v8: a track's fill conditions (16 bytes, pack7; 3 reads as normal) and a set */
  [CMD.FILL_GET](a) {
    const r = new Reader(a),
      o: FillGet = { track: r.b(), fill: [] }
    o.fill = Array.from(unpack7(a.slice(r.i))).slice(0, 16)
    while (o.fill.length < 16) o.fill.push(0)
    return o
  },
  [CMD.FILL_SET](a) {
    const r = new Reader(a)
    return { track: r.b(), step: r.b(), cond: r.b() % 3 }
  },
  /* v9 FM6 patches: target 0 a track (0..2), 1 a bank slot, 2 a factory patch; packed: the 128-byte record */
  [CMD.FM6_GET](a) {
    return {
      target: a[0],
      index: a[1],
      rc: a[2],
      packed: a[2] ? null : a.slice(3, 3 + 128),
    }
  },
  [CMD.FM6_PUT](a) {
    return { target: a[0], index: a[1], rc: a[2] }
  },
  [CMD.FM6_LIST](a) {
    const r = new Reader(a),
      o: Fm6List = { factory: r.b(), bank: r.b(), slots: [] }
    for (let i = 0; i < o.factory + o.bank; i++) {
      const used = r.b()
      o.slots.push({ used, name: used ? r.s() : (r.b(), '') })
    }
    return o
  },
  [CMD.FM6_ERASE](a) {
    return { index: a[0], rc: a[1] }
  },
  /* v10: the SYN drum kits (editor_dsyn.c) */
  [CMD.DSYN_LIST](a) {
    const r = new Reader(a),
      o: DsynList = {
        factory: r.b(),
        user: r.b(),
        stored: !!r.b(),
        names: [],
        kits: [],
      }
    for (let i = 0; i < o.factory; i++) o.names.push(r.s())
    for (let i = 0; i < o.user; i++) o.kits.push({ name: r.s(), src: r.b() })
    return o
  },
  [CMD.DSYN_GET](a) {
    const r = new Reader(a),
      o: DsynGet = { which: r.b(), rc: r.b() }
    if (o.rc) return o
    o.name = r.s()
    const d = unpack7(a.slice(r.i))
    o.crush = d[0]
    o.src = d[1]
    o.sounds = Array.from({ length: DSYN.LANES }, (_, l) =>
      d.slice(2 + l * DSYN.SIZE, 2 + (l + 1) * DSYN.SIZE),
    )
    if (d.length < 2 + DSYN.LANES * DSYN.SIZE) o.rc = 2
    return o
  },
  [CMD.DSYN_PUT](a) {
    return { k: a[0], part: a[1], rc: a[2] }
  },
  [CMD.DSYN_STORE](a) {
    return { rc: a[0] }
  },
  [CMD.DSYN_PLAY](a) {
    return { k: a[0], lane: a[1], rc: a[2] }
  },
}

/* a name the device accepts: printable ASCII, 1..12 characters */
function upName(s: unknown) {
  return (
    String(s ?? '')
      .replace(/[^\x20-\x7E]/g, '')
      .trim()
      .slice(0, UP.NAME_MAX) || 'PATCH'
  )
}

/** a patch as UP_PUT writes it */
export interface PatchIn {
  engine: number
  name?: unknown
  p: (number | null | undefined)[]
  pattern?: PatStep[] | null
}
const req = {
  info: (): Req => [CMD.INFO, []],
  get: (scope: number, id: number): Req => [CMD.GET, [scope, id]],
  set: (scope: number, id: number, v: number): Req => [
    CMD.SET,
    [scope, id, ...v14enc(v)],
  ],
  dump: (): Req => [CMD.DUMP, []],
  desc: (scope: number, id: number): Req => [CMD.DESC, [scope, id]],
  stepGet: (i: number): Req => [CMD.STEP_GET, [i]],
  stepSet: (i: number, st: Step): Req => {
    const n = Math.max(0, Math.min(4, st.n | 0))
    const notes = [0, 1, 2, 3].map((k) => (st.notes[k] | 0) & 0x7f)
    const ext =
      st.lvl == null && st.rat == null
        ? [] /* v5: level / ratchet kept (older firmware ignores them) */
        : [
            ((st.lvl ?? 0) | 0) & 0x7f,
            ((((st.lvl ?? 0) | 0) >> 7) & 1) |
              (((((st.rat ?? 0) | 0) >> 7) & 1) << 1),
            ((st.rat ?? 0) | 0) & 0x7f,
          ]
    return [
      CMD.STEP_SET,
      [
        i,
        n,
        ...notes,
        Math.max(0, Math.min(2, st.time | 0)),
        st.flags & 3,
        (st.vel | 0) & 0x7f,
        ...ext,
      ],
    ]
  },
  /* v5: get (d == null) or set the drum track's step i: {on: 16 bits, lvl[16], rat[16]} */
  drumStep: (i: number, d?: DrumStep | null): Req => {
    if (!d) return [CMD.DRUM_STEP, [i & 0x7f]]
    let lv = 0,
      rt = 0
    for (let l = 0; l < 16; l++)
      if ((d.on >> l) & 1) {
        lv += ((d.lvl[l] | 0) & 3) * 4 ** l
        rt += ((d.rat[l] | 0) & 3) * 4 ** l
      }
    const g7 = (x: number, n: number) =>
      Array.from({ length: n }, (_, k) => Math.floor(x / 2 ** (7 * k)) & 0x7f)
    return [
      CMD.DRUM_STEP,
      [i & 0x7f, ...g7(d.on & 0xffff, 3), ...g7(lv, 5), ...g7(rt, 5)],
    ]
  },
  preset: (e: number, p: number): Req => [CMD.PRESET, [e & 0x7f, p & 0x7f]],
  project: (op: number, slot: number): Req => {
    if (![0, 1, 2].includes(op)) throw new Error('bad PROJECT op')
    return [CMD.PROJECT, [op, slot & 3]]
  } /* 0 load, 1 save, 2 query */,
  names: (e: number): Req => [CMD.NAMES, [e & 0x7f]],
  smpBegin: (s: number): Req => [CMD.SMP_BEGIN, [s & 0x7f]],
  smpWrite: (s: number, off: number, bytes: Bytes): Req => [
    CMD.SMP_WRITE,
    [
      s & 0x7f,
      off & 0x7f,
      (off >> 7) & 0x7f,
      (off >> 14) & 0x7f,
      ...pack7(bytes),
    ],
  ],
  smpEnd: (s: number, hdr: Bytes): Req => [
    CMD.SMP_END,
    [s & 0x7f, ...pack7(hdr)],
  ],
  smpErase: (s: number): Req => [CMD.SMP_ERASE, [s & 0x7f]],
  smpInfo: (): Req => [CMD.SMP_INFO, []],
  upList: (start: number, count: number): Req => [
    CMD.UP_LIST,
    [start & 0x7f, Math.max(1, Math.min(UP.LIST_MAX, count | 0))],
  ],
  upGet: (s: number): Req => [CMD.UP_GET, [s & 0x7f]],
  /* patch: {engine, name, p: P_COUNT values, pattern: 16 x [note, flags]} */
  upPut: (s: number, pt: PatchIn): Req => [
    CMD.UP_PUT,
    [
      s & 0x7f,
      pt.engine & 0x7f,
      ...strEnc(upName(pt.name)),
      ...pt.p.flatMap((v) => v14enc(v ?? 0)),
      ...Array.from({ length: UP.PAT }, (_, i) => {
        const x = (pt.pattern || [])[i] || [0, 0]
        return [x[0] & 0x7f, x[1] & 7]
      }).flat(),
    ],
  ],
  upStore: (s: number, name?: string | null): Req => [
    CMD.UP_STORE,
    [s & 0x7f, ...strEnc(name ? upName(name) : '')],
  ] /* "": the device names it ("ANALOG 07") */,
  upLoad: (s: number): Req => [CMD.UP_LOAD, [s & 0x7f]],
  upErase: (s: number): Req => [CMD.UP_ERASE, [s & 0x7f]],
  /* on: 1 = pushes; 3 = also TRACK_CHANGED (v4 firmware answers 3, older firmware 1) */
  watch: (on: number | boolean): Req => [
    CMD.WATCH,
    [on === 3 ? 3 : on ? 1 : 0],
  ],
  ping: (): Req => [CMD.PING, []],
  /* v3: tracks 0..3 (3 = drums) */
  track: (sel?: number | null): Req => [
    CMD.TRACK,
    sel == null ? [] : [sel & 0x7f],
  ],
  trackMix: (
    tr: number,
    level?: number | null,
    mute?: boolean | number,
  ): Req => [
    CMD.TRACK_MIX,
    level == null ? [tr & 0x7f] : [tr & 0x7f, ...v14enc(level), mute ? 1 : 0],
  ],
  trackDump: (tr: number): Req => [CMD.TRACK_DUMP, [tr & 0x7f]],
  trackStep: (tr: number, i: number, st?: Step | null): Req => [
    CMD.TRACK_STEP,
    st ? [tr & 0x7f, ...req.stepSet(i, st)[1]] : [tr & 0x7f, i & 0x7f],
  ],
  /* v4: get (v == null) or set parameter id (P_*) of track tr, clamped as SET */
  trackParam: (tr: number, id: number, v?: number | null): Req => [
    CMD.TRACK_PARAM,
    v == null ? [tr & 0x7f, id & 0x7f] : [tr & 0x7f, id & 0x7f, ...v14enc(v)],
  ],
  /* v6: backup / restore */
  bkList: (): Req => [CMD.BK_LIST, []],
  bkGet: (id: number, off: number, n: number): Req => [
    CMD.BK_GET,
    [id & 0x7f, ...u35enc(off), n & 0x7f, (n >> 7) & 0x7f],
  ],
  bkBegin: (id: number, len: number, crc: number): Req => [
    CMD.BK_PUT,
    [0, id & 0x7f, ...u35enc(len), ...u35enc(crc)],
  ],
  bkData: (id: number, off: number, bytes: Bytes): Req => [
    CMD.BK_PUT,
    [1, id & 0x7f, ...u35enc(off), ...pack7(bytes)],
  ],
  bkCommit: (id: number): Req => [CMD.BK_PUT, [2, id & 0x7f]],
  bkAbort: (id: number): Req => [CMD.BK_PUT, [3, id & 0x7f]],
  /* v7: the locks of a track; set (v a number) or delete (v == null) the lock of (step, param) */
  lockGet: (tr: number): Req => [CMD.LOCK_GET, [tr & 0x7f]],
  lockSet: (
    tr: number,
    step: number,
    param: number,
    v?: number | null,
  ): Req => [
    CMD.LOCK_SET,
    v == null
      ? [tr & 0x7f, step & 0x7f, param & 0x7f]
      : [tr & 0x7f, step & 0x7f, param & 0x7f, ...v14enc(v)],
  ],
  /* v7: the nudges of a track; set one (m: MICRO.MIN..MAX, sent + 64) */
  microGet: (tr: number): Req => [CMD.MICRO_GET, [tr & 0x7f]],
  microSet: (tr: number, step: number, m: number): Req => [
    CMD.MICRO_SET,
    [
      tr & 0x7f,
      step & 0x7f,
      (Math.max(MICRO.MIN, Math.min(MICRO.MAX, Math.round(m))) + 64) & 0x7f,
    ],
  ],
  /* v8: the fill conditions of a track; set one (c: FC.NORM / FILL / NOFILL) */
  fillGet: (tr: number): Req => [CMD.FILL_GET, [tr & 0x7f]],
  fillSet: (tr: number, step: number, c: number): Req => [
    CMD.FILL_SET,
    [tr & 0x7f, step & 0x7f, (c % 3) & 0x7f],
  ],
  /* v9: FM6 patches (firmware proto >= 9) */
  fm6Get: (target: number, i: number): Req => [
    CMD.FM6_GET,
    [target & 0x7f, i & 0x7f],
  ],
  fm6Put: (target: number, i: number, packed: ArrayLike<number>): Req => [
    CMD.FM6_PUT,
    [target & 0x7f, i & 0x7f, ...Array.from(packed, (x) => x & 0x7f)],
  ],
  fm6List: (): Req => [CMD.FM6_LIST, []],
  fm6Erase: (i: number): Req => [CMD.FM6_ERASE, [i & 0x7f]],
  /* v10: the SYN drum kits (firmware proto >= 10). which: a factory kit 0.., or DSYN.USER + k */
  dsynList: (): Req => [CMD.DSYN_LIST, []],
  dsynGet: (which: number): Req => [CMD.DSYN_GET, [which & 0x7f]],
  dsynSound: (k: number, lane: number, bytes22: Bytes): Req => [
    CMD.DSYN_PUT,
    [k & 0x7f, lane & 0x7f, ...pack7(bytes22)],
  ],
  dsynHead: (k: number, name: string, crush: number, src: number): Req => [
    CMD.DSYN_PUT,
    [
      k & 0x7f,
      16,
      ...pack7(Uint8Array.from([...DSYN.name8(name), crush & 255, src & 255])),
    ],
  ],
  dsynCopy: (k: number, src: number): Req => [
    CMD.DSYN_PUT,
    [k & 0x7f, 17, ...pack7(Uint8Array.of(src & 255))],
  ],
  dsynStore: (): Req => [CMD.DSYN_STORE, []],
  dsynPlay: (k: number, lane: number, vel = 110): Req => [
    CMD.DSYN_PLAY,
    [k & 0x7f, lane & 0x7f, Math.max(1, Math.min(127, vel | 0))],
  ],
  /* v12: LIVE op [, args]: every reply is the live state (parse[CMD.LIVE]) */
  live: (op: number, ...args: number[]): Req => [
    CMD.LIVE,
    [op & 0x7f, ...(args.length ? args : [0]).map((x) => x & 0x7f)],
  ],
}

/* which reply belongs to which request (the device echoes these) */
function replyMatches(cmd: number, args: number[], a: number[]) {
  switch (cmd) {
    case CMD.GET:
    case CMD.SET:
    case CMD.DESC:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.STEP_GET:
    case CMD.STEP_SET:
    case CMD.NAMES:
    case CMD.SMP_BEGIN:
    case CMD.SMP_END:
    case CMD.SMP_ERASE:
      return a[0] === args[0]
    case CMD.SMP_WRITE:
      return (
        a[0] === args[0] &&
        a[1] === args[1] &&
        a[2] === args[2] &&
        a[3] === args[3]
      )
    case CMD.PROJECT:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.UP_LIST:
    case CMD.UP_GET:
    case CMD.UP_PUT:
    case CMD.UP_STORE:
    case CMD.UP_LOAD:
    case CMD.UP_ERASE:
    case CMD.TRACK_MIX:
    case CMD.TRACK_DUMP:
    case CMD.DRUM_STEP:
      return a[0] === args[0]
    case CMD.WATCH:
      return (a[0] & 1) === (args[0] & 1) /* bit 1: v4 firmware only */
    case CMD.TRACK_STEP:
    case CMD.TRACK_PARAM:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.BK_GET:
      return (
        a[0] === args[0] &&
        [0, 1, 2, 3, 4].every((k) => a[2 + k] === args[1 + k])
      )
    case CMD.BK_PUT:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.LOCK_GET:
    case CMD.MICRO_GET:
    case CMD.FILL_GET:
      return a[0] === args[0]
    case CMD.LOCK_SET:
      return a[0] === args[0] && a[1] === args[1] && a[2] === args[2]
    case CMD.MICRO_SET:
    case CMD.FILL_SET:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.FM6_GET:
    case CMD.FM6_PUT:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.FM6_ERASE:
      return a[0] === args[0]
    case CMD.DSYN_GET:
      return a[0] === args[0]
    case CMD.DSYN_PUT:
    case CMD.DSYN_PLAY:
      return a[0] === args[0] && a[1] === args[1]
    case CMD.LIVE:
      return a[0] === args[0]
    default:
      return true
  }
}

/* strict request/response: one frame in flight, the rest queued. Push frames (CHANGED, RELOAD,
   STEP_CHANGED) can come at any time, also between a request and its reply: they go to onPush. */
/** Link's options */
export interface LinkOpts {
  timeout?: number
  onUnknown?: (f: Frame) => void
  onTimeout?: (cmd: number) => void
  onPush?: (f: Frame) => void
  onGap?: (ms: number) => void
}
/** a request in Link's queue */
export interface LinkItem {
  cmd: number
  args: number[]
  key?: string
  res: (a: number[]) => void
  rej: (e: Error) => void
  promise: Promise<number[]>
  quiet: boolean
  timeout: number
  retries: number
  timer?: ReturnType<typeof setTimeout>
}
class Link {
  sendRaw: (bytes: number[]) => void
  q: LinkItem[]
  cur: LinkItem | null
  closed: boolean
  lastSent: number
  timeout: number
  onUnknown: (f: Frame) => void
  onTimeout: (cmd: number) => void
  onPush: (f: Frame) => void
  onGap: (ms: number) => void
  constructor(send: (bytes: number[]) => void, opts: LinkOpts = {}) {
    this.sendRaw = send
    this.q = []
    this.cur = null
    this.closed = false
    this.lastSent = 0 /* Date.now() of the last frame sent (WATCH keep-alive) */
    this.timeout = opts.timeout || 300
    this.onUnknown = opts.onUnknown || ((): void => {})
    this.onTimeout = opts.onTimeout || ((): void => {})
    this.onPush = opts.onPush || ((): void => {})
    this.onGap =
      opts.onGap ||
      ((): void => {}) /* (ms) nothing was sent for that long (WATCH may have ended) */
  }
  get idle() {
    return !this.cur && !this.q.length
  }
  hasQueued(key: string) {
    return this.q.some((r) => r.key === key)
  }
  /* r = [cmd, args]; opt: {timeout, retries, key (coalesce queued requests: the latest args win), front,
     quiet (a timeout is expected: no onTimeout)} */
  async request(r: Req, opt: RequestOpt = {}): Promise<number[]> {
    if (this.closed) return Promise.reject(new Error('closed'))
    const [cmd, args] = r
    if (opt.key) {
      const old = this.q.find((x) => x.key === opt.key)
      if (old) {
        old.cmd = cmd
        old.args = args
        return old.promise
      }
    }
    let res!: (a: number[]) => void, rej!: (e: Error) => void
    const promise = new Promise<number[]>((a, b) => {
      res = a
      rej = b
    })
    const item: LinkItem = {
      cmd,
      args,
      key: opt.key,
      res,
      rej,
      promise,
      quiet: !!opt.quiet,
      timeout: opt.timeout || this.timeout,
      retries: opt.retries ?? 1,
    }
    if (opt.front) this.q.unshift(item)
    else this.q.push(item)
    this.pump()
    return promise
  }
  pump(): void {
    if (this.cur || this.closed || !this.q.length) return
    this.cur = this.q.shift()!
    this.fire()
  }
  fire(): void {
    const c = this.cur!
    const now = Date.now()
    if (this.lastSent && now - this.lastSent > 2500)
      this.onGap(now - this.lastSent)
    this.lastSent = now
    try {
      this.sendRaw(frame(c.cmd, c.args))
    } catch (e) {
      this.finish(null, e as Error)
      return
    }
    c.timer = setTimeout(() => {
      if (this.cur !== c) return
      if (c.retries-- > 0) {
        this.fire()
        return
      }
      if (!c.quiet) this.onTimeout(c.cmd)
      this.finish(null, new Error('timeout (cmd ' + c.cmd + ')'))
    }, c.timeout)
  }
  finish(val: number[] | null, err?: Error): void {
    const c = this.cur
    if (!c) return
    clearTimeout(c.timer)
    this.cur = null
    if (err) c.rej(err)
    else c.res(val!)
    this.pump()
  }
  /* raw incoming MIDI bytes */
  receive(data: Bytes): void {
    const f = unframe(data)
    if (!f) return /* not ours (notes, clock, other SysEx) */
    if (PUSH.has(f.cmd)) {
      this.onPush(f)
      return
    }
    const c = this.cur
    if (!c || f.cmd !== c.cmd || !replyMatches(c.cmd, c.args, f.a)) {
      this.onUnknown(f)
      return
    }
    this.finish(f.a)
  }
  close(): void {
    this.closed = true
    const all = (this.cur ? [this.cur] : []).concat(this.q)
    if (this.cur) clearTimeout(this.cur.timer)
    this.cur = null
    this.q = []
    for (const r of all) r.rej(new Error('closed'))
  }
}

/* ------------------------------------------------------------- formatting --- */
const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]
const noteName = (n: number) =>
  NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1) /* 60 = C4 */
/* GM drum notes (35..81) by short names, for the drum track's steps */
const GM_DRUM: Record<number, string> = {
  35: 'KICK2',
  36: 'KICK',
  37: 'RIM',
  38: 'SNARE',
  39: 'CLAP',
  40: 'SNARE2',
  41: 'LTOM2',
  42: 'CHH',
  43: 'LTOM',
  44: 'PHH',
  45: 'MTOM2',
  46: 'OHH',
  47: 'MTOM',
  48: 'HTOM2',
  49: 'CRASH',
  50: 'HTOM',
  51: 'RIDE',
  52: 'CHINA',
  53: 'BELL',
  54: 'TAMB',
  55: 'SPLASH',
  56: 'COWBELL',
  57: 'CRASH2',
  58: 'VIBRA',
  59: 'RIDE2',
  60: 'HBONGO',
  61: 'LBONGO',
  62: 'MCONGA',
  63: 'HCONGA',
  64: 'LCONGA',
  65: 'HTIMB',
  66: 'LTIMB',
  67: 'HAGOGO',
  68: 'LAGOGO',
  69: 'CABASA',
  70: 'MARACA',
  71: 'SWHIS',
  72: 'LWHIS',
  73: 'SGUIRO',
  74: 'LGUIRO',
  75: 'CLAVES',
  76: 'HWOOD',
  77: 'LWOOD',
  78: 'MCUICA',
  79: 'OCUICA',
  80: 'MTRI',
  81: 'OTRI',
}
const GM_DRUM_BY_NAME = Object.fromEntries(
  Object.entries(GM_DRUM).map(([n, s]) => [s, +n]),
)
const drumName = (n: number) => GM_DRUM[n] || String(n)
/* a note token: a number, a note name (C4, F#3, Bb2) or a GM drum name (KICK, CHH) */
function parseNote(tok: string): number | null {
  const dn = GM_DRUM_BY_NAME[tok.toUpperCase()]
  if (dn != null) return dn
  if (/^\d+$/.test(tok)) {
    const n = +tok
    return n <= 127 ? n : null
  }
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok)
  if (!m) return null
  const base = (
    { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>
  )[m[1].toUpperCase()]
  const n =
    base +
    (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) +
    (parseInt(m[3], 10) + 1) * 12
  return n >= 0 && n <= 127 ? n : null
}
/* "C4 E4 G4" -> [60, 64, 67]; null on a bad token or more than 4 notes */
function parseNotes(s: string): number[] | null {
  const t = s
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
  if (t.length > 4) return null
  const out = t.map(parseNote)
  return out.includes(null) ? null : (out as number[])
}

/* close to the device's param_format (params.c), tables from tools/gen_tables.py */
function fmtValue(d: FmtDesc, v: number): [string, string] {
  const sign = (x: number) => (x > 0 ? '+' + x : String(x))
  switch (d.fmt) {
    case F.PCT:
      return [
        String(
          d.max > 0 ? Math.trunc((v * 100 + Math.trunc(d.max / 2)) / d.max) : v,
        ),
        '%',
      ]
    case F.SWING:
      return [
        String(Math.max(0, Math.min(100, v))),
        '',
      ] /* 0 straight .. 100 the most (as the FM-1, 2.5) */
    case F.FILT:
      return !v
        ? ['OFF', '']
        : v < 0
          ? ['LP' + Math.trunc((-v * 100 + 32) / 64), '%']
          : ['HP' + Math.trunc((v * 100 + 31) / 63), '%']
    case F.BIPCT:
      return [sign(Math.trunc((v * 100) / 64)), '%']
    case F.TIME: {
      const ms10 = Math.round(10 * Math.pow(10000, (v & 127) / 127))
      if (ms10 < 100) return [(ms10 / 10).toFixed(1), 'ms']
      if (ms10 < 10000) return [String(Math.round(ms10 / 10)), 'ms']
      return [(ms10 / 10000).toFixed(2), 's']
    }
    case F.LFOHZ: {
      const h = 0.05 * Math.pow(800, (v & 127) / 127)
      return [h < 10 ? h.toFixed(2) : h.toFixed(1), 'Hz']
    }
    case F.CUTOFF: {
      const h = 30 * Math.pow(16000 / 30, (v & 127) / 127)
      return h < 1000
        ? [String(Math.round(h)), 'Hz']
        : [(h / 1000).toFixed(1), 'kHz']
    }
    case F.DB:
      return v <= 0 ? ['OFF', ''] : [((v - 112) / 2).toFixed(1), 'dB']
    case F.SEMI:
      return [sign(v), 'st']
    case F.ENUM:
      return [d.names![v - d.min] ?? String(v), d.unit || '']
    case F.BPM:
      return [String(v), 'BPM']
    case F.NOTE:
      return [NOTE_NAMES[((v % 12) + 12) % 12], '']
    case F.ONOFF:
      return [v ? 'ON' : 'OFF', '']
    case F.STEPS:
      return [String(v), 'STEP']
    default:
      return [
        d.names && d.names[v - d.min] != null ? d.names[v - d.min] : String(v),
        d.unit || '',
      ]
  }
}

/* ---------------------------------------------------------- user samples --- */
/* A port of tools/sampleio.py (read_any_wav, resample, to_int16, ima_encode, user_slot),
   byte for byte: web/test_web.mjs compares them. */
const SMP = {
  SLOT_SIZE: 0x14000,
  DATA_OFF: 512,
  RATE: 22050,
  HDR_LEN: 32 + 16 * 28,
  MAX_ZONES: 16,
} as {
  SLOT_SIZE: number
  DATA_OFF: number
  RATE: number
  HDR_LEN: number
  MAX_ZONES: number
  MAX_DATA: number
}
SMP.MAX_DATA = SMP.SLOT_SIZE - SMP.DATA_OFF

/* groups of up to 7 bytes, each preceded by their top bits */
function pack7(b: Bytes): number[] {
  const out: number[] = []
  for (let i = 0; i < b.length; i += 7) {
    const g: number[] = Array.from(b.slice(i, i + 7))
    out.push(g.reduce((m, x, j) => m | (((x >> 7) & 1) << j), 0))
    for (const x of g) out.push(x & 0x7f)
  }
  return out
}
function unpack7(a: Bytes): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < a.length; i += 8) {
    const top = a[i]
    for (let j = 0; j < 7 && i + 1 + j < a.length; j++)
      out.push(a[i + 1 + j] | (((top >> j) & 1) << 7))
  }
  return Uint8Array.from(out)
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b: ArrayLike<number>) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++)
    c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const IMA_STEP = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
  50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
  253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
  1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
  3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442,
  11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767,
]
const IMA_IDX = [-1, -1, -1, -1, 2, 4, 6, 8]
/* IMA ADPCM, 4 bit, low nibble first, from predictor 0 / index 0 -> {data, pred, idx} (state at loopStart) */
function imaEncode(s: ArrayLike<number>, loopStart = 0) {
  let pred = 0,
    idx = 0,
    atLoop = [0, 0]
  const nib = new Uint8Array(s.length + (s.length & 1))
  for (let n = 0; n < s.length; n++) {
    if (n === loopStart) atLoop = [pred, idx]
    const step = IMA_STEP[idx]
    let diff = s[n] - pred,
      code = 0
    if (diff < 0) {
      code = 8
      diff = -diff
    }
    let vd = step >> 3
    if (diff >= step) {
      code |= 4
      diff -= step
      vd += step
    }
    if (diff >= step >> 1) {
      code |= 2
      diff -= step >> 1
      vd += step >> 1
    }
    if (diff >= step >> 2) {
      code |= 1
      vd += step >> 2
    }
    pred = Math.max(-32768, Math.min(32767, code & 8 ? pred - vd : pred + vd))
    idx = Math.max(0, Math.min(88, idx + IMA_IDX[code & 7]))
    nib[n] = code
  }
  const out = new Uint8Array(nib.length >> 1)
  for (let k = 0; k < nib.length; k += 2)
    out[k >> 1] = nib[k] | (nib[k + 1] << 4)
  return { data: out, pred: atLoop[0], idx: atLoop[1] }
}

/* WAV: PCM 8/16/24/32 or float, any channel count, mixed to mono -> {sr, x} (gen_samples.read_any_wav) */
/** parseWav: mono at its own rate, and the file's loop (in frames) when it has one */
export interface Wav {
  sr: number
  x: Float64Array
  loop: [number, number] | null
}
function parseWav(buf: ArrayBuffer | ArrayLike<number>): Wav {
  const d = new Uint8Array(buf),
    v = new DataView(d.buffer, d.byteOffset, d.byteLength)
  const id = (i: number) =>
    String.fromCharCode(d[i], d[i + 1], d[i + 2], d[i + 3])
  if (d.length < 12 || id(0) !== 'RIFF' || id(8) !== 'WAVE')
    throw new Error('not a WAV file')
  let i = 12,
    fmt: { tag: number; ch: number; sr: number; bits: number } | null = null,
    data: [number, number] | null = null,
    loop: [number, number] | null = null
  while (i + 8 <= d.length) {
    const cid = id(i),
      n = v.getUint32(i + 4, true)
    if (cid === 'fmt ') {
      let tag = v.getUint16(i + 8, true)
      const ch = v.getUint16(i + 10, true),
        sr = v.getUint32(i + 12, true),
        bits = v.getUint16(i + 22, true)
      if (tag === 0xfffe) tag = v.getUint16(i + 32, true)
      fmt = { tag, ch, sr, bits }
    } else if (cid === 'data') {
      data = [i + 8, Math.min(d.length, i + 8 + n)]
    } else if (
      cid === 'smpl' &&
      n >= 60 &&
      i + 8 + 60 <= d.length &&
      v.getUint32(i + 8 + 28, true)
    ) {
      loop = [
        v.getUint32(i + 8 + 44, true),
        v.getUint32(i + 8 + 48, true),
      ] /* (2.7) its first loop, in frames */
    }
    i += 8 + n + (n & 1)
  }
  if (!fmt || !data) throw new Error('WAV without fmt/data')
  const { tag, ch, sr, bits } = fmt,
    bps = bits >> 3,
    frame = bps * ch
  if (!(tag === 1 || tag === 3) || !bps || !ch)
    throw new Error('unsupported WAV format')
  const nfr = Math.floor((data[1] - data[0]) / frame),
    x = new Float64Array(nfr)
  for (let f = 0; f < nfr; f++) {
    let acc = 0
    for (let c = 0; c < ch; c++) {
      const o = data[0] + f * frame + c * bps
      let s: number
      if (tag === 3)
        s = bps === 4 ? v.getFloat32(o, true) : v.getFloat64(o, true)
      else if (bps === 2) s = v.getInt16(o, true) / 32768
      else if (bps === 3)
        s = (((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) << 8) >> 8) / 8388608
      else if (bps === 4) s = v.getInt32(o, true) / 2147483648
      else s = (d[o] - 128) / 128
      acc += s
    }
    x[f] = acc / ch
  }
  return { sr, x, loop }
}

/* gen_samples.resample: moving average over the ratio, then linear interpolation */
function resample(x: ArrayLike<number>, sr: number, to: number): number[] {
  if (sr === to) return Array.from(x)
  if (sr > to) {
    const k = Math.max(1, pyRound(sr / to))
    if (k > 1) {
      const y: number[] = new Array(x.length)
      for (let i = 0; i < x.length; i++) {
        let s = 0
        for (let j = i; j < Math.min(x.length, i + k); j++) s += x[j]
        y[i] = s / k
      }
      x = y
    }
  }
  const step = sr / to,
    out: number[] = []
  let p = 0
  while (p < x.length - 1) {
    const i = Math.floor(p),
      f = p - i
    out.push(x[i] * (1 - f) + x[i + 1] * f)
    p += step
  }
  return out
}
function pyRound(v: number) {
  const f = Math.floor(v),
    r = v - f
  return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 ? f + 1 : f
}

/* mono float -> int16, peak normalised to 30000 */
function normalize(x: number[] | Float64Array) {
  let pk = 1e-9
  for (const v of x) pk = Math.max(pk, Math.abs(v))
  return Int16Array.from(x, (v: number) =>
    Math.max(-32768, Math.min(32767, Math.trunc((v / pk) * 30000))),
  )
}

/* SLOOP 2.6: how loud a sound is heard, in dB: K-weighted (ITU-R BS.1770, the ear's curve: the lows count less, the
   presence more), the mean square over 100 ms windows, the loudest window (a hit is heard by its loudest moment, not
   by its average with the silence after; a click shorter than a window counts over the whole window, as the ear does) */
function loudDb(s: ArrayLike<number>, sr = SMP.RATE) {
  const bq = (G: number, Q: number, fc: number, shelf: boolean) => {
    /* the two stages' coefficients at this rate (pyloudnorm's) */
    const A = Math.pow(10, G / 40),
      w = (2 * Math.PI * fc) / sr,
      c = Math.cos(w),
      al = Math.sin(w) / (2 * Q),
      r = 2 * Math.sqrt(A) * al
    const k = shelf
      ? [
          A * (A + 1 + (A - 1) * c + r),
          -2 * A * (A - 1 + (A + 1) * c),
          A * (A + 1 + (A - 1) * c - r),
          A + 1 - (A - 1) * c + r,
          2 * (A - 1 - (A + 1) * c),
          A + 1 - (A - 1) * c - r,
        ]
      : [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al]
    return k.map((v) => v / k[3])
  }
  const st = [
    bq(3.99984385397, 0.7071752369554193, 1681.9744509555319, true),
    bq(0, 0.5003270373253953, 38.13547087613982, false),
  ]
  const y = new Float64Array(s.length)
  for (let i = 0; i < s.length; i++) y[i] = s[i] / 32768
  for (const [b0, b1, b2, , a1, a2] of st) {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0
    for (let i = 0; i < y.length; i++) {
      const x = y[i],
        v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = v
      y[i] = v
    }
  }
  const W = Math.round(sr * 0.1),
    hop = Math.max(1, W >> 2)
  let best = 1e-12
  for (let a = 0; a < Math.max(1, y.length - W + hop); a += hop) {
    let e = 0
    for (let i = a; i < Math.min(y.length, a + W); i++) e += y[i] * y[i]
    best = Math.max(best, e / W)
  }
  return 10 * Math.log10(best) - 0.691
}
/* gains (dB, -24..0) that bring sounds to the same heard level: the louder ones turned down to the quietest (every
   sound comes in peak-normalised, so turning up would clip); null entries stay null */
const LEVEL_MIN = -24
function matchGains(
  sounds: (ArrayLike<number> | null | undefined)[],
): (number | null)[] {
  const L = sounds.map((x) => (x ? loudDb(x) : null)),
    q = L.filter((v): v is number => v != null)
  if (!q.length) return L
  const target = Math.max(Math.min(...q), Math.max(...q) + LEVEL_MIN)
  return L.map((v) =>
    v == null ? null : Math.max(LEVEL_MIN, Math.min(0, Math.round(target - v))),
  )
}
/* a sound with its gain (dB, 0 = as it came) */
function withGain(s: Int16Array, db: number | null | undefined) {
  if (!db) return s
  const g = Math.pow(10, Math.max(LEVEL_MIN, Math.min(0, db)) / 20)
  return Int16Array.from(s, (v: number) => Math.round(v * g))
}

/* root from a file name like "piano_C4" or "F#3" (C4 = 60), else 60 (sampleio.note_from_name) */
function rootFromName(name: string) {
  const m = /(?<![A-Za-z])([A-G])([#b]?)(-?\d)(?!\d)/.exec(name)
  if (!m) return 60
  const n =
    ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[
      m[1]
    ] +
    (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) +
    (parseInt(m[3], 10) + 1) * 12
  return Math.max(0, Math.min(127, n))
}

/* 2.7: a file's loop (the Samples page): 0 ONE SHOT; 1 LOOP, the whole file again while the key is held, let go it ends
   its round; 2 LOOP+TAIL, the start, then [ls, le] again while held, let go the rest to the end. Both are the zone's
   looped = 2 (SMP_LOOP_HELD, firmware eng_sample.c; SLOOP 2.6 loops them until the release ends the note) */
/** a file of a sample slot: 22050 Hz samples, its root key, its key range, its loop (LOOP) */
export interface SlotZoneIn {
  s: Int16Array
  root: number
  lo?: number | null
  hi?: number | null
  loop?: number
  ls?: number
  le?: number
  fname?: string
}
/** a zone as the slot header has it */
export interface SlotZone {
  off: number
  n: number
  ls: number
  le: number
  looped: number
  root: number
  lo: number | null
  hi: number | null
  pred: number
  idx: number
}
const LOOP = {
  NAMES: ['ONE SHOT', 'LOOP', 'LOOP+TAIL'],
  MIN: 64,
  SNAP: 512,
  /* the loop's [ls, le] of a file of n samples */
  range(z: Pick<SlotZoneIn, 's' | 'loop' | 'ls' | 'le'>): [number, number] {
    const n = z.s.length
    if (z.loop === 1 || n < 2 * LOOP.MIN) return [0, n - 1]
    const ls = Math.max(0, Math.min(n - LOOP.MIN - 1, Math.round(z.ls ?? 0)))
    return [
      ls,
      Math.max(ls + LOOP.MIN - 1, Math.min(n - 1, Math.round(z.le ?? n - 1))),
    ]
  },
  /* the nearest rising zero crossing to i (s[i - 1] < 0 <= s[i]), within SNAP samples, else i */
  snap(s: ArrayLike<number>, i: number) {
    for (let d = 0; d <= LOOP.SNAP; d++)
      for (const j of d ? [i - d, i + d] : [i])
        if (j >= 1 && j < s.length && s[j - 1] < 0 && s[j] >= 0) return j
    return i
  },
  /* start and end points snapped: the loop starts on a crossing and its last sample is just before one, so the jump
     back lands where the wave was going anyway (no click) */
  snapRange(s: ArrayLike<number>, ls: number, le: number): [number, number] {
    const n = s.length,
      a = Math.max(0, Math.min(n - LOOP.MIN - 1, LOOP.snap(s, ls)))
    let b = LOOP.snap(s, le + 1) - 1
    if (b < a + LOOP.MIN - 1 || b > n - 1)
      b = Math.max(a + LOOP.MIN - 1, Math.min(n - 1, le))
    return [a, b]
  },
}

/* zones: [{s: Int16Array (22050 Hz), root, lo?, hi?, loop?, ls?, le?}] -> {hdr (480 B), data, zones} (sampleio.user_slot) */
function buildSlot(name: string, zonesIn: SlotZoneIn[]) {
  const zones: SlotZone[] = [],
    parts: Uint8Array[] = []
  let len = 0
  for (const z of zonesIn) {
    const [ls, le] = z.loop ? LOOP.range(z) : [0, z.s.length - 1]
    const e = imaEncode(z.s, ls) /* (the decoder's state at the loop start) */
    zones.push({
      off: len,
      n: z.s.length,
      ls,
      le,
      looped: z.loop ? 2 : 0,
      root: z.root,
      lo: z.lo ?? null,
      hi: z.hi ?? null,
      pred: e.pred,
      idx: e.idx,
    })
    parts.push(e.data)
    len += e.data.length
  }
  const data = new Uint8Array(len)
  let o = 0
  for (const p of parts) {
    data.set(p, o)
    o += p.length
  }
  if (len > SMP.MAX_DATA)
    throw new Error(`too long: ${len} B (max ${SMP.MAX_DATA} B)`)
  if (!zones.length || zones.length > SMP.MAX_ZONES)
    throw new Error('1..16 files per slot')
  zones.sort((a, b) => a.root - b.root)
  zones.forEach((z, j) => {
    if (z.lo == null) {
      z.lo = j === 0 ? 0 : Math.floor((zones[j - 1].root + z.root) / 2) + 1
      z.hi =
        j === zones.length - 1
          ? 127
          : Math.floor((z.root + zones[j + 1].root) / 2)
    }
  })
  const hdr = new Uint8Array(SMP.HDR_LEN),
    v = new DataView(hdr.buffer)
  v.setUint32(0, 0x504d5346, true)
  v.setUint16(4, 1, true)
  hdr[6] = zones.length
  const nm = String(name)
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 8)
  for (let i = 0; i < nm.length; i++) hdr[8 + i] = nm.charCodeAt(i)
  v.setUint32(16, len, true)
  v.setUint32(20, crc32(data), true)
  const rate = pyRound((SMP.RATE / 44100) * 65536)
  zones.forEach((z, j) => {
    const b = 32 + j * 28
    ;[z.off, z.n, z.ls, z.le, rate].forEach((x, k) =>
      v.setUint32(b + k * 4, x >>> 0, true),
    )
    v.setInt16(b + 20, z.root * 16, true)
    v.setInt16(b + 22, z.pred, true)
    hdr[b + 24] = z.idx
    hdr[b + 25] = z.lo!
    hdr[b + 26] = z.hi!
    hdr[b + 27] = z.looped || 0
  })
  return { hdr, data, zones }
}

/* ------------------------------------------------------------------- chop --- */
/* Chopping a recording into a slot (the CHOP block of the samples tab). All at SMP.RATE, positions
   in samples. These are pure: test_web.mjs runs them. */
const CHOP = {
  HOP: 128,
  MAX: 16,
  FADE_IN: 22,
  FADE_OUT: 132,
  PRE: 32,
} /* 5.8 ms frames; fades 1 / 6 ms; start 1.5 ms early */

/* onset novelty per frame: the rise of the log energy of the signal's first difference (the attack
   of a hit, not its body), over the louder of the two frames before */
/** chopNovelty: per frame the onset novelty, and .level the frames' log10 power */
export type Novelty = Float64Array & { level?: Float64Array }
/** a chop of a recording (chopList) */
export interface Chop {
  start: number
  end: number
  i: number
  off: boolean
  full: number
}
function chopNovelty(x: ArrayLike<number>): Novelty {
  const H = CHOP.HOP,
    F = Math.ceil(x.length / H),
    L = new Float64Array(F),
    P = new Float64Array(F),
    nov: Novelty = new Float64Array(F)
  let top = 1e-12,
    ptop = 1e-12
  for (let f = 0; f < F; f++) {
    let e = 0,
      p = 0
    for (let i = f * H, n = Math.min(x.length, i + H); i < n; i++) {
      const d = x[i] - (i ? x[i - 1] : 0)
      e += d * d
      p += x[i] * x[i]
    }
    L[f] = e
    P[f] = p
    if (e > top) top = e
    if (p > ptop) ptop = p
  }
  for (let f = 0; f < F; f++) {
    L[f] = Math.log10(L[f] / top + 1e-9)
    P[f] = Math.log10(P[f] / ptop + 1e-9)
  } /* 0 = the loudest */
  for (let f = 0; f < F; f++) {
    const before = Math.max(f ? L[f - 1] : -9, f > 1 ? L[f - 2] : -9)
    nov[f] =
      L[f] > -3.5 ? Math.max(0, L[f] - before) : 0 /* (under -35 dB: no hit) */
  }
  nov.level = P /* (log10 power, 0 = the loudest frame) */
  return nov
}

/* the first sample of the hit in frame f: where the signal first reaches 30 % of its peak over the
   frames f-1..f+2, then PRE samples earlier (the attack is kept whole) */
function chopAttack(x: ArrayLike<number>, f: number) {
  const H = CHOP.HOP,
    a = Math.max(0, (f - 1) * H),
    b = Math.min(x.length, (f + 3) * H)
  let pk = 0
  for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(x[i]))
  for (let i = a; i < b; i++)
    if (Math.abs(x[i]) >= 0.3 * pk) return Math.max(0, i - CHOP.PRE)
  return a
}

/* hits: sens 1 (only the hardest and loudest) .. 10 (every small one); at least 60 ms apart. A hit is a
   sharp rise (nov over thr) to a level (its loudest frame within 3) over the gate */
function chopHits(x: ArrayLike<number>, nov: Novelty, sens: number) {
  const k = Math.max(1, Math.min(10, sens)),
    thr = 0.15 + (10 - k) * 0.08,
    gate = -(0.5 + k * 0.35)
  const gap = Math.round((0.06 * SMP.RATE) / CHOP.HOP),
    L = nov.level
  const out: number[] = []
  let last = -1e9
  for (let f = 0; f < nov.length - 1; f++) {
    /* (a hit on the very first frame counts too) */
    if (nov[f] < thr || (f && nov[f] < nov[f - 1]) || nov[f] < nov[f + 1])
      continue
    if (
      L &&
      Math.max(
        L[f],
        L[Math.min(L.length - 1, f + 1)],
        L[Math.min(L.length - 1, f + 2)],
      ) < gate
    )
      continue
    if (f - last < gap) {
      if (out.length && nov[f] > nov[last]) {
        out[out.length - 1] = chopAttack(x, f)
        last = f
      }
      continue
    }
    out.push(chopAttack(x, f))
    last = f
  }
  return out
}

/* a tap at pos (as heard) moved to the hit it meant: the strongest attack within +-win s, if any */
function chopSnap(
  x: ArrayLike<number>,
  nov: ArrayLike<number>,
  pos: number,
  win = 0.05,
) {
  const H = CHOP.HOP,
    w = Math.round((win * SMP.RATE) / H),
    c = Math.round(pos / H)
  let best = -1,
    bv = 0.12
  for (let f = Math.max(1, c - w); f <= Math.min(nov.length - 1, c + w); f++)
    if (nov[f] > bv) {
      bv = nov[f]
      best = f
    }
  return best < 0
    ? Math.max(0, Math.min(x.length - 1, Math.round(pos)))
    : chopAttack(x, best)
}

/* markers every `beats` beats at bpm from start to end */
function chopGrid(start: number, end: number, bpm: number, beats: number) {
  const step = ((SMP.RATE * 60) / bpm) * beats,
    out: number[] = []
  for (let p = start; p < end - step * 0.25 && out.length < 64; p += step)
    out.push(Math.round(p))
  return out
}

/* n equal parts of start..end */
function chopEqual(start: number, end: number, n: number) {
  return Array.from({ length: n }, (_, i) =>
    Math.round(start + ((end - start) * i) / n),
  )
}

/* the chops of sorted markers: each to the next marker (the last to the end), cut at maxLen samples
   when maxLen > 0 -> [{start, end, i, off, full}] (all of them; the slot takes CHOP.MAX).
   opt[i] (optional) = {off: left out of the slot, len: its own length in samples, over maxLen};
   a chop is never longer than up to the next marker (`full`) */
function chopList(
  marks: number[],
  total: number,
  maxLen = 0,
  opt: ({ off?: boolean; len?: number } | null | undefined)[] | null = null,
): Chop[] {
  return marks.map((m, i) => {
    const full = Math.max(m + 1, i + 1 < marks.length ? marks[i + 1] : total),
      o = (opt && opt[i]) || {}
    let e = full
    if (o.len! > 0) e = Math.min(e, m + o.len!)
    else if (maxLen > 0) e = Math.min(e, m + maxLen)
    return { start: m, end: Math.max(m + 1, e), i, off: !!o.off, full }
  })
}

/* the chops the slot gets: mode 0 the kept ones, the first CHOP.MAX of them; mode 1 the chop `sel` */
function chopPick<T extends Pick<Chop, 'off'>>(
  chops: T[],
  mode = 0,
  sel = 0,
): T[] {
  if (mode === 1)
    return chops.length
      ? [chops[Math.max(0, Math.min(chops.length - 1, sel))]]
      : []
  return chops.filter((c) => !c.off).slice(0, CHOP.MAX)
}

/* the longest common length L (samples) so the chops, each cut at L, fit in room; Infinity if they fit */
function chopFit(chops: Pick<Chop, 'start' | 'end'>[], room: number) {
  const len = chops.map((c) => c.end - c.start),
    sum = (L: number) => len.reduce((a, n) => a + Math.min(n, L), 0)
  if (sum(Infinity) <= room) return Infinity
  let lo = 0,
    hi = Math.max(...len)
  while (lo < hi) {
    const L = (lo + hi + 1) >> 1
    if (sum(L) <= room) lo = L
    else hi = L - 1
  }
  return lo
}

/* chops -> slot zones {s (Int16Array, one gain for all: their levels are kept), root, lo, hi, fname}.
   mode 0: the kept chops (chopPick), one key each from key0 (each key plays its chop at its own speed,
   the keys between are silent); mode 1: the chop `sel` alone over the whole keyboard, at its own speed
   on key0. The file names keep the chop's own number. */
function chopZones(
  x: ArrayLike<number>,
  chops: Chop[],
  key0: number,
  mode = 0,
  sel = 0,
): (SlotZoneIn & { fname: string; lo: number; hi: number })[] {
  const use = chopPick(chops, mode, sel)
  let pk = 1e-9
  for (const c of use)
    for (let i = c.start; i < c.end; i++) pk = Math.max(pk, Math.abs(x[i]))
  return use.map((c, j) => {
    const n = c.end - c.start,
      s = new Int16Array(n),
      fi = Math.min(CHOP.FADE_IN, n >> 2),
      fo = Math.min(CHOP.FADE_OUT, n >> 2)
    for (let i = 0; i < n; i++) {
      let g = 1
      if (i < fi) g = i / fi
      if (i >= n - fo) g = Math.min(g, (n - i) / fo)
      s[i] = Math.max(
        -32768,
        Math.min(32767, Math.trunc((x[c.start + i] / pk) * 30000 * g)),
      )
    }
    const key = Math.min(127, key0 + (mode === 1 ? 0 : j))
    return {
      s,
      root: key,
      lo: mode === 1 ? 0 : key,
      hi: mode === 1 ? 127 : key,
      fname: `CHOP${String((c.i != null ? c.i : mode === 1 ? sel : j) + 1).padStart(2, '0')}_${NOTE_NAMES[key % 12]}${Math.floor(key / 12) - 1}.wav`,
    }
  })
}

/* a mono 16-bit WAV at SMP.RATE */
function wavFile(s: ArrayLike<number>) {
  const b = new Uint8Array(44 + s.length * 2),
    v = new DataView(b.buffer)
  const str = (o: number, t: string): void => {
    for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i)
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + s.length * 2, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, SMP.RATE, true)
  v.setUint32(28, SMP.RATE * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, s.length * 2, true)
  for (let i = 0; i < s.length; i++) v.setInt16(44 + i * 2, s[i], true)
  return b
}

/* files [{name, data: Uint8Array}] -> a ZIP (stored, no compression) */
function zipStore(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [],
    dir: Uint8Array[] = []
  let off = 0
  for (const f of files) {
    const nm = new TextEncoder().encode(f.name),
      crc = crc32(f.data),
      h = new Uint8Array(30 + nm.length),
      v = new DataView(h.buffer)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true)
    v.setUint32(14, crc, true)
    v.setUint32(18, f.data.length, true)
    v.setUint32(22, f.data.length, true)
    v.setUint16(26, nm.length, true)
    h.set(nm, 30)
    const c = new Uint8Array(46 + nm.length),
      w = new DataView(c.buffer)
    w.setUint32(0, 0x02014b50, true)
    w.setUint16(4, 20, true)
    w.setUint16(6, 20, true)
    w.setUint32(16, crc, true)
    w.setUint32(20, f.data.length, true)
    w.setUint32(24, f.data.length, true)
    w.setUint16(28, nm.length, true)
    w.setUint32(42, off, true)
    c.set(nm, 46)
    parts.push(h, f.data)
    dir.push(c)
    off += h.length + f.data.length
  }
  const size = dir.reduce((a, c) => a + c.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, files.length, true)
  e.setUint16(10, files.length, true)
  e.setUint32(12, size, true)
  e.setUint32(16, off, true)
  const out = new Uint8Array(off + size + 22)
  let o = 0
  for (const p of [...parts, ...dir, end]) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/* -------------------------------------------------------------- librarian --- */
/* A patch (library entry, user preset):
     {name, engine (index), engineName, p: [P_COUNT values by parameter id, null = unknown],
      pattern: 16 x [note 0..127 (0 rest), flags 1 accent | 2 slide | 4 tie] or null, tags: [], created, modified}

   Library / bank / single-patch file (JSON):
     {
       "format": "felucca-library", "version": 1,
       "kind": "library" | "bank" | "patch",
       "firmware": "FELUCCA 0.5 ...",          device version string when exported ("" if unknown)
       "pCount": 57, "pE0": 49,                 P_COUNT and the first engine parameter id
       "paramLabels": ["LVL", "ATK", ...],      one key per parameter id: the DESC label, "#2", "#3" appended to
                                                a repeated label (PIT, PIT#2), and "E0".."E7" for the engine
                                                parameters (their labels depend on the engine)
       "engines": ["ANALOG", ...],              engine names by index
       "exported": "2026-10-03T12:00:00.000Z",
       "patches": [{ "name", "engine", "engineName", "params": [pCount numbers or null],
                     "pattern": [[note, flags] x 16] or null, "tags": [...], "created", "modified",
                     "slot": n (bank files only, 0-based) }]
     }
   Reading maps every parameter by its key, so a firmware with other ids (or more parameters) still gets
   the right values; parameters the file does not have are null (left at the engine default). Engines are
   matched by name. The old single-sound file ("felucca-patch" version 1, "Save to file") is read too. */
const LIB = { FORMAT: 'felucca-library', VERSION: 1 }
/** a library entry / user preset, cleaned (cleanPatch) */
export interface Patch {
  name: string
  engine: number
  engineName: string
  p: (number | null)[]
  pattern: PatStep[] | null
  tags: string[]
  created: string
  modified: string
  slot?: number
}
/** what cleanPatch takes: a patch as it comes from a file or the page (JSON: anything) */
export type PatchSource = { [k: string]: any }
/** the library's context: {keys, engines, firmware, pe0} (the device's when connected) */
export interface LibCtx {
  keys?: string[] | null
  engines?: string[] | null
  firmware?: string
  pe0?: number | null
}
/** a patch in a library file */
export interface LibFilePatch {
  name: string
  engine: number
  engineName: string
  params: (number | null)[]
  pattern: PatStep[] | null
  tags: string[]
  created: string
  modified: string
  slot?: number
}
export interface LibFile {
  format: string
  version: number
  kind: string
  firmware: string
  pCount: number
  pE0: number | null
  paramLabels: string[]
  engines: string[]
  exported: string
  patches: LibFilePatch[]
}

/* parameter keys by id from the instrument DESCs */
function paramKeys(
  pdesc: (Pick<ParamDesc, 'label'> | null | undefined)[],
  pe0: number,
  pcount: number,
) {
  const seen: Record<string, number> = {},
    out: string[] = []
  for (let i = 0; i < pcount; i++) {
    if (i >= pe0) {
      out.push('E' + (i - pe0))
      continue
    }
    const l = pdesc[i]?.label || 'P' + i
    seen[l] = (seen[l] || 0) + 1
    out.push(seen[l] > 1 ? `${l}#${seen[l]}` : l)
  }
  return out
}
const sameKeys = (
  a: string[] | null | undefined,
  b: string[] | null | undefined,
) => !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i])
/* values by fromKeys -> values by toKeys (null where the source has no such key) */
function remapParams(
  p: (number | null)[],
  fromKeys: string[] | null | undefined,
  toKeys: string[] | null | undefined,
): (number | null)[] {
  if (!fromKeys || !toKeys || sameKeys(fromKeys, toKeys)) return p.slice()
  const at = new Map(fromKeys.map((k, i) => [k, i]))
  return toKeys.map((k) => (at.has(k) ? (p[at.get(k)!] ?? null) : null))
}

/* one pattern step as the firmware keeps it (up_pat_norm): a tie has no note, a rest no flags */
const patNorm = (n: number, f: number): PatStep =>
  f & 4 ? [0, 4] : [n & 0x7f, n ? f & 3 : 0]
/* sequencer steps (STEP_GET objects) -> 16-step pattern, as the firmware's UP_STORE does (up_pat_from):
   the first note of a NOTE step, flag 4 for a TIE step */
function patternFromSteps(steps: (Step | null | undefined)[]): PatStep[] {
  return Array.from({ length: UP.PAT }, (_, i) => {
    const s = steps[i]
    if (!s) return [0, 0]
    return patNorm(
      s.time === 0 && s.n ? s.notes[0] : 0,
      s.time === 1 ? 4 : s.flags,
    )
  })
}
/* pattern -> 16 STEP_SET objects, as the firmware loads one (load_pat16; velocity 96) */
function stepsFromPattern(pat: PatStep[] | null | undefined): Step[] {
  return Array.from({ length: UP.PAT }, (_, i) => {
    const [n, f] = (pat && pat[i]) || [0, 0]
    return {
      n: n ? 1 : 0,
      notes: [n & 0x7f, 0, 0, 0],
      time: f & 4 ? 1 : n ? 0 : 2,
      flags: n ? f & 3 : 0,
      vel: n ? 96 : 0,
    }
  })
}
const patternUsed = (pat: PatStep[] | null | undefined) =>
  !!pat && pat.some((x) => x && x[0])

function cleanPatch(pt: PatchSource): Patch {
  const now = new Date().toISOString()
  const pat =
    Array.isArray(pt.pattern) && pt.pattern.length
      ? Array.from({ length: UP.PAT }, (_, i): PatStep => {
          const x = pt.pattern[i]
          return Array.isArray(x) ? patNorm(x[0] | 0, x[1] | 0) : [0, 0]
        })
      : null
  const o: Patch = {
    name: String(pt.name ?? 'PATCH').slice(0, 32) || 'PATCH',
    engine: pt.engine | 0,
    engineName: String(pt.engineName ?? ''),
    p: Array.from(pt.p || pt.params || [], (v: any) =>
      Number.isFinite(v) ? Math.round(v) : null,
    ),
    pattern: patternUsed(pat) ? pat : null,
    tags: Array.isArray(pt.tags)
      ? ([
          ...new Set(
            pt.tags.map((x: unknown) => String(x).trim()).filter(Boolean),
          ),
        ] as string[])
      : [],
    created: pt.created || now,
    modified: pt.modified || pt.created || now,
  }
  if (Number.isInteger(pt.slot)) o.slot = pt.slot
  return o
}

/* ctx: {keys, engines, firmware, pe0} of the library (the device's when connected) */
function libraryFile(
  kind: string,
  patches: PatchSource[],
  ctx: LibCtx,
): LibFile {
  return {
    format: LIB.FORMAT,
    version: LIB.VERSION,
    kind,
    firmware: ctx.firmware || '',
    pCount: ctx.keys ? ctx.keys.length : 0,
    pE0: ctx.pe0 ?? null,
    paramLabels: ctx.keys || [],
    engines: ctx.engines || [],
    exported: new Date().toISOString(),
    patches: patches.map((x) => {
      const c = cleanPatch(x)
      const o: LibFilePatch = {
        name: c.name,
        engine: c.engine,
        engineName: c.engineName || (ctx.engines || [])[c.engine] || '',
        params: c.p,
        pattern: c.pattern,
        tags: c.tags,
        created: c.created,
        modified: c.modified,
      }
      if (Number.isInteger(x.slot)) o.slot = x.slot
      return o
    }),
  }
}
/* a sound's values (p, the device or file layout: the common parameters, then the engine's 8 from pe0) in another
   layout of n values, as the firmware maps user presets (up_params): new common parameters come just before the
   engine's, so the common ones by position, the engine's 8 by their own place; what the source lacks is null */
function patchByCount<T>(
  p: T[],
  pe0: number | null | undefined,
  n: number,
): (T | null)[] {
  const src =
    Number.isInteger(pe0) && pe0! >= 0 && pe0! + 8 <= p.length
      ? pe0!
      : p.length - 8
  if (!(n > 8) || src < 0 || (p.length === n && src === n - 8))
    return p.slice(0, n)
  const out = new Array(n).fill(null)
  for (let i = 0; i < Math.min(src, n - 8); i++) out[i] = p[i]
  for (let k = 0; k < 8; k++) out[n - 8 + k] = p[src + k] ?? null
  return out
}

/* -> {patches, skipped, keys (the file's, for a library that has none yet)}; throws on a file it cannot read */
function readLibraryFile(
  obj: any,
  ctx: LibCtx,
): { patches: Patch[]; skipped: number; keys: string[] | null } {
  if (!obj || typeof obj !== 'object') throw new Error('not JSON')
  const engIndex = (
    name: string | undefined,
    idx: number,
    fileEngines?: string[],
  ) => {
    const nm = name || (fileEngines || [])[idx]
    if (ctx.engines && ctx.engines.length) {
      if (nm) return ctx.engines.indexOf(nm)
      return idx < ctx.engines.length ? idx : -1
    }
    return idx
  }
  if (obj.format === 'felucca-patch') {
    /* "Save to file": the whole current sound */
    if (!Array.isArray(obj.p) || !Number.isInteger(obj.engine))
      throw new Error('felucca-patch without engine / p')
    const e = engIndex(obj.engineName, obj.engine)
    if (e < 0) return { patches: [], skipped: 1, keys: null }
    return {
      patches: [
        cleanPatch({
          name: obj.presetName || obj.engineName || 'PATCH',
          engine: e,
          engineName: obj.engineName,
          p: ctx.keys
            ? patchByCount(obj.p, obj.pE0, ctx.keys.length)
            : obj.p.slice(),
          pattern: Array.isArray(obj.steps)
            ? patternFromSteps(obj.steps)
            : null,
          tags: ['file'],
        }),
      ],
      skipped: 0,
      keys: null,
    }
  }
  if (obj.format !== LIB.FORMAT) throw new Error('unknown format')
  if (!(obj.version >= 1)) throw new Error('version')
  if (!Array.isArray(obj.patches)) throw new Error('no patches')
  const fileKeys =
    Array.isArray(obj.paramLabels) && obj.paramLabels.length
      ? obj.paramLabels.map(String)
      : null
  const out: Patch[] = []
  let skipped = 0
  for (const x of obj.patches) {
    if (!x || !Array.isArray(x.params)) {
      skipped++
      continue
    }
    const e = engIndex(x.engineName, x.engine | 0, obj.engines)
    if (e < 0) {
      skipped++
      continue
    }
    const p = remapParams(x.params, fileKeys, ctx.keys)
    out.push(
      cleanPatch({
        ...x,
        engine: e,
        engineName:
          (ctx.engines || [])[e] ||
          x.engineName ||
          (obj.engines || [])[x.engine],
        p,
      }),
    )
  }
  return { patches: out, skipped, keys: fileKeys }
}

/* device side; rq(r, opt) -> reply args (Link.request), info from INFO */
const FLASH_OPT = { timeout: 2500, retries: 0 }
const bank = {
  async list(rq: Rq) {
    const first = parse[CMD.UP_LIST](await rq(req.upList(0, UP.LIST_MAX)))
    const slots = first.slots.slice()
    while (slots.length < first.total) {
      const r = parse[CMD.UP_LIST](
        await rq(
          req.upList(
            slots.length,
            Math.min(UP.LIST_MAX, first.total - slots.length),
          ),
        ),
      )
      if (!r.count) break
      slots.push(...r.slots)
    }
    return { total: first.total, slots }
  },
  async get(rq: Rq, info: Pick<DevInfo, 'pcount'>, slot: number) {
    return parse[CMD.UP_GET](await rq(req.upGet(slot)), info)
  },
  /* -> rc (0 ok) */
  async put(rq: Rq, slot: number, pt: PatchIn) {
    return parse[CMD.UP_PUT](await rq(req.upPut(slot, pt), FLASH_OPT)).rc
  },
  async store(rq: Rq, slot: number, name?: string | null) {
    return parse[CMD.UP_STORE](await rq(req.upStore(slot, name), FLASH_OPT)).rc
  },
  async load(rq: Rq, slot: number) {
    return parse[CMD.UP_LOAD](await rq(req.upLoad(slot), { timeout: 1000 })).rc
  },
  async erase(rq: Rq, slot: number) {
    return parse[CMD.UP_ERASE](await rq(req.upErase(slot), FLASH_OPT)).rc
  },
}

/* the current sound: DUMP + the first 16 steps */
/* ---- v6: the complete backup (projects, sections, user presets, samples, settings) ---- */
function u35enc(v: number) {
  v >>>= 0
  return [0, 1, 2, 3, 4].map((k) => Math.floor(v / 2 ** (7 * k)) & 0x7f)
}
function u35dec(r: Reader) {
  let v = 0
  for (let k = 0; k < 5; k++) v += r.b() * 2 ** (7 * k)
  return v >>> 0
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function b64enc(b: ArrayLike<number>) {
  let s = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0)
    s +=
      B64[(n >> 18) & 63] +
      B64[(n >> 12) & 63] +
      (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') +
      (i + 2 < b.length ? B64[n & 63] : '=')
  }
  return s
}
function b64dec(s: string) {
  s = String(s).replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array((s.length * 3) >> 2)
  let o = 0,
    acc = 0,
    bits = 0
  for (const c of s) {
    acc = ((acc << 6) | B64.indexOf(c)) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[o++] = (acc >> bits) & 255
    }
  }
  return out.subarray(0, o)
}
/* object ids (firmware editor.c ED_BK_IDS): 0 the working project, 1 the settings, 2..5 projects A..D,
   6..7 the user preset banks, 32..35 the sample slots USR1..4 (35, USR4: SLOOP 2.4) */
/* RESTORE: the objects in the order they are written back (banks first; 8 = the FM6 patch bank, firmware v9: a
   file without it restores fine, a v8 device gets no object 8 sent; 9 = the SYN drum kits, firmware v10, likewise) */
const BK = {
  FORMAT: 'sloop-backup',
  VERSION: 1,
  SAMPLES: [32, 33, 34, 35],
  RESTORE: [6, 7, 8, 9, 10, 11, 2, 3, 4, 5, 0, 1],
} /* 10: MIDI LEARN (2.6),
 * 11: your theme (2.7, before the settings: they say whether it is shown) */
class BackupError extends Error {
  code: string
  constructor(code: string, msg?: string) {
    super(msg)
    this.code = code
  }
}
/** an object of a backup / song file: its bytes in base64 */
export interface BackupObject {
  id: number
  len: number
  crc: number
  data: string
}
export interface BackupFile {
  format: string
  version: number
  firmware: string
  date: string
  objects: BackupObject[]
}
export interface SongFile {
  format: string
  version: number
  name: string
  firmware: string
  date: string
  order: string | null
  objects: BackupObject[]
}
/** progress(done, total bytes) */
export type Progress = (done: number, total: number) => void
/* read everything; progress(done, total bytes) */
async function backupCapture(
  rq: Rq,
  info: Pick<DevInfo, 'version'>,
  progress: Progress = () => {},
): Promise<BackupFile> {
  const L = parse[CMD.BK_LIST](
    await rq(req.bkList(), { timeout: 5000, retries: 0 }),
  )
  if (L.rc) throw new BackupError('bkRc' + L.rc, `LIST rc ${L.rc}`)
  const total = L.items.reduce((s, it) => s + it.len, 0),
    objects: BackupObject[] = []
  let done = 0
  for (const it of L.items) {
    const data = new Uint8Array(it.len)
    for (let off = 0; off < it.len; off += 256) {
      const n = Math.min(256, it.len - off)
      const g = parse[CMD.BK_GET](
        await rq(req.bkGet(it.id, off, n), { timeout: 1500, retries: 2 }),
      )
      if (g.rc)
        throw new BackupError(
          g.rc === 5 ? 'bkStale' : 'bkRead',
          `GET ${it.id}+${off} rc ${g.rc}`,
        )
      if (g.data.length !== n)
        throw new BackupError(
          'bkRead',
          `GET ${it.id}+${off}: ${g.data.length} bytes`,
        )
      data.set(g.data, off)
      done += n
      progress(done, total)
    }
    if (crc32(data) !== it.crc)
      throw new BackupError('bkStale', `object ${it.id}: CRC`)
    objects.push({ id: it.id, len: it.len, crc: it.crc, data: b64enc(data) })
  }
  return {
    format: BK.FORMAT,
    version: BK.VERSION,
    firmware: info.version,
    date: new Date().toISOString(),
    objects,
  }
}
/* a backup file -> {id: Uint8Array}; every object checked against its length and CRC */
function backupObjects(file: any): Map<number, Uint8Array> {
  if (
    !file ||
    file.format !== BK.FORMAT ||
    !(file.version >= 1) ||
    !Array.isArray(file.objects)
  )
    throw new BackupError('bkBad', 'not a BoopBox backup')
  const m = new Map<number, Uint8Array>()
  for (const o of file.objects) {
    const d = b64dec(o.data || '')
    if (
      ![...BK.RESTORE, ...BK.SAMPLES].includes(o.id) ||
      d.length !== o.len ||
      crc32(d) !== o.crc >>> 0
    )
      throw new BackupError('bkBad', `object ${o.id}: damaged`)
    m.set(o.id, d)
  }
  if (!m.has(0) || !m.has(1))
    throw new BackupError('bkBad', 'incomplete backup')
  return m
}
/* write it back: banks, projects, the working project, the settings, then the samples */
/* the project format of a backup object ("FUN6" .. as stored, low byte first: 6 ..), 0 not a project */
const bkProjFormat = (d: ArrayLike<number> | null | undefined) =>
  d && d.length >= 4 && d[1] === 0x4e && d[2] === 0x55 && d[3] === 0x46
    ? d[0] - 0x30
    : 0
/* the newest project format a device reads, from its INFO: eight tracks 7 (format 7, variable length), 2.6 (71
   parameters) 6, 2.4 .. 2.5 (61) 5, older 4 */
const bkDevFormat = (info: Pick<DevInfo, 'ntrk' | 'pcount'>) =>
  info.ntrk >= 8 ? 7 : info.pcount >= 71 ? 6 : info.pcount >= 61 ? 5 : 4
/* BoopBox (format 7) reads no four-track project of SLOOP's (formats 1..6): a backup or song holding one is refused
   before anything is written (else the restore stopped at its first project, the preset banks already replaced) */
const bkSloopInto = (
  m: Map<number, Uint8Array>,
  ids: number[],
  info: Pick<DevInfo, 'ntrk' | 'pcount'>,
) =>
  bkDevFormat(info) >= 7 &&
  ids.some(
    (id) =>
      m.has(id) && bkProjFormat(m.get(id)) >= 1 && bkProjFormat(m.get(id)) <= 6,
  )
/* "SLOOP 2.6" -> true when at least maj.min.patch */
const bkFwAtLeast = (v: unknown, want: number[]) => {
  if (/boopbox/i.test(String(v || '')))
    return true /* BoopBox (1.0.0 on) continues SLOOP 2.8.3: newer than any SLOOP */
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v || ''))
  if (!m) return false
  const a = [+m[1], +m[2], +(m[3] || 0)]
  for (let i = 0; i < 3; i++) if (a[i] !== want[i]) return a[i] > want[i]
  return true
}
async function backupRestore(rq: Rq, file: any, progress: Progress = () => {}) {
  const m = backupObjects(file)
  /* (2.6) projects newer than the device reads (a 2.6 backup into 2.5): stop before anything is written (it stopped at
     the first project, the preset banks already replaced) */
  const info = parse[CMD.INFO](
    await rq(req.info(), { timeout: 1000, retries: 2 }),
  )
  const newest = Math.max(
    0,
    ...[0, 2, 3, 4, 5]
      .filter((id) => m.has(id))
      .map((id) => bkProjFormat(m.get(id))),
  )
  if (newest > bkDevFormat(info))
    throw new BackupError(
      'bkNewer',
      `${file.firmware || '?'} > ${info.version}`,
    )
  if (bkSloopInto(m, [0, 2, 3, 4, 5], info))
    throw new BackupError(
      'bkSloop',
      `${file.firmware || '?'} -> ${info.version}`,
    )
  /* (2.6) a backup of a 2.6 FM-1 without object 10 had the MIDI settings at their defaults (nothing learned, channels
     1 2 3, drums 10, OTHER SEL, BEND 2): restored as such, not left as the device has them now */
  if (!m.has(10) && bkFwAtLeast(file.firmware, [2, 5, 1])) {
    const d = new Uint8Array(
      bkDevFormat(info) >= 7 ? 48 : 40,
    ) /* (BoopBox: the 48-byte part, its tail 0: the defaults) */
    d.set([1, 2, 3, 10, 2], 32)
    m.set(10, d)
  }
  const total = [...m.values()].reduce((s, d) => s + d.length, 0) || 1
  let done = 0
  for (const id of BK.RESTORE) {
    if (!m.has(id)) continue
    const d = m.get(id)!
    let r = parse[CMD.BK_PUT](
      await rq(req.bkBegin(id, d.length, crc32(d)), {
        timeout: 1500,
        retries: 1,
      }),
    )
    if (
      (r.rc === 1 || r.rc === 5) &&
      (id === 8 || id === 9 || id === 10 || id === 11)
    )
      continue /* a device without the FM6 bank (v8) /
     * the SYN kits (v9) / MIDI LEARN (2.6): skipped (its BK_PUT answers
     * an unknown id's begin with 5) */
    if (r.rc) throw new BackupError('bkWrite', `begin ${id} rc ${r.rc}`)
    for (let off = 0; off < d.length; off += 256) {
      r = parse[CMD.BK_PUT](
        await rq(req.bkData(id, off, d.subarray(off, off + 256)), {
          timeout: 1500,
          retries: 1,
        }),
      )
      if (r.rc) throw new BackupError('bkWrite', `data ${id}+${off} rc ${r.rc}`)
      done += Math.min(256, d.length - off)
      progress(done, total)
    }
    r = parse[CMD.BK_PUT](
      await rq(req.bkCommit(id), { timeout: 5000, retries: 0 }),
    )
    if (r.rc === 3) throw new BackupError('bkStop', 'stop the song first')
    if (r.rc) throw new BackupError('bkWrite', `commit ${id} rc ${r.rc}`)
  }
  for (const id of BK.SAMPLES) {
    if (!m.has(id)) continue
    const d = m.get(id)!,
      k = id - 32
    if (!d.length) {
      const e = parse[CMD.SMP_ERASE](
        await rq(req.smpErase(k), { timeout: 2500, retries: 0 }),
      )
      if (e.rc) throw new BackupError('bkWrite', `erase USR${k + 1} rc ${e.rc}`)
      continue
    }
    let r = parse[CMD.SMP_BEGIN](
      await rq(req.smpBegin(k), { timeout: 1000, retries: 0 }),
    )
    if (r.rc) throw new BackupError('bkWrite', `USR${k + 1} begin rc ${r.rc}`)
    const data = d.subarray(SMP.DATA_OFF)
    for (let off = 0; off < data.length; off += 256) {
      const w = parse[CMD.SMP_WRITE](
        await rq(
          req.smpWrite(k, SMP.DATA_OFF + off, data.subarray(off, off + 256)),
          { timeout: 1000, retries: 1 },
        ),
      )
      if (w.rc) throw new BackupError('bkWrite', `USR${k + 1} write rc ${w.rc}`)
      done += Math.min(256, data.length - off)
      progress(done, total)
    }
    r = parse[CMD.SMP_END](
      await rq(req.smpEnd(k, d.subarray(0, SMP.HDR_LEN)), {
        timeout: 2000,
        retries: 0,
      }),
    )
    if (r.rc) throw new BackupError('bkWrite', `USR${k + 1} end rc ${r.rc}`)
  }
  return true
}

/* 2.5 Store cartridge: packed patches into B1..Bn in one write. The bank (backup object 8) is read whole, slots
   0..n-1 replaced, the others kept, and written back whole (BK_PUT, as a restore: one flash write, stopped only).
   -> 0 written, 3 the song plays (nothing changed), "old" a device without object 8 (before v9) */
async function fm6CartWrite(
  rq: Rq,
  packs: ArrayLike<number>[],
): Promise<0 | 3 | 'old'> {
  if (!packs.length || packs.length > FM6.BANK_N)
    throw new Error(`bank: ${packs.length} voices`)
  const L = parse[CMD.BK_LIST](
    await rq(req.bkList(), { timeout: 5000, retries: 0 }),
  )
  if (L.rc) throw new Error(`bank: LIST rc ${L.rc}`)
  const it = L.items.find((x) => x.id === 8)
  if (!it) return 'old'
  const cur = new Uint8Array(it.len)
  for (let off = 0; off < it.len; off += 256) {
    const nn = Math.min(256, it.len - off)
    const g = parse[CMD.BK_GET](
      await rq(req.bkGet(8, off, nn), { timeout: 1500, retries: 2 }),
    )
    if (g.rc || g.data.length !== nn) throw new Error(`bank: GET rc ${g.rc}`)
    cur.set(g.data, off)
  }
  const slots =
    FM6.bankUnobj(cur) /* a bank this page can't read is never overwritten */
  if (!slots) throw new Error('bank: unknown format')
  packs.forEach((pk, i) => {
    slots[i] = FM6.pack(FM6.unpack(pk))
  }) /* every value in range, as fm6_bank_put */
  const d = FM6.bankObj(slots)
  let r = parse[CMD.BK_PUT](
    await rq(req.bkBegin(8, d.length, crc32(d)), { timeout: 1500, retries: 1 }),
  )
  if (r.rc) throw new Error(`bank: begin rc ${r.rc}`)
  for (let off = 0; off < d.length; off += 256) {
    r = parse[CMD.BK_PUT](
      await rq(req.bkData(8, off, d.subarray(off, off + 256)), {
        timeout: 1500,
        retries: 1,
      }),
    )
    if (r.rc) throw new Error(`bank: data rc ${r.rc}`)
  }
  r = parse[CMD.BK_PUT](
    await rq(req.bkCommit(8), { timeout: 5000, retries: 0 }),
  )
  if (r.rc === 3) return 3
  if (r.rc) throw new Error(`bank: commit rc ${r.rc}`)
  return 0
}
/* 2.5: a user preset that plays bank slot k (B(k+1)): engine FM6, the voice's name, every value at its default
   (base: P_COUNT values; the macros neutral, so the patch plays as it is), PTCH (P_E7) = F count + k. A user preset
   keeps PTCH, not the patch (a record has no room for 128 bytes): loading it loads B(k+1) */
function fm6CartPreset(
  info: Pick<DevInfo, 'pcount' | 'pe0' | 'engines'>,
  base: (number | null | undefined)[],
  nf: number,
  k: number,
  name?: string | null,
) {
  const p = Array.from({ length: info.pcount }, (_, i) => base[i] ?? 0)
  p[info.pe0 + 7] = nf + k
  return {
    engine: info.engines.indexOf('FM6'),
    name: upName(name || `FM6 B${k + 1}`),
    p,
    pattern: [],
  }
}
/* the preset slots for n voices: from "free" = the first n free ones, from a slot s = s..s+n-1; null: no room */
function fm6CartSlots(
  list: { total: number; slots: Pick<UpSlot, 'used' | 'slot'>[] },
  n: number,
  from: 'free' | number,
) {
  if (from === 'free') {
    const f = list.slots.filter((x) => !x.used).map((x) => x.slot)
    return f.length >= n ? f.slice(0, n) : null
  }
  const s = from | 0
  return s >= 0 && s + n <= list.total
    ? Array.from({ length: n }, (_, i) => s + i)
    : null
}
/* the presets after the bank (fm6CartWrite): one UP_PUT each -> 0, or the first rc (3: the song plays) */
async function fm6CartPresets(rq: Rq, puts: { slot: number; pt: PatchIn }[]) {
  for (const { slot, pt } of puts) {
    const rc = await bank.put(rq, slot, pt)
    if (rc) return rc
  }
  return 0
}

async function capturePatch(rq: Rq, info: DevInfo, name: string) {
  const dump = parse[CMD.DUMP](await rq(req.dump()), info)
  const steps: StepReply[] = []
  for (let i = 0; i < UP.PAT && i < info.nstep; i++)
    steps.push(parse[CMD.STEP_GET](await rq(req.stepGet(i))))
  return {
    patch: cleanPatch({
      name,
      engine: dump.engine,
      engineName: info.engines[dump.engine],
      p: dump.p,
      pattern: patternFromSteps(steps),
    }),
    dump,
    steps,
  }
}

/* what loading a sound leaves alone (firmware ui.c param_kept): the mix (LEVEL, PAN, MUTE), the pattern
   parameters (LEN, DIV, SWG, GATE) and the key the part plays in (ROOT, SCL, QNT; CHORD from SLOOP 2.0); the track FILTER (2.4) */
const keptIds = (info: Pick<DevInfo, 'pe0'>) =>
  new Set([
    0,
    25,
    26,
    27,
    29,
    30,
    31,
    32,
    39,
    40,
    ...(info.pe0 > 49 ? [49] : []),
    ...(info.pe0 > 50 ? [50] : []),
    ...(info.pe0 > 52 ? [51, 52] : []),
  ])
/* play a patch without writing flash, as UP_LOAD would load it: SET the engine (G_ENGSEL, engine defaults),
   then every parameter of the sound that differs. Never the pattern (LIVE: a sound never changes the
   sequence), the mix or the key. opt: {gEng: G_ENGSEL id, progress(i, n)} -> {wrote: false} */
async function auditionPatch(
  rq: Rq,
  info: Pick<DevInfo, 'pcount' | 'gcount' | 'pe0'>,
  pt: Pick<PatchIn, 'engine' | 'p'>,
  opt: { gEng?: number; progress?: (i: number, n: number) => void } = {},
) {
  await rq(req.set(1, opt.gEng ?? 20, pt.engine))
  const dump = parse[CMD.DUMP](await rq(req.dump()), info)
  const n = Math.min(info.pcount, pt.p.length),
    kept = keptIds(info)
  for (let i = 0; i < n; i++) {
    const v = pt.p[i]
    if (opt.progress) opt.progress(i, n)
    if (v == null || kept.has(i) || v === dump.p[i]) continue
    await rq(req.set(0, i, v))
  }
  return { wrote: false }
}

/* WATCH on (asking for TRACK_CHANGED too): false when the firmware does not know it (older than protocol v2),
   else 1, or 3 when it also has TRACK_PARAM / TRACK_CHANGED (protocol v4) */
async function startWatch(rq: Rq): Promise<number | false> {
  try {
    const on = parse[CMD.WATCH](
      await rq(req.watch(3), { timeout: 300, retries: 1, quiet: true }),
    ).on
    return on & 1 ? on & 3 : false
  } catch (e) {
    if ((e as Error).message === 'closed') throw e
    return false
  }
}

/* ------------------------------------------------------------ mixer (v3) --- */
/* The TRACKS page in the editor: TRACK (engine, preset, level, mute, armed of all four) and TRACK_DUMP
   of each track for its P_PAN. Level and mute go through TRACK_MIX (any track; the drum level is
   G_DRLVL). Pan: TRACK_PARAM (v4, any track); with v3 firmware a plain SET, which reaches only the
   selected track: another track is selected for it and the selection is put back (TRACK pushes no
   RELOAD). ids: {pan: P_PAN id} */
const mixer = {
  async read(
    rq: Rq,
    info: Pick<DevInfo, 'pcount' | 'pe0'>,
    ids: { pan?: number | null },
  ) {
    const tr = parse[CMD.TRACK](await rq(req.track()))
    for (let i = 0; i < tr.ntrk; i++) {
      const d = parse[CMD.TRACK_DUMP](await rq(req.trackDump(i)), info)
      tr.tracks[i].pan = ids.pan == null ? null : d.p[ids.pan]
      tr.tracks[i].e0 = d.p[info.pe0] /* the drum track: its kit */
    }
    return tr
  },
  /* -> {track, level, mute} as the device has them now */
  async setMix(
    rq: Rq,
    track: number,
    level?: number | null,
    mute?: boolean | number,
    opt?: RequestOpt,
  ) {
    return parse[CMD.TRACK_MIX](await rq(req.trackMix(track, level, mute), opt))
  },
  /* -> the pan value after clamping. v4: TRACK_PARAM, the selection stays */
  async setPan(
    rq: Rq,
    track: number,
    sel: number,
    panId: number,
    v: number,
    v4?: boolean | number,
  ) {
    if (v4)
      return parse[CMD.TRACK_PARAM](
        await rq(req.trackParam(track, panId, v), { key: 'pan:' + track }),
      ).value
    if (track === sel)
      return parse[CMD.SET](await rq(req.set(0, panId, v))).value
    await rq(req.track(track))
    try {
      return parse[CMD.SET](await rq(req.set(0, panId, v))).value
    } finally {
      await rq(req.track(sel)).catch(() => {})
    }
  },
}

/* ---- (2.7) a song as one file: the loop playing (object 0), the sections A..D (2..5; an empty one is not in the
   file) and their order on the SONG screen (the 36 bytes of the settings at 48, arranger.h arr_config_t). Loaded
   onto an FM-1 (stopped: the commits answer 3 while it plays) every section is written, an empty one as 0 bytes, then
   the loop, then the order into the device's own settings (its colours, calibration... kept). The LIVE page's
   playlist is a list of these files */
const SONGF = {
  FORMAT: 'sloop-song',
  VERSION: 1,
  SECS: [2, 3, 4, 5],
  ORDER_OFF: 48,
  ORDER_LEN: 36,
  PER3: 0x50455233,
}
const songOrderOk = (b: ArrayLike<number> | null | undefined) =>
  !!b &&
  b.length >= SONGF.ORDER_OFF + SONGF.ORDER_LEN &&
  (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0 === SONGF.PER3
/* one object, read whole after a LIST (the LIST's item: {id, len, crc}) */
async function bkReadObj(rq: Rq, it: BkItem) {
  const data = new Uint8Array(it.len)
  for (let off = 0; off < it.len; off += 256) {
    const n = Math.min(256, it.len - off)
    const g = parse[CMD.BK_GET](
      await rq(req.bkGet(it.id, off, n), { timeout: 1500, retries: 2 }),
    )
    if (g.rc)
      throw new BackupError(
        g.rc === 5 ? 'bkStale' : 'bkRead',
        `GET ${it.id}+${off} rc ${g.rc}`,
      )
    if (g.data.length !== n)
      throw new BackupError(
        'bkRead',
        `GET ${it.id}+${off}: ${g.data.length} bytes`,
      )
    data.set(g.data, off)
  }
  if (crc32(data) !== it.crc)
    throw new BackupError('bkStale', `object ${it.id}: CRC`)
  return data
}
/* one object written (0 bytes: an empty section) -> rc 0, or throws (bkStop: the song plays) */
async function bkWriteObj(
  rq: Rq,
  id: number,
  d: Uint8Array,
  progress: (n: number) => void = () => {},
): Promise<void> {
  let r = parse[CMD.BK_PUT](
    await rq(req.bkBegin(id, d.length, crc32(d)), {
      timeout: 1500,
      retries: 1,
    }),
  )
  if (r.rc) throw new BackupError('bkWrite', `begin ${id} rc ${r.rc}`)
  for (let off = 0; off < d.length; off += 256) {
    r = parse[CMD.BK_PUT](
      await rq(req.bkData(id, off, d.subarray(off, off + 256)), {
        timeout: 1500,
        retries: 1,
      }),
    )
    if (r.rc) throw new BackupError('bkWrite', `data ${id}+${off} rc ${r.rc}`)
    progress(Math.min(256, d.length - off))
  }
  r = parse[CMD.BK_PUT](
    await rq(req.bkCommit(id), { timeout: 5000, retries: 0 }),
  )
  if (r.rc === 3) throw new BackupError('bkStop', 'stop the song first')
  if (r.rc) throw new BackupError('bkWrite', `commit ${id} rc ${r.rc}`)
}
async function songCapture(
  rq: Rq,
  info: Pick<DevInfo, 'version'>,
  name: string,
  progress: Progress = () => {},
): Promise<SongFile> {
  const L = parse[CMD.BK_LIST](
    await rq(req.bkList(), { timeout: 5000, retries: 0 }),
  )
  if (L.rc) throw new BackupError('bkRc' + L.rc, `LIST rc ${L.rc}`)
  const items = L.items.filter(
    (it) =>
      it.id === 0 || it.id === 1 || (SONGF.SECS.includes(it.id) && it.len),
  )
  const total = items.reduce((s, it) => s + it.len, 0) || 1,
    objects: BackupObject[] = []
  let done = 0,
    order: Uint8Array | null = null
  for (const it of items) {
    const d = await bkReadObj(rq, it)
    done += it.len
    progress(done, total)
    if (it.id === 1) {
      if (songOrderOk(d))
        order = d.slice(SONGF.ORDER_OFF, SONGF.ORDER_OFF + SONGF.ORDER_LEN)
      continue
    }
    objects.push({ id: it.id, len: it.len, crc: it.crc, data: b64enc(d) })
  }
  return {
    format: SONGF.FORMAT,
    version: SONGF.VERSION,
    name: String(name || '').slice(0, 40),
    firmware: info.version,
    date: new Date().toISOString(),
    order: order ? b64enc(order) : null,
    objects,
  }
}
/* a song file -> {objects: Map id -> bytes, order: bytes or null}; every object checked against its length and CRC */
function songObjects(file: any): {
  objects: Map<number, Uint8Array>
  order: Uint8Array | null
} {
  if (
    !file ||
    file.format !== SONGF.FORMAT ||
    !(file.version >= 1) ||
    !Array.isArray(file.objects)
  )
    throw new BackupError('songBadFile', 'not a BoopBox song')
  const m = new Map<number, Uint8Array>()
  for (const o of file.objects) {
    const d = b64dec(o.data || '')
    if (
      !(o.id === 0 || SONGF.SECS.includes(o.id)) ||
      d.length !== o.len ||
      crc32(d) !== o.crc >>> 0
    )
      throw new BackupError('songBadFile', `object ${o.id}: damaged`)
    m.set(o.id, d)
  }
  if (!m.has(0)) throw new BackupError('songBadFile', 'no loop')
  const order = file.order ? b64dec(file.order) : null
  if (order && order.length !== SONGF.ORDER_LEN)
    throw new BackupError('songBadFile', 'order')
  return { objects: m, order }
}
/* onto the FM-1 (stopped); progress(done, total bytes) */
async function songLoad(rq: Rq, file: any, progress: Progress = () => {}) {
  const { objects: m, order } = songObjects(file)
  const info = parse[CMD.INFO](
    await rq(req.info(), { timeout: 1000, retries: 2 }),
  )
  const newest = Math.max(0, ...[...m.values()].map(bkProjFormat))
  if (newest > bkDevFormat(info))
    throw new BackupError(
      'bkNewer',
      `${file.firmware || '?'} > ${info.version}`,
    )
  if (bkSloopInto(m, [...m.keys()], info))
    throw new BackupError(
      'bkSloop',
      `${file.firmware || '?'} -> ${info.version}`,
    )
  const total = [...m.values()].reduce((s, d) => s + d.length, 0) || 1
  let done = 0
  const step = (n: number): void => {
    done += n
    progress(done, total)
  }
  for (const id of SONGF.SECS)
    await bkWriteObj(rq, id, m.get(id) || new Uint8Array(0), step)
  await bkWriteObj(rq, 0, m.get(0)!, step)
  if (order) {
    /* the order, into the settings as the FM-1 has them */
    const L = parse[CMD.BK_LIST](
      await rq(req.bkList(), { timeout: 5000, retries: 0 }),
    )
    const it = L.rc ? null : L.items.find((x) => x.id === 1)
    if (!it) throw new BackupError('bkRead', `LIST rc ${L.rc}`)
    const s = await bkReadObj(rq, it)
    if (songOrderOk(s)) {
      s.set(order, SONGF.ORDER_OFF)
      await bkWriteObj(rq, 1, s)
    }
  }
  return true
}

/* ------------------------------------------------------------ mock device --- */
/* Implements the protocol like firmware/src/editor.c, with tables copied from params.c
   and the engine sources. Used with ?mock=1 (add &legacy=1 for a firmware without cmds 16..26).
   opt: {legacy: no user bank / WATCH, v3: no TRACK_PARAM / TRACK_CHANGED (firmware 0.8),
         auto: false = no simulated knobs (tests drive sim.*),
         watchMs: how long WATCH lasts after the last request (3000), slots: user bank size (32)} */
/* ------------------------------------------------------------------- FM6 --- */
/* The FM6 engine's patches (eng_fm6.c, EDITOR_PROTOCOL.md "FM6 patches", firmware v9): the generic 6-operator voice.
   voice: 155 bytes, 6 x 21 operator bytes (the sixth operator first, as the format has them), then 19 voice bytes
   and a 10-character name. packed: the 128-byte record of a 32-voice bank (every byte 7-bit). SysEx files: a
   single voice (F0 43 0n 00 01 1B, 155 bytes, checksum, F7: 163 bytes) or 32 packed voices (F0 43 0n 09 20 00,
   4096 bytes, checksum, F7: 4104 bytes); raw 155 / 128 / 4096-byte files are read too, and damaged ones as far
   as they go (parseSysex). */
/** FM6.parseSysex: the voices of a file */
export interface Fm6Sysex {
  voices: { v: Uint8Array; name: string }[]
  badSum: number
  short: number
  skipped: number
  kinds: string[]
  sysex: boolean
}
const FM6 = (() => {
  /* per operator byte: name, highest value; then the voice bytes */
  const OP: [name: string, max: number][] = [
    ['R1', 99],
    ['R2', 99],
    ['R3', 99],
    ['R4', 99],
    ['L1', 99],
    ['L2', 99],
    ['L3', 99],
    ['L4', 99],
    ['BP', 99],
    ['LD', 99],
    ['RD', 99],
    ['LC', 3],
    ['RC', 3],
    ['RS', 7],
    ['AMS', 3],
    ['KVS', 7],
    ['OL', 99],
    ['MODE', 1],
    ['FC', 31],
    ['FF', 99],
    ['DET', 14],
  ]
  const VOICE: [name: string, max: number][] = [
    ['PR1', 99],
    ['PR2', 99],
    ['PR3', 99],
    ['PR4', 99],
    ['PL1', 99],
    ['PL2', 99],
    ['PL3', 99],
    ['PL4', 99],
    ['ALG', 31],
    ['FB', 7],
    ['OKS', 1],
    ['LFS', 99],
    ['LFD', 99],
    ['LPMD', 99],
    ['LAMD', 99],
    ['LKS', 1],
    ['LFW', 5],
    ['LPMS', 7],
    ['TRNSP', 48],
  ]
  const OPI = Object.fromEntries(OP.map(([n], i) => [n, i])),
    VI = Object.fromEntries(VOICE.map(([n], i) => [n, 126 + i]))
  const NAME = 145,
    SIZE = 155,
    PACKED = 128
  const max = (i: number) =>
    i < 126 ? OP[i % 21][1] : i < NAME ? VOICE[i - 126][1] : 126
  /* byte i of operator n (1..6) */
  const at = (n: number, field: string) => (6 - n) * 21 + OPI[field]
  function sanitize(v: Bytes) {
    const o = Uint8Array.from(v.slice(0, SIZE))
    for (let i = 0; i < SIZE; i++)
      o[i] =
        i >= NAME
          ? o[i] < 32 || o[i] > 126
            ? 32
            : o[i]
          : Math.min(o[i], max(i))
    return o
  }
  function unpack(b: ArrayLike<number>) {
    /* eng_fm6.c fm6_unpack */
    const v = new Uint8Array(SIZE)
    for (let k = 0; k < 6; k++) {
      const o = k * 17,
        d = k * 21
      for (let i = 0; i < 11; i++) v[d + i] = b[o + i] & 127
      v[d + 11] = b[o + 11] & 3
      v[d + 12] = (b[o + 11] >> 2) & 3
      v[d + 13] = b[o + 12] & 7
      v[d + 20] = (b[o + 12] >> 3) & 15
      v[d + 14] = b[o + 13] & 3
      v[d + 15] = (b[o + 13] >> 2) & 7
      v[d + 16] = b[o + 14] & 127
      v[d + 17] = b[o + 15] & 1
      v[d + 18] = (b[o + 15] >> 1) & 31
      v[d + 19] = b[o + 16] & 127
    }
    for (let i = 0; i < 9; i++) v[126 + i] = b[102 + i] & 127
    v[134] &= 31
    v[135] = b[111] & 7
    v[136] = (b[111] >> 3) & 1
    for (let i = 0; i < 4; i++) v[137 + i] = b[112 + i] & 127
    v[141] = b[116] & 1
    v[142] = (b[116] >> 1) & 7
    v[143] = (b[116] >> 4) & 7
    v[144] = b[117] & 127
    for (let i = 0; i < 10; i++) v[NAME + i] = b[118 + i] & 127
    return sanitize(v)
  }
  function pack(v: ArrayLike<number>): number[] {
    /* eng_fm6.c fm6_pack */
    const b: number[] = new Array(PACKED).fill(0)
    for (let k = 0; k < 6; k++) {
      const o = k * 17,
        d = k * 21
      for (let i = 0; i < 11; i++) b[o + i] = v[d + i] & 127
      b[o + 11] = (v[d + 11] & 3) | ((v[d + 12] & 3) << 2)
      b[o + 12] = (v[d + 13] & 7) | ((v[d + 20] & 15) << 3)
      b[o + 13] = (v[d + 14] & 3) | ((v[d + 15] & 7) << 2)
      b[o + 14] = v[d + 16] & 127
      b[o + 15] = (v[d + 17] & 1) | ((v[d + 18] & 31) << 1)
      b[o + 16] = v[d + 19] & 127
    }
    for (let i = 0; i < 9; i++) b[102 + i] = v[126 + i] & 127
    b[110] &= 31
    b[111] = (v[135] & 7) | ((v[136] & 1) << 3)
    for (let i = 0; i < 4; i++) b[112 + i] = v[137 + i] & 127
    b[116] = (v[141] & 1) | ((v[142] & 7) << 1) | ((v[143] & 7) << 4)
    b[117] = v[144] & 127
    for (let i = 0; i < 10; i++) b[118 + i] = v[NAME + i] & 127
    return b
  }
  const name = (v: Bytes) =>
    String.fromCharCode(...v.slice(NAME, NAME + 10)).replace(/\s+$/, '')
  function setName<T extends Bytes>(v: T, s: unknown) {
    const t = String(s)
      .toUpperCase()
      .replace(/[^\x20-\x7E]/g, ' ')
      .slice(0, 10)
      .padEnd(10, ' ')
    for (let i = 0; i < 10; i++) v[NAME + i] = t.charCodeAt(i)
    return v
  }
  const checksum = (a: {
    reduce(cb: (s: number, x: number) => number, init: number): number
  }) => (128 - (a.reduce((s, x) => s + x, 0) & 127)) & 127
  /* every voice in a file's bytes: [{name, v}] (after Felucca 1.0.3's editor: files cut short, banks with a bad
     checksum, several banks or voices in one file, raw 4096-byte banks one after another are read); badSum: messages
     whose checksum did not match (still read), short: messages cut short (their whole voices read), skipped / kinds:
     the SysEx that were not 6-operator voices (4-op, another maker, universal...), sysex: the file held any */
  function parseSysex(bytes: ArrayLike<number>): Fm6Sysex {
    const d = Uint8Array.from(bytes),
      voices: { v: Uint8Array; name: string }[] = [],
      kinds: string[] = []
    let badSum = 0,
      short = 0,
      skipped = 0
    const add = (v: Uint8Array) => voices.push({ v, name: name(v) })
    const kind = (k: string): void => {
      skipped++
      if (!kinds.includes(k)) kinds.push(k)
    }
    const sysex = d.includes(0xf0)
    if (d[0] !== 0xf0 && !sysex) {
      /* raw data: banks of 4096, one voice of 155 or packed 128 */
      if (d.length && d.length % 4096 === 0) {
        for (let o = 0; o < d.length; o += 128)
          add(unpack(d.subarray(o, o + 128)))
      } else if (d.length === SIZE) add(sanitize(d))
      else if (d.length === PACKED) add(unpack(d))
      return { voices, badSum, short, skipped, kinds, sysex }
    }
    for (let i = 0; i < d.length; i++) {
      if (d[i] !== 0xf0) continue
      const id = d[i + 1],
        st = d[i + 2],
        f = d[i + 3]
      if (
        id === 0x43 &&
        st !== undefined &&
        (st & 0xf0) === 0 &&
        (f === 0 || f === 9) &&
        i + 6 <= d.length
      ) {
        const want = f === 0 ? SIZE : 4096,
          s0 = i + 6
        let e = s0
        while (e < d.length && e < s0 + want && d[e] < 0x80) e++
        const data = d.subarray(s0, e)
        if (data.length < want) short++
        else if (e < d.length && d[e] < 0x80 && checksum(data) !== d[e])
          badSum++
        if (f === 0) {
          if (data.length >= NAME) {
            const v = new Uint8Array(SIZE)
            v.set(data)
            add(sanitize(v))
          }
        } else {
          for (let o = 0; o + 118 <= data.length; o += 128) {
            /* whole voices, and one cut in its name (at 118) */
            const pk = new Uint8Array(128)
            pk.set(data.subarray(o, o + 128))
            add(unpack(pk))
          }
        }
        i =
          e - 1 /* on to the next F0 (the checksum, F7, junk are passed over) */
        continue
      }
      if (id === 0x43) kind(f === 3 || f === 4 ? 'fm4' : 'other43')
      else if (id === 0x7e || id === 0x7f) kind('universal')
      else if (id !== undefined && id < 0x80)
        kind(
          'maker:' +
            (id === 0 ? [0, d[i + 2], d[i + 3]] : [id])
              .map((x) => (x ?? 0).toString(16).toUpperCase().padStart(2, '0'))
              .join(' '),
        )
    }
    return { voices, badSum, short, skipped, kinds, sysex }
  }
  function singleSysex(v: Bytes, ch = 0) {
    const data = Array.from(sanitize(v))
    return Uint8Array.from([
      0xf0,
      0x43,
      ch & 15,
      0,
      0x01,
      0x1b,
      ...data,
      checksum(data),
      0xf7,
    ])
  }
  function bankSysex(voices: (ArrayLike<number> | null | undefined)[], ch = 0) {
    /* up to 32 voices (155 bytes each), the rest the init voice */
    const data: number[] = []
    for (let k = 0; k < 32; k++)
      data.push(...(voices[k] ? pack(voices[k]!) : INIT_PK))
    return Uint8Array.from([
      0xf0,
      0x43,
      ch & 15,
      9,
      0x20,
      0,
      ...data,
      checksum(data),
      0xf7,
    ])
  }
  /* the 32 algorithms (msfa's tables; fm6_core.c FM6_ALG): per operator, the sixth first */
  const ALG = [
    [0xc1, 0x11, 0x11, 0x14, 0x01, 0x14],
    [0x01, 0x11, 0x11, 0x14, 0xc1, 0x14],
    [0xc1, 0x11, 0x14, 0x01, 0x11, 0x14],
    [0xc1, 0x11, 0x94, 0x01, 0x11, 0x14],
    [0xc1, 0x14, 0x01, 0x14, 0x01, 0x14],
    [0xc1, 0x94, 0x01, 0x14, 0x01, 0x14],
    [0xc1, 0x11, 0x05, 0x14, 0x01, 0x14],
    [0x01, 0x11, 0xc5, 0x14, 0x01, 0x14],
    [0x01, 0x11, 0x05, 0x14, 0xc1, 0x14],
    [0x01, 0x05, 0x14, 0xc1, 0x11, 0x14],
    [0xc1, 0x05, 0x14, 0x01, 0x11, 0x14],
    [0x01, 0x05, 0x05, 0x14, 0xc1, 0x14],
    [0xc1, 0x05, 0x05, 0x14, 0x01, 0x14],
    [0xc1, 0x05, 0x11, 0x14, 0x01, 0x14],
    [0x01, 0x05, 0x11, 0x14, 0xc1, 0x14],
    [0xc1, 0x11, 0x02, 0x25, 0x05, 0x14],
    [0x01, 0x11, 0x02, 0x25, 0xc5, 0x14],
    [0x01, 0x11, 0x11, 0xc5, 0x05, 0x14],
    [0xc1, 0x14, 0x14, 0x01, 0x11, 0x14],
    [0x01, 0x05, 0x14, 0xc1, 0x14, 0x14],
    [0x01, 0x14, 0x14, 0xc1, 0x14, 0x14],
    [0xc1, 0x14, 0x14, 0x14, 0x01, 0x14],
    [0xc1, 0x14, 0x14, 0x01, 0x14, 0x04],
    [0xc1, 0x14, 0x14, 0x14, 0x04, 0x04],
    [0xc1, 0x14, 0x14, 0x04, 0x04, 0x04],
    [0xc1, 0x05, 0x14, 0x01, 0x14, 0x04],
    [0x01, 0x05, 0x14, 0xc1, 0x14, 0x04],
    [0x04, 0xc1, 0x11, 0x14, 0x01, 0x14],
    [0xc1, 0x14, 0x01, 0x14, 0x04, 0x04],
    [0x04, 0xc1, 0x11, 0x14, 0x04, 0x04],
    [0xc1, 0x14, 0x04, 0x04, 0x04, 0x04],
    [0xc4, 0x04, 0x04, 0x04, 0x04, 0x04],
  ]
  /* operators 1..6 that are carriers (on the output bus), and the one with the feedback, of algorithm a (0..31) */
  const carriers = (a: number) =>
    [1, 2, 3, 4, 5, 6].filter((n) => !(ALG[a & 31][6 - n] & 3))
  const feedbackOp = (a: number) =>
    [1, 2, 3, 4, 5, 6].find((n) => (ALG[a & 31][6 - n] & 0xc0) === 0xc0)
  /* an operator's frequency as text: x ratio, or Hz for a fixed one (msfa note osc_freq) */
  function freqText(v: ArrayLike<number>, n: number) {
    const fc = v[at(n, 'FC')],
      ff = v[at(n, 'FF')]
    if (v[at(n, 'MODE')])
      return (10 ** ((fc & 3) + ff / 100)).toPrecision(4) + ' Hz'
    return 'x' + ((fc ? fc : 0.5) * (1 + ff / 100)).toFixed(2)
  }
  const INIT_PK = [
    99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99, 99,
    99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99, 99, 99, 99, 99, 0,
    39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56,
    0, 0, 2, 0, 99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99,
    99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 99, 2, 0, 99, 99, 99, 99, 50,
    50, 50, 50, 0, 8, 35, 0, 0, 0, 49, 24, 73, 78, 73, 84, 32, 86, 79, 73, 67,
    69,
  ]
  const FACTORY_PK = [
    [
      95, 40, 30, 60, 99, 80, 0, 0, 39, 0, 0, 0, 56, 12, 52, 2, 0, 95, 30, 20,
      60, 99, 90, 0, 0, 39, 0, 0, 0, 48, 4, 78, 2, 0, 97, 62, 40, 60, 99, 60, 0,
      0, 39, 0, 0, 0, 59, 24, 68, 28, 0, 95, 20, 20, 50, 99, 95, 0, 0, 39, 0, 0,
      0, 66, 8, 90, 2, 0, 95, 50, 35, 78, 99, 75, 0, 0, 39, 0, 0, 0, 59, 28, 58,
      2, 0, 96, 25, 25, 67, 99, 75, 0, 0, 39, 0, 0, 0, 59, 8, 98, 2, 0, 99, 99,
      99, 99, 50, 50, 50, 50, 4, 11, 34, 33, 0, 0, 41, 24, 84, 73, 78, 69, 32,
      69, 80, 32, 32, 32,
    ] /* TINE EP */,
    [
      99, 60, 40, 45, 99, 50, 0, 0, 39, 0, 0, 0, 56, 0, 60, 2, 0, 99, 60, 40,
      45, 99, 50, 0, 0, 39, 0, 0, 0, 40, 0, 78, 10, 40, 99, 50, 30, 40, 99, 60,
      0, 0, 39, 0, 0, 0, 56, 12, 70, 10, 0, 99, 45, 30, 40, 99, 70, 0, 0, 39, 0,
      0, 0, 72, 4, 84, 4, 38, 99, 35, 25, 35, 99, 70, 0, 0, 39, 0, 0, 0, 56, 12,
      78, 6, 50, 99, 40, 25, 35, 99, 80, 0, 0, 39, 0, 0, 0, 56, 4, 96, 2, 0, 99,
      99, 99, 99, 50, 50, 50, 50, 4, 8, 35, 0, 0, 0, 1, 24, 71, 76, 65, 83, 83,
      32, 66, 69, 76, 76,
    ] /* BELL */,
    [
      99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99,
      99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 72, 50, 75, 99, 65,
      40, 0, 39, 0, 0, 0, 56, 24, 78, 4, 0, 99, 55, 40, 75, 99, 70, 50, 0, 39,
      0, 0, 0, 64, 4, 80, 2, 0, 99, 60, 40, 75, 99, 72, 55, 0, 39, 0, 0, 0, 56,
      20, 80, 2, 0, 99, 40, 30, 75, 99, 85, 70, 0, 39, 0, 0, 0, 56, 8, 99, 2, 0,
      99, 99, 99, 99, 50, 50, 50, 50, 4, 8, 35, 0, 0, 0, 1, 24, 82, 79, 85, 78,
      68, 32, 66, 65, 83, 83,
    ] /* FM BASS */,
    [
      52, 50, 40, 60, 99, 85, 82, 0, 39, 0, 0, 0, 56, 8, 72, 2, 0, 62, 50, 40,
      60, 99, 92, 90, 0, 39, 0, 0, 0, 40, 4, 88, 2, 0, 50, 50, 40, 60, 99, 88,
      85, 0, 39, 0, 0, 0, 56, 12, 78, 2, 0, 62, 50, 40, 60, 99, 92, 90, 0, 39,
      0, 0, 0, 72, 4, 92, 2, 0, 55, 50, 40, 60, 99, 88, 85, 0, 39, 0, 0, 0, 56,
      12, 80, 2, 0, 65, 50, 40, 60, 99, 92, 90, 0, 39, 0, 0, 0, 56, 4, 98, 2, 0,
      80, 60, 99, 60, 46, 50, 50, 50, 4, 13, 33, 50, 6, 0, 57, 24, 66, 82, 65,
      83, 83, 32, 83, 69, 67, 84,
    ] /* BRASS */,
    [
      35, 30, 40, 40, 85, 90, 85, 0, 39, 0, 0, 0, 56, 0, 50, 2, 0, 38, 30, 40,
      40, 99, 95, 90, 0, 39, 0, 0, 0, 56, 0, 80, 4, 0, 30, 25, 40, 40, 80, 90,
      85, 0, 39, 0, 0, 0, 56, 4, 55, 4, 0, 40, 30, 40, 40, 99, 95, 90, 0, 39, 0,
      0, 0, 80, 0, 92, 2, 0, 35, 30, 40, 40, 85, 90, 80, 0, 39, 0, 0, 0, 56, 4,
      60, 2, 0, 40, 30, 40, 40, 99, 95, 90, 0, 39, 0, 0, 0, 40, 0, 92, 2, 0, 99,
      99, 99, 99, 50, 50, 50, 50, 4, 10, 30, 60, 4, 0, 41, 24, 83, 79, 70, 84,
      32, 80, 65, 68, 32, 32,
    ] /* PAD */,
    [
      99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99,
      99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 80, 50, 60, 99, 0, 0,
      0, 39, 0, 0, 0, 59, 12, 45, 2, 0, 99, 70, 50, 60, 99, 0, 0, 0, 39, 0, 0,
      0, 59, 12, 72, 8, 0, 99, 75, 50, 60, 99, 0, 0, 0, 39, 0, 0, 0, 59, 20, 70,
      8, 0, 99, 52, 40, 55, 99, 0, 0, 0, 39, 0, 0, 0, 58, 8, 99, 2, 0, 99, 99,
      99, 99, 50, 50, 50, 50, 4, 8, 35, 0, 0, 0, 1, 24, 87, 79, 79, 68, 32, 66,
      65, 82, 83, 32,
    ] /* MARIMBA */,
    [
      99, 99, 99, 85, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 72, 2, 50, 99, 99, 99,
      85, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 78, 8, 0, 99, 99, 99, 85, 99, 99,
      99, 0, 39, 0, 0, 0, 56, 0, 76, 6, 0, 99, 99, 99, 85, 99, 99, 99, 0, 39, 0,
      0, 0, 56, 0, 86, 4, 0, 99, 99, 99, 85, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0,
      84, 0, 0, 99, 99, 99, 85, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 90, 2, 0, 99,
      99, 99, 99, 50, 50, 50, 50, 31, 8, 60, 0, 3, 0, 57, 24, 68, 82, 65, 87,
      66, 65, 82, 83, 32, 32,
    ] /* ORGAN */,
    [
      99, 99, 99, 99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 99, 99,
      99, 99, 99, 99, 0, 39, 0, 0, 0, 56, 0, 0, 2, 0, 99, 75, 40, 60, 99, 30, 0,
      0, 39, 0, 0, 0, 58, 12, 68, 2, 0, 99, 60, 40, 60, 99, 30, 0, 0, 39, 0, 0,
      0, 66, 8, 74, 4, 0, 99, 70, 40, 60, 99, 40, 0, 0, 39, 0, 0, 0, 58, 16, 76,
      6, 0, 99, 45, 30, 60, 99, 60, 0, 0, 39, 0, 0, 0, 58, 8, 98, 2, 0, 99, 99,
      99, 99, 50, 50, 50, 50, 4, 8, 35, 0, 0, 0, 1, 24, 78, 89, 76, 79, 78, 32,
      80, 73, 67, 75,
    ] /* PLUCK */,
  ]
  /* backup object 8, the PTCH bank as the firmware stores it (fm6_bank.c fm6_bank_t, 3472 bytes): "FM6B", version 1,
     27 slots, the used bits, 4 reserved, then 27 packed records (an empty slot: zeros). slots: [packed 128 | null] */
  function bankObj(slots: (ArrayLike<number> | null | undefined)[]) {
    const o = new Uint8Array(16 + 27 * PACKED)
    let used = 0
    o.set([0x46, 0x4d, 0x36, 0x42, 1, 0, 27, 0])
    for (let k = 0; k < 27; k++)
      if (slots[k]) {
        o.set(
          Array.from(slots[k]!, (x) => x & 0x7f),
          16 + k * PACKED,
        )
        used |= 1 << k
      }
    o.set(
      [used & 255, (used >> 8) & 255, (used >> 16) & 255, (used >>> 24) & 255],
      8,
    )
    return o
  }
  /* bytes -> [packed | null] x 27; an empty object (length 0): all empty; anything else: null (not a bank) */
  function bankUnobj(
    b: Uint8Array | null | undefined,
  ): (Uint8Array | number[] | null)[] | null {
    if (!b || !b.length) return new Array(27).fill(null)
    if (
      b.length !== 16 + 27 * PACKED ||
      b[0] !== 0x46 ||
      b[1] !== 0x4d ||
      b[2] !== 0x36 ||
      b[3] !== 0x42 ||
      b[4] !== 1 ||
      b[6] !== 27
    )
      return null
    const used = (b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24)) >>> 0
    if (used >>> 27 || b.subarray(16).some((x) => x > 127)) return null
    return Array.from({ length: 27 }, (_, k) =>
      (used >> k) & 1 ? b.slice(16 + k * PACKED, 16 + (k + 1) * PACKED) : null,
    )
  }
  const init = () => unpack(INIT_PK)
  const factory = (k: number) => unpack(FACTORY_PK[k])
  return {
    OP,
    VOICE,
    OPI,
    VI,
    NAME,
    SIZE,
    PACKED,
    max,
    at,
    sanitize,
    unpack,
    pack,
    name,
    setName,
    checksum,
    parseSysex,
    singleSysex,
    bankSysex,
    ALG,
    carriers,
    feedbackOp,
    freqText,
    INIT_PK,
    FACTORY_PK,
    init,
    factory,
    bankObj,
    bankUnobj,
    TARGET: { TRACK: 0, BANK: 1, FACTORY: 2 },
    BANK_N: 27,
  }
})()

/* the mock's settings object: "PER3", the rest opaque, the song order A B C D, 4 bars each (arranger.h arr_defaults) */
function mockSettings() {
  const b = Uint8Array.from({ length: 88 }, (_, i) => (i * 37 + 5) & 0xff)
  b.set([0x33, 0x52, 0x45, 0x50])
  return ARR.encode(b, {
    loop: false,
    entries: [0, 1, 2, 3].map((scene) => ({ scene, bars: 4 })),
  })
}
/* backup object 10 at its default: nothing learned, CH1-3 = 1 2 3, drums 10, OTHER SEL, BEND 2 (a 32 / 36-byte one: the
   map, the map and the channels) */
const mlDefault = (b: Uint8Array | number[]) =>
  b.every((x, i) =>
    i < 32
      ? !x
      : i === 32
        ? x === 1
        : i === 33
          ? x === 2
          : i === 34
            ? x === 3
            : i === 35
              ? x === 10
              : i === 36
                ? x === 2
                : !x,
  )
/** makeMockDevice's options */
export interface MockOpt {
  legacy?: boolean
  v3?: boolean
  noBackup?: boolean
  v7?: boolean
  v8?: boolean
  v9?: boolean
  v10?: boolean
  v11?: boolean
  v12?: boolean
  auto?: boolean
  watchMs?: number
  slots?: number
  onChange?: (cmd: number, a: number[]) => void
  onNote?: (data: number[]) => void
}
/** a parameter of the mock (as DESC sends it) */
export interface MockDesc {
  label: string
  fmt: number
  min: number
  max: number
  def: number
  names: string[] | null
  unit: string
}
/** a step as the mock keeps it (lvl / rat always there) */
export interface MockStep extends Step {
  lvl: number
  rat: number
}
export interface MockTrack {
  engine: number
  preset: number
  drum: boolean
  fm6: number[] | Uint8Array
  p: number[]
  step: MockStep[]
  dstep: DrumStep[] | null
  micro: number[]
  locks: Lock[]
  fill: number[]
}
/** a project slot / the snapshot of the mock's tracks (a JSON copy) */
export interface MockProject {
  tracks: MockTrack[]
  sel: number
  g: number[]
}
export interface MockSmpSlot {
  flash: Uint8Array
  zones: number
  name: string
  len: number
  next: number
}
export interface MockLive {
  t0: number
  sec: number
  next: number
  nextAt: number
  songMode: boolean
  srec: number
  fillHeld: boolean
  fillBar: boolean
  fillAt: number
  fillTo: number
  fx: number
  recWait: boolean
  undo: number
  armed: number
  armedAt: number
  taps: number[]
  rolls: Set<string>
  erase: Set<string>
  pattern: number[][]
  chain: number[]
  thr: number
  master: number
  dtw: number[]
  ft?: boolean
  c?: number
}
/** the mock device's state (engine, preset, p, step: the selected track's) */
export interface MockState {
  tracks: MockTrack[]
  sel: number
  rec: number
  solo: number
  g: number[]
  slots: (MockProject | null)[]
  smp: MockSmpSlot[]
  bank: ({
    engine: number
    name: string
    p: number[]
    pattern: PatStep[]
  } | null)[]
  fm6bank: (number[] | Uint8Array | null)[]
  settings: Uint8Array
  dsyn: DsynKit[] | null
  dsynStored: Uint8Array | null
  dsynPlayed: { k: number; lane: number; vel: number; sound: Uint8Array }[]
  ml: Uint8Array | null
  bkSnap: Map<number, Uint8Array> | null
  bkPut: {
    id: number
    len: number
    crc: number
    pos: number
    buf: Uint8Array
  } | null
  watch: boolean
  v4: boolean
  lastReq: number
  playing: boolean
  live: MockLive
  midiIn: number[][]
  theme?: Uint8Array | null
  p7?: Proj7 | null
  engine: number
  preset: number
  p: number[]
  step: MockStep[]
}
/** a fake MIDI port of the mock */
export interface MockPort {
  id: string
  name: string
  type: string
  state: string
  onmidimessage?: ((e: { data: Uint8Array }) => void) | null
  send?: (data: number[] | Uint8Array) => void
}
export interface MockDevice {
  state: MockState
  sim: Record<string, (...args: any[]) => unknown>
  stop: () => void
  access: {
    sysexEnabled: boolean
    inputs: Map<string, MockPort>
    outputs: Map<string, MockPort>
    onstatechange: null
  }
}
function makeMockDevice(opt: MockOpt = {}): MockDevice {
  const NONOFF = ['OFF', 'ON'],
    NDIV = ['1/4', '1/8', '1/16', '1/32', '8T', '16T'],
    NGO = ['--', 'GO'],
    NDASH = ['--']
  const NSDIV = [...NDIV, '1/2', '1BAR', '2BAR'],
    NDLY = [
      ...NDIV,
      '1/8D',
      '1/16D',
      '1/4D',
    ] /* SLOOP 2.4: long steps, dotted delays */
  const D = (
    label: string,
    fmt: number,
    min: number,
    max: number,
    def: number,
    names: string[] | null = null,
    unit = '',
  ): MockDesc => ({ label, fmt, min, max, def, names, unit })
  const E = (label: string, names: string[], def: number) =>
    D(label, F.ENUM, 0, names.length - 1, def, names)
  const TP = [
    D('LVL', F.INT, 0, 127, 104),
    D('ATK', F.TIME, 0, 127, 10),
    D('DEC', F.TIME, 0, 127, 70),
    D('SUS', F.PCT, 0, 127, 90),
    D('REL', F.TIME, 0, 127, 60),
    D('FLT', F.BIPCT, -64, 63, 0),
    D('PIT', F.BIPCT, -64, 63, 0),
    D('SHP', F.BIPCT, -64, 63, 0),
    D('FX', F.BIPCT, -64, 63, 0),
    D('RATE', F.LFOHZ, 0, 127, 60),
    E('WAVE', ['SIN', 'TRI', 'SAW', 'SQR', 'S&H'], 0),
    D('PHS', F.INT, 0, 127, 0),
    D('FADE', F.TIME, 0, 127, 0),
    D('PIT', F.BIPCT, -64, 63, 0),
    D('FLT', F.BIPCT, -64, 63, 0),
    D('SHP', F.BIPCT, -64, 63, 0),
    D('AMP', F.PCT, 0, 127, 0),
    E(
      'MODE',
      [
        'OFF',
        'UP',
        'DN',
        'UPDN',
        'RND',
        'ORD',
        'REPEAT',
        'DNUP',
        'UP+8',
        'CONV',
        'DIVG',
        'PINKY',
        'THUMB',
        'WALK',
        'CHORD',
      ],
      0,
    ),
    E('RATE', NDIV, 2),
    D('OCT', F.INT, 1, 4, 1),
    D('GATE', F.PCT, 1, 127, 64),
    D('SWG', F.SWING, 0, 100, 0),
    D('PROB', F.PCT, 0, 127, 127),
    E('HOLD', NONOFF, 0),
    E('ORD', ['NOTE', 'PLAY'], 0),
    D('ROOT', F.NOTE, 0, 11, 0),
    E(
      'SCL',
      [
        'CHR',
        'MAJ',
        'MIN',
        'DOR',
        'MIX',
        'PEN',
        'MPEN',
        'HARM',
        'PHRY',
        'LYD',
        'LOC',
        'MEL',
        'BLUES',
        'WHOLE',
        'DIMHW',
        'DIMWH',
      ],
      0,
    ),
    E('QNT', ['OFF', 'SNAP', 'WHITE'], 0),
    D('TRN', F.SEMI, -24, 24, 0),
    D('LEN', F.STEPS, 1, 64, 16),
    E('DIV', NSDIV, 2),
    D('SWG', F.SWING, 0, 100, 0),
    D('GATE', F.PCT, 1, 127, 64),
    D('DST', F.PCT, 0, 127, 0),
    D('CHO', F.PCT, 0, 127, 0),
    D('DLY', F.PCT, 0, 127, 0),
    D('REV', F.PCT, 0, 127, 0),
    E('VCE', ['POLY', 'MONO', 'LEG', 'UNI'], 0),
    D('GLD', F.TIME, 0, 127, 0),
    D('PAN', F.BIPCT, -64, 63, 0),
    E('MUTE', NONOFF, 0),
    E('GLMOD', ['RATE', 'TIME'], 0),
    E('PRIO', ['LAST', 'LOW', 'HIGH'], 0),
    E('ALLOC', ['ROT', 'REUSE'], 0),
    D('DTUNE', F.INT, 0, 127, 40),
    E('SLCR', ['OFF', 'GATE', 'STUT'], 0),
    D('PAT', F.INT, 1, 16, 1),
    E('RATE', ['1/8', '1/16', '1/32', '8T', '16T', '32T'], 1),
    D('DEPTH', F.PCT, 0, 127, 127),
    E('CHORD', ['OFF', 'TRIAD', '7TH', '9TH', 'SUS4', 'POWER'], 0),
    D('FILT', F.FILT, -64, 63, 0),
    D('STRUM', F.INT, -60, 60, 0),
    E('VLEAD', NONOFF, 0),
    /* SLOOP 2.6 (after Felucca 1.4 / 1.5): INSERT, ANALOG's filter TYPE, ENV SYNC, LFO 2 */
    E(
      'INSRT',
      [
        'OFF',
        'SOFT',
        'HARD',
        'FOLD',
        'FUZZ',
        'CRUSH',
        'PHASR',
        'FLANG',
        'CHOR',
      ],
      0,
    ),
    D('INS A', F.PCT, 0, 127, 64),
    D('INS B', F.PCT, 0, 127, 96),
    D('INS C', F.PCT, 0, 127, 96),
    D('MIX', F.PCT, 0, 127, 127),
    E('TYPE', ['LP', 'BP', 'HP'], 0),
    E('ESYNC', NONOFF, 0),
    E(
      'SYNC',
      [
        'OFF',
        '4BAR',
        '2BAR',
        '1BAR',
        '1/2',
        '1/4',
        '1/8',
        '8T',
        '1/16',
        '16T',
        '1/32',
      ],
      0,
    ),
    E('TRIG', ['NOTE', 'FREE'], 0),
    E('POL', ['BI', 'UNI'], 0),
  ]
  const GP = [
    D('BPM', F.BPM, 40, 240, 90),
    D('SWING', F.SWING, 0, 100, 0),
    E('CLICK', ['OFF', 'REC', 'ON'], 0),
    D('TUNE', F.INT, -50, 50, 0),
    E('TIME', NDLY, 1),
    D('FDBK', F.PCT, 0, 120, 60),
    D('COLR', F.PCT, 0, 127, 70),
    D('MIX', F.PCT, 0, 127, 90),
    D('SIZE', F.PCT, 0, 127, 90),
    D('DAMP', F.PCT, 0, 127, 60),
    D('CRT', F.LFOHZ, 0, 127, 40),
    D('CDP', F.PCT, 0, 127, 60),
    E('OUT', ['KEYS', 'SEQ'], 0),
    E('SYNC', ['INT', 'USB', 'TRS'], 0),
    E(
      'IN',
      [
        'NOTES',
        'CLOCK',
        ...Array.from({ length: 16 }, (_, k) => `CH ${k + 1}`),
      ],
      0,
    ),
    D('CPU', F.INT, 0, 0, 0),
    D('SECT', F.INT, 1, 4, 1),
    E('NAME', NDASH, 0),
    E('LOAD', NGO, 0),
    E('SAVE', NGO, 0),
    E(
      'ENG',
      [
        'ANALOG',
        'DIGITAL',
        'PHASE',
        'LOFI',
        'SAMPLE',
        'VOICE',
        'TRIO',
        'WHEEL',
        'GRAIN',
        'FM6',
        'PHYS',
        'NOISE',
        'OBERVAVE',
      ],
      0,
    ),
    E('SET', NGO, 0),
    E('CLRSQ', NGO, 0),
    E('INIT', NGO, 0),
    E(
      'CH4',
      ['OFF', ...Array.from({ length: 16 }, (_, i) => String(i + 1))],
      10,
    ),
    D('LVL', F.INT, 0, 127, 100),
    D('REV', F.INT, 0, 127, 16),
    D('DUST', F.PCT, 0, 127, 0),
    D('DUCK', F.PCT, 0, 127, 0),
    D('FILT', F.FILT, -64, 63, 0),
    E('ROLL', ['1/8', '1/16', '1/32', '32T', '1/64'], 1),
    E('NEW', NGO, 0),
    D('DLY', F.INT, 0, 127, 0),
    /* SLOOP 2.6: MIDI, each synth track's channel (OFF, 1..16) and the other channels (SEL / OFF) */
    ...[1, 2, 3].map((k) =>
      E(
        'CH' + k,
        ['OFF', ...Array.from({ length: 16 }, (_, i) => String(i + 1))],
        k,
      ),
    ),
    E('OTHER', ['SEL', 'OFF'], 0),
    /* GLO > TEXTURE (2.6): the bed under the mix */
    E(
      'SRC',
      [
        'OFF',
        'VINYL',
        'TAPE',
        'RAIN',
        'WIND',
        'RADIO',
        'ROOM',
        'USR1',
        'USR2',
        'USR3',
        'USR4',
      ],
      0,
    ),
    D('LEVEL', F.PCT, 0, 127, 64),
    D('TONE', F.FILT, -64, 63, 0),
    D('MOVE', F.PCT, 0, 127, 40),
    E('RATE', ['1BAR', '2BAR', '4BAR', '8BAR', '16BAR'], 2),
    E('WHEN', ['PLAY', 'ALWAYS'], 0),
    E('DUCK', NONOFF, 0),
    D('BEND', F.SEMI, 1, 12, 2) /* MIDI 3 (2.6): the pitch bend's range */,
    E(
      'FX CH',
      ['OFF', ...Array.from({ length: 16 }, (_, i) => String(i + 1))],
      0,
    ) /* MIDI 4 (2.7): the punch-in FX */,
    E(
      'DR MAP',
      ['GM', '1-16'],
      0,
    ) /* MIDI 4 (2.7): MIDI notes -> drum sounds */,
    E(
      'REMOTE',
      ['OFF', ...Array.from({ length: 16 }, (_, i) => String(i + 1))],
      0,
    ) /* MIDI 4 (2.7): the buttons */,
    E(
      'CLOCK',
      ['OFF', 'OUT'],
      0,
    ) /* MIDI 4 (2.7): MIDI clock, START / STOP out on USB */,
    D(
      'FADE',
      F.INT,
      0,
      15,
      0,
    ) /* GLO > MASTER 2 (2.7.2): the punch-in FX fade (punch.c) */,
  ]
  /* the drum track's P_E0: its kit (drums.c DRUM_KIT_NAMES; 5 = 808, the power-on kit) */
  const KIT = E(
    'KIT',
    [
      'ACOUSTIC',
      'DEEP',
      'TIGHT',
      'BRIGHT',
      'DUST',
      '808',
      '909',
      '606',
      '80S',
      'VINTAGE',
      'TRAP',
      'DRILL',
      'BOOMBAP',
      'LO-FI',
      'PHONK',
      'HOUSE',
      'D.HOUSE',
      'TECHNO',
      'MINIMAL',
      'ELECTRO',
      'DISCO',
      'GARAGE',
      'JUNGLE',
      'DUBSTEP',
      'DEMBOW',
      'AMAPIANO',
      'AFRO',
      'LATIN',
      'TRIBAL',
      'SYNTHWV',
      'CHIP',
      'ARCADE',
      'GLITCH',
      'INDUSTR',
      'HYPER',
      'AMBIENT',
      'JAZZ',
      'USR1',
      'USR2',
      'USR3',
      'USR4',
      'USR3+4',
      'SYN1',
      'SYN2',
      'SYN3',
      'SYN4',
    ],
    0,
  )
  /* a GM note -> its drum lane (drums.c LANE_OF_GM: 35..81) */
  const LANE_OF_GM = [
    1, 0, 7, 2, 3, 8, 9, 4, 9, 6, 9, 5, 10, 10, 11, 10, 12, 11, 12, 13, 11, 15,
    11, 13, 12, 14, 14, 14, 14, 14, 14, 14, 15, 15, 13, 13, 15, 15, 13, 13, 7,
    7, 7, 14, 14, 15, 15,
  ]
  const laneOf = (n: number) => (n < 35 ? 0 : n > 81 ? 13 : LANE_OF_GM[n - 35])
  const v5 =
    !opt.legacy &&
    !opt.v3 /* SLOOP 2.0: steps with level / ratchet, DRUM_STEP, TRACK solo */
  const mockProto = opt.noBackup
    ? 5
    : opt.v7
      ? 7
      : opt.v8
        ? 8
        : opt.v9
          ? 9
          : opt.v10
            ? 10
            : opt.v11
              ? 11
              : opt.v12
                ? 12
                : 13 /* INFO's protocol */
  /* the drum step as an old (v1..v4) step: its first 4 lanes as GM notes, ACC when one is hard (editor.c ed_dstep_old) */
  const dOld = (d: DrumStep): MockStep => {
    const notes: number[] = []
    let hard = 0
    for (let l = 0; l < 16 && notes.length < 4; l++)
      if ((d.on >> l) & 1) {
        notes.push(DRUM_LANES[l][0])
        hard |= +(d.lvl[l] === 3)
      }
    const n = notes.length
    return {
      n,
      notes: [...notes, 0, 0, 0, 0].slice(0, 4),
      time: n ? 0 : 2,
      flags: hard ? 1 : 0,
      vel: n ? 100 : 0,
      lvl: 0,
      rat: 0,
    }
  }
  /* an old step written into the drum track: its notes onto their lanes (ed_dstep_from_old) */
  const dFromOld = (
    d: DrumStep,
    n: number,
    notes: number[],
    time: number,
    flags: number,
  ): void => {
    Object.assign(d, emptyDrum())
    if (time !== 0) return
    for (let i = 0; i < Math.min(4, n); i++) {
      const l = laneOf(notes[i] & 0x7f)
      d.on |= 1 << l
      d.lvl[l] = flags & 1 ? 3 : 0
    }
  }
  /* a step's bytes as STEP_GET sends them (v5: + lvl, hi, rat) */
  const stepOut = (b: (x: number) => void, x: MockStep): void => {
    b(x.n)
    x.notes.forEach(b)
    b(x.time)
    b(x.flags)
    b(x.vel)
    if (v5) {
      b(x.lvl | 0)
      b((((x.lvl | 0) >> 7) & 1) | ((((x.rat | 0) >> 7) & 1) << 1))
      b(x.rat | 0)
    }
  }
  /* a step written (n, 4 notes, time, flags, vel [, lvl, hi, rat]) */
  const stepIn = (x: Step, a: number[]): void => {
    x.n = Math.min(4, a[0])
    x.notes = a.slice(1, 5)
    x.time = Math.min(2, a[5])
    x.flags = a[6] & 3
    x.vel = a[7]
    x.lvl = a.length >= 11 ? (a[8] & 0x7f) | ((a[9] & 1) << 7) : 0
    x.rat = a.length >= 11 ? (a[10] & 0x7f) | (((a[9] >> 1) & 1) << 7) : 0
  }
  const NONE = D('-', F.INT, 0, 0, 0)
  const RATIO = [
    '.5',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '14',
    '16',
  ]
  const P = (
    name: string,
    e: number[],
    env = [10, 70, 90, 60],
    mono = 0,
    pat = 0,
  ) => ({ name, e, env, mono, pat })
  const ENG: {
    name: string
    titles: string[]
    edit: MockDesc[]
    presets: ReturnType<typeof P>[]
  }[] = [
    {
      name: 'ANALOG',
      titles: ['OSC', 'FLT'],
      edit: [
        E('WAVE', ['SAW', 'SQR', 'TRI', 'SIN', 'PWM'], 0),
        D('DTN', F.INT, 0, 127, 10, null, 'ct'),
        D('MIX', F.PCT, 0, 127, 64),
        D('NOIS', F.PCT, 0, 127, 0),
        D('CUT', F.CUTOFF, 0, 127, 90),
        D('RES', F.PCT, 0, 127, 30),
        D('DRV', F.PCT, 0, 127, 0),
        D('KTR', F.PCT, 0, 127, 64),
      ],
      presets: [
        P('808 BOOM', [3, 0, 0, 0, 127, 0, 48, 0], [0, 112, 0, 52], 1),
        P('808 DIRTY', [3, 0, 0, 0, 96, 12, 118, 30], [0, 108, 0, 46], 1),
        P('SUB BASS', [3, 0, 0, 0, 127, 0, 10, 0], [0, 60, 118, 24], 1),
        P('REESE', [0, 22, 64, 0, 56, 22, 36, 40], [0, 70, 118, 28], 1),
        P('WOBBLE', [0, 9, 64, 0, 38, 72, 62, 30], [0, 64, 127, 22], 1, 1),
        P('FUNK BASS', [1, 6, 50, 0, 50, 30, 22, 64], [0, 55, 62, 20], 1),
        P('G-FUNK LD', [2, 0, 0, 0, 92, 0, 10, 64], [6, 70, 112, 46], 1),
        P('TRAP PLUCK', [0, 8, 64, 0, 30, 35, 0, 64], [0, 58, 0, 45], 0),
        P('SYN BRASS', [0, 10, 64, 0, 45, 20, 16, 64], [12, 70, 96, 35], 0),
        P('WARM PAD', [4, 12, 64, 6, 52, 8, 0, 32], [75, 90, 115, 90], 0),
        P('DARK STR', [0, 18, 64, 0, 48, 6, 0, 32], [60, 90, 118, 85], 0),
        P('ATMOS PAD', [4, 25, 64, 20, 60, 15, 0, 32], [90, 100, 120, 100], 0),
        P('PAN FLUTE', [2, 0, 0, 30, 70, 10, 0, 64], [14, 70, 110, 40], 1),
        P('FAT LEAD', [0, 8, 64, 0, 70, 30, 30, 64], [2, 70, 110, 30], 1),
        P('MONO BASS', [0, 4, 64, 0, 48, 36, 30, 64], [0, 60, 70, 20], 1),
      ],
    },
    {
      name: 'DIGITAL',
      titles: ['OPS', 'MOD'],
      edit: [
        E('ALG', ['1', '2', '3', '4', '5', '6', '7', '8'], 0),
        E('R2', RATIO, 1),
        E('R3', RATIO, 1),
        E('R4', RATIO, 1),
        D('IDX', F.PCT, 0, 127, 60),
        D('MDEC', F.TIME, 0, 127, 60),
        D('FB', F.PCT, 0, 127, 0),
        NONE,
      ],
      presets: [
        P('RHODES', [4, 1, 1, 14, 26, 35, 0, 0], [0, 85, 35, 55], 0),
        P('DX RHODES', [4, 1, 1, 14, 85, 45, 0, 0], [0, 82, 40, 55], 0),
        P('WURLI', [4, 1, 2, 3, 62, 35, 8, 0], [0, 75, 30, 45], 0),
        P('CLAV', [3, 1, 3, 5, 90, 25, 20, 0], [0, 50, 20, 18], 0),
        P('TRAP BELL', [4, 8, 1, 4, 80, 70, 0, 0], [0, 92, 0, 70], 0),
        P('MUSIC BOX', [4, 4, 3, 9, 45, 75, 0, 0], [0, 90, 0, 75], 0),
        P('MARIMBA', [4, 4, 1, 1, 60, 30, 0, 0], [0, 80, 0, 60], 0),
        P('FM BASS', [0, 1, 1, 1, 34, 40, 8, 0], [0, 60, 70, 25], 1),
        P('STEEL DRUM', [4, 2, 2, 2, 45, 45, 0, 0], [0, 88, 0, 66], 0),
        P('GLOCKEN', [4, 5, 1, 8, 40, 60, 0, 0], [0, 95, 0, 85], 0),
        P('CELESTA', [4, 2, 1, 4, 30, 50, 0, 0], [0, 84, 0, 70], 0),
        P('XYLOPHONE', [4, 4, 3, 3, 70, 18, 0, 0], [0, 77, 0, 58], 0),
        P('HARP', [4, 1, 1, 2, 45, 30, 10, 0], [0, 92, 0, 80], 0),
        P('BASS GTR', [4, 1, 1, 2, 40, 30, 6, 0], [0, 76, 40, 22], 1),
      ],
    },
    {
      name: 'PHASE',
      titles: ['PHS', 'LINE'],
      edit: [
        E(
          'WAVE',
          ['SAW', 'SQR', 'PLS', 'DSIN', 'SPLS', 'RSAW', 'RTRI', 'RTRP'],
          0,
        ),
        E(
          'WAVE2',
          ['--', 'SAW', 'SQR', 'PLS', 'DSIN', 'SPLS', 'RSAW', 'RTRI', 'RTRP'],
          0,
        ),
        D('DCW', F.PCT, 0, 127, 60),
        D('ENV', F.PCT, 0, 127, 64),
        D('DTN', F.INT, 0, 127, 0, null, 'ct'),
        E('LINE', ['MIX', 'RING'], 0),
        D('SUB', F.PCT, 0, 127, 0),
        NONE,
      ],
      presets: [
        P('CZ BASS', [5, 0, 28, 70, 0, 0, 40, 0], [0, 60, 50, 22], 1),
        P('SOFT KEYS', [3, 0, 40, 70, 0, 0, 0, 0], [0, 80, 20, 50], 0),
        P('CZ STRING', [0, 4, 50, 40, 12, 0, 0, 0], [50, 90, 105, 75], 0),
        P('RESO PLUCK', [5, 0, 60, 60, 0, 0, 0, 0], [0, 70, 30, 60], 0, 1),
        P('CZ BRASS', [0, 0, 30, 90, 0, 0, 0, 0], [8, 70, 90, 40], 0),
      ],
    },
    {
      name: 'LOFI',
      titles: ['CHIP', 'MOTN'],
      edit: [
        E('CHIP', ['4BIT', '4B/2', '8BIT', '1BIT', 'STEP'], 0),
        E('WAVE', ['PLS', 'TRI', 'SAW', 'NOIS', 'WRAM'], 0),
        D('DUTY', F.INT, 0, 127, 64),
        D('CRSH', F.PCT, 0, 127, 0),
        D('SWP', F.PCT, 0, 127, 0),
        D('VIB', F.PCT, 0, 127, 0),
        E('ARP', ['OFF', 'OCT', 'MAJ', 'MIN'], 0),
        D('TONE', F.PCT, 0, 127, 127),
      ],
      presets: [
        P('GAME LEAD', [0, 0, 32, 0, 0, 20, 0, 127], [0, 60, 90, 30], 1),
        P('GB BASS', [1, 1, 0, 0, 0, 0, 0, 90], [0, 50, 70, 20], 1),
        P('8BIT ARP', [2, 0, 96, 0, 0, 0, 2, 110], [0, 60, 80, 40], 0),
      ],
    },
    {
      name: 'SAMPLE',
      titles: ['SET', 'TONE'],
      edit: [
        E(
          'SET',
          [
            'PIANO',
            'BASS',
            'VIBES',
            'HORNS',
            'STRGS',
            'FLUTE',
            'SCRCH',
            'PERC',
            'USR1',
            'USR2',
            'USR3',
            'USR4',
          ],
          0,
        ),
        D('TUNE', F.SEMI, -24, 24, 0),
        D('BITS', F.INT, 0, 127, 0),
        E('LOOP', NONOFF, 1),
        D('CUT', F.INT, 0, 127, 127),
        NONE,
        D('DRV', F.PCT, 0, 127, 0),
        NONE,
      ],
      presets: [
        P('DUSTY PNO', [0, 0, 20, 1, 104, 0, 14, 0], [0, 127, 127, 52], 0),
        P('UP BASS', [1, 0, 0, 1, 118, 0, 12, 0], [0, 127, 127, 26], 1),
        P('VIBES', [2, 0, 0, 1, 127, 0, 0, 0], [0, 127, 127, 72], 0),
        P('HORN STAB', [3, 0, 0, 1, 120, 0, 20, 0], [0, 127, 127, 22], 0),
        P('STRING STB', [4, 0, 0, 1, 122, 0, 10, 0], [0, 127, 127, 26], 0),
        P('LOFI FLUTE', [5, 0, 12, 1, 100, 0, 0, 0], [12, 80, 120, 60], 1),
        P('SCRATCH', [6, 0, 0, 1, 127, 0, 8, 0], [0, 127, 127, 18], 0),
        P('GM KIT', [7, 0, 0, 0, 127, 0, 0, 0], [0, 127, 127, 60], 0),
        P('LOFI KEYS', [0, 0, 45, 1, 78, 0, 30, 0], [0, 127, 110, 60], 0),
        P('DEEP BASS', [1, -12, 0, 1, 90, 0, 40, 0], [0, 127, 127, 30], 1),
      ],
    },
    {
      name: 'VOICE',
      titles: ['VOWL', 'TONE'],
      edit: [
        D('VOWL', F.INT, 0, 127, 0),
        D('VOWL2', F.INT, 0, 127, 64),
        D('TALK', F.TIME, 0, 127, 0),
        D('SHIFT', F.SEMI, -12, 12, 0),
        D('BUZZ', F.PCT, 0, 127, 64),
        D('BRTH', F.PCT, 0, 127, 10),
        D('Q', F.PCT, 0, 127, 64),
        D('RAND', F.PCT, 0, 127, 0),
      ],
      presets: [
        P('CHOIR AAH', [0, 0, 0, 0, 40, 22, 60, 0], [85, 90, 115, 95], 0),
        P('SOUL OOH', [110, 0, 0, 0, 30, 30, 55, 0], [70, 90, 115, 90], 0),
        P('TALKBOX', [32, 95, 60, 0, 100, 4, 75, 0], [4, 70, 110, 40], 1),
        P('WOW BASS', [95, 0, 68, 0, 100, 0, 80, 0], [0, 70, 70, 30], 1),
        P('HARMONICA', [64, 0, 0, 0, 127, 20, 70, 0], [4, 70, 115, 25], 1),
      ],
    },
    {
      name: 'TRIO',
      titles: ['OSC', 'TONE'],
      edit: [
        E(
          'WAVE',
          [
            'SAW3',
            'PLS3',
            'PPT',
            'SST',
            'TRI3',
            'S&T',
            'P&S',
            'P+N',
            'NOIS',
            'SYNC',
            'SYNCP',
            'SYNC3',
            'RING',
            'RING3',
            'R+S',
            'R+SP',
          ],
          0,
        ),
        D('INT2', F.SEMI, -24, 24, 0),
        D('INT3', F.SEMI, -24, 24, -12),
        D('DTN', F.INT, 0, 50, 6, null, 'ct'),
        E('MODE', ['LP', 'BP', 'HP', 'NOT'], 0),
        D('CUT', F.CUTOFF, 0, 127, 80),
        D('RES', F.PCT, 0, 127, 40),
        D('PW', F.PCT, 0, 127, 64),
      ],
      presets: [
        P('FAT BASS', [0, 0, -12, 9, 0, 62, 45, 64], [0, 62, 60, 25], 1),
        P('MIN STAB', [0, 3, 7, 6, 0, 80, 20, 64], [0, 50, 0, 30], 0),
        P('MIN7 STAB', [3, 3, 10, 5, 0, 75, 15, 64], [0, 60, 20, 40], 0),
        P('SYNC LEAD', [9, 9, 0, 0, 0, 82, 30, 64], [2, 70, 100, 40], 1),
        P('HOOVER', [0, 0, -12, 40, 0, 70, 20, 64], [10, 70, 110, 40], 1),
        P('ACCORDION', [1, 0, 12, 14, 0, 92, 10, 40], [6, 70, 118, 24], 0),
        P('ENSEMBLE', [0, 12, 0, 10, 0, 85, 0, 64], [50, 90, 118, 80], 0),
        P('80S POLY', [0, 0, 12, 12, 0, 70, 30, 64], [2, 72, 70, 50], 0),
      ],
    },
    {
      name: 'WHEEL',
      titles: ['BARS', 'TONE'],
      edit: [
        E(
          'REG',
          [
            'FLUTE',
            'MELLO',
            'HOLLW',
            'SMOOT',
            '3BAR',
            'BLUES',
            'GOSPL',
            'ROCK',
            'TOPS',
            'CLARI',
            'REED',
            'STRNG',
            'CHAPL',
            'BRITE',
            'BASS',
            'FULL',
          ],
          4,
        ),
        D('SUB', F.INT, -8, 8, 0),
        D('BODY', F.INT, -8, 8, 0),
        D('TOP', F.INT, -8, 8, 0),
        E('PERC', ['OFF', '2ND', '3RD', '2SOFT', '3SOFT', '2SLOW', '3SLOW'], 0),
        D('CLICK', F.PCT, 0, 127, 40),
        D('DRV', F.PCT, 0, 127, 0),
        E('ROTR', ['OFF', 'SLOW', 'FAST'], 1),
      ],
      presets: [
        P('SOUL ORGAN', [3, 0, 0, 0, 0, 25, 10, 1], [0, 64, 127, 40], 0),
        P('GOSPEL', [6, 0, 0, 0, 1, 60, 40, 2], [0, 64, 127, 45], 0),
        P('JAZZ ORGAN', [4, 0, 0, 0, 2, 50, 8, 1], [0, 64, 127, 40], 0),
        P('DIRTY B3', [5, 0, 0, 0, 0, 60, 90, 2], [0, 64, 127, 40], 0),
      ],
    },
    {
      name: 'GRAIN',
      titles: ['GRAN', 'SPRY'],
      edit: [
        E(
          'SRC',
          [
            'PIANO',
            'BASS',
            'VIBES',
            'HORNS',
            'STRGS',
            'FLUTE',
            'SCRCH',
            'PERC',
            'USR1',
            'USR2',
            'USR3',
            'USR4',
          ],
          0,
        ),
        D('POS', F.PCT, 0, 127, 32),
        D('SIZE', F.PCT, 0, 127, 80),
        D('DENS', F.PCT, 0, 127, 80),
        D('PTCH', F.SEMI, -24, 24, 0),
        D('SPRD', F.PCT, 0, 127, 30),
        D('RAND', F.PCT, 0, 127, 10),
        D('TONE', F.PCT, 0, 127, 127),
      ],
      presets: [
        P('LOFI CLOUD', [0, 45, 95, 85, 0, 35, 12, 80], [70, 90, 120, 90], 0),
        P('VIBE HAZE', [2, 30, 100, 90, 0, 25, 10, 90], [50, 100, 120, 95], 0),
        P(
          'FLUTE DUST',
          [5, 50, 108, 72, 0, 10, 10, 85],
          [50, 100, 127, 100],
          0,
        ),
        P('STR CLOUD', [4, 40, 100, 90, 0, 30, 12, 80], [70, 100, 120, 95], 0),
        P('SHIMMER', [0, 30, 90, 95, 12, 40, 15, 110], [60, 100, 120, 100], 0),
        P('DRONE', [3, 50, 115, 80, -12, 20, 20, 50], [90, 100, 127, 100], 0),
      ],
    },
    /* 9: FM6 (SLOOP 2.4, eng_fm6.c): the macros on top of the patch; ALG and PTCH are F_INT with names on the device */
    {
      name: 'FM6',
      titles: ['OPS', 'PATCH'],
      edit: [
        D('ALG', F.INT, 0, 32, 0),
        D('FB', F.INT, -7, 7, 0),
        D('MLVL', F.BIPCT, -64, 63, 0),
        D('MRAT', F.INT, -16, 16, 0),
        D('MEG', F.BIPCT, -64, 63, 0),
        D('VMOD', F.INT, -7, 7, 0),
        D('DTUN', F.PCT, 0, 127, 0),
        D('PTCH', F.INT, 0, FM6.FACTORY_PK.length + 27 - 1, 0),
      ],
      presets: [
        P('TINE EP', [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 127, 0], 0),
        P('GLASS BELL', [0, 0, 0, 0, 0, 0, 0, 1], [0, 0, 127, 0], 0),
        P('ROUND BASS', [0, 0, 0, 0, 0, 0, 0, 2], [0, 0, 127, 0], 1),
        P('BRASS SECT', [0, 0, 0, 0, 0, 0, 0, 3], [0, 0, 127, 0], 0),
        P('SOFT PAD', [0, 0, 0, 0, 0, 0, 30, 4], [0, 0, 127, 0], 0),
        P('WOOD BARS', [0, 0, 0, 0, 0, 0, 0, 5], [0, 0, 127, 0], 0),
        P('DRAWBARS', [0, 0, 0, 0, 0, 0, 0, 6], [0, 0, 127, 0], 0),
        P('NYLON PICK', [0, 0, 0, 0, 0, 0, 0, 7], [0, 0, 127, 0], 0),
      ],
    },
    {
      name: 'PHYS',
      titles: ['BODY', 'EXCT'],
      edit: [
        E('MODEL', ['MODAL', 'STRNG', 'MEMB', 'SYMP'], 0),
        D('STRC', F.PCT, 0, 127, 64),
        D('BRIT', F.PCT, 0, 127, 80),
        D('DAMP', F.PCT, 0, 127, 80),
        D('POS', F.PCT, 0, 127, 20),
        D('ACC', F.PCT, 0, 127, 90),
        D('BOW', F.PCT, 0, 127, 0),
        D('EXC', F.PCT, 0, 127, 0),
      ],
      presets: [
        P('BELL TREE', [0, 70, 100, 106, 12, 100, 0, 6], [0, 100, 127, 96], 0),
        P('MODAL BAR', [0, 116, 38, 40, 24, 90, 0, 30], [0, 90, 127, 52], 0),
        P('STR PLUCK', [1, 56, 72, 84, 40, 96, 0, 0], [0, 100, 127, 58], 0),
        P('BOWED MTL', [0, 98, 70, 112, 10, 80, 90, 0], [60, 90, 127, 90], 0),
        P('THUMB PNO', [0, 34, 16, 56, 100, 90, 0, 48], [0, 100, 127, 60], 0),
        P('HAND DRUM', [2, 112, 76, 56, 44, 100, 14, 24], [0, 100, 127, 64], 0),
        P('MEMB TOMS', [2, 0, 52, 40, 30, 100, 40, 30], [0, 100, 127, 70], 0),
        P('SITAR', [3, 127, 80, 88, 64, 100, 92, 0], [0, 100, 127, 90], 0),
        P('PHYS HARP', [3, 8, 62, 74, 60, 90, 0, 0], [0, 100, 127, 80], 0),
        P('NYLON GTR', [1, 40, 50, 80, 30, 80, 0, 10], [0, 100, 127, 50], 0),
        P('STEEL GTR', [1, 56, 85, 88, 22, 96, 0, 6], [0, 100, 127, 56], 0),
        P('MUTED GTR', [1, 50, 40, 55, 30, 90, 0, 20], [0, 100, 127, 20], 0),
        P('PLUCK BASS', [1, 60, 45, 74, 35, 100, 0, 8], [0, 100, 127, 30], 1),
        P('KOTO', [1, 20, 70, 82, 15, 96, 0, 4], [0, 100, 127, 60], 0),
        P('BANJO', [1, 70, 100, 60, 12, 110, 0, 12], [0, 100, 127, 40], 0),
        P('CELLO BOW', [0, 34, 60, 110, 12, 70, 90, 0], [60, 90, 127, 70], 0),
        P('TANPURA', [3, 0, 70, 120, 90, 80, 110, 0], [0, 100, 127, 100], 0),
        P('CHIMES', [0, 70, 110, 118, 8, 110, 0, 4], [0, 100, 127, 100], 0),
        P('BIG BELL', [0, 80, 90, 124, 16, 120, 0, 8], [0, 100, 127, 110], 0),
        P('VIBRA BAR', [0, 116, 60, 100, 20, 80, 0, 10], [0, 100, 127, 70], 0),
        P('GLASS BOWL', [0, 98, 90, 120, 6, 60, 70, 0], [70, 90, 127, 100], 0),
        P('STEEL PAN', [0, 36, 80, 90, 30, 100, 0, 20], [0, 100, 127, 60], 0),
        P('WOOD BLOCK', [0, 116, 30, 35, 40, 110, 0, 60], [0, 100, 127, 20], 0),
        P('TABLA', [2, 120, 70, 70, 50, 110, 20, 30], [0, 100, 127, 50], 0),
        P('CONGA', [2, 90, 60, 50, 40, 100, 8, 40], [0, 100, 127, 40], 0),
        P('TIMPANI', [2, 10, 50, 100, 20, 110, 6, 10], [0, 100, 127, 90], 0),
      ],
    },
    {
      name: 'NOISE',
      titles: ['SRC', 'MOVE'],
      edit: [
        E('MODE', ['ANLG', 'DUST', 'LFSR', 'META'], 0),
        D('COLR', F.PCT, 0, 127, 64),
        D('FREQ', F.CUTOFF, 0, 127, 80),
        D('RES', F.PCT, 0, 127, 30),
        D('TRK', F.PCT, 0, 127, 64),
        D('DENS', F.PCT, 0, 127, 0),
        D('DRFT', F.PCT, 0, 127, 0),
        D('CRSH', F.PCT, 0, 127, 0),
      ],
      presets: [
        P('WIND', [0, 64, 70, 100, 127, 0, 70, 0], [90, 90, 110, 90], 0),
        P('RAIN', [1, 30, 88, 80, 64, 105, 40, 0], [10, 90, 127, 70], 0),
        P('NZ ARCADE', [2, 0, 127, 0, 127, 112, 0, 84], [0, 80, 0, 50], 0),
        P('NZ METAL', [3, 0, 100, 40, 100, 32, 0, 0], [0, 75, 40, 60], 0),
        P('OCEAN', [0, 100, 50, 20, 0, 0, 110, 0], [100, 90, 127, 100], 0),
        P('VINYL', [1, 0, 110, 10, 0, 70, 20, 0], [0, 64, 127, 40], 0),
        P('HISS', [0, 0, 115, 0, 0, 0, 0, 0], [20, 64, 127, 40], 0),
        P('RISER', [0, 30, 60, 110, 127, 0, 0, 0], [100, 90, 127, 60], 0),
        P('NZ SNARE', [0, 20, 90, 30, 64, 0, 0, 0], [0, 60, 0, 44], 0),
        P('BITCRUSH', [0, 40, 90, 40, 64, 0, 0, 100], [0, 70, 110, 40], 0),
        P('RADIO', [2, 20, 70, 90, 64, 0, 60, 48], [10, 70, 120, 50], 0),
      ],
    },
    {
      name: 'OBERVAVE',
      titles: ['PROGRAM', 'FILTER'],
      edit: [
        E(
          'PROG',
          [
            'DARK ARP',
            'POLY BRASS',
            'OB SYNC LD',
            'UNISON LD',
            'PWM STRING',
            'BELL XMOD',
            'OB FATBASS',
            'ARP SEQ',
            'SWEEP PAD',
            'BP QUACK',
            'DUAL SAW',
            'RESO ZAP',
            'BRASS STAB',
            'NOISE WASH',
            'HOLLOW PAD',
            'SQUARE LD',
            'OB SUBBASS',
            'OB SOFTKEY',
            'SYNC BRASS',
            'DRONE UNI',
            'CLAV PLUCK',
            'WOBBLE BS',
            'ARP PLUCK',
            'ARP CHORD',
            'RANDOM ARP',
            'UPSIDE ARP',
            'FIFTHS LD',
            'VINTAGE PD',
            'NEON PAD',
            'XMOD GROWL',
            'PERC HIT',
            'INIT',
            'NIGHTDRIVE',
            'MINOR FALL',
            'SHADOW ARP',
            'GLASS ARP',
            'PULSE ARP',
            'ARP BASS',
            'DREAM ARP',
            'STAB CHORD',
            'BIG BRASS',
            'HORN SECT',
            'OB WARMPAD',
            'DARK PAD',
            'AIR CHOIR',
            'SLOW SWEEP',
            'GHOST PAD',
            'OB ENSEMBL',
            'SYNC PAD',
            'ICE BELLS',
            'SOFT EP',
            'PULSE ORGN',
            'TAPE KEYS',
            'ACID LINE',
            'OB PLUCKBS',
            'OB DEEP',
            'SYNC BASS',
            'SOLO LEAD',
            'OB PWM LD',
            'SCREAM LD',
            'SOFT FLUTE',
            'LASER',
            'WIND RISE',
            'SPACEDRONE',
            'KICK',
            'SNARE',
            'HIHAT',
            'CLAP',
            'E-PIANO',
            'OB WURLI',
          ],
          0,
        ),
        E('TYPE', ['PROG', 'LP12', 'HP12', 'BP12', 'NOTCH', 'LP24', 'SEM'], 0),
        D('XMOD', F.INT, -64, 63, 0),
        D('DTN', F.INT, -64, 63, 0),
        D('CUT', F.INT, -64, 63, 0),
        D('RES', F.INT, -64, 63, 0),
        D('FENV', F.INT, -64, 63, 0),
        D('DRV', F.INT, -64, 63, 0),
      ],
      presets: [
        P('DARK ARP', [0, 0, 0, 0, 0, 0, 0, 0], [0, 68, 55, 55], 0),
        P('POLY BRASS', [1, 0, 0, 0, 0, 0, 0, 0], [33, 66, 100, 50], 0),
        P('OB SYNC LD', [2, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 1),
        P('UNISON LD', [3, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 44], 0),
        P('PWM STRING', [4, 0, 0, 0, 0, 0, 0, 0], [55, 66, 100, 87], 0),
        P('BELL XMOD', [5, 0, 0, 0, 0, 0, 0, 0], [0, 93, 0, 76], 0),
        P('OB FATBASS', [6, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 23], 1),
        P('ARP SEQ', [7, 0, 0, 0, 0, 0, 0, 0], [0, 44, 0, 33], 0),
        P('SWEEP PAD', [8, 0, 0, 0, 0, 0, 0, 0], [87, 66, 100, 103], 0),
        P('BP QUACK', [9, 0, 0, 0, 0, 0, 0, 0], [0, 76, 70, 55], 0),
        P('DUAL SAW', [10, 0, 0, 0, 0, 0, 0, 0], [1, 66, 100, 55], 0),
        P('RESO ZAP', [11, 0, 0, 0, 0, 0, 0, 0], [0, 33, 0, 23], 1),
        P('BRASS STAB', [12, 0, 0, 0, 0, 0, 0, 0], [3, 55, 90, 39], 0),
        P('NOISE WASH', [13, 0, 0, 0, 0, 0, 0, 0], [98, 66, 100, 109], 0),
        P('HOLLOW PAD', [14, 0, 0, 0, 0, 0, 0, 0], [66, 66, 100, 98], 0),
        P('SQUARE LD', [15, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 1),
        P('OB SUBBASS', [16, 0, 0, 0, 0, 0, 0, 0], [0, 55, 100, 12], 1),
        P('OB SOFTKEY', [17, 0, 0, 0, 0, 0, 0, 0], [0, 87, 60, 55], 0),
        P('SYNC BRASS', [18, 0, 0, 0, 0, 0, 0, 0], [1, 66, 100, 44], 0),
        P('DRONE UNI', [19, 0, 0, 0, 0, 0, 0, 0], [98, 66, 100, 109], 0),
        P('CLAV PLUCK', [20, 0, 0, 0, 0, 0, 0, 0], [0, 55, 0, 23], 0),
        P('WOBBLE BS', [21, 0, 0, 0, 0, 0, 0, 0], [0, 66, 127, 12], 1),
        P('ARP PLUCK', [22, 0, 0, 0, 0, 0, 0, 0], [0, 39, 0, 44], 0),
        P('ARP CHORD', [23, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 55], 0),
        P('RANDOM ARP', [24, 0, 0, 0, 0, 0, 0, 0], [0, 44, 0, 55], 0),
        P('UPSIDE ARP', [25, 0, 0, 0, 0, 0, 0, 0], [0, 55, 20, 66], 0),
        P('FIFTHS LD', [26, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 1),
        P('VINTAGE PD', [27, 0, 0, 0, 0, 0, 0, 0], [55, 66, 100, 87], 0),
        P('NEON PAD', [28, 0, 0, 0, 0, 0, 0, 0], [82, 66, 100, 109], 0),
        P('XMOD GROWL', [29, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 1),
        P('PERC HIT', [30, 0, 0, 0, 0, 0, 0, 0], [0, 23, 0, 17], 0),
        P('INIT', [31, 0, 0, 0, 0, 0, 0, 0], [1, 66, 100, 55], 0),
        P('NIGHTDRIVE', [32, 0, 0, 0, 0, 0, 0, 0], [0, 55, 40, 44], 0),
        P('MINOR FALL', [33, 0, 0, 0, 0, 0, 0, 0], [0, 50, 0, 50], 0),
        P('SHADOW ARP', [34, 0, 0, 0, 0, 0, 0, 0], [0, 55, 20, 55], 0),
        P('GLASS ARP', [35, 0, 0, 0, 0, 0, 0, 0], [0, 66, 0, 66], 0),
        P('PULSE ARP', [36, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 39], 0),
        P('ARP BASS', [37, 0, 0, 0, 0, 0, 0, 0], [0, 44, 60, 17], 1),
        P('DREAM ARP', [38, 0, 0, 0, 0, 0, 0, 0], [7, 66, 100, 87], 0),
        P('STAB CHORD', [39, 0, 0, 0, 0, 0, 0, 0], [0, 50, 30, 33], 0),
        P('BIG BRASS', [40, 0, 0, 0, 0, 0, 0, 0], [44, 66, 110, 60], 0),
        P('HORN SECT', [41, 0, 0, 0, 0, 0, 0, 0], [17, 66, 100, 44], 0),
        P('OB WARMPAD', [42, 0, 0, 0, 0, 0, 0, 0], [76, 66, 100, 103], 0),
        P('DARK PAD', [43, 0, 0, 0, 0, 0, 0, 0], [93, 66, 100, 111], 0),
        P('AIR CHOIR', [44, 0, 0, 0, 0, 0, 0, 0], [87, 66, 100, 103], 0),
        P('SLOW SWEEP', [45, 0, 0, 0, 0, 0, 0, 0], [66, 66, 100, 109], 0),
        P('GHOST PAD', [46, 0, 0, 0, 0, 0, 0, 0], [98, 66, 100, 114], 0),
        P('OB ENSEMBL', [47, 0, 0, 0, 0, 0, 0, 0], [50, 66, 100, 82], 0),
        P('SYNC PAD', [48, 0, 0, 0, 0, 0, 0, 0], [66, 66, 100, 98], 0),
        P('ICE BELLS', [49, 0, 0, 0, 0, 0, 0, 0], [0, 103, 0, 93], 0),
        P('SOFT EP', [50, 0, 0, 0, 0, 0, 0, 0], [0, 93, 40, 55], 0),
        P('PULSE ORGN', [51, 0, 0, 0, 0, 0, 0, 0], [0, 66, 127, 12], 0),
        P('TAPE KEYS', [52, 0, 0, 0, 0, 0, 0, 0], [0, 87, 50, 66], 0),
        P('ACID LINE', [53, 0, 0, 0, 0, 0, 0, 0], [0, 66, 110, 12], 1),
        P('OB PLUCKBS', [54, 0, 0, 0, 0, 0, 0, 0], [0, 55, 0, 17], 0),
        P('OB DEEP', [55, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 17], 1),
        P('SYNC BASS', [56, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 17], 1),
        P('SOLO LEAD', [57, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 39], 1),
        P('OB PWM LD', [58, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 1),
        P('SCREAM LD', [59, 0, 0, 0, 0, 0, 0, 0], [0, 66, 100, 33], 0),
        P('SOFT FLUTE', [60, 0, 0, 0, 0, 0, 0, 0], [23, 66, 100, 44], 1),
        P('LASER', [61, 0, 0, 0, 0, 0, 0, 0], [0, 66, 0, 33], 1),
        P('WIND RISE', [62, 0, 0, 0, 0, 0, 0, 0], [109, 66, 100, 114], 0),
        P('SPACEDRONE', [63, 0, 0, 0, 0, 0, 0, 0], [87, 66, 100, 119], 0),
        P('KICK', [64, 0, 0, 0, 0, 0, 0, 0], [0, 81, 0, 79], 1),
        P('SNARE', [65, 0, 0, 0, 0, 0, 0, 0], [0, 71, 0, 68], 0),
        P('HIHAT', [66, 0, 0, 0, 0, 0, 0, 0], [0, 53, 0, 51], 0),
        P('CLAP', [67, 0, 0, 0, 0, 0, 0, 0], [0, 74, 0, 72], 0),
        P('E-PIANO', [68, 0, 0, 0, 0, 0, 0, 0], [0, 100, 18, 76], 0),
        P('OB WURLI', [69, 0, 0, 0, 0, 0, 0, 0], [0, 92, 30, 57], 0),
      ],
    },
  ]
  const FM6_E = ENG.findIndex((e) => e.name === 'FM6'),
    FM6_BANK = 27,
    FM6_NPART = 3
  const v9 =
    !opt.legacy &&
    !opt.v3 &&
    !opt.noBackup &&
    !opt.v7 &&
    !opt.v8 /* SLOOP 2.4: FM6 patches */
  const v10 = v9 && !opt.v9 /* SLOOP 2.5: the SYN drum kits */
  const v11 = v10 && !opt.v10 /* SLOOP 2.7: your theme (backup object 11) */
  /* demo patterns of the mock only (the LIVE firmware has no factory patterns: a preset never writes the
     sequencer); used to seed the mock's user presets and track 1 as if they had been recorded */
  const T_ = 4
  const PATTERNS = [
    [
      [45, 45, 57, 45, 0, 48, 45, 55, 45, 0, 57, 52, 45, 48, 0, 50],
      [1, 0, 2, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0, 2, 0, 1],
    ],
    [
      [0, 36, 0, 36, 0, 36, 0, 48, 0, 36, 0, 36, 0, 39, 0, 43],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    ],
    [
      [60, 0, 67, 0, 72, 67, 0, 64, 62, 0, 69, 0, 74, 69, 0, 67],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    ],
    [
      [72, 0, 0, 74, 0, 0, 76, 0, 79, 0, 76, 0, 74, 0, 0, 0],
      [1, T_, 0, 2, T_, 0, 0, 0, 1, 0, 2, 0, 0, T_, T_, 0],
    ],
    [
      [60, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 55, 0, 0, 0],
      [0, T_, T_, T_, T_, T_, T_, 0, 0, T_, T_, 0, 0, T_, T_, 0],
    ],
    [
      [0, 0, 60, 0, 0, 63, 0, 0, 0, 0, 60, 0, 0, 65, 0, 63],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    ],
    [
      [72, 0, 0, 79, 0, 0, 84, 0, 0, 0, 76, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    [
      [36, 0, 0, 0, 0, 0, 0, 36, 0, 0, 34, 0, 0, 0, 0, 0],
      [1, T_, T_, T_, 0, 0, 0, 0, 0, 0, 0, T_, T_, T_, 0, 0],
    ],
    [
      [60, 61, 62, 67, 64, 65, 60, 69, 68, 70, 62, 67, 72, 72, 74, 64],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ],
    [
      [60, 60, 61, 61, 62, 0, 63, 63, 64, 65, 65, 0, 66, 66, 66, 67],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ],
    [
      [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    ],
  ]
  const P_E0 = TP.length,
    P_COUNT = P_E0 + 8,
    G_COUNT = GP.length,
    NSTEP = 64,
    G_ENGSEL = 20,
    P_SLCR = 45,
    P_CHORD = 49
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  /* v13 (BoopBox): eight tracks, drums on 4 and 8 (each drum track's level its own P_LEVEL); before (SLOOP, firmware v3..v12):
     four, the drum track last (its level G_DRLVL). engine / preset / p / step below are the selected track's */
  const NTRK = mockProto >= 13 ? 8 : 4,
    TRK_DRUM = 3,
    EIGHT = NTRK >= 8
  const isDrumIdx = (i: number) => (EIGHT ? i % 4 === 3 : i === TRK_DRUM)
  const newTrack = (i: number): MockTrack => ({
    engine: 0,
    preset: 0,
    drum: isDrumIdx(i),
    fm6: FM6.INIT_PK.slice() /* fm6: the FM6 patch (eng_fm6.c fm6_patch) */,
    p: TP.map((d) => d.def).concat(
      isDrumIdx(i) ? [5, 0, 0, 0, 0, 0, 0, 0] : new Array(8).fill(0),
    ),
    step: Array.from({ length: NSTEP }, () => ({
      n: 0,
      notes: [0, 0, 0, 0],
      time: 2,
      flags: 0,
      vel: 0,
      lvl: 0,
      rat: 0,
    })),
    dstep: isDrumIdx(i) ? Array.from({ length: NSTEP }, emptyDrum) : null,
    micro: new Array(NSTEP).fill(0),
    locks: [] /* v7: nudges, parameter locks (at most NLOCK) */,
    fill: new Array(NSTEP / 4).fill(0),
  }) /* v8: fill conditions, 2 bits a step */
  const NLOCK = 24
  const st = {
    tracks: Array.from({ length: NTRK }, (_, i) => newTrack(i)),
    sel: 0,
    rec: 0,
    solo: 0,
    g: GP.map((d) => d.def),
    slots: [null, null, null, null],
    smp: [0, 1, 2, 3].map(() => ({
      flash: new Uint8Array(SMP.SLOT_SIZE).fill(0xff),
      zones: 0,
      name: '',
      len: 0,
      next: SMP.DATA_OFF,
    })) /* USR1..4 (2.4: USR4) */,
    bank: new Array(opt.slots || 32).fill(
      null,
    ) /* user presets: {engine, name, p, pattern} */,
    fm6bank: new Array(FM6_BANK).fill(
      null,
    ) /* the FM6 patch bank (fm6_bank.c): packed records */,
    settings:
      mockSettings() /* v6: the settings object (2.5: a PER3 with a song order) */,
    dsyn: null,
    dsynStored: null,
    dsynPlayed: [] /* v10: the SYN kits (RAM, flash), the auditions heard */,
    ml: null /* 2.6: the MIDI LEARN map (seq.c ml_tab, 16 x 2 bytes), null: none */,
    bkSnap: null,
    bkPut: null,
    watch: false,
    v4: false,
    lastReq: 0,
    playing: false,
    /* v12 (LIVE): the transport's start, the sections (A..D: playing, asked for at a time), song mode, SONG REC, fills,
       the punch-in effect, REC waiting for a note, undo (0 none, 1 undo, 2 redo), a store waiting for its second press,
       the taps of TAP, the MIDI the editor played (notes) */
    live: {
      t0: 0,
      sec: -1,
      next: -1,
      nextAt: 0,
      songMode: false,
      srec: 0,
      fillHeld: false,
      fillBar: false,
      fillAt: 0,
      fillTo: 0,
      fx: -1,
      recWait: false,
      undo: 0,
      armed: -1,
      armedAt: 0,
      taps: [],
      rolls: new Set(),
      erase: new Set(),
      pattern: [],
      chain: [],
      thr: 0,
      master: 0,
      dtw: new Array(16).fill(8 | (4 << 4)),
    },
    midiIn: [],
  } as Omit<MockState, 'engine' | 'preset' | 'p' | 'step'> as MockState
  for (const k of ['engine', 'preset', 'p', 'step']) {
    Object.defineProperty(st, k, {
      enumerable: false,
      get: () => (st.tracks[st.sel] as unknown as Record<string, unknown>)[k],
      set: (v) => {
        ;(st.tracks[st.sel] as unknown as Record<string, unknown>)[k] = v
      },
    })
  }
  const drumSel = () => st.tracks[st.sel].drum
  const ml48 = () => {
    const d = new Uint8Array(48)
    if (st.ml) d.set(st.ml.slice(0, 48))
    else d.set([1, 2, 3, 10, 2], 32)
    return d
  }
  /* (BoopBox) backup object 0 as the firmware keeps it, format 7 (PROJ7): the mock's tracks (kind, sound, parameters,
     the pattern playing: steps, nudges, fill conditions, locks) and what the last project sent kept (the other patterns,
     the chains, the components, FOLLOW, the progression: st.p7). A project sent is applied to the tracks the same way */
  const p7def = (t: MockTrack, k: number) =>
    k < P_E0
      ? TP[k].def
      : t.drum
        ? k === P_E0
          ? KIT.def
          : 0
        : ENG[t.engine].edit[k - P_E0].def
  const p7Pat = (t: MockTrack, keep: P7Pat | null | undefined) => {
    const p = PROJ7.emptyPat(t.drum),
      pe0 = P_E0
    for (let k = 0; k < NSTEP; k++) {
      if (t.drum) {
        const d = t.dstep![k],
          lv = [0, 0, 0, 0],
          rt = [0, 0, 0, 0]
        for (let l = 0; l < 16; l++) {
          lv[l >> 2] |= (d.lvl[l] & 3) << (2 * (l & 3))
          rt[l >> 2] |= (d.rat[l] & 3) << (2 * (l & 3))
        }
        p.steps[k] = { on: [d.on & 0xff, (d.on >> 8) & 0xff], lvl: lv, rat: rt }
      } else {
        const x = t.step[k]
        p.steps[k] = {
          notes: x.notes.slice(),
          n: x.n,
          time: x.time,
          flags: x.flags,
          vel: x.vel,
          lvl: x.lvl | 0,
          rat: x.rat | 0,
        }
      }
      p.micro[k] = t.micro[k]
      p.fill[k] = fillGet(t.fill, k)
    }
    p.locks = t.locks.map((l) => ({
      step: l.step,
      slide: false,
      code: PROJ7.codeOf(l.param, pe0),
      val: l.value,
    }))
    if (keep) {
      p.comps = keep.comps.map((c) => ({ ...c }))
      p.dir = keep.dir
      p.seed = keep.seed
    }
    return p
  }
  function p7Bytes() {
    const B: Pick<Proj7, 'harm' | 'bank' | 'tracks'> & {
        scenes?: P7Scenes | null
      } = st.p7 || { harm: null, bank: [], tracks: [] },
      gm: number[] = new Array((G_COUNT + 7) >> 3).fill(0),
      gv: number[] = []
    st.g.forEach((x, k) => {
      if (x !== GP[k].def) {
        gm[k >> 3] |= 1 << (k & 7)
        gv.push(x)
      }
    })
    const w = PROJ7.writer()
    w.u8(G_COUNT)
    gm.forEach((x) => w.u8(x))
    gv.forEach((x) => w.v(x))
    return PROJ7.encode({
      g: w.o,
      sel: st.sel,
      harm: B.harm,
      bank: B.bank,
      other: [],
      tracks: st.tracks.map((t, i) => {
        const o = B.tracks.find((x) => x.i === i)
        return {
          i,
          kind: t.drum ? 1 : 0,
          eng: t.drum ? 0 : t.engine,
          pre: t.drum ? 0 : t.preset,
          nc: P_E0,
          p: t.p
            .slice(0, P_E0)
            .map((x, k): [number, number] => [k, x])
            .filter(([k, x]) => x !== p7def(t, k)),
          e: t.p
            .slice(P_E0)
            .map((x, k): [number, number] => [k, x])
            .filter(([k, x]) => x !== p7def(t, P_E0 + k)),
          dtw: t.drum ? (o && o.dtw) || new Array(16).fill(0) : null,
          pat: p7Pat(t, o && o.pat),
          cur: o ? o.cur : 0,
          chain: o ? o.chain.slice() : [],
          coff: o ? o.coff | 0 : 0,
          hfol: o ? o.hfol : 0,
          tail: 2,
        }
      }),
      scenes: B.scenes || null,
    })
  }
  function p7Apply(P: Proj7): void {
    for (const x of P.tracks) {
      const t = st.tracks[x.i]
      if (!t || (x.kind === 1) !== t.drum)
        continue /* (the mock keeps its kinds) */
      if (!t.drum) {
        t.engine = x.eng % ENG.length
        t.preset = x.pre
      }
      for (let k = 0; k < P_COUNT; k++) t.p[k] = p7def(t, k)
      x.p.forEach(([k, v]) => {
        if (k < P_E0) t.p[k] = v
      })
      x.e.forEach(([k, v]) => {
        t.p[P_E0 + k] = v
      })
      for (let k = 0; k < NSTEP; k++) {
        if (t.drum) {
          const s = x.pat.steps[k] as P7DrumStep,
            d = emptyDrum()
          d.on = s.on[0] | (s.on[1] << 8)
          for (let l = 0; l < 16; l++) {
            d.lvl[l] = (s.lvl[l >> 2] >> (2 * (l & 3))) & 3
            d.rat[l] = (s.rat[l >> 2] >> (2 * (l & 3))) & 3
          }
          t.dstep![k] = d
        } else {
          const s = x.pat.steps[k] as P7Step
          t.step[k] = {
            n: s.n,
            notes: s.notes.slice(),
            time: s.time,
            flags: s.flags,
            vel: s.vel,
            lvl: s.lvl,
            rat: s.rat,
          }
        }
        t.micro[k] = x.pat.micro[k]
        fillSet(t.fill, k, x.pat.fill[k])
      }
      t.locks = x.pat.locks
        .map((l) => ({
          step: l.step,
          param: PROJ7.idOf(l.code, P_E0),
          value: l.val,
        }))
        .filter((l) => l.param >= 0)
    }
    if (P.sel < NTRK) st.sel = P.sel
    st.p7 = P
  }
  const drumFoc = () =>
    drumSel()
      ? st.sel
      : st.tracks.findIndex((t) => t.drum) /* core.h drum_focus */
  const lvlOf = (i: number) =>
    !EIGHT && st.tracks[i].drum
      ? st.g[25]
      : st.tracks[i].p[0] /* (four tracks: the drums' G_DRLVL) */
  const setLvl = (i: number, lv: number): void => {
    if (!EIGHT && st.tracks[i].drum) st.g[25] = lv
    else st.tracks[i].p[0] = lv
  }
  const engOf = (t: MockTrack) =>
    t.drum ? ENG.length : t.engine /* the engine byte: NENGINES = drums */
  const watchMs = opt.watchMs || 3000
  const tdesc = (t: MockTrack, id: number) =>
    t.drum && id === P_E0
      ? KIT
      : id >= P_E0
        ? ENG[t.engine].edit[id - P_E0]
        : TP[id]
  const desc = (scope: number, id: number) =>
    scope === 0 && id < P_COUNT
      ? tdesc(st.tracks[st.sel], id)
      : scope === 1 && id < G_COUNT
        ? GP[id]
        : null
  const seqEmpty = () => st.step.every((s) => !s.n)
  function loadPat16(pat: PatStep[]): void {
    /* ui.c load_pat16 */
    const ps = stepsFromPattern(pat)
    st.step.forEach((s, i) =>
      Object.assign(
        s,
        i < 16
          ? ps[i]
          : { n: 0, notes: [0, 0, 0, 0], time: 2, flags: 0, vel: 0 },
      ),
    )
    st.p[29] = 16
  }
  const loadPattern = (k: number): void =>
    loadPat16(PATTERNS[k][0].map((n, i) => [n, PATTERNS[k][1][i]]))
  function applyPreset(pi: number, demo?: boolean): void {
    /* demo: seed the mock (never from a command) */
    if (drumSel()) return
    const e = ENG[st.engine]
    pi %= e.presets.length
    const pr = e.presets[pi]
    st.preset = pi
    for (let i = 0; i < 8; i++) st.p[P_E0 + i] = pr.e[i]
    ;[1, 2, 3, 4].forEach((id, k) => {
      st.p[id] = pr.env[k]
    })
    st.p[37] = pr.mono ? 2 : 0
    st.p[33] = 0
    st.p[34] = 24
    st.p[35] = 28
    st.p[36] = 36
    for (let i = P_SLCR; i < P_CHORD; i++)
      st.p[i] =
        TP[
          i
        ].def /* a factory preset turns the SLICER off (CHORD stays: the key) */
    if (demo && pr.pat && seqEmpty()) loadPattern(pr.pat - 1)
    if (st.engine === FM6_E)
      fm6Slot(
        st.tracks[st.sel],
        st.p[P_E0 + 7],
      ) /* eng_fm6.c fm6_track_loaded: the slot's patch */
  }
  /* PTCH value s -> the track's patch: F1..F8 the factory, B1..B27 the bank (empty: the init voice) */
  function fm6Slot(t: MockTrack, s: number): void {
    const nf = FM6.FACTORY_PK.length
    t.fm6 = (
      s < nf ? FM6.FACTORY_PK[s] : st.fm6bank[s - nf] || FM6.INIT_PK
    ).slice()
  }
  function setEngine(ei: number): void {
    if (drumSel()) return
    st.engine = ei % ENG.length
    for (let i = 0; i < 8; i++) st.p[P_E0 + i] = ENG[st.engine].edit[i].def
    applyPreset(0)
  }
  const fm6BankChanged = (k: number): void =>
    st.tracks.forEach((t) => {
      if (
        !t.drum &&
        t.engine === FM6_E &&
        t.p[P_E0 + 7] === FM6.FACTORY_PK.length + k
      )
        fm6Slot(t, t.p[P_E0 + 7])
    })
  const clearSteps = (): void => {
    st.step.forEach((s) =>
      Object.assign(s, {
        n: 0,
        notes: [0, 0, 0, 0],
        time: 2,
        flags: 0,
        vel: 0,
        lvl: 0,
        rat: 0,
      }),
    )
    st.tracks[st.sel].micro.fill(0)
    st.tracks[st.sel].locks.length = 0
    st.tracks[st.sel].fill.fill(0)
  }
  const snapshot = (name: string) => ({
    engine: st.engine,
    name,
    p: st.p.slice(),
    pattern: patternFromSteps(st.step),
  })
  /* a few user presets to start with */
  ;(
    [
      [0, 0, 0, 'MY LEAD'],
      [1, 1, 1, 'GLASS BELL'],
      [2, 2, 3, 'PHASE RESO'],
      [5, 3, 2, '8BIT ARP'],
    ] as [number, number, number, string][]
  ).forEach(([slot, e, p, name]) => {
    setEngine(e)
    clearSteps()
    applyPreset(p, true)
    st.bank[slot] = snapshot(name)
    clearSteps()
  })
  ;[
    [1, 1, 5],
    [2, 3, 0],
  ].forEach(([i, e, p]) => {
    st.sel = i
    setEngine(e)
    applyPreset(p)
    clearSteps()
  }) /* MUSIC BOX, GAME LEAD */
  st.fm6bank[0] = FM6.pack(
    FM6.setName(FM6.factory(0), 'MY TINES'),
  ) /* B1: a stored patch to look at */
  /* a mix to look at: pads left, lead right, and a GM drum pattern on track 4 */
  st.tracks[1].p[39] = -24
  st.tracks[2].p[39] = 20
  st.tracks[2].p[0] = 92
  st.tracks[TRK_DRUM].p[39] = 0
  /* a boom bap beat on the 16 lanes: kick 0, snare 2, clap 3, hat 4, open hat 5; a ghost snare, a hat roll (x2) */
  const KICK = 0,
    SNARE = 2,
    CLAP = 3,
    HAT = 4,
    OHAT = 5
  ;[
    [KICK, HAT],
    [HAT],
    [HAT],
    [HAT],
    [SNARE, HAT],
    [HAT],
    [HAT],
    [KICK, OHAT],
    [KICK, HAT],
    [HAT],
    [KICK],
    [HAT, SNARE],
    [SNARE, CLAP],
    [HAT],
    [HAT],
    [OHAT],
  ].forEach((ls, i) => {
    const d = st.tracks[TRK_DRUM].dstep![i]
    for (const l of ls) d.on |= 1 << l
    if (i === 11) d.lvl[SNARE] = 1 /* GHOST */
    if (i === 14) d.rat[HAT] = 1 /* x2 */
  })
  st.sel = 0
  setEngine(0)
  clearSteps()
  applyPreset(
    4,
    true,
  ) /* WOBBLE, a recorded-looking pattern on track 1 (mock only) */
  const project = (): MockProject =>
    JSON.parse(JSON.stringify({ tracks: st.tracks, sel: st.sel, g: st.g }))
  /* v10: a factory synthesised kit (DSYN_MOCK_KITS), SYN1..4 = copies of 808, 909, TRAP, TECHNO */
  const dsynRaw = b64dec(DSYN_MOCK_KITS)
  function dsynFactory(i: number): DsynKit {
    const at = i * (1 + DSYN.LANES * DSYN.SIZE)
    return {
      name: DSYN_MOCK_NAMES[i],
      crush: dsynRaw[at],
      src: i,
      sounds: Array.from({ length: DSYN.LANES }, (_, l) =>
        dsynRaw.slice(at + 1 + l * DSYN.SIZE, at + 1 + (l + 1) * DSYN.SIZE),
      ),
    }
  }
  function dsynKits() {
    if (!st.dsyn) {
      st.dsyn = [0, 1, 5, 12].map(dsynFactory)
      st.dsynStored = DSYN.bankEncode(st.dsyn)
    }
    return st.dsyn
  }
  st.slots[0] = project()

  function handle(cmd: number, a: number[]): number[] | null {
    const out: number[] = []
    const b = (x: number) => out.push(x & 0x7f),
      v = (x: number) => out.push(...v14enc(x)),
      s = (x: unknown) => out.push(...strEnc(x))
    if (opt.legacy && cmd >= CMD.UP_LIST) return null
    if (opt.v3 && cmd >= CMD.TRACK_PARAM) return null
    if (opt.noBackup && cmd >= CMD.LOCK_GET)
      return null /* (a v5 device: no locks either) */
    if (opt.v7 && cmd >= CMD.FILL_GET)
      return null /* (a v7 device: no fill conditions) */
    if (!v9 && cmd >= CMD.FM6_GET)
      return null /* (a v8 device: no FM6 patches) */
    if (!v10 && cmd >= CMD.DSYN_LIST)
      return null /* (a v9 device: no SYN kits) */
    const NB = st.bank.length
    switch (cmd) {
      case CMD.UP_LIST: {
        if (a.length < 2) return null
        const start = a[0],
          n = Math.max(0, Math.min(a[1], UP.LIST_MAX, NB - start))
        b(start)
        b(n)
        b(NB)
        for (let i = start; i < start + n; i++) {
          const u = st.bank[i]
          b(u ? 1 : 0)
          b(u ? u.engine : 0)
          s(u ? u.name : '')
        }
        break
      }
      case CMD.UP_GET: {
        if (a.length < 1 || a[0] >= NB) return null
        const u = st.bank[a[0]]
        b(a[0])
        b(u ? 1 : 0)
        b(u ? u.engine : 0)
        s(u ? u.name : '')
        for (let i = 0; i < P_COUNT; i++) v(u ? u.p[i] : 0)
        for (let i = 0; i < UP.PAT; i++) {
          const x = u ? u.pattern[i] : [0, 0]
          b(x[0])
          b(x[1])
        }
        break
      }
      case CMD.UP_PUT: {
        if (a.length < 3) return null
        const r = new Reader(a)
        let rc = 0
        try {
          const slot = r.b(),
            engine = r.b(),
            name = r.s(),
            p = [],
            pattern = []
          for (let i = 0; i < P_COUNT; i++) p.push(r.v())
          for (let i = 0; i < UP.PAT; i++) pattern.push(patNorm(r.b(), r.b()))
          if (
            slot >= NB ||
            engine >= ENG.length ||
            !name.length ||
            name.length > UP.NAME_MAX ||
            /[^\x20-\x7E]/.test(name)
          )
            rc = 1
          else if (st.playing)
            rc = 3 /* editor.c: no flash write while the song plays */
          else {
            const saved =
              st.engine /* values clamped to the ranges of that engine */
            st.engine = engine
            st.bank[slot] = {
              engine,
              name,
              p: p.map((x, i) => {
                const d = desc(0, i)
                return clamp(x, d!.min, d!.max)
              }),
              pattern,
            }
            st.engine = saved
          }
        } catch {
          rc = 1
        }
        b(a[0])
        b(rc)
        break
      }
      case CMD.UP_STORE: {
        if (a.length < 2) return null
        const name = new Reader(a.slice(1)).s()
        const rc = a[0] >= NB || name.length > UP.NAME_MAX || drumSel() ? 1 : 0
        if (!rc)
          st.bank[a[0]] = snapshot(
            name ||
              `${ENG[st.engine].name} ${String(a[0] + 1).padStart(2, '0')}`,
          )
        b(a[0])
        b(rc)
        break
      }
      case CMD.UP_LOAD: {
        if (a.length < 1) return null
        const u = drumSel() ? null : st.bank[a[0]]
        if (u) {
          /* the sound; the mix, pattern and key parameters stay (param_kept) */
          const KEPT = [0, 25, 26, 27, 29, 30, 31, 32, 39, 40, P_CHORD],
            mix = KEPT.map((i) => st.p[i])
          st.engine = u.engine
          st.preset = 0
          st.p = u.p.slice()
          KEPT.forEach((i, k) => {
            st.p[i] = mix[k]
          })
          /* LIVE firmware: a user preset brings its sound only, never its pattern */
        }
        b(a[0])
        b(u ? 0 : 1)
        break
      }
      case CMD.UP_ERASE:
        if (a.length < 1) return null
        if (a[0] < NB) st.bank[a[0]] = null
        b(a[0])
        b(a[0] < NB ? 0 : 1)
        break
      case CMD.WATCH:
        if (a.length < 1) return null
        st.watch = !!(a[0] & 1)
        st.v4 =
          st.watch && !opt.v3 && !!(a[0] & 2) /* v4: TRACK_CHANGED pushes too */
        b((st.watch ? 1 : 0) | (st.v4 ? 2 : 0))
        break
      case CMD.PING:
        b(0)
        break
      case CMD.INFO:
        s(
          opt.legacy
            ? 'FELUCCA 0.4 BETA (MOCK)'
            : opt.v3
              ? 'FELUCCA 0.8 (MOCK)'
              : 'FELUCCA BOOPBOX 1.0.0 (MOCK)',
        )
        b(ENG.length)
        b(P_COUNT)
        b(G_COUNT)
        b(NSTEP)
        b(P_E0)
        ENG.forEach((e) => s(e.name))
        if (!opt.legacy) b(NTRK)
        if (v5)
          b(
            mockProto,
          ) /* v12: LIVE (2.7), v11: your theme (2.7) */ /* v10: SYN kits (v9: FM6 patches, v8: fill conditions, v7: nudges and locks, v6: backup) */
        break
      case CMD.GET:
      case CMD.SET: {
        if (a.length < 2) return null
        const d = desc(a[0], a[1])
        if (!d) return null
        const arr = a[0] ? st.g : st.p
        if (cmd === CMD.SET && a.length >= 4) {
          if (a[0] === 1 && a[1] === G_ENGSEL)
            setEngine(clamp(v14dec(a[2], a[3]), 0, ENG.length - 1))
          else if (d.max > d.min)
            arr[a[1]] = clamp(v14dec(a[2], a[3]), d.min, d.max)
          if (!a[0] && a[1] === P_E0 + 7 && st.engine === FM6_E && !drumSel())
            fm6Slot(st.tracks[st.sel], arr[a[1]]) /* PTCH (fm6_poll) */
        }
        b(a[0])
        b(a[1])
        v(arr[a[1]])
        break
      }
      case CMD.DUMP:
        b(engOf(st.tracks[st.sel]))
        b(st.preset)
        st.p.forEach(v)
        st.g.forEach(v)
        break
      case CMD.TRACK:
        if (a.length >= 1 && a[0] < NTRK) st.sel = a[0]
        b(st.sel)
        b(NTRK)
        st.tracks.forEach((t, i) => {
          b(engOf(t))
          b(t.preset)
          v(lvlOf(i))
          b(t.p[40] ? 1 : 0)
          b((st.rec >> i) & 1)
        })
        if (v5 && EIGHT) {
          b(st.solo & 127)
          b(st.solo >> 7)
        } else if (v5) b(st.solo & 15)
        break
      case CMD.TRACK_MIX: {
        if (a.length < 1 || a[0] >= NTRK) return null
        const t = st.tracks[a[0]]
        if (a.length >= 4) {
          setLvl(a[0], clamp(v14dec(a[1], a[2]), 0, 127))
          t.p[40] = a[3] ? 1 : 0
        }
        b(a[0])
        v(lvlOf(a[0]))
        b(t.p[40] ? 1 : 0)
        break
      }
      case CMD.TRACK_DUMP: {
        if (a.length < 1 || a[0] >= NTRK) return null
        const t = st.tracks[a[0]]
        b(a[0])
        b(engOf(t))
        b(t.preset)
        t.p.forEach(v)
        break
      }
      case CMD.TRACK_PARAM: {
        if (a.length < 2 || a[0] >= NTRK || a[1] >= P_COUNT) return null
        const t = st.tracks[a[0]],
          d = tdesc(t, a[1])
        if (a.length >= 4 && d.max > d.min)
          t.p[a[1]] = clamp(v14dec(a[2], a[3]), d.min, d.max)
        if (a.length >= 4 && a[1] === P_E0 + 7 && !t.drum && t.engine === FM6_E)
          fm6Slot(t, t.p[a[1]]) /* PTCH (fm6_poll) */
        b(a[0])
        b(a[1])
        v(t.p[a[1]])
        break
      }
      case CMD.TRACK_STEP: {
        if (a.length < 2 || a[0] >= NTRK || a[1] >= NSTEP) return null
        const t = st.tracks[a[0]]
        if (t.drum) {
          if (a.length >= 10)
            dFromOld(t.dstep![a[1]], a[2], a.slice(3, 7), a[7], a[8])
          b(a[0])
          b(a[1])
          stepOut(b, dOld(t.dstep![a[1]]))
          break
        }
        const x = t.step[a[1]]
        if (a.length >= 10) stepIn(x, a.slice(2))
        b(a[0])
        b(a[1])
        stepOut(b, x)
        break
      }
      /* v7: parameter locks and nudges (firmware editor.c ED_LOCK_* / ED_MICRO_*) */
      case CMD.LOCK_GET: {
        if (a.length < 1 || a[0] >= NTRK) return null
        const t = st.tracks[a[0]]
        b(a[0])
        b(t.locks.length)
        for (const l of t.locks) {
          b(l.step)
          b(l.param)
          v(l.value)
        }
        break
      }
      case CMD.LOCK_SET: {
        if (a.length < 3 || a[0] >= NTRK) return null
        const t = st.tracks[a[0]],
          step = a[1],
          param = a[2]
        let rc =
          step >= NSTEP || param >= P_COUNT ? 1 : !lockable(param, P_E0) ? 2 : 0
        if (!rc) {
          const k = t.locks.findIndex(
            (l) => l.step === step && l.param === param,
          )
          if (a.length >= 5) {
            const d = tdesc(t, param),
              val = clamp(v14dec(a[3], a[4]), d.min, d.max)
            if (k >= 0) t.locks[k].value = val
            else if (t.locks.length < NLOCK)
              t.locks.push({ step, param, value: val })
            else rc = 3
          } else if (k >= 0) t.locks.splice(k, 1)
        }
        const l =
          rc === 1
            ? null
            : t.locks.find((x) => x.step === step && x.param === param)
        b(a[0])
        b(step)
        b(param)
        b(rc)
        b(l ? 1 : 0)
        v(l ? l.value : 0)
        break
      }
      case CMD.MICRO_GET: {
        if (a.length < 1 || a[0] >= NTRK) return null
        b(a[0])
        st.tracks[a[0]].micro.forEach((m) => b(m + 64))
        break
      }
      case CMD.MICRO_SET: {
        if (a.length < 3 || a[0] >= NTRK || a[1] >= NSTEP) return null
        const t = st.tracks[a[0]]
        t.micro[a[1]] = clamp(a[2] - 64, MICRO.MIN, MICRO.MAX)
        b(a[0])
        b(a[1])
        b(t.micro[a[1]] + 64)
        break
      }
      /* v8: the fill conditions (firmware editor.c ED_FILL_*): 16 bytes pack7, as stored; a set of one step */
      case CMD.FILL_GET: {
        if (a.length < 1 || a[0] >= NTRK) return null
        b(a[0])
        out.push(...pack7(Uint8Array.from(st.tracks[a[0]].fill)))
        break
      }
      case CMD.FILL_SET: {
        if (a.length < 3 || a[0] >= NTRK || a[1] >= NSTEP) return null
        const t = st.tracks[a[0]]
        fillSet(t.fill, a[1], a[2] % 3)
        b(a[0])
        b(a[1])
        b(fillGet(t.fill, a[1]))
        break
      }
      case CMD.DRUM_STEP: {
        /* v5: index [, on 3 x 7 bits, lvl 5 x 7, rat 5 x 7] */
        if (a.length < 1 || a[0] >= NSTEP) return null
        const d =
          st.tracks[Math.max(0, drumFoc())].dstep![
            a[0]
          ] /* (the drum track shown: core.h drum_focus) */
        if (a.length >= 14) {
          const g = (k: number, n: number) =>
            a.slice(k, k + n).reduce((x, y, j) => x + y * 2 ** (7 * j), 0)
          const on = g(1, 3) & 0xffff,
            lv = g(4, 5) % 2 ** 32,
            rt = g(9, 5) % 2 ** 32
          Object.assign(d, emptyDrum())
          d.on = on
          for (let l = 0; l < 16; l++)
            if ((on >> l) & 1) {
              d.lvl[l] = Math.floor(lv / 4 ** l) % 4
              d.rat[l] = Math.floor(rt / 4 ** l) % 4
            }
        }
        out.push(...req.drumStep(a[0], d)[1])
        break
      }
      case CMD.DESC: {
        if (a.length < 2) return null
        const d = desc(a[0], a[1])
        if (!d) return null
        b(a[0])
        b(a[1])
        b(d.fmt)
        v(d.min)
        v(d.max)
        v(d.def)
        s(d.label)
        s(d.unit || '')
        if (d.fmt === F.ENUM && d.names)
          for (let i = 0; i <= d.max - d.min && i < 64; i++) s(d.names[i])
        break
      }
      case CMD.STEP_GET:
      case CMD.STEP_SET: {
        if (a.length < 1 || a[0] >= NSTEP) return null
        if (drumSel()) {
          const d = st.tracks[st.sel].dstep![a[0]]
          if (cmd === CMD.STEP_SET && a.length >= 9)
            dFromOld(d, a[1], a.slice(2, 6), a[6], a[7])
          b(a[0])
          stepOut(b, dOld(d))
          break
        }
        const x = st.step[a[0]]
        if (cmd === CMD.STEP_SET && a.length >= 9) stepIn(x, a.slice(1))
        b(a[0])
        stepOut(b, x)
        break
      }
      case CMD.PRESET:
        if (a.length < 2 || a[0] >= ENG.length) return null
        if (a[0] !== st.engine) setEngine(a[0])
        applyPreset(a[1])
        b(engOf(st.tracks[st.sel]))
        b(st.preset)
        break
      case CMD.PROJECT: {
        if (a.length < 2) return null
        const k = a[1] & 3
        if (a[0] > 2) return null
        if (a[0] === 1) st.slots[k] = project()
        else if (a[0] === 0 && st.slots[k])
          Object.assign(st, JSON.parse(JSON.stringify(st.slots[k])))
        b(a[0])
        b(k)
        b(st.slots[k] ? 1 : 0)
        break
      }
      case CMD.NAMES:
        if (a.length < 1 || a[0] >= ENG.length) return null
        b(a[0])
        b(ENG[a[0]].presets.length)
        ENG[a[0]].presets.forEach((p) => s(p.name))
        ENG[a[0]].titles.forEach(s)
        break
      /* user sample slots: the header is checked like the firmware's ed_smp_end() */
      case CMD.SMP_BEGIN:
      case CMD.SMP_ERASE: {
        if (a.length < 1 || a[0] >= st.smp.length) return null
        const u = st.smp[a[0]]
        if (cmd === CMD.SMP_ERASE) u.flash.fill(0xff)
        else u.flash.fill(0xff, 0, 4096)
        u.zones = 0
        u.name = ''
        u.len = 0
        u.next = SMP.DATA_OFF
        b(a[0])
        b(0)
        break
      }
      case CMD.SMP_WRITE: {
        if (a.length < 5 || a[0] >= st.smp.length) return null
        const u = st.smp[a[0]],
          off = a[1] | (a[2] << 7) | (a[3] << 14),
          dat = unpack7(a.slice(4))
        let rc = 0
        if (
          off < SMP.DATA_OFF ||
          off & 0xff ||
          !dat.length ||
          off + dat.length > SMP.SLOT_SIZE ||
          dat.length > 256
        )
          rc = 1
        else {
          if (!(off & 0xfff)) u.flash.fill(0xff, off, off + 4096)
          u.flash.set(dat, off)
          u.next = off + dat.length
        }
        b(a[0])
        b(off)
        b(off >> 7)
        b(off >> 14)
        b(rc)
        break
      }
      case CMD.SMP_END: {
        if (a.length < 2 || a[0] >= st.smp.length) return null
        const u = st.smp[a[0]],
          hd = unpack7(a.slice(1)),
          dv = new DataView(hd.buffer)
        let rc = 0
        if (
          hd.length < SMP.HDR_LEN ||
          dv.getUint32(0, true) !== 0x504d5346 ||
          dv.getUint16(4, true) !== 1
        )
          rc = 2
        else if (!hd[6] || hd[6] > 16) rc = 5
        else {
          const len = dv.getUint32(16, true)
          if (len > SMP.MAX_DATA) rc = 1
          else if (
            crc32(u.flash.subarray(SMP.DATA_OFF, SMP.DATA_OFF + len)) !==
            dv.getUint32(20, true)
          )
            rc = 3
          else {
            u.flash.set(hd, 0)
            u.zones = hd[6]
            u.len = len
            u.name = String.fromCharCode(...hd.slice(8, 16)).replace(
              /\0.*$/,
              '',
            )
          }
        }
        b(a[0])
        b(rc)
        break
      }
      /* v6 backup: the mock's objects are JSON bytes (projects, banks) and the raw sample slots */
      case CMD.BK_LIST: {
        if (opt.noBackup) return null
        const enc = (o: unknown) =>
          Uint8Array.from(
            Array.from(JSON.stringify(o), (c) => c.charCodeAt(0) & 0x7f),
          )
        const bankOf = (h: number) => {
          const x = st.bank.slice(h * 16, h * 16 + 16)
          return x.some(Boolean) ? enc(x) : new Uint8Array(0)
        }
        st.bkSnap = new Map<number, Uint8Array>([
          [0, EIGHT ? p7Bytes() : enc(project())],
          [1, st.settings.slice()],
          ...[0, 1, 2, 3].map((k): [number, Uint8Array] => [
            2 + k,
            st.slots[k] ? enc(st.slots[k]) : new Uint8Array(0),
          ]),
          [6, bankOf(0)],
          [7, bankOf(1)],
          ...(v9
            ? [
                [
                  8,
                  st.fm6bank.some(Boolean)
                    ? FM6.bankObj(st.fm6bank)
                    : new Uint8Array(0),
                ],
              ]
            : []),
          ...(v10 ? [[9, DSYN.bankEncode(dsynKits())]] : []),
          ...(EIGHT
            ? [[10, ml48()]]
            : v10 && st.ml && !mlDefault(st.ml)
              ? [[10, st.ml.slice()]]
              : []) /* (BoopBox: always, 48 bytes) */ /* MIDI LEARN (2.6): only when not the
           * default (editor.c, project.c midi_part_default) */,
          ...(v11 && st.theme
            ? [[11, st.theme.slice()]]
            : []) /* your theme (2.7): only when there is one */,
          ...st.smp.map((_, k) => [
            32 + k,
            st.smp[k].zones
              ? st.smp[k].flash.slice(0, SMP.DATA_OFF + st.smp[k].len)
              : new Uint8Array(0),
          ]),
        ] as [number, Uint8Array][])
        st.bkPut = null
        b(0)
        b(st.bkSnap.size)
        for (const [id, d] of st.bkSnap) {
          b(id)
          out.push(...u35enc(d.length), ...u35enc(crc32(d)))
        }
        break
      }
      case CMD.BK_GET: {
        if (opt.noBackup || a.length !== 8) return null
        const r = new Reader(a),
          id = r.b(),
          off = u35dec(r),
          n = r.b() | (r.b() << 7)
        const d = st.bkSnap && st.bkSnap.get(id)
        const rc =
          !d || !n || n > 256 || off + n > d.length
            ? 1
            : st.bkPut && id === 0
              ? 5
              : 0
        b(id)
        b(rc)
        out.push(...u35enc(off))
        b(rc ? 0 : n)
        b(rc ? 0 : n >> 7)
        if (!rc) out.push(...pack7(d!.subarray(off, off + n)))
        break
      }
      case CMD.BK_PUT: {
        if (opt.noBackup || a.length < 2) return null
        const op = a[0],
          id = a[1],
          r = new Reader(a.slice(2))
        let rc = 1
        if (
          op === 0 &&
          a.length === 12 &&
          [
            0,
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            ...(v9 ? [8] : []),
            ...(v10 ? [9, 10] : []),
            ...(v11 ? [11] : []),
          ].includes(id)
        ) {
          const len = u35dec(r),
            crc = u35dec(r)
          if ((id >= 2 || len) && len <= 1 << 20) {
            st.bkPut = { id, len, crc, pos: 0, buf: new Uint8Array(len) }
            st.bkSnap = null
            rc = 0
          }
        } else if (!st.bkPut || st.bkPut.id !== id) rc = 5
        else if (op === 1 && a.length >= 9) {
          const off = u35dec(r),
            d = unpack7(a.slice(7))
          if (
            off === st.bkPut.pos &&
            d.length &&
            d.length <= st.bkPut.len - off
          ) {
            st.bkPut.buf.set(d, off)
            st.bkPut.pos += d.length
            rc = 0
          }
        } else if (op === 2) {
          const P = st.bkPut
          st.bkPut = null
          rc = P.pos !== P.len || crc32(P.buf) !== P.crc ? 2 : 0
          if (!rc)
            try {
              const js = () =>
                JSON.parse(
                  Array.from(P.buf, (c) => String.fromCharCode(c)).join(''),
                )
              if (id === 1) {
                /* project.c settings_restore */
                if (
                  P.len !== st.settings.length ||
                  !ARR.ok(P.buf) ||
                  P.buf[ARR.OFF] > ARR.STEPS ||
                  P.buf[ARR.OFF + 1] > 1 ||
                  !ARR.valid(ARR.decode(P.buf))
                )
                  throw 0
                if (
                  st.playing &&
                  P.buf
                    .subarray(ARR.OFF, ARR.OFF + ARR.SIZE)
                    .some((v, k) => v !== st.settings[ARR.OFF + k])
                ) {
                  rc = 3
                } else st.settings = P.buf.slice()
              } else if (id === 0 && EIGHT) {
                /* (BoopBox: format 7, as project.c project_restore) */
                const P7 = PROJ7.decode(P.buf)
                if (!P7) throw 0
                if (st.playing) rc = 3
                else p7Apply(P7)
              } else if (id === 0) {
                const o = js()
                st.tracks = o.tracks
                st.sel = o.sel
                st.g = o.g
              } else if (id <= 5) st.slots[id - 2] = P.len ? js() : null
              else if (id === 11) {
                /* your theme (2.7; editor.c: stopped only; 0 bytes: none) */
                const th = P.len ? THEME.decode(P.buf) : null
                if (P.len && (!th || !THEME.readable(th))) throw 0
                if (st.playing) rc = 3
                else
                  st.theme = P.len
                    ? THEME.encode(th!)
                    : null /* (kept as gfx.c keeps it: a THM1 as THM2) */
              } else if (id === 10) {
                /* the MIDI part (2.6; editor.c: stopped only): the LEARN
                                                               map (16 x 2 bytes), then MIDI's channels (4 bytes) */
                if (
                  EIGHT
                    ? P.len !== 48
                    : P.len !== 32 && P.len !== 36 && P.len !== 40
                )
                  throw 0 /* (BoopBox: exactly 48) */
                if (st.playing) rc = 3
                else st.ml = P.buf.slice()
              } else if (id === 9) {
                /* the SYN kits (with the settings: stopped only) */
                const k = DSYN.bankDecode(P.buf)
                if (!k) throw 0
                if (st.playing) rc = 3
                else {
                  st.dsyn = k.map((x) => ({
                    ...x,
                    sounds: x.sounds.map((y) => DSYN.encode(DSYN.decode(y))),
                  }))
                  st.dsynStored = DSYN.bankEncode(st.dsyn)
                }
              } else if (id === 8) {
                /* the PTCH bank (fm6_bank_t; editor.c: stopped only) */
                const x = FM6.bankUnobj(P.buf)
                if (!x) throw 0
                if (st.playing) rc = 3
                else {
                  st.fm6bank = x.map((pk) =>
                    pk ? FM6.pack(FM6.unpack(pk)) : null,
                  )
                  st.fm6bank.forEach((_, i) => fm6BankChanged(i))
                }
              } else {
                const x = P.len ? js() : new Array(16).fill(null)
                for (let i = 0; i < 16; i++)
                  st.bank[(id - 6) * 16 + i] = x[i] || null
              }
            } catch {
              rc = 2
            }
        } else if (op === 3) {
          st.bkPut = null
          rc = 0
        }
        b(op)
        b(id)
        b(rc)
        break
      }
      case CMD.FM6_GET:
      case CMD.FM6_PUT:
      case CMD.FM6_LIST:
      case CMD.FM6_ERASE: {
        /* editor_fm6.c */
        const nf = FM6.FACTORY_PK.length
        if (cmd === CMD.FM6_LIST) {
          if (a.length) return null
          b(nf)
          b(FM6_BANK)
          for (let i = 0; i < nf + FM6_BANK; i++) {
            const pk = i < nf ? FM6.FACTORY_PK[i] : st.fm6bank[i - nf]
            b(pk ? 1 : 0)
            if (pk) s(FM6.name(FM6.unpack(pk)))
            else b(0)
          }
        } else if (cmd === CMD.FM6_ERASE) {
          const rc = a.length !== 1 || a[0] >= FM6_BANK ? 1 : st.playing ? 3 : 0
          if (!rc) {
            st.fm6bank[a[0]] = null
            fm6BankChanged(a[0])
          }
          b(a.length ? a[0] : 127)
          b(rc)
        } else if (cmd === CMD.FM6_GET) {
          let rc = a.length !== 2 || a[0] > 2 ? 1 : 0,
            pk = null
          if (!rc && a[0] === 0) {
            if (a[1] < FM6_NPART) pk = st.tracks[a[1]].fm6
            else rc = 1
          } else if (!rc && a[0] === 1) {
            if (a[1] < FM6_BANK) {
              pk = st.fm6bank[a[1]]
              if (!pk) rc = 2
            } else rc = 1
          } /* 2: an empty slot */
          else if (!rc) {
            if (a[1] < nf) pk = FM6.FACTORY_PK[a[1]]
            else rc = 1
          } /* 1: a bad index */
          b(a.length ? a[0] : 127)
          b(a.length > 1 ? a[1] : 127)
          b(rc)
          if (!rc && pk) pk.forEach(b)
        } else {
          let rc = a.length !== 2 + FM6.PACKED ? 1 : 0
          const pk = rc
            ? null
            : FM6.pack(
                FM6.unpack(a.slice(2)),
              ) /* (every value into its range) */
          if (!rc && a[0] === 0 && a[1] < FM6_NPART) st.tracks[a[1]].fm6 = pk!
          else if (!rc && a[0] === 1 && a[1] < FM6_BANK) {
            if (st.playing) rc = 3
            else {
              st.fm6bank[a[1]] = pk
              fm6BankChanged(a[1])
            }
          } else rc = 1
          b(a.length ? a[0] : 127)
          b(a.length > 1 ? a[1] : 127)
          b(rc)
        }
        break
      }
      case CMD.DSYN_LIST:
      case CMD.DSYN_GET:
      case CMD.DSYN_PUT:
      case CMD.DSYN_STORE:
      case CMD.DSYN_PLAY: {
        /* editor_dsyn.c */
        const K = dsynKits(),
          nf = DSYN_MOCK_NAMES.length
        if (cmd === CMD.DSYN_LIST) {
          if (a.length) return null
          b(nf)
          b(K.length)
          b(DSYN.bankEncode(K).every((x, i) => x === st.dsynStored![i]) ? 1 : 0)
          DSYN_MOCK_NAMES.forEach(s)
          K.forEach((k) => {
            s(k.name)
            b(k.src)
          })
        } else if (cmd === CMD.DSYN_GET) {
          const w = a.length === 1 ? a[0] : 127,
            k =
              w < nf
                ? dsynFactory(w)
                : w >= DSYN.USER && w < DSYN.USER + K.length
                  ? K[w - DSYN.USER]
                  : null
          b(w)
          b(k ? 0 : 1)
          if (k) {
            s(k.name)
            pack7(
              Uint8Array.from([
                k.crush,
                k.src,
                ...k.sounds.flatMap((x) => Array.from(x)),
              ]),
            ).forEach(b)
          }
        } else if (cmd === CMD.DSYN_PUT) {
          const k = a.length >= 2 ? a[0] : 127,
            part = a.length >= 2 ? a[1] : 127,
            d = unpack7(a.slice(2))
          let rc = 1
          if (k < K.length && part < DSYN.LANES && d.length === DSYN.SIZE) {
            K[k].sounds[part] = DSYN.encode(DSYN.decode(d))
            rc = 0
          } else if (k < K.length && part === 16 && d.length === 10) {
            K[k].name = String.fromCharCode(...d.subarray(0, 8)).replace(
              /\0.*$/,
              '',
            )
            K[k].crush = d[8]
            K[k].src = d[9] % nf
            rc = 0
          } else if (
            k < K.length &&
            part === 17 &&
            d.length === 1 &&
            d[0] < nf
          ) {
            K[k] = dsynFactory(d[0])
            rc = 0
          }
          b(k)
          b(part)
          b(rc)
        } else if (cmd === CMD.DSYN_STORE) {
          if (a.length) return null
          const rc = st.playing ? 3 : 0
          if (!rc) st.dsynStored = DSYN.bankEncode(K)
          b(rc)
        } else {
          const rc =
            a.length !== 3 || a[0] >= K.length || a[1] >= DSYN.LANES || !a[2]
              ? 1
              : 0
          if (!rc)
            st.dsynPlayed.push({
              k: a[0],
              lane: a[1],
              vel: a[2],
              sound: K[a[0]].sounds[a[1]].slice(),
            })
          b(a.length ? a[0] : 127)
          b(a.length > 1 ? a[1] : 127)
          b(rc)
        }
        break
      }
      case CMD.SMP_INFO:
        b(st.smp.length)
        b(SMP.SLOT_SIZE / 1024)
        st.smp.forEach((u) => {
          b(u.zones)
          s(u.zones ? u.name : '')
          b(u.zones ? Math.ceil(u.len / 1024) : 0)
        })
        break
      case CMD.LIVE: {
        /* v12: firmware editor_live.c */
        if (a.length < 1 || !v5 || mockProto < 12) return null
        liveOp(a)
        liveState(b, v, a[0])
        break
      }
      default:
        return null
    }
    return frame(cmd, out)
  }

  /* ---- v12: LIVE (firmware editor_live.c, the FM-1's own code for each control: ui_layers.c layer_key, rec_toggle) */
  const barMs = () => 240000 / Math.max(40, st.g[0])
  const nextBar = () =>
    st.live.t0 + Math.ceil((Date.now() - st.live.t0 + 1) / barMs()) * barMs()
  const lenOf = (t: MockTrack) => Math.max(1, t.p[29] | 0)
  function liveTick(): void {
    /* what the sequencer does on the bar */
    const L = st.live,
      now = Date.now()
    if (!st.playing) return
    if (L.next >= 0 && now >= L.nextAt) {
      L.sec = L.next
      L.next = -1
    }
    if (L.fillBar && now >= L.fillAt) {
      L.fillBar = false
      L.fillTo = L.fillAt + barMs()
    }
  }
  function liveOp(a: number[]): void {
    const L = st.live,
      [op, x = 0, y = 0, z = 0] = a
    liveTick()
    if (op === LIVE.PLAY) {
      const play = x === 2 ? !st.playing : !!x
      if (play && !st.playing && !(L.songMode && !st.slots.some(Boolean))) {
        st.playing = true
        L.t0 = Date.now()
      } else if (!play && st.playing) {
        st.playing = false
        L.next = -1
        L.fillBar = false
        if (st.rec) st.rec = 0
      }
    } else if (
      op === LIVE.KEY &&
      a.length >= 4 &&
      x === LIVE.LY_MIX &&
      y < 16
    ) {
      if (!z) {
        if (y === LIVE.FILL) L.fillHeld = false
        return
      }
      const bank = EIGHT
        ? (st.sel >> 2) * 4
        : 0 /* (eight tracks: the selected track's bank of four) */
      if (y < 4) st.tracks[bank + y].p[40] = st.tracks[bank + y].p[40] ? 0 : 1
      else if (y < 8) st.solo ^= 1 << (bank + y - 4)
      else if (y === LIVE.FILL) L.fillHeld = true
      else if (y === LIVE.FILL_BAR) {
        L.fillBar = !L.fillBar
        L.fillAt = nextBar()
      } else if (y === LIVE.TAP) {
        /* ui_layers.c tap_tempo: the last taps' mean, 40..240 */
        const now = Date.now()
        if (L.taps.length && now - L.taps[L.taps.length - 1] > 2000) L.taps = []
        L.taps.push(now)
        if (L.taps.length > 4) L.taps.shift()
        if (L.taps.length >= 2)
          st.g[0] = clamp(
            Math.round((60000 * (L.taps.length - 1)) / (now - L.taps[0])),
            40,
            240,
          )
      }
    } else if (
      op === LIVE.KEY &&
      a.length >= 4 &&
      x === LIVE.LY_SONG &&
      y < 16 &&
      z
    ) {
      if (y < 4) {
        if (st.live.songMode && st.playing) return /* (SONG PLAYS) */
        if (!st.slots[y]) return /* (EMPTY) */
        if (st.playing) {
          L.next = y
          L.nextAt = nextBar()
        } else {
          L.sec = y
          L.next = -1
        }
      } else if (y < 8) {
        const k = y - 4,
          now = Date.now()
        if (st.slots[k] && !(L.armed === k && now - L.armedAt < 3000)) {
          L.armed = k
          L.armedAt = now
          return
        }
        L.armed = -1
        st.slots[k] = project()
        L.sec = k
      } else if (y === LIVE.SONG) {
        if (!L.srec) L.songMode = !L.songMode
      } else if (y === LIVE.SONG_REC) {
        if (L.srec) L.srec = 0
        else if (!(L.songMode && st.playing)) {
          L.songMode = false
          L.srec = 1
        }
      }
    } else if (op === LIVE.FX && a.length >= 3 && x < LIVE.NFX) {
      if (y) L.fx = x
      else if (L.fx === x) L.fx = -1
    } else if (op === LIVE.REC) {
      /* ui_studio.c rec_toggle */
      if (L.ft) {
        L.ft = false
        st.playing = true
        L.t0 = Date.now()
        return
      } /* a free take: REC closes the loop */
      if (st.playing && L.songMode) return
      if (st.rec || L.recWait) {
        st.rec = 0
        L.recWait = false
        return
      }
      L.songMode = false
      if (st.playing) {
        st.rec = 1 << st.sel
        L.undo = 1
      } else L.recWait = true
    } else if (op === LIVE.UNDO && a.length >= 2) {
      if (x && L.undo === 2) L.undo = 1
      else if (!x && L.undo === 1) L.undo = 2
    } else if (
      (op === LIVE.ROLL && a.length >= 5) ||
      (op === LIVE.ERASE && a.length >= 4)
    ) {
      /* (kept for the tests) */
      const set = op === LIVE.ROLL ? L.rolls : L.erase,
        k = `${x}:${y}`,
        down = op === LIVE.ROLL ? a[4] : z
      if (down) set.add(k)
      else set.delete(k)
      if (op === LIVE.ERASE && down && x === 3)
        (st.tracks[3] as MockTrack & { dsteps?: DrumStep[] }).dsteps?.forEach(
          (d) => {
            if (d) d.on &= ~(1 << y)
          },
        )
    } else if (op === LIVE.SOLO_TRK && mockProto >= 13 && a.length >= 2) {
      if (x < NTRK) st.solo ^= 1 << x
    } else if (op === LIVE.PATTERN && a.length >= 4 && x < NTRK) {
      const t = st.tracks[x],
        len = lenOf(t)
      if (y === 1) t.p[29] = z ? Math.min(64, len * 2) : Math.max(1, len >> 1)
      L.pattern.push([x, y, z])
    } else if (op === LIVE.CHAIN) {
      L.chain =
        x && st.playing && a.length >= 1 + x
          ? a.slice(2, 2 + x).map((c) => c & 3)
          : []
      if (L.chain.length) {
        L.next = L.chain[0]
        L.nextAt = nextBar()
      }
    } else if (op === LIVE.THROW) L.thr = x & 3
    else if (op === LIVE.MASTER) L.master = x >= 127 ? 0 : x + 1
    else if (op === LIVE.DRUM_TW && a.length >= 4)
      L.dtw[x & 15] = (Math.min(15, y) & 15) | ((Math.min(7, z) & 7) << 4)
  }
  function liveState(
    b: (x: number) => void,
    v: (x: number) => void,
    op: number,
  ): void {
    const L = st.live,
      now = Date.now(),
      el = now - L.t0,
      mutes = st.tracks.reduce((m, t, i) => m | (t.p[40] ? 1 << i : 0), 0)
    liveTick()
    b(op)
    b(
      (st.playing ? 1 : 0) |
        (L.songMode ? 4 : 0) |
        (L.songMode && st.playing ? 8 : 0) |
        (L.fillHeld || now < L.fillTo ? 16 : 0) |
        (L.fillBar ? 32 : 0) |
        (L.srec ? 64 : 0),
    )
    b(
      (L.recWait ? 1 : 0) |
        (L.undo === 1 ? 2 : 0) |
        (L.undo === 2 ? 4 : 0) |
        (L.ft ? 8 : 0),
    )
    v(st.g[0])
    b(L.sec + 1)
    b(L.next + 1)
    b(L.chain.length >= 2 ? L.chain.length : 0)
    b(0)
    b(mutes)
    b(st.solo & 15)
    b(st.rec & 15)
    b(st.sel)
    b(L.fx + 1)
    b(st.playing ? 18 + Math.round(Math.random() * 6) : 9)
    b(0)
    b(4)
    b(0)
    b(4) /* (the song: entry 0 of 4, bar 0 of 4) */
    b(st.slots.reduce((m, x, k) => m | (x ? 1 << k : 0), 0))
    const trkOut = (t: MockTrack, i: number): void => {
      const steps = st.playing ? Math.floor((el * st.g[0]) / 15000) : 0,
        heard = st.playing && !t.p[40] && !(st.solo && !((st.solo >> i) & 1))
      b(steps % lenOf(t))
      b(lenOf(t))
      b(heard ? 70 + Math.round(Math.random() * 40) : 0)
    }
    st.tracks
      .slice(0, 4)
      .forEach(trkOut) /* (tracks 1..4: the 2.7 page's 50 bytes) */
    if (mockProto >= 12) {
      b(L.master)
      b(L.thr)
      L.dtw.forEach((x) => b(x))
    } /* (2.7: 50 bytes) */
    if (mockProto >= 13) {
      /* v13: tracks 5..8 (65 bytes) */
      b(mutes >> 4)
      b(st.solo >> 4)
      b(st.rec >> 4)
      st.tracks.slice(4, 8).forEach((t, k) => trkOut(t, k + 4))
    }
  }

  /* a WebMIDI-like access object: one input and one output named "Felucca" */
  const input: MockPort = {
    id: 'mock-in',
    name: 'Felucca',
    type: 'input',
    state: 'connected',
    onmidimessage: null,
  }
  let busy = false
  const output: MockPort = {
    id: 'mock-out',
    name: 'Felucca',
    type: 'output',
    state: 'connected',
    send(data: number[] | Uint8Array) {
      if (data && data.length && data[0] !== 0xf0) {
        /* v12 (LIVE): a note, as a keyboard would play it */
        st.midiIn.push(Array.from(data))
        if (
          st.live.recWait &&
          (data[0] & 0xf0) === 0x90 &&
          data[2] &&
          !st.slots.some(Boolean)
        ) {
          st.live.recWait = false
          st.live.ft = true
        } /* an empty project: a free take */
        if (st.midiIn.length > 64) st.midiIn.shift()
        if (opt.onNote) opt.onNote(Array.from(data))
        return
      }
      const f = unframe(data)
      if (!f) {
        console.error(
          'mock: refused a frame that is not F0 7D 46 4C ... F7',
          data,
        )
        return
      }
      if (busy) {
        console.warn('mock: frame dropped (device holds only one frame)', data)
        return
      }
      busy = true
      watching() /* a lapsed WATCH ends before this request counts */
      st.lastReq = Date.now()
      const flash =
        ([CMD.UP_PUT, CMD.UP_STORE, CMD.UP_ERASE] as number[]).includes(
          f.cmd,
        ) && !opt.legacy
      setTimeout(
        () => {
          busy = false
          const r = handle(f.cmd, f.a)
          if (
            r &&
            opt.onChange &&
            (
              [
                CMD.SET,
                CMD.STEP_SET,
                CMD.PRESET,
                CMD.PROJECT,
                CMD.UP_LOAD,
                CMD.TRACK,
                CMD.TRACK_MIX,
                CMD.TRACK_PARAM,
                CMD.TRACK_STEP,
                CMD.DRUM_STEP,
                CMD.LOCK_SET,
                CMD.MICRO_SET,
                CMD.FILL_SET,
                CMD.FM6_PUT,
                CMD.FM6_ERASE,
                CMD.DSYN_PUT,
                CMD.DSYN_PLAY,
                CMD.SMP_END,
                CMD.SMP_ERASE,
                CMD.BK_PUT,
                CMD.LIVE,
              ] as number[]
            ).includes(f.cmd)
          )
            opt.onChange(f.cmd, f.a)
          if (r && input.onmidimessage)
            input.onmidimessage({ data: Uint8Array.from(r) })
          const ra = r ? r.slice(5, -1) : []
          if (
            r &&
            ((f.cmd === CMD.SET && f.a[0] === 1 && f.a[1] === G_ENGSEL) ||
              f.cmd === CMD.PRESET ||
              (f.cmd === CMD.PROJECT && f.a[0] === 0 && ra[2]) ||
              (f.cmd === CMD.UP_LOAD && !ra[1]))
          )
            reloadPush()
        },
        f.cmd === CMD.SMP_ERASE
          ? 900
          : f.cmd === CMD.SMP_BEGIN
            ? 120
            : flash
              ? 150
              : f.cmd === CMD.SMP_WRITE
                ? 25 + Math.random() * 10
                : 4 + Math.random() * 12,
      )
    },
  }
  /* WATCH ends by itself watchMs after the last request */
  function watching() {
    if (st.watch && Date.now() - st.lastReq > watchMs) st.watch = false
    return st.watch
  }
  function push(cmd: number, args: number[]) {
    if (!watching()) return false
    const fr = Uint8Array.from(frame(cmd, args))
    setTimeout(() => {
      if (input.onmidimessage) input.onmidimessage({ data: fr })
    }, 0)
    return true
  }
  const reloadPush = () =>
    push(
      CMD.RELOAD,
      opt.legacy
        ? [st.engine, st.preset]
        : [engOf(st.tracks[st.sel]), st.preset, st.sel],
    )
  /* things done on the device itself */
  const sim = {
    knob(
      id = [9, 33, 35, P_E0 + 4][Math.floor(Math.random() * 4)],
      dv = Math.random() < 0.5 ? -4 : 4,
    ) {
      const d = desc(0, id)!
      st.p[id] = clamp(st.p[id] + dv, d.min, d.max)
      push(CMD.CHANGED, [0, id, ...v14enc(st.p[id])])
      return { id, value: st.p[id] }
    },
    reload(pi = st.preset + 1) {
      applyPreset(pi)
      reloadPush()
      return { engine: st.engine, preset: st.preset }
    },
    track(i = (st.sel + 1) % NTRK) {
      /* TRACKS page KNOB 1 */
      st.sel = i
      reloadPush()
      return i
    },
    /* TRACKS page KNOB 2: the selected track's level (four tracks, the drum track: G_DRLVL); pushes CHANGED */
    level(v: number) {
      const drum = !EIGHT && drumSel()
      v = clamp(v, 0, 127)
      setLvl(st.sel, v)
      push(CMD.CHANGED, drum ? [1, 25, ...v14enc(v)] : [0, 0, ...v14enc(v)])
      return v
    },
    mute(on = !st.p[40]) {
      st.p[40] = on ? 1 : 0
      push(CMD.CHANGED, [0, 40, ...v14enc(st.p[40])])
      return st.p[40]
    },
    /* a parameter of track i changed on the device: CHANGED for the selected track, else TRACK_CHANGED (v4 watch) */
    param(i: number, id: number, val: number) {
      const t = st.tracks[i],
        d = id >= P_E0 ? ENG[t.engine].edit[id - P_E0] : TP[id]
      t.p[id] = clamp(val, d.min, d.max)
      if (i === st.sel) push(CMD.CHANGED, [0, id, ...v14enc(t.p[id])])
      else if (st.v4) push(CMD.TRACK_CHANGED, [i, id, ...v14enc(t.p[id])])
      return t.p[id]
    },
    /* SEQ + a step held + KNOB 4 / PRESETS on the device: a nudge or a lock; the firmware pushes STEP_CHANGED for it */
    nudge(i = 4, m = -8) {
      st.tracks[st.sel].micro[i] = clamp(m, MICRO.MIN, MICRO.MAX)
      push(CMD.STEP_CHANGED, [i, st.sel])
      return i
    },
    /* SEQ + a step held + OCT+ on the device: its fill condition (v8); the same push */
    fill(i = 4, c = 1) {
      fillSet(st.tracks[st.sel].fill, i, c)
      push(CMD.STEP_CHANGED, [i, st.sel])
      return i
    },
    lock(i = 4, param = 33, val = 100) {
      const t = st.tracks[st.sel],
        k = t.locks.findIndex((l) => l.step === i && l.param === param)
      if (k >= 0) t.locks[k].value = val
      else t.locks.push({ step: i, param, value: val })
      push(CMD.STEP_CHANGED, [i, st.sel])
      return i
    },
    /* PLAY / STOP on the device: flash writes (the FM6 bank) answer rc 3 while it plays */
    play(on = !st.playing) {
      st.playing = !!on
      return st.playing
    },
    /* REC on TRACKS: arm / disarm live recording of a track (no push: the editor reads TRACK) */
    arm(i = st.sel) {
      st.rec ^= 1 << i
      return (st.rec >> i) & 1
    },
    step(i = Math.floor(Math.random() * 16)) {
      const x = st.step[i]
      if (drumSel()) {
        const d = st.tracks[st.sel].dstep![i]
        d.on ^= 1 << 4
        d.lvl[4] = d.rat[4] = 0
      } /* the hat lane */
      else if (x.n) x.flags ^= 1
      else
        Object.assign(x, {
          n: 1,
          notes: [60 + Math.floor(Math.random() * 12), 0, 0, 0],
          time: 0,
          flags: 0,
          vel: 96,
        })
      push(CMD.STEP_CHANGED, opt.legacy ? [i] : [i, st.sel])
      return i
    },
  }
  if (opt.auto !== false)
    st.rec = 1 << 2 /* the browser mock: track 3 armed, to show it */
  const timers =
    opt.auto === false
      ? []
      : [
          setInterval(() => sim.knob(), 3000),
          setInterval(() => sim.step(), 11000),
          setInterval(() => sim.reload(), 27000),
          setInterval(
            () =>
              sim.param(
                (st.sel + 1) % NTRK,
                39,
                Math.round(Math.random() * 80) - 40,
              ),
            13000,
          ) /* pan of another track */,
        ]
  return {
    state: st,
    sim,
    stop: (): void => timers.forEach(clearInterval),
    access: {
      sysexEnabled: true,
      inputs: new Map([[input.id, input]]),
      outputs: new Map([[output.id, output]]),
      onstatechange: null,
    },
  }
}
/* A detached snapshot for the audio thread; flash is copied only after an upload or a new start. */
/* A compact sequencer click toggles a whole synth step, or just one drum lane.
   Other drum hits, levels and ratchets are preserved. Never mutate the snapshot. */
/** the audio preview's state (previewSnapshot): a JSON copy of the mock's tracks, the samples' flash, the SYN kits */
export interface PreviewSnapshot {
  tracks: MockTrack[]
  g: number[]
  sel: number
  solo: number
  samples?: Uint8Array[]
  kits?: Uint8Array[]
}
function previewToggleStep<T extends Step>(step: T, note: number): T {
  // REST silences a step in the real sequencer without erasing its pitches or expression.
  if (step.time === 1) return { ...step, notes: step.notes.slice(), time: 2 }
  if (step.n > 0)
    return { ...step, notes: step.notes.slice(), time: step.time === 0 ? 2 : 0 }
  return previewSetStepNotes(step, [note])
}
function previewSetStepNotes<T extends Step>(step: T, notes: number[]): T {
  return {
    ...step,
    n: notes.length,
    notes: [...notes, 0, 0, 0, 0].slice(0, 4),
    time: 0,
    vel: step.vel || 100,
  }
}
function previewToggleDrum<T extends DrumStep>(step: T, lane: number): T {
  const d = { ...step, lvl: step.lvl.slice(), rat: step.rat.slice() }
  d.on ^= 1 << lane
  d.lvl[lane] = d.rat[lane] = 0
  return d
}
function previewSnapshot(
  st: Pick<MockState, 'tracks' | 'g' | 'sel' | 'solo' | 'smp' | 'dsyn'>,
  includeSamples = false,
): PreviewSnapshot {
  const state: PreviewSnapshot = JSON.parse(
    JSON.stringify({ tracks: st.tracks, g: st.g, sel: st.sel, solo: st.solo }),
  )
  if (includeSamples) state.samples = st.smp.map((s) => s.flash.slice())
  if (st.dsyn) {
    const bank = DSYN.bankEncode(st.dsyn)
    state.kits = Array.from({ length: 4 }, (_, i) =>
      bank.slice(8 + i * 364, 8 + (i + 1) * 364),
    )
  }
  return state
}
/* ------------------------------------------------------------ drum kit (2.4) --- */
/* The DRUM KIT page: a user slot whose zones are the drum track's 16 lanes (firmware drums.c, KIT USR1..USR3: a lane
   plays the zone holding its GM note, at its own pitch). A pad: {s: Int16Array at SMP.RATE (normalised), fname,
   tune: semitones -12..12, gain: dB -24..0, len: samples kept (0 = all)}; pads[l] for lane l, or null. */
const KIT = { TUNE: 12, GAIN_MIN: -24, FADE: Math.round(SMP.RATE * 0.004) }
/* a pad as it goes to the slot: tuned (played faster or slower, as a sampler does), cut, faded out, its gain */
/** a pad of the DRUM KIT page */
export interface KitPad {
  s: Int16Array
  fname?: string
  tune?: number
  gain?: number
  len?: number
}
function kitPad(p: KitPad) {
  let x = Array.from(p.s)
  if (p.tune) x = resample(x, SMP.RATE * Math.pow(2, p.tune / 12), SMP.RATE)
  const n = Math.max(
    1,
    Math.min(x.length, p.len! > 0 ? Math.round(p.len!) : x.length),
  )
  const g = Math.pow(10, Math.max(KIT.GAIN_MIN, Math.min(0, p.gain || 0)) / 20),
    out = new Int16Array(n)
  const fade =
    n < x.length
      ? Math.min(KIT.FADE, n)
      : 0 /* a cut sound ends in 4 ms, not with a click */
  for (let i = 0; i < n; i++) {
    const f = fade && i >= n - fade ? (n - i) / fade : 1
    out[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * g * f)))
  }
  return out
}
/* the slot's zones: one per pad, lo = hi = root = its lane's note */
function kitZones(pads: (KitPad | null | undefined)[]) {
  const zs: (SlotZoneIn & { lane: number })[] = []
  pads.forEach((p, l) => {
    if (p)
      zs.push({
        s: kitPad(p),
        root: DRUM_LANES[l][0],
        lo: DRUM_LANES[l][0],
        hi: DRUM_LANES[l][0],
        lane: l,
        fname: p.fname,
      })
  })
  return zs
}
/* the samples a pad keeps after tune and cut (no encode: for the meter while the knobs move) */
const kitLen = (p: KitPad) => {
  const full = p.tune
    ? Math.floor((p.s.length - 1) / Math.pow(2, p.tune / 12))
    : p.s.length
  return Math.max(1, Math.min(full, p.len! > 0 ? Math.round(p.len!) : full))
}
const kitBytes = (pads: (KitPad | null | undefined)[]) =>
  pads.reduce((a, p) => a + (p ? (kitLen(p) + 1) >> 1 : 0), 0)
/* shorten the longest pads to fit `room` bytes (as CHOP's fit): their len, in samples. bins 2 (KIT USR3+4): the
   room of two slots, no pad longer than one slot holds, and the pads must also share out (kitSplit) */
function kitFit(
  pads: (KitPad | null | undefined)[],
  room = SMP.MAX_DATA,
  bins = 1,
): boolean {
  if (bins > 1) {
    let changed = false
    for (const p of pads)
      if (p && (kitLen(p) + 1) >> 1 > room) {
        p.len = room * 2 - 1
        changed = true
      }
    for (
      let r = room * 2;
      !kitSplit(pads, room) && r > 64;
      r = Math.floor(r * 0.98)
    ) {
      kitFit(pads, r)
      changed = true
    }
    return changed
  }
  const use = pads
    .map((p, l) => (p ? { l, n: kitLen(p) } : null))
    .filter((u): u is { l: number; n: number } => !!u)
  const sum = (L: number) =>
    use.reduce((a, u) => a + ((Math.min(u.n, L) + 1) >> 1), 0)
  if (sum(Infinity) <= room) return false
  let lo = 1,
    hi = Math.max(...use.map((u) => u.n))
  while (lo < hi) {
    const L = (lo + hi + 1) >> 1
    if (sum(L) <= room) lo = L
    else hi = L - 1
  }
  for (const u of use)
    if (u.n > lo)
      pads[u.l]!.len = lo /* (len counts the samples after the tune) */
  return true
}
/* KIT USR3+4: the pads shared out over two slots of `room` bytes each, every pad whole in one (the biggest first,
   each into the emptier slot that takes it): [lanes of USR3, lanes of USR4], or null when they do not fit */
function kitSplit(
  pads: (KitPad | null | undefined)[],
  room = SMP.MAX_DATA,
): number[][] | null {
  const items = pads
    .map((p, l) => (p ? { l, b: (kitLen(p) + 1) >> 1 } : null))
    .filter((x): x is { l: number; b: number } => !!x)
    .sort((a, b) => b.b - a.b || a.l - b.l)
  const bins: number[][] = [[], []],
    used = [0, 0]
  for (const it of items) {
    const order = used[0] <= used[1] ? [0, 1] : [1, 0]
    const k = order.find((j) => used[j] + it.b <= room)
    if (k == null) return null
    bins[k].push(it.l)
    used[k] += it.b
  }
  return bins.map((x) => x.sort((a, b) => a - b))
}
/* a file name -> the lane it most likely is (-1: none): "BD 808.wav" kick, "OH_01" open hat, "Low Tom" ... */
const KIT_WORDS: [number, RegExp][] = [
  [5, /open|\boh\b|ophat|o ?hat/],
  [6, /pedal|\bph\b|foot/],
  [4, /clos|\bch\b|\bhh\b|hi ?hat|hihat|\bhat/],
  [7, /\brim|\brs\b|side ?stick|stick/],
  [3, /clap|\bcp\b|\bclp\b|snap/],
  [1, /kick ?2|\bbd ?2|sub ?kick/],
  [0, /kick|\bbd\b|bass ?drum|\bkik\b|\bkck\b/],
  [8, /snare ?2|\bsd ?2|snr ?2/],
  [2, /snare|\bsd\b|\bsnr\b/],
  [10, /hi(gh)? ?tom|\bht\b|tom ?h|mid ?tom|\bmt\b|tom ?[23]\b/],
  [9, /lo(w)? ?tom|\blt\b|floor|tom ?l|tom ?1\b|\btom/],
  [11, /crash|\bcr\b|\bcy\b|cymbal|splash|china/],
  [12, /ride|\brd\b/],
  [13, /shak|\bsh\b|maraca|cabasa|tamb|\bshk\b/],
  [14, /conga|bongo|\bcg\b|\bperc|timbal|djembe/],
  [15, /cow ?bell|\bcb\b|bell|block|clave|agogo/],
]
/* the lane to try next when a sound's lane is taken */
const KIT_ALT: Record<number, number> = {
  0: 1,
  1: 0,
  2: 8,
  8: 2,
  3: 8,
  4: 6,
  6: 4,
  5: 4,
  7: 3,
  9: 10,
  10: 9,
  11: 12,
  12: 11,
  13: 14,
  14: 13,
  15: 14,
}
function kitLaneOf(name: string) {
  const n = String(name)
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, '')
    .replace(/[_\-.()\[\]]+/g, ' ')
  for (const [l, re] of KIT_WORDS) if (re.test(n)) return l
  return -1
}
/* where a new sound goes: its lane, else that lane's alternative, else (or by name nothing) the first free lane */
function kitPlace(
  pads: (KitPad | null | undefined)[],
  name: string,
  want = -1,
) {
  const l = want >= 0 ? want : kitLaneOf(name)
  if (l >= 0 && !pads[l]) return l
  if (want >= 0) return want /* (dropped on a pad: that pad) */
  if (l >= 0 && !pads[KIT_ALT[l]]) return KIT_ALT[l]
  const f = pads.findIndex((p) => !p)
  return f >= 0 ? f : -1
}
/* a ZIP's files [{name, data}] (stored or deflated: DecompressionStream) */
async function zipRead(
  bytes: Uint8Array | ArrayBuffer | ArrayLike<number>,
): Promise<{ name: string; data: Uint8Array }[]> {
  const b =
      bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes as ArrayBuffer),
    v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let e = b.length - 22
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) throw new Error('not a zip')
  const n = v.getUint16(e + 10, true),
    out: { name: string; data: Uint8Array }[] = []
  let c = v.getUint32(e + 16, true)
  for (let k = 0; k < n; k++) {
    if (v.getUint32(c, true) !== 0x02014b50)
      throw new Error('bad zip directory')
    const method = v.getUint16(c + 10, true),
      size = v.getUint32(c + 20, true),
      nl = v.getUint16(c + 28, true)
    const xl = v.getUint16(c + 30, true),
      cl = v.getUint16(c + 32, true),
      off = v.getUint32(c + 42, true)
    const name = new TextDecoder().decode(b.subarray(c + 46, c + 46 + nl))
    const lo =
        off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true),
      raw = b.subarray(lo, lo + size)
    if (!name.endsWith('/')) {
      if (method === 0) out.push({ name, data: raw.slice() })
      else if (method === 8 && typeof DecompressionStream !== 'undefined') {
        const st = new Blob([raw as Uint8Array<ArrayBuffer>])
          .stream()
          .pipeThrough(new DecompressionStream('deflate-raw'))
        out.push({
          name,
          data: new Uint8Array(await new Response(st).arrayBuffer()),
        })
      } else throw new Error(`zip method ${method}`)
    }
    c += 46 + nl + xl + cl
  }
  return out
}

/* ------------------------------------------------ SLOOP 2.5: piano roll --- */
/* A synth track's steps as a piano roll. A NOTE step starts a chord (up to 4 notes, one length for all of
   them: the device ties every note of a step), the TIE steps after it hold it, a REST is silence. These
   functions never change their input: they return the steps to write, as a Map index -> new step. */
/** a chord of the piano roll (ROLL.chords) */
export interface RollChord {
  at: number
  dur: number
  notes: number[]
  vel: number
  flags: number
}
/** what ROLL / SMF read of a step */
export type RollStep = Step | null | undefined
const ROLL = {
  DIV_PER_BAR: [
    4, 8, 16, 32, 12, 24, 2, 1, 0.5,
  ] /* steps in a 4/4 bar for DIV (params.c N_SDIV) */,
  LENGTHS: [
    ['whole', 1],
    ['half', 1 / 2],
    ['quarter', 1 / 4],
    ['eighth', 1 / 8],
    ['sixteenth', 1 / 16],
  ] as [string, number][],
  /* a length (a fraction of a bar) in steps at DIV div: at least one step */
  steps: (frac: number, div: number): number =>
    Math.max(1, Math.round((ROLL.DIV_PER_BAR[div] ?? 16) * frac)),
  rest: (): MockStep => ({
    n: 0,
    notes: [0, 0, 0, 0],
    time: 2,
    flags: 0,
    vel: 0,
    lvl: 0,
    rat: 0,
  }),
  tie: (): MockStep => ({
    n: 0,
    notes: [0, 0, 0, 0],
    time: 1,
    flags: 0,
    vel: 0,
    lvl: 0,
    rat: 0,
  }),
  isNote: (s: RollStep): s is Step => !!s && s.time === 0 && s.n > 0,
  /* the chords: {at, dur, notes[], vel} for every NOTE step, dur = 1 + the TIE steps after it (within len) */
  chords(steps: RollStep[], len: number): RollChord[] {
    const out: RollChord[] = []
    for (let i = 0; i < len; i++) {
      const s = steps[i]
      if (!ROLL.isNote(s)) continue
      let d = 1
      while (i + d < len && steps[i + d] && steps[i + d]!.time === 1) d++
      out.push({
        at: i,
        dur: d,
        notes: s.notes.slice(0, s.n),
        vel: s.vel,
        flags: s.flags,
      })
    }
    return out
  },
  /* the chord sounding at step i (its NOTE step), or -1 */
  owner(steps: RollStep[], i: number): number {
    for (let k = i; k >= 0; k--) {
      const s = steps[k]
      if (ROLL.isNote(s)) return k
      if (!s || (s as Step).time !== 1) return -1
    }
    return -1
  },
  /* the steps after a chord that ends at `end` and were holding it (TIE) become rests */
  _cutTies(
    steps: RollStep[],
    len: number,
    end: number,
    out: Map<number, Step>,
  ): void {
    for (
      let k = end;
      k < len && steps[k] && steps[k]!.time === 1 && !out.has(k);
      k++
    )
      out.set(k, ROLL.rest())
  },
  /* put note `pitch` at step `at` for `dur` steps. On a chord's first step: added to it (it keeps its length,
     at most 4 notes). Inside a held chord: that chord ends there and a new one starts. Elsewhere: a new chord. */
  place(
    steps: RollStep[],
    len: number,
    at: number,
    pitch: number,
    dur: number,
  ): Map<number, Step> {
    const out = new Map<number, Step>(),
      s = steps[at]
    if (at < 0 || at >= len) return out
    if (ROLL.isNote(s)) {
      if (s.notes.slice(0, s.n).includes(pitch) || s.n >= 4) return out
      const notes = s.notes.slice(0, s.n).concat(pitch)
      out.set(at, {
        ...s,
        n: notes.length,
        notes: notes.concat([0, 0, 0, 0]).slice(0, 4),
      })
      return out
    }
    out.set(at, {
      n: 1,
      notes: [pitch, 0, 0, 0],
      time: 0,
      flags: 0,
      vel: 96,
      lvl: 0,
      rat: 0,
    })
    let k = 1
    for (; k < dur && at + k < len; k++) {
      const x = steps[at + k]
      if (ROLL.isNote(x)) break /* the next chord: this one stops before it */
      out.set(at + k, ROLL.tie())
    }
    ROLL._cutTies(
      steps,
      len,
      at + k,
      out,
    ) /* (inside a long chord: its rest is silence now) */
    return out
  },
  /* take note `pitch` off the chord starting at `at`; the last one leaves rests where the chord was */
  remove(
    steps: RollStep[],
    len: number,
    at: number,
    pitch: number,
  ): Map<number, Step> {
    const out = new Map<number, Step>(),
      s = steps[at]
    if (!ROLL.isNote(s)) return out
    const notes = s.notes.slice(0, s.n).filter((n) => n !== pitch)
    if (notes.length === s.n) return out
    if (notes.length) {
      out.set(at, {
        ...s,
        n: notes.length,
        notes: notes.concat([0, 0, 0, 0]).slice(0, 4),
      })
      return out
    }
    out.set(at, ROLL.rest())
    ROLL._cutTies(steps, len, at + 1, out)
    return out
  },
  /* the chord at `at` lasts `dur` steps: shorter, the steps it leaves become rests; longer, it ties over
     the rests after it, up to the next chord */
  resize(
    steps: RollStep[],
    len: number,
    at: number,
    dur: number,
  ): Map<number, Step> {
    const out = new Map<number, Step>()
    if (!ROLL.isNote(steps[at])) return out
    let cur = 1
    while (at + cur < len && steps[at + cur] && steps[at + cur]!.time === 1)
      cur++
    dur = Math.max(1, Math.min(dur, len - at))
    if (dur < cur) for (let k = dur; k < cur; k++) out.set(at + k, ROLL.rest())
    else
      for (let k = cur; k < dur; k++) {
        if (ROLL.isNote(steps[at + k])) break
        out.set(at + k, ROLL.tie())
      }
    return out
  },
}

/* ------------------------------------------ SLOOP 2.5: Standard MIDI Files --- */
/** a note of a MIDI file: at tick t, dur ticks */
export interface SmfNote {
  t: number
  dur: number
  key: number
  vel: number
  ch?: number
}
export interface SmfReport {
  notes: number
  steps: number
  moved: number
  chordCut: number
  overlap: number
  dropped: number
  merged: number
}
export interface SmfApi {
  PPQ: number
  stepTicks(div: number, ppq?: number): number
  vlq(n: number): number[]
  write(
    notes: SmfNote[],
    opt?: { ppq?: number; bpm?: number; ch?: number; name?: string },
  ): Uint8Array
  read(bytes: Uint8Array | ArrayLike<number>): {
    format: number
    ppq: number
    bpm: number
    tracks: { name: string; notes: SmfNote[] }[]
  }
  fromSteps(
    steps: RollStep[],
    len: number,
    div: number,
    ppq?: number,
  ): SmfNote[]
  fromDrums(
    dsteps: (DrumStep | null | undefined)[],
    len: number,
    div: number,
    ppq?: number,
  ): SmfNote[]
  LANE_OF_GM: number[]
  laneOf(key: number): number
  levelOf(vel: number): number
  toSteps(
    notes: SmfNote[],
    ppq: number,
    div: number,
    nstep: number,
    drum?: boolean,
  ):
    | { dsteps: DrumStep[]; len: number; report: SmfReport; steps?: undefined }
    | { steps: MockStep[]; len: number; report: SmfReport; dsteps?: undefined }
}
const SMF: SmfApi = {
  PPQ: 96,
  /* ticks of one step at DIV div (a quarter = ppq ticks) */
  stepTicks: (div: number, ppq: number = SMF.PPQ): number =>
    Math.round((ppq * 4) / (ROLL.DIV_PER_BAR[div] ?? 16)),
  vlq(n: number): number[] {
    const a: number[] = [n & 0x7f]
    while ((n >>= 7)) a.unshift(0x80 | (n & 0x7f))
    return a
  },
  /* a format 0 file: notes [{t, dur, key, vel}] on channel ch (0..15), the tempo, a track name */
  write(
    notes: SmfNote[],
    {
      ppq = SMF.PPQ,
      bpm = 120,
      ch = 0,
      name = '',
    }: { ppq?: number; bpm?: number; ch?: number; name?: string } = {},
  ): Uint8Array {
    const ev: { t: number; o: number; b: number[] }[] = []
    for (const n of notes) {
      ev.push({
        t: n.t,
        o: 1,
        b: [0x90 | ch, n.key & 0x7f, Math.max(1, Math.min(127, n.vel | 0))],
      })
      ev.push({
        t: n.t + Math.max(1, n.dur),
        o: 0,
        b: [0x80 | ch, n.key & 0x7f, 0],
      })
    }
    ev.sort(
      (a, b) => a.t - b.t || a.o - b.o,
    ) /* (a note-off before a note-on at the same tick) */
    const us = Math.round(60000000 / Math.max(1, bpm))
    const nm = Array.from(String(name), (c) => c.charCodeAt(0) & 0x7f)
    const tr = [
      0,
      0xff,
      0x51,
      3,
      (us >> 16) & 255,
      (us >> 8) & 255,
      us & 255,
      0,
      0xff,
      0x58,
      4,
      4,
      2,
      24,
      8,
    ]
    if (nm.length) tr.push(0, 0xff, 0x03, ...SMF.vlq(nm.length), ...nm)
    let last = 0
    for (const e of ev) {
      tr.push(...SMF.vlq(e.t - last), ...e.b)
      last = e.t
    }
    tr.push(0, 0xff, 0x2f, 0)
    const u32 = (n: number) => [
      (n >>> 24) & 255,
      (n >> 16) & 255,
      (n >> 8) & 255,
      n & 255,
    ]
    return Uint8Array.from([
      0x4d,
      0x54,
      0x68,
      0x64,
      ...u32(6),
      0,
      0,
      0,
      1,
      (ppq >> 8) & 255,
      ppq & 255,
      0x4d,
      0x54,
      0x72,
      0x6b,
      ...u32(tr.length),
      ...tr,
    ])
  },
  /* -> {format, ppq, bpm, tracks: [{name, notes: [{t, dur, key, vel, ch}]}]}; throws on a non-MIDI file */
  read(bytes: Uint8Array | ArrayLike<number>): {
    format: number
    ppq: number
    bpm: number
    tracks: { name: string; notes: SmfNote[] }[]
  } {
    const d = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)
    const str = (o: number) =>
      String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3])
    const u32 = (o: number) =>
      ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0
    if (d.length < 14 || str(0) !== 'MThd') throw new Error('not a MIDI file')
    const format = (d[8] << 8) | d[9],
      ntrk = (d[10] << 8) | d[11],
      div = (d[12] << 8) | d[13]
    if (div & 0x8000) throw new Error('SMPTE time is not supported')
    let o = 8 + u32(4),
      bpm = 0
    const tracks: { name: string; notes: SmfNote[] }[] = []
    for (let k = 0; k < ntrk && o + 8 <= d.length; k++) {
      if (str(o) !== 'MTrk') {
        o += 8 + u32(o + 4)
        k--
        if (o >= d.length) break
        continue
      }
      const end = Math.min(d.length, o + 8 + u32(o + 4))
      let p = o + 8,
        t = 0,
        run = 0,
        name = ''
      const on = new Map<number, SmfNote[]>(),
        notes: SmfNote[] = []
      const vlq = () => {
        let n = 0,
          c: number
        do {
          c = d[p++]
          n = (n << 7) | (c & 0x7f)
        } while (c & 0x80 && p < end)
        return n
      }
      const off = (ch: number, key: number): void => {
        const q = on.get(ch * 128 + key)
        if (q && q.length) {
          const n = q.shift()!
          n.dur = Math.max(1, t - n.t)
          notes.push(n)
        }
      }
      while (p < end) {
        t += vlq()
        let st = d[p]
        if (st & 0x80) p++
        else st = run
        if (st === 0xff) {
          const type = d[p++],
            len = vlq()
          if (type === 0x51 && len === 3 && !bpm)
            bpm = 60000000 / ((d[p] << 16) | (d[p + 1] << 8) | d[p + 2])
          if (type === 0x03 && !name)
            name = String.fromCharCode(...d.subarray(p, p + len)).replace(
              /[^\x20-\x7E]/g,
              '',
            )
          p += len
          continue
        }
        if (st === 0xf0 || st === 0xf7) {
          p += vlq()
          continue
        }
        run = st
        const hi = st & 0xf0,
          ch = st & 15
        const a = d[p++],
          b = hi === 0xc0 || hi === 0xd0 ? 0 : d[p++]
        if (hi === 0x90 && b) {
          const q = on.get(ch * 128 + a) || []
          q.push({ t, dur: 0, key: a, vel: b, ch })
          on.set(ch * 128 + a, q)
        } else if (hi === 0x80 || (hi === 0x90 && !b)) off(ch, a)
      }
      for (const [, q] of on)
        for (const n of q) {
          n.dur = Math.max(1, t - n.t)
          notes.push(n)
        } /* (no note-off: to the end) */
      notes.sort((x, y) => x.t - y.t || x.key - y.key)
      tracks.push({ name, notes })
      o = end
    }
    return { format, ppq: div || SMF.PPQ, bpm: Math.round(bpm || 120), tracks }
  },
  /* a synth track's steps -> notes (a chord's notes last its steps; the step's level as the device plays it) */
  fromSteps(
    steps: RollStep[],
    len: number,
    div: number,
    ppq: number = SMF.PPQ,
  ): SmfNote[] {
    const tk = SMF.stepTicks(div, ppq),
      V = [0, 42, 72, 127],
      out: SmfNote[] = []
    for (const c of ROLL.chords(steps, len)) {
      const s = steps[c.at]!,
        base = s.flags & 1 ? 127 : s.vel || 96
      c.notes.forEach((key, i) => {
        const lv = (s.lvl! >> (2 * i)) & 3
        out.push({
          t: c.at * tk,
          dur: c.dur * tk - Math.max(1, tk >> 4),
          key,
          vel: lv ? V[lv] : base,
        })
      })
    }
    return out
  },
  /* the drum track's steps -> GM notes on their lanes (a hit lasts a quarter of its step) */
  fromDrums(
    dsteps: (DrumStep | null | undefined)[],
    len: number,
    div: number,
    ppq: number = SMF.PPQ,
  ): SmfNote[] {
    const tk = SMF.stepTicks(div, ppq),
      V = [100, 42, 72, 127],
      out: SmfNote[] = []
    for (let i = 0; i < len; i++) {
      const d = dsteps[i]
      if (!d) continue
      for (let l = 0; l < 16; l++)
        if ((d.on >> l) & 1)
          out.push({
            t: i * tk,
            dur: Math.max(1, tk >> 2),
            key: DRUM_LANES[l][0],
            vel: V[d.lvl[l] & 3],
          })
    }
    return out
  },
  /* the GM drum note -> its lane (firmware drums.c LANE_OF_GM) */
  LANE_OF_GM: [
    1, 0, 7, 2, 3, 8, 9, 4, 9, 6, 9, 5, 10, 10, 11, 10, 12, 11, 12, 13, 11, 15,
    11, 13, 12, 14, 14, 14, 14, 14, 14, 14, 15, 15, 13, 13, 15, 15, 13, 13, 7,
    7, 7, 14, 14, 15, 15,
  ],
  laneOf: (key: number): number =>
    key < 35 ? 0 : key > 81 ? 13 : SMF.LANE_OF_GM[key - 35],
  levelOf: (vel: number): number =>
    vel < 56
      ? 1
      : vel < 88
        ? 2
        : vel < 116
          ? 0
          : 3 /* (drums.c vel_lvl: GHOST, SOFT, NORM, HARD) */,
  /* notes -> the steps of a track at DIV div, at most nstep. The report says what changed on the way:
     {notes, steps, moved (off the grid by more than a quarter step), chordCut (notes over 4 on a step),
      overlap (a chord cut short by the next one), dropped (past the last step), merged (on the same step)} */
  toSteps(
    notes: SmfNote[],
    ppq: number,
    div: number,
    nstep: number,
    drum = false,
  ):
    | { dsteps: DrumStep[]; len: number; report: SmfReport; steps?: undefined }
    | {
        steps: MockStep[]
        len: number
        report: SmfReport
        dsteps?: undefined
      } {
    const tk = (ppq * 4) / (ROLL.DIV_PER_BAR[div] ?? 16)
    const rep = {
      notes: notes.length,
      steps: 0,
      moved: 0,
      chordCut: 0,
      overlap: 0,
      dropped: 0,
      merged: 0,
    }
    const at = new Map<number, (SmfNote & { end: number })[]>()
    for (const n of notes) {
      const pos = n.t / tk,
        i = Math.round(pos)
      if (Math.abs(pos - i) > 0.25) rep.moved++
      if (i >= nstep) {
        rep.dropped++
        continue
      }
      if (!at.has(i)) at.set(i, [])
      at.get(i)!.push({
        ...n,
        end: Math.max(i + 1, Math.round((n.t + n.dur) / tk)),
      })
    }
    if (drum) {
      const ds = Array.from({ length: nstep }, emptyDrum)
      let last = -1
      for (const [i, list] of at) {
        for (const n of list) {
          const l = SMF.laneOf(n.key)
          if ((ds[i].on >> l) & 1) {
            rep.merged++
            continue
          }
          ds[i].on |= 1 << l
          ds[i].lvl[l] = SMF.levelOf(n.vel)
        }
        last = Math.max(last, i)
      }
      rep.steps = last + 1
      return { dsteps: ds, len: Math.max(1, last + 1), report: rep }
    }
    const steps = Array.from({ length: nstep }, ROLL.rest)
    const starts = [...at.keys()].sort((a, b) => a - b)
    let last = -1
    starts.forEach((i, k) => {
      let list = at.get(i)!
      const keys = new Set<number>()
      list = list.filter((n) =>
        keys.has(n.key) ? (rep.merged++, false) : !!keys.add(n.key),
      )
      if (list.length > 4) {
        rep.chordCut += list.length - 4
        list = list
          .slice()
          .sort((a, b) => b.vel - a.vel)
          .slice(0, 4)
      }
      list.sort((a, b) => a.key - b.key)
      const vel = Math.max(...list.map((n) => n.vel))
      let end = Math.min(nstep, Math.max(...list.map((n) => n.end)))
      const next = k + 1 < starts.length ? starts[k + 1] : nstep
      if (end > next) {
        rep.overlap++
        end = next
      }
      steps[i] = {
        n: list.length,
        notes: list
          .map((n) => n.key)
          .concat([0, 0, 0, 0])
          .slice(0, 4),
        time: 0,
        flags: 0,
        vel,
        lvl: 0,
        rat: 0,
      }
      for (let j = i + 1; j < end; j++) steps[j] = ROLL.tie()
      last = Math.max(last, end - 1)
    })
    rep.steps = last + 1
    return { steps, len: Math.max(1, last + 1), report: rep }
  },
}

/* ------------------------------------------- SLOOP 2.5: the song order --- */
/* The song order lives in the settings object (backup object 1, firmware project.c persist_t): bytes 48..83
   are arranger.h arr_config_t: count, loop, 2 reserved, then 16 x {scene 0..3 = A..D, bars 1..64}. */
/** the song order (ARR): entries {scene 0..3, bars}, the loop region {first, end} */
export interface ArrEntry {
  scene: number
  bars: number
}
export interface ArrRegion {
  first: number
  end: number
}
export interface ArrSong {
  loop: boolean
  entries: ArrEntry[]
  region?: ArrRegion | null
}
export interface ArrRow extends ArrEntry {
  times: number
}
const ARR = {
  OFF: 48,
  STEPS: 16,
  SIZE: 36,
  MAX_BARS: 64,
  MAGIC: 0x50455233,
  ok: (b: ArrayLike<number> | null | undefined): boolean =>
    !!b &&
    b.length >= ARR.OFF + ARR.SIZE &&
    (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0 === ARR.MAGIC,
  decode(b: ArrayLike<number>): ArrSong & { region: ArrRegion | null } {
    const count = b[ARR.OFF],
      loop = b[ARR.OFF + 1],
      entries: ArrEntry[] = []
    for (let i = 0; i < Math.min(count, ARR.STEPS); i++)
      entries.push({
        scene: b[ARR.OFF + 4 + 2 * i],
        bars: b[ARR.OFF + 5 + 2 * i],
      })
    const region = { first: b[ARR.OFF + 2], end: b[ARR.OFF + 3] }
    return {
      loop: loop === 1,
      entries,
      region: ARR.regionOk(region, entries.length) ? region : null,
    }
  },
  /* (BoopBox) the loop region: the song loops from entry `first` to entry `end` - 1 (arranger.h arr_loop_first / end:
     the two reserved bytes; 0, 0 = the whole song). Kept only while it fits the entries */
  regionOk: (r: ArrRegion | null | undefined, count: number): r is ArrRegion =>
    !!r && r.end > 0 && r.first < r.end && r.end <= count,
  /* the settings bytes with this song order (the rest kept as it was) */
  encode(b: ArrayLike<number>, song: ArrSong): Uint8Array {
    const o = Uint8Array.from(b),
      e = song.entries,
      r = ARR.regionOk(song.region, e.length) ? song.region : null
    o[ARR.OFF] = e.length
    o[ARR.OFF + 1] = song.loop ? 1 : 0
    o[ARR.OFF + 2] = r ? r.first : 0
    o[ARR.OFF + 3] = r ? r.end : 0
    for (let i = 0; i < ARR.STEPS; i++) {
      o[ARR.OFF + 4 + 2 * i] = i < e.length ? e[i].scene : i % 4
      o[ARR.OFF + 5 + 2 * i] = i < e.length ? e[i].bars : 4
    }
    return o
  },
  /* arranger.h arr_valid: 1..16 entries, sections A..D, 1..64 bars */
  valid: (song: Pick<ArrSong, 'entries'>): boolean =>
    song.entries.length >= 1 &&
    song.entries.length <= ARR.STEPS &&
    song.entries.every(
      (e) =>
        e.scene >= 0 && e.scene < 4 && e.bars >= 1 && e.bars <= ARR.MAX_BARS,
    ),
  /* entries -> rows {scene, bars, times}: the same section with the same bars in a row is one row played `times` */
  group(entries: ArrEntry[]): ArrRow[] {
    const rows: ArrRow[] = []
    for (const e of entries) {
      const r = rows[rows.length - 1]
      if (r && r.scene === e.scene && r.bars === e.bars) r.times++
      else rows.push({ scene: e.scene, bars: e.bars, times: 1 })
    }
    return rows
  },
  expand: (rows: ArrRow[]): ArrEntry[] =>
    rows.flatMap((r) =>
      Array.from({ length: Math.max(1, r.times | 0) }, () => ({
        scene: r.scene,
        bars: r.bars,
      })),
    ),
}

/* ------------------------------------- BoopBox: a project, format 7 ("FUN7") --- */
/* The working project (backup object 0) and the song sections (2..5) as the firmware keeps them (firmware project.c
   proj7_put / proj7_apply, patcodec.c pat_put / pat_get, patbank.c): a 12-byte header (magic, size, FNV-1a of the size's
   4 bytes and the data), then chunks: a tag, a length (2 bytes, low first), its bytes. 'G' the globals, 'S' the selected
   track, 'T' a track (its sound, the pattern playing, which one that is, the chain, FOLLOW), 'H' the chord progression
   (only when not one chord of I for 4 bars), 'P' a stored pattern (track << 4 | pattern, its LEN, its bytes). The editor
   decodes a project to that model, changes the patterns, the chains, the step components and the progression, and
   encodes it the way the firmware does: decode then encode gives the same bytes, and the firmware captures a project
   the editor wrote as the same bytes again (tests/proj7_tool.c, web/test_web.mjs). A value is one byte (-127..127) or
   0x80 and two (pw_v). Every value is put in range by the firmware when it loads. */
/** PROJ7: a synth step / a drum step (10 bytes) */
export interface P7Step {
  notes: number[]
  n: number
  time: number
  flags: number
  vel: number
  lvl: number
  rat: number
}
export interface P7DrumStep {
  on: number[]
  lvl: number[]
  rat: number[]
}
export type P7AnyStep = P7Step | P7DrumStep
export interface P7Lock {
  step: number
  slide: boolean
  code: number
  val: number
}
/** a step component (comp.c): its type (PROJ7.CP), a and b */
export interface P7Comp {
  step: number
  type: number
  a: number
  b: number
}
export interface P7Pat {
  steps: P7AnyStep[]
  micro: number[]
  fill: number[]
  locks: P7Lock[]
  dir: number
  seed: number
  comps: P7Comp[]
}
/** a track ('T'): its common parameters [id, value] (only those not at their default), its engine's [k, value] */
export interface P7Track {
  i: number
  kind: number
  eng: number
  pre: number
  nc: number
  p: [number, number][]
  e: [number, number][]
  dtw: number[] | null
  pat: P7Pat
  cur: number
  chain: number[]
  coff: number
  hfol: number
  tail: number
}
export interface P7Harm {
  deg: number
  bars: number
}
export interface P7BankEntry {
  trk: number
  pat: number
  len: number
  p: P7Pat
}
export interface P7Scenes {
  names: number[]
  pats: number[][]
}
/** a decoded project (PROJ7.decode / encode) */
export interface Proj7 {
  g: number[] | null
  sel: number
  tracks: P7Track[]
  harm: P7Harm[] | null
  bank: P7BankEntry[]
  scenes: P7Scenes | null
  other: [number | string, number[]][]
}
/** a pattern's LEN: ctx.len its id, ctx.def(id) its default */
export interface P7LenCtx {
  len: number
  def: (id: number) => number
}
export interface P7Reader {
  b: ArrayLike<number>
  i: number
  n: number
  bad: boolean
  u8(): number
  v(): number
}
export interface P7Writer {
  o: number[]
  u8(x: number): void
  v(x: number): void
}
const PROJ7 = {
  MAGIC: 0x46554e37,
  HDR: 12,
  MAX: 3840,
  NSTEP: 64,
  NPAT: 8,
  NCOMP: 16,
  NLOCK: 32,
  NHPROG: 8,
  PB_SIZE: 3072,
  NCHAIN: 16,
  NSCENE: 8,
  SCN_KEEP: 8,
  SCN_NAMES: [
    '-',
    'INTRO',
    'VERSE',
    'PRE',
    'CHORUS',
    'BRIDGE',
    'BREAK',
    'BUILD',
    'DROP',
    'OUTRO',
    'FILL',
    'HOOK',
    'SOLO',
    'ALT',
    'A',
    'B',
    'C',
    'D',
    'END',
  ] /* (patbank.c N_SCN) */,
  SYNTH: 0,
  DRUM: 1,
  ST_REST: 2,
  CP_PARAM: 12,
  /* comp.c CP_NAME / CP_RANGE: a's range, b's range, a new one's a and b (PARAM's a: a lockable parameter) */
  CP: [
    null,
    ['PULSE', 1, 8, 0, 0, 1, 0],
    ['HOLD', 1, 16, 0, 0, 1, 0],
    ['MULT', 2, 8, 0, 0, 2, 0],
    ['VEL', 1, 127, 0, 64, 100, 0],
    ['RAMP+', 1, 16, 1, 7, 3, 1],
    ['RAMP-', 1, 16, 1, 7, 3, 1],
    ['RAND', 1, 12, 0, 0, 2, 0],
    ['PORTA', 1, 127, 0, 0, 40, 0],
    ['BEND', -12, 12, 0, 1, 2, 0],
    ['TONE', -24, 24, 0, 0, 12, 0],
    ['JUMP', 1, 64, 1, 16, 1, 1],
    ['PARAM', 0, 70, 1, 100, 5, 25],
    ['COND', -8, 8, 1, 8, 1, 2],
    ['TRIG', 1, 99, 0, 0, 50, 0],
  ] as (
    | [
        name: string,
        aMin: number,
        aMax: number,
        bMin: number,
        bMax: number,
        aNew: number,
        bNew: number,
      ]
    | null
  )[],
  DIRS: ['FWD', 'REV', 'PEND', 'RAND'],
  HFOL: ['OFF', 'TRANS', 'SCALE'],
  ROMAN: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  u32: (b: ArrayLike<number>, o: number) =>
    (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0,
  sum(b: ArrayLike<number>, size: number) {
    /* project.c proj7_sum */
    let s = 0x811c9dc5
    for (let i = 0; i < 4; i++)
      s = Math.imul(s ^ ((size >>> (8 * i)) & 0xff), 16777619) >>> 0
    for (let i = PROJ7.HDR; i < size; i++)
      s = Math.imul(s ^ b[i], 16777619) >>> 0
    return s >>> 0
  },
  /* a reader never past its end (patcodec.c pr_t): bad once it tried */
  reader: (b: ArrayLike<number>, i = 0, n = b.length): P7Reader => ({
    b,
    i,
    n,
    bad: false,
    u8() {
      if (this.i >= this.n) {
        this.bad = true
        return 0
      }
      return this.b[this.i++]
    },
    v() {
      const x = this.u8()
      if (x !== 0x80) return (x << 24) >> 24
      const lo = this.u8(),
        hi = this.u8()
      return ((lo | (hi << 8)) << 16) >> 16
    },
  }),
  writer: (): P7Writer => ({
    o: [],
    u8(x): void {
      this.o.push(x & 0xff)
    },
    v(x): void {
      if (x >= -127 && x <= 127) this.u8(x)
      else {
        this.u8(0x80)
        this.u8(x)
        this.u8(x >> 8)
      }
    },
  }),
  /* ---- a step (10 bytes, core.h step_t / dstep_t) */
  blank: (drum: boolean | number): P7AnyStep =>
    drum
      ? { on: [0, 0], lvl: [0, 0, 0, 0], rat: [0, 0, 0, 0] }
      : {
          notes: [0, 0, 0, 0],
          n: 0,
          time: 2,
          flags: 0,
          vel: 0,
          lvl: 0,
          rat: 0,
        },
  stepBytes: (s: P7AnyStep, drum: boolean | number): number[] =>
    drum
      ? [
          ...(s as P7DrumStep).on,
          ...(s as P7DrumStep).lvl,
          ...(s as P7DrumStep).rat,
        ]
      : [
          ...(s as P7Step).notes,
          (s as P7Step).n,
          (s as P7Step).time,
          (s as P7Step).flags,
          (s as P7Step).vel,
          (s as P7Step).lvl,
          (s as P7Step).rat,
        ],
  fromBytes(b: ArrayLike<number>, drum: boolean | number): P7AnyStep {
    if (drum)
      return {
        on: [b[0], b[1]],
        lvl: [b[2], b[3], b[4], b[5]],
        rat: [b[6], b[7], b[8], b[9]],
      }
    return {
      notes: [b[0] & 127, b[1] & 127, b[2] & 127, b[3] & 127],
      n: Math.min(b[4], 4),
      time: Math.min(b[5], 2),
      flags: b[6],
      vel: b[7],
      lvl: b[8],
      rat: b[9],
    }
  },
  isBlank: (s: P7AnyStep, drum: boolean | number): boolean =>
    PROJ7.stepBytes(s, drum).every(
      (x, i) => x === (!drum && i === 5 ? PROJ7.ST_REST : 0),
    ) /* patcodec.c step_blank */,
  stepSize(st: P7AnyStep, drum: boolean | number): number {
    /* patcodec.c step_size */
    if (drum) {
      const d = st as P7DrumStep
      return 3 + (d.lvl.some(Boolean) ? 4 : 0) + (d.rat.some(Boolean) ? 4 : 0)
    }
    const s = st as P7Step
    const n = Math.min(s.n, 4)
    let all4 = s.n > 4
    for (let j = n; j < 4; j++) all4 = all4 || s.notes[j] !== 0
    return (
      1 +
      (all4 || s.lvl || s.rat ? 1 : 0) +
      (all4 ? 4 : n) +
      +!!s.flags +
      +!!s.vel +
      +!!s.lvl +
      +!!s.rat
    )
  },
  stepPut(w: P7Writer, st: P7AnyStep, drum: boolean | number): void {
    /* patcodec.c step_put */
    if (drum) {
      const d = st as P7DrumStep,
        l = d.lvl.some(Boolean),
        r = d.rat.some(Boolean)
      w.u8(d.on[0])
      w.u8(d.on[1])
      w.u8((l ? 1 : 0) | (r ? 2 : 0))
      if (l) d.lvl.forEach((x) => w.u8(x))
      if (r) d.rat.forEach((x) => w.u8(x))
      return
    }
    const s = st as P7Step
    const n = Math.min(s.n, 4)
    let all4 = s.n > 4
    for (let j = n; j < 4; j++) all4 = all4 || s.notes[j] !== 0
    const x = all4 || !!s.lvl || !!s.rat
    w.u8(
      (s.n & 7) |
        ((s.time & 3) << 3) |
        (s.flags ? 0x20 : 0) |
        (s.vel ? 0x40 : 0) |
        (x ? 0x80 : 0),
    )
    if (x) w.u8((s.lvl ? 1 : 0) | (s.rat ? 2 : 0) | (all4 ? 4 : 0))
    for (let j = 0; j < (all4 ? 4 : n); j++) w.u8(s.notes[j])
    if (s.flags) w.u8(s.flags)
    if (s.vel) w.u8(s.vel)
    if (s.lvl) w.u8(s.lvl)
    if (s.rat) w.u8(s.rat)
  },
  stepGet(r: P7Reader, drum: boolean | number): P7AnyStep {
    /* patcodec.c step_get */
    if (drum) {
      const s = PROJ7.blank(true) as P7DrumStep
      s.on = [r.u8(), r.u8()]
      const m = r.u8()
      if (m & 1) s.lvl = [r.u8(), r.u8(), r.u8(), r.u8()]
      if (m & 2) s.rat = [r.u8(), r.u8(), r.u8(), r.u8()]
      return s
    }
    const b = r.u8(),
      x = b >> 7 ? r.u8() : 0,
      n = b & 7,
      s: P7Step = {
        notes: [0, 0, 0, 0],
        n: Math.min(n, 4),
        time: Math.min((b >> 3) & 3, 2),
        flags: 0,
        vel: 0,
        lvl: 0,
        rat: 0,
      }
    for (let j = 0; j < (x & 4 ? 4 : Math.min(n, 4)); j++)
      s.notes[j] = r.u8() & 127
    if (b & 0x20) s.flags = r.u8()
    if (b & 0x40) s.vel = r.u8()
    if (x & 1) s.lvl = r.u8()
    if (x & 2) s.rat = r.u8()
    return s
  },
  /* ---- a pattern: its steps, each step's nudge and fill condition, its locks, its components, direction and seed */
  emptyPat: (drum: boolean | number): P7Pat => ({
    steps: Array.from({ length: 64 }, () => PROJ7.blank(drum)),
    micro: new Array(64).fill(0),
    fill: new Array(64).fill(0),
    locks: [],
    dir: 0,
    seed: 0,
    comps: [],
  }),
  patIsEmpty: (p: P7Pat, drum: boolean | number): boolean =>
    !p.comps.length &&
    !p.dir &&
    !p.seed &&
    !p.locks.length &&
    p.micro.every((x) => !x) &&
    p.fill.every((x) => !x) &&
    p.steps.every((s) => PROJ7.isBlank(s, drum)),
  patClone: (p: P7Pat): P7Pat => JSON.parse(JSON.stringify(p)),
  patGet(r: P7Reader, drum: boolean | number): P7Pat {
    /* patcodec.c pat_get (the values as written: the firmware clamps them) */
    const p = PROJ7.emptyPat(drum)
    let m = r.u8()
    if (m === 1) {
      for (let k = 0; k < 64; k++) {
        const b: number[] = []
        for (let j = 0; j < 10; j++) b.push(r.u8())
        p.steps[k] = PROJ7.fromBytes(b, drum)
      }
    } else {
      const map: number[] = []
      for (let k = 0; k < 8; k++) map.push(r.u8())
      for (let k = 0; k < 64 && !r.bad; k++)
        if ((map[k >> 3] >> (k & 7)) & 1) p.steps[k] = PROJ7.stepGet(r, drum)
    }
    m = r.u8()
    if (m) {
      let map: number[] = new Array(8).fill(0xff)
      if (m === 1) map = map.map(() => r.u8())
      for (let k = 0; k < 64 && !r.bad; k++)
        if ((map[k >> 3] >> (k & 7)) & 1) {
          const v = r.u8(),
            mi = v & 63,
            c = v >> 6
          p.micro[k] = mi >= 32 ? mi - 64 : mi
          p.fill[k] = c === 3 ? 0 : c
        }
    }
    const nl = r.u8()
    for (let k = 0; k < nl && !r.bad; k++) {
      const st = r.u8(),
        code = r.u8(),
        val = r.v()
      p.locks.push({ step: st & 0x7f, slide: !!(st & 0x80), code, val })
    }
    if (r.i + 3 > r.n || r.bad)
      return p /* (written before the components: none) */
    p.dir = r.u8()
    p.seed = r.u8()
    const nc = r.u8()
    for (let k = 0; k < nc && !r.bad; k++) {
      const step = r.u8(),
        ty = r.u8(),
        a = r.u8(),
        b = r.u8()
      p.comps.push({
        step,
        type: ty & 0x7f,
        a: ty === (PROJ7.CP_PARAM | 0x80) ? a : (a << 24) >> 24,
        b: (b << 24) >> 24,
      })
    }
    return p
  },
  patPut(w: P7Writer, p: P7Pat, drum: boolean | number): void {
    /* patcodec.c pat_put */
    const map: number[] = new Array(8).fill(0)
    let sz = 8
    p.steps.forEach((s, k) => {
      if (!PROJ7.isBlank(s, drum)) {
        map[k >> 3] |= 1 << (k & 7)
        sz += PROJ7.stepSize(s, drum)
      }
    })
    if (sz < 640) {
      w.u8(0)
      map.forEach((x) => w.u8(x))
      p.steps.forEach((s, k) => {
        if ((map[k >> 3] >> (k & 7)) & 1) PROJ7.stepPut(w, s, drum)
      })
    } else {
      w.u8(1)
      p.steps.forEach((s) => PROJ7.stepBytes(s, drum).forEach((x) => w.u8(x)))
    }
    const mf = p.micro.map((m, k) => (m & 63) | ((p.fill[k] & 3) << 6)),
      mm: number[] = new Array(8).fill(0)
    let n = 0
    mf.forEach((v, k) => {
      if (v) {
        mm[k >> 3] |= 1 << (k & 7)
        n++
      }
    })
    if (!n) w.u8(0)
    else if (8 + n < 64) {
      w.u8(1)
      mm.forEach((x) => w.u8(x))
      mf.forEach((v) => {
        if (v) w.u8(v)
      })
    } else {
      w.u8(2)
      mf.forEach((v) => w.u8(v))
    }
    w.u8(p.locks.length)
    for (const l of p.locks) {
      w.u8(l.step | (l.slide ? 0x80 : 0))
      w.u8(l.code)
      w.v(l.val)
    }
    w.u8(p.dir)
    w.u8(p.seed)
    w.u8(p.comps.length)
    for (const c of p.comps) {
      w.u8(c.step)
      w.u8(c.type === PROJ7.CP_PARAM ? PROJ7.CP_PARAM | 0x80 : c.type)
      w.u8(c.a)
      w.u8(c.b)
    }
  },
  patBytes(p: P7Pat, drum: boolean | number): number[] {
    const w = PROJ7.writer()
    PROJ7.patPut(w, p, drum)
    return w.o
  },
  /* a lock's or PARAM's parameter code (patcodec.c lock_code: the engine's eight as 0xF0 + k, P_E0 moves) <-> its id */
  codeOf: (id: number, pe0: number) => (id < pe0 ? id : 0xf0 + id - pe0),
  idOf: (code: number, pe0: number) =>
    code >= 0xf0
      ? code - 0xf0 < 8
        ? pe0 + code - 0xf0
        : -1
      : code < pe0
        ? code
        : -1,
  /* a component that the firmware keeps (comp.c comp_valid; PARAM's a: a lockable parameter's code) */
  compValid(c: P7Comp, pe0: number): boolean {
    const r = PROJ7.CP[c.type]
    if (!r || c.step >= 64) return false
    const a = c.type === PROJ7.CP_PARAM ? PROJ7.idOf(c.a, pe0) : c.a
    if (a < r[1] || a > r[2] || c.b < r[3] || c.b > r[4]) return false
    if (c.type === 13 && !c.a) return false
    return c.type !== PROJ7.CP_PARAM || lockable(a, pe0)
  },
  /* ---- a track ('T') */
  trkGet(r: P7Reader): P7Track {
    const t: Omit<P7Track, 'pat'> & { pat: P7Pat | null } = {
      i: r.u8(),
      kind: r.u8(),
      eng: r.u8(),
      pre: r.u8(),
      nc: r.u8(),
      p: [],
      e: [],
      dtw: null,
      pat: null,
      cur: 0,
      chain: [],
      coff: 0,
      hfol: 0,
      tail: 0,
    }
    const map: number[] = []
    for (let k = 0; k < (t.nc + 7) >> 3; k++) map.push(r.u8())
    for (let k = 0; k < t.nc; k++)
      if ((map[k >> 3] >> (k & 7)) & 1) t.p.push([k, r.v()])
    const em = r.u8()
    for (let k = 0; k < 8; k++) if ((em >> k) & 1) t.e.push([k, r.v()])
    if (t.kind === PROJ7.DRUM) {
      t.dtw = []
      for (let k = 0; k < 16; k++) t.dtw.push(r.u8())
    }
    t.pat = PROJ7.patGet(r, t.kind === PROJ7.DRUM)
    if (r.i < r.n && !r.bad) {
      t.tail = 1
      t.cur = r.u8() % 8
      const n =
        r.u8() /* (its slots, bit 7: PLAY off; a slot: pattern | repeats - 1 << 4) */
      t.coff = n >> 7
      for (let k = 0; k < (n & 0x7f); k++) {
        const x = r.u8()
        if (k < PROJ7.NCHAIN) t.chain.push(x & 0xf7)
      }
      if (r.i < r.n) {
        t.tail = 2
        t.hfol = r.u8()
      }
    }
    return t as P7Track
  },
  trkPut(w: P7Writer, t: P7Track): void {
    w.u8(t.i)
    w.u8(t.kind)
    w.u8(t.eng)
    w.u8(t.pre)
    w.u8(t.nc)
    const map: number[] = new Array((t.nc + 7) >> 3).fill(0)
    t.p.forEach(([k]) => {
      map[k >> 3] |= 1 << (k & 7)
    })
    map.forEach((x) => w.u8(x))
    ;[...t.p].sort((x, y) => x[0] - y[0]).forEach(([, v]) => w.v(v))
    let em = 0
    t.e.forEach(([k]) => {
      em |= 1 << k
    })
    w.u8(em)
    ;[...t.e].sort((x, y) => x[0] - y[0]).forEach(([, v]) => w.v(v))
    if (t.kind === PROJ7.DRUM)
      (t.dtw || new Array(16).fill(0)).forEach((x) => w.u8(x))
    PROJ7.patPut(w, t.pat, t.kind === PROJ7.DRUM)
    if (t.tail >= 1) {
      w.u8(t.cur)
      w.u8(t.chain.length | (t.coff ? 0x80 : 0))
      t.chain.forEach((x) => w.u8(x))
    }
    if (t.tail >= 2) w.u8(t.hfol)
  },
  /* a common parameter of the track (id < its count): stored only when not its default (def(id) from DESC) */
  param(t: Pick<P7Track, 'p'>, id: number, def: number) {
    const x = t.p.find(([k]) => k === id)
    return x ? x[1] : def
  },
  setParam(t: Pick<P7Track, 'p'>, id: number, v: number, def: number): void {
    t.p = t.p.filter(([k]) => k !== id)
    if (v !== def) t.p.push([id, v])
  },
  /* ---- the whole project */
  decode(bytes: ArrayLike<number>): Proj7 | null {
    const b = Uint8Array.from(bytes)
    if (b.length < PROJ7.HDR || PROJ7.u32(b, 0) !== PROJ7.MAGIC) return null
    const size = PROJ7.u32(b, 4)
    if (
      size < PROJ7.HDR ||
      size > PROJ7.MAX ||
      size > b.length ||
      PROJ7.u32(b, 8) !== PROJ7.sum(b, size)
    )
      return null
    const P: Proj7 = {
        g: null,
        sel: 0,
        tracks: [],
        harm: null,
        bank: [],
        scenes: null,
        other: [],
      },
      pend: Uint8Array[] = []
    const r = PROJ7.reader(b, PROJ7.HDR, size)
    while (r.i + 3 <= r.n && !r.bad) {
      const tag = r.u8(),
        len = r.u8() | (r.u8() << 8)
      if (len > r.n - r.i)
        return null /* (cut short: the editor changes no project it cannot read whole) */
      const body = b.subarray(r.i, r.i + len)
      r.i += len
      const c = PROJ7.reader(body)
      const ch = String.fromCharCode(tag)
      if (ch === 'G') P.g = Array.from(body)
      else if (ch === 'S') P.sel = body[0] | 0
      else if (ch === 'T') {
        const t = PROJ7.trkGet(c)
        if (c.bad || c.i !== c.n) return null
        P.tracks.push(t)
      } else if (ch === 'H') {
        const n = c.u8()
        P.harm = []
        for (let k = 0; k < n; k++) P.harm.push({ deg: c.u8(), bars: c.u8() })
        if (c.bad) return null
      } else if (ch === 'P') pend.push(body)
      else if (ch === 'C') {
        /* the scenes: count, then each its name and 4 bytes of nibbles */
        const n = c.u8(),
          S = PROJ7.scenesDefault()
        for (let k = 0; k < n && k < PROJ7.NSCENE; k++) {
          const nm = c.u8()
          S.names[k] = nm < PROJ7.SCN_NAMES.length ? nm : 0
          for (let j = 0; j < 8; j += 2) {
            const x = c.u8()
            S.pats[k][j] = Math.min(x & 15, 8)
            S.pats[k][j + 1] = Math.min(x >> 4, 8)
          }
        }
        if (c.bad || n !== PROJ7.NSCENE || c.i !== c.n) return null
        P.scenes = S
      } else P.other.push([tag, Array.from(body)])
    }
    for (const body of pend) {
      /* (decoded with the kind of their track: the 'T' chunks come first) */
      const t = P.tracks.find((x) => x.i === body[0] >> 4)
      if (!t || body.length < 2) return null
      const c = PROJ7.reader(body, 2)
      const pat = PROJ7.patGet(c, t.kind === PROJ7.DRUM)
      if (c.bad || c.i !== c.n) return null
      P.bank.push({
        trk: body[0] >> 4,
        pat: body[0] & 15,
        len: body[1],
        p: pat,
      })
    }
    return P
  },
  /* the chunks in the firmware's order (G, S, the tracks, H when not the default, the bank): the same bytes as it writes */
  encodeBody(P: Proj7): number[] {
    const w = PROJ7.writer(),
      chunk = (tag: string | number, f: () => void): void => {
        w.u8(typeof tag === 'string' ? tag.charCodeAt(0) : tag)
        const at = w.o.length
        w.u8(0)
        w.u8(0)
        f()
        const len = w.o.length - at - 2
        w.o[at] = len & 0xff
        w.o[at + 1] = len >> 8
      }
    if (P.g) chunk('G', () => P.g!.forEach((x) => w.u8(x)))
    chunk('S', () => w.u8(P.sel))
    for (const t of P.tracks) chunk('T', () => PROJ7.trkPut(w, t))
    if (P.harm && !PROJ7.harmDefault(P.harm))
      chunk('H', () => {
        w.u8(P.harm!.length)
        P.harm!.forEach((c) => {
          w.u8(c.deg)
          w.u8(c.bars)
        })
      })
    for (const e of P.bank) {
      const t = P.tracks.find((x) => x.i === e.trk)
      chunk('P', () => {
        w.u8((e.trk << 4) | e.pat)
        w.u8(e.len)
        PROJ7.patPut(w, e.p, !!t && t.kind === PROJ7.DRUM)
      })
    }
    if (P.scenes && !PROJ7.scenesIsDefault(P.scenes))
      chunk('C', () => {
        w.u8(PROJ7.NSCENE)
        for (let k = 0; k < PROJ7.NSCENE; k++) {
          w.u8(P.scenes!.names[k])
          for (let j = 0; j < 8; j += 2)
            w.u8(P.scenes!.pats[k][j] | (P.scenes!.pats[k][j + 1] << 4))
        }
      })
    for (const [tag, body] of P.other)
      chunk(tag, () => body.forEach((x) => w.u8(x)))
    return w.o
  },
  encode(P: Proj7): Uint8Array {
    const body = PROJ7.encodeBody(P),
      size = PROJ7.HDR + body.length,
      b = new Uint8Array(size)
    b.set(body, PROJ7.HDR)
    const le = (o: number, v: number): void => {
      b[o] = v & 0xff
      b[o + 1] = (v >>> 8) & 0xff
      b[o + 2] = (v >>> 16) & 0xff
      b[o + 3] = (v >>> 24) & 0xff
    }
    le(0, PROJ7.MAGIC)
    le(4, size)
    le(8, PROJ7.sum(b, size))
    return b
  },
  /* the bytes the bank holds (patbank.c: 4 + a pattern's bytes an entry, PB_SIZE at most) and the project's size */
  bankBytes: (P: Proj7): number =>
    P.bank.reduce(
      (s, e) =>
        s +
        4 +
        PROJ7.patBytes(
          e.p,
          (P.tracks.find((x) => x.i === e.trk) || ({} as Partial<P7Track>))
            .kind === PROJ7.DRUM,
        ).length,
      0,
    ),
  fits: (P: Proj7): boolean =>
    PROJ7.bankBytes(P) <= PROJ7.PB_SIZE &&
    PROJ7.HDR + PROJ7.encodeBody(P).length <= PROJ7.MAX,
  harmDefault: (h: P7Harm[] | null | undefined) =>
    !h || (h.length === 1 && h[0].deg === 0 && h[0].bars === 4),
  /* ---- the patterns of a track: n 0..7 -> its pattern (the one playing is the track's own), null: empty */
  track: (P: Proj7, i: number): P7Track | null =>
    P.tracks.find((x) => x.i === i) || null,
  patOf(P: Proj7, i: number, n: number): P7Pat | null {
    const t = PROJ7.track(P, i)
    if (!t) return null
    if (n === t.cur) return t.pat
    const e = P.bank.find((x) => x.trk === i && x.pat === n)
    return e ? e.p : null
  },
  /* the LEN a pattern has (the one playing: the track's P_SLEN, ctx.len its id, ctx.def(id) its default) */
  lenOf(P: Proj7, i: number, n: number, ctx: P7LenCtx): number {
    const t = PROJ7.track(P, i)!
    if (n === t.cur) return PROJ7.param(t, ctx.len, ctx.def(ctx.len))
    const e = P.bank.find((x) => x.trk === i && x.pat === n)
    return e ? e.len : PROJ7.param(t, ctx.len, ctx.def(ctx.len))
  },
  /* pattern n of track i becomes p (null or empty: none) with that LEN; the one playing stays the track's own */
  setPat(
    P: Proj7,
    i: number,
    n: number,
    p: P7Pat | null | undefined,
    len: number,
    ctx: P7LenCtx,
  ): void {
    const t = PROJ7.track(P, i)!,
      drum = t.kind === PROJ7.DRUM
    if (n === t.cur) {
      t.pat = p ? PROJ7.patClone(p) : PROJ7.emptyPat(drum)
      if (len) PROJ7.setParam(t, ctx.len, len, ctx.def(ctx.len))
      return
    }
    P.bank = P.bank.filter((x) => !(x.trk === i && x.pat === n))
    if (p && !PROJ7.patIsEmpty(p, drum))
      P.bank.push({
        trk: i,
        pat: n,
        len: Math.max(1, Math.min(64, len | 0)),
        p: PROJ7.patClone(p),
      })
  },
  /* track i plays pattern n now (stopped, as patbank.c pat_swap: the one playing into the bank, n out of it, with its LEN) */
  play(P: Proj7, i: number, n: number, ctx: P7LenCtx): void {
    const t = PROJ7.track(P, i)
    if (!t || n === t.cur) return
    const was = t.cur,
      wp = t.pat,
      wl = PROJ7.lenOf(P, i, was, ctx),
      np = PROJ7.patOf(P, i, n),
      nl = PROJ7.lenOf(P, i, n, ctx)
    P.bank = P.bank.filter((x) => !(x.trk === i && x.pat === n))
    t.cur = n
    t.pat = np ? PROJ7.patClone(np) : PROJ7.emptyPat(t.kind === PROJ7.DRUM)
    PROJ7.setParam(t, ctx.len, nl, ctx.def(ctx.len))
    PROJ7.setPat(P, i, was, wp, wl, ctx)
    if (t.tail < 1) t.tail = 1
  },
  /* a chain: up to 16 slots, each a pattern and its repeats (slot(p, r): p | r - 1 << 4); it plays with 2 or more, PLAY on */
  slot: (p: number, r = 1) =>
    (p & 7) | ((Math.max(1, Math.min(16, r)) - 1) << 4),
  slotPat: (x: number) => x & 7,
  slotRep: (x: number) => (x >> 4) + 1,
  setChain(P: Proj7, i: number, list: number[]): void {
    const t = PROJ7.track(P, i)!
    t.chain = list.slice(0, PROJ7.NCHAIN).map((x) => x & 0xf7)
    if (t.tail < 1) t.tail = 1
  },
  /* scenes: names (SCN_NAMES index), each track's pattern (0..7, SCN_KEEP: unchanged); by default scene k is pattern k */
  scenesDefault: (): P7Scenes => ({
    names: new Array(8).fill(0),
    pats: Array.from({ length: 8 }, (_, k) => new Array(8).fill(k)),
  }),
  scenesIsDefault: (S: P7Scenes) =>
    S.names.every((x) => !x) && S.pats.every((r, k) => r.every((x) => x === k)),
}

/* ------------------------------------- v10 (SLOOP 2.5): the SYN drum kits --- */
/* A synthesised drum sound is the firmware's dsnd_t (drum_synth.c, tools/gen_drumkits.py), 22 bytes in this order.
   The tone (a wave with a falling pitch, a second partial), the click, the noise (white, the 808's six metallic
   squares, both, a chip LFSR; the clap's bursts), a resonant filter, drive and level. A kit: 16 of them and its
   crush (bits dropped in the low nibble, sample-and-hold - 1 in the high one). */
/** a synthesised drum sound as the page edits it (DSYN.decode) */
export interface DsynSound {
  wave: number
  noise: number
  clap: number
  pitch: number
  fine: number
  bend: number
  btime: number
  hold: number
  decay: number
  tlev: number
  t2: number
  t2lev: number
  click: number
  nlev: number
  nhold: number
  ndec: number
  fmode: number
  fall: number
  res: number
  fcut: number
  fenv: number
  hpf: number
  chip: number
  drive: number
  level: number
}
/** a SYN kit: its name, crush, source kit, 16 sounds of 22 bytes */
export interface DsynKit {
  name: string
  crush: number
  src: number
  sounds: Uint8Array[]
}
const DSYN = {
  USER: 64,
  NUSER: 4,
  LANES: 16,
  SIZE: 22,
  FIELDS: [
    'wave',
    'src',
    'pitch',
    'fine',
    'bend',
    'btime',
    'hold',
    'decay',
    'tlev',
    't2',
    't2lev',
    'click',
    'nlev',
    'nhold',
    'ndec',
    'flt',
    'fcut',
    'fenv',
    'hpf',
    'chip',
    'drive',
    'level',
  ],
  /* the synthesised lanes (DS_MAP order) and the GM note each plays without an offset (drum_synth.c DS_LANE_NOTE) */
  LANES_N: [
    'KICK',
    'SNARE',
    'CLAP',
    'HAT',
    'OPEN HAT',
    'LOW TOM',
    'HI TOM',
    'CRASH',
    'RIDE',
    'SHAKER',
    'CONGA',
    'RIM',
    'COWBELL',
    'CLAVE',
    'KICK 2',
    'SNARE 2',
  ],
  LANE_NOTE: [36, 38, 39, 42, 46, 43, 48, 49, 51, 70, 63, 37, 56, 75, 35, 40],
  WAVES: ['OFF', 'SINE', 'TRI', 'SQUARE', 'FM', 'BELL'],
  NOISES: ['OFF', 'WHITE', 'METAL', 'CYM', 'CHIP'],
  FMODES: ['OFF', 'LP', 'BP', 'HP'],
  STEPS_PER_OCT: 127 / Math.log2(16000 / 30),
  /* 22 bytes -> the values the page edits */
  decode(b: ArrayLike<number>): DsynSound {
    const g = (k: string) => b[DSYN.FIELDS.indexOf(k)] & 255
    const f = g('flt'),
      src = g('src'),
      fe = g('fenv')
    return {
      wave: g('wave'),
      noise: src & 15,
      clap: (src >> 4) & 1,
      pitch: g('pitch'),
      fine: g('fine'),
      bend: g('bend'),
      btime: g('btime'),
      hold: g('hold'),
      decay: g('decay'),
      tlev: g('tlev'),
      t2: g('t2'),
      t2lev: g('t2lev'),
      click: g('click'),
      nlev: g('nlev'),
      nhold: g('nhold'),
      ndec: g('ndec'),
      fmode: f & 3,
      fall: (f >> 2) & 1,
      res: f >> 3,
      fcut: g('fcut'),
      fenv: fe > 127 ? fe - 256 : fe,
      hpf: g('hpf'),
      chip: g('chip'),
      drive: g('drive'),
      level: g('level'),
    }
  },
  /* the values -> 22 bytes, into the ranges the firmware keeps (editor_dsyn.c dsu_fix_sound) */
  encode(o: Partial<Record<keyof DsynSound, unknown>>): Uint8Array {
    const c = (v: unknown, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, Math.round(+(v as number) || 0)))
    const v: Record<string, number> = {
      wave: c(o.wave, 0, 5),
      src: c(o.noise, 0, 4) | (o.clap ? 16 : 0),
      pitch: c(o.pitch, 0, 127),
      fine: c(o.fine, 0, 15),
      bend: c(o.bend, 0, 96),
      btime: c(o.btime, 0, 127),
      hold: c(o.hold, 0, 255),
      decay: c(o.decay, 0, 127),
      tlev: c(o.tlev, 0, 127),
      t2: c(o.t2, 0, 255),
      t2lev: c(o.t2lev, 0, 127),
      click: c(o.click, 0, 127),
      nlev: c(o.nlev, 0, 127),
      nhold: c(o.nhold, 0, 255),
      ndec: c(o.ndec, 0, 127),
      flt: c(o.fmode, 0, 3) | (o.fall ? 4 : 0) | (c(o.res, 0, 31) << 3),
      fcut: c(o.fcut, 0, 127),
      fenv: c(o.fenv, -128, 127) & 255,
      hpf: c(o.hpf, 0, 127),
      chip: c(o.chip, 0, 127),
      drive: c(o.drive, 0, 127),
      level: c(o.level, 0, 255),
    }
    return Uint8Array.from(DSYN.FIELDS.map((k) => v[k]))
  },
  /* what the numbers mean (tools/gen_tables.py, gen_drumkits.py) */
  hz: (note: number, fine = 0) => 440 * 2 ** ((note + fine / 16 - 69) / 12),
  decayMs: (i: number) => 5 * 800 ** (i / 127),
  cutHz: (i: number) => 30 * (16000 / 30) ** (i / 127),
  db: (level: number) => (level - 128) / 4,
  name8: (s: unknown) => {
    const b = new Uint8Array(8)
    String(s || '')
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 8)
      .split('')
      .forEach((ch, i) => {
        b[i] = ch.charCodeAt(0)
      })
    return b
  },
  /* a kit as a file: {format, version, name, crush, sounds: [22 numbers] x 16} */
  FORMAT: 'sloop-drumsynth',
  toFile: (k: Pick<DsynKit, 'name' | 'crush' | 'sounds'>) => ({
    format: DSYN.FORMAT,
    version: 1,
    name: k.name,
    crush: k.crush,
    sounds: k.sounds.map((x) => Array.from(x)),
  }),
  /* backup object 9: the firmware's dsu_bank_t ("DSU1", 1, 4, then per kit: name 8, crush, src, 2 reserved, 16 x 22) */
  BANK_SIZE: 8 + 4 * 364,
  bankEncode(kits: DsynKit[]): Uint8Array {
    const o = new Uint8Array(DSYN.BANK_SIZE)
    o.set([0x44, 0x53, 0x55, 0x31, 1, 0, 4, 0])
    kits.forEach((k, i) => {
      const at = 8 + i * 364
      o.set(DSYN.name8(k.name), at)
      o[at + 8] = k.crush & 255
      o[at + 9] = k.src & 255
      k.sounds.forEach((x, l) => o.set(x, at + 12 + l * DSYN.SIZE))
    })
    return o
  },
  bankDecode(b: Uint8Array | null | undefined): DsynKit[] | null {
    if (
      !b ||
      b.length !== DSYN.BANK_SIZE ||
      b[0] !== 0x44 ||
      b[1] !== 0x53 ||
      b[2] !== 0x55 ||
      b[3] !== 0x31 ||
      b[4] !== 1 ||
      b[6] !== 4
    )
      return null
    return Array.from({ length: 4 }, (_, i) => {
      const at = 8 + i * 364
      return {
        name: String.fromCharCode(...b.subarray(at, at + 8)).replace(
          /\0.*$/,
          '',
        ),
        crush: b[at + 8],
        src: b[at + 9],
        sounds: Array.from({ length: DSYN.LANES }, (_, l) =>
          b.slice(at + 12 + l * DSYN.SIZE, at + 12 + (l + 1) * DSYN.SIZE),
        ),
      }
    })
  },
  fromFile(j: any): { name: string; crush: number; sounds: Uint8Array[] } {
    if (
      !j ||
      j.format !== DSYN.FORMAT ||
      !Array.isArray(j.sounds) ||
      j.sounds.length !== DSYN.LANES ||
      j.sounds.some((x: unknown) => !Array.isArray(x) || x.length !== DSYN.SIZE)
    )
      throw new Error('not a BoopBox drum synth kit')
    return {
      name: String(j.name || 'KIT')
        .replace(/[^\x20-\x7E]/g, '')
        .slice(0, 8),
      crush: (j.crush | 0) & 255,
      sounds: j.sounds.map((x: number[]) =>
        DSYN.encode(DSYN.decode(Uint8Array.from(x, (v) => v & 255))),
      ),
    }
  },
}
/* the device's 32 synthesised kits (build/gen/felucca_drumkits.h), for the mock: per kit its crush, then 16 x 22 */
const DSYN_MOCK_NAMES = [
  '808',
  '909',
  '606',
  '80S',
  'VINTAGE',
  'TRAP',
  'DRILL',
  'BOOMBAP',
  'LO-FI',
  'PHONK',
  'HOUSE',
  'D.HOUSE',
  'TECHNO',
  'MINIMAL',
  'ELECTRO',
  'DISCO',
  'GARAGE',
  'JUNGLE',
  'DUBSTEP',
  'DEMBOW',
  'AMAPIANO',
  'AFRO',
  'LATIN',
  'TRIBAL',
  'SYNTHWV',
  'CHIP',
  'ARCADE',
  'GLITCH',
  'INDUSTR',
  'HYPER',
  'AMBIENT',
  'JAZZ',
]
const DSYN_MOCK_KITS =
  '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'

/* SET coalescing (userSet), per control key: last = when the user last changed it (touched()), sent = the value last
   requested. A value equal to the last request is skipped only while that request is still pending (queued or in
   flight): it carries it already. Once answered, the device may hold something else under the same key (another track
   or sound under the controls, a knob turned on the FM-1), so the same value is sent again (2.6: setting DIV 1/8 on
   one track, then 1/8 on another, sent nothing the second time). clear(): another track / sound / device */
class SetGate {
  m: Map<string, { last: number; sent: number | null }>
  constructor() {
    this.m = new Map()
  }
  get(k: string) {
    return this.m.get(k)
  }
  user(k: string, v: number, pending: boolean, now: number) {
    let st = this.m.get(k)
    if (!st) this.m.set(k, (st = { last: 0, sent: null }))
    st.last = now
    return !(pending && v === st.sent)
  }
  clear(): void {
    this.m.clear()
  }
}
/* SLOOP 2.7 (protocol v11): your theme, backup object 11, the bytes of gfx.c theme_t: "THM1", name[8] (ASCII, 0-padded),
   c[5] (the screen, faintest .. strongest: lines, dim, labels, secondary, values), trk[4] (the tracks' colours: 1, 2, 3,
   drums), bg (the background; 0 black), hi (the accent: what is touched, the cursor, the play head), 0, CRC-32 of the
   36 bytes before it ("THM2", 40 bytes); colours RGB565, low byte first. The first 2.7 beta's "THM1" (36 bytes, no hi,
   its CRC at 32) still decodes, with a white accent (black on a light background), as the FM-1 takes it. The FM-1
   refuses a theme whose strongest step or accent does not stand out from the background (gfx.c theme_check):
   readable() / problems() say it first. A shared theme is its bytes in a line of text: "SLOOP-THEME-1:" + base64 */
/** an RGB colour, 0..255 each */
export type Rgb = number[]
/** a theme (gfx.c theme_t): c the five steps, trk the tracks' colours, bg, hi the accent */
export interface Theme {
  name: string
  c: Rgb[]
  trk: Rgb[]
  bg: Rgb
  hi?: Rgb | null
}
const THEME = {
  ID: 11,
  SIZE: 40,
  MAGIC: 0x324d4854,
  MAGIC1: 0x314d4854,
  PREFIX: 'SLOOP-THEME-1:',
  WHITE: [255, 255, 255],
  BLACK: [0, 0, 0],
  /* the FM-1's own palettes (gfx.c PALETTES) and the tracks' colours (UI_COL_DEF), as RGB 0..255 */
  BUILTIN: [
    [
      'GREEN',
      [
        [0, 40, 12],
        [0, 84, 30],
        [16, 140, 54],
        [56, 200, 92],
        [120, 255, 146],
      ],
    ],
    [
      'AMBER',
      [
        [60, 26, 0],
        [110, 50, 0],
        [170, 82, 0],
        [225, 120, 8],
        [255, 166, 40],
      ],
    ],
    [
      'CYAN',
      [
        [0, 30, 50],
        [0, 62, 96],
        [16, 112, 160],
        [56, 172, 222],
        [140, 222, 255],
      ],
    ],
    [
      'RED',
      [
        [52, 8, 8],
        [100, 18, 14],
        [170, 36, 26],
        [226, 64, 48],
        [255, 112, 92],
      ],
    ],
    [
      'MONO',
      [
        [40, 40, 40],
        [80, 80, 80],
        [130, 130, 130],
        [186, 186, 186],
        [226, 226, 226],
      ],
    ],
    /* (BoopBox 1.1.0) with its own tracks, background and accent (gfx.c SYNTH_*) */
    [
      'SYNTHWAVE',
      [
        [56, 26, 104],
        [96, 48, 160],
        [168, 124, 232],
        [96, 220, 255],
        [255, 84, 222],
      ],
      {
        trk: [
          [0, 228, 255],
          [255, 44, 212],
          [255, 140, 56],
          [160, 96, 255],
        ],
        bg: [16, 4, 40],
        hi: [128, 252, 255],
      },
    ],
  ] as [name: string, c: Rgb[], o?: { trk?: Rgb[]; bg?: Rgb; hi?: Rgb }][],
  TRACKS: [
    [40, 124, 255],
    [30, 204, 112],
    [255, 198, 24],
    [255, 98, 26],
  ],
  to565: ([r, g, b]: Rgb): number =>
    ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3),
  from565: (v: number): Rgb => [
    Math.round((((v >> 11) & 31) * 255) / 31),
    Math.round((((v >> 5) & 63) * 255) / 63),
    Math.round(((v & 31) * 255) / 31),
  ],
  /* as the FM-1 shows it: each colour through RGB565 */
  shown: (rgb: Rgb): Rgb => THEME.from565(THEME.to565(rgb)),
  hex: (rgb: Rgb): string =>
    '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join(''),
  unhex: (h: unknown): Rgb | null => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [n >> 16, (n >> 8) & 255, n & 255]
  },
  /* a name the FM-1 shows: printable ASCII, upper case (its menu font), 8 at most */
  cleanName: (s: unknown): string =>
    String(s || '')
      .toUpperCase()
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 8),
  /* the FM-1's test (theme_check): the brightest step one channel 96 or more apart from the background (after RGB565,
     channels as x * 8, x * 4, x * 8) */
  ch: (v: number): number[] => [
    ((v >> 11) & 31) * 8,
    ((v >> 5) & 63) * 4,
    (v & 31) * 8,
  ],
  apart(c: Rgb, bg?: Rgb | null): boolean {
    const a = THEME.ch(THEME.to565(c)),
      b = THEME.ch(THEME.to565(bg || [0, 0, 0]))
    return a.some((x, k) => Math.abs(x - b[k]) >= 96)
  },
  hiOf: (t: Pick<Theme, 'hi'>): Rgb => t.hi || THEME.WHITE,
  /* what the FM-1 would refuse: the values (c[4]), the accent */
  problems: (
    t: Pick<Theme, 'c' | 'bg' | 'hi'>,
  ): { val: boolean; acc: boolean } => ({
    val: !THEME.apart(t.c[4], t.bg),
    acc: !THEME.apart(THEME.hiOf(t), t.bg),
  }),
  readable(t: Pick<Theme, 'c' | 'bg' | 'hi'>): boolean {
    const p = THEME.problems(t)
    return !p.val && !p.acc
  },
  light: (rgb: Rgb): boolean =>
    0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 127,
  /* a colour moved toward black (light background) or white (dark) just enough to stand out */
  push(c: Rgb, bg?: Rgb | null): Rgb {
    if (THEME.apart(c, bg)) return c.slice()
    const to = THEME.light(bg || [0, 0, 0]) ? 0 : 255
    for (let f = 0.05; f < 1; f += 0.05) {
      const y = c.map((x) => Math.round(x + (to - x) * f))
      if (THEME.apart(y, bg)) return y
    }
    return [to, to, to]
  },
  /* the same theme readable: the values and the accent pushed apart from the background */
  fix: <T extends Theme>(t: T): T & { hi: Rgb } => ({
    ...t,
    c: t.c.map((x, k) => (k === 4 ? THEME.push(x, t.bg) : x.slice())),
    hi: THEME.push(THEME.hiOf(t), t.bg),
  }),
  /* light <-> dark: the five steps the other way round (faint lines, strong values), a white or black background,
     the accent the other way */
  invert<T extends Theme>(t: T): T & { hi: Rgb } {
    const bg = THEME.light(t.bg || [0, 0, 0])
      ? THEME.BLACK.slice()
      : THEME.WHITE.slice()
    return THEME.fix({
      ...t,
      c: t.c
        .slice()
        .reverse()
        .map((x) => x.slice()),
      bg,
      hi: THEME.light(bg) ? THEME.BLACK.slice() : THEME.WHITE.slice(),
    })
  },
  encode(t: Theme): Uint8Array {
    const d = new Uint8Array(THEME.SIZE),
      w = new DataView(d.buffer)
    w.setUint32(0, THEME.MAGIC, true)
    const nm = THEME.cleanName(t.name)
    for (let i = 0; i < nm.length; i++) d[4 + i] = nm.charCodeAt(i)
    t.c.forEach((c, k) => w.setUint16(12 + 2 * k, THEME.to565(c), true))
    t.trk.forEach((c, k) => w.setUint16(22 + 2 * k, THEME.to565(c), true))
    w.setUint16(30, THEME.to565(t.bg || [0, 0, 0]), true)
    w.setUint16(32, THEME.to565(THEME.hiOf(t)), true)
    w.setUint32(36, crc32(d.subarray(0, 36)), true)
    return d
  },
  decode(d: Uint8Array | null | undefined): (Theme & { hi: Rgb }) | null {
    if (!d || (d.length !== THEME.SIZE && d.length !== 36)) return null
    const w = new DataView(d.buffer, d.byteOffset, d.length),
      v1 = d.length === 36
    if (
      v1
        ? w.getUint32(0, true) !== THEME.MAGIC1 ||
          w.getUint32(32, true) !== crc32(d.subarray(0, 32))
        : w.getUint32(0, true) !== THEME.MAGIC ||
          w.getUint32(36, true) !== crc32(d.subarray(0, 36))
    )
      return null
    let name = ''
    for (let i = 4; i < 12 && d[i]; i++) {
      if (d[i] < 0x20 || d[i] > 0x7e) return null
      name += String.fromCharCode(d[i])
    }
    return {
      name,
      c: [0, 1, 2, 3, 4].map((k) =>
        THEME.from565(w.getUint16(12 + 2 * k, true)),
      ),
      trk: [0, 1, 2, 3].map((k) =>
        THEME.from565(w.getUint16(22 + 2 * k, true)),
      ),
      bg: THEME.from565(w.getUint16(30, true)),
      hi: v1
        ? THEME.apart(THEME.WHITE, THEME.from565(w.getUint16(30, true)))
          ? THEME.WHITE.slice()
          : THEME.BLACK.slice()
        : THEME.from565(w.getUint16(32, true)),
    }
  },
  code: (t: Theme): string => THEME.PREFIX + b64enc(THEME.encode(t)),
  fromCode(s: unknown): (Theme & { hi: Rgb }) | null {
    const m = /SLOOP-THEME-1:([A-Za-z0-9+/=]+)/.exec(String(s || ''))
    if (!m) return null
    try {
      return THEME.decode(b64dec(m[1]))
    } catch {
      return null
    }
  },
  builtin: (i: number): Theme & { hi: Rgb } => {
    const [name, c, o] = THEME.BUILTIN[i]
    return {
      name: THEME.cleanName(name),
      c: c.map((x) => x.slice()),
      trk: ((o && o.trk) || THEME.TRACKS).map((x) => x.slice()),
      bg: ((o && o.bg) || [0, 0, 0]).slice(),
      hi: ((o && o.hi) || [255, 255, 255]).slice(),
    }
  },
  /* five steps from one colour, as the FM-1's palettes go: dark to the colour, the last lighter toward white; on a light
     background (bg given) the other way: faint (light) to strong (dark) */
  ramp(rgb: Rgb, bg?: Rgb | null): Rgb[] {
    if (bg && THEME.light(bg))
      return [0.8, 0.6, 0.35]
        .map((f) => rgb.map((x) => Math.round(x + (255 - x) * f)))
        .concat([rgb.slice(), rgb.map((x) => Math.round(x * 0.45))])
    return [0.2, 0.42, 0.7]
      .map((f) => rgb.map((x) => Math.round(x * f)))
      .concat([rgb.slice(), rgb.map((x) => Math.round(x + (255 - x) * 0.45))])
  },
}
/* the FM-1's MIDI ports. Every FM-1 firmware has the same USB IDs, so Windows and macOS often keep the port name of the
 * first firmware they saw ("X0X FM-1", "USB-MIDI"…): the names the installer accepts (fm1ota.js FM1_PORT, the same
 * list), as in/out pairs of one name, "BoopBox" / "SLOOP" / "Felucca" first, then FM-1, then the generic names. connect() keeps the
 * first pair that answers INFO, so a generic name of other gear is tried and left */
const FM1_PORT =
  /fm-1|boopbox|felucca|sloop|clipper|ota|composite|sinco|usb-midi/i
/** a Web MIDI port, as far as fm1Ports reads it */
export interface MidiPortLike {
  name?: string | null
  state?: string
}
function fm1Ports<I extends MidiPortLike, O extends MidiPortLike>(access: {
  inputs: { values(): Iterable<I> }
  outputs: { values(): Iterable<O> }
}) {
  const live = (p: MidiPortLike) =>
    p.state !== 'disconnected' && FM1_PORT.test(p.name || '')
  const ins = [...access.inputs.values()].filter(live),
    outs = [...access.outputs.values()].filter(live)
  const rank = (n: string) =>
    /boopbox|felucca|sloop/i.test(n) ? 0 : /fm-1/i.test(n) ? 1 : 2
  const pairs: { input: I; output: O }[] = []
  for (const input of ins) {
    const output =
      outs.find((o) => o.name === input.name) ||
      (outs.length === 1 ? outs[0] : null)
    if (output) pairs.push({ input, output })
  }
  return pairs.sort(
    (a, b) => rank(a.input.name || '') - rank(b.input.name || ''),
  )
}
/*PROTO-END*/

export {
  HDR,
  CMD,
  LIVE,
  LVX,
  lockable,
  MICRO,
  FC,
  fillGet,
  fillSet,
  PUSH,
  UP,
  F,
  DRUM_LANES,
  LV_NAMES,
  LV_ORDER,
  emptyDrum,
  v14enc,
  v14dec,
  strEnc,
  frame,
  unframe,
  Reader,
  stepExt,
  parse,
  upName,
  req,
  replyMatches,
  Link,
  NOTE_NAMES,
  noteName,
  GM_DRUM,
  GM_DRUM_BY_NAME,
  drumName,
  parseNote,
  parseNotes,
  fmtValue,
  SMP,
  pack7,
  unpack7,
  CRC_TABLE,
  crc32,
  IMA_STEP,
  IMA_IDX,
  imaEncode,
  parseWav,
  resample,
  pyRound,
  normalize,
  loudDb,
  LEVEL_MIN,
  matchGains,
  withGain,
  rootFromName,
  LOOP,
  buildSlot,
  CHOP,
  chopNovelty,
  chopAttack,
  chopHits,
  chopSnap,
  chopGrid,
  chopEqual,
  chopList,
  chopPick,
  chopFit,
  chopZones,
  wavFile,
  zipStore,
  LIB,
  paramKeys,
  sameKeys,
  remapParams,
  patNorm,
  patternFromSteps,
  stepsFromPattern,
  patternUsed,
  cleanPatch,
  libraryFile,
  patchByCount,
  readLibraryFile,
  FLASH_OPT,
  bank,
  u35enc,
  u35dec,
  B64,
  b64enc,
  b64dec,
  BK,
  BackupError,
  backupCapture,
  backupObjects,
  bkProjFormat,
  bkDevFormat,
  bkSloopInto,
  bkFwAtLeast,
  backupRestore,
  fm6CartWrite,
  fm6CartPreset,
  fm6CartSlots,
  fm6CartPresets,
  capturePatch,
  keptIds,
  auditionPatch,
  startWatch,
  mixer,
  SONGF,
  songOrderOk,
  bkReadObj,
  bkWriteObj,
  songCapture,
  songObjects,
  songLoad,
  FM6,
  mockSettings,
  mlDefault,
  makeMockDevice,
  previewToggleStep,
  previewSetStepNotes,
  previewToggleDrum,
  previewSnapshot,
  KIT,
  kitPad,
  kitZones,
  kitLen,
  kitBytes,
  kitFit,
  kitSplit,
  KIT_WORDS,
  KIT_ALT,
  kitLaneOf,
  kitPlace,
  zipRead,
  ROLL,
  SMF,
  ARR,
  PROJ7,
  DSYN,
  DSYN_MOCK_NAMES,
  DSYN_MOCK_KITS,
  SetGate,
  THEME,
  FM1_PORT,
  fm1Ports,
}
