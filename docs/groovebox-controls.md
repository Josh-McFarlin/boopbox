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
the last sound of a drum step) removes its components too.

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
