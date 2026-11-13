// SPDX-License-Identifier: GPL-3.0-only
// 10 · Song mode: sections A–D, played, chained and recorded.
import { B, Screen } from "../components/ui.jsx";
import { shot } from "../data/screens.js";
import { SONG_STEPS } from "../data/song.js";

export default function Song() {
  return (
    <>
      <div className="flex flex-wrap gap-x-10 gap-y-8">
        <div className="grid w-full max-w-[420px] min-w-0 flex-[1_1_300px] grid-cols-2 gap-5">
          <Screen src={shot("layers/layer-save")} alt="SAVE held: the SONG layer, play and store A–D" color="yellow" />
          <Screen src={shot("pages/seq-song")} alt="The SONG screen: the section chain" color="yellow" />
        </div>
        <ol className="m-0 min-w-0 flex-[1_1_420px] list-none space-y-3 p-0">
          {SONG_STEPS.map(([t, v], i) => (
            <li key={t} className="flex gap-4"><b className="font-pixel text-[26px] leading-none text-yellow">{i + 1}</b><span><B>{t}.</B> {v}</span></li>
          ))}
        </ol>
      </div>
      <p className="m-0 mt-6 max-w-[44em] text-[15px] text-dim">Each track also has eight patterns (SEQ → PATTERNS), a chain of them (CHAIN) and scenes that switch every track at once (SCENES, or hold SEQ
        and tap SAVE). Autosave keeps your working loop 2.5 s after you stop touching anything.</p>
    </>
  );
}
