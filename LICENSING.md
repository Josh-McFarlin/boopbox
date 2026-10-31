# BoopBox licensing

BoopBox is free software: a renamed fork of [SLOOP](https://github.com/isod89/sloop-fm1) (isod89), which is
itself based on [Felucca](https://github.com/hugelton/Felucca) (Leo Kuroshita, Hügelton Instruments). The whole
tree, code and assets alike, is under the GNU General Public License, version 3 only (`GPL-3.0-only`, full text in
`LICENSE`), except for the third-party material listed below under its own licence.

Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments — Felucca, and the files that carry that line.
Copyright (C) 2026 isod89 and the SLOOP contributors — SLOOP.
Copyright (C) 2026 Josh McFarlin and the BoopBox contributors — the BoopBox changes.

Each source file keeps the copyright lines it came with; changes made for BoopBox are recorded in the git history.

## What is GPL-3.0-only

- the firmware: `firmware/` (app, HAL, update loader)
- the build script and tools: `build.sh`, `tools/`
- the web pages (installer, editor) and their tests: `web/` (not the Fukiai font, below)
- the host tests: `tests/`
- BoopBox's own assets, all made by code in this tree:
  - the logo, the app icons and the boot splash (`assets/logo/`, `web/icon-*.png`): `tools/gen_logo.py`
  - the parameter icon atlas (`assets/icons.png`): `tools/gen_icon_art.py`
  - the synthesized drum one-shots (`build/genwav`, used by SLICE's BREAK and for a GM role the CC0 kit lacks):
    `tools/gen_drums.py`

You may use, study, change and share BoopBox under the GPL, for any purpose. If you distribute BoopBox, or
firmware derived from it, you must also give your recipients its complete corresponding source under the same
licence. That includes devices that ship with modified BoopBox inside.

The assets that Felucca and SLOOP shipped as "all rights reserved" (Hügelton Instruments' icon atlas, panel image
and Hügelton Sample Pack) are not part of BoopBox: they were removed and replaced by the GPL assets above, so the
section 7 permission Felucca gave for combining them is not needed.

## Third-party material

| What | Licence | Where |
| --- | --- | --- |
| Instrument and drum samples (Versilian Studios VSCO-2 CE, VCSL; Sonic Pi: SCRCH) | CC0 1.0 | `assets/samples-cc0/`, provenance in `ATTRIBUTION.txt` there |
| The hip-hop pack's E.PIANO (Greg Sullivan's Wurlitzer EP200 samples) | CC BY 3.0 | `assets/hiphop-pack/`, credits in `CREDITS.txt` there |
| Terminus font 8x16: the FM-1's screen (Terminus Bold, ter-u16b), and the web editor's font (the regular ter-u16n; `tools/gen_webfont.py` makes it a TrueType font inlined in `web/editor.html`) | SIL OFL 1.1 | `assets/fonts/ter-u16b.bdf`, `assets/fonts/ter-u16n.bdf`, `assets/fonts/Terminus-LICENSE.txt` |
| Fukiai icon font (Hügelton Instruments), web editor only | MIT | `web/fukiai.ttf`, `web/FUKIAI-LICENSE.txt` |
| CrispyZebra by Leo Kuroshita (<https://github.com/hugelton/CrispyZebra>): the PHASE engine's waveforms are a C port of its oscillator | GPL-3.0 | `firmware/src/eng_phase.c` |
| klattsch by Tony Gies (<https://github.com/tgies/klattsch>): design reference for the VOICE (formant) engine; no code copied. Formant data from Klatt (1980) / Hillenbrand et al. (1995) | MIT (klattsch) | credit only |
| msfa by Google Inc. and Pascal Gauthier, from Dexed (<https://github.com/asb2m10/dexed>): the FM6 engine's synthesis, ported to integer C by Leo Kuroshita (Dexed itself is GPL-3.0; only msfa is used) | Apache-2.0 | `firmware/src/fm6_core.c`, `LICENSES/Apache-2.0-msfa.txt` |
| DaisySP (Electrosmith, Emilie Gillet) and Rings' sympathetic strings (Emilie Gillet): the PHYS engine's models, ported to fixed point by Leo Kuroshita | MIT | `firmware/src/phys_dsp.c`, `firmware/src/phys_symp.c` (the notice is in each file) |
| The second-core HAL after X0X by Charles Vestal and the dual-core work of Andre Rezemini (sloop-lab) | GPL-3.0 | `firmware/hal/fm1_cpu1.*`, `firmware/src/cpu1.*` (the notice is in each file) |
| JieLi AC79 SDK: `uboot.boot`, `cfg_tool.bin`, `eq_cfg_hw.bin` are read from your SDK checkout at build time and placed in the package; no SDK files are in this tree | Apache-2.0 | <https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK> |

## Contributions

Contributions are welcome under GPL-3.0-only.

## Names and trademarks

"BoopBox" is the name of this project. It is not affiliated with, endorsed by or supported by isod89 (SLOOP),
Leo Kuroshita or Hügelton Instruments (Felucca). "Felucca" and "Hügelton Instruments" are names of Hügelton
Instruments, and are used here only to credit the work BoopBox is based on.

"M-VAVE" and "FM-1" are trademarks of their respective owners. BoopBox is independent firmware that runs on FM-1
hardware. It is not affiliated with, endorsed by or supported by those owners.

## Radio

BoopBox never enables the Bluetooth / Wi-Fi radio of the hardware.
