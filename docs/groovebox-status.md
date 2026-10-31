# Groovebox upgrade: status, limits, build and install

This page says what the groovebox upgrade of BoopBox implements, what it does not, and how to build and install it.
The controls are in `docs/groovebox-controls.md`, the design in `docs/groovebox-architecture.md`, the project format
in `docs/groovebox-storage.md`, and the measured cost in `docs/groovebox-performance.md`.

**Status in one line:** every feature below is implemented and tested on the host (the firmware's code compiled
for the PC, with the FM-1's inputs simulated), and the default build (`./build.sh`, the JieLi toolchain) makes an
image that fits the flash with 592 B to spare, the web editor and six visualiser styles included. **Nothing was run on an FM-1** (section 4).
To fit, the build leaves out six of the visualiser's twelve styles, the bitmap boot logo and one bass recording (section 2).

## 1. Implemented

| Feature | What it does | Tests |
| --- | --- | --- |
| Eight tracks | 8 tracks, each a synth or a drum track (default: drums on 4 and 8, `SAVE > TOOLS > KIND` changes it); own engine, preset, pattern, length, MIDI channel; a shared budget of 8 synth voices and one pool of drum voices; at most 3 big engines (refused and said for a fourth); render split over two cores | `tracks8_test`, `arena_test`, `mix_split_test`, `cpu1_modes.sh` (TSan), `ui_pages_test` |
| Step components | 14 types (PULSE, HOLD, MULT, VEL, RAMP+, RAMP−, RAND, PORTA, BEND, TONE, JUMP, PARAM, COND, TRIG); 16 a track, several a step; directions FWD, REV, PEND, RAND; a seed; edited in the step sheet | `comp_test`, `ui_pages_test`, `soak_test` |
| Parameter locks | 32 a track, several a step (one a parameter); SLIDE (a glide over the step, 4 at once a track); knob moves recorded as locks (`MENU > SEQ > REC KNOBS`); saves keep the track's own values; the sheet's LOCKS strip | `lock_test`, `ui_pages_test` |
| Patterns | 8 a track; changes quantized (LOOP, 1, 2, 4 bars; tracks asked together change together); chains of 2..8; COPY, CLEAR; the PATTERNS screen; the song's loop region | `pat_test`, `song_ui_test`, `ui_pages_test`, `soak_test` |
| Harmony | the song's key, scale and chord; per-track FOLLOW (TRANS, SCALE); changes on NOW / BEAT / BAR; a progression of up to 8 chords; live chords from the keys (latched); a note's note-off is always its own note's | `harm_test`, `ui_pages_test` |
| Performance effects | the punch-in effects with TARGET (MASTER, SEL, DRUMS, SYNTHS), LATCH (keys and the MIDI FX channel) and Q (1/16, 1/8, 1/4, BAR) | `perf_test`, `mix_split_test` (TARGET scene) |
| Storage | project format 7 (eight tracks, all the above), the only format: SLOOP's formats 1..6 are not read nor written; damage detected, never cut (refused whole) | `project_test` and the feature tests' store checks |
| Flash budget | the text boot logo and six visualiser styles (of twelve) are the defaults; the BASS set has three recordings; `FELUCCA_EDITOR=0` by hand; `tools/build.py` fails and says so when the image does not fit | real build: 576,212 B of 581,564 |

The existing BoopBox features keep working: the 182 golden renders are unchanged, USB-MIDI, USB audio, the TRS MIDI
input, the M-UPGRADE update entry and the USB rescue are untouched (their host tests pass).

## 2. Limits and what is not implemented

- **Left out for flash room** (from SLOOP 2.8.3): six of the visualiser's twelve styles (SPECTROGRAM, LISSAJOUS, TAPE,
  LCD, ORBIT and the logo style; the six built in are OSCILLOSCOPE, SPECTRUM, VU METERS, CIRCLE, BOUNCE, WIRES), the bitmap
  boot logo (the logo is text), and the top recording of the SAMPLE engine's BASS set (notes 70 and up of UP BASS and
  DEEP BASS are played from the F# recording; every note below 70 is as before). See `docs/groovebox-performance.md`.

