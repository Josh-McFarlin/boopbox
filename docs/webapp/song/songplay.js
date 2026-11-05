// SPDX-License-Identifier: GPL-3.0-only
//
// The song a lesson builds, as the FM-1 plays it, in the browser: the lesson's own steps (web/songgen.js) replayed on
// BoopBox's engines (the editor's WebAssembly, firmware/host/preview.c), so what the page plays is what the steps make.
// programOf gives the engine's calls; web/song-worklet.js makes them on the audio thread.

// the lesson replayed as the FM-1 has it at its DONE: { base: [op, ...] (the sounds, the parameters), sections: [the
// steps and the mutes of each section, as saved], song: [[section, bars], ...] (none: one loop), bpm }
export function programOf(song, C) {
  const base = [["init"]], TG = C.TG, tg = song.targets;
  const boopbox = new Map(Object.values(C.SOUNDS).map((s) => [`${s.engine}:${s.trainer}`, s.boopbox]));
  const pats = [0, 1, 2, 3].map(() => ({})), cur = [1, 1, 1, 1], len = [16, 16, 16, 16], saved = [];
  let muted = 0, entries = [], bpm = 120;
  const snapshot = () => ({ pats: cur.slice(), muted });
  for (const c of song.cards) {
    if (c.goal === TG.TG_GLOBAL) { base.push(["global", c.p, c.v]); if (c.p === C.G.G_BPM) bpm = c.v; }
    else if (c.goal === TG.TG_PARAM) { base.push(["param", c.trk, c.p, c.v]); if (c.p === C.P.P_SLEN) len[c.trk] = c.v; }
    else if (c.goal === TG.TG_SOUND) base.push(["preset", c.trk, c.p, boopbox.get(`${c.p}:${c.v}`)]);
    else if (c.goal === TG.TG_KIT) base.push(["param", c.trk, C.P.P_E0, c.v]);
    else if (c.goal === TG.TG_PATSEL) cur[c.trk] = c.v + 1;
    else if (c.goal === TG.TG_PATS) { for (let k = 0; k < 4; k++) if (tg[c.data + k] !== 255) cur[k] = tg[c.data + k] + 1; }
    else if (c.goal === TG.TG_MUTES) muted = c.v & c.p;
    else if (c.goal === TG.TG_SAVED) saved[c.v] = snapshot();
    else if (c.goal === TG.TG_SONG && !(c.flags & 1)) {
      const o = c.data;
      entries = Array.from({ length: tg[o] }, (_, k) => [tg[o + 1 + 2 * k], tg[o + 2 + 2 * k]]);
    } else if (c.goal === TG.TG_NOTES) {
      let o = c.data;
      const n = tg[o++], steps = [];
      len[c.trk] = n;
      for (let i = 0; i < n; i++) {
        const kind = tg[o++] & 3, b = new Array(12).fill(0);
        if (kind === 1) {
          const m = tg[o++];
          for (let j = 0; j < m; j++) b[j] = tg[o++];
          b[4] = m; b[5] = C.ST.ST_NOTE; b[7] = 100;
        } else b[5] = kind === 2 ? C.ST.ST_TIE : C.ST.ST_REST;
        steps.push(b);
      }
      pats[c.trk][cur[c.trk]] = steps;
    } else if (c.goal === TG.TG_LANES) {
      const o = c.data, n = tg[o], nl = tg[o + 1], on = new Array(n).fill(0);
      for (let l = 0; l < nl; l++) {
        const lane = tg[o + 2 + l * (n + 1)];
        for (let s = 0; s < n; s++) if (tg[o + 3 + l * (n + 1) + s] & 0x10) on[s] |= 1 << lane;
      }
      pats[c.trk][cur[c.trk]] = on.map((m) => [m & 255, m >> 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }
  const snaps = saved.filter(Boolean).length ? saved : [snapshot()];
  const rest = (k) => (k === 3 ? new Array(12).fill(0) : [0, 0, 0, 0, 0, C.ST.ST_REST, 0, 0, 0, 0, 0, 0]);
  const sections = snaps.map((s) => {                 // a section's calls: each track's pattern, then the mutes
    const ops = [];
    for (let k = 0; k < 4; k++) {
      const steps = pats[k][s.pats[k]] || [];
      ops.push(["param", k, C.P.P_SLEN, len[k]]);
      for (let i = 0; i < C.NSTEP; i++) ops.push(["step", k, i, steps[i] || rest(k)]);
      ops.push(["param", k, C.P.P_MUTE, (s.muted >> k) & 1]);
    }
    return ops;
  });
  return { base, sections, song: saved.length ? entries : [], bpm };
}
export const PART_TRACK = { drums: 3, bass: 0, chords: 1, lead: 2 };

// the engine (an instance of boopbox-preview.wasm) playing a program: the song (its sections in turn, bar by bar) or
// one section on a loop; render gives stereo frames
export class SongEngine {
  constructor(module, C) {
    this.w = new WebAssembly.Instance(module, {}).exports;
    this.w._initialize?.();
    this.w.preview_init();                             // (the audio thread renders before the first song arrives: a
    this.C = C;                                        //  state of zeros would divide by a tempo of 0)
    this.frames = this.w.preview_frames();
    this.rate = this.w.preview_rate();
    this.pos = this.frames;
    this.prog = null;
    this.mode = { song: false, section: 0 };
    this.muteUser = [0, 0, 0, 0];
  }
  run(ops) {
    const w = this.w;
    for (const [op, ...a] of ops) {
      if (op === "init") w.preview_init();
      else if (op === "global") w.preview_global(a[0], a[1]);
      else if (op === "param") {
        if (a[1] === this.C.P.P_MUTE) this.sectionMute[a[0]] = a[2];
        w.preview_param(a[0], a[1], a[1] === this.C.P.P_MUTE ? (a[2] || this.muteUser[a[0]]) : a[2]);
      } else if (op === "preset") w.preview_preset(a[0], a[1], a[2]);
      else if (op === "step") {
        new Uint8Array(w.memory.buffer, w.preview_buffer(), 12).set(a[2]);
        w.preview_step(a[0], a[1]);
      }
    }
  }
  load(prog) {                                         // (a program, or the plain list of calls of before)
    this.prog = Array.isArray(prog) ? { base: prog, sections: [[]], song: [], bpm: 120 } : prog;
    this.sectionMute = [0, 0, 0, 0];
    this.w.preview_play(0);
    this.run(this.prog.base);
    this.at = -1;
    this.enter(this.mode.song && this.prog.song.length ? this.prog.song[0][0] : this.mode.section);
    if (this.want) this.start();
  }
  enter(s) {                                           // a section's patterns and mutes
    if (!this.prog || s === this.at) return;
    this.at = s;
    this.run(this.prog.sections[Math.min(s, this.prog.sections.length - 1)] || []);
  }
  // song: the sections in turn; else section s on a loop
  setMode(song, s = 0) { this.mode = { song: !!song, section: s }; if (this.prog) { this.at = -1; this.enter(song && this.prog.song.length ? this.prog.song[0][0] : s); } }
  mute(k, on) { this.muteUser[k] = on ? 1 : 0; this.w.preview_param(k, this.C.P.P_MUTE, on || this.sectionMute?.[k] ? 1 : 0); }
  start() {
    this.played = 0;
    this.entry = 0;
    if (this.mode.song && this.prog?.song.length) { this.at = -1; this.enter(this.prog.song[0][0]); }
    this.w.preview_play(1);
  }
  play(on) { this.want = !!on; this.idle = 0; if (on) this.start(); else this.w.preview_play(0); }
  position(k) { return this.w.preview_position(k); }
  // where the song is: [entry, bar in it] (null: not in song mode)
  where() {
    if (!this.mode.song || !this.prog?.song.length || !this.want) return null;
    const bar = Math.floor(this.played / ((240 / this.prog.bpm) * this.rate));
    let e = 0, b = bar;
    while (e < this.prog.song.length && b >= this.prog.song[e][1]) { b -= this.prog.song[e][1]; e++; }
    return e < this.prog.song.length ? [e, b] : null;
  }
  render(left, right) {
    for (let i = 0; i < left.length; i++) {
      if (this.pos >= this.frames) {
        if (this.want && [0, 1, 2, 3].every((k) => this.w.preview_position(k) < 0) && ++this.idle % 64 === 0)
          this.w.preview_play(1);                      // (asked to play and still stopped: ask again)
        if (this.want && this.mode.song && this.prog?.song.length) {   // the song: the section of the bar coming
          const w = this.where();
          if (!w) { this.want = false; this.w.preview_play(0); this.ended = true; }
          else this.enter(this.prog.song[w[0]][0]);
        }
        this.audio = new Float32Array(this.w.memory.buffer, this.w.preview_render(), this.frames * 2);
        if (this.want) this.played += this.frames;
        this.pos = 0;
      }
      left[i] = this.audio[this.pos * 2]; right[i] = this.audio[this.pos * 2 + 1];
      this.pos++;
    }
  }
}
