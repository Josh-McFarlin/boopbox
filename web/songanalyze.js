// SPDX-License-Identifier: GPL-3.0-only
//
// An audio file to a score the trainer can teach (web/songgen.js), in the browser and with nothing sent anywhere:
//   split    the drums from the rest (harmonic / percussive separation of the spectrogram, median filters)
//   tempo    from the onsets (their autocorrelation, near 110 BPM preferred), the beat's phase, the bar from the kick
//   drums    kick, snare, hats: each lane's onsets on the sixteenths of the bars, folded into one bar
//   notes    Basic Pitch (Spotify's note model, web/vendor/basic-pitch) on the part without drums
//   key      the notes' pitch classes against the major and minor profiles (Krumhansl)
//   parts    a bass line (a note a beat, four bars), a chord a bar (the scale's triads), a lead (eighths, two bars);
//            every note moved into the FM-1's key range and onto the key (the keys play the scale)
// Plain functions on Float32Arrays: tests/trainer_analyze_test.mjs runs the same code in Node.

import { SCALE_STEPS, DRUM_LANES, intoKeys } from "./songgen.js";

export const RATE = 22050;                           // Basic Pitch's rate, and the analysis'
const N = 2048, HOP = 256;

// ---- the signal
export function mono(channels) {
  const n = channels[0].length, out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  return out;
}
export function resample(x, from, to = RATE) {       // (a low-pass of the ratio first: no fold-back)
  if (from === to) return x;
  const r = from / to, n = Math.floor(x.length / r), out = new Float32Array(n), w = Math.max(1, Math.round(r));
  let acc = 0;
  const box = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { acc += x[i]; if (i >= w) acc -= x[i - w]; box[i] = acc / Math.min(i + 1, w); }
  for (let i = 0; i < n; i++) {
    const t = i * r + (w - 1) / 2, j = Math.floor(t), f = t - j;
    out[i] = (box[Math.min(j, x.length - 1)] * (1 - f) + box[Math.min(j + 1, x.length - 1)] * f);
  }
  return out;
}

// ---- FFT (radix 2, in place) and the STFT
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
const HANN = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
export function stft(x) {
  const frames = Math.max(1, Math.floor((x.length - N) / HOP) + 1), bins = N / 2 + 1;
  const re = new Float32Array(frames * bins), im = new Float32Array(frames * bins);
  const fr = new Float64Array(N), fi = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { fr[i] = (x[f * HOP + i] || 0) * HANN[i]; fi[i] = 0; }
    fft(fr, fi);
    for (let b = 0; b < bins; b++) { re[f * bins + b] = fr[b]; im[f * bins + b] = fi[b]; }
  }
  return { re, im, frames, bins };
}
function istft(S, mask, length) {                     // overlap-add, the window squared normalised
  const { re, im, frames, bins } = S, out = new Float32Array(length), norm = new Float32Array(length);
  const fr = new Float64Array(N), fi = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bins; b++) {
      const m = mask[f * bins + b];
      fr[b] = re[f * bins + b] * m; fi[b] = -im[f * bins + b] * m;       // (the inverse: conjugate, forward, conjugate)
      if (b > 0 && b < bins - 1) { fr[N - b] = fr[b]; fi[N - b] = -fi[b]; }
    }
    fft(fr, fi);
    for (let i = 0; i < N; i++) {
      const j = f * HOP + i;
      if (j >= length) break;
      out[j] += (fr[i] / N) * HANN[i]; norm[j] += HANN[i] * HANN[i];
    }
  }
  for (let i = 0; i < length; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return out;
}
const MB = new Float32Array(64);
function median(a) {                                  // (small windows: an insertion sort in one buffer)
  const n = a.length;
  for (let i = 0; i < n; i++) {
    let v = a[i], j = i - 1;
    while (j >= 0 && MB[j] > v) { MB[j + 1] = MB[j]; j--; }
    MB[j + 1] = v;
  }
  return MB[n >> 1];
}

