import { useRef, useState, useCallback, useEffect } from 'react'
import { useDrop } from 'react-dnd'
import CircuitNode from './CircuitNode'
import './DNAWheel.css'

export interface CircuitComponent {
  id: string
  type: string
  name: string
  subType?: string
  x: number
  y: number
  color: string
  angle?: number // Angle in degrees for circular positioning
  startBp?: number // Start position in base pairs
  endBp?: number // End position in base pairs
}

interface DNAWheelProps {
  onCircuitChange: (data: CircuitComponent[]) => void
  circuitData: CircuitComponent[] | null
  zoomSensitivity: number
}

const COMPONENT_COLORS: Record<string, string> = {
  promoter: '#4a90e2',
  gene: '#50c878',
  terminator: '#e67e22',
  riboswitch: '#f39c12',
  rbs: '#9b59b6',
  repressor: '#e74c3c',
  activator: '#3498db',
}

const DNA_BASES = ['A', 'T', 'G', 'C']
const DNA_LENGTH = 1000 // 1000 base pairs

// Generate dummy DNA sequence
function generateDNA(length: number): string[] {
  return Array.from({ length }, () => DNA_BASES[Math.floor(Math.random() * DNA_BASES.length)])
}

// Calculate position on circle based on angle
function getPositionOnCircle(angle: number, radius: number, centerX: number, centerY: number) {
  const rad = ((angle - 90) * Math.PI) / 180 // -90 to start at top
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad),
  }
}

// Get angle for a given base pair position
function getAngleForBp(bp: number, totalBp: number): number {
  return (bp / totalBp) * 360
}

// Get base pair position for a given angle
function getBpForAngle(angle: number, totalBp: number): number {
  let normalizedAngle = angle
  while (normalizedAngle < 0) normalizedAngle += 360
  while (normalizedAngle >= 360) normalizedAngle -= 360
  return Math.floor((normalizedAngle / 360) * totalBp)
}

