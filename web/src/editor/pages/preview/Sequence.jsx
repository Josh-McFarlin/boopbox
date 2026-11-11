// SPDX-License-Identifier: GPL-3.0-only
// The preview's step sequence: a row of 16 steps for each track (pages of 16 when it is longer), following playback; a
// click turns a step on or off, a double click opens the note dialog; a drum track shows its hits on one row and,
// opened, a row for each sound.
import { DRUM_LANES, noteName } from "../../lib/proto.js";
import { A, notify, report, t, tcol } from "../../core/app.js";
import { selectTrack } from "../../core/device.js";
import { showTab } from "../../core/tabs.js";
import { PV, noteOf, posOf, previewCellClick, previewOpenNote } from "./state.js";

const groups = new Map();   /* track -> its rows' element (hovered or focused: its page stays still) */
const ROW = "preview-seq-row grid grid-cols-[128px_minmax(0,1fr)] gap-2 mt-1 max-[680px]:grid-cols-[72px_minmax(0,1fr)] max-[680px]:gap-1";
const STEPS = "preview-seq-steps grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5";

function TrackButton({ k, name, muted, len, position }) {
  const label = `${t("track")} ${k + 1}: ${name}${muted ? " · " + t("previewMuted") : ""}`;
  return (
    <button type="button" aria-pressed={A.mock.state.sel === k} aria-label={label} title={label} onClick={() => selectTrack(k)}
      className="preview-seq-track flex h-7 w-full min-w-0 items-center gap-1 bg-transparent p-0 text-left normal-case text-c aria-pressed:bg-s2
        max-[680px]:gap-0">
      <span className="seq-no w-6 flex-none text-center">{k + 1}</span>
      <span className="seq-name min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-fg2 max-[680px]:hidden">{name}</span>
      <span className="seq-position ml-auto flex-none pr-1 text-[12px] whitespace-nowrap text-dim">{`${position < 0 ? "–" : position + 1}/${len}`}</span>
    </button>
  );
}

function PageTools({ k, len, page, children }) {
  const move = (delta) => {
    PV.follow = false;
    PV.pages[k] = Math.max(0, Math.min(Math.floor((A.mock.state.tracks[k].p[29] - 1) / 16) * 16, (PV.pages[k] || 0) + delta));
    notify();
  };
  const nav = (cls, key, text, delta, disabled) => {
    const label = `${t(key)} · ${t("track")} ${k + 1}`;
    return <button type="button" className={`${cls} h-6 w-6 p-0`} hidden={len <= 16} disabled={disabled} aria-label={label} title={label}
      onClick={() => move(delta)}>{text}</button>;
  };
  return (
    <div className="preview-seq-tools mb-1 flex flex-wrap items-center gap-1">
      {children}
      {nav("seq-prev", "previewPrevSteps", "‹", -16, page === 0)}
      <span className="preview-seq-pages text-[12px] whitespace-nowrap text-dim" hidden={len <= 16}>{`${page + 1}–${Math.min(page + 16, len)}`}</span>
      {nav("seq-next", "previewNextSteps", "›", 16, page + 16 >= len)}
    </div>
  );
}

/* one cell: what it shows and says (the old renderPreviewSequence's cell pass) */
function cellView(k, drum, lane, s, index, len) {
  const notes = !drum && s && s.time === 0 ? s.notes.slice(0, s.n).map(noteName) : [];
  const tie = !drum && s?.time === 1;
  const hits = drum && lane === -2 && s ? DRUM_LANES.filter((_, l) => s.on & (1 << l)).map(([, name]) => name) : [];
  const on = drum ? lane === -2 ? hits.length > 0 : !!(s?.on & (1 << lane)) : notes.length > 0 || tie;
  const stored = !drum && s?.n > 0 ? s.notes.slice(0, s.n).map(noteName) : [];
  const text = drum ? lane === -2 ? hits.length > 1 ? String(hits.length) : on ? "●" : "" : on ? "●" : ""
    : tie ? "→" : stored.length ? stored[0] + (stored.length > 1 ? "+" + (stored.length - 1) : "") : "+";
  const content = drum ? lane === -2 ? hits.join(", ") || t("previewRest") : DRUM_LANES[lane][1] : tie ? t("previewTie")
    : on ? notes.join(", ") : s?.n > 0 ? s.notes.slice(0, s.n).map(noteName).join(", ") : noteName(noteOf(k));
  const description = `${t(lane === -2 ? "previewShowDrumGrid" : !drum && s?.n > 0 ? on ? "previewDeactivate" : "previewReactivate" : on ? "previewRemove" : "previewAdd")} · ${content} · ${t("track")} ${k + 1} · ${t("previewStep")} ${index + 1}`;
  return { on, text, description, unused: index >= len };
}

