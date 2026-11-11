// SPDX-License-Identifier: GPL-3.0-only
import { createRoot } from "react-dom/client";
import "../styles/site.css";
import { registerServiceWorker } from "../shared/pwa.js";
import Installer from "./Installer.jsx";

registerServiceWorker();
createRoot(document.getElementById("root")).render(<Installer meta={window.BOOPBOX_META} />);
