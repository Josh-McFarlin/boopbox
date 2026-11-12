// SPDX-License-Identifier: GPL-3.0-only
// Small controls of the Patterns page and the step components.
import { t } from "../../core/app.js";
import { More } from "../../ui/kit.jsx";

/* a one-line help and its "?" with the longer text (the "?" opens it below the line) */
export function HelpMore({ line, children, className = "mb-3" }) {
  return (
    <div className={`help max-w-[80ch] text-dim ${className}`}>
      <span>{line}</span>
      {children ? <More>{children}</More> : null}
    </div>
  );
}

/* a select of numbers */
export const Sel = ({ v, onPick, children, ...rest }) => (
  <select value={String(v)} onChange={(e) => onPick(+e.target.value)} {...rest}>{children}</select>
);

/* memory used: a short bar and "used / max B" (red when over) */
export function MemBar({ label, used, max, id }) {
  const over = used > max, pc = Math.min(100, Math.round((100 * used) / max));
  return (
    <span id={id} className={`inline-flex items-center gap-1.5 ${over ? "text-red" : "text-dim"}`} title={`${label}: ${used} / ${max} B`}>
      <span>{label}</span>
      <span className="relative inline-block h-2 w-12 border border-line bg-bg">
        <span className={`absolute inset-y-0 left-0 ${over ? "bg-red" : "bg-dim"}`} style={{ width: pc + "%" }} />
      </span>
      <span>{over ? `${used} / ${max} B` : `${pc}%`}</span>
    </span>
  );
}

/* a segmented row of sub-pages */
export function SubTabs({ tabs, value, onPick, id }) {
  return (
    <div className="seg" role="tablist" id={id}>
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} aria-pressed={value === k} onClick={() => onPick(k)}>{t(label)}</button>
      ))}
    </div>
  );
}
