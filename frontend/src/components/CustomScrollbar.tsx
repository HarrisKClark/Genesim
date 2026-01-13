import { theme } from '../utils/themeUtils'

interface CustomScrollbarProps {
  scrollLeft: number // Used in parent calculations
  isDraggingHScroll: boolean
  hasHorizontalScroll: boolean
  hScrollTrackWidth: number
  hScrollThumbWidth: number
  hScrollThumbLeft: number
  scrollbarSize: number
  hScrollTrackRef: React.RefObject<HTMLDivElement>
  onMouseDown: (e: React.MouseEvent) => void
}

export default function CustomScrollbar({
  scrollLeft: _scrollLeft, // Used in parent calculations
  isDraggingHScroll,
  hasHorizontalScroll,
  hScrollTrackWidth,
  hScrollThumbWidth,
  hScrollThumbLeft,
  scrollbarSize,
  hScrollTrackRef,
  onMouseDown,
}: CustomScrollbarProps) {
  const accentColor = theme.accentPrimary
  const accentHover = theme.accentHover
  const bgSecondary = theme.bgSecondary
  const borderPrimary = theme.borderPrimary

  if (!hasHorizontalScroll) return null

  return (
    <div
      ref={hScrollTrackRef}
      className="custom-scrollbar-horizontal"
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        bottom: 24, // Above the status bar
        left: 0,
        width: `${hScrollTrackWidth}px`,
        height: `${scrollbarSize}px`,
        background: bgSecondary,
        borderTop: `1px solid ${borderPrimary}`,
        zIndex: 100,
        cursor: 'default',
      }}
    >
      <div
        className="custom-scrollbar-thumb-horizontal"
        style={{
          position: 'absolute',
          left: `${hScrollThumbLeft}px`,
          top: 0,
          width: `${hScrollThumbWidth}px`,
          height: `${scrollbarSize}px`,
          background: isDraggingHScroll ? accentHover : accentColor,
          border: `1px solid ${accentHover}`,
          cursor: isDraggingHScroll ? 'grabbing' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
