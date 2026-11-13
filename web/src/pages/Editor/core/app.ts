// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The editor's shared state and the helpers every page uses.
//
// How the React editor is put together: the device logic (connect, the requests, polling, the pushes) works on plain
// mutable objects, as the editor always has: A (this file), dev (A.dev: what was read from the FM-1) and each page's
// own state object (LV, PT, SG, DS, TH ...). Whatever changes them calls notify(); every component that called
// useApp() then renders again from those objects. So a page's code reads like the old one minus its DOM work: where it
// built or patched elements it now returns JSX, and where it called renderX() it calls notify().
import { useSyncExternalStore } from 'react'

import { CMD, DRUM_LANES, F, SetGate, parse, req } from '../lib/proto.ts'
import type {
  DevInfo,
  DrumStepReply,
  Dump,
  Fm6List,
  Link,
  Lock,
  ParamDesc,
  Req,
  RequestOpt,
  SmpInfo,
  StepReply,
  TrackReply,
  TrackState,
  UpSlot,
  makeMockDevice,
} from '../lib/proto.ts'
import { TEXT } from '../lib/text.ts'

import type { SlotMode, Tab } from './tabs.ts'

const QS = new URLSearchParams(
  typeof location !== 'undefined' ? location.search : '',
)

/* ------------------------------------------------------------------- types --- */
/* the mixer as read from the FM-1 (pages/tracks: TRACK + each track's pan) */
export interface Mix extends TrackReply {
  tracks: TrackState[]
}
/* the user bank: its size and the slots read (bank.list) */
export interface BankList {
  total: number
  slots: UpSlot[]
}
/* what was read from the FM-1 (A.dev). info and dump are null only while the connect sequence reads them; a page that
   shows only when ready() can take them as there (ReadyDev, readyDev()) */
export interface Dev {
  link: Link
  input: MIDIInput
  output: MIDIOutput
  info: DevInfo | null
  pdesc: (ParamDesc | null)[] /* the selected track's parameters (DESC scope 0; null: not read) */
  gdesc: (ParamDesc | null)[] /* the globals (scope 1) */
  names: string[][] /* per engine: its preset names */
  titles?: string[][] /* per engine: its two edit pages' titles */
  dump: Dump | null
  steps: StepReply[]
  dsteps?: DrumStepReply[] /* v5: the drum track's steps as lanes */
  dstepsOk?: boolean /* dsteps was read for the track under the controls */
  slotUsed: (number | null)[] /* the four project slots: used (PROJECT op 2) */
  keys: string[] | null /* paramKeys */
  watch: number | boolean /* pushes on (startWatch: 1..3, false) */
  v4?: boolean
  bank: BankList | null /* null: no user bank */
  smp?: SmpInfo | null
  fm6?: Fm6List | null
  sel?: number /* the selected track (v3) */
  mix?: Mix | null
  kitNames?: string[]
  micro?: number[] | null
  locks?: Lock[] | null
  fill?: number[] | null
  built?: number /* the engine the controls were built for */
}
/* A.dev once the connect sequence has read INFO and DUMP (ready()) */
export type ReadyDev = Dev & { info: DevInfo; dump: Dump }
/* the status line: a string key and what follows it */
export interface Status {
  key: string | null
  arg: string | number
  err: boolean
  at: number
}
export type MockDevice = ReturnType<typeof makeMockDevice>
export type Lang = keyof typeof TEXT
/* the shared state (A) */
export interface AppState {
  lang: Lang
  tab: Tab
  access: MIDIAccess | null
  dev: Dev | null
  busy: number
  dragging: string | null
  focused: string | null
  connecting: boolean
  wantConnected: boolean
  needReload: boolean
  lastDump: number
  rewatch: boolean
  status: Status
  slotMode: SlotMode
  blink: Map<string, number>
  MOCK: boolean
  LEGACY: boolean
  mock: MockDevice | null
  bkProg?:
    | number
    | null /* (core/shared.ts) a backup / restore / song file's fraction done */
  lvTracks?: { engine?: number }[] /* (pages/live) the LIVE page's tracks */
}

