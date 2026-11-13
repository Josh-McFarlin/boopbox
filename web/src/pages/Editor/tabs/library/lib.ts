// SPDX-License-Identifier: GPL-3.0-only
// The library: the patches kept in this browser (IndexedDB, core/shared.js store) and the FM-1's user preset bank
// (protocol v2: UP_LIST / UP_GET / UP_PUT ..., lib/proto.js bank). The page (Library.jsx) renders from LB; whatever
// changes it calls notify().
import type { Dev } from '../../core/app.ts'
import {
  A,
  download,
  fileSlug,
  gEng,
  isDrum,
  notify,
  pickFile,
  readyDev,
  report,
  rq,
  rqf,
  sayK,
  selfLoad,
  t,
  today,
} from '../../core/app.ts'
import { afterSoundChange } from '../../core/device.ts'
import { H } from '../../core/hooks.ts'
import { checkRc, slotName, store } from '../../core/shared.ts'
import type { StoredPatch } from '../../core/shared.ts'
import {
  UP,
  auditionPatch,
  bank,
  capturePatch,
  cleanPatch,
  libraryFile,
  parse,
  CMD,
  patternFromSteps,
  readLibraryFile,
  remapParams,
  req,
  sameKeys,
  upName,
} from '../../lib/proto.ts'
import type { LibCtx, Patch, PatchSource } from '../../lib/proto.ts'

/* the library's state: the patches (cleanPatch + id), the layout they are stored in, what is selected, the filters */
/* the layout the stored values are in: the parameter keys, the engines' names, the first engine parameter */
export interface LibMeta {
  keys: string[] | null
  engines: string[] | null
  pe0: number | null
}
/* how the list is sorted */
export type LibSort = 'name' | 'engine' | 'created' | 'modified'
export interface LibState {
  lib: StoredPatch[]
  meta: LibMeta
  persistent: boolean
  sel: string | null
  bankSel: number | null
  busy: boolean
  q: string
  eng: string
  tag: string
  sort: string
}
export const LB: LibState = {
  lib: [],
  meta: { keys: null, engines: null, pe0: null },
  persistent: false,
  sel: null,
  bankSel: null,
  busy: false /* a library / bank operation is running */,
  q: '',
  eng: '',
  tag: '',
  sort: 'modified',
}
const newId = (): string =>
  self.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
const nowIso = () => new Date().toISOString()
const libCtx = (): LibCtx => {
  const dev = A.dev
  return dev && dev.keys && dev.info
    ? {
        keys: dev.keys,
        engines: dev.info.engines,
        firmware: dev.info.version,
        pe0: dev.info.pe0,
      }
    : {
        keys: LB.meta.keys,
        engines: LB.meta.engines,
        firmware: '',
        pe0: LB.meta.pe0,
      }
}
export const selPatch = (): StoredPatch | undefined =>
  LB.lib.find((p) => p.id === LB.sel)

async function libInit(): Promise<void> {
  try {
    LB.persistent = await store.ok()
    if (LB.persistent) {
      LB.lib = ((await store.all()) || []).filter((p) => p && p.id)
      LB.meta = (await store.getMeta<LibMeta>('layout')) || LB.meta
    }
  } catch (e) {
    console.warn(e)
    LB.persistent = false
  }
  notify()
}
async function libWrite(ps: StoredPatch[]): Promise<void> {
  try {
    await store.putMany(ps)
  } catch (e) {
    console.warn(e)
    sayK('error', 'IndexedDB: ' + (e as Error).message)
  }
}
export async function libAdd(patches: PatchSource[]): Promise<StoredPatch[]> {
  const add: StoredPatch[] = patches.map((p) => ({
    ...cleanPatch(p),
    id: newId(),
  }))
  LB.lib.push(...add)
  if (add.length) LB.sel = add[add.length - 1].id
  await libWrite(add)
  notify()
  return add
}
async function libUpdate(p: StoredPatch): Promise<void> {
  p.modified = nowIso()
  await libWrite([p])
  notify()
}
/* the device's parameter layout becomes the library's; patches stored with another layout are mapped by key */
async function libAdopt(d: Dev): Promise<void> {
  const keys = d.keys,
    engines = d.info!.engines,
    changed: StoredPatch[] = [],
    m = LB.meta
  if (
    (m.keys && !sameKeys(m.keys, keys)) ||
    (m.engines && !sameKeys(m.engines, engines))
  ) {
    for (const p of LB.lib) {
      const name = p.engineName || (m.engines || [])[p.engine]
      const e = name ? engines.indexOf(name) : p.engine
      p.p = remapParams(p.p, m.keys, keys)
      if (e >= 0) {
        p.engine = e
        p.engineName = engines[e]
      }
      changed.push(p)
    }
  }
  LB.meta = { keys, engines, pe0: d.info!.pe0 }
  if (changed.length) await libWrite(changed)
  try {
    await store.setMeta('layout', LB.meta)
  } catch (e) {
    console.warn(e)
  }
  notify()
}
const engineOk = (p: Patch): boolean =>
  !!A.dev &&
  p.engine < A.dev.info!.nengines &&
  (!p.engineName || A.dev.info!.engines[p.engine] === p.engineName)
