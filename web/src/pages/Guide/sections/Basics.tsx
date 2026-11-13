// SPDX-License-Identifier: GPL-3.0-only
// 02 · The big ideas: the eight tracks and their colours; tap, hold and lock.
import { Card, B } from "../components/ui.tsx";
import { IDEAS, TRACKS } from "../data/basics.ts";
import { C } from "../data/theme.ts";

export default function Basics() {
  return (
    <>
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
        {IDEAS.map(([t, c, v]) => <Card key={t} title={t} color={c}>{v}</Card>)}
      </div>
      <p className="m-0 mt-6 max-w-[44em] text-[15px] text-dim">Inside any layer PLAY still starts and stops, SELECT sets the tempo, and ALGORITHM and PRESETS wait. Keys 1, 5, 9
        and 13 glow dimly: the first key of each row of tiles, so you can find a tile without looking.</p>
    </>
  );
}
