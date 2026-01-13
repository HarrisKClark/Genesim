import type { BackboneSpec } from '../../types/backboneTypes'
import { hexToRgba } from '../../utils/themeUtils'

interface PlasmidRendererProps {
  lineX: number
  lineY: number
  totalWidth: number
  zoom: number
  strandSpacing: number
  baseHeight: number
  showAbstractView: boolean
  showBasePairs: boolean
  backbone: BackboneSpec
  isActive: boolean
  isLastPlasmid: boolean
  accentColor: string
  onDeletePlasmid?: () => void
  onEditBackbone?: () => void
  onAddPlasmid?: () => void
}

export default function PlasmidRenderer({
  lineX,
  lineY,
  totalWidth,
  zoom,
  strandSpacing,
  baseHeight,
  showAbstractView,
  showBasePairs,
  backbone,
  isActive,
  isLastPlasmid,
  accentColor,
  onDeletePlasmid,
  onEditBackbone,
  onAddPlasmid,
}: PlasmidRendererProps) {
  const hasBackbone = showAbstractView && !showBasePairs

  // Backbone dimensions
  const bbGap = Math.max(55, Math.min(95, 70 * zoom))
  const bbHeight = Math.round(Math.max(18, Math.min(26, 20 * zoom)))
  const bbPad = Math.round(Math.max(35, Math.min(80, 55 * zoom)))
  const bbLeft = Math.round(lineX - bbPad)
  const bbWidth = Math.round(totalWidth + bbPad * 2)
  const bbTop = Math.round(lineY + strandSpacing / 2 + baseHeight / 2 + bbGap)

  // Connector dimensions
  const stubLen = Math.round(Math.max(14, Math.min(28, 18 * zoom)))
  const arcWidth = Math.round(Math.max(20, Math.min(40, 28 * zoom)))
  const arcHeight = Math.round(bbTop - lineY + bbHeight / 2)
  const connectorXLeft = bbLeft - stubLen
  const connectorXRight = bbLeft + bbWidth + stubLen

  // Format backbone label
  const formatBackboneLabel = (spec: BackboneSpec) => {
    const cn = spec.copyNumber ?? 10
    const ori = spec.originName ?? 'ColE1'
    const res = (spec.resistances ?? []).map((r) => r.code).join('+')
    return `BB_${cn}C_${ori}${res ? `_${res}` : ''}`
  }

  if (!hasBackbone) return null

  return (
    <>
      {/* Left connector */}
      <svg
        className="plasmid-connector-left"
        style={{
          position: 'absolute',
          left: connectorXLeft,
          top: lineY,
          width: arcWidth + stubLen,
          height: arcHeight + bbHeight,
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 2,
        }}
      >
        <path
          d={`
            M ${stubLen} 0
            L 0 0
            L 0 ${arcHeight}
            L ${stubLen} ${arcHeight}
          `}
          fill="none"
          stroke={accentColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Right connector */}
      <svg
        className="plasmid-connector-right"
        style={{
          position: 'absolute',
          left: bbLeft + bbWidth,
          top: lineY,
          width: arcWidth + stubLen,
          height: arcHeight + bbHeight,
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 2,
        }}
      >
        <path
          d={`
            M 0 0
            L ${stubLen} 0
            L ${stubLen} ${arcHeight}
            L 0 ${arcHeight}
          `}
          fill="none"
          stroke={accentColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Backbone bar */}
      <div
        className="backbone-bar"
        style={{
          position: 'absolute',
          left: bbLeft,
          top: bbTop,
          width: bbWidth,
          height: bbHeight,
          background: accentColor,
          borderRadius: bbHeight / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 3,
        }}
        onClick={onEditBackbone}
        title="Click to edit backbone"
      >
        <span
          style={{
            color: '#fff',
            fontFamily: 'Courier New, monospace',
            fontWeight: 600,
            fontSize: Math.max(9, Math.min(12, 10 * zoom)),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 8px',
          }}
        >
          {formatBackboneLabel(backbone)}
        </span>

        {/* Edit pencil button */}
        {isActive && onEditBackbone && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditBackbone()
            }}
            style={{
              position: 'absolute',
              top: -9,
              right: -9,
              width: 18,
              height: 18,
              background: '#fff',
              border: `2px solid ${accentColor}`,
              borderRadius: '50%',
              color: accentColor,
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
            title="Edit backbone"
          >
            ✎
          </button>
        )}
      </div>

      {/* Delete plasmid button (on right connector) */}
      {isActive && onDeletePlasmid && (
        <button
          className="plasmid-delete"
          onClick={(e) => {
            e.stopPropagation()
            onDeletePlasmid()
          }}
          style={{
            position: 'absolute',
            left: connectorXRight - 9,
            top: lineY - 9,
            width: 18,
            height: 18,
            background: '#e74c3c',
            border: '2px solid #c0392b',
            borderRadius: '50%',
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
          title="Delete plasmid"
        >
          ×
        </button>
      )}

      {/* Add plasmid button (only on last plasmid) */}
      {isActive && isLastPlasmid && onAddPlasmid && (
        <button
          className="cell-add-circuit"
          onClick={(e) => {
            e.stopPropagation()
            onAddPlasmid()
          }}
          style={{
            position: 'absolute',
            left: lineX + totalWidth / 2 - 14,
            top: bbTop + bbHeight + 16,
            width: 28,
            height: 28,
            background: hexToRgba(accentColor, 0.15),
            border: `2px solid ${hexToRgba(accentColor, 0.5)}`,
            borderRadius: '50%',
            color: accentColor,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
          title="Add another plasmid to this cell"
        >
          +
        </button>
      )}
    </>
  )
}

