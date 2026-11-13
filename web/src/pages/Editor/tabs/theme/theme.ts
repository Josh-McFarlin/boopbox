// SPDX-License-Identifier: GPL-3.0-only
/* ---- SLOOP 2.7: the THEME page (firmware v11: backup object 11, gfx.c theme_t) ----
   Made here, with or without an FM-1: five screen colours (darkest first, as the built-in palettes), the four tracks'
   colours, a name. The preview draws a BoopBox page with them, through RGB565 as the FM-1 shows them. Send writes the
   theme to the FM-1 (with its settings, the song stopped) and shows it; Read takes the FM-1's back; the code line
   shares it (THEME.code / THEME.fromCode). */
import { CMD, THEME, crc32, parse, req } from "../../lib/proto.ts";
import { A, notify, op, rq, sayK, t } from "../../core/app.ts";

/* base: the ramp's starting colour (the old page's #thbase field) */
export const TH = { t: Object.assign(THEME.builtin(4), { name: "MY THEME" }), from: "4", sent: null, base: [0x38, 0xc8, 0x5c], hl: null };
/* the colour pointed at (the preview shows where it is used), or null */
export const thHl = (w, k = 0) => { const n = w ? { w, k } : null; if (JSON.stringify(n) !== JSON.stringify(TH.hl)) { TH.hl = n; notify(); } };
export const thOk = () => !!A.dev && !!A.dev.info && A.dev.info.proto >= 11;
export const TH_SCREEN = ["thC1", "thC2", "thC3", "thC4", "thC5"];
/* sent: what the FM-1 shows, as far as this page knows */
export const thState = () => (!thOk() || TH.sent === null ? "" : TH.sent === THEME.code(TH.t) ? "thStSent" : "thStNew");

/* hl: the colour being pointed at ({ w: "c" | "trk" | "bg" | "hi", k }): what is drawn with it stays, the rest fades
   towards the background, so the preview shows where that colour is used */
