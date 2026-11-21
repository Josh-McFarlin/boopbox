// SPDX-License-Identifier: GPL-3.0-only
// The jam rooms follow a player's FM-1 as it changes: track settings (level, pan, mute ...) as they move, and patterns
// asked for (PATTERNS, a scene; firmware protocol 14's PATS push), made by every listener at the player's PAT Q moment
// of the room's beat.
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const test = require("node:test");

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

test("the FM-1 connection passes on track settings and pattern requests as they happen", async () => {
  const { makeMockDevice } = await import("../../web/src/pages/Editor/lib/proto.ts");
  const { connectFm1 } = await import("../../web/src/pages/Rooms/device.ts");
  const mock = makeMockDevice({ auto: false });
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { requestMIDIAccess: async () => mock.access },
  });
  let device;
  try {
    const params = [];
    const asks = [];
    device = await connectFm1(() => {}, () => {}, () => {}, () => {}, () => {}, () => {},
      (...param) => params.push(param), (...ask) => asks.push(ask));
    await device.getPerformanceSnapshot();
    mock.sim.param(2, 0, 90);                               /* LEVEL of track 3 (not selected): TRACK_CHANGED */
    mock.sim.mute(true);                                    /* MUTE of the selected track: CHANGED */
    await wait(20);
    assert.deepEqual(params, [[2, 0, 90], [mock.state.sel, 40, 1]]);

    assert.equal(mock.sim.pats([-1, -1, 3, -1, -1, -1, -1, -1], 2), true, "the room asks for PATS (WATCH bit 2)");
    await wait(20);
    assert.deepEqual(asks, [[[-1, -1, 3, -1, -1, -1, -1, -1], 2]]);
    mock.sim.pats([-1, -1, 3, -1, -1, -1, -1, -1], 2);      /* the same request again (the FM-1 still waits): nothing new */
    await wait(20);
    assert.equal(asks.length, 1);
    mock.sim.pats(Array(8).fill(-1), 2, [0, 0, 3, 0, 0, 0, 0, 0]);   /* made: nothing asked */
    mock.sim.pats([5, 5, 5, 5, 5, 5, 5, 5], 0, [0, 0, 3, 0, 0, 0, 0, 0]);   /* a scene: every track */
    await wait(20);
    assert.deepEqual(asks[1], [[5, 5, 5, 5, 5, 5, 5, 5], 0]);
  } finally {
    device?.close();
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
  }
});

/* a performance of one player: track 1 has two patterns (C4 on step 1, G4 on step 1), the others are silent */
function performance(currentPattern = 0) {
  const pattern = (id, note) => ({
    id, length: 16, steps: note ? [[0, [note, 0, 0, 0, 1, 0, 0, 100, 0, 0]]] : [],
    micro: [], fill: [], locks: [], components: [], dir: 0, seed: 0,
  });
  const tracks = Array.from({ length: 8 }, (_, index) => ({
    index,
    kind: index === 3 || index === 7 ? 1 : 0,
    voice: index === 3 || index === 7 ? { engine: 13, kit: 5 } : { engine: 0, preset: 2, params: {} },
    parameters: [],
    currentPattern: index === 0 ? currentPattern : 0,
    chain: [],
    chainEnabled: false,
    patterns: Array.from({ length: 8 }, (_, id) => pattern(id, index === 0 ? [60, 67][id] : 0)),
  }));
  return {
    tempo: 120, playing: true, currentScene: null, tracks,
    scenes: { names: Array(8).fill(0), patterns: Array.from({ length: 8 }, (_, scene) => Array(8).fill(scene)) },
  };
}

test("a pattern request is made on the room's beat at PAT Q, and the performance after it does not restart it", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/rooms/" };
  try {
    const [{ RoomAudio }, { RoomFirmwareAudio }] = await Promise.all([
      import("../../web/src/pages/Rooms/audio.ts"),
      import("../../web/site/public/editor/preview-worklet.js"),
    ]);
    const module = await WebAssembly.compile(await readFile(resolve(__dirname, "../build/preview/boopbox-preview.wasm")));
    const audio = new RoomAudio(() => {});
    const messages = [];
    audio.node = { port: { postMessage: (message) => messages.push(message) }, disconnect() {} };
    const dsp = new RoomFirmwareAudio(module);
    const deliver = () => {
      for (const message of messages.splice(0)) {
        if (message.type === "state") dsp.sync(message.slot, message.group, message.state);
        else if (message.type === "ask") dsp.askPatterns(message.slot, message.asks, message.quantize);
      }
    };
    await audio.setPerformance(0, performance(0));
    deliver();
    const engine = dsp.players[0][0];
    let resets = 0;
    const reset = engine.w.preview_sequence_reset;
    engine.w = { ...engine.w, preview_sequence_reset: (...args) => { resets += 1; return reset(...args); } };
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    const seconds = (s) => { for (let i = 0; i < Math.round((s * 44_100) / 128); i += 1) dsp.render(left, right); };

    seconds(0.5);                                           /* a quarter of the way into bar 1 (120 BPM: 2 s a bar) */
    audio.askPatterns(0, [1, -1, -1, -1, -1, -1, -1, -1], 1);   /* the player asked for pattern 2, PAT Q 1 BAR */
    deliver();
    assert.equal(engine.w.preview_current(0) & 15, 0, "still pattern 1 until the bar");
    assert.equal(engine.w.preview_current(0) >> 4, 2, "pattern 2 asked for");
    seconds(1.3);                                           /* 1.8 s: not yet */
    assert.equal(engine.w.preview_current(0) & 15, 0);
    seconds(0.4);                                           /* past 2 s: bar 2 */
    assert.equal(engine.w.preview_current(0), 1, "pattern 2 from bar 2, nothing asked any more");

    await audio.setPerformance(0, performance(1));          /* the player's performance follows a little later */
    deliver();
    assert.equal(resets, 0, "no restart of the pattern already playing");

    await audio.setPerformance(0, performance(0));          /* a change with no request before it (an older FM-1) */
    deliver();
    assert.equal(resets, 1, "made at once, as before");
    assert.equal(engine.w.preview_current(0) & 15, 0);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});

test("a track setting from the room reaches the listener's engine", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/rooms/" };
  try {
    const { RoomAudio } = await import("../../web/src/pages/Rooms/audio.ts");
    const audio = new RoomAudio(() => {});
    const messages = [];
    audio.node = { port: { postMessage: (message) => messages.push(message) }, disconnect() {} };
    await audio.setPerformance(2, performance(0));
    await audio.setTrackParameter(2, 5, 0, 77);             /* LEVEL of track 6 (the second engine's track 2) */
    const state = messages.filter((m) => m.type === "state" && m.slot === 2 && m.group === 1).at(-1).state;
    assert.equal(state.tracks[1].p[0], 77);
    assert.deepEqual(audio.performances[2].tracks[5].parameters, [[0, 77]]);
    await assert.rejects(audio.setTrackParameter(2, 5, 63, 1), /track setting/);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
