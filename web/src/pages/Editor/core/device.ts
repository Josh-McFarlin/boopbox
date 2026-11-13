// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The FM-1 under the editor: connecting, the connect sequence (INFO, DESC, NAMES, DUMP, steps ...), SET as fast as the
// device answers, the live pushes (protocol v2+) and the polling that keeps the page in step with the device.
import {
  CMD,
  FM1_PORT,
  Link,
  bank,
  fm1Ports,
  makeMockDevice,
  paramKeys,
  parse,
  req,
  startWatch,
} from '../lib/proto.ts'
import type { Frame, Req, RequestOpt } from '../lib/proto.ts'

import {
  A,
  drumAsStep,
  drumGrid,
  getDescOrNull,
  getDrumStep,
  getDump,
  getStep,
  gEng,
  hasFill,
  hasLocks,
  hasTracks,
  isDrumTrk,
  key,
  notify,
  op,
  pMute,
  pPan,
  P,
  pSlen,
  readyDev,
  report,
  rq,
  sayK,
  selfLoad,
  selfReload,
  sets,
  stepEdit,
} from './app.ts'
import type { Dev } from './app.ts'
import { H } from './hooks.ts'

/* ---------------------------------------------------------------- connecting --- */
export async function connect(): Promise<void> {
  A.wantConnected = true
  if (!A.MOCK && !navigator.requestMIDIAccess) {
    sayK('nomidi')
    return
  }
  A.connecting = true
  sayK('connecting')
  try {
    if (!A.access) {
      if (A.MOCK) {
        A.mock = makeMockDevice({
          auto: false,
          legacy: A.LEGACY,
          onChange: (...a: unknown[]) => H.previewChanged(...a),
        })
        A.access = A.mock
          .access as unknown as MIDIAccess /* (the mock's: the parts the editor uses) */
      } else {
        try {
          A.access = await navigator.requestMIDIAccess({ sysex: true })
        } catch {
          sayK('denied')
          return
        }
      }
      A.access.onstatechange = onState
    }
    const pairs = fm1Ports(A.access)
    if (!pairs.length) {
      sayK('nodevice')
      return
    }
    let link = null,
      input = null,
      output = null
    for (const pr of pairs) {
      /* the first pair that answers (a generic name may be other gear) */
      const l = new Link((d) => pr.output.send(d), {
        timeout: 300,
        onUnknown: (f) => console.debug('ignored reply', f),
        onTimeout: () => sayK('noreply'),
        onPush: (f) => onPush(f),
        onGap: () => {
          A.rewatch = true
        },
      })
      pr.input.onmidimessage = (e: MIDIMessageEvent): void => l.receive(e.data!)
      if (pr.input.open) await pr.input.open().catch(() => {})
      try {
        await l.request(req.info(), {
          timeout: 500,
          retries: 3,
          quiet: true,
        }) /* (the first frame can be lost) */
        link = l
        input = pr.input
        output = pr.output
        break
      } catch {
        l.close()
        pr.input.onmidimessage = null
      }
    }
    if (!link || !input || !output) {
      sayK(pairs.length ? 'noreply' : 'nodevice')
      return
    }
    const dev: Dev = {
      link,
      input,
      output,
      info: null,
      pdesc: [],
      gdesc: [],
      names: [],
      dump: null,
      steps: [],
      slotUsed: [null, null, null, null],
      keys: null,
      watch: false,
      bank: null,
    }
    A.dev = dev
    sets.clear() /* (another FM-1, maybe) */
    notify()
    await load(dev)
  } catch (e) {
    console.error(e)
    if (A.dev) {
      /* not unplugged meanwhile (that says "lost") */
      const timeout = /^timeout/.test((e as Error).message)
      disconnect()
      sayK(timeout ? 'noreply' : 'error', timeout ? '' : (e as Error).message)
    }
  } finally {
    A.connecting = false
    notify()
  }
}

export function disconnect(reasonKey = 'disconnected'): void {
  H.stopPreview()
  const dev = A.dev
  if (dev) {
    dev.link.close()
    dev.input.onmidimessage = null
  }
  A.dev = null
  A.busy = 0
  A.needReload = false
  sayK(reasonKey)
}
export function toggleConnect(): void {
  if (A.dev) {
    A.wantConnected = false
    disconnect()
  } else connect()
}

