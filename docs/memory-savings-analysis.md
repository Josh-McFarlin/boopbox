# BoopBox firmware: where the flash and RAM go, and what can be saved

This document is an analysis of the 1.3.0 tree (`main`, e546d30) from 2026-11-01. Use it when the flash or the RAM is full. The analysis itself changed nothing in the firmware.

The figures are the figures of the 1.3.0 tree, unless a sentence gives another version. Measure a figure again before you use it (section 7). The items have the numbers F1..F10 (flash) and R1..R13 (RAM). Other files refer to these numbers, for example `tools/gen_font.py` and `BUILDING.md`.

## Status of the items (1.9.3)

The current release is 1.9.3. The app is 579,200 B, and 2,364 B of the 581,564 B app slot are free. The size comes from the release package (`docs/groovebox-performance.md`, section 1). In 1.3.0 the app was 580,024 B, with 1,540 B free.

| Item | Status | Proof |
| --- | --- | --- |
| F1 `minsize` on the control path | Applied in 1.3.1 | Commit 63e3700. `CTL_SMALL` in `core.h`. |
| F2 `.data` initializers to `.bss` | Applied in 1.3.1, except `punch` | Commit 63e3700. `drums`, `lim_dac`, `lim_usb` and `tx` are in `.bss`. |
| F3 `param_desc_t` 20 -> 12 B | Open | `core.h` still has `int16_t min, max, def` and the `unit` pointer |
| F4 the font as raw 1-bit glyphs | Applied in 1.8.0 (the compact variant: 70 glyphs) | Commit 2bb11f0. `FONT_S_DATA` is 1,120 B of constants. `font_fill` is empty. |
| F5 shared flash driver helpers in `.ram_text` | Open | `fm1_flash.h` helpers are still `RAMINL` (`always_inline`). `tools/build.py` still refuses every `call` in `.ram_text`. |
| F6 UI helpers | Partly applied | 1.3.1: `lcd_clear`, `ui_text_r`, `ui_text_mid`, `knob_strip`, the lazy ramp in `cv_text`. 1.8.0: the 4-bit path of `cv_text` went with F4. Open: `BANK` and `ICON_MAP` packing, uppercase literals. |
| F7 small trims | Partly applied in 1.3.1. The rest is dropped. | Applied: `lk_slot`, `ota_show`, `cpu1_supplies`. Kept as diagnostics: the USB counters and `stack_paint`. |
| F8 drum kits stored once | Applied in 1.7.0 | Commit af66cc2. `DS_SND` (242 sounds) and `DS_KITS`. |
| F9 display-only tables computed | Applied in 1.8.0 | Commit 2bb11f0. `params.c` computes the values. `tests/display_test.c` checks all 512 values. |
| F10 `PRESET_TRIM` flat | Applied in 1.3.1 | Commit 63e3700. `PT_OFF` in `preset_trim.h`. |
| R1 `pb_buf` to the pool | Open | `patbank.c`: `pb_buf` is still in `.bss` |
| R2 `proj_tmp` aliased to `autosave_buf` | Open | `project.c`: `proj_tmp` is still a `static project_t` |
| R3 the font in flash | Applied in 1.8.0 (with F4) | CHANGELOG 1.8.0: about 4.8 KB of RAM back |
| R4 the OTA buffers overlaid | Open | `ota.c`: `ota_dec` is still a static buffer |
| R5 UI draw scratch into `main_scratch` | Open | `ui.c`: the static `vb` arrays are still there |
| R6 `lcd_fillbuf` from `cv_px` | Open | `lcd.c`: `lcd_fillbuf[240]` is still there |
| R7 `scope_bufr` | Open | `audio.c` still writes it. Nothing reads `vis_r`. |
| R8 lent INSERT lines | Open | `fx.c`: `ins_t.line` is still in each `ins_t` |
| R9 editor buffers | Open | No change found in the git log |
| R10 USB/UAC counters | Dropped | Kept as diagnostics in 1.3.1 (see F7) |
| R11 FM6 per-track copies into the arena | Open | `eng_fm6.c`: `fm6_eff[NTRK]` and `fm6_lfo[NTRK]` are still there |
| R12 `ins_t` union | Open | Estimate only |
| R13 `voice_t` fields as `int16` | Open | `core.h`: `pitch16`, `pitch_cur` and `fine` are still `int32_t` |
| Cymbals at 22.05 kHz (section 4) | Applied in 1.7.0 | Commit af66cc2. `GM_RATE` is empty in `tools/gen_samples.py`. |
| VIBES 1.0 -> 0.8 s (section 4) | Applied in 1.7.0 | `SET_KEEP` in `tools/gen_samples.py` |
| The other sample options (section 4) | Open | |
| ANALOG with one render body (section 3.8) | Open | `analog_render_f` is still a separate copy |
| Global `-Oz` (section 3.1) | Not tried on the real build | |
| A shared voice pool (section 5.2) | Open | `track_t` still holds `v[NVOICE]` |

### What F1, F2, F7, F10 and part of F6 gave in 1.3.1

The proxy build gave code −7,318 B, constants −246 B and `.data` initializers −2,632 B. At the 0.77x rule, this is about −8.5 KB real.

The real build gave less. The app went from 580,024 B to 575,316 B (−4,708 B). The RAM region (`.data` + `.bss`) went from 85,516 B to 85,468 B (−48 B).

The exact parts (constants and `.data`, about −2.9 KB) agreed with the prediction. Thus the code saved only about 1.8 KB, not the 5.6 KB that the proxy gave. `minsize` (F1) saves much less on the pi32v2 compiler than on the host clang. The "−4..−6 KB" for F1 in the table of section 2 is too high.

The 182 golden renders and all 191 test screen renders did not change.

### How the analysis measured

The JieLi pi32v2 toolchain was not available. Thus every code figure comes from the proxy build. `tools/proxy_size.py` compiles the whole firmware for RV32IMC at `-Os` with the host clang. `tools/proxy_diff.py` compares two proxy objects function by function.

