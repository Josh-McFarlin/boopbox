#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The TRAINER's three songs: one score, read by the renderer (tools/trainer/render.py: the firmware's own
sequencer and engines on the host, to a WAV for approval) and, later, by the trainer firmware's lesson data.

Each song is written as the device holds it: tracks with a sound, LEN / DIV / GATE, steps, and (level 3) locks,
components, fill conditions, harmony and sections. A synth track's steps are one token a step:
    .        an empty step            -        a TIE (the note before goes on)
    D4       a note                   D4+F4+A4 a chord (up to 4 notes)
    suffix   ! accent   ? ghost   ~ slide to the next note
A drum lane is one character a step:  . none  x NORM  s SOFT  g GHOST  X HARD  2 3 4 NORM with a ratchet x2..x4
'|' in either is only for reading (bar lines); spaces are ignored.
"""

LANES = ["KICK", "KICK2", "SNARE", "CLAP", "HAT", "OHAT", "PEDAL", "RIM",
         "SNARE2", "LOTOM", "HITOM", "CRASH", "RIDE", "SHAKER", "CONGA", "COWBELL"]
DIVS = ["1/4", "1/8", "1/16", "1/32", "8T", "16T", "1/2", "1BAR", "2BAR"]
SCALES = ["CHR", "MAJ", "MIN", "DOR", "MIX", "PEN", "MPEN", "HARM",
          "PHRY", "LYD", "LOC", "MEL", "BLUES", "WHOLE", "DIMHW", "DIMWH"]
NOTE_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_num(s):
    """'Bb1' -> 34 (C4 = 60, the FM-1's keys are F3 53 .. G5 79)"""
    pc = NOTE_PC[s[0]]
    i = 1
    while i < len(s) and s[i] in "#b":
        pc += 1 if s[i] == "#" else -1
        i += 1
    return pc + 12 * (int(s[i:]) + 1)


def parse_steps(text):
    """synth step tokens -> list of None (empty), 'TIE', or (notes, flags, lvl)"""
    out = []
    for tok in text.replace("|", " ").split():
        if tok == ".":
            out.append(None)
        elif tok == "-":
            out.append("TIE")
        else:
            flags, lvl = 0, 0
            while tok[-1] in "!?~":
                c, tok = tok[-1], tok[:-1]
                flags |= 1 if c == "!" else 2 if c == "~" else 0
                lvl = 1 if c == "?" else lvl          # LV_GHOST
            out.append(([note_num(n) for n in tok.split("+")], flags, lvl))
    return out


DRUM_CH = {"x": (0, 0), "g": (1, 0), "s": (2, 0), "X": (3, 0), "2": (0, 1), "3": (0, 2), "4": (0, 3)}


def parse_lane(text):
    """drum lane characters -> list of None or (lvl, rat)"""
    return [None if c == "." else DRUM_CH[c] for c in text.replace("|", "").replace(" ", "")]


class Track:
    def __init__(self, num, sound, length=16, div="1/16", gate=64, level=None, **p):
        self.num, self.sound, self.length, self.div, self.gate = num, sound, length, div, gate
        self.level = level
        self.p = p                      # more track parameters: P_* name (without P_) -> value
        self.follow = p.pop("follow", "OFF")


class Pattern:
    """what one track plays in a section: steps (synth) or lanes (drums), and the extras"""
    def __init__(self, steps=None, lanes=None, locks=(), comps=(), fills=(), direction="FWD", seed=0):
        self.steps = parse_steps(steps) if steps else []
        self.lanes = {k: parse_lane(v) for k, v in (lanes or {}).items()}
        self.locks = list(locks)        # (step 1.., P_name, value, slide)
        self.comps = list(comps)        # (step 1.., CP_name, a, b)
        self.fills = list(fills)        # (step 1.., 'FILL' | 'NOFILL')
        self.direction, self.seed = direction, seed


class Song:
    def __init__(self, title, level, style, bpm, key, scale, swing=0, **g):
        self.title, self.level, self.style = title, level, style
        self.bpm, self.key, self.scale, self.swing = bpm, key, scale, swing
        self.g = g                      # more global parameters: G_* name (without G_) -> value
        self.tracks = {}
        self.sections = {}              # name -> {track num: Pattern}, plus '_mute': set of muted tracks
        self.song = []                  # [(section, bars)]
        self.prog = []                  # harmony progression: [(degree 1..7, bars)]
        self.performance = []           # loop-only songs: [(bars, set of muted tracks)] for the demo render

    def track(self, *a, **k):
        t = Track(*a, **k)
        self.tracks[t.num] = t
        return t

    def section(self, name, patterns, mute=()):
        self.sections[name] = dict(patterns, _mute=set(mute))


# ---------------------------------------------------------------------------------------------------------------
# LEVEL 1  FIRST LIGHT  lo-fi hip-hop, 86 BPM, A minor
#   The basics: pick a track, a kit and a sound; drum steps; notes on steps (SEQ layer); key and scale; chord mode;
#   DIV / LEN / GATE; tempo; a track's swing; mutes to perform it.
# ---------------------------------------------------------------------------------------------------------------
first = Song("FIRST LIGHT", 1, "LO-FI HIP-HOP", bpm=86, key="A", scale="MIN")   # swing per track (SEQ + KNOB 3)
first.track(4, "LO-FI", 16, "1/16", SSWING=30)
first.track(1, "808 BOOM", 16, "1/4", gate=100)
first.track(2, "RHODES", 4, "1BAR", gate=120, CHORD=2, REV=40)            # chord mode 7TH
first.track(3, "KALIMBA", 16, "1/8", DLY=40, REV=30, SSWING=30)
first.section("LOOP", {
    4: Pattern(lanes={
        "KICK":  "x... ...x ..x. ....",
        "SNARE": ".... x... .... x...",
        "HAT":   "x.x. x.x. x.x. x.x.",
    }),
    # one step a beat: A . . A | D . . . | F . . F | E . G .  (808 BOOM plays two octaves under the keys)
    1: Pattern(steps="A3 . . A3 | D4 . . . | F4 . . F4 | E4 . G4 ."),
    # one step a bar, CHORD 7TH (keys C4 F4 A4 G4 with OCT-: I IV VI V of A minor): Am7 Dm7 Fmaj7 Em7
    2: Pattern(steps="A3+C4+E4+G4 D4+F4+A4+C5 F4+A4+C5+E5 E4+G4+B4+D5"),
    3: Pattern(steps="E5 . G5 A5 . G5 E5 . | D5 . C5 D5 . A4 . ."),
})
first.performance = [(2, {1, 4}), (4, {3}), (8, set()), (2, {1, 4})]   # 4 at most: they play as sections A-D

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 2  NEON AVENUE  synthwave, 104 BPM, D minor
#   The NOTES page (typing a line, LEN, FORCE, accents), drum levels and ratchets, the second bank (track 5), the
#   sound browser, FX sends, two patterns (verse / chorus) and the PATTERNS screen, the mixer.
# ---------------------------------------------------------------------------------------------------------------
neon = Song("NEON AVENUE", 2, "SYNTHWAVE", bpm=104, key="D", scale="MIN", DTIME=6, DFDBK=55)   # delay 1/8D
neon.track(4, "SYNTHWV", 16, "1/16")
neon.track(1, "SAW BASS", 32, "1/8", gate=90)
neon.track(2, "SAW PAD", 16, "1/4", gate=120, REV=50)
neon.track(3, "PWM LEAD", 32, "1/8", gate=100, DLY=45, REV=35)
neon.track(5, "FM PLUCK", 16, "1/16", level=96, DLY=70, REV=30, PAN=-20)
BASS2 = ("D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | "
         "F2 F3 F2 F3 F2 F3 F2 F3 | C2 C3 C2 C3 C2 C3 C2 C3!")
PAD2 = "D4+F4+A4 - - - | D4+F4+Bb4 - - - | C4+F4+A4 - - - | C4+E4+G4 - - -"
PLUCK2 = "D5 . A4 . F5 . A4 . C5 . A4 . D5 . F5 ."
neon.section("VERSE", {
    4: Pattern(lanes={
        "KICK":  "x... x... x... x...",
        "SNARE": ".... X... .... X...",
        "CLAP":  ".... x... .... x...",
        "HAT":   "g.x. g.x. g.x. g.x2",
    }),
    1: Pattern(steps=BASS2),
    2: Pattern(steps=PAD2),
    3: Pattern(),
    5: Pattern(steps=PLUCK2),
})
neon.section("CHORUS", {
    4: Pattern(lanes={
        "KICK":  "x... x... x... x...",
        "SNARE": ".... X... .... X...",
        "CLAP":  ".... x... .... x...",
        "HAT":   "g... g... g... g..2",
        "OHAT":  "..x. ..x. ..x. ..x.",
        "LOTOM": ".... .... .... ..s.",
    }),
    1: Pattern(steps=BASS2),
    2: Pattern(steps=PAD2),
    # the hook, one step an eighth: D5 . . A4 . C5 D5 | F5 . . D5 . C5 | C5 . . A4 . C5 F5 | E5 . . D5 . C5
    3: Pattern(steps="D5! - - A4 - C5 D5 - | F5! - - D5 - C5 - - | C5! - - A4 - C5 F5 - | E5! - - D5 - C5 - -"),
    5: Pattern(steps=PLUCK2),
})
neon.song = [("VERSE", 4), ("CHORUS", 8), ("VERSE", 4), ("CHORUS", 8)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3  AFTERGLOW  melodic house, 122 BPM, A minor, progression Am F C G (I VI III VII, a bar each)
#   Eight tracks; the harmony (CHORDS screen, FOLLOW: one-bar patterns that follow the progression); parameter locks
#   with SLIDE; step components (TRIG, COND, RAMP+); a fill; the play direction; sections A-D and the song.
# ---------------------------------------------------------------------------------------------------------------
glow = Song("AFTERGLOW", 3, "MELODIC HOUSE", bpm=122, key="A", scale="MIN", swing=10, DTIME=6, DFDBK=50)
glow.prog = [(1, 1), (6, 1), (3, 1), (7, 1)]
glow.track(4, "HOUSE", 16, "1/16")
glow.track(8, "AFRO", 16, "1/16")
glow.track(1, "MONO BASS", 16, "1/16", gate=70, follow="SCALE")
glow.track(2, "M1 PIANO", 16, "1/16", gate=60, follow="SCALE", REV=30)
glow.track(3, "MARIMBA", 32, "1/8", gate=90, DLY=50, REV=40)
glow.track(5, "WARM PAD", 1, "1BAR", gate=120, follow="SCALE", REV=60, TFLT=-40)
glow.track(6, "PLUGG BELL", 8, "1/16", gate=50, level=94, follow="SCALE", DLY=60, PAN=25, VOICE=1)
glow.track(7, "RISER", 64, "1/16", gate=127, REV=50)
DRUMS3 = {
    "KICK": "x... x... x... x...",
    "CLAP": ".... x... .... x...",
    "OHAT": "..x. ..x. ..x. ..x.",
    "HAT":  "s.s. s.s. s.s. s.ss",
}
# track 8, the percussion: a shaker that drops some hits (TRIG), a conga every other bar (COND 2:2)
PERC3 = dict(lanes={
    "SHAKER": "sxsx sxsx sxsx sxsx",
    "CONGA":  "...x ..x. ...x .x..",
    "RIM":    ".... ...x .... ..x.",
}, comps=[(2, "TRIG", 60, 0), (10, "TRIG", 60, 0), (14, "COND", 2, 2)])
# the build's percussion: a snare roll on the last beat of every fourth bar (COND 4:4)
PERC3B = dict(lanes={
    "SHAKER": "sxsx sxsx sxsx ....",
    "CONGA":  "...x ..x. ...x ....",
    "RIM":    ".... ...x .... ....",
    "SNARE":  ".... .... .... 4444",
}, comps=[(2, "TRIG", 60, 0), (10, "TRIG", 60, 0)] + [(s, "COND", 4, 4) for s in (13, 14, 15, 16)])
# the drop's percussion: a crash on the first bar of every four (COND 1:4)
PERC3C = dict(lanes={**PERC3["lanes"], "CRASH": "x... .... .... ...."},
              comps=PERC3["comps"] + [(1, "COND", 1, 4)])
# written on A (I); FOLLOW SCALE moves it up the scale to VI, III, VII
BASS3 = Pattern(steps="A1 . A2 . . . A2 . | . . A2 . A1 . A2~ G2")
# offbeat stabs; a lock sends the last one to the delay (a throw)
PIANO3 = Pattern(steps=". . A3+C4+E4 . . A3+C4+E4 . . | . . A3+C4+E4 . . . A3+C4+E4! .",
                 locks=[(15, "DLY", 110, 0)])
# one step a bar; a lock with SLIDE opens its filter over the bar (the track's FILT is -40)
PAD3 = Pattern(steps="A3+C4+E4", locks=[(1, "TFLT", 0, 1)])
ARP3 = Pattern(steps="A4 C5 E5 A5 E5 C5 A4 E5", comps=[(4, "RUP", 3, 1)])
LEAD3 = Pattern(steps="A4 - C5 - E5 - D5 C5 | C5 - A4 - - - . . | G4 - C5 - E5 - D5 C5 | D5 - B4 - - - G4 .")
RISER3 = Pattern(steps=". " * 48 + "C4 " + "- " * 15)
COMMON3 = {1: BASS3, 2: PIANO3, 3: LEAD3, 5: PAD3, 6: ARP3, 7: RISER3}
glow.section("A", {   # intro: kick and hats, the pad, the arp
    4: Pattern(lanes={"KICK": DRUMS3["KICK"], "HAT": DRUMS3["HAT"]}), 8: Pattern(**PERC3), **COMMON3,
}, mute=(8, 1, 2, 3, 7))
glow.section("B", {   # build: the full beat, bass and piano, the riser and a snare roll on its last bar
    4: Pattern(lanes=DRUMS3), 8: Pattern(**PERC3B), **COMMON3,
}, mute=(3, 5))
glow.section("C", {   # the drop: everything but the pad
    4: Pattern(lanes=DRUMS3), 8: Pattern(**PERC3C), **COMMON3,
}, mute=(5, 7))
glow.section("D", {   # the break: pad, lead and arp, no beat; the arp back and forth (PEND)
    4: Pattern(lanes={"HAT": DRUMS3["HAT"]}), 8: Pattern(**PERC3), **COMMON3,
    6: Pattern(steps="A4 C5 E5 A5 E5 C5 A4 E5", direction="PEND"),
}, mute=(4, 1, 2, 7))
glow.song = [("A", 4), ("B", 4), ("C", 8), ("D", 4), ("B", 4), ("C", 8), ("A", 2)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3 (variant)  FAULT LINE  dubstep, 140 BPM (half-time), F minor, progression Fm Db Ab Eb (i VI III VII, two
#   bars each). Level 3's features on a dubstep track: the wobble is parameter locks on the LFO's RATE (on the TIE
#   steps too, so the speed changes inside one long note); the build is a snare roll that speeds up (ratchets) and a
#   high-pass lock that SLIDEs open; the sub and the wobble FOLLOW the progression (TRANS: the riff's shape kept).
# ---------------------------------------------------------------------------------------------------------------
fault = Song("FAULT LINE", 3, "DUBSTEP", bpm=140, key="F", scale="MIN")
fault.prog = [(1, 2), (6, 2), (3, 2), (7, 2)]
fault.track(4, "DUBSTEP", 16, "1/16")
fault.track(8, "INDUSTR", 64, "1/16")
fault.track(1, "WOBBLE", 32, "1/16", gate=110, follow="TRANS")       # plays two octaves under the keys
fault.track(2, "SUB BASS", 32, "1/16", gate=127, follow="TRANS")     # (808 family: two octaves under the keys)
fault.track(3, "HOOVER", 64, "1/8", gate=110, REV=45, DLY=30)
fault.track(5, "DARK STR", 1, "1BAR", gate=110, follow="SCALE", REV=70, TFLT=-30, REL=60)
fault.track(7, "RISER", 64, "1/16", gate=127, REV=60)
# LRATE at 140 BPM: 73 a quarter, 86 an eighth, 94 an eighth triplet, 99 a sixteenth (the LFO restarts on each note)
WOB = Pattern(steps="F3 - - - - - - - . . F3 - - - - - | F3 - - - - - F3 - Ab3 - - - F3 - - -",
              locks=[(1, "LRATE", 73, 0), (5, "LRATE", 86, 0), (11, "LRATE", 94, 0), (17, "LRATE", 99, 0),
                     (23, "LRATE", 86, 0), (25, "LRATE", 73, 0), (29, "LRATE", 99, 0)])
SUB = Pattern(steps="F3 " + "- " * 31)
DROP_DRUMS = {
    "KICK":  "x... .... ..x. ....",
    "SNARE": ".... .... X... ....",
    "CLAP":  ".... .... x... ....",
    "HAT":   "g.s. g.s. g.s. g.ss",
}
HOOK = Pattern(  # the HOOVER hook
    steps="C5 - - Ab4 - - F4 - | G4 - Ab4 - C5 - - - | F5 - - Eb5 - - Db5 - | C5 - - - Ab4 - - - | "
                     "Eb5 - - C5 - - Ab4 - | Bb4 - C5 - Eb5 - - - | G5 - - F5 - - Eb5 - | Bb4 - - - - - - -")
PADF = Pattern(steps="F3+Ab3+C4", locks=[(1, "TFLT", 0, 1)])
RISEF = Pattern(steps=". " * 32 + "C4 " + "- " * 31)
# the build: quarters, eighths, sixteenths, then 32nds (x2 ratchets), louder each bar; a high-pass opens over it
ROLL = Pattern(lanes={"SNARE": "s...s...s...s... | s.s.s.s.s.s.s.s. | xxxxxxxxxxxxxxxx | 2222222222222222"},
               locks=[(1, "TFLT", 0, 0), (49, "TFLT", 40, 1)])
CRASHF = Pattern(lanes={"CRASH": "x" + "." * 63}, comps=[(1, "COND", 1, 2)])   # a crash every other 4-bar loop
COMMONF = {1: WOB, 2: SUB, 3: HOOK, 5: PADF, 7: RISEF}
fault.section("A", {   # intro: the pad and the hoover hook, hats
    4: Pattern(lanes={"HAT": DROP_DRUMS["HAT"]}), 8: CRASHF, **COMMONF,
}, mute=(8, 1, 2, 7))
fault.section("B", {   # build: the roll, the riser, the pad
    4: Pattern(lanes={"KICK": "x... x... x... x..."}), 8: ROLL, **COMMONF,
}, mute=(1, 2, 3))
fault.section("C", {   # the drop: half-time drums, the wobble and the sub
    4: Pattern(lanes=DROP_DRUMS, comps=[(16, "TRIG", 50, 0)]), 8: CRASHF, **COMMONF,
}, mute=(3, 5, 7))
fault.section("D", {   # the break: the hook over the sub, the pad, a kick on the one
    4: Pattern(lanes={"KICK": "x... .... .... ....", "HAT": DROP_DRUMS["HAT"]}), 8: CRASHF, **COMMONF,
}, mute=(8, 1, 7))
fault.song = [("A", 8), ("B", 4), ("C", 8), ("D", 8), ("B", 4), ("C", 8), ("A", 2)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3 (variant)  BLUE HOUR  medium-swing jazz, 132 BPM, Bb major (a friendly key for tenor and alto sax).
#   An eight-bar form, ii V I vi | ii V I I (Cm7 F7 Bbmaj7 Gm7 | Cm7 F7 Bbmaj7 Bbmaj7), on the CHORDS screen. The
#   Rhodes comps rootless voicings written once on I that FOLLOW SCALE into each chord; the walking bass is written out;
#   the vibes play the head (a melody to harmonize a third or sixth under); the SOLO section is the form without the
#   head, for the sax. Components make the drums and the comping breathe (TRIG, with a SEED).
# ---------------------------------------------------------------------------------------------------------------
blue = Song("BLUE HOUR", 3, "JAZZ", bpm=132, key="Bb", scale="MAJ")   # swing per track: not the bass
blue.prog = [(2, 1), (5, 1), (1, 1), (6, 1), (2, 1), (5, 1), (1, 2)]
blue.track(4, "JAZZ", 8, "1/8", level=127, SSWING=64)
blue.track(8, "JAZZ", 16, "1/8", level=118, SSWING=64)
blue.track(1, "UP BASS", 32, "1/4", gate=110, level=94)
blue.track(2, "RHODES", 8, "1/8", gate=70, level=94, follow="SCALE", REV=30, SSWING=64)
blue.track(3, "VIBES", 64, "1/8", gate=110, REV=40, SSWING=64)
WALK = ("C2 D2 Eb2 E2 | F2 A2 C3 B2 | Bb2 F2 D2 F#2 | G2 F2 D2 Db2 | "
        "C2 Eb2 G2 Gb2 | F2 Eb2 C2 A1 | Bb1 D2 F2 A2 | Bb2 A2 G2 Db2")
SWING_DRUMS = Pattern(lanes={"RIDE": "x.xxx.xx", "PEDAL": "..x...x.", "KICK": "g...g..."})
COMPING = Pattern(lanes={"SNARE": ".....g.. ..g...s.", "RIM": "...g.... ......g."},
                  comps=[(6, "TRIG", 50, 0), (11, "TRIG", 40, 0), (15, "TRIG", 35, 0), (4, "TRIG", 30, 0)], seed=7)
# rootless voicing on I (D F A C: Bbmaj9); FOLLOW SCALE makes Cm9, F13-ish (A C Eb F), Gm7 (Bb D F G)
COMP = Pattern(steps="D3+F3+A3+C4 . . D3+F3+A3+C4 . . . .", comps=[(4, "TRIG", 75, 0)], seed=3)
HEAD = Pattern(steps="Eb5 - - D5 C5 - Bb4 - | A4 - - - C5 - Eb5 - | D5 - - - - - . . | . D5 F5 - D5 - Bb4 - | "
                     "C5 - - Eb5 G5 - F5 Eb5 | D5 - C5 - A4 - Eb5 - | D5 - - - - - - - | . . . . . . C5 D5",
               locks=[(49, "REV", 100, 1)])
COMMONB = {1: Pattern(steps=WALK), 2: COMP, 4: SWING_DRUMS, 8: COMPING}
blue.section("A", {**COMMONB, 3: HEAD}, mute=(3,))            # intro / solo: the band, no head
blue.section("B", {**COMMONB, 3: HEAD})                       # the head
blue.song = [("A", 8), ("B", 8), ("A", 16), ("B", 8)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3 (variant)  UNDERPASS  deep dubstep, 140 BPM (half-time), E minor, Em for four bars, C for four (i VI).
#   Sparse and sub-heavy: a shuffled beat (the drums' own swing), a REESE whose filter moves with SLIDE locks across
#   each long note, a sub under it, a dark FM bell over an atmos pad and wind. Components drop hats at random (TRIG)
#   and bring a rim in every other bar (COND).
# ---------------------------------------------------------------------------------------------------------------
under = Song("UNDERPASS", 3, "DEEP DUBSTEP", bpm=140, key="E", scale="MIN", DTIME=6, DFDBK=65)
under.prog = [(1, 4), (6, 4)]
under.track(4, "DUBSTEP", 32, "1/16", SSWING=55)
under.track(8, "TRIBAL", 32, "1/16", level=116, SSWING=55)
under.track(1, "REESE", 32, "1/16", gate=120, follow="TRANS")         # plays two octaves under the keys
under.track(2, "SUB BASS", 32, "1/16", gate=127, follow="TRANS")
under.track(3, "GLASS BELL", 64, "1/8", gate=80, level=112, DLY=70, REV=60, VOICE=1)
under.track(5, "ATMOS PAD", 1, "1BAR", gate=110, follow="SCALE", REV=80, TFLT=-20, REL=70)
under.track(7, "WIND", 64, "1/16", gate=127, level=104, REV=60)
DEEP_HAT = "..s. ..s. ..s. ..s. | ..s. ..s. ..s. ..ss"
DEEP_DRUMS = Pattern(lanes={
    "KICK":  "x... .... .... .... | ..x. .... ..x. ....",
    "SNARE": ".... .... X... .... | .... .... X... ....",
    "HAT":   "..s. ..s. ..s. ..s. | ..s. ..s. ..s. ..ss",
}, comps=[(7, "TRIG", 60, 0), (15, "TRIG", 60, 0), (23, "TRIG", 50, 0)])
PERCU = Pattern(lanes={"RIM": ".... ..g. .... ...g | .... .... .... .g..", "LOTOM": ".... .... .... .... | .... .... .... ..s."},
                comps=[(7, "COND", 2, 2), (16, "COND", 2, 2)])
# the REESE: long notes; its CUT (EDIT 2, KNOB 1) opens and closes over them with SLIDE locks
REESE = Pattern(steps="E3 - - - - - - - - - - - . . G3 - | - - - - . . E3 - - - - - D3 - - -",
                locks=[(1, "E4", 30, 0), (9, "E4", 80, 1), (17, "E4", 40, 1), (25, "E4", 90, 1)])
BELL = Pattern(steps="B4 - - - . . G4 - | A4 - - - - - . . | B4 - - - . . E5 - | D5 - - - B4 - - - | "
                     "C5 - - - . . G4 - | B4 - - - - - . . | C5 - - - . . E5 - | D5 - - - - - - -")
COMMONU = {1: REESE, 2: SUB, 3: BELL, 5: Pattern(steps="E3+G3+B3", locks=[(1, "TFLT", 10, 1)]),
           7: Pattern(steps="E4 " + "- " * 63), 8: PERCU}
under.section("A", {4: Pattern(lanes={"HAT": DEEP_HAT}), **COMMONU}, mute=(1, 2, 8))  # intro
under.section("B", {4: DEEP_DRUMS, **COMMONU}, mute=(3, 5, 7))                                      # the drop
under.section("C", {4: Pattern(lanes={"KICK": "x" + "." * 31}), **COMMONU}, mute=(1, 7))           # the break
under.section("D", {4: DEEP_DRUMS, **COMMONU}, mute=(5, 7))                                         # drop 2: the bell
under.song = [("A", 8), ("B", 8), ("C", 8), ("D", 8), ("A", 4)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3  LANTERNS  melodic dubstep, 150 BPM (half-time), G minor, Eb F Gm Gm (VI VII i i, a bar each).
#   Piano chords in the intro, a saw pad that a SLIDE lock opens through the build, a sync-lead hook, and a talking
#   growl in the drop on WOW BASS (the VOICE engine). The chosen Level 3; GROWLS holds four ways to make it talk.
# ---------------------------------------------------------------------------------------------------------------
GROWLS = {
    # 1  TALK: a vowel lock on each hit (VOWL, EDIT 1 KNOB 1), so each says something else
    "TALK": Pattern(steps="G3 - . G3 . . G3 - | Bb3 - . . G3 . F3 -",
                    locks=[(1, "E0", 20, 0), (4, "E0", 100, 0), (7, "E0", 60, 0), (9, "E0", 120, 0), (13, "E0", 10, 0),
                           (15, "E0", 80, 0)]),
    # 2  YOI: longer notes; locks on TALK (EDIT 1 KNOB 3: how fast it goes from one vowel to the other) make a slow
    #    "wooow" and a quick "yoi"; VOWL2 locks change where it goes; a SLIDE lock on SHIFT lifts the formant at the end
    "YOI": Pattern(steps="G3 - - - . . G3 - | Bb3 - - . G3 - F3 -",
                   locks=[(1, "E2", 115, 0), (1, "E1", 10, 0), (7, "E2", 25, 0), (7, "E1", 120, 0), (9, "E2", 90, 0),
                          (9, "E0", 120, 0), (13, "E2", 20, 0), (15, "E3", 9, 1)]),
    # 3  STUTTER: shorter hits, MULT components fire 3 and 4 hits inside a step, and PARAM components pick a random
    #    vowel each time (+-40 % of VOWL): the riff never talks the same way twice (the SEED keeps a PLAY repeatable)
    "STUTTER": Pattern(steps="G3 G3 . G3 . . G3 G3 | Bb3 . . G3 . G3 F3 F3",
                       comps=[(8, "MULT", 3, 0), (16, "MULT", 4, 0), (1, "PARAM", 63, 40), (4, "PARAM", 63, 40),
                              (7, "PARAM", 63, 40), (12, "PARAM", 63, 40), (14, "PARAM", 63, 40)],
                       locks=[(2, "E0", 110, 0), (9, "E0", 30, 0)], seed=5),
    # 4  DIVE: pitch moves on the growl: BEND components dive an octave down (TO) and scoop up a fourth (FROM),
    #    PORTA glides one note into the next, and the vowels still change on each hit
    "DIVE": Pattern(steps="G3 - . G3 . . G4 - | Bb3 - . . G3 . G3 -",
                    comps=[(7, "BEND", -12, 0), (9, "BEND", 5, 1), (4, "PORTA", 40, 0), (15, "BEND", -12, 0)],
                    locks=[(1, "E0", 30, 0), (4, "E0", 100, 0), (7, "E0", 120, 0), (9, "E0", 60, 0), (13, "E0", 10, 0),
                           (15, "E0", 90, 0)]),
}


def lanterns(growl):
    lant = Song("LANTERNS " + growl, 3, "MELODIC DUBSTEP", bpm=150, key="G", scale="MIN", DTIME=6, DFDBK=50)
    lant.variant = growl
    lant.prog = [(6, 1), (7, 1), (1, 2)]
    lant.track(4, "DUBSTEP", 16, "1/16")
    lant.track(8, "HYPER", 64, "1/16", level=100)
    lant.track(1, "WOW BASS", 16, "1/16", gate=90, level=96, follow="TRANS")      # (an octave under the keys)
    lant.track(2, "SUB BASS", 16, "1/16", gate=127, follow="TRANS")
    lant.track(3, "SYNC LEAD", 32, "1/8", gate=110, DLY=40, REV=40)
    lant.track(5, "SAW PAD", 1, "1BAR", gate=110, follow="SCALE", REV=60, REL=60)
    lant.track(6, "GRAND PNO", 8, "1/8", gate=120, follow="SCALE", REV=50)
    lant.track(7, "RISER", 64, "1/16", gate=127, REV=60)
    subl = Pattern(steps="G3 " + "- " * 15)
    hook = Pattern(steps="G5 - - F5 - - Eb5 - | F5 - - - C5 - D5 - | D5 - - - - - Bb4 - | C5 - Bb4 - A4 - G4 -")
    piano = Pattern(steps="G3+Bb3+D4 - - . G3+Bb3+D4 - . .")
    pad = Pattern(steps="G3+Bb3+D4")
    drop = {"KICK": "x... .... ..x. ....", "SNARE": ".... .... X... ....", "CLAP": ".... .... x... ....",
            "HAT": "..x. ..x. ..x. ..x."}
    build = Pattern(lanes={"SNARE": "x...x...x...x... | x.x.x.x.x.x.x.x. | xxxxxxxxxxxxxxxx | 2222333344444444"})
    common = {1: GROWLS[growl], 2: subl, 3: hook, 5: pad, 6: piano, 7: Pattern(steps=". " * 32 + "C4 " + "- " * 31)}
    lant.section("A", {4: Pattern(), 8: build, **common}, mute=(8, 1, 2, 3, 5, 7))      # intro: the piano alone
    lant.section("B", {4: Pattern(lanes={"KICK": "x... x... x... x..."}), 8: build, **common,
                       5: Pattern(steps="G3+Bb3+D4", locks=[(1, "TFLT", 30, 1)])}, mute=(1, 2))   # the build
    lant.section("C", {4: Pattern(lanes=drop), 8: Pattern(lanes={"CRASH": "x" + "." * 63}), **common},
                 mute=(5, 6, 7))                                                                 # the drop
    lant.section("D", {4: Pattern(lanes={"HAT": drop["HAT"]}), 8: build, **common}, mute=(8, 1, 6, 7))  # the break
    lant.song = [("A", 4), ("B", 4), ("C", 8), ("D", 8), ("B", 4), ("C", 8), ("A", 4)]
    return lant


LANTERNS = [lanterns(g) for g in GROWLS]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3 (variant)  VELVET ROOM  deep house, 120 BPM, D minor, Dm9 for two bars, Gm9 for two (i iv).
#   Rootless ninth chords on the DX RHODES written once on I that FOLLOW SCALE, a choir pad, an FM bass that follows
#   (TRANS), a "soul ooh" vocal chop with a SLIDE lock on its vowel, and latin percussion that never plays the same
#   bar twice (TRIG, COND).
# ---------------------------------------------------------------------------------------------------------------
velv = Song("VELVET ROOM", 3, "DEEP HOUSE", bpm=120, key="D", scale="MIN", swing=20, DTIME=6, DFDBK=45)
velv.prog = [(1, 2), (4, 2)]
velv.track(4, "D.HOUSE", 16, "1/16")
velv.track(8, "LATIN", 32, "1/16", level=112)
velv.track(1, "FM BASS", 32, "1/16", gate=80, follow="TRANS")        # (two octaves under the keys)
velv.track(2, "DX RHODES", 32, "1/16", gate=100, follow="SCALE", REV=40)
velv.track(3, "SOUL OOH", 32, "1/16", gate=90, level=116, DLY=50, REV=50)
velv.track(5, "CHOIR AAH", 1, "2BAR", gate=110, follow="SCALE", level=106, REV=70, REL=70)
velv.track(6, "KALIMBA", 16, "1/16", gate=60, level=88, follow="SCALE", DLY=60, PAN=-30)
DEEPH = {"KICK": "x... x... x... x...", "CLAP": ".... x... .... x...", "OHAT": "..x. ..x. ..x. ..x.",
         "HAT": ".x.x .x.x .x.x .xx."}
LATIN = Pattern(lanes={"CONGA":   "..x. .x.. x... ..x. | ..x. .x.. x.x. ...x",
                       "SHAKER":  "xsxs xsxs xsxs xsxs | xsxs xsxs xsxs xsxs",
                       "COWBELL": ".... .... .... ..g. | .... .... .... ...."},
                comps=[(3, "TRIG", 70, 0), (19, "TRIG", 70, 0), (27, "COND", 2, 2), (15, "COND", 1, 2)])
BASSV = Pattern(steps="D3 - . . . . . D3 . . D3 - . . F3 . | . . . . . . . D3 . . D3 - . . C3 .")
CHORDV = Pattern(steps="F3+A3+C4+E4 - - . . . F3+A3+C4+E4 . . . . . . . . . | "
                       ". . . F3+A3+C4+E4 - - . . . . F3+A3+C4+E4 - - . . .")
OOH = Pattern(steps=". . . . . . A4 - . . C5 - . . . . | . . . . . . D5 - - - C5 - A4 - - -",
              locks=[(23, "E0", 40, 1), (27, "E0", 110, 1)])
COMMONV = {1: BASSV, 2: CHORDV, 3: OOH, 5: Pattern(steps="D3+F3+A3"), 6: Pattern(steps="A5 . E5 . D5 . . . A5 . . . E5 . . .",
           comps=[(9, "RUP", 3, 2)]), 8: LATIN}
velv.section("A", {4: Pattern(lanes={"KICK": DEEPH["KICK"], "HAT": DEEPH["HAT"]}), **COMMONV}, mute=(1, 3, 6))
velv.section("B", {4: Pattern(lanes=DEEPH), **COMMONV}, mute=(3, 5))
velv.section("C", {4: Pattern(lanes=DEEPH), **COMMONV}, mute=(5, 6))
velv.section("D", {4: Pattern(lanes={"HAT": DEEPH["HAT"]}), **COMMONV}, mute=(1, 8))
velv.song = [("A", 8), ("B", 8), ("C", 8), ("D", 4), ("C", 8), ("A", 4)]

# ---------------------------------------------------------------------------------------------------------------
# LEVEL 3 (variant)  ACID RAIN  acid house, 124 BPM, A minor, Am for two bars, Dm for two (i iv: FOLLOW moves the 303 up a fourth).
#   The ACID 303 is the song: slides, accents and CUT locks with SLIDE that sweep the filter, a RAMP that walks a note
#   up the scale each pass, and a pattern that runs backwards in the break (DIR REV). 909 drums, a second kit for the
#   ride and claps, Rhodes chords and a rave stab.
# ---------------------------------------------------------------------------------------------------------------
acid = Song("ACID RAIN", 3, "ACID HOUSE", bpm=124, key="A", scale="MIN", DTIME=6, DFDBK=55)
acid.prog = [(1, 2), (4, 2)]
acid.track(4, "909", 16, "1/16")
acid.track(8, "HOUSE", 16, "1/16", level=112)
acid.track(1, "ACID 303", 16, "1/16", gate=70, follow="TRANS", DLY=20)   # (an octave under the keys)
acid.track(2, "DX RHODES", 32, "1/16", gate=90, follow="SCALE", level=94, REV=40)
acid.track(3, "RAVE STAB", 32, "1/16", gate=40, level=92, DLY=50, REV=40)
acid.track(5, "ATMOS PAD", 1, "2BAR", gate=110, follow="SCALE", level=104, REV=70, REL=70)
acid.track(7, "RISER", 64, "1/16", gate=127, REV=60)
D909 = {"KICK": "x... x... x... x...", "OHAT": "..x. ..x. ..x. ..x.", "HAT": "xx.x xx.x xx.x xx.x"}
PERC9 = Pattern(lanes={"CLAP": ".... x... .... x...", "RIDE": "..x. ..x. ..x. ..x."}, comps=[(15, "TRIG", 50, 0)])
# the 303: slides (~), accents (!), the CUT swept by SLIDE locks; RAMP+ walks the last note up the scale
ACID = Pattern(steps="A3! A3 A4~ A3 . A3 C4! A3~ | A3 E4! A3 G3~ A3 . A4! C4",
               locks=[(1, "E4", 20, 0), (5, "E4", 70, 1), (9, "E4", 30, 0), (13, "E4", 95, 1)],
               comps=[(16, "RUP", 4, 1)])
COMMONA = {1: ACID, 2: Pattern(steps="A3+C4+E4+G4 - . . . . . . . . . . . . . . | . . . . . . . . A3+C4+E4+G4 - . . . . . ."),
           3: Pattern(steps=". . . . . . . . . . A4 . . . . . | . . . . . . A4 . . . A4 . . . . ."),
           5: Pattern(steps="A3+C4+E4"), 7: Pattern(steps=". " * 48 + "C4 " + "- " * 15), 8: PERC9}
acid.section("A", {4: Pattern(lanes={"KICK": D909["KICK"], "HAT": D909["HAT"]}), **COMMONA}, mute=(2, 3, 7))
acid.section("B", {4: Pattern(lanes=D909), **COMMONA}, mute=(3, 5))
acid.section("C", {4: Pattern(lanes=D909), **COMMONA}, mute=(5, 7))
acid.section("D", {4: Pattern(lanes={"HAT": D909["HAT"]}), **COMMONA,
                   1: Pattern(steps="A3! A3 A4~ A3 . A3 C4! A3~ | A3 E4! A3 G3~ A3 . A4! C4",
                              direction="REV", locks=ACID.locks)}, mute=(8, 7))
acid.song = [("A", 8), ("B", 4), ("C", 8), ("D", 8), ("B", 4), ("C", 8)]

# BLUE HOUR stays in the score, but is not a choice (the trainer's Level 3 is dubstep or house)
# Level 3 is LANTERNS, in four growls for now. FAULT LINE, UNDERPASS, AFTERGLOW, VELVET ROOM, ACID RAIN and BLUE HOUR
# stay in the score, set aside
SONGS = [first, neon] + LANTERNS
