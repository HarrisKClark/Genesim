import { useState, useCallback, useEffect, useRef } from 'react'
import { DNASelection, CircuitComponent } from '../types/dnaTypes'
import { calculateSelectionRange } from '../utils/selectionUtils'
import { getCursorPositionFromMouse, cursorPosToBaseIndex } from '../utils/coordinateUtils'

interface UseDNASelectionProps {
  canvasRef: React.RefObject<HTMLDivElement>
  scrollContainerRef: React.RefObject<HTMLDivElement>
  canvasWidth: number
  totalWidth: number
  bpPerPixel: number
  dnaLength: number
  showBasePairs: boolean
  draggingComponentId: string | null
  /**
   * Optional: given an expanded base index, return true if it is selectable.
   * If false, cursor/selection will be snapped to the nearest selectable boundary.
   */
  isBpSelectable?: (bpIndex: number) => boolean
  bpToX?: (bp: number) => number // Not used in hook but kept for consistency
  selectionDragRef?: React.MutableRefObject<{
    startCursorPos: number | null
    isDragging: boolean
    hasMoved: boolean
  }>
  /**
   * Optional: components to check for overlap with selection
   */
  components?: CircuitComponent[]
  /**
   * Optional: callback when selection overlaps components change
   */
  onOverlappingComponentsChange?: (componentIds: string[]) => void
}

