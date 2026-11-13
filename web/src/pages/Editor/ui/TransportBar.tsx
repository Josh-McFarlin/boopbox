// SPDX-License-Identifier: GPL-3.0-only
// The transport bar: fixed at the bottom of the window on every page but LIVE (which has its own), so it is always in
// the same place and never pushes the page down. With the FM-1: play, stop, the tempo and a way to LIVE. With the
// mock (?mock=1): the local audio preview, whose keys and sequence open as a drawer over the page.
import { LIVE } from "../lib/proto.ts";
import { ready, t, useApp } from "../core/app.ts";
import { showTab } from "../core/tabs.ts";
import { Preview } from "../tabs/index.ts";
import { LVG, lvOk, lvSend } from "../tabs/live/state.ts";
import { Ic } from "./kit.tsx";
import { pri } from "./styles.ts";

function DeviceTransport() {
  const { dev } = useApp();
  const ok = lvOk();
  const bpm = dev && dev.dump ? dev.dump.g[LVG().bpm] : null;
  return (
    <div className="flex items-center gap-3 py-2">
      <button type="button" className={pri} disabled={!ok} title={ok ? t("lvxTip_play") : t("lvNeeds")} onClick={() => lvSend(LIVE.PLAY, 1)}>
        {t("lvPlay")}</button>
      <button type="button" disabled={!ok} title={ok ? "" : t("lvNeeds")} onClick={() => lvSend(LIVE.PLAY, 0)}>{t("lvStop")}</button>
      {bpm != null ? <span className="text-fg2">{bpm} <span className="text-dim">{t("lvBpm")}</span></span> : null}
      <button type="button" className="ml-auto" onClick={() => showTab("live")}><Ic ic="note_eight">{t("openLive")}</Ic></button>
    </div>
  );
}

export default function TransportBar() {
  const app = useApp();
  if (!app.dev && !app.MOCK) return null;
  return (
    <div id="transport" className="fixed right-0 bottom-0 left-[200px] z-10 max-h-[70vh] overflow-y-auto border-t border-line bg-bg px-8
      shadow-[0_-8px_24px_rgb(0_0_0/0.35)] max-[999px]:hidden [&_#preview]:mb-0 [&_#preview]:border-b-0 [&_#preview]:py-2">
      {app.MOCK ? <Preview /> : ready() ? <DeviceTransport /> : null}
    </div>
  );
}
