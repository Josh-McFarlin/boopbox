#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The TRAINER's song area: level 4, a song made elsewhere (the trainer's web page), in the trainer's app image.

The trainer build reserves SLOT_SIZE bytes in its app (firmware/src/trainer.c TR_SLOT): the magic, then 0xFF (no song).
A song is written into that area of a trainer package (.fwsc) before it is installed; the firmware checks it at power-on
and shows it as level 4 when it is whole. Installing the package again with another song replaces it (the update loader
rewrites only the sectors that changed). web/trslot.js does the same in the browser; tests/run_tests.sh checks that the
two agree byte for byte and that a patched package is the package fm1pkg_make.py builds from the patched app.

  slot.py patch IN.fwsc SONG.bin OUT.fwsc     the song into a trainer package
  slot.py clear IN.fwsc OUT.fwsc              the song area emptied
  slot.py show IN.fwsc                        what the package's song area holds

The song area (little-endian; offsets from its start; firmware/src/trainer.c tr_slot_load checks every field):
  0   8  "BOOPSONG"
  8   2  bytes used (header included), 0xFFFF: no song
  10  2  format version (1)
  12  4  CRC-32 (zlib) of bytes [16, used)
  16  1  cards (2..TR_C4MAX, the last one TG_DONE)
  17  1  0
  18  2  the targets' offset   20  2  their length
  22  8  the picker's lines: name, style, learn1, learn2 (offsets of NUL-terminated strings)
  30  2  0
  32  16 a card: head, act (string offsets), goal, track, p, button, v (int16), tol, flags, data (int16 as the firmware
         reads it: an offset in the targets, or a page + 1), why (a topic), 0
"""
import os
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import fm1pkg_make as P  # noqa: E402

MAGIC = b"BOOPSONG"
SLOT_SIZE = 8192
VERSION = 1
BLOCKS, BLK, KEEP = 20, 0x30, 0x2F


def song_crc(slot):
    used = struct.unpack_from("<H", slot, 8)[0]
    return zlib.crc32(bytes(slot[16:used])) & 0xFFFFFFFF


def seal(song):
    """a song's bytes (header with used = len, the CRC filled in) padded to the area with 0xFF"""
    s = bytearray(song)
    assert s[:8] == MAGIC and len(s) <= SLOT_SIZE, "not a song (BOOPSONG, at most 8 KiB)"
    struct.pack_into("<HH", s, 8, len(s), VERSION)
    struct.pack_into("<I", s, 12, zlib.crc32(bytes(s[16:])) & 0xFFFFFFFF)
    return bytes(s) + b"\xFF" * (SLOT_SIZE - len(s))


def empty():
    return MAGIC + b"\xFF" * (SLOT_SIZE - len(MAGIC))


def find(app):
    """the song area's offset in an app image: the one place with the magic (an empty area, or a song)"""
    at = [i for i in range(0, len(app) - SLOT_SIZE + 1, 4) if app[i:i + 8] == MAGIC]
    if len(at) != 1:
        raise SystemExit(f"slot: {len(at)} song areas in the app (want 1): not a trainer image with a song area")
    return at[0]


# ---- the package: .fwsc -> logical image (UFW) -> flash.bin -> app area (SFC) -> app.bin
def unmark(fwsc):
    out = bytearray()
    for i in range(BLOCKS):
        out += fwsc[i * BLK:i * BLK + KEEP]
    return out + fwsc[BLOCKS * BLK:], fwsc


def mark(logical, fwsc):
    raw = bytearray()
    for i in range(BLOCKS):
        raw += logical[i * KEEP:(i + 1) * KEEP] + fwsc[i * BLK + KEEP:i * BLK + BLK]
    return bytes(raw + logical[BLOCKS * KEEP:])


def dec_entry(b):
    x = bytearray(b)
    P.enc(x, 0, len(x))
    return x


