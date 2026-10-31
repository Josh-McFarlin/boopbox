// SPDX-License-Identifier: GPL-3.0-only
// The README's screenshots of the web editor, taken from web/editor.html in its mock mode (?mock=1: a simulated FM-1,
// no hardware) in Chromium (Playwright).
//   node tools/make_editor_screens.mjs [OUT_DIR]      (default: assets/screens)
// Writes editor-sound.png, editor-midi-texture.png, editor-drumsynth.png, editor-pianoroll.png, editor-backup.png.
// (editor-cartridge.png needs a DX7 cartridge dropped on the FM6 panel: not made here.)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] || join(ROOT, "assets", "screens"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".ttf": "font/ttf",
  ".wasm": "application/wasm", ".txt": "text/plain" };

const server = createServer(async (q, r) => {
  try {
    const p = join(ROOT, "web", decodeURIComponent(q.url.split("?")[0]));
    const d = await readFile(p);
    r.setHeader("content-type", TYPES[extname(p)] || "application/octet-stream");
    r.end(d);
  } catch (e) { r.statusCode = 404; r.end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/editor.html?mock=1`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("editor: page error:", e.message));
await page.goto(url);
await page.waitForTimeout(500);                         /* (the page set up before Connect) */
await page.click("#connect");
await page.waitForTimeout(1500);

/* the union of the boxes of the groups / cards of a panel whose heading starts with one of the names */
async function boxOf(panel, names) {
  return page.evaluate(([panel, names]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    if (names[0] === "*") {                             /* the panel's visible cards and groups, all of them */
      for (const c of document.querySelectorAll(`#${panel} .card, #${panel} .group`)) {
        if (!c.offsetParent) continue;
        const r = c.getBoundingClientRect();
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top + scrollY); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom + scrollY);
      }
      return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
    for (const h of document.querySelectorAll("h2")) {      /* (the visible ones: the sound groups sit outside #p-sound) */
      if (!h.offsetParent || !(h.closest(`#${panel}`) || h.closest(".groups"))) continue;
      const t = h.textContent.replace(/[^\x20-\x7E]/g, "").trim().toUpperCase();   /* (the icon glyph before it out) */
      if (!names.some((n) => t.startsWith(n.toUpperCase()))) continue;
      const r = h.closest(".group, .card").getBoundingClientRect();
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top + scrollY); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom + scrollY);
    }
    return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }, [panel, names]);
}

async function shot(tab, panel, names, file, before) {
  await page.click(`button[data-tab="${tab}"]`);
  await page.waitForTimeout(600);
  if (before) await before();
  const clip = await boxOf(panel, names);
  if (!clip) {
    const seen = await page.evaluate(() => [...document.querySelectorAll("h2")].filter((h) => h.offsetParent).map((h) => h.textContent.trim().slice(0, 16)));
    throw new Error(`${file}: no ${names.join(", ")} on ${tab} (headings shown: ${seen.join(" | ")})`);
  }
  await page.screenshot({ path: join(OUT, file), clip, fullPage: true });
  console.log(`editor: ${file} (${Math.round(clip.width)}x${Math.round(clip.height)})`);
}

await shot("sound", "p-sound", ["ENV", "LFO", "FX"], "editor-sound.png");
await shot("settings", "p-settings", ["MIDI", "TEXTURE"], "editor-midi-texture.png");
await shot("drumsynth", "p-drumsynth", ["*"], "editor-drumsynth.png");   /* (the whole panel: the kit and its sound) */
await shot("sequencer", "p-sequencer", ["Steps"], "editor-pianoroll.png", async () => {
  await page.getByRole("button", { name: "Piano roll" }).click();
  await page.waitForTimeout(600);
});
await shot("projects", "p-projects", ["Song & sections", "Backup"], "editor-backup.png");

await browser.close();
server.close();
