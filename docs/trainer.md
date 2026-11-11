# BoopBox Trainer

The trainer is a separate build of BoopBox that teaches three songs on the FM-1 itself, with no manual: a coach on the
screen says what to do, lights the button and the keys to press, and moves on when the FM-1 is in the state the step
asks for. Everything else is BoopBox: every screen, button, knob and key works as it does there, so what you learn
works on BoopBox too.

| Level | Song | Style | What it teaches |
| --- | --- | --- | --- |
| 1 | **First Light** | lo-fi hip-hop, 86 BPM, A minor, 4 tracks | choosing tracks, kits and sounds; the DRUMS grid; notes on steps with the SEQ layer; key and scale; chord mode; DIV, LEN, GATE; swing; sends; mutes to perform it |
| 2 | **Neon Avenue** | synthwave, 104 BPM, D minor, 5 tracks | the NOTES page (typing a line, chords, LEN, accents); drum levels and a ratchet; track 5; the sound browser; the delay; pan and level; patterns played on the keys; **scenes** for a verse and a chorus, launched on white keys 9 and 10; a drum **chain** with repeats (verse beat ×3, then a fill) |
| 3 | **Lanterns** | melodic dubstep, 150 BPM, D minor, 7 tracks | an 8-track drop; envelopes; the DUCK pump; patterns per section; a 64-step roll with ratchets; a lock with SLIDE; mutes and sections A–D; the SONG screen and song mode |

The songs were rendered for approval with the firmware's own engines on a computer (`tools/trainer/render.py`); the
lessons' targets are taken from the same score, and `tests/trainer_test.c` checks that the song the lessons build is
that song.

## On the FM-1

- **The level picker.** The first start opens it; later, hold **HOME**. It shows one level a page: the song, its style
  and tempo, what it teaches and your progress. Turn **SELECT** (or ALGORITHM) for the next page; **OCT+** does the
  action on the bar (**START**, **CONTINUE**, **PLAY IT AGAIN**), and **KNOB 1** picks another one when there are
  several (in a level: **SKIP THIS STEP**, **GO BACK A STEP**, **START OVER**, **QUIT THE LEVEL**). **OCT-** closes it.
  Its last page opens BoopBox's menu (screen, lights, audio, MIDI...).
- **Why (1.4.3).** Holding HOME during a level opens, before the picker, the music behind the step you are on: what
  it does and why it sounds that way (the backbeat, syncopation, the minor scale, seventh chords, voice leading,
  half-time, the side-chain pump, song form...), two screens a topic. SELECT turns the pages, then on to the levels;
  OCT- closes. The text is `tools/trainer/theory.py`; `tools/trainer/lessons.py` says which topic each step has.
- **A level** starts from a new project, replacing the loop there without asking (level 3 also replaces the sections
  A–D when you save them). A level left half way goes on where it was left; the steps since its last change of pattern
  or section are checked again, so one the loop lost (BoopBox keeps the loop only while stopped) comes back.
- **The coach** takes the screen's title area. On the TRACKS, DRUMS, PATTERNS and SONG screens and while a layer is
  held it has two lines: the step's number and headline (or what is still wrong, in amber), then the action. On the
  pages it has one line, which shows them in turn. The coloured bar under it is the level's progress.
  - Actions say where to go and what to turn, with the value as the screen shows it: *TAP SEQ UNTIL YOU SEE TIMING*,
    then *TURN KNOB 4 (GATE) TO 79%*.
  - (1.5.1) A line wider than the screen scrolls like a ticker: still for 1.2 s, a pixel every 25 ms to its end, still
    again, then from its start; on one line a scrolling line keeps its turn until all of it has shown.
  - When something is off, the hint says what and how to fix it: *STEP 5: NO KICK HERE (KEY 5)*, *STEP 9: PLAY F4
    (KEY 7)*, *STEP 3: PRESS OCT+*, *NOW 30% (WANT 24%)*, *OPEN THE FX PAGE*, *TRACK 6: MUTE (GLO + KEY 2)*.
  - The button to press **blinks**. On a step about keys the coach owns the keys' lights: only the keys to press are
    lit (every step of the page still to fix, blinking), not BoopBox's beat markers or the steps already there.
  - In the sound browser, a dot fading in and out marks the group and the sound (or kit) to pick, whichever is
    highlighted, and stays until the step is done. The step is done when you tap **SAVE** on that sound (HOME puts
    the sound back).
  - The coach checks the result, not the buttons: any way of getting there counts.
  - When the step is right it says **NICE!** and the next step comes.
- **Progress** is written to its own flash sector a few bytes at a time, after every step, while the music plays too:
  switching off never loses more than the step you were on. A finished level shows *DONE* on its page. Levels can be
  taken in any order.

## What the trainer build leaves out

To make room for the lessons (the app slot is full in the normal build), the trainer build has:

- **No web editor** (its SysEx; updates and USB rescue still work).
- **Three sample sets fewer:** HORNS, STRGS and SCRCH, with the sounds made from them (HORN STAB, STRING STB, SCRATCH,
  STR CLOUD, HORN CLOUD). GRAIN's DRONE plays on the PIANO set instead of the horns.
- **8 synth voices shared, not 20** (1.6.0): the budget its songs were made and approved with.

The trainer image is 561,440 B of the 581,564 B app slot (about 20 KB free); the coach and the lessons take about
39 KB with the why pages (about 18 KB of them); RAM: under 120 B. Its progress uses the free flash sector at 0xFB000.
The normal build is unchanged, byte for byte.

Until 1.9.1 the trainer also had a **level 4**, a song made from an audio file on a web page (the song page) and written
into an 8 KiB song area of the trainer package. Both are gone (9,348 B of flash and 2.6 KB of RAM back); a progress
record from before that was in level 4 opens on the three levels, their progress kept.

## Building and testing

```
scripts/build.sh --trainer                    # build/trainer-fw/felucca-trainer.fwsc (version BOOPBOX TRAINER X.Y.Z)
scripts/build.sh --trainer --release 1.4.3    # build/trainer-fw/felucca-trainer-1.4.3.fwsc
tests/run_tests.sh                      # includes the trainer test
python3 tools/trainer/render.py         # the songs to build/trainer/*.wav and .mp3
```

The trainer build has its own folder (`build/trainer-fw/`, generated headers included), so it never touches the
normal build or its tests. It installs like any BoopBox package; installing the normal BoopBox package goes back.

## Changing a song or a lesson

- `tools/trainer/songs.py` holds the scores (tracks, sounds, steps, drum lanes, locks, sections, song).
  `tools/trainer/render.py` renders them.
- `tools/trainer/lessons.py` holds each level's steps: a headline (up to 23 characters), an action (up to 30; `@` in
  it is the value wanted, as the screen shows it), the page a knob is on, and a goal (a track, a kit, a sound, a parameter, a pattern's notes or hits, the mutes, a lock, the patterns playing, a scene's name and patterns, the scene playing, a track's chain, a
  section saved, the song...). Notes and hits come from the score. It writes `trainer_lessons.h`, which the build
  compiles in.
- `firmware/src/trainer.c` checks the goals, draws the coach and the level picker, lights the panel and keeps the progress log.
- `tests/trainer_test.c` plays every level from the picker to DONE using the panel only (buttons, knob detents, keys),
  as a person following the steps would. It checks that every setting of each approved song is on the FM-1 at the end,
  that a step about keys lights only its keys, that the progress survives a power cycle, and records level 3's song in
  song mode (`trainer-l3-song.wav`, to compare with the approved render).
