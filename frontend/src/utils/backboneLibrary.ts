import type { BackboneSpec } from '../types/backboneTypes'
import { formatBackboneLabel, normalizeBackboneCode } from '../types/backboneTypes'
import { GENESIM_BACKBONES_STORE, openGenesimDb } from './circuitPersistence'

export interface BackboneRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  spec: BackboneSpec
  builtIn?: boolean
}

const BUILT_INS: BackboneRecord[] = [
  {
    id: 'builtin_bb_10c_cole1_cm',
    name: 'BB_10C_ColE1_Cm',
    createdAt: 0,
    updatedAt: 0,
    builtIn: true,
    spec: {
      copyNumber: 10,
      originName: 'ColE1',
      resistances: [{ code: 'Cm', name: 'Chloramphenicol' }],
    },
  },
  {
    id: 'builtin_bb_2c_psc101_kan',
    name: 'BB_2C_pSC101_Kan',
    createdAt: 0,
    updatedAt: 0,
    builtIn: true,
    spec: {
      copyNumber: 2,
      originName: 'pSC101',
      resistances: [{ code: 'Kan', name: 'Kanamycin' }],
    },
  },
  {
    id: 'builtin_bb_100c_cole1_amp',
    name: 'BB_100C_ColE1_Amp',
    createdAt: 0,
    updatedAt: 0,
    builtIn: true,
    spec: {
      copyNumber: 100,
      originName: 'ColE1',
      resistances: [{ code: 'Amp', name: 'Ampicillin' }],
    },
  },
]

function nowMs() {
  return Date.now()
}

function uuid() {
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function normalizeSpec(spec: BackboneSpec): BackboneSpec {
  const cn = Math.max(1, Math.round(Number(spec.copyNumber) || 1))
  const originName = (spec.originName ?? '').trim()
  const resistances = (spec.resistances ?? [])
    .slice(0, 5)
    .map((r) => ({
      code: normalizeBackboneCode(r.code),
      name: (r.name ?? '').trim(),
    }))
    .filter((r) => r.code && r.code.length >= 2 && r.code.length <= 3 && r.name)
  // de-dupe codes
  const seen = new Set<string>()
  const deduped = resistances.filter((r) => {
    const key = r.code.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { copyNumber: cn, originName, resistances: deduped }
}

export function getBuiltInBackbones(): BackboneRecord[] {
  return BUILT_INS
}

export async function listCustomBackbones(): Promise<BackboneRecord[]> {
  const db = await openGenesimDb()
  const tx = db.transaction(GENESIM_BACKBONES_STORE, 'readonly')
  const store = tx.objectStore(GENESIM_BACKBONES_STORE)
  const req = store.getAll()
  const all = await new Promise<any[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as any[])
    req.onerror = () => reject(req.error ?? new Error('Failed to read backbones'))
    tx.onabort = () => reject(tx.error ?? new Error('Backbone transaction aborted'))
  })
  db.close()
  return (all as BackboneRecord[])
    .filter((r) => r && r.id && !r.builtIn)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function listBackbones(): Promise<BackboneRecord[]> {
  const custom = await listCustomBackbones().catch(() => [])
  return [...getBuiltInBackbones(), ...custom]
}

export async function addBackbone(spec: BackboneSpec): Promise<BackboneRecord> {
  const norm = normalizeSpec(spec)
  const id = uuid()
  const rec: BackboneRecord = {
    id,
    name: formatBackboneLabel(norm),
    createdAt: nowMs(),
    updatedAt: nowMs(),
    spec: norm,
  }
  const db = await openGenesimDb()
  const tx = db.transaction(GENESIM_BACKBONES_STORE, 'readwrite')
  const store = tx.objectStore(GENESIM_BACKBONES_STORE)
  const req = store.put(rec)
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('Failed to save backbone'))
    tx.onabort = () => reject(tx.error ?? new Error('Backbone transaction aborted'))
  })
  db.close()
  notifyBackboneChange()
  return rec
}

export async function updateBackbone(id: string, spec: BackboneSpec): Promise<BackboneRecord> {
  const norm = normalizeSpec(spec)
  const db = await openGenesimDb()
  const tx = db.transaction(GENESIM_BACKBONES_STORE, 'readwrite')
  const store = tx.objectStore(GENESIM_BACKBONES_STORE)
  const getReq = store.get(id)
  const existing = await new Promise<any>((resolve, reject) => {
    getReq.onsuccess = () => resolve(getReq.result)
    getReq.onerror = () => reject(getReq.error ?? new Error('Failed to load backbone'))
    tx.onabort = () => reject(tx.error ?? new Error('Backbone transaction aborted'))
  })
  const createdAt = Number(existing?.createdAt ?? nowMs())
  const rec: BackboneRecord = {
    id,
    name: formatBackboneLabel(norm),
    createdAt,
    updatedAt: nowMs(),
    spec: norm,
  }
  const putReq = store.put(rec)
  await new Promise<void>((resolve, reject) => {
    putReq.onsuccess = () => resolve()
    putReq.onerror = () => reject(putReq.error ?? new Error('Failed to update backbone'))
    tx.onabort = () => reject(tx.error ?? new Error('Backbone transaction aborted'))
  })
  db.close()
  notifyBackboneChange()
  return rec
}

export async function deleteBackbone(id: string): Promise<void> {
  const db = await openGenesimDb()
  const tx = db.transaction(GENESIM_BACKBONES_STORE, 'readwrite')
  const store = tx.objectStore(GENESIM_BACKBONES_STORE)
  const req = store.delete(id)
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('Failed to delete backbone'))
    tx.onabort = () => reject(tx.error ?? new Error('Backbone transaction aborted'))
  })
  db.close()
  notifyBackboneChange()
}

// Reactivity (similar to partLibrary change listeners)
const listeners = new Set<() => void>()

function notifyBackboneChange() {
  for (const cb of listeners) cb()
}

export function subscribeBackboneChanges(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}


