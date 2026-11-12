# Building BoopBox

The build makes three files in `build/`:

| File | What |
| --- | --- |
| `felucca.bin` | the firmware app |
| `loader/ota.bin` | the update loader |
| `felucca.fwsc` | the installable package (app + loader) |

## Windows (WSL)

`scripts/INSTALL-BOOPBOX.bat` builds BoopBox in a WSL distribution. Then it opens the installer on
`http://localhost:8766/webapp/installer/`. The script needs three items: Python 3 with Pillow on Windows, a WSL
distribution with the JieLi toolchain, and the three SDK files (below) in `build/deps/ac79`.
If your WSL distribution is different, set `SLOOP_WSL_DISTRO` (default `Ubuntu`). If your toolchain location is different, set `SLOOP_TOOLCHAIN` (a Linux path, default
`/root/.jieli/toolchain`). For example, in PowerShell: `$env:SLOOP_WSL_DISTRO = 'MinUI-Build'`.

## Prerequisites (macOS)

- Python 3 with Pillow: `pip3 install Pillow`
- Docker Desktop. The JieLi toolchain runs only on Linux x86-64. The build runs each tool in a
  `linux/amd64` `debian:bookworm-slim` container (Rosetta on Apple silicon). Keep the source
  tree in a folder that Docker can share, for example under `/Users`.
- The JieLi Linux toolchain (clang 4.0.1 for pi32v2, from the package server of JieLi):

  ```
  tools/get_toolchain.sh            # installs to ~/.jieli/toolchain
  ```

- The JieLi AC79 SDK (Apache-2.0). The package uses three files of the SDK
  (`cpu/wl82/tools/uboot.boot`, `cfg_tool.bin`, `cfg/eq_cfg_hw.bin`). These files are not part of this tree.

  ```
  git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
      https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK
  ```

- Node.js (optional, for the web tests).

On Linux x86-64, the toolchain runs natively. Docker is not necessary.

## Build

```
scripts/build.sh
```

`JIELI_TOOLCHAIN` and `AC79_SDK` override the default locations
(`~/.jieli/toolchain`, `~/fw-AC79_AIoT_SDK`).

`scripts/build.sh --release 1.2.0` makes a release build. In this build, the package identity becomes `FM-1_912`. The version
string becomes `BOOPBOX 1.2.0`. The package is `build/felucca-1.2.0.fwsc`. The build keeps a suffix: `--release 1.2.0-beta`
gives `BOOPBOX 1.2.0-BETA`.

Build options (environment, `0` or `1`). The defaults are in `firmware/src/felucca.c`:

| Flag | Default | |
| --- | --- | --- |
| `FELUCCA_FLASH` | 1 | settings, presets and projects in flash |
| `FELUCCA_OTA` | 1 | update entry (needs `FELUCCA_FLASH`) |
| `FELUCCA_CDC` | 1 | USB serial console |
| `FELUCCA_UAC` | 1 | USB audio input: the master output, 44.1 kHz stereo (after Felucca 1.0) |
| `FELUCCA_UART` | 1 | TRS MIDI IN (the 3.5 mm jack) |
| `FELUCCA_LOGO_TEXT` | 1 | the boot logo as the wordmark alone ("boopbox" in Pixelify Sans Bold, 1 bit a pixel). It uses over 4 KB less flash than the bitmap logo (0), the pixel boombox over the wordmark. |
| `FELUCCA_VIS` | 1 | the full-screen visualiser (HOME on HOME). It uses about 10.8 KB with its six styles. 0 leaves it out. |
| `FELUCCA_VIS_STYLES` | 0x3F | with `FELUCCA_VIS=1`: the styles that the build includes, one bit for each style (bit 0 PALMS, NIGHT DRIVE, HORIZON, FLYOVER, DENSE CITY, bit 5 KEY CITY). SELECT skips the other styles. |
| `FELUCCA_EDITOR` | 1 | the SysEx of the web editor (14 KB). With 0, the editor gets no reply. Updates and USB rescue stay. |

