// SPDX-License-Identifier: GPL-3.0-only
// The song page's FM-1 player on the audio thread: BoopBox's engines (boopbox-preview.wasm) playing the lesson's song
// (web/songplay.js programOf). Messages: load (the program), play, mute (a track), mode (the song, or a section on a
// loop). It reports where the song is ({ at: [entry, bar] }) and when it ends ({ ended: true }).
import { SongEngine } from "./songplay.js";

class SongProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine = new SongEngine(options.processorOptions.module, options.processorOptions.C);
    this.last = "";
    this.port.onmessage = ({ data }) => {
      try {
        if (data.type === "load") this.engine.load(data.prog);
        else if (data.type === "play") this.engine.play(data.on);
        else if (data.type === "mute") this.engine.mute(data.track, data.on);
        else if (data.type === "mode") this.engine.setMode(data.song, data.section);
      } catch (e) { this.port.postMessage({ error: e.message }); }
    };
  }
  process(_in, outputs) {
    this.engine.render(outputs[0][0], outputs[0][1]);
    const w = this.engine.where(), sig = w ? w.join(",") : "";
    if (sig !== this.last) { this.last = sig; this.port.postMessage({ at: w }); }
    if (this.engine.ended) { this.engine.ended = false; this.port.postMessage({ ended: true }); }
    return true;
  }
}
registerProcessor("boopbox-song", SongProcessor);
