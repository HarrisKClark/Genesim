import { CircuitComponent } from '../types/dnaTypes'
import type { CustomPartsBundle } from './partLibrary'
import type { BackboneSpec } from '../types/backboneTypes'

export interface CircuitFileV1 {
  version: 1
  id: string
  name: string
  createdAt: number
  updatedAt: number
  dnaLength: number
  /** Optional background DNA sequence (for per-plasmid edits). */
  dnaSequence?: string[]
  components: CircuitComponent[]
  /** Optional: multiple circuits within a single cell (v1-compatible extension). */
  cellCircuits?: CircuitComponent[][]
  /** Optional: multiple cells in a culture (v1-compatible extension). */
  cultureCells?: Array<{
    cellType: string
    cellName: string
    // Backward compatible:
    // - old: circuits = CircuitComponent[][]
    // - new: circuits = [{ id, backbone, components, dnaLength?, dnaSequence? }]
    circuits: any
    activeCircuitIndex?: number
    backbone?: BackboneSpec
  }>
  customParts?: CustomPartsBundle
  backbone?: BackboneSpec
}

const DB_NAME = 'genesim'
const DB_VERSION = 2
const STORE = 'circuits'
const BACKBONES_STORE = 'backbones'

const DRAFT_ID = '__draft__'

function nowMs() {
  return Date.now()
}

function uuid() {
  // Prefer crypto.randomUUID where available
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('byUpdatedAt', 'updatedAt')
        store.createIndex('byName', 'name')
      }
      if (!db.objectStoreNames.contains(BACKBONES_STORE)) {
        const store = db.createObjectStore(BACKBONES_STORE, { keyPath: 'id' })
        store.createIndex('byUpdatedAt', 'updatedAt')
        store.createIndex('byName', 'name')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

// Shared IndexedDB helpers (used by backbone library too)
export const GENESIM_DB_NAME = DB_NAME
export const GENESIM_DB_VERSION = DB_VERSION
export const GENESIM_BACKBONES_STORE = BACKBONES_STORE

export async function openGenesimDb(): Promise<IDBDatabase> {
  return await openDb()
}

function txp<T>(tx: IDBTransaction, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function listCircuits(): Promise<CircuitFileV1[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const all = await txp(tx, store.getAll())
  db.close()
  // hide draft from library
  return (all as CircuitFileV1[])
    .filter((c) => c.id !== DRAFT_ID)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function loadCircuit(id: string): Promise<CircuitFileV1 | null> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const rec = await txp(tx, store.get(id))
  db.close()
  return (rec as any) ?? null
}

export async function saveCircuit(input: {
  id?: string
  name: string
  dnaLength: number
  dnaSequence?: string[]
  components: CircuitComponent[]
  cellCircuits?: CircuitComponent[][]
  cultureCells?: CircuitFileV1['cultureCells']
  customParts?: CustomPartsBundle
  backbone?: BackboneSpec
  createdAt?: number
}): Promise<CircuitFileV1> {
  const id = input.id ?? uuid()
  const existing = input.id ? await loadCircuit(id) : null
  const createdAt = input.createdAt ?? existing?.createdAt ?? nowMs()
  const record: CircuitFileV1 = {
    version: 1,
    id,
    name: input.name,
    createdAt,
    updatedAt: nowMs(),
    dnaLength: input.dnaLength,
    dnaSequence: input.dnaSequence,
    components: input.components ?? [],
    cellCircuits: input.cellCircuits,
    cultureCells: input.cultureCells,
    customParts: input.customParts,
    backbone: input.backbone,
  }
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  await txp(tx, store.put(record))
  db.close()
  return record
}

export async function deleteCircuit(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  await txp(tx, store.delete(id))
  db.close()
}

export async function renameCircuit(id: string, name: string): Promise<CircuitFileV1 | null> {
  const rec = await loadCircuit(id)
  if (!rec) return null
  return await saveCircuit({ ...rec, name })
}

export async function duplicateCircuit(id: string, newName?: string): Promise<CircuitFileV1 | null> {
  const rec = await loadCircuit(id)
  if (!rec) return null
  return await saveCircuit({
    name: newName ?? `${rec.name} (copy)`,
    dnaLength: rec.dnaLength,
    dnaSequence: (rec as any).dnaSequence,
    components: rec.components,
    cellCircuits: rec.cellCircuits,
    cultureCells: rec.cultureCells,
    customParts: rec.customParts,
    backbone: rec.backbone,
  })
}

export async function saveDraft(
  dnaLength: number,
  components: CircuitComponent[],
  dnaSequence?: string[],
  customParts?: CustomPartsBundle,
  backbone?: BackboneSpec,
  cellCircuits?: CircuitComponent[][],
  cultureCells?: CircuitFileV1['cultureCells']
): Promise<CircuitFileV1> {
  return await saveCircuit({
    id: DRAFT_ID,
    name: 'Draft',
    dnaLength,
    dnaSequence,
    components,
    cellCircuits,
    cultureCells,
    customParts,
    backbone,
  })
}

export async function loadDraft(): Promise<CircuitFileV1 | null> {
  return await loadCircuit(DRAFT_ID)
}

export function exportCircuitToFile(record: CircuitFileV1) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  const safeName = (record.name || 'circuit').replace(/[^\w\-]+/g, '_')
  a.href = URL.createObjectURL(blob)
  a.download = `${safeName}.genesim.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 0)
}

export async function importCircuitFromFile(file: File): Promise<CircuitFileV1> {
  const text = await file.text()
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }
  if (!parsed || parsed.version !== 1) {
    throw new Error('Unsupported circuit file version')
  }
  if (!Array.isArray(parsed.components)) {
    throw new Error('Invalid circuit file: missing components')
  }
  const rec: CircuitFileV1 = {
    version: 1,
    id: parsed.id ?? uuid(),
    name: String(parsed.name ?? 'Imported circuit'),
    createdAt: Number(parsed.createdAt ?? nowMs()),
    updatedAt: nowMs(),
    dnaLength: Number(parsed.dnaLength ?? 10000),
    dnaSequence: Array.isArray(parsed.dnaSequence) ? (parsed.dnaSequence as string[]) : undefined,
    components: parsed.components as CircuitComponent[],
    cellCircuits: Array.isArray(parsed.cellCircuits) ? (parsed.cellCircuits as CircuitComponent[][]) : undefined,
    cultureCells: Array.isArray(parsed.cultureCells) ? (parsed.cultureCells as CircuitFileV1['cultureCells']) : undefined,
    customParts: parsed.customParts,
    backbone: parsed.backbone,
  }
  // Save as a new record (avoid clobbering an existing one with same id)
  return await saveCircuit({
    name: rec.name,
    dnaLength: rec.dnaLength,
    dnaSequence: rec.dnaSequence,
    components: rec.components,
    cellCircuits: rec.cellCircuits,
    cultureCells: rec.cultureCells,
    customParts: rec.customParts,
    backbone: rec.backbone,
  })
}


