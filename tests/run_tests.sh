#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
# Host tests (no hardware). Run from the repo root after ./build.sh:
#   tests/run_tests.sh
#
# Regression suite (tests/regress.c, tests/target_budget.py; details at the top of regress.c):
#   golden renders  every engine x preset, the drum kit, voice modes, FX sends, a 4-track mix: one hash
#                   each in tests/golden.txt. A change of the sound fails with the list of renders.
#   health          clipping, DC, peak level, voices free after the release, silence at the end.
#   CPU             cost / sample per preset and mix, relative to the idle + drums mix (tests/cpu_baseline.txt,
#                   +25 %; counted by the kernel or under callgrind, else timed at +35 %), ns printed;
#                   target: loop instructions of the render functions in build/felucca.dis
#                   (tests/target_budget.txt, +10 %; exact, static).
#   voices          the budget of 8, steal fades, MONO / LEGATO / UNISON keep their note, the VOICE cap,
#                   no hanging notes on any MIDI / key routing.
# FM6 (tests/fm6_test.c): the 6-operator FM engine (firmware/src/eng_fm6.c, fm6_core.c, fm6_bank.c): the 32
#                   algorithms' carriers, the operator envelopes ending the voice, retrigger, DC / clipping, the
#                   eight macros, the patch formats (packed, SysEx), the 6-voice cap, the patch bank on a
#                   simulated NOR; demos in build/fm6_demo/.
# After an intended change of the sound: GOLDEN_UPDATE=1 sh tests/run_tests.sh, review the diff
# of tests/golden.txt, commit it with the change. After an intended change of the cost (or a new
# compiler): BUDGET_UPDATE=1 (rewrites cpu_baseline.txt and target_budget.txt). VERBOSE=1: every render.
#
# The tests run in parallel: each is a job (its compile and its run) in the background, at most TEST_JOBS at once
# (default: the number of CPUs; TEST_JOBS=1 runs one at a time). A job's output is kept in build/host/logs/ and
# printed whole, in the order below, with its time; the longest jobs start first. The CPU budget is counted
# (callgrind, the kernel), so the load of the other jobs does not change it; only a timed fallback gets noisier,
# and it only warns.
set -e
export AC79_SDK="${AC79_SDK:-$HOME/fw-AC79_AIoT_SDK}"
cd "$(dirname "$0")/.."
OUT=build/host
mkdir -p "$OUT"
CC="${CC:-cc} -O1 -Wall -Wno-unused-function"
fail=0
T_START=$(date +%s)

# ---- the jobs ----
TEST_JOBS=${TEST_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}
[ "$TEST_JOBS" -ge 1 ] 2>/dev/null || TEST_JOBS=1
LOGS=$OUT/logs
rm -rf "$LOGS"
mkdir -p "$LOGS"
njob=0 nshown=0 running="" failed=""
# show: the logs of the jobs done, in order, up to the first still running
show() {
    while [ $nshown -lt $njob ]; do
        i=$(printf %03d $((nshown + 1)))
        [ -f "$LOGS/$i.rc" ] || break
        read -r rc secs < "$LOGS/$i.rc"
        if [ -f "$LOGS/$i.name" ]; then
            echo "== $(cat "$LOGS/$i.name")  [${secs} s]"
            [ "$rc" = 0 ] || { fail=1; failed="$failed$i "; }
        fi
        cat "$LOGS/$i.log"
        nshown=$((nshown + 1))
    done
}
# slot: wait until fewer than TEST_JOBS jobs run (MAX=n: fewer than n)
slot() {
    while :; do
        n=0 still=""
        for i in $running; do
            [ -f "$LOGS/$i.rc" ] || { n=$((n + 1)); still="$still $i"; }
        done
        running=$still
        show
        [ $n -ge "${1:-$TEST_JOBS}" ] || return 0
        sleep 0.2 2>/dev/null || sleep 1
    done
}
# run NAME CMD [ARGS...]: a job (CMD may be a function below); its exit status != 0 fails the run
run() {
    slot
    njob=$((njob + 1)); id=$(printf %03d $njob)
    printf '%s\n' "$1" > "$LOGS/$id.name"; shift
    (
        set +e
        t0=$(date +%s)
        "$@" > "$LOGS/$id.log" 2>&1 < /dev/null
        echo "$? $(( $(date +%s) - t0 ))" > "$LOGS/$id.rc.tmp" && mv "$LOGS/$id.rc.tmp" "$LOGS/$id.rc"
    ) &
    running="$running $id"
}
# note TEXT: a line in the output, in its place among the jobs'
note() {
    njob=$((njob + 1)); id=$(printf %03d $njob)
    printf '%s\n' "$1" > "$LOGS/$id.log"; echo "0 0" > "$LOGS/$id.rc"
}
# cc_run BIN 'FLAGS' SRC [ARGS...]: compile SRC into $OUT/BIN ($CC FLAGS ... -lm), then run it with ARGS
cc_run() {
    b=$1 f=$2 s=$3; shift 3
    $CC $f -o "$OUT/$b" "$s" -lm && "$OUT/$b" "$@"
}
G="-O2 -w -Ibuild/gen -Ifirmware/src"
GH="$G -Ifirmware/hal"

