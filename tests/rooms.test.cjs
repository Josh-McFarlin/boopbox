"use strict";

const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const test = require("node:test");
const { WebSocket } = require("ws");
const { createRoomService, normalizeVoice } = require("../server/rooms.cjs");
const config = require("../shared/room-config.json");

function createClient(url) {
  const ws = new WebSocket(url, { headers: { Origin: url.replace(/^ws:/, "http:").replace(/\/api\/rooms$/, "") } });
  const inbox = [];
  const waiters = [];
  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    const index = waiters.findIndex((waiter) => waiter.match(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else inbox.push(message);
  });
  return {
    ws,
    ready: once(ws, "open"),
    send(message) {
      ws.send(JSON.stringify({ v: 1, ...message }));
    },
    next(type, predicate = () => true, timeoutMs = 1500) {
      const index = inbox.findIndex((message) => message.type === type && predicate(message));
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          match: (message) => message.type === type && predicate(message),
          resolve,
          timer: setTimeout(() => {
            const i = waiters.indexOf(waiter);
            if (i >= 0) waiters.splice(i, 1);
            reject(new Error(`Timed out waiting for ${type}`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
    close() {
      if (ws.readyState === WebSocket.CLOSED) return Promise.resolve();
      return new Promise((resolve) => {
        ws.once("close", resolve);
        if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
        else ws.close();
      });
    },
  };
}

async function startRoomServer(options = {}) {
  const server = createServer();
  const service = createRoomService(server, options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    server,
    service,
    url: `ws://127.0.0.1:${port}/api/rooms`,
    async close(clients = []) {
      await Promise.all(clients.map((client) => client.close()));
      service.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function createRoom(client, genre = "house") {
  client.send({ type: "create", genre });
  return client.next("room_state");
}

test("voice descriptors allow only factory presets and factory drum kits", () => {
  assert.deepEqual(normalizeVoice({ engine: 0, preset: 14 }), { engine: 0, preset: 14 });
  assert.deepEqual(normalizeVoice({ engine: 13, kit: 36 }), { engine: 13, kit: 36 });
  assert.deepEqual(normalizeVoice({ engine: 0, preset: 2, params: { 63: 3, 68: 64 } }),
    { engine: 0, preset: 2, params: { 63: 3, 68: 64 } });
  assert.equal(normalizeVoice({ engine: 4, preset: 0 }), null);
  assert.equal(normalizeVoice({ engine: 4, preset: 0, params: { 68: 64 } }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 15 }), null);
  assert.equal(normalizeVoice({ engine: 13, kit: 37 }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 0, params: [1, 2, 3] }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 0, params: { 71: 1 } }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 0, params: { 63: 5 } }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 0, params: { 68: 128 } }), null);
  assert.equal(normalizeVoice({ engine: 0, preset: 0, params: { 68: 1.5 } }), null);
  assert.equal(normalizeVoice({ engine: 8, preset: 0, params: { 63: 0 } }), null);
  assert.equal(normalizeVoice({ engine: 9, preset: 0, params: { 70: 0 } }), null);
  assert.equal(normalizeVoice({ engine: 99, preset: 0 }), null);
  for (const [engine, allowlist] of Object.entries(config.shareableParameters)) {
    const [param, [min, max]] = Object.entries(allowlist)[0];
    assert.deepEqual(normalizeVoice({ engine: Number(engine), preset: 0, params: { [param]: min } }),
      { engine: Number(engine), preset: 0, params: { [param]: min } });
    assert.deepEqual(normalizeVoice({ engine: Number(engine), preset: 0, params: { [param]: max } }),
      { engine: Number(engine), preset: 0, params: { [param]: max } });
  }
});

test("rooms share validated sound edits and retain them for later participants", async () => {
  const app = await startRoomServer();
  const clients = [];
  try {
    const owner = createClient(app.url);
    const peer = createClient(app.url);
    clients.push(owner, peer);
    await Promise.all([owner.ready, peer.ready]);
    const created = await createRoom(owner);
    peer.send({ type: "join", roomId: created.room.id });
    await peer.next("room_state");

    owner.send({ type: "voice", voice: { engine: 0, preset: 2, params: { 68: 64 } } });
    assert.deepEqual((await peer.next("voice")).voice,
      { engine: 0, preset: 2, params: { 68: 64 } });

    owner.send({ type: "sound_edit", param: 68, value: 92 });
    const edit = await peer.next("sound_edit");
    assert.deepEqual(
      { playerId: edit.playerId, slot: edit.slot, param: edit.param, value: edit.value },
      { playerId: created.players[0].id, slot: created.players[0].slot, param: 68, value: 92 },
    );

    owner.send({ type: "sound_edit", param: 71, value: 1 });
    assert.equal((await owner.next("error")).code, "unsupported_sound_edit");
    owner.send({ type: "sound_edit", param: 68, value: 128 });
    assert.equal((await owner.next("error")).code, "unsupported_sound_edit");
    owner.send({ type: "sound_edit", param: 68, value: 92, sample: [1, 2, 3] });
    assert.equal((await owner.next("error")).code, "invalid_message");

    const lateJoiner = createClient(app.url);
    clients.push(lateJoiner);
    await lateJoiner.ready;
    lateJoiner.send({ type: "join", roomId: created.room.id });
    const state = await lateJoiner.next("room_state");
    assert.deepEqual(state.players.find((player) => player.id === created.players[0].id).voice,
      { engine: 0, preset: 2, params: { 68: 92 } });
  } finally {
    await app.close(clients);
  }
});

test("room capacity is eight and only members can share typed notes", async () => {
  const app = await startRoomServer();
  const clients = [];
  try {
    const owner = createClient(app.url);
    clients.push(owner);
    await owner.ready;
    const created = await createRoom(owner, "techno");
    assert.equal(created.room.genre, "techno");

    for (let i = 0; i < 7; i += 1) {
      const guest = createClient(app.url);
      clients.push(guest);
      await guest.ready;
      guest.send({ type: "join", roomId: created.room.id });
      const state = await guest.next("room_state");
      assert.equal(state.players.length, i + 2);
    }

    const fullGuest = createClient(app.url);
    clients.push(fullGuest);
    await fullGuest.ready;
    fullGuest.send({ type: "join", roomId: created.room.id });
    assert.equal((await fullGuest.next("error")).code, "room_full");

    const peer = clients[1];
    owner.send({ type: "voice", voice: { engine: 0, preset: 2 } });
    const voice = await peer.next("voice");
    assert.deepEqual(voice.voice, { engine: 0, preset: 2 });
    assert.equal(voice.playerId, created.players[0].id);

    owner.send({ type: "note_on", note: 60, velocity: 110 });
    const played = await peer.next("note_on");
    assert.equal(played.note, 60);
    assert.equal(played.velocity, 110);
    assert.equal(played.slot, created.players[0].slot);

    owner.send({ type: "note_off", note: 60 });
    assert.equal((await peer.next("note_off")).note, 60);

    owner.send({ type: "voice", voice: { engine: 0, preset: 1, patch: [0, 0] } });
    assert.equal((await owner.next("error")).code, "unsupported_voice");
    owner.send({ type: "note_on", note: 128, velocity: 90 });
    assert.equal((await owner.next("error")).code, "invalid_message");
    owner.send({ type: "midi", data: [0xf0, 0, 0xf7] });
    assert.equal((await owner.next("error")).code, "unsupported_message");
  } finally {
    await app.close(clients);
  }
});

test("the server caps the browser at 50 rooms", async () => {
  const app = await startRoomServer();
  const clients = [];
  try {
    for (let index = 0; index < 50; index += 1) {
      const client = createClient(app.url);
      clients.push(client);
      await client.ready;
      const result = await createRoom(client, "ambient");
      assert.equal(result.room.genre, "ambient");
    }
    assert.deepEqual(app.service.stats(), { rooms: 50, sockets: 50 });

    const extra = createClient(app.url);
    clients.push(extra);
    await extra.ready;
    extra.send({ type: "create", genre: "ambient" });
    assert.equal((await extra.next("error")).code, "server_full");
  } finally {
    await app.close(clients);
  }
});

test("empty rooms expire after ten minutes and a rejoin cancels expiry", async () => {
  const app = await startRoomServer({ roomTtlMs: 90, noteTimeoutMs: 50 });
  const clients = [];
  try {
    const owner = createClient(app.url);
    const guest = createClient(app.url);
    clients.push(owner, guest);
    await Promise.all([owner.ready, guest.ready]);
    const created = await createRoom(owner);
    guest.send({ type: "join", roomId: created.room.id });
    await guest.next("room_state");

    owner.send({ type: "voice", voice: { engine: 1, preset: 1 } });
    owner.send({ type: "note_on", note: 64, velocity: 100 });
    await guest.next("note_on");
    assert.equal((await guest.next("note_off")).note, 64);

    owner.send({ type: "note_on", note: 65, velocity: 100 });
    await guest.next("note_on");

    await owner.close();
    const released = await guest.next("note_off");
    assert.equal(released.note, 65);
    await guest.next("room_state", (state) => state.players.length === 1);
    await guest.close();
    const empty = await waitForRoomCount(app.service, 1);
    assert.ok(empty);

    const rejoiner = createClient(app.url);
    clients.push(rejoiner);
    await rejoiner.ready;
    rejoiner.send({ type: "join", roomId: created.room.id });
    const reopened = await rejoiner.next("room_state");
    assert.equal(reopened.room.id, created.room.id);
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(app.service.stats().rooms, 1);

    await rejoiner.close();
    await waitForRoomCount(app.service, 0);
    assert.equal(app.service.stats().rooms, 0);
  } finally {
    await app.close(clients);
  }
});

async function waitForRoomCount(service, count, timeoutMs = 1000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (service.stats().rooms === count) return true;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Room count did not reach ${count}`);
}
