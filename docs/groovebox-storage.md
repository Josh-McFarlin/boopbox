# Storage: the project format

This page tells how BoopBox stores a project. It also tells what BoopBox does when data is damaged or too large.
It applies to BoopBox 1.9.3.

BoopBox has one project format, format 7 ("FUN7"). BoopBox does not read the four-track formats of SLOOP. SLOOP does
not read format 7.

The source files are:

| File | What it holds |
| --- | --- |
| `firmware/src/project.c` | the project format, the autosave and the settings object |
| `firmware/src/patcodec.c` | a pattern as bytes |
| `firmware/src/patbank.c` | the patterns that do not play, and the scenes |
| `firmware/src/storage.c` | the flash objects |

The host tests check sections 1 to 5. Each section names its tests at the end. Section 6 tells where a test is
missing. Section 7 comes from a reading of the source of SLOOP, not from a test.

## 1. Where a project lives

| Place | What | Size |
| --- | --- | --- |
| `proj_slot[4]` (`.noinit` RAM) | The four song sections A..D. They stay after a reset and after UBOOT entry. | 4 × 3,840 B |
| Flash, `OBJ_PROJECT0..3` | The same four sections, one A/B sector pair each, at 0x97000..0x9EFFF. | 3,840 B payload each |
| Flash, `OBJ_AUTOSAVE` | The working project. Copy A is at 0x9F000. Copy B is at 0xFE000. | 3,840 B |
| Editor backup objects 0 and 2..5 | Object 0 is the working project. Objects 2..5 are the sections A..D. They are the same bytes as the flash objects. | 3,840 B |

The autosave occurs when the transport is stopped and nothing sounds. The panel must be idle for 2.5 s
(`AUTOSAVE_IDLE`). Two autosaves are a minimum of 20 s apart (`AUTOSAVE_GAP`).

### The flash layer

Each object has two sectors of 4,096 B, copy A and copy B. A save writes to the copy that is not the current copy:

1. The save erases the sector.
2. It writes the payload from offset 256.
3. It writes the 32-byte header at offset 0. This step is always the last step.

The header has these fields:

| Field | Size | Contents |
| --- | --- | --- |
| `magic` | 4 | `0x554C4546` ("FELU") |
| `type` | 2 | the object number (below) |
| `slot` | 2 | the copy that the save wrote: 0 (A) or 1 (B) |
| `seq` | 4 | the sequence number |
| `len` | 4 | the payload length (maximum 3,840) |
| `crc` | 4 | the CRC-32 (zlib) of the payload |
| `rsv` | 8 | reserved |
| `hcrc` | 4 | the CRC-32 of the header |

On load, the valid copy with the highest sequence number is the current copy. On a tie, copy A is the current copy.
If power fails during a write, the previous copy stays in use.

A sector can also hold a side record at bytes 64..255. The settings object uses it (section 6).

### The flash map

The flash map did not change for the groovebox upgrade. All new data is inside the same 3,840-byte project object.

| Flash | What | Object |
| --- | --- | --- |
| 0x97000..0x9EFFF | the sections A..D | `OBJ_PROJECT0..3` (1..4) |
| 0x9F000 | the working project, copy A | `OBJ_AUTOSAVE` (7) |
| 0xA0000..0xDBFFF | the user sample slots USR1..USR3 (`eng_sample.c`) | not a `storage.c` object |
| 0xDC000..0xDFFFF | the user preset banks | `OBJ_UPRESET0..1` (5, 6) |
| 0xE5000, 0xE6000 | the FM6 patch bank | `OBJ_FM6BANK` (8) |
| 0xE7000..0xFAFFF | the user sample slot USR4 (`eng_sample.c`) | not a `storage.c` object |
| 0xFB000 | the progress log of BoopBox Trainer (`trainer.c` `TR_LOG`), trainer build only | not a `storage.c` object |
| 0xFC000, 0xFD000 | the settings | `OBJ_SETTINGS` (0) |
| 0xFE000 | the working project, copy B | `OBJ_AUTOSAVE` (7) |

Tests: `tests/storage_test.c` (A/B copies, torn writes, damaged copies, zlib CRC-32, the side record, each copy in its
own sector).

## 2. The format ("FUN7")

A project has a variable length:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | magic `0x46554E37` ("FUN7") |
| 4 | 4 | size: the bytes used, header included (12 .. 3,840) |
| 8 | 4 | check word: FNV-1a over the 4 size bytes (low byte first), then over the data |
| 12 | size − 12 | chunks |

The bytes after `size` are zero. Thus two captures of the same state are the same bytes.

A chunk is a tag (1 byte), a length (2 bytes, low byte first) and its bytes. A reader skips a tag that it does not
know. Thus a later firmware can add chunks.