# HOST_ONLY=1: without the JieLi toolchain (no build/felucca.fwsc), the tests that read the firmware package or its
# disassembly (M-UPGRADE entry, update loader, target cost, the site in Chromium) are skipped and named; all others run
skip() { note "== SKIPPED (HOST_ONLY, no firmware build): $1"; skipped=$((skipped + 1)); }
skipped=0
if [ ! -f build/felucca.fwsc ]; then
    [ -n "$HOST_ONLY" ] || { echo "run ./build.sh first (or HOST_ONLY=1 for the tests that need no firmware build)"; exit 1; }
    NOFW=1
    # the generated headers a firmware build would have made (fonts, tables, samples, kits): no toolchain needed
    [ -f build/gen/felucca_samples.h ] || python3 -c "import sys; sys.path.insert(0, 'tools'); import build; build.generate()" ||
        { echo "generating build/gen failed"; exit 1; }
fi
# the generated headers the FM6 engine needs (tools/build.py generate() makes them too; no Pillow needed)
mkdir -p build/gen
[ build/gen/felucca_tables.h -nt tools/gen_tables.py ] || python3 tools/gen_tables.py build/gen/felucca_tables.h
[ build/gen/felucca_fm6.h -nt tools/gen_fm6_patches.py ] || python3 tools/gen_fm6_patches.py build/gen/felucca_fm6.h
[ build/gen/felucca_obv.h -nt tools/gen_obv.py ] || python3 tools/gen_obv.py build/gen/felucca_obv.h
# the TRAINER's own generated headers (tools/build.py --trainer): three sample sets fewer, the lessons
TGEN=build/trainer-fw/gen
if [ ! -f "$TGEN/trainer_lessons.h" ] || [ "$TGEN/trainer_lessons.h" -ot tools/trainer/lessons.py ] ||
   [ "$TGEN/trainer_lessons.h" -ot tools/trainer/songs.py ]; then
    FELUCCA_TRAINER=1 python3 -c "import sys; sys.path.insert(0, 'tools'); import build; build.GEN = build.SRC / '$TGEN'; build.generate()" >/dev/null ||
        { echo "generating $TGEN failed"; fail=1; }
fi
# regress before any job: the regression job and tests/cpu1_modes.sh both run it
$CC -O2 -w -Ibuild/gen -Ifirmware/src -o "$OUT/regress" tests/regress.c -lm

# ---- the longest jobs first ----
# the CPU budget: counted by the kernel on macOS; elsewhere under callgrind when valgrind is there (exact;
# SKIP_CPU_VALGRIND=1 to time instead, which is only a rough check)
CPU_VALGRIND=""
if [ -z "$SKIP_CPU_VALGRIND" ] && command -v valgrind >/dev/null 2>&1; then CPU_VALGRIND=1; fi
run "regression: golden renders, health, voices, CPU budget" \
    env CPU_VALGRIND="$CPU_VALGRIND" "$OUT/regress" tests/golden.txt tests/cpu_baseline.txt
