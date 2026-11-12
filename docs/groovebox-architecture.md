# BoopBox groovebox: architecture notes

This file describes the BoopBox firmware as it is in release 1.9.3. BoopBox is a fork of SLOOP 2.8.3 with eight
tracks. The file gives the build structure, the hardware limits, and the design that fits eight tracks into these
limits. The controls are in `docs/groovebox-controls.md`. The project format is in `docs/groovebox-storage.md`.

## 1. How the firmware is built

**One compilation unit.** `firmware/src/felucca.c` includes every `.c` file in a fixed order. Almost every symbol is
`static`, so the order is important. A file can use only the symbols of the files before it. The table gives the order
of `felucca.c` and the files that each file includes.

| Step | Files (in order) | Files that they include |
| --- | --- | --- |
| 1 | HAL headers (`firmware/hal/fm1_*.h`), `libc.c`, `lcd.c`, `gfx.c`, `core.h`, `cpu1.h` | |
| 2 | `engines.c` | `dsp.c`, the `eng_*.c` engines (`eng_obv.c` last), `eng_slice.c` |
| 3 | `drums.c`, `params.c`, `voice.c`, `slicer.c`, `fx.c` | `drum_synth.c` (in `drums.c`), `punch.c` (in `fx.c`) |
| 4 | `usb.c`, `midi_uart.c`, `arranger.c` | `usb_host.c` (in `usb.c`) |
| 5 | `seq.c` | `keyvel.c`, `comp.c`, `patcodec.c`, `drumgen.c`, `patbank.c`, `harmony.c` |
| 6 | `audio.c`, `cpu1.c`, `panel.c` | |
| 7 | `ui.c`, `ui_song.c`, `ui_studio.c`, `ui_pats.c`, `icons.c`, `ui_draw.c`, `ui_vis.c`, `ui_layers.c`, `ui_menu.c`, `ui_input.c` | |
| 8 | `storage.c`, `upreset.c`, `project.c` | `arranger_scene.c`, `fm6_bank.c` (in `project.c`) |
| 9 | `trainer.c` (trainer build only), `ota.c`, `editor.c`, `console.c` (`FELUCCA_CDC=1` only), `recovery.c` | `editor_fm6.c`, `editor_dsyn.c`, `editor_live.c` (in `editor.c`) |
| 10 | `splash.c`, `main.c` | `power_on.c` (in `main.c`) |

**Host tests use the same sources.** `tests/hostsim.c` and the other host tests `#include` the firmware files. Small
stubs replace the hardware access. `tests/cpu1_host.c` replaces the second core with a host thread.

**The target build.** `scripts/build.sh` runs `tools/build.py`. This build needs the JieLi pi32v2 toolchain
(`tools/get_toolchain.sh`) and three files of the AC79 SDK (`BUILDING.md`). Without these, run
`HOST_ONLY=1 sh tests/run_tests.sh`. This command generates `build/gen/` and runs every test that does not read a
firmware package. It skips four tests and names them: the update entry, the update loader, the target cost of the
render loops, and the offline site.

**Other builds from the same sources:**

| Build | Command | What it is |
| --- | --- | --- |
| BoopBox Trainer | `scripts/build.sh --trainer` | `FELUCCA_TRAINER=1`: the lessons of `trainer.c`, three levels. No web editor, three sample sets fewer. |
| Browser emulator | `python3 tools/build_emu.py` | `firmware/host/emu.c`: the whole firmware for wasm32 (1.8). No USB, MIDI, second core or update. |
| Sound preview | `tools/build_preview.py` | `firmware/host/preview.c`: the DSP and the clock for the web editor's sound preview. |

**A size estimate without the toolchain.** `tools/proxy_size.py` compiles `felucca.c` for RV32IMC with the host clang,
without the HAL's pi32v2 inline assembly. The struct and array sizes are exact for a 32-bit target. The code size is
not the FM-1's, because the instruction set is different. `docs/memory-savings-analysis.md` measured the real code at
about 0.77 times the proxy code. The difference between two trees is a fair measure of the cost of a change.
`tools/proxy_diff.py` compares two proxy builds function by function.

