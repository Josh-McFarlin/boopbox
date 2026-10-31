# Performance and resources

This page gives the measured cost of the groovebox features: flash, RAM and CPU. Read the source of each number:

- **Real build**: `tools/build.py` with the JieLi pi32v2 toolchain (jieli-linux-toolchains-20260730.1) and the AC79
  SDK files. The 2.8.3 tree built with this toolchain gives an app of 570,176 B, the size of the shipped 2.8.3 app,
  so these figures are the firmware's own.
- **Proxy build** (`tools/proxy_size.py`): the whole firmware compiled with the host clang for RISC-V RV32IMC at
  `-Os`, for use without the JieLi toolchain. Its RAM figures match the real build closely; its code size does not
  (another instruction set: it put this upgrade's growth at 35.3 KB, the real build at 29.1 KB).
- **Host time**: the firmware's audio and sequencer code compiled with `cc -O2` and timed on this machine (x86-64,
  4 cores). It is not the FM-1's time. Only ratios between two runs on the same machine are meaningful.

**Nothing on this page was measured on an FM-1.** An image was built; none was flashed.

## 1. Flash

The app slot is 581,564 B (`APP_SLOT` 0x8DFBC). The 2.8.3 app is 570,176 B: **11,388 B were free**.

### The final build

| | Bytes |
| --- | ---: |
| App, default build (`./build.sh`) | **576,212** |
| Free in the slot | **5,352** |

To fit, three things that cost no feature of the groovebox upgrade were taken out (all measured on the real build):

| Taken out | Saves | What it means |
| --- | ---: | --- |
| The bitmap boot logo (`FELUCCA_LOGO_TEXT=1`, now the default) | 4,592 | the boot screen shows "BoopBox" as text in the tracks' colours |
| The full-screen visualiser (`FELUCCA_VIS=0`, now the default) | 8,980 | HOME on HOME stays on the TRACKS screen |
| The top recording of the SAMPLE engine's BASS set (C#, note 73) | 9,372 | the F# recording (note 66) now plays notes 63 and up; notes below 70 sound exactly as before |

The bitmap logo can be set back (`FELUCCA_LOGO_TEXT=0`: about 750 B are left). The visualiser fits again only without
the web editor (`FELUCCA_VIS=1 FELUCCA_EDITOR=0`): see the variants below.

**Since then (BoopBox):** the visualiser is back in the default build with six of its styles (`FELUCCA_VIS=1`,
`FELUCCA_VIS_STYLES=0x533`: OSCILLOSCOPE, SPECTRUM, VU METERS, CIRCLE, BOUNCE, WIRES), beside the web editor. Measured
on the real build of this tree (the slot is 581,564 B):

| Build | App | Free |
| --- | ---: | ---: |
| the default: six styles, web editor | 580,972 | 592 |
| no visualiser (`FELUCCA_VIS=0`) | 576,632 | 4,932 |
| BOOPBOX style only (`FELUCCA_VIS_STYLES=0x800`), web editor | 579,392 | 2,172 |
| the six and BOOPBOX (`0x933`), web editor | 4 B over | — |
| all twelve styles, web editor | 3,336 B over | — |
| all twelve styles, no web editor (`FELUCCA_EDITOR=0`) | 571,064 | 10,500 |

