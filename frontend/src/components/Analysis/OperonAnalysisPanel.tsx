import { Operon, ValidationResult } from '../../models/CircuitModel'
import OperonCard from './OperonCard'

interface OperonAnalysisPanelProps {
  operons: Operon[]
  validationResult: ValidationResult | null
  selectedOperonId: string | null
  showHighlights: boolean
  onOperonSelect: (operonId: string | null) => void
  onHighlightToggle: (show: boolean) => void
}

/**
 * Analysis panel for operon detection
 * Shows list of detected operons and validation results
 */
export default function OperonAnalysisPanel({
  operons,
  validationResult,
  selectedOperonId,
  showHighlights,
  onOperonSelect,
  onHighlightToggle,
}: OperonAnalysisPanelProps) {
  const validCount = operons.filter(op => op.isValid).length
  const invalidCount = operons.filter(op => !op.isValid).length

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
      }}
    >
      {/* Header with toggle */}
      <div
        style={{
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #aaa',
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
            style={{ cursor: 'pointer' }}
          />
          Show Operon Highlights
        </label>
      </div>

      {/* Summary stats */}
      <div
        style={{
          background: '#f5f5f5',
          padding: '6px 8px',
          borderRadius: '3px',
          marginBottom: '10px',
          fontSize: '10px',
        }}
      >
        <div style={{ marginBottom: '2px' }}>
          <strong>Detected:</strong> {operons.length} operon{operons.length !== 1 ? 's' : ''}
        </div>
        {operons.length > 0 && (
          <div style={{ fontSize: '9px', color: '#666' }}>
            {validCount > 0 && <span style={{ color: '#27ae60' }}>✓ {validCount} valid</span>}
            {validCount > 0 && invalidCount > 0 && <span> | </span>}
            {invalidCount > 0 && <span style={{ color: '#e67e22' }}>⚠ {invalidCount} warnings</span>}
          </div>
        )}
      </div>

      {/* Operon list */}
      {operons.length > 0 ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {operons.map((operon, index) => (
            <OperonCard
              key={operon.id}
              operon={operon}
              index={index}
              isSelected={selectedOperonId === operon.id}
              onClick={() => {
                if (selectedOperonId === operon.id) {
                  onOperonSelect(null) // Deselect if already selected
                } else {
                  onOperonSelect(operon.id)
                  if (!showHighlights) {
                    onHighlightToggle(true) // Auto-enable highlights when selecting
                  }
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '10px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <div>
            <div style={{ marginBottom: '8px' }}>No operons detected</div>
            <div style={{ fontSize: '9px', color: '#bbb' }}>
              Add a promoter, RBS, and gene to create an operon
            </div>
          </div>
        </div>
      )}

      {/* Validation warnings/errors */}
      {validationResult && (validationResult.warnings.length > 0 || validationResult.errors.length > 0) && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid #aaa',
            fontSize: '9px',
            maxHeight: '100px',
            overflowY: 'auto',
          }}
        >
          {validationResult.errors.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: 600, color: '#e74c3c', marginBottom: '2px' }}>
                Errors:
              </div>
              {validationResult.errors.map((error, i) => (
                <div key={i} style={{ color: '#c0392b', marginLeft: '8px' }}>
                  • {error}
                </div>
              ))}
            </div>
          )}
          {validationResult.warnings.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: '#e67e22', marginBottom: '2px' }}>
                Circuit Warnings:
              </div>
              {validationResult.warnings.slice(0, 5).map((warning, i) => (
                <div key={i} style={{ color: '#d68910', marginLeft: '8px' }}>
                  • {warning}
                </div>
              ))}
              {validationResult.warnings.length > 5 && (
                <div style={{ color: '#999', marginLeft: '8px' }}>
                  ...and {validationResult.warnings.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}



