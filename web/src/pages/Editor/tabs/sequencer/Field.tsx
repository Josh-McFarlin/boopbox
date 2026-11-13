// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// A field the user types in: it shows `value` unless it has the focus (a value being typed stays), and reports the
// native change (Enter, leaving it, a spinner click, a choice), as the old page's fields did.
import { useEffect, useRef } from "react";

export default function Field({ as: Tag = "input", value, checked, onCommit, children, ...rest }) {
  const ref = useRef(null);
  const cb = useRef(onCommit);
  cb.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (checked != null) el.checked = !!checked;
    else if (value != null && el.value !== String(value)) el.value = String(value);
  });
  useEffect(() => {
    const el = ref.current, h = () => cb.current && cb.current(el);
    el.addEventListener("change", h);
    return () => el.removeEventListener("change", h);
  }, []);
  return <Tag ref={ref} {...rest}>{children}</Tag>;
}