## 2. Hard limits

The sizes come from `firmware/app.ld`, `tools/build.py` and `tools/fm1pkg_make.py`. The "used" figures come from the
proxy build of the 1.9.3 tree (`tools/proxy_size.py`), except where the table names another source.

| Resource | Size | Used | Notes |
| --- | --- | --- | --- |
| Flash, app slot (XIP) | 581,564 B (`APP_SLOT` 0x8DFBC) | 320 B free in 1.9.0 (`BUILDING.md`) | The built-in sample data (`SMP_DATA`) is 256,496 B. If the app does not fit, the build fails. It does not remove a feature by itself. |
| RAM region (.data + .bss) | 98,304 B | 81,197 B | The largest object is `trk[8]` (19,136 B). |
| Pool (.pool, zeroed) | 344,064 B (0x54000) | 331,004 B | `build.py` demands 8,192 B of headroom, so 4,868 B are usable. The contents are below. |
| NOINIT | 15,696 B (0x3D50) | 15,360 B in `proj_slot[4]` | The four section slots (4 x 3,840 B). They stay through a reset. |
| `.lowram` | the 32,512 B RAMTEXT region, after the RAM code (`.ram_text`, `.c1_text`) | 19,700 B, without core 1's stacks | The reverb lines (`rev_line`, 17,368 B), the two mix accumulators (`acc[2]`, 1,792 B), core 1's stacks. |
| One stored object | 3,840 B payload and a 192 B side record | a project: 12 to 3,840 B | Two copies (A/B), the header written last, CRC-32 (`storage.c`). |
| CPU | an audio interrupt each 256 frames (5.8 ms at 44.1 kHz, `HALF_FRAMES`) | `tests/cpu_baseline.txt`, `tests/target_budget.txt` | On overload, `voice.c shed_voice` fades out voices. Core 1 renders some tracks (`fx.c units_split`). |

The pool holds these buffers (proxy sizes):

| Buffer | Bytes | What |
| --- | ---: | --- |
| `dly_buf` | 131,072 | the delay line |
| `punch_ring` | 65,536 | the mono ring of the punch-in effects (0.74 s) |
| `cv_px` | 59,520 | the drawing canvas (240 x 124, RGB565) |
| `sl_buf` | 32,768 | four STUT buffers of the SLICER (8 KB each) |
| `eng_arena` | 25,776 | three engine arenas (8,592 B each) |
| `cho_buf` | 4,096 | the chorus line |
| `song_keep`, `autosave_buf` | 7,680 | the song backup and the autosave buffer |

Only one sector of the flash data area is free. `storage.c` and `firmware/hal/fm1_flash_map.h` give this map:

| Range | Use |
| --- | --- |
| 0x97000..0x9EFFF | projects: four sections, A and B sectors |
| 0x9F000 and 0xFE000 | the autosave (the working project), copies A and B |
| 0xA0000..0xDBFFF | user sample slots USR1..USR3 |
| 0xDC000..0xDFFFF | user presets |
| 0xE0000..0xE4FFF | the update staging (`ota.c`) |
| 0xE5000 and 0xE6000 | the FM6 patch bank, copies A and B |
| 0xE7000..0xFAFFF | user sample slot USR4 |
| 0xFB000 | free in BoopBox. The trainer build keeps its progress log here (`FL_TRN_LO`). |
| 0xFC000 and 0xFD000 | the settings, copies A and B |

## 3. Changes from SLOOP's four-track code

SLOOP 2.8.3 had four tracks: three synth parts and one drum track at a fixed index. Its code used `NTRK 4`, `NPART 3`,
`TRK_DRUM 3` and `TDRUM`, and `is_drum(t)` compared `t` with `TDRUM`. BoopBox removes `NPART`, `TRK_DRUM` and `TDRUM`.
`NTRK` is 8, and `is_drum(t)` reads `track_t.kind`. The table shows each area that changed.

