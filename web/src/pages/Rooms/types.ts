// SPDX-License-Identifier: GPL-3.0-only
// The jam rooms' protocol records (server/rooms.cjs) and the shapes the room page passes between its modules.

/* a shared sound: a built-in synth preset (engine, preset, the shareable sound controls) or a factory drum kit
   (engine === engineNames.length, kit) */
export interface RoomVoice {
  engine: number;
  preset?: number;
  kit?: number;
  params?: Record<string, number>;
}

/* a drum step: [index, on bits, 16 lane levels, 16 lane ratchets]; a synth step: [index, [4 notes, n, time, flags,
   vel, lvl, rat]] */
export type RoomDrumStep = [index: number, on: number, levels: number[], ratchets: number[]];
export type RoomSynthStep = [index: number, fields: number[]];

export interface RoomPattern {
  id: number;
  length: number;
  steps: (RoomDrumStep | RoomSynthStep)[];
  micro: [index: number, amount: number][];
  fill: [index: number, condition: number][];
  locks: [step: number, slide: boolean, param: number, value: number][];
  components: [step: number, type: number, a: number, b: number][];
  dir: number;
  seed: number;
}

export interface RoomTrack {
  index: number;
  kind: number;
  voice: RoomVoice | null;
  parameters: [id: number, value: number][];
  currentPattern: number;
  chain: number[];
  chainEnabled: boolean;
  patterns: (RoomPattern | null)[];
}

export interface RoomPerformance {
  tempo: number;
  playing: boolean;
  currentScene?: number | null;
  tracks: RoomTrack[];
  scenes: { names: number[]; patterns: number[][] };
}

/* the room's shared clock: tempo, and the beat at serverAt (ms) */
export interface RoomClock {
  tempo: number;
  beat?: number;
  serverAt?: number;
}

export interface RoomTransport {
  tempo: number;
  playing: boolean;
}

export interface RoomPlayer {
  id: string;
  slot: number;
  name?: string;
  voice?: RoomVoice | null;
  hasPerformance?: boolean;
  sharedTracks?: number;
}

export interface RoomSummary {
  id: string;
  genre: string;
  players: number;
  capacity: number;
  expiresAt?: number | null;
}

export interface RoomChatMessage {
  type: "chat";
  id: string;
  playerId: string;
  slot?: number;
  name: string;
  text: string;
  sentAt: number;
}

/* what the page sends: the protocol version is added by send() */
export type RoomOutgoing = { type: string } & Record<string, unknown>;
export type RoomSend = (message: RoomOutgoing) => boolean;
