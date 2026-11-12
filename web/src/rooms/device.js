// SPDX-License-Identifier: GPL-3.0-only
import { CMD, LIVE, Link, PROJ7, bkReadObj, fm1Ports, parse, req } from "../editor/lib/proto.js";
import config from "../../../shared/room-config.json" with { type: "json" };
import { parseKeyboardMessage } from "./keyboard-midi.js";
export { parseKeyboardMessage } from "./keyboard-midi.js";

function cleanVoice(dump) {
  if (dump.engine === config.engineNames.length) {
    const kit = dump.p[63];
    return config.shareableDrumKits.includes(kit) ? { engine: dump.engine, kit } : null;
  }
  if (dump.engine < 0 || dump.engine >= config.presetCounts.length || dump.engine === 4) return null;
  if (dump.preset < 0 || dump.preset >= config.presetCounts[dump.engine]) return null;
  if (dump.engine === 9 && (dump.p[70] < 0 || dump.p[70] >= config.presetCounts[9])) return null;
  const allowlist = config.shareableParameters[dump.engine];
  if (!allowlist) return null;
  const params = {};
  for (const [id, [min, max]] of Object.entries(allowlist)) {
    const value = dump.p[Number(id)];
    if (Number.isSafeInteger(value) && value >= min && value <= max) params[id] = value;
  }
  return { engine: dump.engine, preset: dump.preset, params };
}

function sparse(values, min = -32, max = 31) {
  return values.flatMap((value, index) => Number.isSafeInteger(value) && value >= min && value <= max && value
    ? [[index, value]] : []);
}

function roomPattern(pattern, trackIndex, drum, info) {
  const steps = [];
  pattern.steps.forEach((step, index) => {
    if (drum) {
      const on = (step.on[0] | (step.on[1] << 8)) >>> 0;
      const levels = Array.from({ length: 16 }, (_, lane) => (step.lvl[lane >> 2] >> ((lane & 3) * 2)) & 3);
      const ratchets = Array.from({ length: 16 }, (_, lane) => (step.rat[lane >> 2] >> ((lane & 3) * 2)) & 3);
      if (on || levels.some(Boolean) || ratchets.some(Boolean)) steps.push([index, on, levels, ratchets]);
    } else if (!PROJ7.isBlank(step, false)) {
      steps.push([index, [
        ...step.notes.slice(0, 4), step.n, step.time, step.flags, step.vel, step.lvl, step.rat,
      ]]);
    }
  });
  const locks = pattern.locks.flatMap((lock) => {
    const param = PROJ7.idOf(lock.code, info.pe0);
    return param >= 0 ? [[lock.step, lock.slide, param, lock.val]] : [];
  });
  const components = pattern.comps.flatMap((component) => {
    if (!PROJ7.compValid(component, info.pe0)) return [];
    const a = component.type === PROJ7.CP_PARAM ? PROJ7.idOf(component.a, info.pe0) : component.a;
    return a >= 0 ? [[component.step, component.type, a, component.b]] : [];
  });
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
  };
}

function buildRoomPerformance(project, dumps, live, info) {
  if (!project || project.tracks.length !== 8) throw new Error("The FM-1 project could not be read.");
  const scenes = project.scenes || PROJ7.scenesDefault();
  const tracks = project.tracks.map((track) => {
    const dump = dumps[track.i];
    const voice = cleanVoice(dump);
    const patterns = Array.from({ length: PROJ7.NPAT }, (_, id) => {
      const pattern = PROJ7.patOf(project, track.i, id) || PROJ7.emptyPat(track.kind === PROJ7.DRUM);
      const normalized = roomPattern(pattern, id, track.kind === PROJ7.DRUM, info);
      normalized.length = PROJ7.lenOf(project, track.i, id, {
        len: config.sequenceLengthParameter, def: () => 16,
      });
      return normalized;
    });
    return {
      index: track.i,
      kind: track.kind,
      voice,
      parameters: track.p.filter(([id]) => id < 63).map(([id, value]) => [id, value]),
      currentPattern: track.cur,
      chain: [...track.chain],
      chainEnabled: !track.coff,
      patterns,
    };
  });
  const currentPatterns = tracks.map((track) => track.currentPattern);
  const matchedScene = scenes.pats.findIndex((scene) => scene.every((pattern, track) =>
    pattern === PROJ7.SCN_KEEP || pattern === currentPatterns[track]));
  return {
    tempo: Math.max(40, Math.min(240, Number.isSafeInteger(live?.bpm) ? live.bpm : config.defaultTempo)),
    playing: !!live?.playing,
    currentScene: matchedScene < 0 ? null : matchedScene,
    tracks,
    scenes: { names: [...scenes.names], patterns: scenes.pats.map((scene) => [...scene]) },
  };
}

