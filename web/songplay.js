// SPDX-License-Identifier: GPL-3.0-only
//
// The song a lesson builds, as the FM-1 plays it, in the browser: the lesson's own steps (web/songgen.js) replayed on
// BoopBox's engines (the editor's WebAssembly, firmware/host/preview.c), so what the page plays is what the steps make.
// programOf gives the engine's calls; web/song-worklet.js makes them on the audio thread.

// the lesson's settings in order, as the FM-1 has them at its DONE: [op, ...args] for the engine (preview_*)
export function programOf(song, C) {
  const ops = [["init"]], TG = C.TG, tg = song.targets;
  const boopbox = new Map(Object.values(C.SOUNDS).map((s) => [`${s.engine}:${s.trainer}`, s.boopbox]));
  for (const c of song.cards) {
    if (c.goal === TG.TG_GLOBAL) ops.push(["global", c.p, c.v]);
    else if (c.goal === TG.TG_PARAM) ops.push(["param", c.trk, c.p, c.v]);
    else if (c.goal === TG.TG_SOUND) ops.push(["preset", c.trk, c.p, boopbox.get(`${c.p}:${c.v}`)]);
    else if (c.goal === TG.TG_KIT) ops.push(["param", c.trk, C.P.P_E0, c.v]);
    else if (c.goal === TG.TG_NOTES) {
      let o = c.data;
      const len = tg[o++];
      ops.push(["param", c.trk, C.P.P_SLEN, len]);
      for (let i = 0; i < len; i++) {
        const kind = tg[o++] & 3, b = new Array(12).fill(0);
        if (kind === 1) {
          const n = tg[o++];
          for (let j = 0; j < n; j++) b[j] = tg[o++];
          b[4] = n; b[5] = C.ST.ST_NOTE; b[7] = 100;
        } else b[5] = kind === 2 ? C.ST.ST_TIE : C.ST.ST_REST;
        ops.push(["step", c.trk, i, b]);
      }
    } else if (c.goal === TG.TG_LANES) {
      const o = c.data, len = tg[o], nl = tg[o + 1], on = new Array(len).fill(0);
      for (let l = 0; l < nl; l++) {
        const lane = tg[o + 2 + l * (len + 1)];
        for (let s = 0; s < len; s++) if (tg[o + 3 + l * (len + 1) + s] & 0x10) on[s] |= 1 << lane;
      }
      for (let s = 0; s < len; s++) ops.push(["step", c.trk, s, [on[s] & 255, on[s] >> 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
    }
  }
  return ops;
}
export const PART_TRACK = { drums: 3, bass: 0, chords: 1, lead: 2 };

// the engine (an instance of boopbox-preview.wasm) running a program; render gives `frames` stereo frames
export class SongEngine {
  constructor(module, C) {
    this.w = new WebAssembly.Instance(module, {}).exports;
    this.w._initialize?.();
    this.w.preview_init();                             // (the audio thread renders before the first song arrives: a
    this.C = C;                                        //  state of zeros would divide by a tempo of 0)
    this.frames = this.w.preview_frames();
    this.pos = this.frames;
  }
  load(ops) {
    const w = this.w;
    w.preview_play(0);
    for (const [op, ...a] of ops) {
      if (op === "init") w.preview_init();
      else if (op === "global") w.preview_global(a[0], a[1]);
      else if (op === "param") w.preview_param(a[0], a[1], a[2]);
      else if (op === "preset") w.preview_preset(a[0], a[1], a[2]);
      else if (op === "step") {
        new Uint8Array(w.memory.buffer, w.preview_buffer(), 12).set(a[2]);
        w.preview_step(a[0], a[1]);
      }
    }
    this.audio = new Float32Array(w.memory.buffer, w.preview_render(), this.frames * 2);
    if (this.want) w.preview_play(1);                  // (a new song while playing: it plays on)
  }
  mute(k, on) { this.w.preview_param(k, this.C.P.P_MUTE, on ? 1 : 0); }
  play(on) { this.want = !!on; this.idle = 0; this.w.preview_play(on ? 1 : 0); }
  position(k) { return this.w.preview_position(k); }
  render(left, right) {
    for (let i = 0; i < left.length; i++) {
      if (this.pos >= this.frames) {
        if (this.want && [0, 1, 2, 3].every((k) => this.w.preview_position(k) < 0) && ++this.idle % 64 === 0)
          this.w.preview_play(1);                      // (asked to play and still stopped: ask again)
        this.audio = new Float32Array(this.w.memory.buffer, this.w.preview_render(), this.frames * 2);
        this.pos = 0;
      }
      left[i] = this.audio[this.pos * 2]; right[i] = this.audio[this.pos * 2 + 1];
      this.pos++;
    }
  }
}
