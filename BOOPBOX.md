<p align="center"><img src="project/assets/logo/boopbox-logo.png" alt="BoopBox" width="480"></p>

# BoopBox 1.9.1

**A live groovebox firmware for the M-VAVE FM-1 — for any style.** It has eight tracks. By default, six tracks are synths and two tracks are drum machines. Each drum machine has 16 sounds on the white keys (see [the groovebox controls](docs/groovebox-controls.md)). It has thirteen synthesis engines (for example six-operator FM with DX7 patches, physical models, noise, and now the analog polysynth of OberVave). It has 223 sounds and 37 drum kits (808, 909, trap, phonk, house, techno, UK garage, jungle, amapiano, reggaeton, synthwave, chiptune, ambient, jazz…).

You can use your own samples. BoopBox has ghost notes and ratchets, parameter locks, micro timing and fills, note repeat and one-key chords. It has 27 punch-in effects and a vinyl / sidechain / DJ-filter master. Its screen is clear and colour-coded, and always shows what your hands can do next. There are no factory patterns and there is nothing to load: everything that you hear, you play.

BoopBox is free and open source (GPL-3.0). It is based on [SLOOP](https://github.com/isod89/sloop-fm1) by isod89. SLOOP is based on [Felucca](https://github.com/hugelton/Felucca) by Leo Kuroshita / Hügelton Instruments.

> **Looking for one control?** [GUIDE.md](GUIDE.md) is the complete guide. It gives every button, key combination, layer, page and editor page. It also has a [one-page cheat sheet](GUIDE.md#26-cheat-sheet).

Version tags show the release that added a feature. *(1.8)* and other 1.x tags are BoopBox releases ([CHANGELOG.md](CHANGELOG.md)). *(2.6)* and other 2.x tags are SLOOP releases ([SLOOP's repository](https://github.com/isod89/sloop-fm1)).

---

## Contents

1. [Install](#install)
2. [Sixty seconds to a beat](#sixty-seconds-to-a-beat)
3. [The colour code](#the-colour-code)
4. [The panel: tap, hold, layers](#the-panel-tap-hold-layers)
5. [The drum track](#the-drum-track)
6. [Recording](#recording)
7. [Layers in detail](#layers-in-detail)
8. [Undo, clear, save, autosave](#undo-clear-save-autosave)
9. [Master: DUST, DUCK, FILT (and TEXTURE)](#master-dust-duck-filt-and-texture)
10. [Punch-in effects](#punch-in-effects)
11. [Screens](#screens)
12. [The sound bank](#the-sound-bank)
13. [Drum kits](#drum-kits)
14. [Your own samples](#your-own-samples-usr1usr4)
15. [Song mode](#song-mode)
16. [The web editor](#the-web-editor)
17. [Sound design pages](#sound-design-pages)
18. [MIDI keyboards](#midi-keyboards)
19. [USB audio: record on a computer](#usb-audio-record-on-a-computer)
20. [Lights](#lights)
21. [Specifications](#specifications)
22. [Rescue, going back, credits](#rescue-going-back-credits)

---

## Install

1. Open the [installer page](https://boopbox.replit.app/installer/) in **Chrome or Edge**.
   If you use the source folder on Windows, you can also double-click **`project/scripts/INSTALL-BOOPBOX.bat`**. This script builds the firmware and opens the installer at `http://localhost:8766/installer/`. Keep its black window open until the install is done.
2. Connect the FM-1 to the computer with a USB data cable. Connect it directly, not through a hub.
3. Choose **BoopBox** (or **BoopBox Trainer**, below). Press **INSTALL**. Allow MIDI access. Wait for *Done*.

The FM-1 restarts and shows the BoopBox logo. An update keeps your projects, presets, samples, kits and settings. The editor is at [editor/](https://boopbox.replit.app/editor/) (or **`project/scripts/OPEN-EDITOR.bat`**).

- **BoopBox Trainer** is a second firmware. It teaches you three songs on the FM-1 itself, with a coach on the screen. All other functions work as in BoopBox. To switch back, install the other firmware ([the trainer](docs/trainer.md)).
- **No FM-1 at hand?** [The emulator](https://boopbox.replit.app/emu/) runs the real firmware in the browser, with a drawing of the FM-1 on the page. [The home page](https://boopbox.replit.app/) shows what BoopBox does.

## Sixty seconds to a beat

1. Turn **ALGORITHM** to track **4** (orange, drums). The white keys play 16 sounds: **F3 kick**, G3 kick 2, A3 snare, B3 clap, **C4 hat**, D4 open hat… To select a kit, turn **PRESETS**. Try *808* or *BOOMBAP*.
2. Press **REC**. The screen shows *rec ready*. **Play a beat freely, at your own tempo**. There is no click and no count-in. For ghost notes, hold **OCT−** while you play the hits. For hard hits, hold **OCT+**.
3. **Press REC on the "1" after your last bar.** The loop closes. Its length sets the tempo. The hits snap to the grid. The loop plays immediately.
4. To record on top (overdub), press **REC** again while the loop plays. Hold **ARP** and hold the hat key. You get a 1/16 hat roll, and BoopBox records it as ratchets.
5. Turn **ALGORITHM** to track **1** (blue, *808 BOOM*). Press **REC** and play a bass line. Hold **SEL** and press the key of your song (for example D). On track 2, hold SEL and turn **KNOB 1** to *7TH*. Every white key now plays a chord of the key.
6. For a punch-in effect, hold **FX** and press a key (white or black). Keep FX held. Turn **KNOB 2** for DUST and **KNOB 3** for DUCK.
7. If you make a mistake, hold **EDIT** and press **OCT−** (undo).

## The colour code

| Colour | Track | Knob |
| --- | --- | --- |
| **blue** | 1 · synth | KNOB 1 |
| **green** | 2 · synth | KNOB 2 |
| **yellow** | 3 · synth | KNOB 3 |
| **orange** | 4 · drums | KNOB 4 |

Tracks **5–8** use a lighter shade of the same four colours. At power-on, tracks 5–7 are synths and track 8 is a second drum track. Any track can be a synth or a drum track (SAVE → TOOLS → KIND).

The screens show the bank of four tracks that contains the selected track: 1–4 or 5–8. The four dials at the bottom of the screen show the current function of KNOB 1–4. White always means *what you are touching*. Red always means *recording*.

## The panel: tap, hold, layers

Every function button has two uses. **Tap** the button (press and let go, and touch nothing else), and its pages open, as on all FM-1 firmware. **Hold** the button, and you get a **layer**. While you hold the button, the 16 white keys and KNOB 1–4 change their functions. After 0.35 s (or immediately when you use a key or knob), the screen shows the 16 keys as tiles and the knobs as dials. When you let go, you are back to playing.

The tiles are in four rows of four: keys 1–4, 5–8, 9–12 and 13–16. The first key of each row (1, 5, 9, 13) glows dimly while you hold a layer, and on the drum track. Thus you can find the rows without looking at the screen. The keys at full light show what is on.

**Finding a page:** if you tap a button from another page, it always opens its first page (SEQ: NOTES, or the drum grid). Thus the same taps always get the same page. To go to the next page of its group, tap the button again. **SELECT** moves through the pages in the two directions. The bottom of the screen shows the names of the pages on each side.

The **SCENES** page has its own shortcut: hold **SEQ** and tap **SAVE**. On PATTERNS, CHAIN and SCENES, the keys are pads. White keys 1–8 are the patterns of the track, and keys 9–16 are the scenes ([details](docs/groovebox-controls.md#patterns)).

**Lock a layer:** hold its button and tap **HOME**. When you let the button go, the layer stays open. Your two hands are then free for the keys and the knobs. The screen shows *LOCK*, and the button blinks. Any other button (HOME, the button of the layer, ENV…) unlocks the layer and does only that. PLAY, REC and OCT− / OCT+ continue to work inside the layer.

| Hold | Keys | KNOB 1 · 2 · 3 · 4 | Tap |
| --- | --- | --- | --- |
| **FX** — *punch* | a punch-in effect while the key is held | FILTER · DUST · DUCK · TRK FILT (the filter of the selected track) | FX pages |
| **EDIT** — *erase* | erase that sound / note from the pattern | SHIFT · LENGTH ×2 / ½ · TRANSPOSE · — | EDIT pages (drums: kit ↔ sound) |
| **ARP** — *roll* | note repeat on the grid | RATE · — · — · — | ARP pages |
| **SEQ** — *steps* | steps 1–16 of the page. With a step held: OCT+ sets its fill condition (normal · fill only · no fill), OCT− clears its nudge, locks and condition | SOUND / NOTE · DIV · SWING · LENGTH. With a step held: SOUND / NOTE · LEVEL · RATCHET · NUDGE (PRESETS: the lock, ALGORITHM: its parameter) | SEQ pages: NOTES (drums: the grid), TIMING, PLAY, PATTERNS, CHAIN, SCENES, SONG |
| **SEL** — *key* (between FX and ENV, not the SELECT knob) | the key of the song | CHORD · SCALE · KEYS · TRANSPOSE | SEL pages |
| **GLO** — *mix* | 1–4 mute · 5–8 solo (the bank shown: tracks 1–4 or 5–8) · 9 **fill** while held · 10 **fill bar** (the next bar) · 16 tap tempo | the four levels of the bank | GLO pages |
| **SAVE** — *song* | 1–4 play section A–D (on the next bar. Two or more tapped while SAVE stays held: a **chain** of them, looped) · 5–8 save the loop into A–D · 13 loop / song · 14 SONG REC · 16 the song screen | — | TRACKS: the SONG screen · other pages: the SAVE pages |

Other controls:

| Control | Action |
| --- | --- |
| **PLAY** | start / stop all the tracks (works inside all layers) |
| **REC** | playing: record now / stop · stopped: arm (the first note starts) · free take: close the loop |
| hold **REC** | clear the selected track (a ring fills. Hold for ~2 s. If you let go before, nothing happens) |
| **SAVE** | on TRACKS or DRUMS: the SONG screen · on other pages: the SAVE pages (USER, SECTION, TOOLS) |
| hold **SEQ** + tap **SAVE** | the **SCENES** page, from all pages and tracks |
| **EDIT + OCT− / OCT+** | undo / redo |
| **ALGORITHM** | select the track, 1–8, on every page except the sound browser (there: its sounds). The header shows the track |
| **PRESETS** | the sound of the selected track (in the sound browser, PRESETS moves through the engines and ALGORITHM through their sounds), or the drum kit |
| **SELECT** | on HOME (and inside a layer): the tempo · on a page: the previous / next page of its group (it stops at the ends. SEQ: NOTES or the drum grid, TIMING, PLAY, PATTERNS, CHAIN, SCENES) · drums: kit ↔ sound |
| **OCT− / OCT+** | synth tracks: octave (both: back to 0) · drum track, held: ghost / hard hits |
| **HOME** | the TRACKS screen · on the TRACKS screen: the [visualiser](#the-visualiser) (HOME again closes it) · hold: the menu (SCREEN, LIGHTS, AUDIO, KEYS, SEQ, SYSTEM) · tapped while a layer is held: lock the layer open |
| **ENV / LFO** | their pages |

## The drum track

A drum track (4 and 8 at power-on) plays **16 sounds, one per white key**, from the lowest F to the highest G. A black key plays the sound of the white key on its left. Thus you can play one sound with two fingers, for fast rolls.

| Key | Sound | Key | Sound | Key | Sound | Key | Sound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F3 | kick | C4 | hat | G4 | snare 2 | D5 | ride |
| G3 | kick 2 | D4 | open hat | A4 | low tom | E5 | shaker |
| A3 | snare | E4 | pedal hat | B4 | hi tom | F5 | conga |
| B3 | clap | F4 | rim | C5 | crash | G5 | cowbell |

**Levels:** every hit has one of four levels: **GHOST**, **SOFT**, **NORM** (as played) and **HARD**. For ghost notes, hold **OCT−** while you play the hits. For hard hits, hold **OCT+**. BoopBox records the hits at these levels.

**Ratchets:** a hit can repeat x1–x4 inside its step. ARP rolls record ratchets, and SEQ + a step + KNOB 3 sets them. The closed and pedal hats choke the open hat.

**Beats from the keys (1.9):** go to the **PLAY** page of the drum track (tap SEQ three times). Then **hold white keys**, and BoopBox writes a whole beat across the kit. The lowest key selects the groove (keys 1–8: HOUSE, ROCK, BOOM BAP, TRAP, BREAK, DEMBOW, DNB, ELECTRO · keys 9–16: the same grooves, busier). Each other key that you hold adds a variation and more detail (ghost notes, open hats, percussion, a crash, a fill). The same keys and SEED (KNOB 2) always make the same beat. EDIT + OCT− undoes the beat ([details](docs/groovebox-controls.md#beats-from-the-keys-the-play-page-of-a-drum-track-19)).

## Recording

BoopBox records live. It puts every pass on top of the last pass (overdub). Notes go to the nearest step **as you heard it**. BoopBox subtracts the time between a key and its sound (~12 ms), so what you play on the beat lands on the beat. The synth tracks keep chords (up to 4 notes a step). Held notes become ties.

| When | REC does | Then |
| --- | --- | --- |
| **Playing** | records the selected track **at once** | REC again stops the recording. The loop continues to play |
| **Stopped, project with notes** | arms (*rec ready*, the REC light blinks) | **your first note starts the loop and is step 1**. PLAY also starts it |
| **Stopped, empty project** | arms (*rec ready* · *play freely*) | a **free take** (see below), or MODE *tempo*: as with notes |

**The REC screen sets how it records** (when armed, before the first note). The knobs set these values:

| Knob | Dial | Choices |
| --- | --- | --- |
| KNOB 1 | **mode** (empty project only) | **free**: a free take, the tempo follows you · **tempo**: record at the tempo set (SELECT) |
| KNOB 2 | **length** | the loop of the selected track: **1, 2 or 4 bars** |
| KNOB 3 | **start** | **note**: your first note starts the loop · **count**: press **PLAY**, one bar of clicks (4, 3, 2, 1 on the screen), then the loop starts to record. Notes played before only sound |
| KNOB 4 | **quant** | **on**: what you record lands on the steps · **off**: it keeps your timing, as the nudge of each step ([details](GUIDE.md#quant-off)) |

MODE, START and QUANT are settings of the FM-1. They stay as you set them. In a project with notes, there is no MODE. BoopBox always records at the tempo set (a free take changes the tempo of the notes that are already there). During the count-in, REC cancels the count-in, and PLAY goes back to *rec ready*.

**Free take — the loop follows you.** An empty project has no tempo yet. You set the tempo when you play:

1. Press REC, then play freely. The screen shows *free take*, the seconds, and the loop that it makes if you stop now (*2 bars · 92 bpm*).
2. **Press REC on the "1" after your last bar.** The time from your first note to that press is the loop. BoopBox selects 1, 2 or 4 bars at the tempo nearest the set tempo. If the new tempo is within 3 % of the set tempo, BoopBox keeps the set tempo. BoopBox writes your notes into the loop with their lengths and levels, and plays the loop immediately. Every track gets that length.
3. If you press **PLAY** during a free take, BoopBox deletes the take. A take closes automatically after 24 s.

- While BoopBox records, the REC light is solid and the track shows a red *rec*. If you turn ALGORITHM, the take moves to the next track without a stop.
- The **PLAY light flashes on every beat**. It is a visual metronome. For an audible click, use GLO → GLOBAL → **CLICK** (`OFF`, `REC`, `ON`). BoopBox never records the click.
- **Swing** goes from 0 (straight) to 100 (the strongest, MPC swing at 75 %). GLO → GLOBAL → SWING sets it for all tracks. SEQ + KNOB 3 sets it for one track. The swing of a track adds to the global swing.

## Layers in detail

### FX — punch

The 16 white keys and the 11 black keys are the [punch-in effects](#punch-in-effects). An effect runs while you hold its key. The knobs control the [master](#master-dust-duck-filt-and-texture): **KNOB 1 FILTER** (turn left: low-pass, right: high-pass, centre: off), **KNOB 2 DUST** and **KNOB 3 DUCK**. **KNOB 4 TRK FILT** is the same filter on the selected track only (its FILT, on the FX → FILTER page). Keys that you press while you hold FX never play or record notes.

### EDIT — erase

Hold EDIT and press a key. That sound (drums) or that note (synths) leaves the pattern of the selected track. On a synth track with CHORD on, the notes of its chord leave the pattern. If you press the key **while playing**, the sound leaves every step that the playhead passes while you hold the key. This is MPC style: if you hold the hat key for one bar, the hats of that bar are gone. When the transport is **stopped**, the sound leaves the whole pattern immediately.

*ERASED* flashes. The knobs change the whole pattern:

- **KNOB 1 SHIFT** — moves every step one step later / earlier (this turns the groove around).
- **KNOB 2 LENGTH** — right: ×2 (the pattern is copied after itself, up to 64 steps). Left: ½.
- **KNOB 3 TRANSPOSE** — moves every note a semitone up / down (synth tracks).
- **OCT− undo · OCT+ redo** (the knob turns of one hold count as one change).
- **A black key** (drum track, 2.6): **MUTE mode**. The white keys now mute / unmute their sound in the sequencer, live. Nothing is erased. A muted sound shows *OFF* in red. Press a black key again to go back to erasing (2.7: MUTE mode stays when you let go of EDIT). The mutes stay until you unmute the sounds. When you load a project, every sound plays.

### ARP — roll (note repeat)

Hold ARP and hold a key. The key repeats on the grid at the **RATE** of KNOB 1: 1/8, 1/16, 1/32, 32T or 1/64. The repeat is locked to the tempo and the swing, so it always lands in time. On the drum track, OCT− / OCT+ make the repeats ghost / hard. While BoopBox records, it writes a roll as ratchets (a 1/32 roll on a 1/16 track: x2 on each step). A roll stops when you release its key.

### SEQ — steps (step sequencer)

The 16 white keys are the 16 steps of the page. The lit steps play. The first four black keys (F#3, G#3, A#3, C#4) or **OCT− / OCT+** select page 1–4 (steps 1–16, 17–32, 33–48, 49–64, up to the LENGTH of the track).

- **An empty step:** press its key. BoopBox sets the step immediately. Drums: the step gets the sound shown (KNOB 1 selects it, or the last pad that you played). Synths: the step gets the note or chord that you played last (on the keys, or on a MIDI keyboard from 2.6).
- **A set step:** tap its key to clear the step (with its nudge, locks and fill condition). To edit the step and keep it, hold its key and turn a knob. **KNOB 1** sets the sound (drums) / note (synths). **KNOB 2 LEVEL** sets ghost, soft, norm or hard (on a synth step, 2.6: **VEL**, its velocity 1–127). **KNOB 3 RATCHET** sets x1–x4. **KNOB 4 NUDGE** sets the nudge. **PRESETS** sets a parameter lock, and **ALGORITHM** selects the parameter. **OCT+** changes its fill condition. To edit several steps together, hold their keys. **OCT−** with a step held clears its nudge, locks and condition.
- **No step held:** KNOB 1 selects the sound / note to set. KNOB 2 sets **DIV** (1/4 … 1/32, triplets, 1/2, a bar, two bars). KNOB 3 sets the **SWING** of the track. KNOB 4 sets **LENGTH** (1–64 steps. Each track loops on its own length, and polymeters stay in phase).

**Nudge (micro timing).** Hold a step and turn KNOB 4 to move the step off the grid. The range is −32 … +31, in 1/64 of a step. Minus is early (the step plays before its grid time, inside the previous step), and plus is late. The ratchets of the step move with it, but the recording and the swing stay on the grid. On the drum track, the whole step moves, with every sound in it. A nudged step shows a dot in the corner of its tile.

**Parameter locks.** Hold a step and turn **PRESETS** to give one sound parameter another value *for that step only*. At first, the **lock parameter** is the last sound knob that you turned on a page (ENV, LFO, FX, EDIT, VOICE…). Until you turn one, it is *FLT* of ENV DEST. **ALGORITHM** steps through the other parameters (it wraps round). The title line shows the parameter: *lock dst 14*, or *lock flt --* (no lock yet).

The first click of PRESETS makes the lock at the current value of the track. The next clicks move the lock. At the next step without a lock, the parameter goes back to its previous value. Notes that still ring follow the change (Elektron style). If you turn a knob on the page while a lock is in force, the knob wins. BoopBox keeps that value as the new base.

One step can hold several locks (one per parameter), and a track can hold 32 locks. A lock can also **SLIDE** to its value over the step ([details](docs/groovebox-controls.md#parameter-locks)). The pattern, arp, key and voice-mode parameters cannot lock. A locked step shows the same dot as a nudged step. OCT− with the step held clears the two. Undo (EDIT + OCT−) is for the steps: it does not bring back nudges and locks.

BoopBox saves locks and nudges with the project. The web editor shows them (Sequencer tab, step detail).

**Fill conditions.** Hold a step and press **OCT+** to cycle its condition: *normal* → **FILL ONLY** (plays only during a fill) → **NO FILL** (silent during a fill) → normal. You call a fill while you play. Hold **GLO** and hold white key **9** (*fill*): the fill lasts as long as you hold the key. Or press key **10** (*bar*): the whole next bar plays as a fill, then the fill stops. To cancel, press key 10 again before the bar.

Set the rolls, crashes and pickup notes of a beat to FILL ONLY. Set its main hat to NO FILL. Then one finger brings the fill in and out on the bar. A skipped step is fully silent: no note, no MIDI, no ratchet and no lock of its own. The sound goes back to its base, as at all steps without a lock, and the pattern continues. On the drum track, the condition applies to the step, with every sound in it.

The tile of a FILL ONLY step shows a small **F** in its top left corner. The tile of a NO FILL step shows an **×**. The nudge / lock dot stays top right. The GLO tiles *fill* and *bar* come on while they operate. OCT− with the step held resets the condition, the nudge and the locks. STOP ends all fills.

BoopBox saves conditions with the project. The web editor shows them (the *Fill* select in the step detail, F / × on the grid). The arp and the rolls ignore fills.

### SEL — key and chords

- **Any key** sets the **key of the song**: the root of every synth track (*KEY D*).
- **KNOB 1 CHORD** (selected synth track): OFF, TRIAD, 7TH, 9TH (1-3-7-9, the lo-fi / R&B voicing), SUS4, POWER. When a chord is on, **the white keys walk the scale from C4**. C4 is the chord of the I of the key, D4 the II, E4 the III… One finger plays the whole chord, and BoopBox records it as a chord. When SCALE is on CHR, the chords come from the minor scale.
- **CHORD+ (2.4, after HiChord and minichord): the black keys change the chord.** When a chord mode is on, hold a black key while you play a white key. Or press the black key while you hold the chord, and the chord changes under your finger: **F#** major ↔ minor, **G#** adds the 7th, **A#** sus4, **C#** adds the 9th, **D#** an inversion. This works with both octaves of black keys. To combine changes, hold several black keys. The 7th and 9th come from the scale. In C major, G4 (the V chord, G) with G# is G7, and with F# + G# it is Gm7. BoopBox records what you play as it sounds. On the **SEL 2** page, **STRUM** spreads the notes of a chord like a strummed guitar (1–60 ms a note · right: low to high, left: high to low). STRUM works on the keys and on the chord steps that the sequencer plays. **VLEAD** ON voices each chord nearest the last one. Thus a progression moves smoothly and does not jump.
- **KNOB 2 SCALE** sets the scale for all synth tracks (16 scales: major, minor, dorian, mixolydian, pentatonics, harmonic, blues…).
- **KNOB 3 KEYS**: OFF (all keys chromatic), SNAP (every key rounded to the scale), WHITE (the white keys walk the scale, the black keys are silent).
- **KNOB 4 TRANSPOSE** transposes the selected track, ±24 semitones.

A change of sound (PRESETS, a user preset) never changes the key, the chord mode, the pattern or the mix of its track.

### GLO — mix

- White keys **1–4 mute** the four tracks of the bank shown (1–4, or 5–8 when the selected track is one of them). A muted track fades out in a few ms and plays no new notes. Its pattern continues in time. Keys **5–8 solo** the tracks (several solos add up). The screen shows the four levels as faders, with the mute and solo of each track.
- The last white key (**G5**): **tap tempo** (two taps or more).
- The first black key (**F#3**, 2.6): **MIDI LEARN** on / off (see [MIDI keyboards](#midi-keyboards)).
- **KNOB 1–4: the levels** of the four tracks of the bank.

## Undo, clear, save, autosave

- **Undo / redo:** hold EDIT and press OCT− / OCT+. Undo has one level: the last recording pass, erase, clear, step edit or pattern edit. Redo reverses the undo.
- **Clear a track:** hold REC. After 0.7 s, BoopBox cancels the press and a ring fills. Hold for ~1.3 s more, and BoopBox clears the selected track (*TRACK 2 CLEARED*). If you let go before, nothing happens. Undo brings the track back.
- **Save:** SAVE + keys 5–8 save the loop into section A–D. SAVE → SECTION also has SECT, ERASE, LOAD and SAVE.
- **Autosave:** when the transport is stopped and you touch nothing for 2.5 s, BoopBox keeps the working project in flash (at most every 20 s). At power-on, BoopBox comes back exactly as you left it.
- **New loop:** SAVE → TOOLS → NEW (turn to GO). Every track of the working loop goes back to its power-on sound, with empty patterns. BoopBox keeps the sections A–D.
- **Synth ↔ drum track:** SAVE → TOOLS → KIND (GO). The selected track changes kind, and BoopBox clears its pattern.

## Master: DUST, DUCK, FILT (and TEXTURE)

**TEXTURE (2.6, GLO → TEXTURE, TEXTURE 2):** a bed of sound that loops under the mix. It does not use a track. Its settings are **SRC** (VINYL, TAPE, RAIN, WIND, RADIO, ROOM or a sample slot: USR1–4, looped) · **LEVEL** · **TONE** (low-pass ← off → high-pass) · **MOVE** (it breathes, level and brightness) over **RATE** (1–16 bars) · **WHEN** (PLAY: with the transport / ALWAYS) · **DUCK** (the kick pumps it). BoopBox saves TEXTURE with the project and with each song section.


These effects work on the whole mix, after the sends of the tracks (FX + KNOB 1–3, or GLO → MASTER):

- **DUST** 0–100 %: the mix goes through an old sampler and a record. DUST adds drive into a soft clip, a lower sample rate (down to ~11 kHz) and fewer bits (down to 8). It also adds a low-pass that closes to ~3 kHz. While the transport plays, it adds a little hiss and crackle (a stopped BoopBox is silent).
- **DUCK** 0–100 %: every kick pumps the synth tracks down and back over an 1/8 note. This is the sidechain sound, in time at all tempos.
- **FILT**: a DJ filter. Left of centre, a low-pass closes. Right of centre, a high-pass opens. At the centre, it is OFF. It glides (no zipper noise).
- **ROLL** (GLO → MASTER): the note-repeat rate of ARP + key.

## Punch-in effects

Hold **FX**, then hold a key. You can use the 16 white keys from the lowest F to the highest G, and (2.6) the 11 black keys. The effect runs on the whole mix while you hold the key. When you release the key, the effect stops cleanly. Loops and the gate are locked to the tempo and start on the grid.

| Key | Effect | Key | Effect |
| --- | --- | --- | --- |
| 1 | loop 1/4 | 9 | low-pass sweep |
| 2 | loop 1/8 | 10 | high-pass sweep |
| 3 | loop 1/16 | 11 | phone |
| 4 | loop 1/32 | 12 | bit crush |
| 5 | stutter (1/16 triplets) | 13 | alias (sample-rate drop) |
| 6 | reverse | 14 | gate 1/16 |
| 7 | tape stop | 15 | echo (dotted 1/8) |
| 8 | half speed | 16 | tape wobble |

The black keys (2.6), from the lowest F# to the highest:

| Key | Effect | Key | Effect |
| --- | --- | --- | --- |
| F#3 | **KILL LOW**: the lows removed (below ~250 Hz, 24 dB/oct, DJ style) | F#4 | **FLANGER**: a jet sweep over a bar, left and right apart |
| G#3 | **KILL MID**: the mids removed (~250 Hz – 2.5 kHz) | G#4 | **AUTO-PAN**: the mix in mono, left and right once a beat |
| A#3 | **KILL HIGH**: the highs removed (above ~2.5 kHz) | A#4 | **FREEZE**: the mix goes into the reverb and stays there for as long as you hold the key. When you let go, it dies away with the SIZE of the reverb |
| C#4 | **REWIND**: the record pulled back. It slows, stops and spins backwards faster and faster (about a third of a second of the past). Then silence until you let go | C#5 | **LOOP 8T**: loop 1/8 triplet |
| D#4 | **OCT UP**: the mix an octave up | D#5 | **MONO**: left and right in one |
| | | F#5 | **FADE OUT**: the mix fades to nothing over two beats |

The screen shows the 27 keys as a keyboard. The white keys are in four rows of four, as on the other layers. The black keys are above them. Each black key is between the same two white keys as on the FM-1. The black key after the last white key of a row is at the right end of that row. The effect that you hold is lit white.

## Screens

- **TRACKS** (HOME) — the performance view. It shows the tempo, swing, transport and bar.beat. It also shows each track with its sound, its steps, the playhead, mute / solo / rec badges and its level. Dials: *swing · level · steps · pan* (KNOB 2 on a muted track unmutes it).
- **Layers** — while you hold a layer button: 16 tiles (the white keys) and the dials of the knobs, in the colour of the layer.
- **DRUMS** (on the drum track, tap SEQ for the grid, or tap EDIT for the kit) — **grid**: the 16 sounds × 16 steps, with levels as shades and ratchets as notches. Dials: *sound · step · hit · level*. KNOB 1 plays the sound that it selects, and KNOB 2 plays the step that it moves to. The **keys** are the steps of the sound. A white key sets or clears its step. A black key selects the sound. OCT− / OCT+ select the page of steps (1–16 … 49–64). The keys light the steps of the sound. **kit**: 16 pads that flash on every hit. Dials: *kit · level · reverb · pan*. The grid is the first SEQ page (SEQ again or SELECT right: TIMING, PLAY, PATTERNS, CHAIN, SCENES). Kit and **sound** are the EDIT pages of the drum track (EDIT again or SELECT: kit ↔ sound). On the kit page, the keys play the pads. The top right of the screen shows the name of the page and what comes next.
- **REC READY / FREE TAKE** — while REC is armed: the tracks, then **mode**, **length**, **start** and **quant** on KNOB 1–4 (4-3-2-1 during a count-in). During a free take: the seconds and the loop that it makes.
- **Holds** — the ring of REC (clear) while you hold REC.
- **SONG** — the section chain.
- **PATTERNS, CHAIN, SCENES** — the SEQ pages after PLAY: the eight patterns of the track, its chain (a playlist with repeats) and the scenes of the song. The keys are pads ([details](docs/groovebox-controls.md#patterns)).
- **CHORDS** — after the SEL pages: the chord and progression of the song. The keys play the chord live ([details](docs/groovebox-controls.md#harmony)).
- **Sound pages** (ENV, LFO, FX, SEL, EDIT, ARP, SEQ, GLO, SAVE) — the full synth, colour-coded.

## The sound bank

The bank has 223 starting points for all styles: house and techno, hip-hop, trap and plugg, drum & bass, amapiano, synthwave, lo-fi, ambient, soul. Each sound is a full patch on one of the thirteen engines. You can change it, save your own sounds (32 user presets), or load your own samples.

**PRESETS** on a synth track opens the **sound browser**. It shows the engines on the left and every sound of the selected engine on the right. SELECT (the VIEW) groups the sounds **by kind** instead: basses, keys, organs, pads, leads, plucks and bells, stabs, FX. Your favourites come first and your own presets come last. **SAVE** keeps the current sound and closes the browser. **HOME** puts back the sound that you had.

See [the sound browser](GUIDE.md#the-sound-browser). All sounds are level-matched: they are equally loud at the same LEVEL. On a new project, BoopBox starts at **90 BPM**. Track 1 has *808 BOOM*, track 2 has *RHODES*, track 3 has *LOFI FLUTE* and track 4 has the 808 kit.

| Kind | Sounds (engine) |
| --- | --- |
| **Bass** | 808 BOOM, 808 DIRTY, 808 SLIDE, SUB BASS, PLUGG BASS — they slide between held notes, two octaves under the keys · REESE, WOBBLE, ACID 303 (the resonant acid line, sliding where notes overlap), FUNK BASS, MONO BASS (ANALOG) · FM BASS, BASS GTR (DIGITAL) · CZ BASS (PHASE) · ROUND BASS (FM6) · FAT BASS (TRIO) · WOW BASS (VOICE) · GB BASS (LOFI) · UP BASS, DEEP BASS (SAMPLE: a real upright) · PLUCK BASS (PHYS) · NES BASS (LOFI) · SAW BASS (ANALOG) |
| **Keys** | RHODES, DX RHODES, WURLI, M1 PIANO (the house piano), AFRO KEYS (afro house, amapiano), CLAV (DIGITAL) · GRAND PNO (SAMPLE: a Steinway grand. Long notes fade as on the real one), DUSTY PNO, LOFI KEYS (the same grand through an old sampler) · SOFT KEYS (PHASE) · TINE EP (FM6) · FM GRAND (DIGITAL) |
| **Organ** | SOUL ORGAN, GOSPEL, JAZZ ORGAN, DIRTY B3, HOUSE ORGN (the 90s house organ: bass lines and chords) (WHEEL) · DRAWBARS (FM6) · ACCORDION (TRIO: a musette, two reeds a little apart) · ROCK ORGAN, CHAPEL, REGGAE ORG (WHEEL) |
| **Pad** | WARM PAD, DARK STR, ATMOS PAD (ANALOG) · SAW PAD, ENSEMBLE (TRIO: the 70s string machine) · GLASS PAD (DIGITAL) · SOFT PAD (FM6) · CZ STRING (PHASE) · LOFI CLOUD, VIBE HAZE, STR CLOUD, SHIMMER, DRONE (GRAIN) · CHOIR AAH, SOUL OOH (VOICE) · BOWED MTL, CELLO BOW, GLASS BOWL (PHYS) · WIND, OCEAN (NOISE) · CZ PAD (PHASE) · VOX PAD (VOICE) · PNO FREEZE, HORN CLOUD (GRAIN) · SINE PAD (ANALOG) · PULSE PAD (TRIO) |
| **Lead** | SUPERSAW (eight detuned saws: trance, EDM), G-FUNK LD, FAT LEAD, PAN FLUTE (ANALOG) · SYNC LEAD, HOOVER (TRIO) · TALKBOX, HARMONICA (VOICE) · GAME LEAD (LOFI) · LOFI FLUTE (SAMPLE) · FLUTE DUST (GRAIN) · NZ ARCADE (NOISE) · WAVE LEAD (LOFI) · CZ LEAD (PHASE) · ROBOT (VOICE) · PWM LEAD (ANALOG) · SQR LEAD (TRIO) |
| **Pluck & bell** | TRAP PLUCK (ANALOG) · RESO PLUCK (PHASE) · PLUGG BELL, TRAP BELL, MUSIC BOX, KALIMBA, MARIMBA, XYLOPHONE, GLOCKEN, CELESTA, STEEL DRUM, HARP (DIGITAL) · VIBES (SAMPLE) · 8BIT ARP (LOFI) · GLASS BELL, WOOD BARS, NYLON PICK (FM6) · STR PLUCK, SITAR, PHYS HARP, BELL TREE, MODAL BAR, THUMB PNO, NYLON GTR, STEEL GTR, MUTED GTR, KOTO, BANJO, TANPURA, CHIMES, BIG BELL, VIBRA BAR, STEEL PAN, WOOD BLOCK (PHYS) · 1BIT BEEP (LOFI) · CZ RESO (PHASE) · TUBE BELL, FM PLUCK (DIGITAL) |
| **Stab** | MIN STAB, MIN7 STAB, RAVE STAB, DUB CHORD (dub techno, into the delay) (TRIO: one key plays the chord) · SYN BRASS (ANALOG) · CZ BRASS (PHASE) · BRASS SECT (FM6) · 80S POLY (TRIO) · HORN STAB, STRING STB (SAMPLE) · CHIP CHORD (LOFI) · POWER STAB (TRIO) |
| **FX** | SCRATCH — scratch, backspin, rewind across the keys · GM KIT (SAMPLE) · HAND DRUM, MEMB TOMS, TABLA, CONGA, TIMPANI (PHYS) · RAIN, NZ METAL, VINYL, HISS, RISER, NZ SNARE, BITCRUSH, RADIO (NOISE) · CHIP NOISE (LOFI) |

The sampled sounds (SAMPLE engine, **SET**: PIANO (a grand), BASS, VIBES, HORNS, STRGS, FLUTE, SCRCH, PERC) are free recordings (CC0: Versilian Studios VSCO-2 CE and VCSL, Sonic Pi). They are retuned and coloured like a record through an old sampler.

### FM6: six-operator FM and DX7 patches

**FM6** is the classic six-operator FM synthesis, the sound of the DX7: electric pianos, bells, glassy pads, slap and round basses, brass. It is msfa, the synthesis core of Dexed. Leo Kuroshita ported msfa to whole-number arithmetic for Felucca 1.0.

Each synth track that plays FM6 has a full **patch**. The patch has six operators with their own four-stage envelopes, keyboard scaling, velocity, ratio or fixed frequency and detune. The patch also has 32 algorithms, feedback, the LFO and the pitch envelope. FM6 plays six voices per track. Its own envelopes shape every note, so the ADSR of the track has no effect here.

On the FM-1, the eight **EDIT** values are macros on top of the patch:

| EDIT | Does |
| --- | --- |
| **ALG** | *PAT* = the algorithm of the patch, 1–32 another one |
| **FB** | more feedback (0–7): brighter, then noisy |
| **MLVL** | the level of every modulator (−36 … +36 dB): the brightness |
| **MRAT** | the ratio of the modulators up (ratio mode only): other harmonics |
| **MEG** | the envelopes of the modulators slower (+) or faster (−) |
| **VMOD** | how much velocity makes the note brighter |
| **DTUN** | spreads the carriers apart in pitch: a chorused, wider sound |
| **PTCH** | loads a patch: **F1–F8** the factory ones, **B1–B27** your bank |

The FLT of the track moves MLVL (so LFO → FLT and the matrix still make it brighter). SHP moves the feedback, and PIT moves the pitch.

**Your own patches** live in the **FM6** panel of the web editor (Sound tab, when the selected track plays FM6). There you can edit every operator. **Send to track** sends the patch, and it plays immediately. To hear every change, tick *Send while editing*. **Store in bank** stores the patch in B1–B27, on the flash of the FM-1. Stop the song first.

**Import SysEx** reads a DX7 file. The file can hold one voice (163 bytes) or a 32-voice bank (4104 bytes: pick a voice). It can hold several of them in one file, and the editor reads damaged ones as far as they go. Thus the thousands of DX7 and Dexed patches on the web play on the FM-1. (2.5: you can also drop the .syx file on the panel.)

**Store cartridge in bank** (2.5) stores a whole cartridge at once. Tick up to 27 of its voices (the first 27 are ticked). One write puts them in B1, B2… in order. The editor asks you before it replaces anything, and the rest of the bank stays. If you choose **also add them to the user presets**, each voice gets a user preset with its name, which plays its B slot. On the FM-1, PRESETS and SELECT find these presets by name.

**Export SysEx** and **Export bank as SysEx** write the patches back for Dexed or a real DX7. A project keeps the PTCH of the track, not the patch itself. A patch that you sent stays on the track until the track loads another patch. To keep the patch with the project, store it in the bank. A user preset of an FM6 sound keeps the macros and PTCH in the same way. The backup holds the bank.

## Drum kits

There are 37 kits, plus your own kits (USR1–USR4, USR3+4, and the synthesised SYN1–SYN4 of 2.5). To select a kit, use **PRESETS** on the drum track, KNOB 1 on the kit page, or the editor. Kits 1–5 are a sampled acoustic kit (CC0 recordings of a real snare, hi-hat, toms and cymbals) and its treatments. Kits 6–37 are synthesised, so they use almost no memory.

Every synthesised kit has 16 sounds of its own, one per white key. KICK 2 and SNARE 2 are different sounds, not the same sound retuned (the long 808 in TRAP, the log drum in AMAPIANO, the rumble in TECHNO). Each sound is built as on the classic machines. It has a tuned body with a pitch drop and a hold before it fades. It also has a second partial for the drum heads, a click for the attack, noise through a resonant filter, and drive.

Softer hits are darker as well as quieter. The levels are measured: every kit is as loud as the others, and each sound is at its place in the mix.

| # | Kit | Style | # | Kit | Style |
| --- | --- | --- | --- | --- | --- |
| 1 | ACOUSTIC | studio | 20 | ELECTRO | electro |
| 2 | DEEP | soft | 21 | DISCO | disco |
| 3 | TIGHT | punchy | 22 | GARAGE | UK garage |
| 4 | BRIGHT | bright | 23 | JUNGLE | drum & bass |
| 5 | DUST | dusty | 24 | DUBSTEP | bass music |
| 6 | 808 | hip hop | 25 | DEMBOW | reggaeton |
| 7 | 909 | house | 26 | AMAPIANO | amapiano (log drum) |
| 8 | 606 | acid | 27 | AFRO | afrobeat |
| 9 | 80S | 80s pop | 28 | LATIN | latin |
| 10 | VINTAGE | rhythm box | 29 | TRIBAL | tribal |
| 11 | TRAP | trap | 30 | SYNTHWV | synthwave |
| 12 | DRILL | UK drill | 31 | CHIP | chiptune |
| 13 | BOOMBAP | hip hop | 32 | ARCADE | video game |
| 14 | LO-FI | lo-fi | 33 | GLITCH | glitch |
| 15 | PHONK | phonk (melodic cowbell) | 34 | INDUSTR | industrial |
| 16 | HOUSE | house | 35 | HYPER | hyperpop |
| 17 | D.HOUSE | deep house | 36 | AMBIENT | ambient |
| 18 | TECHNO | techno | 37 | JAZZ | jazz (brushes) |
| 19 | MINIMAL | minimal | | | |

BoopBox saves the kit with projects and song sections. Incoming MIDI notes on the drum channel (10) play the nearest of the 16 sounds. Kits **38–42** are yours: **USR1–USR4** and **USR3+4** (below).

### Your own drum kits (KIT USR1–USR4, USR3+4)

A sample slot can be a drum kit. The kit puts one of your sounds on each of the 16 lanes of the drum track, one per white key (KICK on F3 … COWBELL on G5). Make the kit in the web editor, on the **Drum kit** page:

1. Drop WAV files on the **16 pads** (KICK, KICK 2, SNARE, CLAP, HAT, OPEN HAT, PEDAL, RIM, SNARE 2, LOW TOM, HI TOM, CRASH, RIDE, SHAKER, CONGA, COWBELL). To add several files at once, use **Choose files**. The editor sorts them onto the pads by their names (*kick*, *bd*, *snare*, *hh*, *open*, *crash*…). A second kick goes to KICK 2. To hear a pad, click its wave.
2. Each pad has **Pitch** (±12 semitones), **Gain** and **Length** (a cut ends with a short fade, no click).
3. **Where it goes:** select **USR3+4**, the big kit (about 15 s), or a single slot, **USR1**–**USR4** (about 7.4 s). For USR3+4, the editor divides the sounds between USR3 and USR4 automatically, and USR1 and USR2 stay free for your instruments. Each choice shows what it holds now, and what a send will replace. The meter shows the time used of that space, at 22 kHz mono. If the kit is too long, shorten the long sounds (crashes, open hats) or press **Fit the slot**.
4. Name the kit and press **Send**. Then **Use … on the drum track** selects track 4 and sets its KIT. You can also turn KIT yourself: USR3+4 is the last kit.

All functions of the drum track work with the kit: steps, levels, ratchets, fill conditions, the grid page, the keys, MIDI on the drum channel (a note plays the sound of its lane), the track filter, the slicer, mute. The closed hat cuts the open hat. A lane without a sound is silent, and an empty slot is silent too. You choose if a slot is a kit or an instrument. For example, USR1 and USR2 can be instruments on tracks 1–3 (SAMPLE), with a big kit on USR3+4. **Save as ZIP** keeps the 16 WAVs of the kit so that you can share it, and **Open ZIP** (or a dropped .zip) loads one back.

## Your own samples (USR1–USR4)

Four slots of about 7.4 s each hold your own sounds (USR4 from 2.4). A synth track plays them with engine **SAMPLE**, **SET** = USR1 … USR4. The drum track can also play them as a kit (above). Load them from the **Samples** page of the web editor, in three steps:

1. **Choose a slot.** Four tiles show what each slot holds (its name, how full it is). If a send will replace something (or half of your USR3+4 kit), the page tells you.
2. **Make the sound**, one of two ways:
   - **From files (one note per file)**, for an instrument: drop WAV files (or click to choose them). You can use up to 16 files, at any rate, mono or stereo. Each file plays at its own note. The keys between play the nearest file, pitched. The editor reads the note from the file name (`KEYS_C4.wav`, C4 = 60), or you set it in the list. A keyboard picture shows which keys play which file. ▶ plays a file. The meter shows the time used of the slot.
   - **Chop a recording**, for a loop, a break or a phrase: one recording cut into pieces, one per key (CHOP, below).
3. **Send it and play it:** name the sound and press **Send to USRn**. Then **Play this slot on track 1, 2 or 3** sets that track to SAMPLE with SET = USRn.

- **CHOP:** open or drop a recording (WAV, MP3, AIFF…). Cut it into up to 16 chops, one per key. To cut it live, use **TAP** (or the space bar) while it plays (*snap to the hit* puts each tap on its attack). You can also use **Find hits**, **Grid** or **Equal parts**. Then select the chops to keep (the box on each chop, **Keep all**, **Keep none**, or **K**). To set the length of a chop, use the slider under the chops, or drag the handle at the bottom of the wave. **Up to the next marker** undoes the length change. If the chops are too long together, press **Fit to slot**. A recording of any length works, and the slot takes about 7.4 s of chops. Then send it in step 3, or use **Download WAVs** (the kept chops only, each with its own number).

## Song mode

A song has up to 16 steps of 4 sections, **A–D**. Each section holds every track: sounds, patterns, kits. You make the song live, while you play:

1. Make a loop (the verse). Hold **SAVE** and press the **5th white key** (*save A*). Change the loop (the chorus) and save it into **B** with the 6th key. Save a bridge into **C** and an end into **D**. If you save over a used section, BoopBox asks for the key again within 3 s.
2. **Play the sections live:** hold SAVE and press white key **1–4**. If the transport plays, the section starts on the next bar, with every track from its first step, always in time. If the transport is stopped, the section becomes the loop immediately.
   **Quick chain:** keep SAVE held and tap more section keys (*A B B C*, any order, repeats allowed, up to 8). Then let go. The first section plays on the next bar, as usual. Each next section plays after the previous section plays its **pattern length** (the length of the longest track: a 32-step 1/16 track is 2 bars). The chain loops. The title line shows *chain A B B C*. The section that plays is lit, and the next one has a frame. A tap on one section, STOP, or PLAY in song mode ends the chain. SONG REC records what the chain plays.
3. **Record the song as you play it:** press SAVE + key **14** (*rec*). From the next bar, BoopBox writes into the song every section that you play and how many bars it plays. To end, press SAVE + key 14 again, or STOP. The screen shows *SONG PARTS 5*. BoopBox saves the song automatically when you stop.
4. **Play it back:** SAVE + key **13** switches *loop* / *song*. In song mode, **PLAY** plays the whole song and stops at the end. After that, your loop is back.

The **SONG screen** (tap SAVE on TRACKS, or SAVE + key 16) shows the chain, and you can edit it there. **KNOB 1** selects the step, **KNOB 2** its section, **KNOB 3** its bars and **KNOB 4** the number of steps. **REC** stores the loop into the section of the step. **SAVE** (tap) saves the chain. **OCT−** switches loop / song. **OCT+ twice** loads a section.

## The web editor

Connect the FM-1 by USB. Open the editor in Chrome or Edge from the [home page](https://boopbox.replit.app/), from the installer page, or with **`project/scripts/OPEN-EDITOR.bat`** (`http://localhost:8766/editor/`). Press **Connect**. The editor follows the device live: if you turn a knob on the FM-1, the editor moves.

**Offline (2.6).** *Download for offline use* (at the bottom of the side bar, or on the installer page) saves the whole editor as one file for a computer: `boopbox-editor-<version>.html`. This file is also attached to each [release](https://github.com/josh-mcfarlin/boopbox/releases). Double-click the file. It opens in Chrome or Edge without internet (Chrome asks once to allow MIDI) and works as the online editor. Its sound library (kept in the browser) is separate from the library of the online editor. To move sounds between them, use Export / Import, or a backup.

**As an app, also on Android (2.6).** Open the [online editor](https://boopbox.replit.app/editor/) or the installer once with internet. Then use *Install the app* (at the bottom of the side bar, or on the installer page, or Chrome's menu → *Install app* / *Add to Home screen*). After that, the BoopBox app opens the editor without internet. Its link to the installer also works offline (with the firmware that it installs). The app stays the online site that the browser keeps, so it uses the same sound library as the online editor. It gets each new BoopBox version automatically the next time it opens online.

On Android, use the app, not the downloaded file. Chrome on Android does not allow MIDI in a downloaded file.

The editor looks like the FM-1 (the colours of the tracks, its own Terminus font). It is for a computer: it needs a window at least 1000 px wide. The side bar groups the pages by task: **Play**: LIVE · **Make a loop**: Sound, Sequencer, Patterns · **Song**: Song, Save & load · **Your sounds**: Library, Sample slots · **FM-1**: Settings, Theme. At the top: the page, the messages, the FM-1 and **Connect**, and on the Sound and Sequencer pages the **eight tracks** (number, sound, engine). To edit a track, click it. Every value shows its whole name (*Detune*, *Key tracking*), with the FM-1's short name beside it (*DTN*, *KTR*); the mouse on it tells what it does. Pages that send only when you ask have **Send to FM-1** at the top right, with **Unsent changes** while there is something to send. A transport bar at the bottom has play and stop.

- **Sound** — the presets on the left (an engine filter, a search, the list, files), and every parameter of the selected track on the right, in tabs: **Engine**, **Envelope**, **LFO**, **Effects**, **Voice**, **Arp & key**. Drag a value up or down like a knob (Shift: fine). Or use its bar: click, then use the wheel or the arrow keys (double-click: the default). On an FM6 track, the Engine tab has the **FM6** panel (the patch, the bank, SysEx import and export).
- **Sequencer** — click an empty step to add a note, click a note to select it. The **step panel** beside the steps edits it with the mouse: a small piano for the notes (a chord: up to 4), note / hold previous / rest, velocity, accent, slide, nudge, when it plays (fills), the parameter locks and the step components. The other views: **Piano roll** (C0–C8, every row named) and **List** (typed note names). On the **drum track**: a grid of the 16 sounds × the steps, with the **kit** ([the guide](GUIDE.md#notes-by-hand-sequencer)).
- **Patterns** — in three tabs: **Patterns & chains** (the eight patterns of each track: play, copy, clear, direction, FOLLOW; the chain, built by dragging), **Scenes** and **Chords**. The editor reads them from the FM-1, you change them, and the editor sends them back (with the song stopped).
- **LIVE** — the whole FM-1 on one screen for a show: transport, sections, scenes, the mixer (eight strips in one row), punch-in effects, keys and a playlist ([the guide](GUIDE.md#live)).
- **Song** — the order of sections of the SONG screen, as a timeline, and what happens at its end.
- **Library** (the sounds in the browser and the 32 user presets as tiles: drag between them), **Sample slots** (three tabs: **Samples** with CHOP, **Drum kit** (your own kits, [above](#your-own-drum-kits-kit-usr1usr4-usr34)), **Drum synth** (SYN1–SYN4)), **Save & load** (the sections, song files, the full backup), **Settings** (three tabs: **MIDI**, **Master**, **About**), **Theme** (your own screen colours).
- **Backup** (Save & load page): **Save a backup** writes everything on the FM-1 to one file (BoopBox-backup-DATE.json). The file holds the music that you are working on, the sections A–D, the 32 user presets and the FM6 bank. It also holds the samples USR1–USR4 (with your drum kits) and the settings (colours, calibration, the song order, the lights, SYNC, MIDI OUT). **Restore from a file** puts it all back and replaces what is on the FM-1. The editor refuses a damaged file before it writes anything. It does the same check on each object as a load does. It writes each object as a save writes it, so a cut-off restore never leaves half an object. Before you restore, stop the song (PLAY).

[web/EDITOR_PROTOCOL.md](web/EDITOR_PROTOCOL.md) describes the protocol. The editor writes presets and the FM6 bank to flash only while the song is stopped, as the FM-1 does.

## Sound design pages

The full Felucca engine is underneath ([GUIDE.md](GUIDE.md#16-every-page-knob-by-knob) gives all of it). It has thirteen synthesis engines (analog, 4-op FM, 6-op FM with DX7 patches, phase distortion, lo-fi chip, sampler, formant voice, three-oscillator, tonewheel organ, granular, physical models, noise, OBERVAVE). It has envelopes (with a pitch punch for the 808s), LFO, arpeggiator, scales and chords, and glide and voice modes. It has per-track drive and an INSERT effect (2.6: SOFT, HARD, FOLD, FUZZ, CRUSH, PHASR, FLANG, CHOR). It has a slicer and HP / LP filter, and the filter of ANALOG as LP, BP or HP (2.6). It has a tempo-synced envelope (ENV SYNC) and LFO (LFO 2: SYNC, TRIG, POL) (2.6).

It has chorus / delay / reverb sends: a stereo chorus, a tempo delay (1/4 to 1/32, triplets, dotted 1/8 and 1/16) and a stereo reverb. The reverb is a feedback delay network: it is dense, with no metallic ring. It also has 32 user presets and 4 song sections.

## MIDI keyboards

BoopBox takes MIDI from two places at once:

- **The MIDI IN jack** (3.5 mm TRS, on the FM-1): a keyboard or a pad controller with a MIDI output, through a TRS-to-DIN MIDI adapter. If nothing plays, try the other type of adapter (type A / type B).
- **USB**, from a computer or a phone (a DAW, a MIDI routing app) or a USB MIDI host box. A USB keyboard connected directly to the FM-1 works with HOME menu → **KEYS** → **USB HOST** = ON and a **powered hub** (the FM-1 does not supply power to it). See [the guide](GUIDE.md#usb-keyboards-usb-host). While USB HOST is on, there is no editor, no USB audio and no MIDI to a computer. At each start, USB HOST is OFF again.

| MIDI channel | Plays |
| --- | --- |
| 1, 2, 3 | synth tracks 1, 2, 3 (MIDI → CH1–CH3 set any channel for each) |
| 10 | the drum track (the nearest of its 16 sounds. MIDI → CH4 changes the channel) |
| channels of tracks 5–8 | tracks 5–8 (MIDI 2 → CH5–CH8, OFF by default) |
| the others | the selected track: set your keyboard to channel 4 and it follows ALGORITHM (MIDI 3 → OTHER = OFF ignores them) |

**The MIDI pages.** Hold **HOME** for the menu. Turn SELECT to **SEQ**. Put the cursor on **MIDI SETTINGS** and press **OCT+**. **MIDI** sets the channel of tracks 1–4 (CH4 is the drums). **MIDI 2** sets the channel of tracks 5–8 (OFF or 1–16, in and out). Two tracks never share one channel.

**MIDI 3** has **IN**, **OTHER**, **OUT** and **BEND**. With **OTHER** = SEL, the channels that no track has play the selected track. With OFF, BoopBox ignores them. **MIDI 4** has **FX CH** (the punch-in effects over MIDI), **DR MAP** (GM or 1-16 for the drums), **REMOTE** (the buttons over MIDI) and **CLOCK** (OUT: BoopBox sends the clock). **SYSTEM** has **SYNC** and the CPU load.

These are settings of the FM-1, and they stay through power-off. All the details are in [the guide](GUIDE.md#21-midi).

If your sequencer uses the other channels for other gear, set MIDI 3 → **IN = CH 1 … CH 16** (2.6). BoopBox then answers only that one channel, on the selected track, and ignores the other channels.

**MIDI clock in:** set SYSTEM → **SYNC** = **USB** or **TRS** (INT: BoopBox's own tempo). START plays from the top. CONTINUE continues from where it stopped. STOP stops. The tempo (BPM) follows the master, and the steps follow its 24 pulses a beat. Thus BoopBox cannot drift away from the master.

If the clock stops for half a second, PLAY on the FM-1 plays at its own tempo again. SYNC is a setting of the FM-1: it stays when you load a project.

**MIDI out:** what you play on the keys always goes out on USB MIDI (each track on its channel). MIDI 3 → **OUT** = **SEQ** also sends what the sequencer, the arp and the rolls play. Every note gets its end, and STOP ends all notes that are still on. BoopBox never sends back notes that came in from a computer or the jack (no MIDI loop).

If you set a DAW track to record the MIDI of the FM-1, you get the pattern as notes. You can also let BoopBox control another synth. MIDI 4 → **CLOCK** = OUT makes BoopBox the clock master on USB.

**MIDI CCs (2.5, the standard map of Felucca 1.1.5):** the knobs of a MIDI controller set the sound of the track that the channel plays (as the notes do). The values 0–127 cover the range of the parameter, as a knob does. BoopBox ignores other CCs (mod wheel…). **Sustain** (CC 64) and **pitch bend** work from 2.6. The pedal holds the notes that you let go until the pedal is up (recorded as heard). The bend range is MIDI 3 → BEND (1–12 semitones, default 2).

| CC | Sets |
| --- | --- |
| 5 | GLIDE |
| 7 | LEVEL (on the drum channel: GLO → DRUMS → LVL) |
| 10 | PAN |
| 71 | the resonance of the engine (RES or Q: ANALOG, TRIO, VOICE, NOISE. The others ignore it) |
| 72 · 73 · 75 | release · attack · decay |
| 74 | the cutoff or brightness of the engine (ANALOG / SAMPLE CUT, TRIO CUT, PHASE DCW, LOFI / GRAIN TONE, FM6 MLVL, PHYS BRIT, NOISE FREQ). DIGITAL, VOICE, WHEEL and the drums: the FILTER of the track (64 off) |
| 11 | expression: a volume pedal over the LEVEL of the track |
| 91 · 93 · 94 | the reverb, chorus and delay sends (on the drum channel, 91 and 94 are GLO → DRUMS → REV and DLY) |

**MIDI LEARN (2.6, after Felucca 1.5):** put any knob of your controller onto any parameter of a track. Press **GLO + F#3** (the top line shows *LEARN*). Turn the knob of BoopBox that you want (*T1 CUT: SEND A CC*). Move the knob of the controller (*CC 21 = T1 CUT*). If you want, do this for more knobs. To finish, press **GLO + F#3** again.

A learned CC sets that parameter of the track on any channel. It no longer does what the map above gave it. You can learn up to 16 CCs. Bank select, mod wheel, data entry, expression, sustain and the channel-mode CCs are never learned. The learned CCs stay through power-off and projects, and they are in the backups of the web editor. HOME menu → SYSTEM → **MIDI LEARN CLEAR** (OCT+) deletes them all.

**Clock only:** MIDI 3 → **IN** = **CLOCK** makes BoopBox take only the clock and START / CONTINUE / STOP from MIDI. BoopBox then ignores every incoming note (and CC). This is for a DAW or a sequencer that sends notes to other gear on the same cable. **NOTES** (the default): notes and clock, as before. A note-off still gets through, so no note that is held when you switch stays on. This is a setting of the FM-1, as SYNC is.

**NRPN (1.8):** NRPN sets every parameter of a track, with 14 bits. Send CC 99 = 0, CC 98 with the number of the parameter, then CC 6 and CC 38 ([the map](docs/NRPN.md)).

BoopBox does not support Bluetooth MIDI. Like Felucca, BoopBox never switches the radio on.

## USB audio: record on a computer

On USB, the FM-1 is also an audio input, named **BoopBox**. It works at 44.1 or 48 kHz (2.5: the host selects the rate, so phones and apps that only take 48 kHz also work). It is 16-bit stereo and class compliant, so you do not need a driver. In your DAW or in Audacity, choose that input and record. You get the master output, exactly what the headphones play (after DUST, DUCK and FILT). If the click and the count-in are on, you also get them.

**Its level: HOME menu → AUDIO → USB AUDIO.**

- **MASTER** (default): the recording follows the MASTER knob, as the headphones do. Keep MASTER well up while you record.
- **FULL**: a fixed level, as with MASTER all the way up, whatever the position of the knob. The output limiter prevents clipping. MASTER then only sets the headphones. FULL is the right choice for an audio interface or a computer input with no level control of its own.

USB AUDIO is a setting of the FM-1: it stays as you set it. **USB RATE** (AUDIO, KNOB 3) gives AUTO, 44.1 KHZ or 48 KHZ, from the next start. If a phone records the FM-1 with distortion, try 44.1 KHZ. MIDI, the web editor and the installer continue to work on the same cable while the computer records.

- The first time, the computer sees the FM-1 as a slightly different device (MIDI + audio) and installs it again. The MIDI port keeps its name.
- The audio input comes from Felucca 1.0 (Leo Kuroshita): the same code, adapted to BoopBox.

## The visualiser

On the TRACKS screen, tap **HOME**. The whole screen becomes a visualiser of what BoopBox plays, in six scenes at sunset and in neon. **SELECT** steps through the scenes, and the name shows for a second. BoopBox keeps the last scene chosen with the settings. **HOME** again, or any page button, closes the visualiser.

The keys, PLAY, REC and the layers work as usual (a held layer shows its screen, then the visualiser comes back). During this time, KNOB 1–4 do nothing, and GLO + SELECT sets the tempo.

| # | Style | What it shows |
| --- | --- | --- |
| 1 | **PALMS** | the wave of the mix, sample for sample, as the front wave of the sea at sunset. The reflection of the sun shimmers with the mix |
| 2 | **NIGHT DRIVE** | a car on the road at night: the buildings of the city are the spectrum, the road runs with the beat, the lights of the car flare on every kick. When stopped, the car slows down and parks |
| 3 | **HORIZON** | the spectrum as a neon range (32 bands, caps that fall) over a grid that runs down one line a beat. On each beat, tiles of the floor light up in the colours of the tracks that play |
| 4 | **FLYOVER** | the spectrum over time as a terrain, bass in the middle: the newest in front, the older behind, coloured by height. While the song plays, the ground always moves. After STOP, it moves on until the last peak is gone |
| 5 | **DENSE CITY** | the eight tracks and the mix as towers of 24 floors, lit to their level (yellow, then red at the top), with the peak floor held white, as VU meters. Searchlights sweep with the beat |
| 6 | **KEY CITY** | the skyline as two octaves of keys: a note lights the tower of its key in the colour of its track (a chord: all its keys · a note outside the two octaves: the same note in them). The drum tracks light the street lights |

The visualiser sees the mix as if **MASTER** is all the way up. Thus the picture does not follow the volume knob. With MASTER turned down, even to 0, it moves as at full volume. It only reads what the audio already gives to the screen (that mix, the levels and notes of the tracks, the clock). Thus it takes nothing from the sound.

## Lights

Hold **HOME** for the menu. It has six sections: **SCREEN** (COLOR, ZOOM, KNOB ACCEL), **LIGHTS** (LIGHTS, KEYS, NOTES), **AUDIO** (SPEAKER LOWCUT, USB AUDIO, USB RATE, FILTER RESO), **KEYS** (VELOCITY, AFTERTOUCH, VEL LEARN, USB HOST), **SEQ** (STEP ADVANCE, DRUM PREVIEW, REC KNOBS, MIDI SETTINGS) and **SYSTEM** (2ND CORE, HARDWARE CALIBRATION, MIDI LEARN CLEAR, ABOUT). **SELECT** goes from one section to the next. The knobs set the rows of the section (each row shows the colour of its knob). PRESETS moves the cursor. OCT+ steps the setting at the cursor round, or opens it, and OCT− closes it.

BoopBox saves these settings with the settings of the FM-1, not with a project. If you load a section or use NEW, they do not change. Every setting is in [the guide](GUIDE.md#20-the-home-menu-and-the-lights).

**Key velocity and aftertouch (1.8, after JIANT FM and Velo):** HOME menu → **KEYS**. **VELOCITY** SOFT / NORMAL / HARD reads how hard you press the keys F3..C5. Synths play and record the velocity, and drums use it to select ghost to hard. **AFTERTOUCH** opens the filter or adds vibrato while you keep the key pressed. **VEL LEARN** lets each key learn your touch. Both are OFF by default ([details](GUIDE.md#key-velocity-and-aftertouch-18)).

- **LIGHTS** — OFF, LOW, MID, HIGH: every button glows at that level, so you can read its label in the dark. On a black FM-1, you cannot read the labels without light. What is on (the page, PLAY, REC, an octave) stays at full light and still blinks as before.
- **KEYS** — OFF, C KEYS, WHITE KEYS, ALL KEYS: the Cs, every white key, or every key (2.4) also glow at the LIGHTS level. If LIGHTS is off, KEYS sets LIGHTS to LOW. Played keys and the layer landmarks keep their own light.
- **NOTES** — ON: on the selected synth track, the notes that sound light their keys, live or from the sequencer (the drum track always does this). From 2.4, a note lights its key for at least a tenth of a second, as a drum hit does. Thus the short notes of the sequencer also show. By @renebohne. It works on every page and in every layer. Where the keys play or erase notes (EDIT, ARP, SAVE, SEL), the notes are lit. Under them, the scale glows dimly in SEL, and the sounds of the pattern glow dimly in EDIT on the drum track. Where the keys are tiles (FX effects, SEQ steps, GLO mute / solo), the notes glow dimly and the tiles keep their full light.

The glow is a short pulse on every scan of the panel (about 900 times a second), so there is no flicker. LOW, MID and HIGH are 0.5, 1 and 2 µs a scan. The landmarks (keys 1, 5, 9, 13 while you hold a layer) and the notes under the tiles glow at 4 µs. A lit LED is about 95 µs.

## Specifications

| | |
| --- | --- |
| Tracks | 8: six synths (20 voices shared) and two drum machines (16 sounds each, 6 voices) by default. Any track can be either |
| Sounds | 223 presets on 13 engines (browsed by engine or kind, level-matched, with the 70 programs of OBERVAVE among them), 6-operator FM with DX7 SysEx import and a 27-patch bank, 8 sampled sets (CC0), 4 slots for your own samples (USR1–USR4) |
| Sequencer | 64 steps per track, own length and division each (1/32 to two bars) · chords with a level and ratchet per note · drums with a level and ratchet per sound · ties, slide · per-step nudge (±½ step in 1/64), parameter locks (32 per track, any sound parameter, with SLIDE) · eight patterns a track, chains with repeats, scenes, step components, beats from the keys, a song key and chord progression and fill conditions (fill only / no fill) · swing 0 (straight) to 100 (MPC 75 %) · one sample-accurate clock for steps, arp, rolls, slicer and song (no drift) |
| Performance | layers (hold a button: keys and knobs change function): punch-in FX, erase, note repeat, step entry, key / chords, mute / solo / fill / tap tempo · live sections on the bar and a quick chain of up to 8 |
| Drum kits | 37 (5 sampled, 32 synthesised, 16 sounds each), plus your own: USR1–USR4 and USR3+4 (about 15 s) |
| Effects | 27 punch-in effects (DJ kills, rewind, freeze…) · master DUST, DUCK, DJ filter · per track drive, slicer, a one-knob HP / LP filter, sends to a stereo chorus, a tempo delay (dotted 1/8 and 1/16 too) and a stereo reverb · master limiter |
| Recording | live, quantised as heard (latency-compensated), overdub · records at once while playing · free take sets loop length and tempo, or the tempo set, from the first note or a one-bar count-in |
| Memory | undo / redo, 4 song sections, 32 user presets, 27 FM6 patches, autosave of the working project, song of 4 sections × 16 steps × 1–64 bars |
| Audio | 44.1 kHz, fixed-point DSP · USB audio input (the master output, 16-bit stereo at 44.1 or 48 kHz, class compliant) |
| MIDI | USB class-compliant in / out · TRS MIDI IN (3.5 mm jack) · USB HOST for a USB-MIDI keyboard · each track its own channel (1–3 the synths and 10 the drums by default, the others the selected track) · MIDI clock in (USB or TRS) and out · the sequencer to MIDI out · CCs, NRPN, MIDI LEARN, Program Change |
| Update | over USB from the browser (package SHA-256 and CRC checked) |

## Rescue, going back, credits

- **USB rescue:** hold **OCT−** alone while you switch on the FM-1 (*BoopBox USB RESCUE*). Then install again.
- **Interrupted install:** the FM-1 stays in update mode. Press Install again, and the install finishes. The FM-1 refuses a damaged package and continues to wait for a good one.
- **Back to the official firmware:** use M-VAVE's own updater, **M-UPGRADE** (m-vave.com → Downloads → PC Software), with the official FM-1 firmware (**V16**, `FM-1.fwsc`). Before you start, close every other app that uses MIDI. Also save a backup with the editor before you go. To come back to BoopBox, install it again and restore your backup ([the guide](GUIDE.md#going-back-to-the-official-firmware)).
- **Credits:** BoopBox is based on SLOOP by isod89. SLOOP is based on Felucca by Leo Kuroshita (@kurogedelic), Hügelton Instruments. [CREDITS.md](CREDITS.md) gives the names of everyone who made BoopBox possible.
- **Licence:** GPL-3.0, no warranty. M-VAVE and FM-1 are trademarks of their owners. BoopBox is not affiliated with M-VAVE, Elektron or Akai. Drum kit names describe styles. They do not refer to any product.
