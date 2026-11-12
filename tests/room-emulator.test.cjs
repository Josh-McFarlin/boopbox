"use strict";

const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const { WebSocket } = require("ws");
const config = require("../shared/room-config.json");
const { createRoomService, normalizeRoomPerformance } = require("../server/rooms.cjs");

function createEmulatorWorklet(messages) {
  let Processor;
  class AudioWorkletProcessor {
    constructor() {
      this.port = {
        onmessage: null,
        postMessage: (message) => messages.push(message),
      };
    }
  }
  const context = {
    Array,
    ArrayBuffer,
    AudioWorkletProcessor,
    Float32Array,
    Map,
    Uint8Array,
    WebAssembly,
    registerProcessor: (_name, processor) => { Processor = processor; },
  };
  runInNewContext(require("node:fs").readFileSync("web/site/public/emu/emu-worklet.js", "utf8"), context);
  const module = new WebAssembly.Module(require("node:fs").readFileSync("build/emu/boopbox-emu.wasm"));
  return new Processor({ processorOptions: { module, flash: null, roomMode: true } });
}

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
    next(type, predicate = () => true, timeoutMs = 2000) {
      const index = inbox.findIndex((message) => message.type === type && predicate(message));
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          match: (message) => message.type === type && predicate(message),
          resolve,
          timer: setTimeout(() => {
            const i = waiters.indexOf(waiter);
            if (i >= 0) waiters.splice(i, 1);
            reject(new Error(`Timed out waiting for ${type}; queued messages: ${inbox.map((message) => message.type).join(", ")}`));
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

async function startRoomServer() {
  const server = createServer();
  const service = createRoomService(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    service,
    url: `ws://127.0.0.1:${port}/api/rooms`,
    async close(clients) {
      await Promise.all(clients.map((client) => client.close()));
      service.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("browser emulator notes and sequenced performance reach room players and late joiners", async () => {
  const { buildEmulatorPerformance } = await import("../web/src/rooms/device.js");
  const { PROJ7 } = await import("../web/src/editor/lib/proto.js");
  const workletMessages = [];
  const emulator = createEmulatorWorklet(workletMessages);
  emulator.input({ t: "room-snapshot" });
  const snapshot = workletMessages.find((message) => message.t === "room-snapshot");
  assert.ok(snapshot, "the emulator worklet exports a room snapshot");
  assert.equal(snapshot.tracks.length, 8);

  // Add one known sequenced note to the real firmware project format so the
  // test can verify sequence data, not just an empty default project.
  const project = PROJ7.decode(new Uint8Array(snapshot.project));
  assert.ok(project, "the emulator project decodes in the production protocol");
  project.tracks[0].pat.steps[0] = {
    notes: [60, 0, 0, 0], n: 1, time: 0, flags: 0, vel: 100, lvl: 0, rat: 0,
  };
  const projectBytes = PROJ7.encode(project);
  const performance = buildEmulatorPerformance(projectBytes, snapshot.tracks, {
    tempo: snapshot.tempo,
    playing: snapshot.playing,
  });
  assert.ok(normalizeRoomPerformance(performance), "the server accepts the emulator's factory tracks and sequence");
  assert.equal(performance.tracks[0].patterns[0].steps[0][1][0], 60);

  const app = await startRoomServer();
  const clients = [];
  try {
    const emulatorPlayer = createClient(app.url);
    const listener = createClient(app.url);
    clients.push(emulatorPlayer, listener);
    await Promise.all([emulatorPlayer.ready, listener.ready]);

    emulatorPlayer.send({ type: "create", genre: "house" });
    const roomState = await emulatorPlayer.next("room_state");
    const ownerId = roomState.players[0].id;
    listener.send({ type: "join", roomId: roomState.room.id });
    const listenerState = await listener.next("room_state");

    emulatorPlayer.send({ type: "performance", performance });
    const receivedPerformance = await listener.next("performance", (message) => message.playerId === ownerId);
    assert.equal(receivedPerformance.performance.tracks[0].patterns[0].steps[0][1][0], 60);
    assert.equal(receivedPerformance.performance.tracks[0].voice.preset, snapshot.tracks[0].preset);

    // The iframe bridge forwards this worklet event as a room note message.
    emulator.input({ t: "key", k: 7, down: true, vel: 111 });
    const noteOn = workletMessages.filter((message) => message.t === "room-note").at(-1);
    assert.deepEqual(
      { track: noteOn.track, note: noteOn.note, velocity: noteOn.velocity, down: noteOn.down },
      { track: 0, note: 36, velocity: 111, down: true },
    );
    emulatorPlayer.send({
      type: "note_on", track: noteOn.track, note: noteOn.note, velocity: noteOn.velocity,
    });
    const relayedNoteOn = await listener.next("note_on");
    assert.equal(relayedNoteOn.playerId, ownerId);
    assert.equal(relayedNoteOn.track, noteOn.track);
    assert.equal(relayedNoteOn.note, noteOn.note);
    assert.equal(relayedNoteOn.velocity, 111);

    emulator.input({ t: "key", k: 7, down: false });
    const noteOff = workletMessages.filter((message) => message.t === "room-note").at(-1);
    assert.equal(noteOff.down, false);
    assert.equal(noteOff.note, noteOn.note);
    emulatorPlayer.send({ type: "note_off", track: noteOff.track, note: noteOff.note });
    const relayedNoteOff = await listener.next("note_off");
    assert.equal(relayedNoteOff.playerId, ownerId);
    assert.equal(relayedNoteOff.note, noteOff.note);

    emulatorPlayer.send({ type: "transport", playing: true, tempo: 128 });
    const started = await listener.next("transport", (message) => message.playerId === ownerId);
    assert.equal(started.playing, true);
    assert.equal(started.clock.tempo, 128);

    // A second player's stopped performance stays independent while tempo is shared.
    const listenerId = listenerState.players.find((player) => player.id !== ownerId).id;
    const listenerPerformance = structuredClone(performance);
    listenerPerformance.playing = false;
    listenerPerformance.tempo = 128;
    listenerPerformance.tracks[0].patterns[0].steps[0][1][0] = 67;
    listener.send({ type: "performance", performance: listenerPerformance });
    const independent = await emulatorPlayer.next("performance", (message) => message.playerId === listenerId);
    assert.equal(independent.performance.playing, false);
    assert.equal(independent.performance.tracks[0].patterns[0].steps[0][1][0], 67);

    listener.send({ type: "transport", playing: true, tempo: 140 });
    const listenerStarted = await emulatorPlayer.next("transport", (message) => message.playerId === listenerId);
    assert.equal(listenerStarted.playing, true);
    assert.equal(listenerStarted.clock.tempo, 140);
    await wait(90);
    listener.send({ type: "transport", playing: false, tempo: 140 });
    const listenerStopped = await emulatorPlayer.next("transport", (message) => message.playerId === listenerId);
    assert.equal(listenerStopped.playing, false);

    const lateJoiner = createClient(app.url);
    clients.push(lateJoiner);
    await lateJoiner.ready;
    lateJoiner.send({ type: "join", roomId: roomState.room.id });
    await lateJoiner.next("room_state");
    const restoredOwner = await lateJoiner.next("performance", (message) => message.playerId === ownerId);
    const restoredListener = await lateJoiner.next("performance", (message) => message.playerId === listenerId);
    assert.equal(restoredOwner.performance.playing, true);
    assert.equal(restoredOwner.performance.tempo, 140);
    assert.equal(restoredOwner.performance.tracks[0].patterns[0].steps[0][1][0], 60);
    assert.equal(restoredListener.performance.playing, false);
    assert.equal(restoredListener.performance.tempo, 140);
    assert.equal(restoredListener.performance.tracks[0].patterns[0].steps[0][1][0], 67);
  } finally {
    await app.close(clients);
  }
});
