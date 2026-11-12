// SPDX-License-Identifier: GPL-3.0-only
import { Link, makeMockDevice, previewSnapshot, PROJ7, req } from "../editor/lib/proto.js";
import config from "../../../shared/room-config.json" with { type: "json" };

const PLAYERS = 8;
const WASM_URL = new URL("../editor/boopbox-preview.wasm", document.baseURI);
const WORKLET_URL = new URL("../editor/preview-worklet.js", document.baseURI);

function isShareableParameter(engine, param, value) {
  const range = config.shareableParameters[engine]?.[param];
  return !!range && Number.isSafeInteger(value) && value >= range[0] && value <= range[1];
}

function makePlayer() {
  const mock = makeMockDevice({ auto: false });
  const input = [...mock.access.inputs.values()][0];
  const output = [...mock.access.outputs.values()][0];
  if (!input || !output) throw new Error("The local firmware audio engine could not start.");
  const link = new Link((data) => output.send(data), { timeout: 500 });
  input.onmidimessage = (event) => link.receive(event.data);
  return { mock, input, link, ready: link.request(req.info()) };
}

function makePatternBytes(pattern, drum) {
  const value = PROJ7.emptyPat(drum);
  if (pattern) {
    for (const step of pattern.steps) {
      if (drum) {
        const [, on, levels, ratchets] = step;
        value.steps[step[0]] = {
          on: [on & 255, (on >> 8) & 255],
          lvl: [0, 0, 0, 0],
          rat: [0, 0, 0, 0],
        };
        for (let lane = 0; lane < 16; lane += 1) {
          value.steps[step[0]].lvl[lane >> 2] |= (levels[lane] & 3) << ((lane & 3) * 2);
          value.steps[step[0]].rat[lane >> 2] |= (ratchets[lane] & 3) << ((lane & 3) * 2);
        }
      } else {
        const fields = step[1];
        value.steps[step[0]] = {
          notes: fields.slice(0, 4), n: fields[4], time: fields[5], flags: fields[6],
          vel: fields[7], lvl: fields[8], rat: fields[9],
        };
      }
    }
    for (const [index, amount] of pattern.micro) value.micro[index] = amount;
    for (const [index, condition] of pattern.fill) value.fill[index] = condition;
    value.locks = pattern.locks.map(([step, slide, param, val]) => ({
      step, slide, code: PROJ7.codeOf(param, 63), val,
    }));
    value.comps = pattern.components.map(([step, type, a, b]) => ({
      step, type, a: type === PROJ7.CP_PARAM ? PROJ7.codeOf(a, 63) : a, b,
    }));
    value.dir = pattern.dir;
    value.seed = pattern.seed;
  }
  return PROJ7.patBytes(value, drum);
}

function performanceGroupSnapshot(mock, performance, group, clock) {
  mock.state.g[0] = performance.tempo;
  const snapshot = previewSnapshot(mock.state, false);
  snapshot.playing = performance.playing;
  snapshot.currentScene = performance.currentScene;
  snapshot.hasVoice = performance.tracks.slice(group * 4, group * 4 + 4).some((track) => !!track.voice);
  snapshot.roomBeat = Number.isFinite(clock?.beat)
    ? clock.beat + Math.max(0, Date.now() - (clock.serverAt || Date.now())) * performance.tempo / 60_000
    : 0;
  snapshot.tracks = snapshot.tracks.slice(0, 4).map((track, local) => {
    const source = performance.tracks[group * 4 + local];
    return {
      ...track,
      roomPatterns: source.patterns.map((pattern, id) => ({
        id: pattern?.id ?? id,
        length: pattern?.length ?? 16,
        bytes: Array.from(makePatternBytes(pattern, source.kind === PROJ7.DRUM)),
      })),
      currentPattern: source.currentPattern,
      chain: [...source.chain],
      chainEnabled: source.chainEnabled,
    };
  });
  snapshot.roomScenes = {
    names: [...performance.scenes.names],
    patterns: performance.scenes.patterns.map((scene) => scene.slice(group * 4, group * 4 + 4)),
  };
  return snapshot;
}

export class RoomAudio {
  constructor(onError) {
    this.players = Array.from({ length: PLAYERS }, () => [makePlayer(), makePlayer()]);
    this.voices = new Array(PLAYERS).fill(null);
    this.performances = new Array(PLAYERS).fill(null);
    this.roomClocks = new Array(PLAYERS).fill(null);
    this.mutedSlots = new Array(PLAYERS).fill(false);
    this.soloSlot = null;
    this.queue = Promise.resolve();
    this.context = null;
    this.node = null;
    this.gain = null;
    this.loading = null;
    this.onError = onError;
  }

