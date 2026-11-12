export function playRoomNote(heldNotes, send, roomActive, note, on, velocity = 96, track = 0) {
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

export function stopRoomNotes(heldNotes, send) {
  for (const key of heldNotes) {
    const [track, note] = key.split(":").map(Number);
    send({ type: "note_off", track, note });
  }
  heldNotes.clear();
  send({ type: "panic" });
}
