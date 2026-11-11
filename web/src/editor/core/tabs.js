// SPDX-License-Identifier: GPL-3.0-only
// The editor's pages: one at a time; the last one is remembered (localStorage) and in the URL hash (#sound ...).
import { A, hasTracks, notify, op } from "./app.js";
import { H } from "./hooks.js";

export const TABS = ["live", "sound", "sequencer", "patterns", "tracks", "song", "projects", "library", "samples", "kits", "drumsynth", "settings", "theme"];
export const TAB_KEY = "felucca-editor-tab";
export const TRACK_TABS = new Set(["sound", "sequencer", "tracks"]);
/* the side bar, grouped by what you came to do: [heading key, [tab, its name's key, its icon] ...]; each page says in
   a line what it is for (tabd_*, tabh_*) */
export const NAV = [
  ["navPlay", [["live", "tabLive", "note_eight"]]],
  ["navTrack", [["sound", "sound", "symbol_audio"], ["sequencer", "tabSeq", "symbol_grid"], ["patterns", "tabPatterns", "symbol_folder"],
    ["tracks", "tabTracks", "ui_slider_vertical"]]],
  ["navSong", [["song", "tabSong", "control_arrow_loop"], ["projects", "projects", "port_disk"]]],
  ["navSounds", [["library", "library", "symbol_books"], ["samples", "samples", "symbol_waves"], ["kits", "tabKits", "symbol_drum"],
    ["drumsynth", "tabDrumSynth", "function_env_adsr_exp"]]],
  ["navDevice", [["settings", "tabSettings", "symbol_cog"], ["theme", "tabTheme", "ui_knob"]]],
];
export const TAB_NAME = Object.fromEntries(NAV.flatMap(([, tabs]) => tabs.map(([tab, name]) => [tab, name])));
/* the pages that need an FM-1 (the Library and the Theme work without one) */
export const DEV_TABS = new Set(TABS.filter((x) => x !== "library" && x !== "theme"));

export function initialTab() {
  const h = location.hash.slice(1);
  if (TABS.includes(h)) return h;
  try { const v = localStorage.getItem(TAB_KEY); if (TABS.includes(v)) return v; } catch (e) { /* no storage */ }
  return "sound";
}

/* the page that shows: the Tracks page only with a firmware that has tracks */
export function shownTab() {
  const dev = A.dev;
  return A.tab === "tracks" && dev && dev.info && !hasTracks() ? "sound" : A.tab;
}
export const tracksTabOk = () => !A.dev || hasTracks() || !A.dev.info;

export function showTab(name) {
  if (!TABS.includes(name)) name = "sound";
  const prev = A.tab;
  A.tab = name;
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* no storage */ }
  if (location.hash !== "#" + name) history.replaceState(null, "", location.pathname + location.search + "#" + name);
  notify();
  if (name === "tracks" && prev !== "tracks" && hasTracks() && A.dev.dump) op(() => H.readMixer());
}

export function initTabs() {
  A.tab = initialTab();
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== A.tab) showTab(h); });
}
