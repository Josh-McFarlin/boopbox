// SPDX-License-Identifier: GPL-3.0-only
// The jam rooms' note timing: the server clock (clock.ts), the notes played a steady delay after the time they were
// played (audio.ts), and the audio thread holding them until then (preview-worklet.js RoomFirmwareAudio).
const assert = require("node:assert/strict");
const test = require("node:test");
const config = require("../../shared/room-config.json");

test("the server clock takes its offset from the fastest reply", async () => {
  const { ServerClock } = await import("../../web/src/pages/Rooms/clock.ts");
  let now = 1000;
  const clock = new ServerClock(() => now);
  assert.equal(clock.synced, false);
  assert.equal(clock.serverNow(), 1000);                   /* no reply yet: this browser's own clock */
  /* the server is 5000 ms ahead. A slow reply (300 ms, 250 of it on the way back) is off by 100 ms ... */
  let sent = clock.stamp();
  now += 300;
  clock.sample(sent, sent + 50 + 5000);
  assert.equal(clock.offset, 4900);
  /* ... a fast one (20 ms, half each way) is right, and wins */
  sent = clock.stamp();
  now += 20;
  clock.sample(sent, sent + 10 + 5000);
  assert.equal(clock.offset, 5000);
  sent = clock.stamp();
  now += 400;
  clock.sample(sent, sent + 380 + 5000);                   /* a later slow one does not replace it */
  assert.equal(clock.offset, 5000);
  assert.equal(clock.serverNow(), now + 5000);
  assert.equal(clock.toLocal(now + 5000), now);
  clock.sample(now + 10, now + 5000);                      /* a reply from the future: ignored */
  clock.sample(now, Number.NaN);
  assert.equal(clock.offset, 5000);
  /* only the last eight replies count: the fast one ages out */
  for (let i = 0; i < 8; i += 1) {
    sent = clock.stamp();
    now += 100;
    clock.sample(sent, sent + 50 + 5003);
  }
  assert.equal(clock.offset, 5003);
});

/* RoomFirmwareAudio with its firmware players replaced by recorders: which notes each block plays */
async function recordingRoom() {
  const { RoomFirmwareAudio } = await import("../../web/site/public/editor/preview-worklet.js");
  const room = Object.create(RoomFirmwareAudio.prototype);
  const played = [];
  let block = 0;
  const player = (slot, group) => ({
    w: {
      preview_note: (track, note, on) => played.push({ block, slot, track: group * 4 + track, note, on: !!on }),
      preview_panic: () => {},
    },
    render: () => {},
  });
  room.players = Array.from({ length: 8 }, (_, slot) => [player(slot, 0), player(slot, 1)]);
  room.active = Array.from({ length: 8 }, () => [false, false]);
  room.mutedSlots = Array(8).fill(false);
  room.soloSlot = null;
  room.left = new Float32Array(0);
  room.right = new Float32Array(0);
  room.frame = 0;
  room.pending = [];
  room.seq = 0;
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  return {
    room,
    played,
    render(blocks = 1) {
      for (let i = 0; i < blocks; i += 1) {
        room.render(left, right);
        block += 1;
      }
    },
  };
}

test("the audio thread holds a room note until its time, in order", async () => {
  const { room, played, render } = await recordingRoom();
  room.note(0, 1, 60, true);                               /* no delay: at once */
  assert.deepEqual(played, [{ block: 0, slot: 0, track: 1, note: 60, on: true }]);
  room.note(2, 5, 64, true, 300);                          /* 300 frames: in the third block (256..383) */
  room.note(2, 5, 64, false, 300);                         /* the same frame: after the note-on */
  room.note(2, 5, 67, true, 129);                          /* the second block (128..255), before 64 */
  render();
  assert.equal(played.length, 1);
  render();
  assert.deepEqual(played.slice(1), [{ block: 1, slot: 2, track: 5, note: 67, on: true }]);
  render();
  assert.deepEqual(played.slice(2), [
    { block: 2, slot: 2, track: 5, note: 64, on: true },
    { block: 2, slot: 2, track: 5, note: 64, on: false },
  ]);
  room.note(3, 0, 50, true, 1000);
  room.note(4, 0, 51, true, 1000);
  room.panic(3);                                           /* a panic drops the slot's notes still waiting */
  render(10);
  assert.deepEqual(played.slice(4), [{ block: 10, slot: 4, track: 0, note: 51, on: true }]);
  room.note(0, 0, 40, true, 10_000_000);                   /* capped at a second: 44,100 frames, in the 345th block */
  render(344);
  assert.equal(played.length, 5);
  render(1);
  assert.equal(played.at(-1).note, 40);
});

test("room notes are posted to sound noteDelayMs after the time they were played", async () => {
  const originalDocument = global.document;
  global.document = { baseURI: "http://localhost/rooms/" };
  try {
    const [{ RoomAudio }, { ServerClock }] = await Promise.all([
      import("../../web/src/pages/Rooms/audio.ts"),
      import("../../web/src/pages/Rooms/clock.ts"),
    ]);
    let now = 50_000;
    const clock = new ServerClock(() => now);
    const sent = clock.stamp();
    now += 20;
    clock.sample(sent, sent + 10 + 1_000_000);               /* the server's clock: 1,000,000 ms ahead */
    const audio = new RoomAudio(() => {});
    audio.clock = clock;
    const messages = [];
    audio.node = { port: { postMessage: (message) => messages.push(message) }, disconnect() {} };
    await audio.setVoice(0, { engine: 0, preset: 2 });
    const played = clock.serverNow() - 30;                    /* played 30 ms ago (its trip) */
    await audio.note(0, 0, 60, true, played + config.noteDelayMs);
    const note = messages.find((message) => message.type === "note");
    assert.equal(note.delayFrames, Math.round(((config.noteDelayMs - 30) * 44_100) / 1000));
    await audio.note(0, 0, 60, false, played - 500);          /* already late: at once */
    assert.equal(messages.filter((message) => message.type === "note").at(-1).delayFrames, 0);
    await audio.note(0, 0, 62, true);                         /* no time (an older server): at once */
    assert.equal(messages.filter((message) => message.type === "note").at(-1).delayFrames, 0);
    await audio.close();
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
