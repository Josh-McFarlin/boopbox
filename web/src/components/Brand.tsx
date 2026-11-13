// SPDX-License-Identifier: GPL-3.0-only
// The website wordmark uses Jersey 10 beside the pixel-art boombox icon (project/assets/logo/boopbox-icon.svg, inline:
// its black ground made transparent, its colour bars in the site's palette; 30 x 29 pixels, drawn 1.5 px a pixel).
// The firmware's separate raster wordmark remains generated from Pixelify Sans glyphs by project/tools/gen_logo.py.
import icon from '../../../project/assets/logo/boopbox-icon.svg?raw'

/* the icon's bars: the FM-1's track colours -> the site's magenta, cyan, lime and yellow (light row: their tints) */
const BARS: Record<string, string> = {
  '#287CFF': '#3EE6FF',
  '#1ECC70': '#C6FF3D',
  '#FFC618': '#FFD23F',
  '#FF621A': '#FF4FD8',
  '#88B6FF': '#A8F4FF',
  '#83E2B0': '#E2FF9E',
  '#FFDF7F': '#FFE89A',
  '#FFA881': '#FFA7EC',
}
const ICON = icon
  .replace(/fill="#000"/g, 'fill="transparent"')
  .replace(/ role="img" aria-label="BoopBox"/, ' aria-hidden="true"')
  .replace(/#[0-9A-F]{6}/g, (c) => BARS[c] || c)

interface ClassNameProps {
  className?: string
}

export function Logo({ className = '' }: ClassNameProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 leading-none ${className}`}
    >
      <span
        className="block w-[45px] shrink-0 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: ICON }}
      />
      <span className="[font-family:'Jersey_10',ui-monospace,monospace] text-[30px] font-bold tracking-[.01em] text-[#ffffff]">
        boopbox
      </span>
    </span>
  )
}

export function Strip({ className = '' }: ClassNameProps) {
  return (
    <div className={`flex h-1 ${className}`} aria-hidden="true">
      <i className="flex-1 bg-blue" />
      <i className="flex-1 bg-green" />
      <i className="flex-1 bg-yellow" />
      <i className="flex-1 bg-orange" />
    </div>
  )
}
