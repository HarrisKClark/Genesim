import { DNASelection } from '../../types/dnaTypes'

interface DNASelectionHighlightProps {
  selection: DNASelection | null
  showBasePairs: boolean
  dnaLength: number
  zoom: number
  bpToX: (bp: number) => number
  lineX: number
  lineY: number
}

export default function DNASelectionHighlight({
  selection,
  showBasePairs,
  dnaLength: _dnaLength,
  zoom,
  bpToX,
  lineX,
  lineY,
}: DNASelectionHighlightProps) {
  // In DNA view: selection is shown via base background colors only
  // In abstract view: show a visual highlight overlay
  
  if (!selection) return null
  if (showBasePairs) return null // Only show overlay in abstract view
  
  const { startBp, endBp } = selection
  const selStart = Math.min(startBp, endBp)
  const selEnd = Math.max(startBp, endBp)
  
  // Calculate selection bounds
  const startX = bpToX(selStart)
  const endX = bpToX(selEnd + 1) // +1 to include the last base
  const width = endX - startX
  
  // Calculate height and positioning
  const baseHeight = Math.max(12, Math.min(24, 12 * zoom))
  const strandSpacing = Math.max(20, Math.min(40, 20 * zoom))
  const highlightHeight = strandSpacing + baseHeight + 20 // Extra padding for visibility
  
  return (
    <div
      style={{
        position: 'absolute',
        left: `${lineX + startX}px`,
        top: `${lineY - (highlightHeight / 2)}px`,
        width: `${width}px`,
        height: `${highlightHeight}px`,
        backgroundColor: 'rgba(74, 144, 226, 0.25)', // Semi-transparent blue
        border: '2px solid rgba(74, 144, 226, 0.6)',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: 7, // Above components (6) but below cursor (10)
        boxShadow: '0 0 8px rgba(74, 144, 226, 0.4)',
      }}
    />
  )
}
