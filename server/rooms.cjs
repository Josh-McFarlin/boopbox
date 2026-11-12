"use strict";

const { randomUUID } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");
const config = require("../shared/room-config.json");

const GENRES = new Set(config.genres.map(({ id }) => id));
const ENGINE_COUNT = config.presetCounts.length;
const SHAREABLE_DRUM_KITS = new Set(config.shareableDrumKits);
const MAX_BUFFERED_BYTES = 1024 * 1024;
const MAX_PROTOCOL_ERRORS = 5;
const MAX_ROOM_CREATES_PER_MINUTE = 3;

function isIntegerInRange(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function normalizeParameters(engine, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowlist = config.shareableParameters[engine];
  const keys = Object.keys(value);
  if (!allowlist || keys.length > 8) return null;
  const parameters = {};
  for (const key of keys) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !Object.hasOwn(allowlist, key)) return null;
    const [min, max] = allowlist[key];
    if (!isIntegerInRange(value[key], min, max)) return null;
    parameters[key] = value[key];
  }
  return parameters;
}

function normalizeVoice(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.engine === ENGINE_COUNT) {
    if (Object.keys(value).length !== 2 || !Object.hasOwn(value, "kit")) return null;
    if (!Number.isSafeInteger(value.kit) || !SHAREABLE_DRUM_KITS.has(value.kit)) return null;
    return { engine: ENGINE_COUNT, kit: value.kit };
  }
  if (!isIntegerInRange(value.engine, 0, ENGINE_COUNT - 1) || value.engine === 4) return null;
  const keys = Object.keys(value);
  if (!Object.hasOwn(value, "preset") || keys.some((key) => !["engine", "preset", "params"].includes(key))
    || keys.length < 2 || keys.length > 3) return null;
  if (!isIntegerInRange(value.preset, 0, config.presetCounts[value.engine] - 1)) return null;
  if (!Object.hasOwn(config.shareableParameters, value.engine)) return null;
  if (!Object.hasOwn(value, "params")) return { engine: value.engine, preset: value.preset };
  const params = normalizeParameters(value.engine, value.params);
  if (!params) return null;
  return { engine: value.engine, preset: value.preset, params };
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeSparsePairs(value, length, min, max) {
  if (!Array.isArray(value) || value.length > length) return null;
  const seen = new Set();
  const result = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2
      || !isIntegerInRange(pair[0], 0, length - 1)
      || !isIntegerInRange(pair[1], min, max) || seen.has(pair[0])) return null;
    seen.add(pair[0]);
    result.push([pair[0], pair[1]]);
  }
  return result;
}

function normalizeRoomPattern(value, drum) {
  if (!exactObject(value, ["id", "length", "steps", "micro", "fill", "locks", "components", "dir", "seed"])
    || !isIntegerInRange(value.id, 0, 7) || !isIntegerInRange(value.length, 1, 64)
    || !Array.isArray(value.steps) || value.steps.length > 64
    || !Array.isArray(value.locks) || value.locks.length > 32
    || !Array.isArray(value.components) || value.components.length > 16
    || !isIntegerInRange(value.dir, 0, 3) || !isIntegerInRange(value.seed, 0, 255)) return null;

  const steps = [];
  const seenSteps = new Set();
  for (const step of value.steps) {
    if (!Array.isArray(step) || !isIntegerInRange(step[0], 0, 63) || seenSteps.has(step[0])) return null;
    const index = step[0];
    if (drum) {
      if (step.length !== 4 || !isIntegerInRange(step[1], 0, 65535)
        || !Array.isArray(step[2]) || step[2].length !== 16
        || !step[2].every((n) => isIntegerInRange(n, 0, 3))
        || !Array.isArray(step[3]) || step[3].length !== 16
        || !step[3].every((n) => isIntegerInRange(n, 0, 3))) return null;
      steps.push([index, step[1], [...step[2]], [...step[3]]]);
    } else {
      if (step.length !== 2 || !Array.isArray(step[1]) || step[1].length !== 10
        || !step[1].slice(0, 4).every((n) => isIntegerInRange(n, 0, 127))
        || !isIntegerInRange(step[1][4], 0, 4) || !isIntegerInRange(step[1][5], 0, 2)
        || !isIntegerInRange(step[1][6], 0, 127) || !isIntegerInRange(step[1][7], 0, 127)
        || !isIntegerInRange(step[1][8], 0, 127) || !isIntegerInRange(step[1][9], 0, 127)) return null;
      steps.push([index, [...step[1]]]);
    }
    seenSteps.add(index);
  }

  const micro = normalizeSparsePairs(value.micro, 64, -32, 31);
  const fill = normalizeSparsePairs(value.fill, 64, 0, 2);
  if (!micro || !fill) return null;

  const locks = [];
  for (const lock of value.locks) {
    if (!Array.isArray(lock) || lock.length !== 4
      || !isIntegerInRange(lock[0], 0, 63) || typeof lock[1] !== "boolean"
      || !config.lockableParameters.includes(lock[2]) || !isIntegerInRange(lock[3], -32768, 32767)) return null;
    locks.push([...lock]);
  }

  const components = [];
  for (const component of value.components) {
    if (!Array.isArray(component) || component.length !== 4
      || !isIntegerInRange(component[0], 0, 63) || !isIntegerInRange(component[1], 1, 14)
      || !isIntegerInRange(component[2], -128, 127) || !isIntegerInRange(component[3], -128, 127)) return null;
    const [aMin, aMax, bMin, bMax] = config.componentRanges[component[1]] || [];
    if (!isIntegerInRange(component[2], aMin, aMax) || !isIntegerInRange(component[3], bMin, bMax)) return null;
    if (component[1] === 12 && !config.lockableParameters.includes(component[2])) return null;
    if (component[1] === 13 && component[2] === 0) return null;
    components.push([...component]);
  }
  return {
    id: value.id, length: value.length, steps, micro, fill, locks, components,
    dir: value.dir, seed: value.seed,
  };
}

