// SPDX-License-Identifier: GPL-3.0-only
// A number field that commits on the native "change" (Enter, leaving the field, the spinner), as the old editor's
// fields did: typing alone sends nothing. It shows the value it is given again after each commit (the page clamps it),
// and also whenever it is not being typed in. And a stepper: a number with − and + ("4 bars", "× 2").
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

/* a number with − and + (and the mouse wheel over it); whyMin / whyMax: why − / + is disabled at the ends */
export function Stepper({ v, min, max, onChange, fmt = String, label, id, whyMax, whyMin }) {
  const ref = useRef(null), st = useRef();
  st.current = { v, min, max, onChange };
  useEffect(() => {
    const el = ref.current;
    const f = (e) => {
      e.preventDefault();
      const s = st.current, n = Math.max(s.min, Math.min(s.max, s.v + (e.deltaY < 0 ? 1 : -1)));
      if (n !== s.v) s.onChange(n);
    };
    el.addEventListener("wheel", f, { passive: false });
    return () => el.removeEventListener("wheel", f);
  }, []);
  return (
    <span ref={ref} id={id} className="inline-flex items-center border border-line bg-bg" role="group" aria-label={label}>
      <button type="button" className="px-2.5! py-0.5!" disabled={v <= min} title={v <= min ? whyMin || "" : ""} aria-label={label + " −"}
        onClick={() => onChange(v - 1)}>−</button>
      <span className="min-w-[80px] px-2 text-center text-fg">{fmt(v)}</span>
      <button type="button" className="px-2.5! py-0.5!" disabled={v >= max} title={v >= max ? whyMax || "" : ""} aria-label={label + " +"}
        onClick={() => onChange(v + 1)}>+</button>
    </span>
  );
}
