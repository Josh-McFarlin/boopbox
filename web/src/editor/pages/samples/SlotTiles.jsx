// SPDX-License-Identifier: GPL-3.0-only
// The sample slots as tiles, the same on the Samples and the Drum kit pages: the slot's name, what it holds, a bar of
// the room it uses and "x / y KiB". The selected one in the interface accent (--acc). tiles: [{ id, title, now, full,
// kib, max, cap, big, why }] (why: the tile is off, and its tooltip says why).
import { t } from "../../core/app.js";
import "./samples.css";

export function SlotTiles({ label, tiles, sel, onPick, className = "grid-cols-4" }) {
  return (
    <div className={`slottiles mb-2.5 grid gap-2 ${className}`} role="radiogroup" aria-label={label}>
      {tiles.map((x) => (
        <button key={x.id} type="button" role="radio" data-k={x.id} aria-checked={x.id === sel ? "true" : "false"}
          className={`slottile ${x.full ? "full" : ""} ${x.big ? "big" : ""}`} disabled={!!x.why} title={x.why || ""}
          onClick={() => onPick(x.id)}>
          <b>{x.title}</b>
          <span className="now">{x.now || t("empty")}</span>
          <progress max={x.max || 1} value={Math.min(x.kib || 0, x.max || 1)} />
          <span className="cap">{`${x.kib || 0} / ${x.max} KiB`}</span>
          {x.cap ? <span className="cap">{x.cap}</span> : null}
        </button>
      ))}
    </div>
  );
}
