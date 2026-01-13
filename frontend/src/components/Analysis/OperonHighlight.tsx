import { useState, memo } from 'react'
import { Operon } from '../../models/CircuitModel'
import { describeOperon } from '../../utils/operonDetection'
import { theme, hexToRgba } from '../../utils/themeUtils'

interface OperonHighlightProps {
  operons: Operon[]
  selectedOperonId: string | null
  bpToX: (bp: number) => number
  lineY: number
  lineX: number
  zoom: number
  strandSpacing: number
  baseHeight: number
  onOperonClick?: (operonId: string) => void
  // For matching prefixed IDs from analysis panel
  cellId?: string
  plasmidId?: string
}

/**
 * Visual overlay highlighting detected operons on the DNA strand
 * Shows dotted lines around all operons, solid line for selected
 */
function OperonHighlightInner({
  operons,
  selectedOperonId,
  bpToX,
  lineY,
  lineX,
  strandSpacing,
  baseHeight,
  onOperonClick,
  cellId,
  plasmidId,
}: OperonHighlightProps) {
  const [hoveredOperonId, setHoveredOperonId] = useState<string | null>(null)

  if (operons.length === 0) return null

  // Get the accent color for the current theme
  const accentColor = theme.accentPrimary

  // Calculate the height to span both DNA strands with some padding
  const highlightHeight = strandSpacing + baseHeight + 20
  const highlightTop = lineY - strandSpacing / 2 - baseHeight / 2 - 10

  // Check if an operon matches the selected ID
  // IDs are prefixed as: ${cellId}-${plasmidId}-${operon.id}
  const isOperonSelected = (operon: Operon): boolean => {
    if (!selectedOperonId) return false
    
    // Build the expected prefixed ID for this specific operon
    if (cellId && plasmidId) {
      const expectedId = `${cellId}-${plasmidId}-${operon.id}`
      return selectedOperonId === expectedId
    }
    
    // Fallback: direct match (legacy single-plasmid mode)
    return selectedOperonId === operon.id
  }

  return (
    <>
      {operons.map((operon, index) => {
        const isSelected = isOperonSelected(operon)
        const isHovered = hoveredOperonId === operon.id

        // Use accent color, with a red tint for invalid operons
        const borderColor = operon.isValid ? accentColor : '#e74c3c'
        const bgAlpha = isSelected ? 0.25 : isHovered ? 0.15 : 0.08

        const startX = bpToX(operon.startBp)
        const endX = bpToX(operon.endBp)
        const width = endX - startX

        // Dotted for unselected, solid for selected/hovered
        const borderStyle = isSelected ? 'solid' : isHovered ? 'solid' : 'dashed'
        const borderWidth = isSelected ? 3 : isHovered ? 2 : 2

        return (
          <div
            key={operon.id}
            style={{
              position: 'absolute',
              left: `${lineX + startX}px`,
              top: `${highlightTop}px`,
              width: `${width}px`,
              height: `${highlightHeight}px`,
              background: hexToRgba(borderColor, bgAlpha),
              border: `${borderWidth}px ${borderStyle} ${borderColor}`,
              borderRadius: '4px',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: isSelected ? 2 : 0, // Selected above others
              transition: 'background 0.2s ease, border-width 0.15s ease',
              boxSizing: 'border-box',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // Pass the prefixed ID if we have cell/plasmid context
              const idToPass = cellId && plasmidId ? `${cellId}-${plasmidId}-${operon.id}` : operon.id
              onOperonClick?.(idToPass)
            }}
            onMouseEnter={() => setHoveredOperonId(operon.id)}
            onMouseLeave={() => setHoveredOperonId(null)}
            title={describeOperon(operon)}
          >
            {/* Operon label */}
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '4px',
                fontSize: '10px',
                fontFamily: 'Courier New, monospace',
                fontWeight: 600,
                color: borderColor,
                background: theme.bgPrimary,
                padding: '2px 4px',
                borderRadius: '2px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: isHovered || isSelected ? 1 : 0.7,
                transition: 'opacity 0.2s ease',
                border: isSelected ? `1px solid ${borderColor}` : 'none',
              }}
            >
              Operon {index + 1} {!operon.isValid && '⚠'}
            </div>

            {/* Show structure on hover */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: theme.bgDialog,
                  color: theme.textPrimary,
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'Courier New, monospace',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  border: `1px solid ${theme.borderPrimary}`,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                  {describeOperon(operon)}
                </div>
                <div style={{ fontSize: '9px', color: theme.textMuted }}>
                  {operon.startBp}bp - {operon.endBp}bp ({operon.endBp - operon.startBp}bp)
                </div>
                {operon.warnings.length > 0 && (
                  <div style={{ fontSize: '9px', color: '#f39c12', marginTop: '4px' }}>
                    {operon.warnings.map((w, i) => (
                      <div key={i}>⚠ {w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// PERFORMANCE: Memoize to prevent re-renders when props haven't changed
const OperonHighlight = memo(OperonHighlightInner)
export default OperonHighlight
