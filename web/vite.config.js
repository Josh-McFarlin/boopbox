// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox site: React + Vite + Tailwind. Three pages under site/ (installer/, editor/, emu/), relative URLs
// everywhere (base "./"), so the build drops into the site's webapp/ folder as it is (web/make_site.py).
//
//   npm run dev                      the pages at http://localhost:5173/installer/ /editor/ /emu/ (editor: ?mock=1
//                                    for a simulated FM-1)
//   npm run build                    -> ../build/webapp-vite/        (make_site.py copies it into webapp/)
//   npm run build:offline            -> ../build/webapp-offline/editor/index.html: the editor in one file, for the
//                                    disk (fonts and scripts inlined, no service worker, no download link)
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SITE = resolve(HERE, "site");

export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  return {
    root: SITE,
    base: "./",
    publicDir: offline ? false : resolve(SITE, "public"),
    plugins: [react(), tailwindcss(), ...(offline ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    define: { __OFFLINE__: JSON.stringify(offline) },
    server: { fs: { allow: [HERE] } },
    build: {
      outDir: resolve(HERE, "..", "build", offline ? "webapp-offline" : "webapp-vite"),
      emptyOutDir: true,
      assetsInlineLimit: offline ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: offline
          ? { editor: resolve(SITE, "editor/index.html") }
          : {
              installer: resolve(SITE, "installer/index.html"),
              editor: resolve(SITE, "editor/index.html"),
              emu: resolve(SITE, "emu/index.html"),
            },
      },
    },
  };
});
