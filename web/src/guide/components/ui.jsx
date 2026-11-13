// SPDX-License-Identifier: GPL-3.0-only
// The guide's small building blocks: headings, bold text, key caps, a pixel screen, a section, tabs, the four knobs of a
// page and a grid of titled cards.
import { C, KNOB_C } from "../data/theme.js";

export const KICKER = "m-0 mb-3 inline-block bg-tile px-2.5 py-1 font-pixel text-[15px] font-medium text-blue";
export const H2 = "m-0 mb-4 font-pixel text-[32px] leading-none font-bold text-fg min-[600px]:text-[40px]";
export const H3 = "m-0 mb-2 font-pixel text-[22px] leading-tight font-bold text-fg";

export const B = ({ children }) => <b className="text-fg">{children}</b>;

/* a control's name as a key cap, in an accent colour or plain */
export const Kbd = ({ children, color }) => (
  <kbd className="inline-block border-2 px-1.5 py-px font-pixel text-[14px] leading-tight not-italic"
    style={{ borderColor: color || "var(--line)", color: color || "var(--fg)" }}>{children}</kbd>
);

/* one of the FM-1's screens, crisp, with an offset shadow in an accent */
export function Screen({ src, alt, color = "orange", className = "" }) {
  return <img src={src} alt={alt} width="240" height="240" loading="lazy" className={`pixel-screen ${className}`} style={{ boxShadow: `8px 8px 0 ${C[color]}` }} />;
}

/* a section of the page: its kicker, heading and lead paragraph, then its body */
export function Section({ id, kicker, title, intro, children }) {
  return (
    <section id={id} className="scroll-mt-6 border-b-4 border-line py-16 first:pt-10">
      {kicker ? <p className={KICKER}>{kicker}</p> : null}
      <h2 className={H2}>{title}</h2>
      {intro ? <p className="m-0 mb-8 max-w-[44em] text-body">{intro}</p> : null}
      {children}
    </section>
  );
}

/* a row of tabs: items are [key, label, accent?] */
export function Tabs({ items, value, onChange, label, color = "blue" }) {
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
export function Knobs({ values }) {
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

/* [title, text] pairs as small cards, two a row on wide screens */
export const Steps = ({ items }) => (
  <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[700px]:grid-cols-2">
    {items.map(([k, v]) => (
      <li key={k} className="pixel-panel px-4 py-3"><b className="block font-pixel text-[17px] text-fg">{k}</b><span className="text-[15px]">{v}</span></li>
    ))}
  </ol>
);

/* a titled card: title (in an accent), an optional line under it, the text */
export function Card({ title, color = "blue", sub, children }) {
  return (
    <div className="pixel-panel p-5">
      <h3 className={H3} style={{ color: C[color] }}>{title}</h3>
      {sub ? <p className="m-0 mb-1 font-pixel text-[14px] text-dim">{sub}</p> : null}
      <p className="m-0 text-[15px]">{children}</p>
    </div>
  );
}