| Area | SLOOP 2.8.3 | BoopBox 1.9.3 |
| --- | --- | --- |
| Tracks | three synth parts, the drums on track 4 | eight tracks, each `TK_SYNTH` or `TK_DRUM` (`core.h`) |
| Synth voices | `v[8]` a part, eight voices at once in total | `v[NVOICE]` (8) a track, `NVBUDGET` (20) at once in total |
| Drum voices | `NDRUM` (6) for the one drum part | `NDRUM` (6) for all drum tracks, with an owner track each (`drums.own`) |
| Big engine state | `eng_arena[NPART]`, one arena a part | `NARENA` (3) arenas, lent to the tracks (`engines.c`) |
| Drum mix | one bus, one kit, globals `G_DRLVL`, `G_DRREV`, `G_DRDLY` | each drum track has its own kit, TUNE, DECAY, `P_LEVEL`, `P_REV`, `P_DLY` |
| SLICER STUT buffers | one a track | four (`SL_NBUF`), lent to the tracks |
| Render units | the synth parts and the drums | one unit a track, eight bits in core 1's job argument |
| MIDI channels | `G_CH1..G_CH3`, `G_DRCH` | the same for tracks 1-4, and `G_CH5..G_CH8` for tracks 5-8 |
| Patterns | one a track | `NPAT` (8) a track, with chains and scenes |
| Project format | format 6, fixed layout | format 7, variable length. BoopBox does not read formats 1-6. |
| Screens | four columns, colors `UI_COL[4]` | the bank of four that holds the selected track, colors `UI_COL[8]` |
| Web editor | four tracks | eight tracks (1.1.0), protocol v13 (`editor.c ED_PROTO`) |

The globals `G_DRLVL`, `G_DRREV` and `G_DRDLY` remain. GLO > DRUMS uses them to edit `P_LEVEL`, `P_REV` and `P_DLY` of
the drum track that `drum_focus()` gives (`params.c`).

## 4. Design for eight tracks

The design keeps every engine and the timing core of SLOOP. The timing core is the transport clock in `BEAT_U` units,
one step a block at most, nudges and ratchets. The design changes what each track has:

1. **Eight tracks, each SYNTH or DRUM** (`track_t.kind`). `is_drum(t)` reads the kind, and no track index is special.
   The default layout is in `params.c TRK_DEF`: synths on tracks 1-3 and 5-7, drums on tracks 4 and 8.
   SAVE > TOOLS > KIND changes a track between synth and drum (`ui.c track_set_kind`).
2. **One voice budget for all synth tracks.** `NVBUDGET` is the number of synth voices that sound at once across the
   eight tracks. It is 20 in BoopBox (1.6.0) and 8 in the trainer build, the budget of its approved songs. One track
   still plays at most `NVOICE` (8) voices. When the budget is full, `voice.c voice_victim` takes the oldest released voice first.
   Then it takes an extra UNISON voice, then a held POLY voice that is not the lowest note of its track. The drum
   voices are a separate pool (`NDRUM`), which all drum tracks share.
3. **The firmware lends big engine state to the tracks. It does not multiply it.** GRAIN, DRAWBAR (WHEEL on the screen), FM6, PHYS and OBERVAVE keep
   their state in an arena (`engines.c eng_big`). There are `NARENA` (3) arenas, so at most three tracks can play these
   engines at once. Where you select an engine, the UI refuses a fourth one with a message (`eng_room`, `eng_refused`).
   Five more arenas need about 43 KB of pool, but the pool has less than 5 KB of usable space.
4. **The firmware lends the SLICER STUT buffers in the same way.** Four 8 KB buffers serve at most four tracks in STUT mode. A fifth
   track in STUT plays live until a buffer is free. GATE needs no buffer, and it works on every track.
5. **Drum tracks** render their voices on a mono bus. Then the bus goes through the SLICER, the INSERT and the FILTER,
   then LEVEL, PAN and the sends. Each track has one INSERT state.
6. **The firmware keeps patterns compact.** Each track plays one pattern, decoded in `track_t`. One shared RAM bank of
   3,072 B (`patbank.c pb_buf`) keeps the other patterns of all eight tracks, encoded. The audio interrupt changes a pattern on
   its quantize boundary, with one encode and one decode at most.