// the drums apart from the rest: masks from a median along time (what holds: notes) and along frequency (what is
// broad and short: hits); returns both parts as audio and the magnitudes
const tick = () => new Promise((r) => setTimeout(r, 0));   // (the page keeps drawing while it works)
export async function separate(x, onProgress = () => {}) {
  const S = stft(x), { frames, bins } = S, mag = new Float32Array(frames * bins);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(S.re[i], S.im[i]);
  const H = new Float32Array(mag.length), P = new Float32Array(mag.length), K = 8, w = new Float32Array(2 * K + 1);
  for (let f = 0; f < frames; f++) {
    if (f % 64 === 0) { onProgress(f / frames); await tick(); }
    for (let b = 0; b < bins; b++) {
      for (let k = -K; k <= K; k++) w[k + K] = mag[Math.min(frames - 1, Math.max(0, f + k)) * bins + b];
      H[f * bins + b] = median(w);
      for (let k = -K; k <= K; k++) w[k + K] = mag[f * bins + Math.min(bins - 1, Math.max(0, b + k))];
      P[f * bins + b] = median(w);
    }
  }
  const mh = new Float32Array(mag.length), mp = new Float32Array(mag.length);
  for (let i = 0; i < mag.length; i++) {
    const h = H[i] * H[i], p = P[i] * P[i], s = h + p + 1e-12;
    mh[i] = h / s; mp[i] = p / s;
  }
  onProgress(1);
  return { harmonic: istft(S, mh, x.length), percussive: istft(S, mp, x.length), mag, mp, frames, bins };
}

// ---- tempo, beats, bars
const hz = (b) => (b * RATE) / N;
function bandFlux(mag, mask, frames, bins, lo, hi) {   // the rise of a band's log energy, frame by frame
  const b0 = Math.max(1, Math.round((lo * N) / RATE)), b1 = Math.min(bins - 1, Math.round((hi * N) / RATE));
  const e = new Float32Array(frames), out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let b = b0; b <= b1; b++) { const m = mag[f * bins + b] * (mask ? mask[f * bins + b] : 1); s += m * m; }
    e[f] = Math.log1p(s * 1e3);
  }
  for (let f = 1; f < frames; f++) out[f] = Math.max(0, e[f] - e[f - 1]);
  return out;
}
export function tempoOf(env, lo = 70, hi = 170, fps = RATE / HOP) {
  const mean = env.reduce((a, b) => a + b, 0) / env.length, x = env.map((v) => v - mean);
  let best = null;
  for (let bpm = lo; bpm <= hi; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (const m of [1, 2, 4]) {                       // (the beat, two and four beats: a bar's worth)
      const L = lag * m, l0 = Math.floor(L), fl = L - l0;
      for (let i = 0; i + l0 + 1 < x.length; i++) s += x[i] * (x[i + l0] * (1 - fl) + x[i + l0 + 1] * fl) / m;
    }
    s *= Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.6) ** 2);   // (a prior: most songs are near 110)
    if (!best || s > best.s) best = { bpm, s };
  }
  return Math.round(best.bpm);
}
function at(env, t) { const i = Math.floor(t), f = t - i; return (env[i] || 0) * (1 - f) + (env[i + 1] || 0) * f; }
export function gridOf(env, kick, bpm, frames, fps = RATE / HOP) {   // the first downbeat, in frames; frames a step
  const beat = (60 / bpm) * fps, step = beat / 4;
  let best = 0, bs = -1;
  for (let o = 0; o < beat; o += 0.25) {
    let s = 0;
    for (let t = o; t < frames; t += beat) s += Math.max(at(env, t - 1), at(env, t), at(env, t + 1));
    if (s > bs) { bs = s; best = o; }
  }
  let bar = 0, ks = -1;                                // the bar: the beat of the four with the most kick
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let t = best + k * beat; t < frames; t += 4 * beat) s += Math.max(at(kick, t - 1), at(kick, t), at(kick, t + 1));
    if (s > ks) { ks = s; bar = k; }
  }
  return { first: best + bar * beat, step };
}

