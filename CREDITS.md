# Credits

BoopBox exists because of the work of many people. This file lists them.

The licences of the code, samples and fonts are in [LICENSING.md](LICENSING.md).

## Contents

1. [The projects that BoopBox is based on](#the-projects-that-boopbox-is-based-on)
2. [Added in BoopBox](#added-in-boopbox)
3. [Inherited from SLOOP](#inherited-from-sloop)
4. [Samples, fonts and code from other projects](#samples-fonts-and-code-from-other-projects)
5. [Interface ideas](#interface-ideas)

## The projects that BoopBox is based on

- **[SLOOP](https://github.com/isod89/sloop-fm1)** by **isod89**. BoopBox 1.0.0 is SLOOP 2.8.3 with a new name. All the features and fixes of SLOOP were already in BoopBox on the first day.
- **[Felucca](https://github.com/hugelton/Felucca)** by **Leo Kuroshita** (@kurogedelic) / **Hügelton Instruments**. SLOOP is based on Felucca. Felucca gave the sound engines, the sequencer, the web editor and the installer.

## Added in BoopBox

These items came into BoopBox after the fork, from 1.0.0 onward.

| Release | What | From |
| --- | --- | --- |
| 1.7.0 | The OBERVAVE engine and its 70 programs | [OberVave](https://github.com/zvenson/obervave) by **zvenson** |
| 1.7.0 | USB HOST: a USB-MIDI keyboard plays BoopBox | [Melodee](https://github.com/keremimo/melodee) by **Kerem Kilic** (keremimo), with USB host code by **recursivefieldinstruments** |
| 1.8.0 | Key velocity and aftertouch, the NRPN map, the flash chip of newer FM-1s, and the idea of the browser emulator | [JIANT FM](https://github.com/juanjiant-bit/JIANT) by **Juan Ignacio Antonucci** (juanjiant-bit) |
| 1.8.0 | How to read the carbon key pills of the FM-1, which the key velocity uses | [Velo](https://github.com/charlesvestal/fm1-velocity) by **Charles Vestal** |

Thanks also to everyone who installs BoopBox, plays it, and reports bugs or asks for features in the [issues](../../issues).

## Inherited from SLOOP

All the items in this section were in SLOOP 2.8.3 before BoopBox started. BoopBox did not add them. They are here to keep the credits that SLOOP gave.

The version numbers, for example 2.6, are SLOOP releases. A pull request number is in the SLOOP repository, unless the text says Felucca.

### From Felucca

SLOOP took these features from Felucca releases:

| SLOOP | What | Felucca |
| --- | --- | --- |
| 2.3 | The USB audio input, the MIDI clock, the knob reading, the MIDI input, overload shedding, the LED glow, key debounce, and many fixes | 1.0 / 1.0.1 |
| 2.4 | The FM6 engine and its DX7 patch editor | 1.0 / 1.0.1 |
| 2.6 | The INSERT effects, LFO 2 (SYNC / TRIG / POL), ENV SYNC, the ANALOG filter types, note LEN and step velocity, MIDI LEARN, the live drum mutes, the latched-arp fix (#191), the 1/4D delay, and REV / ECHO THROW | 1.4 / 1.4.1 / 1.5 / 1.5.1 |
| 2.7 | The arp modes REPEAT, DNUP, UP+8, CONV, DIVG, PINKY, THUMB, WALK and CHORD, and ORD (the order in which you pressed the keys) | 1.4 / 1.5.1 |

These people asked for those features first, in the Felucca discussions and issues:

- **Wulgaren:** insert effects with dry / wet (#78), and the arp report (#191)
- **etyrnal:** the lo-fi bit effect (#177), and envelopes in note values (#175)
- **benjaminguerrer:** LFO sync (#154)
- **gospodindilly-ops:** the ANALOG filter types (#104)
- **Armstrong1980** (#178) and **oMauNaProducer** (#173): note length and step velocity
- **lostfictions** and **planist79:** MIDI LEARN (#170)

### SLOOP contributors

- **@renebohne:** the key lights for played notes (pull request #11). In 2.6, MIDI Program Change (Felucca pull request #179). In 2.7, MIDI CC 74 on the cutoff or brightness of each engine (pull request #71).
- **ChanceTheMaker** and **keremimo:** the TRS MIDI input buffer fix (Felucca Salt by ChanceTheMaker, found by keremimo) and work on the MIDI clock.
- **andrerezemini** ([sloop-lab](https://github.com/andrerezemini/sloop-lab)): in 2.7, the sound on the second core of the FM-1 and 38 KB of RAM back (pull request #111). This work starts from the dual-core start of **Charles Vestal** ([X0X](https://github.com/charlesvestal/fm1-x0x)) and **keremimo** ([Melodee](https://github.com/keremimo/melodee)).
- **juanjiant-bit** ([JIANT FM](https://github.com/juanjiant-bit/JIANT)): in 2.7, the progressive knob acceleration (KNOB ACCEL) and the LEVEL / PAN glide.
- **@ordenador** (Mario Faúndez Vidal): the local audio preview of the web editor (pull request #120). It runs the engines and the sequencer of the firmware in the browser (WebAssembly).

### SLOOP users

The users of SLOOP asked for, tested and reported most of each SLOOP update. Some examples are parameter locks, DX7 patches, dotted delays and longer steps (2.4). Others are a MIDI channel for each track, sustain and pitch bend, step entry from a MIDI keyboard, TEXTURE, and many fixes (2.6).

## Samples, fonts and code from other projects

[LICENSING.md](LICENSING.md) gives the full list, with the licence and the files of each item. In short:

- **Samples:** Versilian Studios VSCO-2 CE and VCSL, and Sonic Pi (CC0). Wurlitzer EP200 samples by Greg Sullivan (CC BY 3.0).
- **Fonts and icons:** Terminus and Terminus Bold (SIL OFL 1.1). Pixelify Sans and DM Sans (SIL OFL 1.1), on the website; the logo's wordmark is set in Pixelify Sans Bold. Fukiai by Hügelton Instruments (MIT), in the web editor.
- **Engines:** PHASE after CrispyZebra by Leo Kuroshita (GPL-3.0). VOICE after klattsch by Tony Gies (MIT). FM6 uses msfa from Dexed, by Google Inc. and Pascal Gauthier (Apache-2.0). Leo Kuroshita ported it to integer C for Felucca 1.0. PHYS uses models from DaisySP and Rings, by Electrosmith and Emilie Gillet (MIT).
- **BoopBox art:** `project/tools/gen_icon_art.py` and `project/tools/gen_logo.py` draw the parameter icons and the pixel-art logo (GPL-3.0).

## Interface ideas

Some interface ideas come from the step entry of Elektron and from the MPC of Akai (swing, note repeat, erase). BoopBox is not affiliated with Elektron or Akai.