REGRESS_JOB=$id
# the render split over the two cores (fx.c mix_units): the golden renders and tests/mix_split_test.c (three
# FORMANT, FM6 or PHYS parts, S&H LFOs, mutes, the drums through the SLICER and the FILTER, the metronome: every
# split of the units against none) under every mode of the host double of core 1, and under ThreadSanitizer.
# After GOLDEN_UPDATE / BUDGET_UPDATE it waits for the regression job's new files
cpu1_modes() {
    if [ -n "$GOLDEN_UPDATE$BUDGET_UPDATE" ]; then
        while [ ! -f "$LOGS/$REGRESS_JOB.rc" ]; do sleep 1; done
    fi
    sh tests/cpu1_modes.sh
}
run "the render split over the two cores: every mode of the second core's host double (tests/cpu1_modes.sh)" cpu1_modes
# the web pages (Node.js) with the firmware's project format for the web editor's codec (web/test_web.mjs: gen,
# load and capture again)
web() {
    $CC -w -Ibuild/gen -Ifirmware/src -o "$OUT/proj7_tool" tests/proj7_tool.c -lm && node web/test_web.mjs
}
if command -v node >/dev/null 2>&1; then
    run "web pages: editor protocol, samples, packages, update protocol" web
fi
run "the editor protocol and the other inputs (USB / TRS MIDI, damaged flash) fuzzed under ASan + UBSan, and its reproducers" \
    sh tests/editor_fuzz.sh "${EDFZ_N:-2000}" 1

# ---- the others ----
run "flash storage (A/B, torn writes)" cc_run storage_test "" tests/storage_test.c
run "application USB recovery and boot-loop guard" cc_run recovery_test "" tests/recovery_test.c
run "song order, timing, repeats and missing scenes" cc_run arranger_test "" tests/arranger_test.c
run "song: four simultaneous tracks, scene transition and stop" cc_run song_audio_test "$G" tests/song_audio_test.c "$OUT/song-demo.wav"
run "song screen: commands, load (OCT+ twice), display bounds" cc_run song_ui_test "$G" tests/song_ui_test.c "$OUT/song-screen.ppm"
run "song screen: a confirmation left unconfirmed asks again weeks later (no load / replace on one press)" \
    cc_run song_arm_test "$G" tests/song_arm_test.c

run "drum lanes, kit audio, metronome, record arm, free take" cc_run studio_drums_test "$G" tests/studio_drums_test.c "$OUT/drum-styles.wav"
run "sequencer 2.0: no drift, ratchets, roll, erase / undo, ghost / hard, chords, mute / solo, nudge, locks" \
    cc_run seq2_test "$G" tests/seq2_test.c
run "2.8.3: a note held under others (live, recorded, overdubbed), MIDI in overflow" cc_run hold_rec_test "$G" tests/hold_rec_test.c
run "2.8.3: SEQ > NOTES, LEN under later notes, MONO / STEP FULL, shorter, delete" cc_run len_test "$GH" tests/len_test.c
run "visualiser with some styles built in (FELUCCA_VIS_STYLES): opened, SELECT, each draws" \
    cc_run vis_styles_test "$GH" tests/vis_styles_test.c "$OUT"
run "2.8.3: drum voices on a busy beat, every kit: no kick cut by another sound" cc_run drum_steal_test "$G" tests/drum_steal_test.c
run "2.8.3: a sample played again starts from silence with its ATK (POLY same note, MONO, LEGATO, UNISON), no click" \
    cc_run chop_attack_test "$G" tests/chop_attack_test.c
run "SLOOP Pro #4: a note fading out keeps 16-bit resolution (DAC, MASTER 2048, USB FULL, 808 SLIDE): no 16 LSB floor" \
    cc_run fade_noise_test "$G" tests/fade_noise_test.c
run "every page, HOME, REC READY: a knob turned alone changes one value (sloop-pro #6: REC READY K3 not K2 too)" \
    cc_run knob_walk_test "$GH" tests/knob_walk_test.c "$OUT"

run "synthesised drum kits: every kit x sound bounded, audible, finite, levels, cost" \
    cc_run drumkit_test "$G" tests/drumkit_test.c "$OUT/drum-kits.wav" "$OUT/drum-kits.txt"
run "user drum kits (KIT USR1..USR3): a user slot's sounds on the drum lanes" cc_run userkit_test "$GH" tests/userkit_test.c
run "SYN1..SYN4 drum kits and the editor's DRUM SYNTH commands (v10)" cc_run dsyn_test "$G" tests/dsyn_test.c
run "the screen font at 1 bit a pixel: every glyph, the same pixels as 2.5" cc_run font_test "$G" tests/font_test.c
run "punch-in FX: 27 effects (11 on the black keys), bounded, dry after release, FX-held keys" \
    cc_run punch_test "$G" tests/punch_test.c "$OUT/punch-fx.wav"
