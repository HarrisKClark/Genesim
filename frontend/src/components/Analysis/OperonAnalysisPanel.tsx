import { useMemo } from 'react'
import { Operon, ValidationResult } from '../../models/CircuitModel'
import { CircuitModel } from '../../models/CircuitModel'
import { CircuitComponent } from '../../types/dnaTypes'
import { theme } from '../../utils/themeUtils'

// Type for culture cells passed from Layout
interface CultureCell {
  id: string
  cellType: string
  cellName: string
  circuits: Array<{
    id: string
    components: CircuitComponent[]
    dnaLength?: number
  }>
}

interface OperonAnalysisPanelProps {
  cultureCells?: CultureCell[]
  // Legacy single-plasmid props (fallback)
  operons?: Operon[]
  validationResult?: ValidationResult | null
  selectedOperonId: string | null
  showHighlights: boolean
  onOperonSelect: (operonId: string | null) => void
  onHighlightToggle: (show: boolean) => void
}

interface PlasmidOperons {
  plasmidId: string
  plasmidIndex: number
  operons: Operon[]
  validationResult: ValidationResult
}

interface CellOperons {
  cellId: string
  cellType: string
  cellName: string
  plasmids: PlasmidOperons[]
}

/**
 * Analysis panel for operon detection
 * Shows tree: Cell -> Plasmid -> Operons
 */
