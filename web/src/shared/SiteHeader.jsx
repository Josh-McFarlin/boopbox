// SPDX-License-Identifier: GPL-3.0-only
// The site's header, the same on every page (home, installer, editor, emulator): the logo, the main links and the
// INSTALL button. Its colours and font are written out here (not the pages' theme tokens) so it looks the same under
// the site's theme and under the editor's pixel-font one.
import { Logo } from "./Brand.jsx";

const GITHUB = "https://github.com/josh-mcfarlin/boopbox";
/* [key, label, the home page's section, the page it leads to elsewhere (relative to webapp/)] */
const LINKS = [
  ["features", "Features", "features", "home/#features"],
  ["editor", "Web editor", "editor", "editor/"],
  ["emu", "Try it", "emulator", "emu/"],
  ["install", "Install", "install", "home/#install"],
];

/* current: the page shown ("home", "editor", "emu", "installer"); base: the way to webapp/ (absolute in the offline
   editor); Hash: the home page's in-page link, for its own sections */
export default function SiteHeader({ current, base = "../", Hash }) {
  const home = current === "home" && Hash;
  const A = ({ k, section, page, children, ...p }) => {
    const cur = k === current ? { "aria-current": "page", className: "!text-[#f2f2f2]" } : {};
    return home && section ? <Hash to={section} {...cur} {...p}>{children}</Hash> : <a href={base + page} {...cur} {...p}>{children}</a>;
  };
  return (
    <header className="border-b border-[#2a2a30] bg-black text-[16px] leading-[1.6] [font-family:'Helvetica_Neue',-apple-system,BlinkMacSystemFont,Arial,sans-serif]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-6 py-4">
        <A k="home" section="top" page="home/" aria-label="BoopBox home" className="block"><Logo className="w-[150px]" /></A>
        <nav aria-label="Main" className="flex flex-auto flex-wrap gap-x-[22px] gap-y-1 text-[15px] [&_a]:text-[#b8b8c0] [&_a]:no-underline [&_a:hover]:text-[#f2f2f2]">
          {LINKS.map(([k, label, section, page]) => <A key={k} k={k} section={section} page={page}>{label}</A>)}
          <a href={`${GITHUB}/blob/main/GUIDE.md`}>Guide</a>
          <a href={GITHUB}>GitHub</a>
        </nav>
        <a href={base + "installer/"} {...(current === "installer" ? { "aria-current": "page" } : {})}
          className="inline-flex min-h-11 items-center bg-[#ff621a] px-5 py-3 text-sm font-semibold uppercase tracking-[.08em] text-black no-underline hover:bg-[#f2f2f2]">Install</a>
      </div>
    </header>
  );
}