def patch(fwsc, slot, key=P.KEY):
    """the package with its song area set to `slot` (SLOT_SIZE bytes), every CRC on the way out made again"""
    assert len(slot) == SLOT_SIZE
    lg, orig = unmark(bytearray(fwsc))
    hdr = dec_entry(lg[0:0x40])
    nfiles = struct.unpack_from("<H", hdr, 8)[0]
    if hdr[16:22] != P.UFW_CHIP or P.crc16(hdr[2:0x40]) != struct.unpack_from("<H", hdr, 0)[0]:
        raise SystemExit("slot: not an FM-1 package (UFW header)")
    ents = [dec_entry(lg[0x40 + 0x50 * i:0x90 + 0x50 * i]) for i in range(nfiles)]
    fi = [i for i, e in enumerate(ents) if e[0x40:0x49] == b"flash.bin"]
    if len(fi) != 1:
        raise SystemExit("slot: no flash.bin in the package")
    fe = ents[fi[0]]
    off, n = struct.unpack_from("<II", fe, 8)
    flash = lg[off:off + n]
    # the app area: app_area_head (32 B), then the entries; SFC per 32-byte block from flash 0x4000
    a0 = 0x4000
    head = bytearray(flash[a0:a0 + 32])
    P.sfc(head, 0, 32, 0, key)
    blk = struct.unpack_from("<I", head, 8)[0]
    if head[16:29] != b"app_area_head" or P.crc16(head[2:32]) != struct.unpack_from("<H", head, 0)[0]:
        raise SystemExit("slot: the app area does not decrypt (another chip key?)")
    area = bytearray(flash[a0:a0 + blk])
    P.sfc(area, 0, blk, 0, key)
    e0 = area[32:64]                                    # the first entry: app.bin
    if e0[16:23] != b"app.bin":
        raise SystemExit("slot: no app.bin in the app area")
    aoff, asz = struct.unpack_from("<II", e0, 4)
    app = area[aoff:aoff + asz]
    at = find(app)
    app[at:at + SLOT_SIZE] = slot
    area[aoff:aoff + asz] = app
    body = bytearray(e0[2:])
    struct.pack_into("<H", body, 0, P.crc16(app))
    area[32:64] = struct.pack("<H", P.crc16(body)) + body
    hb = bytearray(area[2:32])
    struct.pack_into("<H", hb, 0, P.crc16(area[32:blk]))
    area[0:32] = struct.pack("<H", P.crc16(hb)) + hb
    P.sfc(area, 0, blk, 0, key)
    flash[a0:a0 + blk] = area
    lg[off:off + n] = flash
    struct.pack_into("<H", fe, 4, P.crc16(flash))
    lst = bytearray()
    for e in ents:
        x = bytearray(e)
        P.enc(x, 0, 0x50)
        lst += x
    lg[0x40:0x40 + len(lst)] = lst
    struct.pack_into("<H", hdr, 2, P.crc16(lst))
    struct.pack_into("<H", hdr, 0, P.crc16(hdr[2:0x40]))
    P.enc(hdr, 0, 0x40)
    lg[0:0x40] = hdr
    return mark(lg, orig)


def app_of(fwsc, key=P.KEY):
    """the app image in a package (for show, and the tests)"""
    lg, _ = unmark(bytearray(fwsc))
    hdr = dec_entry(lg[0:0x40])
    nfiles = struct.unpack_from("<H", hdr, 8)[0]
    for i in range(nfiles):
        e = dec_entry(lg[0x40 + 0x50 * i:0x90 + 0x50 * i])
        if e[0x40:0x49] == b"flash.bin":
            off, n = struct.unpack_from("<II", e, 8)
            area = bytearray(lg[off + 0x4000:off + n])
            head = bytearray(area[:32])
            P.sfc(head, 0, 32, 0, key)
            blk = struct.unpack_from("<I", head, 8)[0]
            area = area[:blk]
            P.sfc(area, 0, blk, 0, key)
            aoff, asz = struct.unpack_from("<II", area, 32 + 4)
            return bytes(area[aoff:aoff + asz])
    raise SystemExit("slot: no flash.bin")


def describe(slot):
    used, ver = struct.unpack_from("<HH", slot, 8)
    if used == 0xFFFF:
        return "no song"
    if used > SLOT_SIZE or used < 32 or ver != VERSION:
        return f"damaged (used {used}, version {ver})"
    if song_crc(slot) != struct.unpack_from("<I", slot, 12)[0]:
        return "damaged (CRC)"
    names = struct.unpack_from("<4H", slot, 22)
    s = lambda o: bytes(slot[o:slot.index(0, o)]).decode("ascii", "replace")
    return f"{s(names[0])} ({s(names[1])}): {slot[16]} cards, {used} of {SLOT_SIZE} B"


def main(argv):
    if len(argv) == 4 and argv[0] == "patch":
        song = open(argv[2], "rb").read()               # a song as web/trslot.js encodes it, or a whole area
        out = patch(open(argv[1], "rb").read(), song if len(song) == SLOT_SIZE else seal(song))
    elif len(argv) == 3 and argv[0] == "clear":
        out = patch(open(argv[1], "rb").read(), empty())
        argv = argv[:2] + [None, argv[2]]
    elif len(argv) == 2 and argv[0] == "show":
        app = app_of(open(argv[1], "rb").read())
        at = find(app)
        print(f"song area at app offset 0x{at:x}: {describe(app[at:at + SLOT_SIZE])}")
        return
    else:
        raise SystemExit(__doc__)
    open(argv[3], "wb").write(out)
    print(f"slot: {argv[3]} ({len(out)} B)")


if __name__ == "__main__":
    main(sys.argv[1:])
