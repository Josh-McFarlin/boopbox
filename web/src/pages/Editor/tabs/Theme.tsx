// SPDX-License-Identifier: GPL-3.0-only
// The Theme page (protocol v11): the FM-1's screen colours, made here with or without an FM-1, a preview of its screen
// (pointing at a colour shows where the preview uses it), and a line to share them (the Share dialog). The logic:
// pages/theme/theme.js.
import { useEffect, useRef, useState } from "react";
import { THEME } from "../lib/proto.ts";
import { sayK, t, useApp } from "../core/app.ts";
import { Card, Help, Ic } from "../ui/kit.tsx";
import { ShortHelp } from "./samples/ui.tsx";
import {
  TH, TH_SCREEN, thApply, thBlack, thColor, thDraw, thFix, thFrom, thHl, thInvert, thName, thOk, thRamp, thRead, thRemove, thSend, thState,
} from "./theme/theme.ts";

const BAD = "outline-3 outline-red outline-offset-1";
const COLOR = "h-[34px] w-full cursor-pointer rounded p-0";
/* pointing at (or focusing) a colour: the preview shows where it is used */
const point = (w, k = 0) => ({ onMouseEnter: () => thHl(w, k), onMouseLeave: () => thHl(null), onFocus: () => thHl(w, k), onBlur: () => thHl(null) });

function Cols({ id, list, which, label, bad }) {
  return (
    <div id={id} className="grid grid-cols-5 gap-1.5">
      {list.map((c, k) => (
        <label key={k} className="flex flex-col gap-[3px] text-[12px]" {...point(which, k)}>
          <span data-k={k}>{label(k)}</span>
          <input type="color" className={`${COLOR} ${bad && bad(k) ? BAD : ""}`} value={THEME.hex(c)}
            onChange={(e) => thColor(which, k, e.target.value)} />
        </label>
      ))}
    </div>
  );
}