The flash is almost full. The default build of 1.9.3 leaves 2,364 B of the app slot free. Version 1.9.0 left 320 B free, and version 1.8 left 2,032 B free. Two changes made room for key velocity in 1.8: the firmware reads the font in place, and it computes the display curves (`docs/memory-savings-analysis.md` F4, F9). To make room, the firmware also builds two tables in RAM: the sine table at power-on and the 2^x table of FM6 at first use (see `docs/groovebox-performance.md`). The bitmap logo fits back in place of the
visualiser (`FELUCCA_VIS=0 FELUCCA_LOGO_TEXT=0`).

If the app does not fit, the build fails and tells you. The build does not leave out anything by itself. See `docs/groovebox-performance.md` for the measured sizes.
See `docs/memory-savings-analysis.md` for where the flash and the RAM go, and for the savings that are still possible (measured, ranked).

## The trainer build

`scripts/build.sh --trainer` builds BoopBox Trainer. This is a separate firmware that teaches three songs on the FM-1 itself
(`docs/trainer.md`). It has no web editor. It has three sample sets fewer (HORNS, STRGS, SCRCH). It writes everything to `build/trainer-fw/`,
including the generated headers.

Its package is `felucca-trainer.fwsc`. With `--release X.Y.Z`, the package is `felucca-trainer-X.Y.Z.fwsc`
and the version string is `BOOPBOX TRAINER X.Y.Z`. The trainer build does not change the normal build, byte for byte.

## Samples

The SAMPLE engine uses CC0 instrument samples. These samples are in `assets/samples-cc0/`
(Versilian Studios, see `ATTRIBUTION.txt` there). `tools/fetch_cc0.py` downloads them
again from the source repositories. If that folder is not there, the build still works. Then the
SAMPLE engine has only the generated drum kit.

