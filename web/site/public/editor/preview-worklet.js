// SPDX-License-Identifier: GPL-3.0-only
// The audio thread owns the firmware instance. No MIDI or hardware access.
export class FirmwareAudio {
  constructor(module) {
    const imports = WebAssembly.Module.imports(module);
    if (imports.length) throw new Error(`Unexpected DSP imports: ${imports.map((x) => x.name).join(', ')}`);
    this.w = new WebAssembly.Instance(module, {}).exports;
    this.w._initialize?.();
    this.w.preview_init();
    this.bytes = new Uint8Array(this.w.memory.buffer);
    this.transfer = this.w.preview_buffer();
    this.frames = this.w.preview_frames();
    this.audio = new Float32Array(this.w.memory.buffer, this.w.preview_render(), this.frames * 2);
    this.previous = null;
    this.position = this.frames;
  }
  write(data) { this.bytes.set(data, this.transfer); }
  transport() {
    return { positions: [0, 1, 2, 3].map((k) => this.w.preview_position(k)) };
  }
  sync(state) {
    const old = this.previous;
    state.g.forEach((v, i) => { if (!old || v !== old.g[i]) this.w.preview_global(i, v); });
    this.w.preview_select(state.sel, state.solo);
    state.tracks.forEach((t, k) => {
      const before = old?.tracks[k];
      const changedSound = !before || t.engine !== before.engine || t.preset !== before.preset;
      if (changedSound) this.w.preview_track(k, t.engine, t.preset);
      t.p.forEach((v, i) => { if (changedSound || v !== before.p[i]) this.w.preview_param(k, i, v); });
      for (let i = 0; i < t.step.length; i++) {
        const source = [k === 3 ? t.dstep[i] : t.step[i], t.micro[i], (t.fill[i >> 2] >> ((i & 3) * 2)) & 3];
        const prior = before && [k === 3 ? before.dstep[i] : before.step[i], before.micro[i], (before.fill[i >> 2] >> ((i & 3) * 2)) & 3];
        if (prior && JSON.stringify(source) === JSON.stringify(prior)) continue;
        const data = new Uint8Array(12), [s, micro, fill] = source;
        if (k === 3) {
          data[0] = s.on & 255; data[1] = s.on >> 8;
          for (let l = 0; l < 16; l++) {
            data[2 + (l >> 2)] |= (s.lvl[l] & 3) << ((l & 3) * 2);
            data[6 + (l >> 2)] |= (s.rat[l] & 3) << ((l & 3) * 2);
          }
        } else data.set([...s.notes.slice(0, 4), s.n, s.time, s.flags, s.vel, s.lvl || 0, s.rat || 0]);
        data[10] = micro; data[11] = fill;
        this.write(data); this.w.preview_step(k, i);
      }
      if (!before || JSON.stringify(t.locks) !== JSON.stringify(before.locks)) {
        const data = new Uint8Array(32 * 4);
        t.locks.slice(0, 32).forEach((l, i) => data.set([l.step, l.param, l.value & 255, (l.value >> 8) & 255], i * 4));
        this.write(data); this.w.preview_locks(k, t.locks.length);
      }
      const sequenceChanged = !before || t.currentPattern !== before.currentPattern
        || t.chainEnabled !== before.chainEnabled || JSON.stringify(t.chain) !== JSON.stringify(before.chain)
        || JSON.stringify(t.roomPatterns) !== JSON.stringify(before.roomPatterns);
      if (sequenceChanged && t.roomPatterns) {
        this.w.preview_sequence_reset(k, t.currentPattern);
        const patterns = [...t.roomPatterns].sort((a, b) => (
          (a.id === t.currentPattern ? -1 : 0) - (b.id === t.currentPattern ? -1 : 0)
        ));
        for (const pattern of patterns) {
          const bytes = Uint8Array.from(pattern.bytes || []);
          this.write(bytes);
          if (!this.w.preview_pattern(k, pattern.id, pattern.length, bytes.length)) {
            throw new Error("The firmware rejected a shared pattern.");
          }
        }
        this.write(Uint8Array.from(t.chain || []));
        this.w.preview_chain(k, (t.chain || []).length, t.chainEnabled ? 1 : 0);
      }
      if (k < 3 && (changedSound || t.p[70] !== before.p[70] || JSON.stringify(t.fm6) !== JSON.stringify(before.fm6))) {
        this.write(t.fm6); this.w.preview_fm6(k);
      }
    });
    if (state.roomScenes && (!old || JSON.stringify(state.roomScenes) !== JSON.stringify(old.roomScenes))) {
      for (let scene = 0; scene < state.roomScenes.names.length; scene += 1) {
        for (let track = 0; track < state.tracks.length; track += 1) {
          this.w.preview_scene(scene, track, state.roomScenes.patterns[scene][track], state.roomScenes.names[scene]);
        }
      }
    }
    if (old && Number.isInteger(state.currentScene) && state.currentScene !== old.currentScene) {
      this.w.preview_scene_launch(state.currentScene);
    }
    state.samples?.forEach((s, k) => { this.write(s); this.w.preview_sample(k); });
    state.kits?.forEach((kit, k) => { this.write(kit); this.w.preview_kit(k); });
    this.previous = state;
  }
  render(left, right) {
    for (let i = 0; i < left.length; i++) {
      if (this.position >= this.frames) { this.w.preview_render(); this.position = 0; }
      left[i] = this.audio[this.position * 2]; right[i] = this.audio[this.position * 2 + 1];
      this.position++;
    }
  }
}

