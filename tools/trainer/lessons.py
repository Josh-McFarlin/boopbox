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


class Card:
    def __init__(self, head, act, goal, trk=255, p=0, v=0, tol=0, flags=0, data=None, btn=None, keys=0):
        assert len(head) <= HEAD_MAX, f"headline too long ({len(head)}): {head}"
        assert len(act) <= ACT_MAX, f"action too long ({len(act)}): {act}"
        assert head == head.upper() and act == act.upper(), (head, act)
        self.head, self.act, self.goal, self.trk, self.p, self.v = head, act, goal, trk, p, v
        self.tol, self.flags, self.data, self.btn, self.keys = tol, flags, data, btn, keys


class Level:
    def __init__(self, num, song, section):
        self.num, self.song, self.cards = num, song, []
        self.sec = song.sections[section]

    def add(self, head, act, goal, **k):
        self.cards.append(Card(head, act, goal, **k))

    # --- goals
    def track(self, n, head, act):
        self.add(head, act, "TG_TRACK", trk=n - 1)

    def kit(self, n, head, act):
        self.add(head, act, "TG_KIT", trk=n - 1, v=KITS.index(self.song.tracks[n].sound))

    def sound(self, n, head, act, name=None):
        e, i = PRESETS[name or self.song.tracks[n].sound]
        self.add(head, act, "TG_SOUND", trk=n - 1, p=e, v=i)

    def param(self, n, pid, v, head, act, tol=0, btn=None):
        self.add(head, act, "TG_PARAM", trk=n - 1, p=f"P_{pid}", v=v, tol=tol, btn=btn)

    def glob(self, gid, v, head, act, tol=0, btn=None):
        self.add(head, act, "TG_GLOBAL", p=f"G_{gid}", v=v, tol=tol, btn=btn)

    def play(self, on, head, act):
        self.add(head, act, "TG_PLAY", v=1 if on else 0, btn="PLAY")

    def page(self, name, head, act, btn=None):
        self.add(head, act, "TG_PAGE", p={"DRUMS": "PG_DRUMS", "PATTERNS": "PG_PATTERNS", "SONG": "PG_SONG"}[name],
                 btn=btn)

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
        empty; upto: only the steps before it"""
        pat = pat or self.sec[n]
        L = []
        for name in lanes:
            hits = list(pat.lanes[name])
            if upto is not None:
                hits = [h if i < upto else None for i, h in enumerate(hits)]
            if not levels:
                hits = [None if h is None else (0, h[1]) for h in hits]
            L.append((S.LANES.index(name), hits))
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
def level1():
    s = S.SONGS[0]
    L = Level(1, s, "LOOP")
    L.track(4, "THE DRUMS: TRACK 4", "TURN ALGORITHM TO TRACK 4")
    L.kit(4, "PICK A DRUM KIT", "TURN PRESETS TO LO-FI")
    L.page("DRUMS", "THE DRUM GRID", "TAP SEQ: THE DRUMS SCREEN", btn="SEQ")
    L.lanes(4, "THE KICK", "KNOB 1: KICK. PRESS LIT KEYS", ["KICK"])
    L.lanes(4, "SNARE ON 2 AND 4", "KNOB 1: SNARE. PRESS LIT KEYS", ["KICK", "SNARE"])
    L.lanes(4, "HATS ON THE EIGHTHS", "KNOB 1: HAT. PRESS LIT KEYS", ["KICK", "SNARE", "HAT"])
    L.play(True, "HEAR IT", "PRESS PLAY")
    L.glob("BPM", 86, "LAID BACK: 86 BPM", "HOME, THEN TURN SELECT TO 86", btn="HOME")
    L.param(4, "SSWING", 30, "SWING THE BEAT", "HOLD SEQ, TURN KNOB 3 TO 30", tol=3, btn="SEQ")
    L.track(1, "THE BASS: TRACK 1", "TURN ALGORITHM TO TRACK 1")
    L.param(1, "ROOT", 9, "THE SONG IS IN A", "HOLD SEL, PRESS AN A KEY", btn="SEL")
    L.param(1, "SCALE", 2, "A MINOR", "HOLD SEL, TURN KNOB 2 TO MIN", btn="SEL")
    L.param(1, "SDIV", 0, "ONE STEP A BEAT", "HOLD SEQ, TURN KNOB 2 TO 1/4", btn="SEQ")
    L.notes(1, "BASS NOTES ON STEPS", "PLAY LIT KEY, SEQ + LIT STEP", how="SEQ")
    L.param(1, "SGATE", 100, "LONGER NOTES", "SEQ PAGES: TIMING, GATE 100", tol=4, btn="SEQ")
    L.track(2, "THE CHORDS: TRACK 2", "TURN ALGORITHM TO TRACK 2")
    L.param(2, "CHORD", 2, "ONE KEY, ONE CHORD", "HOLD SEL, TURN KNOB 1 TO 7TH", btn="SEL")
    L.param(2, "SDIV", 7, "ONE STEP A BAR", "HOLD SEQ, TURN KNOB 2 TO 1BAR", btn="SEQ")
    L.param(2, "SLEN", 4, "FOUR BARS, FOUR STEPS", "HOLD SEQ, TURN KNOB 4 TO 4", btn="SEQ")
    L.octave(-1, "AN OCTAVE DOWN", "PRESS OCT- ONCE")
    L.notes(2, "FOUR CHORDS", "PLAY LIT KEY, SEQ + LIT STEP", how="SEQ")
    L.param(2, "SGATE", 120, "LET THEM RING", "SEQ PAGES: TIMING, GATE 120", tol=4, btn="SEQ")
    L.param(2, "REV", 40, "SOME ROOM", "TAP FX: KNOB 4 REV TO 40", tol=4, btn="FX")
    L.track(3, "THE HOOK: TRACK 3", "TURN ALGORITHM TO TRACK 3")
    L.sound(3, "A NEW SOUND", "PRESETS: FIND KALIMBA (PLCK)")
    L.param(3, "SDIV", 1, "EIGHTH NOTES", "HOLD SEQ, TURN KNOB 2 TO 1/8", btn="SEQ")
    L.octave(1, "UP AN OCTAVE", "OCT+ UNTIL OCTAVE +1")
    L.notes(3, "THE HOOK", "PLAY LIT KEY, SEQ + LIT STEP", how="SEQ")
    L.param(3, "SSWING", 30, "SWING IT TOO", "HOLD SEQ, TURN KNOB 3 TO 30", tol=3, btn="SEQ")
    L.param(3, "DLY", 40, "AN ECHO", "TAP FX: KNOB 3 DLY TO 40", tol=4, btn="FX")
    L.param(3, "REV", 30, "AND A ROOM", "FX PAGE: KNOB 4 REV TO 30", tol=4, btn="FX")
    L.mutes({1, 4}, "PERFORM: THE INTRO", "HOLD GLO, KEYS 1 + 4: MUTE")
    L.mutes({3}, "DRUMS AND BASS IN", "HOLD GLO: 1 + 4 ON, 3 OFF")
    L.mutes(set(), "EVERYTHING", "HOLD GLO, KEY 3: ALL PLAY")
    L.done("LEVEL 1 DONE!", "HOLD HOME: TRAINER, LEVEL 2")
    return L


def level2():
    s = S.SONGS[1]
    L = Level(2, s, "VERSE")
    ch = s.sections["CHORUS"]
    L.glob("BPM", 104, "SYNTHWAVE AT 104", "TURN SELECT TO 104 BPM")
    L.param(1, "ROOT", 2, "THE SONG IS IN D", "HOLD SEL, PRESS A D KEY", btn="SEL")
    L.param(1, "SCALE", 2, "D MINOR", "HOLD SEL, TURN KNOB 2 TO MIN", btn="SEL")
    L.kit(4, "THE DRUMS", "ALGORITHM 4, PRESETS: SYNTHWV")
    L.lanes(4, "FOUR ON THE FLOOR", "DRUM GRID: KICK, LIT STEPS", ["KICK"])
    L.lanes(4, "SNARE AND CLAP", "SNARE, CLAP ON THE LIT STEPS", ["KICK", "SNARE", "CLAP"], levels=False)
    L.lanes(4, "HIT THE SNARE HARD", "SNARE: KNOB 4 LEVEL TO HARD", ["KICK", "SNARE", "CLAP"])
    L.add("HATS ON THE OFFBEAT", "HAT ON THE LIT STEPS", "TG_LANES", trk=3,
          data=("lanes", 16, [(S.LANES.index(n), list(L.sec[4].lanes[n])) for n in ("KICK", "SNARE", "CLAP")] +
                [(S.LANES.index("HAT"), [h if h and h[0] == 0 and h[1] == 0 else None for h in L.sec[4].lanes["HAT"]])]))
    L.add("GHOST HATS", "HATS ON 1 5 9 13, KNOB 4 GHOST", "TG_LANES", trk=3,
          data=("lanes", 16, [(S.LANES.index(n), list(L.sec[4].lanes[n])) for n in ("KICK", "SNARE", "CLAP")] +
                [(S.LANES.index("HAT"), [h if h and h[1] == 0 else None for h in L.sec[4].lanes["HAT"]])]))
    L.lanes(4, "A ROLL AT THE END", "STEP 16 HAT: HOLD OCT+, X2", ["KICK", "SNARE", "CLAP", "HAT"])
    L.play(True, "HEAR IT", "PRESS PLAY")
    L.track(1, "THE BASS: TRACK 1", "TURN ALGORITHM TO TRACK 1")
    L.sound(1, "A BASS SOUND", "PRESETS: FIND SAW BASS (BASS)")
    L.param(1, "SLEN", 32, "FOUR BARS OF 8THS", "SEQ PAGES: TIMING, LEN 32", btn="SEQ")
    L.param(1, "SDIV", 1, "EIGHTH NOTES", "TIMING: KNOB 2 DIV TO 1/8", btn="SEQ")
    L.notes(1, "TYPE THE BASS LINE", "SEQ: NOTES PAGE, PLAY LIT KEYS", plain=True)
    L.notes(1, "ACCENT THE LAST NOTE", "KNOB 1 TO IT, KNOB 4 TO ACC")
    L.param(1, "SGATE", 90, "LONGER NOTES", "TIMING: KNOB 4 GATE TO 90", tol=4, btn="SEQ")
    L.track(2, "THE PAD: TRACK 2", "TURN ALGORITHM TO TRACK 2")
    L.sound(2, "A PAD SOUND", "PRESETS: FIND SAW PAD (PAD)")
    L.param(2, "SDIV", 0, "ONE STEP A BEAT", "TIMING: KNOB 2 DIV TO 1/4", btn="SEQ")
    L.notes(2, "THREE-NOTE CHORDS", "NOTES: PRESS LIT KEYS TOGETHER", ties=False)
    L.notes(2, "A BAR EACH", "KNOB 3: LEN 4 ON EACH CHORD")
    L.param(2, "SGATE", 120, "LET THEM RING", "TIMING: KNOB 4 GATE TO 120", tol=4, btn="SEQ")
    L.param(2, "REV", 50, "MORE ROOM", "TAP FX: KNOB 4 REV TO 50", tol=4, btn="FX")
    L.track(5, "TRACK 5: A PLUCK", "TURN ALGORITHM PAST 4, TO 5")
    L.sound(5, "A PLUCK SOUND", "PRESETS: FIND FM PLUCK (PLCK)")
    L.notes(5, "THE PLUCK LINE", "NOTES: LIT KEYS, KNOB 1 SKIPS")
    L.param(5, "DLY", 70, "ECHOES", "TAP FX: KNOB 3 DLY TO 70", tol=4, btn="FX")
    L.param(5, "REV", 30, "A LITTLE ROOM", "FX PAGE: KNOB 4 REV TO 30", tol=4, btn="FX")
    L.param(5, "PAN", -20, "TO THE LEFT", "HOME: KNOB 4 PAN TO -20", tol=3, btn="HOME")
    L.param(5, "LEVEL", 96, "A BIT QUIETER", "HOME: KNOB 2 LEVEL TO 96", tol=3, btn="HOME")
    L.glob("DTIME", 6, "THE ECHO'S TIMING", "FX PAGES: DLY, TIME TO 1/8D", btn="FX")
    L.glob("DFDBK", 55, "MORE ECHOES", "DLY PAGE: KNOB 2 FDBK TO 55", tol=4, btn="FX")
    L.page("PATTERNS", "THE CHORUS: PATTERNS", "TAP SEQ UNTIL PATTERNS", btn="SEQ")
    L.pathas([1, 2, 4, 5], 2, "COPY TO PATTERN 2", "1 2 4 5: CURSOR 2, KNOB 4 X2")
    L.patsel(4, 2, "DRUMS: PLAY PATTERN 2", "TRACK 4: CURSOR 2, PRESS OCT+", filled=True)
    L.lanes(4, "OPEN HATS", "OFFBEAT HATS BECOME OPEN HATS", ["KICK", "SNARE", "CLAP", "HAT", "OHAT"], pat=ch[4])
    L.lanes(4, "A TOM AT THE END", "LOW TOM ON STEP 15, SOFT", ["KICK", "SNARE", "CLAP", "HAT", "OHAT", "LOTOM"],
            pat=ch[4])
    L.sound(3, "THE LEAD: TRACK 3", "ALGORITHM 3, PRESETS PWM LEAD")
    L.patsel(3, 2, "ITS OWN PATTERN 2", "PATTERNS: CURSOR 2, PRESS OCT+")
    L.param(3, "SLEN", 32, "FOUR BARS OF 8THS", "TIMING: KNOB 1 LEN TO 32", btn="SEQ")
    L.param(3, "SDIV", 1, "EIGHTH NOTES", "TIMING: KNOB 2 DIV TO 1/8", btn="SEQ")
    L.notes(3, "THE HOOK", "NOTES: LIT KEYS, KNOB 3 LEN", pat=ch[3], plain=True)
    L.notes(3, "ACCENTS", "EACH BAR'S FIRST NOTE: ACC", pat=ch[3])
    L.param(3, "SGATE", 100, "SMOOTHER", "TIMING: KNOB 4 GATE TO 100", tol=4, btn="SEQ")
    L.param(3, "DLY", 45, "AN ECHO", "TAP FX: KNOB 3 DLY TO 45", tol=4, btn="FX")
    L.param(3, "REV", 35, "A ROOM", "FX PAGE: KNOB 4 REV TO 35", tol=4, btn="FX")
    L.pats({1: 1, 2: 1, 3: 1, 4: 1, 5: 1}, "THE VERSE", "PATTERNS: CURSOR 1, PRESS OCT-")
    L.play(True, "PLAY THE VERSE", "PRESS PLAY")
    L.pats({1: 2, 2: 2, 3: 2, 4: 2, 5: 2}, "INTO THE CHORUS", "CURSOR 2, OCT-: ALL SWITCH")
    L.done("LEVEL 2 DONE!", "OCT- SWITCHES VERSE, CHORUS")
    return L


def level3():
    s = S.SONGS[2]
    L = Level(3, s, "C")
    A, B, C, D = (s.sections[x] for x in "ABCD")
    L.glob("BPM", 150, "MELODIC DUBSTEP: 150", "TURN SELECT TO 150 BPM")
    L.param(1, "ROOT", 2, "THE SONG IS IN D", "HOLD SEL, PRESS A D KEY", btn="SEL")
    L.param(1, "SCALE", 2, "D MINOR", "HOLD SEL, TURN KNOB 2 TO MIN", btn="SEL")
    L.kit(4, "THE DROP'S DRUMS", "ALGORITHM 4, PRESETS: DUBSTEP")
    L.lanes(4, "HALF-TIME KICK", "DRUM GRID: KICK, LIT STEPS", ["KICK"])
    L.lanes(4, "THE SNARE ON 3", "SNARE AND CLAP, LIT STEP", ["KICK", "SNARE", "CLAP"], levels=False)
    L.lanes(4, "HIT IT HARD", "SNARE: KNOB 4 LEVEL TO HARD", ["KICK", "SNARE", "CLAP"])
    L.lanes(4, "OFFBEAT HATS", "HAT ON THE LIT STEPS", ["KICK", "SNARE", "CLAP", "HAT"])
    L.param(4, "LEVEL", 120, "DRUMS UP FRONT", "HOME: KNOB 2 LEVEL TO 120", tol=3, btn="HOME")
    L.kit(8, "TRACK 8: MORE DRUMS", "ALGORITHM 8, PRESETS DUBSTEP")
    L.param(8, "SLEN", 64, "FOUR BARS LONG", "HOLD SEQ, TURN KNOB 4 TO 64", btn="SEQ")
    L.lanes(8, "A CRASH ON THE ONE", "DRUM GRID: CRASH ON STEP 1", ["CRASH"])
    L.sound(2, "THE SUB: TRACK 2", "ALGORITHM 2, PRESETS SUB BASS")
    L.notes(2, "ONE LONG NOTE", "NOTES: LIT KEY, KNOB 3 LEN 16")
    L.param(2, "SGATE", 127, "HELD THE WHOLE BAR", "SEQ PAGES: TIMING, GATE 127", tol=2, btn="SEQ")
    L.param(2, "LEVEL", 112, "MORE SUB", "HOME: KNOB 2 LEVEL TO 112", tol=3, btn="HOME")
    L.sound(1, "THE CHORDS: TRACK 1", "ALGORITHM 1, PRESETS WARM PAD")
    L.notes(1, "STABS", "NOTES: LIT KEYS TOGETHER", ties=False)
    L.notes(1, "SOME LONGER", "KNOB 3 LEN AS LIT")
    L.param(1, "ATK", 0, "SHARP STABS", "TAP ENV: KNOB 1 ATTACK TO 0", btn="ENV")
    L.param(1, "REL", 12, "SHORT TAILS", "ENV: KNOB 4 RELEASE TO 12", tol=2, btn="ENV")
    L.param(1, "SGATE", 45, "SHORTER", "SEQ PAGES: TIMING, GATE 45", tol=4, btn="SEQ")
    L.param(1, "LEVEL", 127, "FULL LEVEL", "HOME: KNOB 2 LEVEL TO 127", btn="HOME")
    L.glob("DUCK", 50, "THE PUMP", "TAP GLO: MASTER, DUCK 50", tol=4, btn="GLO")
    L.play(True, "HEAR THE DROP", "PRESS PLAY")
    L.sound(6, "THE PIANO: TRACK 6", "ALGORITHM 6, PRESETS GRAND PNO")
    L.param(6, "SLEN", 8, "ONE BAR", "SEQ PAGES: TIMING, LEN 8", btn="SEQ")
    L.param(6, "SDIV", 1, "OF EIGHTHS", "TIMING: KNOB 2 DIV TO 1/8", btn="SEQ")
    L.notes(6, "TWO CHORDS", "NOTES: LIT KEYS TOGETHER", ties=False)
    L.notes(6, "LET THEM RING", "KNOB 3 LEN AS LIT")
    L.param(6, "SGATE", 120, "LONGER", "TIMING: KNOB 4 GATE TO 120", tol=4, btn="SEQ")
    L.param(6, "REV", 65, "A BIG ROOM", "TAP FX: KNOB 4 REV TO 65", tol=4, btn="FX")
    L.param(6, "LEVEL", 98, "A BIT QUIETER", "HOME: KNOB 2 LEVEL TO 98", tol=3, btn="HOME")
    L.sound(5, "THE PAD: TRACK 5", "ALGORITHM 5, PRESETS WARM PAD")
    L.param(5, "SLEN", 1, "ONE STEP", "SEQ PAGES: TIMING, LEN 1", btn="SEQ")
    L.param(5, "SDIV", 7, "A BAR LONG", "TIMING: KNOB 2 DIV TO 1BAR", btn="SEQ")
    L.notes(5, "ONE CHORD", "NOTES: LIT KEYS TOGETHER")
    L.param(5, "SGATE", 110, "ALMOST THE WHOLE BAR", "TIMING: KNOB 4 GATE TO 110", tol=4, btn="SEQ")
    L.param(5, "REV", 60, "ROOM", "TAP FX: KNOB 4 REV TO 60", tol=4, btn="FX")
    L.param(5, "REL", 50, "A SHORTER TAIL", "TAP ENV: KNOB 4 RELEASE 50", tol=3, btn="ENV")
    L.sound(7, "THE RISER: TRACK 7", "ALGORITHM 7, PRESETS RISER")
    L.param(7, "SLEN", 64, "FOUR BARS", "SEQ PAGES: TIMING, LEN 64", btn="SEQ")
    L.notes(7, "RISE IN BARS 3 AND 4", "NOTES: STEP 33, KNOB 3 LEN 32")
    L.param(7, "SGATE", 127, "ALL THE WAY", "TIMING: KNOB 4 GATE TO 127", tol=2, btn="SEQ")
    L.param(7, "REV", 60, "ROOM", "TAP FX: KNOB 4 REV TO 60", tol=4, btn="FX")
    L.glob("DTIME", 6, "THE ECHO'S TIMING", "FX PAGES: DLY, TIME TO 1/8D", btn="FX")
    L.glob("DFDBK", 50, "FEEDBACK", "DLY PAGE: KNOB 2 FDBK TO 50", tol=4, btn="FX")
    # patterns for the other sections
    L.page("PATTERNS", "PATTERNS FOR SECTIONS", "TAP SEQ UNTIL PATTERNS", btn="SEQ")
    L.patsel(4, 2, "THE BUILD'S BEAT", "TRACK 4: CURSOR 2, PRESS OCT+")
    L.lanes(4, "KICK ON EVERY BEAT", "DRUM GRID: KICK, LIT STEPS", ["KICK"], pat=B[4])
    L.patsel(4, 3, "THE BREAK'S BEAT", "PATTERNS: CURSOR 3, OCT+")
    L.lanes(4, "JUST THE HATS", "DRUM GRID: HAT, LIT STEPS", ["HAT"], pat=D[4])
    L.patsel(8, 2, "THE BUILD'S ROLL", "TRACK 8: CURSOR 2, PRESS OCT+")
    roll = B[8]
    L.lanes(8, "BAR 1: QUARTERS", "DRUM GRID: SNARE, LIT STEPS", ["SNARE"], pat=roll, upto=16)
    L.lanes(8, "BAR 2: EIGHTHS", "OCT+ TAPPED: STEPS 17-32", ["SNARE"], pat=roll, upto=32)
    L.lanes(8, "BAR 3: SIXTEENTHS", "STEPS 33-48: EVERY STEP", ["SNARE"], pat=roll, upto=48)
    L.add("BAR 4: EVERY STEP", "STEPS 49-64: EVERY STEP", "TG_LANES", trk=7,
          data=("lanes", 64, [(S.LANES.index("SNARE"), [None if h is None else (h[0], 0) for h in roll.lanes["SNARE"]])]))
    L.lanes(8, "FASTER: RATCHETS", "HOLD OCT+ ON A HIT: RATCHET", ["SNARE"], pat=roll)
    L.patsel(5, 2, "THE BUILD'S PAD", "TRACK 5: COPY TO 2, OCT+", filled=True)
    L.lock(5, 1, "TFLT", 30, False, "OPEN IT UP", "OCT+ HELD: LOCKS, ADD FILT 30")
    L.lock(5, 1, "TFLT", 30, True, "OVER THE WHOLE BAR", "IN THE LOCK: KNOB 3 SLIDE ON")
    # the sections: the patterns and the mutes of each, saved
    L.play(False, "STOP TO SAVE", "PRESS PLAY TO STOP")
    L.pats({4: 1, 5: 1, 8: 1}, "SECTION C: THE DROP", "PATTERNS: T4, T5, T8 ON 1")
    L.mutes(C["_mute"], "MUTE FOR THE DROP", "GLO: MUTE TRACKS 5, 6, 7")
    L.saved("C", "SAVE IT AS C", "HOLD SAVE, PRESS KEY 7")
    L.pats({4: 2, 5: 2, 8: 2}, "SECTION B: THE BUILD", "PATTERNS: T4, T5, T8 ON 2")
    L.mutes(B["_mute"], "MUTE FOR THE BUILD", "GLO: ONLY TRACKS 1, 2 MUTED")
    L.saved("B", "SAVE IT AS B", "HOLD SAVE, PRESS KEY 6")
    L.pats({4: 3, 5: 1}, "SECTION D: THE BREAK", "PATTERNS: T4 ON 3, T5 ON 1")
    L.mutes(D["_mute"], "MUTE FOR THE BREAK", "GLO: MUTE 1, 6, 7 AND 8")
    L.saved("D", "SAVE IT AS D", "HOLD SAVE, PRESS KEY 8")
    L.mutes(set(A["_mute"]) | {4}, "SECTION A: THE INTRO", "GLO: ONLY THE PIANO PLAYS")
    L.saved("A", "SAVE IT AS A", "HOLD SAVE, PRESS KEY 5")
    L.page("SONG", "THE SONG", "HOME, THEN TAP SAVE", btn="SAVE")
    L.song_entries(s.song, "SEVEN PARTS", "KNOB 4: 7 STEPS", count_only=True)
    L.song_entries(s.song, "A4 B4 C8 D8 B4 C8 A4", "KNOB 1 STEP, 2 PART, 3 BARS")
    L.songmode("PLAY THE SONG", "OCT-: SONG MODE, THEN PLAY")
    L.done("LEVEL 3 DONE!", "SAVE + 1-4 PLAYS SECTIONS LIVE")
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
        L.append(f'    {{"{lv.song.title.split()[0] + (" " + lv.song.title.split()[1] if lv.num < 3 else "")}", '
                 f'TR_L{lv.num}, {len(lv.cards)}}},')
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
