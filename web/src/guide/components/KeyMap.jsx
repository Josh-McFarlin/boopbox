// SPDX-License-Identifier: GPL-3.0-only
// A key map as the layer screens draw it: the white keys in four rows of four, the black keys below. A key whose label
// is its own note name just plays that note.
import { BLACK, WHITE } from "../data/keys.js";
import { C } from "../data/theme.js";

export default function KeyMap({ white, black, color }) {
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