A value is one byte (−127..127), or 0x80 and then two bytes, low byte first (`pw_v`). The reader clamps each value
to the range of its parameter.

The writer writes the chunks in this order:

| Tag | When written | Contents |
| --- | --- | --- |
| `G` | always | The `G_COUNT` of the writer. Then one bit for each global that is not at its default. Then those values. A reader with fewer globals reads past the extra values. |
| `S` | always | The selected track. |
| `T` | one for each track (8) | See *The `T` chunk* below. |
| `H` | only when the progression or the live chord is not the default | The number of chords (1..8). Then the degree and the bars of each chord. |
| `P` | one for each pattern in the bank | `track << 4 \| pattern`, the LEN of the pattern, then the bytes of the pattern. |
| `C` | only when the scenes are not the default | The number of scenes (8). Then for each scene: its name (an index into `N_SCN` in `patbank.c`) and 4 bytes. See *The `C` chunk* below. |

In the default scenes, scene N plays pattern N on each track and has no name.

### The `T` chunk

A `T` chunk has these fields, in this order:

1. The index, the kind (0 synth, 1 drum), the engine and the preset. A drum track writes 0 for the engine and the
   preset.
2. The number of common parameters (`P_E0`). Then a bit map of the common parameters that are not at their default.
   Then those values.
3. One byte of bit map for the eight engine parameters. Then those values.
4. For a drum track only: 16 bytes, one for each sound. Bits 0..3 are TUNE. Bits 4..6 are DECAY.
5. The pattern that plays (`pat_put`, below).
6. The number of the pattern that plays.
7. The chain: one byte with the slot count (0..16) in bits 0..6. Bit 7 set means that the PLAY of the chain is off.
   Then one byte for each slot. Bits 0..2 are the pattern. Bits 4..7 are the repeats minus 1.
8. FOLLOW (`hfol`).

The values in fields 2 and 3 are the own values of the track (`trk_base`), not a lock that plays at that time.

The reader reads fields 6 to 8 only when the chunk has bytes left. Thus a project from before these fields loads
with pattern 1, no chain and FOLLOW OFF. A project from before chain repeats has 0 in bits 4..7, so each slot plays
one time.

A track with no `T` chunk loads as at power-on.

### The `C` chunk

Each scene has a name byte and 4 bytes of patterns. Each pattern byte holds two tracks, one in each nibble. Track 2i
is in the low nibble. Track 2i + 1 is in the high nibble. The value 8 (`SCN_KEEP`) means that the track keeps the
pattern that it plays.

### A pattern as bytes (`pat_put` / `pat_get`)

The `T` chunk and the `P` chunk use the same codec. The audio ISR also uses it when it changes patterns. The codec
writes four parts:

1. **Steps.** Either `0`, a 64-bit map of the steps that are not blank, and then each of those steps. Or `1` and all
   64 steps whole. The writer uses the smaller form.
2. **Nudges and fill conditions.** `0` means none. `1` means a 64-bit map and then one byte for each marked step.
   `2` means one byte for each of the 64 steps.
3. **Locks.** The count. Then for each lock: its step (bit 7 is SLIDE), the code of its parameter and its value. A
   track has a maximum of 32 locks (`NLOCK`).
4. **Step components.** The play direction, the random seed and the count. Then 4 bytes for each component: step,
   type, value A and value B. The writer writes PARAM as `type | 0x80`. Its value A is the parameter, coded as in a
   lock.

A pattern from before step components has no part 4. The reader then sets no components.

### Validation on load

| Data | What the reader does |
| --- | --- |
| Magic, size (12..3,840), check word, and for an import the exact object size | If one of them is wrong, the reader refuses the project and the slot reads as empty. It applies nothing. |
| A chunk length that goes past the object | The reader stops. It applies the chunks before that chunk. The tracks with no chunk load as at power-on. |
| A value out of range | The reader clamps it. |
| A lock on a step past 64, on an unknown parameter or on a parameter that cannot be locked. A second lock of one parameter on one step. | The reader discards that lock. |
| A step component with an unknown type, a step past 64 or a value out of range. A second component of one type on one step. | The reader discards that component. It keeps the others. |
| A `P` entry for a track past 8 or a pattern past 8. A pattern that is already in the bank. An entry that does not fit the bank. | The reader discards that entry. It loads the other entries. |
| An `H` chunk with a bad count | The reader ignores it. The default progression stays. |
| A `C` chunk that is cut short | The default scenes stay. |
| A `C` name that is not known, or a `C` pattern past 8 | The name reads as none. The pattern reads as KEEP. |

Tests: `tests/project_test.c` (the "format 7: ..." checks: a round trip of eight tracks, identical captures, an import
only at its own size, a flipped bit or a wrong size or a wrong check word refused, an unknown chunk read past, a chunk
longer than the object), `tests/comp_test.c` (damaged components), `tests/pat_test.c` (a bank entry of track 10 /
pattern 16 discarded, the scenes saved and loaded), `tests/harm_test.c` and `tests/lock_test.c` (their data saved
and loaded).