run "after Felucca 1.4 / 1.5: INSERT, filter TYPE, ENV SYNC, LFO 2, drum mutes, MIDI LEARN" cc_run fx251_test "$G" tests/fx251_test.c

run "live UI: pages, layers (punch, steps, erase, roll, key, mix), holds, drums, REC, fuzz" \
    cc_run ui_pages_test "$GH" tests/ui_pages_test.c "$OUT"

# the TRAINER (tools/build.py --trainer): every level played from the menu to DONE with the panel alone, the songs'
# settings, the progress kept, level 3's song (tests/trainer_test.c). With Node.js, the web page's songs
# (webapp/song/: web/songgen.js), each played as level 4 by the trainer test (TR_SONGS): four written scores (one a
# whole song: sections, patterns, song mode); with the trainer's renders (python3 tools/trainer/render.py), the three
# songs as the page hears them, whole (web/songanalyze.js and Basic Pitch: the tempo, the key, the sections and the
# song, level 1's beat). Then the song page in Chromium (an MP3 of level 1 in, the tempo, the key, both players, the
# package with the song), on the site in docs/ (web/make_site.py ... --trainer), skipped without Playwright or the
# renders; and level 4 on the way to the FM-1: a trainer package with a song written in (web/trslot.js,
# tools/trainer/slot.py) is the package the build makes with that song, the browser and slot.py byte for byte
trainer() {
    tf=0
    mkdir -p "$OUT/trainer"
    $CC -O2 -w -I$TGEN -Ifirmware/src -Ifirmware/hal -Itests -o "$OUT/trainer_test" tests/trainer_test.c -lm || return 1
    TR_SONGS=""
    if command -v node >/dev/null; then
        python3 tools/trainer/consts.py "$OUT/trainer/consts.json" >/dev/null || tf=1
        PW=""; [ -f build/preview/boopbox-preview.wasm ] && PW=build/preview/boopbox-preview.wasm
        echo "-- TRAINER song page: scores to songs for level 4, the FM-1 player (web/songgen.js, web/songplay.js)"
        PREVIEW_WASM=$PW node tests/trainer_song_test.mjs "$OUT/trainer/consts.json" "$OUT/trainer/songs" > "$OUT/trainer/songs.log" || tf=1
        grep -v '^SONGS=' "$OUT/trainer/songs.log"
        TR_SONGS=$(sed -n 's/^SONGS=//p' "$OUT/trainer/songs.log")
        if [ -f build/trainer/1-first-light.wav ] && [ -f build/trainer/2-neon-avenue.wav ]; then
            echo "-- TRAINER song page: the three songs, whole, as the page hears them (Basic Pitch on the CPU: a few minutes)"
            node tests/trainer_analyze_test.mjs "$OUT/trainer/consts.json" "$OUT/trainer/heard" build/trainer/1-first-light.wav \
                build/trainer/2-neon-avenue.wav build/trainer/3-lanterns-cinematic-dm-one-chord.wav 2>/dev/null |
                grep -v '^SONGS=' | grep -v '^$' > "$OUT/trainer/heard.log" || tf=1
            cat "$OUT/trainer/heard.log"
            grep -q '^analyze: PASS' "$OUT/trainer/heard.log" || tf=1
            TR_SONGS="$TR_SONGS:$(ls "$OUT"/trainer/heard/heard-*.bin | tr '\n' ':')"
        else
            echo "(skipped: the page's listening test needs the trainer's renders: python3 tools/trainer/render.py)"
        fi
    fi
    echo "-- TRAINER: the three levels, a song in the song area and the web page's songs (level 4)"
    env TR_SONGS="$TR_SONGS" "$OUT/trainer_test" "$OUT/trainer" || tf=1
    if [ -f docs/webapp/song/index.html ] && [ -f build/trainer/1-first-light.mp3 ] && command -v node >/dev/null; then
        echo "-- TRAINER song page in Chromium: listen, compare, the package to install"
        node tests/trainer_page_test.mjs docs build/trainer/1-first-light.mp3 "$OUT/trainer" || tf=1
    fi
    if [ -f build/trainer-fw/felucca-trainer.fwsc ] && command -v node >/dev/null; then
        echo "-- TRAINER song area: web/trslot.js and slot.py write the package the build would make"
        python3 tests/trainer_slot_test.py build/trainer-fw "$OUT/trainer" || tf=1
    else
        echo "(skipped: the trainer song area test needs ./build.sh --trainer and Node.js)"
    fi
    return $tf
}
run "TRAINER: the three levels, a song in the song area and the web page's songs (level 4) played to DONE with the panel alone" trainer

