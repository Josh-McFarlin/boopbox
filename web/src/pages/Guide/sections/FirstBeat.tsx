// SPDX-License-Identifier: GPL-3.0-only
// 03 · Tutorial: the first beat in eight steps; the selected step shows its screen.
import { useState } from "react";
import { Screen } from "../components/ui.tsx";
import { shot } from "../data/screens.ts";
import { C } from "../data/theme.ts";
import { FIRST_BEAT } from "../data/tutorial.ts";

export default function FirstBeat() {
  const [beat, setBeat] = useState(0);
  return (
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
  );
}
