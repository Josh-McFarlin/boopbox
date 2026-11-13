// SPDX-License-Identifier: GPL-3.0-only
// The note dialog: a step's notes (each member of a chord), picked on a piano, heard on click, applied to the step.
import type { CSSProperties, FormEvent } from 'react'

import { A, notify, t, tcol, useApp } from '../../core/app.ts'
import { previewSetStepNotes, noteName } from '../../lib/proto.ts'
import { dim, pri } from '../../ui/styles.ts'

import { NotePiano } from './Keys.tsx'
import {
  PV,
  auditionPreviewNote,
  closeDialog,
  noteDialogClosed,
  previewError,
  previewSequenceClick,
  setDialog,
  stopPreviewNoteAudition,
} from './state.ts'

async function apply(e: FormEvent): Promise<void> {
  e.preventDefault()
  const target = PV.noteTarget
  if (!target || target.device !== A.dev || target.model !== A.mock) {
    closeDialog()
    return
  }
  const notes = target.notes.slice()
  stopPreviewNoteAudition()
  PV.applying = true
  notify()
  try {
    if (
      await previewSequenceClick(
        target.track,
        target.index,
        -1,
        previewSetStepNotes(target.step, notes),
      )
    ) {
      PV.notes[target.track] = notes[0]
      closeDialog()
    }
  } finally {
    PV.applying = false
    notify()
  }
}

export default function NoteDialog() {
  useApp()
  const target = PV.noteTarget
  const k = target ? target.track : 0
  const octave = (d: number): void => {
    if (!target) return
    target.octave = Math.max(0, Math.min(120, target.octave + d))
    notify()
  }
  const pick = (pitch: number): void => {
    if (!target || target !== PV.noteTarget) return
    target.notes[target.member] = pitch
    notify()
    auditionPreviewNote(pitch).catch(previewError)
  }
  return (
    <dialog
      id="preview-note-dialog"
      ref={setDialog}
      aria-labelledby="preview-note-title"
      onClose={noteDialogClosed}
      style={{ '--c': tcol(k), '--trk': tcol(k) } as CSSProperties}
      className="border-s3 m-auto w-[520px] max-w-[calc(100vw-32px)] border bg-bg p-5 text-fg [font:inherit] backdrop:bg-bg backdrop:opacity-70"
    >
      {target ? (
        <form
          id="preview-note-form"
          onSubmit={async (e) => apply(e).catch(previewError)}
        >
          <h2
            id="preview-note-title"
            className="text-px text-c mt-0 mb-4"
          >{`${t('track')} ${k + 1} · ${t('previewStep')} ${target.index + 1}`}</h2>
          <div
            id="preview-note-fields"
            className="preview-note-chord mb-3 flex flex-wrap gap-1"
            hidden={target.notes.length < 2}
          >
            {target.notes.map((n, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={target.member === i}
                aria-label={`${t('notes')} ${i + 1}: ${noteName(n)}`}
                className="aria-pressed:bg-c px-2 py-1 aria-pressed:text-bg"
                onClick={() => {
                  target.member = i
                  target.octave = Math.floor(target.notes[i] / 12) * 12
                  notify()
                }}
              >
                {`${i + 1} · ${noteName(n)}`}
              </button>
            ))}
          </div>
          <div className="preview-note-picker-head mb-3 flex flex-wrap items-center justify-between gap-2">
            <span>
              <span>{t('notes')}</span> ·{' '}
              <output
                id="preview-note-value"
                aria-live="polite"
                className="text-c"
              >
                {noteName(target.notes[target.member])}
              </output>
            </span>
            <div className="preview-note-octave flex items-center gap-2">
              <button
                type="button"
                id="preview-note-down"
                className="h-8 w-8 p-0"
                disabled={target.octave === 0}
                aria-label={t('previewOctaveDown')}
                onClick={() => octave(-12)}
              >
                −
              </button>
              <span id="preview-note-octave">{`${noteName(target.octave)}–${noteName(Math.min(127, target.octave + 11))}`}</span>
              <button
                type="button"
                id="preview-note-up"
                className="h-8 w-8 p-0"
                disabled={target.octave === 120}
                aria-label={t('previewOctaveUp')}
                onClick={() => octave(12)}
              >
                +
              </button>
            </div>
          </div>
          <NotePiano
            octave={target.octave}
            value={target.notes[target.member]}
            onPick={pick}
            label={t('previewChooseNote')}
          />
          <label className="preview-note-listen mt-3 flex items-center gap-2 text-dim">
            <input
              type="checkbox"
              id="preview-note-listen"
              checked={PV.listen}
              onChange={(e) => {
                PV.listen = e.target.checked
                if (!PV.listen) stopPreviewNoteAudition()
                notify()
              }}
            />
            <span>{t('previewListen')}</span>
          </label>
          <p className={dim}>{t('previewNoteDialogHint')}</p>
          <div className="preview-note-actions mt-5 flex justify-end gap-2">
            <button
              type="button"
              id="preview-note-cancel"
              onClick={closeDialog}
            >
              {t('previewCancel')}
            </button>
            <button
              type="submit"
              id="preview-note-apply"
              className={pri}
              disabled={PV.applying}
            >
              {t('previewApply')}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  )
}
