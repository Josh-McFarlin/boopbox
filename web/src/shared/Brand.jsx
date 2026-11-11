// SPDX-License-Identifier: GPL-3.0-only
// The BoopBox logo (assets/logo/boopbox-logo.svg, inline: its first rect, the black ground, made transparent) and the
// strip of the four track colours under it.
import logo from "../../../assets/logo/boopbox-logo.svg?raw";

const LOGO = logo.replace(/<rect([^>]*)fill="#000"\s*\/>/, '<rect$1fill="transparent"/>');

export function Logo({ className = "" }) {
  return <div className={`[&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: LOGO }} />;
}

export function Strip({ className = "" }) {
  return (
    <div className={`flex h-1 ${className}`} aria-hidden="true">
      <i className="flex-1 bg-blue" /><i className="flex-1 bg-green" /><i className="flex-1 bg-yellow" /><i className="flex-1 bg-orange" />
    </div>
  );
}
