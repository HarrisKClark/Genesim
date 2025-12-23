import { useDragLayer } from 'react-dnd'
import { COMPONENT_COLORS, COMPONENT_SIZES } from '../constants/circuitConstants'
import { bpToX } from '../utils/coordinateUtils'

interface DragPreviewProps {
  bpPerPixel: number
  strandSpacing: number
  baseHeight: number
  dragPreviewPosition: { bp: number; componentLength: number; componentType: string } | null
}

export default function DragPreview({
  bpPerPixel,
  strandSpacing,
  baseHeight,
  dragPreviewPosition,
}: DragPreviewProps) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem() as { type: string; name: string; subType?: string } | null,
    currentOffset: monitor.getClientOffset(),
  }))

  // Only show mouse-following box when NOT over DNA (dragPreviewPosition is null)
  // When over DNA, the box is shown at DNA position in CircuitCanvas instead
  if (!isDragging || !item || !currentOffset || dragPreviewPosition !== null) {
    return null
  }

  const componentLength = COMPONENT_SIZES[item.type] || 100
  const componentColor = COMPONENT_COLORS[item.type] || '#666'
  
  // Calculate preview box dimensions
  const previewWidth = bpToX(componentLength, bpPerPixel) - bpToX(0, bpPerPixel)
  const previewHeight = strandSpacing + baseHeight

  return (
    <div
      style={{
        position: 'fixed',
        left: `${currentOffset.x}px`,
        top: `${currentOffset.y}px`,
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
        backgroundColor: componentColor,
        opacity: 0.5,
        border: '2px solid #333',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'translate(-50%, -50%)',
        borderRadius: '2px',
      }}
    />
  )
}
