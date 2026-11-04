// SPDX-License-Identifier: GPL-3.0-only
//
// The TRAINER's song area (level 4) in the browser: a song encoded for the FM-1, and a BoopBox Trainer package (.fwsc)
// with that song written into its app image, every CRC made again, ready for the installer. Byte for byte what
// tools/trainer/slot.py does (tests/run_tests.sh compares the two); the format is in slot.py and firmware/src/trainer.c.

export const MAGIC = "BOOPSONG";
export const SLOT_SIZE = 8192;
export const VERSION = 1;
export const KEY = 0x980f;
const HEAD_MAX = 23, ACT_MAX = 30, NAME_MAX = 16, LINE_MAX = 28;
export const TG_DONE = 18;                            // firmware/src/trainer.c TG_*: the last step (the level's DONE)

// ---- checksums and the JieLi ciphers (tools/fm1pkg_make.py)
const T16 = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1;
    t[i] = c & 0xffff;
  }
  return t;
})();
export function crc16(d, crc = 0) {
  for (let i = 0; i < d.length; i++) crc = ((crc << 8) & 0xffff) ^ T16[((crc >> 8) ^ d[i]) & 0xff];
  return crc;
}
const T32 = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
export function crc32(d) {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = T32[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function enc(b, off, size, key = 0xffff) {
  for (let i = 0; i < size; i++) {
    b[off + i] ^= key & 0xff;
    key = ((key << 1) ^ (key & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
}
function sfc(b, off, size, base, key) {
  for (let i = 0; i < size; i += 32) enc(b, off + i, Math.min(size - i, 32), key ^ ((off + i - base) >> 2));
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const p16 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; };
const p32 = (b, o, v) => { p16(b, o, v & 0xffff); p16(b, o + 2, (v >>> 16) & 0xffff); };
const ascii = (b, o, s) => { for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false; return true; };

// ---- a song
// song: { name, style, learn1, learn2, targets: bytes, cards: [{ head, act, goal, trk, p, btn, v, tol, flags, data, why }] }
// (numbers as the firmware has them: tools/trainer/consts.json); returns the whole area (SLOT_SIZE bytes)
export function encodeSong(song) {
  const cards = song.cards, tg = Uint8Array.from(song.targets || []);
  if (cards.length < 2 || cards.length > 128) throw new Error(`a song has 2 to 128 steps (this one ${cards.length})`);
  if (cards.some((c, i) => (c.goal === TG_DONE) !== (i === cards.length - 1)))
    throw new Error("a song's last step, and only that one, is its DONE");
  const strs = [], at = new Map();
  const text = (s, max, what) => {
    if (typeof s !== "string" || s.length > max || !/^[ -~]*$/.test(s) || s !== s.toUpperCase())
      throw new Error(`${what}: upper-case ASCII, at most ${max} characters: ${JSON.stringify(s)}`);
    if (!at.has(s)) { at.set(s, -1); strs.push(s); }
    return s;
  };
  [song.name, song.style, song.learn1, song.learn2].forEach((s, i) => text(s, i ? LINE_MAX : NAME_MAX, "the picker's line"));
  for (const c of cards) { text(c.head, HEAD_MAX, "a step's headline"); text(c.act, ACT_MAX, "a step's action"); }
  const tOff = 32 + 16 * cards.length;
  let o = tOff + tg.length;
  for (const s of strs) { at.set(s, o); o += s.length + 1; }
  if (o > SLOT_SIZE) throw new Error(`the song is ${o} B, the FM-1 has room for ${SLOT_SIZE}`);
  const b = new Uint8Array(SLOT_SIZE).fill(0xff);
  for (let i = 0; i < 8; i++) b[i] = MAGIC.charCodeAt(i);
  b.fill(0, 16, o);
  b[16] = cards.length;
  p16(b, 18, tOff); p16(b, 20, tg.length);
  [song.name, song.style, song.learn1, song.learn2].forEach((s, i) => p16(b, 22 + 2 * i, at.get(s)));
  cards.forEach((c, i) => {
    const q = 32 + 16 * i;
    p16(b, q, at.get(c.head)); p16(b, q + 2, at.get(c.act));
    b[q + 4] = c.goal; b[q + 5] = c.trk ?? 255; b[q + 6] = c.p ?? 0; b[q + 7] = c.btn;
    p16(b, q + 8, (c.v ?? 0) & 0xffff); b[q + 10] = c.tol ?? 0; b[q + 11] = c.flags ?? 0;
    p16(b, q + 12, c.data ?? 0); b[q + 14] = c.why ?? 0; b[q + 15] = 0;
  });
  b.set(tg, tOff);
  for (const s of strs) for (let i = 0; i < s.length; i++) b[at.get(s) + i] = s.charCodeAt(i);
  p16(b, 8, o); p16(b, 10, VERSION);
  p32(b, 12, crc32(b.subarray(16, o)));
  return b;
}
export function emptySong() {
  const b = new Uint8Array(SLOT_SIZE).fill(0xff);
  for (let i = 0; i < 8; i++) b[i] = MAGIC.charCodeAt(i);
  return b;
}
// what an area holds: null (no song) or { name, cards, used }
export function describeSong(slot) {
  const used = u16(slot, 8);
  if (used === 0xffff) return null;
  if (used > SLOT_SIZE || used < 32 || u16(slot, 10) !== VERSION || crc32(slot.subarray(16, used)) !== u32(slot, 12))
    return { damaged: true };
  const s = (o) => { let e = o; while (slot[e]) e++; return String.fromCharCode(...slot.subarray(o, e)); };
  return { name: s(u16(slot, 22)), style: s(u16(slot, 24)), cards: slot[16], used };
}

// ---- the package: .fwsc -> logical image (UFW) -> flash.bin -> app area (SFC) -> app.bin
const BLOCKS = 20, BLK = 0x30, KEEP = 0x2f;
function unmark(fwsc) {
  const out = new Uint8Array(fwsc.length - BLOCKS);
  for (let i = 0; i < BLOCKS; i++) out.set(fwsc.subarray(i * BLK, i * BLK + KEEP), i * KEEP);
  out.set(fwsc.subarray(BLOCKS * BLK), BLOCKS * KEEP);
  return out;
}
function mark(lg, fwsc) {
  const out = new Uint8Array(fwsc.length);
  for (let i = 0; i < BLOCKS; i++) {
    out.set(lg.subarray(i * KEEP, (i + 1) * KEEP), i * BLK);
    out[i * BLK + KEEP] = fwsc[i * BLK + KEEP];
  }
  out.set(lg.subarray(BLOCKS * KEEP), BLOCKS * BLK);
  return out;
}
function findSlot(app) {
  let at = -1, n = 0;
  for (let i = 0; i + SLOT_SIZE <= app.length; i += 4)
    if (app[i] === 0x42 && ascii(app, i, MAGIC)) { at = i; n++; }
  if (n !== 1) throw new Error("this package has no song area: it is not a BoopBox Trainer package with level 4");
  return at;
}
function open(fwsc, key) {
  const lg = unmark(fwsc), hdr = lg.slice(0, 0x40);
  enc(hdr, 0, 0x40);
  if (!ascii(hdr, 16, "AC791N") || crc16(hdr.subarray(2, 0x40)) !== u16(hdr, 0)) throw new Error("not an FM-1 package");
  const nfiles = u16(hdr, 8), ents = [];
  for (let i = 0; i < nfiles; i++) { const e = lg.slice(0x40 + 0x50 * i, 0x90 + 0x50 * i); enc(e, 0, 0x50); ents.push(e); }
  const fe = ents.find((e) => ascii(e, 0x40, "flash.bin\0"));
  if (!fe) throw new Error("no flash.bin in the package");
  const off = u32(fe, 8), n = u32(fe, 12), a0 = off + 0x4000;
  const head = lg.slice(a0, a0 + 32);
  sfc(head, 0, 32, 0, key);
  if (!ascii(head, 16, "app_area_head") || crc16(head.subarray(2, 32)) !== u16(head, 0))
    throw new Error("the package's app area does not decrypt");
  const blk = u32(head, 8), area = lg.slice(a0, a0 + blk);
  sfc(area, 0, blk, 0, key);
  if (!ascii(area, 48, "app.bin\0")) throw new Error("no app.bin in the package");
  return { lg, hdr, ents, fe, off, n, a0, blk, area, aoff: u32(area, 36), asz: u32(area, 40) };
}
// the song area of a package as it is (SLOT_SIZE bytes)
export function songAreaOf(fwsc, key = KEY) {
  const P = open(fwsc, key), app = P.area.subarray(P.aoff, P.aoff + P.asz), at = findSlot(app);
  return app.slice(at, at + SLOT_SIZE);
}
// the package with `slot` (encodeSong / emptySong) in its song area
export function patchPackage(fwsc, slot, key = KEY) {
  if (slot.length !== SLOT_SIZE) throw new Error("a song area is 8 KiB");
  const P = open(fwsc, key), { lg, hdr, ents, fe, area } = P;
  const app = area.subarray(P.aoff, P.aoff + P.asz);
  app.set(slot, findSlot(app));
  p16(area, 34, crc16(app));                          // app.bin's entry: its data CRC, then the entry's own
  p16(area, 32, crc16(area.subarray(34, 64)));
  p16(area, 2, crc16(area.subarray(32, P.blk)));      // app_area_head: the area's CRC, then its own
  p16(area, 0, crc16(area.subarray(2, 32)));
  sfc(area, 0, P.blk, 0, key);
  lg.set(area, P.a0);
  p16(fe, 4, crc16(lg.subarray(P.off, P.off + P.n)));  // flash.bin's CRC in the UFW list
  const lst = new Uint8Array(0x50 * ents.length);
  ents.forEach((e, i) => { const x = e.slice(); enc(x, 0, 0x50); lst.set(x, 0x50 * i); });
  lg.set(lst, 0x40);
  p16(hdr, 2, crc16(lst));
  p16(hdr, 0, crc16(hdr.subarray(2, 0x40)));
  enc(hdr, 0, 0x40);
  lg.set(hdr, 0);
  return mark(lg, fwsc);
}
