// SPDX-License-Identifier: GPL-3.0-only
// 08 · Effects: the 27 punch-ins on the keys, the master effects and the effects of each track.
import KeyMap from "../components/KeyMap.jsx";
import { B, Card } from "../components/ui.jsx";
import { EFFECTS } from "../data/effects.js";
import { LAYERS } from "../data/layers.js";

const PUNCH = LAYERS.find((l) => l.id === "FX");

export default function Effects() {
  return (
    <>
      <p className="m-0 mb-6 max-w-[44em]"><B>Hold FX and hold a key</B>: 27 effects on the whole mix, for as long as you hold it. Loops and the gate start on the grid.
        FX + SELECT sets a fade-in and fade-out. FX → PERF chooses what they act on, latches them or quantises their start.</p>
      <KeyMap white={PUNCH.white} black={PUNCH.black} color="orange" />
      <div className="mt-10 grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
        {EFFECTS.map(([t, how, v]) => <Card key={t} title={t} color="orange" sub={how}>{v}</Card>)}
      </div>
      <p className="m-0 mt-6 text-[14px] text-dim">Signal path: engine → drive → INSERT → SLICER → filter → level and DUCK → pan and sends. Then the whole mix → DUST → punch-ins → DJ
        filter → MASTER → limiter.</p>
    </>
  );
}
