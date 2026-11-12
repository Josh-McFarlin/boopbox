"use strict";

const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const test = require("node:test");

test("FM-1 input relays only bounded note-on and note-off messages", async () => {
  const { parseKeyboardMessage } = await import("../web/src/rooms/keyboard-midi.js");
  assert.deepEqual(parseKeyboardMessage(Uint8Array.from([0x90, 60, 110])), {
    note: 60,
    on: true,
    velocity: 110,
  });
  assert.deepEqual(parseKeyboardMessage(Uint8Array.from([0x80, 60, 0])), {
    note: 60,
    on: false,
    velocity: 64,
  });
  assert.deepEqual(parseKeyboardMessage(Uint8Array.from([0x90, 60, 0])), {
    note: 60,
    on: false,
    velocity: 64,
  });
  assert.equal(parseKeyboardMessage(Uint8Array.from([0xb0, 1, 127])), null);
  assert.equal(parseKeyboardMessage(Uint8Array.from([0xf0, 1, 0xf7])), null);
  assert.equal(parseKeyboardMessage(Uint8Array.from([0x90, 200, 100])), null);
  assert.equal(parseKeyboardMessage(Uint8Array.from([0x90, 60, 100, 0])), null);
});

async function connectMockFm1() {
  const { makeMockDevice } = await import("../web/src/editor/lib/proto.js");
  const { connectFm1 } = await import("../web/src/rooms/device.js");
  const mock = makeMockDevice({ auto: false });
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { requestMIDIAccess: async () => mock.access },
  });
  const edits = [];
  const performances = [];
  const performanceWaiters = [];
  let device;
  try {
    device = await connectFm1(() => {}, () => {}, (...edit) => edits.push(edit), (performance) => {
      performances.push(performance);
      performanceWaiters.shift()?.(performance);
    });
    if (!performances.length) {
      await new Promise((resolve) => performanceWaiters.push(resolve));
    }
  } catch (error) {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
    throw error;
  }
  return {
    mock,
    device,
    edits,
    performances,
    waitForNextPerformance() {
      return new Promise((resolve) => performanceWaiters.push(resolve));
    },
    close() {
      device.close();
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete globalThis.navigator;
    },
  };
}

test("FM-1 track switches automatically share the selected stock voice", async () => {
  const fixture = await connectMockFm1();
  try {
    const { mock, device, edits } = fixture;
    let value = mock.state.tracks[0].p[68] + 1;
    const firstEdit = [0, 68, value];
    mock.sim.param(0, 68, value);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [firstEdit]);

    const refreshed = fixture.waitForNextPerformance();
    mock.sim.track(1);
    const performance = await refreshed;
    assert.equal(performance.tracks[1].voice.engine, mock.state.tracks[1].engine);
    assert.equal(performance.tracks[1].voice.preset, mock.state.tracks[1].preset);
    const firstTrackOneValue = mock.state.tracks[1].p[68] + 1;
    mock.sim.param(1, 68, firstTrackOneValue);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [firstEdit, [1, 68, firstTrackOneValue]]);

    const stillSharedValue = mock.state.tracks[0].p[68] + 1;
    mock.sim.param(0, 68, stillSharedValue);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [firstEdit, [1, 68, firstTrackOneValue], [0, 68, stillSharedValue]]);

    const secondTrackOneValue = mock.state.tracks[1].p[68] + 1;
    mock.sim.param(1, 68, secondTrackOneValue);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [
      firstEdit,
      [1, 68, firstTrackOneValue],
      [0, 68, stillSharedValue],
      [1, 68, secondTrackOneValue],
    ]);
  } finally {
    fixture.close();
  }
});

test("FM-1 preset reloads automatically share the new voice and later edits", async () => {
  const fixture = await connectMockFm1();
  try {
    const { mock, edits } = fixture;
    let value = mock.state.tracks[0].p[68] + 1;
    const firstEdit = [0, 68, value];
    mock.sim.param(0, 68, value);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [firstEdit]);

    const refreshed = fixture.waitForNextPerformance();
    const nextVoice = mock.sim.reload();
    const performance = await refreshed;
    assert.equal(performance.tracks[0].voice.engine, nextVoice.engine);
    assert.equal(performance.tracks[0].voice.preset, nextVoice.preset);
    value = mock.state.tracks[0].p[68] + 1;
    mock.sim.param(0, 68, value);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [
      firstEdit,
      [0, 68, value],
    ]);
  } finally {
    fixture.close();
  }
});