// ---- drums
// each lane's strength on the sixteenths of the bars, folded into one bar (a step's window looks ahead almost half a
// step: a swung sixteenth comes late); then the lanes from their strengths and what most songs do: the snare on the
// backbeat when it stands out there (its body is in the kick's band too), a kick there only when it is far the strongest
function stepStrength(env, grid, bars, frames) {
  const v = new Float32Array(16);
  for (let b = 0; b < bars; b++) {
    const t0 = grid.first + b * 16 * grid.step;
    if (t0 + 16 * grid.step >= frames) break;
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * grid.step;
      let m = 0;
      for (let k = Math.floor(t - 1); k <= t + grid.step * 0.45; k++) m = Math.max(m, env[k] || 0);
      v[s] += m;
    }
  }
  const max = Math.max(...v) || 1;
  return Array.from(v, (x) => x / max);
}
export function drumsOf(sep, grid, bars) {
  const { mag, mp, frames, bins } = sep;
  const K = stepStrength(bandFlux(mag, mp, frames, bins, 30, 140), grid, bars, frames);
  const M = stepStrength(bandFlux(mag, mp, frames, bins, 150, 1000), grid, bars, frames);
  const H = stepStrength(bandFlux(mag, mp, frames, bins, 7000, 10500), grid, bars, frames);
  const others = [0, 2, 6, 8, 10, 14].map((s) => M[s]), mean = others.reduce((a, b) => a + b) / others.length;
  const back = (M[4] + M[12]) / 2 > mean * 1.15 || Math.min(M[4], M[12]) >= 0.7;   // (or strong there at least)
  const SNARE = new Array(16).fill(0);
  if (back) SNARE[4] = SNARE[12] = 1;
  const KICK = K.map((k, s) => (k >= 0.42 && (!SNARE[s] || k >= 0.8) ? 1 : 0));
  const HAT = H.map((h, s) => (h >= 0.45 && !(SNARE[s] && h < 0.7) ? 1 : 0));
  if (!KICK.some(Boolean)) KICK[0] = 1;
  return { KICK, SNARE, HAT, strength: { K, M, H } };
}

// ---- notes: Basic Pitch
export async function notesOf(audio22050, bp, onProgress = () => {}) {
  // bp: { BasicPitch, outputToNotesPoly, noteFramesToTime, model } (web/vendor/basic-pitch, loaded by the page)
  const model = new bp.BasicPitch(bp.model), frames = [], onsets = [];
  await model.evaluateModel(audio22050, (f, o) => { frames.push(...f); onsets.push(...o); }, onProgress);
  return bp.noteFramesToTime(bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5))
    .map((n) => ({ t: n.startTimeSeconds, d: n.durationSeconds, p: n.pitchMidi, a: n.amplitude }));
}

// ---- key, and the parts
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) {
  const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < 12; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return s / Math.sqrt(sa * sb || 1);
}
export function keyOf(notes) {
  const h = new Array(12).fill(0);
  for (const n of notes) h[n.p % 12] += n.d * n.a;
  let best = { r: -2 };
  for (let root = 0; root < 12; root++)
    for (const [scale, prof] of [["MAJ", MAJ], ["MIN", MIN]]) {
      const r = corr(h, prof.map((_, i) => prof[(i - root + 12) % 12]));
      if (r > best.r) best = { r, root, scale };
    }
  return { root: best.root, scale: best.scale };
}
export function snap(note, root, scale) {             // onto the key: the nearest note of the scale (down on a tie)
  const steps = SCALE_STEPS[scale];
  for (let d = 0; d < 12; d++)
    for (const s of [-d, d]) if (steps.includes((((note + s - root) % 12) + 12) % 12)) return note + s;
  return note;
}
function into(note, lo, hi) { while (note < lo) note += 12; while (note > hi) note -= 12; return note; }
function lineOf(notes, t0, stepSec, n, lo, hi, pick) {   // a note a step: the one picked of those starting in it
  const out = new Array(n).fill(null);
  for (let s = 0; s < n; s++) {
    const a = t0 + (s - 0.5) * stepSec, b = t0 + (s + 0.5) * stepSec;
    const here = notes.filter((x) => x.t >= a && x.t < b && x.p >= lo && x.p <= hi);
    if (here.length) out[s] = here.reduce(pick).p;
  }
  return out;
}
export function chordsOf(notes, t0, barSec, bars, key) {
  const steps = SCALE_STEPS[key.scale], out = [];
  for (let b = 0; b < bars; b++) {
    const a = t0 + b * barSec, z = a + barSec, c = new Array(12).fill(0);
    for (const n of notes) {
      const o = Math.min(z, n.t + n.d) - Math.max(a, n.t);
      if (o > 0 && n.p >= 45 && n.p <= 84) c[n.p % 12] += o * n.a;
    }
    let best = 0, bs = -1;
    for (let d = 0; d < 7; d++) {                      // the scale's triads: root, third, fifth
      const pcs = [0, 2, 4].map((k) => (key.root + steps[(d + k) % 7]) % 12);
      const s = c[pcs[0]] * 1.2 + c[pcs[1]] + c[pcs[2]];
      if (s > bs) { bs = s; best = d; }
    }
    const root = into(key.root + steps[best], 53, 64);
    out.push([0, 2, 4].map((k) => {
      const deg = best + k, up = Math.floor(deg / 7) * 12;
      return root - steps[best] + steps[deg % 7] + up;
    }));
  }
  return out;
}

