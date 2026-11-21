---
name: Replit site hosting
description: The user's hosting decision and which project files remain release inputs.
---

Replit is the canonical public website host. The user approved retiring the generated GitHub Pages website after moving its installer and release dependencies to the Replit build.

**Why:** The user chose Replit hosting and confirmed the migration rather than keeping a second generated website in sync.

**How to apply:** Keep source documentation under `docs/` and versioned firmware packages under `project/firmware/releases/`; generate deployable pages during the Replit build (into `project/build/replit-site/`) instead of committing generated website output.
