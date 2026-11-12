# Running BoopBox on Replit

## Preview

Use Run to start the **BoopBox website** workflow:

```sh
python3 -m http.server 5000 --bind 0.0.0.0 --directory docs
```

This serves the complete, prebuilt website already included in the imported
repository. It preserves the existing React/Vite source layout and includes
the firmware packages and WebAssembly files without requiring a firmware compiler.
No secrets, database, or external services are needed to view it.

## Publishing on a Reserved VM

The production run command is `node server.js`. It serves the prebuilt site
from `docs/` on the port supplied by Replit (`5000` by default), bound on
`0.0.0.0`. In Publishing settings, select **Reserved VM** and map external
port 80 to local port 5000 before publishing. Replit requires the deployment
type to be selected in the Publishing tool; it cannot be switched by changing
the project file alone.

Pages:

- `/` — home
- `/webapp/editor/` — hardware editor
- `/webapp/editor/?mock=1` — editor with a simulated FM-1
- `/webapp/emu/` — browser emulator
- `/webapp/installer/` — firmware installer

Hardware MIDI and installation need a connected FM-1 and a compatible browser
(Chrome or Edge). If the embedded preview restricts MIDI access, open the preview
in a separate browser tab. Starting the website does not install any firmware.

## Source development

The served `docs/` directory is a prebuilt snapshot: changes in `web/src/` do
not automatically update it.

The existing web dependencies are installed under `web/`. To work directly on
the React source, stop the website workflow before running another server on
port 5000:

```sh
cd web
npm ci
npm run dev -- --host 0.0.0.0 --port 5000 --strictPort --allowedHosts
```

Vite's development pages are `/home/`, `/editor/`, `/editor/?mock=1`,
`/installer/`, and `/emu/`. This source server expects separately built WASM
under `build/`; its installer intentionally has no release metadata.
See `BUILDING.md` and `web/make_site.py` for assembling a complete site after
source or firmware changes. Do not replace `docs/` with only Vite's output:
that would omit the firmware and other release assets.

Checks:

```sh
cd web
npm test
npm run build
npm audit
```

`npm run build` writes ignored output into `build/webapp-vite/`, not `docs/`.
The Python HTTP server is for development preview; `server.js` is the
production server for publishing the existing prebuilt site.