7. **Projects have a variable length** (format 7). The encoding holds the eight tracks, their pattern bank, the step
   components, the parameter locks, the harmony state and the scenes. A project fits in one 3,840 B object, with the same
   slots and flash sectors as in SLOOP. If a project does not fit, the firmware refuses the save and says
   `PROJECT FULL: NOT SAVED`. It does not truncate the project.
8. **The flash is full.** The default build uses the text boot logo (`FELUCCA_LOGO_TEXT=1`). If the app does not fit,
   `tools/build.py` fails and tells you. It removes no feature by itself. `BUILDING.md` lists the options that make
   room by hand (`FELUCCA_VIS=0`, `FELUCCA_EDITOR=0`).

The groovebox features are in these modules. All of them are host-testable, use no allocation, and have bounded loops.

| File | What | Since |
| --- | --- | --- |
| `comp.c` | the step components: `comp_eval` evaluates them, and `seq.c seq_fire` plays the result | 1.0.0 |
| `harmony.c` | the song's key, scale and chord, and the FOLLOW of each track | 1.0.0 |
| `patbank.c` | the pattern bank, quantized pattern changes, chains and scenes | 1.0.0 (chains with repeats and scenes: 1.7.0) |
| `patcodec.c` | the pattern codec of format 7, which the audio interrupt also uses | 1.0.0 |
| `punch.c` (extended) | the performance layer over the punch-in effects: TARGET, LATCH, Q | 1.0.0 |
| `eng_obv.c` | the OBERVAVE engine (OberVave's voice), in an engine arena | 1.7.0 |
| `usb_host.c` | the USB-C port as a USB-MIDI host (MENU > USB > USB HOST) | 1.7.0 |
| `keyvel.c` | key velocity and aftertouch on the FM-1's own keys (MENU > KEYS) | 1.8.0 |
| `power_on.c` | `felucca_init`, shared with the browser emulator | 1.8.0 |
| `drumgen.c` | beats from the keys on the PLAY page of a drum track | 1.9.0 |
| `trainer.c` | BoopBox Trainer, three levels (trainer build only) | 1.4.0 |

## 5. Implementation notes

### 5.1 Tracks and drum tracks

- `drum_focus()` gives the drum track for the drum controls. If the selected track is a drum track, it is that track.
  If not, it is the first drum track. `DFOC` is the track that the drum screens show.
- The drum tracks share one pool of `NDRUM` voices. Each voice has an owner track (`drums.own`). The kit, TUNE, DECAY,
  LEVEL, REV, DLY, the lane mutes and the hat choke are per track (`params.c DRUM_MIX_DESC`).
- If a drum track has its SLICER, INSERT or FILTER on, it renders on a mono bus.
- The screens that list tracks (TRACKS, REC, the track meters, the GLO layer, the visualizer) show the bank of four that
  holds the selected track. Tracks 5-8 show a lighter shade of the colors of tracks 1-4 (`gfx.c UI_COL`).

### 5.2 Engine arenas and STUT buffers

- `engines.c eng_arena_take`, `eng_arena_drop` and `eng_arena_lend` manage the arenas. The ownership is two-way, so a
  stale entry frees itself.
- A track without an arena stays on core 0, where it can take an arena as it renders. A fourth big engine waits for a
  free arena (`tests/tracks8_test.c t_arena`).
- `slicer.c sl_lend` lends the four STUT buffers once a block, on core 0, in track order. It never lends while the
  tracks render.

### 5.3 Render units and the second core

- Each track is one render unit, which is one bit in core 1's job argument (`fx.c`, a static assert keeps `NTRK` at 8 or
  less).
- By default, core 1 renders tracks 3, 4, 7 and 8 (`fx.c units_split`). `units_split` removes from that share a synth track
  that must stay on core 0.
- `tests/mix_split_test.c` renders every split of the units under ThreadSanitizer. The drum voices' shared `active`
  scan and the drum synth's scratch (`ds_buf`, now on the stack of each core) were races that this test found.
