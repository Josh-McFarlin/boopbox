// SPDX-License-Identifier: GPL-3.0-only
// The home page: what BoopBox is and what it does, with the FM-1's own screens (project/tools/make_screens.py draws them with
// the firmware's code: project/assets/screens/fm1/), then the way to the installer, the editor and the emulator.
// Served at the site's root (make_site.py copies the page from webapp/home/ and sets its base to webapp/home/ so
// relative assets resolve correctly).
import type React from "react";
import type { ReactNode } from "react";
import SiteHeader from "../../components/SiteHeader.tsx";
import { arcadeButton, arcadeButtonSize, pixelPanel, pixelScreen } from "../../components/styles.ts";
import tracks from "../../../../project/assets/screens/fm1/tracks-1-4.png";
import punch from "../../../../project/assets/screens/fm1/layer-fx.png";
import sounds from "../../../../project/assets/screens/all/pages/save-presets.png";
import drums from "../../../../project/assets/screens/fm1/drums.png";
import chords from "../../../../project/assets/screens/fm1/chords.png";
import notes from "../../../../project/assets/screens/fm1/notes.png";
import drive from "../../../../project/assets/screens/fm1/vis-night-drive.png";
import song from "../../../../project/assets/screens/fm1/song.png";
import patterns from "../../../../project/assets/screens/fm1/patterns.png";
import mix from "../../../../project/assets/screens/fm1/layer-mix-5-8.png";
import editorShot from "../../../../project/assets/screens/editor-sound.png";

const GITHUB = "https://github.com/josh-mcfarlin/boopbox";
type Color = "blue" | "green" | "yellow" | "orange";
const C: Record<Color, string> = { blue: "#3ee6ff", green: "#c6ff3d", yellow: "#ffd23f", orange: "#ff4fd8" };   /* site.css: cyan, lime, yellow, magenta */
const TEXT: Record<Color, string> = { blue: "text-blue", green: "text-green", yellow: "text-yellow", orange: "text-orange" };

/* the hero's four screens: the tracks, the sound browser, the drums, the visualiser */
const HERO: [src: string, alt: string, color: Color][] = [
  [tracks, "The TRACKS screen: four tracks playing at 92 BPM, each with its steps and level", "orange"],
  [sounds, "The sound browser: the ANALOG engine's sounds, 808 BOOM, 808 DIRTY, 808 SLIDE, SUB BASS, by engine", "blue"],
  [drums, "The DRUMS screen: 16 sounds by 16 steps, each hit with its level", "green"],
  [drive, "The visualiser: a car driving into a neon city, moving with the music", "orange"],
];
const STATS: [big: string, label: string, color: Color][] = [
  ["8", "tracks: six synths and two drum machines", "blue"],
  ["13", "synth engines, FM6 and physical models", "green"],
  ["223", "sounds, every one level-matched", "yellow"],
  ["37", "drum kits, 808 to amapiano", "orange"],
  ["27", "punch-in effects on the keys", "blue"],
  ["64", "steps a track, with locks and fills", "green"],
];
const LAYERS: [name: string, what: string, color: Color][] = [
  ["FX · punch", "27 effects on the whole mix", "orange"],
  ["GLO · mix", "mute, solo, fill, tap tempo", "blue"],
  ["SEQ · steps", "levels, ratchets, locks, nudges", "green"],
  ["ARP · roll", "note repeat, recorded as ratchets", "yellow"],
  ["SEL · key", "the song's key, scale and chords", "blue"],
  ["EDIT · erase", "take notes out as it plays", "orange"],
  ["SAVE · song", "sections A–D, a quick chain", "green"],
];
const ENGINES = ["ANALOG", "FM", "FM6 · DX7", "PHASE", "TRIO", "WHEEL", "VOICE", "GRAIN", "LOFI", "SAMPLE", "PHYS", "NOISE", "OBERVAVE"];
const MORE: [title: string, text: string, color: Color][] = [
  ["Your own samples", "Four slots of about 7 s: up to 16 WAVs each, one per key, played by a synth track or as a drum kit.", "blue"],
  ["MIDI in, out and clock", "USB and the TRS jack; CCs from your controller, MIDI learn, the sequencer to MIDI out, clock in.", "green"],
  ["USB audio", "Record the FM-1 on a computer over the same cable, no driver.", "yellow"],
  ["USB keyboards", "Plug a USB-MIDI keyboard into the FM-1 itself and play its tracks.", "orange"],
  ["Nothing gets lost", "Autosave after 2.5 s, undo and redo, a full backup and restore from the editor.", "blue"],
  ["BoopBox Trainer", "A second firmware that teaches three songs, step by step, on the FM-1 itself.", "green"],
];
const STEPS: [n: string, title: string, text: string, color: Color][] = [
  ["1", "Connect", "Plug the FM-1 into the computer with a USB data cable, no hub.", "blue"],
  ["2", "Open the installer", "In Chrome or Edge, and allow MIDI when it asks.", "green"],
  ["3", "Press Install", "About a minute. Do not unplug the cable while it writes.", "yellow"],
];

