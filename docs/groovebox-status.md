# Groovebox upgrade: status, limits, build and install

This page says what the groovebox upgrade of SLOOP implements, what it does not, and how to build and install it.
The controls are in `docs/groovebox-controls.md`, the design in `docs/groovebox-architecture.md`, the project format
in `docs/groovebox-storage.md`, and the measured cost in `docs/groovebox-performance.md`.

**Status in one line:** every feature below is implemented and tested on the host (the firmware's code compiled
for the PC, with the FM-1's inputs simulated). **No firmware image was built and nothing was run on an FM-1** (the
JieLi toolchain and SDK could not be downloaded here; see section 4). The image probably does not fit the flash
without the manual `FELUCCA_EDITOR=0` option (section 5).

## 1. Implemented

| Feature | What it does | Tests |
| --- | --- | --- |
| Eight tracks | 8 tracks, each a synth or a drum track (default: drums on 4 and 8, `SAVE > TOOLS > KIND` changes it); own engine, preset, pattern, length, MIDI channel; a shared budget of 8 synth voices and one pool of drum voices; at most 3 big engines (refused and said for a fourth); render split over two cores | `tracks8_test`, `arena_test`, `mix_split_test`, `cpu1_modes.sh` (TSan), `ui_pages_test` |
| Step components | 14 types (PULSE, HOLD, MULT, VEL, RAMP+, RAMP−, RAND, PORTA, BEND, TONE, JUMP, PARAM, COND, TRIG); 16 a track, several a step; directions FWD, REV, PEND, RAND; a seed; edited in the step sheet | `comp_test`, `ui_pages_test`, `soak_test` |
| Parameter locks | 32 a track, several a step (one a parameter); SLIDE (a glide over the step, 4 at once a track); knob moves recorded as locks (`MENU > SEQ > REC KNOBS`); saves keep the track's own values; the sheet's LOCKS strip | `lock_test`, `ui_pages_test` |
| Patterns | 8 a track; changes quantized (LOOP, 1, 2, 4 bars; tracks asked together change together); chains of 2..8; COPY, CLEAR; the PATTERNS screen; the song's loop region | `pat_test`, `song_ui_test`, `ui_pages_test`, `soak_test` |
| Harmony | the song's key, scale and chord; per-track FOLLOW (TRANS, SCALE); changes on NOW / BEAT / BAR; a progression of up to 8 chords; live chords from the keys (latched); a note's note-off is always its own note's | `harm_test`, `ui_pages_test` |
| Performance effects | the punch-in effects with TARGET (MASTER, SEL, DRUMS, SYNTHS), LATCH (keys and the MIDI FX channel) and Q (1/16, 1/8, 1/4, BAR) | `perf_test`, `mix_split_test` (TARGET scene) |
| Storage | project format 7 (eight tracks, all the above), formats 1..6 read and converted, damage detected, never cut (refused whole), format 6 kept as a fallback | `project_test` and the feature tests' store checks |
| Size fallbacks | `tools/build.py`: text logo, then no visualiser, each said; `FELUCCA_EDITOR=0` by hand | compile-checked only (proxy build, `-Wall`) |

The existing SLOOP features keep working: the 182 golden renders are unchanged, USB-MIDI, USB audio, the TRS MIDI
input, the M-UPGRADE update entry and the USB rescue are untouched (their host tests pass).

## 2. Limits and what is not implemented

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
- **Going back to SLOOP 2.8.3:** it does not read format 7, so projects saved by this firmware show as empty there
  (see `docs/groovebox-storage.md`, section 7). Back up first.

## 3. Test results

`HOST_ONLY=1 SOAK_MIN=2 SKIP_CPU_VALGRIND=1 sh tests/run_tests.sh` passes on the final tree: *ALL HOST TESTS
PASSED* in 17 min 52 s on this machine, including the 182 golden renders unchanged, the two-core split under
ThreadSanitizer (no race), the UBSan builds and a 2-minute soak (the full log is not part of the repository). Four tests are skipped in `HOST_ONLY` mode because they need a firmware image: the
M-UPGRADE entry, the update loader, the target cost of the render loops (`tests/target_budget.py`) and the
offline site in Chromium (it is built from `build/felucca.fwsc`).

## 4. Blockers met

- The JieLi pi32v2 toolchain (`tools/get_toolchain.sh`: pkgman.jieliapp.com) and the AC79 SDK (gitee.com) could not
  be downloaded: the network policy of this environment blocks those hosts. So no `build/felucca.bin`, no
  `.fwsc`, no real size and no target cost check.
- No FM-1 was available. Nothing was flashed (as asked) and no behaviour was checked on hardware: the timing, the
  CPU load at 8 busy tracks, the display layouts and the feel of the controls are checked on the host only.

## 5. Build

The build is SLOOP's own; see `BUILDING.md` for the prerequisites (Python 3 with Pillow, the JieLi toolchain, the
three AC79 SDK files, Docker on macOS).

```sh
tools/get_toolchain.sh                 # the JieLi toolchain, to ~/.jieli/toolchain
git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
    https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK
./build.sh                             # build/felucca.bin, build/loader/ota.bin, build/felucca.fwsc
```

When the image does not fit the 581,564-byte app slot, `tools/build.py` builds again with the text boot logo, then
also without the full-screen visualiser, and prints each step (`build: the flash is full: building again with ...`,
then `build: NOTE: built with ...`). If it still does not fit, the build fails and says so. Then build without the
web editor's SysEx, which `docs/groovebox-performance.md` estimates is needed:

```sh
FELUCCA_EDITOR=0 ./build.sh
```

With `FELUCCA_EDITOR=0` the web editor gets no reply from the FM-1; updates, the USB rescue, USB-MIDI and USB audio
still work. After the first real build, check:

1. the size line that `tools/build.py` prints, against `docs/groovebox-performance.md`;
2. `sh tests/run_tests.sh` (without `HOST_ONLY`): it runs the four skipped tests on the image;
3. `BUDGET_UPDATE=1` only after reviewing `tests/target_budget.py`'s report (the render loops did not change, so
   their budget should still pass).

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

- the FM-1 no longer starts SLOOP: hold **OCT−** alone while you switch it on (*SLOOP USB RESCUE*), then install
  again (this firmware or a SLOOP release);
- an install was cut off: the FM-1 stays in update mode; install again;
- the FM-1 does not start at all: [FM-1-transporter](https://github.com/kurogedelic/FM-1-transporter).

To go back, install the `.fwsc` of a SLOOP release (for example `docs/firmware/sloop-2.8.3.fwsc`) and restore your
backup there. Projects saved by this firmware do not open in 2.8.3.