(This tree's app is 420 B more than the 576,212 above before the visualiser: the BoopBox About page and the eight
tracks' own colours.)

### Growth per milestone (real build, default flags of each tree)

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

### What single features cost (real build)

Each measured by building the final tree with that feature's entry points made empty (the compiler drops its code):

| Feature | Saves |
| --- | ---: |
| The web editor's SysEx (`FELUCCA_EDITOR=0`) | 13,872 |
| The visualiser | 8,980 |
| The bitmap boot logo | 4,592 |
| Harmony (engine, live chords, CHORDS screen) | 4,200 |
| Step components (engine and COMP strip) | 3,492 |
| The CHORDS screen alone | 3,208 |
| The PATTERNS screen | 3,104 |
| The format 6 fallback writer | 1,104 |
| The sheet's LOCKS strip | 828 |
| SAVE > TOOLS > KIND | 432 |
| FX > PERF Q | 164 |
| REC KNOBS (knob moves as locks) | 160 |
| BEND (step component) | 64 |
| The song's loop region | 48 |
| SLIDE (the glide itself) | 32 |

The visualiser's styles (real build, `FELUCCA_VIS=1`, each style left out alone with `FELUCCA_VIS_STYLES`): the
whole visualiser 9,168 B, its frame with no style 1,860 B; SLOOP 1,672, SPECTRUM + SPECTROGRAM together 1,272 (their
FFT; alone 144 and 280), LCD 704, TAPE 644, ORBIT 568, LISSAJOUS 544, OSCILLOSCOPE 320, WIRES 320, VU METERS 304,
CIRCLE 288, BOUNCE 208. Six styles fit beside the web editor (OSCILLOSCOPE, SPECTRUM, VU METERS, CIRCLE, BOUNCE,
WIRES: `0x533`, 836 B left), seven only just (428 B left with SPECTROGRAM added), eight do not.

Sample data, exact bytes (one recording fewer in a set): PIANO 11,025, VIBES 11,025, FLUTE 10,474, BASS 9,922 (B) or
9,372 (C#), HORNS 6,615, STRGS 6,615.

### Build variants (real build, before the bass recording was taken out)

| Variant | Result |
| --- | ---: |
| the 2.8.3 defaults (bitmap logo, visualiser) | 17,756 B over |
| text logo | 13,164 B over |
| text logo, no visualiser | 4,184 B over |
| no web editor | 3,900 B over |
| text logo, no web editor | fits, 708 B free |
| text logo, no visualiser, no web editor | fits, 9,352 B free |

With the bass recording out, each of these has 9,372 B more room.

When the image does not fit, `tools/build.py` fails and names `FELUCCA_EDITOR=0`; it takes nothing out by itself.
With `FELUCCA_EDITOR=0` the web editor gets no reply from the FM-1 (no editing, backup or sample upload over USB);
M-UPGRADE updates, the USB rescue (`recovery.c`, OCT− at power-on), USB-MIDI and USB audio stay: `ota_service` still
reads every SysEx frame and drops the editor's.

## 2. RAM

| Region | Size | 2.8.3 | Final build | Free |
| --- | ---: | ---: | ---: | ---: |
| RAM region (.data + .bss) | 98,304 | 59,308 | 74,684 | 23,620 |
| Pool (.pool, `tools/build.py` demands 8,192 B headroom) | 344,064 | 333,900 | 328,444 | 15,620 |
| `.lowram` | 29,384 | 22,772 | 22,772 | 6,612 |
| NOINIT (`proj_slot[4]`: 4 x 3,840 B; proxy figure) | 15,696 | 15,464 | 15,560 | 136 |

(Real build figures, from `tools/build.py`'s checks; the visualiser's buffers left the pool and the RAM region with
it.) Where the RAM went, by milestone (proxy build, with the visualiser): B +12.4 KB (the four extra tracks'
`track_t` +8.6 KB, their INSERT states, FM6's per-track copies), C +0.9 KB (the step components in each `track_t`),
D +1.6 KB (locks 25..32, the slides), E +3.3 KB (the pattern bank, 3,072 B, and the chain state), F +132 B (the
harmony), the FX target +32 B. The FX target's second dry pair in the mix accumulators (`acc[2].pl/pr`, 512 B) is in
`.lowram`; the old drum bus of the same size left `.lowram` in Milestone B, so `.lowram` is unchanged.

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
- The target cost of the render loops (`tests/target_budget.py`, a static count of the instructions in the loops of
  each render function in the real build's disassembly): every loop is within 1 % of the 2.8.3 tree built with the
  same toolchain (`drums_mix` 6,830 against 6,811). The FX target made the compiler inline `mix_block` into the audio
  ISR; `mix_block` is `noinline` again, so the ISR is 256 (2.8.3: 268). `tests/target_budget.txt` was written for an
  older toolchain, on which 2.8.3 itself is over budget; it was rewritten on this one (its notes say so).

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
python3 tools/proxy_size.py --json -DFELUCCA_VIS=1         # a variant
cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/groove_cost.c -lm -o build/host/groove_cost
build/host/groove_cost                                     # the host cost table above
HOST_ONLY=1 sh tests/run_tests.sh                          # the full host suite
```

On a machine with the JieLi toolchain and the AC79 SDK, `tools/build.py` gives the real sizes and writes
`build/felucca.dis`, from which `tests/target_budget.py` checks the target cost of the render loops.
