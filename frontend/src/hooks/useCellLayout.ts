import { useCallback, useMemo, RefObject } from 'react'
import { CircuitComponent } from '../types/dnaTypes'
import { DNA_LENGTH } from '../constants/circuitConstants'

export interface CellData {
  id: string
  cellType: string
  cellName: string
  circuits: Array<{
    id: string
    components: CircuitComponent[]
    dnaLength?: number
  }>
  activeCircuitIndex: number
}

export interface CellFrame {
  frameLeft: number
  frameTop: number
  frameWidth: number
  frameBottom: number
}

export interface HoverTarget {
  cellId: string
  cellIdx: number
  plasmidIdx: number
  plasmidLineY: number
  plasmidLineX: number
  plasmidTotalWidth: number
}

interface UseCellLayoutParams {
  renderCells: CellData[]
  cultureCells?: CellData[]
  zoom: number
  lineX: number
  lineY: number
  totalWidth: number
  strandSpacing: number
  baseHeight: number
  bpPerPixel: number
  showAbstractView: boolean
  showBasePairs: boolean
  canvasRef: RefObject<HTMLDivElement>
  scrollContainerRef: RefObject<HTMLDivElement>
}

export function useCellLayout({
  renderCells,
  cultureCells,
  zoom,
  lineX,
  lineY,
  totalWidth,
  strandSpacing,
  baseHeight,
  bpPerPixel,
  showAbstractView,
  showBasePairs,
  canvasRef,
  scrollContainerRef,
}: UseCellLayoutParams) {
  // Plasmid spacing: intentionally tighter; user asked to halve whitespace between plasmids.
  const plasmidSpacingPx = useMemo(
    () => Math.max(140, Math.round((210 + 40 * zoom) * 0.75)),
    [zoom]
  )

  const cellGapPx = useMemo(() => Math.max(34, Math.round(44 * zoom)), [zoom])

  const computeCellHeightPx = useCallback(
    (plasmidCount: number) => {
      const framePadYTop = Math.round(Math.max(34, Math.min(60, 46 * zoom)))
      const framePadYBottom = Math.round(Math.max(34, Math.min(70, 52 * zoom)))
      const hasBackbone = showAbstractView && !showBasePairs
      const bbGap = Math.max(55, Math.min(95, 70 * zoom))
      const bbHeight = Math.round(Math.max(18, Math.min(26, 20 * zoom)))

      const n = Math.max(1, plasmidCount || 1)
      const A = Math.round(strandSpacing / 2 + baseHeight / 2 + framePadYTop)
      const markerBottomOffset = Math.round(strandSpacing / 2 + baseHeight / 2 + 12 + 40)
      const backboneBottomOffset = Math.round(strandSpacing / 2 + baseHeight / 2 + bbGap + bbHeight)
      const B = hasBackbone ? Math.max(markerBottomOffset, backboneBottomOffset) : markerBottomOffset
      return Math.round(A + (n - 1) * plasmidSpacingPx + B + framePadYBottom)
    },
    [zoom, showAbstractView, showBasePairs, strandSpacing, baseHeight, plasmidSpacingPx]
  )

  const cellLineYs = useMemo(() => {
    const ys: number[] = []
    let y = lineY
    for (const cell of renderCells) {
      ys.push(y)
      const n = cell.circuits?.length ?? 1
      y = y + computeCellHeightPx(n) + cellGapPx
    }
    return ys
  }, [renderCells, lineY, computeCellHeightPx, cellGapPx])

  const computeCellFrame = useCallback(
    (cellLineY: number, plasmidCount: number): CellFrame => {
      const framePadX = Math.round(Math.max(90, Math.min(150, 110 * zoom)))
      const framePadYTop = Math.round(Math.max(34, Math.min(60, 46 * zoom)))
      // Extra bottom padding to prevent the add-plasmid button from overlapping the backbone
      const framePadYBottom = Math.round(Math.max(54, Math.min(90, 72 * zoom)))
      const frameLeft = Math.round(lineX - framePadX)
      const frameWidth = Math.round(totalWidth + framePadX * 2)

      const hasBackbone = showAbstractView && !showBasePairs
      const bbGap = Math.max(55, Math.min(95, 70 * zoom))
      const bbHeight = Math.round(Math.max(18, Math.min(26, 20 * zoom)))

      const n = Math.max(1, plasmidCount || 1)
      let top = Infinity
      let bottom = -Infinity
      for (let i = 0; i < n; i++) {
        const y = cellLineY + i * plasmidSpacingPx
        const frameTop = Math.round(y - strandSpacing / 2 - baseHeight / 2 - framePadYTop)
        const markerBottom = Math.round(y + strandSpacing / 2 + baseHeight / 2 + 12 + 40)
        const bbY = Math.round(y + strandSpacing / 2 + baseHeight / 2 + bbGap)
        const circuitBottom = hasBackbone ? Math.max(markerBottom, bbY + bbHeight) : markerBottom
        const frameBottom = Math.round(circuitBottom)
        top = Math.min(top, frameTop)
        bottom = Math.max(bottom, frameBottom)
      }
      const frameTopFinal = Math.round(top)
      const frameBottomFinal = Math.round(bottom + framePadYBottom)
      return { frameLeft, frameTop: frameTopFinal, frameWidth, frameBottom: frameBottomFinal }
    },
    [zoom, strandSpacing, baseHeight, lineX, totalWidth, showAbstractView, showBasePairs, plasmidSpacingPx]
  )

  const getExpandedLengthForComponents = useCallback(
    (dnaLen: number, comps: CircuitComponent[]) => {
      const placedComps = comps.filter((c) => c.position !== undefined)
      const totalInserted = placedComps.reduce((acc, c) => acc + Math.max(0, Math.round(c.length)), 0)
      let len = dnaLen + totalInserted
      // Also ensure we accommodate the highest-positioned component
      for (const c of placedComps) {
        const compEnd = Math.round(c.position!) + Math.max(0, Math.round(c.length))
        if (compEnd > len) len = compEnd
      }
      return len
    },
    []
  )

  const getHoverPlasmidTargetFromClientOffset = useCallback(
    (offset: { x: number; y: number }): HoverTarget | null => {
      if (!canvasRef.current || !scrollContainerRef.current) return null
      const rect = canvasRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const scrollTop = scrollContainerRef.current.scrollTop
      const xAbs = offset.x - rect.left + scrollLeft
      const yAbs = offset.y - rect.top + scrollTop

      for (let idx = 0; idx < renderCells.length; idx++) {
        const cell = renderCells[idx]
        const cellLineY = cellLineYs[idx] ?? lineY
        const plasmidCount = cell.circuits?.length ?? 1
        const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmidCount)
        if (xAbs >= frameLeft && xAbs <= frameLeft + frameWidth && yAbs >= frameTop && yAbs <= frameBottom) {
          const rawPlasmidIdx = Math.round((yAbs - cellLineY) / plasmidSpacingPx)
          const plasmidIdx = Math.max(0, Math.min(plasmidCount - 1, rawPlasmidIdx))
          const plasmidLineY = cellLineY + plasmidIdx * plasmidSpacingPx
          const comps =
            cultureCells && cultureCells.length > 0
              ? (cultureCells.find((c) => c.id === cell.id)?.circuits?.[plasmidIdx]?.components ?? [])
              : cell.circuits?.[plasmidIdx]?.components ?? []
          const dnaLenRaw =
            cultureCells && cultureCells.length > 0
              ? (cultureCells.find((c) => c.id === cell.id)?.circuits?.[plasmidIdx]?.dnaLength ?? DNA_LENGTH)
              : (cell.circuits?.[plasmidIdx]?.dnaLength ?? DNA_LENGTH)
          const expandedLen = getExpandedLengthForComponents(Number(dnaLenRaw ?? DNA_LENGTH), comps)
          const plasmidTotalWidth = expandedLen / bpPerPixel
          const laneLineX = lineX
          const laneTotalWidth = totalWidth
          const plasmidLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidth) / 2))
          return { cellId: cell.id, cellIdx: idx, plasmidIdx, plasmidLineY, plasmidLineX, plasmidTotalWidth }
        }
      }
      return null
    },
    [
      renderCells,
      cellLineYs,
      lineY,
      computeCellFrame,
      plasmidSpacingPx,
      cultureCells,
      getExpandedLengthForComponents,
      bpPerPixel,
      lineX,
      totalWidth,
      canvasRef,
      scrollContainerRef,
    ]
  )

  return {
    plasmidSpacingPx,
    cellGapPx,
    cellLineYs,
    computeCellHeightPx,
    computeCellFrame,
    getExpandedLengthForComponents,
    getHoverPlasmidTargetFromClientOffset,
  }
}