# no divide by 0 (the FM-1 runs with the div0 trap off, hal/fm1_irq.h: a real one would give a wrong value
# silently): the UI fuzz, the sequencer, the projects and a minute of random live use, with UBSan
UBSAN="${CC_UB:-cc} -O1 -w -fsanitize=integer-divide-by-zero -fno-sanitize-recover=integer-divide-by-zero -Ibuild/gen -Ifirmware/src -Ifirmware/hal"
no_div0() {
    $UBSAN -o "$OUT/ui_pages_ub" tests/ui_pages_test.c -lm && $UBSAN -o "$OUT/seq2_ub" tests/seq2_test.c -lm &&
        $UBSAN -o "$OUT/project_ub" tests/project_test.c -lm && $UBSAN -o "$OUT/soak_ub" tests/soak_test.c -lm &&
        $UBSAN -o "$OUT/comp_ub" tests/comp_test.c -lm && $UBSAN -o "$OUT/lock_ub" tests/lock_test.c -lm &&
        $UBSAN -o "$OUT/pat_ub" tests/pat_test.c -lm && $UBSAN -o "$OUT/harm_ub" tests/harm_test.c -lm &&
        $UBSAN -o "$OUT/perf_ub" tests/perf_test.c -lm || return 1
    mkdir -p "$OUT/ub"
    "$OUT/ui_pages_ub" "$OUT/ub" >/dev/null && "$OUT/seq2_ub" >/dev/null && "$OUT/project_ub" >/dev/null &&
        "$OUT/comp_ub" >/dev/null && "$OUT/lock_ub" >/dev/null && "$OUT/pat_ub" >/dev/null && "$OUT/harm_ub" >/dev/null &&
        "$OUT/perf_ub" >/dev/null && "$OUT/soak_ub" 1 >/dev/null && echo 'no divide by zero'
}
run "no divide by zero (UBSan): UI fuzz, sequencer, projects, step components, locks, patterns, harmony, performance FX, a minute of live use" \
    no_div0

# the second core's host double (tests/cpu1_host.c, firmware/src/cpu1.h): inline, a thread, a slow thread, a lost
# job; and the thread under ThreadSanitizer (the render's shared state shows up here once it uses core 1)
cpu1() {
    cf=0
    $CC -w -Ifirmware/src -o "$OUT/cpu1_test" tests/cpu1_test.c || return 1
    echo "-- inline, deferred to the wait (CORES=1)"; env CORES=1 "$OUT/cpu1_test" || cf=1
    echo "-- a thread (CORES=2)"; env CORES=2 "$OUT/cpu1_test" || cf=1
    echo "-- a thread with random delays (CORES=2 CHAOS=7)"; env CORES=2 CHAOS=7 "$OUT/cpu1_test" || cf=1
    echo "-- a lost job, the hold and the fallback (CPU1_TIMEOUT_AT=777)"; env CORES=2 CPU1_TIMEOUT_AT=777 "$OUT/cpu1_test" || cf=1
    TSAN="${CC_UB:-cc} -O1 -g -w -fsanitize=thread -Ifirmware/src"
    if $TSAN -o "$OUT/cpu1_tsan" tests/cpu1_test.c 2>/dev/null; then
        echo "-- under ThreadSanitizer (CORES=2 CHAOS=3)"; env CORES=2 CHAOS=3 "$OUT/cpu1_tsan" || cf=1
    else
        echo "(cpu1 under TSan: this compiler has no ThreadSanitizer, skipped)"
    fi
    return $cf
}
run "second core, host double: inline, a thread, random delays, a lost job; under ThreadSanitizer" cpu1

run "soak: ${SOAK_MIN:-10} minutes of random live use (bounded, no hanging voices, idle after stop)" \
    cc_run soak_test "$G" tests/soak_test.c "${SOAK_MIN:-10}"
run "stress (2.4): FONT_L = FONT_S at 2x, hard random use of every 2.4 addition, clean stop" \
    cc_run stress_test "$GH" tests/stress_test.c "${STRESS_FRAMES:-40000}"
