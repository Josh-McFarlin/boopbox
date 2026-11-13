// SPDX-License-Identifier: GPL-3.0-only
// The visual guide: how to reach everything in the firmware, on a drawing of the FM-1. The panel at the top is the map:
// pick a layer (or press a layer button on it) and the keys and knobs show what they do; select any control for its tap
// and hold. Then the basics, recording, drums, every page knob by knob, effects, chords, song mode, the menu and a
// "where is…?" search. The words come from GUIDE.md (src/guide/data.js); the screens are the firmware's own.
import { useMemo, useState } from "react";
import SiteHeader from "../shared/SiteHeader.jsx";
import Panel from "./Panel.jsx";
import {
  BEATS, BLACK, C, CHORD_MODES, CHORDS_PLUS, CONTROLS, DRUMS, ENGINES, FIRST_BEAT, LAYERS, MENU, PAGES, REC_KNOBS, REC_STATES,
  SPECIAL, TRACKS, VISUALISER, WHERE, WHITE, shot,
} from "./data.js";

const GITHUB = "https://github.com/josh-mcfarlin/boopbox";
const TEXT = { blue: "text-blue", green: "text-green", yellow: "text-yellow", orange: "text-orange", red: "text-red" };
const KNOB_C = [C.blue, C.green, C.yellow, C.orange];
const KICKER = "m-0 mb-3 inline-block bg-tile px-2.5 py-1 font-pixel text-[15px] font-medium text-blue";
const H2 = "m-0 mb-4 font-pixel text-[32px] leading-none font-bold text-fg min-[600px]:text-[40px]";
const H3 = "m-0 mb-2 font-pixel text-[22px] leading-tight font-bold text-fg";

const SECTIONS = [
  ["panel", "The panel"], ["basics", "Tap, hold, lock"], ["first", "First beat"], ["record", "Recording"], ["drums", "Drums"],
  ["steps", "Steps & locks"], ["pages", "Every page"], ["effects", "Effects"], ["chords", "Key & chords"], ["song", "Song mode"],
  ["sounds", "Sounds"], ["menu", "HOME menu"], ["visualiser", "Visualiser"], ["special", "Power-on"], ["where", "Where is…?"],
];

