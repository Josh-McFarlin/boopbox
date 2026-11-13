// SPDX-License-Identifier: GPL-3.0-only
// "Where is…?": the list of where things are, filtered as you type.
import { useMemo, useState } from "react";
import { GUIDE_URL } from "../data/links.ts";
import { WHERE } from "../data/reference.ts";

export default function WhereIs() {
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
        {rows.length === 0 ? <p className="m-0 text-dim">Nothing found. The <a href={GUIDE_URL}>full guide</a> has everything.</p> : null}
      </div>
    </div>
  );
}
