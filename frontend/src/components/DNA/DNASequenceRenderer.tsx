import { useState } from 'react'
import { CircuitComponent } from '../../types/dnaTypes'
import { DNASelection } from '../../types/dnaTypes'
import { isInSelection } from '../../utils/selectionUtils'

interface DNASequenceRendererProps {
  dnaSequence: string[]
  dnaLength: number
  components: CircuitComponent[]
  selection: DNASelection | null
  cursorBp: number | null
  cursorPlaced: boolean
  selectedId: string | null
  draggingComponentId: string | null
  showBasePairs: boolean
  showAbstractView: boolean
  transitionFactor: number
  zoom: number
  fontSize: number
  bpPerPixel: number
  totalWidth: number
  lineX: number
  lineY: number
  bpToX: (bp: number) => number
  hasDraggedRef: React.MutableRefObject<boolean>
  dragComponentStartRef: React.MutableRefObject<{ x: number; startBp: number }>
  selectionDragRef: React.MutableRefObject<{
    startCursorPos: number | null
    isDragging: boolean
    hasMoved: boolean
  }>
  onBaseMouseDown: (e: React.MouseEvent) => void
  onCursorMove: (e: React.MouseEvent) => void
  onCursorLeave: () => void
  onBaseEnter: (index: number) => void
  onBaseLeave: () => void
  onComponentClick: (comp: CircuitComponent) => void
  onComponentMouseDown: (e: React.MouseEvent, comp: CircuitComponent) => void
  onComponentDelete: (id: string) => void
  getCursorPositionFromMouse?: (e: React.MouseEvent | MouseEvent) => number | null // For future use
  setCursorPosition?: (pos: number | null) => void // For future use
  setCursorVisible?: (visible: boolean) => void // For future use
  dragGap?: { startBp: number; length: number } | null
  highlightedPartIds?: string[]

  // Part interactions (placed box on DNA)
  onPartMouseDown?: (e: React.MouseEvent, comp: CircuitComponent) => void
  onPartDelete?: (id: string) => void
  onPartContextMenu?: (e: React.MouseEvent, part: any) => void
}

