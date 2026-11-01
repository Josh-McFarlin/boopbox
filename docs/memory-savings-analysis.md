# BoopBox firmware: where the flash and RAM go, and what can be saved

Analysis of the 1.3.0 tree (`main`, e546d30), 2026-11-01. A reference for the next time the flash or the RAM is
full: nothing in the firmware was changed by it. The figures are those of that tree; re-measure before relying on
one (section 7). Items are numbered F1..F10 (flash) and R1..R13 (RAM) so they can be referred to.

**How it was measured.** The JieLi pi32v2 toolchain is not available here, so every code figure comes from the
proxy build (`tools/proxy_size.py`: the whole firmware for RV32IMC at `-Os` with the host clang), compared function
by function with `tools/proxy_diff.py` after a change. Constant tables, structs and RAM are exact in the proxy;
code is not: the real 1.3.0 app (decoded from `docs/firmware/boopbox-1.3.0.fwsc`, 580,024 B) has about
0.77x the proxy's code bytes, so a proxy code delta is quoted as such and the real one is expected at 0.75..0.85x.
"Exact" below means the figure does not depend on the compiler. Every experiment was done in a scratch copy or an
agent's worktree; the host tests named were run there.

## 1. Where the bytes are

### Flash: the app slot is 581,564 B, the app 580,024 B, **1,540 B free**

| What | Bytes (real image) | Share |
| --- | ---: | ---: |
| `SMP_DATA`: the SAMPLE engine's 8 built-in sets, IMA ADPCM 4-bit at 22.05 kHz (cymbals 32 kHz) | 273,840 | 47.2 % |
| Code (proxy 306,542; real about 236,600) | ~236,600 | 40.8 % |
| Other constants (proxy, exact): `DS_KITS` 11,648, strings 9,399, `ICON_DATA`+`ICON_MAP` 4,208, font 3,044, `UAC_FIR` 1,920, parameter descriptors `TP`+`GP`+12 engine tables 5,272, `SMP_ZONES` 1,344, `BANK` 1,224, presets ~5,400, DSP tables ~5,000, the rest | ~63,500 | 10.9 % |
| `.data` initialisers (copied to RAM at boot, stored in the image): `drums` 1,892, `lim_dac`/`lim_usb` 544, `tx` 196, `punch` 192, small | 2,934 | 0.5 % |
| `.ram_text` (the flash driver, copied to SRAM at boot; proxy 4,954, real about 2,900) + `.c1_text` 196 | ~3,100 | 0.5 % |

Code, by the proxy: `ui_draw` 43,040 (every screen inlined into it), `ui_input` 20,826, `events_block` 20,308,
`ed_handle` 13,204, `fm1_cstart` 9,904, `draw_graph` 9,264, `mix_block` 7,922, `drums_mix` 4,386, `punch_process`
4,234, then the engines' render loops (0.7..2.4 KB each).

### RAM region (`.data` + `.bss`): 98,304 B, 85,331 used (proxy; 85,484 real in 1.1.0), **~12.8 KB free**

| Object | Bytes | What |
| --- | ---: | --- |
| `trk[8]` | 19,072 | `track_t` is 2,384 B: `v[8]` voices 672 (28 %), `step[64]` 640, `p`+`p_old` 284, lock state 288, 22 B of padding |
| `FONT_S_DATA` | 5,376 | the screen font unpacked from LZ4 at boot (the 1.1.0 trade: -3,148 B flash) |
| `ins[8]` | 4,640 | one INSERT state per track, 512 B of it a FLANG/CHOR delay line |
| `FM6_EXP2`, `SINE` | 6,150 | tables built at boot (the 1.1.0 trade: -5,520 B flash) |
| `abuf` | 4,096 | the I2S double buffer, 2 x 256 frames x 2 ch x 32-bit (the DAC takes 32-bit words: the minimum) |
| `proj_tmp`, `main_scratch` | 7,680 | two project-sized scratch buffers |
| `pb_buf` | 3,072 | the pattern bank |
| OTA (`ota_stage.*`, `ota_dec`, ...) | ~2,900 | used only during an update |
| editor (`ed_w`, `ed_out`, `ed_smp_buf`, ...) | ~2,200 | |
| `ua_ring` 2,048, `usr_zone` 1,792, `fm6_eff` 1,600, `dsu` 1,464, `fm6_patch` 1,248, `ft_ev` 1,152, `scope_buf`+`scope_bufr` 2,048, `midi_sel_on` 1,024 | | |

### Pool (344,064 B, 331,004 used, 8,192 B headroom demanded: **~4.9 KB usable**)

