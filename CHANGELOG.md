# Changelog

What changed in each BoopBox release, newest first. A release's section is its
release notes on GitHub: when a PR adds `docs/firmware/boopbox-X.Y.Z.fwsc`, it
must also add a `## X.Y.Z` section here (CI checks), and merging it into `main`
publishes the release with that section as its notes
(`.github/workflows/release-on-merge.yml`).

Write for the people who install it: what is new, what changed, what was fixed,
and whether projects, presets and settings from the version before still open.
Links are relative to the repository root; the release notes make them absolute.

Version tags such as *(2.6)* in the guides mark the SLOOP release that brought a
feature; SLOOP's own history is in [its repository](https://github.com/isod89/sloop-fm1).

## 1.4.2

**The sound browser stays open until you close it** (BoopBox and BoopBox Trainer):

- **SAVE** keeps the sound you are on and closes it (*SOUND KEPT*). **HOME** closes it and puts back the sound the
  track had when it opened (*SOUND PUT BACK*). It no longer goes back by itself after 4 s.
- SAVE tapped elsewhere opens the SAVE pages at USER (USER, SECTION, TOOLS); the browser is the PRESETS knob's.
- PATTERNS, SONG and CHORDS no longer show the bottom of the screen before's labels under their title.

**BoopBox Trainer**, from levels 1 and 2 played on the FM-1 ([the trainer](docs/trainer.md)):

- A sound step is done when you tap **SAVE** on the sound.
- With a note in hand on the SEQ layer, every step that wants it stays lit until all are in.
- Where ALGORITHM does not change the track (the DRUMS grid, the SONG screen, a button held) the step says *TAP HOME*
  first.
- Values read as their screen shows them: HOME's LEVEL *77* (not *-8*), PAN *-20*, LEN *4* with SEQ held.
- The PATTERNS steps say the next press from any track: which track, *KNOB 1 TO PATTERN 2*, *KNOB 4 RIGHT TWICE:
  COPY*, *PRESS OCT+ TO PLAY IT*. From a drum track (SEQ opens its drum grid): *ALGORITHM TO 1, THEN SEQ*.
- Drum steps off the drum grid say how to get there (*TAP SEQ: THE DRUM GRID*).

Projects, songs, presets, settings and the trainer's progress from 1.4.1 open as they are.

## 1.4.1

**BoopBox Trainer** after its first player went through level 1 ([the trainer](docs/trainer.md)):

- **A level picker.** Hold **HOME**: one level a page (the song, its style, what it teaches, your progress). **SELECT**
  turns the pages and **OCT+** starts or continues; KNOB 1 picks SKIP, GO BACK, START OVER or QUIT. The last page opens
  BoopBox's menu.
- **Progress is never lost.** It was kept only while stopped, so switching off while playing lost it. It now goes to
  its own flash sector after every step, playing or not.
- **Only the keys to press are lit.** BoopBox's beat markers and the steps already placed no longer light up on a step
  about keys, and every step still to fix on the page is lit, not one.
- **Hints say what is wrong and what to do:** *STEP 5: NO KICK HERE (KEY 5)*, *STEP 9: PLAY F4 (KEY 7)*, *STEP 3:
  PRESS OCT+*, *KNOB 1 TO SNARE*, *OPEN THE TIMING PAGE*.
- **Values as the screen shows them.** *TURN KNOB 4 TO 30* while the screen said *30%* for another value: the steps now
  show the value as the page does (*24%*, *1/8*, *86 BPM*) and the hint shows both (*NOW 30% (WANT 24%)*).
- **The way there, spelled out:** steps say which button opens the page (*TAP SEQ UNTIL YOU SEE TIMING*) and which knob
  does what, with no words such as "SEQ PAGES".
- **The sound browser's dot stays** on the group and the sound to pick, highlighted or not, until you tap HOME on it.

BoopBox itself is unchanged in this release (only its version number). Projects, songs, presets and settings from
1.4.0 open as they are; the trainer's progress from 1.4.0 starts again.

## 1.4.0

**BoopBox Trainer**, a second firmware that teaches you to make three songs on the FM-1 itself, step by step, with no
manual ([the trainer](docs/trainer.md)):

