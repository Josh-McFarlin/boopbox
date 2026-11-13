# The BoopBox website

The home page, the guide, the installer, the web editor and the browser emulator: React 19 pages in strict
TypeScript, built with [Vite](https://vite.dev) and styled with [Tailwind CSS](https://tailwindcss.com) v4. The code
follows the conventions of [create-react-app-vite](https://github.com/ryota-murakami/create-react-app-vite), with one
difference: components and pages are styled only with Tailwind utility classes, never `.css` or `.module.css` files.
`web/make_site.py` packages the pages with the current firmware for Replit; they are served from the site's root
(`/`, `/guide/`, `/installer/`, `/editor/`, `/emu/`).

```sh
npm ci                   # once (Node.js 22.18 or newer)
npm run dev              # http://localhost:5173/home/  /guide/  /installer/  /editor/  /emu/
                         # the editor with ?mock=1: a simulated FM-1, no hardware (and the firmware's own audio
                         # in the browser when build/preview/boopbox-preview.wasm is built)
npm run build            # -> ../project/build/webapp-vite/
npm run build:offline    # -> ../project/build/webapp-offline/editor/index.html: the editor in one file, for the disk
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint (eslint-config-ts-prefixer); lint:fix to fix
npm run prettier         # Prettier (single quotes, no semicolons, Tailwind class order)
npm test                 # Vitest (src/**/*.test.tsx) and test_web.mjs (the checks that need no browser)
npm run validate         # test, lint:fix, typecheck and build at once
```

A pre-commit hook (husky + lint-staged) runs Prettier and `eslint --fix` on the staged files; `.github/workflows/web.yml`
runs lint, typecheck, test and build on pull requests.

## Conventions

- **Layout.** `src/pages/<Page>/index.tsx` is a page's root component and `main.tsx` its entry (the `site/<page>/index.html`
  loads it); a page's own parts live in its folder. Shared components are in `src/components/`, modules without React
  in `src/lib/`, global type declarations in `src/@types/`, fonts in `src/assets/fonts/`.
- **TypeScript.** `strict`; types for every prop and state object. Node runs some modules directly (the tests import
  `src/lib/*.ts`, `src/pages/Rooms/*.ts`, `src/pages/Editor/lib/proto.ts` with Node's type stripping), so only erasable
  syntax (no `enum`, `namespace` or parameter properties), `import type` for types, and relative imports keep their
  `.ts` / `.tsx` extension. `@/` is an alias for `src/`.
- **Components.** A page's root is `const Name: React.FC = () => …` with `Name.displayName`; props are typed
  interfaces; conditional classes with `clsx`. Every page is wrapped in `components/ErrorBoundary.tsx`.
- **Styling: Tailwind only.** Classes go on the elements; class strings shared by many elements are exported constants
  (`components/styles.ts`, `pages/Editor/ui/styles.ts`, `pages/Emulator/classes.ts`, `pages/Rooms/styles.ts` ...).
  The only CSS files are the two global themes in `src/styles/`: `@import "tailwindcss"`, fonts, `@theme` tokens
  (colours, fonts, animations) and `@layer base` rules for bare HTML elements — no class selectors.

## Where things are

|                                                |                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site/<page>/index.html`                       | the pages' HTML (Vite's entry points)                                                                                                                                                                                                                                        |
| `site/public/`                                 | files served as they are: the audio worklets, the icon font's licence                                                                                                                                                                                                        |
| `src/pages/Home/`                              | the home page                                                                                                                                                                                                                                                                |
| `src/pages/Installer/`                         | the installer; `src/lib/fm1pkg.ts` and `fm1ota.ts`: packages and the update protocol                                                                                                                                                                                         |
| `src/pages/Guide/`                             | the visual guide: `index.tsx` lays out the sections that `data/sections.ts` lists; `sections/` holds each section's body, `components/` the shared parts (`Panel.tsx`, the FM-1's panel as SVG, and the explorers), `data/` every word and screen it shows (from `GUIDE.md`) |
| `src/pages/Emulator/`                          | the emulator page; `engine.ts` starts the firmware's WebAssembly in an AudioWorklet                                                                                                                                                                                          |
| `src/pages/Rooms/`                             | the jam rooms (not in the public build yet)                                                                                                                                                                                                                                  |
| `src/pages/Editor/lib/`                        | no React, no DOM: `proto.ts` (the editor's SysEx protocol, file formats, sample pipeline and mock device, see `EDITOR_PROTOCOL.md`), `text.ts` (every string), `glyphs.ts` (the icons), `preview.ts` (the local audio)                                                       |
| `src/pages/Editor/core/`                       | the editor's state and the FM-1 under it: `app.ts` (the shared state `A`, strings, helpers), `device.ts` (connecting, SET, the pushes, polling), `tabs.ts`, `hooks.ts`, `shared.ts`                                                                                          |
| `src/pages/Editor/ui/`                         | `kit.tsx`: cards, icons, and the device's parameter knobs; `styles.ts`: the shared class strings (`bar`, `seg`, `tog`, `pri`, `warn`, `help`, `title`, `icon` ...)                                                                                                           |
| `src/pages/Editor/tabs/`                       | a page a tab (`Live.tsx`, `Sound.tsx` ...), each with its own folder for its parts                                                                                                                                                                                           |
| `src/components/`                              | the site header, the logo, the error boundary, the site's shared class strings                                                                                                                                                                                               |
| `src/styles/site.css`, `src/styles/editor.css` | Tailwind's themes: the site's "pocket arcade" palette; the FM-1's palette and pixel font                                                                                                                                                                                     |
| `sw.js`                                        | the site without internet (`make_site.py` fills in what it keeps)                                                                                                                                                                                                            |

## How the editor works

The FM-1 is the source of truth and talks over SysEx: requests, replies and pushes. The device logic in
`core/` and in each page's modules works on plain objects, the way the firmware's own state is laid out: `A.dev`
holds what was read from the FM-1 (its parameters, the selected track's DUMP, its steps, its mixer ...), and each page
keeps its own state object (the LIVE page's `LV`, the Patterns page's `PT` ...). Whatever changes them calls
`notify()`; every component that called `useApp()` then renders again from them. So a SET sent while you drag a knob,
a push from the FM-1 and a poll all go through the same objects, and the controls show what the device has.

Tailwind's theme carries the FM-1's colours (`bg-s1`, `text-dim`, `text-trk` for the selected track's colour,
`t1`..`t8` for the tracks) and its Terminus pixel font; native controls get the device's look once in `editor.css`
(`@layer base`), so a plain `<button>` or `<select>` in a page already fits, and `ui/styles.ts` holds the variants.
