import { Operon } from '../../models/CircuitModel'
import { getOperonLength } from '../../utils/operonDetection'

interface OperonCardProps {
  operon: Operon
  index: number
  isSelected: boolean
  onClick: () => void
}

/**
 * Card displaying operon information in the analysis panel
 */
export default function OperonCard({
  operon,
  index,
  isSelected,
  onClick,
}: OperonCardProps) {
  const geneCount = operon.rbsGenePairs.length
  const length = getOperonLength(operon)

  return (
    <div
      className={`operon-card ${isSelected ? 'selected' : ''} ${operon.isValid ? 'valid' : 'invalid'}`}
      onClick={onClick}
      style={{
        padding: '8px 10px',
        margin: '4px 0',
        background: isSelected ? '#4a90e2' : operon.isValid ? '#f5f5f5' : '#fee',
        border: `1px solid ${isSelected ? '#2d5aa0' : operon.isValid ? '#ccc' : '#e74c3c'}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = operon.isValid ? '#e8e8e8' : '#fdd'
          e.currentTarget.style.borderColor = '#999'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = operon.isValid ? '#f5f5f5' : '#fee'
          e.currentTarget.style.borderColor = operon.isValid ? '#ccc' : '#e74c3c'
        }
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: '4px',
          color: isSelected ? '#fff' : '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Operon {index + 1}</span>
        <span style={{ fontSize: '9px', opacity: 0.8 }}>
          {length}bp
        </span>
      </div>

      <div
        style={{
          fontSize: '9px',
          color: isSelected ? 'rgba(255,255,255,0.9)' : '#555',
          marginBottom: '3px',
        }}
      >
        {operon.promoter.name} → {geneCount} gene{geneCount !== 1 ? 's' : ''}
      </div>

      {/* Gene list */}
      <div
        style={{
          fontSize: '8px',
          color: isSelected ? 'rgba(255,255,255,0.8)' : '#777',
          marginBottom: '3px',
        }}
      >
        {operon.rbsGenePairs.map((pair, i) => (
          <div key={i}>
            • {pair.rbs.name} → {pair.gene.name}
          </div>
        ))}
      </div>

      {/* Status */}
      <div
        style={{
          fontSize: '8px',
          color: isSelected ? 'rgba(255,255,255,0.9)' : operon.isValid ? '#27ae60' : '#e74c3c',
          fontWeight: 600,
          marginTop: '4px',
        }}
      >
        {operon.terminator ? `✓ ${operon.terminator.name}` : '⚠ No terminator'}
      </div>

      {/* Warnings */}
      {operon.warnings.length > 0 && !isSelected && (
        <div
          style={{
            fontSize: '8px',
            color: '#e67e22',
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px solid #ddd',
          }}
        >
          {operon.warnings.slice(0, 2).map((warning, i) => (
            <div key={i}>⚠ {warning}</div>
          ))}
          {operon.warnings.length > 2 && (
            <div>...and {operon.warnings.length - 2} more</div>
          )}
        </div>
      )}
    </div>
  )
}

