# Groovebox upgrade: status, limits, build and install

This page tells what the groovebox upgrade of BoopBox implements and what it does not implement. It also tells how
to build and install the firmware. It applies to BoopBox 1.9.3.

Other pages give more data:

| Topic | Page |
| --- | --- |
| The controls | `docs/groovebox-controls.md` |
| The design | `docs/groovebox-architecture.md` |
| The project format | `docs/groovebox-storage.md` |
| The measured cost | `docs/groovebox-performance.md` |
| The build, all options | `BUILDING.md` |

**Status in one line:** each feature below has host tests in `tests/run_tests.sh`. The host tests compile the
firmware code for the PC and simulate the inputs of the FM-1. The default build fits the flash. In 1.9.3, 2,364 B of
the app slot are free (`docs/groovebox-performance.md`, section 1).

## 1. Implemented

Each test in the table is in `tests/` and `tests/run_tests.sh` runs it.

| Feature | What it does | Tests |
| --- | --- | --- |
| Eight tracks | 8 tracks. Each track is a synth track or a drum track. By default, tracks 4 and 8 are drum tracks. `SAVE > TOOLS > KIND` changes the kind. Each track has its own engine, preset, pattern, length and MIDI channel. The render is split over the two cores. | `tracks8_test`, `mix_split_test`, `cpu1_modes.sh` (ThreadSanitizer), `ui_pages_test` |
| 20 synth voices (1.6.0) | The synth tracks share 20 voices (`NVBUDGET`). One track plays a maximum of 8 notes (`NPOLY`). The trainer build keeps 8 voices. | `tracks8_test`, the regression suite (`tests/regress.c`) |
| Big engines | GRAIN, WHEEL, FM6, PHYS and OBERVAVE keep their state in an engine arena. There are 3 arenas (`NARENA`). The UI refuses a big engine on a fourth track and shows a message. | `arena_test`, `tracks8_test` |
| Step components | 14 types: PULSE, HOLD, MULT, VEL, RAMP+, RAMP−, RAND, PORTA, BEND, TONE, JUMP, PARAM, COND, TRIG. A track has a maximum of 16 (`NCOMP`). A step can have more than one, each of a different type. Play directions are FWD, REV, PEND and RAND. Each track has a seed. You edit them in the step sheet. | `comp_test`, `ui_pages_test`, `soak_test` |
| Parameter locks | A track has a maximum of 32 locks (`NLOCK`). A step can have more than one lock, one for each parameter. SLIDE glides a parameter over its step, 4 at the same time on a track (`NSLIDE`). `MENU > SEQ > REC KNOBS` records knob moves as locks. A save keeps the own values of the track, not a lock that plays at that time. | `lock_test`, `ui_pages_test` |
| Patterns | 8 patterns for each track (`NPAT`). A pattern change is quantized: LOOP, 1, 2 or 4 bars. Tracks that you ask together change together. COPY and CLEAR. | `pat_test`, `ui_pages_test`, `soak_test` |
| PATTERNS, CHAIN and SCENES pages (1.7.0) | Three pages after PLAY. On these pages, white keys 1–8 select patterns 1–8 and white keys 9–16 start scenes 1–8. A chain has a maximum of 16 slots (`NCHAIN`). Each slot has a pattern and 1–16 repeats. PLAY turns the chain on or off. There are 8 named scenes. A scene sets a pattern for each track, or KEEP. | `pat_test`, `ui_pages_test` |
| Song loop region | The song can loop a region of its entries. | `pat_test`, `song_ui_test` |
| Harmony | The song has a key, a scale and a chord. Each synth track has a FOLLOW setting: OFF, TRANS or SCALE. Changes occur on NOW, BEAT or BAR. A progression has a maximum of 8 chords (`NHPROG`). The keys can play live chords (latched). The note-off of a note is always for that same note. | `harm_test`, `ui_pages_test` |
| Performance effects | The punch-in effects have TARGET (MASTER, SEL, DRUMS, SYNTHS), LATCH (the keys and the MIDI FX channel) and Q (OFF, 1/16, 1/8, 1/4, BAR). | `perf_test`, `mix_split_test` |
| Beats from the keys (1.9.0) | On the PLAY page of a drum track, held white keys write a full beat. The lowest key selects the groove. The other keys add detail. The same keys and the same SEED always give the same beat. | `drumgen_test` |
| Key velocity and aftertouch (1.8.0) | The keys of the FM-1 can send velocity and aftertouch. Hold HOME, then select **KEYS**. Both functions are OFF by default. | `keyvel_test`, `keyvel_seq_test` |
| NRPN (1.8.0) | MIDI can set each track parameter with 14 bits: CC99, CC98, then CC6 and CC38. The map is `docs/NRPN.md`. | `nrpn_test` (it also compares `docs/NRPN.md` with the firmware) |
| OBERVAVE engine (1.7.0) | An analog polysynth engine with 70 programs. | the regression suite (`tests/golden.txt`) |
| USB HOST (1.7.0) | A class-compliant USB-MIDI keyboard can play BoopBox through a powered hub. | `usb_host_test` |
| The second flash chip (1.8.0) | BoopBox reads and writes the flash chip of the FM-1 units sold from late 2026. | `recovery_test` |
| Storage | Project format 7 ("FUN7") is the only format. BoopBox does not read or write the formats 1 to 6 of SLOOP. BoopBox finds damaged data and refuses it. It never cuts a project. | `project_test`, `storage_test`, and the store checks of the feature tests |
| Web editor and site | The editor edits all eight tracks, the patterns, chains, scenes, step components and the chord progression. The installer, the offline editor and the site are tested. | `web/test_web.mjs` (with `proj7_tool`), `site_test.py`, `pwa_test.mjs`, `install_test.py`, `run_preview_tests.sh` |
| Browser emulator (1.8.0) | The site runs the real firmware in the browser. | `emu_test`, `emu_wasm_test.mjs` |
| BoopBox Trainer (1.4.0) | A second firmware that teaches three songs on the FM-1. It has three levels. It has no web editor and three sample sets fewer. | `trainer_test` |
| Flash budget | The boot logo is text by default. The BASS sample set has three recordings. The firmware builds two tables in RAM. If the image does not fit, `tools/build.py` stops with an error. | the real build (section 4) |

