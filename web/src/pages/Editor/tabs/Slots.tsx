// SPDX-License-Identifier: GPL-3.0-only
// The Sample slots page: the four user slots USR1..USR4 on the FM-1, filled three ways. Samples: WAV files as an
// instrument (the SAMPLE / SLICE engines). Drum kit: WAV files as a drum kit. Drum synth: synthesised drum kits SYN1..4.
// The mode is A.slotMode (core/tabs.js; the old #samples, #kits and #drumsynth links open it).
import type { FC } from "react";
import clsx from "clsx";
import { A, t, useApp } from "../core/app.ts";
import { SLOT_MODES, setSlotMode } from "../core/tabs.ts";
import type { SlotMode } from "../core/tabs.ts";
import { seg, tog } from "../ui/styles.ts";
import Samples from "./Samples.tsx";
import Kits from "./Kits.tsx";
import DrumSynth from "./DrumSynth.tsx";

/* a mode: its page, its name's key, its hint's key */
const MODE: Record<SlotMode, [page: FC, name: string, hint: string]> = { samples: [Samples, "slotsSamples", "slotsSamplesHint"], kits: [Kits, "slotsKits", "slotsKitsHint"],
  drumsynth: [DrumSynth, "slotsDrumSynth", "slotsDrumSynthHint"] };

export default function Slots() {
  const { dev } = useApp();
  const mode = SLOT_MODES.includes(A.slotMode) ? A.slotMode : "samples";
  /* Samples and Drum kit need the FM-1's sample flash; Drum synth does not */
  const needSmp = mode !== "drumsynth" && dev && !dev.smp;
  const [Page] = MODE[mode];
  return (
    <>
      <div role="tablist" aria-label={t("tabSlots")} className={clsx(seg, "mb-4")}>
        {SLOT_MODES.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={m === mode} aria-pressed={m === mode} className={tog} title={t(MODE[m][2])}
            onClick={() => setSlotMode(m)}>{t(MODE[m][1])}</button>
        ))}
      </div>
      {needSmp ? <p className="text-dim">{t("smpNone")}</p> : <Page />}
    </>
  );
}