`dly_buf` 131,072 (the delay, mono int16, 1.49 s), `punch_ring` 65,536 (the punch-in FX's mono ring, 0.74 s),
`cv_px` 59,520 (the drawing canvas, 240 x 124 RGB565), `sl_buf` 32,768 (4 STUT buffers), `eng_arena` 25,776
(3 big-engine arenas), `cho_buf` 4,096, `song_keep` 3,840, `autosave_buf` 3,840, `rev_ap` 1,994, `vis_re`+`vis_im`
2,048, `vis_fly` 512. `.lowram` (29,384 B): `rev_line` 17,368, `acc[2]` 1,792, 9.7 KB free. NOINIT: `proj_slot[4]`
15,360, 136 B free.

## 2. The short list

Flash first, because 1,540 B is what blocks the next feature. Everything in this table changes no sound, no screen
and no stored format; each was measured in the proxy and the named host tests pass.

| # | Change | Flash (proxy) | Expected real | RAM | Risk |
| --- | --- | ---: | ---: | ---: | --- |
| F1 | `minsize` on the sequencer and control-rate code (section 3.1) | -7,524 | -4..-6 KB | 0 | low; gate: `tests/target_budget.py` |
| F2 | `.data` initialisers to `.bss` + a few stores at init (3.2) | -2,630 | -2,600 | 0 | low |
| F3 | `param_desc_t` 20 -> 12 B (3.3) | -2,036 | -2,040 | 0 | low (mechanical, tests pass) |
| F4 | the font as raw 1-bit 8-px glyphs, reachable codes only (3.4) | -2,294 | -2,250 | **-5,376** | low (96/96 renders identical) |
| F5 | share the flash driver's helpers inside `.ram_text` (3.5) | -3,364 | -1,500..-2,000 | 0 | low; `build.py` check change |
| F6 | UI helpers: `lcd_clear`, aligned text, the footer strip, `BANK`/`ICON_MAP` packing, uppercase literals, `cv_text` 1-bit path (3.6) | -2,500 | -2,100 | 0 | low (renders identical) |
| F7 | small trims: lock helpers, USB counters, `ota_show`, `stack_paint` (3.7) | -620 | -500 | -84 | low |
| F8 | the 32 synthesised drum kits deduplicated: 242 distinct lane records + 33 B per kit (3.8) | -5,090 | -5,100 | 0 | low (182/182 golden identical) |
| F9 | four display-only tables computed from FM6's 2^x table and `LFO_INC` (3.8) | -1,304 | -1,350 | 0 | low (512/512 display strings identical) |
| F10 | `PRESET_TRIM` flat (3.8) | -245 | -245 | 0 | trivial |
| | **Total** | **-27,600** | **about -21..-23 KB** | **-5,460** | |

With the sample sets untouched, that turns 1.5 KB free into roughly 22..24 KB. Beyond it, the sample data (section 4)
is where the big numbers are: 11..31 KB per option, each a sound or product decision; and ANALOG's two render
bodies merged (-1,992 B) if a ~3 % slower ANALOG loop is acceptable.

RAM region, the same way (section 5): `pb_buf` to the pool (-3,072), `proj_tmp` aliased to `autosave_buf`
(-3,840), F4 (-5,376), the OTA buffers overlaid (-2,890), FM6's per-track copies into the arena (-1,856), the UI
draw scratch into `main_scratch` (-1,286), `lcd_fillbuf` (-480), the dead right-channel scope buffer (-1,024), lent
INSERT lines (-2,048): **about -22 KB**, from 12.8 KB free to ~35 KB.

## 3. Flash: code and tables

### 3.1 `minsize` on the control path: -7,524 B proxy (F1)

The UI is already compiled for size: `gfx.c:11` defines `UI_SMALL` as `__attribute__((minsize))` (clang's per-function
`-Oz`) and every screen and button function carries it. A whole-firmware `-Oz` proxy build is 25,828 B (8.4 %)
smaller than `-Os`, and most of what is left is in code that runs once a block, not once a sample:

| Marked `minsize` | Functions | proxy code |
| --- | ---: | ---: |
| `seq.c` and its includes (`comp.c`, `patbank.c`, `patcodec.c`, `harmony.c`) | 209 | -5,132 |
| + `voice.c`, `engines.c`, the engines' `*_note_on`, `fm6_sync`, `drum_synth_on`, `punch_start`, the `*_desc` and `*_coef` helpers | 95 | **-7,524** |
| + the unmarked cold functions of `usb.c`, `ota.c`, `gfx.c`, `lcd.c`, `cpu1.c`, `libc.c`... | ~200 | -2,320 more |

`events_block` goes from 20,308 to 16,750 B; every per-sample render loop in `tests/target_budget.py`'s list
(`analog_render`, `drums_mix`, `mix_block`, `grain_render`, `fm6_render`, `slicer_track`, `punch_process`, the audio
ISR) is byte-identical. These functions cost about 0.3 us a block on the host (`docs/groovebox-performance.md`,
section 3), so slower code there is invisible; a `minsize` function is still inlined into its hot callers when the
compiler wants to. The gate is the real build: `tests/target_budget.py` (the static count of the render loops) and
`tests/regress.c`'s CPU check. The marking is one macro on each definition (the `UI_SMALL` pattern; `seq.c:544`
already defines it for the host). Do not use `noinline` for this instead: splitting `events_block`'s callees out
measures **+114 to +794 B** (the inliner is already right at `-Os`), and `noinline` on the screen draws saves 420 B at
most while the input side grows by 950 B.

