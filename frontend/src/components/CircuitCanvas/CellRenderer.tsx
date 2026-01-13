import React from 'react'
import { hexToRgba } from '../../utils/themeUtils'

interface CellFrame {
  frameLeft: number
  frameTop: number
  frameWidth: number
  frameBottom: number
}

interface CellRendererProps {
  cellId: string
  cellType: string
  cellName: string
  cellFrame: CellFrame
  isActive: boolean
  accentColor: string
  bgSecondary: string
  onDeleteCell?: (cellId: string) => void
  onContextMenu?: (e: React.MouseEvent) => void
  children?: React.ReactNode
}

export default function CellRenderer({
  cellId,
  cellType,
  cellName,
  cellFrame,
  isActive,
  accentColor,
  bgSecondary,
  onDeleteCell,
  onContextMenu,
  children,
}: CellRendererProps) {
  const { frameLeft, frameTop, frameWidth, frameBottom } = cellFrame
  const frameHeight = Math.max(1, frameBottom - frameTop)

  return (
    <div
      style={{ position: 'absolute', inset: 0 }}
      onContextMenu={onContextMenu}
    >
      {/* Cell frame border */}
      <div
        className="cell-frame"
        style={{
          position: 'absolute',
          left: `${frameLeft}px`,
          top: `${frameTop}px`,
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          border: `2px dotted ${hexToRgba(accentColor, 0.7)}`,
          borderRadius: 14,
          background: 'transparent',
          zIndex: isActive ? 1 : 0,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Cell label */}
      <div
        className="cell-label"
        style={{
          position: 'absolute',
          left: `${frameLeft + 14}px`,
          top: `${frameTop}px`,
          transform: 'translateY(-50%)',
          padding: '4px 10px',
          fontFamily: 'Courier New, monospace',
          fontWeight: 700,
          fontSize: 12,
          color: hexToRgba(accentColor, 0.95),
          background: bgSecondary,
          zIndex: isActive ? 2 : 1,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {cellType}: {cellName}
      </div>

      {/* Delete button (only for active cells) */}
      {isActive && onDeleteCell && (
        <button
          className="cell-delete"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteCell(cellId)
          }}
          style={{
            position: 'absolute',
            left: frameLeft + frameWidth - 12,
            top: frameTop - 10,
            width: 22,
            height: 22,
            background: '#e74c3c',
            border: '2px solid #c0392b',
            borderRadius: '50%',
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
          title="Delete cell"
        >
          ×
        </button>
      )}

      {/* Children (plasmids) */}
      {children}
    </div>
  )
}