export const A: AppState = {
  lang: 'en',
  tab: 'sound' /* the page showing (core/tabs.js) */,
  access: null /* MIDIAccess (or the mock's) */,
  dev: null /* {link, input, output, info, pdesc[], gdesc[], names[][], titles[][], dump, steps[], dsteps[], slotUsed[],
                           keys[] (paramKeys), watch (pushes on), v4, bank ({total, slots[]} or null: no user bank), smp, fm6,
                           sel (the selected track), mix ({tracks[]}), kitNames, micro, locks, fill, built} */,
  busy: 0 /* multi-request operations in progress: no polling */,
  dragging: null /* key of the control being dragged */,
  focused:
    null /* key of the select that has the focus (its value must not move under it) */,
  connecting: false,
  wantConnected: false,
  needReload: false /* a RELOAD push came: re-read DESC, DUMP and steps when free */,
  lastDump: 0 /* Date.now() of the last DUMP */,
  rewatch: false,
  status: { key: null, arg: '', err: false, at: 0 },
  slotMode:
    'samples' /* the Sample slots page's mode: samples, kits, drumsynth (core/tabs.js) */,
  blink: new Map() /* key -> time a push changed it (the control flashes) */,
  MOCK: QS.get('mock') === '1',
  LEGACY: QS.get('legacy') === '1',
  mock: null /* the simulated FM-1 (?mock=1) */,
}
export const QUERY = QS

/* SET coalescing per control: key -> {last: time of the user's last change, sent: the value last requested} */
export const sets = new SetGate()
/* the device also pushes RELOAD after loads the editor asked for (SET of G_ENGSEL, PRESET, PROJECT load, UP_LOAD); the
   editor re-reads after those anyway, so it skips that many RELOADs for a moment */
export const selfReload = { n: 0, until: 0 }
export function selfLoad(): void {
  const dev = A.dev
  if (!dev || !dev.watch) return
  const now = Date.now()
  selfReload.n = now < selfReload.until ? selfReload.n + 1 : 1
  selfReload.until = now + 1500
}
export const stepEdit = new Map() /* step index -> time of the last edit */

/* ---------------------------------------------------------------- rendering --- */
let version = 0,
  queued = false
const subs = new Set<() => void>()
/* something in A, dev or a page's state changed: the components render again (once per task, however many calls) */
export function notify(): void {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    version++
    for (const f of subs) f()
  })
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}
/* in a component: render again on notify(); -> A */
export function useApp(): AppState {
  useSyncExternalStore(subscribe, () => version)
  return A
}

/* ------------------------------------------------------------------ strings --- */
type Strings = (typeof TEXT)[Lang]
/* a string by its key (the key itself when there is none); a few entries are lists (lvxGuideSteps ...) */
export function t<K extends keyof Strings>(k: K): Strings[K]
export function t(k: string): string
export function t(k: string): unknown {
  return (TEXT[A.lang] as Record<string, unknown>)[k] ?? k
}
/* t() with {name} placeholders filled */
export const tf = (k: string, vars?: Record<string, string | number>): string =>
  String(t(k)).replace(/\{(\w+)\}/g, (m, n: string) =>
    vars && n in vars ? String(vars[n]) : m,
  )

const ERR_KEYS =
  /fail|error|denied|nomidi|nodevice|noreply|lost|refused|full|bad/i
/* the status line (top right): a string key and what follows it. A message fades after STATUS_MS (an error stays
   until the next message), so an old one never reads as something still to do */
export const STATUS_MS = 6000
let statusTimer: ReturnType<typeof setTimeout> | number = 0
export function sayK(k: string, arg: string | number = ''): void {
  A.status = { key: k, arg, err: ERR_KEYS.test(k), at: Date.now() }
  clearTimeout(statusTimer)
  if (!A.status.err) statusTimer = setTimeout(notify, STATUS_MS + 50)
  notify()
}
export const statusText = (): string =>
  A.status.key && (A.status.err || Date.now() - (A.status.at || 0) < STATUS_MS)
    ? t(A.status.key) + A.status.arg
    : ''

