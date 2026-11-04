# BoopBox Trainer

The trainer is a separate build of BoopBox that teaches three songs on the FM-1 itself, with no manual: a coach on the
screen says what to do, lights the button and the keys to press, and moves on when the FM-1 is in the state the step
asks for. Everything else is BoopBox: every screen, button, knob and key works as it does there, so what you learn
works on BoopBox too.

| Level | Song | Style | What it teaches |
| --- | --- | --- | --- |
| 1 | **First Light** | lo-fi hip-hop, 86 BPM, A minor, 4 tracks | choosing tracks, kits and sounds; the DRUMS grid; notes on steps with the SEQ layer; key and scale; chord mode; DIV, LEN, GATE; swing; sends; mutes to perform it |
| 2 | **Neon Avenue** | synthwave, 104 BPM, D minor, 5 tracks | the NOTES page (typing a line, chords, LEN, accents); drum levels and a ratchet; track 5; the sound browser; the delay; pan and level; patterns for a verse and a chorus |
| 3 | **Lanterns** | melodic dubstep, 150 BPM, D minor, 7 tracks | an 8-track drop; envelopes; the DUCK pump; patterns per section; a 64-step roll with ratchets; a lock with SLIDE; mutes and sections A–D; the SONG screen and song mode |

The songs were rendered for approval with the firmware's own engines on a computer (`tools/trainer/render.py`); the
lessons' targets are taken from the same score, and `tests/trainer_test.c` checks that the song the lessons build is
that song.

## On the FM-1

- **The first start** opens the menu on **TRAIN**: the three levels. **PRESETS** moves the cursor, **OCT+** starts the
  level. Later: hold **HOME** for the menu; TRAIN is its first section.
- **A level** starts from a new project. When the loop holds notes, OCT+ asks once more (*OCT+ AGAIN: YOUR LOOP GOES*;
  level 3 also replaces the sections A–D). A level left half way goes on where it was left.
- **The coach** takes the screen's title area. On the TRACKS, DRUMS, PATTERNS and SONG screens and while a layer is
  held it has two lines: the step's number and headline (or what is still wrong, in amber), then the action. On the
  pages it has one line, which shows them in turn. The coloured bar under it is the level's progress.
  - The button to press **blinks**; the keys to play, or the step keys to press, are **lit**.
  - Hints say what is off: *STEP 8: KICK MISSING*, *STEP 3: PRESS OCT-*, *NOW 90 BPM*, *TRACK 6: MUTE*.
  - The coach checks the result, not the buttons: any way of getting there counts.
  - When the step is right it says **NICE!** and the next step comes.
- **In a level**, the menu's TRAIN section has **SKIP THIS STEP**, **STEP BACK**, **RESTART THIS LEVEL** and **QUIT THE
  LEVEL**. No button changes its normal job.
- **A finished level** shows *DONE* in the menu; OCT+ on it plays it again from the start. Levels can be taken in any
  order. Progress is kept with the FM-1's settings and survives a power-off.

## What the trainer build leaves out

To make room for the lessons (the app slot is full in the normal build), the trainer build has:

- **No web editor** (its SysEx; updates and USB rescue still work).
- **Three sample sets fewer:** HORNS, STRGS and SCRCH, with the sounds made from them (HORN STAB, STRING STB, SCRATCH,
  STR CLOUD, HORN CLOUD). GRAIN's DRONE plays on the PIANO set instead of the horns.

The trainer image is 528,880 B of the 581,564 B app slot (about 52 KB free); the coach and the lessons take about
17 KB, and under 100 B of RAM. The normal build is unchanged, byte for byte.

## Building and testing

```
./build.sh --trainer                    # build/trainer-fw/felucca-trainer.fwsc (version BOOPBOX TRAINER X.Y.Z)
./build.sh --trainer --release 1.3.1    # build/trainer-fw/felucca-trainer-1.3.1.fwsc
tests/run_tests.sh                      # includes the trainer test
python3 tools/trainer/render.py         # the songs to build/trainer/*.wav and .mp3
```

The trainer build has its own folder (`build/trainer-fw/`, generated headers included), so it never touches the
normal build or its tests. It installs like any BoopBox package; installing the normal BoopBox package goes back.

## Changing a song or a lesson

- `tools/trainer/songs.py` holds the scores (tracks, sounds, steps, drum lanes, locks, sections, song).
  `tools/trainer/render.py` renders them.
- `tools/trainer/lessons.py` holds each level's steps: a headline (up to 23 characters), an action (up to 30) and a
  goal (a track, a kit, a sound, a parameter, a pattern's notes or hits, the mutes, a lock, the patterns playing, a
  section saved, the song...). Notes and hits come from the score. It writes `trainer_lessons.h`, which the build
  compiles in.
- `firmware/src/trainer.c` checks the goals, draws the coach, lights the panel and adds the menu's TRAIN section.
- `tests/trainer_test.c` plays every level from the menu to DONE using the panel only (buttons, knob detents, keys),
  as a person following the steps would. It checks that every setting of each approved song is on the FM-1 at the end,
  and records level 3's song in song mode (`trainer-l3-song.wav`, to compare with the approved render).
