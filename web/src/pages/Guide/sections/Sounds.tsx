// SPDX-License-Identifier: GPL-3.0-only
// 11 · Sounds: the sound browser and the thirteen engines.
import { B, Screen } from "../components/ui.tsx";
import { shot } from "../data/screens.ts";
import { ENGINES } from "../data/sounds.ts";
import { pixelPanel } from "../../../components/styles.ts";

export default function Sounds() {
  return (
    <>
      <div className="flex flex-wrap gap-x-10 gap-y-8">
        <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
          <Screen src={shot("pages/save-presets")} alt="The sound browser: the engines on the left, their sounds on the right" color="blue" />
        </figure>
        <div className="grid min-w-0 flex-[1_1_420px] grid-cols-1 content-start gap-1.5 min-[600px]:grid-cols-2">
          {ENGINES.map(([e, v]) => <div key={e} className={`${pixelPanel} px-3 py-2`}><b className="block font-pixel text-[16px] text-blue">{e}</b><span className="text-[14px] text-dim">{v}</span></div>)}
        </div>
      </div>
      <p className="m-0 mt-6 text-[15px]">Each engine's eight parameters are on <B>EDIT 1</B> and <B>EDIT 2</B>. Save your own on <B>SAVE → USER</B> (32 slots). Up to three
        tracks can play the big engines (GRAIN, WHEEL, FM6, PHYS, OBERVAVE) at once.</p>
    </>
  );
}
