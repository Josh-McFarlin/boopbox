// SPDX-License-Identifier: GPL-3.0-only
import { createRoot } from "react-dom/client";
import "../../styles/site.css";
import ErrorBoundary from "../../components/ErrorBoundary.tsx";
import { registerServiceWorker } from "../../lib/pwa.ts";
import Installer from "./index.tsx";
import type { InstallerMeta } from "./index.tsx";

declare global {
  interface Window {
    /** the package this page installs (site/installer/index.html; written by web/make_site.py, null in the dev server) */
    BOOPBOX_META?: InstallerMeta | null;
  }
}

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<ErrorBoundary><Installer meta={window.BOOPBOX_META} /></ErrorBoundary>);
