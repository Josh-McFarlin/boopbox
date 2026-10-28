# Performance and resources

This page gives the measured cost of the groovebox features: flash, RAM and CPU. Read the source of each number:

- **Proxy build** (`tools/proxy_size.py`): the whole firmware compiled with the host clang for RISC-V RV32IMC at
  `-Os`, because the JieLi pi32v2 toolchain could not be installed here (`docs/groovebox-status.md`, section 4). Its RAM and pool figures match
  the real build closely (baseline: RAM 59,094 B proxy, 58,220 B target). Its code size does not, because it is a
  different instruction set. The difference between two trees is a fair measure of a change's cost.
- **Shipped image**: the SLOOP 2.8.3 package in `docs/firmware/sloop-2.8.3.fwsc`, decoded (the app entry's CRC-16
  matches). This is a real target figure.
- **Host time**: the firmware's audio and sequencer code compiled with `cc -O2` and timed on this machine (x86-64,
  4 cores). It is not the FM-1's time. Only ratios between two runs on the same machine are meaningful.

**Nothing on this page was measured on an FM-1.** No firmware image was built and none was flashed.

## 1. Flash

### The baseline had 11.1 KB free

The app slot is 581,564 B (`APP_SLOT` 0x8DFBC). In the shipped 2.8.3 image, the app ends at byte 570,176, so
**11,388 B were free**. That image has the bitmap boot logo (its RLE data is in the app), so the 2.7 text-logo
fallback was not needed for 2.8.3.

### Growth per milestone (proxy build, bytes)

