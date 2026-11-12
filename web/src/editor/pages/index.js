// SPDX-License-Identifier: GPL-3.0-only
// The editor's pages: a component for each tab (core/tabs.js TABS). A page module may also export init(), run once when
// the editor starts (to register its hooks for the core, core/hooks.js, or to open its storage).
import * as live from "./Live.jsx";
import * as sound from "./Sound.jsx";
import * as sequencer from "./Sequencer.jsx";
import * as patterns from "./Patterns.jsx";
import * as song from "./Song.jsx";
import * as save from "./Projects.jsx";
import * as library from "./Library.jsx";
import * as slots from "./Slots.jsx";
import * as settings from "./Settings.jsx";
import * as theme from "./Theme.jsx";
import * as preview from "./Preview.jsx";
import * as mixer from "./Tracks.jsx";

const MODULES = { live, sound, sequencer, patterns, song, save, library, slots, settings, theme };
export const PAGES = Object.fromEntries(Object.entries(MODULES).map(([k, m]) => [k, m.default]));
/* the local audio preview (?mock=1): in the transport bar's drawer at the bottom of every page but LIVE */
export const Preview = preview.default;
export function initPages() {
  /* (the mixer's logic: the strips' reads and writes, for LIVE and the track bar; core/hooks.js H.readMixer ...) */
  for (const m of [...Object.values(MODULES), preview, mixer]) if (m.init) m.init();
}
