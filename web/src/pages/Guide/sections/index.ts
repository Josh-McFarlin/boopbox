// SPDX-License-Identifier: GPL-3.0-only
// Each section's body, by its id in data/sections.js.
import type { ComponentType } from "react";
import Basics from "./Basics.tsx";
import Chords from "./Chords.tsx";
import Drums from "./Drums.tsx";
import Effects from "./Effects.tsx";
import FirstBeat from "./FirstBeat.tsx";
import Menu from "./Menu.tsx";
import Pages from "./Pages.tsx";
import PanelSection from "./PanelSection.tsx";
import Recording from "./Recording.tsx";
import Sequencer from "./Sequencer.tsx";
import Song from "./Song.tsx";
import Sounds from "./Sounds.tsx";
import Special from "./Special.tsx";
import Visualiser from "./Visualiser.tsx";
import Where from "./Where.tsx";

export const BODIES: Record<string, ComponentType> = {
  panel: PanelSection, basics: Basics, first: FirstBeat, record: Recording, drums: Drums, steps: Sequencer, pages: Pages,
  effects: Effects, chords: Chords, song: Song, sounds: Sounds, menu: Menu, visualiser: Visualiser, special: Special, where: Where,
};
