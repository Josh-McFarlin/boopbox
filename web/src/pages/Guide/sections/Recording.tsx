// SPDX-License-Identifier: GPL-3.0-only
// 04 · Recording: what REC does, and the REC screen's knobs.
import { B, H3, Knobs, Screen, Steps } from "../components/ui.tsx";
import { REC_KNOBS, REC_STATES } from "../data/recording.ts";
import { shot } from "../data/screens.ts";

export default function Recording() {
  return (
    <>
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
    </>
  );
}