| Tree | Code | Constants | RAM (.data + .bss) |
| --- | ---: | ---: | ---: |
| Baseline (SLOOP 2.8.3) | 266,894 | 358,319 | 59,094 |
| B: eight tracks, format 7 | 277,588 | | 71,448 |
| C: step components | 281,598 | | 72,376 |
| D: parameter locks (+ C's UI) | 287,994 | | 73,948 |
| E: patterns, song loop region | 294,398 | | 77,268 |
| F: harmony | 299,066 | | 77,400 |
| Performance FX | 299,472 | | 77,432 |
| G: UI integration (final tree) | 300,286 | 360,221 | 77,440 |
| **Growth** | **+33,392** | **+1,902** | **+18,346** |

(Constants were measured at the baseline and the final tree only.)

### Build variants (proxy build, final tree)

| Variant | Code | Constants | Code + constants vs baseline | RAM |
| --- | ---: | ---: | ---: | ---: |
| default | 300,286 | 360,221 | +35,294 | 77,440 |
| `FELUCCA_LOGO_TEXT=1` (fallback 1) | 300,372 | 355,559 | +30,718 | 77,440 |
| `FELUCCA_LOGO_TEXT=1 FELUCCA_VIS=0` (fallbacks 1 + 2) | 290,432 | 355,253 | +20,472 | 74,584 |
| `FELUCCA_EDITOR=0` | 280,686 | 359,792 | +15,265 | 74,988 |
| `FELUCCA_LOGO_TEXT=1 FELUCCA_EDITOR=0` | 280,758 | 355,130 | +10,675 | 74,988 |
| `FELUCCA_LOGO_TEXT=1 FELUCCA_VIS=0 FELUCCA_EDITOR=0` | 270,820 | 354,824 | +431 | 72,132 |

### Will it fit? (an estimate, not a measurement)

The proxy build's code + constants for the baseline are 625,213 B, while the real app is 570,176 B: the proxy is
about 1.10 x the target. If the growth scales the same way (an assumption; the instruction sets differ):

| Variant | Estimated growth on the target | Against the 11.1 KB free |
| --- | ---: | --- |
| default | ~32 KB | does not fit |
| fallback 1 (text logo) | ~28 KB | does not fit |
| fallbacks 1 + 2 (text logo, no visualiser) | ~18.7 KB | does not fit |
| `FELUCCA_EDITOR=0` alone | ~13.9 KB | probably does not fit |
| text logo + `FELUCCA_EDITOR=0` | ~9.7 KB | may fit, with little margin |
| all three | ~0.4 KB | fits |

So the automatic fallbacks alone are probably **not** enough. `tools/build.py` takes them in turn and says so; when
every fallback is taken and the image still does not fit, the build fails and names `FELUCCA_EDITOR=0`. The build
does not take that option itself, because it removes a feature that users rely on (the web editor: sound and
pattern editing, backups, sample upload). With `FELUCCA_EDITOR=0`:

- the web editor gets no reply from the FM-1 (no editing, backup or sample upload over USB);
- M-UPGRADE updates, the USB rescue (`recovery.c`, OCT− at power-on), USB-MIDI and USB audio stay: `ota_service`
  still reads every SysEx frame and drops the editor's.

Only a target build can tell the real figure. Other parts that could go (proxy code, measured by building without
them): the TRIO engine 4.3 KB, FORMANT 3.3 KB, NOISE 2.9 KB. This firmware has no switch for them: removing an engine
changes what existing projects sound like.

The fallback switches are compile-checked (proxy build and `clang -Wall`: no warnings). The host tests include
`ui_vis.c` and `editor.c` themselves, so the stubs that replace them are not run by a test.

## 2. RAM

| Region | Size | Baseline | Final tree | Free |
| --- | ---: | ---: | ---: | ---: |
| RAM region (.data + .bss) | 98,304 | 59,094 | 77,440 | ~20.9 KB |
| Pool (.pool, `tools/build.py` demands 8,192 B headroom) | 344,064 | 333,900 | 333,948 | 10,116 (1,924 past the headroom) |
| NOINIT (`proj_slot[4]`: 4 x 3,840 B) | 15,696 | 15,464 | 15,560 | 136 |
| `.lowram` | 29,488 | 19,700 | 19,700 | 9,788 |

Where the RAM went (+18.3 KB): Milestone B +12.4 KB (the four extra tracks' `track_t` +8.6 KB, their INSERT
states, FM6's per-track copies), C +0.9 KB (the step components in each `track_t`), D +1.6 KB (locks 25..32, the
slides), E +3.3 KB (the pattern bank, 3,072 B, and the chain state), F +132 B (the harmony), the FX target +32 B.
The FX target's second dry pair in the mix accumulators (`acc[2].pl/pr`, 512 B) is in `.lowram`; the old drum bus of
the same size left `.lowram` in Milestone B, so `.lowram` is unchanged.

Nothing is allocated at run time. Every new structure is a fixed-size array; every loop has a fixed bound.

## 3. CPU

The audio ISR runs every 5.8 ms (256 frames at 44.1 kHz) and renders in blocks of `CTL` = 32 frames (0.73 ms of
audio a block). The sequencer, the step components, the locks, the patterns and the harmony run on core 0 in
`events_block`, once a block. The voices and effects render on both cores (`fx.c units_split`).

### Measured on the host (`tests/groove_cost.c`)

Eight busy tracks: six synth tracks (ANALOG) with a 3-note chord on every step, two drum tracks with a hit on every
step. First with no new feature, then with every feature at work: 7 step components a track (RAND, RAMP+, MULT, VEL,
TRIG, PARAM, BEND), 8 locks a track (4 with SLIDE), a chain of two patterns (all eight tracks change pattern on the
same block, every loop), FOLLOW SCALE on the synth tracks with a 4-chord progression (a change every bar), and a
latched effect. The benchmark checks that all of it was at work (56 components, 64 locks, 120 pattern changes, the
four chords seen). Three runs of 40,000 blocks each; the range of the three:

| What is timed | Mean a block | 99.9 % of blocks under |
| --- | ---: | ---: |
| `events_block` (core 0's control path), no new feature | 0.27 .. 0.34 us | 2.0 .. 18.9 us |
| `events_block`, every feature | 0.32 .. 0.35 us | 7.2 .. 19.7 us |
| `mix_block` (everything), no new feature | 8.3 .. 8.8 us | 52 .. 60 us |
| `mix_block`, every feature | 7.6 .. 7.9 us | 41 .. 51 us |
| `mix_block`, CRUSH latched on the MASTER (as before) | 8.0 .. 8.4 us | 50 .. 58 us |
| `mix_block`, CRUSH latched on the DRUMS (the second dry bus) | 8.0 .. 8.6 us | 46 .. 59 us |

The longest single blocks (40 us to 5 ms) are not in the table: they come from the host's scheduler and are as
large in the runs without the new features.

What this shows:

- The new control-path work costs about **0.05 us a block on average**, under 1 % of a block's host cost. Most of a
  block is the voices' rendering, which the features do not change.
- The largest piece of new work in one block is a **pattern change**: an encode of the old pattern and a decode of
  the new one. `tests/pat_test.c` measures 1.5 .. 2.7 us for one change of a 32-step chord pattern and 12 .. 21 us
  for all eight tracks at once (several runs). This is the tail of the `events_block` rows. On the FM-1 it runs in
  the audio ISR on core 0, once per change (a quantized change of every track lands on the same block).
- The whole block is not more expensive with every feature; it is a little cheaper here only because the features
  change what plays (TRIG drops half of one step's notes, the locks change sound parameters). It shows that the new
  work is small next to the rendering, not that the features save time.
- The FX target's second dry bus is within the run-to-run noise.
- The suite's own figures on the final tree: the 2-minute soak (random live use, components, patterns, harmony)
  averages 5.06 us a block; the UI fuzz, 99.9 % of blocks under 42 us and 119 us (its two sessions);
  `tests/regress.c`: 0 CPU entries over budget.

### What is not known

The FM-1's processor is much slower than this host, and the ratio was not measured. So these numbers do not say how
much of the 5.8 ms ISR budget eight busy tracks take on the FM-1. The existing protections stay: overload sheds
voices (`voice.c shed_voice`), the second core takes part of the rendering, and GLO > SYSTEM shows the CPU load
(KNOB 4). To check on hardware: eight busy tracks with chains of dense patterns changing on the same bar, with
FOLLOW on, while watching the CPU readout and listening for dropped voices.

## 4. Determinism and the existing sound

- The 182 golden renders of `tests/regress.c` are bit for bit unchanged by every milestone after B. With a feature
  at its default (no component, no lock past the old ones, pattern 1 only, FOLLOW OFF, no FX target) the code takes
  the old path.
- The render split over two cores gives the same output as one core, also with the FX target on
  (`tests/mix_split_test.c`, every split mode; ThreadSanitizer clean, `tests/cpu1_modes.sh`).
- The step components use each track's own random generator (`cp_rng`), seeded at PLAY. They do not draw from the
  shared `rng()`, so the existing sounds' random seeds are unchanged.
- `tests/regress.c`'s CPU check (per-preset cost against `tests/cpu_baseline.txt`, +35 % timed) passes.

## 5. Bounds of the new work per block (core 0)

| Work | Bound |
| --- | --- |
| step components | at most `NCOMP` (16) components looked at per step that fires, `NCPAR` (4) extra parameter values |
| locks | at most `NLOCK` (32) per track looked at per step; at most `NSLIDE` (4) slides moved per track per block |
| pattern change | one encode and one decode of at most 64 steps, 32 locks, 16 components per track that changes |
| harmony | at most 12 x 8 scale lookups per note moved |
| FX target | two more accumulations per frame for the targeted tracks, one sum per frame |

## 6. How to measure again

```sh
python3 tools/proxy_size.py --json                         # proxy sizes (default build)
python3 tools/proxy_size.py --json -DFELUCCA_VIS=0         # a variant
cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/groove_cost.c -lm -o build/host/groove_cost
build/host/groove_cost                                     # the host cost table above
HOST_ONLY=1 sh tests/run_tests.sh                          # the full host suite
```

On a machine with the JieLi toolchain and the AC79 SDK, `tools/build.py` gives the real sizes and writes
`build/felucca.dis`, from which `tests/target_budget.py` checks the target cost of the render loops.
