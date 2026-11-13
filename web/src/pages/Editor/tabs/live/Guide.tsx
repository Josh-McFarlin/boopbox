// SPDX-License-Identifier: GPL-3.0-only
/* ---- a page a newcomer can read: each card's head (its name, one line, its "?" for how to use it), the first steps
   and the keyboard shortcuts (overlays over the page: the first steps once, both again from the "?" menu, the
   shortcuts with the ? key) */
import { useEffect, useRef, useState } from "react";
import { notify, t } from "../../core/app.ts";
import { LV } from "./state.ts";

/* a card of the page: its head (title, what it is in one line, extra controls, its "?"), the longer help over the card */
export function LvCard({ k, title, head, className = "", style, children }) {
  const [open, setOpen] = useState(false);
  const sub = t("lvxSub_" + k);
  return (
    <div className={`lvcard ${k} ${className}`} style={style}>
      <div className="lvhead">
        {title ? <h2>{title}</h2> : null}
        <span className="lvsub" title={sub}>{sub}</span>
        {head}
        <button type="button" className="lvq" aria-expanded={open} title={t("lvxHelpShow")} aria-label={t("lvxHelpShow")} onClick={() => setOpen(!open)}>?</button>
      </div>
      {open ? (
        <div className="lvhelp" role="note">
          <button type="button" className="lvhelpx" aria-label={t("lvxClose")} title={t("lvxClose")} onClick={() => setOpen(false)}>✕</button>
          {String(t("lvxHelp_" + k)).split("\n").map((x, i) => <p key={i}>{x}</p>)}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* the overlays: LV.ui.over is "guide", "keys" or null */
const GUIDE_KEY = "sloop-live-guide";
const seenGuide = () => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch (e) { return false; /* no storage */ } };
export function lvOverlay(which) { LV.ui.over = LV.ui.over === which ? null : which; LV.ui.menu = false; notify(); }
export function lvGuideFirst() { if (LV.ui.over == null && !LV.ui.guideAsked) { LV.ui.guideAsked = true; if (!seenGuide()) LV.ui.over = "guide"; } }
function guideDone() {
  try { localStorage.setItem(GUIDE_KEY, "1"); } catch (e) { /* no storage */ }
  LV.ui.over = null;
  notify();
}

function Overlay({ title, onClose, children, foot }) {
  const ref = useRef(null);
  useEffect(() => { const b = ref.current && ref.current.querySelector(".lvovok"); if (b) b.focus({ preventScroll: true }); }, []);
  return (
    <div className="lvover" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="lvovbox" role="dialog" aria-modal="true" aria-label={title}>
        <div className="lvovhead"><h2>{title}</h2>
          <button type="button" aria-label={t("lvxClose")} title={t("lvxClose")} onClick={onClose}>✕</button></div>
        {children}
        <div className="lvovfoot">{foot}</div>
      </div>
    </div>
  );
}

export function Overlays() {
  const over = LV.ui.over;
  if (over === "guide") {
    const steps = t("lvxGuideSteps");
    return (
      <Overlay title={t("lvxGuideTitle")} onClose={guideDone}
        foot={<><p className="dim">{t("lvxGuideFoot")}</p><button type="button" className="pri lvovok" onClick={guideDone}>{t("lvxGuideOk")}</button></>}>
        <ol className="lvsteps">{(Array.isArray(steps) ? steps : []).map((x, i) => <li key={i}>{x}</li>)}</ol>
      </Overlay>
    );
  }
  if (over === "keys") {
    const rows = t("lvxShortcutList");
    const close = () => { LV.ui.over = null; notify(); };
    return (
      <Overlay title={t("lvxShortcuts")} onClose={close}
        foot={<><p className="dim">{t("lvxShortcutsHint")}</p><button type="button" className="pri lvovok" onClick={close}>{t("lvxClose")}</button></>}>
        <table className="lvkeytab"><tbody>
          {(Array.isArray(rows) ? rows : []).map(([k, a]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{a}</td></tr>)}
        </tbody></table>
      </Overlay>
    );
  }
  return null;
}

/* the "?" of the top row: the first steps, the keyboard shortcuts */
export function HelpMenu() {
  const ref = useRef(null);
  const open = !!LV.ui.menu;
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) { LV.ui.menu = false; notify(); } };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <span className="lvmenuwrap" ref={ref}>
      <button type="button" className="lvq lvhelpbtn" aria-expanded={open} aria-haspopup="menu" title={t("lvxHelpMenu")} aria-label={t("lvxHelpMenu")}
        onClick={() => { LV.ui.menu = !open; notify(); }}>{"? " + t("lvxHelpBtn")}</button>
      {open ? (
        <span className="lvmenu" role="menu">
          <button type="button" role="menuitem" onClick={() => lvOverlay("guide")}>{t("lvxGuideTitle")}</button>
          <button type="button" role="menuitem" onClick={() => lvOverlay("keys")}>{t("lvxShortcuts")} <kbd>?</kbd></button>
        </span>
      ) : null}
    </span>
  );
}
