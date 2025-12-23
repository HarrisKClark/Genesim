import { useEffect, useMemo, useState } from 'react'
import { CircuitComponent } from '../types/dnaTypes'
import { DNA_LENGTH } from '../constants/circuitConstants'
import {
  CircuitFileV1,
  deleteCircuit,
  duplicateCircuit,
  exportCircuitToFile,
  importCircuitFromFile,
  listCircuits,
  loadCircuit,
  renameCircuit,
  saveCircuit,
} from '../utils/circuitPersistence'

type Mode = 'save' | 'load'
type Tab = 'library' | 'import'

interface SavedCircuitsDialogProps {
  isOpen: boolean
  mode: Mode
  currentName: string
  currentComponents: CircuitComponent[]
  currentDnaLength?: number
  currentCircuitId: string | null
  onClose: () => void
  onLoaded: (rec: CircuitFileV1) => void
  onSaved: (rec: CircuitFileV1) => void
}

export default function SavedCircuitsDialog({
  isOpen,
  mode,
  currentName,
  currentComponents,
  currentDnaLength = DNA_LENGTH,
  currentCircuitId,
  onClose,
  onLoaded,
  onSaved,
}: SavedCircuitsDialogProps) {
  const [tab, setTab] = useState<Tab>('library')
  const [items, setItems] = useState<CircuitFileV1[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState(currentName || 'Untitled Circuit')

  useEffect(() => {
    if (!isOpen) return
    setTab('library')
    setError(null)
    setQuery('')
    setNameInput(currentName || 'Untitled Circuit')
    ;(async () => {
      try {
        setBusy(true)
        const list = await listCircuits()
        setItems(list)
      } catch (e: any) {
        setError(e?.message || 'Failed to load saved circuits')
      } finally {
        setBusy(false)
      }
    })()
  }, [isOpen, currentName])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => (c.name || '').toLowerCase().includes(q))
  }, [items, query])

  if (!isOpen) return null

  const refresh = async () => {
    const list = await listCircuits()
    setItems(list)
  }

  const handleSave = async (asNew: boolean) => {
    setError(null)
    try {
      setBusy(true)
      const rec = await saveCircuit({
        id: asNew ? undefined : currentCircuitId ?? undefined,
        name: nameInput.trim() || 'Untitled Circuit',
        dnaLength: currentDnaLength,
        components: currentComponents ?? [],
      })
      await refresh()
      onSaved(rec)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLoad = async (id: string) => {
    setError(null)
    try {
      setBusy(true)
      const rec = await loadCircuit(id)
      if (!rec) throw new Error('Circuit not found')
      onLoaded(rec)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Load failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async (id: string) => {
    const next = window.prompt('Rename circuit to:', items.find((x) => x.id === id)?.name ?? '')
    if (!next) return
    setError(null)
    try {
      setBusy(true)
      await renameCircuit(id, next)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    const yes = window.confirm('Delete this saved circuit? This cannot be undone.')
    if (!yes) return
    setError(null)
    try {
      setBusy(true)
      await deleteCircuit(id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    setError(null)
    try {
      setBusy(true)
      await duplicateCircuit(id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Duplicate failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async (id: string) => {
    setError(null)
    try {
      setBusy(true)
      const rec = await loadCircuit(id)
      if (!rec) throw new Error('Circuit not found')
      exportCircuitToFile(rec)
    } catch (e: any) {
      setError(e?.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      setBusy(true)
      const rec = await importCircuitFromFile(file)
      await refresh()
      onLoaded(rec)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 760,
          maxWidth: '95vw',
          maxHeight: '85vh',
          background: 'white',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Courier New, monospace' }}>
            {mode === 'save' ? 'Save Circuit' : 'Load Circuit'}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 6,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setTab('library')}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              background: tab === 'library' ? '#e9f2ff' : 'white',
              cursor: 'pointer',
              fontFamily: 'Courier New, monospace',
              fontSize: 12,
            }}
          >
            Library
          </button>
          <button
            onClick={() => setTab('import')}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              background: tab === 'import' ? '#e9f2ff' : 'white',
              cursor: 'pointer',
              fontFamily: 'Courier New, monospace',
              fontSize: 12,
            }}
          >
            Import file
          </button>

          <div style={{ flex: 1 }} />

          <input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: 220,
              padding: '6px 10px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontFamily: 'Courier New, monospace',
              fontSize: 12,
            }}
          />
        </div>

        <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
          {error && (
            <div style={{ color: '#c0392b', marginBottom: 10, fontFamily: 'Courier New, monospace', fontSize: 12 }}>
              {error}
            </div>
          )}

          {tab === 'import' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#555' }}>
                Import a circuit file exported from GeneSim (`.genesim.json`).
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </div>
          ) : (
            <>
              {busy && items.length === 0 ? (
                <div style={{ color: '#777', fontFamily: 'Courier New, monospace', fontSize: 12 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: '#777', fontFamily: 'Courier New, monospace', fontSize: 12 }}>
                  No saved circuits yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid #e6e6e6',
                        borderRadius: 8,
                        padding: 10,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: 12 }}>
                          {c.name}
                        </div>
                        <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#777', marginTop: 2 }}>
                          Updated: {new Date(c.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleLoad(c.id)}
                        disabled={busy}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #2e86de',
                          background: '#2e86de',
                          color: 'white',
                          cursor: 'pointer',
                          fontFamily: 'Courier New, monospace',
                          fontSize: 12,
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleExport(c.id)}
                        disabled={busy}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'Courier New, monospace',
                          fontSize: 12,
                        }}
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDuplicate(c.id)}
                        disabled={busy}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'Courier New, monospace',
                          fontSize: 12,
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleRename(c.id)}
                        disabled={busy}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'Courier New, monospace',
                          fontSize: 12,
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={busy}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'Courier New, monospace',
                          fontSize: 12,
                          color: '#c0392b',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {mode === 'save' && (
          <div style={{ borderTop: '1px solid #eee', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#555' }}>Name:</div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={busy}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontFamily: 'Courier New, monospace',
                fontSize: 12,
              }}
            />
            <button
              onClick={() => handleSave(false)}
              disabled={busy || !currentComponents}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #2e86de',
                background: '#2e86de',
                color: 'white',
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontSize: 12,
              }}
              title={currentCircuitId ? 'Update existing' : 'Save'}
            >
              Save
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={busy || !currentComponents}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ddd',
                background: 'white',
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontSize: 12,
              }}
              title="Save as a new circuit"
            >
              Save As…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


