// SPDX-License-Identifier: GPL-3.0-only
// The site without internet (sw.js at the site's root, made by make_site.py): opened once online, the installer, the firmware and
// the editor work offline too, still on https (Android: a downloaded file opens as content://, where Chrome refuses
// MIDI). Not in the dev server (no sw.js there) nor in the offline one-file editor (a file has no site).
import { useEffect, useState } from "react";

export function registerServiceWorker() {
  if (__OFFLINE__ || !import.meta.env.PROD) return;
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
    navigator.serviceWorker.register("../sw.js").catch(() => {});
}

/** the beforeinstallprompt event (not in TypeScript's DOM types) */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/* the browser's own "install the app" prompt (beforeinstallprompt): null until it offers one */
export function useInstallPrompt(): [boolean, () => Promise<void>] {
  const [ask, setAsk] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    if (__OFFLINE__) return undefined;
    const offer = (e: Event) => { e.preventDefault(); setAsk(e as BeforeInstallPromptEvent); };
    const done = () => setAsk(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", done); };
  }, []);
  const install = async () => {
    if (!ask) return;
    ask.prompt();
    await ask.userChoice.catch(() => {});
    setAsk(null);
  };
  return [!!ask, install];
}
