import { DNASelection } from '../types/dnaTypes'
import { getSequenceRange, calculateGCContent } from '../utils/dnaUtils'
import { theme } from '../utils/themeUtils'

interface SelectionInfoProps {
  selection: DNASelection
  dnaSequence: string[]
}

export default function SelectionInfo({ selection, dnaSequence }: SelectionInfoProps) {
  const selectedSeq = getSequenceRange(dnaSequence, selection.startBp, selection.endBp)
  const gcContent = calculateGCContent(selectedSeq)

  return (
    <div className="selection-info" style={{
      position: 'absolute',
      bottom: '50px', // Position above status bar + more padding
      left: '8px',
      background: theme.bgDialog,
      padding: '8px',
      border: `1px solid ${theme.borderPrimary}`,
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: theme.textPrimary,
      zIndex: 10,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
    }}>
      <div>Selection: {selection.startBp}-{selection.endBp} bp</div>
      <div>Length: {Math.abs(selection.endBp - selection.startBp) + 1} bp</div>
      <div>GC Content: {(gcContent * 100).toFixed(1)}%</div>
    </div>
  )
}
