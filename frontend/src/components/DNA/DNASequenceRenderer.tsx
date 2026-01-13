import { useState, useMemo, memo, useCallback } from 'react'
import { CircuitComponent } from '../../types/dnaTypes'
import { DNASelection } from '../../types/dnaTypes'
import { isInSelection } from '../../utils/selectionUtils'
import type { BackboneSpec } from '../../types/backboneTypes'
import { formatBackboneLabel } from '../../types/backboneTypes'
import { theme, hexToRgba } from '../../utils/themeUtils'

// Base color lookup (constant, outside component)
const BASE_COLORS: Record<string, string> = {
  A: '#e74c3c',
  T: '#3498db',
  G: '#2ecc71',
  C: '#f39c12',
  N: '#999',
}

// Complement map for antisense strand
const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  N: 'N',
}

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

  // Backbone (visual + metadata)
  backbone?: BackboneSpec
  onEditBackbone?: () => void
  backboneSelected?: boolean
  onSelectBackbone?: () => void
  cellType?: string
  cellName?: string
  onAddCircuitInCell?: () => void

  /** When rendering plasmids inside a cell, the cell frame/label/+ are drawn by the parent. */
  suppressCellFrame?: boolean
}

// PERFORMANCE: Wrap in React.memo to prevent unnecessary re-renders
function DNASequenceRendererInner({
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
  backbone,
  onEditBackbone,
  backboneSelected = false,
  onSelectBackbone,
  cellType = 'MG1655',
  cellName = 'Repressilator',
  onAddCircuitInCell,
  suppressCellFrame = false,
}: DNASequenceRendererProps) {
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)
  
  // Get accent color from centralized theme - recomputes on each render to pick up theme changes
  const accentColor = theme.accentPrimary
  
  const baseHeight = Math.max(12, Math.min(24, 12 * zoom))
  const strandSpacing = Math.max(20, Math.min(40, 20 * zoom))
  const showBackbone = showAbstractView && !showBasePairs
  const backboneGap = Math.max(55, Math.min(95, 70 * zoom))
  // Snap backbone + connector geometry to whole pixels to avoid subtle anti-aliasing asymmetry.
  const backboneY = Math.round(lineY + strandSpacing / 2 + baseHeight / 2 + backboneGap)
  const backboneHeight = Math.round(Math.max(18, Math.min(26, 20 * zoom)))
  // Backbone should be slightly longer than the insert, but not excessively wide.
  const backbonePad = Math.round(Math.max(35, Math.min(80, 55 * zoom)))
  const backboneLeft = Math.round(lineX - backbonePad)
  const backboneWidth = Math.round(totalWidth + backbonePad * 2)
  const backboneStubLen = Math.round(Math.max(14, Math.min(28, 18 * zoom)))
  const backboneStubThickness = 2
  const backboneMidY = Math.round(backboneY + backboneHeight / 2)
  const insertMidY = Math.round(lineY)
  const insertOverlayPad = Math.round(Math.max(40, Math.min(70, 50 * zoom)))
  const connectorVerticalHeight = Math.max(0, backboneMidY - insertMidY)
  const connectorXLeft = Math.round(backboneLeft - backboneStubLen)
  const connectorXRight = Math.round(backboneLeft + backboneWidth + backboneStubLen)
  const topArmLen = Math.round(backboneStubLen * 2)
  // Manual placement for the pencil: explicitly position it inside the backbone's top-right corner.
  const pencilSize = 18
  // Place the circle so its CENTER sits on the backbone's top-right corner (intentional overhang).
  const pencilLeft = backboneLeft + backboneWidth - pencilSize / 2
  const pencilTop = backboneY - pencilSize / 2

  // Cell frame/UI is now optionally drawn by the parent (CircuitCanvas) so we can stack plasmids within one cell.
  
  // (gap width is computed inside the base-pair render block where it's used)

  // PERFORMANCE: Memoize antisense sequence calculation
  const antisenseSequence = useMemo(() => 
    dnaSequence.map(base => COMPLEMENT[base] || base),
    [dnaSequence]
  )
  
  // PERFORMANCE: Memoize placed components sorting
  const placedComponents = useMemo(() => 
    components
      .filter((comp) => comp.position !== undefined)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [components]
  )
  
  // PERFORMANCE: Memoize component coverage map
  const componentIdByBp = useMemo(() => {
    const map = new Array(dnaLength).fill(null) as Array<string | null>
    for (const comp of placedComponents) {
      const start = Math.max(0, Math.min(dnaLength, Math.round(comp.position!)))
      const len = Math.max(0, Math.round(comp.length))
      const end = Math.max(start, Math.min(dnaLength, start + len))
      for (let i = start; i < end; i++) {
        map[i] = comp.id
      }
    }
    if (dragGap) {
      const start = Math.max(0, Math.min(dnaLength, Math.round(dragGap.startBp)))
      const end = Math.max(start, Math.min(dnaLength, start + Math.max(0, Math.round(dragGap.length))))
      for (let i = start; i < end; i++) {
        map[i] = '__preview__'
      }
    }
    return map
  }, [placedComponents, dnaLength, dragGap])
  
  // PERFORMANCE: Stable callbacks for base interactions
  const handleBaseEnter = useCallback((index: number) => {
    onBaseEnter(index)
  }, [onBaseEnter])

  return (
    <>
      {/* Cell frame/label/+ are rendered by CircuitCanvas when stacking plasmids; keep legacy behavior if needed. */}
      {!suppressCellFrame && (
        <>
          <div
            style={{
              position: 'absolute',
              left: `${lineX - 120}px`,
              top: `${lineY - 180}px`,
              width: `${totalWidth + 240}px`,
              height: `360px`,
              border: `2px dotted ${hexToRgba(accentColor, 0.7)}`,
              borderRadius: 14,
              background: 'transparent',
              zIndex: 0,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${lineX - 110}px`,
              top: `${lineY - 180}px`,
              transform: 'translateY(-50%)',
              padding: '4px 10px',
              fontFamily: 'Courier New, monospace',
              fontWeight: 700,
              fontSize: 12,
              color: hexToRgba(accentColor, 0.95),
              background: '#e8e8e8',
              zIndex: 2,
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {cellType}: {cellName}
          </div>
          {onAddCircuitInCell && (
            <button
              className="cell-add-circuit"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onAddCircuitInCell()
              }}
              title="Add another circuit to this cell"
              style={{
                position: 'absolute',
                left: `${lineX + totalWidth / 2 - 14}px`,
                top: `${lineY + 160}px`,
                width: 28,
                height: 28,
                borderRadius: 999,
                border: `2px solid ${hexToRgba(accentColor, 0.85)}`,
                background: theme.bgSecondary,
                color: hexToRgba(accentColor, 0.95),
                fontFamily: 'Courier New, monospace',
                fontWeight: 900,
                fontSize: 20,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 7,
              }}
            >
              +
            </button>
          )}
        </>
      )}

      {/* Backbone (visual-only, abstract view) */}
      {showBackbone && (
        <>
          {/* Short line stubs extending from backbone ends (visual-only) */}
          <div
            style={{
              position: 'absolute',
              left: `${backboneLeft - backboneStubLen}px`,
              top: `${backboneY + backboneHeight / 2 - backboneStubThickness / 2}px`,
              width: `${backboneStubLen}px`,
              height: `${backboneStubThickness}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${backboneLeft + backboneWidth}px`,
              top: `${backboneY + backboneHeight / 2 - backboneStubThickness / 2}px`,
              width: `${backboneStubLen}px`,
              height: `${backboneStubThickness}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />

          {/* Vertical connector legs from stub tips up to the insert midline (visual-only) */}
          <div
            style={{
              position: 'absolute',
              left: `${connectorXLeft - backboneStubThickness / 2}px`,
              top: `${insertMidY}px`,
              width: `${backboneStubThickness}px`,
              height: `${connectorVerticalHeight}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${connectorXRight - backboneStubThickness / 2}px`,
              top: `${insertMidY}px`,
              width: `${backboneStubThickness}px`,
              height: `${connectorVerticalHeight}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />

          {/* Top arms (2x bottom stub length) extending inward toward the insert from the vertical legs */}
          <div
            style={{
              position: 'absolute',
              left: `${connectorXLeft}px`,
              top: `${insertMidY - backboneStubThickness / 2}px`,
              width: `${topArmLen}px`,
              height: `${backboneStubThickness}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${connectorXRight - topArmLen}px`,
              top: `${insertMidY - backboneStubThickness / 2}px`,
              width: `${topArmLen}px`,
              height: `${backboneStubThickness}px`,
              background: hexToRgba(accentColor, 0.75),
              zIndex: 6,
              pointerEvents: 'none',
            }}
          />

          {/* Backbone strand */}
          <div
            className="backbone-bar"
            style={{
              position: 'absolute',
              left: `${backboneLeft}px`,
              top: `${backboneY}px`,
              width: `${backboneWidth}px`,
              height: `${backboneHeight}px`,
              border: backboneSelected ? `3px solid ${hexToRgba(accentColor, 0.95)}` : `2px solid ${hexToRgba(accentColor, 0.75)}`,
              borderRadius: '0px',
              background: hexToRgba(accentColor, 0.08),
              zIndex: 6,
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Courier New, monospace',
              fontWeight: 700,
              fontSize: `${Math.max(10, Math.min(14, 10 * zoom))}px`,
              color: hexToRgba(accentColor, 0.95),
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              cursor: onSelectBackbone ? 'pointer' : 'default',
            }}
            onMouseDown={(e) => {
              // Prevent DNA selection drag from starting on the backbone.
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectBackbone?.()
            }}
          >
            {backbone ? formatBackboneLabel(backbone) : 'BB_10C_ColE1_Cm'}
          </div>
          {onEditBackbone && backboneSelected && (
            <button
              className="backbone-pencil"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onEditBackbone()
              }}
              title="Edit backbone"
              style={{
                position: 'absolute',
                left: `${pencilLeft}px`,
                top: `${pencilTop}px`,
                border: `1px solid ${hexToRgba(accentColor, 0.55)}`,
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 999,
                width: pencilSize,
                height: pencilSize,
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontWeight: 700,
                fontSize: 12,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                zIndex: 7,
              }}
            >
              ✎
            </button>
          )}
        </>
      )}

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
          color: accentColor,
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
          background: accentColor,
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
          color: accentColor,
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
          color: accentColor,
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
          background: accentColor,
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
          color: accentColor,
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
            // Make insert selection a bit less generous so the backbone remains clickable.
            top: `${lineY - (strandSpacing / 2 + baseHeight / 2) - insertOverlayPad}px`,
            left: `${lineX}px`,
            width: `${totalWidth}px`,
            height: `${Math.round(strandSpacing + baseHeight + insertOverlayPad * 2)}px`,
            zIndex: 5, // Above DNA lines (1) but below cursor (10) and components (2-3)
            pointerEvents: 'auto',
            cursor: 'text',
            backgroundColor: 'transparent',
          }}
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
          {/* DNA view cursor activation overlay - captures mouse events to enable cursor */}
          <div
            className="dna-view-overlay"
            style={{
              position: 'absolute',
              top: `${lineY - strandSpacing / 2 - baseHeight / 2 - 10}px`,
              left: `${lineX}px`,
              width: `${totalWidth}px`,
              height: `${strandSpacing + baseHeight + 20}px`,
              zIndex: 0, // Below everything else but still captures events
              pointerEvents: 'auto',
              cursor: 'text',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={onCursorMove}
            onMouseMove={onCursorMove}
            onMouseLeave={onCursorLeave}
          />
          {/* Render bases in expanded bp space (components contribute their own bp tiles) */}
          {/* PERFORMANCE: Use memoized placedComponents and componentIdByBp from above */}
          {(() => {
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
                        border: `2px solid ${isHovered ? accentColor : isHighlighted ? '#e67e22' : '#6f6f6f'}`,
                        borderRadius: '2px',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        zIndex: 2,
                        boxShadow: isHovered
                          ? `0 0 4px ${hexToRgba(accentColor, 0.5)}`
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
                  onMouseEnter={onCursorMove}
                  onMouseMove={onCursorMove}
                  onMouseLeave={onCursorLeave}
                >
                  {/* PERFORMANCE: Render bases with pre-computed values and reduced style objects */}
                  {(() => {
                    const seamlessWidth = 1 / bpPerPixel
                    // Pre-compute shared styles (avoid creating new objects per base)
                    const baseStyle: React.CSSProperties = {
                      position: 'absolute',
                      width: seamlessWidth,
                      minWidth: seamlessWidth,
                      height: baseHeight,
                      fontSize: fontSize,
                      color: '#000',
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 700,
                      textAlign: 'center',
                      lineHeight: `${baseHeight}px`,
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      userSelect: 'none',
                    }
                    
                    return dnaSequence.map((base, index) => {
                      const isComponentBase = componentIdByBp[index] !== null
                      if (isComponentBase) {
                        // Component bases: minimal render, no interaction
                        return (
                          <span
                            key={`sense-${index}`}
                            style={{
                              ...baseStyle,
                              left: bpToX(index),
                              backgroundColor: 'transparent',
                              pointerEvents: 'none',
                            }}
                          >
                            {base}
                          </span>
                        )
                      }
                      
                      const baseBgColor = BASE_COLORS[base] || '#666'
                      const isSelected = selection ? isInSelection(index, selection.startBp, selection.endBp, dnaLength) : false
                      const isHovered = cursorBp === index
                      
                      return (
                        <span
                          key={`sense-${index}`}
                          data-bp-index={index}
                          style={{
                            ...baseStyle,
                            left: bpToX(index),
                            backgroundColor: isSelected ? '#ffffff' : isHovered ? `${baseBgColor}dd` : baseBgColor,
                            cursor: 'text',
                            pointerEvents: 'auto',
                          }}
                          onMouseEnter={() => handleBaseEnter(index)}
                          onMouseLeave={onBaseLeave}
                          onMouseDown={onBaseMouseDown}
                        >
                          {base}
                        </span>
                      )
                    })
                  })()}
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
                  {/* PERFORMANCE: Optimized antisense strand rendering */}
                  {(() => {
                    const seamlessWidth = 1 / bpPerPixel
                    const baseStyle: React.CSSProperties = {
                      position: 'absolute',
                      width: seamlessWidth,
                      minWidth: seamlessWidth,
                      height: baseHeight,
                      fontSize: fontSize,
                      color: '#000',
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 700,
                      textAlign: 'center',
                      lineHeight: `${baseHeight}px`,
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      userSelect: 'none',
                      cursor: 'default',
                    }
                    
                    return antisenseSequence.map((base, index) => {
                      const isComponentBase = componentIdByBp[index] !== null
                      const baseBgColor = BASE_COLORS[base] || '#666'
                      const isSelected = selection ? isInSelection(index, selection.startBp, selection.endBp, dnaLength) : false
                      
                      return (
                        <span
                          key={`antisense-${index}`}
                          style={{
                            ...baseStyle,
                            left: bpToX(index),
                            backgroundColor: isComponentBase 
                              ? 'transparent' 
                              : isSelected 
                                ? '#ffffff' 
                                : `${baseBgColor}aa`,
                          }}
                        >
                          {base}
                        </span>
                      )
                    })
                  })()}
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
        {(() => {
          // Avoid label overlap when zoomed out by only rendering labels when there's enough pixel spacing.
          const markers = Array.from({ length: Math.floor(dnaLength / 100) + 1 }, (_, i) => i * 100).filter(
            (bp) => bp < dnaLength
          )
          let lastLabelX = -Infinity

          return markers.map((bpPosition) => {
            const x = bpToX(bpPosition)
            const label = `${bpPosition}bp`
            const labelFontPx = 13
            const estimatedLabelWidth = label.length * labelFontPx * 0.62
            const minGapPx = estimatedLabelWidth + 12
            const showLabel = x - lastLabelX >= minGapPx
            if (showLabel) lastLabelX = x

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
                    background: accentColor,
                    marginBottom: '4px',
                  }}
                />
                {showLabel && (
                  <div
                    style={{
                      fontSize: `${labelFontPx}px`,
                      fontFamily: 'Courier New, monospace',
                      color: accentColor,
                      fontWeight: '700',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                  >
                    {label}
                  </div>
                )}
              </div>
            )
          })
        })()}
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
        
        // Calculate text display based on available width
        // Approximate character width for monospace font: ~0.6 * fontSize
        const fontSize = Math.max(8, Math.min(14, 8 * zoom))
        const charWidth = fontSize * 0.65
        const padding = 8 // Horizontal padding inside the box
        const availableWidth = compWidth - padding * 2
        const fullTextWidth = comp.name.length * charWidth
        const abbreviatedWidth = 4 * charWidth // "X..." = 4 chars
        
        // Three-stage text rendering:
        // 1. Full text if it fits
        // 2. First letter + "..." if abbreviated fits
        // 3. Nothing if too small
        let displayText = ''
        if (availableWidth >= fullTextWidth) {
          displayText = comp.name
        } else if (availableWidth >= abbreviatedWidth && comp.name.length > 1) {
          displayText = comp.name[0] + '...'
        } else if (availableWidth >= charWidth) {
          displayText = comp.name[0]
        }
        // else: displayText remains '' (nothing shown)

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
                ? `2px solid ${accentColor}` 
                : isInSelection 
                  ? `2px solid ${hexToRgba(accentColor, 0.9)}` // Highlighted selection border
                  : '1px solid #333',
              zIndex: isDragging ? 8 : 6, // Above overlay (5) but below cursor (10)
              display: showAbstractView ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${fontSize}px`,
              color: '#fff',
              fontFamily: 'Courier New, monospace',
              fontWeight: '600',
              cursor: isDragging ? 'grabbing' : 'move',
              pointerEvents: 'auto',
              opacity: showAbstractView ? (isDragging ? 0.8 : 1) : 0,
              boxShadow: isSelected 
                ? `0 0 4px ${hexToRgba(accentColor, 0.5)}` 
                : isInSelection 
                  ? `0 0 4px ${hexToRgba(accentColor, 0.4)}` // Glow for parts in selection
                  : 'none',
              transition: isDragging ? 'none' : 'box-shadow 0.2s ease, border 0.2s ease',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              overflow: 'visible', // Allow delete button to spill out
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
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
                e.currentTarget.style.boxShadow = `0 0 4px ${accentColor}`
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !isDragging) {
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
            title={comp.name} // Show full name on hover
          >
            <span style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              display: 'block',
            }}>
              {displayText}
            </span>
            {isSelected && (
              <button
                className="abstract-block-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onComponentDelete(comp.id)
                }}
                style={{
                  position: 'absolute',
                  top: '-9px', // Center of 18px button on the corner
                  right: '-9px', // Center of 18px button on the corner
                  width: '18px',
                  height: '18px',
                  background: '#e74c3c',
                  border: '2px solid #c0392b',
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
                  zIndex: 100, // Ensure it's always on top
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)', // Add shadow for visibility
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

// PERFORMANCE: Memoize the entire component to prevent re-renders when props haven't changed
const DNASequenceRenderer = memo(DNASequenceRendererInner)
export default DNASequenceRenderer