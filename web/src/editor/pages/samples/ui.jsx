// SPDX-License-Identifier: GPL-3.0-only
// Pieces the Samples and Drum kit pages share: a numbered step, the meter of a slot's room, a drop target's state.
import { useState } from "react";
import "./samples.css";

/* a numbered step of the page (1 the slot, 2 the sound, 3 send it) */
export function Step({ n, title, children }) {
  return (
    <section className="kstep mt-2 border-t border-line pt-4 pb-1">
      <h3 className="mb-2.5 flex items-center gap-3 uppercase text-fg">
        <span className="grid size-8 place-content-center bg-trk text-big text-black">{n}</span>{title}
      </h3>
      {children}
    </section>
  );
}

/* the room the sound takes in its slot(s); red when over */
export function Meter({ max, value, over, children }) {
  return (
    <div className={`kitmeter flex items-center gap-2.5 ${over ? "over" : ""}`}>
      <progress className="h-2 w-[220px]" max={max} value={value} />
      <span className="dim">{children}</span>
    </div>
  );
}

/* a drop target: [over, its handlers]; onFiles(files, event) gets what was dropped */
export function useDrop(onFiles, stop = false) {
  const [over, setOver] = useState(false);
  return [over, {
    onDragOver: (e) => { e.preventDefault(); if (stop) e.stopPropagation(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e) => {
      e.preventDefault();
      if (stop) e.stopPropagation();                /* (not the card's drop too) */
      setOver(false);
      if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
    },
  }];
}

/* the text of a slot's name: 8 printable characters, upper case */
export function NameInput({ value, onChange }) {
  return (
    <input type="text" className="name w-[110px] uppercase" maxLength="8" spellCheck="false" placeholder="NAME" value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^\x20-\x7E]/g, "").slice(0, 8))} />
  );
}
