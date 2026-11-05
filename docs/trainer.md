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

| 4 | **Your song** | any | a song from an audio file: [the song page](#the-song-page) writes it, the installer puts it in the trainer (below: [Level 4](#level-4-the-song-area)) |

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

## Level 4: the song area

The trainer image keeps an 8 KiB **song area** (`TR_SLOT`, `firmware/src/trainer.c`) for one more level, a song made
somewhere else: [the song page](#the-song-page) turns an audio file into one. The song is written into the area
of the trainer package before it is installed, so it needs no new flash and no change to the update loader: installing
it again with another song replaces it, and the loader rewrites only the sectors that changed. Projects, samples and
settings are not touched.

- **On the FM-1.** With a song in the area the picker has four levels (the song is *LEVEL 4: YOUR SONG*) and its last
  page, BoopBox's menu, is the fifth. The song's coach is the same as the others': the same goals and hints, the same
  why pages (a song's steps name a topic of `tools/trainer/theory.py`). Without a song (or with an area that does not
  check out) there are three levels, as before.
- **Checked at power-on.** The area is checked field by field before it is used: the magic, the format, a CRC-32, every
  string (printable, short enough for the screen), every card's goal, track, button, topic and parameter, and every
  target (notes, drum lanes, locks, patterns, song entries) against the sizes the coach indexes; the last step, and only
  that one, is the DONE. A damaged area is no level 4, never a crash.
- **Progress** of level 4 is kept like the others' and belongs to its song (the record keeps a tag from the song's
  CRC): another song starts from its first step; the other levels' progress stays.
- **Size.** A song is a header, 16 bytes a step (up to 128 steps), the targets and the strings; the three built-in
  levels as songs take 2,166, 4,048 and 5,825 B, so a song as long as level 3 fits.

The format is in `tools/trainer/slot.py`. Two tools write it:

```
python3 tools/trainer/slot.py show build/trainer-fw/felucca-trainer.fwsc       # what the package's area holds
python3 tools/trainer/slot.py patch IN.fwsc SONG.bin OUT.fwsc                    # a song into a trainer package
python3 tools/trainer/slot.py clear IN.fwsc OUT.fwsc                             # the area emptied
```

and `web/trslot.js` in the browser (`encodeSong` from the steps' fields, `patchPackage`, `songAreaOf`). Both find the
area by its magic in the app, write it, and make every CRC on the way out again (app.bin's entry, the app area's head,
flash.bin's, the UFW list and header). `tests/trainer_slot_test.py` checks that a patched package is byte for byte the
package `fm1pkg_make.py` builds from the app with the song in it, and that the browser and `slot.py` agree.
`tests/trainer_test.c` writes level 2 as a song, plays it as level 4 from the picker to DONE with the panel alone, and
checks that damaged areas are refused and that the progress follows the song.

## The song page

[webapp/song/](https://josh-mcfarlin.github.io/boopbox/webapp/song/) (`web/song.html`, linked from the installer) makes
level 4 from an audio file, in the browser: nothing is uploaded, and there is no server.

1. **Listen** to the whole song (up to 6 minutes), in two passes:
   - **The form** (`structureOf`, a second or two): the whole file's tempo (the onsets' autocorrelation, near 110 BPM
     preferred), beat and bar (the kick), then each block of four bars as a fingerprint (its harmony, loudness, low end,
     highs, onsets). Similar blocks are grouped (average linkage, at most four groups, none closer than `TAU`, tuned on
     the trainer's renders) into sections A-D, named in the order they come; the song is their runs (at most 16
     entries, 64 bars each). Quiet blocks at the ends (silence, a fade) are left out.
   - **Each section, closely** (`analyzeSong`): its most typical block (the group's medoid), four bars, with the bar line
     found again there. The drums are split from the rest (harmonic / percussive separation: median filters on the
     spectrogram) and each lane's hits taken on the sixteenths, folded into one bar (the snare on the backbeat when it
     stands out there: its body is in the kick's band too).
     [Basic Pitch](https://github.com/spotify/basic-pitch-ts) (Spotify's note model, Apache-2.0; `web/vendor/`, served
     from the site with TensorFlow.js) finds the notes of the part without drums. A song of three or four sections takes
     a minute or two on a laptop.
   - One key for the song from all the notes (Krumhansl's profiles); in each section a bass line (the lowest note on
     each beat, four bars), a chord a bar (the scale's triad that holds most of the bar's notes), a lead (the highest
     note on each eighth, two bars, or sixteenths). A part a section has not (no drums in an intro) is muted there. Every
     note is moved onto the key and each line into one window of the keys (27 notes, F to G, an octave at a time).
2. **Compare**: the original and the FM-1 version, the whole song (its sections in turn, as song mode plays them) or a
   section on a loop (the original's drums, bass or the rest of it alone, too), played by BoopBox's engines in the
   browser (the editor's WebAssembly, `firmware/host/preview.c`; `web/songplay.js` replays the lesson's own steps,
   patterns, saved sections and song, so what plays is what the steps build). A section's drum grid takes clicks and
   its parts can be taken out; the key, a style (a kit and three sounds by tempo, `web/songsounds.js`) and each part's
   sound are the song's. The steps are listed as they will be on the FM-1.
3. **Install**: the page fetches the trainer package of the site, checks its SHA-256, writes the song into its song
   area (`web/trslot.js`) and installs it as the installer does (`web/fm1ota.js`).

`web/songgen.js` writes the steps the way `tools/trainer/lessons.py` writes the built-in levels (the same kinds of
step, buttons, pages and why topics). The tempo and the key; section A as a loop: the drums lane by lane, the bass
(the SEQ layer), the chords (typed on the NOTES page, a step a bar), the lead and an echo. Then, as level 3 does, the
other sections' new parts, each a pattern of its track (PATTERNS, the pattern's number, the notes typed on the NOTES
page; the same part again is the same pattern); then, stopped, each section: its patterns, its mutes, saved as A-D;
then the song on the SONG screen, song mode, and DONE. A whole song is 50 to 80 steps and about 4 KB; one that does not
fit (128 steps, 8 KiB) is made smaller (`fitLesson`: the later sections take section A's lead, then its chords, then
the last section is played as A), and the page says so. Every text is measured in the screen's font.
The firmware's numbers (goals, parameters, buttons, pages, kits, sounds as the trainer and as BoopBox number them, the
topics, the font's widths) come from `tools/trainer/consts.py`, which `web/make_site.py` runs.

Tests (`tests/run_tests.sh`): `tests/trainer_song_test.mjs` makes songs from four scores (one a whole song of three
sections and seven parts) and checks the FM-1 player plays each part, the sections in turn and the song's end; with
the renders (`python3 tools/trainer/render.py`), `tests/trainer_analyze_test.mjs` listens to the three songs whole, as
the page does (the tempo and the key of each, the sections found, level 1's beat, against their scores); the trainer
test then plays every one of those songs as level 4 to DONE with the panel alone (song mode included);
`tests/trainer_page_test.mjs` uses the page in Chromium (level 1's MP3 in, the song and a section on both players, the
package it installs).

On the renders: level 2 (verse 4, chorus 8, verse 4, chorus 8) comes out A4 B8 A4 B4 C4 (its last bars fade), level 3
(A4 B4 C8 D8 B4 C8 A4) A4 B4 C16 B4 C8 D4 (its second drop is heard as the first). It is an approximation: four parts,
each section's most typical four bars, the song in blocks of four bars, a steady tempo assumed. In a dense mix a bass on
eighths can look like a kick (level 2's render: its kick comes out on every eighth), and a sub bass two octaves down is
often missed; the drum grid and the parts' boxes are there to fix it.

## What the trainer build leaves out

To make room for the lessons (the app slot is full in the normal build), the trainer build has:

- **No web editor** (its SysEx; updates and USB rescue still work).
- **Three sample sets fewer:** HORNS, STRGS and SCRCH, with the sounds made from them (HORN STAB, STRING STB, SCRATCH,
  STR CLOUD, HORN CLOUD). GRAIN's DRONE plays on the PIANO set instead of the horns.

The trainer image is 562,396 B of the 581,564 B app slot (about 19 KB free); the coach and the lessons take about
39 KB with the why pages (about 18 KB of them), the song area 8 KiB and its checks about 1.5 KB; RAM: level 4's cards
(2.5 KB) and under 120 B more. Its progress uses the free flash sector at 0xFB000. The normal build is unchanged, byte for byte.

## Building and testing

```
./build.sh --trainer                    # build/trainer-fw/felucca-trainer.fwsc (version BOOPBOX TRAINER X.Y.Z)
./build.sh --trainer --release 1.4.3    # build/trainer-fw/felucca-trainer-1.4.3.fwsc
tests/run_tests.sh                      # includes the trainer test
python3 tools/trainer/render.py         # the songs to build/trainer/*.wav and .mp3
```

The trainer build has its own folder (`build/trainer-fw/`, generated headers included), so it never touches the
normal build or its tests. It installs like any BoopBox package; installing the normal BoopBox package goes back.

## Changing a song or a lesson

- `tools/trainer/songs.py` holds the scores (tracks, sounds, steps, drum lanes, locks, sections, song).
  `tools/trainer/render.py` renders them.
- `tools/trainer/lessons.py` holds each level's steps: a headline (up to 23 characters), an action (up to 30; `@` in
  it is the value wanted, as the screen shows it), the page a knob is on, and a goal (a track, a kit, a sound, a parameter, a pattern's notes or hits, the mutes, a lock, the patterns playing, a
  section saved, the song...). Notes and hits come from the score. It writes `trainer_lessons.h`, which the build
  compiles in.
- `firmware/src/trainer.c` checks the goals, draws the coach and the level picker, lights the panel and keeps the progress log.
- `tests/trainer_test.c` plays every level from the picker to DONE using the panel only (buttons, knob detents, keys),
  as a person following the steps would. It checks that every setting of each approved song is on the FM-1 at the end,
  that a step about keys lights only its keys, that the progress survives a power cycle, and records level 3's song in
  song mode (`trainer-l3-song.wav`, to compare with the approved render).
