# Running BoopBox on Replit

## Preview

Use Run to start the **BoopBox website** workflow:

```sh
npm run build && node server.js
```

The build compiles the React/Vite pages, then the Node server serves those pages
alongside the firmware downloads and WebAssembly files already in `docs/`. It
also runs the in-memory room and WebSocket service on the same port. No database
or external service is needed.

## Publishing on a Reserved VM

The production build command is `npm run build`; the run command is
`node server.js`. The server binds to the port supplied by Replit (`5000` by
default) on `0.0.0.0`. Rooms keep state only in that single running process, so
publishing must use **Reserved VM** rather than a stateless target.

Pages:

- `/` — home
- `/webapp/editor/` — hardware editor
- `/webapp/editor/?mock=1` — editor with a simulated FM-1
- `/webapp/emu/` — browser emulator
- `/webapp/rooms/` — live music room browser and player
- `/webapp/installer/` — firmware installer

Hardware MIDI and installation need a connected FM-1 and a compatible browser
(Chrome or Edge). If the embedded preview restricts MIDI access, open the preview
in a separate browser tab. Rooms support factory synth presets and factory drum
kits only; custom patches and sample data are not transmitted. Starting the
website does not install any firmware.

## Source development

`npm run build` writes the room and source-page output into ignored
`build/webapp-vite/`; the Node server serves it without replacing the firmware
files in `docs/`.

The existing web dependencies are installed under `web/`. To work directly on
the React source, stop the website workflow before running another server on
port 5000:

Use the configured website workflow for a full room session. To work on the
Vite source in isolation, run `cd web && npm ci && npm run dev`; the room page
expects the Node server for its WebSocket connection.
See `BUILDING.md` and `web/make_site.py` for assembling a complete site after
source or firmware changes. Do not replace `docs/` with only Vite's output:
that would omit the firmware and other release assets.

Checks:

```sh
npm test
npm audit --omit=dev
cd web && npm test && npm run build
```

The root build command runs `npm ci` for `web/` before building the pages.
