// SPDX-License-Identifier: GPL-3.0-only
// The FM-1 drawn with Tailwind classes. The panel is laid out as the real device is: every size and place below is in
// --u, one unit being one pixel of an 840-unit-wide FM-1 (its photo, measured), so the whole panel scales with the width
// it is given and keeps the device's proportions. On a phone (the panel's box under 640 px: @max-[640px]) the same parts
// stack (the screen first, then the knobs and buttons, the keys at the bottom). The panel keeps the FM-1's own colours
// (its grey case #3a3a3d with #47474b / #2f2f32 shading, the wells #29292b, black rubber #1d1d1f / #2c2c2f, the printing
// #c8c8cc, orange LEDs #ff621a) whatever the page around it looks like.

/* the box the panel measures itself against (its container) */
export const WRAP = '@container relative'

/* ---- the case */
export const CASE =
  'relative grid aspect-[840/500] [--u:calc(100cqw/840)] pt-[calc(30*var(--u))] px-[calc(27*var(--u))] pb-[calc(28*var(--u))] ' +
  'grid-cols-[calc(188*var(--u))_calc(200*var(--u))_1fr] grid-rows-[calc(255*var(--u))_1fr] ' +
  "[grid-template-areas:'left_screen_right'_'keys_keys_keys'] gap-x-[calc(18*var(--u))] gap-y-[calc(10*var(--u))] " +
  'rounded-[calc(40*var(--u))] [background:radial-gradient(120%_90%_at_30%_0%,#47474b,#3a3a3d_45%,#2f2f32)] ' +
  '[box-shadow:0_0_0_1px_#000_inset,0_1px_0_#5a5a5f_inset,0_-2px_0_#222_inset,0_30px_60px_#000c,0_6px_14px_#0008] ' +
  "[font-family:ui-monospace,'SF_Mono','Cascadia_Mono',Menlo,Consolas,monospace] " +
  '@max-[640px]:[--u:calc(100cqw/420)] @max-[640px]:aspect-auto @max-[640px]:gap-y-[calc(22*var(--u))] @max-[640px]:gap-x-0 ' +
  '@max-[640px]:pt-[calc(22*var(--u))] @max-[640px]:px-[calc(14*var(--u))] @max-[640px]:pb-[calc(16*var(--u))] ' +
  '@max-[640px]:grid-cols-[1fr] @max-[640px]:grid-rows-[auto] ' +
  "@max-[640px]:[grid-template-areas:'screen'_'right'_'left'_'keys'] @max-[640px]:rounded-[calc(30*var(--u))]"

/* a label printed on the case */
export const PRINT =
  'whitespace-nowrap text-[#c8c8cc] text-[length:calc(12.5*var(--u))] leading-none tracking-[.03em]'

/* a sunken well (the OCT pair, the button block, the keybed) */
export const WELL =
  'bg-[#29292b] [box-shadow:0_0_0_1px_#1a1a1c_inset,0_2px_4px_#000a_inset,0_1px_0_#4a4a4f]'

/* ---- left: MASTER, SELECT, PRESETS, ALGORITHM, OCT- OCT+ */
export const LEFT =
  '[grid-area:left] flex flex-col items-center pt-[calc(3*var(--u))] ' +
  '@max-[640px]:flex-row @max-[640px]:justify-center @max-[640px]:items-center @max-[640px]:gap-[calc(26*var(--u))]'
export const KNOBS4 =
  'grid grid-cols-[repeat(2,calc(90*var(--u)))] gap-y-[calc(22*var(--u))] justify-items-center'
export const OCT =
  'flex gap-[calc(8*var(--u))] mt-[calc(28*var(--u))] p-[calc(6*var(--u))] rounded-[calc(9*var(--u))] ' +
  '@max-[640px]:flex-col @max-[640px]:mt-0'
export const OCT_BTN = 'w-[calc(56*var(--u))] h-[calc(31*var(--u))]'

/* ---- the screen in its bezel */
export const SCREEN =
  '[grid-area:screen] self-start w-full aspect-square p-[calc(18*var(--u))] rounded-[calc(24*var(--u))] bg-[#050505] ' +
  '[box-shadow:0_0_0_1px_#000,0_0_0_calc(2*var(--u))_#2a2a2c,0_calc(2*var(--u))_calc(6*var(--u))_#0009] ' +
  '@max-[640px]:w-[calc(330*var(--u))] @max-[640px]:justify-self-center @max-[640px]:p-[calc(16*var(--u))]'
export const CANVAS =
  'block w-full h-full rounded-[calc(3*var(--u))] bg-black [image-rendering:pixelated]'

