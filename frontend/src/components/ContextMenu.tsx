import { DNASelection } from '../types/dnaTypes'
import { getSequenceRange, translate } from '../utils/dnaUtils'
import { theme } from '../utils/themeUtils'

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
      className="context-menu"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          if (selection) onCopy()
          onClose()
        }}
      >
        Copy
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          if (selection) onCut()
          onClose()
        }}
      >
        Cut
      </button>
      <button
        className="context-menu-item"
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
      </button>
      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => {
          if (selection) onReverseComplement()
          onClose()
        }}
      >
        Reverse Complement
      </button>
      <button
        className="context-menu-item"
        onClick={handleTranslate}
      >
        Translate
      </button>
      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => {
          if (selection) onDelete()
          onClose()
        }}
      >
        Delete
      </button>
      {!selection && (
        <>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item"
            style={{ 
              cursor: isInsideComponent ? 'not-allowed' : 'pointer', 
              color: isInsideComponent ? theme.textMuted : theme.accentPrimary, 
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
          </button>
        </>
      )}
    </div>
  )
}