test("sound-edit pause survives switching away from and back to an FM-1", async () => {
  const { createSoundEditSharingController } = await import("../web/src/rooms/edit-sharing.js");
  const sharing = createSoundEditSharingController();
  const first = await connectMockFm1();
  let second;
  try {
    sharing.attachDevice(first.device);
    assert.equal(sharing.setPaused(true), true);
    const firstValue = first.mock.state.tracks[0].p[68] + 1;
    first.mock.sim.param(0, 68, firstValue);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(first.edits, []);

    sharing.attachDevice(null);
    assert.equal(sharing.paused, true);
    first.close();

    second = await connectMockFm1();
    sharing.attachDevice(second.device);
    const secondValue = second.mock.state.tracks[0].p[68] + 1;
    second.mock.sim.param(0, 68, secondValue);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(second.edits, []);
    assert.equal(sharing.paused, true);
  } finally {
    if (second) second.close();
    else first.close();
  }
});

test("FM-1 connection snapshots all factory tracks and routes keyboard notes", async () => {
  const { makeMockDevice } = await import("../web/src/editor/lib/proto.js");
  const { connectFm1 } = await import("../web/src/rooms/device.js");
  const mock = makeMockDevice({ auto: false });
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let midiOptions;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { requestMIDIAccess: async (options) => { midiOptions = options; return mock.access; } },
  });
  const notes = [];
  let device;
  try {
    const edits = [];
    const errors = [];
    device = await connectFm1((...note) => notes.push(note), () => {}, (...edit) => edits.push(edit),
      () => {}, () => {}, (error) => errors.push(error.message));
    assert.deepEqual(midiOptions, { sysex: true });
    const voice = await device.getSelectedVoice();
    assert.equal(voice.engine, 0);
    assert.equal(voice.preset, 4);
    assert.equal(voice.params[68], mock.state.tracks[0].p[68]);
    const performance = await device.getPerformanceSnapshot();
    assert.deepEqual(errors, []);
    assert.equal(performance?.tracks.length, 8);
    assert.equal(performance?.tracks[0].voice.engine, 0);
    assert.equal(performance?.tracks[3].kind, 1);
    assert.equal(performance?.tracks[0].patterns.length, 8);
    mock.sim.knob(68, 4);
    mock.sim.knob(5, 4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [[0, 68, mock.state.tracks[0].p[68]]]);
    device.setSoundEditsPaused(true);
    mock.sim.knob(68, 4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(edits.length, 1);
    device.setSoundEditsPaused(false);
    mock.sim.knob(68, 4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(edits.length, 2);
    mock.state.tracks[0].engine = 9;
    mock.state.tracks[0].preset = 0;
    mock.state.tracks[0].p[70] = 8;
    await assert.rejects(device.getSelectedVoice(), /built-in synth preset/);
    mock.state.tracks[0].engine = 0;
    device.input.onmidimessage({ data: Uint8Array.from([0x90, 60, 100]) });
    device.input.onmidimessage({ data: Uint8Array.from([0xb0, 1, 127]) });
    assert.deepEqual(notes, [[60, true, 100, 0]]);
  } finally {
    device?.close();
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
  }
});

function roomPerformance(playing = false) {
  const patterns = () => Array.from({ length: 8 }, (_, id) => ({
    id, length: 16, steps: [], micro: [], fill: [], locks: [], components: [], dir: 0, seed: 0,
  }));
  const tracks = Array.from({ length: 8 }, (_, index) => ({
    index,
    kind: index === 3 || index === 7 ? 1 : 0,
    voice: index === 3 || index === 7 ? { engine: 13, kit: 5 } : { engine: 0, preset: 2, params: {} },
    parameters: [],
    currentPattern: 0,
    chain: [],
    chainEnabled: false,
    patterns: patterns(),
  }));
  tracks[0].patterns[0].length = 4;
  tracks[0].patterns[0].steps.push([0, [60, 0, 0, 0, 1, 0, 0, 100, 0, 0]]);
  return {
    tempo: 120, playing, currentScene: 0, tracks,
    scenes: { names: Array(8).fill(0), patterns: Array.from({ length: 8 }, (_, scene) => Array(8).fill(scene)) },
  };
}