export function buildEmulatorPerformance(projectBytes, tracks, live) {
  if (!(projectBytes instanceof ArrayBuffer) && !ArrayBuffer.isView(projectBytes)) {
    throw new Error("The emulator performance snapshot is invalid.");
  }
  if (!Array.isArray(tracks) || tracks.length !== 8 || !Number.isSafeInteger(live?.tempo)
    || live.tempo < 40 || live.tempo > 240 || typeof live.playing !== "boolean") {
    throw new Error("The emulator performance snapshot is invalid.");
  }
  const bytes = projectBytes instanceof ArrayBuffer ? new Uint8Array(projectBytes) : new Uint8Array(
    projectBytes.buffer, projectBytes.byteOffset, projectBytes.byteLength,
  );
  const project = PROJ7.decode(bytes);
  const dumps = tracks.map((track) => {
    if (!track || !Number.isSafeInteger(track.engine) || !Number.isSafeInteger(track.preset)
      || !Array.isArray(track.p) || track.p.length !== 71
      || track.p.some((value) => !Number.isSafeInteger(value))) {
      throw new Error("The emulator track contains unsupported data.");
    }
    return { engine: track.engine, preset: track.preset, p: track.p };
  });
  return buildRoomPerformance(project, dumps, live, { pe0: 63 });
}

