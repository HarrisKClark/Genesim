import { useEffect, useMemo, useState } from 'react'
import { CircuitComponent } from '../types/dnaTypes'
import { DNA_LENGTH } from '../constants/circuitConstants'
import type { BackboneSpec } from '../types/backboneTypes'
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
import { exportCustomParts } from '../utils/partLibrary'
import { getDialogStyles, theme } from '../utils/themeUtils'

type Mode = 'save' | 'load'
type Tab = 'library' | 'import'

interface SavedCircuitsDialogProps {
  isOpen: boolean
  mode: Mode
  currentName: string
  currentComponents: CircuitComponent[]
  currentCellCircuits?: CircuitComponent[][]
  currentCultureCells?: CircuitFileV1['cultureCells']
  currentBackbone?: BackboneSpec
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
  currentCellCircuits,
  currentCultureCells,
  currentBackbone,
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
        cellCircuits: currentCellCircuits,
        cultureCells: currentCultureCells,
        customParts: exportCustomParts(),
        backbone: currentBackbone,
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

  const dialogStyles = getDialogStyles()

  return (
    <div
      style={{
        ...dialogStyles.overlay,
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
          background: theme.bgDialog,
          borderRadius: 0,
          border: `2px solid ${theme.borderPrimary}`,
          overflow: 'hidden',
          boxShadow: `4px 4px 0 ${theme.shadowColor}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: theme.bgDialogHeader,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Courier New, monospace', color: theme.textPrimary }}>
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
              color: theme.textPrimary,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: `1px solid ${theme.borderLight}`, display: 'flex', gap: 10, background: theme.bgDialog }}>
          <button
            onClick={() => setTab('library')}
            style={{
              padding: '6px 10px',
              borderRadius: 0,
              border: `1px solid ${theme.borderPrimary}`,
              background: tab === 'library' ? theme.accentPrimary : theme.bgSecondary,
              color: tab === 'library' ? theme.textOnAccent : theme.textPrimary,
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
              borderRadius: 0,
              border: `1px solid ${theme.borderPrimary}`,
              background: tab === 'import' ? theme.accentPrimary : theme.bgSecondary,
              color: tab === 'import' ? theme.textOnAccent : theme.textPrimary,
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
            className="dialog-input"
            style={{
              width: 220,
            }}
          />
        </div>

        <div className="dialog-body">
          {error && (
            <div className="dialog-error">
              {error}
            </div>
          )}

          {tab === 'import' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: theme.textSecondary }}>
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
                <div style={{ color: theme.textMuted, fontFamily: 'Courier New, monospace', fontSize: 12 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: theme.textMuted, fontFamily: 'Courier New, monospace', fontSize: 12 }}>
                  No saved circuits yet.
                </div>
              ) : (
                <div className="dialog-list">
                  {filtered.map((c) => (
                    <div
                      key={c.id}
                      className="dialog-list-item"
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: 12, color: theme.textPrimary }}>
                          {c.name}
                        </div>
                        <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                          Updated: {new Date(c.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <button
                        className="dialog-btn dialog-btn-primary"
                        onClick={() => handleLoad(c.id)}
                        disabled={busy}
                      >
                        Load
                      </button>
                      <button className="dialog-btn dialog-btn-secondary" onClick={() => handleExport(c.id)} disabled={busy}>
                        Export
                      </button>
                      <button className="dialog-btn dialog-btn-secondary" onClick={() => handleDuplicate(c.id)} disabled={busy}>
                        Duplicate
                      </button>
                      <button className="dialog-btn dialog-btn-secondary" onClick={() => handleRename(c.id)} disabled={busy}>
                        Rename
                      </button>
                      <button className="dialog-btn dialog-btn-danger" onClick={() => handleDelete(c.id)} disabled={busy}>
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
          <div className="dialog-footer" style={{ justifyContent: 'flex-start' }}>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: theme.textSecondary }}>Name:</div>
            <input
              className="dialog-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <button
              className="dialog-btn dialog-btn-primary"
              onClick={() => handleSave(false)}
              disabled={busy || !currentComponents}
              title={currentCircuitId ? 'Update existing' : 'Save'}
            >
              Save
            </button>
            <button
              className="dialog-btn dialog-btn-secondary"
              onClick={() => handleSave(true)}
              disabled={busy || !currentComponents}
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