/* a full parameter set for UP_PUT: unknown values get the DESC default where it is known, else 0 */
function fullParams(p: Patch): number[] {
  const dev = A.dev!,
    info = dev.info!,
    out: number[] = []
  for (let i = 0; i < info.pcount; i++) {
    let v = p.p[i]
    if (v == null) {
      const d = dev.pdesc[i]
      v = d && (i < info.pe0 || p.engine === dev.dump!.engine) ? d.def : 0
    }
    out.push(v)
  }
  return out
}

/* ------------------------------------------------------------- the list's view --- */
export const libEngines = (): string[] => {
  const dev = A.dev
  return [
    ...new Set([
      ...(dev && dev.info ? dev.info.engines : LB.meta.engines || []),
      ...LB.lib.map((p) => p.engineName).filter(Boolean),
    ]),
  ]
}
export const libTags = (): string[] =>
  [...new Set(LB.lib.flatMap((p) => p.tags))].sort()
export function libView(): StoredPatch[] {
  /* (a filter whose choice went away shows everything again, as the old select did) */
  if (LB.eng && !libEngines().includes(LB.eng)) LB.eng = ''
  if (LB.tag && !libTags().includes(LB.tag)) LB.tag = ''
  const q = LB.q.trim().toLowerCase(),
    fe = LB.eng,
    ft = LB.tag
  type Cmp = (a: StoredPatch, b: StoredPatch) => number
  const by =
    (
      {
        name: (a, b) => a.name.localeCompare(b.name),
        engine: (a, b) =>
          (a.engineName || '').localeCompare(b.engineName || '') ||
          a.name.localeCompare(b.name),
        created: (a, b) => b.created.localeCompare(a.created),
        modified: (a, b) => b.modified.localeCompare(a.modified),
      } as Record<string, Cmp | undefined>
    )[LB.sort] ||
    ((a: StoredPatch, b: StoredPatch) => b.modified.localeCompare(a.modified))
  if (LB.sel && !LB.lib.some((p) => p.id === LB.sel)) LB.sel = null
  return LB.lib
    .filter(
      (p) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.tags.some((x) => x.toLowerCase().includes(q))) &&
        (!fe || p.engineName === fe) &&
        (!ft || p.tags.includes(ft)),
    )
    .sort(by)
}

/* library operations that talk to the device: one at a time, buttons off meanwhile */
async function libOp(fn: () => Promise<void>): Promise<void> {
  if (!A.dev || LB.busy) return
  LB.busy = true
  A.busy++
  notify()
  try {
    await fn()
  } catch (err) {
    report(err)
  } finally {
    A.busy--
    LB.busy = false
    notify()
  }
}
async function refreshSlot(slot: number): Promise<void> {
  const r = parse[CMD.UP_LIST](await rq(req.upList(slot, 1)))
  if (A.dev && A.dev.bank && r.slots[0]) A.dev.bank.slots[slot] = r.slots[0]
}

/* ---------------------------------------------------------------- the patches --- */
export function libAudition(id: string): void {
  const p = LB.lib.find((x) => x.id === id)
  if (!p || !A.dev || LB.busy) return
  if (isDrum()) {
    sayK('drumNoSound')
    return
  }
  libOp(async () => {
    if (!engineOk(p))
      throw new Error(t('badEngine') + (p.engineName || p.engine))
    sayK('auditioning', p.name)
    selfLoad()
    const r = await auditionPatch(rqf, A.dev!.info!, p, {
      gEng: gEng(),
      progress: (i, n) => {
        if (i % 8 === 0) sayK('auditioning', `${p.name} ${i}/${n}`)
      },
    })
    await afterSoundChange()
    sayK(r.wrote ? 'auditionedPat' : 'auditioned', p.name)
  })
}