/* ---- right: KNOB1-4 and the twelve buttons */
export const RIGHT =
  '[grid-area:right] flex flex-col items-stretch pt-[calc(3*var(--u))]'
export const KNOBROW =
  'grid grid-cols-[repeat(4,1fr)] justify-items-center px-[calc(4*var(--u))]'
export const PAD =
  'grid grid-cols-[repeat(6,1fr)] gap-y-[calc(10*var(--u))] gap-x-[calc(8*var(--u))] mt-[calc(40*var(--u))] ' +
  'p-[calc(12*var(--u))] rounded-[calc(14*var(--u))] @max-[640px]:mt-[calc(18*var(--u))]'
export const PAD_BTN = 'h-[calc(42*var(--u))]'

/* ---- a knob: the label above, a knurled black cap (turned by --a) with a white mark */
export const KNOB = 'flex flex-col items-center gap-[calc(12*var(--u))]'
export const CAP =
  'relative w-[calc(40*var(--u))] aspect-square rounded-full cursor-ns-resize touch-none ' +
  '[background:radial-gradient(circle_at_50%_50%,#1b1b1d_0_58%,transparent_59%),repeating-conic-gradient(from_var(--a),#0e0e10_0_6deg,#2a2a2e_6deg_12deg)] ' +
  '[box-shadow:0_0_0_calc(2.5*var(--u))_#161618,0_calc(3*var(--u))_calc(6*var(--u))_#000c,0_0_0_calc(3.5*var(--u))_#4a4a4f55] ' +
  "before:absolute before:inset-[21%] before:rounded-full before:content-[''] " +
  'before:[background:radial-gradient(circle_at_40%_30%,#3a3a3e,#19191b_70%)] ' +
  'focus-visible:[outline:2px_solid_var(--color-fg)] focus-visible:[outline-offset:4px]'
export const CAP_MARK =
  'absolute inset-0 [transform:rotate(var(--a))] ' +
  'after:absolute after:left-1/2 after:top-[6%] after:h-[30%] after:w-[calc(3*var(--u))] after:ml-[calc(-1.5*var(--u))] ' +
  "after:rounded-[calc(2*var(--u))] after:bg-[#f2f2f2] after:content-['']"

/* ---- a button: black rubber, its name printed on it (lit orange when the firmware lights it) */
export const BTN =
  'relative flex flex-col items-center justify-center p-0 border-0 rounded-[calc(8*var(--u))] cursor-pointer touch-none ' +
  "[font:700_calc(11*var(--u))/1.05_'Helvetica_Neue',Arial,sans-serif] tracking-[.02em] [transition:transform_.03s] " +
  'focus-visible:[outline:2px_solid_var(--color-fg)] focus-visible:[outline-offset:2px]'
export const BTN_RUBBER = '[background:linear-gradient(#2c2c2f,#1d1d1f_60%)]'
export const BTN_LIT =
  '[background:linear-gradient(#ff8a4c,#ff621a)] [text-shadow:0_0_4px_#7a2a00]'
export const BTN_SHADOW =
  '[box-shadow:0_0_0_1px_#0c0c0d,0_calc(2*var(--u))_0_#0c0c0d,0_1px_0_#3d3d41_inset]'
export const BTN_LIT_SHADOW =
  '[box-shadow:0_0_0_1px_#0c0c0d,0_calc(2*var(--u))_0_#0c0c0d,0_0_calc(14*var(--u))_#ff621a88]'
export const BTN_DOWN =
  '[transform:translateY(calc(2*var(--u)))] [box-shadow:0_0_0_1px_#0c0c0d,0_1px_0_#3d3d41_inset]'
export const BTN_HELD =
  '[outline:calc(2*var(--u))_solid_#ff621a] [outline-offset:calc(2*var(--u))]'
/* the duty layers: half lit (3), breathing up to lit (4; the sound browser's HOME and SAVE) */
export const BTN_DUTY =
  "isolate before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:content-[''] " +
  'before:[background:linear-gradient(#ff8a4c,#ff621a)] before:opacity-45'
export const BTN_BREATHE =
  'before:animate-fm1-breathe motion-reduce:before:animate-none motion-reduce:before:opacity-100'
export const PLAY_LINE =
  'pb-[calc(1.5*var(--u))] mb-[calc(1.5*var(--u))] border-b-[length:calc(1.3*var(--u))] border-solid border-current'

/* ---- the keybed: two rows of rubber pills, each with its light strip; the upper row sits over the gaps. On a phone the
   keybed is at its own size (as wide as on a 840-unit FM-1), in a box that scrolls sideways: the keys play, so it scrolls
   from the strip of case under them (or its scrollbar) */
