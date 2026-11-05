// SPDX-License-Identifier: GPL-3.0-only
// The song page (webapp/song/, web/song.html) in Chromium, as a person uses it: an MP3 in (level 1's render), the page
// listens to the whole song (its form, each section with Basic Pitch), shows the tempo, the key and the song, both
// players play the song and a section, the steps are listed, and the package
// it would install is the trainer's with that song in its song area. No FM-1: the install itself is tests/ota_test.c's.
//   node tests/trainer_page_test.mjs SITE_DIR build/trainer/1-first-light.mp3 [SHOTS_DIR]
//   (SITE_DIR: web/make_site.py ... --trainer ...; skipped without Playwright)
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { extname, join } from "path";

import { createRequire } from "module";
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.log("page: skipped (no Playwright)"); process.exit(0); }
const [site, mp3, shots] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm",
                ".bin": "application/octet-stream", ".fwsc": "application/octet-stream" };
const server = createServer((req, res) => {
  let p = join(site, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(0);
const port = server.address().port;
let fails = 0;
const check = (ok, what) => { console.log(`page: ${what.padEnd(88)} ${ok ? "ok" : "FAIL"}`); fails += !ok; };

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`http://localhost:${port}/webapp/song/`);
await page.setInputFiles("#file", mp3);
await page.waitForSelector("#where:not([hidden])", { timeout: 30000 });
const t = Date.now();
await page.click("#listen");
await page.waitForSelector("#s3:not([hidden])", { timeout: 600000 });
const secs = ((Date.now() - t) / 1000).toFixed(0);
const facts = await page.evaluate(() => ({ tempo: fTempo.textContent, key: fKey.textContent, steps: +fSteps.textContent,
                                           size: fSize.textContent, list: steps.children.length,
                                           backend: globalThis.tf?.getBackend(), go: !go.disabled }));
console.log(`page: listened in ${secs} s (TensorFlow.js backend: ${facts.backend}): ${JSON.stringify(facts)}`);
const WANT = { "1-first-light": ["86 BPM", "A minor"], "2-neon-avenue": ["104 BPM", "D minor"],
               "3-lanterns-cinematic-dm-one-chord": ["150 BPM", "D minor"] }[mp3.split("/").pop().replace(/\.\w+$/, "")];
if (WANT) {
  check(facts.tempo === WANT[0], `the tempo: ${facts.tempo}`);
  check(facts.key === WANT[1], `the key: ${facts.key}`);
}
check(facts.steps > 10 && facts.list === facts.steps, `the steps listed: ${facts.list}`);
check(facts.go, "Install is ready");
const styles = await page.evaluate(() => [...document.querySelectorAll("#style option")].map((o) => o.textContent));
check(styles.includes("dubstep"), `the styles offered: ${styles.join(", ")}`);
const form = await page.evaluate(() => ({ parts: [...document.querySelectorAll("#song div")].map((d) => d.textContent),
                                          tabs: [...document.querySelectorAll("#tabs button")].map((b) => b.textContent),
                                          sections: window.trainerSong.base.sections.length }));
console.log(`page: the song ${form.parts.join(" ")}; tabs: ${form.tabs.join(" | ")}`);
check(form.sections >= 2 && form.parts.length >= 2 && form.tabs.length === form.sections + 1,
      `the whole song: ${form.sections} sections, ${form.parts.length} parts on its timeline, a tab each and one for the song`);
if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/song-page.png`, fullPage: true }); }
// both players: the original (an audio source), the FM-1 version (BoopBox's engines in an AudioWorklet)
const level = async (id) => page.evaluate(async (id) => {
  const S = window.trainerSong, ctx = S.ctx, an = ctx.createAnalyser();
  document.getElementById(id).click();
  await new Promise((r) => setTimeout(r, 300));
  (id === "pOrig" ? S.src : S.fm1).connect(an);
  const d = new Float32Array(an.fftSize);
  let peak = 0;
  for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 50)); an.getFloatTimeDomainData(d); peak = Math.max(peak, ...d.map(Math.abs)); }
  document.getElementById(id).click();
  return peak;
}, id);
const po = await level("pOrig"), pf = await level("pFm1");           // (the whole song)
await page.click("#tabs button:nth-child(2)");                       // section A
const pos = await level("pOrig"), pfs = await level("pFm1");
check(pos > 0.01 && pfs > 0.01, `section A on a loop: both play (peaks ${pos.toFixed(3)}, ${pfs.toFixed(3)})`);
const diag = await page.evaluate(async () => {
  const S = window.trainerSong, msgs = [], t0 = S.ctx.currentTime, old = S.fm1.port.onmessage;
  S.fm1.port.onmessage = (e) => { msgs.push(e.data); old(e); };
  document.getElementById("pFm1").click();
  await new Promise((r) => setTimeout(r, 800));
  document.getElementById("pFm1").click();
  S.fm1.port.onmessage = old;
  return { song: S.fm1Error ? JSON.stringify(S.lesson) : null, err: S.fm1Error || null, clock: +(S.ctx.currentTime - t0).toFixed(2), msgs: msgs.length,
           last: JSON.stringify(msgs[msgs.length - 1] || null), state: S.ctx.state };
});
if (diag.song && shots) { mkdirSync(shots, { recursive: true }); writeFileSync(`${shots}/song-player-failed.json`, diag.song); }
if (pf <= 0.01) console.log(`page: (the FM-1 player: ${JSON.stringify({ ...diag, song: undefined })})`);
check(po > 0.01, `the original plays (peak ${po.toFixed(3)})`);
check(pf > 0.01, `the FM-1 version plays (peak ${pf.toFixed(3)})`);
// a hit clicked off and on again: the same song; a part taken out: fewer steps
const again = await page.evaluate(async () => {
  const S = window.trainerSong, before = [...S.area], n = S.lesson.cards.length;
  if (!document.querySelector(".grid button.hit")) [...document.querySelectorAll("#tabs button")].find((x, i) => i &&
    (x.click(), document.querySelector(".grid button.hit")));     // (a section with drums)
  const b = document.querySelector(".grid button.hit");
  b.click();
  const changed = S.area.some((x, i) => x !== before[i]);
  const back = [...document.querySelectorAll(".grid button")].filter((x) => x.title === b.title)[0];
  back.click();
  const same = S.area.every((x, i) => x === before[i]);
  const boxes = document.querySelectorAll(".part input[type=checkbox]"), before2 = [...S.area];
  boxes[boxes.length - 1].click();
  return { changed, same, fewer: S.lesson.cards.length < n || S.area.some((x, i) => x !== before2[i]) };
});
check(again.changed && again.same, "a drum hit clicked off and on: the song changes, then is as it was");
check(again.fewer, "a part taken out of a section: the song changes");
// the package: the trainer's, its song area the page's song
const ok = await page.evaluate(async () => {
  const { songAreaOf, describeSong } = await import("./trslot.js");
  const pkg = await window.trainerPackageWithSong(), area = songAreaOf(pkg), d = describeSong(area);
  return { same: area.every((x, i) => x === window.trainerSong.area[i]), name: d && d.name, cards: d && d.cards };
});
check(ok.same && ok.cards > 10, `the package to install: the trainer with this song (${ok.name}, ${ok.cards} steps)`);
check(!errors.length, `no errors on the page ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
console.log(`page: ${fails ? "FAIL" : "PASS"}`);
process.exit(fails ? 1 : 0);