export default function DNAWheel({ onCircuitChange, circuitData, zoomSensitivity }: DNAWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const [components, setComponents] = useState<CircuitComponent[]>(circuitData || [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wheelCenter, setWheelCenter] = useState({ x: 0, y: 0 })
  const [baseRadius, setBaseRadius] = useState(200) // Base radius before zoom
  const [zoom, setZoom] = useState(1) // Zoom level (1 = normal, higher = zoomed in)
  const [panX, setPanX] = useState(0) // Pan X offset
  const [panY, setPanY] = useState(0) // Pan Y offset
  const [rotation, setRotation] = useState(0) // Rotation in degrees (for circle rotation)
  const [dnaSequence] = useState<string[]>(generateDNA(DNA_LENGTH))
  const [isPanning, setIsPanning] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isNearDNA, setIsNearDNA] = useState(false)
  const [selectionStart, setSelectionStart] = useState<number | null>(null) // Start base pair index
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null) // End base pair index
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0, rotation: 0, startBp: 0 })
  const [hasInteracted, setHasInteracted] = useState(false)

  const wheelRadius = baseRadius * zoom

  // Calculate wheel dimensions
  // SVG is 2000x2000px, so center is at 1000, 1000
  useEffect(() => {
    // SVG center is always at 1000, 1000 (center of 2000x2000 SVG)
    setWheelCenter({ x: 1000, y: 1000 })
    // Use 40% of SVG size (1000px) for base radius = 400px
    // This gives a nice circle that fits well in the 2000x2000 canvas
    setBaseRadius(400)
  }, [])

  // Handle wheel scroll for zoom - zoom towards mouse position
  const handleWheel = useCallback((e: WheelEvent) => {
    // Don't zoom if selecting DNA
    if (isSelecting || isNearDNA) return
    
    e.preventDefault()
    setHasInteracted(true)
    
    if (!wheelRef.current) return
    
    const rect = wheelRef.current.getBoundingClientRect()
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Container center
    const containerCenterX = rect.width / 2
    const containerCenterY = rect.height / 2
    
    // Point in canvas coordinates (before zoom)
    const canvasX = (mouseX - containerCenterX - panX) / zoom
    const canvasY = (mouseY - containerCenterY - panY) / zoom
    
    // Use a smaller, smoother zoom step
    const zoomStep = 0.05 * zoomSensitivity
    const delta = e.deltaY > 0 ? -zoomStep : zoomStep
    const newZoom = Math.max(0.5, Math.min(10, zoom + delta))
    
    // Adjust pan so the point under mouse stays in the same place
    const newPanX = mouseX - containerCenterX - (canvasX * newZoom)
    const newPanY = mouseY - containerCenterY - (canvasY * newZoom)
    
    setZoom(newZoom)
    setPanX(newPanX)
    setPanY(newPanY)
  }, [zoomSensitivity, zoom, panX, panY, isSelecting, isNearDNA])

  useEffect(() => {
    const wheel = wheelRef.current
    if (wheel) {
      wheel.addEventListener('wheel', handleWheel, { passive: false })
      return () => wheel.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Get base pair index from mouse position
  const getBpFromMouse = useCallback((mouseX: number, mouseY: number): number | null => {
    if (!wheelRef.current || zoom < 1.5) return null
    
    const rect = wheelRef.current.getBoundingClientRect()
    const containerCenterX = rect.width / 2
    const containerCenterY = rect.height / 2
    
    // Convert mouse position to canvas coordinates
    const canvasX = (mouseX - rect.left - containerCenterX - panX) / zoom
    const canvasY = (mouseY - rect.top - containerCenterY - panY) / zoom
    
    // Calculate distance from center
    const dx = canvasX - wheelCenter.x
    const dy = canvasY - wheelCenter.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Check if near the circle (within reasonable distance)
    const tolerance = 30 / zoom // 30px tolerance, adjusted for zoom
    if (Math.abs(distance - wheelRadius) > tolerance) return null
    
    // Calculate angle
    let angle = Math.atan2(dy, dx) * (180 / Math.PI)
    angle = (angle + 90 + 360) % 360 // Adjust to start at top
    
    // Convert angle to base pair index
    return getBpForAngle(angle - rotation, DNA_LENGTH)
  }, [zoom, panX, panY, wheelCenter, wheelRadius, rotation])

  // Detect when mouse is near DNA
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!wheelRef.current || zoom < 1.5) {
        setIsNearDNA(false)
        return
      }
      
      const bpIndex = getBpFromMouse(e.clientX, e.clientY)
      setIsNearDNA(bpIndex !== null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [zoom, getBpFromMouse])

  // Handle mouse drag for pan (or rotation with modifier key, or DNA selection)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    // Don't pan if clicking on a component or control
    const target = e.target as HTMLElement
    
    if (target.closest('.circuit-node') || target.closest('.wheel-controls')) {
      return
    }
    
    setHasInteracted(true)
    
    // Check if near DNA and zoomed in - always use custom selection
    const bpIndex = getBpFromMouse(e.clientX, e.clientY)
    if (bpIndex !== null && zoom > 1.5) {
      // Start custom DNA selection
      e.preventDefault()
      setIsSelecting(true)
      setIsNearDNA(true)
      setSelectionStart(bpIndex)
      setSelectionEnd(bpIndex)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        panX: panX,
        panY: panY,
        rotation: rotation,
        startBp: bpIndex,
      })
      return
    }
    
    e.preventDefault()
    
    // Shift key = rotate, otherwise = pan
    if (e.shiftKey) {
      setIsRotating(true)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        panX: panX,
        panY: panY,
        rotation: rotation,
        startBp: 0,
      })
    } else {
      setIsPanning(true)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        panX: panX,
        panY: panY,
        rotation: rotation,
        startBp: 0,
      })
    }
  }, [panX, panY, rotation, zoom, getBpFromMouse, isNearDNA])

  useEffect(() => {
    if (!isPanning && !isRotating && !isSelecting) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isSelecting) {
        // DNA selection: update selection end based on mouse position
        // Use linear selection - find closest base pair index to mouse
        const bpIndex = getBpFromMouse(e.clientX, e.clientY)
        if (bpIndex !== null) {
          // Linear selection: just set the end index, no wrapping
          setSelectionEnd(bpIndex)
        }
      } else if (isPanning) {
        // Pan: move based on mouse delta
        const deltaX = (e.clientX - dragStart.x) / zoom
        const deltaY = (e.clientY - dragStart.y) / zoom
        setPanX(dragStart.panX + deltaX)
        setPanY(dragStart.panY + deltaY)
      } else if (isRotating) {
        // Rotate: calculate angle from center
        if (wheelRef.current) {
          const rect = wheelRef.current.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          
          const dx1 = dragStart.x - centerX
          const dy1 = dragStart.y - centerY
          const dx2 = e.clientX - centerX
          const dy2 = e.clientY - centerY
          
          const angle1 = Math.atan2(dy1, dx1) * (180 / Math.PI)
          const angle2 = Math.atan2(dy2, dx2) * (180 / Math.PI)
          const deltaAngle = angle2 - angle1
          
          setRotation((dragStart.rotation + deltaAngle) % 360)
        }
      }
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      setIsRotating(false)
      setIsSelecting(false)
      setIsNearDNA(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPanning, isRotating, isSelecting, dragStart, zoom, getBpFromMouse])

  // Detect when mouse is near DNA
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!wheelRef.current || zoom < 1.5) {
        setIsNearDNA(false)
        return
      }
      
      const bpIndex = getBpFromMouse(e.clientX, e.clientY)
      setIsNearDNA(bpIndex !== null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [zoom, getBpFromMouse])

  // Update component positions when wheel dimensions change or data loads
  useEffect(() => {
    if (wheelCenter.x === 0) return
    
    const currentComponents = circuitData || components
    if (currentComponents.length === 0) {
      if (components.length > 0) {
        setComponents([])
      }
      return
    }

    const updated = currentComponents.map((comp: CircuitComponent, index: number) => {
      let angle = comp.angle
      if (angle === undefined) {
        angle = (index * 360) / currentComponents.length
      }
      const pos = getPositionOnCircle(angle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)
      return { ...comp, x: pos.x, y: pos.y, angle }
    })
    
    const needsUpdate = updated.length !== components.length || 
      updated.some((comp, i) => 
        !components[i] || 
        comp.x !== components[i].x || 
        comp.y !== components[i].y
      )
    
    if (needsUpdate) {
      setComponents(updated)
      if (circuitData && circuitData !== components) {
        onCircuitChange(updated)
      }
    }
  }, [wheelCenter.x, wheelCenter.y, wheelRadius, rotation, circuitData])

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'circuit-component',
    drop: (item: { type: string; name: string; subType?: string }) => {
      if (components.length === 0) {
        const angle = 0
        const pos = getPositionOnCircle(angle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)
        const newComponent: CircuitComponent = {
          id: `${item.type}-${Date.now()}`,
          type: item.type,
          name: item.name,
          subType: item.subType,
          x: pos.x,
          y: pos.y,
          angle,
          startBp: 0,
          endBp: 100,
          color: COMPONENT_COLORS[item.type] || '#666',
        }
        const updated = [...components, newComponent]
        setComponents(updated)
        onCircuitChange(updated)
      } else {
        const angleStep = 360 / (components.length + 1)
        const newAngle = components.length * angleStep
        const pos = getPositionOnCircle(newAngle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)
        const bpPos = getBpForAngle(newAngle, DNA_LENGTH)
        const newComponent: CircuitComponent = {
          id: `${item.type}-${Date.now()}`,
          type: item.type,
          name: item.name,
          subType: item.subType,
          x: pos.x,
          y: pos.y,
          angle: newAngle,
          startBp: bpPos,
          endBp: bpPos + 100,
          color: COMPONENT_COLORS[item.type] || '#666',
        }
        const updated = [...components, newComponent]
        const redistributed = updated.map((comp, index) => {
          const newAngle = (index * 360) / updated.length
          const newPos = getPositionOnCircle(newAngle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)
          return { ...comp, angle: newAngle, x: newPos.x, y: newPos.y }
        })
        setComponents(redistributed)
        onCircuitChange(redistributed)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [components, wheelRadius, wheelCenter, rotation, onCircuitChange])

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setComponents((prev) => {
      const comp = prev.find(c => c.id === id)
      if (!comp || wheelCenter.x === 0) return prev

      const dx = x - wheelCenter.x
      const dy = y - wheelCenter.y
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
      if (angle < 0) angle += 360
      angle = (angle - rotation + 360) % 360

      const pos = getPositionOnCircle(angle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)

      const updated = prev.map((c) =>
        c.id === id ? { ...c, x: pos.x, y: pos.y, angle } : c
      )
      onCircuitChange(updated)
      return updated
    })
  }, [wheelCenter, wheelRadius, rotation, onCircuitChange])

  const handleNodeDelete = useCallback((id: string) => {
    setComponents((prev) => {
      const updated = prev.filter((comp) => comp.id !== id)
      const redistributed = updated.map((comp, index) => {
        const newAngle = updated.length > 0 ? (index * 360) / updated.length : 0
        const newPos = getPositionOnCircle(newAngle + rotation, wheelRadius, wheelCenter.x, wheelCenter.y)
        return { ...comp, angle: newAngle, x: newPos.x, y: newPos.y }
      })
      onCircuitChange(redistributed)
      return redistributed
    })
    if (selectedId === id) {
      setSelectedId(null)
    }
  }, [selectedId, wheelRadius, wheelCenter, rotation, onCircuitChange])

  // Render DNA sequence

  const renderDNASequence = () => {
    const showBasePairs = zoom > 1.5 // Show individual base pairs when zoomed in
    
    if (!showBasePairs) {
      // Low zoom: show as a line
      return (
        <circle
          cx={wheelCenter.x}
          cy={wheelCenter.y}
          r={wheelRadius}
          fill="none"
          stroke="#4a90e2"
          strokeWidth={Math.max(1, 2 / zoom)}
          transform={`rotate(${rotation} ${wheelCenter.x} ${wheelCenter.y})`}
        />
      )
    }

    // High zoom: show base pairs around the entire circle
    // Calculate step size based on zoom - higher zoom = smaller step = more bases shown
    // At zoom 2x, show every base. At zoom 10x, show every base. Adjust step for performance
    const circumference = 2 * Math.PI * wheelRadius
    const pixelsPerBp = circumference / DNA_LENGTH
    const minSpacing = 8 // Minimum pixels between base pairs for readability
    const bpStep = Math.max(1, Math.ceil(minSpacing / (pixelsPerBp * zoom)))
    
    // Render all base pairs around the entire 360-degree circle
    const basesToRender = Math.ceil(DNA_LENGTH / bpStep)
    
    // Check if base is selected (linear selection)
    const isSelected = (bpIndex: number) => {
      if (selectionStart === null || selectionEnd === null) return false
      const start = Math.min(selectionStart, selectionEnd)
      const end = Math.max(selectionStart, selectionEnd)
      return bpIndex >= start && bpIndex <= end
    }
    
    return (
      <g transform={`rotate(${rotation} ${wheelCenter.x} ${wheelCenter.y})`}>
        {Array.from({ length: basesToRender }, (_, i) => {
          const bpIndex = (i * bpStep) % DNA_LENGTH
          const angle = getAngleForBp(bpIndex, DNA_LENGTH)
          const pos = getPositionOnCircle(angle, wheelRadius, wheelCenter.x, wheelCenter.y)
          const base = dnaSequence[bpIndex]
          const baseColor = {
            A: '#e74c3c',
            T: '#3498db',
            G: '#2ecc71',
            C: '#f39c12',
          }[base] || '#666'

          // Adjust font size based on zoom and spacing
          const fontSize = Math.min(16, Math.max(8, pixelsPerBp * zoom * 0.8))
          
          // Calculate rotation angle so bottom of text faces into the circle
          // Rotate text by the angle so bottom points toward center
          const textRotation = angle
          const selected = isSelected(bpIndex)

          return (
            <g key={`bp-${bpIndex}`}>
              {/* Background highlight for selected bases */}
              {selected && (
                <rect
                  x={pos.x - fontSize * 0.5}
                  y={pos.y - fontSize * 0.5}
                  width={fontSize}
                  height={fontSize}
                  fill="#4a90e2"
                  rx={2}
                  transform={`rotate(${textRotation} ${pos.x} ${pos.y})`}
                />
              )}
              <text
                x={pos.x}
                y={pos.y}
                fontSize={fontSize}
                fill={selected ? '#fff' : baseColor}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Courier New, monospace"
                fontWeight="600"
                opacity={selected ? 1 : 0.9}
                transform={`rotate(${textRotation} ${pos.x} ${pos.y})`}
                style={{
                  pointerEvents: 'auto',
                  cursor: isNearDNA ? 'text' : 'default',
                }}
              >
                {base}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  useEffect(() => {
    if (wheelRef.current) {
      drop(wheelRef.current)
    }
  }, [drop])

  return (
    <div
      ref={wheelRef}
      className={`dna-wheel ${isOver ? 'drag-over' : ''} ${isPanning ? 'panning' : ''} ${isRotating ? 'rotating' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <svg 
        className="wheel-svg" 
        style={{
          width: '2000px',
          height: '2000px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Outer circle guide */}
        <circle
          cx={wheelCenter.x}
          cy={wheelCenter.y}
          r={wheelRadius}
          fill="none"
          stroke="#888"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.3"
        />
        {/* DNA sequence */}
        {renderDNASequence()}
      </svg>
      <div 
        className="wheel-content"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {components.map((comp) => (
          <CircuitNode
            key={comp.id}
            component={comp}
            isSelected={selectedId === comp.id}
            onSelect={() => setSelectedId(comp.id)}
            onMove={handleNodeMove}
            onDelete={handleNodeDelete}
          />
        ))}
      </div>
      <div className="wheel-controls">
        <div className="zoom-info">
          Zoom: {zoom.toFixed(1)}x | Rot: {rotation.toFixed(0)}° | Drag to pan • Shift+Drag to rotate
        </div>
      </div>
      {components.length === 0 && !hasInteracted && (
        <div className="wheel-empty">
          <p className="empty-message">Drag components onto the circle to build your circuit</p>
          <p className="empty-hint">Scroll to zoom • Drag to pan • Shift+Drag to rotate</p>
        </div>
      )}
    </div>
  )
}
