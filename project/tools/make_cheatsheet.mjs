#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// The one-page cheat sheet PDF, from the cheat sheet in GUIDE.md ("## 26. Cheat sheet").
//
//   node project/tools/make_cheatsheet.mjs [OUT.pdf]      (default: docs/boopbox-cheat-sheet.pdf)
//
// GUIDE.md is the source: change the tables there, never the PDF. Each "### " heading and its table becomes a box;
// the "Layers" table runs across the page and the other boxes flow in columns under it. The firmware version comes
// from FELUCCA_VERSION in project/firmware/src/ui.c. The text shrinks until everything fits on one A4 landscape
// page; if it cannot fit at the smallest size, the script fails (make the GUIDE.md tables shorter).
// The PDF has fixed dates and a fixed ID, so the same input gives the same file (CI commits it only when it changes).
// It needs Playwright with Chromium (CI: .github/workflows/cheatsheet.yml).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(process.argv[2] || `${REPO}/docs/boopbox-cheat-sheet.pdf`);

// ---- the source -------------------------------------------------------------------------------------------------
const guide = readFileSync(`${REPO}/GUIDE.md`, "utf8");
const start = guide.search(/^## \d+\. Cheat sheet\s*$/m);
if (start < 0) throw new Error("GUIDE.md has no '## N. Cheat sheet' section");
let section = guide.slice(start).split("\n").slice(1).join("\n");
const next = section.search(/^(## |---\s*$)/m);   // the next chapter, or the rule before the credits line
if (next >= 0) section = section.slice(0, next);

const ui = readFileSync(`${REPO}/project/firmware/src/ui.c`, "utf8");
const version = (ui.match(/#define FELUCCA_VERSION "BOOPBOX ([^"]+)"/) || [])[1];
if (!version) throw new Error("FELUCCA_VERSION not found in project/firmware/src/ui.c");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/ · /g, ' <span class="dot">·</span> ');
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const boxes = [];
for (const block of section.split(/^### /m).slice(1)) {
  const [title, ...rest] = block.split("\n");
  const rows = rest.filter((l) => l.trim().startsWith("|")).map(cells);
  const notes = rest.filter((l) => l.trim() && !l.trim().startsWith("|")).map((l) => l.trim());
  if (rows.length < 2) throw new Error(`cheat sheet box '${title}' has no table`);
  const [head, , ...body] = rows;   // (row 2 is the |---| line)
  boxes.push({ title: title.trim(), head, body, notes });
}
if (!boxes.length) throw new Error("the cheat sheet section of GUIDE.md has no '### ' tables");

const table = (b) => {
  // A column that is empty or "—" in every row is left out (the wide Layers table has a few).
  const keep = b.head.map((_, i) => i === 0 || b.body.some((r) => r[i] && r[i] !== "—"));
  const row = (r, tag) => `<tr>${r.map((c, i) => (keep[i] ? `<${tag}>${inline(c || "")}</${tag}>` : "")).join("")}</tr>`;
  return `<table><thead>${row(b.head, "th")}</thead><tbody>${b.body.map((r) => row(r, "td")).join("")}</tbody></table>`;
};
const box = (b) =>
  `<section class="box${b.body.length <= 12 ? " short" : ""}"><h2>${inline(b.title)}</h2>${table(b)}${b.notes.map((n) => `<p>${inline(n)}</p>`).join("")}</section>`;

const wide = boxes.filter((b) => b.head.length > 3);
const narrow = boxes.filter((b) => b.head.length <= 3);
const logo = readFileSync(`${REPO}/project/assets/logo/boopbox-logo-black.png`).toString("base64");

const html = (size) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { width: 297mm; height: 210mm; padding: 7mm 8mm 6mm; font: ${size}pt/1.25 "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
         color: #142636; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 4mm; border-bottom: 1.2mm solid #00b8d4; padding-bottom: 2mm; margin-bottom: 2.5mm; }
  header img { height: 9mm; }
  header h1 { font-size: 15pt; margin: 0; letter-spacing: .02em; }
  header .sub { margin-left: auto; text-align: right; color: #4b6171; font-size: 7.5pt; line-height: 1.35; }
  main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .cols { flex: 1; min-height: 0; column-count: 4; column-gap: 3mm; column-fill: auto; overflow: hidden; }
  .box.short { break-inside: avoid; }
  .box { margin: 0 0 2.5mm; border: .3mm solid #cfe3ea; border-radius: 1.5mm; }
  .box h2 { border-radius: 1.2mm 1.2mm 0 0; }
  .box h2 { margin: 0; padding: .8mm 2mm; font-size: 1.15em; background: #00b8d4; color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: .45mm 1.6mm; border-top: .2mm solid #e1edf1; }
  th { background: #e7f3f7; font-weight: bold; }
  td:first-child { font-weight: bold; }
  .cols td:first-child { width: 48%; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f6fafb; }
  .box p { margin: .6mm 2mm; color: #4b6171; }
  .dot { color: #00a3bd; }
  code { font-family: "DejaVu Sans Mono", monospace; font-size: .95em; }
  footer { color: #4b6171; font-size: 6.5pt; border-top: .2mm solid #cfe3ea; padding-top: 1mm; display: flex; justify-content: space-between; }
</style></head><body>
<header><img src="data:image/png;base64,${logo}" alt=""><h1>BoopBox ${esc(version)} · cheat sheet</h1>
  <div class="sub">M-VAVE FM-1 firmware<br>Every button, layer and combination on one page</div></header>
<main>
  ${wide.map((b) => box(b).replace('class="box', 'class="box wide')).join("")}
  <div class="cols">${narrow.map(box).join("")}</div>
</main>
<footer><span>The full guide: GUIDE.md · github.com/Josh-McFarlin/boopbox</span>
  <span>BoopBox is free software (GPL-3.0), based on SLOOP by isod89 and Felucca by Hügelton Instruments. M-VAVE and FM-1 are trademarks of their owners.</span></footer>
</body></html>`;

// ---- the PDF ----------------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ media: "print" });
let fitted = 0;
for (let size = 8; size >= 5.5; size -= 0.25) {
  await page.setContent(html(size));
  const fits = await page.evaluate(() => {
    const main = document.querySelector("main");
    const cols = document.querySelector(".cols");
    // The columns have the height that is left; when they run out, they overflow sideways (a fifth column),
    // where they are cut off. Every row and title must be inside the page's columns.
    const area = cols.getBoundingClientRect();
    const inside = [...cols.querySelectorAll("h2, tr, p")].every((el) => {
      const r = el.getBoundingClientRect();
      return r.right <= area.right + 1 && r.bottom <= area.bottom + 1;
    });
    return inside && main.scrollHeight <= main.clientHeight + 1 && area.height > 0;
  });
  if (fits) { fitted = size; break; }
}
if (!fitted) {
  await browser.close();
  throw new Error("the cheat sheet does not fit on one page even at 5.5 pt: shorten the tables in GUIDE.md section 26");
}
let pdf = Buffer.from(await page.pdf({ width: "297mm", height: "210mm", printBackground: true, pageRanges: "1" }));
await browser.close();

// Same input, same bytes: fixed dates and ID (same length, so the cross-reference offsets stay right).
let text = pdf.toString("latin1");
text = text.replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, (m, k) => {
  const fixed = `/${k} (D:20000101000000+00'00')`;
  return fixed.length <= m.length ? fixed.padEnd(m.length, " ") : m;
});
text = text.replace(/\/ID \[<([0-9A-Fa-f]+)> <([0-9A-Fa-f]+)>\]/, (m, a, b) => `/ID [<${"0".repeat(a.length)}> <${"0".repeat(b.length)}>]`);
pdf = Buffer.from(text, "latin1");

const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== 1) throw new Error(`the cheat sheet PDF has ${pages} pages, not 1`);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdf);
console.log(`${OUT}: BoopBox ${version}, ${boxes.length} tables, ${fitted} pt, ${pdf.length} bytes`);
