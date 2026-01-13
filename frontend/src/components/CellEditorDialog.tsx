import { useEffect, useState } from 'react'
import { theme } from '../utils/themeUtils'
import './Dialog.css'

interface CellEditorDialogProps {
  isOpen: boolean
  cellType: string
  cellName: string
  onSave: (next: { cellType: string; cellName: string }) => void
  onClose: () => void
}

export default function CellEditorDialog({ isOpen, cellType, cellName, onSave, onClose }: CellEditorDialogProps) {
  const [nextType, setNextType] = useState(cellType)
  const [nextName, setNextName] = useState(cellName)

  useEffect(() => {
    if (!isOpen) return
    setNextType(cellType)
    setNextName(cellName)
  }, [isOpen, cellType, cellName])

  if (!isOpen) return null

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-container" style={{ width: 520 }}>
        <div className="dialog-header">
          <span>Edit Cell</span>
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

        <div className="dialog-body">
          <div className="dialog-form-row">
            <input
              className="dialog-input"
              value={nextType}
              onChange={(e) => setNextType(e.target.value)}
              placeholder="Cell type (e.g. MG1655)"
              style={{ flex: 1 }}
            />
            <input
              className="dialog-input"
              value={nextName}
              onChange={(e) => setNextName(e.target.value)}
              placeholder="Cell name (e.g. Repressilator)"
              style={{ flex: 2 }}
            />
          </div>
          <div style={{ color: theme.textMuted, fontFamily: 'Courier New, monospace', fontSize: 11, marginTop: 8 }}>
            Tip: right-click inside a cell to edit these fields.
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={() => {
              onSave({ cellType: nextType.trim() || cellType, cellName: nextName.trim() || cellName })
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
