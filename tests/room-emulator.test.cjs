"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const { WebSocket } = require("ws");
const config = require("../shared/room-config.json");
const { createRoomService, normalizeRoomPerformance } = require("../server/rooms.cjs");

test("room listener retries a failed performance update and applies the saved version", async () => {
  const { applyPerformanceWithRetry } = await import("../web/src/rooms/performance-sync.js");
  const states = new Map();
  const errors = [];
  const calls = [];
  const performance = { version: 1 };
  const audio = {
    async setPerformance(_slot, next) {
      calls.push(next.version);
      if (calls.length === 1) throw new Error("temporary renderer failure");
    },
  };

  applyPerformanceWithRetry({
    states, audio, playerId: "listener", slot: 2, performance,
    onError: (error) => errors.push(error.message), retryDelayMs: 5,
  });
  await wait(30);

  assert.deepEqual(calls, [1, 1]);
  assert.equal(states.get("listener").applied, true);
  assert.deepEqual(errors, []);
});

test("a newer room performance supersedes an older scheduled retry", async () => {
  const { applyPerformanceWithRetry } = await import("../web/src/rooms/performance-sync.js");
  const states = new Map();
  const errors = [];
  const calls = [];
  const audio = {
    async setPerformance(_slot, performance) {
      calls.push(performance.version);
      if (performance.version === 1) throw new Error("older update failed");
    },
  };

  applyPerformanceWithRetry({
    states, audio, playerId: "listener", slot: 2, performance: { version: 1 },
    onError: (error) => errors.push(error.message), retryDelayMs: 30,
  });
  await wait(0);
  applyPerformanceWithRetry({
    states, audio, playerId: "listener", slot: 2, performance: { version: 2 },
    onError: (error) => errors.push(error.message), retryDelayMs: 30,
  });
  await wait(50);

  assert.deepEqual(calls, [1, 2]);
  assert.equal(states.get("listener").performance.version, 2);
  assert.equal(states.get("listener").applied, true);
  assert.deepEqual(errors, []);
});

test("a permanently failing performance reports its error after bounded retries", async () => {
  const { applyPerformanceWithRetry } = await import("../web/src/rooms/performance-sync.js");
  const states = new Map();
  const errors = [];
  let attempts = 0;
  applyPerformanceWithRetry({
    states,
    audio: { async setPerformance() { attempts += 1; throw new Error("renderer unavailable"); } },
    playerId: "listener",
    slot: 2,
    performance: { version: 1 },
    onError: (error) => errors.push(error.message),
    retryDelayMs: 5,
    maxRetries: 2,
  });
  await wait(40);
  applyPerformanceWithRetry({
    states,
    audio: { async setPerformance() { attempts += 1; throw new Error("renderer unavailable"); } },
    playerId: "listener",
    slot: 2,
    performance: { version: 1 },
    onError: (error) => errors.push(error.message),
    retryDelayMs: 5,
    maxRetries: 2,
  });

  assert.equal(attempts, 3);
  assert.deepEqual(errors, ["renderer unavailable"]);
  assert.equal(states.get("listener").failed, true);
});

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

