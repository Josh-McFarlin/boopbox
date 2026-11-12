# Performance and resources

This page gives the flash, RAM and CPU cost of the BoopBox firmware. The current release is 1.9.3. Each table states the version or the tree that it measures. A figure without a version is not on this page.

## Where the numbers come from

| Source | What it gives | Exact? |
| --- | --- | --- |
| **Release package** (`docs/firmware/boopbox-X.Y.Z.fwsc`) | The app size of a published release, decoded from the package. See "How to measure again". | Yes. The JieLi toolchain built each package. |
| **Real build** (`tools/build.py` with the JieLi pi32v2 toolchain jieli-linux-toolchains-20260730.1 and the AC79 SDK files) | App size, RAM, pool and `.lowram` figures, and the disassembly for `tests/target_budget.py`. | Yes |
| **Proxy build** (`tools/proxy_size.py`) | The whole firmware compiled with the host clang for RISC-V RV32IMC at `-Os`. You can use it without the JieLi toolchain. | RAM, structs and constant tables: yes. Code size: no. |
| **Host time** (`cc -O2` on an x86-64 host with 4 cores) | The time of the audio and sequencer code on the host. | Only the ratio between two runs on the same host is useful. |

The proxy uses a different instruction set. Thus its code size is not the code size of the FM-1. For example, the proxy gave 35.3 KB for the growth of the groovebox upgrade, and the real build gave 29.1 KB.

The 2.8.3 tree, built with this JieLi toolchain, gives an app of 570,176 B. This is the size of the shipped SLOOP 2.8.3 app. Thus the real-build figures are the figures of the firmware itself.

**No number on this page comes from a measurement on an FM-1.**

## 1. Flash

The app slot is 581,564 B (`APP_SLOT` 0x8DFBC in `tools/fm1pkg_make.py`). The SLOOP 2.8.3 app is 570,176 B, so 11,388 B of the slot were free.

### The app in each release

These sizes come from the release packages. The CRC16 of each decoded app agrees with its package entry. The decoded 1.1.0, 1.2.0, 1.3.0 and 1.3.1 sizes agree with the real-build figures that the history of this page gives.

| Release | App (B) | Free (B) | What changed the size |
| --- | ---: | ---: | --- |
| 1.0.0 | 580,956 | 608 | Eight tracks, patterns, harmony, the visualizer with six styles |
| 1.1.0 | 577,760 | 3,804 | Three tables built in RAM at power-on, the six scenes, the sound browser, SYNTHWAVE |
| 1.2.0 | 579,752 | 1,812 | The UX review changes |
| 1.3.0 | 580,024 | 1,540 | Presets leveled below the master limiter |
| 1.3.1 | 575,316 | 6,248 | F1, F2, F7, F10 and part of F6 (`docs/memory-savings-analysis.md`) |
| 1.4.0, 1.4.1 | 575,316 | 6,248 | No change to BoopBox |
| 1.4.2, 1.4.3 | 576,556 | 5,008 | The sound browser stays open, drum tracks reach PATTERNS (1.4.2) |
| 1.5.0, 1.5.1 | 576,556 | 5,008 | No change to BoopBox |
| 1.6.0 | 576,556 | 5,008 | 20 shared synth voices (a constant, no size change) |
| 1.7.0 | 579,424 | 2,140 | OBERVAVE and USB HOST added. Cymbals at 22 kHz, VIBES shorter and the drum kits stored once (F8) made room. |
| 1.8.0, 1.8.1 | 579,532 | 2,032 | Key velocity and aftertouch, NRPN, the second flash chip. F4 and F9 made room. |
| 1.9.0 to 1.9.2 | 581,244 | 320 | Beats from the keys (`drumgen.c`) |
| **1.9.3** | **579,200** | **2,364** | The sound browser knobs and lights, screen fixes |

The 1.9.3 package was built two times. The first build gave 581,252 B (commit f80239e). The published package, built after a merge of `main`, gives 579,200 B (commit 119e005). The cause of the 2,052 B difference is not known.

### BoopBox Trainer

The trainer is a separate build (`tools/build.py --trainer`). It has no web editor and three sample sets fewer (HORNS, STRGS, SCRCH). It has a budget of 8 synth voices.

