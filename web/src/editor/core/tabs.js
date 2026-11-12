// SPDX-License-Identifier: GPL-3.0-only
// The editor's pages: one at a time; the last one is remembered (localStorage) and in the URL hash (#sound ...).
import { A, notify } from "./app.js";

export const TABS = ["live", "sound", "sequencer", "patterns", "song", "save", "library", "slots", "settings", "theme"];
export const TAB_KEY = "felucca-editor-tab";
export const TRACK_TABS = new Set(["sound", "sequencer"]);
/* the pages before 1.9.5's: their links still work. The Mixer is part of LIVE; Samples, Drum kit and Drum synth are the
   three modes of Sample slots (A.slotMode) */
export const OLD_TABS = { tracks: ["live"], projects: ["save"], samples: ["slots", "samples"], kits: ["slots", "kits"], drumsynth: ["slots", "drumsynth"] };
export const SLOT_MODES = ["samples", "kits", "drumsynth"];
const MODE_KEY = "felucca-editor-slots";
/* the side bar, grouped by what you came to do: [heading key, [tab, its name's key, its icon] ...]; one line per page,
   and the page's name is the same in the side bar, its title and its URL (#save is "Save & load") */
export const NAV = [
  ["navPlay", [["live", "tabLive", "note_eight"]]],
  ["navTrack", [["sound", "sound", "symbol_audio"], ["sequencer", "tabSeq", "symbol_grid"], ["patterns", "tabPatterns", "symbol_folder"]]],
  ["navSong", [["song", "tabSong", "control_arrow_loop"], ["save", "projects", "port_disk"]]],
  ["navSounds", [["library", "library", "symbol_books"], ["slots", "tabSlots", "symbol_waves"]]],
  ["navDevice", [["settings", "tabSettings", "symbol_cog"], ["theme", "tabTheme", "ui_knob"]]],
];
export const TAB_NAME = Object.fromEntries(NAV.flatMap(([, tabs]) => tabs.map(([tab, name]) => [tab, name])));
/* the pages that need an FM-1 (the Library and the Theme work without one) */
export const DEV_TABS = new Set(TABS.filter((x) => x !== "library" && x !== "theme"));

/* a hash or a stored name -> [the tab, the Sample slots mode] (or null) */
function resolve(h) {
  if (TABS.includes(h)) return [h, null];
  if (OLD_TABS[h]) return OLD_TABS[h];
  return null;
}

export function initialTab() {
  try { const m = localStorage.getItem(MODE_KEY); if (SLOT_MODES.includes(m)) A.slotMode = m; } catch (e) { /* no storage */ }
  const fromHash = resolve(location.hash.slice(1));
  let stored = null;
  try { stored = resolve(localStorage.getItem(TAB_KEY)); } catch (e) { /* no storage */ }
  const r = fromHash || stored;
  if (r && r[1]) A.slotMode = r[1];
  return r ? r[0] : "sound";
}

/* the page that shows */
export const shownTab = () => A.tab;

/* the Sample slots page's mode: Samples (instruments), Drum kit (WAV drums), Drum synth */
export function setSlotMode(m) {
  if (!SLOT_MODES.includes(m)) return;
  A.slotMode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* no storage */ }
  notify();
}

export function showTab(name) {
  const r = resolve(name);
  if (!r) name = "sound";
  else { name = r[0]; if (r[1]) setSlotMode(r[1]); }
  A.tab = name;
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* no storage */ }
  if (location.hash !== "#" + name) history.replaceState(null, "", location.pathname + location.search + "#" + name);
  notify();
}

export function initTabs() {
  if (!A.slotMode) A.slotMode = "samples";
  A.tab = initialTab();
  if (location.hash.slice(1) !== A.tab) history.replaceState(null, "", location.pathname + location.search + "#" + A.tab);
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (resolve(h) && h !== A.tab) showTab(h); });
}
