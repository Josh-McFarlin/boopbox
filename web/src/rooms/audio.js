// SPDX-License-Identifier: GPL-3.0-only
import { Link, makeMockDevice, previewSnapshot, req } from "../editor/lib/proto.js";
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

export class RoomAudio {
  constructor(onError) {
    this.players = Array.from({ length: PLAYERS }, makePlayer);
    this.voices = new Array(PLAYERS).fill(null);
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
      await this.queue;
      for (let slot = 0; slot < this.voices.length; slot += 1) {
        if (this.voices[slot]) this.syncVoice(slot);
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
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return Promise.reject(new Error("Invalid player slot."));
    const next = this.queue.then(async () => {
      const player = this.players[slot];
      const localVoice = { ...voice };
      if (voice.params) localVoice.params = { ...voice.params };
      await player.ready;
      if (localVoice.engine === 13) {
        const track = player.mock.state.tracks[3];
        track.drum = true;
        track.engine = 13;
        track.preset = 0;
        track.p[63] = localVoice.kit;
      } else {
        await player.link.request(req.track(0));
        await player.link.request(req.preset(localVoice.engine, localVoice.preset));
        const track = player.mock.state.tracks[0];
        track.engine = localVoice.engine;
        track.preset = localVoice.preset;
        track.drum = false;
        for (const [param, value] of Object.entries(localVoice.params || {})) {
          const id = Number(param);
          if (!isShareableParameter(localVoice.engine, id, value)) {
            throw new Error("That sound control isn't available to share.");
          }
          await player.link.request(req.trackParam(0, id, value));
        }
      }
      this.voices[slot] = localVoice;
      this.syncVoice(slot);
    });
    this.queue = next.catch(() => {});
    return next;
  }

  setSoundParameter(slot, param, value) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return Promise.reject(new Error("Invalid player slot."));
    const next = this.queue.then(async () => {
      const voice = this.voices[slot];
      if (!voice || voice.engine === 13 || !isShareableParameter(voice.engine, param, value)) {
        throw new Error("That sound control isn't available to share.");
      }
      const player = this.players[slot];
      await player.link.request(req.trackParam(0, param, value));
      voice.params = { ...(voice.params || {}), [param]: value };
      this.syncVoice(slot);
    });
    this.queue = next.catch(() => {});
    return next;
  }

  syncVoice(slot) {
    if (!this.node || !this.voices[slot]) return;
    this.node.port.postMessage({
      type: "state",
      slot,
      state: previewSnapshot(this.players[slot].mock.state, false),
    });
  }

  removeVoice(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PLAYERS) return;
    this.voices[slot] = null;
    const next = this.queue.then(() => this.node?.port.postMessage({ type: "drop", slot }));
    this.queue = next.catch(() => {});
    return this.queue;
  }

  note(slot, note, on) {
    const next = this.queue.then(() => {
      const voice = this.voices[slot];
      if (!voice || !this.node) return;
      this.node.port.postMessage({
        type: "note",
        slot,
        track: voice.engine === 13 ? 3 : 0,
        note,
        on,
      });
    });
    this.queue = next.catch(() => {});
    return next;
  }

  panic() {
    for (let slot = 0; slot < PLAYERS; slot += 1) {
      if (this.voices[slot]) this.node?.port.postMessage({ type: "panic", slot });
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
    for (const player of this.players) {
      player.input.onmidimessage = null;
      player.link.close();
    }
  }
}