export const libSave = async (): Promise<void> =>
  libOp(async () => {
    const dev = readyDev()
    if (isDrum()) {
      sayK('drumNoSound')
      return
    }
    const def = upName(
      (dev.names[dev.dump.engine] || [])[dev.dump.preset] ||
        dev.info.engines[dev.dump.engine],
    )
    const name = prompt(t('promptName'), def)
    if (name == null) return
    const { patch } = await capturePatch(rqf, dev.info, name.trim() || def)
    await libAdd([patch])
    sayK('savedLib', patch.name)
  })

/* factory preset -> library: PRESET, then DUMP + steps; its pattern only if it brought one (the device
   loads a preset's pattern into an empty sequencer, or over one that is still an untouched preset pattern).
   The preset: the one given (the Sound page's choice), else the Sound page's #preset select, else the current one. */
export const factoryToLib = async (
  preset?: number | string | null,
): Promise<void> =>
  libOp(async () => {
    const dev = readyDev()
    const sel =
      typeof document !== 'undefined'
        ? (document.getElementById('preset') as HTMLSelectElement | null)
        : null
    const e = dev.dump.engine
    const pi =
      preset != null && preset !== ''
        ? +preset
        : sel && sel.value !== ''
          ? +sel.value
          : dev.dump.preset
    const name = (dev.names[e] || [])[pi] || 'PRESET'
    const before =
      dev.steps.length >= UP.PAT ? patternFromSteps(dev.steps) : null
    const wasEmpty = dev.steps.length && dev.steps.every((s) => !s || !s.n)
    selfLoad()
    await rq(req.preset(e, pi))
    const { patch } = await capturePatch(rqf, dev.info, name)
    const brought =
      wasEmpty ||
      !before ||
      JSON.stringify(before) !==
        JSON.stringify(patch.pattern || patternFromSteps([]))
    if (!brought) patch.pattern = null
    patch.tags = ['factory']
    await libAdd([patch])
    await afterSoundChange()
    sayK('copiedLib', `${dev.info.engines[e]} ${name}`)
  })

export function libPut(id: string | null, slot: number | null): void {
  const p = LB.lib.find((x) => x.id === id),
    dev = A.dev
  if (!p || !dev || !dev.bank || slot == null || LB.busy) return
  const s = dev.bank.slots[slot]
  if (!engineOk(p)) {
    sayK('badEngine', p.engineName || p.engine)
    return
  }
  if (
    s.used &&
    !confirm(
      t('confirmOverwrite')
        .replace('{n}', slotName(slot))
        .replace('{name}', s.name),
    )
  )
    return
  libOp(async () => {
    checkRc(
      await bank.put(rqf, slot, {
        ...p,
        name: upName(p.name),
        p: fullParams(p),
      }),
    )
    await refreshSlot(slot)
    sayK('putDone', `${slotName(slot)} ${upName(p.name)}`)
  })
}

