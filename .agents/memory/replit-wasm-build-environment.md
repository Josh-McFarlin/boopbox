---
name: Replit WASM build environment
description: Replit-specific toolchain and Python-package behavior for building the browser firmware emulator.
---

On this Replit Nix environment, the `clang` command is a wrapper that can inject host linker flags into a `wasm32` build. Use an unwrapped Clang matching the installed wrapper version and its matching resource headers when building the emulator. Python Nix packages may be present in the Nix store but unavailable to the `python3` selected by build scripts; declare Python build libraries through the language-package flow instead. Post-merge and workflow builds share ignored outputs such as `build/emu/mem.o`, so serialize the complete build command with one shared lock.

**Why:** The emulator build failed first on missing Pillow and then on wrapper-only linker arguments and mismatched Clang headers. A post-merge build also failed while its shared intermediate object was missing, so overlapping setup and workflow builds must not write the same build directory concurrently.

**How to apply:** When the browser-emulator WebAssembly build fails in Replit, check the active compiler wrapper, its matching raw compiler/resource directory, and the project's Python dependency manifest before changing firmware code. Keep the workflow build and post-merge dependency/build steps under the same lock.
