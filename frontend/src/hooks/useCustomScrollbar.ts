import { useState, useCallback, useEffect, useRef } from 'react'

interface UseCustomScrollbarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>
  canvasWidth: number
  minInnerWidth: number
  scrollLeft: number
  setScrollLeft: React.Dispatch<React.SetStateAction<number>>
}

export function useCustomScrollbar({
  scrollContainerRef,
  canvasWidth,
  minInnerWidth,
  scrollLeft,
  setScrollLeft,
}: UseCustomScrollbarProps) {
  const [isDraggingHScroll, setIsDraggingHScroll] = useState(false)
  const hScrollDragStart = useRef({ x: 0, scrollLeft: 0 })
  const hScrollTrackRef = useRef<HTMLDivElement | null>(null)

  const scrollbarSize = 12
  const hasHorizontalScroll = minInnerWidth > canvasWidth
  
  // Calculate scrollbar thumb positions and sizes
  const hScrollTrackWidth = canvasWidth // No vertical scrollbar, so full width
  const hScrollThumbWidth = Math.max(30, (canvasWidth / minInnerWidth) * hScrollTrackWidth)
  const hScrollThumbLeft = hasHorizontalScroll ? (scrollLeft / (minInnerWidth - canvasWidth)) * (hScrollTrackWidth - hScrollThumbWidth) : 0

  // Handle horizontal scrollbar track click (jump to position) and thumb drag
  const handleHScrollMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!scrollContainerRef.current || !hScrollTrackRef.current) return
    
    const trackRect = hScrollTrackRef.current.getBoundingClientRect()
    const clickX = e.clientX - trackRect.left
    const thumbLeft = hScrollThumbLeft
    const thumbWidth = hScrollThumbWidth
    
    // Check if clicking on thumb or track
    if (clickX >= thumbLeft && clickX <= thumbLeft + thumbWidth) {
      // Clicking on thumb - start drag
      setIsDraggingHScroll(true)
      hScrollDragStart.current = { x: e.clientX, scrollLeft: scrollLeft }
    } else {
      // Clicking on track - jump to that position
      const maxScroll = minInnerWidth - canvasWidth
      const trackWidth = hScrollTrackWidth - hScrollThumbWidth
      const scrollRatio = Math.max(0, Math.min(1, (clickX - thumbWidth / 2) / trackWidth))
      const newScrollLeft = scrollRatio * maxScroll
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = newScrollLeft
        setScrollLeft(newScrollLeft)
      }
    }
  }, [scrollLeft, hScrollThumbLeft, hScrollThumbWidth, minInnerWidth, canvasWidth, scrollContainerRef, setScrollLeft])

  // Handle horizontal scrollbar drag
  useEffect(() => {
    if (!isDraggingHScroll || !scrollContainerRef.current || !hScrollTrackRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current || !hScrollTrackRef.current) return
      const container = scrollContainerRef.current
      const trackRect = hScrollTrackRef.current.getBoundingClientRect()
      const trackWidth = hScrollTrackWidth
      const thumbWidth = hScrollThumbWidth
      const maxScroll = minInnerWidth - canvasWidth
      
      // Calculate mouse position relative to track
      const mouseX = e.clientX - trackRect.left
      // Calculate how far mouse moved from initial click position
      const initialMouseX = hScrollDragStart.current.x - trackRect.left
      const deltaX = mouseX - initialMouseX
      
      // Calculate scroll ratio based on track space (excluding thumb width)
      const scrollRatio = deltaX / (trackWidth - thumbWidth)
      const newScrollLeft = Math.max(0, Math.min(maxScroll, hScrollDragStart.current.scrollLeft + (scrollRatio * maxScroll)))
      
      container.scrollLeft = newScrollLeft
      setScrollLeft(newScrollLeft)
    }

    const handleMouseUp = () => {
      setIsDraggingHScroll(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingHScroll, hScrollTrackWidth, hScrollThumbWidth, minInnerWidth, canvasWidth, scrollContainerRef, setScrollLeft])

  return {
    isDraggingHScroll,
    hScrollTrackRef,
    scrollbarSize,
    hasHorizontalScroll,
    hScrollTrackWidth,
    hScrollThumbWidth,
    hScrollThumbLeft,
    handleHScrollMouseDown,
  }
}

