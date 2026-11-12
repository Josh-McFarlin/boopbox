# BoopBox groovebox: controls

This page lists the controls of the groovebox upgrade: eight tracks, step components, parameter locks, patterns,
harmony and the performance effects. It is correct for BoopBox 1.9.3.

All the controls of SLOOP 2.8.3 in `GUIDE.md` operate as `GUIDE.md` tells. When a control is different in BoopBox,
this page tells you. The button names are the panel labels of the FM-1 (`GUIDE.md`, "The panel").

The words on this page have these meanings:

| Word | Meaning |
| --- | --- |
| **push** | push a button and release it |
| **hold** | keep a button or key down |
| **turn** | turn a knob (KNOB 1–4, PRESETS, ALGORITHM, SELECT) |
| **page** | what a button shows on the display. The TRACKS screen, the CHORDS screen and the SONG screen are pages too |
| **display** | the LCD of the FM-1 |
| *TEXT* | text that the display shows |

## What this build changes to fit the flash

The flash of the FM-1 is full. Thus this build differs from SLOOP 2.8.3 in three items (`docs/groovebox-performance.md`):

- **The visualizer has six new styles.** They replace the twelve styles of SLOOP. To open the visualizer, push
  **HOME** on the TRACKS screen. To change the style, turn **SELECT**. The styles are PALMS, NIGHT DRIVE, HORIZON,
  FLYOVER, DENSE CITY and KEY CITY.
- **The boot logo is text, not a bitmap.** The boot page shows "BOOPBOX". The letters BOOP have the colors of tracks
  1–4.
- **The BASS sample set has no top recording.** This set of the SAMPLE engine (UP BASS, DEEP BASS) has no C# recording
  (note 73). Notes 70 and up play from the F# recording (note 66), so they sound a little different. All notes below
  70 sound as before.

## Eight tracks

| Control | Function |
| --- | --- |
| **ALGORITHM** | Selects the track, 1 to 8, on all pages. The header shows the track name for a short time. On some pages, ALGORITHM has a different function (see the next table) |
| **TRACKS screen** (HOME) | Shows the bank of four tracks that holds the selected track: *tracks 1-4* or *tracks 5-8*. To see the second bank, turn ALGORITHM past track 4 |
| **TRACKS screen**, KNOB 1–4 | **TRACK**, **LEVEL**, **LEN** and **PAN** of the selected track |
| **GLO layer** (mute, solo, levels) | Operates on the bank that the display shows. Keys 1–4 are tracks 1–4 or tracks 5–8 |
| **MIDI 2** page | **CH5**, **CH6**, **CH7**, **CH8**: the MIDI channel of tracks 5–8 (OFF, 1–16), for MIDI in and MIDI out. The **MIDI** page has CH1–CH3 and CH4 (the drum channel) |
| **GLO > DRUMS** | **LVL**, **REV** and **DLY** of the selected drum track. On a synth track, these knobs set the first drum track |

On these pages, ALGORITHM does not select the track:

| Page | ALGORITHM |
| --- | --- |
| The sound browser (1.9.3) | Moves through the sounds of the engine, as KNOB 3 does. The track stays the same |
| The SEQ layer, with a step key held | Selects the lock parameter (see [Parameter locks](#parameter-locks)) |
| The SONG screen | Sets the start of the loop region (see [Song: the loop region](#song-the-loop-region)) |

### The tracks and their colors

Tracks 5–8 have a shade of the colors of tracks 1–4. On a dark theme the shade is lighter. On a light theme the shade
is darker. Thus each track has its own color.

On the TRACKS screen, the section letter (A–D) is on the row of the beat lights, to the right of the four lights
(1.9.3). It does not cover *LOOP*, *SONG* or the bar.beat counter.

### LEVEL of a synth track (1.9.2)

The LEVEL of a synth track shows 0–127, as the LEVEL of a drum track and MIDI CC 7 do. The value 112 is unity (0 dB).
Each step is 1/2 dB, and 127 is +7.5 dB. The page of the track, the dials of HOME, the DRUMS page, the GLO faders,
the trainer and the web editor all show this value.

### The sound browser (1.9.3)

| Control | Function |
| --- | --- |
| **PRESETS** | Moves through the engines, as KNOB 2 does |
| **ALGORITHM** | Moves through the sounds of the engine, as KNOB 3 does |
| **SAVE** light | Breathes, up to full brightness. To keep the sound, push SAVE |
| **HOME** light | Is on at half brightness. To put the old sound back, push HOME |

### Change a synth track to a drum track

To change the selected track to a drum track or to a synth track, use **SAVE > TOOLS > KIND** (KNOB 3).

1. Turn KNOB 3 one step. The display shows *TURN AGAIN: KIND*.
2. Turn KNOB 3 one more step in 1.5 s. The display shows *NOW A DRUM TRACK* or *NOW A SYNTH TRACK*.

KIND is a GO knob, the same as CLRSQ and NEW. The change clears the pattern of the track, because a synth step and a
drum step hold different data. Undo cannot bring back this pattern. The notes of the track stop.

The track gets the default kit or sound of its track number. Its PAN, MUTE, FILTER, LEN, DIV and SWING stay the same.
The change also operates while the sequencer plays. A track can become a synth track with a big engine only if a big
engine is free. If no big engine is free, the display shows *ENGINE BUSY: NO CHANGE*.

The sound browser can also change the kind of the track. To do this, select a kit on a synth track, or a synth sound
on a drum track. If the track has a pattern, turn the knob again. The display shows *AGAIN: DRUMS, PAT CLR* or
*AGAIN: SYNTH, PAT CLR* first.

### The default project

In the default project, tracks 1–3 and 5–7 are synth tracks. Tracks 4 and 8 are drum tracks. Each synth track has its
own engine and preset. Each drum track has its own kit, sounds, mix and mutes.

BoopBox uses one project format with eight tracks. A four-track project of SLOOP does not open in BoopBox.

### Limits

| Item | Limit |
| --- | --- |
| Synth voices | The synth tracks share **20 voices**. One track plays a maximum of **8**. BoopBox Trainer keeps 8 voices in total |
| Drum voices | The drum tracks share one set of drum voices |
| Big engines | A maximum of **three tracks** play GRAIN, WHEEL (the drawbar organ), FM6, PHYS or OBERVAVE at the same time |
| SLICER STUT | A maximum of **four tracks** use the STUT mode of the SLICER at the same time |

If you select a big engine on a fourth track, BoopBox refuses it. This applies to an engine, one of its presets and a
user preset. The display shows *BIG ENGINES: 3 IN USE*, and the track keeps its sound. When one of the three tracks
changes to a different engine, the fourth track can use the big engine.

When a fifth track uses STUT, it plays the SLICER without STUT until a STUT buffer is free.

### Song mode

To start or stop song mode, stop the sequencer and push **OCT−** on the SONG screen. Song mode keeps your loop aside while the song plays. If the loop
is too big to keep, PLAY does not start the song. The display then shows *LOOP TOO BIG FOR SONG*.

## Step components

A **step component** is a rule on a step. It changes how the step plays each time the sequencer gets to it. A track
holds a maximum of **16 components**. One step can hold more than one component, each of a different type.

Components operate on synth tracks and on drum tracks. On a drum track, a component operates on the full step, with
all the sounds in it. The melodic types have no effect on a drum track.

### Edit the components

Do these steps on the **NOTES** page (synth track) or on the **DRUMS grid** (drum track):

1. Put the cursor on the step. On NOTES, this is the note that you edit. On the DRUMS grid, KNOB 2 selects the step.
2. Hold **OCT+** for 0.4 s. The sheet of the step opens at the bottom of the page.
3. Turn **KNOB 1** to the row **COMP**. This row is immediately before the last row, LOCKS.
4. Push **OCT+**. The component strip opens.

The value of the COMP row is the number of components on the step. It shows *--* when the step has no component. The
sheet opens again on the row that you used last.

| In the component strip | Function |
| --- | --- |
| **KNOB 1** | Selects an item: each component of the step, then **ADD** |
| **KNOB 2** | On a component: its first value. On ADD: the type to add |
| **KNOB 3** | On a component: its second value, if the type has one |
| **OCT+** | On ADD: adds that type with its default values (*COMP ADDED*). On a component: removes it (*COMP REMOVED*) |
| **OCT−** | Goes back to the sheet. Push OCT− again to close the sheet |

If the step already has a component of that type, OCT+ selects it and the display shows *ON THE STEP ALREADY*. If the
track has 16 components, the display shows *NO COMP LEFT*.

A step with a component shows a dot in its corner. A step with a lock or a nudge shows the same dot.

To clear the extras of a step, hold **SEQ**, hold the step key and push **OCT−**. This clears the nudge, the locks, the
fill condition and the components of the step. The display shows *STEP EXTRAS CLEARED*.

When you clear a step, its components go too. This applies to a push of a step key in the SEQ layer and to the last
sound of a drum step. MOVE and COPY in the sheet move or copy the components with the step. They also move or copy the nudge, the fill
condition and the locks.

### The types

| Type | First value (KNOB 2) | Second value (KNOB 3) | What the step does |
| --- | --- | --- | --- |
| **PULSE** | +1 … +8 | — | Plays again on the next 1–8 grid steps, with a new hit each time. Then the sequence continues |
| **HOLD** | +1 … +16 | — | Sounds through the next 1–16 grid steps, with no new hit. Then the sequence continues |
| **MULT** | x2 … x8 | — | Plays that number of hits, at equal intervals in the step (a ratchet for the full step) |
| **VEL** | 1 … 127 | 0 … 64 (shown as ~) | Plays its notes or hits at that velocity, with a random spread of ± the second value |
| **RAMP+** | 1 … 16 | /1 … /7 | Each time it plays, its notes go up the scale by the second value (in degrees). After the first value of times, it goes back to the start |
| **RAMP−** | 1 … 16 | /1 … /7 | The same as RAMP+, but down |
| **RAND** | ~1 … ~12 | — | Moves its notes by a random number of scale degrees, in the range ± the value |
| **PORTA** | 1 … 127 | — | Its notes glide from the notes before, with that GLD time, for this step only |
| **BEND** | −12 … +12 | TO / FROM | Bends the pitch of the track over the step. TO: from the note to the value, in semitones. FROM: from the value back to the note |
| **TONE** | −24 … +24 | — | Moves its notes by that number of semitones, not in the scale |
| **JUMP** | 1 … 64 | /1 … /16 | After this step, the sequence continues at the step of the first value. The second value: the jump occurs each Nth time that the step plays |
| **PARAM** | a sound parameter | 1 … 100 % | Gives the parameter a random value in ± that percentage of its range, for this step. Any parameter that a lock can use is available |
| **COND** | 1 … 8, or !1 … !8 | :1 … :8 | A:B plays on loop A of each B loops. !A:B plays on all loops except loop A of each B loops |
| **TRIG** | 1 … 99 % | — | Plays with that probability |

The melodic types (RAMP+, RAMP−, RAND) move notes in the scale of the track: SEL > ROOT and SCL. With the scale CHR,
they move notes in semitones. A note that a component moves stops as that note, so no note stays on.

PARAM and PORTA operate as locks do. On the next step and at STOP, the parameter goes back to its own value. When COND
or TRIG silences a step, the full step is silent. Its other components have no effect at that time.

PULSE, HOLD and JUMP move the playhead of the track off the grid. Thus the track plays more or fewer grid steps in each
pass. The other tracks stay on their own grid. On such a track, live recording writes to the grid step, as if the
components were not there.

### The PLAY page (SEQ, third page)

| Knob | Function |
| --- | --- |
| **KNOB 1 DIR** | The play direction: **FWD** (forward), **REV** (backward), **PEND** (forward, then backward, with the end steps once), **RAND** (a random step each time) |
| **KNOB 2 SEED** | 0 … 255: the seed of the random numbers for the components (RAND, the spread of VEL, PARAM, TRIG) and for the RAND direction |

Each time you push PLAY, the same random sequence starts again. A different seed gives a different sequence.

DIR and SEED are part of the pattern, and the pattern saves them. They are not sound parameters. Thus you cannot lock
them, and MIDI LEARN cannot learn them.

### Beats from the keys (the PLAY page of a drum track, 1.9)

On the **PLAY** page of a drum track, the white keys make beats. When you hold one or more white keys, BoopBox writes
a full pattern for the full kit. The pattern has the length of the track (TIMING > LEN).

On this page, the keys play no sound. The beat plays when the sequencer plays. When the page opens, the display shows
*HOLD KEYS: A NEW BEAT*.

To make a beat, hold one or more white keys.

| Keys that you hold | Result |
| --- | --- |
| The **lowest** key, white keys **1 … 8** | The groove: **HOUSE**, **ROCK**, **BOOM BAP**, **TRAP**, **BREAK**, **DEMBOW**, **DNB**, **ELECTRO** |
| The **lowest** key, white keys **9 … 16** | The same eight grooves, but busier. The hi-hats play in 16th notes, and the beat has more detail |
| Each **other** key | A variation of the groove, with more detail |
| **KNOB 2 SEED** | A different set of variations for the same keys. At SEED 0, one key alone gives its groove with no change |

More keys give more detail. The detail is added in this sequence:

| Detail level | Added detail |
| --- | --- |
| 1 key | More kicks and ghost snares (at SEED 1 and up) |
| 2 keys | The open hi-hat |
| 3 keys | A percussion layer on a euclidean rhythm (shaker, conga, rim, cowbell, ride or pedal hi-hat), and a fill on the last 2 steps |
| 4 keys | A second percussion layer, and a crash on step 1 |
| 5 keys | The clap with the snare (in the grooves that use the snare), and a fill on the last 4 steps |
| 6 keys or more | Hi-hat rolls |

Keys 9–16 add 2 to the detail level. TRAP always has hi-hat rolls. The fill uses the snares and the toms.

**The same keys and the same SEED always make the same beat.** The sequence in which you push the keys has no effect.
Nothing is random from one hold to the next. Thus a beat that you like comes back when you hold the same keys again.

Each key that you push during a hold makes the beat again, from all the keys that you hold. When you release the keys,
the last beat stays. The display shows the groove, for example *BEAT HOUSE* or *BEAT TRAP*.

A beat replaces the pattern that plays: its hits, levels and ratchets. The beat clears the nudges, locks, fill
conditions and components.

**One hold is one undo.** To get back the pattern from before the hold, hold **EDIT** and push **OCT−**. To get the beat
back, hold **EDIT** and push **OCT+**.

After that, you can edit the beat as any other pattern: on the DRUMS grid, in the SEQ layer, or with recording. You can
copy it to a different pattern on the PATTERNS page. In song mode, while the song plays, BoopBox refuses a new beat.
The display then shows *STOP THE SONG FIRST*.

### What the project saves (components)

The project (format 7) and the song sections save the components, the direction and the seed. If the project does not
fit, BoopBox does not save it. The display shows *PROJECT FULL: NOT SAVED*, and no data is cut.

## Parameter locks

All of "Parameter locks" in `GUIDE.md` operates as before. To make or move a lock of the lock parameter, hold **SEQ**,
hold the step key, and turn **PRESETS**. To select the lock parameter, turn **ALGORITHM** while you hold the step key.

These items are different from SLOOP 2.8.3:

- A track holds **32 locks**. One step can hold more than one lock, one for each parameter.
- A new lock from the SEQ layer starts at the **own value of the track**. This is also true while a lock on a different
  step plays.
- **A save never keeps the value of a lock as the sound.** A project, the autosave and a user preset keep the own
  values of the track. They keep the locks as locks.

### The LOCKS row of the sheet

To open the lock strip, do these steps on the **NOTES** page or on the **DRUMS grid**:

1. Hold **OCT+** for 0.4 s. The sheet of the step opens.
2. Turn **KNOB 1** to the last row, **LOCKS**. Its value is the number of locks on the step.
3. Push **OCT+**. The lock strip opens.

| In the lock strip | Function |
| --- | --- |
| **KNOB 1** | Selects an item: each lock of the step (its parameter and its value), then **ADD**. *SL* shows that a lock slides |
| **KNOB 2** | On a lock: its value. On ADD: the parameter to lock, from the parameters that ALGORITHM selects in the SEQ layer |
| **KNOB 3** | On a lock: **SLIDE**. Turn right for ON, left for OFF |
| **OCT+** | On ADD: adds a lock of that parameter at the own value of the track (*LOCK ADDED*). On a lock: removes it (*LOCK REMOVED*) |
| **OCT−** | Goes back to the sheet. Push OCT− again to close the sheet |

If the step already has a lock of that parameter, OCT+ selects it and the display shows *ON THE STEP ALREADY*. If the
track has 32 locks, the display shows *NO LOCK LEFT*.

### SLIDE

A lock with **SLIDE** does not jump to its value at the start of its step. The parameter glides from its last value to
the value of the lock. The last value is the lock of the step before, or the own value of the track. The parameter gets
to the value of the lock at the end of the step.

On the next step, the parameter continues as usual: to the lock on that step, or back to the value of the track. A
maximum of **4** slides play at the same time on a track. On a step with more, the other locks jump.

If you turn the knob of the parameter during a slide, the slide stops. The knob value stays and becomes the value of
the track.

### Record knob movements as locks

The setting **REC KNOBS** is in the menu, section **SEQ**. To open the menu, hold **HOME** for 0.7 s.

| REC KNOBS | When you turn a knob while the selected track records |
| --- | --- |
| **SOUND** (default) | The knob changes the sound, as before |
| **LOCKS** | The knob writes a lock with that value on the step that plays |

With LOCKS, the knob of a sound parameter operates on its page and on HOME. You hear the change immediately. The own
value of the track does not change, so the steps without a lock sound as before. A parameter that cannot lock changes
as usual. The FM-1 settings keep REC KNOBS.

### What the project saves (locks)

Format 7 keeps all 32 locks and their SLIDE setting.

## Patterns

Each track has **8 patterns**. A pattern holds:

- the steps of the track, with their nudges, fill conditions, locks and step components
- the direction and the seed (SEQ > PLAY)
- the **length** (TIMING > LEN)

The sound, DIV, SWG and GATE belong to the track. They are the same for all its patterns. A new pattern starts empty,
with the length that the track has.

### Three pages: PATTERNS, CHAIN, SCENES

To open these pages, push **SEQ** until they show. The sequence of the SEQ pages is NOTES, TIMING, PLAY, **PATTERNS**,
**CHAIN**, **SCENES**, SONG. On a drum track, the DRUMS grid replaces NOTES. You can also turn **SELECT** to the right
from PLAY.

To go to **SCENES** from any page and track, hold **SEQ** and push **SAVE**. To go back through CHAIN and PATTERNS,
turn SELECT to the left.

On all three pages, **the keys are pads**. They play no notes.

| Keys | Function |
| --- | --- |
| White keys **1 … 8** (F3 … F4) | Patterns 1 … 8 of the selected track: requests that pattern. On CHAIN: adds it to the chain |
| White keys **9 … 16** (G4 … G5) | Scenes 1 … 8: launches that scene on all tracks |
| Black keys | No function |

The key lights show what plays (on) and what you requested (blinking). The strip near the bottom of each page shows the
same 16 pads. **ALGORITHM** selects the track. **PLAY**, **ENV**, **LFO**, the layer buttons and **HOME** operate as on
all pages.

A pattern change that you request waits for its time. **PAT Q** (KNOB 2 on PATTERNS and SCENES) sets this time:

| PAT Q | The change occurs |
| --- | --- |
| **LOOP** | At the end of the loop of the track. Each track uses its own length |
| **1 BAR**, **2 BAR**, **4 BAR** | On the first step of the track at or after the next such bar line. Tracks that you request together change together |

When the sequencer is stopped, the change occurs immediately. While the sequencer plays, the new pattern starts from its
step 1. A note of the old pattern that still sounds stops there.

#### PATTERNS: the patterns of the track as pads

The page shows eight tiles: patterns 1 … 8 of the selected track. Each tile shows its steps, as bars over its length,
or *empty*. *now* and the color of the track show the pattern that plays. *next* and a blinking frame show the pattern
that you requested. A white line shows the cursor. The header shows the track and how full the pattern store is, in
percent.

| Control | Function |
| --- | --- |
| A white key 1 … 8 | Requests that pattern on the track. The cursor goes there |
| **KNOB 1** | The cursor: pattern 1 … 8 |
| **KNOB 2 QUANT** | PAT Q |
| **KNOB 3 COPY**, two turns | Copies the pattern that plays into the pattern at the cursor. The first turn shows *COPY 1 > 4: AGAIN* |
| **KNOB 4 CLEAR**, two turns | Clears the pattern at the cursor. The first turn shows *CLEAR 4: TURN AGAIN* |
| **OCT+** | Requests the pattern at the cursor on this track |
| **OCT−** | Requests the pattern at the cursor on **all** tracks |

#### CHAIN: a playlist

A chain plays its **slots** in sequence, then starts again. Each slot is a pattern and a number of loops (×1 … ×16).
For example, *1 ×2, 3, 2 ×3* plays pattern 1 two times, pattern 3 one time and pattern 2 three times, then starts
again.

A chain has a maximum of **16 slots**. It plays when it has two or more slots. The page shows the slots as tiles, in
sequence. A `+` tile after the last slot is the end. The slot that plays is on, with a bar for the loops that it played.

| Control | Function |
| --- | --- |
| A white key 1 … 8 | Adds that pattern in a slot after the cursor. At the end, it adds the slot last. Thus the keys 1, 3, 2 make *1 3 2* |
| **KNOB 1** | The slot, or the end |
| **KNOB 2** | The pattern of the slot |
| **KNOB 3** | The repeats of the slot, ×1 … ×16 |
| **KNOB 4 PLAY** | Turn right: the chain plays. Turn left: BoopBox keeps the chain, but it does not play |
| **OCT+** | Adds a slot with the same pattern (×1) after the cursor. At the end: a slot with the pattern that plays |
| **OCT−** | Removes the slot |

If the chain has 16 slots, the display shows *CHAIN FULL: 16 SLOTS*. A pattern that you request plays before the
chain. The chain then continues from that pattern.

#### SCENES: the parts of the song

A scene is a pattern for each track. All the patterns play together, for example as an intro, a verse or a chorus.
There are **8 scenes**, one on each row. A row shows the number of the scene, its name and the pattern of each track.
A `-` shows that the track **keeps** the pattern that it plays.

A ▶ shows the scene that plays. A blinking ▶ shows the scene that you requested. The header shows when it starts, for
example *next in 3 beats* or *at loop end*. In a new project, scene N is pattern N on all tracks, with no name.

| Control | Function |
| --- | --- |
| A white key 9 … 16 (on all three pages) | Launches that scene: each track in the scene requests its pattern |
| **KNOB 1** | The scene |
| **KNOB 2 QUANT** | PAT Q |
| **KNOB 3 NAME** | The name: INTRO, VERSE, PRE, CHORUS, BRIDGE, BREAK, BUILD, DROP, OUTRO, FILL, HOOK, SOLO, ALT, A … D, END |
| **KNOB 4** | The pattern of the selected track in the scene: 1 … 8, or **keep** |
| **OCT+** | Launches the scene |
| **OCT−**, two pushes | Stores the patterns that play now into the scene. The first push shows *OCT- AGAIN: STORE 3* |

Edit the pattern that plays as usual: on NOTES, on the DRUMS grid, in the SEQ layer or with recording. BoopBox keeps
the changes when a different pattern plays. The changes come back with the pattern.

### When the store is full

The patterns that do not play share one store of 3 KB. If the pattern that plays does not fit in the store, BoopBox
refuses the change. The display shows *PATTERNS FULL: KEPT*, and the full pattern continues to play.

If a copy does not fit, the display shows *PATTERNS FULL: NO COPY*. To make space, clear a pattern that you do not
need, or make a pattern shorter.

### What the project saves (patterns)

The project (format 7) and each song section save these items:

- the patterns
- the chains, with their repeats and PLAY setting
- the scenes
- the pattern that each track plays

If a project is larger than one store object, BoopBox does not save it. The display shows *PROJECT FULL: NOT SAVED*.

## Song: the loop region

These controls are on the **SONG** screen (see `GUIDE.md`):

| Control | Function |
| --- | --- |
| **PRESETS**, turn right | The song **loops**. The loop region **ends** on the entry at the cursor (*LOOP ON*) |
| **ALGORITHM** | The loop region **starts** on the entry at the cursor (*LOOP STARTS HERE*) |
| **PRESETS**, turn left | No loop. The song stops after its last entry (*LOOP OFF: THE SONG ENDS*) |

With a loop, the song plays from its first entry. After the last entry of the region, it goes back to the first entry
of the region. The header shows *loop a-b*, and a bar next to the entries shows the region.

These controls also operate while the song plays. The song reads them at the next entry. The song keeps its region. If the
region still fits the entries, the song page of the web editor also keeps it.

## Harmony

The song has one **key**, one **scale** and one **chord**. The chord is a degree of the scale of the key, I to VII.

The synth tracks that **follow** the harmony play their **sequenced** notes in it. These notes are the steps, their
ratchets and the notes that the step components make. The keys, the arpeggiator and MIDI in do not change. Drum tracks
never follow. BoopBox reads the pattern of a track as written in the **ROOT** of the track (SEL page).

| FOLLOW | How a note moves |
| --- | --- |
| **OFF** (default) | It does not move |
| **TRANS** | By the distance from the ROOT of the track to the key, the shorter way (a maximum of a tritone up or a fifth down). Then by the semitones of the chord root. The shape of the pattern stays the same. For example, C E G on chord V of C major becomes G B D |
| **SCALE** | By the distance from the ROOT of the track to the key. Then into the scale: a note out of the scale goes to the nearest scale note below. Then up by the degree of the chord, in scale degrees. This gives the chords of the scale. For example, C E G on ii of C major becomes D F A. In C minor, E becomes Eb |

A note keeps its start pitch until it stops. Its note-off is for that same note, so a change never leaves a note on.

### Pages (SEL)

To move through the SEL pages, push **SEL**. The sequence is SEL, SEL 2, **HARMONY**, **FOLLOW**, then the **CHORDS**
screen.

| Page | Knobs |
| --- | --- |
| **HARMONY** | **KEY**: C … B. **SCALE**: the 16 scales of the SEL page. **Q**: when a change of key, scale or chord occurs: **NOW**, the next **BEAT** or the next **BAR** (default). **PROG**: the chord progression OFF or ON |
| **FOLLOW** | **FOLLOW** of the selected track: OFF, TRANS, SCALE. On a drum track, this page is empty |

The project saves KEY, SCALE, Q and PROG. Each song section has its own values, so a section change can change the key.

### The CHORDS screen

The CHORDS screen shows these items:

- the key and the scale that you set, and Q
- the chord that plays now, in large letters, with *live*, *progression* or *no progression*
- the key and the scale that are in use now
- the chords of the progression (a roman numeral and its bars). The chord that plays is on
- the eight tracks with their FOLLOW: *-* (OFF), *T* (TRANS), *S* (SCALE)

| Control | Function |
| --- | --- |
| **The white keys** | Play the chord of the song **live**. Each key is a degree: C I, D II, E III, F IV, G V, A VI, B VII, in all octaves. The change occurs on the Q boundary |
| **The black keys** | Release the live chord. The progression continues, or chord I plays |
| **KNOB 1** | The chord of the progression that you edit (1 … count) |
| **KNOB 2** | Its degree, I … VII |
| **KNOB 3** | Its length, 1 … 16 bars |
| **KNOB 4** | The number of chords in the progression, 1 … 8 |
| **PRESETS** | The KEY |
| **SELECT** | The SCALE |
| **ALGORITHM** | The track |
| **OCT+** | Changes the FOLLOW of the track: OFF, TRANS, SCALE, then OFF again |
| **OCT−** | PROG on or off (*PROGRESSION ON*, *PROGRESSION OFF*) |
| **ENV**, **LFO**, the layer buttons, **HOME** | As on all pages |

On this page, the keys do not play notes. On a drum track, OCT+ shows *DRUM TRACK: NO FOLLOW*.

With PROG on, while the song plays, the chords of the progression play in sequence and then start again. Each chord
plays for its bars, counted from PLAY. A live chord stays on (latched) over the progression until you push a black key.
When the sequencer is stopped, the first chord of the progression is in use, or the live chord if there is one.

### What the project saves (harmony)

The project (format 7) and the song sections save the progression. Each track saves its FOLLOW.

## Performance effects

The punch-in effects of `GUIDE.md` operate as `GUIDE.md` tells. To use one, hold **FX** and push a key. The effects
include LOOP, STUTTER, REVERSE, STOP, HALF, the filters, PHONE, CRUSH, GATE, ECHO, WOBBLE, the kills, REWIND, OCT UP,
FLANGER, AUTO-PAN, FREEZE, MONO and FADE OUT.

They are the performance effects of the groovebox:

| Function | Effects |
| --- | --- |
| Beat repeat | the LOOPs, STUTTER |
| Filter sweeps | LOW, HIGH |
| Speed | STOP, HALF, REWIND |
| Gate | GATE |
| Audio transposition | OCT UP |

For live transposition of the **sequencer**, use the keys of the CHORDS screen (see [Harmony](#harmony)).

The **PERF** page is the last page of the FX family. It adds these knobs:

| Knob | Function |
| --- | --- |
| **KNOB 1 TARGET** | What the effects operate on: **MASTER** (the full mix, as before), **SEL** (the selected track), **DRUMS** (the drum tracks), **SYNTHS** (the synth tracks) |
| **KNOB 2 LATCH** | **OFF**: an effect stays on while you hold its key, as before. **ON**: FX and a key start the effect, and it stays on when you release them |
| **KNOB 3 Q** | When an effect starts: **OFF** (immediately, as before), or on the next **1/16**, **1/8**, **1/4** or **BAR** line of the transport |

With a target, only the dry sound of those tracks goes through the effect. The other tracks, the reverb, delay and
chorus returns and the TEXTURE do not go through it. If you change the target while an effect plays, the new target
waits until that effect stops.

With LATCH ON, the same key again stops the effect. A different key changes to its effect. The MIDI FX
channel (MIDI 4 > FX CH) operates the same way with its notes.

With Q, an effect always stops immediately. When the sequencer is stopped, an effect starts immediately.

The project saves TARGET, LATCH and Q. The loops play again what the target played. With a target, the loop memory
holds only those tracks. Immediately after a target change, the memory holds the earlier sound for a maximum of 0.74 s.