The features of BoopBox from before the groovebox upgrade continue to work. The regression suite compares a hash of
each render with `tests/golden.txt` (252 renders in 1.9.3). USB-MIDI, USB audio, the TRS MIDI input, the M-UPGRADE
update entry and the USB rescue have their own host tests.

## 2. Limits and what is not implemented

### Left out for flash room

These items are left out to fit the flash:

- **The bitmap boot logo.** The boot logo is text (`FELUCCA_LOGO_TEXT=1`).
- **The top recording of the BASS sample set.** The BASS set keeps three recordings: E1, B1 and F#2. The F#2
  recording plays the top notes.

To get flash room, the firmware also builds two tables in RAM:

- The sine table, at power-on (`sine_fill`).
- The 2^x table of FM6, at the first use (`fm6_x2_fill`).

Since 1.8.0, the firmware reads the screen font directly from the flash. See `docs/groovebox-performance.md` for
the measured sizes.

### Other limits

| Item | Limit |
| --- | --- |
| Screens | A screen shows 4 tracks at a time: the bank (1–4 or 5–8) of the selected track. |
| Synth voices | The synth tracks share 20 voices. One track plays a maximum of 8 notes. Each engine can have a lower limit. |
| Big engines | A maximum of 3 tracks can play GRAIN, WHEEL, FM6, PHYS or OBERVAVE at the same time. |
| STUT | The SLICER has 4 STUT buffers. A fifth track in STUT plays live with no repeat until a buffer is free. |
| Project size | A project object is 3,840 B. A project that does not fit is refused whole. Eight dense tracks (6,664 B in the host test) do not fit. |
| Pattern bank | The patterns that do not play share a bank of 3,072 B. The firmware refuses a change that does not fit. |
| Harmony | Only the notes of the sequencer move. The keys, the arpeggiator and MIDI in play as they are. Drum tracks never follow. |
| Performance effects | These are the existing punch-in effects with new controls. They are not new effect types. |
| USB HOST | USB HOST was not tried on an FM-1 with a keyboard (1.7.0 release notes). Low-speed devices are not supported. |

More details:

- **Recording on a track off the grid.** PULSE, HOLD, JUMP or a direction other than FWD move the playhead off the
  grid. On such a track, live recording writes into the step of the grid.
- **Performance effects with a target.** The memory of the loop effects holds only the targeted tracks. For a
  maximum of 0.74 s after a target change, it holds the sound from before the change.
- **Step components.** The behavior of each type is a definition of this firmware. `docs/groovebox-controls.md`
  lists them. They are not copies from another instrument.