let stateTimer: ReturnType<typeof setTimeout> | number = 0
function onState(e: MIDIConnectionEvent): void {
  const p = e.port,
    dev = A.dev
  if (!p || !FM1_PORT.test(p.name || '')) return
  if (
    dev &&
    p.state === 'disconnected' &&
    (p.id === dev.input.id || p.id === dev.output.id)
  ) {
    disconnect('lost')
  } else if (
    !dev &&
    A.wantConnected &&
    p.state === 'connected' &&
    p.type === 'output'
  ) {
    clearTimeout(stateTimer) /* the device came back: reconnect */
    stateTimer = setTimeout(() => {
      if (!A.dev && A.wantConnected) connect()
    }, 800)
  }
}

/* the whole connect sequence */
async function load(d: Dev): Promise<void> {
  A.busy++
  try {
    /* the first frame after opening the port can be lost: a few tries */
    d.info = parse[CMD.INFO](
      await d.link.request(req.info(), { timeout: 500, retries: 3 }),
    )
    notify()
    const total = d.info.pcount + d.info.gcount
    for (let i = 0; i < d.info.pcount; i++) {
      sayK('reading', `${i + 1}/${total}`)
      d.pdesc[i] = await getDescOrNull(0, i)
    }
    for (let i = 0; i < d.info.gcount; i++) {
      sayK('reading', `${d.info.pcount + i + 1}/${total}`)
      d.gdesc[i] = await getDescOrNull(1, i)
    }
    const kd = d.pdesc[d.info.pe0]
    if (kd && kd.label === 'KIT' && kd.names.length)
      d.kitNames = kd.names /* (the drum track was selected) */
    d.titles = []
    for (let e = 0; e < d.info.nengines; e++) {
      const r = parse[CMD.NAMES](await d.link.request(req.names(e)))
      d.names[e] = r.names
      d.titles[e] = r.titles
    }
    for (let k = 0; k < 4; k++) {
      /* PROJECT op 2: is the slot used */
      try {
        d.slotUsed[k] = parse[CMD.PROJECT](
          await d.link.request(req.project(2, k)),
        ).used
      } catch (e) {
        if ((e as Error).message === 'closed') throw e
      }
    }
    try {
      d.smp = parse[CMD.SMP_INFO](await d.link.request(req.smpInfo()))
    } catch (e) {
      if ((e as Error).message === 'closed') throw e
      d.smp = null
    } /* older firmware, or no flash */
    d.keys = paramKeys(d.pdesc, d.info.pe0, d.info.pcount)
    d.fm6 = null /* v9: the FM6 patch slots (FM6_LIST), else null */
    if (d.info.proto >= 9) {
      try {
        d.fm6 = parse[CMD.FM6_LIST](await d.link.request(req.fm6List()))
      } catch (e) {
        if ((e as Error).message === 'closed') throw e
      }
    }
    H.fm6Names(d)
    await H.libAdopt(d)
    if (d.info.ntrk)
      d.sel = parse[CMD.TRACK](
        await d.link.request(req.track()),
      ).sel /* v3: the selected track */
    d.dump = await getDump()
    d.mix = null
    d.built = d.dump.engine
    notify()
    await loadSteps()
    if (d.info.ntrk) await H.readMixer()
    /* protocol v2: live pushes and the user bank; older firmware: DUMP polling, no bank */
    const rqd = async (r: Req, o?: RequestOpt) => d.link.request(r, o)
    d.watch = await startWatch(rqd)
    d.v4 = d.watch === 3 /* TRACK_PARAM / TRACK_CHANGED */
    if (d.watch) {
      sayK('readingBank')
      try {
        d.bank = await bank.list(async (r, o) =>
          d.link.request(r, { ...o, quiet: true }),
        )
      } catch (e) {
        if ((e as Error).message === 'closed') throw e
        d.bank = null
      }
    }
    sayK('ready')
  } finally {
    A.busy--
    notify()
  }
}

/* the engine's parameters again (another engine under the controls) */
export async function rereadEngineDesc(): Promise<void> {
  const dev = readyDev(),
    pe0 = dev.info.pe0
  for (let i = 0; i < 8 && pe0 + i < dev.info.pcount; i++)
    dev.pdesc[pe0 + i] = await getDescOrNull(0, pe0 + i)
  const kd = dev.pdesc[pe0]
  if (kd && kd.label === 'KIT' && kd.names.length)
    dev.kitNames = kd.names /* the drum track's kits, for the mixer */
  H.fm6Names()
  dev.built = dev.dump.engine
  notify()
}

