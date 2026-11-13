// SPDX-License-Identifier: GPL-3.0-only
// "On this page": the sections, numbered, in a column that stays in view (wide screens only).
import { SECTIONS } from "../data/sections.ts";

export const number = (i) => String(i + 1).padStart(2, "0");

export default function Toc() {
  return (
    <nav aria-label="On this page" className="hidden min-[1100px]:block">
      <div className="sticky top-6">
        <p className="m-0 mb-3 font-pixel text-[14px] text-dim">ON THIS PAGE</p>
        <ol className="m-0 list-none space-y-1 p-0 font-pixel text-[16px]">
          {SECTIONS.map(({ id, toc }, i) => (
            <li key={id}><a href={`#${id}`} className="block py-0.5 text-body no-underline hover:text-blue"><span className="mr-2 text-dim">{number(i)}</span>{toc}</a></li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