export default function OperonAnalysisPanel({
  cultureCells = [],
  operons: legacyOperons = [],
  validationResult: legacyValidation = null,
  selectedOperonId,
  showHighlights,
  onOperonSelect,
  onHighlightToggle,
}: OperonAnalysisPanelProps) {

  // Analyze all cells/plasmids
  const cellOperons: CellOperons[] = useMemo(() => {
    if (cultureCells.length === 0) {
      // Fallback to legacy single plasmid mode
      if (legacyOperons.length > 0 || legacyValidation) {
        return [{
          cellId: 'legacy',
          cellType: 'Cell',
          cellName: 'Current',
          plasmids: [{
            plasmidId: 'legacy-plasmid',
            plasmidIndex: 0,
            operons: legacyOperons,
            validationResult: legacyValidation || { isValid: true, errors: [], warnings: [], operons: legacyOperons },
          }],
        }]
      }
      return []
    }

    return cultureCells.map((cell) => ({
      cellId: cell.id,
      cellType: cell.cellType,
      cellName: cell.cellName,
      plasmids: (cell.circuits || []).map((circuit, idx) => {
        const model = new CircuitModel(circuit.components || [], circuit.dnaLength || 1000)
        const validation = model.validateCircuit()
        // Make operon IDs unique by prefixing with cell and plasmid IDs
        const uniqueOperons = validation.operons.map((op) => ({
          ...op,
          id: `${cell.id}-${circuit.id}-${op.id}`,
        }))
        return {
          plasmidId: circuit.id,
          plasmidIndex: idx,
          operons: uniqueOperons,
          validationResult: { ...validation, operons: uniqueOperons },
        }
      }),
    }))
  }, [cultureCells, legacyOperons, legacyValidation])

  // Total counts
  const totalOperons = cellOperons.reduce(
    (sum, c) => sum + c.plasmids.reduce((s, p) => s + p.operons.length, 0),
    0
  )
  const validCount = cellOperons.reduce(
    (sum, c) => sum + c.plasmids.reduce((s, p) => s + p.operons.filter(o => o.isValid).length, 0),
    0
  )
  const invalidCount = totalOperons - validCount

  return (
    <div
      style={{
        padding: '10px',
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: theme.textPrimary,
      }}
    >
      {/* Header with toggle */}
      <div
        style={{
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `1px solid ${theme.borderSecondary}`,
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px',
          }}
        >
          <input
            type="checkbox"
            checked={showHighlights}
            onChange={(e) => onHighlightToggle(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: theme.accentPrimary }}
          />
          Show Operon Highlights
        </label>
      </div>

      {/* Summary stats */}
      <div
        style={{
          background: theme.bgSecondary,
          padding: '6px 8px',
          borderRadius: '3px',
          marginBottom: '10px',
          fontSize: '10px',
          border: `1px solid ${theme.borderLight}`,
        }}
      >
        <div style={{ marginBottom: '2px' }}>
          <strong>Detected:</strong> {totalOperons} operon{totalOperons !== 1 ? 's' : ''}
        </div>
        {totalOperons > 0 && (
          <div style={{ fontSize: '9px', color: theme.textMuted }}>
            {validCount > 0 && <span style={{ color: '#27ae60' }}>✓ {validCount} valid</span>}
            {validCount > 0 && invalidCount > 0 && <span> | </span>}
            {invalidCount > 0 && <span style={{ color: '#e67e22' }}>⚠ {invalidCount} warnings</span>}
          </div>
        )}
      </div>

      {/* Tree view */}
      {cellOperons.length > 0 ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {cellOperons.map((cell) => (
            <div key={cell.cellId} style={{ marginBottom: '12px' }}>
              {/* Cell header */}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '11px',
                  color: theme.accentPrimary,
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '10px' }}>▼</span>
                {cell.cellType}: {cell.cellName}
              </div>

              {/* Plasmids */}
              {cell.plasmids.map((plasmid) => (
                <div
                  key={plasmid.plasmidId}
                  style={{
                    marginLeft: '12px',
                    marginBottom: '8px',
                    borderLeft: `2px solid ${theme.borderLight}`,
                    paddingLeft: '10px',
                  }}
                >
                  {/* Plasmid header */}
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '10px',
                      color: theme.textSecondary,
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '9px' }}>◦</span>
                    Plasmid {plasmid.plasmidIndex + 1}
                    <span style={{ fontWeight: 400, color: theme.textMuted }}>
                      ({plasmid.operons.length} operon{plasmid.operons.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {/* Operons */}
                  {plasmid.operons.length > 0 ? (
                    plasmid.operons.map((operon, idx) => (
                      <OperonItem
                        key={operon.id}
                        operon={operon}
                        index={idx}
                        isSelected={selectedOperonId === operon.id}
                        onClick={() => {
                          if (selectedOperonId === operon.id) {
                            onOperonSelect(null)
                          } else {
                            onOperonSelect(operon.id)
                            if (!showHighlights) {
                              onHighlightToggle(true)
                            }
                          }
                        }}
                      />
                    ))
                  ) : (
                    <div
                      style={{
                        fontSize: '9px',
                        color: theme.textMuted,
                        marginLeft: '16px',
                        fontStyle: 'italic',
                      }}
                    >
                      No operons
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.textMuted,
            fontSize: '10px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <div>
            <div style={{ marginBottom: '8px' }}>No operons detected</div>
            <div style={{ fontSize: '9px', color: theme.textHint }}>
              Add a promoter, RBS, and gene to create an operon
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mini operon item for the tree
function OperonItem({
  operon,
  index,
  isSelected,
  onClick,
}: {
  operon: Operon
  index: number
  isSelected: boolean
  onClick: () => void
}) {
  const geneCount = operon.rbsGenePairs.length

  return (
    <div
      onClick={onClick}
      style={{
        marginLeft: '16px',
        padding: '6px 8px',
        marginBottom: '4px',
        background: isSelected ? theme.accentPrimary : theme.bgInput,
        border: `2px solid ${isSelected ? theme.accentHover : operon.isValid ? theme.borderLight : '#e74c3c'}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontSize: '9px',
        boxShadow: isSelected ? `0 0 8px ${theme.accentPrimary}` : 'none',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: isSelected ? theme.textOnAccent : theme.textPrimary,
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2px',
        }}
      >
        <span>Operon {index + 1}</span>
        <span style={{ fontWeight: 400, opacity: 0.8 }}>
          {operon.promoter.name} → {geneCount} gene{geneCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div
        style={{
          fontSize: '8px',
          color: isSelected ? 'rgba(255,255,255,0.85)' : theme.textMuted,
        }}
      >
        {operon.rbsGenePairs.map((p) => p.gene.name).join(', ')}
      </div>
      <div
        style={{
          fontSize: '8px',
          marginTop: '2px',
          color: isSelected ? 'rgba(255,255,255,0.9)' : operon.isValid ? '#27ae60' : '#e74c3c',
        }}
      >
        {operon.terminator ? `✓ ${operon.terminator.name}` : '⚠ No terminator'}
      </div>
    </div>
  )
}
