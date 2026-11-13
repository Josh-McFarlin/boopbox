// SPDX-License-Identifier: GPL-3.0-only
// The editor's pages: one at a time; the last one is remembered (localStorage) and in the URL hash (#sound ...).
import { A, notify } from "./app.ts";

export const TABS = ["live", "sound", "sequencer", "patterns", "song", "save", "library", "slots", "settings", "theme"] as const;
/* a page of the editor */
export type Tab = (typeof TABS)[number];
export const TAB_KEY = "felucca-editor-tab";
export const TRACK_TABS: ReadonlySet<Tab> = new Set<Tab>(["sound", "sequencer"]);
/* the pages before 1.9.5's: their links still work. The Mixer is part of LIVE; Samples, Drum kit and Drum synth are the
   three modes of Sample slots (A.slotMode) */
export const OLD_TABS: Record<string, [Tab, SlotMode?]> = { tracks: ["live"], projects: ["save"], samples: ["slots", "samples"], kits: ["slots", "kits"], drumsynth: ["slots", "drumsynth"] };
export const SLOT_MODES = ["samples", "kits", "drumsynth"] as const;
/* the Sample slots page's modes */
export type SlotMode = (typeof SLOT_MODES)[number];
const isTab = (x: string | null): x is Tab => (TABS as readonly (string | null)[]).includes(x);
const isSlotMode = (x: string | null): x is SlotMode => (SLOT_MODES as readonly (string | null)[]).includes(x);
const MODE_KEY = "felucca-editor-slots";
/* the side bar, grouped by what you came to do: [heading key, [tab, its name's key, its icon] ...]; one line per page,
   and the page's name is the same in the side bar, its title and its URL (#save is "Save & load") */
export const NAV: [string, [Tab, string, string][]][] = [
  ["navPlay", [["live", "tabLive", "note_eight"]]],
  ["navTrack", [["sound", "sound", "symbol_audio"], ["sequencer", "tabSeq", "symbol_grid"], ["patterns", "tabPatterns", "symbol_folder"]]],
  ["navSong", [["song", "tabSong", "control_arrow_loop"], ["save", "projects", "port_disk"]]],
  ["navSounds", [["library", "library", "symbol_books"], ["slots", "tabSlots", "symbol_waves"]]],
  ["navDevice", [["settings", "tabSettings", "symbol_cog"], ["theme", "tabTheme", "ui_knob"]]],
];
export const TAB_NAME = Object.fromEntries(NAV.flatMap(([, tabs]) => tabs.map(([tab, name]) => [tab, name]))) as Record<Tab, string>;
/* the pages that need an FM-1 (the Library and the Theme work without one) */
export const DEV_TABS: ReadonlySet<Tab> = new Set(TABS.filter((x) => x !== "library" && x !== "theme"));

/* a hash or a stored name -> [the tab, the Sample slots mode] (or null) */
function resolve(h: string | null): [Tab, (SlotMode | null)?] | null {
  if (isTab(h)) return [h, null];
  if (h !== null && OLD_TABS[h]) return OLD_TABS[h];
  return null;
}

export function initialTab(): Tab {
  try { const m = localStorage.getItem(MODE_KEY); if (isSlotMode(m)) A.slotMode = m; } catch (e) { /* no storage */ }
  const fromHash = resolve(location.hash.slice(1));
  let stored = null;
  try { stored = resolve(localStorage.getItem(TAB_KEY)); } catch (e) { /* no storage */ }
  const r = fromHash || stored;
  if (r && r[1]) A.slotMode = r[1];
  return r ? r[0] : "sound";
}

/* the page that shows */
export const shownTab = (): Tab => A.tab;

/* the Sample slots page's mode: Samples (instruments), Drum kit (WAV drums), Drum synth */
export function setSlotMode(m: string): void {
  if (!isSlotMode(m)) return;
  A.slotMode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* no storage */ }
  notify();
}

export function showTab(want: string): void {
  const r = resolve(want);
  let name: Tab;
  if (!r) name = "sound";
  else { name = r[0]; if (r[1]) setSlotMode(r[1]); }
  A.tab = name;
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* no storage */ }
  if (location.hash !== "#" + name) history.replaceState(null, "", location.pathname + location.search + "#" + name);
  notify();
}

export function initTabs(): void {
  if (!A.slotMode) A.slotMode = "samples";
  A.tab = initialTab();
  if (location.hash.slice(1) !== A.tab) history.replaceState(null, "", location.pathname + location.search + "#" + A.tab);
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (resolve(h) && h !== A.tab) showTab(h); });
}