test("browser listeners keep solo and mute local and clear them when a room ends", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  let modules;
  try {
    modules = await Promise.all([
      import("../web/src/rooms/mix.js"),
      import("../web/src/rooms/audio.js"),
    ]);
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
  const [{ createRoomMixController }, { RoomAudio }] = modules;
  const makeListener = () => {
    const rendererMessages = [];
    const audio = Object.create(RoomAudio.prototype);
    audio.mutedSlots = Array(8).fill(false);
    audio.soloSlot = null;
    audio.node = { port: { postMessage: (message) => rendererMessages.push(message) } };
    return {
      rendererMessages,
      mix: createRoomMixController({
        getAudio: () => audio,
        onChange: () => {},
      }),
    };
  };

  const listenerA = makeListener();
  const listenerB = makeListener();

  listenerA.mix.toggleMute(1);
  listenerA.mix.toggleSolo(2);
  listenerB.mix.toggleMute(2);
  listenerB.mix.toggleSolo(1);

  assert.deepEqual(listenerA.mix.getState(), { mutedSlots: [1], soloSlot: 2 });
  assert.deepEqual(listenerB.mix.getState(), { mutedSlots: [2], soloSlot: 1 });
  assert.deepEqual(listenerA.rendererMessages.at(-1), {
    type: "mix",
    mutedSlots: [false, true, false, false, false, false, false, false],
    soloSlot: 2,
  });
  assert.deepEqual(listenerB.rendererMessages.at(-1), {
    type: "mix",
    mutedSlots: [false, false, true, false, false, false, false, false],
    soloSlot: 1,
  });
  assert.ok([...listenerA.rendererMessages, ...listenerB.rendererMessages]
    .every((message) => message.type === "mix"),
  "solo and mute are delivered only to each listener's local audio worklet");

  listenerA.mix.reset();
  assert.deepEqual(listenerA.mix.getState(), { mutedSlots: [], soloSlot: null });
  assert.deepEqual(listenerA.rendererMessages.at(-1), {
    type: "mix",
    mutedSlots: Array(8).fill(false),
    soloSlot: null,
  });
  assert.deepEqual(listenerB.mix.getState(), { mutedSlots: [2], soloSlot: 1 },
    "resetting one listener does not change another listener's room mix");

  listenerB.mix.retainSlots([0]);
  assert.deepEqual(listenerB.mix.getState(), { mutedSlots: [], soloSlot: null },
    "a room update removes mute and solo settings for departed players");
  listenerB.mix.reset();
  assert.deepEqual(listenerB.mix.getState(), { mutedSlots: [], soloSlot: null },
    "leaving a room can safely reset an already-cleared mix");
});

test("room audio maps all eight factory tracks onto two local firmware groups", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  try {
    const { RoomAudio } = await import("../web/src/rooms/audio.js");
    const audio = new RoomAudio(() => {});
    const messages = [];
    audio.node = { port: { postMessage: (message) => messages.push(message) }, disconnect() {} };
    const ownPerformance = roomPerformance();
    const peerPerformance = roomPerformance();
    peerPerformance.currentScene = 2;
    peerPerformance.tracks[0].patterns[0].steps[0][1][0] = 67;
    peerPerformance.tracks[0].chain = [1, 2];
    peerPerformance.tracks[0].chainEnabled = true;
    peerPerformance.scenes.patterns[2][0] = 3;
    await audio.setPerformance(0, ownPerformance);
    await audio.setPerformance(1, peerPerformance);
    const ownState = messages.find((message) => message.type === "state" && message.slot === 0 && message.group === 0).state;
    const peerState = messages.find((message) => message.type === "state" && message.slot === 1 && message.group === 0).state;
    assert.equal(ownState.currentScene, 0);
    assert.equal(peerState.currentScene, 2);
    assert.notDeepEqual(ownState.tracks[0].roomPatterns[0].bytes, peerState.tracks[0].roomPatterns[0].bytes);
    assert.deepEqual(ownState.tracks[0].chain, []);
    assert.deepEqual(peerState.tracks[0].chain, [1, 2]);
    assert.equal(ownState.roomScenes.patterns[2][0], 2);
    assert.equal(peerState.roomScenes.patterns[2][0], 3);
    const untouchedPreset = audio.players[3][0].mock.state.tracks[0].preset;
    await audio.setPerformance(7, roomPerformance());
    const synthTrack = audio.players[7][0].mock.state.tracks[0];
    assert.equal(synthTrack.engine, 0);
    assert.equal(synthTrack.preset, 2);
    assert.equal(synthTrack.drum, false);
    const secondGroupSynth = audio.players[7][1].mock.state.tracks[0];
    assert.equal(secondGroupSynth.engine, 0);
    assert.equal(secondGroupSynth.preset, 2);
    await audio.setSoundParameter(7, 0, 68, 91);
    assert.equal(synthTrack.p[68], 91);

    await audio.setVoice(1, { engine: 13, kit: 5 });
    const drumTrack = audio.players[1][0].mock.state.tracks[3];
    assert.equal(drumTrack.engine, 13);
    assert.equal(drumTrack.p[63], 5);
    assert.equal(audio.players[3][0].mock.state.tracks[0].preset, untouchedPreset);
    audio.setPlayerMuted(1, true);
    assert.deepEqual(messages.at(-1), {
      type: "mix",
      mutedSlots: [false, true, false, false, false, false, false, false],
      soloSlot: null,
    });
    audio.setSoloPlayer(1);
    assert.equal(messages.at(-1).soloSlot, 1);
    audio.removeVoice(1);
    assert.equal(audio.soloSlot, null);
    assert.equal(audio.mutedSlots[1], false);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});