const B = ({ children }) => <b className="text-fg">{children}</b>;
const Kbd = ({ children, color }) => (
  <kbd className="inline-block border-2 px-1.5 py-px font-pixel text-[14px] leading-tight not-italic"
    style={{ borderColor: color || "var(--line)", color: color || "var(--fg)" }}>{children}</kbd>
);
function Screen({ src, alt, color = "orange", className = "" }) {
  return <img src={src} alt={alt} width="240" height="240" loading="lazy" className={`pixel-screen ${className}`} style={{ boxShadow: `8px 8px 0 ${C[color]}` }} />;
}
function Section({ id, kicker, title, children, intro }) {
  return (
    <section id={id} className="scroll-mt-6 border-b-4 border-line py-16 first:pt-10">
      {kicker ? <p className={KICKER}>{kicker}</p> : null}
      <h2 className={H2}>{title}</h2>
      {intro ? <p className="m-0 mb-8 max-w-[44em] text-body">{intro}</p> : null}
      {children}
    </section>
  );
}
function Tabs({ items, value, onChange, label, color = "blue" }) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex flex-wrap gap-1.5">
      {items.map(([k, text, c]) => {
        const on = k === value;
        return (
          <button key={k} role="tab" aria-selected={on} onClick={() => onChange(k)}
            className="cursor-pointer border-[3px] px-3 py-1.5 font-pixel text-[16px] font-bold leading-none transition-colors"
            style={on ? { background: C[c || color], borderColor: C[c || color], color: "#160d2b" } : { borderColor: "var(--line)", color: "var(--body)", background: "transparent" }}>
            {text}
          </button>
        );
      })}
    </div>
  );
}
/* the four knobs of a page, placed as the screen places them: 1 2 / 3 4 */
function Knobs({ values }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="pixel-panel min-w-0 px-3 py-2.5">
          <span className="mb-0.5 block font-pixel text-[13px]" style={{ color: KNOB_C[i] }}>KNOB {i + 1}</span>
          <span className="block text-[15px] leading-snug text-fg">{v}</span>
        </div>
      ))}
    </div>
  );
}
/* a key map as the layer screens draw it: the white keys in four rows of four, the black keys below */
function KeyMap({ white, black, color }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-1">
        {white.map((t, i) => (
          <div key={i} className="min-w-0 bg-deep px-2 py-1.5" style={{ boxShadow: `inset 0 0 0 2px ${t ? C[color] + "66" : "var(--line)"}` }}>
            <span className="block font-pixel text-[11px] text-dim">{i + 1} · {WHITE[i]}</span>
            <span className="block truncate font-pixel text-[14px] text-fg">{t === WHITE[i] ? "plays its note" : t || "—"}</span>
          </div>
        ))}
      </div>
      {black && black.some(Boolean) ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {black.map((t, j) => t ? (
            <span key={j} className="bg-bg px-2 py-1 font-pixel text-[13px]" style={{ boxShadow: `inset 0 0 0 2px ${C[color]}66` }}>
              <span className="text-dim">{BLACK[j]}</span>{t !== BLACK[j] ? <span className="text-fg"> {t}</span> : null}
            </span>
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------- the panel --- */
function PanelExplorer() {
  const [layerId, setLayer] = useState("PLAY");
  const [sel, setSel] = useState("FX");
  const layer = LAYERS.find((l) => l.id === layerId);
  const onSel = (id) => {
    setSel(id);
    const l = LAYERS.find((x) => x.button === id);
    if (l) setLayer(layerId === l.id ? "PLAY" : l.id);   /* a layer button: press to hold it, again to let go */
  };
  let info;
  if (sel[0] === "W" || sel[0] === "B") {
    const white = sel[0] === "W", i = +sel.slice(1);
    const fn = white ? layer.white[i] : layer.black[i];
    info = { ...CONTROLS[white ? "WHITE" : "BLACK"], name: white ? `White key ${i + 1} · ${WHITE[i]}` : `Black key · ${BLACK[i]}`, now: fn || "nothing in this layer" };
  } else {
    const c = CONTROLS[sel];
    const k = sel.startsWith("KNOB") ? layer.knobs[+sel[4] - 1] : null;
    info = { ...c, now: k && k !== "—" ? k : null };
  }
  return (
    <div>
      <Tabs label="Layer" value={layerId} onChange={setLayer} items={LAYERS.map((l) => [l.id, l.button ? `hold ${l.button}` : l.title, l.color])} />
      <div className="pixel-panel p-2 min-[700px]:p-4">
        <Panel layer={layer} sel={sel} onSel={onSel} screen={shot(layer.shot)} />
      </div>
      <p className="m-0 mt-3 text-[14px] text-dim">Select any knob, button or key. Press a layer button (FX, SEL, EDIT, GLO, SAVE, ARP, SEQ) on the drawing to hold it; press it again to let go.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_1.25fr]">
        <div className="pixel-panel p-5" aria-live="polite">
          <p className="m-0 mb-1 font-pixel text-[14px] text-dim">Selected</p>
          <h3 className="m-0 mb-4 font-pixel text-[28px] leading-none font-bold text-fg">{info.name}</h3>
          {info.now ? (
            <p className="m-0 mb-4 border-l-4 pl-3" style={{ borderColor: C[layer.color] }}>
              <span className="block font-pixel text-[14px]" style={{ color: C[layer.color] }}>{layer.button ? `With ${layer.button} held` : "Right now"}</span>
              <span className="text-fg">{info.now}</span>
            </p>
          ) : null}
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
            <dt className="font-pixel text-blue">{info.kind === "knob" ? "Turn" : info.kind === "keys" ? "Play" : "Tap"}</dt><dd className="m-0">{info.tap}</dd>
            {info.hold ? <><dt className="font-pixel text-orange">Hold</dt><dd className="m-0">{info.hold}</dd></> : null}
          </dl>
        </div>
        <div className="pixel-panel p-5">
          <div className="mb-4 flex items-start gap-5">
            <img src={shot(layer.shot)} alt={`The ${layer.title} screen`} width="240" height="240" className="pixel-screen !w-[120px] shrink-0 !border-4" />
            <div className="min-w-0">
              <p className="m-0 font-pixel text-[14px] text-dim">{layer.name}</p>
              <h3 className={`m-0 mb-2 font-pixel text-[28px] leading-none font-bold ${TEXT[layer.color]}`}>{layer.title}</h3>
              <p className="m-0 text-[15px]">{layer.blurb}</p>
            </div>
          </div>
          <KeyMap white={layer.white} black={layer.black} color={layer.color} />
          <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[15px]">
            {layer.knobs.some((k) => k !== "—") ? (
              <li><span className="font-pixel text-dim">KNOBS </span>{layer.knobs.map((k, i) => <span key={i} className="mr-3 font-pixel text-[15px]" style={{ color: KNOB_C[i] }}>{i + 1}·{k}</span>)}</li>
            ) : null}
            {layer.more.map(([k, v]) => <li key={k}><B>{k}</B>: {v}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page explorer --- */
function PageExplorer() {
  const [btn, setBtn] = useState("ENV");
  const [page, setPage] = useState(0);
  const group = PAGES.find((p) => p.button === btn);
  const [name, img, knobs, note] = group.pages[Math.min(page, group.pages.length - 1)];
  return (
    <div>
      <Tabs label="Button" value={btn} onChange={(b) => { setBtn(b); setPage(0); }} items={PAGES.map((p) => [p.button, p.button, p.color])} />
      <div className="flex flex-wrap gap-x-10 gap-y-8">
        <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
          <Screen src={shot(img)} alt={`The ${btn} → ${name} page`} color={group.color} />
          <figcaption className="mt-5 text-[14px] text-dim">{btn} → {name}, page {page + 1} of {group.pages.length}</figcaption>
        </figure>
        <div className="min-w-0 flex-[1_1_420px]">
          <p className="m-0 mb-3 text-[15px]">
            {group.via ? <>Open with <B>{group.via}</B>. </> : <>Tap <Kbd color={C[group.color]}>{btn}</Kbd> for the first page; tap again (or turn <B>SELECT</B>) for the next. </>}
          </p>
          <Tabs label={`${btn} pages`} value={page} onChange={setPage} color={group.color} items={group.pages.map((p, i) => [i, p[0]])} />
          <Knobs values={knobs} />
          {note ? <p className="m-0 mt-4 text-[15px] text-body">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function MenuExplorer() {
  const [i, setI] = useState(0);
  const [name, img, knobs] = MENU[i];
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-8">
      <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
        <Screen src={shot(img)} alt={`The menu's ${name} section`} color="green" />
      </figure>
      <div className="min-w-0 flex-[1_1_420px]">
        <Tabs label="Menu section" value={i} onChange={setI} color="green" items={MENU.map((m, k) => [k, m[0]])} />
        <Knobs values={knobs} />
        <p className="m-0 mt-4 text-[15px]"><B>SELECT</B> moves between sections · <B>PRESETS</B> moves the cursor · <B>OCT+</B> changes or opens the
          setting · <B>OCT−</B> closes · <B>hold HOME</B> leaves. These are settings of the FM-1: loading a project never changes them.</p>
      </div>
    </div>
  );
}

function WhereIs() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? WHERE.filter(([a, b]) => (a + " " + b).toLowerCase().includes(t)) : WHERE;
  }, [q]);
  return (
    <div>
      <label className="mb-5 block max-w-[520px]">
        <span className="mb-1.5 block font-pixel text-[15px] text-dim">Search</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="tempo, swing, MIDI, kit…"
          className="block w-full border-[3px] border-line bg-deep px-3 py-2.5 text-[16px] text-fg outline-none focus:border-blue" />
      </label>
      <div className="grid grid-cols-1 gap-1.5 min-[800px]:grid-cols-2">
        {rows.map(([a, b]) => (
          <div key={a} className="pixel-panel px-4 py-3">
            <b className="block font-pixel text-[16px] text-blue">{a}</b>
            <span className="block text-[15px] text-body">{b}</span>
          </div>
        ))}
        {rows.length === 0 ? <p className="m-0 text-dim">Nothing found. The <a href={`${GITHUB}/blob/main/GUIDE.md`}>full guide</a> has everything.</p> : null}
      </div>
    </div>
  );
}

function Toc() {
  return (
    <nav aria-label="On this page" className="hidden min-[1100px]:block">
      <div className="sticky top-6">
        <p className="m-0 mb-3 font-pixel text-[14px] text-dim">ON THIS PAGE</p>
        <ol className="m-0 list-none space-y-1 p-0 font-pixel text-[16px]">
          {SECTIONS.map(([id, t], i) => (
            <li key={id}><a href={`#${id}`} className="block py-0.5 text-body no-underline hover:text-blue"><span className="mr-2 text-dim">{String(i + 1).padStart(2, "0")}</span>{t}</a></li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

const Steps = ({ items }) => (
  <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[700px]:grid-cols-2">
    {items.map(([k, v], i) => (
      <li key={k} className="pixel-panel px-4 py-3"><b className="block font-pixel text-[17px] text-fg">{k}</b><span className="text-[15px]">{v}</span></li>
    ))}
  </ol>
);

export default function Guide() {
  const [beat, setBeat] = useState(0);
  return (
    <div className="min-h-screen bg-bg text-[16px] leading-[1.6] text-body">
      <SiteHeader current="guide" />

      <header className="border-b-4 border-b-orange bg-tile">
        <div className="mx-auto max-w-[1200px] px-6 py-14">
          <p className={KICKER}>▶ Visual guide</p>
          <h1 className="m-0 mb-5 max-w-[18em] font-pixel text-[42px] leading-[1] font-bold text-balance min-[600px]:text-[60px]">
            Every control, <span className="text-orange">every layer,</span> every page.</h1>
          <p className="m-0 mb-6 max-w-[40em] text-[19px] leading-[1.5]">How to reach everything in BoopBox on the FM-1 and what it does. Start with the panel:
            pick a layer and the keys and knobs show their jobs. Every screen on this page is drawn by the firmware itself.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            <span><Kbd>tap</Kbd> press and let go quickly</span>
            <span><Kbd>hold</Kbd> keep it pressed</span>
            <span><Kbd>FX + key 3</Kbd> hold FX, press white key 3</span>
            <span><Kbd>key 1 … 16</Kbd> the white keys, F3 to G5</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 min-[1100px]:grid-cols-[180px_1fr]">
        <Toc />
        <main className="min-w-0">
          <Section id="panel" kicker="01 · The map" title="The panel"
            intro="Four knobs and the octave buttons on the left, the screen, KNOB 1–4 and twelve buttons on the right, 11 black and 16 white keys below. KNOB 1–4 always set the four dials at the bottom of the screen.">
            <PanelExplorer />
          </Section>

          <Section id="basics" kicker="02 · The big ideas" title="Tracks, tap, hold and lock">
            <div className="mb-10 grid grid-cols-2 gap-1.5 min-[600px]:grid-cols-4 min-[900px]:grid-cols-8">
              {TRACKS.map(([n, kind, c]) => (
                <div key={n} className="pixel-panel px-3 py-3" style={{ opacity: n > 4 ? 0.8 : 1 }}>
                  <b className="block font-pixel text-[36px] leading-none" style={{ color: C[c] }}>{n}</b>
                  <span className="block text-[14px] text-dim">{kind}</span>
                </div>
              ))}
            </div>
            <p className="m-0 mb-8 max-w-[44em]"><B>Eight tracks.</B> Six synths and two drum machines at power-on; any track can be either (SAVE → TOOLS → KIND). The synths share
              20 voices, the drums have 6 of their own. <B>ALGORITHM</B> selects the track you play, record and edit, and the whole screen takes its colour.
              Tracks 5–8 use lighter shades of 1–4. On the screen, <B>white</B> is what you touch and <B>red</B> is recording.</p>
            <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-3">
              {[["Tap a button", "blue", "Its pages open: sound design and settings. Tap again for the next page, or turn SELECT both ways. From another page, a tap always opens its first page."],
                ["Hold a button", "orange", "A layer opens: while you hold it, the 16 white keys and KNOB 1–4 do other jobs, shown on the screen as 16 tiles. Seven buttons have layers: FX, EDIT, ARP, SEQ, SEL, GLO, SAVE."],
                ["Lock it open", "green", "Hold the layer button and tap HOME: the layer stays (LOCK, the button blinks), both hands free. Any other button unlocks it. PLAY, REC and OCT keep working inside."]]
                .map(([t, c, v]) => (
                  <div key={t} className="pixel-panel p-5"><h3 className={`${H3} ${TEXT[c]}`}>{t}</h3><p className="m-0 text-[15px]">{v}</p></div>
                ))}
            </div>
            <p className="m-0 mt-6 max-w-[44em] text-[15px] text-dim">Inside any layer PLAY still starts and stops, SELECT sets the tempo, and ALGORITHM and PRESETS wait. Keys 1, 5, 9
              and 13 glow dimly: the first key of each row of tiles, so you can find a tile without looking.</p>
          </Section>

          <Section id="first" kicker="03 · Tutorial" title="Your first beat in 60 seconds" intro="Eight steps from an empty FM-1 to a loop with drums, bass, chords and effects.">
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
                <Screen src={shot(FIRST_BEAT[beat][2])} alt={`The screen for step ${beat + 1}: ${FIRST_BEAT[beat][0]}`} color="yellow" />
              </figure>
              <div className="min-w-0 flex-[1_1_420px]">
                <ol className="m-0 list-none space-y-1.5 p-0">
                  {FIRST_BEAT.map(([t, v], i) => (
                    <li key={t}>
                      <button onClick={() => setBeat(i)} aria-expanded={beat === i}
                        className="flex w-full cursor-pointer items-start gap-4 border-0 px-4 py-3 text-left"
                        style={{ background: beat === i ? "var(--tile)" : "transparent", boxShadow: beat === i ? `inset 4px 0 0 ${C.yellow}` : "none" }}>
                        <b className="font-pixel text-[24px] leading-none" style={{ color: beat === i ? C.yellow : "var(--dim)" }}>{i + 1}</b>
                        <span className="min-w-0">
                          <b className="block font-pixel text-[18px] text-fg">{t}</b>
                          {beat === i ? <span className="mt-1 block text-[15px] text-body">{v}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>

          <Section id="record" kicker="04 · Recording" title="REC: live, layered, in time"
            intro="BoopBox records live and adds every pass on top of the last. Notes land where you heard them: the keys' latency is taken back. Punch-in effects, the click and notes played inside a layer are never recorded.">
            <div className="mb-10"><Steps items={REC_STATES} /></div>
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              <div className="grid w-full max-w-[420px] min-w-0 flex-[1_1_300px] grid-cols-2 gap-5">
                <Screen src={shot("rec/rec-armed")} alt="The REC screen, armed: mode, length, start and quant" color="red" />
                <Screen src={shot("rec/rec-free")} alt="A free take: the seconds and the loop it would make" color="red" />
              </div>
              <div className="min-w-0 flex-[1_1_420px]">
                <h3 className={H3}>The REC screen (armed, before the first note)</h3>
                <Knobs values={REC_KNOBS.map(([k, v]) => `${k}: ${v}`)} />
                <p className="m-0 mt-4 text-[15px]">The PLAY light flashes on every beat. For an audible click: <B>GLO → GLOBAL → CLICK</B>. Turn ALGORITHM while recording
                  to move the take to the next track.</p>
              </div>
            </div>
          </Section>

          <Section id="drums" kicker="05 · Drums" title="The drum track"
            intro="16 sounds on the 16 white keys, four levels a hit (GHOST, SOFT, NORM, HARD) and ratchets up to x4. The closed and pedal hats choke the open hat. 46 kits: 37 level-matched factory kits plus your own sampled and synthesised ones.">
            <KeyMap white={DRUMS} color="green" />
            <div className="mt-10 grid grid-cols-1 gap-8 min-[800px]:grid-cols-3">
              {[["Grid", "drums/drums-sheet", "tap SEQ", "16 sounds × 16 steps. KNOB 1 sound · 2 step · 3 hit · 4 level. The white keys are the steps of the sound, the black keys pick the sound, OCT−/OCT+ turn the page of steps."],
                ["Kit", "drums/drums-kit", "tap EDIT", "16 pads that flash on every hit. KNOB 1 kit · 2 level · 3 reverb · 4 pan."],
                ["Sound", "drums/drums-sound", "tap EDIT again", "Tune each sound −8…+7 semitones and make it shorter or longer. KNOB 1 sound · 2 tune · 3 decay · 4 level."]]
                .map(([t, img, how, v]) => (
                  <div key={t} className="min-w-0">
                    <Screen src={shot(img)} alt={`The DRUMS ${t} page`} color="green" className="mb-6 max-w-[260px]" />
                    <h3 className={H3}>{t} <span className="font-pixel text-[15px] text-green">· {how}</span></h3>
                    <p className="m-0 text-[15px]">{v}</p>
                  </div>
                ))}
            </div>
            <div className="mt-12 pixel-panel p-6">
              <h3 className={`${H3} text-green`}>Beats from the keys</h3>
              <p className="m-0 mb-4 text-[15px]">On a drum track's <B>SEQ → PLAY</B> page, hold one or more white keys and a whole pattern is written across the kit. The
                lowest key held picks the groove (keys 9–16: the same, busier); each other key adds detail; <B>KNOB 2 SEED</B> gives another set of variations. One hold is one undo.</p>
              <div className="flex flex-wrap gap-1.5">
                {BEATS.map((b, i) => <span key={b} className="bg-deep px-2.5 py-1 font-pixel text-[14px]"><span className="text-dim">key {i + 1}</span> <span className="text-fg">{b}</span></span>)}
              </div>
            </div>
          </Section>

          <Section id="steps" kicker="06 · The sequencer" title="Steps, nudges, locks and fills"
            intro="Each track has up to 64 steps with its own length and division, so tracks of different lengths loop on their own and stay in phase. Enter steps live with REC, with the SEQ layer, or on the NOTES page (a piano roll).">
            <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
              {[["Set and clear", "Hold SEQ: the white keys are steps 1–16 of the page. An empty step is set with the last note or sound you played; a tap on a set step clears it. Hold several to edit them together."],
                ["Edit a step", "Hold SEQ, hold a step and turn: KNOB 1 its note (or sound), KNOB 2 level or velocity, KNOB 3 ratchet x1–x4, KNOB 4 nudge (−32…+31 in 1/64 of a step)."],
                ["Parameter locks", "Turn the parameter on its page first. Then hold SEQ + the step and turn PRESETS: that step alone gets its own value. ALGORITHM picks another locked parameter. 32 locks a track."],
                ["Fill conditions", "SEQ + step + OCT+ cycles normal → FILL ONLY (F) → NO FILL (×). Play a fill with GLO + key 9 (held) or GLO + key 10 (the next bar). SEQ + step + OCT− clears it all."],
                ["The NOTES page", "Tap SEQ on a synth track. KNOB 1 note · 2 pitch · 3 length · 4 force. Hold OCT+ for the note's sheet: slide, nudge, fill, move, copy, delete, locks."],
                ["Divisions", "SEQ + KNOB 2: 1/4, 1/8, 1/16, 1/32, 8T, 16T, 1/2, 1BAR, 2BAR. A 64-step track at 2BAR lasts 128 bars: drones and slow chord changes."]]
                .map(([t, v]) => <div key={t} className="pixel-panel p-5"><h3 className={`${H3} text-blue`}>{t}</h3><p className="m-0 text-[15px]">{v}</p></div>)}
            </div>
            <div className="mt-8 grid max-w-[600px] grid-cols-2 gap-5">
              <Screen src={shot("pages/seq-notes")} alt="The NOTES page: a piano roll of the track" color="blue" />
              <Screen src={shot("pages/seq-notes-sheet")} alt="The NOTES page with a note's sheet open" color="blue" />
            </div>
          </Section>

          <Section id="pages" kicker="07 · Reference" title="Every page, knob by knob"
            intro="A page shows four values placed as the knobs are: 1 top left, 2 top right, 3 bottom left, 4 bottom right. Global pages (DLY, REV/CHO, PERF, HARMONY, GLOBAL, MASTER, DRUMS, TEXTURE, MIDI) are the same for every track; the others belong to the selected track.">
            <PageExplorer />
          </Section>

          <Section id="effects" kicker="08 · Effects" title="Punch-ins, master and per track">
            <p className="m-0 mb-6 max-w-[44em]"><B>Hold FX and hold a key</B>: 27 effects on the whole mix, for as long as you hold it. Loops and the gate start on the grid.
              FX + SELECT sets a fade-in and fade-out. FX → PERF chooses what they act on, latches them or quantises their start.</p>
            <KeyMap white={LAYERS.find((l) => l.id === "FX").white} black={LAYERS.find((l) => l.id === "FX").black} color="orange" />
            <div className="mt-10 grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
              {[["DUST", "FX + KNOB 2 · GLO → MASTER", "The mix through an old sampler and a record: drive, a lower sample rate, fewer bits, a closing low-pass."],
                ["DUCK", "FX + KNOB 3 · GLO → MASTER", "Every kick pumps the synth tracks down and back over a 1/8 note: sidechain, in time at any tempo."],
                ["FILTER / TRK FILT", "FX + KNOB 1 / KNOB 4", "One-knob DJ filters: left a low-pass closes, right a high-pass opens. KNOB 1 the mix, KNOB 4 the selected track."],
                ["REV / ECHO THROW", "FX + OCT− / OCT+ held", "Every reverb (or delay) send goes to full while held, and glides back. Never saved or recorded."],
                ["Per track", "FX pages", "Sends (drive, chorus, delay, reverb), SLICER gate / stutter, and an INSERT: clip, fold, fuzz, crush, phaser, flanger, chorus."],
                ["TEXTURE", "GLO → TEXTURE", "A looping bed under the mix: vinyl, tape, rain, wind, radio, room or your own sample, breathing over 1–16 bars."]]
                .map(([t, how, v]) => (
                  <div key={t} className="pixel-panel p-5">
                    <h3 className={`${H3} text-orange`}>{t}</h3>
                    <p className="m-0 mb-1 font-pixel text-[14px] text-dim">{how}</p>
                    <p className="m-0 text-[15px]">{v}</p>
                  </div>
                ))}
            </div>
            <p className="m-0 mt-6 text-[14px] text-dim">Signal path: engine → drive → INSERT → SLICER → filter → level and DUCK → pan and sends. Then the whole mix → DUST → punch-ins → DJ
              filter → MASTER → limiter.</p>
          </Section>

          <Section id="chords" kicker="09 · Harmony" title="Key, scales, chords and CHORD+"
            intro="Hold SEL and press any key: that is the key of the song for every synth track. SEL + KNOB 2 sets the scale (16 of them), SEL + KNOB 3 how the keys follow it: OFF (chromatic), SNAP (rounded to the scale) or WHITE (the white keys walk the scale from C4).">
            <div className="grid grid-cols-1 gap-8 min-[800px]:grid-cols-2">
              <div>
                <h3 className={`${H3} text-green`}>One finger, one chord</h3>
                <p className="m-0 mb-4 text-[15px]">Hold SEL and turn KNOB 1. With a chord mode on, the white keys walk the scale from C4: C4 plays the I chord, D4 the II… Every chord
                  is built from the scale, so it always fits.</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {CHORD_MODES.map(([k, v]) => <div key={k} className="pixel-panel px-3 py-2"><b className="block font-pixel text-[16px] text-fg">{k}</b><span className="text-[14px] text-dim">{v}</span></div>)}
                </div>
              </div>
              <div>
                <h3 className={`${H3} text-green`}>CHORD+: the black keys change the chord</h3>
                <p className="m-0 mb-4 text-[15px]">Hold a black key while you play a white one (or press it while the chord rings). Several at once add up: in C major G4 is G, + G# is G7,
                  + F# and G# is Gm7.</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {CHORDS_PLUS.map(([k, v]) => (
                    <div key={k} className="flex items-center gap-4 bg-deep px-3 py-2"><Kbd color={C.green}>{k}</Kbd><span className="text-fg">{v}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <p className="m-0 mt-6 text-[15px]"><B>SEL 2</B> (tap SEL twice): STRUM plays a chord's notes one after another, VLEAD voices each chord nearest the last. <B>SEL → HARMONY</B> and the
              <B> CHORDS</B> screen hold the song's progression, which tracks can FOLLOW.</p>
          </Section>

          <Section id="song" kicker="10 · Arrange" title="Song mode: sections A–D"
            intro="The FM-1 holds one song: four sections (A–D), each a full loop of the eight tracks, and up to 16 steps that play them in order. For more songs, keep an editor backup file for each.">
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              <div className="grid w-full max-w-[420px] min-w-0 flex-[1_1_300px] grid-cols-2 gap-5">
                <Screen src={shot("layers/layer-save")} alt="SAVE held: the SONG layer, play and store A–D" color="yellow" />
                <Screen src={shot("pages/seq-song")} alt="The SONG screen: the section chain" color="yellow" />
              </div>
              <ol className="m-0 min-w-0 flex-[1_1_420px] list-none space-y-3 p-0">
                {[["Save", "SAVE + key 5–8 saves the loop into A–D (a used one: press again within 3 s)."],
                  ["Play live", "SAVE + key 1–4: the section starts on the next bar, always in time."],
                  ["Quick chain", "Keep SAVE held and tap several section keys (A B B C…, up to 8). They play round and round."],
                  ["Record the song", "SAVE + key 14 (SONG REC): from the next bar every section you play is written into the song."],
                  ["Play it back", "SAVE + key 13 switches loop / song. In song mode PLAY plays the whole song. Edit it by hand on the SONG screen (tap SAVE on TRACKS)."]]
                  .map(([t, v], i) => (
                    <li key={t} className="flex gap-4"><b className="font-pixel text-[26px] leading-none text-yellow">{i + 1}</b><span><B>{t}.</B> {v}</span></li>
                  ))}
              </ol>
            </div>
            <p className="m-0 mt-6 max-w-[44em] text-[15px] text-dim">Each track also has eight patterns (SEQ → PATTERNS), a chain of them (CHAIN) and scenes that switch every track at once (SCENES, or hold SEQ
              and tap SAVE). Autosave keeps your working loop 2.5 s after you stop touching anything.</p>
          </Section>

          <Section id="sounds" kicker="11 · Sounds" title="223 sounds on thirteen engines"
            intro="Turn PRESETS on TRACKS: the sound browser opens. KNOB 1 synth / drums, PRESETS or KNOB 2 the engine, ALGORITHM or KNOB 3 the sound, SELECT the view (by engine or by kind), KNOB 4 a favourite. SAVE keeps the sound, HOME puts back the one you had.">
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
                <Screen src={shot("pages/save-presets")} alt="The sound browser: the engines on the left, their sounds on the right" color="blue" />
              </figure>
              <div className="grid min-w-0 flex-[1_1_420px] grid-cols-1 content-start gap-1.5 min-[600px]:grid-cols-2">
                {ENGINES.map(([e, v]) => <div key={e} className="pixel-panel px-3 py-2"><b className="block font-pixel text-[16px] text-blue">{e}</b><span className="text-[14px] text-dim">{v}</span></div>)}
              </div>
            </div>
            <p className="m-0 mt-6 text-[15px]">Each engine's eight parameters are on <B>EDIT 1</B> and <B>EDIT 2</B>. Save your own on <B>SAVE → USER</B> (32 slots). Up to three
              tracks can play the big engines (GRAIN, WHEEL, FM6, PHYS, OBERVAVE) at once.</p>
          </Section>

          <Section id="menu" kicker="12 · Settings" title="The HOME menu" intro="Hold HOME for 0.7 s. Hold it again to leave. Six sections of FM-1 settings, with the MIDI pages inside SEQ.">
            <MenuExplorer />
          </Section>

          <Section id="visualiser" kicker="13 · Show" title="The visualiser" intro="On TRACKS, tap HOME: the screen becomes a visualiser of what plays. SELECT picks the style; HOME or any page button closes it. The keys, PLAY, REC and the layers keep working.">
            <div className="grid grid-cols-2 gap-6 min-[700px]:grid-cols-3">
              {VISUALISER.map(([t, v, img], i) => (
                <figure key={t} className="m-0 min-w-0">
                  <Screen src={shot(img)} alt={`The ${t} visualiser: ${v}`} color={["orange", "blue", "green", "yellow"][i % 4]} />
                  <figcaption className="mt-4"><b className="block font-pixel text-[16px] text-fg">{t}</b><span className="text-[14px] text-dim">{v}</span></figcaption>
                </figure>
              ))}
            </div>
          </Section>

          <Section id="special" kicker="14 · Special" title="Power-on and other combinations">
            <Steps items={SPECIAL} />
            <p className="m-0 mt-6 text-[15px]">Something wrong with a button or knob? Run the <B>hardware calibration</B> (hold HOME → SYSTEM). To reinstall or go back to the official
              firmware, use the <a href="../installer/" className="text-blue">installer</a>.</p>
          </Section>

          <Section id="where" kicker="15 · Find it" title="Where is…?">
            <WhereIs />
          </Section>

          <p className="m-0 py-12 text-[15px]">This page is the map. The <a href={`${GITHUB}/blob/main/GUIDE.md`} className="text-blue">complete guide</a> has every
            detail, and the <a href="../emu/" className="text-blue">emulator</a> lets you try it all in the browser.</p>
        </main>
      </div>

      <footer className="border-t-4 border-line">
        <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-12 text-[13px] text-dim">
          BoopBox is based on <a href="https://github.com/isod89/sloop-fm1">SLOOP</a>, itself based on Felucca by Leo Kuroshita (@kurogedelic), Hügelton Instruments. GPL-3.0, no
          warranty. M-VAVE and FM-1 are trademarks of their respective owners; BoopBox is not affiliated with them.
        </div>
      </footer>
    </div>
  );
}
