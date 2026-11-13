// SPDX-License-Identifier: GPL-3.0-only
import config from '../../../../shared/room-config.json' with { type: 'json' }
import {
  CMD,
  LIVE,
  Link,
  PROJ7,
  bkReadObj,
  fm1Ports,
  parse,
  req,
} from '../Editor/lib/proto.ts'
import type {
  DevInfo,
  LiveState,
  P7DrumStep,
  P7Pat,
  P7Step,
  TrackParam,
} from '../Editor/lib/proto.ts'

import { parseKeyboardMessage } from './keyboardMidi.ts'
export { parseKeyboardMessage } from './keyboardMidi.ts'
import type {
  RoomPattern,
  RoomPerformance,
  RoomSend,
  RoomTrack,
  RoomTransport,
  RoomVoice,
} from './types.ts'

/* the room config's allowlist of shareable sound controls: per engine, per parameter, [min, max] */
const SHAREABLE: Record<string, Record<string, number[]> | undefined> =
  config.shareableParameters

/* a track's sound as the FM-1 (TRACK_DUMP) or the emulator reports it */
interface VoiceDump {
  engine: number
  preset: number
  p: number[]
}
/* the live state read for a performance: the FM-1's LIVE reply, or the emulator's { tempo, playing } */
type RoomLive = Partial<Pick<LiveState, 'bpm' | 'playing'>> & {
  tempo?: unknown
}
type Project = NonNullable<ReturnType<typeof PROJ7.decode>>

/* the emulator's performance snapshot (boopbox-room-snapshot, posted by the emulator page) */
export interface EmulatorSnapshot {
  project: ArrayBuffer | ArrayBufferView
  tracks: VoiceDump[]
  tempo: number
  playing: boolean
}

/* what was last sent for the emulator: the performance's JSON, the transport ("tempo:playing") */
export interface EmulatorSyncState {
  performanceKey: string
  transportKey: string | null
  hasPerformance: boolean
}

/* a connected FM-1 (connectFm1) */
export interface Fm1Connection {
  input: MIDIInput
  link: Link
  close(): void
  getSelectedVoice(): Promise<RoomVoice>
  setSoundEditsPaused(paused: boolean): void
  getPerformanceSnapshot(): Promise<RoomPerformance | null>
}

function cleanVoice(dump: VoiceDump): RoomVoice | null {
  if (dump.engine === config.engineNames.length) {
    const kit = dump.p[63]
    return config.shareableDrumKits.includes(kit)
      ? { engine: dump.engine, kit }
      : null
  }
  if (
    dump.engine < 0 ||
    dump.engine >= config.presetCounts.length ||
    dump.engine === 4
  )
    return null
  if (dump.preset < 0 || dump.preset >= config.presetCounts[dump.engine])
    return null
  if (
    dump.engine === 9 &&
    (dump.p[70] < 0 || dump.p[70] >= config.presetCounts[9])
  )
    return null
  const allowlist = SHAREABLE[dump.engine]
  if (!allowlist) return null
  const params: Record<string, number> = {}
  for (const [id, [min, max]] of Object.entries(allowlist)) {
    const value = dump.p[Number(id)]
    if (Number.isSafeInteger(value) && value >= min && value <= max)
      params[id] = value
  }
  return { engine: dump.engine, preset: dump.preset, params }
}

function sparse(values: number[], min = -32, max = 31): [number, number][] {
  return values.flatMap((value, index) =>
    Number.isSafeInteger(value) && value >= min && value <= max && value
      ? [[index, value] as [number, number]]
      : [],
  )
}

