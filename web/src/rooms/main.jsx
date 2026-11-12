// SPDX-License-Identifier: GPL-3.0-only
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import SiteHeader from "../shared/SiteHeader.jsx";
import { RoomAudio } from "./audio.js";
import { buildEmulatorPerformance, connectFm1 } from "./device.js";
import config from "../../../shared/room-config.json";
import "../styles/site.css";
import "./rooms.css";

const GENRES = config.genres;
const ERROR_TEXT = {
  already_in_room: "Leave your current room before joining another.",
  not_in_room: "Join a room first.",
  room_full: "This room already has eight players.",
  room_not_found: "That room has closed. Refresh the browser to see active rooms.",
  server_full: "The server is at its 50-room limit. Try again later.",
  voice_not_set: "Share a built-in sound before playing.",
  performance_not_set: "Sync your FM-1 performance before starting playback.",
  too_many_notes: "Release some notes before playing more.",
  rate_limited: "That was too many requests. Wait a moment and try again.",
  unsupported_voice: "That sound isn't available to share.",
  unsupported_sound_edit: "That sound control isn't available to share.",
  invalid_performance: "The room rejected an unsupported performance update.",
};
const ENGINE_LABELS = config.engineNames;

function socketUrl() {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/api/rooms`;
}

function voiceLabel(voice) {
  if (!voice) return "Sound not shared";
  if (voice.engine === ENGINE_LABELS.length) return `Factory drum kit ${voice.kit + 1}`;
  return `${ENGINE_LABELS[voice.engine]} · preset ${voice.preset + 1}`;
}

function performanceLabel(player) {
  if (Number.isInteger(player.sharedTracks)) return `${player.sharedTracks} stock tracks synced`;
  if (player.hasPerformance) return "Syncing performance…";
  return voiceLabel(player.voice);
}

function RoomPage() {
  const [socketState, setSocketState] = useState("connecting");
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [genre, setGenre] = useState(GENRES[0].id);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [fm1State, setFm1State] = useState("disconnected");
  const [soundEditsPaused, setSoundEditsPaused] = useState(false);
  const [deviceMode, setDeviceMode] = useState("fm1");
  const [emulatorReady, setEmulatorReady] = useState(false);
  const [status, setStatus] = useState("Connecting to the room server…");
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const selfPlayerIdRef = useRef(null);
  const fm1Ref = useRef(null);
  const emulatorFrameRef = useRef(null);
  const emulatorSnapshotRef = useRef("");
  const emulatorTransportRef = useRef(null);
  const emulatorHasPerformanceRef = useRef(false);
  const audioRef = useRef(null);
  const roomRef = useRef(room);
  const soundEditsPausedRef = useRef(soundEditsPaused);
  const voiceStateRef = useRef(new Map());
  const performanceStateRef = useRef(new Map());
  const heldRef = useRef(new Set());

  useEffect(() => { roomRef.current = room; }, [room]);

  const send = useCallback((message) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ v: config.protocolVersion, ...message }));
    return true;
  }, []);

  const stopAllNotes = useCallback(() => {
    for (const key of heldRef.current) {
      const [track, note] = key.split(":").map(Number);
      send({ type: "note_off", track, note });
    }
    heldRef.current.clear();
    send({ type: "panic" });
  }, [send]);

  const playNote = useCallback((note, on, velocity = 96, track = 0) => {
    if (!roomRef.current) return;
    const key = `${track}:${note}`;
    if (on) {
      heldRef.current.add(key);
      send({ type: "note_on", track, note, velocity });
    } else {
      heldRef.current.delete(key);
      send({ type: "note_off", track, note });
    }
  }, [send]);

  const applyVoice = useCallback((player) => {
    if (player?.id === selfPlayerIdRef.current) return;
    if (!audioRef.current || !player?.voice || player.hasPerformance) return;
    const voiceKey = JSON.stringify(player.voice);
    if (voiceStateRef.current.get(player.id) === voiceKey) return;
    voiceStateRef.current.set(player.id, voiceKey);
    audioRef.current.setVoice(player.slot, player.voice).catch((err) => setError(err.message));
  }, []);

  const applyPerformance = useCallback((playerId, slot, performance, clock = null) => {
    if (!performance) return;
    const key = JSON.stringify(performance);
    const saved = performanceStateRef.current.get(playerId);
    if (saved?.key === key && (saved.applied || !audioRef.current)) return;
    const state = { key, performance, applied: false };
    performanceStateRef.current.set(playerId, state);
    if (playerId === selfPlayerIdRef.current) {
      state.applied = true;
      return;
    }
    if (!audioRef.current) return;
    audioRef.current.setPerformance(slot, performance, clock)
      .then(() => { state.applied = true; })
      .catch((err) => setError(err.message));
  }, []);

  const reconcileRoomVoices = useCallback((currentPlayers) => {
    const bySlot = new Map((currentPlayers || []).map((player) => [player.slot, player]));
    for (let slot = 0; slot < config.maxPlayers; slot += 1) {
      const player = bySlot.get(slot);
      if (!player || (!player.hasPerformance && !player.voice)) audioRef.current?.removeVoice(slot);
    }
    for (const player of currentPlayers || []) applyVoice(player);
    for (const player of currentPlayers || []) {
      const saved = performanceStateRef.current.get(player.id)?.performance;
      if (saved) applyPerformance(player.id, player.slot, saved);
    }
  }, [applyPerformance, applyVoice]);

  useEffect(() => {
    let stopped = false;
    let retryTimer;
    let socket;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        setSocketState("connected");
        setStatus("Connected. Choose a genre and create a room, or join one below.");
        setError("");
      };
      socket.onmessage = ({ data }) => {
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === "connected") {
          selfPlayerIdRef.current = message.playerId;
        } else if (message.type === "rooms") {
          setRooms(Array.isArray(message.rooms) ? message.rooms.slice(0, config.maxRooms) : []);
        } else if (message.type === "room_state") {
          setRoom(message.room);
          setPlayers(message.players || []);
          if (soundEditsPausedRef.current) send({ type: "sound_edit_sharing", paused: true });
          if (message.clock) audioRef.current?.setTempo(message.clock.tempo);
          setStatus(`In a ${GENRES.find((item) => item.id === message.room.genre)?.label || "music"} room.`);
          const currentIds = new Set((message.players || []).map((player) => player.id));
          for (const id of voiceStateRef.current.keys()) {
            if (!currentIds.has(id)) voiceStateRef.current.delete(id);
          }
          for (const id of performanceStateRef.current.keys()) {
            if (!currentIds.has(id)) performanceStateRef.current.delete(id);
          }
          reconcileRoomVoices(message.players || []);
        } else if (message.type === "performance") {
          const sharedTracks = message.performance.tracks.filter((track) => track.voice).length;
          applyPerformance(message.playerId, message.slot, message.performance, message.clock);
          setPlayers((current) => current.map((player) => player.id === message.playerId
            ? { ...player, hasPerformance: true, sharedTracks } : player));
          if (message.clock) audioRef.current?.setTempo(message.clock.tempo);
        } else if (message.type === "transport") {
          if (message.clock) {
            audioRef.current?.setTempo(message.clock.tempo);
            audioRef.current?.setTransport(message.slot, message.playing, message.clock.tempo, message.clock);
          }
          const saved = performanceStateRef.current.get(message.playerId);
          if (saved) {
            saved.performance.playing = message.playing;
            if (message.clock) saved.performance.tempo = message.clock.tempo;
            saved.key = JSON.stringify(saved.performance);
          }
        } else if (message.type === "voice") {
          applyVoice({ id: message.playerId, slot: message.slot, voice: message.voice });
          setPlayers((current) => current.map((player) => player.id === message.playerId
            ? { ...player, voice: message.voice } : player));
        } else if (message.type === "sound_edit") {
          if (message.playerId !== selfPlayerIdRef.current) {
            audioRef.current?.setSoundParameter(message.slot, message.track, message.param, message.value)
              .catch((err) => setError(err.message));
          }
          setPlayers((current) => current.map((player) => player.id === message.playerId && player.voice
            ? { ...player, voice: { ...player.voice, params: { ...(player.voice.params || {}), [message.param]: message.value } } }
            : player));
        } else if (message.type === "note_on") {
          if (message.playerId !== selfPlayerIdRef.current) audioRef.current?.note(message.slot, message.track, message.note, true);
        } else if (message.type === "note_off") {
          if (message.playerId !== selfPlayerIdRef.current) audioRef.current?.note(message.slot, message.track, message.note, false);
        } else if (message.type === "error") {
          setError(ERROR_TEXT[message.code] || "The room server rejected that request.");
        } else if (message.type === "server_closing") {
          setStatus("The room server is restarting. Reconnecting…");
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        setSocketState("connecting");
        selfPlayerIdRef.current = null;
        setStatus("Room server disconnected. Reconnecting…");
        setRoom(null);
        setPlayers([]);
        roomRef.current = null;
        voiceStateRef.current.clear();
        performanceStateRef.current.clear();
        audioRef.current?.panic();
        for (let slot = 0; slot < config.maxPlayers; slot += 1) audioRef.current?.removeVoice(slot);
        retryTimer = window.setTimeout(connect, 1800);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [reconcileRoomVoices, send]);

  useEffect(() => () => {
    stopAllNotes();
    fm1Ref.current?.close();
    audioRef.current?.close();
  }, [stopAllNotes]);

  const startAudio = async () => {
    setError("");
    try {
      if (!audioRef.current) audioRef.current = new RoomAudio((err) => setError(err.message));
      await audioRef.current.start();
      setAudioEnabled(true);
      for (const saved of performanceStateRef.current.values()) saved.applied = false;
      reconcileRoomVoices(players);
      setStatus("Room audio is on. Connect an FM-1 or start the browser emulator to play.");
    } catch (err) {
      setError(err.message);
    }
  };

  const connectDevice = async () => {
    setError("");
    setDeviceMode("fm1");
    setEmulatorReady(false);
    emulatorSnapshotRef.current = "";
    emulatorTransportRef.current = null;
    emulatorHasPerformanceRef.current = false;
    setStatus("Connecting to the FM-1…");
    try {
      fm1Ref.current?.close();
      fm1Ref.current = await connectFm1(playNote, (state) => {
        setFm1State(state);
        if (state === "disconnected") stopAllNotes();
      }, (track, param, value) => {
        if (roomRef.current && !soundEditsPausedRef.current) send({ type: "sound_edit", track, param, value });
      }, (performance) => {
        if (roomRef.current && !send({ type: "performance", performance })) {
          setError("Wait for the room server to reconnect.");
        }
      }, (transport) => {
        if (roomRef.current) send({ type: "transport", ...transport });
      }, () => {
        setError("The FM-1 performance could not be synced. Check the USB connection and try again.");
      });
      setStatus("FM-1 connected. Sharing its stock-sound performance with the room.");
    } catch (err) {
      setFm1State("disconnected");
      setError(err.message);
      setStatus("FM-1 not connected.");
    }
  };

  const useEmulator = () => {
    fm1Ref.current?.close();
    fm1Ref.current = null;
    setFm1State("disconnected");
    setDeviceMode("emulator");
    setEmulatorReady(false);
    emulatorSnapshotRef.current = "";
    emulatorTransportRef.current = null;
    emulatorHasPerformanceRef.current = false;
    setError("");
    setStatus("Start the browser emulator below to play in this room.");
  };

  const usePhysicalDevice = () => {
    stopAllNotes();
    setDeviceMode("fm1");
    setEmulatorReady(false);
    emulatorHasPerformanceRef.current = false;
    setStatus("Connect the FM-1 with its USB MIDI cable.");
  };

  useEffect(() => {
    const onEmulatorMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== emulatorFrameRef.current?.contentWindow
        || deviceMode !== "emulator") return;
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === "boopbox-room-ready") {
        setEmulatorReady(true);
        setStatus("Browser emulator is running. Its stock-sound performance syncs with the room.");
      } else if (message.type === "boopbox-room-note") {
        if (!emulatorHasPerformanceRef.current || !roomRef.current
          || !Number.isInteger(message.track) || message.track < 0 || message.track >= 8
          || !Number.isInteger(message.note) || message.note < 0 || message.note > 127
          || typeof message.down !== "boolean"
          || (message.down && (!Number.isInteger(message.velocity) || message.velocity < 1 || message.velocity > 127))) return;
        playNote(message.note, message.down, message.velocity || 96, message.track);
      } else if (message.type === "boopbox-room-panic") {
        stopAllNotes();
      } else if (message.type === "boopbox-room-error") {
        setError(message.error || "The emulator could not sync its performance.");
      } else if (message.type === "boopbox-room-snapshot") {
        if (!roomRef.current || !Array.isArray(message.tracks)) return;
        try {
          const performance = buildEmulatorPerformance(message.project, message.tracks, {
            tempo: message.tempo, playing: message.playing,
          });
          const performanceKey = JSON.stringify(performance);
          if (performanceKey !== emulatorSnapshotRef.current) {
            if (!send({ type: "performance", performance })) {
              setError("Wait for the room server to reconnect.");
              return;
            }
            emulatorSnapshotRef.current = performanceKey;
            emulatorHasPerformanceRef.current = true;
          }
          const transportKey = `${performance.tempo}:${performance.playing}`;
          if (transportKey !== emulatorTransportRef.current) {
            send({ type: "transport", playing: performance.playing, tempo: performance.tempo });
            emulatorTransportRef.current = transportKey;
          }
        } catch (err) {
          setError(err.message || "The emulator performance could not be synced.");
        }
      }
    };
    window.addEventListener("message", onEmulatorMessage);
    return () => window.removeEventListener("message", onEmulatorMessage);
  }, [deviceMode, playNote, send, stopAllNotes]);

  const sharePerformance = async () => {
    if (!fm1Ref.current) {
      setError("Connect the FM-1 first.");
      return;
    }
    setError("");
    try {
      const performance = await fm1Ref.current.getPerformanceSnapshot();
      if (!performance) throw new Error("The FM-1 could not read its current performance.");
      setStatus("Sharing the FM-1 performance with the room.");
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSoundEditSharing = () => {
    const paused = !soundEditsPausedRef.current;
    soundEditsPausedRef.current = paused;
    setSoundEditsPaused(paused);
    fm1Ref.current?.setSoundEditsPaused(paused);
    if (roomRef.current && !send({ type: "sound_edit_sharing", paused })) {
      setError("Wait for the room server to reconnect.");
    } else {
      setError("");
    }
  };

  const createRoom = () => {
    setError("");
    if (!send({ type: "create", genre })) setError("Wait for the room server to connect.");
  };
  const joinRoom = (id) => {
    setError("");
    if (!send({ type: "join", roomId: id })) setError("Wait for the room server to connect.");
  };
  const leaveRoom = () => {
    stopAllNotes();
    send({ type: "leave" });
    setDeviceMode("fm1");
    setEmulatorReady(false);
    emulatorHasPerformanceRef.current = false;
    setRoom(null);
    soundEditsPausedRef.current = false;
    setSoundEditsPaused(false);
    fm1Ref.current?.setSoundEditsPaused(false);
    setPlayers([]);
    voiceStateRef.current.clear();
    performanceStateRef.current.clear();
    for (let slot = 0; slot < config.maxPlayers; slot += 1) audioRef.current?.removeVoice(slot);
    setStatus("You left the room.");
  };

  const onWindowBlur = () => stopAllNotes();
  useEffect(() => {
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  }, [onWindowBlur]);

  return (
    <div className="rooms-page">
      <SiteHeader current="rooms" />
      <main className="rooms-main">
        <header className="rooms-hero">
          <p className="rooms-kicker">LIVE MUSIC · UP TO 8 PLAYERS</p>
          <h1>Jam rooms</h1>
          <p>Jam with up to seven other BoopBox players. Each FM-1 or browser emulator mixes everyone’s stock-sound performances, while every player keeps their own patterns, scenes, and chains.</p>
          <div className="rooms-status" role="status" aria-live="polite">
            <span className={`status-dot ${socketState === "connected" ? "is-connected" : ""}`} aria-hidden="true" />
            {status}
          </div>
        </header>

        {error && <div className="rooms-error" role="alert">{error}</div>}

        {room ? (
          <section className="room-active" aria-labelledby="active-room-title">
            <div className="room-active-heading">
              <div>
                <p className="rooms-kicker">YOU’RE IN</p>
                <h2 id="active-room-title">{GENRES.find((item) => item.id === room.genre)?.label || "Music"} room</h2>
                <p>{players.length} of {config.maxPlayers} players · Room closes 10 minutes after everyone leaves</p>
              </div>
              <button className="button button-secondary" type="button" onClick={leaveRoom}>Leave room</button>
            </div>

            <div className="room-controls">
              <div className="room-control-card">
                <h3>Hear the room</h3>
              <p>Enable audio once to hear the other players’ tracks and sequences locally. Your own device or emulator stays audible directly, without a doubled browser copy.</p>
                <button className="button button-primary" type="button" onClick={startAudio}>
                  {audioEnabled ? "Restart room audio" : "Enable room audio"}
                </button>
              </div>
              <div className="room-control-card">
                <h3>{deviceMode === "emulator" ? "Play from the emulator" : "Play from your device"}</h3>
                <p>Your patterns, scenes, and chains remain your own and are mixed with other players, not copied onto their devices. Only firmware stock sounds are allowed; starts and stops stay individual while room tempo is shared.</p>
                <div className="control-row">
                  {deviceMode === "emulator" ? (
                    <button className="button button-primary" type="button" onClick={usePhysicalDevice}>Use physical FM-1</button>
                  ) : (
                    <>
                      <button className="button button-primary" type="button" onClick={connectDevice}>
                        {fm1State === "connected" ? "Reconnect FM-1" : "Connect FM-1"}
                      </button>
                      <button className="button button-secondary" type="button" onClick={useEmulator}>Use browser emulator</button>
                      <button className="button button-secondary" type="button" onClick={sharePerformance}
                        disabled={fm1State !== "connected"}>Sync full performance</button>
                    </>
                  )}
                </div>
                <div className="control-row">
                  <button className="button button-secondary" type="button" onClick={toggleSoundEditSharing}
                    aria-pressed={soundEditsPaused}>
                    {soundEditsPaused ? "Resume live sound edits" : "Pause live sound edits"}
                  </button>
                  <p className="emulator-sync-status" role="status" aria-live="polite">
                    {soundEditsPaused
                      ? "Live sound edits are paused. Shared sounds, notes, and playback continue."
                      : "Live sound edits are shared automatically."}
                  </p>
                </div>
                {deviceMode === "emulator" && (
                  <p className="emulator-sync-status" role="status" aria-live="polite">
                    {emulatorReady ? "Emulator connected; performance syncs automatically." : "Start the emulator below to connect it to this room."}
                  </p>
                )}
              </div>
            </div>

            {deviceMode === "emulator" && (
              <section className="room-emulator" aria-label="Browser FM-1 emulator">
                <iframe
                  ref={emulatorFrameRef}
                  src="../emu/?room=1"
                  title="BoopBox FM-1 emulator for this jam room"
                  allow="autoplay"
                />
              </section>
            )}

            <div className="player-list" aria-label="Players in this room">
              <h3>Players</h3>
              <ul>
                {players.slice().sort((a, b) => a.slot - b.slot).map((player) => (
                  <li key={player.id}>
                    <span className="player-badge" aria-hidden="true">{player.slot + 1}</span>
                    <span className="player-name">Player {player.slot + 1}</span>
                    <span className="player-voice">{performanceLabel(player)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="room-safety-note">
              Only factory synth presets, factory drum kits, and bounded musical controls and sequence data are shared. User samples and custom presets are not shared; raw MIDI, SysEx, arbitrary data, and audio streams are never relayed.
            </p>
          </section>
        ) : (
          <div className="room-browser">
            <section className="room-create" aria-labelledby="create-title">
              <p className="rooms-kicker">START A SESSION</p>
              <h2 id="create-title">Create a room</h2>
              <p>Pick a genre to help other musicians find the sound you’re after.</p>
              <label htmlFor="room-genre">Genre</label>
              <select id="room-genre" value={genre} onChange={(event) => setGenre(event.target.value)}>
                {GENRES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <button className="button button-primary" type="button" onClick={createRoom}
                disabled={socketState !== "connected" || rooms.length >= config.maxRooms}>
                Create room
              </button>
              <p className="room-limit">Up to 50 active rooms · 8 players per room</p>
            </section>

            <section className="room-browser-list" aria-labelledby="browse-title">
              <div className="browser-heading">
                <div>
                  <p className="rooms-kicker">FIND PLAYERS</p>
                  <h2 id="browse-title">Room browser</h2>
                </div>
                <span className="room-count">{rooms.length} / {config.maxRooms}</span>
              </div>
              {rooms.length === 0 ? (
                <div className="empty-rooms">
                  <p>No rooms yet.</p>
                  <p>Create one and invite other BoopBox players to join.</p>
                </div>
              ) : (
                <ul className="room-list">
                  {rooms.map((item) => {
                    const full = item.players >= item.capacity;
                    return (
                      <li key={item.id} className="room-list-item">
                        <div className="room-list-info">
                          <strong>{GENRES.find((option) => option.id === item.genre)?.label || "Music"}</strong>
                          <span>{item.players} / {item.capacity} players</span>
                          {item.players === 0 && <span className="room-reopenable">Reopenable for up to 10 minutes</span>}
                        </div>
                        <button className="button button-secondary" type="button" onClick={() => joinRoom(item.id)}
                          disabled={socketState !== "connected" || full}>
                          {full ? "Full" : "Join"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<RoomPage />);
