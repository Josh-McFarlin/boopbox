// SPDX-License-Identifier: GPL-3.0-only
// The FM-1's panel as one SVG, laid out as the real one: four knobs and OCT−/OCT+ on the left, the screen, KNOB 1–4 and
// the twelve buttons on the right, 11 black and 16 white keys below. Every control is a button: a click (or Enter)
// selects it. A layer (FX, SEQ…) shows as its button held, its labels on the keys and knobs, and its screen.
import { BLACK, BLACK_AFTER, WHITE } from "../data/keys.ts";
import type { ReactNode } from "react";
import { C } from "../data/theme.ts";
import type { Layer } from "../data/layers.ts";

const LINE = "var(--body)";
const INK = "#160d2b";
const KNOBS: [id: string, x: number, y: number, label?: string][] = [["MASTER", 167, 143], ["SELECT", 352, 143], ["PRESETS", 167, 303], ["ALGORITHM", 352, 303],
  ["KNOB1", 985, 143, "KNOB1"], ["KNOB2", 1175, 143, "KNOB2"], ["KNOB3", 1367, 143, "KNOB3"], ["KNOB4", 1560, 143, "KNOB4"]];
const ROW1 = ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO"];
const ROW2 = ["HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC"];
const BX = [930, 1048, 1166, 1284, 1401, 1518];
const SILK = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "PIT", "GLO", "MONO", "POLY", ""];   /* printed on the black keys */
const WX = (i: number) => 84 + i * 98;   /* left edge of white key i */
const BCX = (j: number) => WX(BLACK_AFTER[j]) + 44 + 49;   /* centre of black key j: between its two white keys */

interface HitProps {
  id: string;
  label: string;
  sel: string;
  onSel: (id: string) => void;
  children?: ReactNode;
}

function Hit({ id, label, sel, onSel, children }: HitProps) {
  return (
    <g role="button" tabIndex={0} aria-label={label} aria-pressed={sel === id} className="cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-[var(--fg)]"
      onClick={() => onSel(id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSel(id); } }}>
      <title>{label}</title>
      {children}
    </g>
  );
}

/* a label on a key: short ones across, long ones along the key (two words: two lines) */
interface KeyLabelProps {
  x: number;
  y: number;
  h: number;
  text: string;
  color: string;
  size?: number;
}

function KeyLabel({ x, y, h, text, color, size = 21 }: KeyLabelProps) {
  if (!text) return null;
  if (text.length <= 3)
    return <text x={x} y={y + h - 22} textAnchor="middle" fontSize={size + 3} fill={color} className="font-pixel" pointerEvents="none">{text}</text>;
  const words = text.split(" ");
  const lines = words.length > 1 && text.length > 8 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [text];
  return (
    <text transform={`translate(${x} ${y + h / 2}) rotate(-90)`} textAnchor="middle" fontSize={size} fill={color} className="font-pixel" pointerEvents="none">
      {lines.map((l, i) => <tspan key={i} x="0" dy={i === 0 ? (lines.length === 1 ? 7 : -5) : 24}>{l}</tspan>)}
    </text>
  );
}

interface PanelProps {
  layer: Layer;
  sel: string;
  onSel: (id: string) => void;
  screen?: string;
}

