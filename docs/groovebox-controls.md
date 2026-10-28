# SLOOP groovebox: controls

This page lists the controls added by the groovebox upgrade (eight tracks, step components, and what follows). Every
control of SLOOP 2.8.3 described in `GUIDE.md` still works as written there; where a control changed, this page says
so. Button names are the FM-1's panel labels (see `GUIDE.md`, "The controls").

## Eight tracks

| Control | Does |
| --- | --- |
| **ALGORITHM** | selects the track, 1 to 8 (it stopped at 4 before) |
| **TRACKS screen** (HOME) | shows the bank of four tracks the selected one is in: *tracks 1-4* or *tracks 5-8*. Turn ALGORITHM past track 4 to see the second bank. Tracks 5-8 use the colours of tracks 1-4 |
| **GLO layer** (mute, solo, levels) | acts on the bank shown: keys 1-4 are tracks 1-4 or 5-8 |
| **GLO > MIDI 4** | CH5, CH6, CH7, CH8: the MIDI channel of tracks 5-8 (OFF, 1-16), in and out, as GLO > MIDI does for tracks 1-3 and the drum channel (CH4) |
| **GLO > DRUMS** | LVL, REV and DLY of the selected drum track; on a synth track, of the first drum track |

The default project: tracks 1-3 and 5-7 are synth tracks, tracks 4 and 8 drum tracks. Each synth track has its own
engine and preset; each drum track its own kit, sounds, mix and mutes. A project saved by an older SLOOP opens on
tracks 1-4 as it was; tracks 5-8 start as at power-on.

Limits: the eight synth tracks share **8 sounding voices**; the drum tracks share one pool of drum voices. At most
**three tracks** play GRAIN, DRAWBAR, FM6 or PHYS at once (a fourth waits until one of them changes engine), and at
most **four tracks** use the SLICER's STUT mode at once (more play the SLICER without STUT).

## Step components

A **step component** is a rule on one step that changes how the step plays each time the sequencer reaches it. A
track holds up to **16 components**; one step can hold several (each of a different type). They work on synth and drum
tracks (on a drum track a component acts on the whole step, every sound in it; the melodic ones do nothing there).

### Edit them

On the **NOTES** page (synth tracks) or the **DRUMS grid** (drum tracks):

1. Put the cursor on the step (NOTES: the note under edit; DRUMS: KNOB 2's step).
2. Hold **OCT+** (0.4 s): the step's sheet opens at the bottom of the screen.
3. Turn **KNOB 1** to the last row, **COMP** (its value is the number of components on the step, *--* for none).
4. Tap **OCT+**: the component strip opens.

| In the component strip | Does |
| --- | --- |
| **KNOB 1** | picks an item: the step's components one by one, then **ADD** |
| **KNOB 2** | on a component: its first value; on ADD: the type to add |
| **KNOB 3** | on a component: its second value (when the type has one) |
| **OCT+** (tap) | on ADD: adds that type with its default values (*COMP ADDED*; *ON THE STEP ALREADY* picks the one there; *NO COMP LEFT* when the track has 16); on a component: removes it (*COMP REMOVED*) |
| **OCT−** | back to the sheet; OCT− again closes the sheet |

A step with a component shows the same corner dot as a step with a lock or a nudge. **SEQ + step + OCT−** clears the
step's nudge, locks, fill condition and components (*STEP EXTRAS CLEARED*). Clearing a step (a tap in the SEQ layer,
the last sound of a drum step) removes its components too. MOVE and COPY in the sheet take the step's components with
it, as they take its nudge, fill condition and locks.

### The types

| Type | First value (KNOB 2) | Second value (KNOB 3) | What the step does |
| --- | --- | --- | --- |
| **PULSE** | +1 … +8 | — | plays again on the next 1-8 grid steps, a new hit each time, before the sequence moves on |
| **HOLD** | +1 … +16 | — | sounds on through the next 1-16 grid steps (no new hit), then the sequence moves on |
| **MULT** | x2 … x8 | — | that many hits, evenly inside the step (a ratchet for the whole step) |
| **VEL** | 1 … 127 | ~0 … ~64 | its notes or hits at that velocity, with a random spread of ± the second value |
| **RAMP+** | 1 … 16 | /1 … /7 | each time it plays, its notes go up the scale by the second value (degrees), up to the first value times; then back to the start |
| **RAMP−** | 1 … 16 | /1 … /7 | the same, down |
| **RAND** | ~1 … ~12 | — | its notes move a random number of scale degrees, within ± the value |
| **PORTA** | 1 … 127 | — | its notes glide in from the notes before, with that GLIDE time (for this step) |
| **BEND** | −12 … +12 | TO / FROM | the track's pitch bends over the step: from the note to the value in semitones (TO), or from the value back to the note (FROM) |
| **TONE** | −24 … +24 | — | its notes move that many semitones (not in the scale) |
| **JUMP** | 1 … 64 | /1 … /16 | after it, the sequence goes on at that step; the second value: every how many times the step plays |
| **PARAM** | a sound parameter | 1 … 100 % | that parameter takes a random value within ± that share of its range, for the step (any parameter a lock can take) |
| **COND** | 1 … 8, or !1 … !8 | :1 … :8 | plays on loop A of every B (A:B); with **!** it plays on every other loop |
| **TRIG** | 1 … 99 % | — | plays with that chance |

