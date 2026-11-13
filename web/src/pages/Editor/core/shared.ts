// SPDX-License-Identifier: GPL-3.0-only
// What several pages share: the browser's storage for the library (IndexedDB), flash results, the backup / song file
// progress, a song as one file (the Save & load page and the LIVE page's playlist), the Song page's state.
import { CMD, parse, req, songCapture, songLoad } from '../lib/proto.ts'
import type { Patch, Progress } from '../lib/proto.ts'
import { TEXT } from '../lib/text.ts'

import type { Dev } from './app.ts'
import {
  A,
  download,
  fileSlug,
  notify,
  op,
  report,
  rq,
  sayK,
  selfLoad,
  t,
  today,
} from './app.ts'

/* ------------------------------------------------------------ the library's storage --- */
/* Patches live in IndexedDB "felucca-editor": store "patches" (by id), store "meta" ("layout": the parameter keys /
   engine names the stored values are in). Without IndexedDB (some private windows) the library is kept in memory only.
   Other pages keep their own things in "meta" too (LIVE: the playlist, scenes, MIDI learn ...). */
/* a patch as the library stores it (by its id) */
export interface StoredPatch extends Patch {
  id: string
}
type StoreName = 'patches' | 'meta'
export const store = (() => {
  let dbp: Promise<IDBDatabase | null> | null = null
  const open = async () =>
    dbp ||
    (dbp = new Promise<IDBDatabase | null>((res) => {
      try {
        const r = indexedDB.open('felucca-editor', 1)
        r.onupgradeneeded = (): void => {
          r.result.createObjectStore('patches', { keyPath: 'id' })
          r.result.createObjectStore('meta')
        }
        r.onsuccess = (): void => res(r.result)
        r.onerror = r.onblocked = (): void => res(null)
      } catch {
        res(null)
      }
    }))
  const tx = async <T>(
    name: StoreName,
    mode: IDBTransactionMode,
    fn: (os: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> => {
    const db = await open()
    if (!db) return undefined
    return new Promise<T | undefined>((res, rej) => {
      const x = db.transaction(name, mode)
      let out: T | undefined
      const r = fn(x.objectStore(name))
      if (r)
        r.onsuccess = (): void => {
          out = r.result
        }
      x.oncomplete = (): void => res(out)
      x.onerror = x.onabort = (): void => rej(x.error || new Error('IndexedDB'))
    })
  }
  return {
    ok: async () => !!(await open()),
    all: async () =>
      tx<StoredPatch[]>('patches', 'readonly', (os) => os.getAll()),
    putMany: async (ps: StoredPatch[]) =>
      tx('patches', 'readwrite', (os) => {
        ps.forEach((p) => os.put(p))
      }),
    del: async (id: string) =>
      tx('patches', 'readwrite', (os) => os.delete(id)),
    /* (what a page keeps in "meta": its own shape) */
    getMeta: async <T = any>(k: string) =>
      tx<T>('meta', 'readonly', (os) => os.get(k)),
    setMeta: async (k: string, v: unknown) =>
      tx('meta', 'readwrite', (os) => os.put(v, k)),
  }
})()

/* the user bank's slot names (U01 ..) and a flash write's result code */
export const slotName = (i: number): string =>
  'U' + String(i + 1).padStart(2, '0')
export const checkRc = (rc: number): void => {
  if (rc === 3) throw new Error(t('bkStop'))
  if (rc) throw new Error(t('flashFail').replace('{rc}', String(rc)))
}

/* the sample flash's size and slots again (after a restore, a kit sent ...) */
export async function smpInfo(): Promise<void> {
  A.dev!.smp = parse[CMD.SMP_INFO](await rq(req.smpInfo()))
  notify()
}

/* ------------------------------------------------------- backup / song file progress --- */
/* A.bkProg: the fraction done of a backup, a restore or a song file (null: none running); the Save & load page's bar */
A.bkProg = null
export function bkProgress(key: string): Progress {
  A.bkProg = 0
  notify()
  return (d, n): void => {
    A.bkProg = d / n
    sayK(key, `${Math.round((100 * d) / n)} %`)
  }
}
export function bkDone(): void {
  A.bkProg = null
  notify()
}
export function bkReport(err: unknown): void {
  const e = err as { code?: string; message: string } | null | undefined
  if (e && e.code && (TEXT[A.lang] as Record<string, unknown>)[e.code])
    sayK(e.code, e.code === 'bkStop' ? '' : e.message)
  else report(e)
}

/* ------------------------------------------------------------- the Song page's state --- */
/* the song order (the device's SONG screen): read once per connection (SG.dev), edited here, sent back */
/* a block of the song order: a section and its bars, played `times` in a row (ARR.group) */
export interface SongRow {
  scene: number
  bars: number
  times: number
}
/* the Song page's state (pages/song: rows, the loop region, the selection, the song as read) */
export interface SongState {
  dev: Dev | null /* the device the order was read from */
  rows: SongRow[] | null
  loop: boolean
  bytes: Uint8Array | null /* the settings object the order is in */
  err: string
  dirty: boolean
  region?: { first: number; end: number } | null
  loopFrom?: SongRow | null
  rawFirst?: number | null
  keepEnd?: number | null
  sel?: number
  base?: string | null
}
export const SG: SongState = {
  dev: null,
  rows: null,
  loop: false,
  bytes: null,
  err: '',
  dirty: false,
}

/* --------------------------------------------------------------- a song as one file --- */
/* (2.7) a song as one file: export it; load one (also from the LIVE page's playlist) */
export async function songExport(): Promise<void> {
  const name = prompt(t('sfName'), 'SONG ' + today())
  if (name == null) return
  await op(async () => {
    try {
      const f = await songCapture(
        rq,
        A.dev!.info!,
        name.trim() || 'SONG',
        bkProgress('sfSaving'),
      )
      download(`${fileSlug(f.name) || 'song'}.sloopsong`, f)
      sayK('sfSaved', f.name)
    } catch (e) {
      bkReport(e)
    } finally {
      bkDone()
    }
  })
}
export async function songLoadUI(
  file: unknown,
  progress?: Progress,
): Promise<void> {
  const dev = A.dev!
  selfLoad()
  await songLoad(rq, file, progress)
  dev.slotUsed = [null, null, null, null]
  for (let k = 0; k < 4; k++) {
    try {
      dev.slotUsed[k] = parse[CMD.PROJECT](await rq(req.project(2, k))).used
    } catch (e) {
      if ((e as Error).message === 'closed') throw e
    }
  }
  SG.dev = null /* (the Song order page reads it again) */
  notify()
}