- `mix_block` is `noinline` (`fx.c`). `tests/target_budget.py` counts the instructions of the audio interrupt on a real
  build, and an inlined `mix_block` breaks that count.

### 5.4 MIDI and the settings

- Tracks 5-8 have the channels `G_CH5..G_CH8` (MIDI SETTINGS > MIDI 2). `seq.c` maps track 4 to `G_DRCH`, the drum
  channel of SLOOP.
- The settings keep an 8-byte tail after the MIDI part of SLOOP, which older firmware ignores (`project.c midi_part_fill`):

| Byte | Content |
| --- | --- |
| 0-3 | `G_CH5..G_CH8` |
| 4-5 | `ml_hi`: one bit for each MIDI LEARN entry of tracks 5-8 |
| 6 | `rec_locks` (MENU > SEQ > REC KNOBS) |
| 7 | `kv_set` (MENU > KEYS, 1.8.0) |

- NRPN (1.8.0) sets each track parameter with 14 bits: CC99 0, CC98 the parameter number, then CC6 and CC38
  (`seq.c midi_nrpn`, `docs/NRPN.md`).

### 5.5 Project format 7

- `project.c proj7_*` writes and reads format 7. It is the only format. BoopBox 1.0.0 removed the format 6 reader and
  writer, and SLOOP projects do not open.
- A project is a header and a list of chunks. The reader skips an unknown tag. The table gives the chunks:

| Tag | Content |
| --- | --- |
| `G` | the globals that are not at their default, including `G_HKEY`, `G_HSCL`, `G_HQ`, `G_HPROG` |
| `S` | the song: the selected track |
| `T` | a track: kind, engine, preset, parameters, drum TUNE and DECAY, its pattern, the pattern number that plays, the chain (slots, repeats, PLAY), FOLLOW |
| `H` | the chord progression (only when it is not the default) |
| `P` | one entry of the pattern bank |
| `C` | the scenes: a name and eight track patterns each (only when not the default, 1.7.0) |

- `tests/project_test.c` prints the sizes. An eight-track project with a few steps a track takes 1,146 B of 3,840 B.
  Four dense tracks take 3,541 B. Eight dense tracks need 6,664 B, so the firmware refuses the save whole.
- A section of the song is a format 7 capture, so it carries its patterns. `proj_apply` and `proj_capture` run in the
  audio interrupt for a section change and for the song backup (`arranger_scene.c`).

### 5.6 Step components

- There are 14 types (`core.h CP_*`): PULSE, HOLD, MULT, VEL, RAMP+ and RAMP- (`CP_RUP`, `CP_RDN`), RAND, PORTA, BEND,
  TONE, JUMP, PARAM, COND and TRIG. Each track also has a play direction (FWD, REV, PEND, RAND) and a random seed.
- A track has at most `NCOMP` (16) components. One step can have several, of different types. `comp.c CP_RANGE` gives
  the ranges of the values.
- These definitions are BoopBox's own. They cover the usual step components of a groovebox: rhythm, melody,
  dynamics, sequence and conditions.
- `comp_eval` turns the components of a step, the track's component state and its random numbers into a `cp_ev_t`.
  `seq_fire` plays that result. `comp_eval` starts no note, so a test can call it on a track that does not play
  (`tests/comp_test.c t_eval`).
- Only PULSE, HOLD, JUMP or a direction other than FWD move the playhead off the grid (`comp_flow`, `comp_next`). A
  track off the grid still records on the grid. `rec_hold` does not extend held notes into TIEs there.
- Each track has its own xorshift generator (`cp_rng`). It starts from `cp_seed` and the track index at each PLAY. The
  components do not use the shared `rng()`, so the random draws of the render do not change.
- The notes that a component moves are the notes started, so their note-offs match (`seq_notes`). PARAM and PORTA go
  through the lock path (`lock_step_x`). BEND is a per-track offset in 1/4096 semitone (`cp_bend`, added in `voice.c`).
- The work is bounded: at most `NCOMP` components for each step that fires, and `NCPAR` (4) extra parameter values. All
  of it runs on core 0 in `events_block`.