Global `-Oz` (`tools/build.py CFLAGS`) is the bigger hammer (-25.8 KB proxy) but it shrinks the render loops too
(`analog_render` 2,110 -> 870 B, `fm6_op_run` 364 -> 176): fewer inlined helpers and no unrolling, so a CPU cost on
the pi32v2 that only the real build can measure. Worth one build with `BUDGET` left as it is, to see whether the
loops pass; if they do, it is the cheapest 20 KB in the tree.

Verified non-wins: `--gc-sections` on the app link (12 B unreachable: the single translation unit already drops
unused statics), `-fno-jump-tables` (+1,010 B), `-fno-unroll-loops` (+14 B), `-mllvm -inline-threshold=10`
(-914 B, not worth a global knob).

### 3.2 `.data` initialisers: -2,630 B (F2)

`tools/build.py` appends `.data` to the image, so every initialised object costs its full size in flash:

- `drums.c:53` `drums = {.set = -2}`: 1,892 B for one byte.
- `fx.c:76` `lim_dac`, `lim_usb` `= {.env = LIM_T, .g = 32768}`: 544 B for four words.
- `fx.c:980` `tx = {.rnd = 0x2545F491}`: 196 B; `punch.c` `punch = {.req = -1, .cur = -1, .fg = 8192}`: 192 B.

Make them `.bss` and set the fields in `audio_init` / the first use: measured -740 B `.data`, +56 B code for the
`fx.c` pair (editor fuzz and `boot_sound_test` pass). For `drums` the cheapest form needs no init code at all:
store `set` as index + 2 (0 = not looked up yet, 1 = none) in `drum_set()`, measured -1,892 B with the golden
renders identical (17 tests that set `drums.set = -2` change to `= 0`). `punch` is the same kind of change
(estimate -190). `fav` (32), `midi_set` (14), `UI_COL/DIM/MID` (48) are real data; leave them.

### 3.3 `param_desc_t` 20 -> 12 bytes: -2,036 B (F3)

`core.h:40` holds a label pointer, `fmt`, three `int16_t` (min, max, def), a names pointer and a unit pointer:
20 B x 259 descriptors (`TP` 71, `GP` 63, 12 x 8 engine EDIT entries, `INS_DESC`, `ESYNC`, `PS`, `DRUM_MIX`). All
259 fit `int8_t min` (-64..0), `uint8_t max` (<= 255: BPM 240, SEED 255), `int8_t def` (-12..127); only five
descriptors have a unit ("Hz", "ct", "st"), which fits in `fmt`'s upper nibble as an index into a 4-entry table.
Measured: rodata -2,056, code +20 (`TP` -568, `GP` -504, each engine table -64). 119 initialisers lose their seventh
field (a script does it; four have an expression as `max`: `eng_sample.c:253`, `eng_grain.c:461`, `eng_fm6.c:410`,
`eng_phys.c:269`); readers become `desc_fmt()` / `desc_unit()` at `params.c:348/438/464`, `editor.c:741-747`,
`icons.c:97`, `ui_draw.c:1149`. The editor protocol is unchanged (`ED_DESC` sends `fmt & 15`). Compiled with
`-Wconstant-conversion -Wexcess-initializers -Werror`; comp, lock, pat, harm, project, upreset, ui_pages, storage and
the golden renders pass.

### 3.4 The font: -2,294 B flash **and** -5,376 B RAM (F4)