export function report(err: unknown): void {
  const e = err as Error | null | undefined
  if (e && e.message !== 'closed') {
    console.warn(err)
    sayK('error', e.message)
  }
}

export const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

/* ----------------------------------------------------------- the device --- */
export const rq = async (r: Req, opt?: RequestOpt): Promise<number[]> =>
  A.dev!.link.request(r, opt)
export const rqf = async (r: Req, o?: RequestOpt): Promise<number[]> => rq(r, o)
export async function getDesc(scope: number, id: number): Promise<ParamDesc> {
  return parse[CMD.DESC](await rq(req.desc(scope, id)))
}
export async function getDescOrNull(
  s: number,
  i: number,
): Promise<ParamDesc | null> {
  try {
    return await getDesc(s, i)
  } catch (e) {
    if ((e as Error).message === 'closed') throw e
    return null
  }
}
export async function getDump(): Promise<Dump> {
  A.lastDump = Date.now()
  return parse[CMD.DUMP](await rq(req.dump()), A.dev!.info!)
}
export async function getStep(i: number): Promise<StepReply> {
  return parse[CMD.STEP_GET](await rq(req.stepGet(i)))
}
export async function getDrumStep(i: number): Promise<DrumStepReply> {
  return parse[CMD.DRUM_STEP](await rq(req.drumStep(i)))
}
/* a drum step as an old step (firmware ed_dstep_old): for what still reads dev.steps */
export function drumAsStep(d: DrumStepReply): StepReply {
  const notes: number[] = []
  for (let l = 0; l < 16 && notes.length < 4; l++)
    if ((d.on >> l) & 1) notes.push(DRUM_LANES[l][0])
  return {
    index: d.index,
    n: notes.length,
    notes: [...notes, 0, 0, 0, 0].slice(0, 4),
    time: notes.length ? 0 : 2,
    flags: 0,
    vel: notes.length ? 100 : 0,
  }
}

/* one multi-request operation; polling waits for it */
export async function op(fn: () => Promise<unknown> | void): Promise<void> {
  if (!A.dev) return
  A.busy++
  notify()
  try {
    await fn()
  } catch (err) {
    report(err)
  } finally {
    A.busy--
    notify()
  }
}

/* what the firmware has */
export const hasTracks = (): boolean =>
  !!A.dev && !!A.dev.info && !!A.dev.info.ntrk
export const nTrk = (): number => (A.dev && A.dev.info && A.dev.info.ntrk) || 0
export const ready = (): boolean => !!A.dev && !!A.dev.dump
export const hasLocks = (): boolean =>
  !!A.dev && !!A.dev.info && A.dev.info.proto >= 7
export const hasFill = (): boolean =>
  !!A.dev && !!A.dev.info && A.dev.info.proto >= 8
export const devNlock = (): number =>
  A.dev && A.dev.info && A.dev.info.ntrk >= 8
    ? 32
    : 24 /* locks a track: 32 on the eight-track firmware */
/* four-track firmware: the drum track's level and sends are globals (GLO > DRUMS: G_DRLVL, G_DRREV, G_DRDLY). BoopBox's
   drum tracks have their own (P_LEVEL, P_REV, P_DLY: those globals only name the focused drum track's on the FM-1's
   screen, so the editor sets the track's own) */
export const drumLvGlobal = (): boolean => nTrk() < 8

/* a track's kind: its engine byte (NENGINES = drums), from TRACK (dev.mix), the LIVE page's reads (A.lvTracks) or the
   selected track's DUMP. BoopBox has eight tracks, drums on 4 and 8 by default, and any track may be either (SAVE >
   TOOLS > KIND); a four-track firmware (SLOOP, Felucca) has its one drum track last */