The melodic types (RAMP+, RAMP−, RAND) move in the track's scale (SEL > ROOT and SCL; CHR: semitones). A note a
component moves ends as that note: nothing is left sounding. PARAM and PORTA work like locks: the parameter is back
at its own value on the next step and at STOP. A step silenced by COND or TRIG is silent whole, and its other
components do not act that time.

PULSE, HOLD and JUMP move the track's playhead off the grid (the track plays more or fewer grid steps per pass);
other tracks keep their own grid. On such a track, live recording still writes the grid's step (where the step would
be without them).

### The PLAY page (SEQ, third page)

| Knob | Does |
| --- | --- |
| **KNOB 1 DIR** | the play direction: **FWD**, **REV** (backwards), **PEND** (forwards then backwards, the end steps once), **RAND** (a random step each time) |
| **KNOB 2 SEED** | 0 … 255: the seed of the components' random numbers (RAND, VEL's spread, PARAM, TRIG, the RAND direction). Each PLAY starts the same random sequence again; another seed gives another one |

DIR and SEED belong to the pattern (saved with it). They are not sound parameters: they cannot be locked or learnt
over MIDI.

### Saved

Components, the direction and the seed are saved in the project (format 7) and in song sections. A project that has
any of them is never saved in the older format 6 (which cannot hold them): when it does not fit format 7, the save is
refused (*PROJECT FULL: NOT SAVED*) and nothing is cut.

## Parameter locks

Everything in `GUIDE.md` ("Parameter locks") still works: **SEQ + step + PRESETS** makes or moves a lock of the lock
parameter, **ALGORITHM** (step held) picks the parameter. What changed:

- A track holds **32 locks** (24 before). Several locks can sit on one step, one per parameter.
- A lock made from the SEQ layer starts at the **track's own value**, also while another step's lock is playing.
- **Saving never keeps a lock's value as the sound.** A project (also the autosave while playing) and a user preset
  store the track's own values; the locks are stored as locks.

### The LOCKS row of the sheet

