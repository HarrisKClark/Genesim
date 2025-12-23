import { DNASelection } from '../types/dnaTypes'
import { getSequenceRange, translate } from '../utils/dnaUtils'

interface ContextMenuProps {
  contextMenu: { x: number; y: number; bp: number } | null
  selection: DNASelection | null
  clipboard: string[] | null
  cursorPosition: number | null
  dnaSequence: string[]
  isInsideComponent?: boolean
  onClose: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: (position?: number) => void
  onReverseComplement: () => void
  onDelete: () => void
  onSetOrigin: (bp: number) => void
}

export default function ContextMenu({
  contextMenu,
  selection,
  clipboard,
  cursorPosition,
  dnaSequence,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onReverseComplement,
  onDelete,
  onSetOrigin,
  isInsideComponent = false,
}: ContextMenuProps) {
  if (!contextMenu) return null

  const handleTranslate = () => {
    if (selection) {
      const selectedSeq = getSequenceRange(dnaSequence, selection.startBp, selection.endBp)
      const aminoAcids = translate(selectedSeq)
      alert(`Translated sequence:\n${aminoAcids.join('')}`)
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        background: '#fff',
        border: '1px solid #333',
        padding: '4px',
        zIndex: 1000,
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        onClick={() => {
          if (selection) onCopy()
          onClose()
        }}
      >
        Copy
      </div>
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        onClick={() => {
          if (selection) onCut()
          onClose()
        }}
      >
        Cut
      </div>
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        onClick={() => {
          if (clipboard) {
            if (cursorPosition !== null) {
              onPaste()
            } else {
              onPaste(contextMenu.bp)
            }
          }
          onClose()
        }}
      >
        Paste
      </div>
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        onClick={() => {
          if (selection) onReverseComplement()
          onClose()
        }}
      >
        Reverse Complement
      </div>
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        onClick={handleTranslate}
      >
        Translate
      </div>
      <div
        style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: !selection ? '1px solid #ddd' : 'none' }}
        onClick={() => {
          if (selection) onDelete()
          onClose()
        }}
      >
        Delete
      </div>
      {!selection && (
        <div
          style={{ 
            padding: '4px 8px', 
            cursor: isInsideComponent ? 'not-allowed' : 'pointer', 
            color: isInsideComponent ? '#999' : '#2d5aa0', 
            fontWeight: 600,
          }}
          onClick={() => {
            if (!isInsideComponent) {
              onSetOrigin(contextMenu.bp)
              onClose()
            }
          }}
          title={isInsideComponent ? 'Cannot set origin inside a component' : undefined}
        >
          Set Origin ({contextMenu.bp}bp → 0bp){isInsideComponent ? ' (blocked)' : ''}
        </div>
      )}
    </div>
  )
}

