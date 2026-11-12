---
name: Room browser identity
description: Product scope for limiting a browser to one active jam room.
---

Room exclusivity is scoped to one same-origin browser profile. It does not identify a person or link separate browsers, private sessions, storage resets, or devices.

**Why:** The user chose browser-only identity for room limits rather than IP-based identity.

**How to apply:** Keep the limit within the browser profile. Do not use IP addresses as person identifiers or add account-based, cross-device enforcement without asking the user.
