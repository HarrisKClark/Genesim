interface ZoomControlsProps {
  zoom?: number // Not used in render but kept for potential future use
  onZoomIn: () => void
  onZoomOut: () => void
}

export default function ZoomControls({ zoom: _zoom, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '8px',
      right: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      zIndex: 100,
    }}>
      <button
        onClick={onZoomIn}
        style={{
          width: '32px',
          height: '32px',
          padding: 0,
          fontSize: '18px',
          fontFamily: 'Courier New, monospace',
          background: '#4a90e2',
          color: '#fff',
          border: '1px solid #2d5aa0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: '1',
        }}
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        style={{
          width: '32px',
          height: '32px',
          padding: 0,
          fontSize: '18px',
          fontFamily: 'Courier New, monospace',
          background: '#4a90e2',
          color: '#fff',
          border: '1px solid #2d5aa0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: '1',
        }}
        title="Zoom Out"
      >
        −
      </button>
    </div>
  )
}

