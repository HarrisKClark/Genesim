import { theme } from '../../utils/themeUtils'

interface DNACursorProps {
  cursorVisible: boolean
  cursorPosition: number | null
  showBasePairs: boolean
  cursorPlaced: boolean
  zoom: number
  bpToX: (bp: number) => number
  lineX: number
  lineY: number
}

export default function DNACursor({
  cursorVisible,
  cursorPosition,
  showBasePairs,
  cursorPlaced: _cursorPlaced,
  zoom,
  bpToX,
  lineX,
  lineY,
}: DNACursorProps) {
  if (!cursorVisible || cursorPosition === null) return null
  // Show cursor in both DNA view and abstract view when visible
  // In abstract view, cursorVisible is true when hovering, so we show it

  const baseHeight = Math.max(12, Math.min(24, 12 * zoom))
  const strandSpacing = Math.max(20, Math.min(40, 20 * zoom))
  const cursorX = bpToX(cursorPosition)
  const cursorHeight = strandSpacing + baseHeight + 10
  // In abstract view we prefer crisp positioning (no tween) to avoid amplifying perceived jitter.
  const leftTransition = showBasePairs ? 'left 0.05s ease-out' : 'none'

  // Use theme-aware cursor color - bright for dark/iluvatar modes
  const cursorColor = theme.cursorColor

  return (
    <div
      style={{
        position: 'absolute',
        left: `${cursorX + lineX}px`,
        top: `${lineY - strandSpacing / 2 - baseHeight / 2 - 5}px`,
        width: '3px',
        height: `${cursorHeight}px`,
        background: cursorColor,
        boxShadow: `0 0 4px ${cursorColor}`,
        transform: 'translateX(-50%)',
        zIndex: 10, // Higher z-index to ensure cursor is always visible above other elements
        pointerEvents: 'none',
        opacity: 1,
        transition: leftTransition,
        willChange: 'left', // Optimize for position changes
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-5px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${cursorColor}`,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

