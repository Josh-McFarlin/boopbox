// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox editor: the FM-1's sounds, sequences, songs, samples and settings from the computer, over USB MIDI
// (EDITOR_PROTOCOL.md). ?mock=1: a simulated FM-1 (and the firmware's own audio in the browser, when built).
import { createRoot } from "react-dom/client";
import "@fontsource/jersey-10/latin-400.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "./editor.css";
import { A, sayK } from "./core/app.js";
import { startDeviceLoops } from "./core/device.js";
import { initTabs } from "./core/tabs.js";
import { loadIconFont } from "./ui/kit.jsx";
import { registerServiceWorker } from "../shared/pwa.js";
import { initPages } from "./pages/index.js";
import App from "./App.jsx";

document.documentElement.lang = A.lang;
initTabs();
initPages();
startDeviceLoops();
loadIconFont();
registerServiceWorker();
if (!A.MOCK && !navigator.requestMIDIAccess) sayK("nomidi");
createRoot(document.getElementById("root")).render(<App />);