export const KEYSCROLL =
  '[grid-area:keys] grid @max-[640px]:block @max-[640px]:overflow-x-auto @max-[640px]:overscroll-x-contain ' +
  '@max-[640px]:[scrollbar-width:thin] @max-[640px]:[scrollbar-color:#6a6a70_transparent] ' +
  '@max-[640px]:mx-[calc(-14*var(--u))] @max-[640px]:mb-[calc(-16*var(--u))] ' +
  '@max-[640px]:px-[calc(14*var(--u))] @max-[640px]:pb-[calc(30*var(--u))]'
export const KEYS =
  'relative grid grid-rows-[1fr_1fr] gap-y-[calc(4*var(--u))] pt-[calc(13*var(--u))] px-[calc(14*var(--u))] pb-[calc(12*var(--u))] ' +
  'rounded-[calc(30*var(--u))] @max-[640px]:w-[calc(786*var(--u))] @max-[640px]:h-[calc(177*var(--u))]'
/* a row of 16 pills with gaps of --kg units */
export const ROW =
  '[--kg:5] relative grid grid-cols-[repeat(16,1fr)] gap-x-[calc(var(--kg)*var(--u))]'
export const KEY =
  'flex flex-col items-center p-0 border-0 rounded-[999px] cursor-pointer touch-none text-[#e8e8e8] ' +
  '[background:linear-gradient(90deg,#121214,#1d1d1f_25%,#232326_55%,#1d1d1f_85%,#121214)] ' +
  'focus-visible:[outline:2px_solid_var(--color-fg)] focus-visible:[outline-offset:2px]'
export const KEY_SHADOW =
  '[box-shadow:0_0_0_1px_#0a0a0b,0_calc(3*var(--u))_calc(4*var(--u))_#000a,0_1px_0_#3a3a3e_inset]'
export const KEY_DOWN_SHADOW =
  '[box-shadow:0_0_0_1px_#0a0a0b,0_1px_0_#3a3a3e_inset] [filter:brightness(.85)]'
/* an upper-row key: over the gap it sits on (left: set by the page), as wide as a lower one */
export const KEY_TOP =
  'absolute top-0 bottom-0 w-[calc((100%-15*var(--kg)*var(--u))/16)]'
/* a key's light strip, unlit / half lit / lit */
export const STRIP =
  'absolute left-1/2 w-[calc(5*var(--u))] ml-[calc(-2.5*var(--u))] rounded-[99px] [transition:background_.05s,box-shadow_.05s]'
export const STRIP_LED = [
  'bg-[#e9e9e6] [box-shadow:0_0_calc(2*var(--u))_#fff4]',
  'bg-[#ffb488] [box-shadow:0_0_calc(5*var(--u))_#ff8a4c99]',
  'bg-[#ff7a3a] [box-shadow:0_0_calc(9*var(--u))_#ff621a,0_0_calc(3*var(--u))_#ffc29a]',
]
export const KEY_LABEL =
  'pointer-events-none absolute bottom-[14%] text-[length:calc(9.5*var(--u))] tracking-[.02em] text-[#d8d8d8]'
export const DOT =
  'absolute top-[calc(-3.5*var(--u))] w-[calc(4*var(--u))] h-[calc(4*var(--u))] ml-[calc(-2*var(--u))] rounded-full bg-[#6a6a70]'

/* the computer's key on each control: faint, and only where there is likely a keyboard (a mouse, not a touch screen),
   never on a phone-sized panel; placed by HINT_BTN / HINT_KEY / HINT_CAP */
export const HINT =
  'pointer-events-none absolute hidden border-0 p-0 bg-transparent tracking-[0] text-white opacity-38 whitespace-nowrap ' +
  'shadow-[inset_0_0_0_2px_var(--line)] [@media(hover:hover)_and_(pointer:fine)]:block @max-[640px]:hidden!'
export const HINT_BTN =
  "top-[calc(3*var(--u))] right-[calc(4.5*var(--u))] [font:600_calc(8*var(--u))/1_ui-monospace,'SF_Mono',Menlo,Consolas,monospace]"
export const HINT_KEY =
  "top-[5%] left-1/2 [transform:translateX(-50%)] [font:600_calc(9*var(--u))/1_ui-monospace,'SF_Mono',Menlo,Consolas,monospace]"
export const HINT_CAP =
  'top-[calc(100%+7*var(--u))] left-1/2 [transform:translateX(-50%)] ' +
  "[font:600_calc(8*var(--u))/1_ui-monospace,'SF_Mono',Menlo,Consolas,monospace]"
