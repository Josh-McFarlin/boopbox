// SPDX-License-Identifier: GPL-3.0-only
// 06 · The sequencer: steps, nudges, locks, fills, the NOTES page and divisions.
import { Card, Screen } from "../components/ui.tsx";
import { shot } from "../data/screens.ts";
import { SEQ_CARDS } from "../data/sequencer.ts";

export default function Sequencer() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
        {SEQ_CARDS.map(([t, v]) => <Card key={t} title={t} color="blue">{v}</Card>)}
      </div>
      <div className="mt-8 grid max-w-[600px] grid-cols-2 gap-5">
        <Screen src={shot("pages/seq-notes")} alt="The NOTES page: a piano roll of the track" color="blue" />
        <Screen src={shot("pages/seq-notes-sheet")} alt="The NOTES page with a note's sheet open" color="blue" />
      </div>
    </>
  );
}
