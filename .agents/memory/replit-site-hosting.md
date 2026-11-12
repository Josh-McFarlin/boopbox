---
name: Replit site hosting
description: The user's hosting decision and which project files remain release inputs.
---

Replit is the canonical public website host. The user approved retiring the generated GitHub Pages website after moving its installer and release dependencies to the Replit build.

**Why:** The user chose Replit hosting and confirmed the migration rather than keeping a second generated website in sync.

**How to apply:** Keep source documentation and versioned firmware packages under `docs/`; generate deployable pages during the Replit build instead of committing generated website output there.
