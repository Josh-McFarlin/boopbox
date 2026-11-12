// SPDX-License-Identifier: GPL-3.0-only
// (1.8) The BoopBox emulator's engine: the whole firmware (boopbox-emu.wasm, firmware/host/emu.c) runs here, in the
// audio thread, as the FM-1 runs its main loop between its audio interrupts: emu_render() gives a block of sound and,
// every ~16 ms of it, makes the main loop's pass (the screen, the LEDs, the autosave). The page sends the panel's
// input; this sends back the screen when it changed, the LEDs, and the flash when the firmware wrote it.
const NLED = 41;                                  // buttons 0..13, note keys 14..40 (emu_led ids)

class BoopBoxEmu extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { module, flash } = options.processorOptions;
    this.roomMode = !!options.processorOptions.roomMode;
    this.e = new WebAssembly.Instance(module, {}).exports;
    this.e.emu_init();
    if (flash && flash.byteLength === this.e.emu_flash_size())
      new Uint8Array(this.e.memory.buffer, this.e.emu_flash(), flash.byteLength).set(new Uint8Array(flash));
    this.e.emu_boot();
    this.n = this.e.emu_frames();
    this.buf = new Float32Array(0);               // what the last block left over (the firmware's blocks are 32 frames)
    this.lastScreen = -1;
    this.lastLeds = "";
    this.sent = 0;
    this.roomHeld = new Map();
    this.port.onmessage = ({ data }) => this.input(data);
  }
  input(m) {
    const e = this.e;
    switch (m.t) {
      case "key":
        e.emu_key(m.k, m.down ? 1 : 0, m.vel || 100);
        if (this.roomMode) {
          const key = m.k;
          const voice = m.down ? {
            track: e.emu_room_selected_track(), note: e.emu_room_note(key),
          } : this.roomHeld.get(key);
          if (voice && voice.note < 128) {
            if (m.down) this.roomHeld.set(key, voice);
            else this.roomHeld.delete(key);
            this.port.postMessage({
              t: "room-note", track: voice.track, note: voice.note, down: !!m.down, velocity: m.vel || 100,
            });
          }
        }
        break;
      case "button": e.emu_button(m.b, m.down ? 1 : 0); break;
      case "knob": e.emu_knob(m.e, m.s | 0); break;
      case "master": e.emu_master(m.v | 0); break;
      case "room-snapshot": {
        const size = e.emu_room_capture();
        if (!size) {
          this.port.postMessage({ t: "room-snapshot-error", error: "The emulator performance could not be read." });
          break;
        }
        const project = new Uint8Array(e.memory.buffer, e.emu_room_project_ptr(), size).slice();
        const tracks = Array.from({ length: 8 }, (_, track) => ({
          engine: e.emu_room_engine(track),
          preset: e.emu_room_preset(track),
          p: Array.from({ length: 71 }, (_, param) => e.emu_room_param(track, param)),
        }));
        this.port.postMessage({
          t: "room-snapshot", project: project.buffer, tracks, tempo: e.emu_room_tempo(),
          playing: !!e.emu_room_playing(),
        }, [project.buffer]);
        break;
      }
      case "flash": {                             // the page asks for the flash (a download of it)
        const f = new Uint8Array(e.memory.buffer, e.emu_flash(), e.emu_flash_size()).slice();
        this.port.postMessage({ t: "flash", flash: f.buffer, ask: true }, [f.buffer]);
        break;
      }
    }
  }
  pull() {                                        // one firmware block, interleaved stereo
    const p = this.e.emu_render();
    return new Float32Array(this.e.memory.buffer, p, this.n * 2);
  }
  report() {
    const e = this.e;
    const sn = e.emu_screen_n();
    if (sn !== this.lastScreen) {
      this.lastScreen = sn;
      const s = new Uint16Array(e.memory.buffer, e.emu_screen(), 240 * 240).slice();
      this.port.postMessage({ t: "screen", px: s.buffer }, [s.buffer]);
    }
    let leds = "";
    for (let i = 0; i < NLED; i++) leds += e.emu_led(i);
    if (leds !== this.lastLeds) {
      this.lastLeds = leds;
      this.port.postMessage({ t: "leds", leds });
    }
    if (e.emu_flash_dirty()) {
      const f = new Uint8Array(e.memory.buffer, e.emu_flash(), e.emu_flash_size()).slice();
      this.port.postMessage({ t: "flash", flash: f.buffer }, [f.buffer]);
    }
  }
  process(_inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0], len = L.length;
    let i = 0;
    while (i < len) {
      if (!this.buf.length) {
        this.buf = this.pull();
        this.pos = 0;
      }
      while (this.pos < this.buf.length && i < len) {
        L[i] = this.buf[this.pos];
        R[i] = this.buf[this.pos + 1];
        this.pos += 2;
        i++;
      }
      if (this.pos >= this.buf.length) this.buf = new Float32Array(0);
    }
    if (currentTime - this.sent > 0.015) {        // (the screen and the LEDs: ~60 times a second at most)
      this.sent = currentTime;
      this.report();
    }
    return true;
  }
}
registerProcessor("boopbox-emu", BoopBoxEmu);
