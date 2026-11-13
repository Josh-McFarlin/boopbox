// SPDX-License-Identifier: GPL-3.0-only
import React, { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import SiteHeader from "../../components/SiteHeader.tsx";
import { RoomAudio } from "./audio.ts";
import { applyPerformanceWithRetry } from "./performanceSync.ts";
import { getRoomBrowserIdentity } from "./browserIdentity.ts";
import { buildEmulatorPerformance, connectFm1, syncEmulatorSnapshot } from "./device.ts";
import type { EmulatorSnapshot, Fm1Connection } from "./device.ts";
import { playRoomNote, stopRoomNotes } from "./notes.ts";
import { createSoundEditSharingController } from "./editSharing.ts";
import type { SoundEditSharingController } from "./editSharing.ts";
import { createRoomMixController } from "./mix.ts";
import type { RoomMixController } from "./mix.ts";
import type { PerformanceState } from "./performanceSync.ts";
import RoomChat from "./RoomChat/index.tsx";
import { CARD, CARD_TITLE, KICKER, PANEL_PHONE, PANEL_TITLE, SELECT_FOCUS, button } from "./styles.ts";
import type {
  RoomChatMessage, RoomClock, RoomOutgoing, RoomPerformance, RoomPlayer, RoomSummary, RoomVoice,
} from "./types.ts";
import config from "../../../../shared/room-config.json";

const GENRES = config.genres;
const ERROR_TEXT: Record<string, string | undefined> = {
  already_in_room: "Leave your current room before joining another.",
  browser_already_in_room: "This browser already has a room open in another tab. Leave it there before joining or creating another.",
  browser_identity_required: "Room access could not be verified. Refresh this page and try again.",
  invalid_browser_identity: "This browser could not be verified. Refresh the page to try again.",
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
  invalid_name: "Use 1–24 letters, numbers, underscores, or hyphens for your room name.",
  name_taken: "That room name is already in use.",
  name_rate_limited: "Wait a moment before changing your room name again.",
  invalid_chat: "The message was empty, too long, or included unsupported control characters.",
  chat_rate_limited: "Chat is moving quickly. Wait a moment before sending another message.",
};
const ENGINE_LABELS = config.engineNames;

/* the control cards' text, their rows of buttons, the page's lists and a room's details in the room browser */
const CONTROL_TEXT = "min-h-[44px] text-[14px] leading-[1.5] text-[#b7a9ca]";
const CONTROL_ROW = "flex flex-wrap gap-2";
const LIST = "mt-5 mb-0 list-none";
const ROOM_DETAIL = "text-[13px] text-[#b7a9ca]";

function socketUrl() {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/api/rooms`;
}

/* what the room server sends (server/rooms.cjs) */
type ServerMessage =
  | { type: "connected"; playerId: string }
  | { type: "identified" }
  | { type: "rooms"; rooms?: RoomSummary[] }
  | { type: "room_state"; room: RoomSummary; players?: RoomPlayer[]; clock?: RoomClock }
  | { type: "performance"; playerId: string; slot: number; performance: RoomPerformance; clock?: RoomClock }
  | { type: "transport"; playerId: string; slot: number; playing: boolean; clock?: RoomClock }
  | { type: "voice"; playerId: string; slot: number; voice: RoomVoice }
  | { type: "player_name"; playerId: string; name: string }
  | RoomChatMessage
  | { type: "sound_edit"; playerId: string; slot: number; track: number; param: number; value: number }
  | { type: "note_on" | "note_off"; playerId: string; slot: number; track: number; note: number }
  | { type: "error"; code: string }
  | { type: "server_closing" };

/* what the emulator page posts to the room page */
type EmulatorMessage =
  | { type: "boopbox-room-ready" }
  | { type: "boopbox-room-note"; track: unknown; note: unknown; down: unknown; velocity?: unknown }
  | { type: "boopbox-room-panic" }
  | { type: "boopbox-room-error"; error?: string }
  | ({ type: "boopbox-room-snapshot" } & EmulatorSnapshot);

type SocketState = "connecting" | "connected" | "identity_error";

function voiceLabel(voice: RoomVoice | null | undefined) {
  if (!voice) return "Sound not shared";
  if (voice.engine === ENGINE_LABELS.length) return `Factory drum kit ${voice.kit! + 1}`;
  return `${ENGINE_LABELS[voice.engine]} · preset ${voice.preset! + 1}`;
}

function performanceLabel(player: RoomPlayer) {
  if (Number.isInteger(player.sharedTracks)) return `${player.sharedTracks} stock tracks synced`;
  if (player.hasPerformance) return "Syncing performance…";
  return voiceLabel(player.voice);
}

const Rooms: React.FC = () => {
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [nameError, setNameError] = useState("");
  const [genre, setGenre] = useState(GENRES[0].id);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [mutedSlots, setMutedSlots] = useState<number[]>([]);
  const [soloSlot, setSoloSlot] = useState<number | null>(null);
  const [fm1State, setFm1State] = useState<"connected" | "disconnected">("disconnected");
  const [soundEditsPaused, setSoundEditsPaused] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"fm1" | "emulator">("fm1");
  const [emulatorReady, setEmulatorReady] = useState(false);
  const [status, setStatus] = useState("Connecting to the room server…");
  const [error, setError] = useState("");
  const soundEditSharingRef = useRef<SoundEditSharingController>(null!);
  if (!soundEditSharingRef.current) soundEditSharingRef.current = createSoundEditSharingController();
  const socketRef = useRef<WebSocket | null>(null);
  const selfPlayerIdRef = useRef<string | null>(null);
  const fm1Ref = useRef<Fm1Connection | null>(null);
  const emulatorFrameRef = useRef<HTMLIFrameElement>(null);
  const emulatorSnapshotRef = useRef("");
  const emulatorTransportRef = useRef<string | null>(null);
  const emulatorHasPerformanceRef = useRef(false);
  const audioRef = useRef<RoomAudio | null>(null);
  const roomRef = useRef(room);
  const voiceStateRef = useRef(new Map<string, string>());
  const performanceStateRef = useRef(new Map<string, PerformanceState>());
  const heldRef = useRef(new Set<string>());
  const roomMixRef = useRef<RoomMixController>(null!);
  if (!roomMixRef.current) {
    roomMixRef.current = createRoomMixController({
      getAudio: () => audioRef.current,
      onChange: ({ mutedSlots: nextMutedSlots, soloSlot: nextSoloSlot }) => {
        setMutedSlots(nextMutedSlots);
        setSoloSlot(nextSoloSlot);
      },
    });
  }

  useEffect(() => { roomRef.current = room; }, [room]);

  const send = useCallback((message: RoomOutgoing) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ v: config.protocolVersion, ...message }));
    return true;
  }, []);

  const stopAllNotes = useCallback(() => {
    stopRoomNotes(heldRef.current, send);
  }, [send]);

  const playNote = useCallback((note: number, on: boolean, velocity = 96, track = 0) => {
    playRoomNote(heldRef.current, send, !!roomRef.current, note, on, velocity, track);
  }, [send]);

  const applyVoice = useCallback((player: RoomPlayer) => {
    if (player?.id === selfPlayerIdRef.current) return;
    if (!audioRef.current || !player?.voice || player.hasPerformance) return;
    const voiceKey = JSON.stringify(player.voice);
    if (voiceStateRef.current.get(player.id) === voiceKey) return;
    voiceStateRef.current.set(player.id, voiceKey);
    audioRef.current.setVoice(player.slot, player.voice).catch((err) => setError(err.message));
  }, []);

  const applyPerformance = useCallback((
    playerId: string, slot: number, performance: RoomPerformance, clock: RoomClock | null = null,
  ) => {
    applyPerformanceWithRetry({
      states: performanceStateRef.current,
      audio: audioRef.current,
      playerId,
      slot,
      performance,
      clock,
      shouldApply: playerId !== selfPlayerIdRef.current,
      onError: (err) => setError(err.message),
    });
  }, []);

  const reconcileRoomVoices = useCallback((currentPlayers: RoomPlayer[]) => {
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
    let retryTimer: number | undefined;
    let socket: WebSocket | undefined;
    let browserIdentity: string | null = null;
    const connect = async () => {
      if (stopped) return;
      if (!browserIdentity) {
        try {
          browserIdentity = await getRoomBrowserIdentity();
        } catch (identityError) {
          if (!stopped) {
            setSocketState("identity_error");
            setStatus("Room access is unavailable in this browser.");
            setError((identityError as Error).message);
          }
          return;
        }
      }
      if (stopped) return;
      const ws = new WebSocket(socketUrl());
      socket = ws;
      socketRef.current = ws;
      ws.onopen = () => {
        setStatus("Checking this browser’s room access…");
        if (!send({ type: "identify", browserId: browserIdentity })) {
          setError("Could not verify this browser with the room server. Refresh the page to try again.");
          ws.close();
        }
      };
      ws.onmessage = ({ data }: MessageEvent<string>) => {
        let message: ServerMessage;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === "connected") {
          selfPlayerIdRef.current = message.playerId;
        } else if (message.type === "identified") {
          setSocketState("connected");
          setStatus("Connected. Choose a genre and create a room, or join one below.");
          setError("");
        } else if (message.type === "rooms") {
          setRooms(Array.isArray(message.rooms) ? message.rooms.slice(0, config.maxRooms) : []);
        } else if (message.type === "room_state") {
          const previousRoom = roomRef.current;
          if (previousRoom?.id !== message.room?.id) {
            setChatMessages([]);
            setNameError("");
            roomMixRef.current.reset();
          }
          roomRef.current = message.room;
          setRoom(message.room);
          setPlayers(message.players || []);
          const occupiedSlots = new Set((message.players || []).map((player) => player.slot));
          roomMixRef.current.retainSlots(occupiedSlots);
          if (soundEditSharingRef.current.paused) send({ type: "sound_edit_sharing", paused: true });
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
            if (message.clock) saved.clock = message.clock;
            saved.key = JSON.stringify(saved.performance);
          }
        } else if (message.type === "voice") {
          applyVoice({ id: message.playerId, slot: message.slot, voice: message.voice });
          setPlayers((current) => current.map((player) => player.id === message.playerId
            ? { ...player, voice: message.voice } : player));
        } else if (message.type === "player_name") {
          setPlayers((current) => current.map((player) => player.id === message.playerId
            ? { ...player, name: message.name } : player));
          if (message.playerId === selfPlayerIdRef.current) setNameError("");
        } else if (message.type === "chat") {
          setChatMessages((current) => [...current, message].slice(-100));
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
          const errorText = ERROR_TEXT[message.code];
          if (["invalid_name", "name_taken", "name_rate_limited"].includes(message.code)) {
            setNameError(errorText || "That room name could not be used.");
          } else {
            setError(errorText || "The room server rejected that request.");
          }
        } else if (message.type === "server_closing") {
          setStatus("The room server is restarting. Reconnecting…");
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setSocketState("connecting");
        selfPlayerIdRef.current = null;
        heldRef.current.clear();
        setStatus("Room server disconnected. Reconnecting…");
        setRoom(null);
        setPlayers([]);
        setChatMessages([]);
        setNameError("");
        roomMixRef.current.reset();
        roomRef.current = null;
        voiceStateRef.current.clear();
        performanceStateRef.current.clear();
        audioRef.current?.panic();
        for (let slot = 0; slot < config.maxPlayers; slot += 1) audioRef.current?.removeVoice(slot);
        retryTimer = window.setTimeout(() => { void connect(); }, 1800);
      };
      ws.onerror = () => ws.close();
    };
    void connect();
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
      const mix = roomMixRef.current.getState();
      audioRef.current.setMix(
        Array.from({ length: config.maxPlayers }, (_, slot) => mix.mutedSlots.includes(slot)),
        mix.soloSlot,
      );
      for (const saved of performanceStateRef.current.values()) saved.applied = false;
      reconcileRoomVoices(players);
      setStatus("Room audio is on. Connect an FM-1 or start the browser emulator to play.");
    } catch (err) {
      setError((err as Error).message);
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
        if (roomRef.current && !soundEditSharingRef.current.paused) send({ type: "sound_edit", track, param, value });
      }, (performance) => {
        if (roomRef.current && !send({ type: "performance", performance })) {
          setError("Wait for the room server to reconnect.");
        }
      }, (transport) => {
        if (roomRef.current) send({ type: "transport", ...transport });
      }, () => {
        setError("The FM-1 performance could not be synced. Check the USB connection and try again.");
      });
      soundEditSharingRef.current.attachDevice(fm1Ref.current);
      setStatus("FM-1 connected. Sharing its stock-sound performance with the room.");
    } catch (err) {
      setFm1State("disconnected");
      setError((err as Error).message);
      setStatus("FM-1 not connected.");
    }
  };

  const useEmulator = () => {
    fm1Ref.current?.close();
    fm1Ref.current = null;
    soundEditSharingRef.current.attachDevice(null);
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
    const onEmulatorMessage = (event: MessageEvent<EmulatorMessage | null>) => {
      if (event.origin !== window.location.origin || event.source !== emulatorFrameRef.current?.contentWindow
        || deviceMode !== "emulator") return;
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === "boopbox-room-ready") {
        setEmulatorReady(true);
        setStatus("Browser emulator is running. Its stock-sound performance syncs with the room.");
      } else if (message.type === "boopbox-room-note") {
        if (!emulatorHasPerformanceRef.current || !roomRef.current
          || !Number.isInteger(message.track) || (message.track as number) < 0 || (message.track as number) >= 8
          || !Number.isInteger(message.note) || (message.note as number) < 0 || (message.note as number) > 127
          || typeof message.down !== "boolean"
          || (message.down && (!Number.isInteger(message.velocity)
            || (message.velocity as number) < 1 || (message.velocity as number) > 127))) return;
        playNote(message.note as number, message.down, (message.velocity as number) || 96, message.track as number);
      } else if (message.type === "boopbox-room-panic") {
        stopAllNotes();
      } else if (message.type === "boopbox-room-error") {
        setError(message.error || "The emulator could not sync its performance.");
      } else if (message.type === "boopbox-room-snapshot") {
        if (!roomRef.current || !Array.isArray(message.tracks)) return;
        try {
          const synced = syncEmulatorSnapshot(message, {
            performanceKey: emulatorSnapshotRef.current,
            transportKey: emulatorTransportRef.current,
            hasPerformance: emulatorHasPerformanceRef.current,
          }, send);
          if (!synced) {
            setError("Wait for the room server to reconnect.");
            return;
          }
          emulatorSnapshotRef.current = synced.performanceKey;
          emulatorTransportRef.current = synced.transportKey;
          emulatorHasPerformanceRef.current = synced.hasPerformance;
        } catch (err) {
          setError((err as Error).message || "The emulator performance could not be synced.");
        }
      }
    };
    window.addEventListener("message", onEmulatorMessage);
    return () => window.removeEventListener("message", onEmulatorMessage);
  }, [deviceMode, playNote, send, stopAllNotes]);

  const toggleSoundEditSharing = () => {
    const paused = soundEditSharingRef.current.setPaused(!soundEditSharingRef.current.paused);
    setSoundEditsPaused(paused);
    if (roomRef.current && !send({ type: "sound_edit_sharing", paused })) {
      setError("Wait for the room server to reconnect.");
    } else {
      setError("");
    }
  };

  const setRoomName = (name: string) => {
    setNameError("");
    if (!send({ type: "set_name", name })) setNameError("Wait for the room server to reconnect.");
  };

  const sendRoomChat = (text: string) => {
    if (!send({ type: "chat", text })) setError("Wait for the room server to reconnect before sending.");
  };

  const togglePlayerMute = (slot: number) => {
    roomMixRef.current.toggleMute(slot);
  };

  const togglePlayerSolo = (slot: number) => {
    roomMixRef.current.toggleSolo(slot);
  };

  const createRoom = () => {
    setError("");
    if (!send({ type: "create", genre })) setError("Wait for the room server to connect.");
  };
  const joinRoom = (id: string) => {
    setError("");
    if (!send({ type: "join", roomId: id })) setError("Wait for the room server to connect.");
  };
  const leaveRoom = () => {
    stopAllNotes();
    send({ type: "leave" });
    roomMixRef.current.reset();
    setDeviceMode("fm1");
    setEmulatorReady(false);
    emulatorHasPerformanceRef.current = false;
    setRoom(null);
    setSoundEditsPaused(soundEditSharingRef.current.setPaused(false));
    setPlayers([]);
    setChatMessages([]);
    setNameError("");
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
    <div className="min-h-screen bg-[#100a1f] bg-[radial-gradient(ellipse_at_92%_0%,rgb(90_54_139/32%),transparent_38rem)] text-[#f6f2ff] [font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <SiteHeader current="rooms" />
      <main className="mx-auto w-[min(1120px,calc(100%-40px))] pt-[clamp(32px,6vw,76px)] pb-[72px] max-[520px]:w-[min(100%-24px,1120px)] max-[520px]:pt-[32px]">
        <header className="mb-[36px] max-w-[780px]">
          <p className={KICKER}>LIVE MUSIC · UP TO 8 PLAYERS</p>
          <h1 className="m-0 text-[clamp(40px,7vw,68px)] font-extrabold leading-none tracking-[-.045em] text-white">Jam rooms</h1>
          <p className="max-w-[680px] text-[17px] leading-[1.65] text-[#c8bddb]">Jam with up to seven other BoopBox players. Each FM-1 or browser emulator mixes everyone’s stock-sound performances, while every player keeps their own patterns, scenes, and chains.</p>
          <div className="flex min-h-[24px] items-center gap-[10px] text-[14px] text-[#ddd3ec]" role="status" aria-live="polite">
            <span className={clsx("h-[9px] w-[9px] rounded-full", socketState === "connected"
              ? "bg-[#a8f45c] shadow-[0_0_0_4px_rgb(168_244_92/12%)]"
              : "bg-[#f3b14d] shadow-[0_0_0_4px_rgb(243_177_77/12%)]")} aria-hidden="true" />
            {status}
          </div>
        </header>

        {error && <div className="mt-0 mb-5 rounded-[12px] border border-[#ff8eae] bg-[#371329] px-4 py-[14px] text-[#ffe1e9]" role="alert">{error}</div>}

        {room ? (
          <section className={clsx(CARD, "p-[clamp(20px,4vw,32px)]", PANEL_PHONE)} aria-labelledby="active-room-title">
            <div className="mb-[22px] flex items-center justify-between gap-4 max-[520px]:flex-col max-[520px]:items-start">
              <div>
                <p className={KICKER}>YOU’RE IN</p>
                <h2 className={PANEL_TITLE} id="active-room-title">{GENRES.find((item) => item.id === room.genre)?.label || "Music"} room</h2>
                <p className="mt-[7px] mb-0 text-[14px] text-[#b7a9ca]">{players.length} of {config.maxPlayers} players · Room closes 10 minutes after everyone leaves</p>
              </div>
              <button className={button("secondary")} type="button" onClick={leaveRoom}>Leave room</button>
            </div>

            <div className="mt-5 grid grid-cols-2 items-start gap-5 max-[760px]:grid-cols-1">
              <div className={clsx(CARD, "p-5")}>
                <h3 className={CARD_TITLE}>Hear the room</h3>
              <p className={CONTROL_TEXT}>Enable audio once to hear the other players’ tracks and sequences locally. Your own device or emulator stays audible directly, without a doubled browser copy.</p>
                <button className={button("primary")} type="button" onClick={startAudio}>
                  {audioEnabled ? "Restart room audio" : "Enable room audio"}
                </button>
              </div>
              <div className={clsx(CARD, "p-5")}>
                <h3 className={CARD_TITLE}>{deviceMode === "emulator" ? "Play from the emulator" : "Play from your device"}</h3>
                <p className={CONTROL_TEXT}>Stock engine, preset, sound-control, pattern, scene, and chain changes sync automatically. Your music stays attached to your player, not copied onto other devices; starts and stops stay individual while room tempo is shared.</p>
                <div className={CONTROL_ROW}>
                  {deviceMode === "emulator" ? (
                    <button className={button("primary")} type="button" onClick={usePhysicalDevice}>Use physical FM-1</button>
                  ) : (
                    <>
                      <button className={button("primary")} type="button" onClick={connectDevice}>
                        {fm1State === "connected" ? "Reconnect FM-1" : "Connect FM-1"}
                      </button>
                      <button className={button("secondary")} type="button" onClick={useEmulator}>Use browser emulator</button>
                    </>
                  )}
                </div>
                <div className={CONTROL_ROW}>
                  <button className={button("secondary")} type="button" onClick={toggleSoundEditSharing}
                    aria-pressed={soundEditsPaused}>
                    {soundEditsPaused ? "Resume live sound edits" : "Pause live sound edits"}
                  </button>
                  <p className={clsx(CONTROL_TEXT, "mb-0")} role="status" aria-live="polite">
                    {soundEditsPaused
                      ? "Live sound edits are paused. Shared sounds, notes, and playback continue."
                      : "Preset, sound-control, and performance changes sync automatically."}
                  </p>
                </div>
                {deviceMode === "emulator" && (
                  <p className={clsx(CONTROL_TEXT, "mb-0")} role="status" aria-live="polite">
                    {emulatorReady ? "Emulator connected; performance syncs automatically." : "Start the emulator below to connect it to this room."}
                  </p>
                )}
              </div>
            </div>

            {deviceMode === "emulator" && (
              <section className="mt-5 overflow-hidden rounded-[14px] border border-[#493766] bg-[#100a1f]" aria-label="Browser FM-1 emulator">
                <iframe
                  className="block h-[min(88vh,1120px)] min-h-[720px] w-full border-0 bg-[#100a1f] max-[520px]:h-[clamp(900px,calc(100svh+180px),1100px)] max-[520px]:min-h-0"
                  ref={emulatorFrameRef}
                  src="../emu/?room=1"
                  title="BoopBox FM-1 emulator for this jam room"
                  allow="autoplay"
                />
              </section>
            )}

            <div className="mt-5 grid grid-cols-[minmax(250px,.85fr)_minmax(0,1.15fr)] items-stretch gap-5 max-[760px]:grid-cols-1">
              <section className={clsx(CARD, "mt-0 min-w-0 p-5")} aria-labelledby="room-players-title">
                <h3 className={CARD_TITLE} id="room-players-title">Players</h3>
                <p className="mt-2 mb-0 text-[13px] leading-[1.45] text-[#b7a9ca]">
                  Mute or solo only changes the browser-rendered room mix here. Your own FM-1 or emulator stays audible.
                </p>
                <ul className={LIST}>
                  {players.slice().sort((a, b) => a.slot - b.slot).map((player) => {
                    const isSelf = player.id === selfPlayerIdRef.current;
                    const isMuted = mutedSlots.includes(player.slot);
                    const isSolo = soloSlot === player.slot;
                    const name = player.name || `Player ${player.slot + 1}`;
                    const hasSharedSound = Number.isInteger(player.sharedTracks)
                      ? player.sharedTracks! > 0
                      : !!player.voice;
                    return (
                      <li key={player.id} className="grid grid-cols-[32px_minmax(0,1fr)] items-center justify-between gap-x-[10px] gap-y-2 border-t border-[#493766] py-[14px]">
                        <span className="inline-grid h-8 w-8 flex-none place-items-center rounded-full bg-[#412d61] font-extrabold text-[#ddcefa]" aria-hidden="true">{player.slot + 1}</span>
                        <span className="min-w-0 font-bold text-white [overflow-wrap:anywhere]">{name}{isSelf ? " (you)" : ""}</span>
                        <span className="col-[2] mx-0 mt-[-5px] mb-0 text-left text-[13px] text-[#b7a9ca]">{performanceLabel(player)}</span>
                        {!isSelf && (
                          <span className="col-[2] flex flex-wrap gap-[7px]">
                            <button className={button("secondary", "small")} type="button"
                              aria-pressed={isMuted}
                              aria-label={`${isMuted ? "Unmute" : "Mute"} ${name} in your room mix`}
                              disabled={!audioEnabled || !hasSharedSound}
                              onClick={() => togglePlayerMute(player.slot)}>
                              {isMuted ? "Unmute" : "Mute"}
                            </button>
                            <button className={button("secondary", "small")} type="button"
                              aria-pressed={isSolo}
                              aria-label={`${isSolo ? "Stop soloing" : "Solo"} ${name} in your room mix`}
                              disabled={!audioEnabled || !hasSharedSound}
                              onClick={() => togglePlayerSolo(player.slot)}>
                              {isSolo ? "Stop solo" : "Solo"}
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <RoomChat
                players={players.map((player) => ({
                  id: player.id,
                  slot: player.slot,
                  name: player.name || `Player ${player.slot + 1}`,
                }))}
                messages={chatMessages}
                selfName={players.find((player) => player.id === selfPlayerIdRef.current)?.name || ""}
                nameError={nameError}
                connected={socketState === "connected" && !!room}
                onSetName={setRoomName}
                onSendMessage={sendRoomChat}
              />
            </div>
            <p className="mt-5 mb-0 text-[12px] leading-[1.5] text-[#a99aba]">
              Only factory synth presets, factory drum kits, and bounded musical controls and sequence data are shared. User samples and custom presets are not shared; raw MIDI, SysEx, arbitrary data, and audio streams are never relayed.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-[minmax(260px,.78fr)_minmax(0,1.5fr)] items-start gap-5 max-[760px]:grid-cols-1">
            <section className={clsx(CARD, "p-6", PANEL_PHONE)} aria-labelledby="create-title">
              <p className={KICKER}>START A SESSION</p>
              <h2 className={PANEL_TITLE} id="create-title">Create a room</h2>
              <p className="leading-[1.55] text-[#c8bddb]">Pick a genre to help other musicians find the sound you’re after.</p>
              <label className="mt-[22px] mb-2 block font-bold text-[#f4edff]" htmlFor="room-genre">Genre</label>
              <select className={clsx("mb-[14px] min-h-[48px] w-full rounded-[9px] border border-[#796597] bg-[#120b20] px-3 text-white", SELECT_FOCUS)}
                id="room-genre" value={genre} onChange={(event) => setGenre(event.target.value)}>
                {GENRES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <button className={clsx(button("primary"), "w-full")} type="button" onClick={createRoom}
                disabled={socketState !== "connected" || rooms.length >= config.maxRooms}>
                Create room
              </button>
              <p className="text-[12px] leading-[1.55] text-[#c8bddb]">Up to 50 active rooms · 8 players per room</p>
            </section>

            <section className={clsx(CARD, "p-6", PANEL_PHONE)} aria-labelledby="browse-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={KICKER}>FIND PLAYERS</p>
                  <h2 className={PANEL_TITLE} id="browse-title">Room browser</h2>
                </div>
                <span className="rounded-full border border-[#695384] px-[10px] py-[6px] text-[12px] font-bold text-[#e8ddfa]">{rooms.length} / {config.maxRooms}</span>
              </div>
              {rooms.length === 0 ? (
                <div className="mt-[22px] rounded-[12px] border border-dashed border-[#614d79] p-[22px] leading-[1.5] text-[#c8bddb]">
                  <p className="mt-0 font-extrabold text-white">No rooms yet.</p>
                  <p className="mb-0">Create one and invite other BoopBox players to join.</p>
                </div>
              ) : (
                <ul className={clsx(LIST, "max-h-[420px] overflow-y-auto pr-[2px]")}>
                  {rooms.map((item) => {
                    const full = item.players >= item.capacity;
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-[14px] border-t border-[#493766] py-[14px] max-[520px]:items-start">
                        <div className="grid gap-1">
                          <strong className="text-[16px] text-white">{GENRES.find((option) => option.id === item.genre)?.label || "Music"}</strong>
                          <span className={ROOM_DETAIL}>{item.players} / {item.capacity} players</span>
                          {item.players === 0 && <span className={ROOM_DETAIL}>Reopenable for up to 10 minutes</span>}
                        </div>
                        <button className={clsx(button("secondary"), "max-[520px]:min-w-[74px]")} type="button" onClick={() => joinRoom(item.id)}
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
};
Rooms.displayName = "Rooms";

export default Rooms;
