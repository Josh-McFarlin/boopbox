---
name: Room musical ownership
description: Product rule for sharing FM-1 performances in jam rooms.
---

Each room participant keeps their own patterns, scenes, chains, and sequences. Room playback mixes each participant's performance; it must not copy or overwrite another participant's musical arrangement. Restrict sound sources to firmware stock sounds, not user samples or custom presets.

**Why:** The user wants jamming to work like friends playing their own FM-1 devices together, with only sound selection restricted.

**How to apply:** Keep sequence and arrangement state attached to the player in room protocols and local renderers. Validate factory sound identifiers separately from the player's bounded musical data.