export default function Theme() {
  const { dev } = useApp();
  const cv = useRef(null), fix = useRef(null), code = useRef(null), dlg = useRef(null);
  const [name, setName] = useState(null);        /* the name being typed (cleaned when it is done) */
  const [paste, setPaste] = useState("");
  useEffect(() => { if (cv.current) thDraw(cv.current); });
  useEffect(() => () => thHl(null), []);
  const th = TH.t, ok = thOk();
  const pb = THEME.problems(th), readable = !pb.val && !pb.acc;
  const st = thState();
  const H3 = "mt-2.5 mb-1 text-[13px]";
  return (
    <>
      <Card title={t("thTitle")} ic="ui_knob">
        <ShortHelp text={t("thHelp")} />
        <div className="my-2 flex flex-wrap items-start gap-4">
          <canvas id="thprev" ref={cv} width="240" height="240" role="img" aria-label="FM-1 screen"
            className="aspect-square w-[360px] max-w-full rounded-md border border-line bg-bg [image-rendering:pixelated]" />
          <div className="min-w-[260px] flex-1">
            <p className="bar"><span>{t("thStart")}</span>
              <select id="thfrom" value={TH.from} onChange={(e) => thFrom(e.target.value)}>
                <option value="">—</option>
                {THEME.BUILTIN.map(([n], i) => <option key={i} value={String(i)}>{n}</option>)}
              </select>
              <span>{t("name")}</span>
              <input id="thname" type="text" maxLength={8} size={9} spellCheck="false" value={name ?? th.name}
                onChange={(e) => { setName(e.target.value); thName(e.target.value); }}
                onBlur={() => setName(null)} onKeyDown={(e) => { if (e.key === "Enter") setName(null); }} /></p>
            <h3 className={H3}>{t("thScreen")}</h3>
            <Cols id="thscreen" list={th.c} which="c" label={(k) => `${k + 1} ${t(TH_SCREEN[k])}`} bad={(k) => k === 4 && pb.val} />
            <p className="bar mt-2"><span>{t("thBg")}</span>
              <input type="color" id="thbg" {...point("bg")} value={THEME.hex(th.bg || [0, 0, 0])} onChange={(e) => thColor("bg", 0, e.target.value)} />
              <button type="button" id="thbgblack" onClick={thBlack}>{t("thBlack")}</button>
              <button type="button" id="thinvert" onClick={thInvert}>{t("thInvert")}</button></p>
            <p className="bar"><span>{t("thAcc")}</span>
              <input type="color" id="thacc" {...point("hi")} className={pb.acc ? BAD : ""} value={THEME.hex(THEME.hiOf(th))}
                onChange={(e) => thColor("hi", 0, e.target.value)} />
              <span className="dim">{t("thAccHelp")}</span></p>
            <p className="bar"><span>{t("thRampFrom")}</span>
              <input type="color" id="thbase" value={THEME.hex(TH.base)} onChange={(e) => thColor("base", 0, e.target.value)} />
              <button type="button" id="thramp" onClick={thRamp}>{t("thRamp")}</button></p>
            <h3 className={H3}>{t("thTracks")}</h3>
            <Cols id="thtracks" list={th.trk} which="trk" label={(k) => (k < 3 ? `T${k + 1}` : t("thT4"))} />
          </div>
        </div>
        <p className="bar">
          {/* (an unreadable theme: Send says why, Fix next to it) */}
          <button type="button" id="thsend" className="pri" disabled={!ok} title={ok ? "" : t(dev ? "thOld" : "libWhyNoDev")}
            onClick={() => { if (!thSend() && fix.current) fix.current.focus(); }}><Ic ic="symbol_upload">{t("thSend")}</Ic></button>
          <button type="button" id="thread" disabled={!ok} title={ok ? "" : t(dev ? "thOld" : "libWhyNoDev")} onClick={thRead}><Ic ic="symbol_download">{t("thRead")}</Ic></button>
          <button type="button" id="thremove" className="warn" disabled={!ok} title={ok ? "" : t(dev ? "thOld" : "libWhyNoDev")} onClick={thRemove}><Ic ic="symbol_trash">{t("thRemove")}</Ic></button>
          <span className="dim" id="thstate">{st ? t(st) : ""}</span>
          <button type="button" id="thshare" className="ml-auto" aria-haspopup="dialog" title={t("thShareHint")}
            onClick={() => dlg.current && dlg.current.showModal()}>{t("thShare")}</button></p>
        {readable ? null : (
          <p className="bar" id="thdarkbar"><span className="bad" id="thdark">{t(pb.val && pb.acc ? "thDarkBoth" : pb.val ? "thDark" : "thDarkAcc")}</span>
            <button type="button" id="thfix" ref={fix} onClick={thFix}>{t("thFix")}</button></p>
        )}
        {dev ? null : <Help>{t("thNoDev")}</Help>}
        {dev && dev.info && !ok ? <p className="bad" id="thold">{t("thOld")}</p> : null}
      </Card>
      <dialog ref={dlg} id="thdialog" aria-labelledby="thsharetitle" onClose={() => setPaste("")}
        className="m-auto w-[min(720px,90vw)] border border-s3 bg-s1 p-5 text-fg2 backdrop:bg-black/60">
        <h2 id="thsharetitle" className="mb-2 text-big text-fg">{t("thShare")}</h2>
        <Help>{t("thShareHelp")}</Help>
        <p className="bar">
          <input id="thcode" ref={code} type="text" readOnly spellCheck="false" value={THEME.code(th)} aria-label={t("thShareLine")}
            onFocus={(e) => e.target.select()} className="min-w-[16em] flex-1 font-[ui-monospace,monospace] text-[12px]" />
          <button type="button" id="thcopy" className="pri" onClick={async () => {
            const s = THEME.code(TH.t);
            try { await navigator.clipboard.writeText(s); } catch (e) { code.current.select(); document.execCommand && document.execCommand("copy"); }
            sayK("thCopied");
          }}>{t("thCopy")}</button></p>
        <h3 className="mt-4 mb-1.5 text-fg">{t("thPasteTitle")}</h3>
        <p className="bar">
          <input id="thpaste" type="text" spellCheck="false" placeholder={t("thPasteHint")} value={paste} onChange={(e) => setPaste(e.target.value)}
            aria-label={t("thPasteTitle")} className="min-w-[16em] flex-1 font-[ui-monospace,monospace] text-[12px]"
            onKeyDown={(e) => { if (e.key === "Enter" && paste && thApply(paste)) dlg.current.close(); }} />
          <button type="button" id="thapply" disabled={!paste.trim()} title={paste.trim() ? "" : t("thWhyPaste")}
            onClick={() => { if (thApply(paste)) dlg.current.close(); }}>{t("thApply")}</button></p>
        <p className="bar mt-4 mb-0 justify-end"><button type="button" onClick={() => dlg.current.close()}>{t("thClose")}</button></p>
      </dialog>
    </>
  );
}

