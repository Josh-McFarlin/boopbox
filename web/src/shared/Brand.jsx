// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox logo: the boombox icon (assets/logo/boopbox-icon.svg, inline: its black ground and case made transparent, its
// colour bars in the site's palette) and the name set in the site's pixel font; and the strip of the four colours.
import icon from "../../../assets/logo/boopbox-icon.svg?raw";

/* the icon's bars: the FM-1's track colours -> the site's magenta, cyan, lime and yellow (light row: their tints) */
const BARS = { "#287CFF": "#3EE6FF", "#1ECC70": "#C6FF3D", "#FFC618": "#FFD23F", "#FF621A": "#FF4FD8",
               "#88B6FF": "#A8F4FF", "#83E2B0": "#E2FF9E", "#FFDF7F": "#FFE89A", "#FFA881": "#FFA7EC" };
const ICON = icon.replace(/fill="#000"/g, 'fill="transparent"')
  .replace(/ role="img" aria-label="BoopBox"/, ' aria-hidden="true"')
  .replace(/#[0-9A-F]{6}/g, (c) => BARS[c] || c);

export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className}`}>
      <span className="block w-[46px] shrink-0 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: ICON }} />
      <span className="font-bold text-[#ffffff] [font-family:'Pixelify_Sans',ui-monospace,monospace] text-[30px] tracking-[.01em]">boopbox</span>
    </span>
  );
}

export function Strip({ className = "" }) {
  return (
    <div className={`flex h-1 ${className}`} aria-hidden="true">
      <i className="flex-1 bg-blue" /><i className="flex-1 bg-green" /><i className="flex-1 bg-yellow" /><i className="flex-1 bg-orange" />
    </div>
  );
}
