"use strict";

const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const test = require("node:test");
const { WebSocket } = require("ws");
const { createRoomService, normalizeVoice, normalizeRoomPerformance } = require("../server/rooms.cjs");
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
      ws.send(JSON.stringify({ v: config.protocolVersion, ...message }));
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

function roomPattern(id) {
  return { id, length: 16, steps: [], micro: [], fill: [], locks: [], components: [], dir: 0, seed: 0 };
}

function roomPerformance() {
  const tracks = Array.from({ length: 8 }, (_, index) => ({
    index,
    kind: index === 3 || index === 7 ? 1 : 0,
    voice: index === 0 ? { engine: 0, preset: 2, params: { 68: 64 } }
      : index === 3 ? { engine: 13, kit: 5 } : null,
    parameters: [],
    currentPattern: 0,
    chain: [],
    chainEnabled: false,
    patterns: Array.from({ length: 8 }, (_, id) => roomPattern(id)),
  }));
  tracks[0].patterns[0].steps.push([0, [60, 0, 0, 0, 1, 0, 0, 100, 0, 0]]);
  tracks[3].patterns[0].steps.push([0, 1, Array(16).fill(0), Array(16).fill(0)]);
  return {
    tempo: 120,
    playing: false,
    currentScene: null,
    tracks,
    scenes: {
      names: Array(8).fill(0),
      patterns: Array.from({ length: 8 }, (_, scene) => Array(8).fill(scene)),
    },
  };
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

test("room performance validation accepts typed sequences and rejects arbitrary fields", () => {
  const performance = roomPerformance();
  assert.deepEqual(normalizeRoomPerformance(performance), performance);
  const arbitrary = roomPerformance();
  arbitrary.tracks[0].patterns[0].steps[0].push("raw payload");
  assert.equal(normalizeRoomPerformance(arbitrary), null);
  const unsafeComponent = roomPerformance();
  unsafeComponent.tracks[0].patterns[0].components.push([0, 1, 999, 0]);
  assert.equal(normalizeRoomPerformance(unsafeComponent), null);
  const customSound = roomPerformance();
  customSound.tracks[0].voice = { engine: 4, preset: 0 };
  assert.equal(normalizeRoomPerformance(customSound), null);
});

test("rooms relay bounded performances, sync tempo, and restore state for late joiners", async () => {
  const app = await startRoomServer();
  const clients = [];
  try {
    const owner = createClient(app.url);
    const guest = createClient(app.url);
    clients.push(owner, guest);
    await Promise.all([owner.ready, guest.ready]);
    const created = await createRoom(owner);
    guest.send({ type: "join", roomId: created.room.id });
    const joinedState = await guest.next("room_state");
    const guestId = joinedState.players.find((player) => player.id !== created.players[0].id)?.id;
    assert.ok(guestId);

    const performance = roomPerformance();
    owner.send({ type: "performance", performance });
    const shared = await guest.next("performance");
    assert.equal(shared.performance.tracks[0].patterns[0].steps[0][1][0], 60);
    assert.equal(shared.performance.tracks[3].voice.kit, 5);

    const guestPerformance = roomPerformance();
    guestPerformance.currentScene = 2;
    guestPerformance.tracks[0].patterns[0].steps[0][1][0] = 67;
    guestPerformance.tracks[0].chain = [1, 2];
    guestPerformance.tracks[0].chainEnabled = true;
    guestPerformance.scenes.patterns[2][0] = 3;
    guest.send({ type: "performance", performance: guestPerformance });
    const guestShare = await owner.next("performance", (message) => message.playerId === guestId);
    assert.equal(guestShare.performance.tracks[0].patterns[0].steps[0][1][0], 67);
    assert.deepEqual(guestShare.performance.tracks[0].chain, [1, 2]);
    assert.equal(guestShare.performance.currentScene, 2);
    assert.equal(guestShare.performance.scenes.patterns[2][0], 3);

    owner.send({ type: "transport", playing: true, tempo: 124 });
    const transport = await guest.next("transport");
    assert.equal(transport.playing, true);
    assert.equal(transport.clock.tempo, 124);
    assert.ok(Number.isFinite(transport.clock.beat));

    const lateJoiner = createClient(app.url);
    clients.push(lateJoiner);
    await lateJoiner.ready;
    lateJoiner.send({ type: "join", roomId: created.room.id });
    await lateJoiner.next("room_state");
    const restored = await lateJoiner.next("performance", (message) => message.playerId === created.players[0].id);
    assert.equal(restored.performance.playing, true);
    assert.equal(restored.performance.tempo, 124);
    assert.equal(restored.performance.tracks[0].patterns[0].steps[0][1][0], 60);
    const restoredGuest = await lateJoiner.next("performance", (message) => message.playerId === guestId);
    assert.equal(restoredGuest.performance.playing, false);
    assert.equal(restoredGuest.performance.tempo, 124);
    assert.equal(restoredGuest.performance.tracks[0].patterns[0].steps[0][1][0], 67);
    assert.deepEqual(restoredGuest.performance.tracks[0].chain, [1, 2]);

    const arbitrary = roomPerformance();
    arbitrary.tracks[0].sample = [1, 2, 3];
    owner.send({ type: "performance", performance: arbitrary });
    assert.equal((await owner.next("error")).code, "invalid_performance");
  } finally {
    await app.close(clients);
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

    owner.send({ type: "sound_edit", track: 0, param: 68, value: 92 });
    const edit = await peer.next("sound_edit");
    assert.deepEqual(
      { playerId: edit.playerId, slot: edit.slot, param: edit.param, value: edit.value },
      { playerId: created.players[0].id, slot: created.players[0].slot, param: 68, value: 92 },
    );

    owner.send({ type: "sound_edit", track: 0, param: 71, value: 1 });
    assert.equal((await owner.next("error")).code, "unsupported_sound_edit");
    owner.send({ type: "sound_edit", track: 0, param: 68, value: 128 });
    assert.equal((await owner.next("error")).code, "unsupported_sound_edit");
    owner.send({ type: "sound_edit", track: 0, param: 68, value: 92, sample: [1, 2, 3] });
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

test("pausing live sound edits preserves shared sounds while notes continue", async () => {
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

    const original = roomPerformance();
    original.tracks[0].voice.params[68] = 92;
    owner.send({ type: "performance", performance: original });
    const initial = await peer.next("performance");
    assert.equal(initial.performance.tracks[0].voice.params[68], 92);

    owner.send({ type: "sound_edit_sharing", paused: true });
    owner.send({ type: "sound_edit", track: 0, param: 68, value: 100 });
    await new Promise((resolve) => setTimeout(resolve, 1050));
    const editedWhilePaused = roomPerformance();
    editedWhilePaused.tracks[0].voice.params[68] = 100;
    owner.send({ type: "performance", performance: editedWhilePaused });
    const pausedSnapshot = await peer.next("performance");
    assert.equal(pausedSnapshot.performance.tracks[0].voice.preset, 2);
    assert.equal(pausedSnapshot.performance.tracks[0].voice.params[68], 92);

    owner.send({ type: "note_on", track: 0, note: 61, velocity: 100 });
    assert.equal((await peer.next("note_on")).note, 61);
    owner.send({ type: "sound_edit_sharing", paused: false });
    owner.send({ type: "sound_edit", track: 0, param: 68, value: 100 });
    assert.equal((await peer.next("sound_edit")).value, 100);
  } finally {
    await app.close(clients);
  }
});

test("room names are unique and chat is live-only, bounded, and room-scoped", async () => {
  const app = await startRoomServer();
  const clients = [];
  try {
    const owner = createClient(app.url);
    const guest = createClient(app.url);
    clients.push(owner, guest);
    await Promise.all([owner.ready, guest.ready]);
    const created = await createRoom(owner);
    const ownerId = created.players[0].id;
    assert.equal(created.players[0].name, "Player 1");

    guest.send({ type: "join", roomId: created.room.id });
    const joined = await guest.next("room_state");
    const guestId = joined.players.find((player) => player.id !== ownerId).id;
    assert.equal(joined.players.find((player) => player.id === guestId).name, "Player 2");

    owner.send({ type: "set_name", name: "DJ_Alpha" });
    await owner.next("player_name", (message) => message.playerId === ownerId && message.name === "DJ_Alpha");
    await guest.next("player_name", (message) => message.playerId === ownerId && message.name === "DJ_Alpha");
    guest.send({ type: "set_name", name: "dj_alpha" });
    assert.equal((await guest.next("error")).code, "name_taken");
    guest.send({ type: "set_name", name: "B_Side" });
    await owner.next("player_name", (message) => message.playerId === guestId && message.name === "B_Side");
    await guest.next("player_name", (message) => message.playerId === guestId && message.name === "B_Side");

    owner.send({ type: "chat", text: "Try the next scene?\n<script>alert(1)</script> @B_Side" });
    const sent = await owner.next("chat", (message) => message.playerId === ownerId);
    const received = await guest.next("chat", (message) => message.playerId === ownerId);
    assert.equal(sent.id, received.id);
    assert.equal(sent.name, "DJ_Alpha");
    assert.equal(sent.text, "Try the next scene?\n<script>alert(1)</script> @B_Side");
    assert.ok(Number.isFinite(sent.sentAt));

    const lateJoiner = createClient(app.url);
    clients.push(lateJoiner);
    await lateJoiner.ready;
    lateJoiner.send({ type: "join", roomId: created.room.id });
    await lateJoiner.next("room_state");
    await assert.rejects(lateJoiner.next("chat", () => true, 100), /Timed out waiting for chat/);

    for (let index = 0; index < 7; index += 1) {
      const text = `Planning note ${index}`;
      owner.send({ type: "chat", text });
      await owner.next("chat", (message) => message.text === text);
      await guest.next("chat", (message) => message.text === text);
    }
    owner.send({ type: "chat", text: "One too many" });
    assert.equal((await owner.next("error")).code, "chat_rate_limited");
    owner.send({ type: "chat", text: "x".repeat(501) });
    assert.equal((await owner.next("error")).code, "invalid_chat");
    owner.send({ type: "set_name", name: "@invalid" });
    assert.equal((await owner.next("error")).code, "invalid_name");
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

    owner.send({ type: "note_on", track: 0, note: 60, velocity: 110 });
    const played = await peer.next("note_on");
    assert.equal(played.note, 60);
    assert.equal(played.velocity, 110);
    assert.equal(played.slot, created.players[0].slot);

    owner.send({ type: "note_off", track: 0, note: 60 });
    assert.equal((await peer.next("note_off")).note, 60);

    owner.send({ type: "voice", voice: { engine: 0, preset: 1, patch: [0, 0] } });
    assert.equal((await owner.next("error")).code, "unsupported_voice");
    owner.send({ type: "note_on", track: 0, note: 128, velocity: 90 });
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
    owner.send({ type: "note_on", track: 0, note: 64, velocity: 100 });
    await guest.next("note_on");
    assert.equal((await guest.next("note_off")).note, 64);

    owner.send({ type: "note_on", track: 0, note: 65, velocity: 100 });
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
