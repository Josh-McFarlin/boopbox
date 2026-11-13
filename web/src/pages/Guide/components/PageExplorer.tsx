// SPDX-License-Identifier: GPL-3.0-only
// Every page of every button: pick the button, then the page, and see its screen and its four knobs.
import { useState } from "react";
import { PAGES } from "../data/pages.ts";
import { shot } from "../data/screens.ts";
import { C } from "../data/theme.ts";
import { B, Kbd, Knobs, Screen, Tabs } from "./ui.tsx";
import type { TabItem } from "./ui.tsx";

export default function PageExplorer() {
  const [btn, setBtn] = useState("ENV");
  const [page, setPage] = useState(0);
  const group = PAGES.find((p) => p.button === btn)!;
  const [name, img, knobs, note] = group.pages[Math.min(page, group.pages.length - 1)];
  return (
    <div>
      <Tabs label="Button" value={btn} onChange={(b: string) => { setBtn(b); setPage(0); }} items={PAGES.map((p): TabItem<string> => [p.button, p.button, p.color])} />
      <div className="flex flex-wrap gap-x-10 gap-y-8">
        <figure className="m-0 w-full max-w-[320px] min-w-0 flex-[1_1_260px]">
          <Screen src={shot(img)} alt={`The ${btn} → ${name} page`} color={group.color} />
          <figcaption className="mt-5 text-[14px] text-dim">{btn} → {name}, page {page + 1} of {group.pages.length}</figcaption>
        </figure>
        <div className="min-w-0 flex-[1_1_420px]">
          <p className="m-0 mb-3 text-[15px]">
            {group.via ? <>Open with <B>{group.via}</B>. </> : <>Tap <Kbd color={C[group.color]}>{btn}</Kbd> for the first page; tap again (or turn <B>SELECT</B>) for the next. </>}
          </p>
          <Tabs label={`${btn} pages`} value={page} onChange={setPage} color={group.color} items={group.pages.map((p, i): TabItem<number> => [i, p[0]])} />
          <Knobs values={knobs} />
          {note ? <p className="m-0 mt-4 text-[15px] text-body">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}
