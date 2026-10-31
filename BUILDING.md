# Building BoopBox

The build makes three files in `build/`:

| File | What |
| --- | --- |
| `felucca.bin` | the firmware app |
| `loader/ota.bin` | the update loader |
| `felucca.fwsc` | the installable package (app + loader) |

## Windows (WSL)

`INSTALL-BOOPBOX.bat` builds in a WSL distribution and opens the installer on
`http://localhost:8766/webapp/installer/`. It needs Python 3 with Pillow on Windows, a WSL
distribution with the JieLi toolchain, and the three SDK files (below) in `build/deps/ac79`.
Set `SLOOP_WSL_DISTRO` (default `Ubuntu`) and `SLOOP_TOOLCHAIN` (a Linux path, default
`/root/.jieli/toolchain`) if yours differ.

## Prerequisites (macOS)

- Python 3 with Pillow: `pip3 install Pillow`
- Docker Desktop. The JieLi toolchain is Linux x86-64 only; the build runs each tool in a
  `linux/amd64` `debian:bookworm-slim` container (Rosetta on Apple silicon). Keep the source
  tree in a folder Docker can share, e.g. under `/Users`.
- The JieLi Linux toolchain (clang 4.0.1 for pi32v2, from JieLi's package server):

  ```
  tools/get_toolchain.sh            # installs to ~/.jieli/toolchain
  ```

- The JieLi AC79 SDK (Apache-2.0). The package uses three of its files
  (`cpu/wl82/tools/uboot.boot`, `cfg_tool.bin`, `cfg/eq_cfg_hw.bin`); they are not part of this tree.

  ```
  git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
      https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK
  ```

- Node.js (optional, for the web tests).

On Linux x86-64 the toolchain runs natively and Docker is not needed.

## Build

```
./build.sh
```

`JIELI_TOOLCHAIN` and `AC79_SDK` override the default locations
(`~/.jieli/toolchain`, `~/fw-AC79_AIoT_SDK`).

`./build.sh --release 1.1.0` makes a release build: the package identity becomes `FM-1_911` and the version
string `BOOPBOX 1.1.0`; the package is `build/felucca-1.1.0.fwsc`. A suffix is kept: `--release 1.1.0-beta`
gives `BOOPBOX 1.1.0-BETA`.

Build options (environment, `0` or `1`; defaults in `firmware/src/felucca.c`):

| Flag | Default | |
| --- | --- | --- |
| `FELUCCA_FLASH` | 1 | settings, presets and projects in flash |
| `FELUCCA_OTA` | 1 | update entry (needs `FELUCCA_FLASH`) |
| `FELUCCA_CDC` | 1 | USB serial console |
| `FELUCCA_UAC` | 1 | USB audio input: the master output, 44.1 kHz stereo (after Felucca 1.0) |
| `FELUCCA_UART` | 1 | TRS MIDI IN (the 3.5 mm jack) |
| `FELUCCA_LOGO_TEXT` | 1 | the boot logo as text (4.6 KB less flash than the bitmap logo, 0) |
| `FELUCCA_VIS` | 1 | the full-screen visualiser (HOME on HOME): about 10.8 KB with its six styles; 0 leaves it out |
| `FELUCCA_VIS_STYLES` | 0x3F | with `FELUCCA_VIS=1`: its styles built in, a bit each (bit 0 PALMS, NIGHT DRIVE, HORIZON, FLYOVER, DENSE CITY, bit 5 KEY CITY); SELECT skips the others |
| `FELUCCA_EDITOR` | 1 | the web editor's SysEx (14 KB); 0: the editor gets no reply, updates and USB rescue stay |

The flash is full: the default build leaves 724 B of the app slot free (three tables are built in RAM at power-on to make room: see `docs/groovebox-performance.md`). The bitmap logo fits back in place of the
visualiser (`FELUCCA_VIS=0 FELUCCA_LOGO_TEXT=0`). When the app does not fit, the build fails and
says so; it leaves nothing out by itself. See `docs/groovebox-performance.md` for the measured sizes.

## Samples

The CC0 instrument samples that the SAMPLE engine uses are in `assets/samples-cc0/`
(Versilian Studios, see `ATTRIBUTION.txt` there). `tools/fetch_cc0.py` downloads them
again from the source repositories. Without that folder the build still works and the
SAMPLE engine has only the generated drum kit.

The generated drum one-shots (`build/genwav`, SLICE's BREAK and any GM role the CC0 kit lacks) come
from `tools/gen_drums.py`, which the build runs.

## Logo and icons

The logo, the icon atlas and the web app's icons are made by code and committed; the build reads them.
After changing the drawing code, write them again:

```
python3 tools/gen_logo.py --assets assets/logo     # boopbox-logo/icon .svg/.png, boopbox-splash.png
python3 tools/gen_logo.py --web web                # icon-192.png, icon-512.png, icon-maskable-512.png
python3 tools/gen_icon_art.py                      # assets/icons.png (--preview OUT.png: 8x, labelled)
```

The boot splash itself (`build/gen/boopbox_logo.h`) is made by the build from `tools/gen_logo.py`.

The README's screenshots are made the same way, from the code: `python3 tools/make_screens.py` draws the FM-1's
screens with the firmware's own drawing code (`tools/screens_demo.c`, the host tests' harness, a demo project on the
eight tracks; it needs `build/gen`), and `node tools/make_editor_screens.mjs` takes the web editor's pages in its
mock mode (Playwright and Chromium). Both write into `assets/screens/`.

## Tests

```
tests/run_tests.sh
```

Runs the host tests (flash storage, user presets, MIDI parser, update entry, update
loader, a DSP render, the 8-track mix, project formats, the SLICER, the regression suite,
the command-line installer) and, with Node.js, the web page tests. Run it after `./build.sh`
(it uses `build/` and needs `AC79_SDK` set as for the build).

Without the JieLi toolchain, `HOST_ONLY=1 sh tests/run_tests.sh` runs every test that does not need a firmware
image and names the ones it skips (the update entry, the update loader, the target cost, the offline site).
`python3 tools/proxy_size.py` estimates the code and RAM size with the host clang (see
`docs/groovebox-architecture.md`).

The regression suite (`tests/regress.c`) renders every engine and preset and compares a
hash of each render with `tests/golden.txt`; it also checks levels, voices and the CPU
cost (`tests/cpu_baseline.txt`, `tests/target_budget.txt`). The host CPU cost is relative
to the idle + drums mix, counted by the kernel on macOS and under callgrind on Linux when
valgrind is installed (exact, about 45 s more); without either it is timed, a rough check.
After an intended change of the sound, `GOLDEN_UPDATE=1 sh tests/run_tests.sh` rewrites
the hashes; `BUDGET_UPDATE=1` does the same for the cost files.

## Browser audio preview

The browser preview uses the firmware's DSP and sequencer with RAM-backed user samples.
It requires Python 3, a host C compiler, Node.js for tests, and Emscripten (`brew install emscripten` on macOS).
It does not need the JieLi toolchain, AC79 SDK, Docker, or an FM-1.

```sh
python3 tools/build_preview.py
tests/run_preview_tests.sh
```

The build produces `build/preview/boopbox-preview.wasm`. The tests compare all twelve engines sample by sample
against the same adapter compiled for the host and verify sequencing, live mixer changes, stop, and user samples.
`web/make_site.py` includes the preview and caches it for the site app when the WASM build is present:

```sh
# Use a release package downloaded from isod89/sloop-fm1, or your own firmware build.
python3 web/make_site.py build/releases/boopbox-2.6.fwsc 2.6 build/site
python3 -m http.server 8766 --bind 127.0.0.1 --directory build/site
```

Open `http://localhost:8766/webapp/editor/?mock=1`, **Connect**, then **Play loop** to hear all four tracks.
**Show preview** opens the piano/pads, volume and editable sequence; **Hide preview** folds them while
playback continues. The piano keys and labeled computer keys audition the selected track.
The audio controls are available only in simulated mode. The physical-device editor continues to use Web MIDI.
The standalone downloaded HTML editor does not include the WASM asset.

## Install

On Windows, `INSTALL-BOOPBOX.bat` builds and opens the web installer (Chrome or Edge). The
`.fwsc` of each release is on the GitHub releases page.

From the command line (needs `pip3 install mido python-rtmidi`):

```
python3 tools/fm1_install.py build/felucca.fwsc
python3 tools/fm1_install.py --info          # identity of the connected FM-1
```

Or, to install your own build from the web installer, make a local copy of the site and open it from `localhost`
(Web MIDI needs a secure context):

```
python3 web/make_site.py build/felucca.fwsc dev /tmp/felucca-site
cd /tmp/felucca-site && python3 -m http.server 8000
# open http://localhost:8000/webapp/installer/
```

Installing firmware is at your own risk. If an install fails and the FM-1 no longer
starts, recovery needs [FM-1-transporter](https://github.com/kurogedelic/FM-1-transporter).
