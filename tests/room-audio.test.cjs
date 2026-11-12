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

test("FM-1 connection reads only the selected shareable voice", async () => {
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
  try {
    const edits = [];
    const device = await connectFm1((...note) => notes.push(note), () => {}, (...edit) => edits.push(edit));
    assert.deepEqual(midiOptions, { sysex: true });
    const voice = await device.getSelectedVoice();
    assert.equal(voice.engine, 0);
    assert.equal(voice.preset, 4);
    assert.equal(voice.params[68], mock.state.tracks[0].p[68]);
    mock.sim.knob(68, 4);
    mock.sim.knob(5, 4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(edits, [[68, mock.state.tracks[0].p[68]]]);
    mock.state.tracks[0].engine = 9;
    mock.state.tracks[0].preset = 0;
    mock.state.tracks[0].p[70] = 8;
    await assert.rejects(device.getSelectedVoice(), /built-in synth preset/);
    mock.state.tracks[0].engine = 0;
    device.input.onmidimessage({ data: Uint8Array.from([0x90, 60, 100]) });
    device.input.onmidimessage({ data: Uint8Array.from([0xb0, 1, 127]) });
    assert.deepEqual(notes, [[60, true, 100]]);
    device.close();
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
  }
});

test("room audio maps shared factory sounds onto local firmware tracks", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  try {
    const { RoomAudio } = await import("../web/src/rooms/audio.js");
    const audio = new RoomAudio(() => {});
    const untouchedPreset = audio.players[3].mock.state.tracks[0].preset;
    await audio.setVoice(7, { engine: 0, preset: 2 });
    const synthTrack = audio.players[7].mock.state.tracks[0];
    assert.equal(synthTrack.engine, 0);
    assert.equal(synthTrack.preset, 2);
    assert.equal(synthTrack.drum, false);
    await audio.setSoundParameter(7, 68, 91);
    assert.equal(synthTrack.p[68], 91);

    await audio.setVoice(1, { engine: 13, kit: 5 });
    const drumTrack = audio.players[1].mock.state.tracks[3];
    assert.equal(drumTrack.engine, 13);
    assert.equal(drumTrack.p[63], 5);
    assert.equal(audio.players[3].mock.state.tracks[0].preset, untouchedPreset);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});

test("isolated firmware renderers make sound on player slots beyond the editor preview", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  let audio;
  try {
    const [{ RoomAudio }, { RoomFirmwareAudio }, { previewSnapshot }] = await Promise.all([
      import("../web/src/rooms/audio.js"),
      import("../web/site/public/editor/preview-worklet.js"),
      import("../web/src/editor/lib/proto.js"),
    ]);
    audio = new RoomAudio(() => {});
    for (let slot = 0; slot < 8; slot += 1) {
      const voice = slot % 2 === 0 ? { engine: 0, preset: 2 } : { engine: 13, kit: 5 };
      await audio.setVoice(slot, voice);
    }
    await audio.setSoundParameter(0, 68, 88);
    assert.equal(audio.players[0].mock.state.tracks[0].p[68], 88);
    const module = await WebAssembly.compile(await readFile(resolve(__dirname, "../docs/webapp/editor/boopbox-preview.wasm")));
    const dsp = new RoomFirmwareAudio(module);
    for (let slot = 0; slot < 8; slot += 1) {
      const voice = audio.voices[slot];
      const snapshot = previewSnapshot(audio.players[slot].mock.state);
      if (slot === 0) assert.equal(snapshot.tracks[0].p[68], 88);
      dsp.sync(slot, snapshot);
      dsp.note(slot, voice.engine === 13 ? 3 : 0, voice.engine === 13 ? 36 : 60, true);
    }

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
    assert.equal(dsp.active.filter(Boolean).length, 8);
    assert.ok(peak > 0.001, `expected rendered audio, peak was ${peak}`);
  } finally {
    await audio?.close();
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
