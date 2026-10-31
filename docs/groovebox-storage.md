# Storage: the project format

This page describes how BoopBox stores a project, and what it does when data is damaged or does not fit. BoopBox
1.0.0 has one project format ("FUN7"); it does not read SLOOP's four-track formats, and SLOOP does not read it. The source is `firmware/src/project.c` (the project), `firmware/src/patcodec.c`
(a pattern as bytes), `firmware/src/patbank.c` (the other patterns) and `firmware/src/storage.c` (flash objects).
Sections 2 to 5 are tested on the host; the tests are named at the end of each section. Section 6 says where a
test is missing. Section 7 comes from reading SLOOP's source, not from a test.

## 1. Where a project lives

| Place | What | Size |
| --- | --- | --- |
| `proj_slot[4]` (.noinit RAM) | the four song sections A..D. They survive a reset and UBOOT entry. | 4 x 3,840 B |
| flash, `OBJ_PROJECT0..3` | the same four sections, one A/B sector pair each (0x97000..0x9EFFF) | 3,840 B payload each |
| flash, `OBJ_AUTOSAVE` | the working project, saved when the transport is stopped and nothing sounds (A 0x9F000, B 0xFE000) | 3,840 B |
| song backup, editor backup | the same object, as bytes | 3,840 B |

The flash layer did not change. Each object has two sectors. A save erases the older copy, writes the payload from
offset 256, then writes the 32-byte header (magic "FELU", type, slot, sequence number, length, CRC-32 of the payload,
CRC of the header) last. On load, the valid copy with the highest sequence number wins, so a write that is cut by a
power loss leaves the previous copy in use.

The flash map did not change either: no new sector is used. All new data (patterns, components, locks 25..32,
harmony, the new globals) is inside the same 3,840-byte project object.

## 2. The format ("FUN7")

A project has a variable length:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | magic `0x46554E37` ("FUN7") |
| 4 | 4 | size: the bytes used, header included (12 .. 3,840) |
| 8 | 4 | check word: FNV-1a over the 4 size bytes (low first), then the data |
| 12 | size - 12 | chunks |

The bytes after `size` are zero, so two captures of the same state are the same bytes (the autosave uses this to
know if the project changed).

A chunk is a tag (1 byte), a length (2 bytes, low first) and its bytes. A reader skips a tag that it does not know,
so a later firmware can add chunks. A value is one byte (-127..127), or 0x80 followed by two bytes (`pw_v`). Every
value is clamped to its parameter's range when it is read.

