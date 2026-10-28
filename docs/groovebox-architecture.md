# SLOOP groovebox upgrade: architecture notes

This file records what the checked-out tree (SLOOP 2.8.3, branch `groovebox-8track`) actually does, the limits
that bound the upgrade to eight tracks, and the design chosen to fit them. It was written before the first
change of the firmware and is updated as the work goes on (the last section).

## 1. How the firmware is built

- **One compilation unit.** `firmware/src/felucca.c` includes every `.c` file in a fixed order; nearly every
  symbol is `static`. Order matters: `core.h` → engines → `drums.c` → `params.c` → `voice.c` → `slicer.c` →
  `fx.c` (which includes `punch.c`) → USB / MIDI → `arranger.c` → `seq.c` → `audio.c` → the UI files →
  `storage.c` → `upreset.c` → `project.c` → editor → `main.c`.
- **Host tests include the same sources.** `tests/hostsim.c` and the other tests `#include` the firmware files
  with small stubs for the hardware (`fm1_in`, IRQ on/off, the second core as `tests/cpu1_host.c`).
- **The target build** (`tools/build.py`) needs JieLi's pi32v2 toolchain and three files of the AC79 SDK. Neither
  can be downloaded from this environment (the network policy refuses `pkgman.jieliapp.com` and `gitee.com`), so
  no firmware image can be produced here. `tests/run_tests.sh` gained `HOST_ONLY=1`: it generates `build/gen/`
  itself and runs every test that does not read the firmware package (4 are skipped and named).
