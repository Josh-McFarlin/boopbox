---
name: Room musical ownership
description: Product rule for sharing FM-1 performances in jam rooms.
---

Each room participant keeps their own patterns, scenes, chains, and sequences. Room playback mixes each participant's performance; it must not copy or overwrite another participant's musical arrangement. Share supported factory-sound, preset, and performance changes automatically while connected; do not require a manual publish or share step. Restrict sound sources to firmware stock sounds, not user samples or custom presets.

**Why:** The user wants jamming to work like friends playing their own FM-1 devices together, with only sound selection restricted and each device change reflected automatically.

**How to apply:** Keep sequence and arrangement state attached to the player in room protocols and local renderers. Revalidate sound state after device voice reloads so later control changes continue syncing automatically. Validate factory sound identifiers separately from the player's bounded musical data.
