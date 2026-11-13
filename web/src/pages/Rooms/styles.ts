// SPDX-License-Identifier: GPL-3.0-only
// The jam rooms page's shared Tailwind class strings: its panels, small capitals, headings and buttons.
import clsx from "clsx";

/* a raised panel: the room creator, the room browser, the active room, its control cards and the player list */
export const CARD = "rounded-[18px] border border-[#493766] bg-[rgb(30_20_48/90%)] shadow-[0_18px_45px_rgb(0_0_0/16%)]";

/* the small capitals over headings */
export const KICKER = "mt-0 mb-2 text-[12px] font-extrabold uppercase tracking-[.14em] text-[#d1bfef]";

/* a panel's title (h2) and a card's title (h3) */
export const PANEL_TITLE = "m-0 text-[25px] tracking-[-.025em] text-white";
export const CARD_TITLE = "m-0 text-[17px] text-white";

/* the outer panels narrow their corners and padding on a phone */
export const PANEL_PHONE = "max-[520px]:rounded-[14px] max-[520px]:p-[18px]";

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#3ee6ff]";

/* the page's buttons: primary (lime) or secondary (outlined violet); small for the players' mute and solo */
export function button(variant: "primary" | "secondary", size: "normal" | "small" = "normal") {
  return clsx(
    "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[9px] border-2 font-extrabold",
    "transition-[translate,background-color,border-color] duration-[.12s] ease-[ease] enabled:hover:-translate-y-px",
    "disabled:cursor-not-allowed disabled:opacity-48 motion-reduce:transition-none",
    FOCUS,
    size === "small" ? "px-[10px] py-[7px] text-[12px]" : "px-[15px] py-[9px] text-[14px]",
    variant === "primary"
      ? "border-transparent bg-[#c6ff3d] text-[#160d2b] enabled:hover:bg-[#e0ff9b]"
      : "border-[#75618e] bg-[#2a1c40] text-white enabled:hover:border-[#cbb7e8] enabled:hover:bg-[#38274f]",
  );
}

export const SELECT_FOCUS = FOCUS;
