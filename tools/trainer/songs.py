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
#   DIV / LEN / GATE; tempo and swing; mutes to perform it.
# ---------------------------------------------------------------------------------------------------------------
first = Song("FIRST LIGHT", 1, "LO-FI HIP-HOP", bpm=86, key="A", scale="MIN", swing=30)
first.track(4, "LO-FI", 16, "1/16")
first.track(1, "808 BOOM", 16, "1/4", gate=100)
first.track(2, "RHODES", 4, "1BAR", gate=120, CHORD=2, REV=40)            # chord mode 7TH
first.track(3, "KALIMBA", 16, "1/8", DLY=40, REV=30)
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

SONGS = [first, neon, glow]
