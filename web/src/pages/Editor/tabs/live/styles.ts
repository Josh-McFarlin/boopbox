// SPDX-License-Identifier: GPL-3.0-only
// The LIVE page's shared class strings (Tailwind). The page's root (Live.tsx) is the group "lv": its modes are data
// attributes there (data-simple: the essentials view, data-nopro: a firmware without LIVE pro, data-learn: MIDI learn).
// The drum panel of the Sound page uses the knobs and lvNeeds too.

/* shown in the everything view only; with LIVE pro only */
export const adv = "group-data-[simple]/lv:hidden!";
export const xpro = "group-data-[nopro]/lv:hidden!";

/* a row of small controls */
export const grp = "flex flex-wrap items-center gap-1.5";
/* a row of knobs */
export const knobs = "flex flex-wrap gap-x-3 gap-y-2";
/* "needs firmware 2.7" */
export const needs = "border border-t3 px-3 text-t3";

/* the looks a button's own background leaves to the editor's base rules otherwise (under the pointer, disabled) */
export const hov = "hover:enabled:bg-s3";
export const dis = "disabled:bg-s1 disabled:text-dim";

/* a button in a card's head (and the stage tools) */
export const headBtn = "px-2.5 py-0.5";
/* the "?" of a card */
export const qBtn = "min-w-6 flex-none border border-s3 bg-bg text-fg hover:bg-s3 aria-expanded:border-acc aria-expanded:bg-acc aria-expanded:text-black";

/* the blink of what waits for the bar (the section next, REC armed, the song loading) */
export const blink = "animate-lvblink-fast";

/* a key name (<kbd>) in the words around it */
export const kbd = "[font:inherit]";
