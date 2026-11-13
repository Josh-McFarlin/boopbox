// SPDX-License-Identifier: GPL-3.0-only
// The FM-1's own screens, drawn by the firmware's code (project/tools/make_screens.py): shot("pages/env-env") is
// project/assets/screens/all/pages/env-env.png, bundled by Vite.
const SHOTS = import.meta.glob<string>("../../../../project/assets/screens/all/*/*.png", { eager: true, import: "default" });

export const shot = (name: string): string => SHOTS[`../../../../project/assets/screens/all/${name}.png`];