const PRIMARY = `${arcadeButton} ${arcadeButtonSize} bg-orange`;
const SECONDARY = "inline-flex min-h-[52px] items-center border-[3px] border-blue px-7 font-pixel text-[20px] font-bold leading-none text-blue "
  + "no-underline hover:bg-blue hover:text-ink";
const KICKER = "m-0 mb-4 inline-block bg-tile px-2.5 py-1 font-pixel text-[16px] font-medium text-blue";
const H2 = "m-0 font-pixel font-bold text-fg";

interface ScreenProps {
  src: string;
  alt: string;
  caption?: string;
  color?: Color;
  className?: string;
}

function Screen({ src, alt, caption, color = "orange", className = "" }: ScreenProps) {
  return (
    <figure className={`m-0 w-full max-w-[440px] min-w-0 flex-[1_1_360px] ${className}`}>
      <img src={src} alt={alt} width="240" height="240"
        className={pixelScreen} style={{ boxShadow: `10px 10px 0 ${C[color]}` }} />
      {caption ? <figcaption className="mt-5 text-[14px] text-dim">{caption}</figcaption> : null}
    </figure>
  );
}
interface FeatureProps {
  reverse?: boolean;
  children?: ReactNode;
  media: ReactNode;
}

function Feature({ reverse, children, media }: FeatureProps) {
  return (
    <div className={`mb-24 flex flex-wrap items-center gap-x-14 gap-y-10 ${reverse ? "flex-wrap-reverse" : ""}`}>
      {reverse ? media : null}
      <div className="min-w-0 flex-[1_1_440px]">{children}</div>
      {reverse ? null : media}
    </div>
  );
}
const H3 = ({ color, lead, children }: { color: Color; lead: string; children?: ReactNode }) => (
  <h3 className="m-0 mb-3 font-pixel text-[30px] leading-[1.1] font-bold"><span className={TEXT[color]}>{lead}</span> {children}</h3>
);
const P = ({ children }: { children?: ReactNode }) => <p className="m-0 mb-4 text-body">{children}</p>;
const B = ({ children }: { children?: ReactNode }) => <b className="text-fg">{children}</b>;

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg text-[16px] leading-[1.6] text-body">
      <SiteHeader current="home" />

      <main>
        <section id="top" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-6 pt-[72px] pb-14">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className={KICKER}>▶ Free firmware for the M-VAVE FM-1</p>
            <h1 className="m-0 mb-6 font-pixel text-[46px] leading-[.98] font-bold text-balance min-[600px]:text-[68px]">Turn the FM-1 into
              a <span className="text-orange">groovebox you play&nbsp;live.</span></h1>
            <p className="m-0 mb-7 max-w-[36em] text-[20px] leading-[1.45] text-body">Eight tracks, thirteen synth engines, 37 drum kits and 27
              punch-in effects, under your hands. No factory patterns, nothing to load: everything you hear, you play. House, techno, hip-hop,
              drum &amp; bass, lo-fi, ambient: it does not pick a style for you.</p>
            <div className="mb-6 flex flex-wrap gap-4">
              <a href="../installer/" className={PRIMARY}>Install from the browser</a>
              <a href="../emu/" className={SECONDARY}>Try it first</a>
            </div>
            <p className="m-0 text-sm text-dim">Open source (GPL-3.0) · installs over USB in Chrome or Edge · go back to the official firmware any time</p>
          </div>
          <div className="grid max-w-[520px] min-w-0 flex-[1_1_420px] -rotate-2 grid-cols-2 gap-7 pr-2 pb-2">
            {HERO.map(([src, alt, c]) => (
              <img key={alt} src={src} alt={alt} width="240" height="240" className={pixelScreen} style={{ boxShadow: `8px 8px 0 ${C[c]}` }} />
            ))}
          </div>
        </section>

        <section aria-label="BoopBox in numbers" className="border-y-4 border-t-orange border-b-blue bg-tile">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 min-[700px]:grid-cols-3 min-[1000px]:grid-cols-6">
            {STATS.map(([big, label, c]) => (
              <div key={label} className="min-w-0">
                <b className={`block font-pixel text-[52px] leading-none font-bold ${TEXT[c]}`}>{big}</b>
                <span className="mt-2 block text-[14px] leading-snug text-dim">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1200px] px-6 pt-20 pb-6">
          <p className={KICKER}>Why BoopBox</p>
          <h2 className={`${H2} mb-16 max-w-[24em] text-balance text-[36px] leading-none min-[600px]:text-[48px]`}>
            The most complete firmware for the <span className="whitespace-nowrap">FM-1</span>.</h2>

          <Feature media={<Screen src={punch} caption="FX held: loops, stutter, tape stop, DJ kills, rewind, reverb freeze."
            alt="The PUNCH screen: FX held, the 27 effects laid out on the keys: loops, stutter, reverse, tape stop, kills, rewind, freeze" />}>
            <H3 color="orange" lead="27 effects, mutes and fills">under your fingers</H3>
            <P>Hold FX and the 16 white keys become 27 punch-in effects, locked to the tempo. Hold GLO for mutes, solos, fills and tap tempo. Tap
              the button to open its pages; hold it and tap HOME to lock it open, both hands free.</P>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-1.5">
              {LAYERS.map(([name, what, c]) => (
                <div key={name} className={`${pixelPanel} px-3.5 py-3`}>
                  <b className="mb-1.5 inline-block px-2 py-0.5 font-pixel text-[15px] font-bold text-ink" style={{ background: C[c] }}>{name}</b>
                  <span className="block text-sm text-dim">{what}</span>
                </div>
              ))}
            </div>
          </Feature>

          <Feature reverse media={<Screen src={drums} color="green" caption="16 sounds × 16 steps, every hit with its level and roll."
            alt="The DRUMS screen: a 16 by 16 grid of an 808 kit, each hit with its level" />}>
            <H3 color="green" lead="Two drum tracks,">37 kits, 16 sounds on the keys</H3>
            <P>Kick to cowbell on the white keys; a black key doubles its neighbour for two-finger rolls. Hold OCT− or OCT+ for ghost or hard
              hits. Each hit keeps its level and a ratchet up to x4.</P>
            <ul className="m-0 list-disc pl-5 text-body [&_li]:mb-1.5">
              <li><B>Beats from the keys:</B> hold a few white keys on a drum track's PLAY page and a whole groove is written across the kit:
                house, rock, boom bap, trap, break, dembow, drum &amp; bass, electro.</li>
              <li><B>37 level-matched kits:</B> 808, 909, 606, trap, drill, amapiano, afrobeat, jungle, synthwave, jazz brushes and more.</li>
              <li><B>Your own kits:</B> drop WAVs on 16 pads in the editor, or synthesise one in its Drum synth page.</li>
            </ul>
          </Feature>

          <Feature media={<Screen src={chords} color="blue" caption="One key for the whole song, 16 scales, one-key chords and a progression the tracks follow."
            alt="The CHORDS screen: a progression VI, IV, I, V in C major that the tracks follow" />}>
            <H3 color="blue" lead="Thirteen engines,">DX7 cartridges included</H3>
            <P>Sliding 808s and acid 303s, a real Steinway, Rhodes, string machines, granular clouds, plucked guitars and sitar, supersaws.
              Every sound level-matched; 32 slots for your own.</P>
            <div className="mb-5 flex flex-wrap gap-1.5">
              {ENGINES.map((e) => <span key={e} className={`${pixelPanel} px-2.5 py-1.5 font-pixel text-[15px] text-fg`}>{e}</span>)}
            </div>
            <p className="m-0 text-body"><B>Six-operator FM with DX7 patches:</B> drop a .syx cartridge on the editor and keep 27 patches on
              the FM-1. <B>OberVave</B>'s analog polysynth comes with its 70 programs.</p>
          </Feature>

          <Feature reverse media={<Screen src={notes} color="yellow" caption="The piano roll of a synth track, on the FM-1 itself."
            alt="The NOTES screen: the piano roll of a synth track, notes on a timeline" />}>
            <H3 color="yellow" lead="Record a pass,">then another on top</H3>
            <P>Press REC while it plays and every pass is layered on top. Notes land where you heard them: the keys' latency is taken back. Or
              play freely with no tempo at all, and the loop's length sets the tempo.</P>
            <ul className="m-0 list-disc pl-5 text-body [&_li]:mb-1.5">
              <li>64 steps a track, each with its own length and division: polymeters that stay in phase.</li>
              <li>Parameter locks, micro timing and fill conditions on any step.</li>
              <li>Chords up to 4 notes a step, ties, slide, MPC swing.</li>
              <li>Undo and redo for everything; hold REC to clear a track.</li>
            </ul>
          </Feature>

          <Feature media={
            <div className="grid w-full max-w-[440px] min-w-0 flex-[1_1_360px] grid-cols-2 gap-5 [&_img]:block [&_img]:aspect-square [&_img]:h-auto
              [&_img]:w-full [&_img]:border-[6px] [&_img]:border-deep [&_img]:[image-rendering:pixelated]">
              <img src={song} width="240" height="240" alt="The SONG screen: sections A and B of four bars, C and D empty, playing in loop mode" />
              <img src={patterns} width="240" height="240" alt="The PATTERNS screen: eight patterns for track 1 and the scenes" />
              <img src={mix} width="240" height="240" alt="The MIX screen: GLO held, four level bars with mute and solo, fill and tap tempo" />
              <div className={`${pixelPanel} flex flex-col justify-end p-4`}>
                <b className="font-pixel text-[40px] leading-none text-orange">A–D</b>
                <span className="text-sm text-dim">sections, chained live or played in order</span>
              </div>
            </div>}>
            <H3 color="orange" lead="Build a song">from four sections</H3>
            <P>Save the loop into sections A–D and jump between them on the next bar. Hold SAVE and tap several for a quick chain, or record the
              song as you perform it. Eight patterns a track, with scenes that switch them all at once.</P>
            <p className="m-0 text-body">Master effects on top: <B>DUST</B> (an old sampler and a record), <B>DUCK</B> (the kick pumps the
              synths), a DJ filter, and a <B>TEXTURE</B> bed of vinyl, tape, rain or your own sample.</p>
          </Feature>

        </section>

        <section aria-label="More features" className="mx-auto max-w-[1200px] px-6 pt-0 pb-20">
          <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
            {MORE.map(([title, text, c]) => (
              <div key={title} className={`${pixelPanel} px-[22px] pt-5 pb-6`}>
                <h3 className={`m-0 mb-2 font-pixel text-[22px] leading-snug font-bold ${TEXT[c]}`}>{title}</h3>
                <p className="m-0 text-[15px] text-dim">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="editor" className="border-y-4 border-line bg-deep">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-14 gap-y-10 px-6 py-20">
            <div className="min-w-0 flex-[1_1_400px]">
              <p className={KICKER}>The web editor</p>
              <h2 className={`${H2} mb-4 text-[40px] leading-none`}>The FM-1's screen, on a big one.</h2>
              <P>Plug the FM-1 in and the editor follows every knob you turn, live. Shape sounds, draw in a piano roll, import and export MIDI
                files, build sample instruments and drum kits, keep a library of sounds, back up the whole FM-1.</P>
              <ul className="m-0 mb-6 list-disc pl-5 text-body [&_li]:mb-1.5">
                <li><B>LIVE page:</B> play a set from a laptop or a tablet: scenes, morphs, MIDI learn, a playlist of songs.</li>
                <li><B>CHOP:</B> drop any recording, tap along, send the chops to the keys.</li>
                <li><B>Works offline:</B> install it as an app, or download it as one file.</li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <a href="../editor/" className={SECONDARY}>Open the editor</a>
                <a href="../editor/?mock=1" className="inline-flex min-h-12 items-center px-1 py-3.5 text-[15px] text-dim underline-offset-4 hover:text-blue hover:underline">Try it with a simulated FM-1</a>
              </div>
            </div>
            <figure className="m-0 min-w-0 flex-[1_1_520px]">
              <img src={editorShot} alt="The web editor's Sound page: the ENV, LFO and FX cards, four knobs a row in the track colours"
                className="block h-auto w-full border-[6px] border-bg shadow-[10px_10px_0_var(--color-orange)]" />
              <figcaption className="mt-5 text-[14px] text-dim">The Sound page: the device's own pages, four knobs a row in the track colours.</figcaption>
            </figure>
          </div>
        </section>

        <section id="emulator" className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="flex flex-wrap items-center justify-between gap-8 bg-blue p-6 text-ink shadow-[12px_12px_0_var(--color-orange)] min-[600px]:p-10">
            <div className="min-w-0 flex-[1_1_520px]">
              <p className="m-0 mb-2 font-pixel text-[18px] font-medium">No FM-1 yet?</p>
              <h2 className="m-0 mb-3 font-pixel text-[40px] leading-none font-bold text-ink">Play the real firmware in your browser.</h2>
              <p className="m-0 max-w-[40em]">The emulator runs BoopBox itself: the same screen, sequencer and sound engines. Click
                the keys or use your computer's keyboard; your projects stay in the browser.</p>
            </div>
            <a href="../emu/" className={`${arcadeButton} ${arcadeButtonSize} bg-ink !text-green [--shadow:var(--color-orange)]`}>Open the emulator ▶</a>
          </div>
        </section>

        <section id="install" className="mx-auto max-w-[1200px] px-6 pb-24">
          <h2 className={`${H2} mb-3 text-[40px] leading-none`}>Install in a minute, from the browser.</h2>
          <p className="m-0 mb-8 max-w-[46em] text-body">No app, no account, no extra hardware: Chrome or Edge on a computer, and a USB data
            cable straight into the FM-1.</p>
          <ol className="m-0 mb-10 grid list-none grid-cols-1 gap-3 p-0 min-[700px]:grid-cols-3">
            {STEPS.map(([n, title, text, c]) => (
              <li key={n} className={`${pixelPanel} p-[22px]`}>
                <b className={`mb-3 block font-pixel text-[40px] leading-none ${TEXT[c]}`}>{n}</b>
                <b className="mb-1 block font-pixel text-[22px] text-fg">{title}</b>
                <span className="block text-[15px] text-dim">{text}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="../installer/" className={PRIMARY}>Go to the installer</a>
            <p className="m-0 flex-[1_1_360px] text-sm text-dim">The package is checked (SHA-256) before it is written and again by the loader; an
              interrupted install finishes when you press Install again; USB rescue and a way back to the official firmware are always there.</p>
          </div>
        </section>
      </main>

      <footer className="border-t-4 border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-12 gap-y-6 px-6 pt-8 pb-12 text-[13px] text-dim">
          <p className="m-0 flex-[1_1_420px]">BoopBox is based on <a href="https://github.com/isod89/sloop-fm1">SLOOP</a>, itself based on Felucca by
            Leo Kuroshita (@kurogedelic), <a href="https://hugelton.com">Hügelton Instruments</a>. GPL-3.0, no warranty. M-VAVE and FM-1 are
            trademarks of their respective owners; BoopBox is not affiliated with them.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={GITHUB}>Source</a>
            <a href={`${GITHUB}/releases`}>Releases</a>
            <a href={`${GITHUB}/blob/main/CHANGELOG.md`}>Changelog</a>
            <a href={`${GITHUB}/issues`}>Report a bug</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
Home.displayName = "Home";

export default Home;