function roomPattern(
  pattern: P7Pat,
  trackIndex: number,
  drum: boolean,
  info: Pick<DevInfo, 'pe0'>,
): RoomPattern {
  const steps: RoomPattern['steps'] = []
  pattern.steps.forEach((step, index) => {
    if (drum) {
      const drumStep = step as P7DrumStep
      const on = (drumStep.on[0] | (drumStep.on[1] << 8)) >>> 0
      const levels = Array.from(
        { length: 16 },
        (_, lane) => (drumStep.lvl[lane >> 2] >> ((lane & 3) * 2)) & 3,
      )
      const ratchets = Array.from(
        { length: 16 },
        (_, lane) => (drumStep.rat[lane >> 2] >> ((lane & 3) * 2)) & 3,
      )
      if (on || levels.some(Boolean) || ratchets.some(Boolean))
        steps.push([index, on, levels, ratchets])
    } else if (!PROJ7.isBlank(step, false)) {
      const synthStep = step as P7Step
      steps.push([
        index,
        [
          ...synthStep.notes.slice(0, 4),
          synthStep.n,
          synthStep.time,
          synthStep.flags,
          synthStep.vel,
          synthStep.lvl,
          synthStep.rat,
        ],
      ])
    }
  })
  const locks = pattern.locks.flatMap((lock): RoomPattern['locks'] => {
    const param = PROJ7.idOf(lock.code, info.pe0)
    return param >= 0 ? [[lock.step, lock.slide, param, lock.val]] : []
  })
  const components = pattern.comps.flatMap(
    (component): RoomPattern['components'] => {
      if (!PROJ7.compValid(component, info.pe0)) return []
      const a =
        component.type === PROJ7.CP_PARAM
          ? PROJ7.idOf(component.a, info.pe0)
          : component.a
      return a >= 0 ? [[component.step, component.type, a, component.b]] : []
    },
  )
  return {
    id: trackIndex,
    length: 16,
    steps,
    micro: sparse(pattern.micro),
    fill: sparse(pattern.fill, 0, 2),
    locks,
    components,
    dir: pattern.dir,
    seed: pattern.seed,
  }
}

function buildRoomPerformance(
  project: Project | null,
  dumps: VoiceDump[],
  live: RoomLive | null | undefined,
  info: Pick<DevInfo, 'pe0'>,
): RoomPerformance {
  if (!project || project.tracks.length !== 8)
    throw new Error('The FM-1 project could not be read.')
  const scenes = project.scenes || PROJ7.scenesDefault()
  const tracks = project.tracks.map((track): RoomTrack => {
    const dump = dumps[track.i]
    const voice = cleanVoice(dump)
    const patterns = Array.from({ length: PROJ7.NPAT }, (_, id) => {
      const pattern =
        PROJ7.patOf(project, track.i, id) ||
        PROJ7.emptyPat(track.kind === PROJ7.DRUM)
      const normalized = roomPattern(
        pattern,
        id,
        track.kind === PROJ7.DRUM,
        info,
      )
      normalized.length = PROJ7.lenOf(project, track.i, id, {
        len: config.sequenceLengthParameter,
        def: () => 16,
      })
      return normalized
    })
    return {
      index: track.i,
      kind: track.kind,
      voice,
      parameters: track.p
        .filter(([id]) => id < 63)
        .map(([id, value]) => [id, value]),
      currentPattern: track.cur,
      chain: [...track.chain],
      chainEnabled: !track.coff,
      patterns,
    }
  })
  const currentPatterns = tracks.map((track) => track.currentPattern)
  const matchedScene = scenes.pats.findIndex((scene) =>
    scene.every(
      (pattern, track) =>
        pattern === PROJ7.SCN_KEEP || pattern === currentPatterns[track],
    ),
  )
  return {
    tempo: Math.max(
      40,
      Math.min(
        240,
        Number.isSafeInteger(live?.bpm) ? live!.bpm! : config.defaultTempo,
      ),
    ),
    playing: !!live?.playing,
    currentScene: matchedScene < 0 ? null : matchedScene,
    tracks,
    scenes: {
      names: [...scenes.names],
      patterns: scenes.pats.map((scene) => [...scene]),
    },
  }
}

