# UX review pictures

`mock.py` makes the before / after pictures of the UX review (`docs/ux-review/README.md`): a screen as 1.1.0 drew
it and as 1.2.0 draws it, side by side, both from the firmware's own code in SYNTHWAVE. Before 1.2.0 it drew the
proposals by hand; now that they are built, the pictures are the real screens.

```
cp -r assets/screens/all /tmp/before          # before the change
python3 tools/make_all_screens.py             # after it
python3 tools/ux-mockups/mock.py /tmp/before assets/screens/all
python3 tools/make_before_after.py /tmp/before assets/screens/all docs/ux-review/before-after-all.png
```

`tools/make_before_after.py` puts every screen of the two galleries side by side in one large image.