Constant tables, structs and RAM are exact in the proxy. Code is not exact. The real 1.3.0 app has about 0.77x the code bytes of the proxy. Thus this document gives a proxy code change as a proxy figure, and the real change is expected at 0.75..0.85x.

"Exact" means that the figure does not depend on the compiler. Each experiment was done in a scratch copy or a separate worktree. The host tests named in each section ran there.

## 1. Where the bytes are (1.3.0)

### Flash: the app slot is 581,564 B, the app 580,024 B, 1,540 B free

| What | Bytes (real image) | Share |
| --- | ---: | ---: |
| `SMP_DATA`: the 8 built-in sets of the SAMPLE engine, IMA ADPCM 4-bit at 22.05 kHz (cymbals 32 kHz) | 273,840 | 47.2 % |
| Code (proxy 306,542, real about 236,600) | ~236,600 | 40.8 % |
| Other constants (proxy, exact): `DS_KITS` 11,648, strings 9,399, `ICON_DATA`+`ICON_MAP` 4,208, font 3,044, `UAC_FIR` 1,920, parameter descriptors `TP`+`GP`+12 engine tables 5,272, `SMP_ZONES` 1,344, `BANK` 1,224, presets ~5,400, DSP tables ~5,000, the rest | ~63,500 | 10.9 % |
| `.data` initializers (copied to RAM at power-on, stored in the image): `drums` 1,892, `lim_dac`/`lim_usb` 544, `tx` 196, `punch` 192, small | 2,934 | 0.5 % |
| `.ram_text` (the flash driver, copied to SRAM at power-on; proxy 4,954, real about 2,900) + `.c1_text` 196 | ~3,100 | 0.5 % |

The largest functions in the proxy code: `ui_draw` 43,040 (every screen is inlined into it), `ui_input` 20,826, `events_block` 20,308, `ed_handle` 13,204, `fm1_cstart` 9,904, `draw_graph` 9,264, `mix_block` 7,922, `drums_mix` 4,386, `punch_process` 4,234. The render loops of the engines follow (0.7..2.4 KB each).

In 1.9.3, `SMP_DATA` is 256,496 B. The sections 3.8 and 4 give the changes.

### RAM region (`.data` + `.bss`): 98,304 B, 85,331 B used (proxy), about 12.8 KB free

The real build of 1.1.0 used 85,484 B. The proxy build of 1.9.3 uses 81,197 B (17,107 B free).

| Object | Bytes | What |
| --- | ---: | --- |
| `trk[8]` | 19,072 | `track_t` is 2,384 B: `v[8]` voices 672 (28 %), `step[64]` 640, `p`+`p_old` 284, lock state 288, 22 B of padding |
| `FONT_S_DATA` | 5,376 | The screen font, unpacked from LZ4 at power-on (the 1.1.0 trade: −3,148 B flash). In flash since 1.8.0 (F4). |
| `ins[8]` | 4,640 | One INSERT state for each track. 512 B of each is a FLANG/CHOR delay line. |
| `FM6_EXP2`, `SINE` | 6,150 | Tables built at power-on (the 1.1.0 trade: −5,520 B flash) |
| `abuf` | 4,096 | The I2S double buffer, 2 x 256 frames x 2 ch x 32-bit. The DAC takes 32-bit words, so this is the minimum. |
| `proj_tmp`, `main_scratch` | 7,680 | Two scratch buffers of project size |
| `pb_buf` | 3,072 | The pattern bank |
| OTA (`ota_stage.*`, `ota_dec`, and more) | ~2,900 | Used only during an update |
| Editor (`ed_w`, `ed_out`, `ed_smp_buf`, and more) | ~2,200 | |
| `ua_ring` 2,048, `usr_zone` 1,792, `fm6_eff` 1,600, `dsu` 1,464, `fm6_patch` 1,248, `ft_ev` 1,152, `scope_buf`+`scope_bufr` 2,048, `midi_sel_on` 1,024 | | |

In the 1.9.3 proxy object, `trk[8]` is 19,136 B (`track_t` 2,392 B).

### Pool: 344,064 B, 331,004 B used, 8,192 B reserve, about 4.9 KB usable

The proxy build of 1.9.3 gives the same 331,004 B.

| Object | Bytes | What |
| --- | ---: | --- |
| `dly_buf` | 131,072 | The delay, mono int16, 1.49 s |
| `punch_ring` | 65,536 | The mono ring of the punch-in FX, 0.74 s |
| `cv_px` | 59,520 | The drawing canvas, 240 x 124 RGB565 |
| `sl_buf` | 32,768 | 4 STUT buffers |
| `eng_arena` | 25,776 | 3 arenas for the big engines |
| `cho_buf`, `song_keep`, `autosave_buf` | 4,096, 3,840, 3,840 | |
| `rev_ap`, `vis_re`+`vis_im`, `vis_fly` | 1,994, 2,048, 512 | |

`.lowram` (29,384 B) holds `rev_line` (17,368 B) and `acc[2]` (1,792 B). It had 9.7 KB free. NOINIT holds `proj_slot[4]` (15,360 B) and has 136 B free.

## 2. The short list

The table gives the 1.3.0 predictions. The status column gives the result. In 1.3.0, the 1,540 B of free flash blocked the next feature, so the list starts with flash.

Each change in this table keeps every sound, every screen and every stored format. Each was measured in the proxy, and the named host tests passed.

