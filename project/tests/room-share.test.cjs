// SPDX-License-Identifier: GPL-3.0-only
// The jam rooms: which of a device's tracks the room can play, and why the others are muted (device.ts unsharedTracks).
const assert = require("node:assert/strict");
const test = require("node:test");

/* a track's TRACK_DUMP: engine, preset, the 71 parameters (P_E0 = 63) */
function dump(engine, preset, edits = {}) {
  const p = new Array(71).fill(0);
  for (const [id, value] of Object.entries(edits)) p[Number(id)] = value;
  return { engine, preset, p };
}

test("factory sounds of every engine are shared, the device's own are muted with a reason", async () => {
  const { unsharedTracks } = await import("../../web/src/pages/Rooms/device.ts");
  const shared = [
    dump(0, 21),              /* ANALOG's last factory preset (22 since BoopBox 1.x) */
    dump(4, 10, { 63: 7 }),   /* SAMPLE, a factory set */
    dump(8, 0, { 63: 3 }),    /* GRAIN on a factory set */
    dump(9, 0, { 70: 7 }),    /* FM6, a factory patch */
    dump(13, 0, { 63: 36 }),  /* the last factory drum kit */
    dump(6, 13),
    dump(3, 7, { 64: 4 }),    /* LOFI's fifth wave */
    dump(12, 69),
  ];
  assert.deepEqual(unsharedTracks(shared), []);

  const own = [
    dump(4, 0, { 63: 8 }),    /* SAMPLE on USR1 */
    dump(8, 0, { 63: 11 }),   /* GRAIN on USR4 */
    dump(9, 0, { 70: 8 }),    /* FM6, a patch from the bank */
    dump(13, 0, { 63: 37 }),  /* USR1 as a kit */
    dump(0, 22),              /* past the factory presets */
    dump(14, 0),              /* no such engine */
    dump(0, 0),
    dump(13, 0, { 63: 41 }),  /* SYN1 */
  ];
  assert.deepEqual(unsharedTracks(own), [
    { track: 0, reason: "your own sample (USR)" },
    { track: 1, reason: "your own sample (USR)" },
    { track: 2, reason: "a patch from your FM6 bank" },
    { track: 3, reason: "your own drum kit (USR or SYN)" },
    { track: 4, reason: "a preset rooms don't know yet" },
    { track: 5, reason: "an engine rooms can't play" },
    { track: 7, reason: "your own drum kit (USR or SYN)" },
  ]);
});