- **Pick it in the installer.** The installer now offers **BoopBox** or **BoopBox Trainer**. Installing the other one
  switches back at any time.
- **Three levels, three songs:** *First Light* (lo-fi hip-hop: tracks, kits, drum steps, notes on steps, key and scale,
  chords), *Neon Avenue* (synthwave: the NOTES page, drum levels and ratchets, the sound browser, the delay, patterns
  for a verse and a chorus) and *Lanterns* (melodic dubstep: eight tracks, envelopes, the pump, a lock that slides, a
  roll with ratchets, sections and the song). Take them in any order, and again whenever you like.
- **A coach on the screen:** the title line says what the step is about and what to do, and what is still off
  (*STEP 8: KICK MISSING*). The button to press blinks, and the keys to play or the steps to press are lit. In the
  sound browser, a fading dot marks the sound to pick. It checks what the FM-1 does, not which buttons you pressed, so
  any way of getting there counts. Every button, knob and key works as in BoopBox.
- **Hold HOME** for the menu's **TRAIN** section: the levels with your progress, and in a level SKIP, BACK, RESTART and
  QUIT. Progress is kept when the FM-1 is switched off. A level starts from a new project.
- To make room, the trainer has **no web editor** and **three sample sets fewer** (HORNS, STRGS, SCRCH: HORN STAB,
  STRING STB, SCRATCH, STR CLOUD and HORN CLOUD; GRAIN's DRONE plays on the piano).

BoopBox itself is unchanged in this release (only its version number). Projects, songs, presets and settings from
1.3.1 open as they are.

## 1.3.1

A tuning fix for TANPURA, and room in the firmware:

- **TANPURA stays in tune on the top notes.** The PHYS sympathetic strings (the ones that ring along with the string you
  play) are tuned an octave below and an octave or two above it. On the top octaves those partners landed above 5 kHz,
  where their loop is only two or three samples long and its gain is at the limit. They rang several times louder than
  the string you played, into the soft clip, and the level changed with every pluck: the top notes came out up to 60
  cents off, about one pluck in twenty. Partners above 4.4 kHz are left out now. At E7 the worst of 60 plucks is 11
  cents off (it was 59), and at C7 it is 10 (it was 41). Only the highest notes of a SYMP sound change; SITAR and
  PHYS HARP were not affected on the notes measured, and no other engine changed.
- **4.7 KB more room in the firmware** (the app is 575,316 B; 6,248 B of the 581,564 B slot are free, up from 1,540 B).
  The sequencer, voice and set-up code is compiled for size, four tables that only held an initial value no longer
  take flash, and a few repeated routines are shared. Nothing was taken out and no sound or screen changed.
- Projects, songs, presets and settings from 1.3.0 open as they are, and a saved project sounds as it did.

## 1.3.0

Even loudness between the factory sounds, and a drum LEVEL that turns:

- **The drum track's LEVEL works on TRACKS.** KNOB 2 on a drum track changed nothing you could hear or see (the level
  stayed at 100). It now sets the drum track's level, as GLO → DRUMS and the mix layer already did.
- **The factory sounds are as loud as each other** at a normal MASTER. Each preset's level trim was measured with
  MASTER all the way up, where the master limiter held almost every sound at the same peak. Punchy sounds read quiet
  there, took a big trim, and came out the loudest at the MASTER you play at: 32 presets were more than 3 dB off,
  PHYS HARP 7.5 dB too loud. They are measured below the limiter now: 98 presets moved (90 quieter, 8 louder), and at
  the power-on MASTER 5 are more than 3 dB off and none is more than 0.3 dB too loud. Many sounds you know, such as
  RHODES, ACID 303 and the stabs, are quieter than in 1.2.0.
- **LEVEL turns every sound up.** On 39 presets, turning LEVEL above its default did nothing: their trim had used up
  the top of the range. A trim may now go past it, so LEVEL keeps its whole range on every sound.
- Still quiet, because their peaks reach the master limiter first: CHIP NOISE, REGGAE ORG, NZ SNARE, BANJO and
  MUTED GTR.