- **A size estimate without the toolchain**: `tools/proxy_size.py` compiles `felucca.c` for RV32IMC with the
  host clang (the HAL's pi32v2 inline assembly emptied). Its RAM and pool figures match the real build closely
  (pool 333,900 B: identical to `RAM.md`; RAM 59,094 B against 58,220 B on the target); its code size does not
  (another instruction set), but the *difference* between two trees is a fair measure of a change's cost.

## 2. Hard limits (measured on the baseline)

| Resource | Size | Used (baseline) | Notes |
| --- | --- | --- | --- |
| Flash, app slot (XIP) | 581,564 B (`APP_SLOT` 0x8DFBC) | full | 2.7 removed the USB serial console and `build.py` already rebuilds with a text boot logo when the image does not fit. The built-in samples are 283,212 B of it. |
| RAM region (.data+.bss) | 98,304 B | 59,094 B (proxy) | ~37 KB free: the only real room. |
| Pool (.pool, zeroed) | 344,064 B | 333,900 B | `build.py` demands 8,192 B of headroom: **~2 KB usable**. Holds the delay (128 KB), the punch ring (64 KB), the canvas (58 KB), the SLICER buffers (4 x 8 KB), the engine arenas (3 x 8,592 B), the song backup and the autosave buffer. |
| NOINIT | 15,696 B | 15,464 B | The four section snapshots `proj_slot[4]` (4 x 3,816 B). |
| `.lowram` | 29,488 B | 19,700 B | Reverb lines, core 1's stacks, the split's scratch. |
| Flash data | 0x97000..0xFFFFF | allocated | Projects: 4 sections x A/B sectors (0x97000..0x9EFFF), autosave A 0x9F000 / B 0xFE000, user samples 0xA0000..0xDBFFF and 0xE7000..0xFAFFF, user presets 0xDC000..0xDFFFF, update staging 0xE0000..0xE4FFF, FM6 bank 0xE5000/0xE6000, settings 0xFC000/0xFD000. Only 0xFB000 is free. |
| One stored object | 3,840 B payload (+192 B "side") | project format 6 = 3,816 B | A/B copies, header written last, CRC-32 (`storage.c`). |
| CPU | audio ISR every 5.8 ms half (256 frames) | see `tests/cpu_baseline.txt` | Overload sheds voices (`voice.c shed_voice`); core 1 can render some units (`fx.c units_split`). |

## 3. Hard-coded assumptions found

`NTRK`, `NPART`, `TRK_DRUM`, `TDRUM` and `is_drum` appear 438 times in `firmware/src`:

- `core.h`: `NTRK 4`, `NPART 3`, `TRK_DRUM 3`; `is_drum(t)` is `t == TDRUM`; `ex_off[NTRK]`; `song.solo`/`song.rec`
  are bit masks (8 bits: room for 8 tracks).
- **Voices** (`voice.c`): every synth part owns `v[NVOICE]` (8) but only `NVOICE` of all parts' voices sound at
  once (`voices_busy`, `voice_victim`, `shed_voice`: loops over `NPART`). The drums have their own 6 voices
  (`drums.c NDRUM`) outside that budget.
- **Engine state** (`engines.c`): GRAIN, DRAWBAR, FM6 and PHYS keep their big state in `eng_arena[NPART]`
  (3 x 8,592 B in the pool). FM6 also keeps per-part patch copies in RAM (`fm6_patch`, `fm6_eff`, `fm6_lfo`,
  indexed by track < `NPART`); PHYS its slot layout (`phys_lay[NPART]`).
- **The drum part** (`drums.c`): one bus, one kit (`TDRUM->p[P_E0]`), one TUNE / DECAY table (`drum_tune[16]`,
  `drum_dec[16]`), level / reverb / delay in globals (`G_DRLVL`, `G_DRREV`, `G_DRDLY`), mixed by
  `fx.c mix_drums` with its own four INSERT states (`ins[NPART..NPART+3]`) and the SLICER's drum path.
- **Mixing / second core** (`fx.c`): units are the synth parts (bits 0..2) and the drums (bit `NPART`); core 1's
  job argument packs the mask in 8 bits.
- **SLICER** (`slicer.c`): `sl_buf[NTRK][4096]` in the pool (8 KB a track).
- **Sequencer** (`seq.c`): MIDI channels: `G_CH1..G_CH3` for the parts, `G_DRCH` for the drums (settings of the
  FM-1 in `panel.c midi_set[]`); `midi_sel_on` keeps a nibble per channel and note (room for track + 1 <= 15);
  chord voice leading `vl_prev[NPART]`; `kh_set[NTRK]`, `mo_set[NTRK]`, `pc_req[NTRK]`.
- **Patterns**: one 64-step pattern per track inside `track_t` (`step_t`/`dstep_t` union, 10 B a step),
  `micro[64]`, `fill[16]` (2-bit conditions), `lock[24]` (4 B parameter locks, sparse).
- **Sections / song** (`arranger*.c`, `project.c`): a *section* A..D is a whole-project snapshot
  (`project_t`, fixed 3,816 B) in NOINIT and flash; the song is up to 16 (section, bars) entries; live
  sections, quick chain and SONG REC switch on the bar. `proj_apply` / `proj_capture` run inside the audio ISR
  for a song's section change and the song backup.
- **Project format 6** (`project.c`): fixed layout, 4 tracks, read-only converters from formats 1..5.
- **UI**: the TRACKS screen draws 4 columns of 60 px; the four track colours `UI_COL[4]` (indexed `& 3`);
  GLO keys 1..4 mute, 5..8 solo, knobs 1..4 the track levels; SAVE keys 1..4 / 5..8 play / store sections;
  ALGORITHM selects the track (clamped to 0..3 on the drum screen).
- **Web editor protocol** (`editor.c`): sends `NTRK` and bounds-checks track numbers against it; the drum track
  is `TRK_DRUM` (its level is `G_DRLVL`).

## 4. Design for eight tracks

The upgrade keeps every working engine and the timing core (the transport clock in `BEAT_U` units, one step a
block at most, nudges, ratchets) and changes what is per track:

1. **Eight tracks, each SYNTH or DRUM** (`track_t.kind`). `is_drum(t)` reads the kind; no index is special.
   The default project keeps the old layout on tracks 1..4 (three synths, drums on 4) and adds tracks 5..8
   (synths 5..7, a second drum track on 8) so that old projects open as they were.
2. **One voice budget across all synth tracks**: `NVOICE` (8) sounding synth voices shared by the eight tracks,
   with the existing priorities (released first, then extra UNISON voices, then held POLY voices that are not the
   bass). The drum voices stay a separate pool (`NDRUM`), now shared by every drum track with an owner per voice.
3. **Big engine state is lent, not multiplied.** The three engine arenas become a pool of `NARENA` (3) slots lent
   to the tracks that play GRAIN, DRAWBAR, FM6 or PHYS. At most three tracks can play those four engines at once;
   the UI refuses a fourth with a message. (Five more arenas would need 43 KB of pool; there are 2 KB.)
4. **SLICER STUT buffers are lent the same way**: four 8 KB buffers for at most four tracks in STUT mode; GATE needs
   no buffer and works on every track.
5. **Drum tracks** render their voices on a mono bus, then the SLICER, the INSERT and the FILTER, then LEVEL, PAN and
   the sends: one INSERT state per track instead of four for the drums.
6. **Patterns are stored compactly.** Each track plays one pattern (decoded in `track_t` as today); the other
   patterns of all eight tracks are kept encoded (a few bytes a step) in one shared RAM bank with a byte budget.
   A pattern change is quantized and done by the audio ISR on the boundary (a bounded encode + decode).
7. **Projects become variable-length** (format 7): a compact encoding of the eight tracks, their pattern banks, the
   step components, the parameter locks and the harmony state, inside the same 3,840-byte objects, slots and
   flash sectors as before. A save that does not fit is refused and named; nothing is truncated; old formats 1..6
   are converted on load (they always fit).
8. **The flash**: the new code must find room. `tools/build.py` already falls back to the text logo; a further,
   explicit fallback can alias the largest built-in sample sets onto others when the image still does not fit
   (reported by the build, never silent). This can only be checked with the JieLi toolchain.

New modules (all host-testable, no allocation, bounded loops):

| File | What |
| --- | --- |
| `comp.c` | step components: per-step rules, evaluated (`comp_eval`) apart from the scheduling (`seq.c seq_fire`) |
| `harmony.c` | the harmony: key, scale, chord, progression, per-track follow, applied to the sequencer's notes |
| `patbank.c`, `patcodec.c` | the pattern bank, quantized pattern changes and chains; the pattern codec (moved out of `project.c`) |
| `punch.c` (extended) | the performance layer over the punch-in effects: target, latch, quantized start |

## 5. Progress log

- Milestone A: baseline host suite passes (`HOST_ONLY=1`, 4 tests skipped for want of a firmware build);
  sizes measured with `tools/proxy_size.py`.
- Milestone B (eight tracks), as built:
  - `track_t.kind`; `is_drum()` reads it; `drum_focus()` / `DFOC` is the drum track the drum pages show (the selected
    one, else the first). The default layout: synths 1-3 and 5-7, drums 4 and 8 (`params.c TRK_DEF`, `pon_params`).
  - Drum tracks: one pool of `NDRUM` voices with an owner each (`drums.own`); kit, TUNE / DECAY, LEVEL / REV / DLY
    (in the track's `P_LEVEL`, `P_REV`, `P_DLY`, `params.c DRUM_MIX_DESC`), lane mutes and the hat choke per track.
    GLO > DRUMS edits the focused drum track. A drum track with its SLICER, INSERT or FILTER on renders on a mono bus.
  - Engine arenas: three, lent (`engines.c eng_arena_take / eng_arena_drop / eng_arena_lend`); ownership is two-way, so
    a stale entry frees itself; a track without an arena stays on core 0 (it may take one as it renders). A fourth big
    engine waits for a free arena (`tests/tracks8_test.c t_arena`).
  - STUT buffers: four, lent once a block on core 0 in track order (`slicer.c sl_lend`), never while rendering.
  - Render units: one per track, eight bits in core 1's job argument; core 1's default share is tracks 3, 4, 7, 8.
    Two races found by the extended split test and fixed: the drum voices' shared `active` scan, the drum synth's
    shared scratch (`ds_buf`, now on the stack).
  - MIDI: CH5..CH8 (`G_CH5..G_CH8`, GLO > MIDI 4), saved in an 8-byte tail of the settings' MIDI part that older
    firmware ignores; MIDI LEARN keeps a fourth track bit (`ml_hi`) there too.
  - Screens that list tracks (TRACKS, REC, the track meters, the GLO layer, the visualiser) show the bank of four the
    selected track is in; tracks 5-8 take the colours of 1-4.
  - Project format 7 (`project.c proj7_*`): typical eight-track projects take ~1.1 KB of the 3,840; four dense
    tracks 3.4 KB; eight dense tracks (6.4 KB) are refused whole (PROJECT FULL). Format 6 is still read and is the
    fallback when tracks 5..8 are as at power-on.
  - The golden renders: bit for bit the same when only tracks 1..4 render; with all eight, the three idle synth tracks
    5..7 tick their LFOs and an LFO wrap draws from the shared `rng()`, which shifts the random seeds of the PHYS
    string models: those 8 renders were re-recorded (`tests/golden.txt`), no other sound changed.
  - Not kept for eight tracks (documented limits): the web editor's LIVE page and its track list stay four-track
    (the protocol frame sizes are unchanged); the editor's FM6 / track commands accept tracks 1..8.
  - Proxy sizes against the baseline: RAM 59,094 -> 71,448 B (+12.4 KB of 96 KB: `trk` +8.6 KB, the INSERT states,
    FM6's per-track copies), pool +48 B, code +10.7 KB (format 7's codec ~6 KB of it).
- Milestone C (step components), the engine (`firmware/src/comp.c`, included by `seq.c`):
  - 14 types (`core.h CP_*`): PULSE, HOLD, MULT, VEL, RAMP+ / RAMP-, RAND, PORTA, BEND, TONE, JUMP, PARAM, COND, TRIG;
    a per-track play direction (FWD, REV, PEND, RAND) and a random seed. Sparse: `NCOMP` (16) per track, several on
    one step (of different types). The values and their ranges: `comp.c CP_RANGE`.
  - These are this firmware's own definitions, chosen to cover the usual groovebox step components (rhythm, melody,
    dynamics, sequence, conditions); where a reference instrument's exact behaviour could not be checked, the
    semantics here are the documented ones (`core.h`, `GUIDE`-style notes in `docs/groovebox-controls.md`).
  - Evaluation apart from scheduling: `comp_eval` turns a step's components, the track's component state and its own
    random numbers into a `cp_ev_t` (skip, repeats, jump, hits, velocity, semitones, scale degrees, bend, parameter
    values); `seq_fire` plays that. `comp_eval` starts no note and can be called on a track that does not play
    (`tests/comp_test.c t_eval`).
  - The playhead leaves the grid only with PULSE / HOLD / JUMP or a direction other than FWD (`comp_flow`,
    `comp_next`); every other track, and a track without those, plays `abs % len` as before. A track off the grid
    still records on the grid, and held notes are not extended into TIEs there (`rec_hold` is skipped).
  - Random numbers: each track's own xorshift (`cp_rng`), seeded from `cp_seed` and the track index at every PLAY;
    the shared `rng()` is not drawn (the render's draws and the golden renders stay the same: 182 / 182).
  - Moved notes are the notes started, so their note-offs are theirs (`seq_notes`); PARAM and PORTA go through the
    lock machinery (`lock_step_x`) and come back to their base like a lock; BEND is a per-track offset in 1/4096
    semitone (`cp_bend`, added in `voice.c` with the MIDI bend), 0 at the next step and at STOP.
  - Bounded work: at most `NCOMP` components looked at per step that fires, `NCPAR` (4) extra parameter values; no
    allocation; everything on core 0 in `events_block`.
  - Stored in format 7 at the end of each pattern (direction, seed, count, 4 bytes each). Format 6 has no room for
    them: the fallback is refused when any track has a component or a direction (`proj6_fits`), so nothing is lost
    silently. Damaged entries (unknown type, step past 64, value out of range, a second of a type) are dropped.
  - Tests: `tests/comp_test.c` (each type played, directions, seeds, drums, a 5-step track beside, a random edited
    session with stops: nothing left on, the stores and damage); the soak test now adds components at random.
  - Proxy sizes against Milestone B: code 277,588 -> 281,598 B (+4.0 KB), constants +138 B, RAM 71,448 -> 72,376 B.
- Milestone C, the UI: the step sheet's COMP row and strip (`ui.c comp_strip_*`), SEQ > PLAY (`SC_PATT`: DIR and
  SEED live in `track_t` beside `p[]`, so they are not sound parameters: no lock, no MIDI learn, not in user presets).
- Milestone D (parameter locks):
  - `NLOCK` 24 -> 32 a track; formats 5 and 6 keep their 24 (`NLOCK_V6`): format 6 capture packs the slots, and the
    fallback is refused when a track has more than 24 or a SLIDE (`proj6_fits`).
  - SLIDE: bit 7 of `plock_t.param` (`LOCK_SLIDE`; the parameter id is `& LOCK_PID`). The step's slides (at most
    `NSLIDE` = 4) are listed in `track_t.sl_*` and moved once a block on core 0 (`seq.c lock_slide_tick`, after the
    ratchets); a new step first puts the last step's slides at their values. Format 7 stores SLIDE in bit 7 of the
    lock's step byte (steps < 64).
  - No preset corruption: `trk_base(t, id)` is `p[id]` without the lock in force; project capture (formats 6 and 7,
    so also the autosave and the song backup) and the user preset save use it.
  - Capture: `lock_capture` (the step playing, the base kept in `lk_*`), from the UI's page and HOME knobs when
    MENU > SEQ > REC KNOBS is LOCKS (`panel.c rec_locks`, kept in byte 6 of the settings' eight-track tail).
  - The sheet's LOCKS row and strip (`ui.c lock_strip_*`); MOVE / COPY of a note take its components along with its
    locks; the web editor shows up to 32 locks on this firmware (`devNlock`).
  - Tests: `tests/lock_test.c`; UI cases in `tests/ui_pages_test.c`; the golden renders unchanged.
  - Proxy sizes against Milestone C's engine: code 281,598 -> 287,994 B (+6.4 KB with C's UI), RAM 72,376 ->
    73,948 B.
  - Flash risk: code has grown ~21 KB (proxy) since the baseline, whose image already filled the app slot. A target
    build is needed to know the real figure; `tools/build.py` must shed something (see Milestone H).
