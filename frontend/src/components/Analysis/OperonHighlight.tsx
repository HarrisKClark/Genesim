import { useState } from 'react'
import { Operon } from '../../models/CircuitModel'
import { describeOperon } from '../../utils/operonDetection'

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
}

/**
 * Visual overlay highlighting detected operons on the DNA strand
 * Shows colored regions spanning from promoter to terminator
 */
export default function OperonHighlight({
  operons,
  selectedOperonId,
  bpToX,
  lineY,
  lineX,
  strandSpacing,
  baseHeight,
  onOperonClick,
}: OperonHighlightProps) {
  const [hoveredOperonId, setHoveredOperonId] = useState<string | null>(null)

  if (operons.length === 0) return null

  // Operon colors (alternating hues for visual distinction)
  const operonColors = [
    { valid: 'rgba(74, 144, 226, 0.15)', invalid: 'rgba(231, 76, 60, 0.15)', border: '#4a90e2' }, // Blue
    { valid: 'rgba(46, 204, 113, 0.15)', invalid: 'rgba(231, 76, 60, 0.15)', border: '#2ecc71' }, // Green
    { valid: 'rgba(155, 89, 182, 0.15)', invalid: 'rgba(231, 76, 60, 0.15)', border: '#9b59b6' }, // Purple
    { valid: 'rgba(241, 196, 15, 0.15)', invalid: 'rgba(231, 76, 60, 0.15)', border: '#f1c40f' }, // Yellow
  ]

  // Calculate the height to span both DNA strands with some padding
  const highlightHeight = strandSpacing + baseHeight + 20
  const highlightTop = lineY - strandSpacing / 2 - baseHeight / 2 - 10

  return (
    <>
      {operons.map((operon, index) => {
        const colorSet = operonColors[index % operonColors.length]
        const bgColor = operon.isValid ? colorSet.valid : colorSet.invalid
        const borderColor = colorSet.border

        const startX = bpToX(operon.startBp)
        const endX = bpToX(operon.endBp)
        const width = endX - startX

        const isSelected = selectedOperonId === operon.id
        const isHovered = hoveredOperonId === operon.id

        // Adjust opacity and border for selected/hovered state
        const opacity = isSelected ? 0.3 : isHovered ? 0.25 : 1
        const borderWidth = isSelected ? 3 : isHovered ? 2 : 1

        return (
          <div
            key={operon.id}
            style={{
              position: 'absolute',
              left: `${lineX + startX}px`,
              top: `${highlightTop}px`,
              width: `${width}px`,
              height: `${highlightHeight}px`,
              background: bgColor,
              border: `${borderWidth}px ${isSelected || isHovered ? 'solid' : 'dashed'} ${borderColor}`,
              borderRadius: '4px',
              opacity,
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: 0, // Below components but above DNA
              transition: 'opacity 0.2s ease, border-width 0.15s ease',
              boxSizing: 'border-box',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onOperonClick?.(operon.id)
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
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 4px',
                borderRadius: '2px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: isHovered || isSelected ? 1 : 0.7,
                transition: 'opacity 0.2s ease',
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
                  background: 'rgba(0, 0, 0, 0.85)',
                  color: '#fff',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'Courier New, monospace',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                  {describeOperon(operon)}
                </div>
                <div style={{ fontSize: '9px', color: '#aaa' }}>
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