`build/gen/felucca_font.h` stores 224 glyphs of 12 x 16 px (two always-blank columns on each side), LZ4-packed
(2,148 B) plus 1,024 B of per-glyph offset/advance/width tables that are constant (every glyph advances 8, every
bitmap is 12 wide), unpacked at boot into `FONT_S_DATA` (5,376 B) by `font_fill`. `gfx.c glyph()` folds a-z and the
Latin-1 lower case to capitals and maps 127..159 to `?`, so 89 glyphs can never be drawn, and the whole firmware uses
one non-ASCII character (the Ü of `ui_menu.c:150`). Stored as raw 8-px-wide 1-bit rows (16 B a glyph) for the 70
reachable codes: 1,120 B of constants, no table, no RAM copy, no unpack. Measured: code -218, constants -2,076,
RAM -5,376; the three screen-rendering tests (`song_ui`, `vis_styles`, `ui_pages`) give 96 of 96 renders
byte-identical. `FONT_L` (the 2x font, `sh = 1`) keeps working. A conservative variant that keeps all of 160..255
(135 glyphs) is code -168 / constants -1,036 / RAM -5,376. `tests/font_test.c` indexes the old tables and must be
rewritten; `tools/gen_font.py`'s unused TTF/4-bit path can go with it. This reverses the 1.1.0 trade and beats it on
both axes.

### 3.5 The flash driver in `.ram_text`: -3,364 B proxy, about -1.5..-2 KB real (F5)

`fm1_flash.h:83-150`: `fl_cs`, `fl_tx`, `fl_rx`, `fl_addr`, `fl_rdsr`, `fl_wren`, `fl_enter`, `fl_exit`,
`fl_wait_ready` are `always_inline`, so each of the five `RAMFN` entry points (`fl_prog_ram`, `fl_erase4k_ram`,
`fl_read_ram`, `fl_status_ram`, `fl_jedec_ram`) carries its own copies (`fl_tx` about twelve times each via
`fl_addr`). The reason is `tools/build.py check()`, which refuses any `call` instruction in `.ram_text` because RAM
code must not reach XIP while the flash is off. A call whose target is itself inside `.ram_text` is safe (the window
is 32 KB, the stack is RAM, the helpers call nothing). With the nine helpers as `section(".ram_text"), noinline`,
the proxy `.ram_text` drops from 4,954 to 1,590 B (`fl_prog_ram` 1,586 -> 400, `fl_erase4k_ram` 1,422 -> 280);
`fl_inval` must stay inline (XIP callers: `ed_smp_inval`, `fl_plain_window_init`). The check becomes: a `call` in
the `.ram_text` listing is allowed when its target address lies in `[_rt_start, _rt_end)` (the same regex the ROM check
already parses), refused otherwise. The real `.ram_text` is about 2,900 B (from the 29,384 B `.lowram` figure in
`docs/groovebox-performance.md`), so the real saving is roughly half the proxy's.

### 3.6 UI code and tables: about -2,500 B (F6)

All measured with identical renders:

- `lcd_fill(0, 0, 240, 240, C_BLACK)` appears 17 times and right-/centre-aligned `cv_text(236 - text_w(...), ...)`
  18 times: `lcd_clear()`, `ui_text_r()`, `ui_text_c()` save 600 B.
- `ui.c:1092 BANK`: 157 x `{u8, u8, const char *}` = 8 B each with 3 B of padding; a byte table plus a name table
  saves 459 B of constants (+38 code). A generated preset-index table would save ~470 B more and `bank_pi` (157 B RAM).
- `icons.c:24-72 ICON_MAP` (139 x 8 B, 417 B padding), `WAVE_ICON`, the engine maps: as a byte stream with one
  lookup, -480 B net. All 86 icons are referenced; `ICON_DATA` (3,096 B) is 2-bit antialiased and 1-bit would be
  visible, so leave it.
- `ui_studio.c:87 ui_lower` lowercases text that `glyph()` folds back to capitals; the lowercase label style costs 86
  case-only duplicate literals. Uppercasing them and dropping `ui_lower`: constants -372, code -98 (one semantic guard
  at `ui_studio.c:507`, three string checks in `ui_pages_test.c` change case).
- `ui_pats.c:87-111/287-305` and `ui_song.c:85-98` repeat the four-knob footer: a `knob_strip()` saves 336 B.
- `gfx.c cv_text` builds a 16-entry `ramp[]` (48 divisions a call) that the 1-bit font never reads, and carries the
  dead 4-bit path: -194 B and a CPU win.
- Estimated, not measured: the OCT+ sheet strip and filter code duplicated between `ui_draw.c:410-428` /
  `ui_input.c:1293-1313` and `ui_studio.c:452-476` / `681-703` (~300 B), the 40-row title band drawn five ways
  (~200 B), `palette_set` with outlined helpers (-122 B).

