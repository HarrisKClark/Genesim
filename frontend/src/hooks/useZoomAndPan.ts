import { useState, useCallback, useEffect } from 'react'

interface UseZoomAndPanProps {
  canvasRef?: React.RefObject<HTMLDivElement> // Not used but kept for consistency
  scrollContainerRef: React.RefObject<HTMLDivElement>
  showBasePairs?: boolean
  selectionDragRef?: React.MutableRefObject<{
    startCursorPos: number | null
    isDragging: boolean
    hasMoved: boolean
  }>
}

export function useZoomAndPan({
  scrollContainerRef,
  showBasePairs,
  selectionDragRef,
}: UseZoomAndPanProps) {
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 })

  // Simple zoom: scroll to zoom in/out (no scrolling allowed)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Always prevent default to stop any scrolling behavior
    e.preventDefault()
    e.stopPropagation()
    
    // Only handle zoom, never scroll
    const zoomFactor = 1.1
    const zoomDirection = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor
    setZoom((prevZoom) => {
      const newZoom = Math.max(0.5, Math.min(10, prevZoom * zoomDirection))
      return newZoom
    })
  }, [])

  // Handle mouse drag for horizontal scrolling (when zoomed in, not selecting)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    if (showBasePairs === false) return // Only allow drag scrolling when zoomed in
    if (selectionDragRef?.current?.isDragging) return // Don't scroll while selecting
    
    const target = e.target as HTMLElement
    // Don't drag if clicking on a component or control or abstract block
    if (target.closest('.circuit-node') || target.closest('.canvas-controls') || target.closest('.abstract-component-block')) {
      return
    }
    
    // Don't start drag scrolling if clicking on DNA sequence (let selection handle it)
    if (target.hasAttribute('data-bp-index') || target.closest('[data-bp-index]')) {
      return
    }
    
    e.preventDefault()
    setIsDragging(true)
    if (scrollContainerRef.current) {
      setDragStart({
        x: e.clientX,
        scrollLeft: scrollContainerRef.current.scrollLeft,
      })
    }
  }, [showBasePairs, scrollContainerRef, selectionDragRef])

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
  }, [isDragging, dragStart, showBasePairs, scrollContainerRef])

  // Handle zoom via scroll container wheel events
  useEffect(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    
    // Prevent wheel scrolling but allow zoom
    const handleWheel = (e: WheelEvent) => {
      // Always prevent scrolling
      e.preventDefault()
      e.stopPropagation()
      
      // Handle zoom (same logic as handleWheel on canvas)
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
  }, [scrollContainerRef])

  return {
    zoom,
    setZoom,
    isDragging,
    handleWheel,
    handleMouseDown,
  }
}

