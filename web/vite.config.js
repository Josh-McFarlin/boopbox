// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox site: React + Vite + Tailwind. Pages under site/, relative URLs
// everywhere (base "./"), so the build drops into the site's webapp/ folder as it is (web/make_site.py).
//
//   npm run dev                      the pages at http://localhost:5173/home/ /installer/ /editor/ /emu/ (editor: ?mock=1
//                                    for a simulated FM-1)
//   npm run build                    -> ../project/build/webapp-vite/        (make_site.py copies it into webapp/)
//   npm run build:offline            -> ../project/build/webapp-offline/editor/index.html: the editor in one file, for the
//                                    disk (fonts and scripts inlined, no service worker, no download link)
import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SITE = resolve(HERE, "site");
const BUILD = resolve(HERE, "..", "project", "build");

/* the dev server also serves the WebAssembly built apart from the pages (make_site.py copies them into the site):
   the emulators' (project/tools/build_emu.py, and --trainer) at /emu/, the editor's audio preview (project/tools/build_preview.py) at /editor/ */
const WASM = { "/emu/boopbox-emu.wasm": resolve(BUILD, "emu/boopbox-emu.wasm"),
               "/emu/boopbox-trainer-emu.wasm": resolve(BUILD, "emu/boopbox-trainer-emu.wasm"),
               "/editor/boopbox-preview.wasm": resolve(BUILD, "preview/boopbox-preview.wasm") };
const devWasm = {
  name: "boopbox-dev-wasm",
  configureServer(server) {
    /* the pages load ../../src/...: in the dev server that URL is /src/... (above the root, site/): serve web/src */
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith("/src/")) req.url = "/@fs" + resolve(HERE, req.url.slice(1)).replace(/\\/g, "/");
      next();
    });
    server.middlewares.use((req, res, next) => {
      const f = WASM[(req.url || "").split("?")[0]];
      if (!f || !existsSync(f)) return next();
      res.setHeader("Content-Type", "application/wasm");
      createReadStream(f).pipe(res);
    });
  },
};

export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  return {
    root: SITE,
    base: "./",
    publicDir: offline ? false : resolve(SITE, "public"),
    plugins: [react(), tailwindcss(), devWasm, ...(offline ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    define: { __OFFLINE__: JSON.stringify(offline) },
    server: { fs: { allow: [HERE, resolve(HERE, "..")] } },
    build: {
      outDir: resolve(BUILD, offline ? "webapp-offline" : "webapp-vite"),
      emptyOutDir: true,
      assetsInlineLimit: offline ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: offline
          ? { editor: resolve(SITE, "editor/index.html") }
          : {
              home: resolve(SITE, "home/index.html"),
              installer: resolve(SITE, "installer/index.html"),
              editor: resolve(SITE, "editor/index.html"),
              emu: resolve(SITE, "emu/index.html"),
            },
      },
    },
  };
});
