// SPDX-License-Identifier: GPL-3.0-only
// Each section's body, by its id in data/sections.js.
import Basics from "./Basics.jsx";
import Chords from "./Chords.jsx";
import Drums from "./Drums.jsx";
import Effects from "./Effects.jsx";
import FirstBeat from "./FirstBeat.jsx";
import Menu from "./Menu.jsx";
import Pages from "./Pages.jsx";
import PanelSection from "./PanelSection.jsx";
import Recording from "./Recording.jsx";
import Sequencer from "./Sequencer.jsx";
import Song from "./Song.jsx";
import Sounds from "./Sounds.jsx";
import Special from "./Special.jsx";
import Visualiser from "./Visualiser.jsx";
import Where from "./Where.jsx";

export const BODIES = {
  panel: PanelSection, basics: Basics, first: FirstBeat, record: Recording, drums: Drums, steps: Sequencer, pages: Pages,
  effects: Effects, chords: Chords, song: Song, sounds: Sounds, menu: Menu, visualiser: Visualiser, special: Special, where: Where,
};