On the **NOTES** page or the **DRUMS grid**, hold **OCT+** (the step's sheet), turn **KNOB 1** to the last row,
**LOCKS** (its value: the number of locks on the step), and tap **OCT+**:

| In the lock strip | Does |
| --- | --- |
| **KNOB 1** | picks an item: the step's locks one by one (the parameter and its value; *SL* when it slides), then **ADD** |
| **KNOB 2** | on a lock: its value; on ADD: the parameter to lock (the lockable ones, as ALGORITHM picks them in the SEQ layer) |
| **KNOB 3** | on a lock: **SLIDE** (right ON, left OFF) |
| **OCT+** (tap) | on ADD: a lock of that parameter at the track's own value (*LOCK ADDED*; *ON THE STEP ALREADY* picks it; *NO LOCK LEFT* at 32); on a lock: removes it (*LOCK REMOVED*) |
| **OCT−** | back to the sheet; OCT− again closes it |

### SLIDE

A lock with **SLIDE** does not jump to its value at the start of its step: the parameter glides from the value it had
(the step before's lock, or the track's own value) to the lock's value, reaching it at the end of the step. On the
next step the parameter goes on as usual (its lock there, or back to the track's value). Up to **4** slides play at
once on a track (on a step with more, the others jump). Turning the parameter's knob during a slide stops it: the
knob's value stays and becomes the track's value.

### Recording knob moves as locks

**MENU > SEQ > REC KNOBS**: **SOUND** (the default, as before: a knob turned while recording changes the sound) or
**LOCKS**: while the selected track records (REC, playing), turning a sound parameter's knob (on its page or on HOME)
writes a lock of that value on the step playing. You hear it at once; the track's own value does not change, so on
the steps without a lock the sound stays as it was. Parameters that cannot be locked change as usual. The setting is
kept with the FM-1's settings.

### Saved

Format 7 keeps all 32 locks and their SLIDE. A project whose locks format 6 could not hold whole (more than 24 on a
track, or a SLIDE) is never saved as format 6.

## Patterns

Each track has **8 patterns**. A pattern holds the track's steps with their nudges, fill conditions, locks and step
components, its direction and seed (SEQ > PLAY) and its **length** (PATTERN > LEN). The sound, DIV, SWG and GATE are
the track's, the same for all its patterns. A new pattern starts empty, with the length the track has.

### The PATTERNS screen (SEQ, after PLAY)

Tap **SEQ** until the PATTERNS screen shows (NOTES, PATTERN, PLAY, **PATTERNS**, SONG). It shows the eight tracks as
rows and their eight patterns as columns:

| Tile | Means |
| --- | --- |
| lit in the track's colour | the pattern playing |
| dim | a pattern that holds something |
| dark | an empty pattern |
| blinking white frame | the pattern asked for: it waits for its moment (PAT Q) |
| a dot under it | a pattern of the track's chain |
| white line under it | the cursor (KNOB 1) on the selected track |

| Control | Does |
| --- | --- |
| **ALGORITHM** | the track (its row number turns white) |
| **KNOB 1** | the cursor: pattern 1 … 8 |
| **OCT+** | asks for the cursor's pattern on the selected track |
| **OCT−** | asks for the cursor's pattern on **every** track |
| **KNOB 2 QUANT** | when an asked change happens (PAT Q): **LOOP** (at the end of the track's own loop, each track on its own length), **1 BAR**, **2 BAR**, **4 BAR** (on the first step of the track at or after the next such bar line: tracks asked together change together) |
| **KNOB 3 CHAIN** | the selected track's chain: **OFF**, or the cursor's pattern and the ones after it (2 … 8 patterns); each plays one loop, then the next, round |
| **KNOB 4** right, twice | **COPY** the pattern playing into the cursor's pattern (*AGAIN: COPY* first) |
| **KNOB 4** left, twice | **CLEAR** the cursor's pattern (*AGAIN: CLEAR* first) |
| **PLAY**, the keys | as everywhere; **ENV**, **LFO** and the layer buttons open their pages; **HOME** goes home |

Stopped, a change is made at once. Playing, it waits for its moment, then the new pattern starts from its step 1 (a
note of the old pattern still sounding ends there). An asked change goes before the chain; the chain then goes on from
the pattern asked for. Edit the pattern playing as usual (NOTES, the DRUMS grid, the SEQ layer, recording): its
changes are kept when another pattern plays, and come back with it. The header shows how full the pattern store is.

### When the store is full

The patterns that are not playing share one store of 3 KB (a typical pattern takes 30 to 150 bytes; a 64-step pattern
of 4-note chords about 700). When the pattern playing does not fit in it, a change is refused: the screen says
*PATTERNS FULL: NOT CHANGED* and the pattern keeps playing, whole. COPY says *PATTERNS FULL: NOT COPIED*. Clear a
pattern you do not need, or shorten one.

### Saved

The patterns, the chains and the pattern each track plays are saved in the project (format 7) and in each song
section. A project with more than one pattern on a track is never saved in format 6. A project larger than a store
object is refused whole (*PROJECT FULL: NOT SAVED*).

## Song: the loop region

On the **SONG** screen (see `GUIDE.md`):

| Control | Does |
| --- | --- |
| **PRESETS** right | the song **loops**, the loop region **ending** on the entry under the cursor |
| **ALGORITHM** | the loop region **starts** on the entry under the cursor |
| **PRESETS** left | no loop: the song ends after its last entry |

With a loop on, the song plays from its first entry and, after the region's last entry, goes back to the region's first
(the header shows *loop a-b*; a bar beside the entries marks the region). This works while the song plays (it is read
at the next entry). The region is kept with the song. (The web editor's song page saves the song without a region.)

## Harmony

The song has one **key**, one **scale** and one **chord** (a degree of the key's scale, I to VII). The synth tracks
that **follow** it play their **sequenced** notes in it: the steps, their ratchets and the notes the step components
make. The keys, the arp and MIDI in play as they are; drum tracks never follow. A track's pattern is taken as written
in the track's own **ROOT** (SEL page).

| FOLLOW | A note moves |
| --- | --- |
| **OFF** (default) | not at all |
| **TRANS** | by the key's distance from the track's ROOT (the nearer way: up to a tritone up, a fifth down), then by the chord root's semitones: the pattern's shape is kept exactly (C E G on chord V of C major: G B D) |
| **SCALE** | by the key's distance from the track's ROOT, into the scale (a note outside it goes to the nearest scale tone below), then up the chord's number of scale degrees: the chords of the scale itself (C E G on ii of C major: D F A; in C minor, E becomes Eb) |

A note keeps the pitch it started with until it ends; its note-off is that note's, so a change never leaves a note on.

### Pages (SEL)

Tap **SEL** to walk its pages: SEL, SEL 2, **HARMONY**, **FOLLOW**, then the **CHORDS** screen.

| Page | Knobs |
| --- | --- |
| **HARMONY** | **KEY** C … B · **SCALE** (the 16 scales of the SEL page) · **Q** when a change of key, scale or chord takes hold: **NOW**, the next **BEAT**, the next **BAR** (default) · **PROG** the chord progression OFF / ON |
| **FOLLOW** | **FOLLOW** of the selected track: OFF, TRANS, SCALE (a drum track shows nothing here) |

KEY, SCALE, Q and PROG are saved with the project; each song section carries its own (a section change can change
the key).

### The CHORDS screen

It shows the key and scale asked for and Q (top right), the chord playing now in large type (*LIVE* when played
live, *progression* or *no progression*), the key and scale in force, the progression's chords (a roman numeral and
its bars; the one playing lit) and the eight tracks with their FOLLOW (*-* off, *T* trans, *S* scale).

| Control | Does |
| --- | --- |
| **the keys** | play the song's chord **live**: a white key its degree (C I, D II, E III, F IV, G V, A VI, B VII, in every octave), a black key lets the live chord go (back to the progression, or I). On Q's boundary; no note sounds from the keys on this screen |
| **KNOB 1** | the progression's chord under edit (1 … count) |
| **KNOB 2** | its degree, I … VII |
| **KNOB 3** | its length, 1 … 16 bars |
| **KNOB 4** | how many chords the progression has, 1 … 8 |
| **PRESETS** | the KEY |
| **SELECT** | the SCALE |
| **ALGORITHM** | the track; **OCT+** steps its FOLLOW round (OFF, TRANS, SCALE) |
| **OCT−** | PROG on / off (*PROGRESSION ON*) |
| **ENV**, **LFO**, the layer buttons, **HOME** | as everywhere |

With PROG on, while the song plays, the progression's chords follow one another round, each for its bars, counted
from PLAY. A live chord stays (latched) over the progression until a black key lets it go. Stopped, the first chord of
the progression (or the live one) is in force.

### Saved

The progression is saved in the project (format 7) and in song sections; FOLLOW with each track. A project with a
harmony (a follow, a progression, a key or scale other than C major, Q other than BAR, PROG on) is never saved in
format 6, which has no room for it.

## Performance effects

The punch-in effects of `GUIDE.md` (hold **FX**, press a key: LOOP, STUTTER, REVERSE, STOP, HALF, the filters, PHONE,
CRUSH, GATE, ECHO, WOBBLE, the kills, REWIND, OCT UP, FLANGER, AUTO-PAN, FREEZE, MONO, FADE OUT …) are the
performance effects: beat repeat (the LOOPs, STUTTER), filter sweeps (LOW, HIGH), speed (STOP, HALF, REWIND), gating
(GATE), audio transposition (OCT UP). Live **sequencer** transposition is the harmony's: the CHORDS screen's keys (see
Harmony). Everything there still works as written; the **PERF** page (FX family, the last page) adds:

| Knob | Does |
| --- | --- |
| **KNOB 1 TARGET** | what the effects act on: **MASTER** (the whole mix, as before), **SEL** (the selected track), **DRUMS** (the drum tracks), **SYNTHS** (the synth tracks). With a target, only those tracks' dry sound goes through the effect; the other tracks, the reverb, delay and chorus returns and the TEXTURE pass it by. A target taken while an effect plays waits until that effect ends |
| **KNOB 2 LATCH** | **OFF** (as before: an effect lasts while its key is held) or **ON**: FX + a key turns its effect on and it stays when you let go (also FX); the same key again turns it off; another key changes to its effect. The MIDI FX channel (GLO > MIDI 3 > FX CH) does the same with its notes |
| **KNOB 3 Q** | when an effect starts: **OFF** (at once, as before) or on the next **1/16**, **1/8**, **1/4** or **BAR** line of the playing transport. Its end is always at once; stopped, it starts at once |

TARGET, LATCH and Q are saved with the project (not in format 6). The loops replay what the target played (with a
target the loops' memory holds only those tracks; just after the target changed, it still holds what came before,
for up to 0.74 s).
