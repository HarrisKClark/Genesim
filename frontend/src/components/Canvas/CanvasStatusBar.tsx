import { DNASelection } from '../../types/dnaTypes'

interface CanvasStatusBarProps {
  fileName: string
  dnaLength: number
  selection: DNASelection | null
}

/**
 * Bottom status bar showing file name, DNA length, and selection info
 */
export default function CanvasStatusBar({
  fileName,
  dnaLength,
  selection,
}: CanvasStatusBarProps) {
  return (
    <div className="canvas-status-bar">
      <span className="status-filename">{fileName}</span>
      <span className="status-separator">|</span>
      <span className="status-info">{dnaLength} bp</span>
      {selection && (
        <>
          <span className="status-separator">|</span>
          <span className="status-info">Selected: {selection.startBp}-{selection.endBp}</span>
        </>
      )}
    </div>
  )
}



