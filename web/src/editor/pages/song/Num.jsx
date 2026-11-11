// SPDX-License-Identifier: GPL-3.0-only
// A number field that commits on the native "change" (Enter, leaving the field, the spinner), as the old editor's
// fields did: typing alone sends nothing. It shows the value it is given again after each commit (the page clamps it),
// and also whenever it is not being typed in.
import { useEffect, useRef } from "react";

export function Num({ v, min, max, onCommit, className = "", ...rest }) {
  const ref = useRef(null);
  const st = useRef({ cb: onCommit, done: false });
  st.current.cb = onCommit;
  useEffect(() => {
    const el = ref.current;
    const f = () => { st.current.done = true; st.current.cb(+el.value); };
    el.addEventListener("change", f);
    return () => el.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (st.current.done || document.activeElement !== el) { el.value = String(v); st.current.done = false; }
  });
  return <input ref={ref} type="number" min={min} max={max} defaultValue={String(v)} className={className} {...rest} />;
}

/* the look of the old table.song (the Song order, the Patterns page's tables): cells 4 / 8 px, number fields 64 px,
   the row buttons small; td.i (the row number) dim and on the right */
export const SONG_TABLE = "[&_td]:px-2 [&_td]:py-1 [&_td]:text-left [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_input[type=number]]:w-16";
export const ACTS = "[&_button]:mr-1 [&_button]:min-w-[34px] [&_button]:px-1.5 [&_button]:py-0";
export const TD_I = "text-dim text-right!";
