---
name: Mobile Web Audio activation
description: Keep emulator audio startup compatible with mobile browser user-activation rules.
---

Call `AudioContext.resume()` in the same synchronous user-gesture turn that creates the context, before awaiting firmware fetches, compilation, or worklet loading.

**Why:** Mobile browsers, especially iOS Safari, may no longer consider the original tap active after asynchronous loading. Resuming only after that work can leave the emulator silent.

**How to apply:** When adding or changing audio startup behind a button or touch control, begin `resume()` immediately and await its promise together with the required setup work.
