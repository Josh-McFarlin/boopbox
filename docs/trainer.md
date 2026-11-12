# BoopBox Trainer

BoopBox Trainer is a separate build of BoopBox. It teaches three songs on the FM-1 itself, without a manual. A coach on
the screen tells you what to do. It lights the button and the keys to press. When the FM-1 is in the state that the
lesson step asks for, the coach goes to the next lesson step.

All other functions are as in BoopBox. Every screen, button, knob and key works the same. Thus, what you learn in the
trainer also works in BoopBox.

This page is correct for BoopBox Trainer 1.9.3.

## The levels

The trainer has three levels. Each level teaches one song.

| Level | Song | Style | Tempo | Key | Tracks | Lesson steps | What the level teaches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **First Light** | lo-fi hip-hop | 86 BPM | A minor | 4 (tracks 1–4) | 37 | how to select tracks, kits and sounds, the DRUMS grid, notes on steps with the SEQ layer, key and scale, chord mode, DIV, LEN and GATE, tempo, swing, the delay and reverb sends, mutes for a performance |
| 2 | **Neon Avenue** | synthwave | 104 BPM | D minor | 5 (tracks 1–5) | 71 | the NOTES page (type a line, chords, LEN, accents), drum levels and a ratchet, track 5, the sound browser, the delay, pan and level, patterns on the keys, **scenes** for a verse and a chorus (white keys 9 and 10), a drum **chain** with repeats (the verse beat ×3, then a fill) |
| 3 | **Lanterns** | melodic dubstep | 150 BPM | D minor | 7 (tracks 1, 2 and 4–8) | 110 | a second drum track (track 8), the envelope, the DUCK pump, the delay, a pattern for each section, a 64-step roll with ratchets, a lock with SLIDE, mutes and sections A–D, the SONG screen and song mode |

The tempo, key and tracks are in `tools/trainer/songs.py`. The lesson steps are in `tools/trainer/lessons.py`.

Before 1.9.1, the trainer also had a level 4 (*YOUR SONG*). A web page (the song page) made this level from an audio
file. 1.9.1 removed level 4, its song page and its 8 KiB song area. Now, the fourth page of the level picker opens
BoopBox's menu.

`tools/trainer/render.py` renders the songs on a computer with the engines of the firmware. The lessons take their
targets from the same score. `tests/trainer_test.c` makes sure that the song that the lessons build is that song.

## On the FM-1

### The level picker

The level picker opens at the first start. To open it later, hold **HOME**. The picker has four pages:

| Page | What it shows |
| --- | --- |
| 1–3 | One level: the song, its style and tempo, what it teaches, and your progress (*NOT STARTED*, *STEP 5 OF 37* or *DONE*) |
| 4 | *MORE SETTINGS*: BoopBox's menu (screen, lights, audio, MIDI, calibration, about) |

Use the picker as follows:

1. To go to the next or the previous page, turn **SELECT** or **ALGORITHM**.
2. If a page has more than one action, turn **KNOB 1** or **PRESETS** to select the action.
3. To do the selected action, press **OCT+**.
4. To close the picker, press **OCT-**.

The actions on a level page are these:

| Level state | Actions |
| --- | --- |
| Not started | **START** |
| Started, not running now | **CONTINUE**, **START OVER** |
| Running now | **CONTINUE**, **SKIP THIS STEP**, **GO BACK A STEP**, **START OVER**, **QUIT THE LEVEL** |
| Done | **PLAY IT AGAIN** |

On page 4, the only action is **OPEN THE MENU**.

### Why each lesson step (1.4.3)

If you hold HOME during a level, the "why" pages open before the picker. They explain the music behind the current
lesson step. They tell what it does and why it sounds that way.

There are 47 topics. Examples are the backbeat, syncopation, the minor scale, seventh chords, voice leading, half-time,
the side-chain pump, scenes, chains and song form. Each topic has two screens, but SECTIONS has three (95 screens in total).

1. To turn the pages, turn **SELECT** or **ALGORITHM**.
2. After the last page, turn **SELECT** again to go to the level picker.
3. To close, press **OCT-**.

The text is in `tools/trainer/theory.py`. `tools/trainer/lessons.py` gives the topic of each lesson step.

### A level

A level starts from a new project. It replaces the loop in the FM-1 and does not ask first. Level 3 also replaces the
sections A–D when you save them.

When you continue a level, it starts at the lesson step where you stopped. The coach looks at the lesson steps again
from the last change of pattern or section. If a step no longer holds, the level continues from that step. BoopBox
saves the loop only while it is stopped, so the loop can be older than the progress.

When you start a level from its start, the progress of the other levels that are not done goes back to zero. Their
loops are not in the new project.

### The coach

The coach uses the title area of the screen.

- On the TRACKS, DRUMS, PATTERNS, SONG and CHORDS screens, REC, the visualizer, and while you hold a layer button, the
  coach has two lines. Line 1 shows the lesson step number and headline, or what is still wrong (in amber). Line 2 shows the
  action.
- On the parameter pages and in the sound browser, the coach has one line. The headline, the action and the hint show
  in turn on this line.
- The colored bar under the coach shows the progress in the level.

The actions tell you where to go and what to turn. They give the value as the screen shows it. Examples are
*TAP SEQ UNTIL YOU SEE TIMING* and then *TURN KNOB 4 (GATE) TO 79%*.

A line that is wider than the screen scrolls like a ticker (1.5.1). It stays still for 1.2 s. Then it moves one pixel
every 25 ms until its end shows. Then it stays still again and starts again from its start. On the one-line coach, a
scrolling line keeps its turn until all of it has shown. A hint can have up to 47 characters.