function createClient(url, browserId = randomUUID()) {
  const ws = new WebSocket(url, { headers: { Origin: url.replace(/^ws:/, "http:").replace(/\/api\/rooms$/, "") } });
  const inbox = [];
  const waiters = [];
  let resolveIdentified;
  const identified = new Promise((resolve) => { resolveIdentified = resolve; });
  const opened = once(ws, "open");
  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === "identified") resolveIdentified(message);
    const index = waiters.findIndex((waiter) => waiter.match(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else inbox.push(message);
  });
  ws.on("open", () => {
    ws.send(JSON.stringify({ v: config.protocolVersion, type: "identify", browserId }));
  });
  return {
    ws,
    ready: opened.then(() => identified),
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
  const { buildEmulatorPerformance, syncEmulatorSnapshot } = await import("../web/src/rooms/device.js");
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
  const originalDocument = global.document;
  let roomAudio;
  try {
    global.document = { baseURI: "http://localhost/webapp/rooms/" };
    const emulatorPlayer = createClient(app.url);
    const listener = createClient(app.url);
    clients.push(emulatorPlayer, listener);
    await Promise.all([emulatorPlayer.ready, listener.ready]);

    emulatorPlayer.send({ type: "create", genre: "house" });
    const roomState = await emulatorPlayer.next("room_state");
    const ownerId = roomState.players[0].id;
    listener.send({ type: "join", roomId: roomState.room.id });
    const listenerState = await listener.next("room_state");

    const snapshotState = { performanceKey: "", transportKey: null, hasPerformance: false };
    const initialSync = syncEmulatorSnapshot({
      project: projectBytes, tracks: snapshot.tracks, tempo: snapshot.tempo, playing: snapshot.playing,
    }, snapshotState, (message) => {
      emulatorPlayer.send(message);
      return true;
    });
    assert.equal(initialSync.hasPerformance, true);
    Object.assign(snapshotState, initialSync);
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

    await wait(100);
    emulatorPlayer.send({ type: "transport", playing: true, tempo: 128 });
    const started = await listener.next("transport", (message) => message.playerId === ownerId && message.playing);
    assert.equal(started.playing, true);
    assert.equal(started.clock.tempo, 128);

    // A later emulator snapshot changes while the owner is already playing.
    await wait(1000);
    project.tracks[0].pat.steps[0].notes[0] = 64;
    const updatedProjectBytes = PROJ7.encode(project);
    const updatedSync = syncEmulatorSnapshot({
      project: updatedProjectBytes, tracks: snapshot.tracks, tempo: 128, playing: true,
    }, snapshotState, (message) => {
      emulatorPlayer.send(message);
      return true;
    });
    assert.notEqual(updatedSync.performanceKey, snapshotState.performanceKey);
    Object.assign(snapshotState, updatedSync);
    const updatedPerformance = await listener.next("performance", (message) => message.playerId === ownerId);
    assert.equal(updatedPerformance.performance.playing, true);
    assert.equal(updatedPerformance.performance.tracks[0].patterns[0].steps[0][1][0], 64);

    // Apply the relayed update to the same state-message path used by the listener's audio worklet.
    const [{ RoomAudio }, { RoomFirmwareAudio }] = await Promise.all([
      import("../web/src/rooms/audio.js"),
      import("../web/site/public/editor/preview-worklet.js"),
    ]);
    roomAudio = new RoomAudio(() => {});
    const audioMessages = [];
    roomAudio.node = { port: { postMessage: (message) => audioMessages.push(message) }, disconnect() {} };
    const ownerSlot = roomState.players.find((player) => player.id === ownerId).slot;
    const listenerId = listenerState.players.find((player) => player.id !== ownerId).id;
    const listenerSlot = listenerState.players.find((player) => player.id === listenerId).slot;
    await roomAudio.setPerformance(ownerSlot, receivedPerformance.performance, receivedPerformance.clock);
    const initialRendererState = audioMessages.filter((message) => message.type === "state"
      && message.slot === ownerSlot && message.group === 0).at(-1).state;
    await roomAudio.setPerformance(ownerSlot, updatedPerformance.performance, updatedPerformance.clock);
    const updatedRendererState = audioMessages.filter((message) => message.type === "state"
      && message.slot === ownerSlot && message.group === 0).at(-1).state;
    assert.equal(updatedRendererState.playing, true);
    assert.notDeepEqual(
      updatedRendererState.tracks[0].roomPatterns[0].bytes,
      initialRendererState.tracks[0].roomPatterns[0].bytes,
    );
    const previewModule = await WebAssembly.compile(await readFile("build/preview/boopbox-preview.wasm"));
    const renderer = new RoomFirmwareAudio(previewModule);
    renderer.sync(ownerSlot, 0, updatedRendererState);
    assert.equal(renderer.active[ownerSlot][0], true, "the playing performance is active in the listener's mixer");
    let ownerRenderCalls = 0;
    const ownerDsp = renderer.players[ownerSlot][0];
    const renderOwner = ownerDsp.render.bind(ownerDsp);
    ownerDsp.render = (left, right) => {
      ownerRenderCalls += 1;
      renderOwner(left, right);
    };
    renderer.render(new Float32Array(128), new Float32Array(128));
    assert.equal(ownerRenderCalls, 1, "the listener renders the departing player's sequenced slot");

    // A second player's stopped performance stays independent while tempo is shared.
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
    const lateJoinState = await lateJoiner.next("room_state");
    const lateJoinerId = lateJoinState.players.find((player) => player.id !== ownerId
      && player.id !== listenerId).id;
    const lateJoinerSlot = lateJoinState.players.find((player) => player.id === lateJoinerId).slot;
    const restoredOwner = await lateJoiner.next("performance", (message) => message.playerId === ownerId);
    const restoredListener = await lateJoiner.next("performance", (message) => message.playerId === listenerId);
    assert.equal(restoredOwner.performance.playing, true);
    assert.equal(restoredOwner.performance.tempo, 140);
    assert.equal(restoredOwner.performance.tracks[0].patterns[0].steps[0][1][0], 64);
    assert.equal(restoredListener.performance.playing, false);
    assert.equal(restoredListener.performance.tempo, 140);
    assert.equal(restoredListener.performance.tracks[0].patterns[0].steps[0][1][0], 67);

    // An unclean owner disconnect must release its sustained notes to every
    // listener, and a later room join must not replay those live notes.
    const heldNote = 72;
    emulatorPlayer.send({ type: "note_on", track: 0, note: heldNote, velocity: 96 });
    const notePredicate = (message) => message.playerId === ownerId && message.track === 0
      && message.note === heldNote;
    await Promise.all([
      listener.next("note_on", notePredicate),
      lateJoiner.next("note_on", notePredicate),
    ]);
    const socketClosed = once(emulatorPlayer.ws, "close");
    emulatorPlayer.ws.terminate();
    await socketClosed;
    const listenerRoomState = await listener.next("room_state", (message) => (
      !message.players.some((player) => player.id === ownerId)
    ));
    await lateJoiner.next("room_state", (message) => !message.players.some((player) => player.id === ownerId));
    assert.ok(!listenerRoomState.players.some((player) => player.slot === ownerSlot));
    await roomAudio.removeVoice(ownerSlot);
    const dropMessage = audioMessages.findLast((message) => message.type === "drop" && message.slot === ownerSlot);
    assert.ok(dropMessage, "the listener drops the departed player's audio slot");
    renderer.drop(dropMessage.slot);
    assert.deepEqual(renderer.active[ownerSlot], [false, false]);
    const renderCallsBeforeNextBlock = ownerRenderCalls;
    renderer.render(new Float32Array(128), new Float32Array(128));
    assert.equal(ownerRenderCalls, renderCallsBeforeNextBlock, "the departed player's slot is no longer rendered");

    const [listenerRelease, lateJoinerRelease] = await Promise.all([
      listener.next("note_off", notePredicate),
      lateJoiner.next("note_off", notePredicate),
    ]);
    assert.equal(listenerRelease.slot, roomState.players[0].slot);
    assert.equal(lateJoinerRelease.note, heldNote);

    // A normal Leave action also removes that player's sequenced slot for listeners.
    const leavingPerformance = structuredClone(listenerPerformance);
    leavingPerformance.playing = true;
    lateJoiner.send({ type: "performance", performance: leavingPerformance });
    const leavingUpdate = await listener.next("performance", (message) => message.playerId === lateJoinerId);
    await roomAudio.setPerformance(lateJoinerSlot, leavingUpdate.performance, leavingUpdate.clock);
    const leavingState = audioMessages.filter((message) => message.type === "state"
      && message.slot === lateJoinerSlot && message.group === 0).at(-1).state;
    renderer.sync(lateJoinerSlot, 0, leavingState);
    assert.equal(renderer.active[lateJoinerSlot][0], true);
    let leavingRenderCalls = 0;
    const leavingDsp = renderer.players[lateJoinerSlot][0];
    const renderLeaving = leavingDsp.render.bind(leavingDsp);
    leavingDsp.render = (left, right) => {
      leavingRenderCalls += 1;
      renderLeaving(left, right);
    };
    renderer.render(new Float32Array(128), new Float32Array(128));
    assert.equal(leavingRenderCalls, 1, "the listener renders the player who will leave normally");
    lateJoiner.send({ type: "leave" });
    const afterLeave = await listener.next("room_state", (message) => (
      !message.players.some((player) => player.id === lateJoinerId)
    ));
    assert.ok(!afterLeave.players.some((player) => player.slot === lateJoinerSlot));
    await roomAudio.removeVoice(lateJoinerSlot);
    renderer.drop(lateJoinerSlot);
    assert.deepEqual(renderer.active[lateJoinerSlot], [false, false]);
    const leavingRenderCallsBeforeNextBlock = leavingRenderCalls;
    renderer.render(new Float32Array(128), new Float32Array(128));
    assert.equal(leavingRenderCalls, leavingRenderCallsBeforeNextBlock,
      "the normally departing player's slot is no longer rendered");

    const rejoiner = createClient(app.url);
    clients.push(rejoiner);
    await rejoiner.ready;
    rejoiner.send({ type: "join", roomId: roomState.room.id });
    const rejoinState = await rejoiner.next("room_state");
    assert.ok(rejoinState.players.every((player) => player.id !== ownerId));
    for (const type of ["note_on", "note_off"]) {
      await assert.rejects(
        rejoiner.next(type, notePredicate, 120),
        /Timed out waiting/,
        `a later joiner should not receive stale ${type} events`,
      );
    }
  } finally {
    await roomAudio?.close();
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    await app.close(clients);
  }
});