| Tag | When written | Contents |
| --- | --- | --- |
| `G` | always | the writer's `G_COUNT`; a bit per global that is not at its default; those values. A reader with fewer globals reads past the extra ones. |
| `S` | always | the selected track |
| `T` | one per track (8) | index, kind (synth / drum), engine, preset; the count of common parameters (`P_E0`), a bit map of those not at their default and their values (the track's own values, not a lock that plays now: `trk_base`); the engine's eight parameters in the same way; a drum track's 16 sounds' TUNE / DECAY (16 bytes); the pattern that plays (see below); then, added with the patterns: the number of the pattern that plays, the chain length and the chain; then, added with the harmony: FOLLOW (`hfol`). |
| `H` | only when the progression or the live chord is not the default | the number of chords (1..8), then degree and bars for each |
| `P` | one per stored pattern in the bank | `track << 4 \| pattern`, the pattern's LEN, the pattern's bytes |

A track without a `T` chunk is set as at power-on. The fields added at the end of `T` are read only when there are
bytes left in the chunk, so a project written before they existed loads with pattern 1, no chain and FOLLOW OFF.

### A pattern as bytes (`pat_put` / `pat_get`)

The same codec is used in a `T` chunk (the pattern that plays) and in a `P` chunk (the other patterns), and by the
audio ISR when it changes patterns.

1. Steps: `0` and a 64-bit map of the steps that are not blank, then each of those steps; or `1` and all steps
   whole (when that is smaller).
2. Nudges and fill conditions: `0` none, `1` a map and one byte per marked step, or `2` one byte for each of the 64
   steps.
3. Locks: the count, then for each lock its step (bit 7: SLIDE), the parameter's code and the value. Up to 32 locks
   (`NLOCK`) a track.
4. Step components: the play direction, the random seed, the count, then 4 bytes for each component: step, type
   (PARAM is written as `type | 0x80`, its parameter coded as a lock's), value A, value B.

### Validation on load

- The magic, the size (12..3,840), the check word, and for an import the exact object size must all agree. If one
  of them is wrong, the project is refused and the slot reads as empty. Nothing is applied.
- A chunk whose length goes past the object stops the read. The chunks before it are applied; the tracks that had
  no chunk are set as at power-on.
- A value outside its range is clamped. A lock on a step past 64, on an unknown parameter or on one that cannot be
  locked, or a second lock of one parameter on one step, is dropped. A step component with an unknown type, a step past 64, a value out of range, or a second component of the
  same type on one step is dropped; the others are kept.
- A `P` entry for a track past 8 or a pattern past 8 is dropped; the other entries are loaded.
- An `H` chunk with a bad count is ignored (the default progression stays).

Tests: `tests/project_test.c` ("format 7: ..." checks: round trip of eight tracks, identical captures, import only
at its own size, a flipped bit / wrong size / wrong check word refused, an unknown chunk read past, a chunk longer
than the object), `tests/comp_test.c` (damaged components), `tests/pat_test.c` (a bank entry of track 10 /
pattern 16 dropped), `tests/harm_test.c` and `tests/lock_test.c` (their data saved and loaded).

## 3. Nothing is cut

A project object is at most 3,840 bytes. A save (`proj_capture`) first measures the size without writing.

1. If it fits, it is written.
2. If it does not fit, nothing is written. The slot keeps what it had and the UI says `PROJECT FULL: NOT SAVED`
   (the autosave says `TOO BIG TO AUTOSAVE`). The firmware never stores a part of a project.

Typical sizes: an eight-track project with ordinary patterns takes about 1.1 KB; four dense tracks take about
3.4 KB; eight dense tracks (about 6.4 KB) are refused whole. The pattern bank holds at most 3,072 bytes, which is
about what one project object can keep next to eight tracks' sounds and the patterns that play. A pattern change
or a copy that would overflow the bank is refused (`PATTERNS FULL: KEPT`, `PATTERNS FULL: NO COPY`); nothing is lost.

Tests: `tests/project_test.c` ("eight dense tracks do not fit: refused, the slot unchanged", "four dense tracks:
saved whole, or refused untouched"), `tests/pat_test.c` ("a full bank: the project saves whole (format 7) or is
refused, never cut").

## 4. SLOOP's projects are not read

SLOOP (and Felucca before it) stored four-track projects as "FUN1" .. "FUN6". BoopBox 1.0.0 reads none of them: a
section or an autosave in one of those formats reads as empty (`EMPTY SECTION`; at power-on, the default project),
and a backup object in one of them is refused (restore rc 2). BoopBox never writes them, so SLOOP cannot load a
BoopBox project either.

Tests: `tests/project_test.c` ("SLOOP's four-track projects (FUN1 .. FUN6): not a project, the slot unchanged"),
`tests/boot_sound_test.c` (a SLOOP working project in the flash: the default sounds at power-on),
`tests/editor_fuzz.c` (SLOOP images restored and found in the flash).

## 5. Versions of this format

Globals and track parameters are stored by index with their count, so a later BoopBox can add new ones at the end
of their group (the common parameters just before `P_E0`) and an older BoopBox reads past them. Chunks it does not
know are skipped. The fields at the end of a `T` chunk are read only when there are bytes left.

## 6. Other stored data

- Settings (`OBJ_SETTINGS`): `persist_t` (magic "PER3"), the SYN kits, then the MIDI part (`MIDI_PART_8` bytes:
  the MIDI LEARN map, MIDI's channels and switches, CH5..CH8, the MIDI LEARN bit of tracks 5..8 (`ml_hi`),
  MENU > SEQ > REC KNOBS), always all three. An object of another length (an older SLOOP's) keeps only its
  `persist_t` part (the panel calibration, palette, song order, lights); the SYN kits and the MIDI settings start at
  their defaults. Your theme (THM2) is in the side record; SLOOP 2.7's first-beta THM1 is not read.
- The song (persist object): the loop region is in the arrangement's two reserved bytes (`arranger.h`). An older
  firmware does not read them. The region logic is tested in `tests/pat_test.c` and `tests/song_ui_test.c`; there is no
  separate flash round-trip test for these two bytes (they are part of the arrangement, which is saved whole).
- Song sections are format 7 captures, so a section keeps its patterns, components, locks and FOLLOW. A section
  applies its tracks, the TEXTURE and the harmony globals; it keeps the tempo and the master.
- User presets: the format did not change. A save stores the track's own values (`trk_base`), not a lock that
  plays at that moment.

## 7. Going back to SLOOP

SLOOP reads formats 1..6 only. On SLOOP:

- a section saved by BoopBox shows as `EMPTY SECTION`. Its flash object stays as it is until a project is saved
  into that slot. If you install BoopBox again before that, the section is there again;
- the working project (autosave) saved by BoopBox is not loaded at power-on, and the next autosave of SLOOP
  replaces it.

The same holds the other way: projects saved by SLOOP are not read by BoopBox (section 4).
