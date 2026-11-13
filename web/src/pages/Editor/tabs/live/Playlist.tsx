// SPDX-License-Identifier: GPL-3.0-only
/* ---- (2.7) the playlist: song files (Save & load → Export this song), loaded one after the other. A song loads
   with the FM-1 stopped (a few seconds of flash), then plays if "play when loaded" is on. The list is kept in this
   browser (IndexedDB), and saved / opened as one file to take to a gig */
import { clsx } from 'clsx'

import {
  A,
  download,
  notify,
  pickFile,
  sayK,
  sleep,
  t,
  today,
  useApp,
} from '../../core/app.ts'
import { bkReport, songLoadUI, store } from '../../core/shared.ts'
import { LIVE, LVX, songObjects } from '../../lib/proto.ts'
import type { Scene } from '../../lib/proto.ts'
import { bar, dim, pri, tog } from '../../ui/styles.ts'

import { LvCard } from './Guide.tsx'
import { LVS, lvxSave } from './pro.ts'
import type { PlSong } from './state.ts'
import { LV, lvAllOff, lvGlobal, lvOk, lvReadTracks, lvSend } from './state.ts'
import { adv, blink, dis, hov } from './styles.ts'

const PLF = { FORMAT: 'sloop-playlist', VERSION: 1 }
async function plStore(): Promise<void> {
  try {
    await store.setMeta('playlist', {
      songs: LV.pl.songs,
      cur: LV.pl.cur,
      auto: LV.pl.auto,
    })
  } catch (e) {
    console.warn(e)
  }
}
export async function plRestore(): Promise<void> {
  try {
    const v = await store.getMeta('playlist')
    if (v && Array.isArray(v.songs))
      Object.assign(LV.pl, {
        songs: v.songs.filter((f: PlSong) => {
          try {
            songObjects(f)
            return true
          } catch {
            return false
          }
        }),
        cur: v.cur ?? -1,
        auto: v.auto !== false,
      })
  } catch {
    /* no storage: the list lives in this page only */
  }
  notify()
}
async function plAddFiles(files: File[]): Promise<void> {
  let bad = 0
  for (const f of files) {
    try {
      const obj = JSON.parse(await f.text())
      if (obj && obj.format === PLF.FORMAT && Array.isArray(obj.songs)) {
        for (const x of obj.songs) {
          songObjects(x)
          LV.pl.songs.push(x)
        }
        if (
          Array.isArray(obj.scenes) &&
          obj.scenes.some(Boolean) &&
          confirm(t('lvxSetScenes'))
        ) {
          /* LIVE pro: the set's scenes */
          obj.scenes
            .slice(0, LVX.NSCENE)
            .forEach((x: Scene | null, k: number) => {
              LVS.scenes[k] = x && x.v === 1 ? x : null
            })
          LVS.names = Array.isArray(obj.sceneNames)
            ? obj.sceneNames.slice(0, LVX.NSCENE)
            : []
          if (obj.midiMap && typeof obj.midiMap === 'object')
            LVS.map = obj.midiMap
          lvxSave()
        }
      } else {
        songObjects(obj)
        if (!obj.name) obj.name = f.name.replace(/\.(sloopsong|json)$/i, '')
        LV.pl.songs.push(obj)
      }
    } catch {
      bad++
    }
  }
  if (bad) sayK('songBadFile', ` (${bad})`)
  plStore()
  notify()
}
async function lvSongGo(i: number): Promise<void> {
  const pl = LV.pl,
    f = pl.songs[i]
  if (!f || pl.loading || !A.dev || !A.dev.dump) return
  pl.loading = true
  pl.at = i
  pl.pct = 0
  notify()
  try {
    if (LV.s && LV.s.playing) {
      await lvSend(LIVE.PLAY, 0)
      await sleep(150)
    }
    lvAllOff()
    A.busy++ /* (the editor's own polling waits) */
    try {
      await songLoadUI(f, (d, n) => {
        pl.pct = Math.round((100 * d) / n)
        notify()
      })
    } finally {
      A.busy--
    }
    pl.cur = i
    LV.stale = true
    plStore()
    await lvReadTracks(true)
    if (f.live && f.live.bpm)
      lvGlobal(
        LVX.BPM,
        f.live.bpm,
        true,
      ) /* (LIVE pro: the setlist's tempo for this song) */
    sayK('sfLoaded', f.name || '')
    if (pl.auto && lvOk()) await lvSend(LIVE.PLAY, 1)
  } catch (e) {
    bkReport(e)
  } finally {
    pl.loading = false
    pl.at = -1
    notify()
  }
}
export const lvSongNext = (): void => {
  const n = LV.pl.songs.length
  if (n) lvSongGo(LV.pl.cur + 1 < n ? LV.pl.cur + 1 : 0)
}
/* LIVE pro: a song's tempo (set when it loads) and its cue (a note for the stage), kept in the setlist */
function lvxSongEdit(i: number): void {
  const f = LV.pl.songs[i]
  if (!f) return
  const bpm = prompt(
    t('lvxSongBpm'),
    f.live && f.live.bpm ? String(f.live.bpm) : '',
  )
  if (bpm == null) return
  const note = prompt(
    t('lvxSongNote'),
    f.live && f.live.note ? f.live.note : '',
  )
  if (note == null) return
  const b = Math.round(+bpm)
  f.live = {
    bpm: b >= 40 && b <= 240 ? b : null,
    note: note.trim().slice(0, 120),
  }
  plStore()
  notify()
}

