#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""The jam rooms' list of shareable sounds (shared/room-config.json) against the firmware (tests/room_config_dump.c).

A room shares a track's sound as an engine, a factory preset and the allowlisted sound controls; a track whose
sound is outside the list is played muted (web/src/pages/Rooms/device.ts). When the firmware gains presets, kits or
a wider control and the list is not updated, factory sounds go silent in the rooms. This checks:
  - one preset count per engine, each the firmware's;
  - the factory drum kits, all of them and nothing past them (USR, SYN: the player's own);
  - every allowlisted control is a real control with the firmware's range, except a sample source (SAMPLE's SET,
    GRAIN's SRC), which stops at the factory sets (the rest are the player's USR slots);
  - FM6's factory patches are the patch values the page accepts (device.ts: presetCounts[9]).

  tests/room_config_test.py DUMP.json shared/room-config.json
"""
import json
import sys


def main():
    fw = json.load(open(sys.argv[1]))
    cfg = json.load(open(sys.argv[2]))
    engines = fw["engines"]
    errors = []
    if len(cfg["presetCounts"]) != len(engines):
        errors.append(f"presetCounts has {len(cfg['presetCounts'])} engines, the firmware {len(engines)}")
    if len(cfg["engineNames"]) != len(engines):
        errors.append(f"engineNames has {len(cfg['engineNames'])} engines, the firmware {len(engines)}")
    for e, (count, eng) in enumerate(zip(cfg["presetCounts"], engines)):
        if count != eng["presets"]:
            errors.append(f"engine {e} {eng['name']}: presetCounts {count}, the firmware has {eng['presets']} presets")
    if cfg["shareableDrumKits"] != list(range(fw["factory_kits"])):
        errors.append(f"shareableDrumKits should be 0..{fw['factory_kits'] - 1} (the factory kits)")
    if cfg["presetCounts"][9] != fw["fm6_factory_patches"]:
        errors.append(f"FM6: device.ts accepts PTCH < presetCounts[9] = {cfg['presetCounts'][9]}, "
                      f"the firmware has {fw['fm6_factory_patches']} factory patches")
    if str(fw["fm6_patch"]) in cfg["shareableParameters"].get("9", {}):
        errors.append("FM6's PTCH is allowlisted: its values past the factory patches are the player's bank")
    for e, allow in cfg["shareableParameters"].items():
        eng = engines[int(e)]
        for pid, rng in allow.items():
            if pid not in eng["edit"]:
                errors.append(f"engine {e} {eng['name']}: {pid} is not one of its sound controls")
                continue
            label, lo, hi = eng["edit"][pid]
            want = [lo, hi]
            if int(e) in cfg.get("sampleSourceEngines", []) and pid == "63":
                want = [0, fw["factory_sample_sets"] - 1]
            if label == "-":
                errors.append(f"engine {e} {eng['name']}: {pid} is an unused control")
            elif rng != want:
                errors.append(f"engine {e} {eng['name']}: {pid} {label} allowlisted {rng}, should be {want}")
    for e in cfg.get("sampleSourceEngines", []):
        if "63" not in cfg["shareableParameters"].get(str(e), {}):
            errors.append(f"engine {e}: a sample source engine without its source (63) in the allowlist")
    for err in errors:
        print("room config:", err)
    if errors:
        print("room config: shared/room-config.json does not match the firmware")
        return 1
    print(f"room config: {len(engines)} engines, {sum(e['presets'] for e in engines)} factory presets, "
          f"{fw['factory_kits']} factory kits, {fw['factory_sample_sets']} factory sample sets: as the firmware")
    return 0


if __name__ == "__main__":
    sys.exit(main())
