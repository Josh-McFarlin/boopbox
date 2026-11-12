---
name: Replit WASM build environment
description: Replit-specific toolchain and Python-package behavior for building the browser firmware emulator.
---

On this Replit Nix environment, the `clang` command is a wrapper that can inject host linker flags into a `wasm32` build. Use an unwrapped Clang matching the installed wrapper version and its matching resource headers when building the emulator. Python Nix packages may be present in the Nix store but unavailable to the `python3` selected by build scripts; declare Python build libraries through the language-package flow instead.

**Why:** The emulator build failed first on missing Pillow and then on wrapper-only linker arguments and mismatched Clang headers.

**How to apply:** When the browser-emulator WebAssembly build fails in Replit, check the active compiler wrapper, its matching raw compiler/resource directory, and the project's Python dependency manifest before changing firmware code.