# the same under AddressSanitizer + UBSan: any read or write out of bounds stops it (left shifts of negative values
# and the FM6 phase's wrap-around are left out: the DSP's two's complement idioms, as every compiler builds them)
ASAN="${CC_UB:-cc} -O1 -g -w -fsanitize=address,undefined -fno-sanitize=shift-base,signed-integer-overflow -fno-sanitize-recover=all -Ibuild/gen -Ifirmware/src -Ifirmware/hal"
stress_asan() {
    if $ASAN -o "$OUT/stress_asan" tests/stress_test.c -lm 2>/dev/null; then
        "$OUT/stress_asan" "${STRESS_ASAN_FRAMES:-15000}" 7
    else
        echo "(stress under ASan: this compiler has no AddressSanitizer, skipped)"
    fi
}
run "stress under ASan + UBSan (no access out of bounds)" stress_asan

run "user presets (UP_PUT parser, bank round trip, versions)" cc_run upreset_test "" tests/upreset_test.c
run "TRS MIDI parser" cc_run midi_uart_test "" tests/midi_uart_test.c
run "knobs: one click = one step (slow, fast, pauses, bounce)" cc_run encoder_test "-Ifirmware/hal" tests/encoder_test.c
# USB audio input (tests/uac_test.c): the descriptors (with CDC, without, CDC built in with the menu's USB SERIAL OFF,
# USB RATE 44.1 / 48 (2.7), a build without 48 kHz (SLOOP 2.4)), the ring and the packets
HALF=$(sed -n 's/^#define HALF_FRAMES \([0-9]*\).*/\1/p' firmware/src/core.h)
uac() {
    uf=0
    $CC -DT_CDC=1 -DHALF_FRAMES=$HALF -o "$OUT/uac_test" tests/uac_test.c -lm &&
        $CC -DT_CDC=0 -DHALF_FRAMES=$HALF -o "$OUT/uac_test_nocdc" tests/uac_test.c -lm &&
        $CC -DT_CDC=2 -DHALF_FRAMES=$HALF -o "$OUT/uac_test_seroff" tests/uac_test.c -lm &&
        $CC -DT_CDC=2 -DT_RATE=1 -DHALF_FRAMES=$HALF -o "$OUT/uac_test_441" tests/uac_test.c -lm &&
        $CC -DT_CDC=1 -DT_RATE=2 -DHALF_FRAMES=$HALF -o "$OUT/uac_test_48" tests/uac_test.c -lm &&
        $CC -w -DT_CDC=0 -DFELUCCA_UAC_48K=0 -DHALF_FRAMES=$HALF -o "$OUT/uac_test_no48" tests/uac_test.c -lm || return 1
    echo "-- descriptors (with CDC), ring and packets"; "$OUT/uac_test" || uf=1
    echo "-- descriptors (without CDC), ring and packets"; "$OUT/uac_test_nocdc" || uf=1
    echo "-- descriptors (CDC built in, menu USB SERIAL OFF), ring and packets"; "$OUT/uac_test_seroff" || uf=1
    echo "-- USB SERIAL OFF: the descriptors of a build without CDC, byte for byte"
    [ "$(UAC_DUMP=1 "$OUT/uac_test_seroff" | tail -n 2)" = "$(UAC_DUMP=1 "$OUT/uac_test_nocdc" | tail -n 2)" ] && echo same || uf=1
    echo "-- menu USB RATE 44.1 (2.7): descriptors, ring and packets"; "$OUT/uac_test_441" || uf=1
    echo "-- menu USB RATE 48 (2.7): descriptors, ring and packets"; "$OUT/uac_test_48" || uf=1
    echo "-- USB RATE 44.1: the descriptors of a build without 48 kHz (SLOOP 2.4), byte for byte"
    [ "$(UAC_DUMP=1 "$OUT/uac_test_441" | tail -n 2)" = "$(UAC_DUMP=1 "$OUT/uac_test_no48" | tail -n 2)" ] && echo same || uf=1
    return $uf
}
run "USB audio input: descriptors (with / without CDC, USB SERIAL OFF, USB RATE 44.1 / 48, no 48 kHz), ring and packets" uac
uac_in_app() { ${CC%% *} -E -Ibuild/gen -Ifirmware/hal -Ifirmware/src firmware/src/felucca.c 2>/dev/null | grep -q uac_service; }
run "USB audio input: built into the firmware (FELUCCA_UAC set before usb.c)" uac_in_app
# (1.7) the USB MIDI host (usb_host.c, from Melodee) against its model of the SIE, a keyboard, hubs and a stick
usb_host() {
    cc -O1 -g -fsanitize=address,undefined -DHALF_FRAMES=$HALF -Ifirmware/hal -Ifirmware/src -Ibuild/gen \
        -o "$OUT/usb_host_test" tests/usb_host_test.c && "$OUT/usb_host_test"
}
run "USB MIDI host: enumeration (direct, hubs, a hub on a hub), events, the filter, back-pressure, unplug, recovery" usb_host