export function thDraw(cv, hl = TH.hl) {
  const g = cv.getContext("2d"), th = TH.t;
  if (!g) return;
  const bg = THEME.shown(th.bg || [0, 0, 0]), BG = THEME.hex(bg);
  const fade = (rgb, w, k) => THEME.hex(!hl || (hl.w === w && (hl.k === k || w === "bg" || w === "hi")) ? rgb
    : rgb.map((x, i) => Math.round(bg[i] + (x - bg[i]) * 0.18)));
  const P = th.c.map((x, k) => fade(THEME.shown(x), "c", k)), T = th.trk.map((x) => THEME.shown(x));
  const HI = fade(THEME.shown(THEME.hiOf(th)), "hi", 0);
  const col = (k) => fade(T[k], "trk", k), part = (k, f) => fade(T[k].map((x) => Math.round(x * f)), "trk", k);
  const sel = 0;
  g.fillStyle = BG; g.fillRect(0, 0, 240, 240);
  if (hl && hl.w === "bg") { g.strokeStyle = THEME.hex(bg.map((x) => (x > 127 ? x - 90 : x + 90))); g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(1, 1, 238, 238); g.setLineDash([]); }
  g.textBaseline = "top";
  g.font = "bold 12px ui-monospace, monospace";
  g.fillStyle = P[4]; g.fillText("ANALOG1 SOFT PAD", 4, 4);
  g.fillStyle = col(sel); g.fillRect(168, 2, 12, 16);
  g.fillStyle = P[2]; g.fillText("FLT 1/3", 186, 4);
  g.fillStyle = P[0]; g.fillRect(0, 21, 240, 1);
  [["CUT", "64", ""], ["RES", "31", "%"], ["ENV", "+12", "st"], ["DRV", "8", ""]].forEach(([l, v, u], c) => {
    const x = c * 60 + 4;
    g.font = "bold 11px ui-monospace, monospace"; g.fillStyle = P[2]; g.fillText(l, x, 26);
    g.font = "bold 22px ui-monospace, monospace"; g.fillStyle = c === 0 ? HI : col(c); g.fillText(v, x, 40);   /* (CUT: being turned) */
    g.font = "bold 10px ui-monospace, monospace"; g.fillStyle = P[1]; g.fillText(u, x + 2 + g.measureText(v).width * 2.1, 52);
  });
  for (let y = 78; y <= 150; y += 18) { g.fillStyle = P[0]; g.fillRect(4, y, 232, 1); }
  g.strokeStyle = col(sel); g.lineWidth = 2; g.beginPath();
  for (let x = 4; x <= 236; x++) {
    const f = (x - 4) / 232, y = 150 - 52 / (1 + Math.pow(f / 0.55, 6)) - 22 * Math.exp(-Math.pow((f - 0.55) / 0.05, 2));
    if (x === 4) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.font = "bold 10px ui-monospace, monospace"; g.fillStyle = P[3]; g.fillText("1.2k", 128, 154);
  for (let i = 0; i < 16; i++) {
    const x = 4 + i * 14.5, on = [0, 3, 6, 8, 11, 14].includes(i);
    g.fillStyle = i === 4 ? HI : on ? col(sel) : P[1];   /* (the play head: the accent) */
    g.fillRect(x, 170, 12, 12);
    if (!on && i !== 4) { g.fillStyle = BG; g.fillRect(x + 1, 171, 10, 10); }
  }
  ["T1", "T2", "T3", "DR"].forEach((l, k) => {
    const x = 4 + k * 59, lv = [0.8, 0.55, 0.35, 0.9][k];
    g.fillStyle = part(k, 1 / 3); g.fillRect(x, 202, 52, 10);
    g.fillStyle = col(k); g.fillRect(x, 202, Math.round(52 * lv), 10);
    g.fillStyle = part(k, 2 / 3); g.fillRect(x, 214, 52, 2);
    g.font = "bold 11px ui-monospace, monospace"; g.fillStyle = P[3]; g.fillText(l, x, 222);
  });
}

/* ---- edits ---- */
export function thFrom(v) {
  if (v === "") return;
  const name = TH.t.name, bg = TH.t.bg, hi = THEME.hiOf(TH.t);
  TH.t = THEME.builtin(+v);
  TH.t.name = name;
  TH.t.bg = bg || [0, 0, 0];                           /* (a palette: the screen's five; the background and accent stay;
                                                          on a light background the palette the other way round) */
  TH.t.hi = hi;
  if (THEME.light(TH.t.bg)) TH.t.c.reverse();
  TH.from = v;
  notify();
}
export function thColor(which, k, hex) {
  const v = THEME.unhex(hex);
  if (!v) return;
  if (which === "c") { TH.t.c[k] = v; TH.from = ""; }
  else if (which === "trk") { TH.t.trk[k] = v; TH.from = ""; }
  else if (which === "bg") { TH.t.bg = v; TH.from = ""; }
  else if (which === "hi") TH.t.hi = v;
  else if (which === "base") TH.base = v;
  notify();
}
export const thName = (s) => { TH.t.name = THEME.cleanName(s); notify(); };
export const thBlack = () => { TH.t.bg = [0, 0, 0]; notify(); };
export const thInvert = () => { TH.t = THEME.invert(TH.t); TH.from = ""; notify(); };
export const thFix = () => { TH.t = THEME.fix(TH.t); notify(); };
export const thRamp = () => { TH.t.c = THEME.ramp(TH.base, TH.t.bg); TH.from = ""; notify(); };
/* a pasted code -> the theme (false: not one) */
export function thApply(s) {
  const th = THEME.fromCode(s);
  if (!th) { sayK("thBadCode"); return false; }
  TH.t = th;
  TH.from = "";
  notify();
  return true;
}

/* ---- the FM-1 ---- */
async function thPut(bytes) {                       /* -> the BK_PUT rc (0 written) */
  let r = parse[CMD.BK_PUT](await rq(req.bkBegin(THEME.ID, bytes.length, crc32(bytes)), { timeout: 1500, retries: 1 }));
  if (r.rc) return r.rc;
  if (bytes.length) {
    r = parse[CMD.BK_PUT](await rq(req.bkData(THEME.ID, 0, bytes), { timeout: 1500, retries: 1 }));
    if (r.rc) return r.rc;
  }
  return parse[CMD.BK_PUT](await rq(req.bkCommit(THEME.ID), { timeout: 5000, retries: 0 })).rc;
}
const thSay = (rc, okKey) => sayK(rc === 0 ? okKey : rc === 3 ? "thStop" : "thRefused");
/* -> false when the theme is unreadable (the FM-1 would refuse it: the page says why and focuses Fix) */
export function thSend() {
  if (!thOk()) return true;
  if (!THEME.readable(TH.t)) { sayK("thSendDark"); return false; }
  const code = THEME.code(TH.t);
  op(async () => { const rc = await thPut(THEME.encode(TH.t)); if (rc === 0) TH.sent = code; thSay(rc, "thSent"); notify(); });
  return true;
}
export function thRemove() {
  if (thOk() && confirm(t("thRemoveAsk"))) op(async () => { const rc = await thPut(new Uint8Array(0)); if (rc === 0) TH.sent = null; thSay(rc, "thRemoved"); notify(); });
}
export function thRead() {
  if (!thOk()) return;
  op(async () => {
    const L = parse[CMD.BK_LIST](await rq(req.bkList(), { timeout: 5000, retries: 0 }));
    const it = !L.rc && L.items.find((x) => x.id === THEME.ID);
    if (!it) { sayK("thNone"); return; }
    const g = parse[CMD.BK_GET](await rq(req.bkGet(THEME.ID, 0, it.len), { timeout: 1500, retries: 2 }));
    const th = !g.rc && THEME.decode(Uint8Array.from(g.data));
    if (!th) { sayK("thNone"); return; }
    TH.t = th;
    TH.from = "";
    TH.sent = THEME.code(th);
    notify();
    sayK("thGot");
  });
}