| # | Change | Flash (proxy) | Expected real | RAM | Risk | Status |
| --- | --- | ---: | ---: | ---: | --- | --- |
| F1 | `minsize` on the sequencer and control-rate code (3.1) | −7,524 | −4..−6 KB (too high: see above) | 0 | Low. Gate: `tests/target_budget.py` | Applied 1.3.1 |
| F2 | `.data` initializers to `.bss`, and a few stores at init (3.2) | −2,630 | −2,600 | 0 | Low | Applied 1.3.1 |
| F3 | `param_desc_t` 20 -> 12 B (3.3) | −2,036 | −2,040 | 0 | Low (mechanical, tests pass) | Open |
| F4 | The font as raw 1-bit 8-px glyphs, reachable codes only (3.4) | −2,294 | −2,250 | −5,376 | Low (96/96 renders identical) | Applied 1.8.0 |
| F5 | Shared flash driver helpers inside `.ram_text` (3.5) | −3,364 | −1,500..−2,000 | 0 | Low. Needs a change to the `build.py` check. | Open |
| F6 | UI helpers: `lcd_clear`, aligned text, the footer strip, `BANK`/`ICON_MAP` packing, uppercase literals, `cv_text` 1-bit path (3.6) | −2,500 | −2,100 | 0 | Low (renders identical) | Partly applied |
| F7 | Small trims: lock helpers, USB counters, `ota_show`, `stack_paint` (3.7) | −620 | −500 | −84 | Low | Partly applied 1.3.1 |
| F8 | The 32 synthesized drum kits stored once: 242 distinct lane records + 33 B for each kit (3.8) | −5,090 | −5,100 | 0 | Low (182/182 golden identical) | Applied 1.7.0 |
| F9 | Four display-only tables computed from the 2^x table of FM6 and `LFO_INC` (3.8) | −1,304 | −1,350 | 0 | Low (512/512 display strings identical) | Applied 1.8.0 |
| F10 | `PRESET_TRIM` flat (3.8) | −245 | −245 | 0 | Very low | Applied 1.3.1 |
| | **Total** | **−27,600** | **about −21..−23 KB** | **−5,460** | | |

With the sample sets unchanged, the full list was to turn 1.5 KB of free flash into about 22..24 KB. Beyond this list, the sample data (section 4) gives the large numbers: 11..31 KB for each option. Each option is a sound or product decision. Another option is to merge the two render bodies of ANALOG (−1,992 B), if a 3 % slower ANALOG loop is acceptable.

For the RAM region, section 5 gives a list of the same kind:

- `pb_buf` to the pool (−3,072).
- `proj_tmp` aliased to `autosave_buf` (−3,840).
- F4 (−5,376).
- The OTA buffers overlaid (−2,890).
- The per-track copies of FM6 into the arena (−1,856).
- The UI draw scratch into `main_scratch` (−1,286).
- `lcd_fillbuf` (−480).
- The unused right-channel scope buffer (−1,024).
- Lent INSERT lines (−2,048).

Together these give about −22 KB, from 12.8 KB free to about 35 KB.

## 3. Flash: code and tables

### 3.1 `minsize` on the control path: −7,524 B proxy (F1)

**Status: applied in 1.3.1.** The real saving was about 1.8 KB of code (see the status section).

The UI is already compiled for size. `gfx.c:11` defines `UI_SMALL` as `__attribute__((minsize))` (the per-function `-Oz` of clang). Every screen and button function has it. A whole-firmware `-Oz` proxy build is 25,828 B (8.4 %) smaller than `-Os`. Most of the remaining code runs one time for each block, not one time for each sample.

| Marked `minsize` | Functions | Proxy code |
| --- | ---: | ---: |
| `seq.c` and its includes (`comp.c`, `patbank.c`, `patcodec.c`, `harmony.c`) | 209 | −5,132 |
| + `voice.c`, `engines.c`, the `*_note_on` of the engines, `fm6_sync`, `drum_synth_on`, `punch_start`, the `*_desc` and `*_coef` helpers | 95 | **−7,524** |
| + the unmarked cold functions of `usb.c`, `ota.c`, `gfx.c`, `lcd.c`, `cpu1.c`, `libc.c` and more | ~200 | −2,320 more |

`events_block` goes from 20,308 to 16,750 B. Every per-sample render loop in the list of `tests/target_budget.py` stays byte-identical. This list is `analog_render`, `drums_mix`, `mix_block`, `grain_render`, `fm6_render`, `slicer_track`, `punch_process` and the audio ISR.

These functions cost about 0.3 us for each block on the host (`docs/groovebox-performance.md`, section 3). Thus slower code there is not visible. The compiler can still inline a `minsize` function into its hot callers. The gate is the real build: `tests/target_budget.py` (the static count of the render loops) and the CPU check of `tests/regress.c`.

The marking is one macro on each definition, as the `UI_SMALL` pattern does. Do not use `noinline` for this purpose. Splitting the callees of `events_block` out measures +114 to +794 B, because the inliner is already correct at `-Os`. `noinline` on the screen draws saves 420 B at most, and the input side grows by 950 B.

Global `-Oz` (`tools/build.py CFLAGS`) is a larger change (−25.8 KB proxy). It also makes the render loops smaller (`analog_render` 2,110 -> 870 B, `fm6_op_run` 364 -> 176). They get fewer inlined helpers and no unrolled loops. Thus there is a CPU cost on the pi32v2 that only the real build can measure. One build with an unchanged `BUDGET` will show whether the loops pass. If they pass, this is the least expensive 20 KB in the tree. **Status: not tried on the real build.**

Changes that gave no saving: `--gc-sections` on the app link (12 B unreachable, because the single translation unit already drops unused statics), `-fno-jump-tables` (+1,010 B), `-fno-unroll-loops` (+14 B), `-mllvm -inline-threshold=10` (−914 B, too small for a global flag).

### 3.2 `.data` initializers: −2,630 B (F2)

**Status: applied in 1.3.1 for `drums`, `lim_dac`, `lim_usb` and `tx`.** `punch` stays in `.data`, because `punch.req` and `punch.cur` must start at -1 in every boot path and test harness.

`tools/build.py` adds `.data` to the image. Thus every initialized object costs its full size in flash:

- `drums.c:53` `drums = {.set = -2}`: 1,892 B for one byte.
- `fx.c:76` `lim_dac`, `lim_usb` `= {.env = LIM_T, .g = 32768}`: 544 B for four words.
- `fx.c:980` `tx = {.rnd = 0x2545F491}`: 196 B.
- `punch.c` `punch = {.req = -1, .cur = -1, .fg = 8192}`: 192 B.

