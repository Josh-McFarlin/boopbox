// SPDX-License-Identifier: GPL-3.0-only
// 13 · The visualiser's six styles.
import { Screen } from "../components/ui.jsx";
import { shot } from "../data/screens.js";
import { VISUALISER } from "../data/visualiser.js";

const SHADOWS = ["orange", "blue", "green", "yellow"];

export default function Visualiser() {
  return (
    <div className="grid grid-cols-2 gap-6 min-[700px]:grid-cols-3">
      {VISUALISER.map(([t, v, img], i) => (
        <figure key={t} className="m-0 min-w-0">
          <Screen src={shot(img)} alt={`The ${t} visualiser: ${v}`} color={SHADOWS[i % 4]} />
          <figcaption className="mt-4"><b className="block font-pixel text-[16px] text-fg">{t}</b><span className="text-[14px] text-dim">{v}</span></figcaption>
        </figure>
      ))}
    </div>
  );
}
