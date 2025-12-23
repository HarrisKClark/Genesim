import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useDrop } from 'react-dnd'
import CircuitNode from './CircuitNode'
import './CircuitCanvas.css'
import { CircuitComponent } from '../types/dnaTypes'
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
import {
  snapToValidInsertionPosition,
  shiftComponentPositionsAtOrAfter,
  migrateComponent,
} from '../utils/componentPositioning'
import { buildExpandedLayout } from '../utils/expandedLayout'

interface CircuitCanvasProps {
  onCircuitChange: (data: CircuitComponent[]) => void
  circuitData: CircuitComponent[] | null
  zoomSensitivity: number
  fileName?: string
  // Operon analysis props
  showOperonHighlights?: boolean
  selectedOperonId?: string | null
  onOperonClick?: (operonId: string) => void
  onAnalysisUpdate?: (analysis: any) => void
  onPartContextMenu?: (e: React.MouseEvent, part: any) => void
}

export default function CircuitCanvas({ 
  onCircuitChange, 
  circuitData, 
  fileName = 'Untitled Circuit',
  showOperonHighlights = false,
  selectedOperonId = null,
  onOperonClick,
  onAnalysisUpdate,
  onPartContextMenu,
}: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasInitialCenteredRef = useRef(false)
  const prevZoomRef = useRef<number | null>(null)
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
  // Background DNA (does not include component bases)
  const [dnaSequence, setDnaSequence] = useState<string[]>(generateDNA(DNA_LENGTH))
  const [dnaLength, setDnaLength] = useState(DNA_LENGTH)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; bp: number } | null>(null)
  
  // Expanded length (background + inserted component bases). Used for view/canvas sizing.
  const expandedLengthBase = useMemo(() => {
    const inserted = components
      .filter((c) => c.position !== undefined)
      .reduce((acc, c) => acc + Math.max(0, Math.round(c.length)), 0)
    return Math.max(0, dnaLength + inserted)
  }, [dnaLength, components])
  
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
    handleWheel,
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
    getBpFromMouse,
    getCursorPositionFromMouse,
  } = viewState
  
  // Drag preview state for component insertion
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{
    bp: number
    componentLength: number
    componentType: string
    componentName: string
    blockedPartIds?: string[]
    snappedFromBlocked?: boolean
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
    dnaLength: expandedLengthBase,
    enabled: true, // Always run analysis
  })
  
  // Notify parent of analysis updates
  useEffect(() => {
    if (onAnalysisUpdate) {
      onAnalysisUpdate(circuitAnalysis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, expandedLengthBase])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (selectionDragRef.current.isDragging) return
    
    const target = e.target as HTMLElement
    // If user is interacting with a placed part, don't pan the canvas.
    if (target.closest('.dna-part-box') || target.closest('.dna-part-delete')) {
      return
    }
    if (target.closest('.circuit-node') || target.closest('.canvas-controls') || target.closest('.abstract-component-block')) {
      return
    }
    
    if (target.hasAttribute('data-bp-index') || target.closest('[data-bp-index]')) {
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
  }, [showBasePairs])

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

  // Handle zoom via scroll container wheel events
  useEffect(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const zoomFactor = 1.1
      const zoomDirection = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.5, Math.min(10, prevZoom * zoomDirection))
        return newZoom
      })
    }
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

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
    totalWidth,
    bpPerPixel,
    dnaLength: expandedLayout.expandedLength,
    showBasePairs,
    draggingComponentId,
    isBpSelectable: (bpIdx) => !expandedLayout.isComponentBaseIndex(bpIdx),
    bpToX,
    selectionDragRef,
    components,
    onOverlappingComponentsChange: setOverlappingComponentIds,
  })

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
      const x = e.clientX - rect.left + scrollLeft - lineX
      
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

      const { position: insertPosClosed } = snapToValidInsertionPosition(desiredClosed, closedLength, othersClosed)

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
    setCursorVisible(false)
    setCursorPosition(null)
    setCursorBp(null)
    setCursorPlaced(false)

    const len = comp.length
    setDraggingPlacedPart({ id: comp.id, length: len })
    draggingPlacedPartStartRef.current = comp.position

    // Compute grab offset so the box doesn't shift when drag starts
    if (canvasRef.current && scrollContainerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const x = e.clientX - rect.left + scrollLeft - lineX
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
    if (canvasHeight > 0) {
      return canvasHeight
    }
    return contentHeight
  }, [canvasHeight, contentHeight])

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
        const x = offset.x - rect.left + scrollLeft - lineX
        
        // Check if mouse is over strand area (includes displaced width from inserted parts)
        if (x >= 0 && x <= strandWidthPx) {
          const componentLength = COMPONENT_SIZES[item.type] || 100
          
          // Expanded insertion boundary (integer bp index)
          const desiredPosition = Math.round(x * bpPerPixel)
          const { position, snapped, blockedBy } = snapToValidInsertionPosition(
            desiredPosition,
            expandedLengthBase,
            components
          )
          
          setDragPreviewPosition({
            bp: position,  // Using position field (will be renamed in future)
            componentLength,
            componentType: item.type,
            componentName: item.name,
            blockedPartIds: blockedBy,
            snappedFromBlocked: snapped,
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
        const x = offset.x - rect.left + scrollLeft - lineX
        const desiredPosition = Math.round(x * bpPerPixel)
        position = snapToValidInsertionPosition(desiredPosition, expandedLengthBase, components).position
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
      const shifted = shiftComponentPositionsAtOrAfter(components, position, componentLength)
      const updatedComponents = [...shifted, newComponent]
      setComponents(updatedComponents)
      onCircuitChange(updatedComponents)
      setDragPreviewPosition(null)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [bpToX, bpPerPixel, showAbstractView, lineX, dragPreviewPosition, showBasePairs, strandWidthPx, totalWidth, components, onCircuitChange, saveState, expandedLengthBase])

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
  }, [selection, clipboard, selectedId, handleCopySelection, handleCutSelection, handlePaste, handleDeleteSelection, handleNodeDelete, handleUndo, handleRedo, setSelection])

  // Handlers for DNASequenceRenderer
  const handleCursorMove = useCallback((e: React.MouseEvent) => {
    // Don't activate cursor while manipulating a placed part box
    if (draggingPlacedPart) return
    if ((e.target as HTMLElement).closest?.('.dna-part-box') || (e.target as HTMLElement).closest?.('.dna-part-delete')) {
      return
    }
    if (!cursorPlaced && !selectionDragRef.current.isDragging) {
      const cursorPos = getCursorPositionFromMouse(e)
      if (cursorPos !== null) {
        setCursorPosition(cursorPos)
        setCursorVisible(true)
      }
    }
  }, [draggingPlacedPart, cursorPlaced, getCursorPositionFromMouse, setCursorPosition, setCursorVisible])

  const handleCursorLeave = useCallback(() => {
    // Only hide cursor if it's not placed and there's no active selection
    // Use a small delay to prevent flickering
    if (!cursorPlaced && !selectionDragRef.current.isDragging && !selection) {
      // Small timeout to prevent flicker when cursor briefly leaves/re-enters
      setTimeout(() => {
        if (!cursorPlaced && !selectionDragRef.current.isDragging && !selection) {
          setCursorVisible(false)
          setCursorPosition(null)
        }
      }, 50)
    }
  }, [cursorPlaced, selection, setCursorVisible, setCursorPosition])

  const handleBaseEnter = useCallback((index: number) => {
    // Don't activate cursor while manipulating a placed part box
    if (draggingPlacedPart) return
    setCursorBp(index)
    if (!cursorPlaced) {
      // Allow cursor in both DNA view and abstract view
      const cursorPos = index + 1
      setCursorPosition(cursorPos)
      setCursorVisible(true)
    }
  }, [draggingPlacedPart, cursorPlaced, setCursorBp, setCursorPosition, setCursorVisible])

  const handleBaseLeave = useCallback(() => {
    setCursorBp(null)
  }, [setCursorBp])

  const handleComponentClick = useCallback((comp: CircuitComponent) => {
    setSelectedId(comp.id)
    setSelection(null)
    setOverlappingComponentIds([])
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

  // Note: DNA/component "sync" validation no longer applies (components are overlays, DNA is not spliced).

  return (
    <div
      ref={canvasRef}
      className={`circuit-canvas ${isOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        // Enable context menu in both views
        e.preventDefault()
        const bp = getBpFromMouse(e)
        if (bp !== null && showBasePairs) {
          setContextMenu({ x: e.clientX, y: e.clientY, bp })
        }
      }}
      onClick={(e) => {
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
        const isClickingControl = target.closest('.canvas-controls') || target.closest('.selection-info')
        const isClickingScrollbar = target.closest('.custom-scrollbar-horizontal')
        
        // Only clear selection when clicking on empty canvas (not on DNA, components, or controls)
        if (!isClickingComponent && !isClickingDNABase && !isClickingControl && !isClickingScrollbar) {
          setContextMenu(null)
          setSelection(null)
          setSelectedId(null)
          setOverlappingComponentIds([])
          setCursorPlaced(false)
          setCursorVisible(false)
          setCursorPosition(null)
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
          overflowY: 'hidden',
          position: 'relative',
          cursor: showBasePairs && isDragging ? 'grabbing' : showBasePairs ? 'grab' : 'default',
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
            totalWidth={totalWidth}
            lineX={lineX}
            lineY={lineY}
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
            getCursorPositionFromMouse={getCursorPositionFromMouse}
            setCursorPosition={setCursorPosition}
            setCursorVisible={setCursorVisible}
            dragGap={dragPreviewPosition ? { startBp: dragPreviewPosition.bp, length: dragPreviewPosition.componentLength } : null}
            highlightedPartIds={overlappingComponentIds.length > 0 ? overlappingComponentIds : (dragPreviewPosition?.blockedPartIds || [])}
            onPartMouseDown={handlePartMouseDown}
            onPartDelete={handleDeletePlacedPart}
            onPartContextMenu={onPartContextMenu}
          />
          <DNACursor
            cursorVisible={cursorVisible}
            cursorPosition={cursorPosition}
            showBasePairs={showBasePairs}
            cursorPlaced={cursorPlaced}
            zoom={zoom}
            bpToX={bpToX}
            lineX={lineX}
            lineY={lineY}
          />
          <DNASelectionHighlight
            selection={selection}
            showBasePairs={showBasePairs}
            dnaLength={expandedLayout.expandedLength}
            zoom={zoom}
            bpToX={bpToX}
            lineX={lineX}
            lineY={lineY}
          />
          {/* Operon highlights */}
          {showOperonHighlights && (
            <OperonHighlight
              operons={circuitAnalysis.operons}
              selectedOperonId={selectedOperonId}
              bpToX={bpToX}
              lineY={lineY}
              lineX={lineX}
              zoom={zoom}
              strandSpacing={strandSpacing}
              baseHeight={baseHeight}
              onOperonClick={onOperonClick}
            />
          )}
          {/* Drag preview overlay (uses the same insertion-boundary mapping) */}
          <DragPreviewOverlay
            dragPreviewPosition={dragPreviewPosition}
            showBasePairs={showBasePairs}
            zoom={zoom}
            bpToX={bpToX}
            bpPerPixel={bpPerPixel}
            lineX={lineX}
            lineY={lineY}
            baseHeight={baseHeight}
            strandSpacing={strandSpacing}
            fontSize={fontSize}
          />
          {showAbstractView && scrollContainerRef.current && components
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