export async function connectFm1(
  onNote, onState, onParameter = () => {}, onPerformance = () => {}, onTransport = () => {}, onPerformanceError = () => {},
) {
  if (!navigator.requestMIDIAccess) throw new Error("This browser does not support USB MIDI access.");
  let access;
  try {
    access = await navigator.requestMIDIAccess({ sysex: true });
  } catch {
    throw new Error("Allow MIDI access to connect the FM-1.");
  }
  const pairs = fm1Ports(access);
  if (!pairs.length) throw new Error("Connect the FM-1 with its USB MIDI cable, then try again.");

  for (const pair of pairs) {
    const link = new Link((data) => pair.output.send(data), { timeout: 400 });
    let sharedVoices = new Map();
    let selectedTrack = 0;
    let soundEditsPaused = false;
    const heldTrackByNote = new Map();
    let keepalive = null;
    let performanceTimer = null;
    let transportTimer = null;
    let refreshTimer = null;
    let refreshing = false;
    let refreshTask = null;
    let refreshPerformance = () => {};
    let performanceErrorReported = false;
    let lastTransport = null;
    link.onPush = (frame) => {
      if (frame.cmd === CMD.RELOAD) {
        const reload = parse[CMD.RELOAD](frame.a);
        sharedVoices.delete(reload.track);
        globalThis.clearTimeout(refreshTimer);
        refreshTimer = globalThis.setTimeout(() => refreshPerformance(), 350);
        return;
      }
      if (frame.cmd === CMD.STEP_CHANGED) {
        globalThis.clearTimeout(refreshTimer);
        refreshTimer = globalThis.setTimeout(() => refreshPerformance(), 200);
        return;
      }
      let change;
      if (frame.cmd === CMD.CHANGED) {
        change = parse[CMD.CHANGED](frame.a);
        if (change.scope !== 0) return;
        change.track = selectedTrack;
      } else if (frame.cmd === CMD.TRACK_CHANGED) {
        change = parse[CMD.TRACK_CHANGED](frame.a);
      } else {
        return;
      }
      const sharedVoice = sharedVoices.get(change.track);
      if (!sharedVoice) return;
      const range = config.shareableParameters[sharedVoice.engine]?.[change.id];
      if (!range || !Number.isSafeInteger(change.value) || change.value < range[0] || change.value > range[1]) return;
      if (soundEditsPaused) return;
      sharedVoice.params[change.id] = change.value;
      onParameter(change.track, change.id, change.value);
    };
    let disconnected = false;
    const inputHandler = (event) => {
      const data = event.data;
      if (!data?.length) return;
      if (data[0] === 0xf0) {
        if (data.length <= 512) link.receive(data);
        return;
      }
      const note = parseKeyboardMessage(data);
      if (!note) return;
      const track = note.on ? selectedTrack : (heldTrackByNote.get(note.note) ?? selectedTrack);
      if (note.on) heldTrackByNote.set(note.note, track);
      else heldTrackByNote.delete(note.note);
      onNote(note.note, note.on, note.velocity, track);
    };
    pair.input.onmidimessage = inputHandler;
    if (pair.input.open) await pair.input.open().catch(() => {});
    try {
      const info = parse[CMD.INFO](await link.request(req.info(), { retries: 1 }));
      if (info.ntrk < 8 || info.nengines < config.presetCounts.length || info.pe0 !== 63 || info.pcount < 71) {
        throw new Error("This room needs current BoopBox firmware with eight tracks and supported sound controls.");
      }
      const watch = parse[CMD.WATCH](await link.request(req.watch(3), { retries: 1 }));
      if ((watch.on & 3) !== 3) {
        throw new Error("Update the FM-1 firmware to share live sound controls.");
      }
      keepalive = globalThis.setInterval(() => {
        if (!disconnected) link.request(req.ping(), { timeout: 300, retries: 0, quiet: true }).catch(() => {});
      }, 2000);
      refreshPerformance = () => {
        if (disconnected) return Promise.resolve(null);
        if (refreshTask) return refreshTask;
        refreshing = true;
        refreshTask = (async () => {
          try {
            const list = parse[CMD.BK_LIST](await link.request(req.bkList(), { timeout: 1500, retries: 0 }));
            if (list.rc) throw new Error("The FM-1 could not read its current project.");
            const item = list.items.find(({ id }) => id === 0);
            if (!item || item.len < PROJ7.HDR || item.len > PROJ7.MAX) {
              throw new Error("The FM-1 project is outside the supported size.");
            }
            const project = PROJ7.decode(await bkReadObj((command, options) => link.request(command, options), item));
            if (!project || project.tracks.length !== 8) throw new Error("The FM-1 project could not be decoded.");
            const dumps = [];
            for (let track = 0; track < 8; track += 1) {
              dumps.push(parse[CMD.TRACK_DUMP](await link.request(req.trackDump(track)), info));
            }
            const live = parse[CMD.LIVE](await link.request(req.live(LIVE.STATE), { retries: 0, quiet: true }));
            const selected = parse[CMD.TRACK](await link.request(req.track()));
            selectedTrack = selected.sel;
            for (let track = 0; track < dumps.length; track += 1) {
              const voice = cleanVoice(dumps[track]);
              if (voice && voice.engine !== config.engineNames.length) {
                sharedVoices.set(track, {
                  engine: voice.engine, preset: voice.preset, params: { ...voice.params },
                });
              } else {
                sharedVoices.delete(track);
              }
            }
            const performance = buildRoomPerformance(project, dumps, live, info);
            lastTransport = { tempo: performance.tempo, playing: performance.playing };
            performanceErrorReported = false;
            onPerformance(performance);
            return performance;
          } catch (error) {
            if (!performanceErrorReported) onPerformanceError(error);
            performanceErrorReported = true;
            return null;
          } finally {
            refreshing = false;
            refreshTask = null;
          }
        })();
        return refreshTask;
      };
      const refreshTransport = async () => {
        if (disconnected || refreshing) return;
        try {
          const live = parse[CMD.LIVE](await link.request(req.live(LIVE.STATE), { retries: 0, quiet: true }));
          const next = {
            tempo: Math.max(40, Math.min(240, Number.isSafeInteger(live?.bpm) ? live.bpm : config.defaultTempo)),
            playing: !!live?.playing,
          };
          if (!lastTransport || lastTransport.tempo !== next.tempo || lastTransport.playing !== next.playing) {
            lastTransport = next;
            onTransport(next);
          }
        } catch {
          // A short live-state poll is retried on the next tick.
        }
      };
      const stateHandler = (event) => {
        if (event.port?.id === pair.input.id && event.port.state === "disconnected") disconnect();
      };
      const disconnect = () => {
        if (disconnected) return;
        disconnected = true;
        if (keepalive !== null) globalThis.clearInterval(keepalive);
        if (performanceTimer !== null) globalThis.clearInterval(performanceTimer);
        if (transportTimer !== null) globalThis.clearInterval(transportTimer);
        globalThis.clearTimeout(refreshTimer);
        pair.input.onmidimessage = null;
        heldTrackByNote.clear();
        link.close();
        onState("disconnected");
      };
      access.onstatechange = stateHandler;
      onState("connected");
      refreshPerformance();
      performanceTimer = globalThis.setInterval(refreshPerformance, 2500);
      transportTimer = globalThis.setInterval(refreshTransport, 120);
      return {
        input: pair.input,
        link,
        close() {
          if (access.onstatechange === stateHandler) access.onstatechange = null;
          disconnect();
        },
        async getSelectedVoice() {
          const selection = parse[CMD.TRACK](await link.request(req.track()));
          selectedTrack = selection.sel;
          const dump = parse[CMD.TRACK_DUMP](await link.request(req.trackDump(selection.sel)), info);
          const voice = cleanVoice(dump);
          if (!voice) {
            throw new Error("Choose a built-in synth preset or a factory drum kit. User samples and custom presets cannot be shared.");
          }
          if (voice.engine !== config.engineNames.length) {
            sharedVoices.set(selection.sel, { ...voice, params: { ...voice.params } });
          } else {
            sharedVoices.delete(selection.sel);
          }
          return voice;
        },
        setSoundEditsPaused(paused) {
          soundEditsPaused = !!paused;
        },
        getPerformanceSnapshot: refreshPerformance,
      };
    } catch (error) {
      if (keepalive !== null) globalThis.clearInterval(keepalive);
      pair.input.onmidimessage = null;
      link.close();
      if (error.message.includes("current BoopBox")) throw error;
    }
  }
  throw new Error("No connected MIDI device answered as an FM-1. Check the cable and try again.");
}