- The editor's sound preview plays the new levels.
- Projects, songs, presets and settings from 1.2.0 open as they are. A saved project keeps the trims it was saved
  with, so it sounds as it did; a factory preset chosen again takes its new trim.

## 1.2.0

A cleaner screen and quicker controls, after a review of every screen
([the review](docs/ux-review/README.md), [every screen before and after](docs/ux-review/before-after-all.png)):

- **Every value once, large, in its knob's corner.** The 29 pages without a graph (EDIT, VOICE, the DEST pages,
  GLOBAL, MASTER, DLY…) showed each value twice: small in columns along the top and large below. They now show the
  four values once, large, from just under the header: KNOB 1 top left, 2 top right, 3 bottom left, 4 bottom right,
  each label in its knob's colour.
- **Whole words.** Labels and values were cut at five letters (*TARGE MASTE*); they now keep up to eight
  (*TARGET MASTER*).
- **Page tabs.** The bottom line names the page between the one before and the one after it (what SELECT or the
  button again brings), with a dot a page; the track's sound moved into the header, once.
- **ALGORITHM picks the track on every page** (it worked on TRACKS, PATTERNS and CHORDS only). The page stays and the
  header says *TRACK 3: LOFI FLUTE* for a moment.
- **GLO has five pages** (GLOBAL, MASTER, DRUMS, TEXTURE, TEXTURE 2; it had ten). The MIDI setup has its own pages,
  from the menu: hold HOME, SELECT to **SEQ**, OCT+ on **MIDI SETTINGS**. They are MIDI (CH1–4), MIDI 2 (CH5–8),
  MIDI 3 (IN, OTHER, OUT, BEND), MIDI 4 (FX CH, DR MAP, REMOTE, CLOCK) and SYSTEM (SYNC, USB). No setting is on two
  pages any more.
- **FX → FILTER** holds the INSERT's MIX too (the one-value INSERT 2 page is gone): FX has seven pages.
- **GLO held shows faders:** the bank's four levels, with mute and solo under each, and FILL, BAR and the tap tempo
  below. The keys do what they did.
- **The step's sheet says what OCT− and OCT+ do** (NOTES, OCT+ held): *OCT− CLOSE · OCT+ SLIDE*, *OCT+ OPEN*,
  *OCT− BACK · OCT+ ADD*.
- **The ENV curve in its knobs' colours:** attack, decay, sustain and release each in the colour of the knob that
  sets it.
- Settings that act on a second detent say *TURN AGAIN*.
- Projects, songs, presets and settings from 1.1.0 open as they are.

## 1.1.0

- **A sound browser.** On TRACKS, PRESETS on a synth track opens the engines (or the kinds of sound) on the left
  and their sounds on the right: PRESETS or KNOB 2 moves through the sounds (each one loads as
  you land on it), SELECT or KNOB 1 jumps to the next group, KNOB 3 shows them by ENGINE or by KIND, KNOB 4 marks a
  favourite. It closes by itself after 4 s; it replaces the SAVE > PRESETS page. The drum track's PRESETS is still the
  kit.