The strings (9,399 B) are not a lever: identical literals are already merged; UI messages are 3,922 B of it,
`params.c` names 1,405, the presets and kits the rest. Trimming help lines is a product decision worth 150..250 B.

### 3.7 Small, safe trims (F7)

`seq.c:1218-1297` lock_step_x's find-or-add loop appears three times (`lk_slot()`: -158 B, lock/comp/pat/seq2 and
the golden renders pass); the USB/UAC diagnostic counters nobody reads with `FELUCCA_CDC=0` (`usb.c`: -276 B code,
-84 B RAM; keep `resets`, `setups`, `sof_seen`, `timeouts`, `fill_min`, and guard `uac.underruns/overruns` for
`tests/uac_test.c`); `stack_paint` (`main.c:38`) exists only for the console's `stack_free` (~100 B);
`felucca.c:186 ota_show` hand-rolls a two-digit number (`fmt_int`: -86 B); `cpu1.c:74 cpu1_supplies` hand-rolls
"1.38V" (`fmt_fix`: ~-50 B).

### 3.8 Engines and DSP tables: about -6.6 KB (F8..F10), all with the 182 golden renders identical

- **F8, the synthesised drum kits: -5,268 B of constants (+~180 B code).** `DS_KITS` (`tools/gen_drumkits.py`,
  `drum_synth.c:31-50`) stores 32 kits x 16 lanes x 22 B. Most kits are `kit(K808, ...)` with 3..9 lanes changed: of
  the 512 lane records only 242 are distinct once the per-kit level byte is kept apart. Stored as `DS_SND[242]`
  (22 B each) plus a 33 B `dkit_t` per kit (crush, 16 sound indices, 16 levels; the name/style pointers already live
  in `DRUM_KIT_NAMES`), `DS_KITS` goes from 11,648 to 6,380 B. `ds_on()` takes the lane's record and level,
  `drums.c drum_synth_on()` and `editor_dsyn.c`'s LIST/GET index through the kit. The SYN1..4 user-kit format and the
  editor protocol (16 x 22 B with levels) are untouched; `dsyn_test`, `drumkit_test`, `drum_steal_test` pass with
  their accessors adapted. One extra index at note-on.
