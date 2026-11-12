<p align="center"><img src="assets/logo/boopbox-logo.png" alt="BoopBox" width="420"></p>

# BoopBox 1.9.4 — The Complete Guide

This guide gives all the functions of BoopBox in one place: every button, every combination and every page. Read it from the top the first time. Then use it as a reference. The [cheat sheet](#26-cheat-sheet) at the end gives every combination on one page.

BoopBox is a free, open-source (GPL-3.0) firmware for the M-VAVE FM-1. It is based on [SLOOP](https://github.com/isod89/sloop-fm1) by isod89. SLOOP is based on [Felucca](https://github.com/hugelton/Felucca) by Leo Kuroshita / Hügelton Instruments. The short manual is [BOOPBOX.md](BOOPBOX.md). The project page is [README.md](README.md).

---

## How to read this guide

| Written | Means |
| --- | --- |
| **tap FX** | press FX and let go quickly (in less than about half a second). Do not touch other controls |
| **hold FX** | keep FX pressed |
| **FX + key 3** | hold FX. While you hold it, press white key 3 |
| **FX + KNOB 2** | hold FX. While you hold it, turn KNOB 2 |
| **SEQ + step + KNOB 4** | hold SEQ, hold a step key and turn KNOB 4 |
| **key 1 … key 16** | the 16 white keys, from the lowest (**F3** = key 1) to the highest (**G5** = key 16) |
| **GO** | a value that does an action (LOAD, SAVE, NEW…). Turn it one click. *TURN AGAIN: …* shows. To do the action, turn it one more click in less than about 1.5 s |

The 16 white keys, with their numbers:

| Key | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Note | F3 | G3 | A3 | B3 | C4 | D4 | E4 | F4 | G4 | A4 | B4 | C5 | D5 | E5 | F5 | G5 |

The 11 black keys are F#3, G#3, A#3, C#4, D#4, F#4, G#4, A#4, C#5, D#5, F#5. The "first four black keys" are F#3, G#3, A#3 and C#4.

---

## Contents

1. [Install and update](#1-install-and-update)
2. [The panel](#2-the-panel)
3. [The big ideas: tracks, colours, tap and hold](#3-the-big-ideas-tracks-colours-tap-and-hold)
4. [Your first beat in 60 seconds](#4-your-first-beat-in-60-seconds)
5. [Every button, alone](#5-every-button-alone)
6. [Playing the keys](#6-playing-the-keys)
7. [The drum track](#7-the-drum-track)
8. [Recording](#8-recording)
9. [The layers, one by one](#9-the-layers-one-by-one)
10. [The step sequencer: steps, nudge, locks, fills](#10-the-step-sequencer-steps-nudge-locks-fills)
11. [Key, scales, chords and CHORD+](#11-key-scales-chords-and-chord)
12. [Mix: levels, mute, solo, fills, tap tempo](#12-mix-levels-mute-solo-fills-tap-tempo)
13. [Undo, clear, save, sections, autosave](#13-undo-clear-save-sections-autosave)
14. [Song mode: sections, chains, songs](#14-song-mode-sections-chains-songs)
15. [The screens](#15-the-screens)
16. [Every page, knob by knob](#16-every-page-knob-by-knob)
17. [The sounds and the thirteen engines](#17-the-sounds-and-the-thirteen-engines)
18. [Effects: master, punch-in, per track](#18-effects-master-punch-in-per-track)
19. [The visualiser](#19-the-visualiser)
20. [The HOME menu and the lights](#20-the-home-menu-and-the-lights)
21. [MIDI](#21-midi)
22. [USB audio](#22-usb-audio)
23. [Your own samples and drum kits](#23-your-own-samples-and-drum-kits)
24. [The web editor](#24-the-web-editor)
25. [Backup, rescue, going back, troubleshooting](#25-backup-rescue-going-back-troubleshooting)
26. [Cheat sheet](#26-cheat-sheet)

---

A version tag shows the release that added a feature. *(1.8)* and other 1.x tags are BoopBox releases ([CHANGELOG.md](CHANGELOG.md)). *(2.6)* and other 2.x tags are SLOOP releases ([SLOOP's repository](https://github.com/isod89/sloop-fm1)).

---

## 1. Install and update

**From the browser (recommended).** Open the [installer page](https://boopbox.replit.app/webapp/installer/) in **Chrome or Edge**. Connect the FM-1 with a USB data cable. Connect the cable directly, with no hub. Press **INSTALL**. Allow MIDI access. Wait for *Done*. The FM-1 restarts and shows the BoopBox logo.

**From the source folder (Windows).** Double-click **`scripts/INSTALL-BOOPBOX.bat`**. This script builds the firmware and opens the installer at `http://localhost:8766/webapp/installer/`. Keep the black window open until the installation is complete. **`scripts/OPEN-EDITOR.bat`** opens the web editor.

**Updating** keeps your projects, presets, samples, kits and settings. The installer does a check of the package (SHA-256). Before the update loader of BoopBox starts the new firmware, it does a second check of the package (CRC). A damaged package is refused before anything is written.

**BoopBox or BoopBox Trainer (1.4).** The installer offers two firmwares: **BoopBox** and **BoopBox Trainer**. BoopBox Trainer teaches you three songs on the FM-1 itself, step by step, with a coach on the screen ([the trainer](docs/trainer.md)). All other functions of the trainer work as in BoopBox (the trainer keeps 8 synth voices and has no web editor). To switch back at any time, install the other firmware.

**Before you go back to an older BoopBox**, save a backup in the editor. A project that a newer BoopBox saved can fail to open correctly on an older BoopBox. The release notes in [CHANGELOG.md](CHANGELOG.md) tell you when this occurs.

<a id="the-emulator-18"></a>**Try it first in the browser (1.8).** [The emulator](https://boopbox.replit.app/webapp/emu/) runs the real BoopBox firmware (screen, sequencer, sound). The page shows a drawing of the FM-1. Play it with the mouse, a touch screen or the keys of the computer. The names of the computer keys are printed faintly on the controls. Your projects stay in the browser. [The home page](https://boopbox.replit.app/) shows what BoopBox does. It has links to the installer, the editor and the emulator.

---

## 2. The panel

| Control | Kind | Main job |
| --- | --- | --- |
| **PLAY** | button | start / stop all the tracks |
| **REC** | button | record (tap), clear the track (hold) |
| **SAVE** | button | song layer (hold), song screen / save pages (tap) |
| **HOME** | button | TRACKS screen, visualiser (tap), menu (hold), lock a layer |
| **ENV** | button | envelope pages |
| **LFO** | button | LFO pages |
| **FX** | button | punch-in layer (hold), effect pages (tap) |
| **SEL** | button | key / chord layer (hold), scale pages (tap). It is the second button of the top row, between FX and ENV. It is not the SELECT knob |
| **EDIT** | button | erase layer (hold), engine pages (tap) |
| **ARP** | button | note-repeat layer (hold), arpeggiator pages (tap) |
| **SEQ** | button | step layer (hold), sequencer pages (tap) |
| **GLO** | button | mix layer (hold), global pages (tap) |
| **OCT− / OCT+** | buttons | octave, ghost / hard hits, undo / redo, pages |
| **ALGORITHM** | knob | selects the track (1–8) |
| **PRESETS** | knob | the sound of the selected track (opens the [sound browser](#the-sound-browser)), or the drum kit |
| **SELECT** | knob | tempo, or the previous / next page |
| **KNOB 1–4** | knobs | the values that the four dials at the bottom of the screen show |
| **MASTER** | knob | output volume (headphones / line out) |
| **27 keys** | keys | 16 white (F3–G5) and 11 black |

---

## 3. The big ideas: tracks, colours, tap and hold

### Eight tracks

| Track | Colour | Plays (at power-on) | Knob of the same colour |
| --- | --- | --- | --- |
| **1** | blue | a synth (the synth tracks share 20 voices) | KNOB 1 |
| **2** | green | a synth | KNOB 2 |
| **3** | yellow | a synth | KNOB 3 |
| **4** | orange | a drum machine: 16 sounds, one for each white key | KNOB 4 |
| **5** | light blue | a synth | KNOB 1 |
| **6** | light green | a synth | KNOB 2 |
| **7** | light yellow | a synth | KNOB 3 |
| **8** | light orange | a second drum machine, with its own kit | KNOB 4 |

Any track can be a synth track or a drum track (SAVE → TOOLS → KIND, or KNOB 1 in the [sound browser](#the-sound-browser)). Tracks 5–8 use a lighter shade of the colours of
tracks 1–4. On a light theme, they use a darker shade. Thus each track has its own colour, also in your own theme. The screens that
list tracks show the bank of four that contains the selected track: 1–4 or 5–8. For more information, read
[the groovebox controls](docs/groovebox-controls.md).

**ALGORITHM** selects the track that you play, record and edit (1 to 8). It does this on every screen except SONG. On SONG, it sets the start of the loop. The page stays and shows the new track. On the DRUMS screen (1.4.2), a synth track goes to its NOTES page. On NOTES, a drum track goes to its DRUMS grid.

The screen and the whole editor use the colour of the selected track. **White** on the screen always means *what you are touching*, and **red** always means *recording*.

### Tap and hold

Every function button has two functions:

- **Tap** the button: its **pages** open (sound design, settings), as on all FM-1 firmware. Tap it again to open the next page of that button. **SELECT** also moves through the pages of that button, in the two directions. (1.7) If you tap a button from another page, it always opens its **first** page. Thus the same taps always open the same page.
- **Hold** the button: a **layer** opens. While you hold it, the 16 white keys and KNOB 1–4 do different functions. After 0.35 s (2.8.3), or immediately when you use a key or knob, the screen shows the 16 keys as 16 tiles (four rows of four: keys 1–4, 5–8, 9–12, 13–16). The screen also shows the knobs as dials. Before 2.8.3, this delay was 0.14 s, and a quick tap made the layer flash on the screen. Let go of the button to go back to playing.

The layers are **FX** (punch-in effects), **EDIT** (erase), **ARP** (note repeat), **SEQ** (steps), **SEL** (key and chords), **GLO** (mix) and **SAVE** (song). ENV and LFO have no layer. They only open pages.

**Landmarks:** while you hold a layer (and always on the drum track), keys 1, 5, 9 and 13 glow dimly. These keys are the first key of each row of tiles. Thus you can find a tile without looking. Keys at full light show what is on.

**Lock a layer:** hold its button and **tap HOME**. The layer stays open after you let go of the button. The screen shows *LOCK* and the button blinks. Thus you have both hands free: one hand on the keys and one hand on the knobs. Any other button (HOME, the button of the layer, ENV…) unlocks the layer and does only that action. **PLAY, REC and OCT− / OCT+ keep working** inside a locked layer.

**Inside any layer:** PLAY still starts and stops. **SELECT** always sets the tempo. The ALGORITHM / PRESETS knobs wait (they do not jump when you let go).

---

## 4. Your first beat in 60 seconds

1. Turn **ALGORITHM** to track **4** (orange). The white keys play 16 drum sounds: **F3 kick**, G3 kick 2, A3 snare, B3 clap, **C4 hat**, D4 open hat… To select a kit, turn **PRESETS**. Try *808* or *BOOMBAP*.
2. Press **REC** (*rec ready*). **Play a beat freely**, at your own tempo. There is no click and no count-in. For ghost notes, hold **OCT−** while you play. For hard hits, hold **OCT+**.
3. **Press REC on the "1" after your last bar.** The loop closes. Its length sets the tempo. The hits snap to the grid. The loop plays immediately.
4. Press **REC** again while the loop plays. Then you record on top (overdub). Hold **ARP** and hold the hat key (C4). This gives a 1/16 hat roll, which BoopBox records as ratchets.
5. Turn **ALGORITHM** to track **1** (blue, *808 BOOM*). Press **REC**. Play a bass line.
6. Hold **SEL** and press the key of your song (for example D). Select track 2. Hold **SEL** and turn **KNOB 1** to *7TH*. Now every white key plays a chord of the key, with one finger for each chord.
7. For a punch-in effect, hold **FX** and hold a key (white or black). While you still hold FX, turn **KNOB 2** for DUST and **KNOB 3** for DUCK.
8. If you make a mistake, use **EDIT + OCT−** to undo.

---

## 5. Every button, alone

| Control | Tap / turn | Hold |
| --- | --- | --- |
| **PLAY** | start / stop all tracks (in song mode: play the song). This works inside every layer | — |
| **REC** | playing: record now / stop recording · stopped: arm (*rec ready*) · free take: close the loop · count-in: cancel | ~2 s: **clear the selected track**. A ring fills. If you let go before the ring is full, nothing occurs |
| **SAVE** | on TRACKS or DRUMS: the **SONG** screen · on the SONG screen: save the song · on all other screens: the **SAVE pages** | the **song layer** (sections A–D, chain, song mode, SONG REC) |
| **HOME** | the **TRACKS** screen · on TRACKS: the **visualiser** (HOME again closes it) | 0.7 s: the **menu** (SCREEN, LIGHTS, AUDIO, KEYS, SEQ, SYSTEM). To leave the menu, hold HOME again |
| **ENV** | ENV pages (ENV, ENV DEST) | — |
| **LFO** | LFO pages (LFO, LFO DEST) | — |
| **FX** | FX pages (FX, FILTER, SLICER, INSERT, DLY, REV/CHO, PERF) | punch-in layer |
| **SEL** | SEL pages (SEL, SEL 2, HARMONY, FOLLOW, then the CHORDS screen) | key / chord layer |
| **EDIT** | EDIT pages (EDIT 1, EDIT 2, FILTER on ANALOG, VOICE, VOICE 2) · with the drum track: the **DRUMS** screen's **kit** page. Tap again: kit ↔ **sound** · on the NOTES page: delete the note | erase layer |
| **ARP** | ARP pages (ARP, ARP 2) | note-repeat layer |
| **SEQ** | SEQ pages (NOTES, TIMING, PLAY, PATTERNS, CHAIN, SCENES, then the SONG screen) · with the drum track: the **DRUMS** grid in place of NOTES, then the same pages (from kit or sound: the grid) | step layer · held + **SAVE** tapped: the **SCENES** page |
| **GLO** | GLO pages (GLOBAL, MASTER, DRUMS, TEXTURE, TEXTURE 2) | mix layer (the bank of four shown: 1–4 or 5–8) |
| **OCT− / OCT+** | synth track: octave down / up (−3 … +3) · both together: octave 0 | drum track: **ghost** (OCT−) / **hard** (OCT+) hits while held |
| **ALGORITHM** | select the track, on every screen except SONG (its loop start) and the sound browser (its sounds). On DRUMS, a synth track goes to its NOTES. On NOTES, a drum track goes to its DRUMS grid (1.4.2). Inside a layer, it waits. Not during a free take | — |
| **PRESETS** | on TRACKS and HOME: opens the **[sound browser](#the-sound-browser)** (the first click opens it, and the sound stays), then the next / previous **engine** in it (a drum track: its kinds of kit). ALGORITHM moves through the sounds there · on the DRUMS screen: the kit | — |
| **SELECT** | on TRACKS, inside a layer and on the REC screen: the **tempo** · on a page: previous / next page of its button (it stops at the first and last page. For SEQ: NOTES or the DRUMS grid, TIMING, PLAY, PATTERNS, CHAIN, SCENES) · DRUMS kit / sound: kit ↔ sound · visualiser: the style · menu: the section | — |
| **KNOB 1–4** | the four dials at the bottom of the screen | — |
| **MASTER** | output volume (the visualiser ignores it) | — |

### Combinations at power-on and while stopped

| Combination | Does |
| --- | --- |
| **OCT−** held when you switch on | **USB rescue** (*BoopBox USB RESCUE*): install again from the browser |
| **OCT− + OCT+** held when you switch on | **hardware calibration**: teach each button and knob (also in the HOME menu → SYSTEM) |
| **OCT− + OCT+** held 5 s, stopped | **update mode** (UBOOT). A countdown shows from 2 s. To cancel, let go. BoopBox saves your work first |

---

## 6. Playing the keys

### Synth tracks (1–3 and 5–7 at power-on)

- The keys play the selected track. The notes that you play always go out on USB MIDI (on the channel of the track).
- **OCT− / OCT+**: octave −3 … +3. Both together: back to 0. The OCT lights show when the octave is not 0.
- What the keys play depends on the **KEYS** setting of the track and on the **CHORD** mode (SEL layer or SEL page):

| KEYS | CHORD | The keys play |
| --- | --- | --- |
| **OFF** | OFF | every key chromatic (the default) |
| **SNAP** | OFF | every key, rounded down to the scale |
| **WHITE** | OFF | the white keys play the scale, up from C4 (C4 = the root of the key). The black keys are silent |
| any | **on** | the white keys play **chords** of the scale, one chord for each key (C4 = the I chord). The black keys **change the chord** ([CHORD+](#chord-the-black-keys-change-the-chord)) |

- The **GM KIT** sound (SAMPLE engine) is the exception: the lowest key is a kick (C2), and there is no scale.

### Drum tracks (4 and 8 at power-on)

A drum track has 16 sounds, one for each white key. A black key plays the sound of the white key on its left. Thus two fingers can play one sound, for fast rolls. For ghost notes, hold **OCT−**. For hard hits, hold **OCT+**. See [The drum track](#7-the-drum-track).

### Velocity and levels

The keys of the FM-1 have no velocity. On the drum track, every hit has one of four **levels**: **GHOST**, **SOFT**, **NORM** (as played) and **HARD**. You select the level with OCT− / OCT+ while you play, or later in the step sequencer. On synth tracks, a note also has a **FORCE**, and a step has an **accent** (NOTES page, KNOB 4).

---

## 7. The drum track

### The 16 sounds

| Key | Sound | Key | Sound | Key | Sound | Key | Sound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 · F3 | KICK | 5 · C4 | HAT | 9 · G4 | SNARE 2 | 13 · D5 | RIDE |
| 2 · G3 | KICK 2 | 6 · D4 | OPEN HAT | 10 · A4 | LOW TOM | 14 · E5 | SHAKER |
| 3 · A3 | SNARE | 7 · E4 | PEDAL HAT | 11 · B4 | HI TOM | 15 · F5 | CONGA |
| 4 · B3 | CLAP | 8 · F4 | RIM | 12 · C5 | CRASH | 16 · G5 | COWBELL |

- **Levels:** GHOST, SOFT, NORM, HARD (hold OCT− / OCT+ while you play). Softer hits are darker and also quieter.
- **Ratchets:** a hit can repeat x1–x4 inside its step. ARP rolls record ratchets. SEQ + step + KNOB 3 sets them.
- **Choke:** the closed hat and the pedal hat cut the open hat.
- **6 drum voices**, separate from the 20 synth voices. (2.8.3) When all six voices sound, a new hit takes the voice of its own sound if that sound still rings. Thus a hi-hat cuts the last hi-hat, as on a drum machine. If not, the hit takes the oldest voice, and it takes the voice of the kick last. Thus on a busy beat, the kick no longer drops out.

### Kits

**PRESETS** on the drum track selects the kit (or KNOB 1 on the DRUMS kit page, or the editor):

| # | Kits |
| --- | --- |
| 1–5 | **ACOUSTIC** (sampled studio kit, CC0) and its treatments: DEEP, TIGHT, BRIGHT, DUST |
| 6–37 | 32 synthesised kits, 16 sounds each: 808, 909, 606, 80S, VINTAGE, TRAP, DRILL, BOOMBAP, LO-FI, PHONK, HOUSE, D.HOUSE, TECHNO, MINIMAL, ELECTRO, DISCO, GARAGE, JUNGLE, DUBSTEP, DEMBOW, AMAPIANO, AFRO, LATIN, TRIBAL, SYNTHWV, CHIP, ARCADE, GLITCH, INDUSTR, HYPER, AMBIENT, JAZZ |
| 38–41 | **USR1, USR2, USR3, USR4**: your own kit in one sample slot (about 7.4 s) |
| 42 | **USR3+4**: your own big kit in two slots (about 15 s) |
| 43–46 | **SYN1, SYN2, SYN3, SYN4** (2.5): your own synthesised kits. You make them on the [Drum synth](#your-own-synthesised-kits-syn1syn4) page of the editor. The FM-1 shows the name that you gave them |

Every kit is level-matched. BoopBox saves the kit with projects and song sections. A change of kit never changes the pattern. [Your own kits](#23-your-own-samples-and-drum-kits) work like all other kits: steps, levels, ratchets, fills, choke, MIDI.

### The DRUMS screen

The DRUMS screen has three pages: grid, kit and (2.7) sound. The pages are in two groups, as on a synth track (1.7):

- When the drum track is selected, a tap on **SEQ** opens the **grid**. The grid is the first SEQ page of the drum track, in place of
  NOTES. SEQ again (or **SELECT** right) goes on through the other SEQ pages: **TIMING**, **PLAY**, **PATTERNS**,
  **CHAIN** and **SCENES**. Then it goes to the SONG screen, exactly as from the NOTES page of a synth track.
- When the drum track is selected, a tap on **EDIT** opens the **kit**. EDIT again (or **SELECT**) switches kit ↔ **sound**.
  SEQ from the kit page or the sound page goes back to the grid.

The top right of the screen shows the name of the current page. It also shows where SEQ or EDIT goes next. To open the SCENES page from anywhere, hold **SEQ** and tap **SAVE**.

**Grid page** — the 16 sounds × 16 steps. Shades show the levels, and notches show the ratchets.

| Control | Does |
| --- | --- |
| KNOB 1 **sound** | selects the sound (lane). (2.7.1) You hear it only with MENU → SEQ → **DRUM PREVIEW ON** (OFF by default: quiet for live use) |
| KNOB 2 **step** | moves to a step (with DRUM PREVIEW ON, you hear what the step holds) |
| KNOB 3 **hit** | right: a hit of that sound on that step (NORM) · left: clear it |
| KNOB 4 **level** | the level of the hit, up / down (GHOST, SOFT, NORM, HARD) |
| **white keys** | the 16 steps of the selected sound. Press a key to set the step. Press it again to clear the step (2.7.1: silent, the pattern plays it). The keys light the steps of that sound |
| **black keys** (2.7.1) | select the sound, silently: F#3 KICK / KICK 2 · G#3 SNARE / SNARE 2 · A#3 RIM · C#4 CLAP · D#4 HAT / PEDAL · F#4 OPEN HAT · G#4 LOW TOM / HI TOM · A#4 CRASH · C#5 RIDE · D#5 SHAKER / CONGA · F#5 COWBELL (the same key again: the other sound of its pair). The black key of the selected sound is lit |
| **OCT− / OCT+** (2.7.1) | the page of steps: 1–16, 17–32, 33–48, 49–64 (in a loop, up to the length of the track). Up to 2.7: the first four black keys |
| **PRESETS** | the kit |
| **SAVE** | the SONG screen |
| **HOME** | back to TRACKS |

**Kit page** — 16 pads that flash on every hit. The keys play the pads.

| KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- |
| **kit** | **level** of the drum track | **reverb** send of the drums | **pan** of the drum track |

<a id="drum-sound"></a>**Sound page (2.7)** — on every kit, you can tune each of the 16 sounds and make it shorter or longer. To select the sound, play a key (or turn KNOB 1). Its pad gets a frame. A sound that you changed shows a small square.

| KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- |
| **sound** (you hear it) | **tune**: −8 … +7 semitones | **decay**: −4 (very short) … 0 (as the kit has it) … +3 (long) | **level** of the drum track |

On the synthesised kits (808, 909… and your SYN1–4), DECAY makes the sound itself shorter or longer. On the sampled kits (ACOUSTIC … DUST, USR), DECAY can only make the sound shorter (a fade). At +3, the sample plays as it is. **(2.8)** On the synthesised kits, TUNE also changes the **brightness** of the sounds that have no tone (closed hats, shakers, claps). These sounds have no pitch to shift. Lower TUNE for a darker, duller hat, and raise it for a crisper hat.

BoopBox keeps these settings with the project and with each section A–D. Thus a section can have its own tuning. A change of kit keeps the settings. NEW sets them back to 0. A project from an older BoopBox opens with every sound as its kit has it.

While the song plays in song mode, the hit and level knobs of the grid wait (*STOP THE SONG FIRST*).

---

## 8. Recording

BoopBox records live. It adds every pass on top of the last pass (overdub). Notes go to the nearest step **as you heard it**. BoopBox removes the ~12 ms between a key and its sound. Thus a note that you play on the beat lands on the beat.

The synth tracks whose VOICE is POLY keep chords (up to 4 notes a step). A MONO, LEGATO or UNISON sound plays and records one note at a time. Most basses and leads are such sounds. Held notes become ties. (2.7.1) On a POLY track, each held note continues until you let go of its own key, also while other notes start and end over it. Thus you can hold a note and play other notes on top, and it keeps sounding in the pattern (up to 4 at once).

(2.7.2) On a MONO, LEGATO or UNISON track, you can play a note while you still hold the note before it. BoopBox records the new note **legato**, and it plays back as you played it. With LEGATO, the sound continues into the new note without a new attack. It glides only with GLIDE or a SLIDE. Before 2.7.2, the sequencer ended the note and started the next note again.

This works from the keys of the FM-1 and from a MIDI controller. If you let go of the second note while you still hold the first note, the pattern does not go back to the first note. The live sound does.

(2.8.3) When you record on a MONO or LEGATO sound, the screen shows *MONO: SET VOICE POLY* the first time that you play a key over a held key. The 808 BOOM sound of track 1 is such a sound. To hold a note under other notes, set VOICE to POLY (EDIT → VOICE page, VCE). Alternatively, record on a POLY sound.

(2.8.3) On a POLY track, the pattern never cuts or restarts a note while you hold it. The note also continues through the steps that already have notes (an overdub over a melody), up to 4 notes a step. The TRACKS page shows one mark for each step. The NOTES page shows the notes of a chord one by one (*2/3*…).

**Over held notes (2.7).** On a POLY track, held notes of the pattern can ring while you record (for example, a pad tied over the bar). A note that you record over them no longer cuts them: they continue under it, and your note ends where you let it go. Up to 4 notes sound at once on a track (a fifth note makes the oldest held note end at that point). Steps that you enter by hand (SEQ + key) still replace what plays, so you can cut a long note on purpose. On SLOOP 2.6, such a pattern plays the held notes again where a note was laid over them.

**With a MIDI keyboard:** REC records the **selected** track. A keyboard on channel 1, 2 or 3 always plays track 1, 2 or 3 (2.6: the channels of MIDI), whichever track is selected. To play and record the selected track, set the keyboard to channel 4 (or 4–16). From 2.6, if your keyboard plays a track that is not the recording track, the screen shows *MIDI PLAYS TRACK n* (one time for each take).

### What REC does

| When | REC does | Then |
| --- | --- | --- |
| **Playing** | records the selected track **at once** | REC again stops recording. The loop continues to play |
| **Stopped, project with notes** | arms (*rec ready*, the REC light blinks) | **your first note starts the loop and is step 1**. PLAY also starts it |
| **Stopped, empty project** | arms (*rec ready · play freely*) | a **free take**, or, with MODE *tempo*, the same as with notes |

If you press REC again while it is armed, REC disarms (*REC OFF*). In **song mode**, REC waits until the song stops (*STOP THE SONG FIRST*). When you arm REC in song mode, BoopBox switches back to loop mode.

(2.8.3) A free take also keeps held notes. On a POLY track, you can hold a note while you play other notes over it. When the loop closes, that note continues under them (up to 4 notes a step). Before 2.8.3, it stopped at the next note.

While you record, the REC light is solid and the track shows a red *rec*. **Turn ALGORITHM** during recording to move the take to the next track. The recording does not stop.

### The REC screen (armed, before the first note)

| Knob | Dial | Choices |
| --- | --- | --- |
| KNOB 1 | **mode** (empty project only) | **free**: a free take, the tempo follows you · **tempo**: record at the set tempo (SELECT) |
| KNOB 2 | **length** | the loop of the selected track: **1, 2 or 4 bars** |
| KNOB 3 | **start** | **note**: your first note starts the loop · **count**: press **PLAY**. One bar of clicks plays (4, 3, 2, 1 on the screen). Then recording starts. Notes before that only sound |
| KNOB 4 | **quant** (2.7) | **on**: what you record goes on the steps (as before) · **off**: it keeps your timing (see below) |

LENGTH and START apply when you record at a tempo (MODE *tempo*, or a project that already has notes). A free take makes its own length. MODE, START and QUANT are settings of the FM-1. They stay as you left them, also when you record while the song plays.

<a id="quant-off"></a>**QUANT off (2.7).** A note that you play still goes into the nearest step. Its distance from the grid becomes the **nudge** of that step (SEQ + step + KNOB 4: 1/64 of a step, about 2 ms at 120 BPM in 1/16). Thus the pattern plays back with your groove. You can still edit it step by step (a nudged step shows its dot, and SEQ + step + OCT− puts it back on the grid). This works for the keys and MIDI, also in the free take. The arp and note repeat stay on their grid.

A step has one nudge. The first note in a step sets it. The other notes of a chord, or other drum sounds on that step, follow it (in DIV 1/32 the steps are twice as fine). Undo (EDIT + OCT−) removes the nudges of a take together with its notes. During the count-in, **REC cancels it** and **PLAY** goes back to *rec ready*. SELECT sets the tempo on this screen.

### Free take: the loop follows you

1. On an empty project, press **REC**. Then play freely. The screen shows *free take*, the seconds, and the loop that it makes if you close it now (*2 bars · 92 bpm*).
2. **Press REC on the "1" after your last bar.** BoopBox selects 1, 2 or 4 bars at the tempo nearest to the set tempo. If the difference is within 3 %, BoopBox keeps the set tempo. BoopBox writes your notes with their lengths and levels. Then it plays the loop immediately. Every track takes that length.
3. **PLAY** during a free take discards it. A take closes automatically after 24 s.

### Metronome and swing

- The **PLAY light flashes on every beat**: a silent metronome.
- An audible click: **GLO → GLOBAL → CLICK** = **OFF**, **REC** (only while a track records) or **ON** (whenever it plays). The click is a short tick of its own (higher on the first beat of a bar). You hear it with every kit, also when the drum track is muted or another track is soloed. Its level follows GLO → DRUMS → LVL. BoopBox never records the click, and the count-in always clicks.
- **Swing** goes from **0** (straight) to **100** (the strongest: a step pair played 75 / 25, as MPC swing at 75 %). For all tracks, use **HOME, KNOB 1** or **GLO → GLOBAL → SWING**. For one track, use **SEQ + KNOB 3** (or SEQ → TIMING → SWG). The swing of a track adds to the global swing. BoopBox never swings triplet divisions.

### What gets recorded

- **Synth tracks:** the notes (and chords) with their lengths, ties for held notes, ARP rolls as ratchets, and CHORD+ chords as they sound.
- **Drum track:** the hits with their levels, and ARP rolls as **ratchets** (a 1/32 roll on a 1/16 track: x2 on each step).
- Never recorded: punch-in effects, the click, and notes played in a layer that uses the keys for a different function (FX, SEQ, GLO…).

---

## 9. The layers, one by one

This table shows all seven layers:

| Hold | Name | White keys | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 | Tap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **FX** | punch | a punch-in effect while you hold the key | FILTER (master) | DUST | DUCK | TRK FILT (selected track) | FX pages |
| **EDIT** | erase | erase that sound / note from the pattern | SHIFT | LENGTH ×2 / ½ | TRANSPOSE | — | EDIT pages |
| **ARP** | roll | note repeat on the grid | RATE | — | — | — | ARP pages |
| **SEQ** | steps | steps 1–16 of the page | SOUND / NOTE | DIV | SWING | LENGTH | SEQ pages |
| **SEL** | key | the key of the song | CHORD | SCALE | KEYS | TRANSPOSE | SEL pages |
| **GLO** | mix | 1–4 mute · 5–8 solo · 9 fill · 10 fill bar · 16 tap tempo | level 1 | level 2 | level 3 | level 4 | GLO pages |
| **SAVE** | song | 1–4 play A–D · 5–8 save A–D · 13 loop / song · 14 SONG REC · 16 song screen | — | — | — | — | song screen / SAVE pages |

### FX — punch

| Control | Does |
| --- | --- |
| **FX + a key** | the [punch-in effect](#punch-in-effects) of that key (16 white keys, and 11 black keys, 2.6), on the whole mix, for as long as you hold the key |
| **FX + KNOB 1** | master **FILTER**. Left: a low-pass filter. Right: a high-pass filter. Centre: off |
| **FX + KNOB 2** | master **DUST** (old sampler and vinyl) |
| **FX + KNOB 3** | master **DUCK** (sidechain pump from the kick) |
| **FX + KNOB 4** | **TRK FILT**: the same one-knob filter on the **selected track only** (any track, the drums too) |
| **FX + OCT−** (held, 2.6) | **REV THROW**: while you hold OCT−, the reverb send of every track (the drums too) goes to full. It glides in and out (approximately 12 ms). It also works together with a punch-in key. The REV values of the song never change. BoopBox does not save or record the throw |
| **FX + OCT+** (held, 2.6) | **ECHO THROW**: the same for the delay sends. While you hold OCT+, FDBK is at least 70 %. Both together: both throws |
| **FX + HOME** | lock the FX layer open (both hands free) |

While you hold FX, the keys that you press never play or record notes.

### EDIT — erase

| Control | Does |
| --- | --- |
| **EDIT + key**, playing | erases that sound (drums) or note (synths) from **every step the playhead passes while you hold the key**. With CHORD on, it erases the chord of the note. This is MPC style: hold the hat key for one bar, and the hats of that bar are gone. *ERASED* flashes |
| **EDIT + key**, stopped | erases that sound / note from the **whole pattern** at once |
| **EDIT + KNOB 1** | **SHIFT**: every step moves one step later (right) or earlier (left). This turns the groove around |
| **EDIT + KNOB 2** | **LENGTH**: right ×2 (the pattern is copied after itself, up to 64 steps). Left ½ |
| **EDIT + KNOB 3** | **TRANSPOSE**: every note moves one semitone up or down (synth tracks) |
| **EDIT + OCT−** | **undo** |
| **EDIT + OCT+** | **redo** |
| **EDIT + a black key** (drum track, 2.6) | **MUTE mode**: the white keys now **mute / unmute their sound** in the sequencer, live. They erase nothing. The muted sounds show *OFF* in red. The screen shows *mute: key = sound*. A black key again goes back to erasing. 2.7: MUTE mode **stays** when you let go of EDIT. Then the next EDIT + key mutes at once (2.6 went back to erasing) |

All the knob turns of one EDIT hold count as one change for undo.

The drum mutes stay on until you unmute the sound (EDIT + a black key, then its key again). The mutes are a performance tool, not part of the pattern. When you load a project or start a new one, every sound plays. A muted sound still plays from the keys and from MIDI. Its ratchets are muted too.

### ARP — roll (note repeat)

| Control | Does |
| --- | --- |
| **ARP + key (held)** | the key repeats on the grid at the RATE, locked to the tempo and the swing. The roll ends when you let go of the key |
| **ARP + KNOB 1** | **RATE**: 1/8, 1/16, 1/32, 32T, 1/64 (also GLO → MASTER → ROLL) |
| **ARP + key + OCT− / OCT+** | on the drum track: ghost / hard rolls |

When you record, BoopBox writes a roll as ratchets (a 1/32 roll on a 1/16 track: x2 on each step). Rolls ignore fills. (The **arpeggiator** is a different function: tap ARP for its pages.)

### SEQ — steps

The 16 white keys are the 16 steps of the current page. The lit steps play.

| Control | Does |
| --- | --- |
| **SEQ + empty step** | sets it at once. Drums: with the sound that the screen shows (KNOB 1, or the last pad you hit). Synths: with the note or chord you played last (on the keys, or a MIDI keyboard: 2.6) |
| **SEQ + set step (tap)** | clears it (with its nudge, locks and fill condition) |
| **SEQ + several step keys held** | edit them together |
| **SEQ + first four black keys** or **SEQ + OCT− / OCT+** (no step held) | the page: steps 1–16, 17–32, 33–48, 49–64 (up to the length of the track). (2.7.1) On the drum track, only OCT− / OCT+ select the page. There, the black keys pick the sound |
| **SEQ + a black key** (drum track, 2.7.1) | the **sound** that the steps are for, silently, as on the DRUMS grid (F#3 KICK / KICK 2 … F#5 COWBELL). The same key again picks its pair. With **SEQ + HOME** (locked), both hands are free: the black keys pick the sound, and the white keys are its steps |
| **SEQ + KNOB 1** (no step held) | the **sound** (drums, heard with DRUM PREVIEW ON, 2.7.1) / **note** to set |
| **SEQ + KNOB 2** | **DIV**: 1/4, 1/8, 1/16, 1/32, 8T, 16T, 1/2, 1BAR, 2BAR |
| **SEQ + KNOB 3** | **SWING** of the track |
| **SEQ + KNOB 4** | **LENGTH**: 1–64 steps |
| **SEQ + step + KNOB 1** | drums: the **sound** of the step that LEVEL and RATCHET edit (heard with DRUM PREVIEW ON) · synths: the **note** of the step (every note of a chord moves together) |
| **SEQ + step + KNOB 2** | drums: **LEVEL**: ghost, soft, norm, hard · synths (2.6): **VEL**, the velocity of the step, 1–127 (every note of the step). VEL takes off an accent, as the accent plays at 127 |
| **SEQ + step + KNOB 3** | **RATCHET**: x1–x4 |
| **SEQ + step + KNOB 4** | **NUDGE**: −32 … +31 (in 1/64 of a step) |
| **SEQ + step + PRESETS** | a **parameter lock** on that step. The first click makes the lock, one click away from the value of the track. The next clicks move it |
| **SEQ + step + ALGORITHM** | which parameter the lock is on |
| **SEQ + step + OCT+** | the **fill condition** of the step: normal → FILL ONLY → NO FILL → normal |
| **SEQ + step + OCT−** | clears the nudge, locks and fill condition of the step |

If you edit a held step with a knob, the step is **kept** when you let go. Only a plain tap clears a step. For details, see [The step sequencer](#10-the-step-sequencer-steps-nudge-locks-fills).

### SEL — key and chords

| Control | Does |
| --- | --- |
| **SEL + any key** | sets the **key of the song**: the root of every synth track (*KEY D*) |
| **SEL + KNOB 1** | **CHORD** of the selected synth track: OFF, TRIAD, 7TH, 9TH, SUS4, POWER |
| **SEL + KNOB 2** | **SCALE** of every synth track: 16 scales |
| **SEL + KNOB 3** | **KEYS**: OFF, SNAP, WHITE |
| **SEL + KNOB 4** | **TRANSPOSE** the selected track, ±24 semitones |

For details, see [Key, scales, chords and CHORD+](#11-key-scales-chords-and-chord).

### GLO — mix

| Control | Does |
| --- | --- |
| **GLO + key 1–4** | **mute** / unmute track 1–4 of the bank (tracks 1–4, or 5–8 when the selected track is one of them). The track fades out in a few ms. The pattern runs on in time |
| **GLO + key 5–8** | **solo** track 1–4 of the bank (several solos add up) |
| **GLO + key 9 (held)** | **fill** for as long as you hold the key |
| **GLO + key 10** | **fill bar**: the whole next bar plays as a fill. To cancel, press again before the bar |
| **GLO + key 16** | **tap tempo** (two taps or more) |
| **GLO + F#3** (the first black key, 2.6) | **MIDI LEARN** on / off. See [MIDI LEARN](#midi-learn-26) |
| **GLO + KNOB 1–4** | the **levels** of the four tracks of the bank |
| **GLO + SELECT** | the tempo (also inside the visualiser) |

(1.2.0) While you hold GLO, the screen shows the four levels of the bank as faders. Under each fader, it shows the mute and solo of that track. Below, it shows FILL, BAR and the tap tempo. The *fill* and *bar* light while they act. To mix a track of the other bank, turn ALGORITHM to that track.

### SAVE — song

| Control | Does |
| --- | --- |
| **SAVE + key 1–4** | play section **A–D**. Playing: from the next bar (every track from its first step). Stopped: it becomes the loop at once |
| **SAVE + key 1–4, several tapped while SAVE stays held** | a **quick chain** (*A B B C*…, up to 8, repeats allowed). When you let go, they play in turn, round and round |
| **SAVE + key 5–8** | **save the loop** into section A–D. To save over a used section, press the key again within 3 s |
| **SAVE + key 13** | switch **loop** / **song** mode |
| **SAVE + key 14** | **SONG REC**: from the next bar, BoopBox writes every section you play (and how long) into the song. To end, press it again (or STOP) |
| **SAVE + key 16** | the **SONG** screen |

For details, see [Song mode](#14-song-mode-sections-chains-songs).

---

## 10. The step sequencer: steps, nudge, locks, fills

Each track has up to **64 steps**. Each track has its own **length** (1–64) and **division** (1/32 to two bars). Tracks of different lengths loop on their own and stay in phase (polymeters). A synth step holds up to 4 notes (a chord) with a level and ratchet, a tie or a rest, an accent and a slide. A drum step holds any of the 16 sounds, each with its own level and ratchet.

There are three ways to enter steps:

1. **Live** — use REC, and play (see [Recording](#8-recording)).
2. **The SEQ layer** — hold SEQ. The white keys are steps (all tracks, see [SEQ — steps](#seq--steps)).
3. **The NOTES page** (synth tracks, 2.7.2, called the STEP page before) — tap **SEQ**. The page shows the pattern as a **piano roll**. Each note is a bar as long as the note lasts. The note you edit has a white outline, with its name over it. Lines mark the beats. The names of the C rows are on the left. The playhead is a line. The fill of a note shows its **FORCE**: GHOST dark, SOFT hollow, NORM and HARD full, ACC a white cap. A SLIDE shows as a dash to the next note.

| NOTES page | Does |
| --- | --- |
| **keys** | the keys that you press together become the step under edit (POLY: up to 4 notes. MONO, LEG and UNI: the last one). In chord mode, a key writes its whole chord, CHORD+ changes included. When you let go of all keys, the edit moves on to the next step. (2.7.1) With MENU → SEQ → **STEP ADVANCE OFF**, it stays, and the next keys write the same step again, for a chord tried twice · **a MIDI keyboard** too (2.6): the notes it plays together on the selected track (the track its channel plays, MIDI) become the step, as they sound. If it plays on the channel of another track while stopped, the screen shows *MIDI PLAYS TRACK n* (and when you record: see REC) |
| KNOB 1 **NOTE** | goes from note to note: the notes of a chord one by one, then the next step. It also goes to the empty steps, so you can put a note there. The TIEs of a note are its length, not stops |
| KNOB 2 **PITCH** | the pitch of that note (the other notes of a chord stay). An empty step gets your last note |
| KNOB 3 **LEN** | how many steps the note lasts. Longer turns the steps after it into TIEs. Shorter turns its last TIEs back into RESTs. (2.8.3) On a POLY track, the note goes on **under the notes after it**: a long bass under a melody. Each note keeps its own length (up to 4 notes a step: *STEP FULL: 4 NOTES*). The note stops at the end of the pattern (*END OF PATTERN*). It also stops at the same pitch played again, or at a step with ratchets or a slide (*NOTE AHEAD*). It also stops on a MONO, LEGATO or UNISON sound, which plays one note at a time (*MONO: SET VOICE POLY*: VOICE page, VCE = POLY) |
| KNOB 4 **FORCE** | **GHOST**, **SOFT**, **NORM**, **HARD**, then **ACC** (the accent of the step, for its whole chord) |
| **PRESETS** | the zoom: 8, 16 (when the page opens), 32 or 64 steps on the screen (the page with the note under edit) |
| **EDIT (tap)** | deletes the note under edit. A chord keeps its other notes. Its last note takes the step and its TIEs |
| **OCT−** / **OCT+** (tap) | the octave of the keys, as everywhere |
| **OCT+ held** (0.4 s) | the **sheet** of the note. (2.8.1) The sheet is a strip along the bottom of the screen, so the piano roll stays visible. It opens again on the row you last used. KNOB 1 picks a row. KNOB 2 sets it. OCT+ does it. OCT− closes the sheet. The rows: **SLIDE** (ON / OFF, OCT+ too) · **NUDGE** (the micro timing of the step, −32 … +31) · **FILL** (NORMAL, FILL only, NO FILL) · **MOVE** (KNOB 2: one step for each detent, with its TIEs, nudge, fill and locks. Not over another note: *NO ROOM*) · **COPY** (OCT+: a copy just after it, picked, and MOVE next to place it) · **DELETE** (OCT+) |

EDIT + OCT− / OCT+ undo and redo the edits, as before. Not while you record or while REC is armed (then the keys record live). On the drum track, the NOTES page shows *DRUM TRACK*. Use the DRUMS grid or the SEQ layer.

**The DRUMS grid has the same sheet** (2.7.2). On the grid, **OCT+ held** opens it for the hit of the KNOB 1 sound on the KNOB 2 step. The rows are **RATCHET** (x1 … x4), **NUDGE** and **FILL** (of the step: every sound in it), **MOVE** (KNOB 2), **COPY** (OCT+: to the next step) and **DELETE** (OCT+). OCT− closes the sheet. If you tap OCT+, it still turns the page of steps.

The **TIMING** page (tap SEQ again, called PATTERN before) holds the **LEN** of the pattern. It also holds the **DIV**, **SWG** (swing) and **GATE** (how long each note lasts) of the track. Tap SEQ again for the **PLAY** page (the play direction and the random seed). Then come **PATTERNS** (the eight patterns of the track as pads), **CHAIN** (the playlist of patterns of the track) and **SCENES** (the pattern of every track at once, for the parts of the song). Then comes the **SONG** screen. On those three pages, the keys are pads: white keys 1–8 are the patterns of the track, and 9–16 are the scenes ([the details](docs/groovebox-controls.md#patterns)).

**SELECT** walks NOTES to SCENES in both directions. **SEQ held + SAVE** goes straight to SCENES. If you tap SEQ from any other page, it always starts on NOTES. On the drum track, SEQ opens the [DRUMS grid](#the-drums-screen) in place of NOTES. TIMING, PLAY, PATTERNS, CHAIN, SCENES and SONG work the same.

### Beats from the keys (1.9)

On a **drum track's PLAY page**, the white keys write beats. If you **hold one or more white keys**, BoopBox writes a whole pattern across the kit, over the length of the track (TIMING → LEN). The keys play no sound on this page. When you open the page, the screen shows *HOLD KEYS: A NEW BEAT*. The screen also shows the name of the groove (*BEAT HOUSE*).

| Keys held | Make |
| --- | --- |
| the **lowest** key held, keys **1–8** | the groove: **HOUSE**, **ROCK**, **BOOM BAP**, **TRAP**, **BREAK**, **DEMBOW**, **DNB**, **ELECTRO** |
| the lowest key held, keys **9–16** | the same eight grooves, busier |
| each **other** key held | a variation with more detail: ghost snares, the open hat, percussion layers, a crash on the one, a fill on the last steps, hat rolls |
| **KNOB 2 SEED** | another set of variations for the same keys (at 0, one key alone gives its groove plain) |

**The same keys and the same SEED always make the same beat**, in whatever order you press the keys. A beat replaces the pattern that plays. Its nudges, locks, fill conditions and step components are cleared. **One hold is one undo** (EDIT + OCT−). After that, you can edit the beat as any other pattern. This does not work while a song plays (*STOP THE SONG FIRST*). For more, see [the groovebox controls](docs/groovebox-controls.md#beats-from-the-keys-the-play-page-of-a-drum-track-19).

### Nudge (micro timing)

**SEQ + step + KNOB 4** moves a step off the grid, from −32 to +31 in 1/64 of a step. Minus is early: the step plays before its grid time, inside the previous step. Plus is late. The ratchets of the step move with it. Recording and swing stay on the grid. On the drum track, the whole step moves, with every sound in it. A nudged step shows a dot in the corner of its tile.

### Parameter locks

A **lock** gives one sound parameter another value **for that step only** (Elektron style).

1. Turn the parameter you want on its page (for example FX → DLY send, or LFO → RATE). That parameter becomes the **lock parameter**. (Before you turn a parameter, the lock parameter is ENV DEST → FLT.)
2. Hold **SEQ** and hold the step.
3. Turn **PRESETS**. The first click makes the lock, one click away from the value of the track. The next clicks move it. The title line shows the lock (*lock dst 14* · *lock flt --* = no lock yet).
4. To go to the other parameters, keep the step held and turn **ALGORITHM**. It steps through them and wraps round.

At the next step without a lock on that parameter, the parameter comes back to its base value. Notes that still ring follow this change. If you turn a knob on the page while a lock is in force, the knob wins: that value becomes the new base. One step can have several locks (one for each parameter). The limit is **32 per track**.

You can lock the sound parameters of the track (and the GATE of the TIMING page). You cannot lock the arp, key / scale / chord, STRUM / VLEAD, voice-mode, MUTE, LEN / DIV / SWG and the global pages (*NOT LOCKABLE*). When all 32 locks are used, the screen shows *NO LOCK LEFT*. A locked step shows the same dot as a nudged step, and **SEQ + step + OCT−** clears both. Undo (EDIT + OCT−) is for steps and (2.7) their nudges. It does not bring locks back.

**The step's locks, one by one.** On the NOTES page or the DRUMS grid:

1. Hold **OCT+** to open the sheet of the step.
2. Turn KNOB 1 to its last row, **LOCKS**.
3. Tap OCT+.

Then KNOB 1 picks a lock (or **ADD**). KNOB 2 sets its value (on ADD: the parameter). KNOB 3 turns its **SLIDE** on: the parameter glides to the value of the lock over the step, and does not jump. Each track can have up to 4 slides at once. OCT+ adds or removes the lock. OCT− goes back.

**HOME menu → SEQ → REC KNOBS = LOCKS** records knob moves as locks on the steps that play. With this setting, the knob moves do not change the sound. See [the groovebox controls](docs/groovebox-controls.md#parameter-locks).

### Fill conditions

**SEQ + step + OCT+** cycles the condition of the step:

| Condition | Mark on the tile | Plays |
| --- | --- | --- |
| **normal** | — | always |
| **FILL ONLY** | small **F** (top left) | only during a fill |
| **NO FILL** | **×** (top left) | always, except during a fill |

To call a fill while you play, use **GLO + key 9** (as long as you hold it) or **GLO + key 10** (the whole next bar). Build a beat with FILL ONLY rolls, crashes and pickup notes, and a NO FILL main hat. Then one finger brings the fill in and out on the bar.

A skipped step is fully silent (no note, no MIDI, no ratchet, no lock). On the drum track, the condition is for the whole step, with every sound in it. STOP ends any fill. The arp and the rolls ignore fills.

### Divisions

**DIV**: 1/4, 1/8, **1/16** (default), 1/32, 8T, 16T (triplets), **1/2**, **1BAR**, **2BAR**. A 64-step track at 2BAR lasts 128 bars: for drones, chord changes and slow songs.

---

## 11. Key, scales, chords and CHORD+

### Key and scale

- **SEL + any key** sets the **key of the song** for every synth track. (You can also set it for each track: SEL page → ROOT.)
- **SCALE**: SEL + KNOB 2 sets it for every synth track. The SEL page sets it for the selected track only. The scales are CHR (chromatic), MAJ, MIN, DOR (dorian), MIX (mixolydian), PEN (major pentatonic), MPEN (minor pentatonic), HARM (harmonic minor), PHRY (phrygian), LYD (lydian), LOC (locrian), MEL (melodic minor), BLUES, WHOLE (whole tone), DIMHW and DIMWH (diminished, half-whole and whole-half).
- **KEYS**: **OFF** (chromatic), **SNAP** (every key rounded down to the scale), **WHITE** (the white keys walk the scale from C4, and the black keys are silent).
- **TRANSPOSE** (for each track): ±24 semitones.

When you change a sound (PRESETS, a user preset), the key, the chord mode, the pattern and the mix of its track never change.

### Chord mode: one finger, one chord

To set the chord mode of the selected synth track, hold **SEL** and turn **KNOB 1 CHORD**:

| CHORD | Notes |
| --- | --- |
| **OFF** | single notes |
| **TRIAD** | 1-3-5 |
| **7TH** | 1-3-5-7 |
| **9TH** | 1-3-7-9 (the lo-fi / R&B voicing) |
| **SUS4** | 1-4-5 |
| **POWER** | 1-5-8 (root, fifth, octave) |

When a chord mode is on, **the white keys walk the scale from C4**. C4 plays the chord of the I of the key, D4 the II, E4 the III… The keys below C4 continue downwards. BoopBox builds every chord from the scale, so the chord always fits the song. When SCALE is on CHR, the chords come from the minor scale. One finger plays the whole chord, and BoopBox records it as a chord.

### CHORD+: the black keys change the chord

When a chord mode is on, **hold a black key while you play a white one**. You can also press the black key while you hold the chord. The chord changes under your finger:

| Black key | Changes the chord |
| --- | --- |
| **F#** | major ↔ minor |
| **G#** | adds the 7th |
| **A#** | sus4 |
| **C#** | adds the 9th |
| **D#** | an inversion |

The black keys of both octaves work. You can hold several black keys. The 7th and 9th come from the scale.

For example, in C major, G4 plays **G** (the V chord). **G#** makes it **G7**. **F# + G#** make it **Gm7**. On C4, F# + G# give C-E♭-G-B. BoopBox records what you play as it sounds.

### SEL 2: STRUM and VLEAD

To open **SEL 2**, tap **SEL** twice (or tap SEL, then turn SELECT):

| Knob | Does |
| --- | --- |
| KNOB 1 **TRN** | transpose the track, ±24 semitones |
| KNOB 2 **STRUM** | plays the notes of a chord one after the other, as on a strummed guitar, 1–60 ms a note. Right = low to high. Left = high to low. Centre = off. It works on the keys and on the chord steps that the sequencer plays |
| KNOB 3 **VLEAD** | **ON**: voice leading. BoopBox voices each chord nearest the last one. As a result, a progression moves smoothly and does not jump |

---

## 12. Mix: levels, mute, solo, fills, tap tempo

| Where | What |
| --- | --- |
| **GLO + KNOB 1–4** | levels of the four tracks of the bank (1–4 or 5–8) |
| **TRACKS screen, KNOB 2** | the level of the selected track (on a muted track: unmutes it) |
| **GLO + keys 1–4 / 5–8** | mute / solo |
| **VOICE 2 page** | PAN and MUTE of a synth track |
| **TRACKS screen, KNOB 4** | the pan of the selected track |
| **GLO → DRUMS** | the LVL of the drum track, its reverb send and (2.5) its delay send (its MIDI channel: MIDI → CH4) |
| **MASTER knob** | the output volume |

A muted track fades out in a few milliseconds. It plays no new notes. Its pattern runs on in time. Several solos add up.

**Tempo:** turn SELECT on TRACKS (or inside any layer). You can also use **GLO + key 16** (tap tempo), or GLO → GLOBAL → BPM (40–240). When MIDI SYNC is on, the tempo follows the master.

---

## 13. Undo, clear, save, sections, autosave

| Action | How |
| --- | --- |
| **Undo / redo** | **EDIT + OCT−** / **EDIT + OCT+**. One level: the last recording pass, erase, clear, step or pattern edit |
| **Clear the selected track** | **hold REC** approximately 2 s. After 0.7 s, a ring fills. If you let go before the ring is full, nothing happens. Undo brings the track back |
| **Clear the pattern** | SAVE → TOOLS → **CLRSQ** (GO) |
| **Reset the sound** | SAVE → TOOLS → **INIT** (GO): the defaults and first preset of the engine |
| **Synth ↔ drum track** | SAVE → TOOLS → **KIND** (GO): the selected track becomes a drum track or a synth track (*NOW A DRUM TRACK*). Its pattern is cleared. You cannot undo this. You can also use KNOB 1 in the [sound browser](#the-sound-browser) |
| **New loop** | SAVE → TOOLS → **NEW** (GO): every track of your working loop goes back to its power-on sound, with empty patterns, at 90 BPM. *NEW LOOP, A-D KEPT*: the saved sections do not change. In song mode, stop the song first. Undo brings back only the pattern of the last track. If you are not sure, save a section first |
| **Save the loop as a section** | **SAVE + key 5–8** (A–D) |
| **Save / load a section** | SAVE → SECTION: **SECT** A–D, **LOAD** (GO), **SAVE** (GO) |
| **Erase a saved section** (2.6) | SAVE → SECTION: **SECT** A–D, **ERASE** on KNOB 2 (GO), with the song stopped. The slot is *EMPTY* again, and its section key goes dark. BoopBox takes out the steps of the song that played the section. The other steps keep their order. If no steps are left, the song is the default song A B C D. Your working loop does not change. There is no undo. If you are not sure, save the section into another slot first |
| **Save a sound** | SAVE → USER: **SLOT** (1–32), **SAVE** (GO) |
| **Autosave** | automatic. When the transport is stopped and you touch nothing for 2.5 s, BoopBox keeps the working project in flash (at most every 20 s). At power-on, BoopBox comes back exactly as you left it |

**One song on the FM-1.** The FM-1 holds one song: **four sections, A–D**, and the order they play in (the SONG screen). A **section** is a loop. It holds the eight tracks (sounds, patterns, kit, locks, nudges, fill conditions, the track filter). It also holds the global settings of the loop (tempo, swing, key…). Your **working loop** (what plays in loop mode, kept by the autosave) is separate from the sections. LOAD copies a section into it, and SAVE copies it into a section.

A–D are not four songs. **To keep several songs**, save an editor **Backup** file for each song (Save & load page). Then restore the file of the song that you want to play. (Before 2.7, the SAVE page had the name PROJECT, and its slots were 1–4: the same four sections.)

**Settings of the FM-1** (SYNC, MIDI OUT, IN, the lights, the menu settings, and the MODE, START and QUANT of the REC screen) are not part of a section. When you load a section or use NEW, these settings never change.

### The SAVE pages (SAVE tapped, not on TRACKS or DRUMS)

The SAVE pages open at **USER**. SELECT walks USER, SECTION and TOOLS. (The sounds are in the [sound browser](#the-sound-browser): turn PRESETS.)

| Page | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- | --- |
| **USER** | **SLOT** 1–32 | **LOAD** (GO) | **ERASE** (GO) | **SAVE** (GO) |
| **SECTION** | **SECT** A–D | **ERASE** (GO, 2.6) | **LOAD** (GO) | **SAVE** (GO) |
| **TOOLS** | **CLRSQ** (GO) | **INIT** (GO) | **KIND** (GO) | **NEW** (GO) |

<a id="favourites"></a>**Favourites (2.7).** To add a sound to your favourites, turn KNOB 4 right in the sound browser (*FAV ADDED*). You can have up to 16 favourites. They come first in the SYNTH list of the browser (**FAV**), in the order you added them. To remove a favourite, turn KNOB 4 left. A user preset can be a favourite too.

The favourites are a setting of the FM-1, and they stay through power-off (not in a project, and not in an editor backup). MIDI Program Change still counts the list without them.

GO: one click shows *TURN AGAIN: SAVE* (or LOAD…). A second click within approximately 1.5 s does the action. BoopBox writes presets and sections to flash only while the song is stopped.

---

## 14. Song mode: sections, chains, songs

The FM-1 holds **one song**: up to **16 steps** of **4 sections, A–D**. Each section holds every track (sounds, patterns, kit). SAVE → SECTION shows them. For more songs, keep one editor backup file for each song.

### Make it live, by playing

1. Make a loop (the verse). Press **SAVE + key 5** (*save A*). Change the loop (the chorus) and save it into **B** (key 6). Save a bridge into **C** (key 7) and an ending into **D** (key 8). To save over a used section, press the key again within 3 s.
2. **Play the sections live: SAVE + key 1–4.** Playing: the section starts on the next bar, with every track from its first step, always in time. Stopped: the section becomes the loop at once.
3. **Quick chain:** keep SAVE held and tap several section keys (*A B B C*, any order, repeats allowed, up to 8). Then let go. The first section plays on the next bar. Each next section plays after the previous one plays its **pattern length** (the length of the longest track). The chain goes round and round. The title line shows *chain A B B C*. The section that plays is lit, and the next one has a frame. A single section tap, STOP, or PLAY in song mode ends the chain.
4. **Record the song as you play it: SAVE + key 14.** From the next bar, BoopBox writes every section you play, and for how many bars, into the song. To end, press SAVE + key 14 again, or STOP (*SONG PARTS 5*). When you stop, BoopBox saves the song automatically. SONG REC also records what a chain plays.
5. **Play it back:** **SAVE + key 13** switches *loop* / *song*. In song mode, **PLAY** plays the whole song and stops at the end. After that, your loop is back.

### The SONG screen

To open it, use **SAVE tapped on TRACKS** (or on DRUMS), or **SAVE + key 16**. The screen shows the chain, and you can edit the chain by hand:

| Control | Does |
| --- | --- |
| KNOB 1 | the song step (cursor) |
| KNOB 2 | the section of that step (A–D) |
| KNOB 3 | its length in bars (1–64) |
| KNOB 4 | the number of steps in the song (1–16) |
| **REC** | stores the current loop into the section of the step. For a used section, press REC again within 3 s |
| **SAVE** (tap) | saves the song |
| **OCT−** | loop / song mode |
| **OCT+** twice (within 3 s) | loads the section of the step (this replaces unsaved work) |
| **PLAY** | play / stop |
| **SEQ** | the SEQ pages |
| **HOME** | back to TRACKS |

You can edit the settings of the song only while it is stopped (*STOP FIRST*). An empty section cannot play (*EMPTY SECTION: REC*).

---

## 15. The screens

| Screen | How to get there | What it shows · what the knobs do |
| --- | --- | --- |
| **TRACKS** | tap **HOME** | the performance view: tempo, swing, transport, bar.beat. Each track shows its sound, steps, playhead, mute / solo / rec badges and level. **(2.8)** A coloured **A–D** badge next to the title shows which section plays. Dials: KNOB 1 **swing** (global) · KNOB 2 **level** (selected track, and on a muted track it unmutes it) · KNOB 3 **steps** (its length) · KNOB 4 **pan** |
| **Visualiser** | tap **HOME** on TRACKS | full-screen visualiser, six styles. See [The visualiser](#19-the-visualiser) |
| **Layer** | hold a layer button | 16 tiles (the white keys) and the four dials, in the colour of the layer |
| **DRUMS** (grid / kit / sound) | tap **SEQ** (grid) or **EDIT** (kit) with the drum track | see [The DRUMS screen](#the-drums-screen) |
| **REC READY / FREE TAKE / COUNT-IN** | **REC** while stopped | the tracks, then **mode · length · start · quant** on KNOB 1–4 (4-3-2-1 during a count-in). In a free take: the seconds and the loop that the take makes |
| **Hold ring** | hold **REC** | the ring of *clear track* filling |
| **SONG** | tap **SAVE** on TRACKS, or **SAVE + key 16** | the section chain. See [The SONG screen](#the-song-screen) |
| **Pages** | tap ENV, LFO, FX, SEL, EDIT, ARP, SEQ, GLO, SAVE | four colour-coded values with a graph (ENV, LFO, ARP, SEL, FX, SLICER…), or the four values in large type, placed as the knobs are (1 2 / 3 4) |
| **CHORDS** | tap **SEL** past SEL, SEL 2, HARMONY and FOLLOW | the chord and progression of the song. The keys play the chord live ([the groovebox controls](docs/groovebox-controls.md#the-chords-screen)) |
| **PATTERNS / CHAIN / SCENES** | tap **SEQ** past PLAY, or hold **SEQ** + tap **SAVE** (SCENES) | the keys are pads: see [the SEQ pages](#10-the-step-sequencer-steps-nudge-locks-fills) |
| **Menu** | hold **HOME** | the settings of the FM-1 in six sections. See [The HOME menu](#20-the-home-menu-and-the-lights) |

The **title line** of every screen also shows short messages: *KEY D*, *ERASED*, *TURN AGAIN: SAVE*, *TRACK 3: LOFI FLUTE* (ALGORITHM on a page, 1.2.0), *NEXT: B*, *chain A B B C*, *lock flt 12*…

The lettering (2.6) is Terminus **Bold**, all in **capitals**. The strokes are thicker, so the text is easier to read on the small screen at arm's length. The layout is the same as before (same 8 × 16 cell).

---

## 16. Every page, knob by knob

Tap a button to open its first page. **Tap it again** to open its next page. Or turn **SELECT** to go back and forth through the pages. The number after the title (*TIMING 2/3*) counts the pages that SELECT goes through.

If you tap SEQ more times, it also opens the SONG screen. If you tap SEL more times, it also opens the CHORDS screen. These two are separate screens: SELECT does not go into them. On the drum track, the pages that do not apply to it show *DRUM TRACK*.

| Button | Page | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- | --- | --- |
| **ENV** | **ENV** | ATK attack (2.8.3: on SAMPLE and SLICE, every note starts with it. This includes a sample that plays again while its voice still sounds) | DEC decay | SUS sustain | REL release |
| | **ENV DEST** | FLT: envelope → brightness (±) | PIT: envelope → pitch (±, the 808 punch) | SHP: envelope → the shape of the engine (±) | ESYNC (2.6): OFF / ON. ON sets ATK, DEC and REL as note values |
| **LFO** | **LFO** | RATE (Hz) | WAVE: SIN, TRI, SAW, SQR, S&H | PHS phase | FADE (fade-in time) |
| | **LFO 2** (2.6) | SYNC: OFF, 4BAR, 2BAR, 1BAR, 1/2, 1/4, 1/8, 8T, 1/16, 16T, 1/32 | TRIG: NOTE / FREE | POL: BI / UNI | — |
| | **LFO DEST** | PIT: vibrato | FLT: filter wobble | SHP: shape | AMP: tremolo |
| **FX** | **FX** (sends) | DST drive | CHO chorus send | DLY delay send | REV reverb send |
| | **FILTER** | FILT: the one-knob filter of the track. Left is LP, right is HP, centre is OFF (the drum track has it too. 2.7.2: its page is no longer greyed) | MIX: the dry / wet of the INSERT (1.2.0. Before 1.2.0: on INSERT 2) | — | — |
| | **SLICER** | SLCR: OFF, GATE, STUT (stutter) | PAT: pattern 1–16 | RATE: 1/8, 1/16, 1/32, 8T, 16T, 32T | DEPTH |
| | **INSERT** (2.6) | INSRT: OFF, SOFT, HARD, FOLD, FUZZ, CRUSH, PHASR, FLANG, CHOR | A | B | C (A, B and C change with the type: see [Per track](#per-track)) |
| | **DLY** (global) | TIME: 1/4, 1/8, 1/16, 1/32, 8T, 16T, 1/8D, 1/16D, 1/4D (2.6. At 60 BPM or less, it stops at 1.49 s) | FDBK feedback | COLR colour (the tone of the repeats) | MIX |
| | **REV/CHO** (global) | SIZE reverb size | DAMP reverb damping | CRT chorus rate | CDP chorus depth |
| | **PERF** (global) | TARGET: what the punch-in effects act on: MASTER, SEL (the selected track), DRUMS, SYNTHS | LATCH: OFF / ON (a tap turns an effect on, and a tap on the same key turns it off) | Q: when an effect starts: OFF, 1/16, 1/8, 1/4, BAR | — |
| **SEL** | **SEL** | ROOT (the key of the track) | SCL: the scale of the track (SEL + KNOB 2 sets every synth track) | QNT keys: OFF, SNAP, WHITE | CHORD: OFF, TRIAD, 7TH, 9TH, SUS4, POWER |
| | **SEL 2** | TRN transpose ±24 | STRUM ±60 ms | VLEAD: OFF / ON | — |
| | **HARMONY** (global) | KEY of the song C … B | SCALE (the 16 scales) | Q: when a change takes effect: NOW, BEAT, BAR | PROG: the chord progression OFF / ON |
| | **FOLLOW** | FOLLOW: how the sequenced notes of the track follow the chord of the song: OFF, TRANS, SCALE | — | — | — |
| | **CHORDS** | the CHORDS screen ([the groovebox controls](docs/groovebox-controls.md#the-chords-screen)) | | | |
| **EDIT** | **EDIT 1** | engine parameter 1 | 2 | 3 | 4 (see [the engines](#the-thirteen-engines)) |
| | **EDIT 2** | engine parameter 5 | 6 | 7 | 8 |
| | **FILTER** (ANALOG only, 2.6) | TYPE: LP, BP, HP | CUT cutoff | RES resonance | KTR key tracking |
| | **VOICE** | VCE: POLY, MONO, LEG (legato), UNI (unison) | GLD glide | GLMOD: RATE / TIME | PRIO: LAST, LOW, HIGH (mono note priority) |
| | **VOICE 2** | ALLOC: ROT (rotate) / REUSE | DTUNE (unison detune) | PAN | MUTE |
| **ARP** | **ARP** | MODE: OFF, UP, DN, UPDN, RND, ORD, and (2.7) REPEAT, DNUP, UP+8, CONV, DIVG, PINKY, THUMB, WALK, CHORD ([below](#arp-modes)) | RATE: 1/4 … 16T | OCT: 1–4 octaves | GATE |
| | **ARP 2** | SWG swing (2.7: also when the sequencer is stopped) | PROB probability of each note | HOLD: OFF / ON (latch. With MODE OFF, 2.7: [KBD HOLD](#kbd-hold)) | ORD: NOTE (pitch order) / PLAY (the order you played) |
| **SEQ** | **NOTES** | NOTE (cursor) | PITCH | LEN (the number of steps the note lasts) | FORCE: GHOST, SOFT, NORM, HARD, ACC (see [the NOTES page](#10-the-step-sequencer-steps-nudge-locks-fills)) |
| | **TIMING** | LEN 1–64 steps | DIV 1/4 … 2BAR | SWG track swing | GATE note length |
| | **PLAY** | DIR: FWD, REV, PEND, RAND | SEED 0–255 (on a drum track, the keys make [beats](#beats-from-the-keys-19)) | — | — |
| | **PATTERNS** | PATTERN (cursor. The keys are pads: [groovebox controls](docs/groovebox-controls.md#patterns)) | QUANT (PAT Q) | COPY the pattern that plays here (twice) | CLEAR it (twice) |
| | **CHAIN** | SLOT (or the end) | its PATTERN | REPEAT ×1–×16 | PLAY on / off |
| | **SCENES** | SCENE | QUANT (PAT Q) | NAME | the PATTERN of the track in it (or keep) |
| | **SONG** | the SONG screen | | | |
| **GLO** | **GLOBAL** | BPM 40–240 | SWING (all tracks) | CLICK: OFF, REC, ON | TUNE ±50 cents |
| | **MASTER** | DUST | DUCK | FILT (DJ filter) | ROLL (note-repeat rate) |
| | **DRUMS** | LVL drum level | REV drum reverb | DLY drum delay | — (1.2.0: its MIDI channel is only on MIDI → CH4) |
| | **TEXTURE** (2.6) | SRC: OFF, VINYL, TAPE, RAIN, WIND, RADIO, ROOM, USR1–4 | LEVEL | TONE (LP ← OFF → HP) | MOVE |
| | **TEXTURE 2** (2.6) | RATE: 1–16 bars | WHEN: PLAY / ALWAYS | DUCK: OFF / ON | — |
| **MIDI** (1.2.0: hold HOME, SEQ, OCT+ on MIDI SETTINGS. Before 1.2.0: pages of GLO) | **MIDI** | CH1: the MIDI channel of track 1 (OFF, 1–16) | CH2: the channel of track 2 | CH3: the channel of track 3 | CH4: the channel of the drum track (default 10) |
| | **MIDI 2** | CH5: the channel of track 5 | CH6 | CH7 | CH8 |
| | **MIDI 3** | IN: NOTES / CLOCK / CH 1–16 | OTHER: the channels that no track has: SEL (the selected track) / OFF | OUT: KEYS / SEQ | BEND: the range of the pitch bend, 1–12 semitones |
| | **MIDI 4** | FX CH: the MIDI channel of the punch-in effects (OFF, 1–16) | DR MAP: how MIDI notes play the drums (GM / 1-16) | REMOTE: the buttons over MIDI (OFF, 1–16) | CLOCK: OUT, the MIDI clock and START / STOP |
| | **SYSTEM** | SYNC: INT, USB, TRS | CPU load (the USB link state when no computer is connected) | — | — |
| **SAVE** | **USER** | SLOT 1–32 | LOAD (GO) | ERASE (GO) | SAVE (GO) |
| | **SECTION** | SECT A–D | ERASE (GO) | LOAD (GO) | SAVE (GO) |
| | **TOOLS** | CLRSQ: clear the pattern (GO) | INIT: reset the sound (GO) | KIND: synth ↔ drum track (GO) | NEW loop (GO) |

Notes:

- **Global** pages (DLY, REV/CHO, PERF, HARMONY, GLOBAL, MASTER, DRUMS, TEXTURE and the MIDI pages) are the same for all tracks. They do not change with the selected track.
- **1.2.0:** a page of values shows its four values one time, large, in the corners of their knobs (KNOB 1 top left … 4 bottom right). The bottom line names the page, between the page before it and the page after it.
- **SYNC**, **MIDI** and **IN** are settings of the FM-1. The FM-1 keeps them when you load a project.
- On the **drum track**, these pages work: SLICER, TIMING and PLAY (SEQ), the PATTERNS, CHAIN, SCENES and SONG pages, and the global pages. SEQ opens the DRUMS screen in place of NOTES. The kit, level, reverb and pan of the drum track are on the DRUMS kit page. Its filter is **FX + KNOB 4**.
- FM6 tracks ignore the ENV page and ENV DEST, because each operator has its own envelope.
- <a id="arp-modes"></a>**ARP modes** (2.7, after Felucca 1.4 / 1.5.1). These examples use C, E and G held: **UP** C E G · **DN** G E C · **UPDN** C E G E · **DNUP** G E C E · **RND** in a random order · **ORD** in the order you pressed them · **REPEAT** the last note you pressed, again and again (OCT has no effect) · **UP+8** C E G C' (the first note again, an octave above the top) · **CONV** C G E (from the outside in) · **DIVG** E G C (from the inside out) · **PINKY** C G E G (the top note between the others) · **THUMB** C E C G (the bottom note between the others) · **WALK** one step up or down at random, from the bottom · **CHORD** the held notes together (the first four), on every step, an octave higher each step through OCT. OCT spreads the list over 1–4 octaves. For the other modes, ARP 2 ORD PLAY keeps the order you played. Until 2.6, ORD played as UP unless ARP 2 ORD was PLAY. Now ORD always follows the order you pressed.
- <a id="kbd-hold"></a>**KBD HOLD** (2.7): with ARP 2 → **HOLD ON** and ARP → **MODE OFF**, the FM-1 holds the notes you play, without an arpeggio. When you let go, they continue to sound (a pad, a drone, a chord to play over with one hand). The next note that you play with no key down **replaces** them (a new chord). Notes that you play while keys are still down **join** them. The MIDI note-offs of the keys wait too, so gear that the FM-1 plays holds with it. **HOLD OFF** ends the held notes (also ARP on, another project, or NEW). Loading another sound also ends the held notes, but HOLD stays ON. Projects saved before 2.7 open with HOLD OFF when their arp is OFF, because HOLD did nothing then. Thus no notes hang by surprise. KBD HOLD works for MIDI notes too. The recording is the same as what you hear: a held note ends where a new note replaces it. Up to 2.6, HOLD did nothing with the arp OFF.
- **ARP SWG** (2.7): the swing of the arp also works when the sequencer is stopped (the odd steps late), as it does during play. Until 2.6, it only worked during play.
- **ARP and sounds** (2.7): while the arpeggiator runs (MODE not OFF), loading another sound (a preset or a user preset) keeps the arp. Its settings (both ARP pages) and the notes it holds or latches continue with the new sound. With the arp OFF, a preset that has its own arp (8BIT ARP…) brings it, as before. (2.7.1) An arp that came with the sound (8BIT ARP, a user preset saved with its arp) goes away with that sound if you did not change it. Then the next sound brings its own arp (most often OFF). If you change one of its settings, the arp is yours: it continues with the next sounds.
- **ENV SYNC** (ENV DEST → ESYNC ON, 2.6): ATK, DEC and REL become note values of the tempo. The values go from 0 through 1/64T … 1/4, 1/2 … to 4BAR, with triplets and dotted values. At 120 BPM, an ATK of 1/4 lasts half a second. At 60 BPM, it lasts a whole second. These values follow the tempo when it changes. With OFF, the times are in milliseconds, as before.
- **LFO 2** (2.6): **SYNC** locks the cycle of the LFO to a note value of the tempo (then RATE has no effect. With OFF: RATE, as before). **TRIG** NOTE restarts the LFO at PHS on each new phrase (as before). FREE lets the LFO continue to run. **POL** BI swings above and below the value. UNI swings only above it (a tremolo that only lowers the level, a wobble that only opens).
- **FILTER** (EDIT, ANALOG only, 2.6): the filter of the ANALOG engine as a **low-pass** (as before), **band-pass** or **high-pass**. CUT, RES and KTR are the same values as on EDIT 2.
- On the screen, EDIT 1 and EDIT 2 have the page names of the engine: ANALOG *OSC / FLT*, DIGITAL *OPS / MOD*, PHASE *PHS / LINE*, LOFI *CHIP / MOTN*, SAMPLE *SET / TONE*, VOICE *VOWL / TONE*, TRIO *OSC / TONE*, WHEEL *BARS / TONE*, GRAIN *GRAN / SPRY*, FM6 *OPS / PATCH*, PHYS *BODY / EXCT*, NOISE *SRC / MOVE*, OBERVAVE *PROGRAM / FILTER*.
- You can **lock** any sound parameter on these pages on a step (see [Parameter locks](#parameter-locks)). The exceptions are the pattern, arp, key and voice-mode parameters.

---

## 17. The sounds and the thirteen engines

### The sound bank

There are **223 factory sounds**. Each one is a full patch on one of the thirteen engines. All are level-matched: the same LEVEL gives the same loudness. **PRESETS** opens the [sound browser](#the-sound-browser). It sorts the sounds by engine, or **by kind**: basses, keys, organs, pads, leads, plucks and bells, stabs, FX. Your **32 user presets** come after them. A new project starts at **90 BPM**, with *808 BOOM* on track 1, *RHODES* on track 2, *LOFI FLUTE* on track 3 and the 808 kit on track 4.

| Kind | Sounds (engine) |
| --- | --- |
| **Bass** | 808 BOOM, 808 DIRTY, 808 SLIDE, SUB BASS, PLUGG BASS (they slide between held notes, two octaves under the keys) · REESE, WOBBLE, ACID 303, FUNK BASS, MONO BASS (ANALOG) · FM BASS, BASS GTR (DIGITAL) · CZ BASS (PHASE) · ROUND BASS (FM6) · FAT BASS (TRIO) · WOW BASS (VOICE) · GB BASS (LOFI) · UP BASS, DEEP BASS (SAMPLE) · PLUCK BASS (PHYS) · NES BASS (LOFI) · SAW BASS (ANALOG) |
| **Keys** | RHODES, DX RHODES, WURLI, M1 PIANO, AFRO KEYS, CLAV (DIGITAL) · GRAND PNO, DUSTY PNO, LOFI KEYS (SAMPLE) · SOFT KEYS (PHASE) · TINE EP (FM6) · FM GRAND (DIGITAL) |
| **Organ** | SOUL ORGAN, GOSPEL, JAZZ ORGAN, DIRTY B3, HOUSE ORGN (WHEEL) · DRAWBARS (FM6) · ACCORDION (TRIO) · ROCK ORGAN, CHAPEL, REGGAE ORG (WHEEL) |
| **Pad** | WARM PAD, DARK STR, ATMOS PAD (ANALOG) · SAW PAD, ENSEMBLE (TRIO) · GLASS PAD (DIGITAL) · SOFT PAD (FM6) · CZ STRING (PHASE) · LOFI CLOUD, VIBE HAZE, STR CLOUD, SHIMMER, DRONE (GRAIN) · CHOIR AAH, SOUL OOH (VOICE) · BOWED MTL, CELLO BOW, GLASS BOWL (PHYS) · WIND, OCEAN (NOISE) · CZ PAD (PHASE) · VOX PAD (VOICE) · PNO FREEZE, HORN CLOUD (GRAIN) · SINE PAD (ANALOG) · PULSE PAD (TRIO) |
| **Lead** | SUPERSAW, G-FUNK LD, FAT LEAD, PAN FLUTE (ANALOG) · SYNC LEAD, HOOVER (TRIO) · TALKBOX, HARMONICA (VOICE) · GAME LEAD (LOFI) · LOFI FLUTE (SAMPLE) · FLUTE DUST (GRAIN) · NZ ARCADE (NOISE) · WAVE LEAD (LOFI) · CZ LEAD (PHASE) · ROBOT (VOICE) · PWM LEAD (ANALOG) · SQR LEAD (TRIO) |
| **Pluck & bell** | TRAP PLUCK (ANALOG) · RESO PLUCK (PHASE) · PLUGG BELL, TRAP BELL, MUSIC BOX, KALIMBA, MARIMBA, XYLOPHONE, GLOCKEN, CELESTA, STEEL DRUM, HARP (DIGITAL) · VIBES (SAMPLE) · 8BIT ARP (LOFI) · GLASS BELL, WOOD BARS, NYLON PICK (FM6) · STR PLUCK, SITAR, PHYS HARP, BELL TREE, MODAL BAR, THUMB PNO, NYLON GTR, STEEL GTR, MUTED GTR, KOTO, BANJO, TANPURA, CHIMES, BIG BELL, VIBRA BAR, STEEL PAN, WOOD BLOCK (PHYS) · 1BIT BEEP (LOFI) · CZ RESO (PHASE) · TUBE BELL, FM PLUCK (DIGITAL) |
| **Stab** | MIN STAB, MIN7 STAB, RAVE STAB, DUB CHORD (TRIO: one key plays the chord) · SYN BRASS (ANALOG) · CZ BRASS (PHASE) · BRASS SECT (FM6) · 80S POLY (TRIO) · HORN STAB, STRING STB (SAMPLE) · CHIP CHORD (LOFI) · POWER STAB (TRIO) |
| **FX** | SCRATCH (scratch, backspin, rewind across the keys) · GM KIT (SAMPLE) · HAND DRUM, MEMB TOMS, TABLA, CONGA, TIMPANI (PHYS) · RAIN, NZ METAL, VINYL, HISS, RISER, NZ SNARE, BITCRUSH, RADIO (NOISE) · CHIP NOISE (LOFI) |

<a id="the-sound-browser"></a>**The sound browser.** On TRACKS (or HOME), on any track, turn **PRESETS**. The browser opens, and your current sound
stays unchanged. The browser has three levels: the **TYPE** (SYNTH or DRUMS), the **engines** of that type on the left, and every
**sound** of the selected engine on the right. The sound that plays is on a white bar.
A scroll bar shows your position in a long engine. Each sound loads when you land on it. Play the keys to hear it.

| Control | In the browser |
| --- | --- |
| **KNOB 1 TYPE** | right **DRUMS**, left **SYNTH**: the track becomes a drum track or a synth track (see below) |
| **PRESETS** · **KNOB 2 ENG** | the next / previous engine of the type: its first sound. It stops at the first and last engine |
| **ALGORITHM** · **KNOB 3 SOUND** | the next / previous sound of the engine. It stops at the first and last sound: it never scrolls into the next engine. (ALGORITHM does not change the track here) |
| **SELECT** | the VIEW: right **KIND** (basses, keys, organs, pads, leads, plucks and bells, stabs, FX: the order of the list before), left **ENG** (the thirteen engines in order, each with its sounds) |
| **KNOB 4 FAV** | right adds the sound to your favourites, left removes it (synth sounds) |

**SYNTH** starts with your favourites (**FAV**) and ends with your user presets (**USER**), in both views. **DRUMS** has
no engines. Its kits are in groups by kind instead. **GM KIT** is the sampled kit and its treatments. **MACHINE** is the
synthesised kits (808, 909, TRAP…). **USR SMP** is your sample kits (USR1–4, USR3+4). **USR SYN** is your synth kits
(SYN1–4).

While the browser is open, **SAVE** breathes. Tap it to keep the sound and close the browser. **HOME** glows at half
brightness. Tap it to put back the sound you had. When you change the TYPE, the track changes kind (as SAVE → TOOLS → KIND does). This clears its pattern.
If the track has a pattern, the first turn shows *AGAIN*. A second turn in approximately 1.5 s changes the kind. On an
empty track, the kind changes immediately.

The browser stays open until you close it (1.4.2):

- **SAVE** keeps the sound you are on and closes the browser (*SOUND KEPT*).
- **HOME** closes the browser and puts back the sound that the track had when the browser opened (*SOUND PUT BACK*). This includes the kit, or the engine and
  its settings. A change of TYPE cleared the pattern: HOME puts back the sound, not the pattern.
- Any other button goes to its usual place and keeps the sound you are on.

The browser closes to the screen that it opened from. If you tap SAVE elsewhere, it opens the SAVE pages at **USER** (USER, SECTION, TOOLS).
The browser belongs to the PRESETS knob. MIDI Program Change counts the list in the KIND order, as before.

To start from the defaults of the engine, select SAVE → TOOLS → **INIT**.

### The thirteen engines

The eight parameters of each engine are on **EDIT 1** (KNOB 1–4) and **EDIT 2** (KNOB 1–4). Tap EDIT once for EDIT 1 and twice for EDIT 2. The screen shows them under the page names of the engine (for example DIGITAL: *OPS*, *MOD*). A dash is an unused knob.

| Engine | Sound | EDIT 1: KNOB 1 · 2 · 3 · 4 | EDIT 2: KNOB 1 · 2 · 3 · 4 |
| --- | --- | --- | --- |
| **ANALOG** | virtual analogue: two oscillators, filter | WAVE (SAW, SQR, TRI, SIN, PWM) · DTN detune · MIX · NOIS noise | CUT cutoff · RES resonance · DRV drive · KTR key tracking |
| **DIGITAL** | 4-operator FM | ALG algorithm 1–8 · R2 · R3 · R4 (operator ratios) | IDX FM amount · MDEC modulator decay · FB feedback · — |
| **PHASE** | phase distortion (CZ style) | WAVE · WAVE2 (a second wave, or –) · DCW (the distortion amount) · ENV (its envelope) | DTN detune · LINE: MIX / RING · SUB sub-oscillator · — |
| **LOFI** | 8-bit chip | CHIP: 4BIT, 4B/2, 8BIT, 1BIT, STEP · WAVE: PLS, TRI, SAW, NOIS, WRAM · DUTY (pulse width / wave table) · CRSH crush (DCY on STEP) | SWP pitch sweep · VIB vibrato · ARP: OFF, OCT, MAJ, MIN (chip arpeggio) · TONE |
| **SAMPLE** | sampler | SET: PIANO, BASS, VIBES, HORNS, STRGS, FLUTE, SCRCH (2.7.2: one scratch over the whole keyboard), PERC, **USR1–USR4** · TUNE ±24 · BITS (bit reduction) · LOOP: OFF / ON | CUT (tone) · — · DRV drive · — |
| **VOICE** | formant voice (choirs, talkbox) | VOWL vowel · VOWL2 second vowel · TALK (the time from one vowel to the other) · SHIFT formant shift ±12 | BUZZ · BRTH breath · Q · RAND |
| **TRIO** | three oscillators | WAVE (16 combinations) · INT2 · INT3 (intervals of oscillators 2 and 3, ±24) · DTN | MODE: LP, BP, HP, NOT (filter type) · CUT · RES · PW pulse width |
| **WHEEL** | tonewheel organ | REG (16 drawbar registrations: FLUTE, MELLO, HOLLW, SMOOT, 3BAR, BLUES, GOSPL, ROCK…) · SUB · BODY · TOP (drawbar groups ±8) | PERC: OFF, 2ND, 3RD, 2SOFT, 3SOFT, 2SLOW, 3SLOW · CLICK · DRV · ROTR: OFF, SLOW, FAST (rotary speaker) |
| **GRAIN** | granular | SRC (any sample set, USR1–USR4 too) · POS position · SIZE grain size · DENS density | PTCH ±24 · SPRD spread · RAND randomness · TONE |
| **FM6** | six-operator FM, DX7 patches | ALG: PAT (the algorithm of the patch) or 1–32 · FB feedback · MLVL modulator level (brightness) · MRAT modulator ratio | MEG modulator envelopes slower / faster · VMOD velocity → brightness · DTUN carrier spread · PTCH: F1–F8 factory, B1–B27 your bank |
| **PHYS** | physical models: strings, bars and bells, drum heads, sympathetic strings (DaisySP and Rings, as Felucca 1.0 ported them. 3 voices a track, SYMP 2) | MODEL: MODAL, STRNG, MEMB, SYMP · STRC structure (MEMB: HARM, SYMP: CHRD the chord of the sympathetic strings) · BRIT brightness · DAMP | POS strike / pluck position (SYMP: SYMP, how much they ring) · ACC accent · BOW bowing (MEMB: BEND, SYMP: BUZZ) · EXC the exciter in the mix |
| **NOISE** | noise, from analogue to digital: colours, crackle, shift registers, metallic tones | MODE: ANLG, DUST, LFSR, META · COLR white → pink → brown · FREQ · RES | TRK key tracking · DENS impulses (LFSR, META: LEN, the register) · DRFT drift · CRSH crush (LFSR, META: CLK, the clock above the key) |
| **OBERVAVE** (1.7) | the 8-voice analog polysynth OberVave (zvenson): two oscillators with sync and cross-mod, noise, drive, a 24 dB ladder or a 12 dB filter (LP, HP, BP, notch, SEM), its own filter envelope, an LFO, vintage drift | PROG (one of its 70 programs) · TYPE (PROG: the filter of the program, or LP12, HP12, BP12, NOTCH, LP24, SEM) · XMOD · DTN (the fine tune of oscillator 2) | CUT · RES · FENV (the amount of the filter envelope) · DRV. All except PROG and TYPE move the value of the program: 0 is the program as it was made |

The **SAMPLE** sets are free recordings (CC0: Versilian Studios VSCO-2 CE and VCSL, Sonic Pi). They are coloured like a record through an old sampler. **GRAND PNO** is a Steinway, recorded note by note. Long notes fade as on the real piano.

### Polyphony

The synth tracks **share one pool of 20 voices** (BoopBox Trainer: 8). The drum tracks have their own 6 voices. One track plays a maximum of 8 voices at the same time. When an engine plays on its own, its maximum polyphony is:

| Voices | Engines |
| --- | --- |
| **8** | ANALOG, DIGITAL, PHASE, LOFI, SAMPLE, TRIO, WHEEL, NOISE, OBERVAVE |
| **6** | FM6 |
| **4** | VOICE |
| **3** | GRAIN, PHYS (SYMP model: **2**) |

In **MONO** or **LEGATO**, a track plays one note at a time. **UNISON** stacks detuned voices within the same limit. If the synth tracks together need more than 20 voices, a part that needs a voice takes the oldest voice that sounds (a released voice first, never the bass of a track). If the FM-1 runs short of time with many heavy voices (FM6, PHYS, TRIO...), it fades out the quietest voices one by one. The SYSTEM page shows the load ([the MIDI pages](#all-the-midi-settings-midi-to-midi-4-and-system), KNOB 2).

A maximum of **three tracks** can play the big engines (GRAIN, WHEEL, FM6, PHYS, OBERVAVE) at the same time. If you choose one on a fourth track, the FM-1 refuses it (*BIG ENGINES: 3 IN USE*). The track keeps its sound.

### FM6 and DX7 patches

**FM6** is msfa, the synthesis core of Dexed, as Felucca 1.0 ported it. It has six operators with their own four-stage envelopes, keyboard scaling, velocity, ratio or fixed frequency, and detune. It has 32 algorithms, feedback, an LFO and a pitch envelope. It plays six voices per track. The eight EDIT values above are **macros on top of the patch**. The FLT of the track moves MLVL, so LFO → FLT still makes it brighter. SHP moves the feedback, and PIT moves the pitch.

Edit full patches in the **FM6** panel of the web editor (Sound page, on an FM6 track). The panel has every operator, **Send to track**, **Store in bank** (B1–B27), **Import SysEx** and **Export SysEx**. **Import SysEx** takes a DX7 voice or a 32-voice bank. Thousands of DX7 and Dexed patches play on the FM-1. You can also drop the .syx file on the panel.

**Store cartridge in bank** (2.5) puts a whole 32-voice cartridge on the FM-1 at one time. The first 27 voices are ticked. Or tick the voices you want, up to 27. One write puts them in B1, B2… in order. The editor asks before it replaces patches. The rest of the bank stays. Stop the song first.

Before you store, you can choose to **also add them to the user presets** (in the free slots, or from a slot you pick). Each voice then gets a user preset with its name, and this preset plays its B slot. Thus, on the FM-1, you pick the voice by name with **PRESETS** or **SELECT**, like any sound. The editor tells you which user presets it will replace. (A user preset keeps PTCH, not the patch: the voice itself stays in the bank.)

Then pick them on the FM-1 with **PTCH** (EDIT page 2: B1–B27 after the factory F1–F8). A project keeps the **PTCH** of the track, not the patch itself. To keep an edited patch, store it in the bank.

---

## 18. Effects: master, punch-in, per track

### Signal path

Each synth track: engine → **drive** (DST) → **INSERT** (2.6) → **SLICER** → **FILTER** (the filter of the track) → level (and DUCK) → pan and **sends** to the stereo chorus, the tempo delay and the reverb. The drum track has its own INSERT (2.6), slicer, filter, level, pan, reverb send and (2.5) delay send. Then the whole mix goes, with the effect returns (and, 2.6, the **TEXTURE** bed), through **DUST** → **punch-in effects** → **FILT** (the DJ filter) → **MASTER** volume → limiter. (2.6: the limiter looks one block, 0.7 ms, ahead. Thus a loud hit is already turned down when it arrives. The limiter never pushes it into the soft clipper of the output.)

### Master: DUST, DUCK, FILT, ROLL

On FX + KNOB 1–3, or GLO → MASTER:

| | Does |
| --- | --- |
| **DUST** 0–100 % | the mix through an old sampler and a record: drive into a soft clip, a lower sample rate (down to ~11 kHz), fewer bits (down to 8), a low-pass that closes to ~3 kHz. While the transport plays, also a little hiss and crackle (a stopped BoopBox is silent) |
| **DUCK** 0–100 % | every kick pumps the synth tracks down and back over an 1/8 note: the sidechain sound, in time at any tempo |
| **FILT** | a DJ filter: left of centre, a low-pass that closes. Right of centre, a high-pass that opens. Centre is OFF. It glides (no zipper noise) |
| **ROLL** | the note-repeat rate of ARP + key |

### Punch-in effects

**FX + white key**: the effect runs on the whole mix while you hold the key. It stops cleanly when you let go of the key. Loops and the gate lock to the tempo and start on the grid. **Fade (2.8):** hold **FX**, then turn **SELECT** (shown top right) to set a fade-in and fade-out for the punch-ins. The range is 0 (off: instant, with only an anti-click) to 15 (about 0.37 s). The effects then ease in and out, and do not snap on and off. **Over MIDI (2.7):** set MIDI 4 → **FX CH**. Then the notes F3 … G5 on that channel play the same 27 effects (see [the MIDI settings](#all-the-midi-settings-midi-to-midi-4-and-system)).

| Key | Effect | Key | Effect |
| --- | --- | --- | --- |
| 1 · F3 | loop 1/4 | 9 · G4 | low-pass sweep |
| 2 · G3 | loop 1/8 | 10 · A4 | high-pass sweep |
| 3 · A3 | loop 1/16 | 11 · B4 | phone |
| 4 · B3 | loop 1/32 | 12 · C5 | bit crush |
| 5 · C4 | stutter (1/16 triplets) | 13 · D5 | alias (sample-rate drop) |
| 6 · D4 | reverse | 14 · E5 | gate 1/16 |
| 7 · E4 | tape stop | 15 · F5 | echo (dotted 1/8) |
| 8 · F4 | half speed | 16 · G5 | tape wobble |

**FX + black key** (2.6): eleven more effects, on the black keys from the lowest F# to the highest.

| Key | Effect | Key | Effect |
| --- | --- | --- | --- |
| F#3 | **KILL LOW**: removes the lows (below ~250 Hz, 24 dB/oct, DJ style) | F#4 | **FLANGER**: a jet sweep over a bar, with left and right apart |
| G#3 | **KILL MID**: removes the mids (~250 Hz – 2.5 kHz) | G#4 | **AUTO-PAN**: the mix in mono, moves left and right one time a beat |
| A#3 | **KILL HIGH**: removes the highs (above ~2.5 kHz) | A#4 | **FREEZE**: the mix goes into the reverb and stays there while you hold the key. When you let go, it dies away with the SIZE of the reverb |
| C#4 | **REWIND**: the record is pulled back. It slows, stops and spins backwards faster and faster (about a third of a second of the past). Then silence until you let go | C#5 | **LOOP 8T**: loop 1/8 triplet |
| D#4 | **OCT UP**: the mix an octave up | D#5 | **MONO**: left and right in one |
| | | F#5 | **FADE OUT**: the mix fades to nothing over two beats |

The screen shows the 27 keys as a keyboard. The white keys are in four rows of four, as on the other layers. The black keys are above them. Each black key is between the two white keys that it is between on the FM-1. The black key after the last white key of a row is at the right end of that row. The held effect is lit white.

### Texture (2.6)

**GLO → TEXTURE** (and TEXTURE 2): a looping bed under the whole mix, the glue of lo-fi and ambient tracks. It does not use a track. It goes into the dry mix (not the sends), before DUST, the punch-ins and the master filter.

| Knob | TEXTURE | TEXTURE 2 |
| --- | --- | --- |
| 1 | **SRC**: OFF, **VINYL** (hiss, rumble, crackle), **TAPE** (dark hiss, drifting), **RAIN** (a bed and droplets), **WIND** (resonant gusts), **RADIO** (bursts of static), **ROOM** (room tone), **USR1–USR4** (your sample slot, its first sound looped at its own pitch) | **RATE**: how long one breath of MOVE takes: 1, 2, 4, 8 or 16 bars of the tempo |
| 2 | **LEVEL** | **WHEN**: PLAY (it fades in and out with the transport) / ALWAYS |
| 3 | **TONE**: left is a low-pass, right is a high-pass, centre is open | **DUCK**: ON: the kick pumps it too (GLO → MASTER → DUCK) |
| 4 | **MOVE**: how much it breathes over RATE (its level and brightness) | — |

The project saves the texture, and each song section (A–D) has its own texture. The generated sources use no memory. At SRC OFF, nothing runs.

### Per track

- **FILTER** (FX → FILTER, or **FX + KNOB 4** for the selected track): one knob. Left is a low-pass, right is a high-pass, centre is off. It stays when you change the sound. You can lock it on a step. The project saves it. Its **resonance** is one setting for every track, in HOME menu → AUDIO → **FILTER RESO** (0 clean … 10, 2.7.2). **(2.8) The drum track has it too:** FX → FILTER sweeps and shapes the whole kit, live.
- **Sends** (FX page): DST drive, CHO chorus, DLY delay, REV reverb. The delay settings and the reverb / chorus settings are global (DLY and REV/CHO pages). The TIME of the delay includes dotted 1/8 and 1/16.
- **SLICER** (FX → SLICER): a tempo gate (GATE) or stutter (STUT), 16 patterns, 1/8 to 32T, with a depth.
- **INSERT** (FX → INSERT, and its MIX on FX → FILTER, 2.6, after Felucca 1.5): one effect on the track alone, immediately after its drive. The drum track has one too, on the whole kit and its sends. MIX sets dry / wet. A, B and C change with the type:

| Type | A | B | C |
| --- | --- | --- | --- |
| **SOFT** (soft clip), **HARD** (hard clip), **FOLD** (wavefolder), **FUZZ** | DRIVE | TONE | LEVEL |
| **CRUSH** | BITS 1–16 | RATE (the sample rate, 689 Hz – 44 kHz) | LPF |
| **PHASR** (phaser), **FLANG** (flanger), **CHOR** (chorus) | RATE | DEPTH | FDBK feedback |

  You can lock A, B, C and MIX on a step. TYPE OFF (or MIX at 0) costs nothing: the track sounds exactly as without the INSERT.

---

## 19. The visualiser

On the TRACKS screen, **tap HOME**. The whole screen becomes a visualiser of what BoopBox plays, in six scenes at
sunset and in neon.

| Control | Does |
| --- | --- |
| **SELECT** | the next / previous style (its name shows for a second. The settings keep the last style) |
| **HOME**, or any page button | closes it |
| keys, PLAY, REC, layers | work as usual (a held layer shows its screen, then the visualiser comes back) |
| KNOB 1–4 | nothing (meanwhile, the tempo is on GLO + SELECT) |

| # | Style | What it shows |
| --- | --- | --- |
| 1 | **PALMS** | the wave of the mix, sample for sample, as the front wave of the sea at sunset. The reflection of the sun shimmers with the mix |
| 2 | **NIGHT DRIVE** | a car on the road at night. The buildings of the city are the spectrum. The road moves with the beat (three lane stripes go past each beat). The lights of the car flare on every kick. When the transport stops, the car slows down and parks |
| 3 | **HORIZON** | the spectrum as a neon range (32 bands, caps that fall) over a grid that runs down one line a beat. On each beat, tiles of the floor light up in the colours of the tracks that play |
| 4 | **FLYOVER** | the spectrum over time as a terrain, bass in the middle: the newest in front, the older behind, coloured by height. While the song plays, the ground always moves (flat in silent bars). When the transport stops, it moves on until the last peak goes off the back, then holds still |
| 5 | **DENSE CITY** | the eight tracks and the mix as towers of 24 floors, lit to their level (yellow, then red at the top), with the peak floor held white, as VU meters. Searchlights sweep with the beat |
| 6 | **KEY CITY** | the skyline as two octaves of keys. A note lights the tower of its key in the colour of its track (a chord: all its keys. A note outside the two octaves: the same note in them). The drum tracks light the street lights |

DENSE CITY and KEY CITY show each of the eight tracks separately. PALMS, NIGHT DRIVE, HORIZON and FLYOVER show the mix.

The visualiser sees the mix **as if MASTER is all the way up**. When MASTER is turned down, even to 0, the visualiser still moves at full size. It costs the sound nothing.

---

## 20. The HOME menu and the lights

**Hold HOME** (0.7 s) to open the menu. Hold it again to close the menu. The menu has six sections:

| Section | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- | --- |
| **SCREEN** | **COLOR**: the screen palette (GREEN, AMBER, CYAN, RED, MONO, SYNTHWAVE — the default since 1.1.0 —, then [your theme](#your-theme) after you send one. SYNTHWAVE, 1.1.0: night indigo, a cyan accent, the tracks in cyan, magenta, sunset orange and violet (5–8 periwinkle, rose, gold, orchid), neon rules with a glow under the headers, large values that fade from pink to orange, a neon floor to the horizon where a page has an empty half, and a sun that sets on the boot screen) | **ZOOM**: ON shows the value you touch, large and white | **KNOB ACCEL** (2.7): ON (the default): a fast turn sweeps wider. OFF: one value a detent | — |
| **LIGHTS** | **LIGHTS**: OFF, LOW, MID, HIGH | **KEYS**: OFF, C KEYS, WHITE KEYS, ALL KEYS | **NOTES**: OFF / ON | — |
| **AUDIO** | **SPEAKER LOWCUT**: ON cuts the lows that the small speaker cannot play (~110 Hz) | **USB AUDIO**: MASTER / FULL | **USB RATE** (2.7): AUTO / 44.1 KHZ / 48 KHZ (takes effect at the next start) | **FILTER RESO** (2.7.2): the resonance of the per-track filter, 0 (clean, as before) … 10 |
| **KEYS** (1.8 · USB in 1.7) | **VELOCITY** (1.8): OFF (the default: every key 100) / SOFT / NORMAL / HARD, the curve of the velocity of the keys ([key velocity](#key-velocity-and-aftertouch-18)) | **AFTERTOUCH** (1.8): OFF (the default) / FILTER LOW, MID, HIGH / VIBRATO LOW, MID, HIGH | **VEL LEARN** (1.8): ON (the default): the keys learn your touch / OFF. **OCT+** forgets it | **USB HOST**: OFF (always, at every start) / ON: the USB-C port plays a USB-MIDI keyboard or controller through a powered hub, and does not talk to a computer ([USB keyboards](#usb-keyboards-usb-host)) 
| **SEQ** (2.7.1) | **STEP ADVANCE**: ON (the default): the NOTES page moves on when you let go of the keys. OFF: it stays, so you can play a chord that you missed again on the same step (KNOB 1 moves the cursor) | **DRUM PREVIEW**: OFF (the default): you do not hear a drum sound that you pick with a knob (DRUMS screen, SEQ layer), quiet for live. ON: you hear it, as up to 2.7 | **REC KNOBS**: SOUND (the default): a knob that you turn during recording changes the sound. LOCKS: it writes a lock on the step that plays ([locks](#parameter-locks)) | **MIDI SETTINGS** (OCT+ opens it): the MIDI pages, MIDI to SYSTEM ([MIDI](#all-the-midi-settings-midi-to-midi-4-and-system)) |
| **SYSTEM** | **2ND CORE** (2.7): **ON** (the default) / OFF. With ON, the FM-1 computes the sound on both of its cores. This gives about twice the room before the CPU runs out (many voices, INSERT effects on several tracks), with the same sound. ON takes effect at the next power-on. ABOUT then shows *2 CORES*. (*1 CORE*: the second core did not answer, and BoopBox runs on one core, as before.) OFF: one core, as in 2.6. (2.8.3) On some FM-1s, the second core can misread a word under heavy load (a backup over USB). Each job is examined before it runs, and a wrong job is refused. BoopBox then continues on one core until the next power-off (ABOUT: *1 CORE*), and does not crash. If a crash occurs while both cores run, the next start is on one core too, until you power off. If this continues to occur on your FM-1, set 2ND CORE to OFF | **HARDWARE CALIBRATION** (the knob selects it, OCT+ opens it) | **MIDI LEARN CLEAR** (2.6): how many CCs are learned. **OCT+** forgets them all | **ABOUT**, the version (the knob selects it, OCT+ opens it) |

**The knobs (2.7).** A slow turn gives fine tuning: one value a detent. If you turn faster, the value sweeps wider, progressively (x2 up to x16 on the widest values). When you turn back to correct, the value always moves one value a detent. Lists of names never jump. MENU → SCREEN → KNOB ACCEL OFF keeps one value a detent everywhere.

**LEVEL and PAN glide** over about 3 ms, and do not step at each detent. This applies on every track and the drums. Thus a held note has no zipper noise. Both features are after JIANT FM by juanjiant-bit.

| Control in the menu | Does |
| --- | --- |
| **SELECT** | the previous / next section |
| **KNOB 1, 2, 3** | set the rows of the section directly (each row shows the colour of its knob) |
| **PRESETS** | moves the cursor |
| **OCT+** | steps the setting at the cursor round, or opens it (CALIBRATION, ABOUT) |
| **OCT−** | closes (from ABOUT: back to the section) |
| **hold HOME** | leaves the menu |

All of these are **settings of the FM-1**. The FM-1 keeps them when you load a project or start a new one.

In **BoopBox Trainer**, when you hold HOME, the level picker of the trainer opens first. Its last page opens this menu ([the trainer](docs/trainer.md)).

### Lights

- **LIGHTS** — every button glows at that level, so you can read its label in the dark (on a black FM-1, you cannot read the labels when they are not lit). What is on (the page, PLAY, REC, an octave) stays at full light and still blinks.
- **KEYS** — the Cs, every white key, or every key glow at the LIGHTS level too. If LIGHTS is off, KEYS turns it on at LOW.
- **NOTES** — ON: the notes that sound on the selected synth track light their keys, when you play them live or the sequencer plays them. Each key stays lit for at least a tenth of a second, so short sequencer notes show too. The drum track always lights its hits. This works on every page and in every layer.
- **Always:** PLAY flashes on every beat. REC blinks when armed and is solid during recording. The button of the shown page is lit. In a layer, keys 1, 5, 9, 13 glow dimly, and what is on is fully lit. OCT− / OCT+ light when the octave is not 0. The button of a locked layer blinks.

### Key velocity and aftertouch (1.8)

From [JIANT FM](https://github.com/juanjiant-bit/JIANT), after the [Velo](https://github.com/charlesvestal/fm1-velocity) of Charles Vestal.
Under each key of the FM-1 is a carbon pill. Its resistance decreases when you press the key harder. On the 20 keys **F3..C5**,
BoopBox can read it. The top row (C#5..G5) has no sensor and plays the average of your recent playing. It is **OFF** until
you turn it on in HOME menu → **KEYS**:

- **VELOCITY** SOFT / NORMAL / HARD: the curve. A synth key plays, records and sends out its velocity. On a drum track, the
  velocity selects the hit (ghost, soft, normal, hard). Holding OCT− or OCT+ still forces ghost or hard. A synth note waits
  a maximum of 2.2 ms for the reading of its key. Drum keys never wait.
- **AFTERTOUCH** FILTER or VIBRATO, LOW / MID / HIGH: continue to press a held key to open the filter of the track or add vibrato
  (at the LFO speed of the track). BoopBox sends it out as MIDI channel pressure. Channel pressure that comes in from MIDI does the same.
- **VEL LEARN** ON: each key adjusts to how you play (each strike moves its soft / normal / hard marks a little). BoopBox
  saves the result 30 s after you stop. **OCT+** on the row puts back the factory marks.

Every FM-1 is a little different. If one key is always louder than the others, play it for a minute with VEL LEARN on.

### Hardware calibration

If a button or knob does the wrong thing, open HOME menu → SYSTEM → **HARDWARE CALIBRATION**. Or hold **OCT− + OCT+** while you switch on. Then press each button and turn each knob to the right when the screen asks. If there is no input for 30 s, the calibration stops and keeps the old setup.

---

## 21. MIDI

### Where MIDI comes in

- **The MIDI IN jack** (3.5 mm TRS on the FM-1): a keyboard or a pad controller with a MIDI output connects here, through a TRS-to-DIN MIDI adapter. If nothing plays, try the other type of adapter (type A / type B).
- **USB**: a computer or a phone (a DAW, a MIDI routing app) or a USB MIDI host box connects here. A USB keyboard that you connect directly to the FM-1 works only when **USB HOST** is on (below). If USB HOST is off, both are USB devices, and a USB link needs a host.

<a id="usb-keyboards-usb-host"></a>**USB keyboards: USB HOST (1.7, from [Melodee](https://github.com/keremimo/melodee)).** Go to HOME menu → **KEYS** (USB before 1.8) → **USB HOST** and set it to ON. Then the USB-C port hosts a class-compliant USB-MIDI keyboard or controller, alone or behind a hub. Its notes, CCs, bend and clock play BoopBox in the same way as USB MIDI from a computer. **The FM-1 does not power it: use a powered hub** (or a keyboard with its own supply). BoopBox does not support low-speed devices.

The screen shows *MIDI DEVICE READY*, *NO MIDI DEVICE* or *MIDI DEVICE LOST*. At *MIDI DEVICE LOST*, BoopBox releases every note that the device held. While USB HOST is on, there is no web editor, no USB audio and no MIDI to a computer. BoopBox also sends nothing to the keyboard. The FM-1 never saves this setting: at every start it is a normal USB device, so updates always work. When you set it to OFF, the FM-1 goes back to the computer immediately. Nobody has tried this function on an FM-1 with a keyboard yet.

The MIDI IN jack and USB work at the same time.

### All the MIDI settings: MIDI to MIDI 4, and SYSTEM

Every MIDI setting is on its own pages. To open them, do these steps:

1. To open the menu, **hold HOME**.
2. Turn **SELECT** to the **SEQ** section.
3. Turn PRESETS to put the cursor on **MIDI SETTINGS**.
4. Press **OCT+**.

Then turn SELECT to go through the five pages. Press HOME to close them. These are settings of the FM-1. They stay through power-off, and a project does not change them. The backups of the web editor include them.

| Page | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- | --- |
| **MIDI**: the channel of tracks 1–4 | **CH1** track 1 (default 1) | **CH2** track 2 (2) | **CH3** track 3 (3) | **CH4** the drum track (10) |
| **MIDI 2**: the channel of tracks 5–8 | **CH5** | **CH6** | **CH7** | **CH8** |
| **MIDI 3**: how MIDI comes in and goes out | **IN** | **OTHER** | **OUT** | **BEND** |
| **MIDI 4**: the punch-in effects, the drums, the buttons over MIDI, the clock out | **FX CH** | **DR MAP** | **REMOTE** | **CLOCK** |
| **SYSTEM** | **SYNC**: the clock that BoopBox follows | **CPU** load (when no computer is connected: the state of the USB link) | — | — |

- **CH1–CH8:** OFF or 1–16. The channel of a track plays that track (notes, CCs, sustain, pitch bend, Program Change). The keys and the sequence of the track go out on that channel. **OFF**: nothing comes in and nothing goes out for that track. Two tracks never share a channel. If you set a channel that another track has, the setting goes on to the next free channel. The screen shows which track had it (*CH 3 = TRACK 3*). When you change a channel, all sound that is still on it stops, on the FM-1 and on the other gear.
- **IN:** **NOTES** (notes, CCs and the clock: normal) · **CLOCK** (only the clock and START / CONTINUE / STOP. BoopBox ignores every note and CC, except the REMOTE CCs when REMOTE is on) · **CH 1 … CH 16** (only that one channel, always on the selected track. BoopBox does not use CH1–CH4 and OTHER, but it still follows the clock). If IN is not NOTES, the screen tells you when you open MIDI (*IN CH 5: SEL TRK ONLY*, *IN = CLOCK: NO NOTES*).
- **OTHER:** what BoopBox does with a channel that no track has. **SEL** plays the selected track (set your keyboard to channel 4: it then follows ALGORITHM) · **OFF** ignores it (for example, the channels of a sequencer for other gear on the same cable).
- **OUT:** **KEYS**: only what you play on the keys goes out · **SEQ**: the sequencer, the arp and the rolls go out too.
- **FX CH** (2.7): OFF (the default) or 1–16. On that channel, the notes **F3 … G5** (MIDI 53–79) are the 27 keys of the FM-1 with **FX** held. A held note holds its [punch-in effect](#punch-in-effects). When the note is released, the effect stops (white keys: effects 1–16, black keys: 17–27, as on the FM-1). A pad controller, a keyboard or a DAW can play and automate them. That channel only plays effects, so choose a channel that no track uses. It works with IN = NOTES or CH n, not with IN = CLOCK. A key of the FM-1 (FX + key) takes control immediately.
- <a id="dr-map"></a>**DR MAP** (2.7): how the notes that reach the drum track select the 16 drum sounds. These notes come on CH4, or on IN CH n when the drum track is selected. **GM** (the default, as before): the General MIDI notes, for DAWs and MIDI files: 36 kick, 35 kick 2, 38 snare, 39 clap, 42 hat, 46 open hat, 44 pedal hat, 37 rim, 40 snare 2, 43 low tom, 48 high tom, 49 crash, 51 ride, 70 shaker, 63 conga, 56 cowbell. Any other note plays the nearest of them. **1-16**: any 16 notes in a row play the 16 sounds in order, from note 36 (KICK, KICK 2, SNARE, CLAP, HAT, OPEN HAT, PEDAL, RIM, SNARE 2, LOW TOM, HI TOM, CRASH, RIDE, SHAKER, CONGA, COWBELL). This order repeats every 16 notes. Thus a keyboard or a row of pads plays the whole kit, wherever it starts. What the drum track sends on MIDI OUT stays GM.
- <a id="remote"></a>**REMOTE** (2.7): OFF (the default) or 1–16. On that channel, **CC 102 … 115** press the 14 buttons of the FM-1 from a controller or a DAW. A value of 64 or more holds the button down. A value of less than 64 releases it. (A button on a controller sends 127 then 0: a tap. If you hold the button, it is a hold.) Everything works as on the panel: taps, holds and their layers, combinations (a button held + a key), OCT− / OCT+. CC 102 FX · 103 SEL · 104 ENV · 105 LFO · 106 EDIT · 107 GLO · 108 HOME · 109 SAVE · 110 ARP · 111 SEQ · 112 PLAY · 113 REC · 114 OCT− · 115 OCT+. Choose a channel that no track uses. Its other messages work as usual (notes, other CCs, MIDI LEARN).
- <a id="clock-out"></a>**CLOCK** (2.7): OFF (the default) or **OUT**. With OUT, the FM-1 is the **clock master** on USB. It sends the MIDI clock (24 pulses a beat, at its tempo). It also sends the clock while it is stopped, so that the other gear knows the tempo. It sends **START** when its sequencer starts (after the count-in, if there is one) and **STOP** when it stops. Then a DAW, a drum machine or another groovebox that follows MIDI clock plays in time with BoopBox. It also starts and stops with BoopBox. This works with SYNC = INT only. An FM-1 that follows a clock (SYNC USB or TRS) never sends one (no loop through a computer). The TRS jack of the FM-1 is an input, so the clock goes out on USB. CLOCK is a setting of the FM-1, kept through power-off.
- **BEND:** the range of the pitch bend, 1–12 semitones (default 2).

**Examples.** A keyboard on channel 1 plays track 1. To play another track from channel 4, select that track (OTHER = SEL). An external sequencer sends drums on 10, bass on 2, pad on 11 and lead on 8. For this sequencer, set CH1 = 2, CH2 = 11, CH3 = 8, CH4 = 10, OTHER = OFF. A KeyStep Pro uses its other channels for other gear. For this KeyStep Pro, set IN = CH n. That channel then plays the selected track.

### MIDI out, clock in

- **MIDI out:** each track goes out on its channel (CH1–CH8). If MIDI 3 → OUT = **SEQ**, a DAW track can record the MIDI of the FM-1, and you get the pattern as notes. BoopBox can also drive another synth. Every note gets its end. STOP ends all notes that are still on. BoopBox never sends back the notes that came in (no MIDI loop).
- **Clock in** (SYSTEM → SYNC = USB or TRS): START plays from the top. CONTINUE plays on from the current position. STOP stops. The tempo follows the master pulse by pulse (24 a beat), so BoopBox cannot drift. When the clock stops for half a second, PLAY on the FM-1 plays at its own tempo again. A MIDI START during the REC count-in starts and records immediately.
- When you change IN or a channel, BoopBox releases all notes that are still held. No note stays on.
- BoopBox does not support **Bluetooth MIDI**. BoopBox never switches the radio on.

### MIDI CCs (2.5)

The knobs of a MIDI controller set the sound. They use the standard CC map of Felucca 1.1.5. A CC acts on the track that its channel plays, as the notes do. (The channel of each synth track goes to that track, the drum channel to the drum track, and the other channels to the selected track.) A CC sets its parameter as a knob does: 0–127 over the range of the parameter, with 64 the middle of PAN and FILTER. It changes the value of the sound itself, as a knob does, so a save keeps it. The screen and the web editor follow the change.

| CC | Sets |
| --- | --- |
| 5 | GLIDE |
| 7 | LEVEL (on the drum channel: GLO → DRUMS → LVL) |
| 10 | PAN |
| 11 | (2.7.1) **EXPRESSION**: a volume pedal over the LEVEL of the track (on the drum channel: over DRUMS LVL). 127 is full, 0 is silent, as on a GM synth. It does not change LEVEL (your mix and what you save stay as they are). It is full again at power-on, when you load a project or section, and with CC 121 |
| 121 | (2.7.1) RESET ALL CONTROLLERS: the expression is full again |
| 71 | the resonance of the engine (RES or Q: ANALOG, TRIO, VOICE, NOISE). The other engines ignore it |
| 72 · 73 · 75 | release · attack · decay |
| 74 | (2.7) the cutoff or brightness of the engine itself, dark to bright: ANALOG / SAMPLE CUT, TRIO CUT, PHASE DCW, LOFI / GRAIN TONE, FM6 MLVL, PHYS BRIT, NOISE FREQ. DIGITAL, VOICE, WHEEL and the drum track: the FILTER of the track (64 off, lower a low-pass, higher a high-pass), as before |
| 91 · 93 · 94 | the reverb, chorus and delay sends (on the drum channel, 91 and 94 are GLO → DRUMS → REV and DLY) |

<a id="nrpn-18"></a>**NRPN (1.8, after JIANT FM).** You can also set every parameter of the sound, mix and sequencer of a track with 14 bits. To do this, send these messages on the channel of the track: **CC 99 = 0**, **CC 98** = the number of the parameter, then **CC 6** and **CC 38**. CC 6 and CC 38 are the high and low parts of the value. CC 6 alone is a 7-bit value. The parameter stays selected for more values. The numbers are in [docs/NRPN.md](docs/NRPN.md). The CC map above and MIDI LEARN work as before.

**Sustain and pitch bend (2.6).** The **sustain pedal** (CC 64) acts on the track that its channel plays. While the pedal is down, a note that you release continues to sound until the pedal comes up. The arp keeps the note, and a recording holds it as you hear it. If you play the note again in that time, it ends with its key. **Pitch bend** bends the track that its channel plays, smoothly, by up to **BEND** semitones (MIDI 3: 1–12, default 2). The drum track ignores it. BoopBox ignores other CCs (mod wheel…), unless you map them with MIDI LEARN.

**Program Change (2.6, after Felucca 1.5.1 and @renebohne's PR #179).** A Program Change on the channel of a track loads a sound. On a synth track, number *n* is the *n*-th sound of the PRESETS list. Number 0 is the first sound: 808 BOOM. The list holds the 223 factory sounds in the KIND order, then your user presets in order. The OBERVAVE programs are at the end of the sounds of their kind.

On the drum channel, number *n* loads kit *n*. BoopBox ignores a number past the end. The screen shows *T2 PROG 5*. IN = CLOCK ignores the Program Change. IN = CH n sends it to the selected track.

**(2.7.2) Bank Select (CC 0)** gives access to the sounds after the first 128. If you send **CC 0** on the channel of the track, BoopBox latches it for the next Program Change. Bank 0 is the first 128 sounds of the PRESETS list, bank 1 is the next 128, and so on (the remaining factory sounds, then your user presets by slot). Send CC 0, then the Program Change.

### MIDI LEARN (2.6)

You can assign any knob of your controller to any parameter of a track (after Felucca 1.5):

1. Press **GLO + F#3** (the first black key). The screen shows *LEARN: TURN A KNOB*, and the top line shows **LEARN**.
2. Turn the knob of BoopBox that you want (any page of the track, or LEVEL / PAN on TRACKS). The screen shows *T1 CUT: SEND A CC*.
3. Move the knob on your controller. The screen shows *CC 21 = T1 CUT*. Continue with other knobs, as many as you want.
4. Press **GLO + F#3** again. The screen shows *LEARN DONE*.

A learned CC sets that parameter of that track, on any channel. It no longer does what the standard map gave it. If you learn a CC for a new parameter, BoopBox removes it from its old parameter. You can learn up to 16 CCs. BoopBox never learns the CCs that have their own meaning: bank select (0, 32), mod wheel (1), data entry (6, 38), expression (11), sustain (64), 96–101 and the channel modes (120–127).

What you learn is a setting of the FM-1. It stays through power-off and projects. The backups of the web editor keep it, and restore it on this FM-1 or another. To forget it all, go to **HOME menu → SYSTEM → MIDI LEARN CLEAR** and press OCT+.

---

## 22. USB audio

On USB, the FM-1 is also an audio input with the name **BoopBox**. The format is 44.1 or 48 kHz, 16-bit stereo, class compliant, with no driver. The computer, phone or tablet picks the rate (48 kHz since 2.5, for the phones and apps that only accept it). In your DAW, in Audacity or in a sampler app on your phone (with a USB-C cable or adapter), choose that input and record. You get the master output, exactly what the headphones play (after DUST, DUCK and FILT, and the click and count-in too if they are on). MIDI, the editor and the installer continue to work on the same cable.

**HOME menu → AUDIO → USB AUDIO:**

- **MASTER** (default): the recording follows the MASTER knob, as the headphones do. Keep MASTER high while you record.
- **FULL**: a fixed level, as with MASTER fully up (the limiter prevents clipping). MASTER then sets only the headphones. This is the best setting for a computer input that has no level control of its own.

The first time, the computer sees the FM-1 as a slightly different device (MIDI + audio) and configures it again. On macOS 13–15, keep **USB SERIAL** OFF (the default), or the audio input can be missing (2.6). From 2.7, the build of the FM-1 has no serial console and no USB SERIAL: the flash is full, and it was a developer's tool.

(2.7.2) On macOS 15 and older, BoopBox up to 2.7.1 showed MIDI but no audio input. On these versions, the audio driver of Apple stopped reading the USB description of BoopBox before the audio part. Now the audio is first in this description (after Felucca 1.5.1). The FM-1 also reports a new USB version, so the Mac configures it fresh.

<a id="usb-rate"></a>**HOME menu → AUDIO → USB RATE** (2.7), KNOB 3: the rates that the FM-1 offers. The setting takes effect at the next start. Turn the FM-1 off and on (until then, the menu shows *RESTART*).

- **AUTO** (default): 44.1 and 48 kHz. The computer or phone picks, as in 2.5 and 2.6.
- **44.1 KHZ**: 44.1 kHz only. The samples are exactly as the FM-1 makes them (as in 2.4). If a phone or tablet records the FM-1 with distortion or noise, but a computer records it clean, try this setting first. The phone then converts the rate itself.
- **48 KHZ**: 48 kHz only, for a device or app that needs it.

The computer or phone sees each setting as a slightly different device and can configure it again.

---

## 23. Your own samples and drum kits

The FM-1 has **four sample slots**, **USR1–USR4**, of about **7.4 s** each (22 kHz mono). A slot holds one of these:

- **an instrument**, which a synth track plays: engine **SAMPLE**, **SET = USR1 … USR4** (or the SRC of the GRAIN engine), or
- **a drum kit**, which the drum track plays: **KIT = USR1 … USR4**, or **USR3+4**, one big kit of about **15 s** over two slots.

A good setup: USR1 and USR2 as instruments, and a big kit on USR3+4. You fill the slots from the web editor.

### An instrument (editor → Sample slots → Samples)

1. **Choose a slot.** Four tiles show what each slot holds and how full it is. The page warns you when a send will replace something (or half of your USR3+4 kit).
2. **Make the sound**, in one of two ways:
   - **From files (one note per file):** drop up to 16 WAV files (any rate, mono or stereo). Each file plays at its own note. The keys between them play the nearest file, at the correct pitch. The editor reads the note from the file name (`KEYS_C4.wav`, C4 = 60), or you set it in the list. A keyboard picture shows which keys play which file. ▶ plays a file. The meter shows the time used. Each file has a **Gain** (0 to −24 dB, 2.6). **Match levels** sets the gains so that you hear every file at the same level. (It turns down the loud files: every file comes in at full scale.) Then adjust by ear.

     **Loop** (2.7), for each file: **ONE SHOT** plays once to the end, as before. **LOOP** plays the whole file again and again while the key is held. When you release the key, the file plays to the end of its round. **LOOP+TAIL** plays the start, then plays the part between **Loop start** and **Loop end** again and again while the key is held. When you release the key, the remaining part of the file (the tail) plays to the end. Thus a short sample becomes a sound that you can hold: a pad, a string, a voice, an organ.

     Set the points on the wave of the file (the loop is lit). When you release a slider, the point moves to the nearest zero crossing, so the loop does not click. To hear the loop as the FM-1 plays it, hold ▶. To hear the tail, release ▶. A WAV that has its own loop (set in a sample editor: its *smpl* chunk) comes in as LOOP+TAIL with its points. A loop uses no extra memory.

     The **LOOP** of the SAMPLE engine (EDIT 1, KNOB 4) still turns loops off for the whole set. The release (ENV) still ends the note, so set REL long enough to hear the tail. On SLOOP 2.6, such a file loops until the release ends it.
   - **Chop a recording** (CHOP): open or drop a recording (WAV, MP3, AIFF…). Cut it into up to 16 chops, one for each key.
3. **Send it and play it:** give it a name and press **Send to USRn**. Then press **Play this slot on track 1, 2 or 3**: that track changes to SAMPLE with SET = USRn.

**CHOP** in detail:

| Control | Does |
| --- | --- |
| **TAP** (or the space bar) while it plays | makes a cut at that moment (*snap to the hit* puts it on the attack) |
| **Find hits** (with a sensitivity), **Grid**, **Equal parts** | make the cuts for you |
| the box on a chop, **Keep all**, **Keep none**, **K** | keep or leave out chops (left-out chops go neither to the slot nor to the WAVs) |
| the length slider, or the handle at the bottom of the wave | shortens a chop. **Up to the next marker** undoes it |
| **Fit to slot** | shortens the longest chops only as much as necessary to fit |
| **Download WAVs** | the kept chops as WAV files |
| keys 1–9, 0 | listen to a chop |
| double-click / drag / ← → / Del | add / move / nudge / remove a marker |
| mouse wheel | zoom |

A recording of any length works. Keep the chops that you want: the slot takes about 7.4 s of them.

### A drum kit (editor → Sample slots → Drum kit)

1. **Your sounds.** Drop a WAV on any of the **16 pads** (KICK, KICK 2, SNARE, CLAP, HAT, OPEN HAT, PEDAL, RIM, SNARE 2, LOW TOM, HI TOM, CRASH, RIDE, SHAKER, CONGA, COWBELL). Or use **Choose files** to add several files at the same time. The editor sorts them onto the pads by name (*kick*, *bd*, *snare*, *hh*, *open*, *crash*…). A second kick goes to KICK 2. Click the wave of a pad to hear it. Each pad has **Pitch** (±12 semitones), **Gain** and **Length** (a cut ends with a short fade). **Match levels** (2.6, under the pads) sets the Gain of every pad so that the kit sounds even. It measures as the ear hears: the lows count less, and it turns the loud pads down to the quietest pad. Then adjust by ear.
2. **Where it goes.** **USR3+4** (the big kit, about 15 s): the editor divides the sounds between the two slots automatically. Or a single slot **USR1–USR4** (about 7.4 s). Each choice shows what it holds now and what a send will replace. The meter shows the time used. If the kit is too long, shorten the long sounds or press **Fit the slot**.
3. **Send it.** Give it a name and press **Send**. Then **Use … on the drum track** selects track 4 and sets its KIT. (Or turn PRESETS on the drum track: USR3+4 is the last kit.)

**Save as ZIP** keeps the 16 WAVs of the kit, to share. **Open ZIP** (or a .zip that you drop) loads one back.

On the FM-1, your kit works like any other kit: steps, levels, ratchets, fill conditions, the DRUMS grid, the keys, MIDI channel 10 (a note plays the sound of its lane), the filter, the slicer, mute. The closed hat cuts the open hat. A lane without a sound is silent, and an empty slot is silent too.

### Your own synthesised kits (SYN1–SYN4)

SLOOP 2.5: on the **Drum synth** tab of the editor's **Sample slots** page, you can change every value of a synthesised kit, sound by sound. The FM-1 plays the change immediately. Until you store them, SYN1–SYN4 are copies of 808, 909, TRAP and TECHNO.

1. **Pick a kit**, SYN1 to SYN4, and give it a name (8 letters: the DRUMS screen shows it). **Start from** + **Copy** makes it a copy of any of the 32 kits.
2. **Pick a sound** (KICK, SNARE, CLAP, HAT, OPEN HAT, LOW TOM, HI TOM, CRASH, RIDE, SHAKER, CONGA, RIM, COWBELL, CLAVE, KICK 2, SNARE 2): it plays. (**Play** also plays it. **Play on change** plays it after every change.)
3. **Change it.** Each value is a tile that you drag up or down, or a bar. A **double-click** puts back the value of the kit that it started from.

| Group | Values |
| --- | --- |
| **Tone** | **WAVE** (OFF, SINE, TRI, SQUARE, FM, BELL) · **PITCH** (a note, its Hz) and **FINE** · **BEND** (the semitones that the pitch falls from at the hit) and **B.TIME** (how fast) · **HOLD** (at full level) and **DECAY** · **LEVEL** · **2ND** (a second partial: its ratio, the second mode of the drum head) and **2ND LVL** · **CLICK** (the attack: the beater, the stick) |
| **Noise** | **NOISE** (OFF, WHITE, METAL: the six squares of the 808, CYM: metal and white, CHIP: an 8-bit noise) · **CLAP** (three bursts, then the tail) · **LEVEL**, **HOLD**, **DECAY** · **HPF** (a high-pass on the noise) · **CHIP** (the clock of the chip noise) |
| **Filter** | **FILTER** (OFF, LP, BP, HP) · **ON** (the noise, or ALL: the tone too) · **CUTOFF**, **RES** · **ENV** (the octaves that the cutoff starts above its value, falling with the pitch) |
| **Out** | **DRIVE** · **LEVEL** (dB) |

**Bit crush** (CRUSH, bits off) and **Sample rate reduction** (S&H, a lower sample rate) act on the whole kit. They are in the **Kit** card, next to **Out**.

4. **Store on the FM-1** keeps the four kits in flash. Stop the song first. Until you store, the page shows *not stored yet*. If you switch off before you store, the FM-1 can come back with the last stored kits. **Use on the drum track** sets KIT to the kit. **Save file / Open file**: a kit as a file, to share or to keep. A [backup](#backup-and-restore) holds the four kits too.

---

## 24. The web editor

Open the editor in **Chrome or Edge** with the FM-1 on USB. Open it from the [home page](https://boopbox.replit.app/), the [installer page](https://boopbox.replit.app/webapp/installer/), the [editor link](https://boopbox.replit.app/webapp/editor/), or **`scripts/OPEN-EDITOR.bat`**. Then press **Connect** (allow MIDI). The editor follows the device live: when you turn a knob on the FM-1, the editor moves. It looks like the FM-1: the colours of the tracks and the pixel font of the FM-1. The editor is for a computer: it needs a window at least 1000 px wide. In a narrower window, it shows a note.

**Offline (2.6).** *Download for offline use* (at the bottom of the side bar, or on the installer page) saves the whole editor as one file for a computer: `boopbox-editor-<version>.html` (for example, `boopbox-editor-1.9.4.html`). This file is also attached to each [release](https://github.com/josh-mcfarlin/boopbox/releases). Double-click it. It opens in Chrome or Edge without internet (Chrome asks one time to allow MIDI), and it works as the online editor does. Its sound library (kept in the browser) is separate from the library of the online editor. To move sounds between them, use Export / Import, or a backup.

**As an app, also on Android (2.6).** Open the [online editor](https://boopbox.replit.app/webapp/editor/) or the installer one time with internet. Then use *Install the app* (at the bottom of the side bar, or on the installer page, or Chrome's menu → *Install app* / *Add to Home screen*). After that, the BoopBox app opens the editor without internet. Its link to the installer also works offline (with the firmware that it installs).

The app stays the online site, kept by the browser. Thus it uses the same sound library as the online editor. It also gets each new BoopBox version automatically the next time it opens online. On Android, use the app, not the downloaded file: Chrome on Android does not allow MIDI in a downloaded file.

**Layout:** the side bar has the pages in five groups, by task: **Play** (LIVE), **Make a loop** (Sound, Sequencer, Patterns), **Song** (Song, Save & load), **Your sounds** (Library, Sample slots), **FM-1** (Settings, Theme). Each page has one line in the side bar. At the top are the page title, the messages, the FM-1 (its firmware, live or polling) and **Connect**. Under the title, one sentence tells what the page is for. Pages that send their changes only when you ask (Patterns, Song, Theme) have **Send to FM-1** at the top right, with **Unsent changes** while there is something to send. The Sound and Sequencer pages also show the **eight tracks** at the top (number, sound, engine): click one to select it. On every page except LIVE, a **transport bar** at the bottom of the window has **play** and **stop**, the tempo, and **Open LIVE**. When the side bar has the focus, the arrow keys move between pages. Old links (`#tracks`, `#projects`, `#samples`, `#kits`, `#drumsynth`) still open the right page.

**Names:** every value shows its whole name (for example *Detune*, *Key tracking*), with the short name of the FM-1's screen beside it in small letters (*DTN*, *KTR*). Put the mouse on the name: a sentence tells what the value does. A **?** next to a card shows a longer explanation.

**Values:** each value is a tile that you **drag up or down like a knob** (Shift: fine), or a bar. For a bar, click it, then use the wheel or the arrow keys (Shift: steps of 10). A **double-click** resets the value.

| Page | What you do there |
| --- | --- |
| **LIVE** (2.7) | the whole FM-1 under your hands for a show, from a computer, a tablet or a phone: see [LIVE](#live) |
| **Sound** | every parameter of the selected track. On the left, the **presets**: an **Engine** filter, a search field and the list (click a preset to load it), then **Copy to library**, **Save to file / Load file** (a sound as a file) and **Init sound**. On the right, the parameters in tabs, in the order of the signal: **Engine** (the values of the engine, for example *Engine: ANALOG*), **Envelope**, **LFO**, **Effects**, **Voice**, **Arp & key**. On an FM6 track, the **Engine** tab also has the **FM6** panel: the six operators, **Read from track**, **Send to track** (*Send while editing* to hear every change), **Store in bank** (B1–B27), **Import SysEx** (or drop a .syx), **Store cartridge in bank** (2.5), **Export SysEx**, **Export bank as SysEx**. **The drum track** (2.7): **DRUMS**: the kit (‹ ›), level, pan, filter, reverb, delay, the INSERT, and the 16 pads. Tap a pad to hear it. Its **tune** and **decay** are as on the SOUND page of the DRUMS screen |
| **Sequencer** | the steps of the selected track: see [Notes by hand](#notes-by-hand-sequencer). At the top, in one row: **Length**, **Step length** (DIV), **Swing**, **Note length** (GATE), the view (**Steps**, **Piano roll**, **List**), **Import MIDI / Export MIDI**, **Reload**, **Clear sequence** |
| **Patterns** (BoopBox) | the patterns of the working project, in three tabs. **Patterns & chains**: pick a track, then one of its eight patterns (*playing*, the steps it holds, or empty · its length). **Play P*n***, **Copy to**, **Clear**, **Direction** (FWD, REV, PEND, RAND) and **seed**, and **follows the chords** (Off, Transpose, Transpose + scale). The **chain**: up to 16 slots. Drag a pattern tile into the chain, or press **+P1…+P8**. Drag a slot to move it. Each slot plays its pattern ×1–×16 (− / +, or the wheel), and **×** takes it out. **Scenes**: a grid with a row for each scene: its name and the pattern of each track (or *keep*). A cell that is not the default is marked. **Reset the scenes** asks first. **Chords**: up to 8 chords (I–VII, 1–16 bars), **↑ ↓ ×**, **Add**. **Read from FM-1** and **Send to FM-1** are at the top right (the FM-1 loads it immediately · stop the song first). Nothing changes on the FM-1 until you send. Small bars show the space that is used (patterns of 3,072 B, the project of 3,840 B). The **step components** of a step are in the Sequencer's step panel |
| **Song** | the song order of the [SONG screen](#14-song-mode-sections-chains-songs), as a timeline: a block for each entry, as long as it plays, in the colour of its section. Click a block to change it below: the section (**A B C D**), the **bars** (1–64) and how many **times** in a row. Drag a block (or **earlier / later**) to move it. **Add an entry**, **remove** (16 entries in all). **When the song ends**: **Stop**, or **Loop** from an entry. **Read from FM-1** and **Send to FM-1** are at the top right (stop the song first). A section with an empty slot has a mark: save it on the FM-1 first (SAVE + key 5–8) |
| **Library** | your sound library, kept in the browser: **Save current sound**, **Import**, **Export library**, search by name or tag, filter by engine, sort. Each sound has a **⋯** menu (or a right-click): **Audition**, **To device slot**, **Rename**, **Tags**, **Duplicate**, **Export**, **Delete**. You can copy factory presets in. Next to it are the **32 user presets on the FM-1** as tiles. Each has a **⋯** menu: **Load**, **Store current sound**, **To library**, **Erase**. **Reload**, **Export bank**. Drag a sound onto a tile to send it there, or a tile onto the library to keep a copy. The arrows between the two (**→ Send to slot**, **← Keep in library**) do the same with the selected sound or tile |
| **Sample slots** | the four slots USR1–USR4, in three tabs. **Samples**: your instruments, in three steps (see [above](#an-instrument-editor--sample-slots--samples)), with CHOP. **Drum kit**: your own drum kits, in three steps (see [above](#a-drum-kit-editor--sample-slots--drum-kit)). **Drum synth**: your own synthesised kits SYN1–SYN4 (see [above](#your-own-synthesised-kits-syn1syn4)). A step that you cannot do yet is grey, and it tells what to do first |
| **Save & load** | **Sections of this song**: A–D, each **used** or **empty**. **Load into the loop** puts a section into the working loop (it asks first). **Save the loop here** saves the working loop into a section (it asks first if the section is used). **Files**: **Song file** (2.7: **Export this song** saves the loop, A–D and their order as one *.sloopsong* file · **Load a song file** · the playlist of the LIVE page plays them) and **Full backup** (everything on the FM-1: **Save a backup**, **Restore from a file**) |
| **Settings** | three tabs. **MIDI**: the channel of each track, then **Notes on other channels**, **Pitch bend range**, **Effects MIDI channel**, **Drum note map**, **Respond to remote control**, **Send MIDI clock**, each with a sentence. **Master**: **Tempo & tuning** (BPM, swing, metronome, tune), **Master effects** (dust, ducking, filter, roll rate, effects fade), **Drums** (level, reverb, delay), **Texture** (the background bed). **About**: the firmware, the engines, the tracks, the slots |
| **Theme** (2.7) | your own screen colours: see [Your theme](#your-theme) |

The Mixer page of older versions is now the mixer of the **LIVE** page.

<a id="live"></a>**LIVE (2.7).** The **LIVE** page of the editor plays the FM-1 in front of an audience. Everything that a show needs is on one screen, without scrolling. You can use the mouse, a finger on a tablet or a phone, or the keys of the computer. Its buttons go through the code of the FM-1 itself (the same as GLO + key, SAVE + key, FX + key, REC, PLAY). Thus the FM-1 and the page always agree, and you can play on both at the same time.

- **Transport**: **PLAY / STOP**, **REC** (the selected track, as the REC button), **undo / redo**, **BPM** (drag the knob, or **TAP**), **SWING**, the position in the loop (bar.beat) and, in song mode, the part and bar of the song.
- **Song**: **LOOP / SONG**, **SONG REC**, **FILL** while held and **FILL BAR** (the next bar is a fill), as GLO + key 9 and 10.
- **Sections A–D**: tap a section to play it from the next bar (when stopped: immediately). The section that plays is lit, the next one blinks, and an empty one is dim. **Save the loop into A B C D** stores the loop (if the section is used, the page asks first).
- **Mixer**, eight strips in one row, one for each track: the track number (a red dot: armed for REC), the **sound** (any preset, or for the drums, the kit) with **‹ ›** for the next one, the **level** fader with its meter, **mute**, **solo**, and **play**. **⋯** opens the strip's **pan**, **filter** (left: low-pass, right: high-pass), **reverb**, **delay**, **chorus** and **drive** (for the drums: pan, filter, reverb, delay). With **play**, the keys play that track. The FM-1 also selects that track, so REC records it. **Edit this track's sound →** opens the Sound page for it.
- **Master FX**: the master **filter**, **dust** and **duck** (FX + KNOB 1 to 3 on the FM-1).
- **Punch-in effects**: the 27 effects in four groups (loops & time, filter & EQ, colour, movement). While you hold a pad, its effect plays, as FX + key. **Latch**: a tap turns an effect on. Another tap (or another effect) turns it off.
- **Keys**: a bar at the bottom of the window (**keys ▲** opens it over the page): two octaves for the synth tracks (octave, velocity, the **arp** mode of the track and **hold**), and the 16 drum pads for the drum track (GHOST, SOFT, NORM, HARD). They are real MIDI notes on the channel of the track (MIDI), so they sound immediately.
- **Playlist**: your songs, one after the other. First, export each song (**Save & load → Export this song**: the loop, the sections A–D and their order in one *.sloopsong* file). Then **add songs** here. Tap a song (or **next song**, key **N**). The FM-1 stops, and the song loads in a few seconds (its A–D, loop and order replace those on the FM-1). With **play when loaded**, the song then starts. The list stays in the browser. **save the list** keeps it as one file to take to a gig (**add songs** opens it again).
- **Full screen**: the page alone, with the side bar hidden. **All off** releases every note and effect.
- **Help on the page**: every card tells in one line what it is for. Its **?** explains how to use it. When the mouse is over a control, a tip tells what the control does. **First live in 5 steps** shows one time, over the page, until you press *got it*. **? help** at the top brings it back, and shows the keyboard shortcuts (or press the **?** key). **view: essentials** (the default) keeps the transport, sections, scenes, mixer, keys and effects. **view: everything** adds the chain, the scene morph, the playlist and the stage tools.
- **Sections or scenes?** The sections A–D change **what plays** (the notes: intro, verse, chorus…). The scenes change **how it sounds** (the knobs: filters, levels, effects), never the notes. Example: scene 1 "intro" has the filters closed and the drums low. Scene 2 "drop" has everything open. Play your loop, tap 1, then tap 2 at the drop. Or let scene 2 come in over 8 bars for a build-up.
- **Scenes** (8): a scene keeps how everything sounds now. It keeps the level, mute, pan, filter, sends and drive of each track. It keeps the knobs of the sound of each track (the 8 values of the engine, FLT PIT SHP, the envelope, glide, the LFO), its INSERT and its arp. It also keeps the master bus (filter, dust, duck, the delay, the reverb, the chorus, TEXTURE, swing). **+ sounds** keeps the presets and the kit too, and **+ tempo** keeps the BPM. To keep a scene, press **Store**, then a scene pad (double-click: its name). A tap recalls the scene **at once**, or **morphs** to it over 1 to 16 bars. The **crossfader** mixes two scenes (A and B) as you move it. The browser keeps the scenes, and the setlist file keeps them too.
- **Sounds**: **☆** on a strip makes its sound a favourite (at the top of every list, in this browser). Your **USER** presets are in the lists too.
- **MIDI learn**: press **MIDI learn**. Tap a control of the page (a fader, a knob, a scene, an effect pad, PLAY…). Then move a knob or press a pad on your controller (any USB MIDI controller connected to the computer). Learned controls work as soon as the page shows. In learn mode, a right-click forgets one control, and **forget all** forgets all of them.
- **The FM-1's live tools** (2.7): **chain** (under the sections: tap 2+ letters, then **play chain**. Each section plays for its bars, looped, as SAVE + several keys). **roll / erase** for the keys and pads (roll repeats while held, at the **roll rate**, as ARP + key. Erase removes that note or sound while held, as EDIT + key). **rev throw / echo throw** while held, and the **volume** (MASTER FX). When you turn the MASTER knob of the FM-1, or **knob**, the FM-1 gets the volume back.
- **Stage tools**: the **clock** and the **set's time** (from the first PLAY · tap it to start again). **lock**: the page ignores taps, so nothing changes by accident. The keys of the computer and the controller still work. To unlock, hold it. **record set**: records the USB audio of the FM-1 as a WAV file until you stop (the browser asks for the microphone one time). In the playlist, **✎** gives a song its **tempo** (set when it loads) and a **cue** (shown while it plays, with the next cue under it).

**The computer's keys** (not in a text field): **Space** play / stop · **1–4** sections A–D · **5–8** mute tracks 1–4 (**Shift**: solo) ·
**9** fill while held · **0** fill bar · **B** tap · **C** REC · **N** next song · **Z / X** octave · **← →** the track the keys play · **A W S E D F T G Y H U J
K O L P** play (the drums: the 16 pads) · **Shift** + those keys: the first 16 effects while held · **F1–F8** scenes (**Shift**: store) · **Esc** all off.

The mixer and the keys also work with an FM-1 on SLOOP 2.6. The transport, sections, fills and effects need 2.7. If the keys stay silent, the page tells why: MIDI 3 > IN = CLOCK (no notes), or a track with no channel while OTHER is OFF.

<a id="your-theme"></a>**Your theme (2.7).** On the **Theme** page of the editor, you can make the screen of the FM-1 your own, with or without the FM-1 connected:

- **Screen**: five colours, faintest first (darkest on a dark background, lightest on a light one): **Lines**, **Dim** (empty steps, units), **Labels**, **Secondary** text, **Values**. **Start from** takes a built-in palette (in the opposite order on a light background). **Five steps from one colour** makes the five colours from the colour that you pick.
- **Background**: black by default, or any colour, white too (**Back to black** goes back to black). **Light ↔ dark** inverts the theme: a white background, the five steps in the opposite order, a black accent (and back). The greys of the pages (tiles, empty steps, labels) follow the background.
- **Accent**: what you touch, the cursor of the menu, the play head. It is white by default, and dark on a light background.
- **Track colours**: T1, T2, T3 and the drums (the values of the knobs, the step tiles, the meters).
- **Name**: up to 8 characters. The FM-1 shows it in MENU → COLOR.
- The preview draws a BoopBox page with your colours, exactly as the screen will show them.
- **Send to the FM-1** (stop the song first): the FM-1 keeps the theme and shows it immediately. The theme then comes after MONO in **MENU → SCREEN → COLOR**. Turn KNOB 1 to go back to a built-in palette, and again to go to your theme. **Read from the FM-1** brings the theme back into the page. **Remove from the FM-1** deletes it (it asks first). After any change, send again. Next to the buttons, the page tells whether what you see is what the FM-1 has.
  **Values** and the **Accent** must stand out from the background, so that the menu stays readable. The page marks the colour that is too close, and Send tells why. **Make it readable** moves only those two colours until they stand out. The FM-1 refuses a colour that is too close. A theme made with a 2.7 beta still loads, with a white accent.
- **Share**: **share** opens a box with one line (*SLOOP-THEME-1:…*): the whole theme. Copy it into a comment or a message. Anyone can paste it into **Paste a theme** in the same box and press **Use**. When the mouse is on a colour, the preview shows only what is drawn in that colour.

A backup made with the editor keeps your theme. If you go back to SLOOP 2.6, the FM-1 shows the built-in palette that you used last. It forgets the theme when it next saves its settings.

### Notes by hand (Sequencer)

**Steps** (the first view): the steps of the pattern as tiles. A tile shows its notes (a chord: one note on each line) and a bar for its velocity.

- To add a note, click an empty step. It plays the last note that you used (at first C4), at velocity 100, and the step is selected.
- To select a step, click it. The arrow keys move the selection.
- To make a step a rest, double-click it, or press **Delete** when it is selected.

The **step panel** on the right shows the selected step:

- **Type**: **note**, **hold previous** (a tie: the note before goes on) or **rest**.
- **Notes**: the notes of the step (4 at most: a chord). Click a key of the small piano to add or remove a note (**‹ ›**: another octave). Or type the notes (*C4 E4 G4*; C4 is middle C, # is sharp, b is flat) and press Enter. If the editor cannot read what you typed, it tells you why under the field.
- **Velocity**, **accent** and **slide**.
- **Nudge**: the step a little earlier or later (in 1/64 of a step). **Plays**: always, only in fills, or not in fills. **Parameter locks**: a value that is different on this step only (+ lock, pick the parameter, set or delete).
- **Step components** (BoopBox): what the step does each time the sequencer gets to it. They are part of the project: **Send components** sends them to the FM-1.

Under the tiles, a line explains their marks (accent, slide, lock or nudge, only in fills, not in fills).

On the drum track, the view is a **grid** of the 16 sounds × the steps, with the **kit**. Click an empty cell: a hit (**Shift+click**: one level louder). Click a hit to select it, double-click or **Delete** to clear it. The step panel shows the 16 sounds of the step, its **level** and its **roll**.

**List**: the steps as a table (notes, type, accent, slide, velocity), to type a whole pattern.

**Piano roll** (a synth track): the steps go from left to right, and the notes from bottom to top, from C0 to C8 (scroll for other octaves). The keyboard on the left names each row. Choose a **note length** (1/1 to 1/16 of a bar, in steps of the DIV of the track). Then:

- To add a note of that length, click an empty spot. On the first step of a chord, a click adds one more note to the chord (4 at most, one length for all, as on the device).
- To delete a note, click it (the last note of a chord leaves rests).
- To make a note shorter or longer (ties), drag its right end, up to the next chord.

Every change goes to the FM-1 immediately, and the other views show the same steps.

**Export MIDI** saves the pattern of the selected track as a MIDI file (`boopbox-track1.mid`…). The file has the notes with their lengths, levels and accents, at the tempo of the song. The drum track becomes GM drum notes on channel 10.

**Import MIDI** reads a MIDI file into the selected track, at its DIV. First, a preview shows the track of the file to take, the number of notes and steps, and what changes on the way. These changes are: notes off the grid move to the nearest step, more than 4 notes on a step (the loudest stay), a note that the next note cuts short, notes past step 64. **Import** replaces the pattern of the track (and, if ticked, sets its length). **Cancel** keeps the pattern as it was. On the drum track, the GM notes go to the lanes (36 kick, 38 snare, 42 hat…), and the velocity goes to the levels, from ghost to hard.

The editor writes presets, the FM6 bank and backups to flash only while the song is stopped, as the FM-1 does (it asks you to stop first). To try the editor without hardware, add `?mock=1` to its address. [web/EDITOR_PROTOCOL.md](web/EDITOR_PROTOCOL.md) documents the protocol.

---

## 25. Backup, rescue, going back, troubleshooting

### Backup and restore

Editor → **Save & load** → **Backup**:

- **Save a backup** writes everything on the FM-1 to one file (`BoopBox-backup-DATE.json`). The file holds the music that you work on, the sections A–D, the 32 user presets, the FM6 bank and the SYN drum kits. It also holds the samples **USR1–USR4** (with your drum kits) and the settings (colours, calibration, song order, lights, SYNC, MIDI OUT).
- **Restore from a file** puts it all back and replaces what is on the FM-1. Before you restore, stop the song (PLAY). The editor refuses a damaged file before it writes anything. It writes each object as a save writes it, so a restore that stops halfway never leaves half an object.

A backup from SLOOP does not restore into BoopBox (the editor refuses it before it writes anything). SLOOP does not open the projects of BoopBox. **Save a backup before every update and before going back.**

### Rescue and special modes

| Situation | Do |
| --- | --- |
| BoopBox does not start | Hold **OCT−** alone while you switch on (*BoopBox USB RESCUE*). Then install again from the browser |
| An install stopped half-way | The FM-1 waits in update mode. Press **INSTALL** again |
| Buttons or knobs do the wrong thing | Hold **OCT− + OCT+** while you switch on. Or go to HOME menu → SYSTEM → HARDWARE CALIBRATION |
| A developer needs UBOOT | While stopped, hold **OCT− + OCT+** for 5 s (*UPDATE MODE IN 3…*). To cancel, release the buttons |

### Going back to the official firmware

**(2.8)** BoopBox no longer has the return-to-stock function in the browser, because it was not reliable on every system. To go back to the official firmware, use **M-VAVE's own updater, M-UPGRADE** (m-vave.com → Downloads → PC Software → M-UPGRADE). Use it with the official **FM-1** firmware (PC Firmware → FM-1, **V16**, `FM-1.fwsc`). Before you start, close every other app that uses MIDI. Before you go, save a backup with the editor. To come back, install BoopBox again and restore your backup.

If the official firmware starts with strange settings or a scrambled display, it reads the settings that BoopBox left in the memory of the FM-1. Nothing is damaged. To clear these settings, do a factory reset in the firmware of M-VAVE, or a full restore in M-UPGRADE. If you install BoopBox again, your work comes back exactly as it was.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| The installer or editor does not find the FM-1 | Use Chrome or Edge, a data cable and no hub. Allow MIDI. Close every other app or tab that uses MIDI, then reload |
| The black keys are silent on a synth track | The track plays chords or the scale. Set SEL → CHORD OFF and KEYS OFF. (With a chord on, the black keys change the chord: CHORD+) |
| Recorded notes move | BoopBox quantises to the DIV of the track. To keep your timing, set [QUANT off](#quant-off) on the REC screen (2.7). Or use 1/32, or nudge the step (SEQ + step + KNOB 4) |
| Notes fade out on a dense part | The processor is at its limit. BoopBox fades one voice at a time (never the bass or lead), and does not glitch. Play fewer held notes, or use a lighter engine |
| Nothing from the MIDI IN jack | Try the other adapter type (A / B). Make sure that the channel is correct (MIDI: CH1–CH4 · MIDI 2: CH5–CH8 · MIDI 3: OTHER). Make sure that MIDI 3 → IN is NOTES |
| The USB audio input does not show | Disconnect the FM-1 and connect it again. On a Mac (2.6), keep USB SERIAL OFF and restart the FM-1. In Audacity, use Transport → Rescan Audio Devices |
| The USB recording is quiet | Set HOME menu → USB AUDIO = FULL, or turn MASTER up |
| The USB recording is distorted or noisy on a phone (clean on a computer) | Set HOME menu → AUDIO → [USB RATE](#usb-rate) = 44.1 KHZ. Then turn the FM-1 off and on |
| An FM6 sound changed after loading a project | Store the edited patch in the bank (editor → FM6 → Store in bank). Then set PTCH to it |
| *STOP THE SONG FIRST* / *STOP FIRST* | That change (new project, song edit, flash write) waits until the transport is stopped |
| *EMPTY SECTION: REC* | The section that you asked for is empty. Save a loop into it first (SAVE + key 5–8) |
| Something else | [Open an issue](../../issues). Tell what you did, what you expected, what happened, and the version (HOME menu → SYSTEM → ABOUT) |

---

## 26. Cheat sheet

### Buttons alone

| Do | Result |
| --- | --- |
| PLAY | start / stop |
| REC | record / arm / close a free take |
| hold REC ~2 s | clear the selected track |
| tap HOME | TRACKS · on TRACKS: visualiser |
| hold HOME | menu |
| tap SAVE | on TRACKS: SONG screen · on other screens: SAVE pages |
| tap ENV, LFO, FX, SEL, EDIT, ARP, SEQ, GLO | their first page (again: next page) |
| hold SEQ + tap SAVE | SCENES page |
| white keys 1–8 / 9–16, on PATTERNS, CHAIN, SCENES | the patterns of the track (CHAIN: into the chain) / launch scenes 1–8 |
| tap SEQ / EDIT, drum track | DRUMS grid (again: TIMING, PLAY, PATTERNS, CHAIN, SCENES) / kit (again: sound) |
| OCT− / OCT+ | octave (both: 0) · drums: ghost / hard while held |
| ALGORITHM | track (1–8) |
| PRESETS | sound · drum kit |
| SELECT | tempo · pages · visualiser style · menu section |

### Layers

| Hold + | Keys | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 | Other |
| --- | --- | --- | --- | --- | --- | --- |
| **FX** | punch-in effects: 16 white keys, 11 black keys | master FILTER | DUST | DUCK | track FILTER | + HOME: lock |
| **EDIT** | erase sound / note · black key: drum MUTE mode (white keys mute / unmute) | SHIFT | LENGTH ×2 / ½ | TRANSPOSE | — | OCT− undo · OCT+ redo |
| **ARP** | note repeat | RATE | — | — | — | OCT− / OCT+: ghost / hard (drums) |
| **SEQ** | steps · black keys 1–4: page | SOUND / NOTE | DIV | SWING | LENGTH | OCT− / OCT+: page |
| **SEQ + step** | more steps | drums: which sound · synths: NOTE | drums: LEVEL · synths: VEL | RATCHET | NUDGE | PRESETS lock · ALGORITHM lock parameter · OCT+ fill condition · OCT− clear nudge, locks, condition |
| **SEL** | key of the song | CHORD | SCALE | KEYS | TRANSPOSE | — |
| **GLO** | 1–4 mute · 5–8 solo (the bank shown: 1–4 or 5–8) · 9 fill · 10 fill bar · 16 tap tempo · F#3 MIDI LEARN | level 1 / 5 | level 2 / 6 | level 3 / 7 | level 4 / 8 | SELECT: tempo |
| **SAVE** | 1–4 play A–D (several: chain) · 5–8 save A–D · 13 loop / song · 14 SONG REC · 16 song screen | — | — | — | — | — |
| **any layer + HOME** | lock it open | | | | | any other button unlocks |

### Chord mode (CHORD on)

| Hold | + white key |
| --- | --- |
| nothing | the chord of the scale on that key (C4 = I) |
| F# | major ↔ minor |
| G# | + 7th |
| A# | sus4 |
| C# | + 9th |
| D# | inversion |

### Power-on and special

| Do | Result |
| --- | --- |
| OCT− held at power-on | USB rescue |
| OCT− + OCT+ held at power-on | hardware calibration |
| OCT− + OCT+ held 5 s, stopped | update mode (UBOOT) |
| EDIT + OCT− / OCT+ | undo / redo |
| GO values (LOAD, SAVE, ERASE, NEW, CLRSQ, INIT) | one click arms (*TURN AGAIN: …*). A second click within ~1.5 s acts |
| SAVE + key 5–8 on a used section | press again within 3 s |
| SONG screen: REC on a used section · OCT+ | press again within 3 s |

### Where is…?

| Looking for | It is |
| --- | --- |
| tempo | SELECT on TRACKS · GLO + key 16 (tap) · GLO → GLOBAL → BPM |
| swing | TRACKS KNOB 1 (global) · SEQ + KNOB 3 (track) · GLO → GLOBAL |
| metronome | GLO → GLOBAL → CLICK |
| the level / pan of a track | TRACKS KNOB 2 / KNOB 4 · GLO + KNOB 1–4 |
| the drum kit | PRESETS on the drum track · DRUMS kit page KNOB 1 |
| the drum level / reverb | DRUMS kit page KNOB 2 / 3 · GLO → DRUMS |
| the drum delay (2.5) | GLO → DRUMS → DLY (KNOB 4) |
| the filter of a track | FX + KNOB 4 · FX → FILTER |
| delay time | FX → DLY → TIME |
| chords | SEL + KNOB 1 · SEL page |
| STRUM, VLEAD | SEL 2 |
| your sections A–D | SAVE + keys 1–4 (play) / 5–8 (save) · SAVE → SECTION (LOAD, SAVE, ERASE) |
| your sounds | SAVE → USER · PRESETS: the sound browser (USER, at the end) |
| the MIDI pages | hold HOME → SEQ → MIDI SETTINGS, OCT+ |
| the clock that BoopBox follows | SYSTEM → SYNC |
| the MIDI channel of each track | MIDI (CH1–CH4) · MIDI 2 (CH5–CH8) |
| the clock out, the punch-ins over MIDI, the drum map | MIDI 4 (CLOCK, FX CH, DR MAP, REMOTE) |
| MIDI in / out, the other channels, the bend | MIDI 3 (IN OTHER OUT BEND) |
| a vinyl / tape / rain bed under the mix | GLO → TEXTURE (2.6) |
| MIDI LEARN | GLO + F#3 · forget: hold HOME → SYSTEM → MIDI LEARN CLEAR |
| the effect of a track (INSERT) | FX → INSERT (its MIX on FX → FILTER) |
| tempo-synced envelope / LFO | ENV DEST → ESYNC · LFO → LFO 2 → SYNC |
| ANALOG band-pass / high-pass | EDIT → FILTER → TYPE |
| the length of a note in steps | SEQ → NOTES page, KNOB 3 on the note (LEN) |
| drum mutes | EDIT + a black key, then the keys of the sounds |
| a beat from the keys | drum track: SEQ → PLAY page, hold white keys |
| patterns, chain, scenes | SEQ pages after PLAY · hold SEQ + tap SAVE (SCENES) |
| the key and chords of the song | SEL → HARMONY · the CHORDS screen |
| synth ↔ drum track | SAVE → TOOLS → KIND · KNOB 1 in the sound browser |
| key velocity, aftertouch, USB HOST | hold HOME → KEYS |
| lights, colours, USB audio level | hold HOME (menu) |
| the version | hold HOME → SYSTEM → ABOUT |

---

*BoopBox is based on SLOOP by isod89, which is based on Felucca by Leo Kuroshita (@kurogedelic), Hügelton Instruments. Full credits and licences: [BOOPBOX.md](BOOPBOX.md#rescue-going-back-credits) and [LICENSING.md](LICENSING.md). M-VAVE and FM-1 are trademarks of their owners. BoopBox is not affiliated with them.*
