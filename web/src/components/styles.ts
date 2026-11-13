// SPDX-License-Identifier: GPL-3.0-only
// The site's shared looks ("pocket arcade") as Tailwind class strings, used on the home page, the guide, the installer
// and the emulator (they were classes in site.css: .arcade-btn, pixel-screen, pixel-panel, and the emulator's kbd).

/* a chunky button with an offset shadow in a second colour (--shadow, cyan by default), pressed in when held. Its size
   (arcadeButtonSize, or the caller's own min-h / px / text size) and its background are added by the caller. Disabled:
   no shadow, not moved, dim text (the background stays the caller's). */
export const arcadeButton =
  "inline-flex cursor-pointer items-center justify-center border-0 font-pixel font-bold leading-none text-ink no-underline " +
  "transition-transform shadow-[5px_5px_0_var(--shadow,var(--color-blue))] " +
  "hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--shadow,var(--color-blue))] " +
  "active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_var(--shadow,var(--color-blue))] " +
  "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-fg " +
  "disabled:cursor-default disabled:text-dim disabled:shadow-none disabled:translate-none";
/* the arcade button's usual size */
export const arcadeButtonSize = "min-h-[52px] px-7 text-[20px]";

/* a pixel screen: the FM-1's 240 x 240 shown crisp, in a thick dark bezel */
export const pixelScreen = "block aspect-square h-auto w-full border-6 border-solid border-deep [image-rendering:pixelated]";

/* a panel drawn with a pixel-thick inside border */
export const pixelPanel = "bg-tile shadow-[inset_0_0_0_3px_var(--line)]";

/* a computer key named in running text (the emulator's help) */
export const kbd = "bg-deep px-1.5 py-px font-mono text-[12px] font-bold text-blue shadow-[inset_0_0_0_2px_var(--line)]";