- **F9, the display-only tables: -1,304 B** (`params.c:376-424` is their only reader). `TIME_MS_X10`,
  `LFO_HZ_X100`, `CUTOFF_HZ`, `LEVEL_DB_X10` (1,536 B) replaced by `round(scale * base^(v/127))` from `fm6_mant()`
  (FM6's 2^x table, already in RAM), LFO Hz from `LFO_INC`, dB as `(v - 112) * 5`: +232 B code. A host probe shows
  all 512 display strings identical (one raw value differs by a unit and prints the same). Display path only.
- **F10, `PRESET_TRIM` flat: -245 B.** `preset_trim.h` is 13 x 32 `int8` for 157 presets; 157 bytes plus 14
  offsets (`tools/level_presets.py` emits it).
- **FM6's per-track copies into the arena: -1,856 B RAM, -162 B code** (R11, section 5). `eng_fm6.c:35-53`
  `fm6_eff[NTRK]`, `fm6_lfo[NTRK]`, `fm6_lfo_v/d` were per track although at most `NARENA` (3) tracks can play FM6;
  moved into `fm6_part_t` (the arena's FM6 use 2,032 -> 2,264 of 8,592). When a track loses its arena and gets it
  back, the macro copy is rebuilt and the LFO phase restarts, as at the first note after power-on; `fm6_patch` (the
  editor's patch) stays per track.
- **Optional, a CPU trade: ANALOG's two render bodies, -1,992 B code.** `eng_analog.c:33-100` keeps
  `analog_render` (LP, filter type constant) and `analog_render_f` (BP/HP) as deliberate copies of one body. One body
  with a run-time type makes the per-sample loop 511 -> 527 proxy instructions (~3 %): inside `target_budget.txt`'s
  10 % but not free. Take it only if that cost is acceptable on the pi32v2.
- Estimates, not built: packed name blobs for the 0-terminated `F_INT` lists (`N_FM6_PATCH`, `N_FM6_ALG`, `N_DCY`,
  `ESYNC_NAMES`, `N_IRATE`, ... 206 entries of 4 B pointers: ~-800 B; the whole firmware has 968 name pointers,
  3,872 B); one SVF coefficient routine for `dsp.c tsvf_coef`, `drum_synth.c:104-121`, `eng_trio.c:301-306`,
  `eng_noise.c:140-146` (~-150..200 B, bit-identical); preset names inline (`char[11]`) only together with a
  `BANK` by engine and index (section 3.6), else it costs more than it saves.
- Did not pan out: `GR_HANN` from `SINE` (99 of 129 points match), `ENV_LIN`/`ENV_EXP`/`DECAY_K`/`LFO_INC`/
  `PITCH_OCT` from `FM6_EXP2` (the generators truncate differently: a few LSBs, so golden changes), the reverb and
  chorus lines (already `int16`), the arena size (PHYS's two SYMP slots set it at 8,592; GRAIN needs 7,020).

### 3.9 What did not pan out

`ed_handle` (13.2 KB) is 35 protocol cases of ~180 B each with no dead handler; `noinline` on its sub-handlers is
+176 B and a table-driven dispatch would not beat the switch. `fm1_cstart` (9.9 KB) is `fm1_main` and the boot path
inlined once; `noinline` is +58 B. `UAC_FIR` (1,920 B) already stores half its phases (symmetric); 10 taps fails
`tests/uac_test.c`'s 16 kHz SNR. `abuf` is the minimum for 256-frame halves (128 would save 2 KB but doubles the
ISR rate and retunes the UAC bands). `FELUCCA_CDC=0` really leaves `console.c` out. The 8-bit canvas is not feasible
(the visualiser's per-row gradients). `--gc-sections` finds 12 B.

## 4. Flash: the sample data (exact arithmetic on the generated zones)

`SMP_DATA` is 273,840 B: 47 % of the app, 4-bit IMA ADPCM at 22,050 Hz (`tools/gen_samples.py TR`), the GM kit's
metal at 32,000 Hz. The earlier trade that removed the BASS set's top recording (9,372 B) is the precedent. The
zones, with each option's exact saving:

| Set | Zones | Bytes | Options |
| --- | ---: | ---: | --- |
| PERC (the sampled GM kit: ACOUSTIC .. DUST drum kits and the SAMPLE engine's GM KIT) | 16 samples (27 zones) | 86,144 | hi-hats, open hat, crash, ride at 32 kHz -> 22.05 kHz: **-11,000**; crash/ride/open hat 0.6 -> 0.45 s: -7,200 (32 kHz) or -4,962 (22 kHz) |
| PIANO (loop 0.47..0.64 s -> 1.0 s) | 4 x 11,026 | 44,104 | 1.0 -> 0.75 s (a shorter loop): **-11,024**; 4 -> 3 zones: -11,026 |
| VIBES (one-shot 1.0 s) | 3 x 11,026 | 33,078 | 1.0 -> 0.8 s: -6,618 |
| FLUTE (loop 0.4 -> 0.95 s) | 3 x 10,474 | 31,422 | 0.95 -> 0.70 s: -8,268; 3 -> 2 zones: -10,474 |
| BASS (one-shot 0.9 s) | 3 x 9,922 | 29,766 | 0.9 -> 0.7 s: -6,612 |
| HORNS (0.6 s) | 4 x 6,615 | 26,462 | 4 -> 3 zones: -6,616 |
| STRGS (0.6 s) | 3 x 6,615 | 19,844 | (already short) |
| SCRCH | 1 | 3,020 | (already one sound) |

The least audible first: the metal at 22.05 kHz loses the top octave above 11 kHz (the rest of the kit is there
already); PIANO's loop region is a level-flattened steady tone, so a 0.25 s loop instead of 0.4..0.5 s mostly risks a
faster-cycling timbre; VIBES and BASS at 0.8 / 0.7 s cut tails that the presets' envelopes already shape. All of these
change the golden renders of the presets that use them and need listening. Each is a parameter in
`tools/gen_samples.py` (`GM_RATE`, `GM_KEEP`, the per-kind `keep`, the loop window).

A 3-bit ADPCM would save 68 KB but at a quality the 4-bit codec was chosen to avoid; not recommended.

**Outside the app slot.** `eng_sample.c` reads samples by byte offset from `SMP_DATA`, user slots are read through the
plaintext XIP window above flash 0x93000 (`fl_plain_window_init`), and `SMP_ZONES` offsets are plain numbers: the
firmware side of keeping a built-in set elsewhere in the flash is small. The flash map has 0x93000..0x97000 (16 KiB)
that Felucca's store never uses (`storage.c:22`, `fm1_flash.h:38-47`; the loader's record scan only erases sectors
that hold a record), and the four 80 KiB user sample slots. What stops it is the install path: the update loader
writes `[0x4000, 0x93000)` only (`ldr_core.c:32`, `fm1pkg_make.py FLASH_SIZE`), so a factory set outside the slot
needs the loader, the package format, the web installer and `fm1_install.py` to write a second region, or the
firmware to copy it from the staged package. Worth it only if the sample sets are to grow; as a way to free the
present 1.5 KB it is out of proportion. After the slot, `cfg_tool.bin` (383 B) and the SDK EQ directory take the
3,876 B before 0x93000; whether the SPL needs them is unverified, so the slot cannot be assumed extensible.

The remaining build switches: `FELUCCA_EDITOR=0` (-13,872 B real: the web editor gets no reply) and `FELUCCA_VIS=0`
(-10,752 B) are the documented feature-for-flash trades.

## 5. RAM

### 5.1 The RAM region (96 KiB): about -22 KB without a feature change

| # | Change | Bytes | Notes |
| --- | --- | ---: | --- |
| R1 | `patbank.c:14 pb_buf` to `.pool` | -3,072 | one attribute; the ISR already uses pool buffers; pool headroom stays > 8 KiB (12.5 KB on the real build) |
| R2 | `project.c:393 proj_tmp` aliased to `autosave_buf` (pool) | -3,840 | both are main-loop, call-confined users (project load/save, bank staging, the editor's backup PUT; the autosave's capture/compare/save). `song_keep` and `proj_slot[]` are touched by the ISR and stay. Needs one guard: `autosave_tick` must not recapture while a backup PUT is staged (`ed_bk_put`); project, pat, storage, song_arm and soak tests pass with the alias |
| R3 | the font in flash (F4) | -5,376 | |
| R4 | the OTA buffers (`ota.c:103/248/330`: 2,160 B of staging over `proj_tmp`, 730 B as a `main_scratch` member) | -2,890 | `ota_session` runs at the main loop's top level and blocks; audio and `usb_poll` keep running, so `abuf`, `sl_buf`, `pb_buf`, `ua_ring` are **not** idle, `proj_tmp` is. Note `felucca.c:151`: 2.7 kept "the update path never shares RAM" as a policy |
| R5 | `ui_layers.c:749 tl`, `ui.c:666/595 *.vb` into a `ui[1024]` member of the `scratch.h` union | -1,286 | each lives inside one draw call |
| R6 | `lcd.c:63 lcd_fillbuf` filled from `cv_px` | -480 | `lcd_fill` already syncs first |
| R7 | `audio.c:25 scope_bufr` | -1,024 | written by the ISR, copied to `vis_r`, which nothing reads (`ui_vis.c:281` writes it; only `vis_l` is read) |
| R8 | lend the INSERT's FLANG/CHOR lines as the STUT buffers are lent (`fx.c:474 ins_t.line`, 512 B x 8) | -2,048 | estimate: 4 lines for 4 tracks; the other types need none. A fifth FLANG/CHOR track plays dry until a line is free: a (documented) limit like the arenas |
| R9 | editor: `editor.c:907` stage in `ed_smp_buf` (-192), `:1196` on the stack (-64), `ed_w.t/tt` as `uint8` (-158) | -414 | |
| R10 | USB/UAC counters (F7) | -84 | |
| R11 | FM6's macro copy and LFO state into the engine arena (`eng_fm6.c:35-53`, section 3.8) | -1,856 | measured; `fm6_test` passes, golden identical |
| R12 | `ins_t`: the FLANG/CHOR line and the phaser's `px/py/fb` as a union (`fx.c:463-472`) | -288 | estimate |
| R13 | `voice_t`: `pitch16`, `pitch_cur`, `fine` as `int16` over 70 voices | -280 | estimate; mind the `pend_note` padding note in `core.h:129` |
| | **Total** | **-22,900** | |

Also measured but not recommended without a reason: `vis_re`/`vis_im` can run in place on `main_scratch.vis`
(-2,048 B of **pool**, renders identical); `track_t` reordered to kill 22 B of padding (-160 B); `p_old[71]` per track
as a pool of two slots (-852 B, moderate risk: `fx.c:663` swaps `p`/`p_old` on both cores).

### 5.2 The big one: a shared voice pool, -4,704 B

`track_t.v[NVOICE]` gives every track eight `voice_t` (84 B each) although only eight voices sound across all synth
tracks and drum tracks never use `v[]` (`voice.c voices_busy`, `docs/groovebox-architecture.md` section 4). A pool of
eight voices with an owner each saves 4,704 B of RAM. The cost is spread: `eng_drawbar.c:185/216` and
`eng_grain.c:362/405` index per-part state by `(v - t->v) % NVOICE`; MONO/LEGATO/UNISON pin `t->v[0]`
(`voice.c:501/547`); `voice_alloc` and the stealing scan all parts; `project.c:66`, `ui.c:1013`,
`ui_input.c:69/504`, `engines.c:159`, `eng_fm6.c:191` loop over `t->v[]`; 28 host tests poke `trk[].v[]`; both cores
render from it. A large, testable refactor (the golden renders and `mix_split_test` are the net); worth it only when
RAM, not flash, is the wall.

### 5.3 The pool

Nothing cheap: the delay line, the punch ring, the canvas, the STUT buffers and the arenas are sized by features.
The options, each a sound or behaviour change: the delay at half rate or half length (-64 KB: 1/4 notes clamp below
82 BPM, or the repeats lose the top octave); the punch ring in 8-bit companded form (-32 KB: the loops get noisier);
a 240 x 62 canvas drawn in two passes (-29,760 B at ~9 draw sites, the visualiser's scene passes double); fewer STUT
buffers or arenas (-8 KB each: one fewer track in STUT or on a big engine at once). The pool has 13 KB free with
8 KB reserved, so there is no pressure unless a new pool buffer is wanted.

## 6. Suggested order

1. **F8, F3, F2, F9, F10, F7, R1, R7, R11** (a day or two): mechanical, test-covered, about -12 KB flash and
   -6 KB RAM. F8, F9, F10 and R11 exist as one patch (section 7) with the golden renders passing; F3 and the lock
   helpers as scripts in the scratchpad.
2. **F4** (the font) and **F6** (UI helpers): about -4.5 KB flash, -5.4 KB RAM; renders checked by
   `tools/make_all_screens.py` against the committed gallery.
3. **F1** (`minsize` on the control path) with a real build, `tests/target_budget.py` and `tests/regress.c` as
   the gate; then one `-Oz` build to see whether the loops survive it.
4. **F5** (the flash driver) with the `build.py` check change; **R2, R4, R5, R6, R8** for RAM.
5. The sample options of section 4 only when a feature needs more than this gives, starting with the metal at
   22.05 kHz.

Every step: `./build.sh` (the real sizes), `sh tests/run_tests.sh` (golden renders, budgets), and for the UI steps the
screenshot gallery. Each proxy figure should be re-measured on the pi32v2 build before it is counted on.

## 7. How to measure again

Everything above can be reproduced without the JieLi toolchain:

```sh
HOST_ONLY=1 sh tests/run_tests.sh                       # generates build/gen, runs the host suite
python3 tools/proxy_size.py --obj build/base.o          # the baseline proxy object
# ... make a change ...
python3 tools/proxy_size.py --obj build/new.o && python3 tools/proxy_diff.py build/base.o build/new.o 60
llvm-readelf -S -W build/new.o                          # per-function / per-object section sizes
```

- A whole-firmware flag variant: preprocess `firmware/src/felucca.c` as `proxy_size.py` does (the HAL's inline
  assembly emptied), then compile the `.i` with the flag under test and compare `.text*` sizes.
- The `minsize` experiment of 3.1: add `__attribute__((minsize))` to the `static` function definitions of the files
  named (a regex over lines that start with `static`, skip `inline` and existing attributes), proxy-build, and
  check with `llvm-nm -S` that the functions of `tests/target_budget.py`'s `FUNCS` list did not change size.
- The real figures: `./build.sh` prints `image ... B; RAM .data+.bss ... B of 98304; lowram ...; pool ...`, and
  `sh tests/run_tests.sh` without `HOST_ONLY` runs `tests/target_budget.py` on `build/felucca.dis`.
- The real 1.3.0 app image can be decoded from `docs/firmware/boopbox-1.3.0.fwsc` with the ciphers in
  `tools/fm1pkg_make.py` (undo the `.fwsc` marker bytes, take `flash.bin`, `sfc()` the area from 0x4000 with
  `KEY`, the app is at 0x120 of it): 580,024 B, `SMP_DATA` at offset 250,096.

The changes marked "measured" were made in scratch copies during the analysis and not kept; the text gives each
one's files, lines and the tests that covered it, which is enough to redo any of them in an hour or two. F8, F9, F10
and R11 were made together and passed the 182 golden renders as one tree.

One thing seen in passing, not caused by any of this: on the unmodified tree, `tests/phys_tune_test.c` reports
`TANPURA 100: +64.5 cents FAIL` under `HOST_ONLY=1 sh tests/run_tests.sh` on this machine (x86-64, clang 18). It
reproduces identically with the engine changes applied, so it is a pre-existing host result worth a look of its own.