- **The web editor.** It reads the working project (backup object 0, format 7) and changes it in the browser
  (`web/src/editor/lib/proto.js`, `PROJ7`). Then it sends the project back whole. The FM-1 loads it immediately. This
  is possible only while the song is stopped. `tests/proj7_tool.c` compares this codec with the capture and the load
  of the firmware.
- **Song sections in the web editor.** The Patterns page edits only the working project. To edit a section A..D,
  load the section on the FM-1. Then edit it and save it into the same section again.
- **Projects of SLOOP.** BoopBox does not read the four-track formats of SLOOP, and SLOOP does not read the format
  of BoopBox. In both directions, the sections show as empty. See `docs/groovebox-storage.md`, sections 4 and 7.
  Make a backup first.

## 3. Tests

`tests/run_tests.sh` runs all the host tests. `BUILDING.md` (section *Tests*) tells how to run them and how long
they take.

Four tests need the firmware image:

- The M-UPGRADE update entry.
- The update loader.
- The target cost of the render loops (`tests/target_budget.py`).
- The site with no internet in Chromium.

If you do not have the JieLi toolchain, use `HOST_ONLY=1 sh tests/run_tests.sh`. This command skips these four
tests and names them.

These variables make a run shorter:

| Variable | Effect |
| --- | --- |
| `SOAK_MIN=n` | The soak test runs for n minutes (default 10). |
| `SKIP_CPU_VALGRIND=1` | The CPU check uses time, not callgrind. |
| `TEST_JOBS=n` | n jobs run at the same time (default: the number of CPUs). |

## 4. Build

`BUILDING.md` gives the full steps, the prerequisites and the build options. This is a summary.

On Linux or macOS:

1. Install the JieLi toolchain with `tools/get_toolchain.sh`.
2. Get the three AC79 SDK files. `BUILDING.md` gives the `git clone` command.
3. Run `scripts/build.sh`.

The build writes three files:

| File | What |
| --- | --- |
| `build/felucca.bin` | the firmware app |
| `build/loader/ota.bin` | the update loader |
| `build/felucca.fwsc` | the package to install (app and loader) |

On Windows with WSL:

1. Run `scripts/INSTALL-BOOPBOX.bat`.
2. Keep the window open during the install.

`scripts/INSTALL-BOOPBOX.bat` runs `scripts/build-boopbox.ps1`. This script builds the firmware in WSL. It writes the
site into `build/boopbox-site` and serves it on `http://localhost:8766`. Then it opens the installer in the browser.

To open the editor again later, run `scripts/OPEN-EDITOR.bat`. It serves `build/boopbox-site` and opens
`http://localhost:8766/webapp/editor/`.

Notes about the build:

- If the image does not fit, `tools/build.py` stops with an error. It does not leave out anything by itself.
- The bitmap boot logo can replace the visualizer: `FELUCCA_VIS=0 FELUCCA_LOGO_TEXT=0 scripts/build.sh`.
- With `FELUCCA_EDITOR=0`, the web editor gets no reply from the FM-1. Updates and the USB rescue continue to work.

## 5. Install and recovery

> CAUTION: You install custom firmware at your own risk. Before you install, save a backup with the web editor. The
> backup keeps the projects, user presets and samples.

To install with Python:

1. Install the MIDI packages: `pip3 install mido python-rtmidi`.
2. Run `python3 tools/fm1_install.py build/felucca.fwsc`.

To show the identity of the connected FM-1, run `python3 tools/fm1_install.py --info`.

To install with the web installer from a local copy of the site:

```sh
python3 web/make_site.py build/felucca.fwsc dev /tmp/felucca-site
cd /tmp/felucca-site && python3 -m http.server 8000
```

Then open `http://localhost:8000/webapp/installer/` in Chrome or Edge. Web MIDI needs `localhost`.

Recovery:

| Problem | Action |
| --- | --- |
| The FM-1 does not start BoopBox. | Hold **OCT−** alone while you switch on the FM-1 (*BoopBox USB RESCUE*). Then install again. |
| An install stopped before the end. | The FM-1 stays in update mode. Install again. |
| The FM-1 does not start at all. | Use [FM-1-transporter](https://github.com/kurogedelic/FM-1-transporter). |

To go back to SLOOP, install the `.fwsc` of SLOOP. Then restore a backup that you made with SLOOP. SLOOP does not
open projects that BoopBox saved.