// the score of `bars` bars from the first downbeat: what the page shows, plays and teaches
export function scoreOf({ notes, sep, frames, bpm, grid, key }, opts = {}) {
  const fps = RATE / HOP, stepSec = grid.step / fps, t0 = grid.first / fps, barSec = 16 * stepSec;
  const drums = drumsOf(sep, grid, opts.drumBars || 8);
  const bass = intoKeys(lineOf(notes, t0, 4 * stepSec, 16, 24, 55, (x, y) => (y.p < x.p ? y : x))
    .map((p) => (p == null ? null : snap(into(p, 45, 60), key.root, key.scale))));
  const leadDiv = opts.leadDiv || "1/8", ls = leadDiv === "1/16" ? stepSec : 2 * stepSec;
  const lead = intoKeys(lineOf(notes.filter((n) => n.a > 0.25), t0, ls, 16, 60, 96, (x, y) => (y.p > x.p ? y : x))
    .map((p) => (p == null ? null : snap(into(p, 65, 84), key.root, key.scale))));
  const chords = chordsOf(notes, t0, barSec, opts.chordBars || 4, key);
  return {
    bpm, root: key.root, scale: key.scale,
    drums: { lanes: Object.fromEntries(DRUM_LANES.map((l) => [l, drums[l] || new Array(16).fill(0)])) },
    bass: bass.some((x) => x != null) ? { div: "1/4", steps: bass } : null,
    chords: { steps: chords },
    lead: lead.filter((x) => x != null).length >= 3 ? { div: leadDiv, steps: lead } : null,
    t0, barSec,
  };
}

