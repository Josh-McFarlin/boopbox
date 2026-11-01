### How to install

**From the browser (recommended):** open [the BoopBox installer](https://josh-mcfarlin.github.io/boopbox/) in **Chrome or Edge** on a computer and connect the FM-1 by USB, with a **data** cable, directly (no hub). Press **INSTALL**, allow MIDI access, and wait for *Done*. The FM-1 restarts on the BoopBox logo. Your projects, user presets, samples and settings are kept. Then unplug the FM-1 and plug it back in once, so the computer finds its USB audio input.

The installer always installs the newest version. To install this one in particular, use Python:

**With Python:** download `@FILE@` from the assets below and [`fm1_install.py`](@BLOB@/tools/fm1_install.py), then run `python fm1_install.py @FILE@` (needs `pip install mido python-rtmidi`).

**Offline editor:** download `boopbox-editor-@VERSION@.html` from the assets and double-click it. It opens in Chrome or Edge without internet.

**If something goes wrong:** hold **OCT−** alone while switching the FM-1 on (*BoopBox USB RESCUE*), then install again. See [Rescue](@BLOB@/README.md#rescue) and [Going back](@BLOB@/README.md#going-back) in the README.

> Custom firmware is installed at your own risk. No warranty.
