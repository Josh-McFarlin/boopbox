#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The TRAINER's lessons: for each level, the cards the coach shows, each with what it checks on the FM-1. The
targets (notes, drum lanes, locks, the song) come from the approved songs (tools/trainer/songs.py), so the song the
lessons build is the song that was approved.

  python3 tools/trainer/lessons.py OUT.h        (tools/build.py --trainer runs it; tests/trainer_test.c reads it)

A card is two lines on the screen: a headline (what this step is about, up to 23 characters after its number) and
an action (what to do, up to 30). The coach checks the card's goal on every frame; when it holds, the card is done.
Goals (TG_*, firmware/src/trainer.c): the track selected, a kit, a sound, a parameter (with a tolerance), a global, the
transport, a page, the octave, a synth pattern (notes, ties, accents, slides), drum lanes (hits, levels, ratchets),
the mutes, a lock, the pattern each track plays, a pattern stored, a section saved, the song, song mode."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import songs as S  # noqa: E402

HEAD_MAX, ACT_MAX = 23, 30
KITS = None                                     # filled in main(): the drum kits' names, as drums.c numbers them
ENGINE_ORDER = ["ANALOG", "DIGITAL", "PHASE", "LOFI", "SAMPLE", "VOICE", "TRIO", "WHEEL", "GRAIN", "FM6", "PHYS",
                "NOISE"]
# the factory sounds the lessons pick, as (engine, its index in that engine's table): read from the engines' sources
PRESETS = {}
BTN = {"FX": 0, "SEL": 1, "ENV": 2, "LFO": 3, "EDIT": 4, "GLO": 5, "HOME": 6, "SAVE": 7, "ARP": 8, "SEQ": 9,
       "PLAY": 10, "REC": 11, "OCT-": 12, "OCT+": 13}          # panel.c B_*


PAGES = []                                      # filled in main(): params.c PAGES, as (title, family), in order
VAL_MAX = 4                                     # "@": the value as the screen shows it, about this long (tests/trainer_test.c checks)


def page_index(title, fam):
    return PAGES.index((title, "FAM_" + fam))


class Card:
    def __init__(self, head, act, goal, trk=255, p=0, v=0, tol=0, flags=0, data=None, btn=None, keys=0):
        assert len(head) <= HEAD_MAX, f"headline too long ({len(head)}): {head}"
        shown = act.replace("@", "#" * VAL_MAX) if goal in ("TG_PARAM", "TG_GLOBAL") else act
        assert len(shown) <= ACT_MAX, f"action too long ({len(shown)}): {act}"
        assert head == head.upper() and act == act.upper(), (head, act)
        assert "@" not in act or goal in ("TG_PARAM", "TG_GLOBAL"), act
        self.head, self.act, self.goal, self.trk, self.p, self.v = head, act, goal, trk, p, v
        self.tol, self.flags, self.data, self.btn, self.keys = tol, flags, data, btn, keys


def key_list(steps):
    """"PRESS KEYS 1, 8 AND 11" for steps (1..16)"""
    n = [str(x) for x in steps]
    if len(n) == 1:
        return "PRESS KEY " + n[0]
    t = "PRESS KEYS " + ", ".join(n[:-1]) + " AND " + n[-1]
    return t if len(t) <= ACT_MAX else "PRESS KEYS " + " ".join(n) if len("PRESS KEYS " + " ".join(n)) <= ACT_MAX \
        else "PRESS THE BLINKING KEYS"


# the page each parameter's knob is on (the card's page: off it, the coach says which to open), and its knob
ON_PAGE = {"SLEN": ("TIMING", "SEQ"), "SDIV": ("TIMING", "SEQ"), "SSWING": ("TIMING", "SEQ"),
           "SGATE": ("TIMING", "SEQ"), "DIST": ("FX", "FX"), "CHOR": ("FX", "FX"), "DLY": ("FX", "FX"),
           "REV": ("FX", "FX"), "ATK": ("ENV", "ENV"), "DEC": ("ENV", "ENV"), "SUS": ("ENV", "ENV"),
           "REL": ("ENV", "ENV"), "DTIME": ("DLY", "FX"), "DFDBK": ("DLY", "FX"), "DUCK": ("MASTER", "GLO")}


