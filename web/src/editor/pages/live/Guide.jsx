// SPDX-License-Identifier: GPL-3.0-only
/* ---- a page a newcomer can read: each card's line and "?", the first steps */
import { useState } from "react";
import { t } from "../../core/app.js";

/* a card of the page: its head, what it is in one line, its "?" for how to use it (LIVE pro: a page a newcomer can read) */
export function LvCard({ k, head, className = "", style, children }) {
  const [open, setOpen] = useState(false);
  const sub = (
    <p className="lvsub" key="sub">
      <span>{t("lvxSub_" + k)}</span>
      <button type="button" className="lvq" aria-expanded={open} title={t("lvxHelpShow")} aria-label={t("lvxHelpShow")} onClick={() => setOpen(!open)}>?</button>
    </p>
  );
  const help = open ? <div className="lvhelp" key="help">{String(t("lvxHelp_" + k)).split("\n").map((x, i) => <p key={i}>{x}</p>)}</div> : null;
  return (
    <div className={`lvcard ${className}`} style={style}>
      {head}{sub}{help}
      {children}
    </div>
  );
}

/* the first steps: a short path through the page, shown until "got it" (the "?" at the top brings it back) */
const seenGuide = () => { try { return localStorage.getItem("sloop-live-guide") === "1"; } catch (e) { return false; /* no storage */ } };
export function Guide() {
  const [hidden, setHidden] = useState(seenGuide);
  const steps = t("lvxGuideSteps");
  return (
    <div>
      {hidden ? null : (
        <div className="lvcard lvguide">
          <div className="lvhead"><h2>{t("lvxGuideTitle")}</h2>
            <button type="button" className="pri" onClick={() => {
              setHidden(true);
              try { localStorage.setItem("sloop-live-guide", "1"); } catch (e) { /* no storage */ }
            }}>{t("lvxGuideOk")}</button></div>
          <ol className="lvsteps">{(Array.isArray(steps) ? steps : []).map((x, i) => <li key={i}>{x}</li>)}</ol>
          <p className="dim">{t("lvxGuideFoot")}</p>
        </div>
      )}
      {hidden ? <button type="button" className="lvguidebtn" onClick={() => setHidden(false)}>{"? " + t("lvxGuideTitle")}</button> : null}
    </div>
  );
}
