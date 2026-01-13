import { useEffect, useMemo, useState } from 'react'
import type { BackboneResistance, BackboneSpec } from '../types/backboneTypes'
import { formatBackboneLabel, normalizeBackboneCode } from '../types/backboneTypes'
import {
  addBackbone,
  listBackbones,
  subscribeBackboneChanges,
  type BackboneRecord,
} from '../utils/backboneLibrary'
import { theme } from '../utils/themeUtils'

const PRESET_RESISTANCES: BackboneResistance[] = [
  { code: 'Amp', name: 'Ampicillin' },
  { code: 'Kan', name: 'Kanamycin' },
  { code: 'Cm', name: 'Chloramphenicol' },
  { code: 'Spec', name: 'Spectinomycin' },
  { code: 'Tet', name: 'Tetracycline' },
  { code: 'Gent', name: 'Gentamicin' },
  { code: 'Zeo', name: 'Zeocin' },
  { code: 'Hyg', name: 'Hygromycin' },
]

function clampSpec(spec: BackboneSpec): BackboneSpec {
  const cn = Math.max(1, Math.round(Number(spec.copyNumber) || 1))
  const originName = (spec.originName ?? '').trim()
  const resistances = (spec.resistances ?? []).slice(0, 5).map((r) => ({
    code: normalizeBackboneCode(r.code),
    name: (r.name ?? '').trim(),
  }))
  return { copyNumber: cn, originName, resistances }
}

function validateSpec(spec: BackboneSpec): string | null {
  if (!spec.originName.trim()) return 'Origin name is required.'
  if (!Number.isFinite(spec.copyNumber) || spec.copyNumber <= 0) return 'Copy number must be a positive number.'
  if ((spec.resistances?.length ?? 0) > 5) return 'Max 5 resistances.'
  for (const r of spec.resistances ?? []) {
    if (!r.name.trim()) return 'Each resistance must have a name.'
    const code = normalizeBackboneCode(r.code)
    if (code.length < 2 || code.length > 3) return 'Each resistance code must be 2–3 characters.'
  }
  const seen = new Set<string>()
  for (const r of spec.resistances ?? []) {
    const key = normalizeBackboneCode(r.code).toLowerCase()
    if (seen.has(key)) return 'Resistance codes must be unique.'
    seen.add(key)
  }
  return null
}

interface NewCellDialogProps {
  isOpen: boolean
  defaultCellType: string
  defaultCellName: string
  defaultBackbone: BackboneSpec
  onCreate: (args: { cellType: string; cellName: string; backbone: BackboneSpec }) => void
  onClose: () => void
}