class Level:
    def __init__(self, num, song, section, name, style, learn1, learn2):
        self.num, self.song, self.cards = num, song, []
        self.sec = song.sections[section]
        for x in (style, learn1, learn2):
            assert len(x) <= 28 and x == x.upper(), x
        assert len(name) <= 14
        self.name, self.style, self.learn1, self.learn2 = name, style, learn1, learn2

    def add(self, head, act, goal, **k):
        self.cards.append(Card(head, act, goal, **k))

    # --- goals
    def track(self, n, head):
        self.add(head, f"TURN ALGORITHM TO TRACK {n}", "TG_TRACK", trk=n - 1)

    def kit(self, n, head):
        self.add(head, "TURN PRESETS, FOLLOW THE DOTS", "TG_KIT", trk=n - 1, v=KITS.index(self.song.tracks[n].sound))

    def sound(self, n, head, name=None):
        e, i = PRESETS[name or self.song.tracks[n].sound]
        self.add(head, "TURN PRESETS, FOLLOW THE DOTS", "TG_SOUND", trk=n - 1, p=e, v=i)

    def param(self, n, pid, v, head, act, tol=0, btn=None, held=False):
        """held: the knob of a held button (SEQ, SEL) or HOME's: any page"""
        pg, b = ON_PAGE.get(pid, (None, None))
        data = None if held or pg is None else ("page", page_index(pg, b))
        self.add(head, act, "TG_PARAM", trk=n - 1, p=f"P_{pid}", v=v, tol=tol, btn=btn or (None if held else b),
                 data=data)

    def glob(self, gid, v, head, act, tol=0, btn=None, held=False):
        pg, b = ON_PAGE.get(gid, (None, None))
        data = None if held or pg is None else ("page", page_index(pg, b))
        self.add(head, act, "TG_GLOBAL", p=f"G_{gid}", v=v, tol=tol, btn=btn or (None if held else b), data=data)

    def play(self, on, head, act):
        self.add(head, act, "TG_PLAY", v=1 if on else 0, btn="PLAY")

    def page(self, title, fam, head, act, btn=None):
        self.add(head, act, "TG_PAGE", p=page_index(title, fam), btn=btn or fam)

    def timing(self, head):                           # the TIMING page, before its knobs
        self.page("TIMING", "SEQ", head, "TAP SEQ UNTIL YOU SEE TIMING")

    def octave(self, o, head, act):
        self.add(head, act, "TG_OCT", v=o, btn="OCT+" if o > 0 else "OCT-")

    def notes(self, n, head, act, how="NOTES", pat=None, upto=None, plain=False, ties=True):
        """the synth pattern of track n (this level's section, or pat): every step; upto: only steps before it (the
        rest empty); plain: accents and slides not asked yet; ties=False: each note one step (its LEN not asked yet)"""
        pat = pat or self.sec[n]
        steps = list(pat.steps) + [None] * (self.song.tracks[n].length - len(pat.steps))
        data = []
        for i, x in enumerate(steps):
            if upto is not None and i >= upto:
                x = None
            if x == "TIE" and not ties:
                x = None
            if isinstance(x, tuple) and plain:
                x = (x[0], 0, x[2])
            data.append(x)
        self.add(head, act, "TG_NOTES", trk=n - 1, flags=f"HOW_{how}", data=("notes", data))

    def lanes(self, n, head, act, lanes, pat=None, upto=None, levels=True):
        """drum lanes of track n: every hit (level and ratchet when levels) of the lanes named, the other lanes
        empty; upto: only the steps before it. act None: the keys of the last lane named (its first 16 steps)"""
        pat = pat or self.sec[n]
        L = []
        for name in lanes:
            hits = list(pat.lanes[name])
            if upto is not None:
                hits = [h if i < upto else None for i, h in enumerate(hits)]
            if not levels:
                hits = [None if h is None else (0, h[1]) for h in hits]
            L.append((S.LANES.index(name), hits))
        if act is None:
            act = key_list([i + 1 for i, h in enumerate(L[-1][1][:16]) if h])
        self.add(head, act, "TG_LANES", trk=n - 1, data=("lanes", self.song.tracks[n].length, L))

    def mutes(self, muted, head, act):
        """the tracks muted (the others heard), of the tracks this song uses with something in them"""
        care = sum(1 << (t - 1) for t in self.song.tracks if any(
            sec.get(t) is not None and (sec[t].steps and any(x for x in sec[t].steps) or sec[t].lanes)
            for sec in self.song.sections.values()))
        m = sum(1 << (t - 1) for t in muted) & care
        self.add(head, act, "TG_MUTES", p=care, v=m, btn="GLO")

    def lock(self, n, step, pid, v, slide, head, act, tol=2):
        self.add(head, act, "TG_LOCK", trk=n - 1, p=f"P_{pid}", v=v, tol=tol, flags=1 if slide else 0,
                 data=("step", step - 1))

    def patsel(self, n, pat, head, act, filled=False):
        self.add(head, act, "TG_PATSEL", trk=n - 1, v=pat - 1, flags=1 if filled else 0)

    def pats(self, per_track, head, act):
        """the pattern each track plays: {track: pattern 1..8}; the others any"""
        b = [255] * 8
        for t, p in per_track.items():
            b[t - 1] = p - 1
        self.add(head, act, "TG_PATS", data=("bytes", b))

    def pathas(self, tracks, pat, head, act):
        self.add(head, act, "TG_PATHAS", v=sum(1 << (t - 1) for t in tracks), p=pat - 1)

    def saved(self, slot, head, act):
        self.add(head, act, "TG_SAVED", v="ABCD".index(slot), btn="SAVE")

    def song_entries(self, entries, head, act, count_only=False):
        names = list(self.song.sections)
        b = [len(entries)] + ([] if count_only else [x for n, bars in entries for x in (names.index(n), bars)])
        self.add(head, act, "TG_SONG", flags=1 if count_only else 0, data=("bytes", b))

    def songmode(self, head, act):
        self.add(head, act, "TG_SONGMODE", btn="PLAY")

    def done(self, head, act):
        self.add(head, act, "TG_DONE")