export async function loadSteps(): Promise<void> {
  const dev = readyDev(),
    n = dev.info.nstep,
    drum = drumGrid()
  if (!dev.dsteps) dev.dsteps = []
  for (let i = 0; i < n; i++) {
    if (i % 8 === 0) sayK('steploading', `${i}/${n}`)
    if (drum) {
      dev.dsteps[i] = await getDrumStep(i)
      dev.steps[i] = drumAsStep(dev.dsteps[i])
    } else dev.steps[i] = await getStep(i)
  }
  dev.dstepsOk = drum
  await loadLocks()
  notify()
}
/* v7: the selected track's nudges and locks (none on older firmware); v8: its fill conditions too */
export async function loadLocks(): Promise<void> {
  const d = A.dev!
  if (!hasLocks()) {
    d.micro = null
    d.locks = null
    d.fill = null
    return
  }
  const m = parse[CMD.MICRO_GET](
    await rq(req.microGet(d.sel!), { key: 'micro' }),
  )
  const l = parse[CMD.LOCK_GET](await rq(req.lockGet(d.sel!), { key: 'locks' }))
  const f = hasFill()
    ? parse[CMD.FILL_GET](await rq(req.fillGet(d.sel!), { key: 'fill' }))
    : null
  if (d !== A.dev) return
  d.micro = m.micro
  d.locks = l.locks
  d.fill = f ? f.fill : null
  notify()
}

/* ------------------------------------------------------------ SET a value --- */
/* a SET of this control queued or in flight */
export function pendingSet(k: string): boolean {
  const dev = A.dev
  return (
    !!dev &&
    (dev.link.hasQueued(k) || (!!dev.link.cur && dev.link.cur.key === k))
  )
}
/* the user is working on this control: polling and pushes must not move it */
export function touched(k: string): boolean {
  const st = sets.get(k)
  if (A.dragging === k || A.focused === k) return true
  if (st && performance.now() - st.last < 600) return true
  return pendingSet(k)
}
/* listeners for a value the user set (the sequencer follows LEN at once, ...): fn(s, id, v) */
type SetListener = (s: number, id: number, v: number) => void
const setListeners = new Set<SetListener>()
export const onUserSet = (fn: SetListener): (() => boolean) => {
  setListeners.add(fn)
  return () => setListeners.delete(fn)
}

/* SET as fast as the device answers: one SET per control in flight and at most one queued, which always carries the
   latest value (Link coalesces by key), so a drag never builds a backlog */
export function userSet(
  s: number,
  id: number,
  v: number,
  final: boolean,
): void {
  const dev = A.dev
  if (!dev) return
  const k = key(s, id)
  ;(s ? dev.dump!.g : dev.dump!.p)[id] = v
  H.mixFromDump()
  for (const fn of setListeners) fn(s, id, v)
  notify()
  if (!sets.user(k, v, pendingSet(k), performance.now()))
    return /* the pending request already carries it */
  void final
  sendSet(s, id, k)
}
async function sendSet(s: number, id: number, k: string): Promise<void> {
  const dev = A.dev
  if (!dev) return
  const st = sets.get(k)!
  const v = (s ? dev.dump!.g : dev.dump!.p)[id]
  st.sent = v
  try {
    const r = parse[CMD.SET](await rq(req.set(s, id, v), { key: k }))
    if (A.dev && A.dragging !== k && st.sent === v && !dev.link.hasQueued(k)) {
      /* the device's value after clamping */
      ;(s ? dev.dump!.g : dev.dump!.p)[id] = r.value
      H.mixFromDump()
      if (!s && id === dev.info!.pe0 + 7 && H.fm6On())
        H.fm6Later() /* PTCH: the device loaded that patch */
      notify()
    }
  } catch (e) {
    if ((e as Error).message !== 'closed') console.warn(e)
  }
}
/* a drag ended anywhere on the page: its last value is final */
if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', () => {
    if (!A.dragging || !A.dev || !A.dev.dump) {
      A.dragging = null
      return
    }
    const k = A.dragging,
      [s, id] = k.split(':').map(Number)
    A.dragging = null
    userSet(s, id, (s ? A.dev.dump.g : A.dev.dump.p)[id], true)
  })
  window.addEventListener('pointercancel', () => {
    A.dragging = null
  })
}