When something is wrong, the hint tells you what is wrong and how to correct it. Examples:

- *STEP 5: NO KICK HERE (KEY 5)*
- *STEP 9: PLAY F4 (KEY 7)*
- *NOW 30% (WANT 24%)*
- *OPEN THE FX PAGE*
- *TRACK 6: MUTE (GLO + KEY 2)*

The button to press **blinks**. On a lesson step about keys, the coach controls the key lights. Only the keys to press
are lit. Every step of the page that is still wrong blinks. BoopBox's beat markers and the steps that are already
correct are not lit.

In the sound browser, a dot that fades in and out marks the group and the sound (or kit) to select. The dot stays
until the lesson step is done. The lesson step is done when you tap **SAVE** on that sound. **HOME** puts the old sound
back.

The coach looks at the result, not at the buttons that you pressed. Thus, any way to get the result is correct. When
the lesson step is correct, the coach shows **NICE!** for 0.7 s. Then the next lesson step comes.

### Progress

The trainer writes the progress to its own flash sector after each lesson step. It writes 16 B at a time, also while
the music plays. Thus, if you switch off the FM-1, you lose at most the current lesson step.

A level that is done shows *DONE* on its picker page. You can do the levels in any order.

If a progress record from before 1.9.1 was in level 4, the trainer starts with no level running. The progress of
levels 1–3 stays.

## What the trainer build leaves out

The app slot is full in the normal build. To make space for the lessons, the trainer build has these differences:

| Item | In the trainer build |
| --- | --- |
| Web editor | Not included (no editor SysEx). Updates and USB rescue still work. |
| Sample sets | HORNS, STRGS and SCRCH are not included. |
| Sounds | HORN STAB, STRING STB, SCRATCH, STR CLOUD and HORN CLOUD are not included. GRAIN's DRONE plays on the PIANO set, not on HORNS. |
| Synth voices | 8 shared voices, not 20 (1.6.0). The songs were made and approved with this budget (`NVBUDGET` in `firmware/src/core.h`). |

Sizes, as measured:

- In 1.9.1, the trainer image was 561,440 B of the 581,564 B app slot (about 20 KB free). RAM for the coach was less than 120 B.
- In 1.4.3, the coach and the lessons used about 39 KB of flash. The "why" pages used about 18 KB of this.
- 1.9.1 made the trainer image 9,348 B smaller than in 1.9.0.

The progress uses the free flash sector at 0xFB000 (`FL_TRN_LO` in `firmware/hal/fm1_flash_map.h`). The trainer build
does not change the normal build, byte for byte.

## Building and testing

```
scripts/build.sh --trainer                    # build/trainer-fw/felucca-trainer.fwsc (version BOOPBOX TRAINER X.Y.Z)
scripts/build.sh --trainer --release 1.9.3    # build/trainer-fw/felucca-trainer-1.9.3.fwsc
tests/run_tests.sh                            # includes the trainer test
python3 tools/trainer/render.py               # the songs to build/trainer/*.wav and .mp3
python3 tools/build_emu.py --trainer          # the trainer in the browser emulator (BUILDING.md)
```

The trainer build has its own folder, `build/trainer-fw/`, with its own generated headers. Thus, it does not change the
normal build or its tests.

`tools/trainer/render.py` needs `build/gen` (from `tests/run_tests.sh` or `tools/build.py`). It makes the .mp3 files
only if `ffmpeg` is installed.

The trainer package installs like all BoopBox packages. To go back, install the normal BoopBox package.

## Changing a song or a lesson

| File | What it holds |
| --- | --- |
| `tools/trainer/songs.py` | The scores: tracks, sounds, steps, drum lanes, locks, sections and the song. `SONGS` holds the three songs of the trainer. |
| `tools/trainer/render.py` | Renders the scores to audio. |
| `tools/trainer/lessons.py` | The lesson steps of each level. It writes `trainer_lessons.h`, which the build compiles in. |
| `tools/trainer/theory.py` | The text of the "why" pages. |
| `firmware/src/trainer.c` | Looks at the goals, draws the coach and the level picker, lights the panel and keeps the progress log. |
| `tests/trainer_host.c` | Runs the UI of the trainer firmware on the host, with the real sequencer, song mode and coach. |
| `tests/trainer_test.c` | Plays each level from start to end on the host. |

Each lesson step in `tools/trainer/lessons.py` has these parts:

- A headline, up to 23 characters.
- An action, up to 30 characters. In an action, `@` is the value to set, as the screen shows it.
- The page that the knob is on.
- A goal. The goal types are these:
  - a track, a kit, a sound or a parameter
  - the notes or hits of a pattern, or a lock
  - the mutes, or the patterns that play
  - the name and patterns of a scene, or the scene that plays
  - the chain of a track
  - a saved section, or the song

The notes and hits come from the score.

`tests/trainer_test.c` plays each level from the picker to DONE. It uses only the panel (buttons, knob detents and
keys), as a person who obeys the lesson steps. The test makes sure that:

- Each setting of each approved song is on the FM-1 at the end.
- A lesson step about keys lights only its keys.
- The progress stays after a power cycle.
- Level 2 ends with the scenes VERSE and CHORUS and the drum chain.
- Level 3 has the sections A–D saved and a song of 7 entries in song mode.

The test also records the song of level 3 in song mode to `trainer-l3-song.wav`. Compare it with the approved render.
