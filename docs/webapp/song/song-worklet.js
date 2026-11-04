// SPDX-License-Identifier: GPL-3.0-only
// The song page's FM-1 player on the audio thread: BoopBox's engines (boopbox-preview.wasm) playing the lesson's song
// (web/songplay.js programOf). Messages: load (the program), play, mute (a track), C (the firmware's numbers).
import { SongEngine } from "./songplay.js";

class SongProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine = new SongEngine(options.processorOptions.module, options.processorOptions.C);
    this.last = "";
    this.port.onmessage = ({ data }) => {
      try {
        if (data.type === "load") this.engine.load(data.ops);
        else if (data.type === "play") this.engine.play(data.on);
        else if (data.type === "mute") this.engine.mute(data.track, data.on);
      } catch (e) { this.port.postMessage({ error: e.message }); }
    };
  }
  process(_in, outputs) {
    this.engine.render(outputs[0][0], outputs[0][1]);
    const pos = [0, 1, 2, 3].map((k) => this.engine.position(k)).join(",");
    if (pos !== this.last) { this.last = pos; this.port.postMessage({ positions: pos.split(",").map(Number) }); }
    return true;
  }
}
registerProcessor("boopbox-song", SongProcessor);
