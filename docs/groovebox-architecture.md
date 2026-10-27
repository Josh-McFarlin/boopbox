# SLOOP groovebox upgrade: architecture notes

This file records what the checked-out tree (SLOOP 2.8.3, branch `groovebox-8track`) actually does, the limits
that bound the upgrade to eight tracks, and the design chosen to fit them. It was written before the first
change of the firmware and is updated as the work goes on (the last section).

## 1. How the firmware is built

- **One compilation unit.** `firmware/src/felucca.c` includes every `.c` file in a fixed order; nearly every
  symbol is `static`. Order matters: `core.h` → engines → `drums.c` → `params.c` → `voice.c` → `slicer.c` →
  `fx.c` (which includes `punch.c`) → USB / MIDI → `arranger.c` → `seq.c` → `audio.c` → the UI files →
  `storage.c` → `upreset.c` → `project.c` → editor → `main.c`.
- **Host tests include the same sources.** `tests/hostsim.c` and the other tests `#include` the firmware files
  with small stubs for the hardware (`fm1_in`, IRQ on/off, the second core as `tests/cpu1_host.c`).
- **The target build** (`tools/build.py`) needs JieLi's pi32v2 toolchain and three files of the AC79 SDK. Neither
  can be downloaded from this environment (the network policy refuses `pkgman.jieliapp.com` and `gitee.com`), so
  no firmware image can be produced here. `tests/run_tests.sh` gained `HOST_ONLY=1`: it generates `build/gen/`
  itself and runs every test that does not read the firmware package (4 are skipped and named).
