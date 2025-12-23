import { DNASelection } from '../types/dnaTypes'
import { getSequenceRange, calculateGCContent } from '../utils/dnaUtils'

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
      bottom: '36px', // Position above status bar (24px height) + padding
      left: '8px',
      background: 'rgba(212, 212, 212, 0.9)',
      padding: '8px',
      border: '1px solid #888',
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
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

