import { useState, useCallback, useEffect, useMemo, RefObject } from 'react'
import { BP_PER_PIXEL_BASE } from '../constants/circuitConstants'
import { 
  bpToX as bpToXUtil, 
  xToBp as xToBpUtil, 
  getBpFromMouse as getBpFromMouseUtil, 
  getCursorPositionFromMouse as getCursorPositionFromMouseUtil 
} from '../utils/coordinateUtils'

interface UseViewStateProps {
  canvasRef: RefObject<HTMLDivElement>
  scrollContainerRef: RefObject<HTMLDivElement>
  dnaLength: number
}

interface UseViewStateReturn {
  // Zoom state
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  handleWheel: (e: React.WheelEvent) => void
  
  // Pan state
  isDragging: boolean
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  dragStart: { x: number; scrollLeft: number }
  setDragStart: React.Dispatch<React.SetStateAction<{ x: number; scrollLeft: number }>>
  
  // View mode
  showBasePairs: boolean
  showAbstractView: boolean
  transitionFactor: number
  viewCutoffZoom: number
  
  // Canvas dimensions
  canvasWidth: number
  setCanvasWidth: React.Dispatch<React.SetStateAction<number>>
  canvasHeight: number
  setCanvasHeight: React.Dispatch<React.SetStateAction<number>>
  lineX: number
  lineY: number
  
  // Rendering dimensions
  fontSize: number
  baseWidth: number
  baseHeight: number
  strandSpacing: number
  bpPerPixel: number
  totalWidth: number
  minSpacing: number
  
  // Coordinate conversion
  bpToX: (bp: number) => number
  xToBp: (x: number) => number
  getBpFromMouse: (e: React.MouseEvent | MouseEvent) => number | null
  getCursorPositionFromMouse: (e: React.MouseEvent | MouseEvent) => number | null
}

export function useViewState({
  canvasRef,
  scrollContainerRef,
  dnaLength,
}: UseViewStateProps): UseViewStateReturn {
  // Zoom state
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 })
  
  // Canvas dimensions
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [canvasHeight, setCanvasHeight] = useState(0)
  
  // Calculate base pair rendering dimensions
  const fontSize = useMemo(() => Math.max(12, Math.min(18, 12 + (zoom - 1) * 0.8)), [zoom])
  const baseWidth = useMemo(() => Math.max(fontSize + 4, Math.min(20, 2 * zoom)), [fontSize, zoom])
  const minSpacing = useMemo(() => baseWidth + 2, [baseWidth])
  const baseHeight = useMemo(() => Math.max(12, Math.min(24, 12 * zoom)), [zoom])
  const strandSpacing = useMemo(() => Math.max(20, Math.min(40, 20 * zoom)), [zoom])
  
  // Calculate base bpPerPixel
  const baseBpPerPixel = BP_PER_PIXEL_BASE / zoom
  
  // Calculate effective bpPerPixel
  const bpPerPixel = useMemo(() => {
    const transitionStart = 1.5
    const transitionEnd = 2.5
    let transitionFactor = 0
    if (zoom >= transitionStart && zoom <= transitionEnd) {
      transitionFactor = (zoom - transitionStart) / (transitionEnd - transitionStart)
    } else if (zoom > transitionEnd) {
      transitionFactor = 1
    }
    
    const minBpPerPixel = 1 / minSpacing
    return baseBpPerPixel * (1 - transitionFactor) + Math.min(baseBpPerPixel, minBpPerPixel) * transitionFactor
  }, [zoom, baseBpPerPixel, minSpacing])
  
  const totalWidth = useMemo(() => dnaLength / bpPerPixel, [dnaLength, bpPerPixel])
  
  // Hard cutoff between abstract and DNA view
  const viewCutoffZoom = 2.0
  const transitionFactor = useMemo(() => {
    return zoom >= viewCutoffZoom ? 1 : 0
  }, [zoom, viewCutoffZoom])
  
  const showBasePairs = zoom >= viewCutoffZoom
  const showAbstractView = zoom < viewCutoffZoom
  
  // Calculate centered positions
  const lineY = useMemo(() => canvasHeight > 0 ? canvasHeight / 2 : 200, [canvasHeight])
  const lineX = useMemo(() => canvasWidth > 0 && totalWidth < canvasWidth ? (canvasWidth - totalWidth) / 2 : 0, [canvasWidth, totalWidth])
  
  // Coordinate conversion functions
  const bpToX = useCallback((bp: number) => bpToXUtil(bp, bpPerPixel), [bpPerPixel])
  const xToBp = useCallback((x: number) => xToBpUtil(x, bpPerPixel), [bpPerPixel])
  const getBpFromMouse = useCallback((e: React.MouseEvent | MouseEvent): number | null => {
    return getBpFromMouseUtil(e, canvasRef, scrollContainerRef, canvasWidth, totalWidth, bpPerPixel, dnaLength)
  }, [canvasRef, scrollContainerRef, canvasWidth, totalWidth, bpPerPixel, dnaLength])
  const getCursorPositionFromMouse = useCallback((e: React.MouseEvent | MouseEvent): number | null => {
    return getCursorPositionFromMouseUtil(e, canvasRef, scrollContainerRef, canvasWidth, totalWidth, bpPerPixel, dnaLength, showBasePairs)
  }, [canvasRef, scrollContainerRef, canvasWidth, totalWidth, bpPerPixel, dnaLength, showBasePairs])
  
  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const zoomFactor = 1.1
    const zoomDirection = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor
    setZoom((prevZoom) => {
      const newZoom = Math.max(0.5, Math.min(10, prevZoom * zoomDirection))
      return newZoom
    })
  }, [])
  
  // Calculate canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setCanvasWidth(rect.width)
        setCanvasHeight(rect.height)
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [canvasRef])
  
  return {
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
    viewCutoffZoom,
    canvasWidth,
    setCanvasWidth,
    canvasHeight,
    setCanvasHeight,
    lineX,
    lineY,
    fontSize,
    baseWidth,
    baseHeight,
    strandSpacing,
    bpPerPixel,
    totalWidth,
    minSpacing,
    bpToX,
    xToBp,
    getBpFromMouse,
    getCursorPositionFromMouse,
  }
}