The change puts these objects in `.bss` and sets the fields in `audio_init` or at the first use. For the `fx.c` pair this measured −740 B of `.data` and +56 B of code (editor fuzz and `boot_sound_test` pass).

For `drums`, the least expensive form needs no init code. `drum_set()` stores `set` as index + 2 (0 = not looked up yet, 1 = none). This measured −1,892 B, with identical golden renders. The 17 tests that set `drums.set = -2` change to `= 0`. The estimate for `punch` is −190 B.

`fav` (32), `midi_set` (14) and `UI_COL/DIM/MID` (48) are real data. Keep them.

### 3.3 `param_desc_t` 20 -> 12 bytes: −2,036 B (F3)

**Status: open.**

`core.h:40` holds a label pointer, `fmt`, three `int16_t` (min, max, def), a names pointer and a unit pointer. This is 20 B x 259 descriptors (`TP` 71, `GP` 63, 12 x 8 engine EDIT entries, `INS_DESC`, `ESYNC`, `PS`, `DRUM_MIX`). The count of 259 is from 1.3.0. OBERVAVE (1.7.0) added an engine table.

All 259 values fit `int8_t min` (-64..0), `uint8_t max` (<= 255: BPM 240, SEED 255) and `int8_t def` (-12..127). Only five descriptors have a unit ("Hz", "ct", "st"). The unit fits in the upper nibble of `fmt` as an index into a table of 4 entries.

Measured: rodata −2,056, code +20 (`TP` −568, `GP` −504, each engine table −64). The other parts of the change:

- 119 initializers lose their seventh field. A script makes this change.
- Four initializers have an expression as `max`: `eng_sample.c:253`, `eng_grain.c:461`, `eng_fm6.c:410`, `eng_phys.c:269`.
- The readers become `desc_fmt()` / `desc_unit()` at `params.c:348/438/464`, `editor.c:741-747`, `icons.c:97`, `ui_draw.c:1149`.
- The editor protocol does not change (`ED_DESC` sends `fmt & 15`).

The test compiled with `-Wconstant-conversion -Wexcess-initializers -Werror`. The comp, lock, pat, harm, project, upreset, ui_pages and storage tests and the golden renders passed. The line numbers are from 1.3.0.

### 3.4 The font: −2,294 B flash and −5,376 B RAM (F4)

**Status: applied in 1.8.0, the compact variant** (commit 2bb11f0). The font is 70 glyphs of 8 x 16 px at 1 bit, read in place from flash. An accented capital (É, Ñ) now shows as its letter. CHANGELOG 1.8.0 gives about 2.5 KB of flash and 4.8 KB of RAM back. `FONT_S_DATA` is now 1,120 B of constants in the proxy object.

The 1.3.0 analysis:

- `build/gen/felucca_font.h` stored 224 glyphs of 12 x 16 px, with two blank columns on each side. It was LZ4-packed (2,148 B).
- Constant tables for the offset, the advance and the width of each glyph added 1,024 B. Every glyph advances 8 and every bitmap is 12 wide.
- `font_fill` unpacked the font into `FONT_S_DATA` (5,376 B) at power-on.
- `gfx.c glyph()` changes a-z and the Latin-1 lower case to capitals, and maps 127..159 to `?`. Thus the firmware can never draw 89 glyphs.
- The whole firmware uses one non-ASCII character (the Ü of `ui_menu.c:150`).

The proposal stored raw 8-px-wide 1-bit rows (16 B a glyph) for the 70 reachable codes. This gives 1,120 B of constants, no table, no RAM copy and no unpack step. Measured: code −218, constants −2,076, RAM −5,376.

The three screen-render tests (`song_ui`, `vis_styles`, `ui_pages`) gave 96 of 96 renders byte-identical. `FONT_L` (the 2x font, `sh = 1`) continues to work. A conservative variant kept all of 160..255 (135 glyphs): code −168, constants −1,036, RAM −5,376.

`tests/font_test.c` indexed the old tables and needed a new version. The unused TTF/4-bit path of `tools/gen_font.py` was also removable. This change reverses the 1.1.0 trade and gives a better result on flash and on RAM.

### 3.5 The flash driver in `.ram_text`: −3,364 B proxy, about −1.5..−2 KB real (F5)

**Status: open.** The helpers in `fm1_flash.h` are still `RAMINL` (`always_inline`). The `check()` of `tools/build.py` still refuses every `call` in `.ram_text`.

`fm1_flash.h:83-150` has the helpers `fl_cs`, `fl_tx`, `fl_rx`, `fl_addr`, `fl_rdsr`, `fl_wren`, `fl_enter`, `fl_exit` and `fl_wait_ready`. They are `always_inline`. Thus each of the five `RAMFN` entry points has its own copies. These entry points are `fl_prog_ram`, `fl_erase4k_ram`, `fl_read_ram`, `fl_status_ram` and `fl_jedec_ram`. `fl_tx` occurs about twelve times in each of them, through `fl_addr`.

The reason is `tools/build.py check()`. It refuses any `call` instruction in `.ram_text`, because RAM code must not reach XIP while the flash is off. A call to a target inside `.ram_text` is safe: the window is 32 KB, the stack is in RAM, and the helpers call nothing.

With the nine helpers as `section(".ram_text"), noinline`, the proxy `.ram_text` goes from 4,954 to 1,590 B. `fl_prog_ram` goes from 1,586 to 400 B, and `fl_erase4k_ram` from 1,422 to 280 B. `fl_inval` must stay inline, because XIP code calls it (`ed_smp_inval`, `fl_plain_window_init`).

The new check allows a `call` in the `.ram_text` listing when its target address is in `[_rt_start, _rt_end)`. It refuses all other calls. The ROM check already parses the target with the same regex. The real `.ram_text` is about 2,900 B, so the real saving is about half the proxy saving.

### 3.6 UI code and tables: about −2,500 B (F6)

**Status: partly applied.** All figures were measured with identical renders.