  async start() {
    if (this.node) {
      await this.context.resume();
      return;
    }
    if (this.loading) return this.loading;
    this.loading = this.initialize().finally(() => { this.loading = null; });
    return this.loading;
  }

  async initialize() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || !window.AudioWorkletNode) throw new Error("AudioWorklet is not supported in this browser.");
    this.context = new Audio({ sampleRate: 44100, latencyHint: "interactive" });
    if (this.context.sampleRate !== 44100) {
      await this.context.close();
      this.context = null;
      throw new Error("BoopBox preview requires audio at 44.1 kHz.");
    }
    await this.context.resume();
    try {
      const response = await fetch(WASM_URL);
      if (!response.ok) throw new Error("The firmware audio preview could not be loaded.");
      const module = await WebAssembly.compile(await response.arrayBuffer());
      await this.context.audioWorklet.addModule(WORKLET_URL);
      this.node = new AudioWorkletNode(this.context, "boopbox-room-preview", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { module },
      });
      this.node.port.onmessage = ({ data }) => {
        if (data.error) this.onError(new Error(data.error));
      };
      this.node.onprocessorerror = () => this.onError(new Error("The room audio engine stopped. Disable audio and try again."));
      this.gain = this.context.createGain();
      this.gain.gain.value = 0.75;
      this.node.connect(this.gain).connect(this.context.destination);
      this.syncMixSettings();
      await this.queue;
      for (let slot = 0; slot < this.performances.length; slot += 1) {
        if (this.performances[slot]) this.syncPerformance(slot);
      }
    } catch (error) {
      this.node?.disconnect();
      this.node = null;
      await this.context.close();
      this.context = null;
      throw error;
    }
  }

  setVoice(slot, voice) {
    const performance = this.performances[slot] || {
      tempo: config.defaultTempo, playing: false,
      tracks: Array.from({ length: 8 }, (_, index) => ({
        index, kind: index === 3 || index === 7 ? PROJ7.DRUM : PROJ7.SYNTH, voice: null,
        parameters: [], currentPattern: 0, chain: [], chainEnabled: false,
        patterns: Array(8).fill(null),
      })),
      scenes: { names: Array(8).fill(0), patterns: Array.from({ length: 8 }, (_, scene) => Array(8).fill(scene)) },
    };
    const track = performance.tracks.find((item) => item.index === (voice.engine === 13 ? 3 : 0));
    track.voice = { ...voice, params: voice.params ? { ...voice.params } : undefined };
    return this.setPerformance(slot, performance);
  }

  setPerformance(slot, performance, clock = null) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return Promise.reject(new Error("Invalid player slot."));
    const next = this.queue.then(async () => {
      if (!performance?.tracks || performance.tracks.length !== 8) throw new Error("The shared performance is invalid.");
      for (let group = 0; group < 2; group += 1) {
        const player = this.players[slot][group];
        await player.ready;
        for (let localTrack = 0; localTrack < 4; localTrack += 1) {
          const source = performance.tracks[group * 4 + localTrack];
          const track = player.mock.state.tracks[localTrack];
          if (!source || source.index !== group * 4 + localTrack) throw new Error("The shared track map is invalid.");
          if (source.voice) {
            const voice = source.voice;
            if (voice.engine === 13) {
              track.drum = true;
              track.engine = 13;
              track.preset = 0;
              track.p[63] = voice.kit;
            } else {
              if (!config.shareableParameters[voice.engine]) throw new Error("That sound isn't available to share.");
              await player.link.request(req.track(localTrack));
              await player.link.request(req.preset(voice.engine, voice.preset));
              track.engine = voice.engine;
              track.preset = voice.preset;
              track.drum = false;
              for (const [param, value] of Object.entries(voice.params || {})) {
                const id = Number(param);
                if (!isShareableParameter(voice.engine, id, value)) throw new Error("That sound control isn't available to share.");
                track.p[id] = value;
              }
            }
          } else {
            track.p[40] = 1;
          }
          for (const [id, value] of source.parameters || []) {
            if (!Number.isInteger(id) || id < 0 || id > 62 || !Number.isInteger(value) || value < -128 || value > 127) {
              throw new Error("That track setting isn't available to share.");
            }
            track.p[id] = value;
          }
          if (!source.voice) track.p[40] = 1;
          if (source.patterns?.length !== 8) throw new Error("The shared patterns are invalid.");
        }
      }
      this.performances[slot] = performance;
      if (clock) this.roomClocks[slot] = clock;
      this.voices[slot] = performance.tracks.find((track) => track.voice)?.voice || null;
      this.syncPerformance(slot);
    });
    this.queue = next.catch(() => {});
    return next;
  }

  setSoundParameter(slot, trackIndex, param, value) {
    if (arguments.length === 3) {
      value = param;
      param = trackIndex;
      trackIndex = 0;
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return Promise.reject(new Error("Invalid player slot."));
    const next = this.queue.then(async () => {
      if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= 8) throw new Error("Invalid shared track.");
      const performance = this.performances[slot];
      const voice = performance?.tracks[trackIndex]?.voice;
      if (!voice || voice.engine === 13 || !isShareableParameter(voice.engine, param, value)) {
        throw new Error("That sound control isn't available to share.");
      }
      const player = this.players[slot][Math.floor(trackIndex / 4)];
      const localTrack = trackIndex % 4;
      await player.link.request(req.track(localTrack));
      await player.link.request(req.trackParam(localTrack, param, value));
      player.mock.state.tracks[localTrack].p[param] = value;
      voice.params = { ...(voice.params || {}), [param]: value };
      this.syncPerformance(slot);
    });
    this.queue = next.catch(() => {});
    return next;
  }

  syncPerformance(slot) {
    if (!this.node || !this.performances[slot]) return;
    for (let group = 0; group < 2; group += 1) {
      this.node.port.postMessage({
        type: "state",
        slot,
        group,
        state: performanceGroupSnapshot(
          this.players[slot][group].mock, this.performances[slot], group, this.roomClocks[slot],
        ),
      });
    }
  }

  setTempo(tempo) {
    if (!Number.isInteger(tempo) || tempo < 40 || tempo > 240) return;
    for (let slot = 0; slot < PLAYERS; slot += 1) {
      const performance = this.performances[slot];
      if (!performance) continue;
      performance.tempo = tempo;
      for (const player of this.players[slot]) player.mock.state.g[0] = tempo;
      this.node?.port.postMessage({ type: "transport", slot, tempo, playing: performance.playing });
    }
  }

  setTransport(slot, playing, tempo, clock = null) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS || typeof playing !== "boolean") return;
    if (!Number.isInteger(tempo) || tempo < 40 || tempo > 240) return;
    const performance = this.performances[slot];
    if (!performance) return;
    performance.playing = playing;
    if (clock) this.roomClocks[slot] = clock;
    this.setTempo(tempo);
    const beat = Number.isFinite(clock?.beat)
      ? clock.beat + Math.max(0, Date.now() - (clock.serverAt || Date.now())) * tempo / 60_000
      : null;
    this.node?.port.postMessage({ type: "transport", slot, tempo, playing, beat });
  }

  setPlayerMuted(slot, muted) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return;
    this.mutedSlots[slot] = !!muted;
    this.syncMixSettings();
  }

  setSoloPlayer(slot) {
    if (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS)) return;
    this.soloSlot = slot;
    this.syncMixSettings();
  }

  setMix(mutedSlots, soloSlot) {
    if (!Array.isArray(mutedSlots) || mutedSlots.length !== PLAYERS
      || !mutedSlots.every((muted) => typeof muted === "boolean")
      || !(soloSlot === null || (Number.isInteger(soloSlot) && soloSlot >= 0 && soloSlot < PLAYERS))) return;
    this.mutedSlots = [...mutedSlots];
    this.soloSlot = soloSlot;
    this.syncMixSettings();
  }

  syncMixSettings() {
    this.node?.port.postMessage({
      type: "mix",
      mutedSlots: [...this.mutedSlots],
      soloSlot: this.soloSlot,
    });
  }

  removeVoice(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return;
    this.voices[slot] = null;
    this.performances[slot] = null;
    const mutedSlots = [...this.mutedSlots];
    mutedSlots[slot] = false;
    this.setMix(mutedSlots, this.soloSlot === slot ? null : this.soloSlot);
    const next = this.queue.then(() => this.node?.port.postMessage({ type: "drop", slot }));
    this.queue = next.catch(() => {});
    return this.queue;
  }

  note(slot, track, note, on) {
    const next = this.queue.then(() => {
      if (!this.performances[slot]?.tracks[track]?.voice || !this.node) return;
      this.node.port.postMessage({
        type: "note",
        slot,
        track,
        note,
        on,
      });
    });
    this.queue = next.catch(() => {});
    return next;
  }

  panic() {
    for (let slot = 0; slot < PLAYERS; slot += 1) {
      if (this.performances[slot]) this.node?.port.postMessage({ type: "panic", slot });
    }
  }

  async close() {
    this.panic();
    await this.loading?.catch(() => {});
    await this.queue;
    this.node?.disconnect();
    this.node = null;
    if (this.context) await this.context.close();
    this.context = null;
    for (const group of this.players) {
      for (const player of group) {
        player.input.onmidimessage = null;
        player.link.close();
      }
    }
  }
}