if [ -z "$NOFW" ]; then
run "M-UPGRADE entry" cc_run ota_test "" tests/ota_test.c build/felucca.fwsc
ldr() {
    head -c 200000 build/felucca.bin > "$OUT/old_app.bin" &&
        python3 tools/fm1pkg_make.py "$OUT/old_app.bin" build/loader/ota.bin "$OUT/old.fwsc" >/dev/null &&
        cc_run ldr_test "" tests/ldr_test.c "$OUT/old.fwsc" build/felucca.fwsc
}
run "update loader: other app -> this build" ldr
else
skip "M-UPGRADE entry"; skip "update loader: other app -> this build"
fi

hostsim() {
    $CC -O2 -w -Ibuild/gen -Ifirmware/src -o "$OUT/hostsim" tests/hostsim.c -lm || return 1
    "$OUT/hostsim" 0 0 1 "$OUT/render.wav" || return 1
    mkdir -p build/tracks_demo
    echo "-- TRACKS: 4-track pattern (of eight), live recording (lengths, swing), voice budget, engine switch, cost"
    env TRACKS=build/tracks_demo "$OUT/hostsim" 0 0 1 "$OUT/tracks.wav"
}
run "DSP render (ANALOG preset 0); TRACKS: 4-track pattern, live recording, voice budget, engine switch, cost" hostsim
run "scales: white-key mapping and note lifecycle" cc_run scale_test "$G" tests/scale_test.c
run "eight tracks: all at once on their own lengths, the shared voice budget, two drum tracks, kinds, arenas, STUT, MIDI CH5..8" \
    cc_run tracks8_test "-DARENA_STATS $GH" tests/tracks8_test.c
run "step components: each type, directions, seeds, drums, other lengths beside, nothing hanging, stores, damage" \
    cc_run comp_test "$GH" tests/comp_test.c
run "parameter display: TIME, LFO Hz, CUTOFF and dB computed, every value as the tables showed it" \
    cc_run display_test "$GH" tests/display_test.c
run "key velocity: the scan's sampling, the map, the 2.2 ms bound, drums no wait, calibration, pressure; OFF as before" \
    cc_run keyvel_test "-O1 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal" tests/keyvel_test.c
run "key velocity in the sequencer: synth and drum keys, held-back presses, aftertouch (keys, MIDI), FILTER / VIBRATO" \
    cc_run keyvel_seq_test "$GH" tests/keyvel_seq_test.c
emu() {
    cc_run emu_test "-O1 -w -Ibuild/gen -Ifirmware/src" tests/emu_test.c "$OUT" || return 1
    if command -v node >/dev/null && command -v clang >/dev/null && command -v wasm-ld >/dev/null; then
        python3 tools/build_emu.py >/dev/null && node tests/emu_wasm_test.mjs
    else
        echo "emu wasm: no clang / wasm-ld / node: the WebAssembly build not checked"
    fi
}
run "browser emulator: powers on, keys sound and light, pages, knobs, PLAY, MASTER, the flash kept across a power-on; its wasm" emu
nrpn() {
    cc_run nrpn_test "$GH" tests/nrpn_test.c || return 1
    "$OUT/nrpn_test" --write "$OUT/NRPN.md" && cmp -s "$OUT/NRPN.md" docs/NRPN.md ||
        { echo "docs/NRPN.md differs from the firmware: $OUT/nrpn_test --write docs/NRPN.md"; return 1; }
}
run "NRPN: track parameters by CC99/98, 14-bit CC6/38, selection kept and ended, drums, engines; docs/NRPN.md current" nrpn
run "parameter locks: several a step, 32 a track, every engine, SLIDE, capture, saves keep the track's values" \
    cc_run lock_test "$GH" tests/lock_test.c