// ---- the song's form: the whole file, cheaply (no separation, no notes): its tempo and bars, then each block of four
// bars as a fingerprint (its harmony, loudness, low end, highs, onsets), similar blocks grouped into up to four sections
const SH = 512;                                       // (the structure's hop: 23 ms)
export async function structureOf(x, onProgress = () => {}) {
  const fps = RATE / SH, frames = Math.max(1, Math.floor((x.length - N) / SH) + 1), bins = N / 2 + 1;
  const env = new Float32Array(frames), low = new Float32Array(frames), chroma = new Float32Array(frames * 12);
  const loud = new Float32Array(frames), lowE = new Float32Array(frames), highE = new Float32Array(frames);
  const pc = new Int8Array(bins).fill(-1), fr = new Float64Array(N), fi = new Float64Array(N);
  for (let b = 1; b < bins; b++) { const f = hz(b); if (f >= 55 && f <= 2000) pc[b] = ((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12; }
  const b150 = Math.round((150 * N) / RATE), b5k = Math.round((5000 * N) / RATE), b10k = Math.round((10000 * N) / RATE);
  let prev = new Float32Array(bins), lowPrev = 0;
  for (let f = 0; f < frames; f++) {
    if (f % 512 === 0) { onProgress(f / frames); await tick(); }
    for (let i = 0; i < N; i++) { fr[i] = (x[f * SH + i] || 0) * HANN[i]; fi[i] = 0; }
    fft(fr, fi);
    let flux = 0, e = 0, le = 0, he = 0;
    for (let b = 1; b < bins; b++) {
      const m = Math.hypot(fr[b], fi[b]), l = Math.log1p(m);
      if (b <= b10k) flux += Math.max(0, l - prev[b]);
      prev[b] = l;
      e += m * m;
      if (b <= b150) le += m * m; else if (b >= b5k) he += m * m;
      if (pc[b] >= 0) chroma[f * 12 + pc[b]] += m;
    }
    env[f] = flux; loud[f] = e; lowE[f] = le; highE[f] = he;
    const ll = Math.log1p(le * 1e3);
    low[f] = Math.max(0, ll - lowPrev); lowPrev = ll;
  }
  onProgress(1);
  const bpm = tempoOf(env, 70, 170, fps), grid = gridOf(env, low, bpm, frames, fps), barF = 16 * grid.step;
  const nbars = Math.floor((frames - grid.first) / barF), nblocks = Math.floor(nbars / 4);
  // a block's fingerprint: its mean chroma (shape only), then loudness, low end, highs, onsets (as z-scores)
  const raw = [];
  for (let k = 0; k < nblocks; k++) {
    const a = Math.floor(grid.first + k * 4 * barF), z = Math.floor(grid.first + (k + 1) * 4 * barF);
    const c = new Array(12).fill(0);
    let e = 0, le = 0, he = 0, on = 0;
    for (let f = a; f < z; f++) {
      for (let j = 0; j < 12; j++) c[j] += chroma[f * 12 + j];
      e += loud[f]; le += lowE[f]; he += highE[f]; on += env[f];
    }
    const n = Math.hypot(...c) || 1;
    raw.push({ c: c.map((v) => v / n), e: Math.log10(e / (z - a) + 1e-9), le: Math.log10(le / (z - a) + 1e-9),
               he: Math.log10(he / (z - a) + 1e-9), on: on / (z - a) });
  }
  const zs = (k) => {
    const v = raw.map((r) => r[k]), m = v.reduce((a, b) => a + b, 0) / (v.length || 1);
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length || 1)) || 1;
    return v.map((x) => (x - m) / sd);
  };
  const ze = zs("e"), zl = zs("le"), zh = zs("he"), zo = zs("on"), emax = Math.max(...raw.map((r) => r.e));
  const blocks = raw.map((r, k) => ({ k, quiet: r.e < emax - 1.5,   // (more than 15 dB under the loudest: a fade, silence)
                                      v: [...r.c.map((x) => x * 3), ze[k] * 0.6, zl[k] * 0.8, zh[k] * 0.8, zo[k] * 0.8] }));
  return { bpm, fps, first: grid.first, barF, barSec: barF / fps, blocks, nbars, ...formOf(blocks) };
}
const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
// the blocks grouped (average linkage, at most four groups, none closer than TAU), the song as its runs of groups
export const TAU = 1.1;                        // (tuned on the trainer's renders: within a section < 1.2, between > 1.9)
export function formOf(blocks, most = 4, tau = TAU) {
  const live = blocks.filter((b) => !b.quiet);
  if (!live.length) return { entries: [], sections: [] };
  const first = live[0].k, last = live[live.length - 1].k, body = blocks.slice(first, last + 1);
  let groups = body.filter((b) => !b.quiet).map((b) => [b]);
  const link = (g, h) => { let s = 0; for (const a of g) for (const b of h) s += dist(a.v, b.v); return s / (g.length * h.length); };
  for (;;) {
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) { const d = link(groups[i], groups[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
    if (bi < 0 || (groups.length <= most && bd > tau)) break;
    groups[bi] = groups[bi].concat(groups[bj]);
    groups.splice(bj, 1);
  }
  const of = new Map();
  groups.forEach((g, i) => g.forEach((b) => of.set(b.k, i)));
  let label = body.map((b) => (of.has(b.k) ? of.get(b.k) : null));
  for (let i = 0; i < label.length; i++) if (label[i] == null) label[i] = i ? label[i - 1] : label.find((x) => x != null);
  // the groups named A, B, C, D in the order they come
  const order = [];
  for (const g of label) if (!order.includes(g)) order.push(g);
  label = label.map((g) => order.indexOf(g));
  let entries = [];
  for (const g of label) {
    if (entries.length && entries[entries.length - 1][0] === g && entries[entries.length - 1][1] + 4 <= 64) entries[entries.length - 1][1] += 4;
    else entries.push([g, 4]);
  }
  while (entries.length > 16) {                       // (the FM-1's song: 16 entries) the shortest into its neighbour
    let i = 0;
    for (let j = 1; j < entries.length; j++) if (entries[j][1] < entries[i][1]) i = j;
    const n = i ? i - 1 : 1;
    entries[n][1] = Math.min(64, entries[n][1] + entries[i][1]);
    entries.splice(i, 1);
    for (let j = entries.length - 1; j > 0; j--) if (entries[j][0] === entries[j - 1][0]) { entries[j - 1][1] = Math.min(64, entries[j - 1][1] + entries[j][1]); entries.splice(j, 1); }
  }
  const sections = order.map((_, g) => {               // each section's most typical block (its medoid)
    const mine = body.filter((b, i) => label[i] === g && !b.quiet);
    let best = mine[0], bs = Infinity;
    for (const a of mine) { const s = mine.reduce((t, b) => t + dist(a.v, b.v), 0); if (s < bs) { bs = s; best = a; } }
    return { block: best.k, blocks: mine.length };
  });
  return { entries, sections, firstBlock: first, label };
}

// the whole song: its form (structureOf), then each section's most typical four bars listened to closely (the drums
// apart, the notes), one key for all; returns the sections' scores and the song
export async function analyzeSong(x, bp, onStage = () => {}) {
  onStage("form", 0);
  const st = await structureOf(x, (p) => onStage("form", p));
  const fps = RATE / HOP, bar = st.barSec, out = [];
  for (let i = 0; i < st.sections.length; i++) {
    const at = (st.first + st.sections[i].block * 4 * st.barF) / st.fps;   // (seconds: the block's first downbeat)
    const from = Math.max(0, at - bar / 2), to = Math.min(x.length / RATE, at + 4 * bar + bar / 4);
    const w = x.subarray(Math.floor(from * RATE), Math.floor(to * RATE));
    const sep = await separate(w, (p) => onStage("section", (i + p * 0.3) / st.sections.length, st));
    const notes = await notesOf(sep.harmonic, bp, (p) => onStage("section", (i + 0.3 + p * 0.7) / st.sections.length, st));
    let pe = 0;
    for (const v of sep.percussive) pe += v * v;
    // the bar line again, here and finer (the form's hop is 23 ms): the song's tempo, the beat's phase in these bars,
    // the downbeat nearest the form's
    const env = bandFlux(sep.mag, null, sep.frames, sep.bins, 30, 10000), kick = bandFlux(sep.mag, sep.mp, sep.frames, sep.bins, 30, 150);
    const g = gridOf(env, kick, st.bpm, sep.frames), beat = 4 * g.step, want = (at - from) * fps;
    let first = g.first;
    while (first + 2 * beat <= want) first += 4 * beat;   // (a bar at a time: the same downbeat)
    while (first - 2 * beat > want) first -= 4 * beat;
    if (Math.abs(first - want) > beat / 2) first = want;  // (not near: the form's)
    out.push({ at: from + first / fps, from, sep, notes, frames: sep.frames, perc: Math.sqrt(pe / w.length),
               grid: { first, step: g.step } });
  }
  const key = keyOf(out.flatMap((s) => s.notes));
  onStage("done", 1);
  return { bpm: st.bpm, key, barSec: bar, structure: st, sections: out, entries: st.entries,
           songStart: st.first / st.fps + st.firstBlock * 4 * bar };
}
// the song's score (web/songgen.js): the sections' parts (a part a section has not: null), the song
export function songScoreOf(r, opts = {}) {
  const pmax = Math.max(...r.sections.map((s) => s.perc)) || 1;
  const sections = r.sections.map((s) => {
    const sc = scoreOf({ notes: s.notes, sep: s.sep, frames: s.frames, bpm: r.bpm, grid: s.grid, key: opts.key || r.key }, opts);
    const drums = s.perc / pmax > 0.3 ? sc.drums : null;
    const chordNotes = s.notes.filter((n) => n.p >= 45 && n.p <= 84).length;
    return { drums, bass: sc.bass, chords: chordNotes >= 4 ? sc.chords : null, lead: sc.lead, t0: s.from + sc.t0 };
  });
  return { bpm: r.bpm, root: (opts.key || r.key).root, scale: (opts.key || r.key).scale, sections, song: r.entries,
           barSec: r.barSec, songStart: r.songStart };
}

// the whole analysis of one stretch of a song (x: mono at RATE)
export async function analyze(x, bp, onStage = () => {}) {
  onStage("split", 0);
  const sep = await separate(x, (p) => onStage("split", p));
  onStage("tempo", 0);
  const env = bandFlux(sep.mag, null, sep.frames, sep.bins, 30, 10000);
  const kick = bandFlux(sep.mag, sep.mp, sep.frames, sep.bins, 30, 150);
  const bpm = tempoOf(env), grid = gridOf(env, kick, bpm, sep.frames);
  onStage("notes", 0);
  const notes = await notesOf(sep.harmonic, bp, (p) => onStage("notes", p));
  const key = keyOf(notes);
  onStage("done", 1);
  return { sep, notes, bpm, grid, key, frames: sep.frames };
}
export { hz, bandFlux as _bandFlux };