export function buildEmulatorPerformance(
  projectBytes: unknown,
  tracks: unknown,
  live: { tempo?: unknown; playing?: unknown } | null | undefined,
): RoomPerformance {
  if (
    !(projectBytes instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(projectBytes)
  ) {
    throw new Error('The emulator performance snapshot is invalid.')
  }
  if (
    !Array.isArray(tracks) ||
    tracks.length !== 8 ||
    !live ||
    !Number.isSafeInteger(live.tempo) ||
    (live.tempo as number) < 40 ||
    (live.tempo as number) > 240 ||
    typeof live.playing !== 'boolean'
  ) {
    throw new Error('The emulator performance snapshot is invalid.')
  }
  const bytes =
    projectBytes instanceof ArrayBuffer
      ? new Uint8Array(projectBytes)
      : new Uint8Array(
          projectBytes.buffer,
          projectBytes.byteOffset,
          projectBytes.byteLength,
        )
  const project = PROJ7.decode(bytes)
  const dumps = (tracks as (Partial<VoiceDump> | null)[]).map(
    (track): VoiceDump => {
      if (
        !track ||
        !Number.isSafeInteger(track.engine) ||
        !Number.isSafeInteger(track.preset) ||
        !Array.isArray(track.p) ||
        track.p.length !== 71 ||
        track.p.some((value: unknown) => !Number.isSafeInteger(value))
      ) {
        throw new Error('The emulator track contains unsupported data.')
      }
      return {
        engine: track.engine as number,
        preset: track.preset as number,
        p: track.p,
      }
    },
  )
  /* the emulator reports its tempo as "tempo", not the FM-1's "bpm" */
  return buildRoomPerformance(project, dumps, live as RoomLive, { pe0: 63 })
}

export function syncEmulatorSnapshot(
  message: EmulatorSnapshot,
  state: EmulatorSyncState,
  send: RoomSend,
): EmulatorSyncState | null {
  const performance = buildEmulatorPerformance(
    message.project,
    message.tracks,
    {
      tempo: message.tempo,
      playing: message.playing,
    },
  )
  const performanceKey = JSON.stringify(performance)
  let hasPerformance = state.hasPerformance
  if (performanceKey !== state.performanceKey) {
    if (!send({ type: 'performance', performance })) return null
    hasPerformance = true
  }
  const transportKey = `${performance.tempo}:${performance.playing}`
  if (transportKey !== state.transportKey) {
    send({
      type: 'transport',
      playing: performance.playing,
      tempo: performance.tempo,
    })
  }
  return { performanceKey, transportKey, hasPerformance }
}

export async function connectFm1(
  onNote: (note: number, on: boolean, velocity: number, track: number) => void,
  onState: (state: 'connected' | 'disconnected') => void,
  onParameter: (track: number, param: number, value: number) => void = () => {},
  onPerformance: (performance: RoomPerformance) => void = () => {},
  onTransport: (transport: RoomTransport) => void = () => {},
  onPerformanceError: (error: unknown) => void = () => {},
): Promise<Fm1Connection> {
  if (!navigator.requestMIDIAccess)
    throw new Error('This browser does not support USB MIDI access.')
  let access: MIDIAccess
  try {
    access = await navigator.requestMIDIAccess({ sysex: true })
  } catch {
    throw new Error('Allow MIDI access to connect the FM-1.')
  }
  const pairs = fm1Ports(access)
  if (!pairs.length)
    throw new Error('Connect the FM-1 with its USB MIDI cable, then try again.')

  for (const pair of pairs) {
    const link = new Link((data) => pair.output.send(data), { timeout: 400 })
    const sharedVoices = new Map<
      number,
      { engine: number; preset?: number; params: Record<string, number> }
    >()
    let selectedTrack = 0
    let soundEditsPaused = false
    const heldTrackByNote = new Map<number, number>()
    let keepalive: ReturnType<typeof setInterval> | null = null
    let performanceTimer: ReturnType<typeof setInterval> | null = null
    let transportTimer: ReturnType<typeof setInterval> | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let refreshing = false
    let refreshTask: Promise<RoomPerformance | null> | null = null
    let refreshPerformance: () => Promise<RoomPerformance | null> | void =
      () => {}
    let performanceErrorReported = false
    let lastTransport: RoomTransport | null = null
    link.onPush = (frame): void => {
      if (frame.cmd === CMD.RELOAD) {
        const reload = parse[CMD.RELOAD](frame.a)
        sharedVoices.delete(reload.track)
        globalThis.clearTimeout(refreshTimer)
        refreshTimer = globalThis.setTimeout(
          async () => refreshPerformance(),
          350,
        )
        return
      }
      if (frame.cmd === CMD.STEP_CHANGED) {
        globalThis.clearTimeout(refreshTimer)
        refreshTimer = globalThis.setTimeout(
          async () => refreshPerformance(),
          200,
        )
        return
      }
      let change: TrackParam
      if (frame.cmd === CMD.CHANGED) {
        const changed = parse[CMD.CHANGED](frame.a)
        if (changed.scope !== 0) return
        change = { ...changed, track: selectedTrack }
      } else if (frame.cmd === CMD.TRACK_CHANGED) {
        change = parse[CMD.TRACK_CHANGED](frame.a)
      } else {
        return
      }
      const sharedVoice = sharedVoices.get(change.track)
      if (!sharedVoice) return
      const range = SHAREABLE[sharedVoice.engine]?.[change.id]
      if (
        !range ||
        !Number.isSafeInteger(change.value) ||
        change.value < range[0] ||
        change.value > range[1]
      )
        return
      if (soundEditsPaused) return
      sharedVoice.params[change.id] = change.value
      onParameter(change.track, change.id, change.value)
    }
    let disconnected = false
    const inputHandler = (event: MIDIMessageEvent): void => {
      const data = event.data
      if (!data?.length) return
      if (data[0] === 0xf0) {
        if (data.length <= 512) link.receive(data)
        return
      }
      const note = parseKeyboardMessage(data)
      if (!note) return
      const track = note.on
        ? selectedTrack
        : (heldTrackByNote.get(note.note) ?? selectedTrack)
      if (note.on) heldTrackByNote.set(note.note, track)
      else heldTrackByNote.delete(note.note)
      onNote(note.note, note.on, note.velocity, track)
    }
    pair.input.onmidimessage = inputHandler
    if (pair.input.open) await pair.input.open().catch(() => {})
    try {
      const info = parse[CMD.INFO](
        await link.request(req.info(), { retries: 1 }),
      )
      if (
        info.ntrk < 8 ||
        info.nengines < config.presetCounts.length ||
        info.pe0 !== 63 ||
        info.pcount < 71
      ) {
        throw new Error(
          'This room needs current BoopBox firmware with eight tracks and supported sound controls.',
        )
      }
      const watch = parse[CMD.WATCH](
        await link.request(req.watch(3), { retries: 1 }),
      )
      if ((watch.on & 3) !== 3) {
        throw new Error(
          'Update the FM-1 firmware to share live sound controls.',
        )
      }
      keepalive = globalThis.setInterval(() => {
        if (!disconnected)
          link
            .request(req.ping(), { timeout: 300, retries: 0, quiet: true })
            .catch(() => {})
      }, 2000)
      refreshPerformance = async () => {
        if (disconnected) return Promise.resolve(null)
        if (refreshTask) return refreshTask
        refreshing = true
        refreshTask = (async () => {
          try {
            const list = parse[CMD.BK_LIST](
              await link.request(req.bkList(), { timeout: 1500, retries: 0 }),
            )
            if (list.rc)
              throw new Error('The FM-1 could not read its current project.')
            const item = list.items.find(({ id }) => id === 0)
            if (!item || item.len < PROJ7.HDR || item.len > PROJ7.MAX) {
              throw new Error('The FM-1 project is outside the supported size.')
            }
            const project = PROJ7.decode(
              await bkReadObj(
                async (command, options) => link.request(command, options),
                item,
              ),
            )
            if (!project || project.tracks.length !== 8)
              throw new Error('The FM-1 project could not be decoded.')
            const dumps: VoiceDump[] = []
            for (let track = 0; track < 8; track += 1) {
              dumps.push(
                parse[CMD.TRACK_DUMP](
                  await link.request(req.trackDump(track)),
                  info,
                ),
              )
            }
            const live = parse[CMD.LIVE](
              await link.request(req.live(LIVE.STATE), {
                retries: 0,
                quiet: true,
              }),
            )
            const selected = parse[CMD.TRACK](await link.request(req.track()))
            selectedTrack = selected.sel
            for (let track = 0; track < dumps.length; track += 1) {
              const voice = cleanVoice(dumps[track])
              if (voice && voice.engine !== config.engineNames.length) {
                sharedVoices.set(track, {
                  engine: voice.engine,
                  preset: voice.preset,
                  params: { ...voice.params },
                })
              } else {
                sharedVoices.delete(track)
              }
            }
            const performance = buildRoomPerformance(project, dumps, live, info)
            lastTransport = {
              tempo: performance.tempo,
              playing: performance.playing,
            }
            performanceErrorReported = false
            onPerformance(performance)
            return performance
          } catch (error) {
            if (!performanceErrorReported) onPerformanceError(error)
            performanceErrorReported = true
            return null
          } finally {
            refreshing = false
            refreshTask = null
          }
        })()
        return refreshTask
      }
      const refreshTransport = async (): Promise<void> => {
        if (disconnected || refreshing) return
        try {
          const live = parse[CMD.LIVE](
            await link.request(req.live(LIVE.STATE), {
              retries: 0,
              quiet: true,
            }),
          )
          const next = {
            tempo: Math.max(
              40,
              Math.min(
                240,
                Number.isSafeInteger(live?.bpm)
                  ? live.bpm
                  : config.defaultTempo,
              ),
            ),
            playing: !!live?.playing,
          }
          if (
            !lastTransport ||
            lastTransport.tempo !== next.tempo ||
            lastTransport.playing !== next.playing
          ) {
            lastTransport = next
            onTransport(next)
          }
        } catch {
          // A short live-state poll is retried on the next tick.
        }
      }
      const stateHandler = (event: MIDIConnectionEvent): void => {
        if (
          event.port?.id === pair.input.id &&
          event.port.state === 'disconnected'
        )
          disconnect()
      }
      const disconnect = (): void => {
        if (disconnected) return
        disconnected = true
        if (keepalive !== null) globalThis.clearInterval(keepalive)
        if (performanceTimer !== null)
          globalThis.clearInterval(performanceTimer)
        if (transportTimer !== null) globalThis.clearInterval(transportTimer)
        globalThis.clearTimeout(refreshTimer)
        pair.input.onmidimessage = null
        heldTrackByNote.clear()
        link.close()
        onState('disconnected')
      }
      access.onstatechange = stateHandler
      onState('connected')
      refreshPerformance()
      performanceTimer = globalThis.setInterval(refreshPerformance, 2500)
      transportTimer = globalThis.setInterval(refreshTransport, 120)
      return {
        input: pair.input,
        link,
        close(): void {
          if (access.onstatechange === stateHandler) access.onstatechange = null
          disconnect()
        },
        async getSelectedVoice() {
          const selection = parse[CMD.TRACK](await link.request(req.track()))
          selectedTrack = selection.sel
          const dump = parse[CMD.TRACK_DUMP](
            await link.request(req.trackDump(selection.sel)),
            info,
          )
          const voice = cleanVoice(dump)
          if (!voice) {
            throw new Error(
              'Choose a built-in synth preset or a factory drum kit. User samples and custom presets cannot be shared.',
            )
          }
          if (voice.engine !== config.engineNames.length) {
            sharedVoices.set(selection.sel, {
              ...voice,
              params: { ...voice.params },
            })
          } else {
            sharedVoices.delete(selection.sel)
          }
          return voice
        },
        setSoundEditsPaused(paused): void {
          soundEditsPaused = !!paused
        },
        getPerformanceSnapshot:
          refreshPerformance as () => Promise<RoomPerformance | null>,
      }
    } catch (error) {
      if (keepalive !== null) globalThis.clearInterval(keepalive)
      pair.input.onmidimessage = null
      link.close()
      if ((error as Error).message.includes('current BoopBox')) throw error
    }
  }
  throw new Error(
    'No connected MIDI device answered as an FM-1. Check the cable and try again.',
  )
}