The generated drum one-shots (`build/genwav`, SLICE's BREAK and each GM role that the CC0 kit does not have) come
from `tools/gen_drums.py`. The build runs this script.

## Logo and icons

Code makes the logo, the icon atlas and the icons of the web app. These files are committed, and the build reads them.
If you change the drawing code, write the files again:

```
python3 tools/gen_logo.py --assets assets/logo     # boopbox-logo/icon .svg/.png, boopbox-splash.png
python3 tools/gen_logo.py --web web                # icon-192.png, icon-512.png, icon-maskable-512.png
python3 tools/gen_icon_art.py                      # assets/icons.png (--preview OUT.png: 8x, labelled)
```

The build makes the boot splash itself (`build/gen/boopbox_logo.h`) from `tools/gen_logo.py`.

Code also makes the screenshots of the README, in the same way. `python3 tools/make_screens.py` draws the screens of the FM-1
with the drawing code of the firmware (`tools/screens_demo.c`, the harness of the host tests, a demo project on the
eight tracks). This script needs `build/gen`. `node tools/make_editor_screens.mjs` takes screenshots of the pages of the web editor in its
mock mode (Playwright and Chromium). Before you run it, build the pages: `cd web && npm ci && npm run build`. Both scripts write into `assets/screens/`.

`python3 tools/make_all_screens.py` draws every screen of the firmware in the same way (`tools/screens_all.c`: every
page, the EDIT pages of every engine, the layers, REC, the menu, the visualiser). It writes into `assets/screens/all/` one PNG for each
screen and one contact sheet for each group. Its `README.md` lists them. Both draw in SYNTHWAVE, the palette that the FM-1 starts
with. To draw in a different palette, use `--palette N` (gfx.c `PALETTES`).

To compare a change, first copy that gallery to a different folder. Then run `tools/make_before_after.py BEFORE AFTER OUT.png`.
This script puts every screen of the two galleries side by side in one image (the UX review's, `docs/ux-review/`).

## Tests

```
tests/run_tests.sh
```

This script runs the host tests (flash storage, user presets, MIDI parser, update entry, update
loader, a DSP render, the 8-track mix, project formats, the SLICER, the regression suite,
the command-line installer). With Node.js, it also runs the web page tests. Run it after `scripts/build.sh`.
It uses `build/` and needs `AC79_SDK` set as for the build.

The tests run in parallel, one job for each test (its compile and its run). The number of jobs at the same time is the number of
CPUs of the machine. On 4 cores, the tests take about 4 minutes. One job at a time took about 16 minutes.

`TEST_JOBS=n` sets how many jobs run at the same time (`TEST_JOBS=1`: one at a time). The script prints the output of each job whole, in order, with its time.
It also keeps this output in `build/host/logs/`. At the end, the script names the failed jobs.

If you do not have the JieLi toolchain, use `HOST_ONLY=1 sh tests/run_tests.sh`. This command runs every test that does not need a firmware
image. It names the tests that it skips (the update entry, the update loader, the target cost, the offline site).
`python3 tools/proxy_size.py` estimates the code and RAM size with the host clang (see
`docs/groovebox-architecture.md`).

The regression suite (`tests/regress.c`) renders every engine and preset. It compares a
hash of each render with `tests/golden.txt`. It also does checks on levels, voices and the CPU
cost (`tests/cpu_baseline.txt`, `tests/target_budget.txt`).

The host CPU cost is relative to the idle + drums mix. On macOS, the kernel counts it. On Linux, if
valgrind is installed, callgrind counts it (exact, about 45 s more). Without either, the tests time it. This is a rough check.

After an intended change of the sound, `GOLDEN_UPDATE=1 sh tests/run_tests.sh` rewrites
the hashes. `BUDGET_UPDATE=1` does the same for the cost files.

## Browser audio preview

The browser preview uses the DSP and sequencer of the firmware, with RAM-backed user samples.
It needs Python 3, a host C compiler, Node.js for tests, and Emscripten (`brew install emscripten` on macOS).
It does not need the JieLi toolchain, AC79 SDK, Docker, or an FM-1.

```sh
python3 tools/build_preview.py
tests/run_preview_tests.sh
```

The build makes `build/preview/boopbox-preview.wasm`. The tests compare all twelve engines, sample by sample,
with the same adapter compiled for the host. The tests also make sure that sequencing, live mixer changes, stop, and user samples work.
If the WASM build is present, `web/make_site.py` includes the preview and caches it for the site app:

```sh
# Use a release package downloaded from isod89/sloop-fm1, or your own firmware build.
python3 web/make_site.py build/releases/boopbox-2.6.fwsc 2.6 build/site
python3 -m http.server 8766 --bind 127.0.0.1 --directory build/site
```

Open `http://localhost:8766/webapp/editor/?mock=1`. Select **Connect**. To hear all four tracks, select **Play loop**.
**Show preview** opens the piano/pads, volume and editable sequence. **Hide preview** folds them, and
playback continues. The piano keys and labelled computer keys audition the selected track.
The audio controls are available only in simulated mode. The physical-device editor continues to use Web MIDI.
The standalone downloaded HTML editor does not include the WASM asset.

## Install

On Windows, `scripts/INSTALL-BOOPBOX.bat` builds and opens the web installer (Chrome or Edge). The
`.fwsc` of each release is on the GitHub releases page.

To install from the command line, you need `pip3 install mido python-rtmidi`:

```
python3 tools/fm1_install.py build/felucca.fwsc
python3 tools/fm1_install.py --info          # identity of the connected FM-1
```

You can also install your own build from the web installer. To do this, make a local copy of the site. Then open it from `localhost`.
Web MIDI needs a secure context. `make_site.py` builds the pages with Node.js (see [The website](#the-website)):

```
python3 web/make_site.py build/felucca.fwsc dev /tmp/felucca-site
cd /tmp/felucca-site && python3 -m http.server 8000
# open http://localhost:8000/webapp/installer/
```

You install firmware at your own risk. If an install fails and the FM-1 does not start any more,
you need [FM-1-transporter](https://github.com/kurogedelic/FM-1-transporter) for recovery.

## Release

When a PR that adds a new firmware binary merges into `main`, GitHub publishes a release
(`.github/workflows/release-on-merge.yml`):

1. Set the version in `firmware/src/ui.c` (`FELUCCA_VERSION "BOOPBOX X.Y.Z"`). Then build with
   `scripts/build.sh --release X.Y.Z`.
2. Rebuild the site: `python3 web/make_site.py build/felucca-X.Y.Z.fwsc X.Y.Z docs`. This command writes
   `docs/firmware/boopbox-X.Y.Z.fwsc` and deletes the old package. It also writes the installer and the offline cache that
   install the package. Do not copy a binary into `docs/firmware/` by hand. The website is these committed files.
   If the site of a PR is not built for its new binary, the PR fails the *Changelog check* (`python3 tools/check_site.py
   docs/firmware/boopbox-X.Y.Z.fwsc`).
3. Add a `## X.Y.Z` section at the top of [CHANGELOG.md](CHANGELOG.md). Write it for the people who install the release.
   This section becomes the release notes. If a PR adds a binary without a section, the PR fails the
   *Changelog check*. The *Changelog check* also shows the notes that it will publish on the summary page of the run.
   To see the notes locally, run `python3 tools/changelog_section.py X.Y.Z`.
4. Merge the PR. The release gets the tag `vX.Y.Z` on the merge commit. It carries the `.fwsc`, the offline
   editor (`boopbox-editor-X.Y.Z.html`) and `SHA256SUMS.txt`. The notes give the SHA-256 of the package and the install instructions.
   To change that part, edit `.github/release-install.md`.
   A version with a suffix (`1.3.0-beta`) is a pre-release. A PR without a new binary releases nothing.
   A version that already has a release also releases nothing.

## The browser emulator

`python3 tools/build_emu.py` compiles the whole firmware to WebAssembly, into `build/emu/` (`firmware/host/emu.c`: the UI, the sequencer, the sound, the
storage on a memory flash). It uses the wasm32 target of clang and wasm-ld (or Emscripten). The emulator page of the site runs it.
To use this page, run `cd web && npm run dev`. Then open `http://localhost:5173/emu/` (the dev server
serves `build/emu/boopbox-emu.wasm` there).

`python3 tools/build_emu.py --trainer` compiles BoopBox Trainer in the same way, into `build/emu/boopbox-trainer-emu.wasm`.
If it is built, the emulator page shows a switch between BoopBox and BoopBox Trainer (`?fw=trainer` opens the trainer).
Each firmware keeps its own flash in the browser.

If the emulator is built, `web/make_site.py` puts it in the site as `webapp/emu/`, with the trainer if that is built too. The tests are `tests/emu_test.c` (the same core on the host) and
`tests/emu_wasm_test.mjs` (the wasm in Node). Both are in `tests/run_tests.sh`.

## The website

The installer, the editor and the emulator are React pages in `web/`
(see [web/README.md](web/README.md)). They use Vite for the build and Tailwind CSS for the styles. They need Node.js 20 or newer:

```sh
cd web
npm ci                   # once
npm run dev              # http://localhost:5173/installer/, /editor/ (?mock=1: a simulated FM-1), /emu/
npm run build            # -> build/webapp-vite/ (and npm run build:offline: the one-file editor)
node test_web.mjs        # the editor's protocol, formats and pages, the installer's update protocol (no browser)
```

`web/make_site.py` runs both builds itself. Then it writes the site (`docs/` for a release) with the package, the
checksums of the installer and the offline cache. `python3 tests/site_test.py` and `node tests/pwa_test.mjs SITE_DIR` do checks on
what it makes.
