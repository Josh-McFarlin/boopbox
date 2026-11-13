// SPDX-License-Identifier: GPL-3.0-only
// The editor's shared class strings: the variants of the native controls (styles/editor.css styles a bare <button>,
// <select>, <input> ... in @layer base) and the small text styles, as Tailwind utilities. Utilities beat @layer base
// whatever its selectors' specificity, so a variant states its hover / disabled looks itself where the base rule's
// would have won before.

/* a row of controls */
export const bar = "m-0 mb-2 flex flex-wrap items-center gap-2";
/* (in a bar) the element that takes the rest of the row */
export const barGrow = "flex-1";

/* toggles: a segmented group (the container), its buttons (each one gets `tog`); or one button that stays pressed
   (aria-pressed) */
export const seg = "inline-flex flex-wrap gap-0.5";
export const tog = "bg-s2 text-dim aria-pressed:bg-acc aria-pressed:text-black";
/* a toggle whose words are ids / names as written (no lowercase): the buttons of a segmented group of ids */
export const togId = `${tog} normal-case`;

/* the primary action */
export const pri = "bg-acc text-black hover:enabled:bg-fg disabled:bg-s2 disabled:text-dim";
/* an action that destroys something: red under the pointer */
export const warn = "hover:enabled:bg-red hover:enabled:text-black";

/* quieter words; an error */
export const dim = "text-dim";
export const bad = "text-red";

/* help text: sentences in DM Sans (the values, labels and buttons stay in the device's pixel font); a <p> has it already
   (editor.css @layer base) */
export const help = "font-text text-[15px] leading-[22px] [-webkit-font-smoothing:antialiased] [text-rendering:auto]";

/* an icon (the Fukiai font; hidden until it has loaded: html.fk). A fixed-width box, its glyph centred and lowered onto
   the text's middle (Fukiai draws above the pixel font's), so the words after icons of different widths start in one
   column; faded in a disabled button */
export const icon =
  "mr-[.45em] inline-block w-[1.15em] text-center align-[-0.2em] font-[family-name:Fukiai] leading-none font-normal not-italic " +
  "[font-synthesis:none] [-webkit-font-smoothing:antialiased] in-[button:disabled]:opacity-50 in-[html:not(.fk)]:hidden";

/* a WAVE choice: a page-drawn picker so the options carry an icon (Chrome 135+, appearance: base-select); native menus
   get words only */
export const waveSelect =
  "supports-[appearance:base-select]:[appearance:base-select] supports-[appearance:base-select]:[&::picker(select)]:[appearance:base-select] " +
  /* (it draws its own arrow) */
  "supports-[appearance:base-select]:bg-none! " +
  "supports-[appearance:base-select]:[&>button]:[font:inherit] supports-[appearance:base-select]:[&>button]:[background:none] " +
  "supports-[appearance:base-select]:[&>button]:text-inherit supports-[appearance:base-select]:[&>button]:p-0 " +
  "supports-[appearance:base-select]:[&>button]:text-start supports-[appearance:base-select]:[&>button]:normal-case " +
  "supports-[appearance:base-select]:[&::picker(select)]:border supports-[appearance:base-select]:[&::picker(select)]:border-s3 " +
  "supports-[appearance:base-select]:[&::picker(select)]:bg-bg supports-[appearance:base-select]:[&::picker(select)]:text-fg " +
  "supports-[appearance:base-select]:[&::picker(select)]:p-0 " +
  "supports-[appearance:base-select]:[&_option]:px-2 supports-[appearance:base-select]:[&_option]:py-[2px] " +
  "supports-[appearance:base-select]:[&_option]:[min-block-size:0] supports-[appearance:base-select]:[&_option:checked]:text-acc " +
  "supports-[appearance:base-select]:[&_option:hover]:bg-acc supports-[appearance:base-select]:[&_option:hover]:text-black " +
  "supports-[appearance:base-select]:[&_option:focus-visible]:bg-acc supports-[appearance:base-select]:[&_option:focus-visible]:text-black " +
  "supports-[appearance:base-select]:[&_option::checkmark]:hidden";
