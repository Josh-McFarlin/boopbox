// SPDX-License-Identifier: GPL-3.0-only
// The visual guide: how to reach everything in the firmware, on a drawing of the FM-1. The page is its sections, in the
// order data/sections.js lists them (with their headings); sections/ holds each one's body, components/ the parts they
// share, and data/ every word and screen they show (from GUIDE.md; the screens are the firmware's own).
import SiteHeader from "../../components/SiteHeader.tsx";
import Footer from "./components/Footer.tsx";
import Hero from "./components/Hero.tsx";
import Toc, { number } from "./components/Toc.tsx";
import { Section } from "./components/ui.tsx";
import { GITHUB, GUIDE_URL } from "./data/links.ts";
import { SECTIONS } from "./data/sections.ts";
import { BODIES } from "./sections/index.ts";

export default function Guide() {
  return (
    <div className="min-h-screen bg-bg text-[16px] leading-[1.6] text-body">
      <SiteHeader current="guide" />
      <Hero />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 min-[1100px]:grid-cols-[180px_1fr]">
        <Toc />
        <main className="min-w-0">
          {SECTIONS.map(({ id, kicker, title, intro }, i) => {
            const Body = BODIES[id];
            return (
              <Section key={id} id={id} kicker={`${number(i)} · ${kicker}`} title={title} intro={intro}>
                <Body />
              </Section>
            );
          })}
          <p className="m-0 py-12 text-[15px]">This page is the map. The <a href={GUIDE_URL} className="text-blue">complete guide</a> has every
            detail, the <a href="../emu/" className="text-blue">emulator</a> lets you try it all in the browser, and the source is
            on <a href={GITHUB} className="text-blue">GitHub</a>.</p>
        </main>
      </div>
      <Footer />
    </div>
  );
}
