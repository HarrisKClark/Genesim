import { useEffect, useMemo, useState } from 'react'
import type { BackboneResistance, BackboneSpec } from '../types/backboneTypes'
import { formatBackboneLabel, normalizeBackboneCode } from '../types/backboneTypes'
import {
  addBackbone,
  deleteBackbone,
  listBackbones,
  subscribeBackboneChanges,
  type BackboneRecord,
} from '../utils/backboneLibrary'
import { getDialogStyles, theme } from '../utils/themeUtils'

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

interface BackboneEditorDialogProps {
  isOpen: boolean
  value: BackboneSpec
  onChange: (next: BackboneSpec) => void
  onClose: () => void
}

export default function BackboneEditorDialog({ isOpen, value, onChange, onClose }: BackboneEditorDialogProps) {
  const [items, setItems] = useState<BackboneRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('custom')
  const [draft, setDraft] = useState<BackboneSpec>(value)
  const [customResName, setCustomResName] = useState('')
  const [customResCode, setCustomResCode] = useState('')

  const styles = getDialogStyles()

  useEffect(() => {
    if (!isOpen) return
    setDraft(value)
    setSelectedId('custom')
    setError(null)
    setCustomResCode('')
    setCustomResName('')
    ;(async () => {
      try {
        setBusy(true)
        const list = await listBackbones()
        setItems(list)
      } catch (e: any) {
        setError(e?.message || 'Failed to load backbones')
      } finally {
        setBusy(false)
      }
    })()
    const unsub = subscribeBackboneChanges(() => {
      listBackbones().then(setItems).catch(() => {})
    })
    return unsub
  }, [isOpen, value])

  const label = useMemo(() => formatBackboneLabel(clampSpec(draft)), [draft])
  const validationError = useMemo(() => validateSpec(clampSpec(draft)), [draft])

  if (!isOpen) return null

  const apply = () => {
    setError(null)
    const next = clampSpec(draft)
    const v = validateSpec(next)
    if (v) {
      setError(v)
      return
    }
    onChange(next)
    onClose()
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

  const handlePick = (id: string) => {
    setSelectedId(id)
    if (id === 'custom') return
    const rec = items.find((x) => x.id === id)
    if (rec) setDraft(rec.spec)
  }

  const addResistance = (r: BackboneResistance) => {
    const next = clampSpec({
      ...draft,
      resistances: [...(draft.resistances ?? []), r].slice(0, 5),
    })
    setDraft(next)
    setSelectedId('custom')
  }

  const removeResistance = (idx: number) => {
    const next = clampSpec({
      ...draft,
      resistances: (draft.resistances ?? []).filter((_, i) => i !== idx),
    })
    setDraft(next)
    setSelectedId('custom')
  }

  const canAddMore = (draft.resistances?.length ?? 0) < 5

  return (
    <div
      style={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={{ ...styles.container, minWidth: 680, maxWidth: '95vw' }}>
        {/* Header */}
        <div style={{ ...styles.header, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Edit Backbone</span>
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

        {/* Body */}
        <div style={{ ...styles.body, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Left column - Library */}
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <label style={styles.label}>Library</label>
            <select
              value={selectedId}
              onChange={(e) => handlePick(e.target.value)}
              disabled={busy}
              style={styles.select}
            >
              <option value="custom">Custom / Current</option>
              {items.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.builtIn ? ' (built-in)' : ''}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textSecondary }}>
              <span style={{ fontWeight: 600 }}>Preview:</span> {label}
            </div>
          </div>

          {/* Right column - Settings */}
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <label style={styles.label}>Copy Number + Origin</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={1}
                value={draft.copyNumber}
                onChange={(e) => {
                  setDraft({ ...draft, copyNumber: Number(e.target.value) })
                  setSelectedId('custom')
                }}
                style={{ ...styles.input, flex: 1 }}
              />
              <input
                type="text"
                value={draft.originName}
                onChange={(e) => {
                  setDraft({ ...draft, originName: e.target.value })
                  setSelectedId('custom')
                }}
                placeholder="Origin (e.g. ColE1)"
                style={{ ...styles.input, flex: 2 }}
              />
            </div>

            <label style={{ ...styles.label, marginTop: 14 }}>Resistances (max 5)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(draft.resistances ?? []).map((r, idx) => (
                <div key={`${r.code}-${idx}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={r.code}
                    onChange={(e) => {
                      const next = [...(draft.resistances ?? [])]
                      next[idx] = { ...next[idx], code: e.target.value }
                      setDraft({ ...draft, resistances: next })
                      setSelectedId('custom')
                    }}
                    style={{ ...styles.input, width: 70, flex: 'none' }}
                    placeholder="Code"
                  />
                  <input
                    value={r.name}
                    onChange={(e) => {
                      const next = [...(draft.resistances ?? [])]
                      next[idx] = { ...next[idx], name: e.target.value }
                      setDraft({ ...draft, resistances: next })
                      setSelectedId('custom')
                    }}
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="Name"
                  />
                  <button
                    onClick={() => removeResistance(idx)}
                    title="Remove"
                    style={{ ...styles.secondaryButton, padding: '6px 10px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select
                disabled={!canAddMore}
                onChange={(e) => {
                  const code = e.target.value
                  if (!code) return
                  const preset = PRESET_RESISTANCES.find((p) => p.code === code)
                  if (preset) addResistance(preset)
                  e.currentTarget.value = ''
                }}
                style={{ ...styles.select, width: 'auto' }}
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
                disabled={!canAddMore}
                value={customResCode}
                onChange={(e) => setCustomResCode(e.target.value)}
                placeholder="Code (2–3)"
                style={{ ...styles.input, width: 90, flex: 'none' }}
              />
              <input
                disabled={!canAddMore}
                value={customResName}
                onChange={(e) => setCustomResName(e.target.value)}
                placeholder="Custom name"
                style={{ ...styles.input, flex: 1, minWidth: 120 }}
              />
              <button
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
                style={styles.secondaryButton}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Error display */}
        {(error || validationError) && (
          <div style={{ padding: '0 16px 12px 16px' }}>
            <div style={{ color: '#e74c3c', fontSize: 12 }}>
              {error || validationError}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ ...styles.footer, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={saveToLibrary}
              disabled={busy || !!validationError}
              style={styles.secondaryButton}
              title="Save current settings as a custom backbone in your local library"
            >
              Save to Library
            </button>

            <button
              onClick={async () => {
                if (selectedId === 'custom') return
                const rec = items.find((x) => x.id === selectedId)
                if (!rec || rec.builtIn) return
                const yes = window.confirm('Delete this custom backbone from your local library?')
                if (!yes) return
                try {
                  setBusy(true)
                  await deleteBackbone(rec.id)
                  setSelectedId('custom')
                } catch (e: any) {
                  setError(e?.message || 'Delete failed')
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy || selectedId === 'custom' || !!items.find((x) => x.id === selectedId)?.builtIn}
              style={styles.secondaryButton}
              title="Delete selected custom backbone"
            >
              Delete Selected
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={styles.secondaryButton}>
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={busy || !!validationError}
              style={styles.primaryButton}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
