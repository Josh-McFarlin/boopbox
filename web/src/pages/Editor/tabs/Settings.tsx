// SPDX-License-Identifier: GPL-3.0-only
// The Settings page: the FM-1's globals in three tabs. MIDI: each track's channel, then the other MIDI settings as
// whole sentences. Master: tempo and tuning, the master effects, the drums, the texture bed. About: what the device
// reported (firmware, engines ...).
import { useState } from "react";
import { A, t, tf, useApp } from "../core/app.ts";
import clsx from "clsx";
import { Card, ParamGroups, ParamRow, gid, layoutKnown } from "../ui/kit.tsx";
import { seg, tog } from "../ui/styles.ts";

const TABS: [id: string, name: string][] = [["midi", "setTabMidi"], ["master", "setTabMaster"], ["about", "setTabAbout"]];
const TAB_KEY = "felucca-editor-settings-tab";
const MASTER = ["GLOBAL", "MASTER", "DRUMS", "TEXTURE"];
/* the MIDI settings after the channels, in the order a musician sets them up */
const MIDI_MORE = ["OTHER", "BEND", "FX CH", "DR MAP", "REMOTE", "CLOCK"];

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

/* the channels: a line a track (the drum track's channel is CH4 on the device) */
function Midi() {
  useApp();
  const chs: [label: string, name: string, n: number][] = [["CH1", tf("midiTrackN", { n: 1 }), 1], ["CH2", tf("midiTrackN", { n: 2 }), 2],
    ["CH3", tf("midiTrackN", { n: 3 }), 3], ["CH4", t("midiDrums"), 4]];
  const ch = chs.map(([l, name, n]): [id: number, name: string, n: number] => [gid(l), name, n]).filter(([id]) => id >= 0);
  const more = MIDI_MORE.map(gid).filter((id) => id >= 0);
  if (!ch.length && !more.length) return <p className="text-dim">{t("layout")}</p>;
  return (
    <div className="max-w-[880px]">
      {ch.length ? (
        <Card title={t("midiChannels")} ic="port_usb_c" id="midichannels">
          <p className="mt-0 mb-2 text-dim">{t("midiChannelsHint")}</p>
          {ch.map(([id, name]) => (
            <ParamRow key={id} s={1} id={id} name={name} hint={null} />
          ))}
        </Card>
      ) : null}
      {more.length ? (
        <Card title={t("midiMore")} ic="symbol_cog" id="midimore">
          {more.map((id) => <ParamRow key={id} s={1} id={id} ctx="MIDI" />)}
        </Card>
      ) : null}
      <p className="text-dim">{t("midiNote")}</p>
    </div>
  );
}

export default function Settings() {
  const { dev } = useApp();
  const [tab, setTab] = useState(() => {
    try { const s = localStorage.getItem(TAB_KEY); if (s !== null && TABS.some((x) => x[0] === s)) return s; } catch (e) { /* no storage */ }
    return "midi";
  });
  if (!A.dev || !dev || !dev.info) return null;
  const known = layoutKnown(dev.info);
  return (
    <>
      <div role="tablist" aria-label={t("setTabsLabel")} className={clsx(seg, "mb-4")} id="settabs">
        {TABS.map(([id, k]) => (
          <button key={id} type="button" role="tab" data-tab={id} aria-selected={id === tab} aria-pressed={id === tab} className={tog}
            onClick={() => { setTab(id); try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* no storage */ } }}>{t(k)}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "midi" ? <Midi /> : null}
        {/* (an unknown firmware layout: every global, in id order) */}
        {tab === "master" ? (known ? <ParamGroups where="setgroups" only={MASTER} flat /> : <ParamGroups where="setgroups" flat />) : null}
        {tab === "about" ? <Card title={t("system")} ic="symbol_cog" className="max-w-[880px]"><SysInfo /></Card> : null}
      </div>
    </>
  );
}