- Milestone E (patterns and arrangement):
  - `NPAT` (8) patterns a track. The one playing stays decoded in `track_t` (with its LEN); the others are encoded
    with the format 7 pattern codec (`patcodec.c`, moved out of `project.c` so the audio ISR can use it) in one
    3,072-byte RAM bank (`patbank.c pb_buf`): `[track << 4 | pattern][size][LEN][bytes]`, empty patterns not stored.
    3 KB is about what a project object can keep beside eight tracks' sounds and playing patterns.
  - Changes: `t->pat_req` (UI) is seen once a block (`pat_block`) and made in `seq_tick` on the step it falls on
    (`pat_due`: G_PATQ LOOP = the track's own loop start, or the first step at or after the next 1/2/4-bar line,
    computed per track from its DIV, so tracks asked together change on the same block). The change
    (`pat_swap`) restores the locks, encodes the pattern playing, releases its notes, decodes the new one and resets
    the components; the new pattern starts at step 1 because each track now keeps the grid step its pattern started
    on (`seq_org`; every `abs % len` became `(abs - seq_org) % len`, so tracks without a change play exactly as
    before). A pattern that does not fit refuses the change (`pb_full`, said by the UI); nothing is lost.
  - Chains (`pat_chain`, 2..8 patterns, one loop each); an asked change goes first and the chain goes on from it.
  - Cost (host): one change of a 32-step chord pattern 1.5 us, eight at once 12 us (`tests/pat_test.c`).
  - Storage: format 7 keeps each track's pattern playing and chain at the end of its 'T' chunk and every bank entry as
    a 'P' chunk (applied after a reset of the bank; a damaged entry, an unknown track or pattern, is dropped).
    Sections (song mode) are format 7 captures, so they carry their patterns. Format 6 is refused when any track has
    more than one pattern, a chain, or plays a pattern other than 1.
  - The song's loop region: the arranger's two reserved bytes (`arranger.h arr_loop_first / arr_loop_end`), set on
    the SONG screen (PRESETS / ALGORITHM), read at each entry boundary.
  - The PATTERNS screen (`ui_pats.c`, scope `SC_PATS`, a screen of its own between PLAY and SONG).
  - The firmware's libc has no `memmove`: the bank closes up with a byte loop (the proxy build caught it; the host
    tests link the system libc).
  - Tests: `tests/pat_test.c`; UI cases in `tests/ui_pages_test.c` and `tests/song_ui_test.c`; the soak test asks
    for pattern changes and chains at random. The soak's end check now shortens REL before waiting: a random preset's
    release (REL 110, ~10 s) outlasted the 5 s wait (the voices were released, not held).
  - Proxy sizes against Milestone D: code 287,994 -> 294,398 B (+6.4 KB), RAM 73,948 -> 77,268 B (+3.3 KB: the bank).