test("room firmware renders all eight tracks and sequenced patterns for eight members", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  let audio;
  try {
    const [{ RoomAudio }, { FirmwareAudio, RoomFirmwareAudio }] = await Promise.all([
      import("../web/src/rooms/audio.js"),
      import("../web/site/public/editor/preview-worklet.js"),
    ]);
    audio = new RoomAudio(() => {});
    const messages = [];
    audio.node = { port: { postMessage: (message) => messages.push(message) }, disconnect() {} };
    for (let slot = 0; slot < 8; slot += 1) {
      await audio.setPerformance(slot, roomPerformance(false));
    }
    const module = await WebAssembly.compile(await readFile(resolve(__dirname, "../docs/webapp/editor/boopbox-preview.wasm")));
    for (let track = 0; track < 8; track += 1) {
      const group = Math.floor(track / 4);
      const state = messages.find((message) => message.type === "state" && message.slot === 0 && message.group === group).state;
      const single = new FirmwareAudio(module);
      single.sync(state);
      single.w.preview_note(track % 4, track === 3 || track === 7 ? 36 : 60, 1);
      let trackPeak = 0;
      const trackLeft = new Float32Array(128);
      const trackRight = new Float32Array(128);
      for (let block = 0; block < 20; block += 1) {
        single.render(trackLeft, trackRight);
        for (let frame = 0; frame < trackLeft.length; frame += 1) {
          trackPeak = Math.max(trackPeak, Math.abs(trackLeft[frame]), Math.abs(trackRight[frame]));
        }
      }
      assert.ok(trackPeak > 0.001, `expected track ${track} to render sound, peak was ${trackPeak}`);
    }
    const dsp = new RoomFirmwareAudio(module);
    for (const message of messages) {
      if (message.type === "state") dsp.sync(message.slot, message.group, message.state);
    }
    await audio.setPerformance(0, roomPerformance(true));
    for (const message of messages.slice(-2)) dsp.sync(message.slot, message.group, message.state);

    let peak = 0;
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    for (let block = 0; block < 20; block += 1) {
      dsp.render(left, right);
      for (let frame = 0; frame < left.length; frame += 1) {
        peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
      }
    }
    assert.equal(dsp.players.length, 8);
    assert.equal(dsp.players[0].length, 2);
    assert.equal(dsp.active.filter((groups) => groups.some(Boolean)).length, 8);
    assert.ok(peak > 0.001, `expected rendered audio, peak was ${peak}`);

    dsp.active = Array.from({ length: 8 }, () => [true, false]);
    for (let slot = 0; slot < 8; slot += 1) {
      dsp.players[slot][0].render = (outLeft, outRight) => {
        outLeft.fill(slot + 1);
        outRight.fill(slot + 1);
      };
    }
    const isolatedLeft = new Float32Array(16);
    const isolatedRight = new Float32Array(16);
    dsp.setMix(Array(8).fill(false), 3);
    dsp.render(isolatedLeft, isolatedRight);
    assert.ok(Math.abs(isolatedLeft[0] - 1) < 1e-6, "solo renders only the selected member");

    dsp.setMix([false, false, false, true, false, false, false, false], null);
    dsp.render(isolatedLeft, isolatedRight);
    const expectedWithoutMutedMember = 32 * 0.25 / Math.sqrt(7);
    assert.ok(Math.abs(isolatedLeft[0] - expectedWithoutMutedMember) < 1e-6,
      "mute removes one member from this listener's local mix");
  } finally {
    await audio?.close();
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