- Format 7 keeps the components at the end of each pattern. On load, the firmware drops a damaged entry. A damaged entry
  has an unknown type, a step past 64, a value out of range, or a type that its step already has.
- SEQ > PLAY shows DIR and SEED (`SC_PATT`). These values are in `track_t` beside `p[]`, so they are not sound
  parameters. They have no lock and no MIDI LEARN, and user presets do not keep them.

### 5.7 Parameter locks

- A track has `NLOCK` (32) locks. Format 7 keeps all of them.
- SLIDE is bit 7 of `plock_t.param` (`LOCK_SLIDE`). The parameter id is `param & LOCK_PID`. At most `NSLIDE` (4)
  slides move at once on a track. `seq.c lock_slide_tick` moves them once a block on core 0, after the ratchets.
- `trk_base(t, id)` gives `p[id]` without the lock that is in force. The project capture (also the autosave and the song
  backup) and the user preset save use it, so a lock never gets into a preset.
- With MENU > SEQ > REC KNOBS set to LOCKS, a knob that turns during a recording writes a lock (`lock_capture`).
- The step sheet has the LOCKS strip (`ui.c lock_strip_*`) and the COMP strip (`ui.c comp_strip_*`). MOVE and COPY of
  a note take its components and its locks with it.

### 5.8 Patterns, chains and scenes

- A track has `NPAT` (8) patterns. The pattern that plays stays decoded in `track_t`. The bank keeps the others as
  `[track << 4 | pattern][size, 2 bytes][LEN][bytes]` (`patbank.c`). An empty pattern has no entry.
