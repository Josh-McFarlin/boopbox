# Running BoopBox on Replit

## Preview

Use Run to start the **BoopBox website** workflow:

```sh
npm run build && node server.js
```

The build compiles the React/Vite pages and assembles the complete site under
`project/build/replit-site/` from `web/` and `project/firmware/releases/`. The Node server serves
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
- `/webapp/installer/` — firmware installer
- `/webapp/home/` redirects to `/`

Jam rooms are temporarily hidden from navigation and public builds. Their source,
server implementation, and tests remain in the project for later reactivation.

Hardware MIDI and installation need a connected FM-1 and a compatible browser
(Chrome or Edge). If the embedded preview restricts MIDI access, open the preview
in a separate browser tab. Starting the website does not install any firmware.

## Source development

`npm run build` writes the complete generated site into ignored
`project/build/replit-site/`. Keep source documentation in `docs/` and versioned
firmware packages in `project/firmware/releases/`; the build assembles them without
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
