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
        background: '#d4d4d4',
        borderTop: '1px solid #888',
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
          background: isDraggingHScroll ? '#2d5aa0' : '#4a90e2',
          border: '1px solid #2d5aa0',
          cursor: isDraggingHScroll ? 'grabbing' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

