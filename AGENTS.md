# Notes for agents working on BoopBox

Read [README.md](README.md) for the project layout and [BUILDING.md](BUILDING.md) for the build, the tests and the
generated pictures. Notes from earlier work are in [.agents/memory/](.agents/memory/MEMORY.md).

## When you change the firmware, update everything that describes it

A change to what BoopBox does (a feature, a page, a control, a sound, a number such as presets, engines, kits or
effects) is not finished until the text and the pictures that describe it match. In the same change, check and update:

1. **The guides.** [GUIDE.md](GUIDE.md) (the complete guide) and [BOOPBOX.md](BOOPBOX.md) (the manual). Also the feature
   list in [README.md](README.md).
2. **The website.** The pages are in `web/src/pages/`: the home page, the visual guide (`Guide/sections/`,
   `Guide/data/`), the installer, the editor and the emulator. A page or control that changed on the FM-1 often also
   changes in the web editor and in the guide page's text.
3. **The pictures.** The screenshots are made by code, not by hand (BUILDING.md has the details). Make them again
   when a screen they show has changed:
   - `python3 project/tools/make_screens.py`: the README sheets and `project/assets/screens/fm1/` (the website uses
     these, and so does the hub card).
   - `python3 project/tools/make_all_screens.py`: every screen, in `project/assets/screens/all/`.
   - `node project/tools/make_editor_screens.mjs`: the web editor's screenshots (build `web/` first).
4. **The Firmware Hub card.** [fmhub.json](fmhub.json) is BoopBox's card on The Firmware Hub
   (thefirmwarehub.com). The hub reads it from `main` every three hours. Keep it true:
   - `what`: what this version is and does, in plain English. 20 to 300 characters, with no links, HTML, code or the
     characters `<` `>` `{` `}` and backticks. Update it when a feature or a number in it changes.
   - `image`: a square PNG, WebP or JPEG, 240×240 to 1024×1024 and 300 KB at most. It is
     `project/assets/screens/fm1/tracks-1-4.png`; if that file is renamed or removed, change the path here.
   - `sounds`: where every sample in the repository and the package comes from. When you add, remove or replace
     samples, update this line, and also [LICENSING.md](LICENSING.md) and [CREDITS.md](CREDITS.md). Do not write this
     line on your own judgement: ask the maintainer, who answers for it.
   - `play` and `editor`: update them if the emulator or editor moves.
   - Use only the fields the hub allows: `what`, `author`, `kinds`, `play`, `editor`, `cheat`, `image`, `color`,
     `sounds`, `smk37`. Any other field makes the hub ignore the whole file. The full rules are at
     <https://thefirmwarehub.com/fmhub.md>.
   - Check that the JSON is valid: `python3 -m json.tool fmhub.json`.
5. **The changelog.** A release needs a `## X.Y.Z` section in [CHANGELOG.md](CHANGELOG.md) (CI checks it).

## The package identity

The identity is `FM-1_2667` + the build digit + the version (`identity()` in `project/tools/build.py`; BUILDING.md
explains it). The Firmware Hub needs it to be unique, so do not change the `2667` prefix. Do not change the loader's
`ota-FM-1_900` either: hosts resume an interrupted update by that name.
