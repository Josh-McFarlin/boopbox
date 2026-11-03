#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Render the trainer's songs (tools/trainer/songs.py) with the firmware's own sequencer, engines, mixer and song
mode on the host, to build/trainer/<n>-<title>.wav (and .mp3 with ffmpeg): what the FM-1 plays, for approval.

  python3 tools/trainer/render.py            (needs build/gen: tests/run_tests.sh or tools/build.py generate)

Each song's sections are captured as the FM-1's sections A-D are (proj_capture), and its song is played in song mode
(the arranger), as SAVE > SONG plays it. A loop-only song (level 1) is played as its performance: the loop with the
tracks muted and unmuted bar by bar, a section each."""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import songs as S  # noqa: E402

OUT = os.path.join(ROOT, "build", "trainer")


def c_song(si, song):
    L = []
    w = L.append
    w(f"static void song_{si}(FILE *f, FILE *log)\n{{")
    w(f"    reset({song.bpm});")
    w(f"    song.g[G_SWING] = {song.swing};")
    for k, v in song.g.items():
        w(f"    song.g[G_{k}] = {v};")
    key = S.NOTE_PC[song.key[0]] + (1 if song.key[1:] == "#" else -1 if song.key[1:] == "b" else 0)
    scl = S.SCALES.index(song.scale)
    w(f"    song.g[G_HKEY] = {key % 12}; song.g[G_HSCL] = {scl};")
    if song.prog:
        w(f"    harm.n = {len(song.prog)}; song.g[G_HPROG] = 1; song.g[G_HQ] = HQ_BAR;")
        for i, (deg, bars) in enumerate(song.prog):
            w(f"    harm.c[{i}].deg = {deg - 1}; harm.c[{i}].bars = {bars};")
    for t in song.tracks.values():
        k = t.num - 1
        if t.sound in KITS:
            w(f'    kit({k}, "{t.sound}");')
        else:
            w(f'    synth({k}, "{t.sound}");')
            w(f"    trk[{k}].p[P_ROOT] = {key % 12}; trk[{k}].p[P_SCALE] = {scl};")
            w(f"    trk[{k}].hfol = HF_{t.follow};")
        w(f"    trk[{k}].p[P_SLEN] = {t.length}; trk[{k}].p[P_SDIV] = {S.DIVS.index(t.div)};"
          f" trk[{k}].p[P_SGATE] = {t.gate};")
        if t.level is not None:
            w(f"    trk[{k}].p[P_LEVEL] = {t.level};")
        for pn, v in t.p.items():
            w(f"    trk[{k}].p[P_{pn}] = {v};")
    for ni, (name, sec) in enumerate(song.sections.items()):
        w(f"    /* section {name} */")
        for t in song.tracks.values():
            k = t.num - 1
            pat = sec.get(t.num, S.Pattern())
            w(f"    steps_clear(&trk[{k}]); trk[{k}].p[P_MUTE] = {1 if t.num in sec['_mute'] else 0};")
            w(f"    trk[{k}].cp_dir = DIR_{pat.direction}; trk[{k}].cp_seed = {pat.seed};")
            if t.sound in KITS:
                for lane, hits in pat.lanes.items():
                    li = S.LANES.index(lane)
                    for st, h in enumerate(hits):
                        if h:
                            w(f"    dstep_set(&trk[{k}].dstep[{st}], {li}, {h[0]}, {h[1]});")
            else:
                steps = pat.steps
                for st, s in enumerate(steps):
                    if s is None:
                        continue
                    if s == "TIE":
                        w(f"    tie({k}, {st});")
                        continue
                    notes, flags, lvl = s
                    ns = ", ".join(str(n) for n in notes + [0] * (4 - len(notes)))
                    w(f"    note({k}, {st}, {flags}, {lvl}, {len(notes)}, {ns});")
            for st, p, v, sl in pat.locks:
                w(f"    lk({k}, {st - 1}, P_{p}, {v}, {sl});")
            for st, ty, a, b in pat.comps:
                w(f"    cp({k}, {st - 1}, CP_{ty}, {a}, {b});")
            for st, fc in pat.fills:
                w(f"    fillc({k}, {st - 1}, FC_{fc});")
        w(f"    check_capture({ni});")
    names = list(song.sections)
    entries = [(names.index(n), b) for n, b in song.song]
    w(f"    arr_defaults(&arrangement); arrangement.count = {len(entries)};")
    for i, (sc, b) in enumerate(entries):
        w(f"    arrangement.entry[{i}] = (arr_entry_t){{{sc}, {b}}};")
    total = sum(b for _, b in entries)
    w(f"    play(f, log, {total});")
    w("}")
    return "\n".join(L)


KITS = set()


def main():
    os.makedirs(OUT, exist_ok=True)
    kits = open(os.path.join(ROOT, "build", "gen", "felucca_drumkits.h")).read()
    line = [l for l in kits.splitlines() if l.startswith("#define DS_KIT_NAME_LIST")][0]
    KITS.update(x.strip().strip('"') for x in line.split(" ", 2)[2].split(","))
    KITS.update(["ACOUSTIC", "DEEP", "TIGHT", "BRIGHT", "DUST"])
    body = [open(os.path.join(HERE, "render_main.c")).read()]
    order = []
    for si, song in enumerate(S.SONGS):
        if song.performance and not song.song:      # a loop song: the loop, muted bar by bar, a section each
            base = list(song.sections.values())[0]
            song.sections = {f"P{i}": dict(base, _mute=m) for i, (b, m) in enumerate(song.performance)}
            song.song = [(f"P{i}", b) for i, (b, m) in enumerate(song.performance)]
        body.append(c_song(si, song))
        order.append((si, song))
    body.append("int main(void)\n{\n    FILE *f, *log = stdout;")
    for si, song in order:
        fn = os.path.join(OUT, f"{song.level}-{song.title.lower().replace(' ', '-')}.wav")
        body.append(f'    f = fopen("{fn}", "wb"); printf("== {song.title}\\n"); song_{si}(f, log); fclose(f);')
    body.append("    return fails;\n}")
    src = os.path.join(OUT, "render_songs.c")
    open(src, "w").write("\n".join(body) + "\n")
    exe = os.path.join(OUT, "render_songs")
    cc = ["cc", "-O2", "-w", "-I" + os.path.join(ROOT, "build", "gen"), "-I" + os.path.join(ROOT, "firmware", "src"),
          "-I" + os.path.join(ROOT, "firmware", "hal"), "-I" + os.path.join(ROOT, "tests"), "-o", exe, src, "-lm"]
    subprocess.check_call(cc)
    r = subprocess.call([exe])
    for si, song in order:
        fn = os.path.join(OUT, f"{song.level}-{song.title.lower().replace(' ', '-')}")
        subprocess.call(["ffmpeg", "-loglevel", "error", "-y", "-i", fn + ".wav", "-codec:a", "libmp3lame", "-b:a",
                         "192k", fn + ".mp3"])
    sys.exit(r)


if __name__ == "__main__":
    main()