| Part | Saving | Status |
| --- | ---: | --- |
| `lcd_fill(0, 0, 240, 240, C_BLACK)` occurs 17 times and right- or center-aligned `cv_text(236 - text_w(...), ...)` 18 times. Helpers `lcd_clear()`, `ui_text_r()`, `ui_text_c()`. | 600 B | Applied 1.3.1 (`lcd_clear`, `ui_text_r`, `ui_text_mid`) |
| `ui_pats.c:87-111/287-305` and `ui_song.c:85-98` repeat the four-knob footer. Helper `knob_strip()`. | 336 B | Applied 1.3.1 |
| `gfx.c cv_text` built a 16-entry `ramp[]` (48 divisions for each call) that the 1-bit font never reads. It also had an unused 4-bit path. | 194 B | Lazy ramp applied 1.3.1. The 4-bit path went with F4 in 1.8.0. |
| `ui.c:1092 BANK`: 157 x `{u8, u8, const char *}`, 8 B each with 3 B of padding. A byte table and a name table save 459 B of constants (+38 code). A generated preset-index table saves about 470 B more and `bank_pi` (157 B RAM). | 459 B | Open. `BANK` is 1,784 B in 1.9.3 (the OBERVAVE programs). |
| `icons.c:24-72 ICON_MAP` (139 x 8 B, 417 B of padding), `WAVE_ICON` and the engine maps as a byte stream with one lookup. | 480 B net | Open |
| `ui_studio.c:87 ui_lower` changes text to lower case, and `glyph()` changes it back to capitals. The lowercase label style costs 86 literals that differ only in case. Uppercase literals and no `ui_lower`: constants −372, code −98. One guard at `ui_studio.c:507` and three string checks in `ui_pages_test.c` change case. | 470 B | Open. `ui_lower` is still in use. |
| Estimates, not measured. The OCT+ sheet strip and filter code occur in `ui_draw.c:410-428` / `ui_input.c:1293-1313` and again in `ui_studio.c:452-476` / `681-703` (~300 B). The 40-row title band has five forms (~200 B). `palette_set` with outlined helpers saves 122 B. | | Open |

All 86 icons have a reference. `ICON_DATA` (3,096 B) is 2-bit antialiased, and 1-bit icons look different. Keep `ICON_DATA` as it is.

The strings (9,399 B) are not a useful source of savings. The compiler already merges identical literals. UI messages are 3,922 B of the strings, the names in `params.c` 1,405 B, and the presets and kits the rest. Shorter help lines are a product decision worth 150..250 B.

### 3.7 Small, safe trims (F7)

**Status: partly applied in 1.3.1.** The USB counters and `stack_paint` stay as diagnostics. These parts are dropped.

| Part | Saving | Status |
| --- | ---: | --- |
| `seq.c:1218-1297`: the find-or-add loop of `lock_step_x` occurs three times. Helper `lk_slot()`. The lock, comp, pat and seq2 tests and the golden renders pass. | −158 B | Applied 1.3.1 |
| `felucca.c:186 ota_show` writes a two-digit number by hand. Use `fmt_int`. | −86 B | Applied 1.3.1 |
| `cpu1.c:74 cpu1_supplies` writes "1.38V" by hand. Use `fmt_fix`. | ~−50 B | Applied 1.3.1 |
| The USB/UAC diagnostic counters that nothing reads with `FELUCCA_CDC=0` (`usb.c`). Keep `resets`, `setups`, `sof_seen`, `timeouts`, `fill_min`. Keep `uac.underruns/overruns` for `tests/uac_test.c`. | −276 B code, −84 B RAM | Dropped (kept as diagnostics) |
| `stack_paint` (`main.c:38`) is only for the `stack_free` command of the console. | ~−100 B | Dropped (kept as diagnostics) |

### 3.8 Engines and DSP tables: about −6.6 KB (F8..F10)

All these changes kept the 182 golden renders identical. (182 is the count of 1.3.0. `tests/golden.txt` has 252 in 1.9.3.)

**F8, the synthesized drum kits: −5,268 B of constants (+~180 B code). Status: applied in 1.7.0** (commit af66cc2). The commit gives −4.8 KB. In the 1.9.3 proxy object, `DS_SND` is 5,324 B and `DS_KITS` 1,408 B.

The 1.3.0 analysis:

- `DS_KITS` (`tools/gen_drumkits.py`, `drum_synth.c:31-50`) stored 32 kits x 16 lanes x 22 B.
- Most kits are `kit(K808, ...)` with 3..9 lanes changed. Of the 512 lane records, only 242 are distinct if the level byte of each kit stays separate.
- The proposal: `DS_SND[242]` (22 B each), and a `dkit_t` of 33 B for each kit (crush, 16 sound indices, 16 levels). `DS_KITS` goes from 11,648 to 6,380 B. The name and style pointers are already in `DRUM_KIT_NAMES`.
- `ds_on()` takes the record and the level of the lane. `drums.c drum_synth_on()` and the LIST/GET of `editor_dsyn.c` index through the kit.
- The SYN1..4 user-kit format and the editor protocol (16 x 22 B with levels) do not change.
- `dsyn_test`, `drumkit_test` and `drum_steal_test` pass with changed accessors. Each note-on has one more index.

**F9, the display-only tables: −1,304 B. Status: applied in 1.8.0** (commit 2bb11f0).

- `params.c:376-424` was the only reader of `TIME_MS_X10`, `LFO_HZ_X100`, `CUTOFF_HZ` and `LEVEL_DB_X10` (1,536 B).
- The proposal replaces them with `round(scale * base^(v/127))` from `fm6_mant()`. This uses the 2^x table of FM6, which is already in RAM.
- LFO Hz comes from `LFO_INC`, and dB is `(v - 112) * 5`. This adds 232 B of code.
- A host probe showed all 512 display strings identical. One raw value differs by a unit and prints the same. Only the display path changes.

**F10, `PRESET_TRIM` flat: −245 B. Status: applied in 1.3.1.** `preset_trim.h` was 13 x 32 `int8` for 157 presets. The flat form is 157 bytes plus 14 offsets. `tools/level_presets.py` writes it.

