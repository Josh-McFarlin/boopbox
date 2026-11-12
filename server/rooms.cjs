"use strict";

const { randomUUID } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");
const config = require("../shared/room-config.json");

const GENRES = new Set(config.genres.map(({ id }) => id));
const ENGINE_COUNT = config.presetCounts.length;
const SHAREABLE_DRUM_KITS = new Set(config.shareableDrumKits);
const MAX_BUFFERED_BYTES = 64 * 1024;
const MAX_PROTOCOL_ERRORS = 5;
const MAX_ROOM_CREATES_PER_MINUTE = 3;

function isIntegerInRange(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function normalizeVoice(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.engine === ENGINE_COUNT) {
    if (Object.keys(value).length !== 2 || !Object.hasOwn(value, "kit")) return null;
    if (!Number.isSafeInteger(value.kit) || !SHAREABLE_DRUM_KITS.has(value.kit)) return null;
    return { engine: ENGINE_COUNT, kit: value.kit };
  }
  if (!isIntegerInRange(value.engine, 0, ENGINE_COUNT - 1) || value.engine === 4) return null;
  if (Object.keys(value).length !== 2 || !Object.hasOwn(value, "preset")) return null;
  if (!isIntegerInRange(value.preset, 0, config.presetCounts[value.engine] - 1)) return null;
  return { engine: value.engine, preset: value.preset };
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
      players: [...room.players.values()].map((player) => ({
        id: player.id,
        slot: player.slot,
        voice: player.voice,
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

  function releaseNotes(player) {
    if (!player.room) return;
    for (const [note, timer] of player.activeNotes) {
      clearTimeout(timer);
      broadcast(player.room, {
        type: "note_off",
        playerId: player.id,
        slot: player.slot,
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
    player.slot = null;
    if (room.players.size === 0) {
      room.expiresAt = Date.now() + roomTtlMs;
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
    room.players.set(player.id, player);
    safeSend(player.ws, roomState(room));
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
      case "note_on": {
        if (!validEnvelope(message, ["note", "velocity"])) return protocolError(player);
        if (!player.room) return sendError(player, "not_in_room");
        if (!player.voice) return sendError(player, "voice_not_set");
        if (!isIntegerInRange(message.note, 0, 127) || !isIntegerInRange(message.velocity, 1, 127)) {
          return protocolError(player);
        }
        if (!player.activeNotes.has(message.note) && player.activeNotes.size >= config.maxActiveNotesPerPlayer) {
          return sendError(player, "too_many_notes");
        }
        clearTimeout(player.activeNotes.get(message.note));
        const timer = setTimeout(() => {
          if (player.activeNotes.get(message.note) !== timer) return;
          player.activeNotes.delete(message.note);
          if (player.room) {
            broadcast(player.room, {
              type: "note_off",
              playerId: player.id,
              slot: player.slot,
              note: message.note,
            });
          }
        }, noteTimeoutMs);
        timer.unref?.();
        player.activeNotes.set(message.note, timer);
        broadcast(player.room, {
          type: "note_on",
          playerId: player.id,
          slot: player.slot,
          note: message.note,
          velocity: message.velocity,
        });
        break;
      }
      case "note_off": {
        if (!validEnvelope(message, ["note"]) || !isIntegerInRange(message.note, 0, 127)) {
          return protocolError(player);
        }
        if (!player.room) return sendError(player, "not_in_room");
        const timer = player.activeNotes.get(message.note);
        if (timer) {
          clearTimeout(timer);
          player.activeNotes.delete(message.note);
          broadcast(player.room, {
            type: "note_off",
            playerId: player.id,
            slot: player.slot,
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
      activeNotes: new Map(),
      messageTimes: [],
      createTimes: [],
      protocolErrors: 0,
      lastVoiceAt: 0,
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

module.exports = { createRoomService, normalizeVoice };