function Cells({ k, drum, lane = -1, source, page, len, position }) {
  return (
    <div className={`${STEPS} self-center`}>
      {Array.from({ length: 16 }, (_, i) => {
        const index = page + i, v = cellView(k, drum, lane, source[i], index, len), cur = index === position;
        const look = v.on && cur ? "bg-c text-black border-c" : v.on ? "bg-s2 text-c border-s3" : cur ? "bg-s1 text-c border-c"
          : `bg-s1 text-dim border-line ${i % 4 === 0 ? "border-l-s3" : ""}`;
        const key = `${k}:${lane}:${i}`;
        return (
          <button key={i} type="button" data-track={k} data-lane={lane} data-step={index} disabled={v.unused}
            aria-pressed={lane !== -2 ? v.on : undefined} aria-controls={lane === -2 ? `preview-drum-details-${k}` : undefined}
            aria-expanded={lane === -2 ? PV.drumOpen.has(k) : undefined}
            aria-label={v.description} title={v.description + (!drum ? " · " + t("previewDoubleClick") : "")}
            className={`preview-seq-cell flex h-7 items-center justify-center overflow-hidden border p-0 hover:enabled:border-c hover:enabled:bg-s3
              focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-c ${look} ${v.unused ? "invisible" : ""}
              ${v.on ? "on" : ""} ${cur ? "is-current" : ""} ${lane === -2 ? "seq-drum-brief" : ""}`}
            onClick={(e) => previewCellClick(e, key, k, lane, index)}
            onDoubleClick={!drum ? () => previewOpenNote(key, k, index).catch(report) : undefined}>
            <span className="preview-seq-note max-[680px]:hidden" aria-hidden="true">{v.text}</span>
            <span className={`seq-hit h-3 w-1 bg-current ${v.on ? "hidden max-[680px]:block" : "hidden"}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function TrackRows({ k }) {
  const st = A.mock.state, track = st.tracks[k], dev = A.dev, drum = !!track.drum;
  const len = Math.max(1, Math.min(64, track.p[29] || 16));
  const position = posOf(k);
  // Keep the page still under the pointer or keyboard focus while editing.
  const el = groups.get(k);
  if (PV.follow && position >= 0 && !(el && el.matches(":hover, :focus-within"))) PV.pages[k] = Math.floor(position / 16) * 16;
  const page = PV.pages[k] = Math.min(PV.pages[k] || 0, Math.floor((len - 1) / 16) * 16);
  const name = drum ? t("drum") : (dev.names[track.engine] || [])[track.preset] || t("track");
  const muted = !!track.p[40] || !!(st.solo && !(st.solo & (1 << k)));
  const source = (drum ? track.dstep : track.step).slice(page, page + 16);
  const setRef = (e) => { if (e) groups.set(k, e); else groups.delete(k); };
  const cells = (lane) => <Cells k={k} drum={drum} lane={lane} source={source} page={page} len={len} position={position} />;
  const mutedCls = muted ? "is-muted [&_.preview-seq-steps]:opacity-40" : "";
  if (!drum) {
    const label = `${t("previewNewNote")} · ${t("track")} ${k + 1}`;
    return (
      <div ref={setRef} className={`${ROW} ${mutedCls}`} data-seq-track={k} style={{ "--c": tcol(k) }}>
        <div className="preview-seq-label min-w-0">
          <TrackButton k={k} name={name} muted={muted} len={len} position={position} />
          <PageTools k={k} len={len} page={page}>
            <select className="seq-pitch h-6 w-16 min-w-0 px-1 py-0 max-[680px]:w-[72px]" value={String(noteOf(k))} aria-label={label} title={label}
              onChange={(e) => { PV.notes[k] = +e.target.value; notify(); }}>
              {Array.from({ length: 128 }, (_, n) => <option key={n} value={n}>{noteName(n)}</option>)}
            </select>
          </PageTools>
        </div>
        {cells(-1)}
      </div>
    );
  }
  const open = PV.drumOpen.has(k), all = PV.allDrums.has(k);
  const active = track.dstep.slice(0, len).reduce((mask, d) => mask | d.on, 0);
  const toggle = (set, on) => { if (on) set.delete(k); else set.add(k); notify(); };
  return (
    <div ref={setRef} className={`preview-seq-drums mt-2 border-t border-line pt-1 ${mutedCls}`} data-seq-track={k} style={{ "--c": tcol(k) }}>
      <div className={ROW}>
        <div className="preview-seq-label min-w-0">
          <TrackButton k={k} name={name} muted={muted} len={len} position={position} />
          <PageTools k={k} len={len} page={page} />
          <button type="button" aria-controls={`preview-drum-details-${k}`} aria-expanded={open} onClick={() => toggle(PV.drumOpen, open)}
            className="seq-drum-toggle max-w-full bg-transparent p-0 text-left whitespace-normal normal-case text-c hover:enabled:bg-transparent
              hover:enabled:text-fg focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-c">
            {(open ? "▾ " : "▸ ") + t(open ? "previewHideDrumGrid" : "previewShowDrumGrid")}</button>
        </div>
        {cells(-2)}
      </div>
      <div id={`preview-drum-details-${k}`} hidden={!open}>
        <div className="preview-seq-drumhead flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="preview-seq-legend seq-drum-help mt-1.5 mb-0 text-dim">{t("previewDrumHint")}</p>
          <button type="button" className="seq-all-drums ml-auto bg-transparent p-0 text-dim underline" aria-expanded={all}
            onClick={() => toggle(PV.allDrums, all)}>{t(all ? "previewFewerDrums" : "previewAllDrums")}</button>
        </div>
        {DRUM_LANES.map((l, lane) => (
          <div key={lane} className={ROW} data-drum-lane={lane} hidden={!(all || [0, 2, 3, 4, 5].includes(lane) || (active & (1 << lane)))}>
            <span className="preview-seq-lane self-center overflow-hidden pl-6 text-ellipsis whitespace-nowrap text-fg2 max-[680px]:pl-0
              max-[680px]:text-[12px]">{l[1]}</span>
            {cells(lane)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sequence() {
  const st = A.mock.state;
  return (
    <div id="preview-sequence" className="preview-sequence col-span-2 mt-3 border-t border-line pt-2">
      <div className="preview-seq-head mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="mr-auto">{t("previewSequence")}</span>
        <label className="text-dim"><input type="checkbox" id="preview-follow" checked={PV.follow}
          onChange={(e) => { PV.follow = e.target.checked; notify(); }} /> <span>{t("previewFollow")}</span></label>
        <button type="button" id="preview-edit" className="bg-transparent p-0 text-dim underline hover:text-fg" onClick={() => showTab("sequencer")}>
          {t("previewEdit")}</button>
      </div>
      <div id="preview-sequence-rows">
        <div className={`${ROW} preview-seq-numbers text-center text-[12px] text-dim`}>
          <span />
          <div className={STEPS}>{Array.from({ length: 16 }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
        </div>
        {st.tracks.map((_, k) => <TrackRows key={k} k={k} />)}
      </div>
      <p className="preview-seq-legend mt-1.5 mb-0 text-dim">{t("previewSequenceHint")}</p>
    </div>
  );
}