export default function Panel({ layer, sel, onSel, screen }: PanelProps) {
  const lc = C[layer.color];
  const held = layer.button;
  const selKey = (k: string) => sel === k;
  return (
    <svg viewBox="0 0 1772 880" className="block h-auto w-full select-none" role="group" aria-label="The FM-1 panel: select a control">
      <rect x="20" y="22" width="1732" height="838" rx="64" fill="var(--tile)" stroke={LINE} strokeWidth="5" />

      {/* knobs */}
      {KNOBS.map(([id, x, y]) => {
        const name = id.startsWith("KNOB") ? id.replace("KNOB", "KNOB ") : id;
        const on = selKey(id);
        const fn = id.startsWith("KNOB") ? layer.knobs[+id[4] - 1] : null;
        return (
          <Hit key={id} id={id} label={name} sel={sel} onSel={onSel}>
            {on ? <circle cx={x} cy={y} r="54" fill="none" stroke={lc} strokeWidth="6" /> : null}
            <circle cx={x} cy={y} r="44" fill="#000" stroke={on ? "var(--fg)" : LINE} strokeWidth="5" />
            <circle cx={x} cy={y} r="31" fill="#000" stroke="#3a3a3a" strokeWidth="4" />
            <line x1={x} y1={y - 30} x2={x} y2={y - 14} stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            <text x={x} y={y - 62} textAnchor="middle" fontSize="27" fontWeight="700" fill="var(--fg)" className="font-pixel">{name}</text>
            {fn && fn !== "—" ? <text x={x} y={y + 76} textAnchor="middle" fontSize="23" fill={lc} className="font-pixel">{fn}</text> : null}
          </Hit>
        );
      })}

      {/* octave buttons */}
      {([["OCTM", "OCT−", 104], ["OCTP", "OCT+", 264]] as const).map(([id, name, x]) => (
        <Hit key={id} id={id} label={name} sel={sel} onSel={onSel}>
          <rect x={x} y="372" width="144" height="68" rx="16" fill={selKey(id) ? lc : "var(--deep)"} stroke={selKey(id) ? "var(--fg)" : LINE} strokeWidth="5" />
          <text x={x + 72} y="416" textAnchor="middle" fontSize="27" fontWeight="700" fill={selKey(id) ? INK : "var(--fg)"} className="font-pixel">{name}</text>
        </Hit>
      ))}

      {/* the screen */}
      <rect x="470" y="66" width="398" height="380" rx="44" fill="var(--deep)" stroke={LINE} strokeWidth="5" />
      <rect x="519" y="106" width="300" height="300" rx="6" fill="#0e081d" stroke={LINE} strokeWidth="4" />
      {screen ? <image href={screen} x="521" y="108" width="296" height="296" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated" }} /> : null}

      {/* the twelve buttons */}
      <rect x="905" y="232" width="740" height="226" rx="34" fill="none" stroke={LINE} strokeWidth="5" />
      {[ROW1, ROW2].map((row, r) => row.map((id, i) => {
        const isHeld = held === id, on = selKey(id) || isHeld;
        const y = r ? 352 : 256;
        return (
          <Hit key={id} id={id} label={id === "PLAY" ? "PLAY / STOP" : id} sel={sel} onSel={onSel}>
            <rect x={BX[i]} y={y} width="105" height="80" rx="16" fill={on ? lc : "var(--deep)"} stroke={selKey(id) ? "var(--fg)" : LINE} strokeWidth="5" />
            {id === "PLAY" ? (
              <>
                <text x={BX[i] + 52} y={y + 34} textAnchor="middle" fontSize="23" fontWeight="700" fill={on ? INK : "var(--fg)"} className="font-pixel">PLAY</text>
                <line x1={BX[i] + 22} y1={y + 42} x2={BX[i] + 83} y2={y + 42} stroke={on ? INK : "var(--fg)"} strokeWidth="3" />
                <text x={BX[i] + 52} y={y + 66} textAnchor="middle" fontSize="23" fontWeight="700" fill={on ? INK : "var(--fg)"} className="font-pixel">STOP</text>
              </>
            ) : <text x={BX[i] + 52} y={y + 50} textAnchor="middle" fontSize="27" fontWeight="700" fill={on ? INK : "var(--fg)"} className="font-pixel">{id}</text>}
          </Hit>
        );
      }))}

      {/* the keybed */}
      <rect x="60" y="487" width="1598" height="340" rx="44" fill="none" stroke={LINE} strokeWidth="5" />
      {[480, 775, 1163, 1458].map((x) => <circle key={x} cx={x} cy="638" r="7" fill={LINE} />)}
      <text transform="translate(1722 700) rotate(-90)" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--fg)" className="font-pixel">FM1</text>

      {WHITE.map((n, i) => {
        const id = `W${i}`, on = selKey(id), x = WX(i);
        const landmark = held && i % 4 === 0;
        const label = layer.white[i];
        return (
          <Hit key={id} id={id} label={`White key ${i + 1} (${n})${label ? `: ${label}` : ""}`} sel={sel} onSel={onSel}>
            <rect x={x} y="650" width="88" height="156" rx="42" fill={on ? lc : landmark ? "color-mix(in srgb, var(--deep) 70%, " + lc + ")" : "var(--deep)"}
              stroke={on ? "var(--fg)" : label && held ? lc : LINE} strokeWidth="5" />
            <text x={x + 44} y="676" textAnchor="middle" fontSize="16" fill={on ? INK : "var(--dim)"} className="font-pixel" pointerEvents="none">{i + 1}</text>
            <KeyLabel x={x + 44} y={680} h={126} text={label} color={on ? INK : held ? lc : "var(--body)"} />
          </Hit>
        );
      })}
      {BLACK.map((n, j) => {
        const id = `B${j}`, on = selKey(id), cx = BCX(j);
        const label = layer.black[j];
        return (
          <Hit key={id} id={id} label={`Black key ${n}${label ? `: ${label}` : ""}`} sel={sel} onSel={onSel}>
            <rect x={cx - 44} y="500" width="88" height="140" rx="42" fill={on ? lc : "var(--bg)"} stroke={on ? "var(--fg)" : label && held ? lc : LINE} strokeWidth="5" />
            {held || layer.id === "DRUM" ? <KeyLabel x={cx} y={506} h={130} text={label} size={19} color={on ? INK : lc} />
              : (
                <>
                  <line x1={cx} y1="528" x2={cx} y2="566" stroke={LINE} strokeWidth="5" strokeLinecap="round" />
                  <text x={cx} y="604" textAnchor="middle" fontSize="20" fill={on ? INK : "var(--dim)"} className="font-pixel" pointerEvents="none">{SILK[j]}</text>
                  <text x={cx} y="626" textAnchor="middle" fontSize="16" fill={on ? INK : "var(--dim)"} className="font-pixel" pointerEvents="none">{n}</text>
                </>
              )}
          </Hit>
        );
      })}
    </svg>
  );
}