/* ------------------------------------------------- the sound under the controls --- */
export async function choosePreset(e: number, p: number): Promise<void> {
  if (!A.dev) return
  A.busy++
  try {
    selfLoad()
    parse[CMD.PRESET](await rq(req.preset(e, p)))
    await afterSoundChange()
  } catch (err) {
    report(err)
  } finally {
    A.busy--
    notify()
  }
}
export async function afterSoundChange(msg = 'ready'): Promise<void> {
  const dev = A.dev!
  A.needReload = false /* this re-reads everything a RELOAD asks for */
  sets.clear() /* another track / sound under the controls: a value equal to the one
                                                       sent before is sent again, and they show the device's at once */
  dev.dump = await getDump()
  await rereadEngineDesc()
  notify()
  await loadSteps() /* a preset can bring a pattern */
  if (hasTracks())
    await H.readMixer() /* the sound names and the selected strip */
  await H.fm6Follow() /* FM6: the track's patch (a PTCH value may have loaded one) */
  sayK(msg)
}
export async function initSound(confirmText: string): Promise<void> {
  const dev = A.dev
  if (!dev || !confirm(confirmText)) return
  A.busy++
  try {
    selfLoad()
    await rq(req.set(1, gEng(), dev.dump!.engine))
    await afterSoundChange()
  } catch (err) {
    report(err)
  } finally {
    A.busy--
    notify()
  }
}
export function selectTrack(i: number): void {
  const dev = A.dev
  if (!dev || !hasTracks() || i === dev.sel) return
  op(async () => {
    dev.sel = parse[CMD.TRACK](await rq(req.track(i))).sel
    await afterSoundChange()
  })
}

/* ------------------------------------------------- live sync / polling --- */
/* With WATCH (protocol v2) the device pushes CHANGED / RELOAD / STEP_CHANGED; the editor PINGs about once a second so
   the watch stays on (it ends 3 s after the last request), and DUMPs every 5 s as a safety net. Older firmware: DUMP
   every 400 ms and two steps per round. */
type PushListener = (f: Frame) => void
const pushListeners = new Set<PushListener>()
/* a page that follows the pushes itself (LIVE, the sequencer ...): fn(frame) */
export const onPushed = (fn: PushListener): (() => boolean) => {
  pushListeners.add(fn)
  return () => pushListeners.delete(fn)
}

function onPush(f: Frame): void {
  const d = A.dev
  if (!d || !d.dump || !d.info) return
  if (A.tab === 'live')
    H.livePush(f) /* (2.7) the LIVE page follows the FM-1 too */
  try {
    for (const fn of pushListeners) fn(f)
    if (f.cmd === CMD.CHANGED) {
      const c = parse[CMD.CHANGED](f.a)
      if (H.panning() && !c.scope)
        return /* about the track selected for a moment, not ours */
      const arr = c.scope ? d.dump.g : d.dump.p
      if (c.id >= arr.length) return
      const k = key(c.scope, c.id)
      if (touched(k)) return /* the user's value wins; their SET follows */
      arr[c.id] = c.value
      blink(k)
      H.mixFromDump()
      if (!c.scope && c.id === d.info.pe0 + 7 && H.fm6On())
        H.fm6Later() /* PTCH turned on the device: another patch */
      notify()
    } else if (f.cmd === CMD.RELOAD) {
      d.sel = parse[CMD.RELOAD](
        f.a,
      ).track /* v3: another track may be selected on the device */
      if (selfReload.n > 0 && Date.now() < selfReload.until) {
        selfReload.n--
        return
      }
      A.needReload = true
      maybeReload()
    } else if (f.cmd === CMD.STEP_CHANGED) {
      const { index } = parse[CMD.STEP_CHANGED](f.a)
      if (index < d.info.nstep) refreshStep(index)
    } else if (f.cmd === CMD.TRACK_CHANGED) {
      /* v4: level / pan / mute of a track that is not selected */
      const c = parse[CMD.TRACK_CHANGED](f.a),
        x = d.mix && d.mix.tracks[c.track]
      if (!x || c.track === d.sel) return
      if (c.id === pPan()) {
        if (!H.mixTouched('pan', c.track)) x.pan = c.value
      } else if (c.id === pMute()) {
        if (!H.mixTouched('lv', c.track)) x.mute = c.value ? 1 : 0
      } else if (c.id === P.LEVEL && !isDrumTrk(c.track)) {
        if (!H.mixTouched('lv', c.track)) x.level = c.value
      } else return
      H.updateStrip(c.track)
      notify()
    }
  } catch (e) {
    console.warn('bad push', f, e)
  }
}
function blink(k: string): void {
  A.blink.set(k, performance.now())
  setTimeout(() => {
    if (performance.now() - (A.blink.get(k) || 0) >= 390) {
      A.blink.delete(k)
      notify()
    }
  }, 400)
}
export async function refreshStep(i: number): Promise<void> {
  const d = A.dev!
  if (hasLocks()) H.refreshLocks()
  try {
    if (drumGrid() && d.dstepsOk) {
      const r = parse[CMD.DRUM_STEP](
        await rq(req.drumStep(i), { key: 'dstep:' + i }),
      )
      if (d !== A.dev || r.index !== i || !drumGrid()) return
      d.dsteps![i] = r
      d.steps[i] = drumAsStep(r)
      notify()
      return
    }
    const s = parse[CMD.STEP_GET](
      await rq(req.stepGet(i), { key: 'step:' + i }),
    )
    if (d !== A.dev || s.index !== i) return
    d.steps[i] = s
    notify()
  } catch (err) {
    report(err)
  }
}
export function maybeReload(): void {
  const dev = A.dev
  if (!dev || A.busy || !A.needReload || !dev.dump || A.tab === 'live')
    return /* (LIVE: when another page shows) */
  op(async () => afterSoundChange('reloaded'))
}