function normalizeRoomPerformance(value) {
  if (!exactObject(value, ["tempo", "playing", "currentScene", "tracks", "scenes"])
    || !isIntegerInRange(value.tempo, 40, 240) || typeof value.playing !== "boolean"
    || !(value.currentScene === null || isIntegerInRange(value.currentScene, 0, 7))
    || !Array.isArray(value.tracks) || value.tracks.length !== 8
    || !exactObject(value.scenes, ["names", "patterns"])
    || !Array.isArray(value.scenes.names) || value.scenes.names.length !== 8
    || !value.scenes.names.every((name) => isIntegerInRange(name, 0, 18))
    || !Array.isArray(value.scenes.patterns) || value.scenes.patterns.length !== 8
    || !value.scenes.patterns.every((scene) => Array.isArray(scene) && scene.length === 8
      && scene.every((pattern) => isIntegerInRange(pattern, 0, 8)))) return null;

  const tracks = [];
  for (let index = 0; index < 8; index += 1) {
    const track = value.tracks[index];
    if (!exactObject(track, ["index", "kind", "voice", "parameters", "currentPattern", "chain", "chainEnabled", "patterns"])
      || track.index !== index || !isIntegerInRange(track.kind, 0, 1)
      || !isIntegerInRange(track.currentPattern, 0, 7) || typeof track.chainEnabled !== "boolean"
      || !Array.isArray(track.chain) || track.chain.length > 16
      || !track.chain.every((slot) => isIntegerInRange(slot, 0, 0x7F) && (slot & 0x08) === 0 && (slot & 0x0F) < 8)
      || !Array.isArray(track.patterns) || track.patterns.length !== 8) return null;
    const voice = track.voice === null ? null : normalizeVoice(track.voice);
    if (track.voice !== null && !voice) return null;
    if (voice && ((track.kind === 1) !== (voice.engine === ENGINE_COUNT))) return null;
    if (!Array.isArray(track.parameters) || track.parameters.length > 63) return null;
    const params = [];
    const seenParams = new Set();
    for (const param of track.parameters) {
      if (!Array.isArray(param) || param.length !== 2
        || !isIntegerInRange(param[0], 0, config.sequenceLengthParameter + 33)
        || !isIntegerInRange(param[1], -128, 127) || seenParams.has(param[0])) return null;
      seenParams.add(param[0]);
      params.push([...param]);
    }
    const patterns = [];
    for (let pattern = 0; pattern < 8; pattern += 1) {
      if (track.patterns[pattern] === null) {
        patterns.push(null);
        continue;
      }
      const normalized = normalizeRoomPattern(track.patterns[pattern], track.kind === 1);
      if (!normalized || normalized.id !== pattern) return null;
      patterns.push(normalized);
    }
    tracks.push({
      index, kind: track.kind, voice, parameters: params,
      currentPattern: track.currentPattern, chain: [...track.chain],
      chainEnabled: track.chainEnabled, patterns,
    });
  }
  const performance = {
    tempo: value.tempo, playing: value.playing, currentScene: value.currentScene, tracks,
    scenes: { names: [...value.scenes.names], patterns: value.scenes.patterns.map((scene) => [...scene]) },
  };
  if (Buffer.byteLength(JSON.stringify(performance), "utf8") > config.maxPerformanceBytes) return null;
  return performance;
}

