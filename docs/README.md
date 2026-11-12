# Technical documentation

This folder contains documentation and design references—not website output or
firmware release packages. The public guides and release notes remain at the
repository root. Firmware, assets, tools, scripts, tests and generated build
files are grouped under `project/`. Technical notes may use paths such as
`firmware/src/` relative to that folder; run their firmware build commands from
`project/` unless a command explicitly targets root-level `web/` or `docs/`.

## Firmware and device

- [Architecture](groovebox-architecture.md)
- [Controls](groovebox-controls.md)
- [Performance and release-package measurements](groovebox-performance.md)
- [Status](groovebox-status.md)
- [Storage](groovebox-storage.md)
- [NRPN reference](NRPN.md)
- [Trainer notes](trainer.md)

## Analysis and design

- [Memory-savings analysis](memory-savings-analysis.md)
- [UX review images and notes](ux-review/README.md)

Versioned `.fwsc` release packages are kept in
[`project/firmware/releases/`](../project/firmware/releases/). The generated website is built
under `project/build/replit-site/`.
