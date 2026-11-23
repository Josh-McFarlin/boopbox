---
name: Version bumps
description: Never bump the firmware version unless the maintainer asks.
---

Do not change `FELUCCA_VERSION` (project/firmware/src/ui.c), add a `boopbox-X.Y.Z.fwsc` release package, or give
CHANGELOG.md a numbered section on your own. Put new entries under `## Unreleased`.

**Why:** The maintainer decides when a release happens and said they will ask for each version bump.

**How to apply:** Keep the version as it is in every change. Version tags in guides and comments may name the expected
next version, but say so when you report the work.
