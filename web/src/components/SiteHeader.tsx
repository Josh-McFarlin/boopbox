// SPDX-License-Identifier: GPL-3.0-only
// The site's header, the same on every page (home, installer, editor, emulator): the logo, the main links and the
// INSTALL button, in the site's "pocket arcade" look. Its colours and fonts are written out here (not the pages' theme
// tokens) so it looks the same under the site's theme and under the editor's own one.
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Logo } from "./Brand.tsx";

const GITHUB = "https://github.com/josh-mcfarlin/boopbox";
/* [key (the page it marks as current), label, the page it opens (relative to webapp/)]: always a page, never a section
   of the home page. The home key uses the site's root URL. */
const LINKS: [key: string, label: string, page: string][] = [
  ["home", "Features", "home/"],
  ["editor", "Web editor", "editor/"],
  ["guide", "Guide", "guide/"],
  ["emu", "Try it", "emu/"],
  ["installer", "Install", "installer/"],
];

/* current: the page shown ("home", "guide", "editor", "emu", "installer"); base: the way to webapp/ (absolute in the offline
   editor) */
export interface SiteHeaderProps {
  current: string;
  base?: string;
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  k: string;
  page: string;
  children?: ReactNode;
}

export default function SiteHeader({ current, base = "../" }: SiteHeaderProps) {
  const homeHref = base.startsWith("http") ? new URL("../", base).href : "/";
  const A = ({ k, page, children, ...p }: LinkProps) => {
    const cur: AnchorHTMLAttributes<HTMLAnchorElement> = k === current ? { "aria-current": "page", className: "!text-[#ffffff] underline decoration-[#ff4fd8] decoration-[3px] underline-offset-[6px]" } : {};
    return <a href={k === "home" ? homeHref : base + page} {...cur} {...p}>{children}</a>;
  };
  return (
    <header className="border-b-[3px] border-[#3a2766] bg-[#160d2b] text-[16px] leading-[1.6] [font-family:'Jersey_10',ui-monospace,Menlo,monospace] [font-variant-ligatures:none]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-6 py-4">
        <A k="home" page="home/" aria-label="BoopBox home" className="block no-underline"><Logo /></A>
        <nav aria-label="Main" className="flex flex-auto flex-wrap gap-x-[22px] gap-y-1 text-[18px] font-medium [&_a]:text-[#c9bdf0] [&_a]:no-underline [&_a:hover]:text-[#3ee6ff]">
          {LINKS.map(([k, label, page]) => <A key={k} k={k} page={page}>{label}</A>)}
          <a href={GITHUB}>GitHub</a>
        </nav>
        <a href={base + "installer/"} {...(current === "installer" ? { "aria-current": "page" } : {})}
          className="inline-flex min-h-11 items-center bg-[#c6ff3d] px-5 py-2 text-[18px] font-bold uppercase leading-none text-[#160d2b] no-underline
            shadow-[4px_4px_0_#ff4fd8] hover:bg-[#ffffff] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]">Install</a>
      </div>
    </header>
  );
}