/* (i: may be dev.sel before the firmware has tracks, undefined; it is used as it comes, as before) */
export function isDrumTrk(i: number | undefined): boolean {
  const dev = A.dev
  if (!dev || !dev.info) return false
  const j = i as number
  const ne = dev.info.nengines,
    x =
      (dev.mix && dev.mix.tracks && dev.mix.tracks[j]) ||
      (A.lvTracks && A.lvTracks[j])
  if (i === dev.sel && dev.dump && dev.dump.engine !== undefined)
    return dev.dump.engine >= ne
  if (x && x.engine !== undefined) return x.engine >= ne
  const n = nTrk() || 4
  return n >= 8 ? j % 4 === 3 : i === n - 1
}
/* the drum track the FM-1's drum screens show (core.h drum_focus): the selected track if it is one, else the first */
export function drumFocus(): number {
  const dev = A.dev
  if (!dev) return -1
  if (isDrumTrk(dev.sel)) return dev.sel!
  for (let i = 0; i < (nTrk() || 4); i++) if (isDrumTrk(i)) return i
  return -1
}

/* parameter ids by their DESC label (firmware/src/core.h), with the usual id when the firmware does not name it */
export const P = { LEVEL: 0, SLEN: 29, CHORD: 49 }
export const key = (s: number, id: number): string => s + ':' + id
export const gEng = (): number => {
  const i = A.dev!.gdesc.findIndex((d) => d && d.label === 'ENG')
  return i >= 0 ? i : 20
}
export const pSlen = (): number => {
  const i = A.dev!.pdesc.findIndex((d) => d && d.fmt === F.STEPS)
  return i >= 0 ? i : P.SLEN
}
export const pById = (label: string, def: number): number => {
  const d = A.dev!
  const i = d.pdesc.findIndex(
    (x, k) => x && k < d.info!.pe0 && x.label === label,
  )
  return i >= 0 ? i : def
}
export const pPan = (): number => pById('PAN', 39),
  pMute = (): number => pById('MUTE', 40)
export const gDrLvl = (): number => {
  const i = A.dev!.gdesc.findIndex(
    (d, k) => d && k > gEng() && (d.label === 'LVL' || d.label === 'LEVEL'),
  )
  return i >= 0 ? i : 25
}
export const isDrum = (): boolean =>
  !!A.dev && !!A.dev.dump && A.dev.dump.engine >= A.dev.info!.nengines
/* v5 (SLOOP 2.0): the drum track is edited as its 16 lanes (DRUM_STEP); older firmware: as GM notes */
export const drumGrid = (): boolean =>
  isDrum() && !!A.dev!.info!.proto && A.dev!.info!.proto >= 5
/* A.dev on a page that shows only once ready() (the connect sequence has read INFO and DUMP) */
export const readyDev = (): ReadyDev => A.dev as ReadyDev

/* the device's track colours (ui_studio.c UI_COL): the selected one is the editor's accent (--trk) */
export const TCOL = [
  'var(--t1)',
  'var(--t2)',
  'var(--t3)',
  'var(--t4)',
  'var(--t5)',
  'var(--t6)',
  'var(--t7)',
  'var(--t8)',
]
export const tcol = (i: number): string => TCOL[(i | 0) % TCOL.length]

/* ------------------------------------------------------------------- files --- */
function save(name: string, blob: Blob): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const download = (name: string, obj: unknown): void =>
  save(
    name,
    new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }),
  )
export const downloadBytes = (
  name: string,
  bytes: Blob | BlobPart | Uint8Array,
  type = 'application/octet-stream',
): void =>
  save(
    name,
    bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type }),
  )
export const fileSlug = (s: unknown): string =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'patch'
export const today = (): string => new Date().toISOString().slice(0, 10)
/* a file chosen by the user: opens the browser's picker, -> the File (or null) */
export function pickFile(accept: string, multiple?: false): Promise<File | null>
export function pickFile(accept: string, multiple: true): Promise<File[]>
export function pickFile(
  accept: string,
  multiple?: boolean,
): Promise<File | File[] | null>
export async function pickFile(
  accept: string,
  multiple = false,
): Promise<File | File[] | null> {
  return new Promise((res) => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = accept
    i.multiple = multiple
    i.onchange = (): void => res(multiple ? [...i.files!] : i.files![0] || null)
    i.click()
  })
}