/* keep-alive: PING when nothing else went out for ~1 s; after a longer gap (hidden tab, a long flash write:
   Link.onGap) the watch may have ended: WATCH again and re-read what may have been missed */
let keepAliveRun = false
async function keepAlive(): Promise<void> {
  const d = A.dev
  if (!d || !d.watch || !d.dump || document.hidden) return
  const gap = Date.now() - d.link.lastSent
  if (A.rewatch || gap > 2500) {
    if (keepAliveRun) return
    keepAliveRun = true
    try {
      const on = await startWatch(async (r, o) => d.link.request(r, o))
      A.rewatch = false /* (this WATCH itself may have flagged the gap) */
      if (on) {
        d.v4 = on === 3
        A.needReload = true
        maybeReload()
      } else if (d === A.dev) {
        d.watch = false
        notify()
      }
    } catch {
      /* closed */
    } finally {
      // eslint-disable-next-line require-atomic-updates -- the flag guards this one run; only this run resets it
      keepAliveRun = false
    }
  } else if (gap > 850 && d.link.idle) {
    d.link
      .request(req.ping(), { key: 'ping', quiet: true, retries: 0 })
      .catch(() => {})
  }
}

let stepRR = 0
async function poll(): Promise<void> {
  const d = A.dev
  if (!d || A.busy || A.dragging || document.hidden || !d.dump || !d.link.idle)
    return
  if (A.needReload) {
    maybeReload()
    return
  }
  if (d.watch && Date.now() - A.lastDump < 5000) return
  A.busy++
  try {
    const dump = await getDump()
    if (d !== A.dev) return
    const soundChanged =
      dump.engine !== d.dump.engine || dump.preset !== d.dump.preset
    const engineChanged = dump.engine !== d.dump.engine
    for (const [s, arr] of [
      [0, dump.p],
      [1, dump.g],
    ] as [number, number[]][])
      /* the user's controls keep their value */
      for (let id = 0; id < arr.length; id++)
        if (touched(key(s, id))) arr[id] = (s ? d.dump.g : d.dump.p)[id]
    d.dump = dump
    notify()
    if (engineChanged) await rereadEngineDesc()
    if (hasTracks())
      await H.readMixer() /* the strips (other tracks push nothing) */
    if (soundChanged) {
      await loadSteps()
      sayK('ready')
      return
    }
    if (d.watch) return /* steps come as STEP_CHANGED */
    /* steps are not in DUMP: follow them two at a time */
    const len = Math.max(1, Math.min(d.info!.nstep, dump.p[pSlen()] || 16))
    for (let n = 0; n < 2; n++) {
      stepRR = (stepRR + 1) % len
      if (performance.now() - (stepEdit.get(stepRR) || 0) < 1500) continue
      if (drumGrid() && d.dstepsOk) {
        const r = await getDrumStep(stepRR)
        d.dsteps![stepRR] = r
        d.steps[stepRR] = drumAsStep(r)
        continue
      }
      d.steps[stepRR] = await getStep(stepRR)
    }
    notify()
  } catch (err) {
    report(err)
  } finally {
    A.busy--
  }
}

let loops = false
/* the timers (once, when the editor starts) */
export function startDeviceLoops(): void {
  if (loops) return
  loops = true
  setInterval(keepAlive, 1000)
  setInterval(poll, 400)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && A.dev && A.dev.watch) {
      A.rewatch = true
      keepAlive()
    }
  })
}
