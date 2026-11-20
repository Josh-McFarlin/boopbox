import type { RoomSend } from './types.ts'

export function playRoomNote(
  heldNotes: Set<string>,
  send: RoomSend,
  roomActive: boolean,
  note: number,
  on: boolean,
  velocity = 96,
  track = 0,
  at:
    | number
    | null = null /* when it was played, on the room server's clock (clock.ts) */,
): void {
  if (!roomActive) return
  const key = `${track}:${note}`
  const time = at === null || !Number.isFinite(at) ? {} : { at: Math.round(at) }
  if (on) {
    heldNotes.add(key)
    send({ type: 'note_on', track, note, velocity, ...time })
  } else {
    heldNotes.delete(key)
    send({ type: 'note_off', track, note, ...time })
  }
}

export function stopRoomNotes(heldNotes: Set<string>, send: RoomSend): void {
  for (const key of heldNotes) {
    const [track, note] = key.split(':').map(Number)
    send({ type: 'note_off', track, note })
  }
  heldNotes.clear()
  send({ type: 'panic' })
}