- **Web editor:** its LIVE page and track list show 4 tracks (the protocol's frame sizes are unchanged). Its song
  page saves the song without the loop region. It was not extended for the new features: it has no editing of step
  components, patterns 2..8 or the chord progression (the FM-1 has; the editor's backup keeps them, because it copies
  whole project objects).
- **Screens** show 4 tracks at a time: the bank (1-4 or 5-8) of the selected track.
- **Voices:** the 8 synth tracks share 8 sounding voices; 3 big engines (GRAIN, DRAWBAR, FM6, PHYS) at once; 4
  tracks with STUT at once.
- **Recording on a track off the grid** (PULSE, HOLD, JUMP, or a direction other than FWD) writes on the grid's
  step, and a held note is not extended into TIEs there.
- **Project size:** a project object is 3,840 B. Eight dense tracks (about 6.4 KB) do not fit and are refused whole;
  the patterns not playing share a 3 KB store (a change that does not fit is refused).
- **Harmony** moves only the sequencer's notes: the keys, the arp and MIDI in play as they are; drum tracks never
  follow.
- **Performance effects** are the existing punch-in effects with new controls, not new effect types. With a target,
  the loop effects' memory holds only the targeted tracks; for up to 0.74 s after a target change it still holds
  what came before.
- **Step component semantics** are this firmware's own definitions (listed in `docs/groovebox-controls.md`); they
  are not copied from another instrument.
- **SLOOP's projects:** BoopBox does not read SLOOP's four-track formats, and SLOOP does not read BoopBox's: going
  either way, the sections show as empty (see `docs/groovebox-storage.md`, sections 4 and 7). Back up first.

## 3. Test results

After `./build.sh`, `SOAK_MIN=2 SKIP_CPU_VALGRIND=1 sh tests/run_tests.sh` passes on the final tree with nothing
skipped: *ALL HOST TESTS PASSED* in 18 min 14 s on this machine. That includes the 182 golden renders unchanged, the
two-core split under ThreadSanitizer (no race), the UBSan builds, a 2-minute soak, and the tests that need the
firmware image: the M-UPGRADE entry and the update loader on the built package, the target cost of the render loops
(`tests/target_budget.py`, rewritten for this toolchain, see `docs/groovebox-performance.md`) and the offline site
in Chromium. The full log is not part of the repository. Without the toolchain, `HOST_ONLY=1` runs everything but
those four.

## 4. Blockers met

- At first the JieLi pi32v2 toolchain and the AC79 SDK could not be downloaded (the environment's network policy).
  With `pkgman.jieliapp.com`, `jl-update.oss-cn-shenzhen.aliyuncs.com` (where the toolchain link leads) and
  `gitee.com` allowed, `tools/get_toolchain.sh` and a sparse checkout of the three SDK files work, and the image is
  built.
- No FM-1 was available. Nothing was flashed (as asked) and no behaviour was checked on hardware: the timing, the
  CPU load at 8 busy tracks, the display layouts and the feel of the controls are checked on the host only.

## 5. Build

The build is BoopBox's own; see `BUILDING.md` for the prerequisites (Python 3 with Pillow, the JieLi toolchain, the
three AC79 SDK files, Docker on macOS).

```sh
tools/get_toolchain.sh                 # the JieLi toolchain, to ~/.jieli/toolchain
git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
    https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK
./build.sh                             # build/felucca.bin, build/loader/ota.bin, build/felucca.fwsc
```

The default build fits (`app ... 580972 B`). The bitmap boot logo can be built back in place of the visualiser with
`FELUCCA_VIS=0 FELUCCA_LOGO_TEXT=0 ./build.sh`; all twelve visualiser styles only without the web editor
(`FELUCCA_VIS_STYLES=0xFFF FELUCCA_EDITOR=0 ./build.sh`). When an image does not fit, `tools/build.py` fails and says so; it
leaves nothing out by itself. With `FELUCCA_EDITOR=0` the web editor gets no reply from the FM-1; updates, the USB
rescue, USB-MIDI and USB audio still work.

After a build, `sh tests/run_tests.sh` (without `HOST_ONLY`) also runs the tests that need the image.

## 6. Install and recovery

Installing custom firmware is at your own risk. Before you install, **save a backup with the web editor** (the
projects, user presets and samples).

```sh
python3 tools/fm1_install.py build/felucca.fwsc     # needs pip3 install mido python-rtmidi
python3 tools/fm1_install.py --info                 # the identity of the connected FM-1
```

Or the web installer from a local copy of the site (Web MIDI needs `localhost`):

```sh
python3 web/make_site.py build/felucca.fwsc dev /tmp/felucca-site
cd /tmp/felucca-site && python3 -m http.server 8000   # open http://localhost:8000/webapp/installer/
```

If something goes wrong:

- the FM-1 no longer starts BoopBox: hold **OCT−** alone while you switch it on (*BoopBox USB RESCUE*), then install
  again (this firmware or a BoopBox release);
- an install was cut off: the FM-1 stays in update mode; install again;
- the FM-1 does not start at all: [FM-1-transporter](https://github.com/kurogedelic/FM-1-transporter).

To go back to SLOOP, install its `.fwsc` and restore a backup made with SLOOP. Projects saved by BoopBox do not open
in SLOOP.
