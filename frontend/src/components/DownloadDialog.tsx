import { useState, useMemo } from 'react'
import JSZip from 'jszip'
import { buildFullPlasmidSequence, toFasta, toGenBank } from '../utils/sequenceExport'
import type { BackboneSpec } from '../types/backboneTypes'
import type { CircuitComponent } from '../types/dnaTypes'
import { theme } from '../utils/themeUtils'

interface PlasmidData {
  id: string
  backbone: BackboneSpec
  components: CircuitComponent[]
  dnaLength: number
}

interface CellData {
  id: string
  cellType: string
  cellName: string
  circuits: PlasmidData[]
}

interface DownloadDialogProps {
  open: boolean
  onClose: () => void
  cultureCells: CellData[]
}

type ExportFormat = 'fasta' | 'gbk'

interface SelectionState {
  [cellId: string]: {
    selected: boolean
    plasmids: { [plasmidIndex: number]: boolean }
  }
}

export default function DownloadDialog({ open, onClose, cultureCells }: DownloadDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('gbk')
  const [isDownloading, setIsDownloading] = useState(false)

  // Initialize selection state with all cells/plasmids selected
  const initialSelection = useMemo(() => {
    const state: SelectionState = {}
    for (const cell of cultureCells) {
      state[cell.id] = {
        selected: true,
        plasmids: {},
      }
      cell.circuits.forEach((_, idx) => {
        state[cell.id].plasmids[idx] = true
      })
    }
    return state
  }, [cultureCells])

  const [selection, setSelection] = useState<SelectionState>(initialSelection)

  // Reset selection when dialog opens
  useMemo(() => {
    if (open) {
      setSelection(initialSelection)
    }
  }, [open, initialSelection])

  const toggleCell = (cellId: string) => {
    setSelection((prev) => {
      const cellState = prev[cellId]
      const newSelected = !cellState.selected
      const newPlasmids: { [key: number]: boolean } = {}
      Object.keys(cellState.plasmids).forEach((key) => {
        newPlasmids[parseInt(key)] = newSelected
      })
      return {
        ...prev,
        [cellId]: {
          selected: newSelected,
          plasmids: newPlasmids,
        },
      }
    })
  }

  const togglePlasmid = (cellId: string, plasmidIndex: number) => {
    setSelection((prev) => {
      const cellState = prev[cellId]
      const newPlasmids = {
        ...cellState.plasmids,
        [plasmidIndex]: !cellState.plasmids[plasmidIndex],
      }
      // Check if any plasmid is selected to update cell selection
      const anySelected = Object.values(newPlasmids).some((v) => v)
      return {
        ...prev,
        [cellId]: {
          selected: anySelected,
          plasmids: newPlasmids,
        },
      }
    })
  }

  const handleDownload = async () => {
    setIsDownloading(true)

    try {
      const zip = new JSZip()

      for (const cell of cultureCells) {
        const cellSelection = selection[cell.id]
        if (!cellSelection?.selected) continue

        // Create folder for this cell
        const folderName = sanitizeFilename(cell.cellName || cell.cellType || 'Cell')
        const folder = zip.folder(folderName)
        if (!folder) continue

        cell.circuits.forEach((plasmid, idx) => {
          if (!cellSelection.plasmids[idx]) return

          // Build the full plasmid sequence
          const { sequence, features } = buildFullPlasmidSequence(
            plasmid.components,
            plasmid.dnaLength,
            plasmid.backbone
          )

          const plasmidName = `${sanitizeFilename(cell.cellName || cell.cellType || 'Cell')}_${idx + 1}`

          let content: string
          let extension: string

          if (format === 'fasta') {
            content = toFasta(plasmidName, sequence)
            extension = 'fasta'
          } else {
            content = toGenBank(plasmidName, sequence, features, `${cell.cellName} Plasmid ${idx + 1}`)
            extension = 'gbk'
          }

          folder.file(`${plasmidName}.${extension}`, content)
        })
      }

      // Generate ZIP and trigger download
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `circuits_export.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  // Count selected plasmids
  const selectedCount = useMemo(() => {
    let count = 0
    for (const cellId in selection) {
      const cellState = selection[cellId]
      for (const idx in cellState.plasmids) {
        if (cellState.plasmids[idx]) count++
      }
    }
    return count
  }, [selection])

  if (!open) return null

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-container medium">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-title">
            Export Sequences
          </div>
          <button
            className="dialog-close-btn"
            onClick={onClose}
            style={{
              padding: 6,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="dialog-body">
          {/* Format Selection */}
          <div className="dialog-form-group">
            <div className="dialog-label">Format:</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <label className="dialog-checkbox-row">
                <input
                  type="radio"
                  name="format"
                  value="gbk"
                  checked={format === 'gbk'}
                  onChange={() => setFormat('gbk')}
                />
                GenBank (.gbk)
              </label>
              <label className="dialog-checkbox-row">
                <input
                  type="radio"
                  name="format"
                  value="fasta"
                  checked={format === 'fasta'}
                  onChange={() => setFormat('fasta')}
                />
                FASTA (.fasta)
              </label>
            </div>
          </div>

          {/* Selection Tree */}
          <div className="dialog-form-group">
            <div className="dialog-label">Select items to export:</div>
            <div
              style={{
                border: `1px solid ${theme.borderLight}`,
                borderRadius: 0,
                maxHeight: 280,
                overflow: 'auto',
                background: theme.bgInput,
              }}
            >
              {cultureCells.length === 0 ? (
                <div className="dialog-empty">
                  No cells to export
                </div>
              ) : (
                cultureCells.map((cell) => (
                  <div key={cell.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: theme.bgDialog,
                        color: theme.textPrimary,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selection[cell.id]?.selected || false}
                        onChange={() => toggleCell(cell.id)}
                        style={{ accentColor: theme.accentPrimary }}
                      />
                      <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 600 }}>
                        {cell.cellName || cell.cellType || 'Cell'}
                      </span>
                      <span style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: theme.textMuted }}>
                        ({cell.cellType})
                      </span>
                    </label>
                    <div style={{ background: theme.bgSecondary, paddingLeft: 28 }}>
                      {cell.circuits.map((plasmid, idx) => (
                        <label
                          key={plasmid.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderTop: `1px solid ${theme.borderLight}`,
                            color: theme.textPrimary,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selection[cell.id]?.plasmids[idx] || false}
                            onChange={() => togglePlasmid(cell.id, idx)}
                            style={{ accentColor: theme.accentPrimary }}
                          />
                          <span style={{ fontFamily: 'Courier New, monospace', fontSize: 11 }}>
                            Plasmid {idx + 1}
                          </span>
                          <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: theme.textMuted }}>
                            ({plasmid.components.filter((c) => c.position !== undefined).length} parts)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: theme.textMuted }}>
            {selectedCount} plasmid(s) selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="dialog-btn dialog-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="dialog-btn dialog-btn-primary"
              onClick={handleDownload}
              disabled={selectedCount === 0 || isDownloading}
              style={{
                opacity: selectedCount === 0 || isDownloading ? 0.5 : 1,
                cursor: selectedCount === 0 || isDownloading ? 'not-allowed' : 'pointer',
              }}
            >
              {isDownloading ? 'Exporting...' : 'Download ZIP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 50)
}