export default function NewCellDialog({
  isOpen,
  defaultCellType,
  defaultCellName,
  defaultBackbone,
  onCreate,
  onClose,
}: NewCellDialogProps) {
  const [cellType, setCellType] = useState(defaultCellType)
  const [cellName, setCellName] = useState(defaultCellName)
  const [items, setItems] = useState<BackboneRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BackboneSpec>(defaultBackbone)
  const [customResName, setCustomResName] = useState('')
  const [customResCode, setCustomResCode] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setCellType(defaultCellType)
    setCellName(defaultCellName)
    setSelectedId('default')
    setDraft(defaultBackbone)
    setError(null)
    setCustomResCode('')
    setCustomResName('')
    ;(async () => {
      try {
        setBusy(true)
        const list = await listBackbones()
        setItems(list)
      } catch (e: any) {
        setError(e?.message || 'Failed to load backbone library')
      } finally {
        setBusy(false)
      }
    })()
    const unsub = subscribeBackboneChanges(() => {
      listBackbones().then(setItems).catch(() => {})
    })
    return unsub
  }, [isOpen, defaultCellType, defaultCellName, defaultBackbone])

  const label = useMemo(() => formatBackboneLabel(clampSpec(draft)), [draft])
  const validationError = useMemo(() => validateSpec(clampSpec(draft)), [draft])

  if (!isOpen) return null

  const handlePick = (id: string) => {
    setSelectedId(id)
    if (id === 'default') {
      setDraft(defaultBackbone)
      return
    }
    const rec = items.find((x) => x.id === id)
    if (rec) setDraft(rec.spec)
  }

  const addResistance = (r: BackboneResistance) => {
    const next = clampSpec({
      ...draft,
      resistances: [...(draft.resistances ?? []), r].slice(0, 5),
    })
    setDraft(next)
  }

  const removeResistance = (idx: number) => {
    const next = clampSpec({
      ...draft,
      resistances: (draft.resistances ?? []).filter((_, i) => i !== idx),
    })
    setDraft(next)
  }

  const saveToLibrary = async () => {
    setError(null)
    const next = clampSpec(draft)
    const v = validateSpec(next)
    if (v) {
      setError(v)
      return
    }
    try {
      setBusy(true)
      await addBackbone(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to save backbone')
    } finally {
      setBusy(false)
    }
  }

  const canAddMore = (draft.resistances?.length ?? 0) < 5

  const handleCreate = () => {
    setError(null)
    const ct = cellType.trim() || defaultCellType
    const cn = cellName.trim() || defaultCellName
    const bb = clampSpec(draft)
    const v = validateSpec(bb)
    if (v) {
      setError(v)
      return
    }
    onCreate({ cellType: ct, cellName: cn, backbone: bb })
    onClose()
  }

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-container large" style={{ width: 720 }}>
        <div className="dialog-header">
          <div className="dialog-title">New Cell</div>
          <button className="dialog-close-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          {/* Cell type and name */}
          <div className="dialog-label">
            Cell Info
          </div>
          <div className="dialog-form-row">
            <input
              className="dialog-input"
              value={cellType}
              onChange={(e) => setCellType(e.target.value)}
              placeholder="Cell type (e.g. MG1655)"
              style={{ flex: 1 }}
            />
            <input
              className="dialog-input"
              value={cellName}
              onChange={(e) => setCellName(e.target.value)}
              placeholder="Cell name (e.g. Repressilator)"
              style={{ flex: 2 }}
            />
          </div>

          {/* Backbone section */}
          <div className="dialog-label" style={{ borderTop: `1px solid ${theme.borderLight}`, paddingTop: 14, marginTop: 8 }}>
            Initial Plasmid Backbone
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', minWidth: 260 }}>
              <div className="dialog-label">
                Library
              </div>
              <select
                className="dialog-select"
                value={selectedId}
                onChange={(e) => handlePick(e.target.value)}
                disabled={busy}
              >
                <option value="default">Default (BB_10C_ColE1_Cm)</option>
                <option value="custom">Custom</option>
                {items.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.builtIn ? ' (built-in)' : ''}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 8, fontFamily: 'Courier New, monospace', fontSize: 11, color: theme.textPrimary }}>
                <span style={{ fontWeight: 700 }}>Preview:</span> {label}
              </div>
            </div>

            <div style={{ flex: '1 1 320px', minWidth: 300 }}>
              <div className="dialog-label">
                Copy Number + Origin
              </div>
              <div className="dialog-form-row">
                <input
                  className="dialog-input"
                  type="number"
                  min={1}
                  value={draft.copyNumber}
                  onChange={(e) => setDraft({ ...draft, copyNumber: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <input
                  className="dialog-input"
                  type="text"
                  value={draft.originName}
                  onChange={(e) => setDraft({ ...draft, originName: e.target.value })}
                  placeholder="Origin (e.g. ColE1)"
                  style={{ flex: 2 }}
                />
              </div>

              <div className="dialog-label" style={{ marginTop: 12 }}>
                Resistances (max 5)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(draft.resistances ?? []).map((r, idx) => (
                  <div key={`${r.code}-${idx}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="dialog-input"
                      value={r.code}
                      onChange={(e) => {
                        const next = [...(draft.resistances ?? [])]
                        next[idx] = { ...next[idx], code: e.target.value }
                        setDraft({ ...draft, resistances: next })
                      }}
                      style={{ width: 70 }}
                      placeholder="Code"
                    />
                    <input
                      className="dialog-input"
                      value={r.name}
                      onChange={(e) => {
                        const next = [...(draft.resistances ?? [])]
                        next[idx] = { ...next[idx], name: e.target.value }
                        setDraft({ ...draft, resistances: next })
                      }}
                      style={{ flex: 1 }}
                      placeholder="Name"
                    />
                    <button
                      className="dialog-btn dialog-btn-secondary"
                      onClick={() => removeResistance(idx)}
                      title="Remove"
                      style={{ padding: '4px 8px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select
                  className="dialog-select"
                  disabled={!canAddMore}
                  onChange={(e) => {
                    const code = e.target.value
                    if (!code) return
                    const preset = PRESET_RESISTANCES.find((p) => p.code === code)
                    if (preset) addResistance(preset)
                    e.currentTarget.value = ''
                  }}
                  style={{ width: 'auto' }}
                  defaultValue=""
                >
                  <option value="">Add preset…</option>
                  {PRESET_RESISTANCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} – {p.name}
                    </option>
                  ))}
                </select>

                <input
                  className="dialog-input"
                  disabled={!canAddMore}
                  value={customResCode}
                  onChange={(e) => setCustomResCode(e.target.value)}
                  placeholder="Code (2–3)"
                  style={{ width: 90 }}
                />
                <input
                  className="dialog-input"
                  disabled={!canAddMore}
                  value={customResName}
                  onChange={(e) => setCustomResName(e.target.value)}
                  placeholder="Name"
                  style={{ flex: 1, minWidth: 100 }}
                />
                <button
                  className="dialog-btn dialog-btn-secondary"
                  disabled={!canAddMore}
                  onClick={() => {
                    const code = normalizeBackboneCode(customResCode)
                    const name = customResName.trim()
                    if (!code || code.length < 2 || code.length > 3 || !name) {
                      setError('Custom resistance needs a 2–3 char code and a name.')
                      return
                    }
                    addResistance({ code, name })
                    setCustomResCode('')
                    setCustomResName('')
                  }}
                  style={{ padding: '6px 8px' }}
                >
                  Add
                </button>
              </div>

              <button
                className="dialog-btn dialog-btn-secondary"
                onClick={saveToLibrary}
                disabled={busy || !!validationError}
                style={{ marginTop: 10, fontSize: 11 }}
                title="Save this backbone configuration to your local library for future use"
              >
                Save Backbone to Library
              </button>
            </div>
          </div>

          {error && <div className="dialog-error">{error}</div>}
          {!error && validationError && <div className="dialog-error">{validationError}</div>}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={handleCreate}
            disabled={busy || !!validationError}
          >
            Create Cell
          </button>
        </div>
      </div>
    </div>
  )
}
