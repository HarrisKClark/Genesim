import { COMPONENT_COLORS } from '../../constants/circuitConstants'

interface DragPreviewPosition {
  bp: number
  componentLength: number
  componentType: string
  componentName: string
  blockedPartIds?: string[]
  snappedFromBlocked?: boolean
}

interface DragPreviewOverlayProps {
  dragPreviewPosition: DragPreviewPosition | null
  showBasePairs: boolean
  zoom: number
  bpToX: (bp: number) => number
  bpPerPixel: number
  lineX: number
  lineY: number
  baseHeight: number
  strandSpacing: number
  fontSize: number
}

/**
 * Renders the drag preview overlay when dragging components onto the DNA canvas
 * Shows different visuals for DNA view (with N bases) vs Abstract view (solid block)
 */
export default function DragPreviewOverlay({
  dragPreviewPosition,
  showBasePairs,
  zoom,
  bpToX,
  bpPerPixel,
  lineX,
  lineY,
  baseHeight,
  strandSpacing,
  fontSize,
}: DragPreviewOverlayProps) {
  if (!dragPreviewPosition) return null

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const componentColor = COMPONENT_COLORS[dragPreviewPosition.componentType] || '#95a5a6'
  const borderColor = dragPreviewPosition.snappedFromBlocked ? '#e67e22' : (showBasePairs ? '#6f6f6f' : '#333')

  // DNA view: show detailed box with N bases
  if (showBasePairs) {
    const gapStartBp = dragPreviewPosition.bp
    const gapLength = dragPreviewPosition.componentLength
    const gapLeftX = bpToX(gapStartBp)
    const gapWidth = gapLength / bpPerPixel
    const gapCenterX = gapLeftX + gapWidth / 2

    const overhangPx = Math.max(22, Math.round(baseHeight * 0.35))
    const baseHeightPx = Math.round(baseHeight)
    const strandSpacingPx = Math.round(strandSpacing)
    const boxHeightPx = strandSpacingPx + baseHeightPx + (overhangPx * 2)

    const solid = hexToRgba(componentColor, 1)
    const strip = hexToRgba(componentColor, 0.82)
    const topStripStartPx = overhangPx
    const topStripEndPx = overhangPx + baseHeightPx
    const bottomStripStartPx = overhangPx + strandSpacingPx
    const bottomStripEndPx = overhangPx + strandSpacingPx + baseHeightPx
    const bg = `linear-gradient(to bottom,
      ${solid} 0px,
      ${solid} ${topStripStartPx}px,
      ${strip} ${topStripStartPx}px,
      ${strip} ${topStripEndPx}px,
      ${solid} ${topStripEndPx}px,
      ${solid} ${bottomStripStartPx}px,
      ${strip} ${bottomStripStartPx}px,
      ${strip} ${bottomStripEndPx}px,
      ${solid} ${bottomStripEndPx}px,
      ${solid} ${boxHeightPx}px
    )`

    return (
      <div
        style={{
          position: 'absolute',
          left: `${lineX + gapCenterX}px`,
          top: `${lineY - (strandSpacingPx + baseHeightPx) / 2 - overhangPx}px`,
          width: `${gapWidth}px`,
          height: `${boxHeightPx}px`,
          background: bg,
          border: `2px solid ${borderColor}`,
          borderRadius: '2px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1000,
          transform: 'translateX(-50%)',
          transition: 'none',
        }}
      >
        {/* Top strand N bases */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${topStripStartPx}px`,
            height: `${baseHeightPx}px`,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, gapLength)}, 1fr)`,
            pointerEvents: 'none',
            fontFamily: 'Courier New, monospace',
            fontWeight: 700,
            fontSize: `${fontSize}px`,
            color: '#000',
            lineHeight: `${baseHeightPx}px`,
            textShadow: '0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {Array.from({ length: Math.max(1, gapLength) }, (_, i) => (
            <div key={`tp-prev-s-${i}`} style={{ textAlign: 'center', userSelect: 'none' }}>
              N
            </div>
          ))}
        </div>
        {/* Bottom strand N bases */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${bottomStripStartPx}px`,
            height: `${baseHeightPx}px`,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, gapLength)}, 1fr)`,
            pointerEvents: 'none',
            fontFamily: 'Courier New, monospace',
            fontWeight: 700,
            fontSize: `${fontSize}px`,
            color: '#000',
            lineHeight: `${baseHeightPx}px`,
            opacity: 0.95,
            textShadow: '0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {Array.from({ length: Math.max(1, gapLength)}, (_, i) => (
            <div key={`tp-prev-a-${i}`} style={{ textAlign: 'center', userSelect: 'none' }}>
              N
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Abstract view: show solid colored block
  const startBp = dragPreviewPosition.bp
  const length = dragPreviewPosition.componentLength
  const startX = bpToX(startBp)
  const width = length / bpPerPixel

  const abstractBoxHeight = strandSpacing + baseHeight
  const abstractBoxTop = lineY - strandSpacing / 2 - baseHeight / 2

  return (
    <div
      style={{
        position: 'absolute',
        left: `${lineX + startX}px`,
        top: `${abstractBoxTop}px`,
        width: `${width}px`,
        height: `${abstractBoxHeight}px`,
        background: componentColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '2px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1000,
        transition: 'none',
        boxShadow: '0 0 4px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(8, Math.min(14, 8 * zoom))}px`,
        color: '#fff',
        fontFamily: 'Courier New, monospace',
        fontWeight: 600,
        opacity: 0.9,
      }}
    >
      {dragPreviewPosition.componentName}
    </div>
  )
}

