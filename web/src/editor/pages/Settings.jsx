// SPDX-License-Identifier: GPL-3.0-only
// The Settings page: the FM-1's globals (GLOBAL, MASTER, DRUMS, MIDI, TEXTURE) and what the device reported.
import { A, t, useApp } from "../core/app.js";
import { Card, ParamGroups } from "../ui/kit.jsx";

function SysInfo() {
  const { dev } = useApp();
  if (!dev || !dev.info) return <table />;
  const i = dev.info;
  const rows = [
    ["firmware", i.version], ["sync", t(dev.watch ? "live" : "polling")], ["enginesL", i.engines.join(", ")],
    ["tracksN", i.ntrk ? String(i.ntrk) : "1"], ["stepsN", String(i.nstep)],
    ["smpSlots", dev.smp ? `${dev.smp.nslots} × ${dev.smp.slotKiB} KiB` : t("none")],
    ["userBank", dev.bank ? String(dev.bank.total) : t("none")],
  ];
  return <table><tbody>{rows.map(([k, v]) => <tr key={k}><th>{t(k)}</th><td>{v}</td></tr>)}</tbody></table>;
}

export default function Settings() {
  useApp();
  if (!A.dev) return null;
  return (
    <>
      <ParamGroups where="setgroups" />
      <Card title={t("system")} ic="symbol_cog" className="mt-4"><SysInfo /></Card>
    </>
  );
}