**The per-track copies of FM6 into the arena: −1,856 B RAM, −162 B code (R11, section 5). Status: open.**

- `eng_fm6.c:35-53` has `fm6_eff[NTRK]`, `fm6_lfo[NTRK]` and `fm6_lfo_v/d` for each track. At most `NARENA` (3) tracks can play FM6.
- The proposal moves them into `fm6_part_t`. The FM6 use of the arena goes from 2,032 to 2,264 of 8,592 B.
- When a track loses its arena and gets it back, the firmware builds the macro copy again. The LFO phase starts again, as at the first note after power-on.
- `fm6_patch` (the patch of the editor) stays for each track.

**Optional, a CPU trade: one render body for ANALOG, −1,992 B code. Status: open.**

- `eng_analog.c:33-100` keeps `analog_render` (LP, the filter type is constant) and `analog_render_f` (BP/HP) as two copies of one body.
- One body with a run-time type makes the per-sample loop go from 511 to 527 proxy instructions (about 3 %).
- This is inside the 10 % of `target_budget.txt`, but it is not free. Do this change only if the cost on the pi32v2 is acceptable.

Estimates, not built (status: open):

- Packed name blobs for the 0-terminated `F_INT` lists (`N_FM6_PATCH`, `N_FM6_ALG`, `N_DCY`, `ESYNC_NAMES`, `N_IRATE` and more): 206 entries of 4 B pointers, about −800 B. The whole firmware has 968 name pointers (3,872 B).
- One SVF coefficient routine for `dsp.c tsvf_coef`, `drum_synth.c:104-121`, `eng_trio.c:301-306` and `eng_noise.c:140-146`: about −150..200 B, bit-identical.
- Preset names inline (`char[11]`). This saves bytes only together with a `BANK` by engine and index (section 3.6). Without it, it costs more than it saves.

Changes that gave no saving:

- `GR_HANN` from `SINE`: only 99 of 129 points agree.
- `ENV_LIN`/`ENV_EXP`/`DECAY_K`/`LFO_INC`/`PITCH_OCT` from `FM6_EXP2`: the generators truncate differently. A few LSBs change, so the golden renders change.
- The reverb and chorus lines are already `int16`.
- The arena size: the two SYMP slots of PHYS set it at 8,592 B. GRAIN needs 7,020 B.

### 3.9 Other changes that gave no saving

- `ed_handle` (13.2 KB) is 35 protocol cases of about 180 B each, with no unused handler. `noinline` on its sub-handlers adds 176 B. A table-driven dispatch is not smaller than the switch.
- `fm1_cstart` (9.9 KB) is `fm1_main` and the boot path, inlined one time. `noinline` adds 58 B.
- `UAC_FIR` (1,920 B) already stores half its phases (it is symmetric). 10 taps fails the 16 kHz SNR of `tests/uac_test.c`.
- `abuf` is the minimum for halves of 256 frames. 128 frames saves 2 KB, but it doubles the ISR rate and changes the UAC bands.
- `FELUCCA_CDC=0` already removes `console.c`.
- An 8-bit canvas is not possible, because the visualizer uses gradients on each row.
- `--gc-sections` finds 12 B.

## 4. Flash: the sample data

The figures in this section are exact. They come from the generated zones.

In 1.3.0, `SMP_DATA` was 273,840 B: 47 % of the app. The sets are 4-bit IMA ADPCM at 22,050 Hz (`tools/gen_samples.py TR`). In 1.3.0, the metal sounds of the GM kit were at 32,000 Hz. An earlier trade removed the top recording of the BASS set (9,372 B).

In 1.9.3, `SMP_DATA` is 256,496 B. Release 1.7.0 applied two options of this table: PERC −10,726 B and VIBES −6,618 B.

| Set | Zones | Bytes (1.3.0) | Options | Status |
| --- | ---: | ---: | --- | --- |
| PERC (the sampled GM kit: the ACOUSTIC .. DUST drum kits and the GM KIT of the SAMPLE engine) | 16 samples (27 zones) | 86,144 | Hi-hats, open hat, crash, ride from 32 kHz to 22.05 kHz: **−11,000** | Applied 1.7.0 (75,418 B in 1.9.3) |
| | | | Crash, ride, open hat 0.6 -> 0.45 s: −7,200 (32 kHz) or −4,962 (22 kHz) | Open |
| PIANO (loop 0.47..0.64 s -> 1.0 s) | 4 x 11,026 | 44,104 | 1.0 -> 0.75 s (a shorter loop): **−11,024**. 4 -> 3 zones: −11,026. | Open |
| VIBES (one-shot 1.0 s) | 3 x 11,026 | 33,078 | 1.0 -> 0.8 s: −6,618 | Applied 1.7.0 (3 x 8,820 = 26,460 B) |
| FLUTE (loop 0.4 -> 0.95 s) | 3 x 10,474 | 31,422 | 0.95 -> 0.70 s: −8,268. 3 -> 2 zones: −10,474. | Open |
| BASS (one-shot 0.9 s) | 3 x 9,922 | 29,766 | 0.9 -> 0.7 s: −6,612 | Open |
| HORNS (0.6 s) | 4 x 6,615 | 26,462 | 4 -> 3 zones: −6,616 | Open |
| STRGS (0.6 s) | 3 x 6,615 | 19,844 | (already short) | |
| SCRCH | 1 | 3,020 | (already one sound) | |

The analysis put the options in order, the least audible first:

1. The metal sounds at 22.05 kHz lose the top octave above 11 kHz. The other sounds of the kit were already at this rate. (Applied in 1.7.0.)
2. The loop region of PIANO is a steady tone with a flat level. A loop of 0.25 s instead of 0.4..0.5 s can give a timbre that cycles faster.
3. VIBES and BASS at 0.8 / 0.7 s lose tails that the envelopes of the presets already shape. (VIBES applied in 1.7.0.)

All these options change the golden renders of the presets that use the sets. Each option needs a listening test. Each is a parameter in `tools/gen_samples.py` (`GM_RATE`, `GM_KEEP`, `SET_KEEP`, the `keep` of each kind, the loop window).