export function libRename(): void {
  const p = selPatch()
  if (!p) return
  const v = prompt(t('promptName'), p.name)
  if (v == null || !v.trim()) return
  p.name = v.trim().slice(0, 32)
  libUpdate(p)
}
export function libSetTags(): void {
  const p = selPatch()
  if (!p) return
  const v = prompt(t('promptTags'), p.tags.join(', '))
  if (v == null) return
  p.tags = [
    ...new Set(
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ]
  libUpdate(p)
}
export function libDuplicate(): void {
  const p = selPatch()
  if (p)
    libAdd([
      {
        ...p,
        name: (p.name + ' 2').slice(0, 32),
        created: nowIso(),
        modified: nowIso(),
      },
    ])
}
export async function libDelete(): Promise<void> {
  const p = selPatch()
  if (!p || !confirm(t('confirmDelete').replace('{name}', p.name))) return
  LB.lib = LB.lib.filter((x) => x !== p)
  LB.sel = null
  try {
    await store.del(p.id)
  } catch (e) {
    console.warn(e)
  }
  notify()
}

/* ------------------------------------------------------------ files --- */
export function libExportOne(): void {
  const p = selPatch()
  if (p)
    download(
      `felucca-patch-${fileSlug(p.name)}.json`,
      libraryFile('patch', [p], libCtx()),
    )
}
export const libExportAll = (): void =>
  download(
    `felucca-library-${today()}.json`,
    libraryFile('library', LB.lib, libCtx()),
  )
export async function libImport(): Promise<void> {
  const files = await pickFile('.json,application/json', true)
  if (!files || !files.length) return
  let n = 0,
    skipped = 0
  for (const f of files) {
    try {
      const obj = JSON.parse(await f.text()) as {
        engines?: unknown
        pE0?: number
        kind?: string
      }
      const ctx = libCtx()
      const r = readLibraryFile(obj, ctx)
      if (!ctx.keys && r.keys) {
        /* no layout yet: the file's becomes the library's */
        LB.meta = {
          keys: r.keys,
          engines: Array.isArray(obj.engines)
            ? (obj.engines as string[])
            : null,
          pe0: obj.pE0 ?? null,
        }
        try {
          await store.setMeta('layout', LB.meta)
        } catch (e) {
          console.warn(e)
        }
      }
      if (obj.kind === 'bank')
        r.patches.forEach((p) => {
          if (!p.tags.includes('bank')) p.tags.push('bank')
        })
      await libAdd(r.patches)
      n += r.patches.length
      skipped += r.skipped
    } catch (e) {
      sayK('badfile', `${f.name}: ${(e as Error).message}`)
      return
    }
  }
  sayK(
    'imported',
    n +
      (skipped ? t('skippedN').replace('{n}', String(skipped)) : t('patchesN')),
  )
}

/* ------------------------------------------------------------ the device bank --- */
export function bankLoad(slot: number | null): void {
  const dev = A.dev
  if (!dev || !dev.bank || slot == null || LB.busy) return
  if (isDrum()) {
    sayK('drumNoSound')
    return
  }
  const s = dev.bank.slots[slot]
  libOp(async () => {
    selfLoad()
    const rc = await bank.load(rqf, slot)
    if (rc) {
      sayK('emptySlot', slotName(slot))
      return
    }
    await afterSoundChange()
    sayK('loadedUser', `${slotName(slot)} ${s.name}`)
  })
}
export function bankStore(): void {
  const slot = LB.bankSel,
    dev = A.dev
  if (!dev || !dev.bank || slot == null) return
  if (isDrum()) {
    sayK('drumNoSound')
    return
  }
  const s = dev.bank.slots[slot]
  const name = prompt(t('promptNameAuto'), s.used ? s.name : '')
  if (name == null) return
  if (
    s.used &&
    !confirm(
      t('confirmOverwrite')
        .replace('{n}', slotName(slot))
        .replace('{name}', s.name),
    )
  )
    return
  libOp(async () => {
    checkRc(await bank.store(rqf, slot, name.trim()))
    await refreshSlot(slot)
    sayK('storedSlot', `${slotName(slot)} ${A.dev!.bank!.slots[slot].name}`)
  })
}
export function bankGet(slot: number | null): void {
  const dev = A.dev
  if (!dev || !dev.info || !dev.bank || slot == null || LB.busy) return
  const info = dev.info
  libOp(async () => {
    const u = await bank.get(rqf, info, slot)
    if (!u.used) {
      sayK('emptySlot', slotName(slot))
      return
    }
    await libAdd([
      {
        name: u.name,
        engine: u.engine,
        engineName: info.engines[u.engine],
        p: u.p,
        pattern: u.pattern,
        tags: ['device'],
      },
    ])
    sayK('copiedLib', u.name)
  })
}
export function bankErase(): void {
  const slot = LB.bankSel,
    dev = A.dev
  if (!dev || !dev.bank || slot == null) return
  const s = dev.bank.slots[slot]
  if (
    !s.used ||
    !confirm(
      t('confirmEraseSlot')
        .replace('{n}', slotName(slot))
        .replace('{name}', s.name),
    )
  )
    return
  libOp(async () => {
    checkRc(await bank.erase(rqf, slot))
    await refreshSlot(slot)
    sayK('erasedSlot', slotName(slot))
  })
}
export const bankRefresh = async (): Promise<void> =>
  libOp(async () => {
    sayK('readingBank')
    A.dev!.bank = await bank.list(rqf)
    sayK('ready')
  })
export const bankExport = async (): Promise<void> =>
  libOp(async () => {
    const dev = readyDev(),
      out: PatchSource[] = []
    for (const x of dev.bank!.slots) {
      if (!x.used) continue
      sayK('readingBank', ` ${slotName(x.slot)}`)
      const u = await bank.get(rqf, dev.info, x.slot)
      if (u.used)
        out.push({
          name: u.name,
          engine: u.engine,
          engineName: dev.info.engines[u.engine],
          p: u.p,
          pattern: u.pattern,
          slot: x.slot,
        })
    }
    download(`felucca-bank-${today()}.json`, libraryFile('bank', out, libCtx()))
    sayK('ready')
  })

/* at start-up: open the library; while connecting the core hands over the device's layout */
let started = false
export function init(): void {
  if (started) return
  started = true
  Object.assign(H, { libAdopt })
  libInit()
}
