// SPDX-License-Identifier: GPL-3.0-only
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import SiteHeader from "../shared/SiteHeader.jsx";
import { RoomAudio } from "./audio.js";
import { connectFm1 } from "./device.js";
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
  too_many_notes: "Release some notes before playing more.",
  rate_limited: "That was too many requests. Wait a moment and try again.",
  unsupported_voice: "That sound isn't available to share.",
  unsupported_sound_edit: "That sound control isn't available to share.",
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

function RoomPage() {
  const [socketState, setSocketState] = useState("connecting");
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [genre, setGenre] = useState(GENRES[0].id);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [fm1State, setFm1State] = useState("disconnected");
  const [status, setStatus] = useState("Connecting to the room server…");
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const fm1Ref = useRef(null);
  const audioRef = useRef(null);
  const roomRef = useRef(room);
  const voiceStateRef = useRef(new Map());
  const heldRef = useRef(new Set());

  useEffect(() => { roomRef.current = room; }, [room]);

  const send = useCallback((message) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ v: config.protocolVersion, ...message }));
    return true;
  }, []);

  const stopAllNotes = useCallback(() => {
    for (const note of heldRef.current) send({ type: "note_off", note });
    heldRef.current.clear();
    send({ type: "panic" });
  }, [send]);

  const playNote = useCallback((note, on, velocity = 96) => {
    if (!roomRef.current) return;
    if (on) {
      heldRef.current.add(note);
      send({ type: "note_on", note, velocity });
    } else {
      heldRef.current.delete(note);
      send({ type: "note_off", note });
    }
  }, [send]);

  const applyVoice = useCallback((player) => {
    if (!audioRef.current || !player?.voice) return;
    const voiceKey = JSON.stringify(player.voice);
    if (voiceStateRef.current.get(player.id) === voiceKey) return;
    voiceStateRef.current.set(player.id, voiceKey);
    audioRef.current.setVoice(player.slot, player.voice).catch((err) => setError(err.message));
  }, []);

  const reconcileRoomVoices = useCallback((currentPlayers) => {
    const bySlot = new Map((currentPlayers || []).map((player) => [player.slot, player]));
    for (let slot = 0; slot < config.maxPlayers; slot += 1) {
      if (!bySlot.get(slot)?.voice) audioRef.current?.removeVoice(slot);
    }
    for (const player of currentPlayers || []) applyVoice(player);
  }, [applyVoice]);

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
        if (message.type === "rooms") {
          setRooms(Array.isArray(message.rooms) ? message.rooms.slice(0, config.maxRooms) : []);
        } else if (message.type === "room_state") {
          setRoom(message.room);
          setPlayers(message.players || []);
          setStatus(`In a ${GENRES.find((item) => item.id === message.room.genre)?.label || "music"} room.`);
          const currentIds = new Set((message.players || []).map((player) => player.id));
          for (const id of voiceStateRef.current.keys()) {
            if (!currentIds.has(id)) voiceStateRef.current.delete(id);
          }
          reconcileRoomVoices(message.players || []);
        } else if (message.type === "voice") {
          applyVoice({ id: message.playerId, slot: message.slot, voice: message.voice });
          setPlayers((current) => current.map((player) => player.id === message.playerId
            ? { ...player, voice: message.voice } : player));
        } else if (message.type === "sound_edit") {
          audioRef.current?.setSoundParameter(message.slot, message.param, message.value)
            .catch((err) => setError(err.message));
          setPlayers((current) => current.map((player) => player.id === message.playerId && player.voice
            ? { ...player, voice: { ...player.voice, params: { ...(player.voice.params || {}), [message.param]: message.value } } }
            : player));
        } else if (message.type === "note_on") {
          audioRef.current?.note(message.slot, message.note, true);
        } else if (message.type === "note_off") {
          audioRef.current?.note(message.slot, message.note, false);
        } else if (message.type === "error") {
          setError(ERROR_TEXT[message.code] || "The room server rejected that request.");
        } else if (message.type === "server_closing") {
          setStatus("The room server is restarting. Reconnecting…");
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        setSocketState("connecting");
        setStatus("Room server disconnected. Reconnecting…");
        setRoom(null);
        setPlayers([]);
        roomRef.current = null;
        voiceStateRef.current.clear();
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
      reconcileRoomVoices(players);
      setStatus("Room audio is on. Connect the FM-1 to play.");
    } catch (err) {
      setError(err.message);
    }
  };

  const connectDevice = async () => {
    setError("");
    setStatus("Connecting to the FM-1…");
    try {
      fm1Ref.current?.close();
      fm1Ref.current = await connectFm1(playNote, (state) => {
        setFm1State(state);
        if (state === "disconnected") stopAllNotes();
      }, (param, value) => {
        if (roomRef.current) send({ type: "sound_edit", param, value });
      });
      setStatus("FM-1 connected. Share its selected built-in sound to the room.");
    } catch (err) {
      setFm1State("disconnected");
      setError(err.message);
      setStatus("FM-1 not connected.");
    }
  };

  const shareSound = async () => {
    if (!fm1Ref.current) {
      setError("Connect the FM-1 first.");
      return;
    }
    setError("");
    try {
      const voice = await fm1Ref.current.getSelectedVoice();
      if (!send({ type: "voice", voice })) throw new Error("Wait for the room server to reconnect.");
      setStatus(`Sharing ${voiceLabel(voice)} with the room.`);
    } catch (err) {
      setError(err.message);
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
    setRoom(null);
    setPlayers([]);
    voiceStateRef.current.clear();
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
          <p>Play your FM-1 keyboard with other BoopBox players. Everyone renders the notes locally using the firmware audio engine.</p>
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
                <p>Start audio once on this device. Each player’s notes are rendered locally.</p>
                <button className="button button-primary" type="button" onClick={startAudio}>
                  {audioEnabled ? "Restart room audio" : "Enable room audio"}
                </button>
              </div>
              <div className="room-control-card">
                <h3>Play from your FM-1</h3>
                <p>Connect the USB MIDI keyboard, then share its selected built-in sound.</p>
                <div className="control-row">
                  <button className="button button-primary" type="button" onClick={connectDevice}>
                    {fm1State === "connected" ? "Reconnect FM-1" : "Connect FM-1"}
                  </button>
                  <button className="button button-secondary" type="button" onClick={shareSound}
                    disabled={fm1State !== "connected"}>Share selected sound</button>
                </div>
              </div>
            </div>

            <div className="player-list" aria-label="Players in this room">
              <h3>Players</h3>
              <ul>
                {players.slice().sort((a, b) => a.slot - b.slot).map((player) => (
                  <li key={player.id}>
                    <span className="player-badge" aria-hidden="true">{player.slot + 1}</span>
                    <span className="player-name">Player {player.slot + 1}</span>
                    <span className="player-voice">{voiceLabel(player.voice)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="room-safety-note">
              Only built-in synth preset and factory drum kit IDs are shared; live knob edits, user samples, custom patches, chat, and audio streams are not sent.
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