export default function DNASequenceRenderer({
  dnaSequence,
  dnaLength,
  components,
  selection,
  cursorBp,
  cursorPlaced: _cursorPlaced, // For future use
  selectedId,
  draggingComponentId,
  showBasePairs,
  showAbstractView,
  transitionFactor,
  zoom,
  fontSize,
  bpPerPixel,
  totalWidth,
  lineX,
  lineY,
  bpToX,
  hasDraggedRef,
  dragComponentStartRef: _dragComponentStartRef, // For future use
  selectionDragRef: _selectionDragRef, // For future use
  onBaseMouseDown,
  onCursorMove,
  onCursorLeave,
  onBaseEnter,
  onBaseLeave,
  onComponentClick,
  onComponentMouseDown,
  onComponentDelete,
  getCursorPositionFromMouse: _getCursorPositionFromMouse, // For future use
  setCursorPosition: _setCursorPosition, // For future use
  setCursorVisible: _setCursorVisible, // For future use
  dragGap,
  highlightedPartIds,
  onPartMouseDown,
  onPartDelete,
  onPartContextMenu,
}: DNASequenceRendererProps) {
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)
  const baseHeight = Math.max(12, Math.min(24, 12 * zoom))
  const strandSpacing = Math.max(20, Math.min(40, 20 * zoom))
  
  // (gap width is computed inside the base-pair render block where it's used)

  // Calculate antisense strand (complementary sequence)
  const antisenseSequence = dnaSequence.map(base => {
    if (base === 'A') return 'T'
    if (base === 'T') return 'A'
    if (base === 'G') return 'C'
    if (base === 'C') return 'G'
    return base // For 'N' or other bases
  })

  return (
    <>
      {/* Sense strand (top) */}
      {/* 5' label - at the start of the sense strand */}
      <div
        style={{
          position: 'absolute',
          left: `${lineX - 25}px`,
          top: `${lineY - strandSpacing / 2}px`,
          transform: 'translateY(-50%)',
          fontSize: `${Math.max(10, Math.min(14, 10 * zoom))}px`,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          color: '#4a90e2',
          zIndex: 2,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
        5′
      </div>

      {/* Background line for sense strand */}
      <div
        className="dna-line"
        style={{
          position: 'absolute',
          top: `${lineY - strandSpacing / 2}px`,
          left: `${lineX}px`,
          width: `${totalWidth}px`,
          height: `${2 + (baseHeight - 2) * transitionFactor}px`,
          background: '#4a90e2',
          opacity: showBasePairs ? 0.5 : 1,
          zIndex: 1,
          transform: 'translateY(-50%)',
        }}
      />

      {/* 3' label - at the end of the sense strand */}
      <div
        style={{
          position: 'absolute',
          left: `${lineX + totalWidth + 5}px`,
          top: `${lineY - strandSpacing / 2}px`,
          transform: 'translateY(-50%)',
          fontSize: `${Math.max(10, Math.min(14, 10 * zoom))}px`,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          color: '#4a90e2',
          zIndex: 2,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
        3′
      </div>

      {/* Antisense strand (bottom) */}
      {/* 3' label - at the start of the antisense strand */}
      <div
        style={{
          position: 'absolute',
          left: `${lineX - 25}px`,
          top: `${lineY + strandSpacing / 2}px`,
          transform: 'translateY(-50%)',
          fontSize: `${Math.max(10, Math.min(14, 10 * zoom))}px`,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          color: '#4a90e2',
          zIndex: 2,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
        3′
      </div>

      {/* Background line for antisense strand */}
      <div
        className="dna-line antisense"
        style={{
          position: 'absolute',
          top: `${lineY + strandSpacing / 2}px`,
          left: `${lineX}px`,
          width: `${totalWidth}px`,
          height: `${2 + (baseHeight - 2) * transitionFactor}px`,
          background: '#4a90e2',
          opacity: showBasePairs ? 0.5 : 1,
          zIndex: 1,
          transform: 'translateY(-50%)',
        }}
      />

      {/* 5' label - at the end of the antisense strand */}
      <div
        style={{
          position: 'absolute',
          left: `${lineX + totalWidth + 5}px`,
          top: `${lineY + strandSpacing / 2}px`,
          transform: 'translateY(-50%)',
          fontSize: `${Math.max(10, Math.min(14, 10 * zoom))}px`,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          color: '#4a90e2',
          zIndex: 2,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
        5′
      </div>

      {/* Clickable overlay for abstract view - allows cursor/selection in abstract view */}
      {!showBasePairs && (
        <div
          className="abstract-view-overlay"
          style={{
            position: 'absolute',
            top: `${lineY - 100}px`, // Very generous clickable area (100px above center)
            left: `${lineX}px`,
            width: `${totalWidth}px`,
            height: '200px', // Very large clickable area (200px total height) - covers entire strand area and beyond
            zIndex: 5, // Above DNA lines (1) but below cursor (10) and components (2-3)
            pointerEvents: 'auto',
            cursor: 'text',
            backgroundColor: 'transparent',
          }}
          onMouseMove={onCursorMove}
          onMouseLeave={onCursorLeave}
          onMouseDown={(e) => {
            // Only handle if not clicking on a component or control
            const target = e.target as HTMLElement
            if (target.closest('.abstract-component-block') || target.closest('.circuit-node') || target.closest('.canvas-controls') || target.closest('.dna-part-box')) {
              return
            }
            e.preventDefault()
            e.stopPropagation()
            // Let the existing handler calculate cursor position
            onBaseMouseDown(e)
          }}
        />
      )}

      {/* Base pairs - appear and grow as zoom increases */}
      {showBasePairs && (
        <>
          {/* Render bases in expanded bp space (components contribute their own bp tiles) */}
          {(() => {
            const placedComponents = components
              .filter((comp) => comp.position !== undefined)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

            // Mark component bp tiles so we can:
            // - make their per-base background transparent (box provides the background)
            // - prevent per-bp selection/edit interactions (box drag/delete handles interaction)
            const componentIdByBp = new Array(dnaLength).fill(null) as Array<string | null>
            for (const comp of placedComponents) {
              const start = Math.max(0, Math.min(dnaLength, Math.round(comp.position!)))
              const len = Math.max(0, Math.round(comp.length))
              const end = Math.max(start, Math.min(dnaLength, start + len))
              for (let i = start; i < end; i++) {
                componentIdByBp[i] = comp.id
              }
            }
            if (dragGap) {
              const start = Math.max(0, Math.min(dnaLength, Math.round(dragGap.startBp)))
              const end = Math.max(start, Math.min(dnaLength, start + Math.max(0, Math.round(dragGap.length))))
              for (let i = start; i < end; i++) {
                componentIdByBp[i] = '__preview__'
              }
            }

            const strandWidthPx = totalWidth

            return (
              <>
                {/* Placed components (rendered at their insertion boundary) */}
                {placedComponents.map((comp) => {
                  const position = comp.position!
                  const length = comp.length
                  const compWidth = length / bpPerPixel
                  const compLeftX = bpToX(position)
                  
                  // Component letters are rendered as regular base tiles on the strand.

                  // Pixel-align everything to avoid tiny seams/gaps from subpixel gradients
                  // Ensure enough top padding to fit delete button without covering letters
                  const overhangPx = Math.max(22, Math.round(baseHeight * 0.35))
                  const baseHeightPx = Math.round(baseHeight)
                  const strandSpacingPx = Math.round(strandSpacing)
                  const boxHeightPx = strandSpacingPx + baseHeightPx + (overhangPx * 2)

                  // Use component color (same as abstract view) instead of gray
                  // Convert hex color to rgba for the gradient
                  const componentColor = comp.color || '#95a5a6' // fallback to gray
                  // Helper to convert hex to rgba
                  const hexToRgba = (hex: string, alpha: number) => {
                    const r = parseInt(hex.slice(1, 3), 16)
                    const g = parseInt(hex.slice(3, 5), 16)
                    const b = parseInt(hex.slice(5, 7), 16)
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`
                  }
                  // Only the two letter rows should be see-through (but still mostly opaque so you don't
                  // see underlying bases shifting during drag)
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

                  const isHovered = hoveredPartId === comp.id
                  const isHighlighted = (highlightedPartIds || []).includes(comp.id)

                  return (
                    <div
                      key={`dna-part-box-${comp.id}`}
                      className="dna-part-box"
                      style={{
                        position: 'absolute',
                        left: `${lineX + compLeftX}px`,
                        top: `${lineY - (strandSpacingPx + baseHeightPx) / 2 - overhangPx}px`,
                        width: `${compWidth}px`,
                        height: `${boxHeightPx}px`,
                        background: bg,
                        border: `2px solid ${isHovered ? '#4a90e2' : isHighlighted ? '#e67e22' : '#6f6f6f'}`,
                        borderRadius: '2px',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        zIndex: 2,
                        boxShadow: isHovered
                          ? '0 0 4px rgba(74, 144, 226, 0.5)'
                          : isHighlighted
                            ? '0 0 6px rgba(230, 126, 34, 0.55)'
                            : 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={() => setHoveredPartId(comp.id)}
                      onMouseLeave={() => setHoveredPartId((prev) => (prev === comp.id ? null : prev))}
                      onContextMenu={(e) => {
                        onPartContextMenu?.(e, {
                          source: 'placed',
                          id: comp.id,
                          type: comp.type,
                          name: comp.name,
                          subType: comp.subType,
                          color: comp.color,
                          length: comp.length,
                          position: comp.position,
                        })
                      }}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('.dna-part-delete')) return
                        onPartMouseDown?.(e, comp)
                      }}
                    >
                      {/* Delete control (only on hover) */}
                      {isHovered && (
                        <button
                          type="button"
                          className="dna-part-delete"
                          title="Delete part"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onPartDelete?.(comp.id)
                          }}
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 3,
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: '1px solid rgba(0,0,0,0.35)',
                            background: 'rgba(245,245,245,0.95)',
                            color: '#222',
                            fontSize: 13,
                            lineHeight: '14px',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          }}
                        >
                          ×
                        </button>
                      )}

                      {/* Letters are rendered as regular base tiles on the strand.
                          The box only provides background/border + interactions. */}
                    </div>
                  )
                })}
                
                {/* Sense strand bases (top) */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${lineY - strandSpacing / 2}px`,
                    left: `${lineX}px`,
                    width: `${strandWidthPx}px`,
                    height: `${baseHeight}px`,
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                    opacity: showBasePairs ? 1 : 0,
                    display: showBasePairs ? 'flex' : 'none',
                    alignItems: 'center',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}
                  onMouseMove={onCursorMove}
                  onMouseLeave={onCursorLeave}
                >
                  {/* Render all bases (expanded) */}
                  {dnaSequence.map((base, index) => {
                          const baseBgColor = {
                            A: '#e74c3c',
                            T: '#3498db',
                            G: '#2ecc71',
                            C: '#f39c12',
                            N: '#999',
                          }[base] || '#666'

                          const isComponentBase = componentIdByBp[index] !== null
                          const xLeft = bpToX(index)
                          const seamlessWidth = 1 / bpPerPixel
                          const isSelected = selection ? isInSelection(index, selection.startBp, selection.endBp, dnaLength) : false
                          const isHovered = cursorBp === index

                          return (
                            <span
                              key={`sense-${index}`}
                              data-bp-index={isComponentBase ? undefined : index}
                              style={{
                                position: 'absolute',
                                left: `${xLeft}px`,
                                width: `${seamlessWidth}px`,
                                minWidth: `${seamlessWidth}px`,
                                height: `${baseHeight}px`,
                                fontSize: `${fontSize}px`,
                                color: '#000',
                                fontFamily: 'Courier New, monospace',
                                fontWeight: '700',
                                textAlign: 'center',
                                lineHeight: `${baseHeight}px`,
                                transition: 'opacity 0.2s ease',
                                backgroundColor: isComponentBase
                                  ? 'transparent'
                                  : isSelected
                                    ? '#ffffff'
                                    : isHovered
                                      ? `${baseBgColor}dd`
                                      : baseBgColor,
                                cursor: isComponentBase ? 'default' : 'text',
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                boxSizing: 'border-box',
                                pointerEvents: isComponentBase ? 'none' : 'auto',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                              }}
                              onMouseEnter={isComponentBase ? undefined : () => onBaseEnter(index)}
                              onMouseLeave={isComponentBase ? undefined : onBaseLeave}
                              onMouseDown={isComponentBase ? undefined : onBaseMouseDown}
                            >
                              {base}
                            </span>
                          )
                        })}
                </div>

                {/* Antisense strand bases (bottom) */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${lineY + strandSpacing / 2}px`,
                    left: `${lineX}px`,
                    width: `${strandWidthPx}px`,
                    height: `${baseHeight}px`,
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                    opacity: showBasePairs ? 1 : 0,
                    display: showBasePairs ? 'flex' : 'none',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}
                >
                  {/* Render all bases (expanded) */}
                  {antisenseSequence.map((base, index) => {
                          const isComponentBase = componentIdByBp[index] !== null
                          const xLeft = bpToX(index)
                          const seamlessWidth = 1 / bpPerPixel

                          const baseBgColor = {
                            A: '#e74c3c',
                            T: '#3498db',
                            G: '#2ecc71',
                            C: '#f39c12',
                            N: '#999',
                          }[base] || '#666'

                          const isSelected = selection ? isInSelection(index, selection.startBp, selection.endBp, dnaLength) : false

                          return (
                            <span
                              key={`antisense-${index}`}
                              style={{
                                position: 'absolute',
                                left: `${xLeft}px`,
                                width: `${seamlessWidth}px`,
                                minWidth: `${seamlessWidth}px`,
                                height: `${baseHeight}px`,
                                fontSize: `${fontSize}px`,
                                color: '#000',
                                fontFamily: 'Courier New, monospace',
                                fontWeight: '700',
                                textAlign: 'center',
                                lineHeight: `${baseHeight}px`,
                                transition: 'opacity 0.2s ease',
                                backgroundColor: isComponentBase
                                  ? 'transparent'
                                  : isSelected
                                    ? '#ffffff'
                                    : `${baseBgColor}aa`,
                                cursor: 'default',
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                boxSizing: 'border-box',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                              }}
                            >
                              {base}
                            </span>
                          )
                        })}
                </div>
              </>
            )
          })()}
        </>
      )}

      {/* BP markers and ticks - always visible in both views */}
      <div
        style={{
          position: 'absolute',
          top: `${lineY + strandSpacing / 2 + baseHeight / 2 + 12}px`,
          left: `${lineX}px`,
          width: `${totalWidth}px`,
          height: '40px',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        {/* 10bp minor ticks */}
        {Array.from({ length: Math.floor(dnaLength / 10) + 1 }, (_, i) => {
          const bpPosition = i * 10
          if (bpPosition >= dnaLength || bpPosition % 100 === 0) return null
          const x = bpToX(bpPosition)
          return (
            <div
              key={`global-tick-10-${bpPosition}`}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: 0,
                width: '1px',
                height: '5px',
                background: '#666',
              }}
            />
          )
        })}
        {/* 100bp major markers with labels */}
        {Array.from({ length: Math.floor(dnaLength / 100) + 1 }, (_, i) => {
          const bpPosition = i * 100
          if (bpPosition >= dnaLength) return null
          const x = bpToX(bpPosition)
          return (
            <div
              key={`global-marker-${bpPosition}`}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '2px',
                  height: '12px',
                  background: '#4a90e2',
                  marginBottom: '4px',
                }}
              />
              <div
                style={{
                  fontSize: '13px',
                  fontFamily: 'Courier New, monospace',
                  color: '#4a90e2',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }}
              >
                {bpPosition}bp
              </div>
            </div>
          )
        })}
      </div>

      {/* NEW: Render components as abstract blocks - same positioning logic as DNA view */}
      {showAbstractView && components.filter((comp) => comp.position !== undefined && comp.type !== 'test-part').map((comp) => {
        // NEW: Use position system
        const position = comp.position!
        const length = comp.length
        const compWidth = length / bpPerPixel
        const compLeftX = bpToX(position)
        const isSelected = selectedId === comp.id
        const isDragging = draggingComponentId === comp.id
        const isInSelection = (highlightedPartIds || []).includes(comp.id)

        // Calculate height to span both strands (top to bottom) and scale with zoom
        const abstractBoxHeight = strandSpacing + baseHeight
        const abstractBoxTop = lineY - strandSpacing / 2 - baseHeight / 2

        return (
          <div
            key={comp.id}
            className={`abstract-component-block ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isInSelection ? 'in-selection' : ''}`}
            style={{
              position: 'absolute',
              left: `${compLeftX + lineX}px`,
              top: `${abstractBoxTop}px`,
              width: `${compWidth}px`,
              height: `${abstractBoxHeight}px`,
              background: comp.color,
              border: isSelected 
                ? '2px solid #fff' 
                : isInSelection 
                  ? '3px solid rgba(74, 144, 226, 0.9)' // Highlighted selection border
                  : '1px solid #333',
              zIndex: isDragging ? 8 : 6, // Above overlay (5) but below cursor (10)
              display: showAbstractView ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${Math.max(8, Math.min(14, 8 * zoom))}px`, // Scale font with zoom
              color: '#fff',
              fontFamily: 'Courier New, monospace',
              fontWeight: '600',
              cursor: isDragging ? 'grabbing' : 'move',
              pointerEvents: 'auto',
              opacity: showAbstractView ? (isDragging ? 0.8 : 1) : 0,
              boxShadow: isSelected 
                ? '0 0 4px rgba(255, 255, 255, 0.5)' 
                : isInSelection 
                  ? '0 0 8px rgba(74, 144, 226, 0.6)' // Glow for parts in selection
                  : 'none',
              transition: isDragging ? 'none' : 'box-shadow 0.2s ease, border 0.2s ease',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
            onContextMenu={(e) => {
              onPartContextMenu?.(e, {
                source: 'placed',
                id: comp.id,
                type: comp.type,
                name: comp.name,
                subType: comp.subType,
                color: comp.color,
                length: comp.length,
                position: comp.position,
              })
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!hasDraggedRef.current) {
                onComponentClick(comp)
              }
            }}
            onMouseDown={(e) => onComponentMouseDown(e, comp)}
            onMouseEnter={(e) => {
              if (!isSelected && !isDragging) {
                e.currentTarget.style.boxShadow = '0 0 2px rgba(255, 255, 255, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !isDragging) {
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            {comp.name}
            {isSelected && (
              <button
                className="abstract-block-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onComponentDelete(comp.id)
                }}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '16px',
                  height: '16px',
                  background: '#e74c3c',
                  border: '1px solid #c0392b',
                  borderRadius: '50%',
                  color: '#fff',
                  fontSize: '12px',
                  lineHeight: '1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  zIndex: 4,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

