# The BoopBox website

The installer, the web editor and the browser emulator: React pages built with [Vite](https://vite.dev) and styled
with [Tailwind CSS](https://tailwindcss.com) v4. `web/make_site.py` packages them with the current firmware for Replit.

```sh
npm ci                   # once (Node.js 20 or newer)
npm run dev              # http://localhost:5173/installer/  /editor/  /emu/
                         # the editor with ?mock=1: a simulated FM-1, no hardware (and the firmware's own audio
                         # in the browser when build/preview/boopbox-preview.wasm is built)
npm run build            # -> ../build/webapp-vite/
npm run build:offline    # -> ../build/webapp-offline/editor/index.html: the editor in one file, for the disk
node test_web.mjs        # the tests that need no browser
```

## Where things are

| | |
|---|---|
| `site/installer/`, `site/editor/`, `site/emu/` | the three pages' `index.html` (Vite's entry points) |
| `site/public/` | files served as they are: the audio worklets, the icon font's licence |
| `src/installer/` | the installer; `src/lib/fm1pkg.js` and `fm1ota.js`: packages and the update protocol |
| `src/emu/` | the emulator page; `engine.js` starts the firmware's WebAssembly in an AudioWorklet |
| `src/editor/lib/` | no React, no DOM: `proto.js` (the editor's SysEx protocol, file formats, sample pipeline and mock device, see `EDITOR_PROTOCOL.md`), `text.js` (every string), `glyphs.js` (the icons), `preview.js` (the local audio) |
| `src/editor/core/` | the editor's state and the FM-1 under it: `app.js` (the shared state, strings, helpers), `device.js` (connecting, SET, the pushes, polling), `tabs.js`, `hooks.js`, `shared.js` |
| `src/editor/ui/kit.jsx` | cards, icons, and the device's parameter knobs |
| `src/editor/pages/` | a page a tab (`Live.jsx`, `Sound.jsx` ...), each with its own folder for its parts |
| `src/editor/editor.css`, `src/styles/site.css` | Tailwind's theme: the FM-1's palette and the pixel font |
| `sw.js` | the site without internet (`make_site.py` fills in what it keeps) |

## How the editor works

The FM-1 is the source of truth and talks over SysEx: requests, replies and pushes. The device logic in
`core/` and in each page's modules works on plain objects, the way the firmware's own state is laid out: `A.dev`
holds what was read from the FM-1 (its parameters, the selected track's DUMP, its steps, its mixer ...), and each page
keeps its own state object (the LIVE page's `LV`, the Patterns page's `PT` ...). Whatever changes them calls
`notify()`; every component that called `useApp()` then renders again from them. So a SET sent while you drag a knob,
a push from the FM-1 and a poll all go through the same objects, and the controls show what the device has.

Tailwind's theme carries the FM-1's colours (`bg-s1`, `text-dim`, `text-trk` for the selected track's colour,
`t1`..`t8` for the tracks) and its Terminus pixel font; native controls get the device's look once in `editor.css`,
so a plain `<button>` or `<select>` in a page already fits.
