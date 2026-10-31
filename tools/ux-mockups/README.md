# UX review mockups

`mock.py` draws the proposed screens of the UX review (`docs/ux-review/README.md`) at the FM-1's 240 × 240, in the
firmware's own font (Terminus 16 bold from `assets/fonts`, and 2× of it as the large size) and its MONO colours. It
puts each mockup beside the screen as the firmware draws it today, taken from `assets/screens/all/`
(`tools/make_all_screens.py`).

```
python3 tools/ux-mockups/mock.py [OUT_DIR]      # default: docs/ux-review
```

They are drawings, not firmware: nothing here runs on the FM-1.
