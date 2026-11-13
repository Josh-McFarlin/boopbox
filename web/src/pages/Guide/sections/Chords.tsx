// SPDX-License-Identifier: GPL-3.0-only
// 09 · Harmony: chord modes, CHORD+ on the black keys, SEL 2 and the song's progression.
import { B, H3, Kbd } from "../components/ui.tsx";
import { CHORD_MODES, CHORDS_PLUS } from "../data/harmony.ts";
import { C } from "../data/theme.ts";
import { pixelPanel } from "../../../components/styles.ts";

export default function Chords() {
  return (
    <>
      <div className="grid grid-cols-1 gap-8 min-[800px]:grid-cols-2">
        <div>
          <h3 className={`${H3} !text-green`}>One finger, one chord</h3>
          <p className="m-0 mb-4 text-[15px]">Hold SEL and turn KNOB 1. With a chord mode on, the white keys walk the scale from C4: C4 plays the I chord, D4 the II… Every chord
            is built from the scale, so it always fits.</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CHORD_MODES.map(([k, v]) => <div key={k} className={`${pixelPanel} px-3 py-2`}><b className="block font-pixel text-[16px] text-fg">{k}</b><span className="text-[14px] text-dim">{v}</span></div>)}
          </div>
        </div>
        <div>
          <h3 className={`${H3} !text-green`}>CHORD+: the black keys change the chord</h3>
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
    </>
  );
}