- Milestone F (harmony, `firmware/src/harmony.c`, included by `seq.c` after the pattern bank):
  - Globals `G_HKEY`, `G_HSCL`, `G_HQ`, `G_HPROG`; the progression (`harm.c[NHPROG]`, 8 chords, degree and bars) and
    the live chord (`harm.live`, from the CHORDS screen's keys: seq.c `key_down` with `kb_harm` set by the UI each
    frame, as `kb_grid` is for the drum grid); per track `t->hfol` (OFF / TRANS / SCALE).
  - `harm_block` (once a block, before the patterns and the tracks' steps) takes the key, scale and chord on their
    boundary (NOW / the next beat / the next bar; stopped: at once); the progression's chord comes from the bar count
    since PLAY. `harm_apply` maps the notes of the step's copy (`cp_step`, the same copy the step components use) at
    note-on, so the ratchets and the note-offs use the mapped notes (`seq_notes`). Bounded: a note is moved with at
    most 96 scale lookups. A track with FOLLOW OFF takes the same path as before (the golden renders unchanged).
  - Storage: the globals in 'G' (they also apply with a section: `g_of_section`), the progression in an 'H' chunk
    (written only when not the default), FOLLOW at the end of each 'T' chunk; format 6 is refused when any of them
    (or PAT Q) is not the default (format 6 has no byte for them).
  - UI: SCL > HARMONY (a global page), SCL > FOLLOW (`SC_PATT`, `PS_HFOL`), the CHORDS screen (`ui_pats.c`, `SC_HARM`).
  - Tests: `tests/harm_test.c` (the mapping alone, played, BEAT / BAR, a progression, a live chord, a note held across
    a change, ratchets and component notes, the keys untouched, the stores), UI cases in `tests/ui_pages_test.c`.
  - Proxy sizes against Milestone E: code 294,398 -> 299,066 B (+4.7 KB), RAM 77,268 -> 77,400 B.
- Performance effects (the punch-in FX extended in place, `punch.c` and `fx.c`):
  - LATCH (`G_PFXL`): `seq.c key_down` (the FX layer) and `midi_fx` toggle `punch.req` instead of holding it.
  - Q (`G_PFXQ`): `punch_quant` lets a new effect through only once the transport crossed a 1/16, 1/8, 1/4 or bar
    line since the last block (an end, or stopped: at once).
  - TARGET (`G_PFXT`): `mixacc_t` gained a second dry pair (`pl`, `pr`); `fx.c pfx_bus` (set before the units render,
    read by both cores) sends the targeted tracks' dry there instead of the mix (`mix_part`, `mix_drums`, the drum
    voices' direct path). The punch processes that bus, which is then added to the mix; with no target the path is
    the old one (the golden renders unchanged), and idle with a target the output is the same sum. The bus mask is
    latched when an effect starts (`punch_mask`). `.lowram` +512 B.
  - Tests: `tests/perf_test.c`; a TARGET scene in `tests/mix_split_test.c` (every split, ThreadSanitizer clean).
  - Proxy sizes against Milestone F: code 299,066 -> 299,472 B (+0.4 KB), RAM 77,400 -> 77,432 B.
- Milestone G (UI integration): every feature above has its controls on the FM-1 (`docs/groovebox-controls.md`):
  the step sheet's COMP and LOCKS strips, SEQ > PLAY, the PATTERNS screen, the SONG loop region, SCL > HARMONY /
  FOLLOW and the CHORDS screen, FX > PERF, MENU > SEQ > REC KNOBS, and now SAVE > TOOLS > KIND (a track synth <-> drum,
  `ui.c track_set_kind`). A fourth big engine is refused where engines are chosen (`engines.c eng_room`, in
  `set_engine_of` and `up_load_to`; said by the UI: `eng_refused`), instead of the track switching later with the new
  engine's values on the old engine; song mode's refusal (`song_full`) is said too. Messages kept within the UI's
  23 characters (`ui.msg`).
  - Proxy sizes against the performance FX: code 299,472 -> 300,286 B, RAM 77,432 -> 77,440 B.