# ---------------------------------------------------------------------------------------------------------------
PLAY_SEQ = "PLAY IT, THEN HOLD SEQ + STEP"           # the notes, one step at a time (the coach: which, which key)
PLAY_NOTES = "KNOB 1 TO A STEP, PLAY IT"        # the NOTES page


def level1():
    s = S.SONGS[0]
    L = Level(1, s, "LOOP", "FIRST LIGHT", "LO-FI HIP HOP, 86 BPM", "DRUMS, BASS, CHORDS, A HOOK",
              "STEPS, SOUNDS, FX, MUTES")
    L.track(4, "THE DRUMS: TRACK 4")
    L.kit(4, "DRUM KIT: LO-FI")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(4, "KICK: KNOB 1 TO KICK", None, ["KICK"])
    L.lanes(4, "SNARE: KNOB 1 TO SNARE", None, ["KICK", "SNARE"])
    L.lanes(4, "HATS: KNOB 1 TO HAT", None, ["KICK", "SNARE", "HAT"])
    L.play(True, "HEAR IT", "PRESS PLAY")
    L.glob("BPM", 86, "LAID BACK: 86 BPM", "TAP HOME, SELECT TO @", btn="HOME", held=True)
    L.param(4, "SSWING", 30, "SWING THE BEAT", "HOLD SEQ, TURN KNOB 3 TO @", tol=3, btn="SEQ", held=True)
    L.track(1, "THE BASS: TRACK 1")
    L.param(1, "ROOT", 9, "THE SONG IS IN A", "HOLD SEL, PRESS A LIT KEY", btn="SEL", held=True)
    L.param(1, "SCALE", 2, "A MINOR", "HOLD SEL, TURN KNOB 2 TO @", btn="SEL", held=True)
    L.param(1, "SDIV", 0, "ONE STEP A BEAT", "HOLD SEQ, TURN KNOB 2 TO @", btn="SEQ", held=True)
    L.notes(1, "THE BASS LINE", PLAY_SEQ, how="SEQ")
    L.timing("LONGER NOTES")
    L.param(1, "SGATE", 100, "LONGER NOTES", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.track(2, "THE CHORDS: TRACK 2")
    L.param(2, "CHORD", 2, "ONE KEY, ONE CHORD", "HOLD SEL, TURN KNOB 1 TO @", btn="SEL", held=True)
    L.param(2, "SDIV", 7, "ONE STEP A BAR", "HOLD SEQ, TURN KNOB 2 TO @", btn="SEQ", held=True)
    L.param(2, "SLEN", 4, "FOUR BARS, FOUR STEPS", "HOLD SEQ, KNOB 4 TO @", btn="SEQ", held=True)
    L.octave(-1, "AN OCTAVE DOWN", "PRESS OCT- ONCE")
    L.notes(2, "FOUR CHORDS", PLAY_SEQ, how="SEQ")
    L.timing("LET THEM RING")
    L.param(2, "SGATE", 120, "LET THEM RING", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(2, "REV", 40, "SOME ROOM", "TAP FX, TURN KNOB 4 TO @", tol=4)
    L.track(3, "THE HOOK: TRACK 3")
    L.sound(3, "A NEW SOUND: KALIMBA")
    L.param(3, "SDIV", 1, "EIGHTH NOTES", "HOLD SEQ, TURN KNOB 2 TO @", btn="SEQ", held=True)
    L.octave(1, "UP AN OCTAVE", "TAP OCT+ UNTIL OCTAVE IS +1")
    L.notes(3, "THE HOOK", PLAY_SEQ, how="SEQ")
    L.param(3, "SSWING", 30, "SWING IT TOO", "HOLD SEQ, TURN KNOB 3 TO @", tol=3, btn="SEQ", held=True)
    L.param(3, "DLY", 40, "AN ECHO", "TAP FX, TURN KNOB 3 TO @", tol=4)
    L.param(3, "REV", 30, "AND A ROOM", "TURN KNOB 4 (REV) TO @", tol=4)
    L.mutes({1, 4}, "PERFORM: THE INTRO", "HOLD GLO, TAP KEYS 1 AND 4")
    L.mutes({3}, "DRUMS AND BASS IN", "HOLD GLO, TAP KEYS 1, 3 AND 4")
    L.mutes(set(), "EVERYTHING", "HOLD GLO, TAP KEY 3")
    L.done("LEVEL 1 DONE!", "HOLD HOME FOR LEVEL 2")
    return L


def level2():
    s = S.SONGS[1]
    L = Level(2, s, "VERSE", "NEON AVENUE", "SYNTHWAVE, 104 BPM", "A VERSE AND A CHORUS",
              "NOTES PAGE, PATTERNS, ECHO")
    ch = s.sections["CHORUS"]
    L.glob("BPM", 104, "SYNTHWAVE AT 104", "TAP HOME, SELECT TO @", btn="HOME", held=True)
    L.param(1, "ROOT", 2, "THE SONG IS IN D", "HOLD SEL, PRESS A LIT KEY", btn="SEL", held=True)
    L.param(1, "SCALE", 2, "D MINOR", "HOLD SEL, TURN KNOB 2 TO @", btn="SEL", held=True)
    L.track(4, "THE DRUMS: TRACK 4")
    L.kit(4, "DRUM KIT: SYNTHWV")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(4, "FOUR ON THE FLOOR: KICK", None, ["KICK"])
    L.lanes(4, "SNARE, THEN CLAP", "THE SAME KEYS FOR BOTH", ["KICK", "SNARE", "CLAP"], levels=False)
    L.lanes(4, "HIT THE SNARE HARD", "KNOB 4 (LEVEL) TO HARD", ["KICK", "SNARE", "CLAP"])
    L.add("HATS ON THE OFFBEAT", key_list([i + 1 for i, h in enumerate(L.sec[4].lanes["HAT"])
                                            if h and h[0] == 0 and h[1] == 0]), "TG_LANES", trk=3,
          data=("lanes", 16, [(S.LANES.index(n), list(L.sec[4].lanes[n])) for n in ("KICK", "SNARE", "CLAP")] +
                [(S.LANES.index("HAT"), [h if h and h[0] == 0 and h[1] == 0 else None for h in L.sec[4].lanes["HAT"]])]))
    L.add("SOFT HATS: 1 5 9 13", "ADD THEM, KNOB 4 TO GHOST", "TG_LANES", trk=3,
          data=("lanes", 16, [(S.LANES.index(n), list(L.sec[4].lanes[n])) for n in ("KICK", "SNARE", "CLAP")] +
                [(S.LANES.index("HAT"), [h if h and h[1] == 0 else None for h in L.sec[4].lanes["HAT"]])]))
    L.lanes(4, "A ROLL ON STEP 16", "KNOB 2 TO STEP 16, HOLD OCT+", ["KICK", "SNARE", "CLAP", "HAT"])
    L.play(True, "HEAR IT", "PRESS PLAY")
    L.track(1, "THE BASS: TRACK 1")
    L.sound(1, "BASS SOUND: SAW BASS")
    L.timing("FOUR BARS OF EIGHTHS")
    L.param(1, "SLEN", 32, "32 STEPS LONG", "TURN KNOB 1 (LEN) TO @")
    L.param(1, "SDIV", 1, "EIGHTH NOTES", "TURN KNOB 2 (DIV) TO @")
    L.page("NOTES", "SEQ", "TYPE THE BASS LINE", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(1, "TYPE THE BASS LINE", PLAY_NOTES, plain=True)
    L.notes(1, "ACCENT THE LAST NOTE", "KNOB 4 TO ACC ON THAT STEP")
    L.timing("LONGER NOTES")
    L.param(1, "SGATE", 90, "LONGER NOTES", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.track(2, "THE PAD: TRACK 2")
    L.sound(2, "PAD SOUND: SAW PAD")
    L.timing("ONE STEP A BEAT")
    L.param(2, "SDIV", 0, "ONE STEP A BEAT", "TURN KNOB 2 (DIV) TO @")
    L.page("NOTES", "SEQ", "THREE-NOTE CHORDS", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(2, "THREE-NOTE CHORDS", "PRESS THE LIT KEYS TOGETHER", ties=False)
    L.notes(2, "A BAR EACH", "KNOB 3 (LEN) TO 4 ON EACH")
    L.timing("LET THEM RING")
    L.param(2, "SGATE", 120, "LET THEM RING", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(2, "REV", 50, "MORE ROOM", "TAP FX, TURN KNOB 4 TO @", tol=4)
    L.track(5, "TRACK 5: A PLUCK")
    L.sound(5, "PLUCK SOUND: FM PLUCK")
    L.page("NOTES", "SEQ", "THE PLUCK LINE", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(5, "THE PLUCK LINE", PLAY_NOTES)
    L.param(5, "DLY", 70, "ECHOES", "TAP FX, TURN KNOB 3 TO @", tol=4)
    L.param(5, "REV", 30, "A LITTLE ROOM", "TURN KNOB 4 (REV) TO @", tol=4)
    L.param(5, "PAN", -20, "TO THE LEFT", "ON HOME: KNOB 4 TO @", tol=3, btn="HOME", held=True)
    L.param(5, "LEVEL", 96, "A BIT QUIETER", "ON HOME: KNOB 2 TO @", tol=3, btn="HOME", held=True)
    L.page("DLY", "FX", "THE ECHO'S TIMING", "TAP FX UNTIL YOU SEE DLY")
    L.glob("DTIME", 6, "THE ECHO'S TIMING", "TURN KNOB 1 (TIME) TO @")
    L.glob("DFDBK", 55, "MORE ECHOES", "TURN KNOB 2 (FDBK) TO @", tol=4)
    L.page("PATTERNS", "SEQ", "THE CHORUS: PATTERNS", "TAP SEQ UNTIL PATTERNS")
    L.pathas([1, 2, 4, 5], 2, "COPY 1 2 4 5 TO PAT 2", "EACH: KNOB 1 TO 2, KNOB 4 X2")
    L.patsel(4, 2, "DRUMS: PLAY PATTERN 2", "TRACK 4: KNOB 1 TO 2, OCT+", filled=True)
    L.lanes(4, "OPEN HATS", "OFFBEAT HATS BECOME OPEN HATS", ["KICK", "SNARE", "CLAP", "HAT", "OHAT"], pat=ch[4])
    L.lanes(4, "A TOM AT THE END", "LOW TOM ON KEY 15, SOFT", ["KICK", "SNARE", "CLAP", "HAT", "OHAT", "LOTOM"],
            pat=ch[4])
    L.sound(3, "THE LEAD: PWM LEAD")
    L.patsel(3, 2, "ITS OWN PATTERN 2", "TRACK 3: KNOB 1 TO 2, OCT+")
    L.timing("FOUR BARS OF EIGHTHS")
    L.param(3, "SLEN", 32, "32 STEPS LONG", "TURN KNOB 1 (LEN) TO @")
    L.param(3, "SDIV", 1, "EIGHTH NOTES", "TURN KNOB 2 (DIV) TO @")
    L.page("NOTES", "SEQ", "THE HOOK", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(3, "THE HOOK", PLAY_NOTES, pat=ch[3], plain=True)
    L.notes(3, "ACCENTS", "EACH BAR'S FIRST NOTE: ACC", pat=ch[3])
    L.timing("SMOOTHER")
    L.param(3, "SGATE", 100, "SMOOTHER", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(3, "DLY", 45, "AN ECHO", "TAP FX, TURN KNOB 3 TO @", tol=4)
    L.param(3, "REV", 35, "A ROOM", "TURN KNOB 4 (REV) TO @", tol=4)
    L.page("PATTERNS", "SEQ", "VERSE AND CHORUS", "TAP SEQ UNTIL PATTERNS")
    L.pats({1: 1, 2: 1, 3: 1, 4: 1, 5: 1}, "BACK TO THE VERSE", "KNOB 1 TO 1, PRESS OCT-")
    L.play(True, "PLAY THE VERSE", "PRESS PLAY")
    L.pats({1: 2, 2: 2, 3: 2, 4: 2, 5: 2}, "INTO THE CHORUS", "KNOB 1 TO 2, PRESS OCT-")
    L.done("LEVEL 2 DONE!", "HOLD HOME FOR LEVEL 3")
    return L


def level3():
    s = S.SONGS[2]
    L = Level(3, s, "C", "LANTERNS", "MELODIC DUBSTEP, 150 BPM", "FOUR SECTIONS, ONE SONG",
              "LOCKS, ROLLS, SAVE, SONG")
    A, B, C, D = (s.sections[x] for x in "ABCD")
    L.glob("BPM", 150, "MELODIC DUBSTEP: 150", "TAP HOME, SELECT TO @", btn="HOME", held=True)
    L.param(1, "ROOT", 2, "THE SONG IS IN D", "HOLD SEL, PRESS A LIT KEY", btn="SEL", held=True)
    L.param(1, "SCALE", 2, "D MINOR", "HOLD SEL, TURN KNOB 2 TO @", btn="SEL", held=True)
    L.track(4, "THE DRUMS: TRACK 4")
    L.kit(4, "DRUM KIT: DUBSTEP")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(4, "HALF-TIME KICK", None, ["KICK"])
    L.lanes(4, "SNARE AND CLAP ON 9", "BOTH ON KEY 9", ["KICK", "SNARE", "CLAP"], levels=False)
    L.lanes(4, "HIT IT HARD", "KNOB 4 (LEVEL) TO HARD", ["KICK", "SNARE", "CLAP"])
    L.lanes(4, "OFFBEAT HATS", None, ["KICK", "SNARE", "CLAP", "HAT"])
    L.param(4, "LEVEL", 120, "DRUMS UP FRONT", "TAP HOME, KNOB 2 TO @", tol=3, btn="HOME", held=True)
    L.track(8, "TRACK 8: MORE DRUMS")
    L.kit(8, "DRUM KIT: DUBSTEP")
    L.param(8, "SLEN", 64, "FOUR BARS LONG", "HOLD SEQ, KNOB 4 TO @", btn="SEQ", held=True)
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(8, "A CRASH ON THE ONE", "KNOB 1 TO CRASH, PRESS KEY 1", ["CRASH"])
    L.track(2, "THE SUB: TRACK 2")
    L.sound(2, "SUB SOUND: SUB BASS")
    L.page("NOTES", "SEQ", "ONE LONG NOTE", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(2, "ONE LONG NOTE", "PRESS THE LIT KEY, LEN 16")
    L.timing("HELD THE WHOLE BAR")
    L.param(2, "SGATE", 127, "HELD THE WHOLE BAR", "TURN KNOB 4 (GATE) TO @", tol=2)
    L.param(2, "LEVEL", 112, "MORE SUB", "TAP HOME, KNOB 2 TO @", tol=3, btn="HOME", held=True)
    L.track(1, "THE CHORDS: TRACK 1")
    L.sound(1, "CHORD SOUND: WARM PAD")
    L.page("NOTES", "SEQ", "STABS", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(1, "STABS", "PRESS THE LIT KEYS TOGETHER", ties=False)
    L.notes(1, "SOME LONGER", "KNOB 3 (LEN) AS THE HINT SAYS")
    L.param(1, "ATK", 0, "SHARP STABS", "TAP ENV, KNOB 1 TO @")
    L.param(1, "REL", 12, "SHORT TAILS", "TURN KNOB 4 (REL) TO @", tol=2)
    L.timing("SHORTER")
    L.param(1, "SGATE", 45, "SHORTER", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(1, "LEVEL", 127, "FULL LEVEL", "TAP HOME, KNOB 2 TO @", btn="HOME", held=True)
    L.page("MASTER", "GLO", "THE PUMP", "TAP GLO UNTIL YOU SEE MASTER")
    L.glob("DUCK", 50, "THE PUMP", "TURN KNOB 2 (DUCK) TO @", tol=4)
    L.play(True, "HEAR THE DROP", "PRESS PLAY")
    L.track(6, "THE PIANO: TRACK 6")
    L.sound(6, "PIANO SOUND: GRAND PNO")
    L.timing("ONE BAR OF EIGHTHS")
    L.param(6, "SLEN", 8, "8 STEPS LONG", "TURN KNOB 1 (LEN) TO @")
    L.param(6, "SDIV", 1, "EIGHTH NOTES", "TURN KNOB 2 (DIV) TO @")
    L.page("NOTES", "SEQ", "TWO CHORDS", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(6, "TWO CHORDS", "PRESS THE LIT KEYS TOGETHER", ties=False)
    L.notes(6, "LET THEM RING", "KNOB 3 (LEN) AS THE HINT SAYS")
    L.timing("LONGER")
    L.param(6, "SGATE", 120, "LONGER", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(6, "REV", 65, "A BIG ROOM", "TAP FX, TURN KNOB 4 TO @", tol=4)
    L.param(6, "LEVEL", 98, "A BIT QUIETER", "TAP HOME, KNOB 2 TO @", tol=3, btn="HOME", held=True)
    L.track(5, "THE PAD: TRACK 5")
    L.sound(5, "PAD SOUND: WARM PAD")
    L.timing("ONE STEP, A BAR LONG")
    L.param(5, "SLEN", 1, "ONE STEP", "TURN KNOB 1 (LEN) TO @")
    L.param(5, "SDIV", 7, "A BAR LONG", "TURN KNOB 2 (DIV) TO @")
    L.page("NOTES", "SEQ", "ONE CHORD", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(5, "ONE CHORD", "PRESS THE LIT KEYS TOGETHER")
    L.timing("ALMOST THE WHOLE BAR")
    L.param(5, "SGATE", 110, "ALMOST THE WHOLE BAR", "TURN KNOB 4 (GATE) TO @", tol=4)
    L.param(5, "REV", 60, "ROOM", "TAP FX, TURN KNOB 4 TO @", tol=4)
    L.param(5, "REL", 50, "A SHORTER TAIL", "TAP ENV, TURN KNOB 4 TO @", tol=3)
    L.track(7, "THE RISER: TRACK 7")
    L.sound(7, "RISER SOUND: RISER")
    L.timing("FOUR BARS")
    L.param(7, "SLEN", 64, "64 STEPS LONG", "TURN KNOB 1 (LEN) TO @")
    L.page("NOTES", "SEQ", "RISE IN BARS 3 AND 4", "TAP SEQ UNTIL YOU SEE NOTES")
    L.notes(7, "RISE IN BARS 3 AND 4", "STEP 33: LIT KEY, LEN 32")
    L.timing("ALL THE WAY")
    L.param(7, "SGATE", 127, "ALL THE WAY", "TURN KNOB 4 (GATE) TO @", tol=2)
    L.param(7, "REV", 60, "ROOM", "TAP FX, TURN KNOB 4 TO @", tol=4)
    L.page("DLY", "FX", "THE ECHO'S TIMING", "TAP FX UNTIL YOU SEE DLY")
    L.glob("DTIME", 6, "THE ECHO'S TIMING", "TURN KNOB 1 (TIME) TO @")
    L.glob("DFDBK", 50, "FEEDBACK", "TURN KNOB 2 (FDBK) TO @", tol=4)
    # patterns for the other sections
    L.page("PATTERNS", "SEQ", "PATTERNS FOR SECTIONS", "TAP SEQ UNTIL PATTERNS")
    L.patsel(4, 2, "THE BUILD'S BEAT", "TRACK 4: KNOB 1 TO 2, OCT+")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(4, "KICK ON EVERY BEAT", None, ["KICK"], pat=B[4])
    L.page("PATTERNS", "SEQ", "THE BREAK'S BEAT", "TAP SEQ UNTIL PATTERNS")
    L.patsel(4, 3, "THE BREAK'S BEAT", "TRACK 4: KNOB 1 TO 3, OCT+")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    L.lanes(4, "JUST THE HATS", None, ["HAT"], pat=D[4])
    L.page("PATTERNS", "SEQ", "THE BUILD'S ROLL", "TAP SEQ UNTIL PATTERNS")
    L.patsel(8, 2, "THE BUILD'S ROLL", "TRACK 8: KNOB 1 TO 2, OCT+")
    L.page("DRUMS", "TRK", "THE DRUM GRID", "TAP SEQ TO OPEN THE DRUMS", btn="SEQ")
    roll = B[8]
    L.lanes(8, "BAR 1: SNARE ON BEATS", None, ["SNARE"], pat=roll, upto=16)
    L.lanes(8, "BAR 2: EIGHTHS", "TAP OCT+: STEPS 17-32", ["SNARE"], pat=roll, upto=32)
    L.lanes(8, "BAR 3: SIXTEENTHS", "OCT+: STEPS 33-48, EVERY KEY", ["SNARE"], pat=roll, upto=48)
    L.add("BAR 4: EVERY STEP", "OCT+: STEPS 49-64, EVERY KEY", "TG_LANES", trk=7,
          data=("lanes", 64, [(S.LANES.index("SNARE"), [None if h is None else (h[0], 0) for h in roll.lanes["SNARE"]])]))
    L.lanes(8, "FASTER: RATCHETS", "KNOB 2 TO A STEP, HOLD OCT+", ["SNARE"], pat=roll)
    L.page("PATTERNS", "SEQ", "THE BUILD'S PAD", "TAP SEQ UNTIL PATTERNS")
    L.patsel(5, 2, "THE BUILD'S PAD", "TRACK 5: COPY TO 2, THEN OCT+", filled=True)
    L.page("NOTES", "SEQ", "A LOCK ON STEP 1", "TAP SEQ UNTIL YOU SEE NOTES")
    L.lock(5, 1, "TFLT", 30, False, "OPEN THE FILTER", "ADD A FILT LOCK TO STEP 1")
    L.lock(5, 1, "TFLT", 30, True, "OVER THE WHOLE BAR", "IN ITS LOCK: KNOB 3 TO SLIDE")
    # the sections: the patterns and the mutes of each, saved
    L.play(False, "STOP TO SAVE", "PRESS PLAY TO STOP")
    L.page("PATTERNS", "SEQ", "SECTION C: THE DROP", "TAP SEQ UNTIL PATTERNS")
    L.pats({4: 1, 5: 1, 8: 1}, "SECTION C: THE DROP", "TRACKS 4, 5, 8 ON PATTERN 1")
    L.mutes(C["_mute"], "MUTE FOR THE DROP", "HOLD GLO: MUTE TRACKS 5 6 7")
    L.saved("C", "SAVE IT AS C", "HOLD SAVE, PRESS KEY 7")
    L.pats({4: 2, 5: 2, 8: 2}, "SECTION B: THE BUILD", "TRACKS 4, 5, 8 ON PATTERN 2")
    L.mutes(B["_mute"], "MUTE FOR THE BUILD", "HOLD GLO: MUTE ONLY 1 AND 2")
    L.saved("B", "SAVE IT AS B", "HOLD SAVE, PRESS KEY 6")
    L.pats({4: 3, 5: 1}, "SECTION D: THE BREAK", "TRACK 4 ON 3, TRACK 5 ON 1")
    L.mutes(D["_mute"], "MUTE FOR THE BREAK", "HOLD GLO: MUTE 1, 6, 7 AND 8")
    L.saved("D", "SAVE IT AS D", "HOLD SAVE, PRESS KEY 8")
    L.mutes(set(A["_mute"]) | {4}, "SECTION A: THE INTRO", "HOLD GLO: ONLY THE PIANO ON")
    L.saved("A", "SAVE IT AS A", "HOLD SAVE, PRESS KEY 5")
    L.page("SONG", "SEQ", "THE SONG", "TAP HOME, THEN TAP SAVE", btn="SAVE")
    L.song_entries(s.song, "SEVEN PARTS", "TURN KNOB 4 TO 7 STEPS", count_only=True)
    L.song_entries(s.song, "A4 B4 C8 D8 B4 C8 A4", "KNOB 1 STEP, 2 PART, 3 BARS")
    L.songmode("PLAY THE SONG", "OCT-: SONG MODE, THEN PLAY")
    L.done("LEVEL 3 DONE!", "SAVE + KEYS 1-4: PLAY SECTIONS")
    return L


# ---------------------------------------------------------------------------------------------------------------
def presets_from_sources(root):
    """factory sounds: engine index and preset index, read from the engines' preset tables and the samples header"""
    import re
    src = os.path.join(root, "firmware", "src")
    files = {"ANALOG": "eng_analog.c", "DIGITAL": "eng_digital.c", "PHASE": "eng_phase.c", "LOFI": "eng_lofi.c",
             "VOICE": "eng_formant.c", "TRIO": "eng_trio.c", "WHEEL": "eng_drawbar.c", "GRAIN": "eng_grain.c",
             "FM6": "eng_fm6.c", "PHYS": "eng_phys.c", "NOISE": "eng_noise.c"}
    out = {}
    for e, f in files.items():
        text = open(os.path.join(src, f)).read()
        m = re.search(r"static const preset_t \w+_PRESETS\[\] = \{(.*?)\n\};", text, re.S)
        body, i = m.group(1), 0
        active = [True]
        for line in body.splitlines():                  # (#if FELUCCA_TRAINER: the trainer's view of the table)
            ls = line.strip()
            if ls.startswith("#if"):
                cond = "!FELUCCA_TRAINER" not in ls       # (#if FELUCCA_TRAINER: on; #if !FELUCCA_TRAINER: off)
                active.append(cond if "FELUCCA_TRAINER" in ls else active[-1])
                continue
            if ls.startswith("#else"):
                active[-1] = not active[-1]
                continue
            if ls.startswith("#endif"):
                active.pop()
                continue
            if not all(active):
                continue
            for name in re.findall(r'^\s*\{"([^"]+)"', line):
                out[name] = (ENGINE_ORDER.index(e), i)
                i += 1
    return out


def c_data(levels):
    blob, offs = [], {}
    for L in levels:
        for c in L.cards:
            if c.data is None:
                c.off = 0
                continue
            kind = c.data[0]
            if kind == "page":
                c.off = 1 + c.data[1]
                continue
            b = []
            if kind == "notes":
                steps = c.data[1]
                b.append(len(steps))
                for x in steps:
                    if x is None:
                        b.append(0)
                    elif x == "TIE":
                        b.append(2)
                    else:
                        notes, flags, lvl = x
                        b += [1 | (flags & 3) << 2, len(notes)] + list(notes)
            elif kind == "lanes":
                _, length, lanes = c.data
                b += [length, len(lanes)]
                for lane, hits in lanes:
                    hits = list(hits) + [None] * (length - len(hits))
                    b.append(lane)
                    for h in hits[:length]:
                        b.append(0 if h is None else 0x10 | h[0] | h[1] << 2)
            elif kind == "bytes":
                b += c.data[1]
            elif kind == "step":
                b.append(c.data[1])
            key = tuple(b)
            if key not in offs:
                offs[key] = len(blob)
                blob += b
            c.off = offs[key]
    return blob


def main(out):
    global KITS
    root = os.path.dirname(os.path.dirname(HERE))
    kits_h = os.path.join(os.path.dirname(out), "felucca_drumkits.h")
    line = [l for l in open(kits_h).read().splitlines() if l.startswith("#define DS_KIT_NAME_LIST")][0]
    KITS = ["ACOUSTIC", "DEEP", "TIGHT", "BRIGHT", "DUST"] + [x.strip().strip('"') for x in line.split(" ", 2)[2].split(",")]
    PRESETS.update(presets_from_sources(root))
    import re
    params = open(os.path.join(root, "firmware", "src", "params.c")).read()
    body = params[params.index("static const page_t PAGES[] = {"):]
    body = body[:body.index("\n};")]
    PAGES.extend(re.findall(r'^\s*\{"([^"]+)", (FAM_\w+),', body, re.M))
    os.environ.setdefault("FELUCCA_TRAINER", "1")
    PRESETS["GRAND PNO"] = (4, "SMP_PRESET_GRAND_PNO")      # (the samples header numbers the SAMPLE presets)
    levels = [level1(), level2(), level3()]
    blob = c_data(levels)
    L = ["/* generated by tools/trainer/lessons.py from tools/trainer/songs.py: the TRAINER's lessons */", "#pragma once", ""]
    L.append(f"static const uint8_t TR_DATA[{max(1, len(blob))}] = {{")
    for i in range(0, len(blob), 24):
        L.append("    " + ", ".join(str(x) for x in blob[i:i + 24]) + ",")
    L.append("};")
    for lv in levels:
        L.append(f"static const tr_card_t TR_L{lv.num}[] = {{")
        for c in lv.cards:
            btn = f"B_{c.btn.replace('-', 'DN').replace('+', 'UP')}" if c.btn and c.btn.startswith("OCT") else \
                  f"B_{'SCL' if c.btn == 'SEL' else c.btn}" if c.btn else "NB"
            L.append(f'    {{"{c.head}", "{c.act}", {c.goal}, {c.trk}, {c.p}, {btn}, {c.v}, {c.tol}, {c.flags}, '
                     f'{c.off}}},')
        L.append("};")
    L.append("static const tr_level_t TR_LEVELS[] = {")
    for lv in levels:
        L.append(f'    {{"{lv.name}", "{lv.style}", "{lv.learn1}", "{lv.learn2}", TR_L{lv.num}, {len(lv.cards)}}},')
    L.append("};")
    L.append(f"#define TR_NLEVELS {len(levels)}")
    # what each level's song sets, for the tests (tests/trainer_test.c): (level, track or 255 for a global, id, value)
    chk = []
    for lv in levels:
        s = lv.song
        chk.append((lv.num, 255, "G_BPM", s.bpm))
        for k, v in s.g.items():
            chk.append((lv.num, 255, f"G_{k}", v))
        for t in s.tracks.values():
            k = t.num - 1
            if not any(sec.get(t.num) is not None and (any(x for x in sec[t.num].steps) or sec[t.num].lanes)
                       for sec in s.sections.values()):
                continue                                 # (a track with nothing to play: its settings change nothing)
            chk += [(lv.num, k, "P_SLEN", t.length), (lv.num, k, "P_SDIV", S.DIVS.index(t.div))]
            if t.sound not in KITS:
                chk.append((lv.num, k, "P_SGATE", t.gate))
            if t.level is not None:
                chk.append((lv.num, k, "P_LEVEL", t.level))
            for pn, v in t.p.items():
                chk.append((lv.num, k, f"P_{pn}", v))
    L.append("#ifdef TR_WANT_CHECK")
    L.append("static const struct { uint8_t lvl, trk, id; int16_t v; } TR_CHECK[] = {")
    L += [f"    {{{a}, {b}, {c}, {d}}}," for a, b, c, d in chk]
    L.append("};")
    L.append("#endif")
    open(out, "w").write("\n".join(L) + "\n")
    print(f"trainer: {', '.join(str(len(l.cards)) for l in levels)} cards, {len(blob)} B of targets -> {out}")


if __name__ == "__main__":
    main(sys.argv[1])
