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

**Not yet tested on an FM-1:** 1.2.0 is tested in the host simulator only. Install it at your own risk, keep a
backup, and please [report](../../issues) what you find.

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
