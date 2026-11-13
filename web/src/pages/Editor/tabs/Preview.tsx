// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// The local audio preview (?mock=1), above every page but LIVE: the firmware's own audio in the browser, playing the
// mock device. Collapsed: play / stop and a line saying what plays. Expanded: audio on / off, the volume and output
// meter, the selected track's keys (or drum pads, played with the mouse or the labeled computer keys, Space: play /
// stop), and the step sequence of every track to listen to and edit. The logic is in preview/state.js.
import { useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { DRUM_LANES, noteName } from "../lib/proto.ts";
import { A, notify, t, useApp } from "../core/app.ts";
import { KeyBoard } from "./preview/Keys.tsx";
import type { KeyHandlers } from "./preview/Keys.tsx";
import NoteDialog from "./preview/NoteDialog.tsx";
import Sequence from "./preview/Sequence.tsx";
import {
  PV, init as initPreview, noteDialogClosed, playPreview, posOf, previewError, previewNoteOff, previewNoteOn, releasePreviewKeys,
  selDrum, setMeter, setOctave, setVolume, startPreview, stopPlaying, stopPreview,
} from "./preview/state.ts";

export const init = initPreview;

type Shape = "play" | "pause" | "stop" | "audio" | "muted";
const SHAPES: Record<Shape, string> = {
  play: "M4 2v12l10-6z", pause: "M3 2h4v12H3zM9 2h4v12H9z", stop: "M3 3h10v10H3z",
  audio: "M1 6h3l4-4v12l-4-4H1zM10 5l1-1c3 2 3 6 0 8l-1-1c2-2 2-4 0-6z",
  muted: "M1 6h3l4-4v12l-4-4H1zM10 5l1-1 2 3 2-3 1 1-2 3 2 3-1 1-2-3-2 3-1-1 2-3z",
};
/* a transport button's face: a small drawing and its words */
const Face = ({ shape, children }: { shape: Shape; children?: ReactNode }) => (
  <>
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 flex-none fill-current"><path d={SHAPES[shape]} /></svg>
    <span>{children}</span>
  </>
);

/* the status line under the keys */
function statusText(ready: boolean, active: boolean): string {
  if (PV.starting) return t("previewLoading");
  if (PV.error) return PV.error;
  return t(!ready ? "previewConnect" : A.tab === "song" ? "previewSongHint" : PV.playing ? "previewPlaying" : active ? "previewReady" : "previewHint");
}
/* the collapsed panel's line: the selected track, its sound, the step playing */
function summary(ready: boolean, active: boolean): string {
  if (PV.error || PV.starting) return statusText(ready, active);
  const mock = A.mock, dev = A.dev;
  if (!mock || !dev?.dump) return t("previewConnect");
  const k = mock.state.sel, track = mock.state.tracks[k], drum = !!track.drum;
  const name = drum ? t("drum") : (dev.names[track.engine] || [])[track.preset] || t("track");
  const position = posOf(k);
  const muted = !!track.p[40] || !!(mock.state.solo && !(mock.state.solo & (1 << k)));
  let state = t(PV.playing ? "previewRunning" : "previewStopped");
  if (position >= 0) {
    const dstep = drum ? track.dstep?.[position] : undefined, step = drum ? undefined : track.step[position];
    const notes = drum ? DRUM_LANES.filter((_, lane) => (dstep?.on ?? 0) & (1 << lane)).map(([, n]) => n) :
      step?.time === 0 ? step.notes.slice(0, step.n).map(noteName) : [];
    const sound = muted ? t("previewMuted") : notes.length ? notes.join(" + ") : step?.time === 1 ? t("previewTie") : t("previewRest");
    state = `${t("previewStep")} ${position + 1}/${track.p[29]} · ${sound}`;
  }
  return `${t("track")} ${k + 1} · ${name} · ${state}`;
}

/* a key's pointer and keyboard handlers: pressed while held (the pointer captured), Enter / Space on a focused key */
const keyHandlers = (disabled: boolean) => (offset: number): KeyHandlers => ({
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    previewNoteOn(`pointer:${e.pointerId}`, offset).catch(previewError);
  },
  onPointerUp: (e: ReactPointerEvent) => previewNoteOff(`pointer:${e.pointerId}`, offset),
  onPointerCancel: (e: ReactPointerEvent) => previewNoteOff(`pointer:${e.pointerId}`, offset),
  onLostPointerCapture: (e: ReactPointerEvent) => previewNoteOff(`pointer:${e.pointerId}`, offset),
  // Focused keys/pads also play with Enter or Space; these events must not toggle the sequencer.
  onKeyDown: (e: ReactKeyboardEvent) => {
    if (!["Enter", "Space"].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat && !disabled) previewNoteOn(`button:${offset}`, offset).catch(previewError);
  },
  onKeyUp: (e: ReactKeyboardEvent) => {
    if (!["Enter", "Space"].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    previewNoteOff(`button:${offset}`, offset);
  },
  onBlur: () => previewNoteOff(`button:${offset}`, offset),
});

let layout = "";   /* the keys' layout (track, octave): another one lets go of the keys held */

export default function Preview() {
  const app = useApp();
  const dev = app.dev, mock = app.mock;
  const expanded = PV.expanded, active = !!PV.audio?.node, ready = !!dev?.dump;
  const drum = selDrum(), sel = mock?.state.sel || 0;
  const wide = drum && expanded;   /* drums, expanded: the pads and the controls side by side on a wide screen */
  const W = (cls: string): string => (wide ? cls : "");
  useEffect(() => {
    const stamp = `${sel}:${PV.octave}`;
    if (layout && layout !== stamp) releasePreviewKeys();
    layout = stamp;
  });
  useEffect(() => () => { if (PV.noteTarget) noteDialogClosed(); }, []);
  const status = statusText(ready, active), line = summary(ready, active);
  const starting = !!PV.starting;
  const keysOff = !ready || starting;
  return (
    <section id="preview" aria-label="Local audio preview" data-expanded={String(expanded)} data-instrument={drum ? "drums" : "keys"}
      className={`preview mb-4 border-b border-line py-4 [&>*]:max-w-[848px] ${W("min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,480px)_minmax(0,344px)] min-[1100px]:gap-x-6")}`}>
      <div className={`preview-toolbar items-center gap-3 max-[680px]:items-start ${expanded
        ? "flex flex-wrap justify-between" : "grid grid-cols-[auto_minmax(0,1fr)_auto] max-[680px]:grid-cols-[1fr_auto] max-[680px]:gap-2"}
        ${W("min-[1100px]:col-start-2 min-[1100px]:row-span-2 min-[1100px]:row-start-1 min-[1100px]:flex-col min-[1100px]:items-start min-[1100px]:justify-start min-[1100px]:gap-4")}`}>
        <div className="preview-transport flex flex-wrap items-center gap-2 [&>button]:inline-flex [&>button]:min-h-9 [&>button]:items-center [&>button]:justify-center [&>button]:gap-2">
          <button type="button" id="preview-enable" hidden={!expanded} aria-pressed={active} disabled={!ready || starting}
            title={t(active ? "previewDisable" : "previewEnable")} aria-label={t(active ? "previewDisable" : "previewEnable")}
            className="border border-s3 bg-transparent text-fg2 aria-pressed:border-trk aria-pressed:text-fg disabled:border-line disabled:bg-transparent disabled:text-dim"
            onClick={() => (PV.audio?.node ? stopPreview() : startPreview()).catch(previewError)}>
            <Face shape={active ? "audio" : "muted"}>{t(active ? "previewAudioOn" : "previewAudioOff")}</Face></button>
          <button type="button" id="preview-play" aria-pressed={PV.playing} disabled={!ready || starting}
            className="min-w-28 border border-trk text-trk aria-pressed:bg-trk aria-pressed:text-black disabled:border-line disabled:text-dim"
            onClick={() => playPreview().catch(previewError)}>
            <Face shape={PV.playing ? "stop" : "play"}>{t(PV.playing ? "previewPause" : "previewPlay")}</Face></button>
          <button type="button" id="preview-stop" disabled={!active} onClick={stopPlaying}>
            <Face shape="stop">{t("previewStop")}</Face></button>
        </div>
        <span id="preview-summary" hidden={expanded} title={line + (A.tab === "song" ? " · " + t("previewSongHint") : "")}
          className="preview-summary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-fg2 max-[680px]:col-span-2 max-[680px]:row-start-2">{line}</span>
        <button type="button" id="preview-disclosure" aria-expanded={expanded} title={t("previewDisclosureHint")}
          aria-controls="preview-instrument-panel preview-keys preview-footer preview-sequence preview-volume-panel"
          className="bg-transparent px-0 py-1 normal-case text-dim hover:text-fg"
          onClick={() => { PV.expanded = !PV.expanded; if (!PV.expanded) releasePreviewKeys(); notify(); }}>
          {(expanded ? "▾ " : "▸ ") + t(expanded ? "previewHide" : "previewShow")}</button>
        <div id="preview-volume-panel" hidden={!expanded}
          className={`preview-volume flex flex-wrap items-center gap-2 max-[1150px]:w-full max-[1150px]:justify-between
            ${W("min-[1100px]:flex-col min-[1100px]:items-start min-[1100px]:gap-3")}`}>
          <label className="flex items-center gap-2"><span>{t("previewVolume")}</span>
            <input id="preview-volume" type="range" min="0" max="100" value={PV.volume} aria-label="Local audio volume" className="w-28"
              onChange={(e) => setVolume(Number(e.target.value))} />
            <output id="preview-volume-value" htmlFor="preview-volume" className="min-w-[4ch] text-right text-fg">{PV.volume}%</output></label>
          <div className={`preview-output flex items-center gap-2 border-l border-line pl-3 text-dim ${W("min-[1100px]:border-0 min-[1100px]:pl-0")}`}>
            <span>{t("previewOutput")}</span>
            <meter id="preview-meter" ref={setMeter} min="0" max="1" defaultValue="0" aria-label="Local audio output level"
              className="h-2 w-16 appearance-none border-0 [background:var(--s2)] [&::-moz-meter-bar]:[background:var(--t2)] [&::-webkit-meter-bar]:h-2 [&::-webkit-meter-bar]:rounded-none
                [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:[background:var(--s2)] [&::-webkit-meter-optimum-value]:[background:var(--t2)]" />
          </div>
        </div>
      </div>
      {expanded ? (
        <>
          <div id="preview-instrument-panel"
            className={`preview-instrument mt-3 mb-2 flex flex-wrap items-center justify-between gap-3 ${W("min-[1100px]:col-start-1 min-[1100px]:row-start-1 min-[1100px]:mt-0")}`}>
            <div>
              <span id="preview-instrument" className="text-fg">{`${t("track")} ${sel + 1} · ${t(drum ? "previewDrums" : "previewKeys")}`}</span>
              <span id="preview-sound" className="ml-2 text-dim">{ready && !drum ? (dev!.names[dev!.dump!.engine] || [])[dev!.dump!.preset] || "" : ""}</span>
            </div>
            <div className="preview-instrument-actions flex items-center gap-3">
              <div id="preview-octaves" className="preview-octaves flex items-center gap-2" hidden={drum || PV.keysHidden}>
                <button type="button" id="preview-down" aria-label="Octave down" className="size-8 p-0" disabled={drum || PV.octave <= 24}
                  onClick={() => setOctave(-12)}>−</button>
                <span id="preview-octave" className="min-w-[5ch] text-center">{drum ? "16 drums" : `C${PV.octave / 12 - 1}–C${PV.octave / 12}`}</span>
                <button type="button" id="preview-up" aria-label="Octave up" className="size-8 p-0" disabled={drum || PV.octave >= 84}
                  onClick={() => setOctave(12)}>+</button>
              </div>
              <button type="button" id="preview-fold" aria-expanded={!PV.keysHidden} aria-controls="preview-keys"
                className="bg-transparent px-0 py-1 text-dim underline hover:text-fg"
                onClick={() => { releasePreviewKeys(); PV.keysHidden = !PV.keysHidden; notify(); }}>
                {t(PV.keysHidden ? (drum ? "previewShowPads" : "previewShowKeys") : (drum ? "previewHidePads" : "previewHideKeys"))}</button>
            </div>
          </div>
          {PV.keysHidden ? null : (
            <div className={W("min-[1100px]:col-start-1 min-[1100px]:row-start-2")}>
              <KeyBoard drum={drum} octave={PV.octave} pressed={PV.pressed} disabled={keysOff} handlers={keyHandlers(keysOff)} />
            </div>
          )}
          <div id="preview-footer" className={`preview-footer mt-3 flex flex-wrap items-baseline justify-between gap-3 text-dim max-[680px]:gap-1 ${W("min-[1100px]:col-span-2")}`}>
            <span id="preview-status" role="status" aria-live="polite" data-error={PV.error ? "true" : undefined} className={PV.error ? "text-red" : ""}>{status}</span>
            <span className="preview-help whitespace-nowrap"><kbd className="border border-s3 px-1 [font:inherit] text-fg2">Space</kbd> <span>{t("previewShortcut")}</span></span>
          </div>
          {mock && ready ? <Sequence /> : null}
        </>
      ) : null}
      <NoteDialog />
    </section>
  );
}