// Each room member has two isolated firmware instances: each renders three synth tracks and one drum track.
export class RoomFirmwareAudio {
  constructor(module) {
    this.players = Array.from({ length: 8 }, () => [new FirmwareAudio(module), new FirmwareAudio(module)]);
    this.active = Array.from({ length: 8 }, () => [false, false]);
    this.mutedSlots = Array(8).fill(false);
    this.soloSlot = null;
    this.left = new Float32Array(0);
    this.right = new Float32Array(0);
  }
  setMix(mutedSlots, soloSlot) {
    if (!Array.isArray(mutedSlots) || mutedSlots.length !== 8
      || !mutedSlots.every((muted) => typeof muted === "boolean")
      || !(soloSlot === null || (Number.isInteger(soloSlot) && soloSlot >= 0 && soloSlot < 8))) return;
    this.mutedSlots = [...mutedSlots];
    this.soloSlot = soloSlot;
  }
  sync(slot, group, state) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.players.length
      || !Number.isInteger(group) || group < 0 || group > 1) return;
    this.players[slot][group].sync(state);
    if (state.playing && Number.isFinite(state.roomBeat)) {
      const beat = Math.max(0, state.roomBeat);
      const whole = Math.floor(beat);
      this.players[slot][group].w.preview_phase(whole, Math.floor((beat - whole) * 1_000_000));
    }
    this.players[slot][group].w.preview_play(state.playing ? 1 : 0);
    this.active[slot][group] = !!state.hasVoice;
  }
  note(slot, track, note, on) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.players.length) return;
    if (!Number.isInteger(track) || track < 0 || track > 7) return;
    const group = Math.floor(track / 4);
    this.players[slot][group].w.preview_note(track % 4, note, on ? 1 : 0);
  }
  transport(slot, tempo, playing, beat) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.players.length) return;
    if (!Number.isInteger(tempo) || tempo < 40 || tempo > 240) return;
    for (let group = 0; group < 2; group += 1) {
      const dsp = this.players[slot][group];
      dsp.w.preview_global(0, tempo);
      if (playing && Number.isFinite(beat)) {
        const phase = Math.max(0, beat);
        const whole = Math.floor(phase);
        dsp.w.preview_phase(whole, Math.floor((phase - whole) * 1_000_000));
      }
      dsp.w.preview_play(playing ? 1 : 0);
    }
  }
  panic(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.players.length) return;
    for (const dsp of this.players[slot]) dsp.w.preview_panic();
  }
  drop(slot) {
    this.panic(slot);
    if (Number.isInteger(slot) && slot >= 0 && slot < this.active.length) this.active[slot] = [false, false];
  }
  render(left, right) {
    left.fill(0);
    right.fill(0);
    if (this.left.length !== left.length) {
      this.left = new Float32Array(left.length);
      this.right = new Float32Array(right.length);
    }
    const canHear = (slot) => !this.mutedSlots[slot] && (this.soloSlot === null || this.soloSlot === slot);
    const activePlayers = this.active.filter((groups, slot) => canHear(slot) && groups.some(Boolean)).length;
    if (!activePlayers) return;
    const gain = 0.25 / Math.sqrt(activePlayers);
    for (let slot = 0; slot < this.players.length; slot += 1) {
      const audible = canHear(slot);
      for (let group = 0; group < 2; group += 1) {
        if (!this.active[slot][group]) continue;
        this.left.fill(0);
        this.right.fill(0);
        this.players[slot][group].render(this.left, this.right);
        if (!audible) continue;
        for (let frame = 0; frame < left.length; frame += 1) {
          left[frame] += this.left[frame] * gain;
          right[frame] += this.right[frame] * gain;
        }
      }
    }
  }
}