A 3-bit ADPCM saves 68 KB. But its quality is the quality that the choice of the 4-bit codec avoided. This analysis does not recommend it.

**Sample data outside the app slot.** The firmware side of this change is small:

- `eng_sample.c` reads samples by byte offset from `SMP_DATA`.
- The firmware reads user slots through the plaintext XIP window above flash 0x93000 (`fl_plain_window_init`).
- `SMP_ZONES` offsets are plain numbers.

The flash map has 0x93000..0x97000 (16 KiB) that the store of Felucca never uses (`storage.c:22`, `fm1_flash.h:38-47`). The record scan of the loader erases only sectors that hold a record. There are also the four user sample slots of 80 KiB.

The install path stops this change. The update loader writes only `[0x4000, 0x93000)` (`ldr_core.c:32`, `fm1pkg_make.py FLASH_SIZE`). Thus a factory set outside the slot needs a second region in the loader, the package format, the web installer and `fm1_install.py`. Another method is a copy by the firmware from the staged package.

This change is useful only if the sample sets must grow. To free 1.5 KB, it is too large. After the slot, `cfg_tool.bin` (383 B) and the EQ directory of the SDK use the 3,876 B before 0x93000. Nobody has checked whether the SPL needs them. Thus you cannot assume that the slot can grow.

The remaining build flags are `FELUCCA_EDITOR=0` (−13,872 B real: the web editor gets no reply) and `FELUCCA_VIS=0` (−10,752 B in 1.1.0). These are the documented trades of a feature for flash.

## 5. RAM

### 5.1 The RAM region (96 KiB): about −22 KB with no feature change

| # | Change | Bytes | Notes | Status |
| --- | --- | ---: | --- | --- |
| R1 | `patbank.c:14 pb_buf` to `.pool` | −3,072 | One attribute. The ISR already uses pool buffers. The pool keeps more than 8 KiB free (12.5 KB on the real build). | Open |
| R2 | `project.c:393 proj_tmp` aliased to `autosave_buf` (pool) | −3,840 | See the notes below this table. | Open |
| R3 | The font in flash (F4) | −5,376 | | Applied 1.8.0 |
| R4 | The OTA buffers (`ota.c:103/248/330`: 2,160 B of staging over `proj_tmp`, 730 B as a `main_scratch` member) | −2,890 | See the notes below this table. | Open |
| R5 | `ui_layers.c:749 tl`, `ui.c:666/595 *.vb` into a `ui[1024]` member of the `scratch.h` union | −1,286 | Each one is used only inside one draw call | Open |
| R6 | `lcd.c:63 lcd_fillbuf` filled from `cv_px` | −480 | `lcd_fill` already syncs first | Open |
| R7 | `audio.c:25 scope_bufr` | −1,024 | The ISR writes it, and `ui_vis.c:281` copies it to `vis_r`. Nothing reads `vis_r`. Only `vis_l` is read. | Open (still true in 1.9.3) |
| R8 | Lend the FLANG/CHOR lines of the INSERT, as the firmware lends the STUT buffers (`fx.c:474 ins_t.line`, 512 B x 8) | −2,048 | Estimate: 4 lines for 4 tracks. The other types need none. A fifth FLANG/CHOR track plays dry until a line is free. This is a documented limit, as the arenas are. | Open |
| R9 | Editor: stage at `editor.c:907` in `ed_smp_buf` (−192), `:1196` on the stack (−64), `ed_w.t/tt` as `uint8` (−158) | −414 | | Open |
| R10 | USB/UAC counters (F7) | −84 | | Dropped |
| R11 | The FM6 macro copy and LFO state into the engine arena (`eng_fm6.c:35-53`, section 3.8) | −1,856 | Measured. `fm6_test` passes, golden identical. | Open |
| R12 | `ins_t`: the FLANG/CHOR line and the phaser `px/py/fb` as a union (`fx.c:463-472`) | −288 | Estimate | Open |
| R13 | `voice_t`: `pitch16`, `pitch_cur`, `fine` as `int16` over 70 voices | −280 | Estimate. Look at the note about `pend_note` padding in `core.h:129`. | Open |
| | **Total** | **−22,900** | | |

The line numbers are from 1.3.0.

Notes on R2:

- `proj_tmp` and `autosave_buf` have users only in the main loop, and only inside a call.
- The users of `proj_tmp` are project load and save, bank staging and the backup PUT of the editor. The users of `autosave_buf` are the capture, compare and save of the autosave.
- The ISR touches `song_keep` and `proj_slot[]`, so they stay separate.
- The alias needs one guard: `autosave_tick` must not capture again while a backup PUT is staged (`ed_bk_put`).
- The project, pat, storage, song_arm and soak tests pass with the alias.

Notes on R4:

- `ota_session` runs at the top level of the main loop and blocks it.
- Audio and `usb_poll` continue to run. Thus `abuf`, `sl_buf`, `pb_buf` and `ua_ring` are not idle. `proj_tmp` is idle.
- `felucca.c:151` records a 2.7 policy: "the update path never shares RAM".

Also measured, but not recommended without a reason:

- `vis_re`/`vis_im` can run in place on `main_scratch.vis` (−2,048 B of pool, renders identical).
- `track_t` reordered to remove 22 B of padding (−160 B).
- `p_old[71]` for each track as a pool of two slots (−852 B, moderate risk: `fx.c:663` swaps `p`/`p_old` on the two cores).

### 5.2 The large change: a shared voice pool

**Status: open. The 1.3.0 figure of −4,704 B is out of date.**

In 1.3.0, `track_t.v[NVOICE]` gave each track eight `voice_t` (84 B each). Only eight voices sounded across all synth tracks, and drum tracks never use `v[]` (`voice.c voices_busy`). A pool of eight voices, each with an owner, saved 4,704 B of RAM.