- **A new visualiser.** Six scenes at sunset and in neon replace the twelve styles, all built in beside the web
  editor: PALMS (the mix's wave as the sea's front wave), NIGHT DRIVE (the spectrum as a city, a car on a road that
  runs with the beat, its lights flaring on the kick; stopped, it slows down and parks), HORIZON (the spectrum as a
  neon range over a floor that lights up on the beat in the tracks' colours), FLYOVER (the spectrum over time as a
  terrain), DENSE CITY (the eight tracks and the mix as towers of 24 floors with peak holds) and KEY CITY (a tower per
  key, lit in the colour of the track that plays it; a chord lights all its keys). See
  [the visualiser](BOOPBOX.md#the-visualiser).
- **SYNTHWAVE, the new look** (the default; MENU → SCREEN → COLOR picks another): night indigo, the tracks in cyan, magenta,
  sunset orange and violet (5–8 periwinkle, rose, gold, orchid), neon rules with a glow under the headers, large
  values fading from pink to orange, a neon floor to the horizon where a page has an empty half, and a sun setting on
  the boot screen. An FM-1 that already has a colour set keeps it; the other palettes and your theme look as before.
  The web editor's Theme page can start from it. See [every screen](assets/screens/all/README.md).
- **SEQ → PATTERN is now TIMING** (LEN, DIV, SWG, GATE), so it no longer reads like the PATTERNS screen next to it.
- **FLYOVER keeps flying:** while the song plays the ground always moves, silent bars too; after STOP it moves on until
  the last peak has gone off the back of the screen.
- **The web editor has eight tracks.** The track bar, the Tracks page and the LIVE page show tracks 1–8 (tracks 5–8 in
  their own shades); a drum track is any track whose kind is drums (4 and 8 by default), and its level and sends are its
  own. LIVE solos any track (protocol v13: 32 bytes of firmware).
- **A Patterns page in the editor:** each track's eight patterns (play one, copy, clear), its chain, FOLLOW, a pattern's
  step components (with direction and seed) and the song's chord progression. The editor reads the FM-1's working
  project, changes it, and sends it back whole; nothing changes until you press Send, and the song must be stopped.
- **The Song page keeps the loop region** (it used to drop it when sending) and edits it: *Loop the entries* from … to ….
- **SLOOP 2.8.4's fixes.** Clean fades (no distortion at the end of notes on the 3.5 mm output and USB), UNISON no
  longer stacks its voices in phase, PHYS strings in tune, NOISE's NZ ARCADE, SAMPLE and GRAIN follow the top keys,
  a firm press on a layer button opens its pages, on REC READY a knob changes only its own value, and more
  ([SLOOP's releases](https://github.com/isod89/sloop-fm1)).
- **Room in the flash.** Three tables (FM6's exponent, the sine, the screen font) are built in RAM when the FM-1
  starts instead of stored in the flash: byte for byte the same, so the sound and the screens do not change, and the
  build fits again with the fixes and the visualiser
  ([docs/groovebox-performance.md](docs/groovebox-performance.md)).
- The CHORDS screen no longer shows what the page before it left under the track buttons (the TRACKS screen's dials,
  for one).
- Projects, backups, songs, presets and settings from 1.0.0 open as they are; the visualiser style kept with the
  settings opens as one of the new six.

## 1.0.0

- **BoopBox.** SLOOP 2.8.3 under its own name: the boot screen, the ABOUT page, the USB device (*BoopBox*;
  *BoopBox Update* while updating), the web editor and the installer. The installer also updates an FM-1 that runs
  SLOOP or Felucca, and the editor still finds one. BoopBox keeps eight tracks in its own project format: projects,
  sections and songs from SLOOP do not open in BoopBox, and SLOOP does not open BoopBox's. Presets, samples, the FM6
  bank and themes carry over.
- **Eight tracks.** Six synths and two drum machines by default (tracks 4 and 8); any track can be either
  (SAVE → TOOLS → KIND). The screens show the bank of four the selected track is in (1–4 or 5–8). MIDI channels for
  tracks 5–8 (MIDI 2).
- **Each track its own colour.** Tracks 5–8 take a lighter shade of the colours of 1–4 (a darker one on a light
  theme), your own theme's too.
- **Patterns, step components, harmony, performance effects.** Eight patterns a track with chains and quantized
  changes (the PATTERNS screen); 14 step components; 32 parameter locks a track and SLIDE; the song's key, scale and a
  chord progression that tracks can follow (the CHORDS screen); punch-in effects with a target, latch and quantize.
  See [the groovebox controls](docs/groovebox-controls.md).
- **The visualiser,** with six styles: oscilloscope, spectrum, VU meters, circle, bounce, wires (tap HOME on TRACKS).
- **Its own art:** a new logo, the parameter icons and the synthesized drums are drawn and made by code in this
  repository (GPL-3.0); see [LICENSING.md](LICENSING.md).
- **Left out to fit the flash:** six of the visualiser's twelve styles, the bitmap boot logo (the boot screen shows the
  name as text) and the top recording of the BASS sample set
  ([docs/groovebox-status.md](docs/groovebox-status.md)).
- **Known limits:** the web editor shows tracks 1–4 only (its LIVE page and track list) and does not edit patterns 2–8,
  step components or the chord progression (backups keep them). *Lifted in 1.1.0: see [1.1.0](#110).*
