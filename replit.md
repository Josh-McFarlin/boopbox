# Running BoopBox on Replit

## Preview

Use Run to start the **BoopBox website** workflow:

```sh
npm run build && node server.js
```

The build compiles the React/Vite pages and assembles the complete site under
`build/replit-site/` from `web/` and `firmware/releases/`. The Node server serves
the pages, firmware downloads, WebAssembly files, and in-memory room/WebSocket
service on the same port. No database or external service is needed.

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

`npm run build` writes the complete generated site into ignored
`build/replit-site/`. Keep source documentation in `docs/` and versioned
firmware packages in `firmware/releases/`; the build assembles them without
committing generated website output.

The existing web dependencies are installed under `web/`. To work directly on
the React source, stop the website workflow before running another server on
port 5000:

Use the configured website workflow for a full room session. To work on the
Vite source in isolation, run `cd web && npm ci && npm run dev`; the room page
expects the Node server for its WebSocket connection.
See `BUILDING.md` and `web/make_site.py` for assembling a complete site after
source or firmware changes.

Checks:

```sh
npm test
npm audit --omit=dev
cd web && npm test && npm run build
```

The root build command runs `npm ci` for `web/` before building the pages.
