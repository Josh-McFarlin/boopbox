// SPDX-License-Identifier: GPL-3.0-only
// The preview's instrument: a piano octave (C..C, the labeled computer keys A W S E D ...) or the 16 drum pads; also the
// note dialog's piano (one octave to pick a step's note).
import type { CSSProperties, DOMAttributes } from "react";
import { DRUM_LANES, noteName } from "../../lib/proto.ts";

export const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B", "C"];
/* a black key: its place among the white ones */
export const BLACK_AT: Record<number, number | undefined> = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };

/* a key's look: white / black (main piano or the dialog's) / pad; pressed and disabled */
export type KeyKind = "white" | "black" | "pad";
export function keyClass(kind: KeyKind, pressed: boolean, disabled: boolean, dialog = false): string {
  const base = "touch-none select-none normal-case [&_kbd]:[font:inherit]";
  const shape = {
    white: `p-2 flex flex-col items-center justify-end gap-1 border-b-[3px] ${dialog ? "h-[120px]" : "h-24"}`,
    black: `absolute z-1 flex flex-col items-center justify-between border border-b-[3px] ${dialog
      ? "left-[calc(var(--key)*14.285714%_-_4.3%)] w-[8.6%] h-[72px] px-0 py-1" : "left-[calc(var(--key)*12.5%_-_3.75%)] w-[7.5%] h-14 p-1"}`,
    pad: "p-2 grid h-12 min-w-0 grid-cols-[1fr_auto] items-center gap-2 border text-left leading-4 whitespace-normal [&_kbd]:min-w-5 [&_kbd]:border "
      + "[&_kbd]:border-s3 [&_kbd]:text-center max-[680px]:flex max-[680px]:h-16 max-[680px]:flex-col max-[680px]:items-start "
      + "max-[680px]:justify-between max-[680px]:gap-1",
  }[kind];
  const look = disabled ? "bg-s2 text-dim border-line [&_kbd]:text-dim"
    : pressed ? "bg-trk text-black border-trk [&_kbd]:text-black"
    : {
      white: "bg-fg2 text-bg border-dim hover:bg-fg [&_kbd]:text-s3",
      black: "bg-s1 text-fg border-s3 [&_kbd]:text-dim",
      pad: "border-s3 [&_kbd]:text-dim",
    }[kind];
  return `${base} ${shape} ${look}`;
}

/* the panel's keys: handlers(offset) -> the pointer / key handlers of that key */
/* a key's pointer / keyboard handlers */
export type KeyHandlers = Pick<DOMAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture" | "onKeyDown" | "onKeyUp" | "onBlur">;
export interface KeyBoardProps { drum: boolean; octave: number; pressed: Set<number>; disabled: boolean; handlers: (offset: number) => KeyHandlers }
export function KeyBoard({ drum, octave, pressed, disabled, handlers }: KeyBoardProps) {
  const n = drum ? 16 : 13;
  return (
    <div id="preview-keys" className={`preview-keys relative w-full ${drum
      ? "grid max-w-[480px] grid-cols-4 gap-1" : "grid h-24 grid-cols-8 gap-0.5"}`}>
      {Array.from({ length: n }, (_, i) => {
        const oct = Math.floor((octave + i) / 12) - 1;
        const note = drum ? DRUM_LANES[i][1] : NAMES[i] + (i % 12 === 0 ? oct : "");
        const shortcut = "AWSEDFTGYHUJKOLP"[i];
        const kind: KeyKind = drum ? "pad" : BLACK_AT[i] ? "black" : "white";
        return (
          <button key={i} type="button" data-note={i} aria-pressed={pressed.has(i)} disabled={disabled}
            className={keyClass(kind, pressed.has(i), disabled) + (drum ? " drum-pad" : kind === "black" ? " black-key" : " white-key")}
            style={!drum && BLACK_AT[i] ? { "--key": BLACK_AT[i] } as CSSProperties : undefined}
            aria-label={(drum ? note : NAMES[i] + oct) + ` (${shortcut})`} aria-keyshortcuts={shortcut} title={`${note} · ${shortcut}`}
            {...handlers(i)}>
            <span>{note}</span><kbd aria-hidden="true">{shortcut}</kbd>
          </button>
        );
      })}
    </div>
  );
}

/* the note dialog's piano: C..B of `octave`; the note chosen pressed */
export interface NotePianoProps { octave: number; value: number; onPick: (pitch: number) => void; label: string }
export function NotePiano({ octave, value, onPick, label }: NotePianoProps) {
  return (
    <div id="preview-note-piano" role="group" aria-label={label}
      className="preview-keys preview-note-piano relative grid h-[120px] w-full grid-cols-7 gap-0.5">
      {NAMES.slice(0, 12).map((name, offset) => {
        const pitch = octave + offset, black = BLACK_AT[offset];
        return (
          <button key={offset} type="button" data-pitch={pitch} aria-label={noteName(pitch)} disabled={pitch > 127}
            aria-pressed={pitch === value} className={keyClass(black ? "black" : "white", pitch === value, pitch > 127, true)}
            style={black ? { "--key": black } as CSSProperties : undefined} onClick={() => onPick(pitch)}>
            {black ? name : noteName(pitch)}
          </button>
        );
      })}
    </div>
  );
}