Since 1.6.0, up to 20 synth voices sound at the same time (`NVBUDGET` in `core.h`, commit cbf4404). Each track still holds `v[NVOICE]` (8). Thus a shared pool must now hold 20 voices, and it saves less than 4,704 B. Nobody has measured the new figure.

The cost of the change is in many places:

- `eng_drawbar.c:185/216` and `eng_grain.c:362/405` index the state of each part by `(v - t->v) % NVOICE`.
- MONO/LEGATO/UNISON use `t->v[0]` (`voice.c:501/547`).
- `voice_alloc` and the stealing scan look at all parts.
- `project.c:66`, `ui.c:1013`, `ui_input.c:69/504`, `engines.c:159` and `eng_fm6.c:191` loop over `t->v[]`.
- 28 host tests write to `trk[].v[]`.
- The two cores render from it.

This is a large refactor that tests can cover (the golden renders and `mix_split_test`). It is useful only when RAM, not flash, is the limit.

### 5.3 The pool

There is no inexpensive change. The features set the sizes of the delay line, the punch ring, the canvas, the STUT buffers and the arenas. Each option changes the sound or the behavior:

- The delay at half rate or half length (−64 KB). Either 1/4 notes clamp below 82 BPM, or the repeats lose the top octave.
- The punch ring in 8-bit companded form (−32 KB). The loops get more noise.
- A 240 x 62 canvas drawn in two passes (−29,760 B, about 9 draw sites). The scene passes of the visualizer double.
- Fewer STUT buffers or arenas (−8 KB each). One fewer track can use STUT or a big engine at the same time.

The pool has 13 KB free with 8 KB reserved. The 1.9.3 proxy build gives the same pool size as 1.3.0. Thus there is no pressure, unless a new pool buffer is necessary.

## 6. Suggested order

The 1.3.0 analysis gave this order. The status of each step is in brackets.

1. **F8, F3, F2, F9, F10, F7, R1, R7, R11.** These are mechanical changes with test coverage, about −12 KB flash and −6 KB RAM. F8, F9, F10 and R11 existed as one patch with the golden renders passing (section 7). [F2, F7, F8, F9, F10 applied. F3, R1, R7, R11 open.]
2. **F4** (the font) and **F6** (UI helpers): about −4.5 KB flash and −5.4 KB RAM. `tools/make_all_screens.py` checks the renders against the committed gallery. [F4 applied 1.8.0. F6 partly applied.]
3. **F1** (`minsize` on the control path) with a real build. `tests/target_budget.py` and `tests/regress.c` are the gate. Then one `-Oz` build shows whether the loops pass. [F1 applied 1.3.1. The `-Oz` build is not done.]
4. **F5** (the flash driver) with the change to the `build.py` check. **R2, R4, R5, R6, R8** for RAM. [All open.]
5. The sample options of section 4, only when a feature needs more than this gives. Start with the metal sounds at 22.05 kHz. [The metal sounds and VIBES applied 1.7.0.]

For every step, run `scripts/build.sh` (the real sizes) and `sh tests/run_tests.sh` (golden renders, budgets). For the UI steps, also make the screenshot gallery. Measure each proxy figure again on the pi32v2 build before you count on it.

## 7. How to measure again

You can make all the proxy measurements without the JieLi toolchain:

```sh
HOST_ONLY=1 sh tests/run_tests.sh                       # generates build/gen, runs the host suite
python3 tools/proxy_size.py --obj build/base.o          # the baseline proxy object
# ... make a change ...
python3 tools/proxy_size.py --obj build/new.o && python3 tools/proxy_diff.py build/base.o build/new.o 60
llvm-readelf -S -W build/new.o                          # per-function / per-object section sizes
```

- **A whole-firmware flag variant.** Preprocess `firmware/src/felucca.c` as `proxy_size.py` does (with the inline assembly of the HAL emptied). Then compile the `.i` file with the flag under test and compare the `.text*` sizes.
- **The `minsize` experiment of 3.1.** Add `__attribute__((minsize))` to the `static` function definitions of the named files. Use a regex over lines that start with `static`, and skip `inline` and existing attributes. Make a proxy build. Then use `llvm-nm -S` to make sure that the functions of the `FUNCS` list of `tests/target_budget.py` keep their size.
- **The real figures.** `scripts/build.sh` prints `image ... B; RAM .data+.bss ... B of 98304; lowram ...; pool ...`. `sh tests/run_tests.sh` without `HOST_ONLY` runs `tests/target_budget.py` on `build/felucca.dis`.
- **The app of a release.** `docs/groovebox-performance.md` (section 6) gives the steps to decode an app from a `.fwsc` package with `tools/fm1pkg_make.py`. Only the packages of the current release are in `docs/firmware/`. Get an older package from git, for example `git show 18a3689:docs/firmware/boopbox-1.3.0.fwsc`. The 1.3.0 app is 580,024 B, with `SMP_DATA` at offset 250,096.

The analysis made the changes marked "measured" in scratch copies and did not keep them. The text gives the files, the lines and the tests of each change. This is enough to make any of them again in an hour or two. F8, F9, F10 and R11 were made together and passed the 182 golden renders as one tree.

## Note: TANPURA tuning (fixed in 1.3.1)

The analysis found one fault that none of these changes caused. On the unchanged 1.3.0 tree, `tests/phys_tune_test.c` reported `TANPURA 100: +64.5 cents FAIL` under `HOST_ONLY=1 sh tests/run_tests.sh` (x86-64, clang 18).

The cause was an engine bug, not a quirk of the host:

- The SYMP model tuned some sympathetic strings above 4.4 kHz. These were the octave and two-octave partners of the top notes.
- Above 4.4 kHz, their loop gain is clamped at 0.9999. They rang several times louder than the main string, into the soft knee.
- The note came out up to 60 cents off, at random: in about 5 % of the random plucks at E7 and C7. The previous notes changed the result, through the global `rng()`.

The fix leaves out the partners with a period of less than 5 half-rate steps (`PX_YMIN_P` in `phys_symp.c`). The worst case over 60 plucks at E7 is now 10.8 cents. The golden renders did not change.