function createRoomService(server, options = {}) {
  const roomLimit = options.maxRooms ?? config.maxRooms;
  const playerLimit = options.maxPlayers ?? config.maxPlayers;
  const roomTtlMs = options.roomTtlMs ?? config.emptyRoomTtlMs;
  const maxMessagesPerSecond = options.maxMessagesPerSecond ?? config.maxMessagesPerSecond;
  const noteTimeoutMs = options.noteTimeoutMs ?? config.noteTimeoutMs;
  const rooms = new Map();
  const wsServer = new WebSocketServer({
    noServer: true,
    maxPayload: config.maxMessageBytes,
    perMessageDeflate: false,
  });
  let closed = false;

  function safeSend(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      ws.close(1013, "Connection is too slow");
      return false;
    }
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {
      ws.terminate();
      return false;
    }
  }

  function roomSummary(room) {
    return {
      id: room.id,
      genre: room.genre,
      players: room.players.size,
      capacity: playerLimit,
      expiresAt: room.expiresAt,
    };
  }

  function roomState(room) {
    return {
      type: "room_state",
      room: roomSummary(room),
      clock: {
        tempo: room.tempo,
        beat: room.anchorBeat + (Date.now() - room.anchorAt) * room.tempo / 60_000,
        serverAt: Date.now(),
      },
      players: [...room.players.values()].map((player) => ({
        id: player.id,
        slot: player.slot,
        voice: player.voice,
        hasPerformance: !!player.performance,
      })),
    };
  }

  function sendRoomList(ws) {
    safeSend(ws, { type: "rooms", rooms: [...rooms.values()].map(roomSummary) });
  }

  function broadcastRoomList() {
    const message = { type: "rooms", rooms: [...rooms.values()].map(roomSummary) };
    for (const ws of wsServer.clients) safeSend(ws, message);
  }

  function broadcast(room, message) {
    for (const player of room.players.values()) safeSend(player.ws, message);
  }

  function sendPerformances(room, ws) {
    for (const player of room.players.values()) {
      if (!player.performance) continue;
      safeSend(ws, {
        type: "performance",
        playerId: player.id,
        slot: player.slot,
        performance: player.performance,
        clock: {
          tempo: room.tempo,
          beat: room.anchorBeat + (Date.now() - room.anchorAt) * room.tempo / 60_000,
          serverAt: Date.now(),
        },
      });
    }
  }

  function noteKey(track, note) {
    return `${track}:${note}`;
  }

  function releaseNotes(player) {
    if (!player.room) return;
    for (const [key, timer] of player.activeNotes) {
      clearTimeout(timer);
      const [track, note] = key.split(":").map(Number);
      broadcast(player.room, {
        type: "note_off",
        playerId: player.id,
        slot: player.slot,
        track,
        note,
      });
    }
    player.activeNotes.clear();
  }

  function removeEmptyRoom(room) {
    if (rooms.get(room.id) !== room || room.players.size !== 0) return;
    clearTimeout(room.expiryTimer);
    rooms.delete(room.id);
    broadcastRoomList();
  }

  function leaveRoom(player) {
    const room = player.room;
    if (!room) return;
    releaseNotes(player);
    room.players.delete(player.id);
    player.room = null;
    player.voice = null;
    player.performance = null;
    player.slot = null;
    if (room.players.size === 0) {
      room.expiresAt = Date.now() + roomTtlMs;
      room.anchorBeat = 0;
      room.anchorAt = Date.now();
      room.tempo = config.defaultTempo;
      room.expiryTimer = setTimeout(() => removeEmptyRoom(room), roomTtlMs);
      room.expiryTimer.unref?.();
    } else {
      broadcast(room, roomState(room));
    }
    broadcastRoomList();
  }

  function sendError(player, code) {
    safeSend(player.ws, { type: "error", code });
  }

  function protocolError(player, code = "invalid_message") {
    player.protocolErrors += 1;
    sendError(player, code);
    if (player.protocolErrors >= MAX_PROTOCOL_ERRORS) player.ws.close(1008, "Invalid messages");
  }

  function findFreeSlot(room) {
    const occupied = new Set([...room.players.values()].map((player) => player.slot));
    for (let slot = 0; slot < playerLimit; slot += 1) {
      if (!occupied.has(slot)) return slot;
    }
    return null;
  }

  function joinRoom(player, room) {
    if (room.players.size >= playerLimit) {
      sendError(player, "room_full");
      return;
    }
    clearTimeout(room.expiryTimer);
    room.expiryTimer = null;
    room.expiresAt = null;
    player.room = room;
    player.slot = findFreeSlot(room);
    player.voice = null;
    player.performance = null;
    player.soundEditsPaused = false;
    room.players.set(player.id, player);
    safeSend(player.ws, roomState(room));
    sendPerformances(room, player.ws);
    broadcast(room, roomState(room));
    broadcastRoomList();
  }

  function exactKeys(message, expected) {
    const keys = Object.keys(message).sort();
    const wanted = [...expected].sort();
    return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
  }

  function validEnvelope(message, keys) {
    return message && typeof message === "object" && !Array.isArray(message)
      && message.v === config.protocolVersion && exactKeys(message, ["type", "v", ...keys]);
  }

  function applyMessage(player, message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.type !== "string") {
      protocolError(player);
      return;
    }

    switch (message.type) {
      case "list":
        if (!validEnvelope(message, [])) return protocolError(player);
        if (Date.now() - player.lastListAt < 1000) return sendError(player, "rate_limited");
        player.lastListAt = Date.now();
        sendRoomList(player.ws);
        break;
      case "create": {
        if (!validEnvelope(message, ["genre"]) || !GENRES.has(message.genre)) return protocolError(player);
        if (player.room) return sendError(player, "already_in_room");
        const now = Date.now();
        player.createTimes = player.createTimes.filter((time) => now - time < 60_000);
        if (player.createTimes.length >= MAX_ROOM_CREATES_PER_MINUTE) return sendError(player, "rate_limited");
        if (rooms.size >= roomLimit) return sendError(player, "server_full");
        player.createTimes.push(now);
        const room = {
          id: randomUUID(),
          genre: message.genre,
          tempo: config.defaultTempo,
          anchorBeat: 0,
          anchorAt: now,
          players: new Map(),
          expiryTimer: null,
          expiresAt: null,
        };
        rooms.set(room.id, room);
        joinRoom(player, room);
        break;
      }
      case "join": {
        if (!validEnvelope(message, ["roomId"]) || typeof message.roomId !== "string" || message.roomId.length > 36) {
          return protocolError(player);
        }
        if (player.room) return sendError(player, "already_in_room");
        const room = rooms.get(message.roomId);
        if (!room) return sendError(player, "room_not_found");
        joinRoom(player, room);
        break;
      }
      case "leave":
        if (!validEnvelope(message, [])) return protocolError(player);
        leaveRoom(player);
        break;
      case "voice": {
        if (!validEnvelope(message, ["voice"])) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        const voice = normalizeVoice(message.voice);
        if (!voice) return protocolError(player, "unsupported_voice");
        const now = Date.now();
        if (now - player.lastVoiceAt < 250) return sendError(player, "rate_limited");
        player.lastVoiceAt = now;
        player.voice = voice;
        broadcast(player.room, {
          type: "voice",
          playerId: player.id,
          slot: player.slot,
          voice,
        });
        break;
      }
      case "sound_edit": {
        if (!validEnvelope(message, ["track", "param", "value"])
          || !isIntegerInRange(message.track, 0, 7)) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        const voice = player.performance?.tracks[message.track]?.voice
          || (message.track === 0 ? player.voice : null);
        if (!voice || voice.engine === ENGINE_COUNT) return sendError(player, "voice_not_set");
        const allowlist = config.shareableParameters[voice.engine];
        const range = Number.isSafeInteger(message.param) ? allowlist?.[message.param] : null;
        if (!range || !isIntegerInRange(message.value, range[0], range[1])) {
          return protocolError(player, "unsupported_sound_edit");
        }
        if (player.soundEditsPaused) break;
        if (player.performance) {
          const track = player.performance.tracks[message.track];
          track.voice = {
            ...track.voice,
            params: { ...(track.voice.params || {}), [message.param]: message.value },
          };
        }
        if (message.track === 0) {
          player.voice = {
            ...player.voice,
            params: { ...(player.voice?.params || {}), [message.param]: message.value },
          };
        }
        broadcast(player.room, {
          type: "sound_edit",
          playerId: player.id,
          slot: player.slot,
          track: message.track,
          param: message.param,
          value: message.value,
        });
        break;
      }
      case "sound_edit_sharing": {
        if (!validEnvelope(message, ["paused"]) || typeof message.paused !== "boolean") {
          return protocolError(player);
        }
        if (!player.room) return sendError(player, "not_in_room");
        player.soundEditsPaused = message.paused;
        break;
      }
      case "performance": {
        if (!validEnvelope(message, ["performance"])) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        const performance = normalizeRoomPerformance(message.performance);
        if (!performance) return protocolError(player, "invalid_performance");
        const now = Date.now();
        if (now - player.lastPerformanceAt < 1000) return sendError(player, "rate_limited");
        player.lastPerformanceAt = now;
        const room = player.room;
        if (room.tempo !== performance.tempo) {
          room.anchorBeat += (now - room.anchorAt) * room.tempo / 60_000;
          room.anchorAt = now;
          room.tempo = performance.tempo;
        }
        if (player.soundEditsPaused && player.performance) {
          for (let track = 0; track < performance.tracks.length; track += 1) {
            const currentVoice = player.performance.tracks[track].voice;
            const nextVoice = performance.tracks[track].voice;
            if (!currentVoice || !nextVoice || currentVoice.engine !== nextVoice.engine
              || currentVoice.preset !== nextVoice.preset || currentVoice.kit !== nextVoice.kit) continue;
            const allowlist = config.shareableParameters[currentVoice.engine] || {};
            for (const parameter of Object.keys(allowlist)) {
              if (Object.hasOwn(currentVoice.params || {}, parameter)) {
                nextVoice.params = { ...(nextVoice.params || {}), [parameter]: currentVoice.params[parameter] };
              }
            }
          }
        }
        player.performance = performance;
        player.voice = performance.tracks.find((track) => track.voice)?.voice || null;
        for (const member of room.players.values()) {
          if (member.performance) member.performance.tempo = room.tempo;
        }
        broadcast(room, {
          type: "performance",
          playerId: player.id,
          slot: player.slot,
          performance,
          clock: {
            tempo: room.tempo,
            beat: room.anchorBeat + (now - room.anchorAt) * room.tempo / 60_000,
            serverAt: now,
          },
        });
        break;
      }
      case "transport": {
        if (!validEnvelope(message, ["playing", "tempo"]) || typeof message.playing !== "boolean"
          || !isIntegerInRange(message.tempo, 40, 240)) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        if (!player.performance) return sendError(player, "performance_not_set");
        const now = Date.now();
        if (now - player.lastTransportAt < 80) return sendError(player, "rate_limited");
        player.lastTransportAt = now;
        const room = player.room;
        if (room.tempo !== message.tempo) {
          room.anchorBeat += (now - room.anchorAt) * room.tempo / 60_000;
          room.anchorAt = now;
          room.tempo = message.tempo;
          for (const member of room.players.values()) {
            if (member.performance) member.performance.tempo = room.tempo;
          }
        }
        player.performance.playing = message.playing;
        broadcast(room, {
          type: "transport",
          playerId: player.id,
          slot: player.slot,
          playing: message.playing,
          clock: {
            tempo: room.tempo,
            beat: room.anchorBeat + (now - room.anchorAt) * room.tempo / 60_000,
            serverAt: now,
          },
        });
        break;
      }
      case "note_on": {
        if (!validEnvelope(message, ["track", "note", "velocity"])
          || !isIntegerInRange(message.track, 0, 7)) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        if (!player.performance?.tracks[message.track]?.voice
          && !(message.track === 0 && player.voice)) return sendError(player, "voice_not_set");
        if (!isIntegerInRange(message.note, 0, 127) || !isIntegerInRange(message.velocity, 1, 127)) {
          return protocolError(player);
        }
        const key = noteKey(message.track, message.note);
        if (!player.activeNotes.has(key) && player.activeNotes.size >= config.maxActiveNotesPerPlayer) {
          return sendError(player, "too_many_notes");
        }
        clearTimeout(player.activeNotes.get(key));
        const timer = setTimeout(() => {
          if (player.activeNotes.get(key) !== timer) return;
          player.activeNotes.delete(key);
          if (player.room) {
            broadcast(player.room, {
              type: "note_off",
              playerId: player.id,
              slot: player.slot,
              track: message.track,
              note: message.note,
            });
          }
        }, noteTimeoutMs);
        timer.unref?.();
        player.activeNotes.set(key, timer);
        broadcast(player.room, {
          type: "note_on",
          playerId: player.id,
          slot: player.slot,
          track: message.track,
          note: message.note,
          velocity: message.velocity,
        });
        break;
      }
      case "note_off": {
        if (!validEnvelope(message, ["track", "note"]) || !isIntegerInRange(message.track, 0, 7)
          || !isIntegerInRange(message.note, 0, 127)) {
          return protocolError(player);
        }
        if (!player.room) return sendError(player, "not_in_room");
        const key = noteKey(message.track, message.note);
        const timer = player.activeNotes.get(key);
        if (timer) {
          clearTimeout(timer);
          player.activeNotes.delete(key);
          broadcast(player.room, {
            type: "note_off",
            playerId: player.id,
            slot: player.slot,
            track: message.track,
            note: message.note,
          });
        }
        break;
      }
      case "panic":
        if (!validEnvelope(message, [])) return protocolError(player);
        releaseNotes(player);
        break;
      default:
        protocolError(player, "unsupported_message");
    }
  }

  function acceptOrigin(request) {
    if (typeof request.headers.origin !== "string" || typeof request.headers.host !== "string") return false;
    try {
      const origin = new URL(request.headers.origin);
      return (origin.protocol === "http:" || origin.protocol === "https:")
        && origin.host.toLowerCase() === request.headers.host.toLowerCase();
    } catch {
      return false;
    }
  }

  function onConnection(ws) {
    const player = {
      id: randomUUID(),
      ws,
      room: null,
      slot: null,
      voice: null,
      performance: null,
      soundEditsPaused: false,
      activeNotes: new Map(),
      messageTimes: [],
      createTimes: [],
      protocolErrors: 0,
      lastVoiceAt: 0,
      lastPerformanceAt: 0,
      lastTransportAt: 0,
      lastListAt: 0,
    };
    safeSend(ws, { type: "connected", playerId: player.id });
    sendRoomList(ws);

    ws.on("message", (raw, isBinary) => {
      if (isBinary || raw.length > config.maxMessageBytes) {
        ws.close(1003, "Text messages only");
        return;
      }
      const now = Date.now();
      player.messageTimes = player.messageTimes.filter((time) => now - time < 1000);
      if (player.messageTimes.length >= maxMessagesPerSecond) {
        sendError(player, "rate_limited");
        return;
      }
      player.messageTimes.push(now);
      let message;
      try {
        message = JSON.parse(raw.toString("utf8"));
      } catch {
        protocolError(player);
        return;
      }
      applyMessage(player, message);
    });

    ws.on("close", () => leaveRoom(player));
    ws.on("error", () => leaveRoom(player));
  }

  function onUpgrade(request, socket, head) {
    let pathname;
    try {
      const url = new URL(request.url, `http://${request.headers.host || "invalid"}`);
      pathname = url.pathname;
      if (pathname !== "/api/rooms" || url.search || url.hash || !acceptOrigin(request)) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    if (closed || wsServer.clients.size >= (options.maxSockets ?? config.maxSockets)) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit("connection", ws, request);
    });
  }

  wsServer.on("connection", onConnection);
  server.on("upgrade", onUpgrade);

  const heartbeat = setInterval(() => {
    for (const ws of wsServer.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 25_000);
  heartbeat.unref?.();
  wsServer.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
  });

  return {
    stats: () => ({ rooms: rooms.size, sockets: wsServer.clients.size }),
    close: () => {
      closed = true;
      clearInterval(heartbeat);
      server.off("upgrade", onUpgrade);
      for (const room of rooms.values()) clearTimeout(room.expiryTimer);
      rooms.clear();
      for (const ws of wsServer.clients) ws.close(1001, "Server restarting");
      wsServer.close();
    },
  };
}

module.exports = { createRoomService, normalizeVoice, normalizeRoomPerformance };
