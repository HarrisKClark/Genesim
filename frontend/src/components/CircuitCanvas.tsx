import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useDrop } from 'react-dnd'
import CircuitNode from './CircuitNode'
import './CircuitCanvas.css'
import { CircuitComponent } from '../types/dnaTypes'
import type { BackboneSpec } from '../types/backboneTypes'
import { COMPONENT_COLORS, COMPONENT_SIZES, DNA_LENGTH, generateDNA } from '../constants/circuitConstants'
import { useUndoRedo } from '../hooks/useUndoRedo'
import { useCustomScrollbar } from '../hooks/useCustomScrollbar'
import { useDNASelection } from '../hooks/useDNASelection'
import { useDNAEditing } from '../hooks/useDNAEditing'
import { useViewState } from '../hooks/useViewState'
import DNASequenceRenderer from './DNA/DNASequenceRenderer'
import DNACursor from './DNA/DNACursor'
import DNASelectionHighlight from './DNA/DNASelectionHighlight'
import SelectionInfo from './SelectionInfo'
import CustomScrollbar from './CustomScrollbar'
import ContextMenu from './ContextMenu'
import DragPreview from './DragPreview'
import DragPreviewOverlay from './Canvas/DragPreviewOverlay'
import CanvasStatusBar from './Canvas/CanvasStatusBar'
import OperonHighlight from './Analysis/OperonHighlight'
import { useCircuitAnalysis } from '../hooks/useCircuitAnalysis'
import { CircuitModel } from '../models/CircuitModel'
import { getBpFromMouse as getBpFromMouseUtil, getCursorPositionFromMouse as getCursorPositionFromMouseUtil } from '../utils/coordinateUtils'
import {
  snapToValidInsertionPosition,
  shiftComponentPositionsAtOrAfter,
  migrateComponent,
} from '../utils/componentPositioning'
import { buildExpandedLayout } from '../utils/expandedLayout'
import { theme, hexToRgba } from '../utils/themeUtils'
// Note: useCellLayout hook is available for further refactoring
// import { useCellLayout } from '../hooks/useCellLayout'

interface CircuitCanvasProps {
  onCircuitChange: (data: CircuitComponent[]) => void
  onCircuitChangeForPlasmid?: (cellId: string, plasmidIndex: number, data: CircuitComponent[]) => void
  circuitData: CircuitComponent[] | null
  zoomSensitivity: number
  fileName?: string
  backbone?: BackboneSpec
  onEditBackbone?: () => void
  onEditCell?: (cellId: string) => void
  cellType?: string
  cellName?: string
  onAddCircuitInCell?: () => void
  onAddCircuitInCellForCell?: (cellId: string) => void
  isActive?: boolean
  onActivate?: () => void
  // Culture rendering (multiple cells in one panel)
  cultureCells?: Array<{
    id: string
    cellType: string
    cellName: string
    circuits: Array<{
      id: string
      backbone: BackboneSpec
      components: CircuitComponent[]
      dnaLength?: number
      dnaSequence?: string[]
    }>
    activeCircuitIndex: number
  }>
  activeCellId?: string
  onActivateCell?: (id: string) => void
  onAddCell?: () => void
  onDeleteCell?: (id: string) => void
  onDeletePlasmid?: (cellId: string, plasmidId: string) => void
  onActivatePlasmid?: (cellId: string, plasmidIndex: number) => void
  onPlasmidDnaChange?: (cellId: string, plasmidIndex: number, dnaSequence: string[], dnaLength: number) => void
  // Operon analysis props
  showOperonHighlights?: boolean
  selectedOperonId?: string | null
  onOperonClick?: (operonId: string) => void
  onAnalysisUpdate?: (analysis: any) => void
  onPartContextMenu?: (e: React.MouseEvent, part: any) => void
}