| Release | App (B) | Free (B) |
| --- | ---: | ---: |
| 1.4.0 | 529,160 | 52,404 |
| 1.4.3 | 552,656 | 28,908 |
| 1.5.0 | 562,396 | 19,168 |
| 1.5.1, 1.6.0 | 562,892 | 18,672 |
| 1.7.0 | 565,384 | 16,180 |
| 1.8.0 | 566,296 | 15,268 |
| 1.8.1 | 569,004 | 12,560 |
| 1.9.0 | 570,784 | 10,780 |
| 1.9.1, 1.9.2 | 561,440 | 20,124 |
| **1.9.3** | **561,948** | **19,616** |

The 1.9.1 CHANGELOG gives 9,348 B for the removal of level 4. The packages in git give 9,344 B.

### Where the flash goes in 1.9.3

The sample data (`SMP_DATA`) is 256,496 B, 44 % of the 1.9.3 app. This figure comes from `build/gen/felucca_samples.h`, which `tools/gen_samples.py` writes. Each set stores 4-bit IMA ADPCM at 22,050 Hz.

| Set | Recordings | Bytes a recording | Set bytes |
| --- | ---: | ---: | ---: |
| PIANO | 4 | 11,026 | 44,104 |
| BASS | 3 | 9,922 | 29,766 |
| VIBES (0.8 s since 1.7.0, was 1.0 s) | 3 | 8,820 | 26,460 |
| HORNS | 4 | 6,614 .. 6,616 | 26,462 |
| STRGS | 3 | 6,614 .. 6,616 | 19,844 |
| FLUTE | 3 | 10,474 | 31,422 |
| SCRCH | 1 | 3,020 | 3,020 |
| PERC (the sampled GM kit, all at 22,050 Hz since 1.7.0) | 27 zones | | 75,418 |

In 1.3.0 the sample data was 273,840 B. Release 1.7.0 removed 17,344 B: PERC lost 10,726 B (cymbals from 32 kHz to 22.05 kHz) and VIBES lost 6,618 B.

Other large constants in the 1.9.3 proxy object (exact):

| Object | Bytes | What |
| --- | ---: | --- |
| `DS_SND` + `DS_KITS` | 5,324 + 1,408 | The 32 synthesized drum kits: 242 distinct sounds, and 16 indices and 16 levels for each kit (F8, 1.7.0). In 1.3.0 `DS_KITS` was 11,648 B. |
| `BANK` | 1,784 | The preset list of the sound browser. It was 1,224 B in 1.3.0. The 70 OBERVAVE programs added entries. |
| `ICON_MAP` | 1,112 | Unchanged since 1.3.0 |
| `FONT_S_DATA` | 1,120 | The screen font: 70 glyphs of 8 x 16 px at 1 bit, read from the flash (F4, 1.8.0) |

### What is left out to save flash (1.9.3)

