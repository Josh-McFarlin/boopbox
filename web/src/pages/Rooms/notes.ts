import type { RoomSend } from "./types.ts";

export function playRoomNote(
  heldNotes: Set<string>, send: RoomSend, roomActive: boolean, note: number, on: boolean, velocity = 96, track = 0,
) {
  if (!roomActive) return;
  const key = `${track}:${note}`;
  if (on) {
    heldNotes.add(key);
    send({ type: "note_on", track, note, velocity });
  } else {
    heldNotes.delete(key);
    send({ type: "note_off", track, note });
  }
}

export function stopRoomNotes(heldNotes: Set<string>, send: RoomSend) {
  for (const key of heldNotes) {
    const [track, note] = key.split(":").map(Number);
    send({ type: "note_off", track, note });
  }
  heldNotes.clear();
  send({ type: "panic" });
}