export default function CircuitCanvas({ 
  onCircuitChange, 
  onCircuitChangeForPlasmid,
  circuitData, 
  fileName = 'Untitled Circuit',
  backbone,
  onEditBackbone,
  onEditCell,
  cellType,
  cellName,
  onAddCircuitInCell,
  onAddCircuitInCellForCell,
  isActive = true,
  onActivate,
  cultureCells,
  activeCellId,
  onActivateCell,
  onAddCell,
  onDeleteCell,
  onDeletePlasmid,
  onActivatePlasmid,
  onPlasmidDnaChange,
  showOperonHighlights = false,
  selectedOperonId = null,
  onOperonClick,
  onAnalysisUpdate,
  onPartContextMenu,
}: CircuitCanvasProps) {
  // Get theme colors - recompute on each render to pick up theme changes
  const accentColor = theme.accentPrimary
  const bgSecondary = theme.bgSecondary
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasInitialCenteredRef = useRef(false)
  const prevZoomRef = useRef<number | null>(null)
  // Cursor hide is debounced; keep a ref so we can cancel stale timers and prevent flicker.
  const cursorHideTimerRef = useRef<number | null>(null)
  // Reduce cursor jitter by only updating position when it actually changes.
  const lastCursorPositionRef = useRef<number | null>(null)
  // In abstract view we arm the cursor when the mouse is near the DNA band; used to start selection on mousedown.
  const abstractCursorArmedRef = useRef(false)
  // Allows us to start selection from handlers declared before the selection hook.
  const handleBaseMouseDownRef = useRef<((e: React.MouseEvent) => void) | null>(null)
  const [backboneSelected, setBackboneSelected] = useState(false)
  // In abstract view, the cursor should appear near whichever plasmid row the mouse is near,
  // without forcing the "active plasmid" to change just by hovering.
  const [cursorLineY, setCursorLineY] = useState<number | null>(null)
  const [cursorLineX, setCursorLineX] = useState<number | null>(null)
  const [components, setComponents] = useState<CircuitComponent[]>(() => {
    const initial = circuitData || []
    // Migrate old components to new format
    return initial.map(comp => migrateComponent({
      ...comp,
      length: comp.length || COMPONENT_SIZES[comp.type] || 100,
    }))
  })
  
  // Sync circuitData prop changes
  useEffect(() => {
    if (circuitData) {
      setComponents(circuitData.map(comp => ({
        ...comp,
        length: comp.length || COMPONENT_SIZES[comp.type] || 100,
      })))
      // Clear any selection that might reference stale IDs after a load/new
      setSelectedId(null)
      setOverlappingComponentIds([])
    }
  }, [circuitData])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overlappingComponentIds, setOverlappingComponentIds] = useState<string[]>([])
  // Background DNA (ACTIVE plasmid only; other plasmids use cultureCells[].circuits[].dnaSequence)
  const [dnaSequence, setDnaSequence] = useState<string[]>(generateDNA(DNA_LENGTH))
  const [dnaLength, setDnaLength] = useState(DNA_LENGTH)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; bp: number } | null>(null)
  const lastSyncedDnaRef = useRef<{ cellId: string; plasmidIndex: number; dnaLength: number; dnaSequence: string[] } | null>(null)

  const activeCellIdForDna = useMemo(() => {
    if (!cultureCells || cultureCells.length === 0) return '__single__'
    return activeCellId ?? cultureCells[0]?.id ?? '__single__'
  }, [cultureCells, activeCellId])

  const activePlasmidIndexForDna = useMemo(() => {
    if (!cultureCells || cultureCells.length === 0) return 0
    const cell = cultureCells.find((c) => c.id === activeCellIdForDna) ?? cultureCells[0]
    return Math.max(0, Math.min((cell?.circuits?.length ?? 1) - 1, Number(cell?.activeCircuitIndex ?? 0)))
  }, [cultureCells, activeCellIdForDna])

  // Track which plasmid we last synced FROM props (to detect plasmid switches)
  const lastSyncedPlasmidRef = useRef<{ cellId: string; plasmidIndex: number } | null>(null)

  // Sync ACTIVE plasmid DNA from props into local state ONLY when switching to a different plasmid.
  // Do NOT re-sync on every cultureCells change - that causes oscillation with local edits.
  useEffect(() => {
    if (!cultureCells || cultureCells.length === 0) return
    const lastSynced = lastSyncedPlasmidRef.current
    // Only sync if we're switching to a DIFFERENT plasmid
    if (lastSynced && lastSynced.cellId === activeCellIdForDna && lastSynced.plasmidIndex === activePlasmidIndexForDna) {
      return // Same plasmid - don't overwrite local edits
    }
    const cell = cultureCells.find((c) => c.id === activeCellIdForDna) ?? cultureCells[0]
    const plasmid = cell?.circuits?.[activePlasmidIndexForDna]
    const nextLen = Number(plasmid?.dnaLength ?? DNA_LENGTH)
    const nextSeq = Array.isArray(plasmid?.dnaSequence) ? (plasmid!.dnaSequence as string[]) : generateDNA(nextLen)
    lastSyncedPlasmidRef.current = { cellId: activeCellIdForDna, plasmidIndex: activePlasmidIndexForDna }
    lastSyncedDnaRef.current = {
      cellId: activeCellIdForDna,
      plasmidIndex: activePlasmidIndexForDna,
      dnaLength: nextLen,
      dnaSequence: nextSeq,
    }
    setDnaLength(nextLen)
    setDnaSequence(nextSeq)
  }, [cultureCells, activeCellIdForDna, activePlasmidIndexForDna])

  // Push local DNA edits back up to Layout for the active plasmid.
  // This runs whenever local dnaSequence/dnaLength changes.
  useEffect(() => {
    if (!cultureCells || cultureCells.length === 0) return
    const last = lastSyncedDnaRef.current
    // If we just synced from props (same values), don't push back up.
    if (
      last &&
      last.cellId === activeCellIdForDna &&
      last.plasmidIndex === activePlasmidIndexForDna &&
      last.dnaLength === dnaLength &&
      last.dnaSequence === dnaSequence
    ) {
      return
    }
    // Update lastSyncedDnaRef so we know this is our latest local state
    lastSyncedDnaRef.current = {
      cellId: activeCellIdForDna,
      plasmidIndex: activePlasmidIndexForDna,
      dnaLength,
      dnaSequence,
    }
    onPlasmidDnaChange?.(activeCellIdForDna, activePlasmidIndexForDna, dnaSequence, dnaLength)
  }, [cultureCells, onPlasmidDnaChange, activeCellIdForDna, activePlasmidIndexForDna, dnaSequence, dnaLength])

  // Expanded length (background + inserted component bases). Used for view/canvas sizing.
  // If we are rendering a culture, size to the max length across ALL plasmids in ALL cells so nothing "shrinks"
  // when the active cell/plasmid changes.
  const expandedLengthBase = useMemo(() => {
    const baseFor = (dnaLen: number, comps: CircuitComponent[]) => {
      const placedComps = comps.filter((c) => c.position !== undefined)
      const totalInserted = placedComps.reduce((acc, c) => acc + Math.max(0, Math.round(c.length)), 0)
      let len = dnaLen + totalInserted
      // Also ensure we accommodate the highest-positioned component
      for (const c of placedComps) {
        const compEnd = Math.round(c.position!) + Math.max(0, Math.round(c.length))
        if (compEnd > len) len = compEnd
      }
      return len
    }

    if (!cultureCells || cultureCells.length === 0) return Math.max(0, baseFor(dnaLength, components))

    let maxLen = baseFor(dnaLength, components)
    for (const cell of cultureCells) {
      const circuits = cell.circuits ?? []
      for (let pIdx = 0; pIdx < circuits.length; pIdx++) {
        // SKIP active plasmid - already counted via local state to avoid dual-source sizing oscillation
        if (cell.id === activeCellIdForDna && pIdx === activePlasmidIndexForDna) continue
        const plasmid = circuits[pIdx]
        const comps = plasmid?.components ?? []
        const dnaLen = Number(plasmid?.dnaLength ?? DNA_LENGTH)
        maxLen = Math.max(maxLen, baseFor(dnaLen, comps))
      }
    }
    return Math.max(0, maxLen)
  }, [dnaLength, components, cultureCells, activeCellIdForDna, activePlasmidIndexForDna])
  
  // View state hook (zoom, pan, coordinate conversion, canvas dimensions)
  const viewState = useViewState({
    canvasRef,
    scrollContainerRef,
    dnaLength: expandedLengthBase,
  })
  
  // Destructure for easy access
  const {
    zoom,
    setZoom,
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    showBasePairs,
    showAbstractView,
    transitionFactor,
    canvasWidth,
    canvasHeight,
    lineX,
    lineY,
    fontSize,
    baseHeight,
    strandSpacing,
    bpPerPixel,
    totalWidth,
    bpToX,
  } = viewState

  // Drag preview state for component insertion
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{
    bp: number
    componentLength: number
    componentType: string
    componentName: string
    blockedPartIds?: string[]
    snappedFromBlocked?: boolean
    targetLineY?: number
    targetLineX?: number
    targetCellId?: string
    targetPlasmidIndex?: number
  } | null>(null)

  const [dragTargetCellFrame, setDragTargetCellFrame] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  // Expanded layout (background + inserted component bases). Used for rendering and mouse coordinate mapping.
  // Includes a preview insertion while dragging onto the strand.
  const expandedLayout = useMemo(() => {
    const extra =
      dragPreviewPosition && showBasePairs
        ? [
            {
              id: '__preview__',
              position: Math.round(dragPreviewPosition.bp),
              length: Math.max(0, Math.round(dragPreviewPosition.componentLength)),
              sequence: Array(Math.max(0, Math.round(dragPreviewPosition.componentLength))).fill('N'),
              color: COMPONENT_COLORS[dragPreviewPosition.componentType] || '#666',
            },
          ]
        : []
    return buildExpandedLayout({
      backgroundSequence: dnaSequence,
      components,
      extraInsertions: extra,
    })
  }, [dnaSequence, components, dragPreviewPosition, showBasePairs])

  // Plasmid-specific width/centering: each plasmid keeps its own expanded width and is centered within the "lane"
  // defined by the max-width plasmid (totalWidth from viewState / expandedLengthBase).
  const laneLineX = lineX
  const laneTotalWidth = totalWidth
  const activeExpandedLength = expandedLayout.expandedLength
  const activeTotalWidthPx = useMemo(() => activeExpandedLength / bpPerPixel, [activeExpandedLength, bpPerPixel])
  const activeLineX = useMemo(
    () => Math.round(laneLineX + Math.max(0, (laneTotalWidth - activeTotalWidthPx) / 2)),
    [laneLineX, laneTotalWidth, activeTotalWidthPx]
  )

  const getBpFromMouseActive = useCallback((e: React.MouseEvent | MouseEvent) => {
    return getBpFromMouseUtil(
      e,
      canvasRef,
      scrollContainerRef,
      canvasWidth,
      activeTotalWidthPx,
      bpPerPixel,
      expandedLayout.expandedLength,
      activeLineX
    )
  }, [canvasRef, scrollContainerRef, canvasWidth, activeTotalWidthPx, bpPerPixel, expandedLayout.expandedLength, activeLineX])

  const getCursorPositionFromMouseActive = useCallback((e: React.MouseEvent | MouseEvent) => {
    return getCursorPositionFromMouseUtil(
      e,
      canvasRef,
      scrollContainerRef,
      canvasWidth,
      activeTotalWidthPx,
      bpPerPixel,
      expandedLayout.expandedLength,
      showBasePairs,
      activeLineX
    )
  }, [canvasRef, scrollContainerRef, canvasWidth, activeTotalWidthPx, bpPerPixel, expandedLayout.expandedLength, showBasePairs, activeLineX])

  // NOTE: Operon/ORF analysis is now performed in expanded coordinate space, so no background→expanded mapping is needed.

  // Drag state for moving an already-placed part box
  const [draggingPlacedPart, setDraggingPlacedPart] = useState<{
    id: string
    length: number
  } | null>(null)
  const draggingPlacedPartStartRef = useRef<number | null>(null)
  // Preserve the exact grab point inside the box so it doesn't "jump" when drag starts.
  // Value is in px: mouseX - boxLeftX at drag start (strand-relative coordinates).
  const draggingPlacedPartMouseOffsetPxRef = useRef<number>(0)
  
  // Legacy abstract drag state (kept for click suppression)
  const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null)
  const dragComponentStartRef = useRef({ x: 0, startBp: 0 })
  const hasDraggedRef = useRef(false)

  // Selection drag ref (shared between hooks)
  const selectionDragRef = useRef<{
    startCursorPos: number | null
    isDragging: boolean
    hasMoved: boolean
  }>({
    startCursorPos: null,
    isDragging: false,
    hasMoved: false,
  })
  
  const strandWidthPx = totalWidth

  // Culture vertical layout (all cells in one panel)
  // Cell vertical positioning is dynamic (based on plasmid count), so avoid fixed per-cell spacing.
  // Plasmid spacing: intentionally tighter; user asked to halve whitespace between plasmids.
  const plasmidSpacingPx = useMemo(() => Math.max(140, Math.round((210 + 40 * zoom) * 0.75)), [zoom])
  // If `cultureCells` is provided, we render exactly that (even if empty for a blank project).
  // Otherwise, fall back to a single-cell view.
  const renderCells =
    cultureCells !== undefined
      ? cultureCells
      : [
          {
            id: '__single__',
            cellType: cellType ?? 'MG1655',
            cellName: cellName ?? 'Repressilator',
            circuits: [
              {
                id: '__single_plasmid__',
                backbone:
                  backbone ?? { copyNumber: 10, originName: 'ColE1', resistances: [{ code: 'Cm', name: 'Chloramphenicol' }] },
                components,
              },
            ],
            activeCircuitIndex: 0,
          },
        ]
  const activeIdx = useMemo(() => {
    if (!activeCellId) return 0
    const idx = renderCells.findIndex((c) => c.id === activeCellId)
    return idx >= 0 ? idx : 0
  }, [renderCells, activeCellId])
  const baseLineY = lineY
  const activePlasmidIdx = renderCells[activeIdx]?.activeCircuitIndex ?? 0

  const cellGapPx = useMemo(() => Math.max(34, Math.round(44 * zoom)), [zoom])

  const computeCellHeightPx = useCallback((plasmidCount: number) => {
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
  }, [zoom, showAbstractView, showBasePairs, strandSpacing, baseHeight, plasmidSpacingPx])

  const cellLineYs = useMemo(() => {
    const ys: number[] = []
    let y = baseLineY
    for (const cell of renderCells) {
      ys.push(y)
      const n = cell.circuits?.length ?? 1
      y = y + computeCellHeightPx(n) + cellGapPx
    }
    return ys
  }, [renderCells, baseLineY, computeCellHeightPx, cellGapPx])

  const activeCellLineY = cellLineYs[activeIdx] ?? baseLineY
  const activeLineY = activeCellLineY + activePlasmidIdx * plasmidSpacingPx
  const cursorRenderLineY = (showBasePairs ? activeLineY : (cursorLineY ?? activeLineY))
  const cursorRenderLineX = (showBasePairs ? activeLineX : (cursorLineX ?? activeLineX))

  const computeCellFrame = useCallback(
    (cellLineY: number, plasmidCount: number) => {
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

  const getExpandedLengthForComponents = useCallback((dnaLen: number, comps: CircuitComponent[]) => {
    const placedComps = comps.filter((c) => c.position !== undefined)
    const totalInserted = placedComps.reduce((acc, c) => acc + Math.max(0, Math.round(c.length)), 0)
    let len = dnaLen + totalInserted
    // Also ensure we accommodate the highest-positioned component
    for (const c of placedComps) {
      const compEnd = Math.round(c.position!) + Math.max(0, Math.round(c.length))
      if (compEnd > len) len = compEnd
    }
    return len
  }, [])

  const getHoverPlasmidTargetFromClientOffset = useCallback((offset: { x: number; y: number }) => {
    if (!canvasRef.current || !scrollContainerRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const scrollLeft = scrollContainerRef.current.scrollLeft
    const scrollTop = scrollContainerRef.current.scrollTop
    const xAbs = (offset.x - rect.left) + scrollLeft
    const yAbs = (offset.y - rect.top) + scrollTop

    for (let idx = 0; idx < renderCells.length; idx++) {
      const cell = renderCells[idx]
      const cellLineY = cellLineYs[idx] ?? baseLineY
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
            : ((cell.circuits?.[plasmidIdx] as any)?.dnaLength ?? DNA_LENGTH)
        const expandedLen = getExpandedLengthForComponents(Number(dnaLenRaw ?? DNA_LENGTH), comps)
        const plasmidTotalWidth = expandedLen / bpPerPixel
        const plasmidLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidth) / 2))
        return { cellId: cell.id, cellIdx: idx, plasmidIdx, plasmidLineY, plasmidLineX, plasmidTotalWidth }
      }
    }
    return null
  }, [
    renderCells,
    cellLineYs,
    baseLineY,
    computeCellFrame,
    plasmidSpacingPx,
    cultureCells,
    getExpandedLengthForComponents,
    bpPerPixel,
    laneLineX,
    laneTotalWidth,
  ])

  const isOriginInsideComponent = useCallback((originBp: number) => {
    // Setting origin at a boundary that cuts through a component would split it.
    // Allow origin exactly at component start/end boundaries, but block inside: (start, end).
    return components.some((c) => {
      if (c.position === undefined) return false
      const start = Math.round(c.position)
      const end = start + Math.round(c.length)
      return originBp > start && originBp < end
    })
  }, [components])
  
  // Circuit analysis hook (operon detection)
  const circuitAnalysis = useCircuitAnalysis({
    components,
    // IMPORTANT: Operons/ORFs must be analyzed in expanded coordinate space.
    // Otherwise, downstream parts beyond background dnaLength get truncated and cause false "missing terminator".
    // In multi-plasmid mode, analyze the ACTIVE plasmid’s expanded length (not the max across the culture),
    // so operon coordinates and rendering stay aligned.
    dnaLength: expandedLayout.expandedLength,
    enabled: true, // Always run analysis
  })
  
  // Notify parent of analysis updates
  useEffect(() => {
    if (!isActive) return
    if (onAnalysisUpdate) {
      onAnalysisUpdate(circuitAnalysis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, expandedLengthBase])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (selectionDragRef.current.isDragging) return

    // In culture mode (multiple plasmids), clicking in a cell should activate the closest plasmid
    // so subsequent drag/drop edits apply to the intended plasmid.
    if (!showBasePairs && cultureCells && cultureCells.length > 0 && canvasRef.current && scrollContainerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const scrollTop = scrollContainerRef.current.scrollTop
      const xAbs = (e.clientX - rect.left) + scrollLeft
      const yAbs = (e.clientY - rect.top) + scrollTop
      for (let idx = 0; idx < renderCells.length; idx++) {
        const cell = renderCells[idx]
        const cellLineY = cellLineYs[idx] ?? baseLineY
        const plasmidCount = cell.circuits?.length ?? 1
        const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmidCount)
        if (xAbs >= frameLeft && xAbs <= frameLeft + frameWidth && yAbs >= frameTop && yAbs <= frameBottom) {
          const rawPlasmidIdx = Math.round((yAbs - cellLineY) / plasmidSpacingPx)
          const plasmidIdx = Math.max(0, Math.min(plasmidCount - 1, rawPlasmidIdx))
          onActivateCell?.(cell.id)
          onActivatePlasmid?.(cell.id, plasmidIdx)
          break
        }
      }
    }
    
    const target = e.target as HTMLElement
    // If user is interacting with a placed part, don't pan the canvas.
    if (target.closest('.dna-part-box') || target.closest('.dna-part-delete')) {
      return
    }
    if (target.closest('.circuit-node') || target.closest('.canvas-controls') || target.closest('.abstract-component-block')) {
      return
    }
    
    // DNA view: clicking on a base pair should start selection, not pan
    if (showBasePairs && (target.hasAttribute('data-bp-index') || target.closest('[data-bp-index]'))) {
      setBackboneSelected(false)
      e.preventDefault()
      e.stopPropagation()
      handleBaseMouseDownRef.current?.(e)
      return
    }

    // Both views: if the cursor is armed near the DNA band, clicking and dragging should start DNA selection.
    // This is intentionally generous and overrides other empty-canvas drags.
    if (abstractCursorArmedRef.current) {
      if (
        target.closest('.dna-part-box') ||
        target.closest('.dna-part-delete') ||
        target.closest('.circuit-node') ||
        target.closest('.canvas-controls') ||
        target.closest('.abstract-component-block') ||
        target.closest('.custom-scrollbar-horizontal') ||
        target.closest('.selection-info') ||
        target.closest('.backbone-bar')
      ) {
        return
      }
      setBackboneSelected(false)
      e.preventDefault()
      e.stopPropagation()
      handleBaseMouseDownRef.current?.(e)
      return
    }
    
    // Only enable panning in DNA view
    if (!showBasePairs) return
    
    e.preventDefault()
    setIsDragging(true)
    if (scrollContainerRef.current) {
      setDragStart({
        x: e.clientX,
        scrollLeft: scrollContainerRef.current.scrollLeft,
      })
    }
  }, [
    showBasePairs,
    cultureCells,
    renderCells,
    cellLineYs,
    baseLineY,
    computeCellFrame,
    plasmidSpacingPx,
    onActivateCell,
    onActivatePlasmid,
  ])

  useEffect(() => {
    if (!isDragging || !showBasePairs) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return
      const deltaX = e.clientX - dragStart.x
      scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - deltaX
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, showBasePairs])

  // Scroll-to-zoom has been removed. Scrolling now only scrolls the canvas vertically.
  // Zoom is controlled via the +/- buttons in the header.

  // Selection hook
  const {
    selection,
    setSelection,
    cursorBp,
    setCursorBp,
    cursorPosition,
    setCursorPosition,
    cursorVisible,
    setCursorVisible,
    cursorPlaced,
    setCursorPlaced,
    handleBaseMouseDown,
  } = useDNASelection({
    canvasRef,
    scrollContainerRef,
    canvasWidth,
    totalWidth: activeTotalWidthPx,
    bpPerPixel,
    dnaLength: expandedLayout.expandedLength,
    lineX: activeLineX,
    showBasePairs,
    draggingComponentId,
    isBpSelectable: (bpIdx) => !expandedLayout.isComponentBaseIndex(bpIdx),
    bpToX,
    selectionDragRef,
    components,
    onOverlappingComponentsChange: setOverlappingComponentIds,
  })
  // Keep latest selection starter in a ref for pre-hook handlers (abstract view mousedown override).
  handleBaseMouseDownRef.current = handleBaseMouseDown

  // Global cursor: robust geometry snap for both abstract and DNA view (no reliance on hover/leave of specific layers).
  useEffect(() => {
    if (!isActive) return

    const hideIfAllowed = () => {
      if (selectionDragRef.current.isDragging) return
      if (selection) return
      if (cursorHideTimerRef.current !== null) {
        window.clearTimeout(cursorHideTimerRef.current)
        cursorHideTimerRef.current = null
      }
      setCursorVisible(false)
      setCursorPosition(null)
      setCursorLineY(null)
      lastCursorPositionRef.current = null
    }

    const onMove = (e: MouseEvent) => {
      if (!canvasRef.current || !scrollContainerRef.current) return
      if (draggingPlacedPart) return
      if (selectionDragRef.current.isDragging) return

      // Don't activate DNA cursor when hovering draggable part blocks/controls.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (
        el?.closest?.('.abstract-component-block') ||
        el?.closest?.('.dna-part-box') ||
        el?.closest?.('.dna-part-delete') ||
        el?.closest?.('.canvas-controls') ||
        el?.closest?.('.custom-scrollbar-horizontal') ||
        el?.closest?.('.selection-info') ||
        el?.closest?.('.backbone-bar') ||
        el?.closest?.('.cell-add-circuit') ||
        el?.closest?.('.cell-delete') ||
        el?.closest?.('.plasmid-delete')
      ) {
        abstractCursorArmedRef.current = false
        hideIfAllowed()
        return
      }

      const rect = canvasRef.current.getBoundingClientRect()
      const insideCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!insideCanvas) {
        abstractCursorArmedRef.current = false
        hideIfAllowed()
        return
      }

      const scrollTop = scrollContainerRef.current.scrollTop
      const yAbs = (e.clientY - rect.top) + scrollTop

      // Find which cell/plasmid line the mouse is closest to (within a generous band).
      let hoveredCellIdx: number | null = null
      for (let idx = 0; idx < renderCells.length; idx++) {
        const cell = renderCells[idx]
        const cellLineY = cellLineYs[idx] ?? baseLineY
        const plasmidCount = cell.circuits?.length ?? 1
        const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmidCount)
        const xAbs = (e.clientX - rect.left) + scrollContainerRef.current.scrollLeft
        if (xAbs >= frameLeft && xAbs <= frameLeft + frameWidth && yAbs >= frameTop && yAbs <= frameBottom) {
          hoveredCellIdx = idx
          break
        }
      }

      // If not over a cell at all, don't show cursor.
      if (hoveredCellIdx === null) {
        abstractCursorArmedRef.current = false
        hideIfAllowed()
        return
      }

      const hoveredCell = renderCells[hoveredCellIdx]
      const hoveredCellLineY = cellLineYs[hoveredCellIdx] ?? baseLineY
      const hoveredPlasmidCount = hoveredCell.circuits?.length ?? 1
      // In DNA view, use tighter band around the DNA strands
      const band = showBasePairs 
        ? Math.max(60, (strandSpacing + baseHeight) / 2 + 20)
        : Math.max(140, (strandSpacing + baseHeight) / 2 + 90)
      const rawPlasmidIdx = Math.round((yAbs - hoveredCellLineY) / plasmidSpacingPx)
      const plasmidIdx = Math.max(0, Math.min(hoveredPlasmidCount - 1, rawPlasmidIdx))
      const plasmidLineY = hoveredCellLineY + plasmidIdx * plasmidSpacingPx
      if (Math.abs(yAbs - plasmidLineY) > band) {
        abstractCursorArmedRef.current = false
        hideIfAllowed()
        return
      }

      // Important: do NOT switch the active cell/plasmid just by hovering.
      // Hover-based activation caused confusing "random" circuit changes.

      // Cancel any pending hide.
      if (cursorHideTimerRef.current !== null) {
        window.clearTimeout(cursorHideTimerRef.current)
        cursorHideTimerRef.current = null
      }

      // Get the hovered plasmid's actual size and position (not the active one)
      const hoveredPlasmidData = cultureCells?.find((c) => c.id === hoveredCell.id)?.circuits?.[plasmidIdx]
      const hoveredDnaLen = Number(hoveredPlasmidData?.dnaLength ?? DNA_LENGTH)
      const hoveredComps = hoveredPlasmidData?.components ?? []
      const hoveredExpandedLen = getExpandedLengthForComponents(hoveredDnaLen, hoveredComps)
      const hoveredTotalWidthPx = hoveredExpandedLen / bpPerPixel
      // Center within the lane (laneLineX/laneTotalWidth are the global lane bounds)
      const hoveredLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - hoveredTotalWidthPx) / 2))

      const scrollLeft = scrollContainerRef.current.scrollLeft
      const x = (e.clientX - rect.left) + scrollLeft - hoveredLineX
      // Require mouse X to be near the strand too (avoid cursor popping up far away and then clamping).
      const xMarginPx = 80
      if (x < -xMarginPx || x > hoveredTotalWidthPx + xMarginPx) {
        abstractCursorArmedRef.current = false
        hideIfAllowed()
        return
      }
      const rawPos = Math.round(x * bpPerPixel)
      const cursorPos = Math.max(0, Math.min(hoveredExpandedLen, rawPos))
      abstractCursorArmedRef.current = true

      if (lastCursorPositionRef.current !== cursorPos) {
        lastCursorPositionRef.current = cursorPos
        setCursorPosition(cursorPos)
      }
      // In abstract view, track which plasmid line for cursor rendering
      // In DNA view, cursor uses activeLineY/activeLineX so we don't need these
      if (!showBasePairs) {
        setCursorLineY(plasmidLineY)
        setCursorLineX(hoveredLineX)
      }
      setCursorVisible(true)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [
    isActive,
    showBasePairs,
    draggingPlacedPart,
    selection,
    lineX,
    lineY,
    bpPerPixel,
    strandSpacing,
    baseHeight,
    expandedLayout.expandedLength,
    totalWidth,
    setCursorVisible,
    setCursorPosition,
    renderCells,
    cultureCells,
    activeCellId,
    onActivateCell,
    onActivatePlasmid,
    cellLineYs,
    baseLineY,
    computeCellFrame,
    plasmidSpacingPx,
  ])

  // Undo/Redo hook
  const { saveState, handleUndo, handleRedo } = useUndoRedo({
    dnaSequence,
    dnaLength,
    components,
    onCircuitChange,
    setDnaSequence,
    setDnaLength,
    setComponents,
    setSelection,
  })

  // Editing hook
  const {
    clipboard,
    handleDeleteSelection: handleDeleteSelectionBase,
    handleCopySelection,
    handleCutSelection,
    handlePaste,
    handleReverseComplement,
  } = useDNAEditing({
    dnaSequence,
    dnaLength,
    components,
    selection,
    cursorPosition,
    expandedLayout,
    setDnaSequence,
    setDnaLength,
    setComponents,
    setSelection,
    setCursorPosition,
    setCursorPlaced,
    setCursorVisible,
    onCircuitChange,
    saveState,
  })

  // Wrapper that also deletes overlapping components
  const handleDeleteSelection = useCallback(() => {
    if (!selection) return
    
    // Delete overlapping components first
    if (overlappingComponentIds.length > 0) {
      saveState()
      setComponents((prev) => {
        const updated = prev.filter((c) => !overlappingComponentIds.includes(c.id))
        onCircuitChange(updated)
        return updated
      })
      setOverlappingComponentIds([])
    }
    
    // Then delete the DNA selection
    handleDeleteSelectionBase()
  }, [selection, overlappingComponentIds, handleDeleteSelectionBase, saveState, setComponents, onCircuitChange])

  // Set origin: rotate DNA sequence so the given bp becomes position 0
  const handleSetOrigin = useCallback((newOriginBp: number) => {
    if (newOriginBp <= 0 || newOriginBp >= dnaLength) return
    
    // Check if origin is inside a component
    if (isOriginInsideComponent(newOriginBp)) {
      alert('Cannot set origin inside a placed component. Please choose a position outside of components.')
      return
    }
    
    saveState()
    
    // Rotate background DNA (clamped dragging stays compatible; origin rotation shifts component insertion indices)
    const rotatedSequence = [
      ...dnaSequence.slice(newOriginBp),
      ...dnaSequence.slice(0, newOriginBp),
    ]
    const updatedComponents = components.map((comp) => {
      if (comp.position === undefined) return comp
      const len = Math.round(comp.length)
      const oldPos = Math.round(comp.position)
      let newPos = oldPos - newOriginBp
      if (newPos < 0) newPos = dnaLength + newPos
      return {
        ...comp,
        position: newPos,
        x: bpToX(newPos),
        length: len,
      }
    })
    
    setDnaSequence(rotatedSequence)
    setComponents(updatedComponents)
    onCircuitChange(updatedComponents)
    
    // Clear any selection or cursor
    setSelection(null)
    setCursorPosition(null)
    lastCursorPositionRef.current = null
    setCursorPlaced(false)
  }, [dnaSequence, dnaLength, components, isOriginInsideComponent, saveState, onCircuitChange, setSelection, setCursorPosition, setCursorPlaced, bpToX])

  // Delete a placed part: remove the component overlay (background DNA is not modified)
  const handleDeletePlacedPart = useCallback((id: string) => {
    saveState()
    setComponents((prev) => {
      const deleting = prev.find((c) => c.id === id)
      if (!deleting || deleting.position === undefined) {
        const updated = prev.filter((c) => c.id !== id)
        onCircuitChange(updated)
        return updated
      }

      const start = Math.round(deleting.position)
      const len = Math.max(0, Math.round(deleting.length))
      const without = prev.filter((c) => c.id !== id)
      // Removing the segment shifts items after its END boundary.
      const shifted = shiftComponentPositionsAtOrAfter(without, start + len, -len)
      onCircuitChange(shifted)
      return shifted
    })

    if (selectedId === id) setSelectedId(null)
  }, [onCircuitChange, saveState, selectedId])

  // NEW: Drag placed part - simple position update, no DNA splicing!
  useEffect(() => {
    if (!draggingPlacedPart) return

    let raf: number | null = null
    let lastMouse: MouseEvent | null = null

    const applyMove = (e: MouseEvent) => {
      if (!canvasRef.current || !scrollContainerRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const x = e.clientX - rect.left + scrollLeft - activeLineX
      
      const current = components.find((c) => c.id === draggingPlacedPart.id)
      if (!current || current.position === undefined) return
      const oldPos = Math.round(current.position)
      const len = Math.max(0, Math.round(current.length))

      const desiredLeftX = x - draggingPlacedPartMouseOffsetPxRef.current
      const desiredPosWithSegment = Math.round(desiredLeftX * bpPerPixel)
      const closedLength = Math.max(0, expandedLengthBase - len)
      // Map from "open" coordinates (where the moving segment exists at [oldPos, oldPos+len))
      // to "closed" coordinates (where that segment is removed).
      // Important: only subtract len once the boundary is past the END of the segment.
      const desiredClosed =
        desiredPosWithSegment >= oldPos + len ? desiredPosWithSegment - len : desiredPosWithSegment

      // Build "closed" component list (moving segment removed)
      const othersClosed = components
        .filter((c) => c.id !== draggingPlacedPart.id && c.position !== undefined)
        .map((c) => {
          const p = Math.round(c.position!)
          // Removing the segment shifts only components at/after the END boundary.
          const newP = p >= oldPos + len ? p - len : p
          return { ...c, position: newP }
        })

      const { position: insertPosClosed } = snapToValidInsertionPosition(desiredClosed, closedLength, othersClosed, { componentLength: len, isRepositioning: true })

      // Re-open: shift components at/after insertion by +len, then insert moving component at insertPosClosed.
      const shifted = shiftComponentPositionsAtOrAfter(othersClosed, insertPosClosed, len)
      const next = [
        ...shifted,
        { ...current, position: insertPosClosed, x: bpToX(insertPosClosed) },
      ]

      setComponents(next)
      onCircuitChange(next)

      draggingPlacedPartStartRef.current = insertPosClosed
    }

    const handleMove = (e: MouseEvent) => {
      lastMouse = e
      if (raf !== null) return
      raf = window.requestAnimationFrame(() => {
        raf = null
        if (lastMouse) applyMove(lastMouse)
      })
    }

    const handleUp = () => {
      setDraggingPlacedPart(null)
      draggingPlacedPartStartRef.current = null
      draggingPlacedPartMouseOffsetPxRef.current = 0
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggingPlacedPart, bpPerPixel, lineX, bpToX, onCircuitChange, components, expandedLengthBase])

  const handlePartMouseDown = useCallback((e: React.MouseEvent, comp: CircuitComponent) => {
    if (e.button !== 0) return
    // NEW: Use position field
    if (comp.position === undefined) return
    e.preventDefault()
    e.stopPropagation()

    // One undo step for the whole drag
    saveState()

    // Stop any canvas drag
    setIsDragging(false)
    // Hide cursor immediately so it doesn't flash during box manipulation
    if (cursorHideTimerRef.current !== null) {
      window.clearTimeout(cursorHideTimerRef.current)
      cursorHideTimerRef.current = null
    }
    setCursorVisible(false)
    setCursorPosition(null)
    lastCursorPositionRef.current = null
    setCursorBp(null)
    setCursorPlaced(false)

    const len = comp.length
    setDraggingPlacedPart({ id: comp.id, length: len })
    draggingPlacedPartStartRef.current = comp.position

    // Compute grab offset so the box doesn't shift when drag starts
    if (canvasRef.current && scrollContainerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const x = e.clientX - rect.left + scrollLeft - activeLineX
      const compLeftX = bpToX(comp.position)
      draggingPlacedPartMouseOffsetPxRef.current = x - compLeftX
    } else {
      draggingPlacedPartMouseOffsetPxRef.current = 0
    }
  }, [saveState, setCursorVisible, setCursorPosition, setCursorBp, setCursorPlaced, lineX, bpPerPixel, components, bpToX])


  // Center the view on initial mount or zoom/resize (but NOT when DNA length changes)
  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0 && totalWidth > 0 && scrollContainerRef.current) {
      // Center on initial mount or when zoom/canvas size changes
      // Don't center when DNA length changes (totalWidth changes) - preserve scroll position
      const shouldCenter = !hasInitialCenteredRef.current || 
                          (prevZoomRef.current !== null && prevZoomRef.current !== zoom)
      
      if (shouldCenter) {
        const newScrollLeft = totalWidth > canvasWidth ? (totalWidth - canvasWidth) / 2 : 0
        scrollContainerRef.current.scrollLeft = Math.max(0, newScrollLeft)
        setScrollLeft(Math.max(0, newScrollLeft))
        hasInitialCenteredRef.current = true
        prevZoomRef.current = zoom
      }
    }
  }, [canvasWidth, canvasHeight, zoom]) // Removed totalWidth from dependencies - preserve scroll when DNA length changes

  // Sync scroll position with state
  const [scrollLeft, setScrollLeft] = useState(0)
  useEffect(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const handleScroll = () => {
      setScrollLeft(container.scrollLeft)
    }
    
    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Calculate content dimensions
  const contentHeight = Math.max(400, canvasHeight || 400)
  const minInnerWidth = useMemo(() => {
    if (canvasWidth > 0) {
      // Include displaced width from inserted parts so the strand never gets clipped.
      return Math.max(canvasWidth + 1, strandWidthPx)
    }
    return Math.max(1, strandWidthPx)
  }, [canvasWidth, strandWidthPx])
  
  const minInnerHeight = useMemo(() => {
    // Ensure all stacked cells fit vertically inside the single panel, plus room for the culture '+' button.
    if (renderCells.length === 0) return Math.max(contentHeight, canvasHeight || 0)
    const lastIdx = renderCells.length - 1
    const lastLineY = cellLineYs[lastIdx] ?? baseLineY
    const lastCell = renderCells[lastIdx]
    const plasmidCount = lastCell?.circuits?.length ?? 1
    const { frameBottom } = computeCellFrame(lastLineY, plasmidCount)

    const culturePlusPad = 140
    const needed = Math.round(frameBottom + culturePlusPad)
    if (canvasHeight > 0) return Math.max(canvasHeight, needed)
    return Math.max(contentHeight, needed)
  }, [
    canvasHeight,
    contentHeight,
    renderCells,
    baseLineY,
    cellLineYs,
    computeCellFrame,
  ])

  // Custom scrollbar hook
  const scrollbar = useCustomScrollbar({
    scrollContainerRef,
    canvasWidth,
    minInnerWidth,
    scrollLeft,
    setScrollLeft,
  })

  // Abstract view dragging uses the same placed-part drag path (position updates only).
  
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'circuit-component',
    hover: (item: { type: string; name: string; subType?: string }, monitor) => {
      const offset = monitor.getClientOffset()
      if (offset && canvasRef.current && scrollContainerRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const scrollLeft = scrollContainerRef.current.scrollLeft
        const target = getHoverPlasmidTargetFromClientOffset(offset)
        const targetLineX = target?.plasmidLineX ?? activeLineX
        const targetTotalWidth = target?.plasmidTotalWidth ?? activeTotalWidthPx
        const x = offset.x - rect.left + scrollLeft - targetLineX

        // If user is hovering a specific plasmid inside a cell, target that plasmid for preview (and for drop).
        if (target && cultureCells && cultureCells.length > 0) {
          if (onActivateCell) onActivateCell(target.cellId)
          if (onActivatePlasmid) onActivatePlasmid(target.cellId, target.plasmidIdx)
        }

        // Highlight only the hovered cell (not the whole canvas).
        if (target) {
          const cellLineY = cellLineYs[target.cellIdx] ?? baseLineY
          const cell = renderCells[target.cellIdx]
          const plasmidCount = cell?.circuits?.length ?? 1
          const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmidCount)
          setDragTargetCellFrame({
            left: frameLeft,
            top: frameTop,
            width: frameWidth,
            height: Math.max(0, frameBottom - frameTop),
          })
        } else {
          setDragTargetCellFrame(null)
        }
        
        // Check if mouse is over strand area (includes displaced width from inserted parts)
        // Allow some negative margin so components can be placed at position 0 even if mouse is slightly left
        const componentLength = COMPONENT_SIZES[item.type] || 100
        const componentWidthPx = componentLength / bpPerPixel
        const leftMargin = componentWidthPx / 2 + 20 // Allow mouse to be up to half component width + 20px left of DNA start
        if (x >= -leftMargin && x <= targetTotalWidth + leftMargin) {

          // Use the target plasmid's component list for snapping (so preview respects overlaps on that plasmid).
          const targetComps =
            target && cultureCells && cultureCells.length > 0
              ? (cultureCells.find((c) => c.id === target.cellId)?.circuits?.[target.plasmidIdx]?.components ?? components)
              : components
          const expandedLenForTarget = getExpandedLengthForComponents(
            Number(
              (target && cultureCells && cultureCells.length > 0
                ? cultureCells.find((c) => c.id === target.cellId)?.circuits?.[target.plasmidIdx]?.dnaLength
                : undefined) ?? dnaLength
            ),
            targetComps
          )
          
          // Expanded insertion boundary (integer bp index)
          const desiredPosition = Math.round(x * bpPerPixel)
          const { position, snapped, blockedBy } = snapToValidInsertionPosition(
            desiredPosition,
            expandedLenForTarget,
            targetComps,
            { componentLength }
          )
          
          setDragPreviewPosition({
            bp: position,  // Using position field (will be renamed in future)
            componentLength,
            componentType: item.type,
            componentName: item.name,
            blockedPartIds: blockedBy,
            snappedFromBlocked: snapped,
            targetLineY: target?.plasmidLineY,
            targetCellId: target?.cellId,
            targetPlasmidIndex: target?.plasmidIdx,
            targetLineX: targetLineX,
          })
        } else {
          // Outside DNA area
          setDragPreviewPosition(null)
        }
      }
    },
    drop: (item: { type: string; name: string; subType?: string }, monitor) => {
      // Clear any selection to prevent browser default behavior
      setSelection(null)
      
      const componentLength = COMPONENT_SIZES[item.type] || 100
      
      // Use dragPreviewPosition if available (DNA view), otherwise calculate from mouse (abstract view)
      let position: number
      if (dragPreviewPosition) {
        // DNA view: use resolved position from hover
        position = dragPreviewPosition.bp
      } else {
        // Abstract view: calculate from mouse position and apply no-overlap logic
        const offset = monitor.getClientOffset()
        if (!offset || !canvasRef.current || !scrollContainerRef.current) {
          setDragPreviewPosition(null)
          return
        }
        const rect = canvasRef.current.getBoundingClientRect()
        const scrollLeft = scrollContainerRef.current.scrollLeft
        const x = offset.x - rect.left + scrollLeft - activeLineX
        // Clamp x to valid range before calculating position (allows drops near edges)
        const clampedX = Math.max(0, Math.min(totalWidth, x))
        const desiredPosition = Math.round(clampedX * bpPerPixel)
        position = snapToValidInsertionPosition(desiredPosition, expandedLayout.expandedLength, components, { componentLength }).position
      }
      
      const y = showAbstractView ? 190 : 200
      
      // NEW: Component with its own sequence (immutable)
      const newComponent: CircuitComponent = {
        id: `${item.type}-${Date.now()}`,
        type: item.type,
        name: item.name,
        subType: item.subType,
        x: bpToX(position),
        y: y,  // Always defined
        position,  // NEW: insertion position
        sequence: Array(componentLength).fill('N'),  // NEW: component's own DNA
        length: componentLength,
        color: COMPONENT_COLORS[item.type] || '#666',
      }
      
      // Insert semantics in expanded space: shift downstream components and add new component at boundary
      saveState()
      const targetCellId = dragPreviewPosition?.targetCellId
      const targetPlasmidIndex = dragPreviewPosition?.targetPlasmidIndex
      const isCultureTarget =
        !!targetCellId &&
        typeof targetPlasmidIndex === 'number' &&
        cultureCells &&
        cultureCells.length > 0 &&
        typeof onCircuitChangeForPlasmid === 'function'

      if (isCultureTarget) {
        const cell = cultureCells.find((c) => c.id === targetCellId)
        const baseComps = cell?.circuits?.[targetPlasmidIndex]?.components ?? []
        const shifted = shiftComponentPositionsAtOrAfter(baseComps, position, componentLength)
        const updatedComponents = [...shifted, newComponent]
        onCircuitChangeForPlasmid!(targetCellId!, targetPlasmidIndex!, updatedComponents)
        // If we're currently editing this plasmid, keep local state in sync too.
        if (targetCellId === (activeCellId ?? '__single__') && targetPlasmidIndex === (renderCells[activeIdx]?.activeCircuitIndex ?? 0)) {
          setComponents(updatedComponents)
        }
      } else {
        const shifted = shiftComponentPositionsAtOrAfter(components, position, componentLength)
        const updatedComponents = [...shifted, newComponent]
        setComponents(updatedComponents)
        onCircuitChange(updatedComponents)
      }
      setDragPreviewPosition(null)
      setDragTargetCellFrame(null)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [
    bpToX,
    bpPerPixel,
    showAbstractView,
    lineX,
    dragPreviewPosition,
    showBasePairs,
    strandWidthPx,
    totalWidth,
    components,
    onCircuitChange,
    onCircuitChangeForPlasmid,
    saveState,
    expandedLengthBase,
    cultureCells,
    activeCellId,
    renderCells,
    activeIdx,
    onActivateCell,
    onActivatePlasmid,
    getHoverPlasmidTargetFromClientOffset,
    getExpandedLengthForComponents,
    renderCells,
    cellLineYs,
    baseLineY,
    computeCellFrame,
  ])

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setComponents((prev) => {
      const updated = prev.map((comp) => {
        if (comp.id === id) {
          return {
            ...comp,
            x,
            y,
          }
        }
        return comp
      })
      onCircuitChange(updated)
      return updated
    })
  }, [onCircuitChange])

  const handleNodeDelete = useCallback((id: string) => {
    saveState()
    
    setComponents((prev) => {
      const updated = prev.filter((comp) => comp.id !== id)
      onCircuitChange(updated)
      return updated
    })
    if (selectedId === id) {
      setSelectedId(null)
    }
  }, [selectedId, onCircuitChange, saveState])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection) {
        e.preventDefault()
        handleCopySelection()
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selection) {
        e.preventDefault()
        handleCutSelection()
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault()
        handlePaste()
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) {
          e.preventDefault()
          handleDeleteSelection()
        } else if (selectedId) {
          e.preventDefault()
          handleNodeDelete(selectedId)
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
      
      if (e.key === 'Escape') {
        setSelection(null)
        setContextMenu(null)
        setSelectedId(null)
        setOverlappingComponentIds([])
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, selection, clipboard, selectedId, handleCopySelection, handleCutSelection, handlePaste, handleDeleteSelection, handleNodeDelete, handleUndo, handleRedo, setSelection])

  // Handlers for DNASequenceRenderer
  const handleCursorMove = useCallback((e: React.MouseEvent) => {
    // Don't activate cursor while manipulating a placed part box
    if (draggingPlacedPart) return
    // Don't update cursor if user is actively dragging a selection
    if (selectionDragRef.current.isDragging) return
    if ((e.target as HTMLElement).closest?.('.dna-part-box') || (e.target as HTMLElement).closest?.('.dna-part-delete')) {
      return
    }
    // Always show cursor on mouse move in DNA view (removed cursorPlaced check for better responsiveness)
    if (cursorHideTimerRef.current !== null) {
      window.clearTimeout(cursorHideTimerRef.current)
      cursorHideTimerRef.current = null
    }
    const cursorPos = getCursorPositionFromMouseActive(e)
    if (cursorPos !== null) {
      if (lastCursorPositionRef.current !== cursorPos) {
        lastCursorPositionRef.current = cursorPos
        setCursorPosition(cursorPos)
      }
      setCursorVisible(true)
    }
  }, [draggingPlacedPart, getCursorPositionFromMouseActive, setCursorPosition, setCursorVisible])

  const handleCursorLeave = useCallback(() => {
    // Only hide cursor if it's not placed and there's no active selection
    // Use a small delay to prevent flickering
    if (!cursorPlaced && !selectionDragRef.current.isDragging && !selection) {
      if (cursorHideTimerRef.current !== null) {
        window.clearTimeout(cursorHideTimerRef.current)
        cursorHideTimerRef.current = null
      }
      // Small timeout to prevent flicker when cursor briefly leaves/re-enters
      cursorHideTimerRef.current = window.setTimeout(() => {
        cursorHideTimerRef.current = null
        if (!cursorPlaced && !selectionDragRef.current.isDragging && !selection) {
          setCursorVisible(false)
          setCursorPosition(null)
          lastCursorPositionRef.current = null
        }
      }, 50)
    }
  }, [cursorPlaced, selection, setCursorVisible, setCursorPosition])

  const handleBaseEnter = useCallback((index: number) => {
    // Don't activate cursor while manipulating a placed part box
    if (draggingPlacedPart) return
    // Don't update cursor if user is actively dragging a selection
    if (selectionDragRef.current.isDragging) return
    
    setCursorBp(index)
    // In DNA view, always show cursor on hover (more responsive feel)
    // The cursorPlaced check is less relevant in DNA view where individual bases are hoverable
    const cursorPos = index + 1
    if (cursorHideTimerRef.current !== null) {
      window.clearTimeout(cursorHideTimerRef.current)
      cursorHideTimerRef.current = null
    }
    if (lastCursorPositionRef.current !== cursorPos) {
      lastCursorPositionRef.current = cursorPos
      setCursorPosition(cursorPos)
    }
    setCursorVisible(true)
  }, [draggingPlacedPart, setCursorBp, setCursorPosition, setCursorVisible])

  const handleBaseLeave = useCallback(() => {
    setCursorBp(null)
  }, [setCursorBp])

  const handleComponentClick = useCallback((comp: CircuitComponent) => {
    setSelectedId(comp.id)
    setSelection(null)
    setOverlappingComponentIds([])
    setBackboneSelected(false)
  }, [setSelectedId, setSelection])

  const handleComponentMouseDown = useCallback((e: React.MouseEvent, comp: CircuitComponent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.abstract-block-delete')) {
      return
    }
    e.preventDefault()
    e.stopPropagation()

    // Same drag behavior as DNA view: move the component's insertion index
    if (comp.position !== undefined) {
      handlePartMouseDown(e, comp)
      setSelectedId(comp.id)
      return
    }

    // Should be rare now (components are generally always insertion-positioned)
    hasDraggedRef.current = false
    dragComponentStartRef.current = { x: e.clientX, startBp: 0 }
    setDraggingComponentId(comp.id)
    setSelectedId(comp.id)
  }, [handlePartMouseDown])

  // Set up refs for drag and drop
  useEffect(() => {
    if (canvasRef.current) {
      drop(canvasRef.current)
    }
  }, [drop])

  // Clear drag preview position when drag ends (isOver becomes false)
  useEffect(() => {
    if (!isOver && dragPreviewPosition) {
      // Small delay to allow drop handler to run first
      const timer = setTimeout(() => {
        setDragPreviewPosition(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOver, dragPreviewPosition])

  // Clear cell-only drag highlight when drag leaves/ends.
  useEffect(() => {
    if (!isOver && dragTargetCellFrame) {
      const t = setTimeout(() => setDragTargetCellFrame(null), 100)
      return () => clearTimeout(t)
    }
  }, [isOver, dragTargetCellFrame])

  // Note: DNA/component "sync" validation no longer applies (components are overlays, DNA is not spliced).

  return (
    <div
      ref={canvasRef}
      className={`circuit-canvas ${isOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={(e) => {
        onActivate?.()
        handleMouseDown(e)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        
        // Priority 1: If there's an active DNA selection, show DNA context menu
        if (selection && (selection.startBp !== selection.endBp)) {
          const bp = getBpFromMouseActive(e)
          if (bp !== null) {
            // Check if right-click is within the selection
            const selStart = Math.min(selection.startBp, selection.endBp)
            const selEnd = Math.max(selection.startBp, selection.endBp)
            if (bp >= selStart && bp <= selEnd) {
              setContextMenu({ x: e.clientX, y: e.clientY, bp })
              return
            }
          }
        }
        
        // Priority 2: If in DNA view, show DNA context menu
        if (showBasePairs) {
          const bp = getBpFromMouseActive(e)
          if (bp !== null) {
            setContextMenu({ x: e.clientX, y: e.clientY, bp })
            return
          }
        }
        
        // Priority 3: Right-click on a cell - open the cell editor
        const target = getHoverPlasmidTargetFromClientOffset({ x: e.clientX, y: e.clientY })
        if (target) {
          e.stopPropagation()
          onActivateCell?.(target.cellId)
          onActivatePlasmid?.(target.cellId, target.plasmidIdx)
          onEditCell?.(target.cellId)
          return
        }
      }}
      onClick={(e) => {
        onActivate?.()
        // Don't clear selection if we just finished a drag selection
        // The selection should persist after dragging until user explicitly clicks off
        if (selectionDragRef.current.hasMoved && selectionDragRef.current.isDragging === false) {
          // Reset the flag but keep the selection
          selectionDragRef.current.hasMoved = false
          return
        }
        
        const target = e.target as HTMLElement
        const isClickingComponent = target.closest('.abstract-component-block') || target.closest('.circuit-node')
        const isClickingDNABase = target.hasAttribute('data-bp-index') || target.closest('[data-bp-index]')
        const isClickingControl =
          target.closest('.canvas-controls') ||
          target.closest('.selection-info') ||
          target.closest('.backbone-bar') ||
          target.closest('.cell-add-circuit')
        const isClickingScrollbar = target.closest('.custom-scrollbar-horizontal')
        
        // Only clear selection when clicking on empty canvas (not on DNA, components, or controls)
        if (!isClickingComponent && !isClickingDNABase && !isClickingControl && !isClickingScrollbar) {
          setContextMenu(null)
          setSelection(null)
          setSelectedId(null)
          setOverlappingComponentIds([])
          setBackboneSelected(false)
          setCursorPlaced(false)
          if (cursorHideTimerRef.current !== null) {
            window.clearTimeout(cursorHideTimerRef.current)
            cursorHideTimerRef.current = null
          }
          setCursorVisible(false)
          setCursorPosition(null)
          lastCursorPositionRef.current = null
        }
      }}
    >
      <div 
        ref={scrollContainerRef}
        className="canvas-scroll-container"
        style={{
          width: '100%',
          height: '100%',
          overflowX: 'hidden',
          // Allow vertical pan to see stacked cells, but don't show a second scrollbar.
          overflowY: 'auto',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        <div 
          className="canvas-inner-wrapper"
          style={{ 
            width: `${minInnerWidth}px`, 
            height: `${minInnerHeight}px`,
            minWidth: `${minInnerWidth}px`,
            minHeight: `${minInnerHeight}px`,
            position: 'relative',
          }}
        >
          {/* While dragging a part, highlight only the cell currently under the cursor. */}
          {dragTargetCellFrame && (
            <div
              style={{
                position: 'absolute',
                left: dragTargetCellFrame.left,
                top: dragTargetCellFrame.top,
                width: dragTargetCellFrame.width,
                height: dragTargetCellFrame.height,
                borderRadius: 16,
                border: `2px solid ${hexToRgba(accentColor, 0.55)}`,
                background: hexToRgba(accentColor, 0.08),
                boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.15)}`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}
          {/* Render non-active cells (visual-only) stacked vertically in the same panel */}
          {renderCells.map((cell, idx) => {
            if (cell.id === (activeCellId ?? '__single__')) return null
            const cellLineY = cellLineYs[idx] ?? baseLineY
            const plasmids = cell.circuits?.length ? cell.circuits : []
            const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmids.length || 1)

            return (
              <div key={`cell-preview-${cell.id}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {/* cell frame + label */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${frameLeft}px`,
                    top: `${frameTop}px`,
                    width: `${frameWidth}px`,
                    height: `${Math.max(1, frameBottom - frameTop)}px`,
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
                    left: `${frameLeft + 14}px`,
                    top: `${frameTop}px`,
                    transform: 'translateY(-50%)',
                    padding: '4px 10px',
                    fontFamily: 'Courier New, monospace',
                    fontWeight: 700,
                    fontSize: 12,
                    color: hexToRgba(accentColor, 0.95),
                    background: bgSecondary,
                    zIndex: 1,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cell.cellType}: {cell.cellName}
                </div>

                {/* plasmids stacked */}
                {plasmids.map((p, pi) => {
                  const y = cellLineY + pi * plasmidSpacingPx
                  const comps = p.components ?? []
                  const bgLen = Number((p as any).dnaLength ?? DNA_LENGTH)
                  const bgSeq = Array.isArray((p as any).dnaSequence) ? ((p as any).dnaSequence as string[]) : generateDNA(bgLen)
                  const layout = buildExpandedLayout({ backgroundSequence: bgSeq, components: comps, extraInsertions: [] })
                  const plasmidTotalWidthPx = layout.expandedLength / bpPerPixel
                  const plasmidLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidthPx) / 2))
                  return (
                    <DNASequenceRenderer
                      key={`cell-${cell.id}-plasmid-${p.id}`}
                      dnaSequence={layout.expandedSequence}
                      dnaLength={layout.expandedLength}
                      components={comps}
                      selection={null}
                      cursorBp={null}
                      cursorPlaced={false}
                      selectedId={null}
                      draggingComponentId={null}
                      showBasePairs={showBasePairs}
                      showAbstractView={showAbstractView}
                      transitionFactor={transitionFactor}
                      zoom={zoom}
                      fontSize={fontSize}
                      bpPerPixel={bpPerPixel}
                      totalWidth={plasmidTotalWidthPx}
                      lineX={plasmidLineX}
                      lineY={y}
                      bpToX={bpToX}
                      hasDraggedRef={hasDraggedRef}
                      dragComponentStartRef={dragComponentStartRef}
                      selectionDragRef={selectionDragRef}
                      onBaseMouseDown={() => {}}
                      onCursorMove={() => {}}
                      onCursorLeave={() => {}}
                      onBaseEnter={() => {}}
                      onBaseLeave={() => {}}
                      onComponentClick={() => {}}
                      onComponentMouseDown={() => {}}
                      onComponentDelete={() => {}}
                      highlightedPartIds={[]}
                      backbone={p.backbone}
                      backboneSelected={false}
                      onSelectBackbone={() => {}}
                      onEditBackbone={undefined}
                      suppressCellFrame={true}
                    />
                  )
                })}
              </div>
            )
          })}

          <DNASequenceRenderer
            dnaSequence={expandedLayout.expandedSequence}
            dnaLength={expandedLayout.expandedLength}
            components={components}
            selection={selection}
            cursorBp={cursorBp}
            cursorPlaced={cursorPlaced}
            selectedId={selectedId}
            draggingComponentId={draggingComponentId}
            showBasePairs={showBasePairs}
            showAbstractView={showAbstractView}
            transitionFactor={transitionFactor}
            zoom={zoom}
            fontSize={fontSize}
            bpPerPixel={bpPerPixel}
            totalWidth={activeTotalWidthPx}
            lineX={activeLineX}
            lineY={activeLineY}
            bpToX={bpToX}
            hasDraggedRef={hasDraggedRef}
            dragComponentStartRef={dragComponentStartRef}
            selectionDragRef={selectionDragRef}
            onBaseMouseDown={handleBaseMouseDown}
            onCursorMove={handleCursorMove}
            onCursorLeave={handleCursorLeave}
            onBaseEnter={handleBaseEnter}
            onBaseLeave={handleBaseLeave}
            onComponentClick={handleComponentClick}
            onComponentMouseDown={handleComponentMouseDown}
            onComponentDelete={handleNodeDelete}
            getCursorPositionFromMouse={getCursorPositionFromMouseActive}
            setCursorPosition={setCursorPosition}
            setCursorVisible={setCursorVisible}
            dragGap={dragPreviewPosition ? { startBp: dragPreviewPosition.bp, length: dragPreviewPosition.componentLength } : null}
            highlightedPartIds={overlappingComponentIds.length > 0 ? overlappingComponentIds : (dragPreviewPosition?.blockedPartIds || [])}
            onPartMouseDown={handlePartMouseDown}
            onPartDelete={handleDeletePlacedPart}
            onPartContextMenu={onPartContextMenu}
            backbone={backbone}
            onEditBackbone={onEditBackbone}
            backboneSelected={backboneSelected}
            onSelectBackbone={() => {
              setBackboneSelected(true)
              setSelectedId(null)
              setSelection(null)
              setOverlappingComponentIds([])
            }}
            suppressCellFrame={true}
          />

          {/* Active cell frame + label */}
          {(() => {
            const activeCell = renderCells[activeIdx]
            if (!activeCell) return null
            const cellLineY = cellLineYs[activeIdx] ?? baseLineY
            const plasmids = activeCell.circuits?.length ? activeCell.circuits : []
            const { frameLeft, frameTop, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmids.length || 1)
            const frameHeight = Math.max(1, frameBottom - frameTop)
            return (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: `${frameLeft}px`,
                    top: `${frameTop}px`,
                    width: `${frameWidth}px`,
                    height: `${frameHeight}px`,
                    border: `2px dotted ${hexToRgba(accentColor, 0.7)}`,
                    borderRadius: 14,
                    background: 'transparent',
                    zIndex: 1,
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${frameLeft + 14}px`,
                    top: `${frameTop}px`,
                    transform: 'translateY(-50%)',
                    padding: '4px 10px',
                    fontFamily: 'Courier New, monospace',
                    fontWeight: 700,
                    fontSize: 12,
                    color: hexToRgba(accentColor, 0.95),
                    background: bgSecondary,
                    zIndex: 2,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeCell.cellType}: {activeCell.cellName}
                </div>
              </>
            )
          })()}

          {/* Render the other plasmids in the ACTIVE cell, stacked under the active one */}
          {(() => {
            const activeCell = renderCells[activeIdx]
            if (!activeCell) return null
            return (activeCell.circuits ?? []).map((p, pi) => {
              if (pi === activePlasmidIdx) return null
              const y = (cellLineYs[activeIdx] ?? baseLineY) + pi * plasmidSpacingPx
              const comps = p.components ?? []
              const bgLen = Number((p as any).dnaLength ?? DNA_LENGTH)
              const bgSeq = Array.isArray((p as any).dnaSequence) ? ((p as any).dnaSequence as string[]) : generateDNA(bgLen)
              const layout = buildExpandedLayout({ backgroundSequence: bgSeq, components: comps, extraInsertions: [] })
              const plasmidTotalWidthPx = layout.expandedLength / bpPerPixel
              const plasmidLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidthPx) / 2))
              
              // Handler to switch to this plasmid on interaction
              const handleActivateThisPlasmid = () => {
                onActivatePlasmid?.(activeCell.id, pi)
              }
              
              return (
                <div key={`active-cell-plasmid-preview-${p.id}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
                  <DNASequenceRenderer
                    dnaSequence={layout.expandedSequence}
                    dnaLength={layout.expandedLength}
                    components={comps}
                    selection={null}
                    cursorBp={null}
                    cursorPlaced={false}
                    selectedId={null}
                    draggingComponentId={null}
                    showBasePairs={showBasePairs}
                    showAbstractView={showAbstractView}
                    transitionFactor={transitionFactor}
                    zoom={zoom}
                    fontSize={fontSize}
                    bpPerPixel={bpPerPixel}
                    totalWidth={plasmidTotalWidthPx}
                    lineX={plasmidLineX}
                    lineY={y}
                    bpToX={bpToX}
                    hasDraggedRef={hasDraggedRef}
                    dragComponentStartRef={dragComponentStartRef}
                    selectionDragRef={selectionDragRef}
                    onBaseMouseDown={handleActivateThisPlasmid}
                    onCursorMove={handleActivateThisPlasmid}
                    onCursorLeave={() => {}}
                    onBaseEnter={handleActivateThisPlasmid}
                    onBaseLeave={() => {}}
                    onComponentClick={handleActivateThisPlasmid}
                    onComponentMouseDown={handleActivateThisPlasmid}
                    onComponentDelete={() => {}}
                    highlightedPartIds={[]}
                    backbone={p.backbone}
                    backboneSelected={false}
                    onSelectBackbone={handleActivateThisPlasmid}
                    onEditBackbone={undefined}
                    suppressCellFrame={true}
                  />
                </div>
              )
            })
          })()}

          {/* Add-plasmid button inside each cell, below its last plasmid */}
          {(onAddCircuitInCellForCell || onAddCircuitInCell) && renderCells.length > 0 && (
            <>
              {renderCells.map((cell, idx) => {
                const cellLineY = cellLineYs[idx] ?? baseLineY
                const plasmids = cell.circuits?.length ? cell.circuits : []
                const { frameLeft, frameWidth, frameBottom } = computeCellFrame(cellLineY, plasmids.length || 1)
                const size = 30
                const isActiveCell = cell.id === (activeCellId ?? '__single__')
                return (
                  <button
                    key={`cell-add-plasmid-${cell.id}`}
                    className="cell-add-circuit"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onActivateCell?.(cell.id)
                      // Keep active plasmid index stable when adding (defaults to last active).
                      onActivatePlasmid?.(cell.id, cell.activeCircuitIndex ?? 0)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onAddCircuitInCellForCell) {
                        onAddCircuitInCellForCell(cell.id)
                      } else {
                        // Back-compat: open using current active cell
                        onActivateCell?.(cell.id)
                        onAddCircuitInCell?.()
                      }
                    }}
                    title="Add another plasmid to this cell"
                    style={{
                      position: 'absolute',
                      left: frameLeft + frameWidth / 2 - size / 2,
                      top: frameBottom - size - 10,
                      width: size,
                      height: size,
                      borderRadius: 999,
                      border: `2px solid ${hexToRgba(accentColor, 0.85)}`,
                      background: bgSecondary,
                      color: hexToRgba(accentColor, 0.95),
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 900,
                      fontSize: 22,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: isActiveCell ? 8 : 7,
                      opacity: isActiveCell ? 1 : 0.9,
                    }}
                  >
                    +
                  </button>
                )
              })}
            </>
          )}

          {/* Add-cell button (culture) pinned above the horizontal scrollbar */}
          {onAddCell && (
            <button
              className="culture-add-cell"
              onMouseDown={(e) => {
                e.stopPropagation()
                onActivateCell?.(activeCellId ?? '__single__')
              }}
              onClick={(e) => {
                e.stopPropagation()
                onAddCell()
              }}
              title="Add a new cell to the culture"
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 64,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: `2px solid ${hexToRgba(accentColor, 0.85)}`,
                background: bgSecondary,
                color: hexToRgba(accentColor, 0.95),
                fontFamily: 'Courier New, monospace',
                fontWeight: 900,
                fontSize: 30,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 50,
              }}
            >
              +
            </button>
          )}

          {/* Delete button on each cell frame (top-right) */}
          {onDeleteCell && (
            <>
              {renderCells.map((cell, idx) => {
                const cellLineY = cellLineYs[idx] ?? baseLineY
                const plasmidCount = cell.circuits?.length ?? 1
                const { frameLeft, frameTop, frameWidth } = computeCellFrame(cellLineY, plasmidCount)
                const size = 18
                const left = frameLeft + frameWidth - size / 2
                const top = frameTop - size / 2

                return (
                  <button
                    key={`cell-delete-${cell.id}`}
                    className="cell-delete"
                    title="Delete cell"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onActivateCell?.(cell.id)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (renderCells.length <= 1) {
                        window.alert('You must keep at least one cell in the culture.')
                        return
                      }
                      const yes = window.confirm('Delete this cell from the culture?')
                      if (!yes) return
                      onDeleteCell(cell.id)
                    }}
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width: size,
                      height: size,
                      borderRadius: 4,
                      border: `1px solid ${hexToRgba(accentColor, 0.8)}`,
                      background: bgSecondary,
                      color: hexToRgba(accentColor, 0.95),
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 900,
                      fontSize: 14,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 60,
                    }}
                  >
                    ×
                  </button>
                )
              })}
            </>
          )}

          {/* Delete button for each plasmid (top-right of the right connector) */}
          {onDeletePlasmid && renderCells.length > 0 && (
            <>
              {renderCells.flatMap((cell, cellIdx) => {
                const cellLineY = cellLineYs[cellIdx] ?? baseLineY
                const plasmids = cell.circuits ?? []
                if (plasmids.length <= 1) return []

                const size = 16
                const dx = 2 // slight outward offset
                const dy = -2

                return plasmids.map((p, pIdx) => {
                  const y = Math.round(cellLineY + pIdx * plasmidSpacingPx)
                  const comps = p.components ?? []
                  const expandedLen = getExpandedLengthForComponents(Number((p as any).dnaLength ?? DNA_LENGTH), comps)
                  const plasmidTotalWidthPx = expandedLen / bpPerPixel
                  const plasmidLineX = Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidthPx) / 2))

                  // Geometry copied from DNASequenceRenderer for right connector position, but plasmid-specific.
                  const backbonePad = Math.round(Math.max(35, Math.min(80, 55 * zoom)))
                  const backboneLeft = Math.round(plasmidLineX - backbonePad)
                  const backboneWidth = Math.round(plasmidTotalWidthPx + backbonePad * 2)
                  const backboneStubLen = Math.round(Math.max(14, Math.min(28, 18 * zoom)))
                  const connectorXRight = Math.round(backboneLeft + backboneWidth + backboneStubLen)

                  const left = connectorXRight - size / 2 + dx
                  const top = y - size / 2 + dy
                  const isActiveCell = cell.id === activeCellId
                  const isActivePlasmid = isActiveCell && pIdx === (cell.activeCircuitIndex ?? 0)

                  return (
                    <button
                      key={`plasmid-delete-${cell.id}-${p.id}`}
                      className="plasmid-delete"
                      title="Delete plasmid"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        onActivateCell?.(cell.id)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const yes = window.confirm('Delete this plasmid from the cell?')
                        if (!yes) return
                        onDeletePlasmid(cell.id, p.id)
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: size,
                        height: size,
                        borderRadius: 4,
                        border: `1px solid ${hexToRgba(accentColor, 0.8)}`,
                        background: bgSecondary,
                        color: hexToRgba(accentColor, 0.95),
                        fontFamily: 'Courier New, monospace',
                        fontWeight: 900,
                        fontSize: 12,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: isActivePlasmid ? 80 : 40,
                        opacity: isActiveCell ? 1 : 0.85,
                      }}
                    >
                      ×
                    </button>
                  )
                })
              })}
            </>
          )}
          <DNACursor
            cursorVisible={cursorVisible}
            cursorPosition={cursorPosition}
            showBasePairs={showBasePairs}
            cursorPlaced={cursorPlaced}
            zoom={zoom}
            bpToX={bpToX}
            lineX={cursorRenderLineX}
            lineY={cursorRenderLineY}
          />
          <DNASelectionHighlight
            selection={selection}
            showBasePairs={showBasePairs}
            dnaLength={expandedLayout.expandedLength}
            zoom={zoom}
            bpToX={bpToX}
            lineX={cursorRenderLineX}
            lineY={cursorRenderLineY}
          />
          {/* Operon highlights for ALL plasmids in ALL cells */}
          {showOperonHighlights && (() => {
            if (renderCells.length === 0) {
              // Single plasmid mode (no culture)
              return (
                <OperonHighlight
                  operons={circuitAnalysis.operons}
                  selectedOperonId={selectedOperonId}
                  bpToX={bpToX}
                  lineY={activeLineY}
                  lineX={activeLineX}
                  zoom={zoom}
                  strandSpacing={strandSpacing}
                  baseHeight={baseHeight}
                  onOperonClick={onOperonClick}
                />
              )
            }
            // Multi-cell mode: render operons for each plasmid in ALL cells
            return renderCells.flatMap((cell, cellIdx) => {
              const cellLineY = cellLineYs[cellIdx] ?? baseLineY
              const isActiveCell = cell.id === (activeCellId ?? '__single__')
              
              return (cell.circuits || []).map((p, pi) => {
                const y = cellLineY + pi * plasmidSpacingPx
                const isActivePlasmid = isActiveCell && pi === activePlasmidIdx
                
                // For the active plasmid, use local state (components, expandedLayout) to stay in sync with DNA rendering
                // For other plasmids, use cultureCells data
                const comps = isActivePlasmid ? components : (p.components ?? [])
                const bgLen = isActivePlasmid ? dnaLength : Number((p as any).dnaLength ?? DNA_LENGTH)
                const bgSeq = isActivePlasmid ? dnaSequence : (Array.isArray((p as any).dnaSequence) ? ((p as any).dnaSequence as string[]) : generateDNA(bgLen))
                const layout = isActivePlasmid ? expandedLayout : buildExpandedLayout({ backgroundSequence: bgSeq, components: comps, extraInsertions: [] })
                const plasmidTotalWidthPx = layout.expandedLength / bpPerPixel
                const plasmidLineX = isActivePlasmid ? activeLineX : Math.round(laneLineX + Math.max(0, (laneTotalWidth - plasmidTotalWidthPx) / 2))
                
                // Get operons for this specific plasmid
                const plasmidModel = new CircuitModel(comps, layout.expandedLength)
                const validation = plasmidModel.validateCircuit()
                const plasmidOperons = validation.operons
                
                // Create a bpToX function for this plasmid
                const plasmidBpToX = (bp: number) => bp / bpPerPixel
                
                return (
                  <OperonHighlight
                    key={`operon-highlight-${cell.id}-${p.id}`}
                    operons={plasmidOperons}
                    selectedOperonId={selectedOperonId}
                    bpToX={plasmidBpToX}
                    lineY={y}
                    lineX={plasmidLineX}
                    zoom={zoom}
                    strandSpacing={strandSpacing}
                    baseHeight={baseHeight}
                    onOperonClick={onOperonClick}
                    cellId={cell.id}
                    plasmidId={p.id}
                  />
                )
              })
            })
          })()}
          {/* Drag preview overlay (uses the same insertion-boundary mapping) */}
          <DragPreviewOverlay
            dragPreviewPosition={dragPreviewPosition}
            showBasePairs={showBasePairs}
            zoom={zoom}
            bpToX={bpToX}
            bpPerPixel={bpPerPixel}
            lineX={dragPreviewPosition?.targetLineX ?? activeLineX}
            lineY={dragPreviewPosition?.targetLineY ?? activeLineY}
            baseHeight={baseHeight}
            strandSpacing={strandSpacing}
            fontSize={fontSize}
          />
          {/* Free-floating nodes (components without insertion position) are legacy; hide them in culture mode
              to avoid confusing "floating parts" when the lane resizes. */}
          {showAbstractView && scrollContainerRef.current && (!cultureCells || cultureCells.length === 0) && components
            .filter((comp) => comp.position === undefined) // Only render CircuitNode for components NOT placed on the strand
            .map((comp) => {
            const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
            return (
              <div 
                key={comp.id} 
                style={{ 
                  pointerEvents: 'auto', 
                  position: 'absolute', 
                  left: `${comp.x}px`, 
                  top: `${comp.y}px`,
                  zIndex: 2,
                }}
              >
                <CircuitNode
                  component={{
                    ...comp,
                    x: (comp.x || 0) - scrollLeft,
                    y: comp.y || 200,  // Ensure y is always defined
                  }}
                  isSelected={selectedId === comp.id}
                  onSelect={() => setSelectedId(comp.id)}
                  onMove={(id, x, y) => {
                    if (scrollContainerRef.current) {
                      const currentScrollLeft = scrollContainerRef.current.scrollLeft
                      handleNodeMove(id, x + currentScrollLeft, y)
                    }
                  }}
                  onDelete={handleNodeDelete}
                />
              </div>
            )
          })}
        </div>
      </div>
      <CustomScrollbar
        scrollLeft={scrollLeft}
        isDraggingHScroll={scrollbar.isDraggingHScroll}
        hasHorizontalScroll={scrollbar.hasHorizontalScroll}
        hScrollTrackWidth={scrollbar.hScrollTrackWidth}
        hScrollThumbWidth={scrollbar.hScrollThumbWidth}
        hScrollThumbLeft={scrollbar.hScrollThumbLeft}
        scrollbarSize={scrollbar.scrollbarSize}
        hScrollTrackRef={scrollbar.hScrollTrackRef}
        onMouseDown={scrollbar.handleHScrollMouseDown}
      />
      {/* Top-right controls: zoom info + zoom buttons */}
      <div className="top-right-controls">
        <div className="zoom-info">
          <span className="zoom-level">{zoom.toFixed(1)}x</span>
          <span className="view-mode">{showBasePairs ? 'DNA View' : 'Parts View'}</span>
        </div>
        <div className="zoom-buttons">
          <button
            className="zoom-btn"
            onClick={() => setZoom(Math.min(10, zoom * 1.1))}
            title="Zoom In"
          >
            +
          </button>
          <button
            className="zoom-btn"
            onClick={() => setZoom(Math.max(0.5, zoom / 1.1))}
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>
      {selection && (
        <SelectionInfo
          selection={selection}
          dnaSequence={dnaSequence}
        />
      )}
      <ContextMenu
        contextMenu={contextMenu}
        selection={selection}
        clipboard={clipboard}
        cursorPosition={cursorPosition}
        dnaSequence={dnaSequence}
        isInsideComponent={contextMenu ? isOriginInsideComponent(contextMenu.bp) : false}
        onClose={() => setContextMenu(null)}
        onCopy={handleCopySelection}
        onCut={handleCutSelection}
        onPaste={handlePaste}
        onReverseComplement={handleReverseComplement}
        onDelete={handleDeleteSelection}
        onSetOrigin={handleSetOrigin}
      />
      <DragPreview
        bpPerPixel={bpPerPixel}
        strandSpacing={strandSpacing}
        baseHeight={baseHeight}
        dragPreviewPosition={dragPreviewPosition}
      />
      {/* Bottom status bar */}
      <CanvasStatusBar
        fileName={fileName}
        dnaLength={dnaLength}
        selection={selection}
      />
    </div>
  )
}
