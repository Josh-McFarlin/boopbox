// SPDX-License-Identifier: GPL-3.0-only
// The sample slots as tiles, the same on the Samples and the Drum kit pages: the slot's name, what it holds, a bar of
// the room it uses and "x / y KiB". The selected one in the interface accent (--acc). tiles: [{ id, title, now, full,
// kib, max, cap, big, why }] (why: the tile is off, and its tooltip says why).
import clsx from "clsx";
import { t } from "../../core/app.ts";

/* a tile: its slot (id), its name, what it holds (now; full: something), the room it uses (kib of max), a line under
   it (cap), big: it takes two slots, why: it cannot be picked (and why) */
export interface SlotTile<K = number> {
  id: K; title: string; now?: string; full?: boolean; kib?: number; max: number; cap?: string; big?: boolean; why?: string;
}
export interface SlotTilesProps<K = number> {
  label: string; tiles: SlotTile<K>[]; sel: K; onPick: (id: K) => void; className?: string;
}

/* a sample slot (on Samples and Drum kit alike): its name, what it holds, the room it uses */
export function SlotTiles<K extends string | number = number>({ label, tiles, sel, onPick, className = "grid-cols-4" }: SlotTilesProps<K>) {
  return (
    <div className={`slottiles mb-2.5 grid gap-2 ${className}`} role="radiogroup" aria-label={label}>
      {tiles.map((x) => (
        <button key={x.id} type="button" role="radio" data-k={x.id} aria-checked={x.id === sel ? "true" : "false"}
          className={clsx("flex min-h-[92px] flex-col items-stretch gap-1 border border-s3 bg-bg px-3 py-2.5 text-left whitespace-normal normal-case",
            /* (the base hover again, over the tile's own background) */
            "hover:enabled:bg-s2 aria-checked:border-acc aria-checked:bg-s2 aria-checked:shadow-[inset_0_0_0_1px_var(--acc)]")}
          disabled={!!x.why} title={x.why || ""}
          onClick={() => onPick(x.id)}>
          <b className={clsx("text-[32px] leading-8 font-normal", x.id === sel ? "text-acc" : "text-fg")}>{x.title}</b>
          <span className={clsx("wrap-anywhere", x.full ? "text-fg2" : "text-s3")}>{x.now || t("empty")}</span>
          <progress className="h-1 w-full" max={x.max || 1} value={Math.min(x.kib || 0, x.max || 1)} />
          <span className="text-dim">{`${x.kib || 0} / ${x.max} KiB`}</span>
          {x.cap ? <span className="text-dim">{x.cap}</span> : null}
        </button>
      ))}
    </div>
  );
}