run "patterns: 8 a track, quantized changes (loop, bars), chains, the bank full, stores, sections, the song's loop region" \
    cc_run pat_test "$GH" tests/pat_test.c
run "harmony: key, scale, chords (TRANS, SCALE), quantized changes, a progression, live chords, note-offs, stores" \
    cc_run harm_test "$GH" tests/harm_test.c
run "performance FX: LATCH (keys, MIDI), Q (1/16 .. bar), TARGET (master, drums, synths, the selected track)" \
    cc_run perf_test "$GH" tests/perf_test.c
run "project format: FUN7 (eight tracks) round trips, damage, too big refused whole; SLOOP's FUN1..FUN6 not read" \
    cc_run project_test "-w -Ibuild/gen -Ifirmware/src" tests/project_test.c
run "engine arenas: no stale state, no engine on another's arena, a random session (lent to the tracks)" \
    cc_run arena_test "-O1 -w -DARENA_STATS -Ibuild/gen -Ifirmware/src" tests/arena_test.c
mkdir -p build/slicer_demo build/fm6_demo
run "SLICER: no clicks, timing, sync with the sequencer, STUT, cost, demos" cc_run slicer_test "$G" tests/slicer_test.c build/slicer_demo
run "FM6: algorithms, envelopes, retrigger, DC, clipping, macros, patch formats, voices, the bank, demos" \
    cc_run fm6_test "$G" tests/fm6_test.c build/fm6_demo
run "NOISE LFSR: the clock follows the keys past the sample rate (NZ ARCADE, clipper-fm1 #10)" \
    cc_run noise_clock_test "$GH" tests/noise_clock_test.c
run "SAMPLE, GRAIN: the pitch follows the keys to the top of the keyboard (up to the decode bound)" \
    cc_run sample_pitch_test "$GH" tests/sample_pitch_test.c
run "GRAIN: a note played in the release of the one before is not starved of grains" \
    cc_run grain_release_test "$GH" tests/grain_release_test.c
run "PHYS: every pitched preset in tune (+-5 cents; a curved bridge +-20), notes 28..100" \
    cc_run phys_tune_test "$GH" tests/phys_tune_test.c
run "UNISON: every engine spreads its voices' phases (no stack of voices in phase over POLY)" \
    cc_run unison_level_test "$GH" tests/unison_level_test.c
# SLICE (tests/slice_test.c) needs a FELUCCA_SLICE=1 build; the engine is not built by default

if [ -z "$NOFW" ]; then
run "regression: target cost of the render loops" python3 tests/target_budget.py \
    build/felucca.dis tests/target_budget.txt
else
skip "regression: target cost of the render loops"
fi

run "installer CLI (fm1_install.py) against a simulated FM-1" python3 tests/install_test.py
run "the offline editor (one file, nothing next to it); the offline site (sw.js, manifest)" python3 tests/site_test.py

if command -v node >/dev/null 2>&1; then
    if [ -z "$NOFW" ]; then
    pwa() {
        rm -rf "$OUT/pwa-site" && python3 web/make_site.py build/felucca.fwsc 2.7 "$OUT/pwa-site" >/dev/null &&
            node tests/pwa_test.mjs "$OUT/pwa-site"
    }
    run "the site without internet in Chromium (skipped without Playwright)" pwa
    else
    skip "the site without internet in Chromium"
    fi
else
    note "== skip web tests (no node)"
fi

# the browser audio preview (web editor): the same engines in WASM as on the host, when it is built
# (python3 tools/build_preview.py: Emscripten, or clang + wasm-ld)
if [ -f build/preview/boopbox-preview.wasm ]; then
    run "the editor's audio preview: WASM == host, all 12 engines" sh tests/run_preview_tests.sh
fi

slot 1
wait
show
[ $skipped -eq 0 ] || echo "($skipped tests skipped: no firmware build)"
for i in $failed; do echo "FAILED: $(cat "$LOGS/$i.name") (build/host/logs/$i.log)"; done
echo "($njob jobs, $TEST_JOBS at once: $(( $(date +%s) - T_START )) s)"
[ $fail -eq 0 ] && echo "ALL HOST TESTS PASSED" || { echo "HOST TESTS FAILED"; exit 1; }