export default function Playlist() {
  useApp()
  const pl = LV.pl
  const move = (i: number, d: number): void => {
    const j = i + d
    if (j < 0 || j >= pl.songs.length || pl.loading) return
    ;[pl.songs[i], pl.songs[j]] = [pl.songs[j], pl.songs[i]]
    if (pl.cur === i) pl.cur = j
    else if (pl.cur === j) pl.cur = i
    plStore()
    notify()
  }
  /* the cue: the song playing and its note, then the next one */
  const cur = pl.songs[pl.cur],
    nx = pl.songs.length
      ? pl.songs[pl.cur + 1 < pl.songs.length ? pl.cur + 1 : 0]
      : null
  return (
    <LvCard
      k="playlist"
      className={adv}
      title={t('plTitle')}
      head={
        <button
          type="button"
          className={pri}
          data-lvm="pl:next"
          disabled={!pl.songs.length || pl.loading}
          title={pl.songs.length ? undefined : t('plEmpty')}
          onClick={lvSongNext}
        >
          {t('plNext')} ▶
        </button>
      }
    >
      {cur || nx ? (
        <div className="mb-2 [&>p]:mx-0 [&>p]:mt-0 [&>p]:mb-0.5">
          {cur ? (
            <p>
              <b className="text-t2 text-[20px] font-normal">
                {cur.name || 'SONG'}
              </b>
              <span>
                {cur.live && cur.live.note ? ' — ' + cur.live.note : ''}
              </span>
            </p>
          ) : null}
          {nx && nx !== cur ? (
            <p className={dim}>
              <span>{t('lvxNext') + ' '}</span>
              <b>{nx.name || 'SONG'}</b>
              <span>{nx.live && nx.live.note ? ' — ' + nx.live.note : ''}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-1 p-0 [counter-reset:pl]">
        {pl.songs.map((f, i) => {
          const isCur = i === pl.cur,
            at = pl.loading && pl.at === i
          const secs = (f.objects || [])
            .filter((o) => o.id >= 2)
            .map((o) => 'ABCD'[o.id - 2])
            .join('')
          return (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 [counter-increment:pl]"
            >
              <button
                type="button"
                className={clsx(
                  'grid grid-cols-[2.5ch_minmax(0,1fr)_auto] items-center gap-2 border bg-bg px-2 py-1 text-left text-fg normal-case',
                  'before:text-dim before:content-[counter(pl)]',
                  hov,
                  dis,
                  isCur
                    ? 'border-t2 shadow-[inset_4px_0_var(--t2)]'
                    : 'border-s3',
                  at && blink,
                )}
                disabled={pl.loading}
                onClick={async () => lvSongGo(i)}
                title={t('plLoad')}
              >
                <b className="overflow-hidden font-normal text-ellipsis whitespace-nowrap">
                  {f.name || 'SONG'}
                </b>
                <small className={dim}>
                  {at
                    ? `${t('sfLoading')}${pl.pct} %`
                    : secs + (f.live && f.live.bpm ? ` · ${f.live.bpm}` : '')}
                </small>
              </button>
              <span className="flex gap-0.5 [&>button]:px-2 [&>button]:py-1">
                <button
                  type="button"
                  title={t('lvxSongEdit')}
                  aria-label={t('lvxSongEdit')}
                  disabled={pl.loading}
                  onClick={() => lvxSongEdit(i)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  title={t('plUp')}
                  aria-label={t('plUp')}
                  disabled={!i || pl.loading}
                  onClick={() => move(i, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title={t('plDown')}
                  aria-label={t('plDown')}
                  disabled={i === pl.songs.length - 1 || pl.loading}
                  onClick={() => move(i, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  title={t('plRemove')}
                  aria-label={t('plRemove')}
                  disabled={pl.loading}
                  onClick={() => {
                    pl.songs.splice(i, 1)
                    if (pl.cur === i) pl.cur = -1
                    else if (pl.cur > i) pl.cur--
                    plStore()
                    notify()
                  }}
                >
                  ✕
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {pl.songs.length ? null : <p className={dim}>{t('plEmpty')}</p>}
      <p className={bar}>
        <button
          type="button"
          onClick={async () => {
            const fs = await pickFile(
              '.sloopsong,.sloopset,.json,application/json',
              true,
            )
            if (fs && fs.length) plAddFiles(fs)
          }}
        >
          {t('plAdd')}
        </button>
        <button
          type="button"
          onClick={() =>
            download(`boopbox-playlist-${today()}.sloopset`, {
              format: PLF.FORMAT,
              version: PLF.VERSION,
              songs: LV.pl.songs,
              scenes: LVS.scenes,
              sceneNames: LVS.names,
              midiMap: LVS.map,
            })
          }
        >
          {t('plSave')}
        </button>
        <button
          type="button"
          className={tog}
          aria-pressed={pl.auto}
          onClick={() => {
            LV.pl.auto = !LV.pl.auto
            plStore()
            notify()
          }}
        >
          {t('plAuto')}
        </button>
      </p>
    </LvCard>
  )
}
