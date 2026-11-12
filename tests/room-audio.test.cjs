"use strict";

const assert = require("node:assert/strict");
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

test("room audio maps shared factory sounds onto local firmware tracks", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/webapp/rooms/" };
  try {
    const { RoomAudio } = await import("../web/src/rooms/audio.js");
    const audio = new RoomAudio(() => {});
    await audio.setVoice(3, { engine: 0, preset: 2 });
    assert.equal(audio.mock.state.tracks[3].engine, 0);
    assert.equal(audio.mock.state.tracks[3].preset, 2);
    assert.equal(audio.mock.state.tracks[3].drum, false);
    assert.deepEqual(audio.mock.state.tracks[3].p, audio.mock.state.tracks[0].p);

    await audio.setVoice(1, { engine: 13, kit: 5 });
    assert.equal(audio.mock.state.tracks[1].engine, 13);
    assert.equal(audio.mock.state.tracks[1].p[63], 5);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