- The UI sets `t->pat_req`. `pat_block` reads it once a block, and `seq_tick` makes the change on the step where it
  falls (`pat_due`). `G_PATQ` selects LOOP (the track's own loop) or the first step at or after the next 1, 2 or 4 bars.
- `pat_swap` restores the locks, encodes the pattern that plays, releases its notes, decodes the new pattern and resets
  the components.
- Each track keeps the grid step where its pattern started (`seq_org`). The step index is `(abs - seq_org) % len`, so a
  new pattern starts on its step 1. A track without a change plays as before.
- If a pattern does not fit in the bank, the firmware refuses the change (`pb_full`) and the UI says `PATTERNS FULL`.
  No data is lost.
- A chain (`pat_chain`) has 2 to `NCHAIN` (16) slots. Each slot is a pattern and its repeats (x1 to x16). A requested
  change plays first, and then the chain continues from it.
- A scene gives each track a pattern, or KEEP. There are `NSCENE` (8) scenes, each with a name from `N_SCN`. A scene
  launch requests a change on every track, and all tracks change on the same quantize boundary.
- The PATTERNS, CHAIN and SCENES pages are in `ui_pats.c`, scope `SC_PATS`. `pats_view` tells them apart by their order
  in `PAGES`. On these pages the keys are pads (`seq.c kb_pats`, `KB_PATS` events).
- The song's loop region uses the two reserved bytes of the arranger (`arranger.h arr_loop_first`, `arr_loop_end`). On
  the SONG screen, PRESETS sets the loop end and ALGORITHM sets the loop start (`ui_song.c`).
- The libc of the firmware has no `memmove`, so the bank closes up with a byte loop.

### 5.9 Harmony

- The globals are `G_HKEY`, `G_HSCL`, `G_HQ` and `G_HPROG`. The progression has up to `NHPROG` (8) chords, each a
  degree and a number of bars. The live chord comes from the keys of the CHORDS screen (`harm.live`).
- Each track has FOLLOW (`t->hfol`): OFF, TRANS or SCALE. Drum tracks never follow.
- `harm_block` runs once a block, before the patterns and the steps. It takes a new key, scale or chord on its boundary
  (`G_HQ`: NOW, the next beat or the next bar). When the transport is stopped, the change is immediate.
- `harm_apply` maps the notes of the step copy (`cp_step`) at note-on. The ratchets and the note-offs use the mapped
  notes (`seq_notes`). A note moves with at most 12 x 8 scale lookups.
- A track with FOLLOW OFF takes the same path as in SLOOP.
- The UI is SCL > HARMONY (a global page), SCL > FOLLOW (`SC_PATT`) and the CHORDS screen (`ui_pats.c`, `SC_HARM`).

### 5.10 Performance effects

- LATCH (`G_PFXL`): `seq.c key_down` and `midi_fx` toggle `punch.req`, instead of holding it.
- Q (`G_PFXQ`): `punch_quant` starts a new effect only when the transport crosses a 1/16, 1/8, 1/4 or bar line. An end
  of an effect, or any change while stopped, is immediate.
- TARGET (`G_PFXT`): `mixacc_t` has a second dry pair (`pl`, `pr`). `fx.c pfx_bus` sends the dry signal of the target
  tracks there, instead of to the mix. The punch-in effect processes that bus, and then the bus goes into the mix.
- When an effect starts, `punch_mask` latches the bus mask. With no target, the signal path is the same as in SLOOP.
- The controls are on FX > PERF.

### 5.11 Features after 1.0.0

| Release | Feature | Where |
| --- | --- | --- |
| 1.1.0 | The web editor shows eight tracks, the Patterns page, and the song loop region | `editor.c`, `web/` |
| 1.1.0 | The firmware builds FM6's exponent table and the sine table in RAM at power-on. Until 1.8.0, it also unpacked the font there. | `main.c`, `docs/groovebox-performance.md` |
| 1.6.0 | 20 synth voices (`NVBUDGET`), 8 in the trainer build | `core.h` |
| 1.7.0 | PATTERNS, CHAIN and SCENES pages, chains with repeats, scenes in the `C` chunk | `patbank.c`, `ui_pats.c`, `project.c` |
| 1.7.0 | OBERVAVE, a fifth engine in the arenas | `eng_obv.c` |
| 1.7.0 | USB HOST: a USB-MIDI keyboard on the USB-C port. Input only, never saved. | `usb_host.c` |
| 1.8.0 | The flash chip of newer FM-1s, and a shared flash map for the emulator | `firmware/hal/fm1_flash_map.h` |
| 1.8.0 | NRPN, key velocity and aftertouch, the browser emulator | `seq.c`, `keyvel.c`, `firmware/host/emu.c` |
| 1.8.0 | The font is read in place from the flash | `gfx.c` |
| 1.9.0 | Beats from the keys on a drum track's PLAY page | `drumgen.c` |
| 1.9.1 | The trainer has three levels again. This release removed level 4 and its song page. | `trainer.c`, `tools/trainer/lessons.py` |
| 1.9.2 | A synth track's LEVEL reads 0-127 | `params.c` |
| 1.9.3 | PRESETS and ALGORITHM move through the sound browser | `ui_input.c` |

## 6. Tests

| Test | What it covers |
| --- | --- |
| `tests/tracks8_test.c` | eight tracks, track kinds, drum tracks, arenas |
| `tests/mix_split_test.c` | the render split over the two cores, with a TARGET scene, under ThreadSanitizer |
| `tests/comp_test.c` | each component type, the directions, the seeds, drum tracks, a random session, storage and damage |
| `tests/lock_test.c` | parameter locks and SLIDE |
| `tests/pat_test.c` | patterns, chains, scenes, and the host cost of a pattern change |
| `tests/harm_test.c` | the note mapping, BEAT and BAR changes, progressions, live chords, storage |
| `tests/perf_test.c` | LATCH, Q and TARGET of the performance effects |
| `tests/drumgen_test.c` | beats from the keys |
| `tests/project_test.c` | format 7: round trips, damage, projects that are too large |
| `tests/ui_pages_test.c`, `tests/song_ui_test.c` | the UI pages of the features |
| `tests/soak_test.c` | random sessions that also add components and request pattern changes and chains |
| `tests/groove_cost.c` | the host cost of the sequencer path and of a block, with and without each feature |
| `tests/regress.c` | renders of every engine and preset, compared with `tests/golden.txt` |