| Left out | Saves | Status in 1.9.3 |
| --- | ---: | --- |
| The bitmap boot logo (`FELUCCA_LOGO_TEXT=1` is the default) | 4,592 B (measured before 1.0.0) | Still left out. The boot screen shows "BoopBox" as text in the track colors. |
| The top recording of the BASS set (C#, note 73) | 9,372 B (exact) | Still left out. The F# recording (note 66) plays notes 63 and up. Notes below 70 sound as before. |
| SLOOP's twelve visualizer styles | | Replaced in 1.1.0 by six scenes (PALMS, NIGHT DRIVE, HORIZON, FLYOVER, DENSE CITY, KEY CITY). All six are in the default build (`FELUCCA_VIS_STYLES` 0x3F). |
| The 32 kHz rate of the GM kit cymbals | 10,726 B (exact) | Removed in 1.7.0. The cymbals lose the octave above 11 kHz. |
| The last 0.2 s of each VIBES recording | 6,618 B (exact) | Removed in 1.7.0 |

### Tables built in RAM at power-on (1.1.0)

Release 1.1.0 moved three constant tables from the flash to RAM. The firmware builds each table at power-on, with the same bytes as before. The host tests check every point.

| Table | Flash | RAM | Status in 1.9.3 |
| --- | ---: | ---: | --- |
| `FM6_EXP2` (the 2^x table of FM6, 1,025 points), from ten Q62 constants (`fm6_core.c fm6_x2_fill`) | −3,808 | +4,100 | Still built in RAM (4,100 B in the proxy object) |
| `SINE` (1,025 points), from its series in Q62, one quarter mirrored (`felucca_tables.h sine_fill`) | −1,712 | +2,050 | Still built in RAM (2,050 B in the proxy object) |
| The screen font, LZ4-packed and unpacked at power-on (`felucca_font.h font_fill`) | −3,148 | +5,376 | Reversed in 1.8.0. The font is now 1,120 B of flash and no RAM. `font_fill` is an empty function. |

The figures in this table come from the real build of the 1.1.0 tree.

### Build flags that remove a feature

You can set these flags by hand. The default build does not set them.

| Flag | Saves | Measured on | Result |
| --- | ---: | --- | --- |
| `FELUCCA_EDITOR=0` | 13,872 B | The groovebox upgrade tree, before 1.0.0 | The web editor gets no reply from the FM-1 |
| `FELUCCA_VIS=0` | 10,752 B | 1.1.0 | No visualizer |

The SYNTHWAVE palette and the cleared rows of the CHORDS screen cost 1,112 B in 1.1.0. The visualizer cost 10,752 B in 1.1.0: its frame (the update, the FFT, the name) was 2,640 B, and the six scenes were the rest.

With `FELUCCA_EDITOR=0`, the web editor gets no reply from the FM-1. Thus you cannot edit, back up or upload samples over USB. M-UPGRADE updates, the USB rescue (`recovery.c`, OCT− at power-on), USB-MIDI and USB audio stay. `ota_service` still reads every SysEx frame and drops the frames of the editor.

If the app does not fit, `tools/build.py` stops and names `FELUCCA_VIS=0` and `FELUCCA_EDITOR=0`. The build does not remove a feature by itself.

### History: the groovebox upgrade (before 1.0.0)

The figures in this section come from the real build of the trees before 1.0.0. They are not the figures of 1.9.3.

Growth by milestone (real build, the default flags of each tree):

| Tree | App | Added |
| --- | ---: | ---: |
| Baseline (SLOOP 2.8.3) | 570,176 | |
| B: eight tracks, project format 7 | 579,080 | +8,904 |
| C: step components, the engine | 584,168 | +5,088 |
| C: step components, the UI | 586,868 | +2,700 |
| D: parameter locks | 589,456 | +2,588 |
| E: patterns, song loop region | 595,000 | +5,544 |
| F: harmony | 597,712 | +2,712 |
| Performance FX | 598,416 | +704 |
| G: UI integration | 599,320 | +904 |
| **Growth** | | **+29,144** |

The upgrade then removed the bitmap logo (4,592 B), the visualizer (8,980 B) and the top BASS recording (9,372 B). The app became 576,212 B, with 5,352 B free.

The cost of single features (real build, before 1.0.0). Each figure comes from a build with the entry points of that feature made empty:

| Feature | Saves (B) |
| --- | ---: |
| The SysEx of the web editor (`FELUCCA_EDITOR=0`) | 13,872 |
| The SLOOP visualizer (twelve styles) | 8,980 |
| The bitmap boot logo | 4,592 |
| Harmony (engine, live chords, CHORDS screen) | 4,200 |
| Step components (engine and COMP strip) | 3,492 |
| The CHORDS screen alone | 3,208 |
| The PATTERNS screen | 3,104 |
| The format 6 fallback writer (removed in 1.0.0) | 1,104 |
| The LOCKS strip of the sheet | 828 |
| SAVE > TOOLS > KIND | 432 |
| FX > PERF Q | 164 |
| REC KNOBS (knob moves as locks) | 160 |
| BEND (step component) | 64 |
| The loop region of the song | 48 |
| SLIDE (the glide itself) | 32 |

Since 1.0.0, PATTERNS has three pages (1.7.0) and other features grew. These figures are not measured again.

Build variants (real build, before 1.0.0, with the top BASS recording still in):

| Variant | Result |
| --- | ---: |
| The 2.8.3 defaults (bitmap logo, visualizer) | 17,756 B over |
| Text logo | 13,164 B over |
| Text logo, no visualizer | 4,184 B over |
| No web editor | 3,900 B over |
| Text logo, no web editor | Fits, 708 B free |
| Text logo, no visualizer, no web editor | Fits, 9,352 B free |

The removal of the BASS recording gave 9,372 B more to each of these variants.

## 2. RAM

The RAM region (`.data` + `.bss`) is 98,304 B. The pool (`.pool`) is 344,064 B. `tools/build.py` stops if the pool has less than 8,192 B free.

### RAM in 1.9.3 (proxy build)

| Region | Size (B) | Used (B) | Free (B) |
| --- | ---: | ---: | ---: |
| RAM region (`.data` + `.bss`) | 98,304 | 81,197 | 17,107 |
| Pool (`.pool`) | 344,064 | 331,004 | 13,060 (4,868 above the 8,192 B reserve) |
| NOINIT (`proj_slot[4]`: 4 x 3,840 B) | 15,696 | 15,560 | 136 |
| `.lowram` | | 19,700 | |

These are proxy figures of the 1.9.3 source. The proxy RAM figure was within 200 B of the real build in 1.1.0 and 1.3.0. The real `.lowram` figure also holds `.ram_text`, so the real `.lowram` is larger than the proxy figure.

The largest objects in the RAM region (1.9.3 proxy): `trk[8]` 19,136 B, `ins[8]` 4,640 B, `FM6_EXP2` 4,100 B, `abuf` 4,096 B, `proj_tmp` 3,840 B, `main_scratch` 3,840 B, `pb_buf` 3,072 B, `SINE` 2,050 B.

### RAM over the releases (real build)

| Tree | RAM region used (B) |
| --- | ---: |
| SLOOP 2.8.3 | 59,308 |
| The groovebox upgrade, visualizer out (before 1.0.0) | 74,684 |
| 1.1.0 (visualizer in, font and two tables in RAM) | 85,484 |
| 1.3.0 | 85,516 |
| 1.3.1 | 85,468 |

There is no real-build RAM figure for a release after 1.3.1 on this page. Release 1.8.0 gave back about 4.8 KB of RAM (CHANGELOG: the font read from flash).

The other regions of the groovebox upgrade tree, before 1.0.0 (real build):

| Region | Size | 2.8.3 | Upgrade tree | Free |
| --- | ---: | ---: | ---: | ---: |
| Pool | 344,064 | 333,900 | 328,444 | 15,620 |
| `.lowram` | 29,384 | 22,772 | 22,772 | 6,612 |

### Where the RAM of the upgrade went (proxy build, before 1.0.0)

| Milestone | RAM | What |
| --- | ---: | --- |
| B | +12.4 KB | The `track_t` of the four extra tracks (+8.6 KB), their INSERT states, the per-track copies of FM6 |
| C | +0.9 KB | The step components in each `track_t` |
| D | +1.6 KB | Locks 25..32, the slides |
| E | +3.3 KB | The pattern bank (3,072 B) and the chain state |
| F | +132 B | The harmony |
| FX target | +32 B | The FX target |

The second dry pair of the FX target in the mix accumulators (`acc[2].pl/pr`, 512 B) is in `.lowram`. The old drum bus had the same size and left `.lowram` in milestone B. Thus `.lowram` did not change.

The firmware allocates no memory at run time. Each structure is a fixed-size array. Each loop has a fixed bound.

## 3. CPU

The audio ISR runs every 5.8 ms (256 frames at 44.1 kHz). It renders in blocks of `CTL` = 32 frames (0.73 ms of audio for each block). The sequencer, the step components, the locks, the patterns and the harmony run on core 0 in `events_block`, one time for each block. The voices and effects render on the two cores (`fx.c units_split`).

### Voices

Since 1.6.0, up to 20 synth voices sound at the same time across all the synth tracks (`NVBUDGET` in `core.h`). Before 1.6.0 the budget was 8. BoopBox Trainer keeps a budget of 8. One track still plays at most 8 voices (`NVOICE`). FM6 plays at most 6, VOICE 4, GRAIN and PHYS 3.

The change to 20 voices did not change the RAM. It increased the cost of the heavy mixes in `tests/cpu_baseline.txt`, which now sound 20 voices:

| Mix (`tests/cpu_baseline.txt`) | Before 1.6.0 | Since 1.6.0 |
| --- | ---: | ---: |
| `cpu/mix/3parts_heavy_now_drums` | 2,952 | 4,302 |
| `cpu/mix/3parts_phys_noise_drums` | 3,263 | 4,276 |
| `cpu/mix/3parts_full_drums` | 2,833 | 3,720 |

The unit is the cost for each sample, in parts per thousand of the idle mix with drums (`cpu/mix/idle_drums` = 1000).

An OBERVAVE voice (1.7.0) costs about two times an ANALOG voice on the host (`tests/target_budget.txt`, CHANGELOG 1.7.0). OBERVAVE uses an engine arena, as FM6, GRAIN, PHYS and WHEEL do. At most three tracks (`NARENA`) play these engines at the same time.

### Measured on the host (`tests/groove_cost.c`, before 1.0.0)

These figures come from the groovebox upgrade tree, before 1.0.0, with a budget of 8 synth voices. They are not measured again for 20 voices.

The test uses eight busy tracks. Six synth tracks (ANALOG) play a 3-note chord on every step. Two drum tracks play a hit on every step. The first run uses no new feature. The second run uses all the features:

- 7 step components on each track (RAND, RAMP+, MULT, VEL, TRIG, PARAM, BEND).
- 8 locks on each track (4 with SLIDE).
- A chain of two patterns. All eight tracks change pattern on the same block, every loop.
- FOLLOW SCALE on the synth tracks with a 4-chord progression (a change every bar).
- A latched effect.

The benchmark checks that all the features were active: 56 components, 64 locks, 120 pattern changes and the four chords. There were three runs of 40,000 blocks each. The table gives the range of the three runs.

| What the test times | Mean for each block | 99.9 % of blocks under |
| --- | ---: | ---: |
| `events_block` (the control path of core 0), no new feature | 0.27 .. 0.34 us | 2.0 .. 18.9 us |
| `events_block`, all features | 0.32 .. 0.35 us | 7.2 .. 19.7 us |
| `mix_block` (all the rendering), no new feature | 8.3 .. 8.8 us | 52 .. 60 us |
| `mix_block`, all features | 7.6 .. 7.9 us | 41 .. 51 us |
| `mix_block`, CRUSH latched on the MASTER | 8.0 .. 8.4 us | 50 .. 58 us |
| `mix_block`, CRUSH latched on the DRUMS (the second dry bus) | 8.0 .. 8.6 us | 46 .. 59 us |

The longest single blocks (40 us to 5 ms) are not in the table. The scheduler of the host causes them, and they are equally large in the runs without the new features.

What these figures show:

- The new control-path work costs about 0.05 us for each block on average. This is less than 1 % of the host cost of a block.
- Most of a block is the rendering of the voices. The features do not change this rendering.
- The largest new work in one block is a pattern change: an encode of the old pattern and a decode of the new one.
- `tests/pat_test.c` measures 1.5 .. 2.7 us for one change of a 32-step chord pattern. It measures 12 .. 21 us for all eight tracks at the same time.
- On the FM-1 the pattern change runs in the audio ISR on core 0, one time for each change. A quantized change of every track occurs on the same block.
- The whole block is a little less expensive with all features here. The features change what plays: TRIG drops half the notes of a step, and the locks change sound parameters.
- The second dry bus of the FX target is within the noise between runs.

The suite gave these figures on the upgrade tree. The 2-minute soak (random live use, components, patterns, harmony) gave a mean of 5.06 us for each block. The UI fuzz gave 99.9 % of blocks under 42 us and 119 us (its two sessions). `tests/regress.c` gave 0 CPU entries over budget.

### What is not known

The processor of the FM-1 is much slower than the host. Nobody measured the ratio. Thus these numbers do not tell how much of the 5.8 ms ISR budget a busy project uses on the FM-1.

The firmware keeps three protections:

- Overload removes voices (`voice.c shed_voice`). The FM-1 fades out the quietest voices one at a time.
- The second core does part of the rendering.
- SYSTEM shows the CPU load (KNOB 4).

To test on hardware, do these steps:

1. Make eight busy tracks with chains of dense patterns that change on the same bar.
2. Set FOLLOW on.
3. Play chords on several tracks so that 20 synth voices sound.
4. Watch the CPU load on SYSTEM.
5. Listen for voices that stop.

## 4. Determinism and the existing sound

- In the groovebox upgrade, the 182 golden renders of `tests/regress.c` did not change in any milestone after B. If a feature is at its default, the code takes the old path. The default is no component, no lock past the old ones, pattern 1 only, FOLLOW OFF and no FX target.
- `tests/golden.txt` now holds 252 golden renders. Release 1.7.0 added the 70 OBERVAVE programs and the GM kit renders.
- The render split over two cores gives the same output as one core, also with the FX target on (`tests/mix_split_test.c`, every split mode). ThreadSanitizer finds no data race (`tests/cpu1_modes.sh`).
- The step components use the random generator of each track (`cp_rng`). PLAY sets its seed. They do not use the shared `rng()`, so the random seeds of the existing sounds did not change.
- The CPU check of `tests/regress.c` compares the cost of each preset with `tests/cpu_baseline.txt`. It allows +25 % (instructions) or +35 % (time).

The target cost of the render loops (`tests/target_budget.py`) is a static count of the instructions in the loops of each render function. It reads the disassembly of the real build and allows +10 % on `tests/target_budget.txt`:

- On the upgrade tree, every loop was within 1 % of the 2.8.3 tree built with the same toolchain (`drums_mix` 6,830 against 6,811).
- The audio ISR (`fm1_alnk0_irq`) is 256. In 2.8.3 it was 268. The FX target made the compiler inline `mix_block` into the ISR, so `mix_block` is `noinline` again.
- `tests/target_budget.txt` was first written for an older toolchain, on which 2.8.3 itself is over budget. The upgrade wrote it again for this toolchain.
- 1.6.0: a backward branch counts as a loop only if its target comes back to it (`reaches()`). Before this fix, `sample_render` read 593 and `grain_render` 2,363 on every real build. The correct values are 125 and 1,747.
- 1.7.0: `obv_render` (OBERVAVE) has a budget of 7,654. Its per-sample loop has 491 instructions, but the count weighs it as three nested loops. The host CPU check is the real measure for OBERVAVE.

## 5. Bounds of the new work for each block (core 0)

| Work | Bound |
| --- | --- |
| Step components | At most `NCOMP` (16) components examined for each step that fires, `NCPAR` (4) extra parameter values |
| Locks | At most `NLOCK` (32) for each track examined for each step. At most `NSLIDE` (4) slides moved for each track and each block. |
| Pattern change | One encode and one decode of at most 64 steps, 32 locks and 16 components, for each track that changes |
| Harmony | At most 12 x 8 scale lookups for each note moved |
| FX target | Two more accumulations for each frame for the targeted tracks, one sum for each frame |

## 6. How to measure again

To get the proxy sizes and the host figures, run these commands:

```sh
python3 tools/proxy_size.py --json                         # proxy sizes (default build)
python3 tools/proxy_size.py --json -DFELUCCA_VIS=0         # a variant
cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/groove_cost.c -lm -o build/host/groove_cost
build/host/groove_cost                                     # the host cost table of section 3
HOST_ONLY=1 sh tests/run_tests.sh                          # the full host suite
```

`tools/proxy_size.py` needs the generated headers in `build/gen`. `HOST_ONLY=1 sh tests/run_tests.sh` makes them.

On a computer with the JieLi toolchain and the AC79 SDK, `scripts/build.sh` gives the real sizes. It prints `image ... B; RAM .data+.bss ... B of 98304; lowram ...; pool ...`. It also writes `build/felucca.dis`. Then `tests/target_budget.py` checks the target cost of the render loops from this file.

To get the app size of a published release without the toolchain, decode its package with the functions of `tools/fm1pkg_make.py`:

1. Remove the marker byte after each of the first 20 blocks of 0x2F bytes of the `.fwsc` file.
2. Decode the file list at offset 0x40 with `enc()`. Each entry is 0x50 bytes.
3. Take `flash.bin` (the first file) at the offset and length that its entry gives.
4. Decode 0x120 + `APP_SLOT` bytes from flash offset 0x4000 with `sfc()` and `KEY`.
5. Take `APP_SLOT` bytes at offset 0x120 of this area. This is `app.bin`, padded with 0xFF.
6. Compare its CRC16 with the `app.bin` entry at offset 32 of the area.
7. Remove the 0xFF bytes at the end. The length that remains is the app size.