// Guard permits the exact same adapter to be tested with Node, without Web Audio.
if (typeof registerProcessor === 'function') {
  class BoopBoxProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.dsp = new FirmwareAudio(options.processorOptions.module);
      this.meterFrames = 0;
      this.peak = 0;
      this.lastTransport = '';
      this.port.onmessage = ({ data }) => {
        try {
          if (data.type === 'state') this.dsp.sync(data.state);
          else if (data.type === 'note') this.dsp.w.preview_note(data.track, data.note, data.on ? 1 : 0);
          else if (data.type === 'play') this.dsp.w.preview_play(data.on ? 1 : 0);
          else if (data.type === 'panic') this.dsp.w.preview_panic();
          else if (data.type === 'hit') this.dsp.w.preview_hit(data.kit, data.lane, data.velocity);
        } catch (error) { this.port.postMessage({ error: error.message }); }
      };
    }
    process(_inputs, outputs) {
      this.dsp.render(outputs[0][0], outputs[0][1]);
      for (const channel of outputs[0])
        for (let i = 0; i < channel.length; i++) this.peak = Math.max(this.peak, Math.abs(channel[i]));
      this.meterFrames += outputs[0][0].length;
      const message = {}, transport = this.dsp.transport(), signature = transport.positions.join(',');
      if (signature !== this.lastTransport) {
        this.lastTransport = signature;
        message.transport = transport;
      }
      if (this.meterFrames >= 4096) {
        message.peak = this.peak;
        this.meterFrames = 0; this.peak = 0;
      }
      if (message.transport || message.peak != null) this.port.postMessage(message);
      return true;
    }
  }
  registerProcessor('boopbox-preview', BoopBoxProcessor);

  class BoopBoxRoomProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.dsp = new RoomFirmwareAudio(options.processorOptions.module);
      this.port.onmessage = ({ data }) => {
        try {
          if (data.type === 'state') this.dsp.sync(data.slot, data.group, data.state);
          else if (data.type === 'note') this.dsp.note(data.slot, data.track, data.note, data.on);
          else if (data.type === 'transport') this.dsp.transport(data.slot, data.tempo, data.playing, data.beat);
          else if (data.type === 'panic') this.dsp.panic(data.slot);
          else if (data.type === 'drop') this.dsp.drop(data.slot);
          else if (data.type === 'mix') this.dsp.setMix(data.mutedSlots, data.soloSlot);
        } catch (error) { this.port.postMessage({ error: error.message }); }
      };
    }
    process(_inputs, outputs) {
      this.dsp.render(outputs[0][0], outputs[0][1]);
      return true;
    }
  }
  registerProcessor('boopbox-room-preview', BoopBoxRoomProcessor);
}