export function useDNASelection({
  canvasRef,
  scrollContainerRef,
  canvasWidth,
  totalWidth,
  bpPerPixel,
  dnaLength,
  showBasePairs,
  draggingComponentId,
  isBpSelectable,
  bpToX: _bpToX, // Not used in hook
  selectionDragRef: externalSelectionDragRef,
  components = [],
  onOverlappingComponentsChange,
}: UseDNASelectionProps) {
  const [selection, setSelection] = useState<DNASelection | null>(null)
  const [cursorBp, setCursorBp] = useState<number | null>(null)
  const [cursorPosition, setCursorPosition] = useState<number | null>(null)
  const [cursorVisible, setCursorVisible] = useState(false)
  const [cursorPlaced, setCursorPlaced] = useState(false)

  // Track selection drag state - use external ref if provided, otherwise create internal one
  const internalSelectionDragRef = useRef<{
    startCursorPos: number | null
    isDragging: boolean
    hasMoved: boolean
  }>({
    startCursorPos: null,
    isDragging: false,
    hasMoved: false,
  })
  
  const selectionDragRef = externalSelectionDragRef || internalSelectionDragRef

  // Get cursor position from mouse - wrapper that uses coordinate utils
  const getCursorPos = useCallback((e: React.MouseEvent | MouseEvent): number | null => {
    const pos = getCursorPositionFromMouse(
      e,
      canvasRef,
      scrollContainerRef,
      canvasWidth,
      totalWidth,
      bpPerPixel,
      dnaLength,
      showBasePairs
    )
    if (pos === null) return null

    if (!isBpSelectable) return pos
    // Cursor position N is boundary between base N-1 and N.
    // If base under cursor is not selectable, snap cursor to nearest boundary outside the blocked run.
    const baseIndex = Math.max(0, Math.min(dnaLength - 1, Math.floor(pos)))
    if (isBpSelectable(baseIndex)) return pos

    // Scan outward to find nearest selectable base; then snap boundary accordingly.
    let left = baseIndex
    let right = baseIndex
    while (left >= 0 || right < dnaLength) {
      if (left >= 0 && isBpSelectable(left)) {
        return left // boundary before that base
      }
      if (right < dnaLength && isBpSelectable(right)) {
        return right // boundary before that base
      }
      left--
      right++
    }
    return pos
  }, [canvasRef, scrollContainerRef, canvasWidth, totalWidth, bpPerPixel, dnaLength, showBasePairs])

  // Convert cursor position to base index
  const cursorToBaseIndex = useCallback((cursorPos: number): number => {
    return cursorPosToBaseIndex(cursorPos, dnaLength)
  }, [dnaLength])

  // Handle base pair selection - mouse down
  const handleBaseMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    // Allow selection in both DNA view and abstract view
    if (draggingComponentId) return // Don't select while dragging component
    
    const target = e.target as HTMLElement
    // Don't select if clicking on a component or control or abstract block
    if (target.closest('.circuit-node') || target.closest('.canvas-controls') || target.closest('.abstract-component-block')) {
      return
    }
    
    // Calculate cursor position from mouse
    const cursorPos = getCursorPos(e)
    if (cursorPos === null) return
    
    // Place cursor at this position
    setCursorPosition(cursorPos)
    setCursorPlaced(true)
    setCursorVisible(true)
    
    // Initialize selection drag state
    selectionDragRef.current = {
      startCursorPos: cursorPos,
      isDragging: true,
      hasMoved: false,
    }
    
    // Clear existing selection on click (unless Shift is held)
    // Note: Selection will be set during drag if user moves mouse
    // If user just clicks without dragging, selection stays cleared
    if (!e.shiftKey) {
      setSelection(null)
      if (onOverlappingComponentsChange) {
        onOverlappingComponentsChange([])
      }
    }
    
    e.preventDefault()
    e.stopPropagation()
  }, [getCursorPos, draggingComponentId])

  // Handle mouse move and mouse up for selection
  useEffect(() => {
    if (draggingComponentId) return // Don't select while dragging component
    
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingComponentId) return // Don't select while dragging component
      if (!selectionDragRef.current.isDragging || selectionDragRef.current.startCursorPos === null) return
      
      // Get current cursor position
      const cursorPos = getCursorPos(e as any)
      if (cursorPos === null) return
      
      // Update cursor position for visual feedback
      setCursorPosition(cursorPos)
      setCursorVisible(true)
      
      // Check if mouse has moved significantly (more than 3 pixels) to start selection
      // We'll use cursor position change as a proxy for mouse movement
      const cursorDelta = Math.abs(cursorPos - selectionDragRef.current.startCursorPos)
      if (cursorDelta > 0.1) { // Small threshold for cursor position change
        selectionDragRef.current.hasMoved = true
      }
      
      // If mouse has moved, update selection
      if (selectionDragRef.current.hasMoved) {
        // Convert cursor positions to base indices
        // Cursor position N means "after base N-1" (insertion point)
        const startCursorPos = selectionDragRef.current.startCursorPos
        
        // Special case: if cursor returns to start position, clear selection
        // This handles the case where user drags forward then back to origin
        if (Math.abs(cursorPos - startCursorPos) < 0.1) {
          // Cursor is at or very close to start position - no selection
          setSelection(null)
          return
        }
        
        // When dragging forward (cursorPos > startCursorPos):
        //   - Start: select base AFTER start cursor = startCursorPos
        //   - End: select base BEFORE end cursor = cursorPos - 1
        // When dragging backward (cursorPos < startCursorPos):
        //   - Start: select base AFTER end cursor = cursorPos
        //   - End: select base BEFORE start cursor = startCursorPos - 1
        const isDraggingForward = cursorPos > startCursorPos
        
        let startBp: number
        let endBp: number
        
        if (isDraggingForward) {
          // Dragging forward: select bases from after start cursor to before end cursor
          // Example: cursor 3 to 4 should select base 3 only
          startBp = Math.max(0, Math.min(dnaLength - 1, Math.floor(startCursorPos)))
          endBp = Math.max(0, Math.min(dnaLength - 1, Math.floor(cursorPos) - 1))
        } else {
          // Dragging backward: select bases from after end cursor to before start cursor
          // Example: cursor 4 to 3 should select base 3 only
          startBp = Math.max(0, Math.min(dnaLength - 1, Math.floor(cursorPos)))
          endBp = Math.max(0, Math.min(dnaLength - 1, Math.floor(startCursorPos) - 1))
        }
        
        // Calculate selection range (handles edge cases)
        const { startBp: finalStartBp, endBp: finalEndBp } = calculateSelectionRange(startBp, endBp, dnaLength)
        setSelection({ startBp: finalStartBp, endBp: finalEndBp })
        
        // Check for component overlaps
        if (onOverlappingComponentsChange) {
          const overlappingIds: string[] = []
          const selStart = Math.min(finalStartBp, finalEndBp)
          const selEnd = Math.max(finalStartBp, finalEndBp)
          
          for (const comp of components) {
            if (comp.position === undefined) continue
            const compStart = Math.round(comp.position)
            const compEnd = compStart + Math.round(comp.length)
            
            // Check if selection overlaps component (any overlap)
            if (selStart < compEnd && selEnd > compStart) {
              overlappingIds.push(comp.id)
            }
          }
          
          onOverlappingComponentsChange(overlappingIds)
        }
      }
    }
    
    const handleMouseUp = () => {
      // Only process if we were dragging
      if (selectionDragRef.current.isDragging) {
        // Only keep selection if mouse moved (user actually dragged)
        // If user just clicked without dragging, clear selection
        if (!selectionDragRef.current.hasMoved) {
          // Just a click, no selection
          setSelection(null)
          if (onOverlappingComponentsChange) {
            onOverlappingComponentsChange([])
          }
        }
        // If hasMoved is true, selection is already set and should persist
        // Don't clear it here - let it stay until user clicks off
        
        // Reset drag state (but keep hasMoved flag temporarily so onClick can check it)
        // We'll reset hasMoved in the onClick handler after it checks
        selectionDragRef.current = {
          startCursorPos: null,
          isDragging: false,
          hasMoved: selectionDragRef.current.hasMoved, // Keep hasMoved flag for onClick check
        }
      }
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [getCursorPos, cursorToBaseIndex, dnaLength, draggingComponentId, components, onOverlappingComponentsChange])

  return {
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
    selectionDragRef,
    handleBaseMouseDown,
  }
}