## 3. Nothing is cut

A project object is a maximum of 3,840 bytes. A save (`proj_capture`) first measures the size and writes nothing.

1. If the project fits, the save writes it.
2. If the project does not fit, the save writes nothing. The slot keeps its data. The UI shows
   `PROJECT FULL: NOT SAVED`. The autosave shows `TOO BIG TO AUTOSAVE`. The firmware never stores a part of a project.

Sizes from `tests/project_test.c` (1.9.3):

| Project | Size |
| --- | --- |
| Eight tracks with a few steps each | 1,146 B |
| Four dense tracks | 3,541 B |
| Eight dense tracks | 6,664 B (refused whole) |

The pattern bank holds a maximum of 3,072 bytes (`PB_SIZE`). This leaves room in the project object for the sounds
of eight tracks and the patterns that play. The firmware refuses a pattern change or a copy that does not fit the
bank. The UI then shows `PATTERNS FULL: KEPT` or `PATTERNS FULL: NO COPY`. Nothing is lost.

Tests: `tests/project_test.c` ("eight dense tracks do not fit: refused, the slot unchanged", "four dense tracks:
saved whole, or refused untouched"), `tests/pat_test.c` ("a full bank: the project saves whole (format 7) or is
refused (PROJECT FULL), never cut").

## 4. SLOOP's projects are not read

SLOOP (and Felucca before it) stored four-track projects as "FUN1" .. "FUN6". BoopBox reads none of these formats:

- A section or an autosave in one of these formats reads as empty. The UI shows `EMPTY SECTION`. At power-on,
  BoopBox loads the default project.
- The web editor refuses a backup object in one of these formats (restore return code 2).

BoopBox never writes these formats. Thus SLOOP cannot load a BoopBox project.

Tests: `tests/project_test.c` ("SLOOP's four-track projects (FUN1 .. FUN6): not a project, the slot unchanged"),
`tests/boot_sound_test.c` (a working project of SLOOP in the flash: the default sounds at power-on, run by
`tests/editor_fuzz.sh`), `tests/editor_fuzz.c` (SLOOP images restored and found in the flash).

## 5. Versions of this format

The format stores globals and track parameters by index, with their count. Thus a later BoopBox can add new values at
the end of their group. The common parameters go just before `P_E0`. An older BoopBox reads past the new values.

An older BoopBox skips the chunks that it does not know. It reads the fields at the end of a `T` chunk only when
bytes are left.

The `C` chunk came in 1.7.0, still as format 7. A project from 1.7.0 or later can load incorrectly on an older
BoopBox.

## 6. Other stored data

### Settings (`OBJ_SETTINGS`)

The payload has three parts, always all three:

1. `persist_t` (magic "PER3"): the panel calibration, the palette, the song order and the lights.
2. The SYN drum kits.
3. The MIDI part (`MIDI_PART_8` bytes): the MIDI LEARN map, the GLO > MIDI channels and switches, CH5..CH8, the MIDI
   LEARN bits of tracks 5..8 (`ml_hi`), `MENU > SEQ > REC KNOBS`, and (1.8.0) the KEYS settings VELOCITY, AFTERTOUCH
   and VEL LEARN.

If the object has a different length (an older SLOOP), BoopBox keeps only the `persist_t` part. The SYN kits and the
MIDI settings start at their defaults.

The side record of the settings object is 120 bytes. It holds your theme (THM2), the favorites, and (1.8.0) the
calibration of key velocity. BoopBox does not read THM1 from the first beta of SLOOP 2.7.

### Other data

- **The song loop region.** It is in the two reserved bytes of the song order (`arranger.h`), in `persist_t`. An
  older firmware does not read these bytes. `tests/pat_test.c` and `tests/song_ui_test.c` test the region logic. No
  test does a flash round trip of these two bytes. They are part of the song order, which BoopBox saves whole.
- **Song sections.** A section is a format 7 capture. Thus a section keeps its patterns, components, locks and
  FOLLOW. A section applies its tracks, the TEXTURE and the harmony globals. It keeps the tempo and the master.
- **User presets.** A save stores the own values of the track (`trk_base`), not a lock that plays at that time.

## 7. Going back to SLOOP

SLOOP reads formats 1..6 only. On SLOOP:

- A section that BoopBox saved shows as `EMPTY SECTION`. Its flash object stays as it is until SLOOP saves a project
  into that slot. If you install BoopBox again before that, the section is there again.
- SLOOP does not load the working project (autosave) of BoopBox at power-on. The next autosave of SLOOP replaces it.

The same is true in the other direction: BoopBox does not read projects that SLOOP saved (section 4).