- **A size estimate without the toolchain**: `tools/proxy_size.py` compiles `felucca.c` for RV32IMC with the
  host clang (the HAL's pi32v2 inline assembly emptied). Its RAM and pool figures match the real build closely
  (pool 333,900 B: identical to `RAM.md`; RAM 59,094 B against 58,220 B on the target); its code size does not
  (another instruction set), but the *difference* between two trees is a fair measure of a change's cost.

## 2. Hard limits (measured on the baseline)

| Resource | Size | Used (baseline) | Notes |
| --- | --- | --- | --- |
| Flash, app slot (XIP) | 581,564 B (`APP_SLOT` 0x8DFBC) | full | 2.7 removed the USB serial console and `build.py` already rebuilds with a text boot logo when the image does not fit. The built-in samples are 283,212 B of it. |
| RAM region (.data+.bss) | 98,304 B | 59,094 B (proxy) | ~37 KB free: the only real room. |
| Pool (.pool, zeroed) | 344,064 B | 333,900 B | `build.py` demands 8,192 B of headroom: **~2 KB usable**. Holds the delay (128 KB), the punch ring (64 KB), the canvas (58 KB), the SLICER buffers (4 x 8 KB), the engine arenas (3 x 8,592 B), the song backup and the autosave buffer. |
| NOINIT | 15,696 B | 15,464 B | The four section snapshots `proj_slot[4]` (4 x 3,816 B). |
| `.lowram` | 29,488 B | 19,700 B | Reverb lines, core 1's stacks, the split's scratch. |
| Flash data | 0x97000..0xFFFFF | allocated | Projects: 4 sections x A/B sectors (0x97000..0x9EFFF), autosave A 0x9F000 / B 0xFE000, user samples 0xA0000..0xDBFFF and 0xE7000..0xFAFFF, user presets 0xDC000..0xDFFFF, update staging 0xE0000..0xE4FFF, FM6 bank 0xE5000/0xE6000, settings 0xFC000/0xFD000. Only 0xFB000 is free. |
| One stored object | 3,840 B payload (+192 B "side") | project format 6 = 3,816 B | A/B copies, header written last, CRC-32 (`storage.c`). |
| CPU | audio ISR every 5.8 ms half (256 frames) | see `tests/cpu_baseline.txt` | Overload sheds voices (`voice.c shed_voice`); core 1 can render some units (`fx.c units_split`). |

## 3. Hard-coded assumptions found

`NTRK`, `NPART`, `TRK_DRUM`, `TDRUM` and `is_drum` appear 438 times in `firmware/src`:

- `core.h`: `NTRK 4`, `NPART 3`, `TRK_DRUM 3`; `is_drum(t)` is `t == TDRUM`; `ex_off[NTRK]`; `song.solo`/`song.rec`
  are bit masks (8 bits: room for 8 tracks).
- **Voices** (`voice.c`): every synth part owns `v[NVOICE]` (8) but only `NVOICE` of all parts' voices sound at
  once (`voices_busy`, `voice_victim`, `shed_voice`: loops over `NPART`). The drums have their own 6 voices
  (`drums.c NDRUM`) outside that budget.
- **Engine state** (`engines.c`): GRAIN, DRAWBAR, FM6 and PHYS keep their big state in `eng_arena[NPART]`
  (3 x 8,592 B in the pool). FM6 also keeps per-part patch copies in RAM (`fm6_patch`, `fm6_eff`, `fm6_lfo`,
  indexed by track < `NPART`); PHYS its slot layout (`phys_lay[NPART]`).
- **The drum part** (`drums.c`): one bus, one kit (`TDRUM->p[P_E0]`), one TUNE / DECAY table (`drum_tune[16]`,
  `drum_dec[16]`), level / reverb / delay in globals (`G_DRLVL`, `G_DRREV`, `G_DRDLY`), mixed by
  `fx.c mix_drums` with its own four INSERT states (`ins[NPART..NPART+3]`) and the SLICER's drum path.
- **Mixing / second core** (`fx.c`): units are the synth parts (bits 0..2) and the drums (bit `NPART`); core 1's
  job argument packs the mask in 8 bits.
- **SLICER** (`slicer.c`): `sl_buf[NTRK][4096]` in the pool (8 KB a track).
- **Sequencer** (`seq.c`): MIDI channels: `G_CH1..G_CH3` for the parts, `G_DRCH` for the drums (settings of the
  FM-1 in `panel.c midi_set[]`); `midi_sel_on` keeps a nibble per channel and note (room for track + 1 <= 15);
  chord voice leading `vl_prev[NPART]`; `kh_set[NTRK]`, `mo_set[NTRK]`, `pc_req[NTRK]`.
- **Patterns**: one 64-step pattern per track inside `track_t` (`step_t`/`dstep_t` union, 10 B a step),
  `micro[64]`, `fill[16]` (2-bit conditions), `lock[24]` (4 B parameter locks, sparse).
- **Sections / song** (`arranger*.c`, `project.c`): a *section* A..D is a whole-project snapshot
  (`project_t`, fixed 3,816 B) in NOINIT and flash; the song is up to 16 (section, bars) entries; live
  sections, quick chain and SONG REC switch on the bar. `proj_apply` / `proj_capture` run inside the audio ISR
  for a song's section change and the song backup.
- **Project format 6** (`project.c`): fixed layout, 4 tracks, read-only converters from formats 1..5.
- **UI**: the TRACKS screen draws 4 columns of 60 px; the four track colours `UI_COL[4]` (indexed `& 3`);
  GLO keys 1..4 mute, 5..8 solo, knobs 1..4 the track levels; SAVE keys 1..4 / 5..8 play / store sections;
  ALGORITHM selects the track (clamped to 0..3 on the drum screen).
- **Web editor protocol** (`editor.c`): sends `NTRK` and bounds-checks track numbers against it; the drum track
  is `TRK_DRUM` (its level is `G_DRLVL`).

## 4. Design for eight tracks

The upgrade keeps every working engine and the timing core (the transport clock in `BEAT_U` units, one step a
block at most, nudges, ratchets) and changes what is per track:

1. **Eight tracks, each SYNTH or DRUM** (`track_t.kind`). `is_drum(t)` reads the kind; no index is special.
   The default project keeps the old layout on tracks 1..4 (three synths, drums on 4) and adds tracks 5..8
   (synths 5..7, a second drum track on 8) so that old projects open as they were.
2. **One voice budget across all synth tracks**: `NVOICE` (8) sounding synth voices shared by the eight tracks,
   with the existing priorities (released first, then extra UNISON voices, then held POLY voices that are not the
   bass). The drum voices stay a separate pool (`NDRUM`), now shared by every drum track with an owner per voice.
3. **Big engine state is lent, not multiplied.** The three engine arenas become a pool of `NARENA` (3) slots lent
   to the tracks that play GRAIN, DRAWBAR, FM6 or PHYS. At most three tracks can play those four engines at once;
   the UI refuses a fourth with a message. (Five more arenas would need 43 KB of pool; there are 2 KB.)
4. **SLICER STUT buffers are lent the same way**: four 8 KB buffers for at most four tracks in STUT mode; GATE needs
   no buffer and works on every track.
5. **Drum tracks** render their voices on a mono bus, then the SLICER, the INSERT and the FILTER, then LEVEL, PAN and
   the sends: one INSERT state per track instead of four for the drums.
6. **Patterns are stored compactly.** Each track plays one pattern (decoded in `track_t` as today); the other
   patterns of all eight tracks are kept encoded (a few bytes a step) in one shared RAM bank with a byte budget.
   A pattern change is quantized and done by the audio ISR on the boundary (a bounded encode + decode).
7. **Projects become variable-length** (format 7): a compact encoding of the eight tracks, their pattern banks, the
   step components, the parameter locks and the harmony state, inside the same 3,840-byte objects, slots and
   flash sectors as before. A save that does not fit is refused and named; nothing is truncated; old formats 1..6
   are converted on load (they always fit).
8. **The flash**: the new code must find room. `tools/build.py` already falls back to the text logo; a further,
   explicit fallback can alias the largest built-in sample sets onto others when the image still does not fit
   (reported by the build, never silent). This can only be checked with the JieLi toolchain.

New modules (all host-testable, no allocation, bounded loops):

| File | What |
| --- | --- |
| `stepcomp.c` | step components: per-step transformations, evaluated before scheduling |
| `harmony.c` | the harmony track: key, scale, chord progression, per-track opt-in, applied to scheduled notes |
| `patbank.c` | the compact pattern bank and quantized pattern changes |
| `perf.c` | the performance layer over the punch-in effects (momentary / latched, quantized) |

## 5. Progress log

- Milestone A: baseline host suite passes (`HOST_ONLY=1`, 4 tests skipped for want of a firmware build);
  sizes measured with `tools/proxy_size.py`.
