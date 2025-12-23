import { useState, useRef, useEffect } from 'react'
import './CircuitNode.css'

interface CircuitNodeProps {
  component: {
    id: string
    type: string
    name: string
    subType?: string
    x: number
    y: number
    color: string
  }
  isSelected: boolean
  onSelect: () => void
  onMove: (id: string, x: number, y: number) => void
  onDelete: (id: string) => void
}

export default function CircuitNode({
  component,
  isSelected,
  onSelect,
  onMove,
  onDelete,
}: CircuitNodeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    e.preventDefault()
    e.stopPropagation()
    
    if (nodeRef.current?.parentElement) {
      const nodeRect = nodeRef.current.getBoundingClientRect()
      // Calculate offset: where on the node did we click?
      const offsetX = e.clientX - nodeRect.left
      const offsetY = e.clientY - nodeRect.top
      
      setDragOffset({ x: offsetX, y: offsetY })
      setIsDragging(true)
    }
    onSelect()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (nodeRef.current?.parentElement) {
        const canvasRect = nodeRef.current.parentElement.getBoundingClientRect()
        // Calculate new position: mouse position minus the offset where we clicked
        const x = e.clientX - canvasRect.left - dragOffset.x
        const y = e.clientY - canvasRect.top - dragOffset.y
        
        onMove(component.id, Math.max(0, x), Math.max(0, y))
      }
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
  }, [isDragging, dragOffset, component.id, onMove])

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(component.id)
  }

  return (
    <div
      ref={nodeRef}
      className={`circuit-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${component.x}px`,
        top: `${component.y}px`,
        borderColor: component.color,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="node-header">
        <div className="node-color-bar" style={{ backgroundColor: component.color }} />
        <div className="node-name">{component.name}</div>
        {component.subType && (
          <div className="node-subtype">{component.subType}</div>
        )}
        {isSelected && (
          <button className="node-delete" onClick={handleDelete}>
            ×
          </button>
        )}
      </div>
      <div className="node-body">
        <div className="node-input" />
        <div className="node-output" />
      </div>
    </div>
  )
}

