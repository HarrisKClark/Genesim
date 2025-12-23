import { useState, useCallback } from 'react'
import { DNASelection } from '../types/dnaTypes'
import { CircuitComponent } from '../types/dnaTypes'
import { getSequenceRange, normalizeSelection } from '../utils/dnaUtils'
import { reverseComplement } from '../utils/dnaUtils'
import { shiftComponentPositions, shiftComponentPositionsAtOrAfter } from '../utils/componentPositioning'
import { ExpandedLayout } from '../utils/expandedLayout'

interface UseDNAEditingProps {
  dnaSequence: string[]
  dnaLength: number
  components?: CircuitComponent[] // Not used directly, components accessed via setComponents
  selection: DNASelection | null
  cursorPosition: number | null
  expandedLayout?: ExpandedLayout | null
  setDnaSequence: React.Dispatch<React.SetStateAction<string[]>>
  setDnaLength: React.Dispatch<React.SetStateAction<number>>
  setComponents: React.Dispatch<React.SetStateAction<CircuitComponent[]>>
  setSelection: React.Dispatch<React.SetStateAction<DNASelection | null>>
  setCursorPosition: React.Dispatch<React.SetStateAction<number | null>>
  setCursorPlaced: React.Dispatch<React.SetStateAction<boolean>>
  setCursorVisible: React.Dispatch<React.SetStateAction<boolean>>
  onCircuitChange?: (components: CircuitComponent[]) => void // Not used in hook, parent handles via setComponents
  saveState: () => void
}

export function useDNAEditing({
  dnaSequence,
  dnaLength,
  components: _components = [], // Not used directly
  selection,
  cursorPosition,
  expandedLayout = null,
  setDnaSequence,
  setDnaLength,
  setComponents,
  setSelection,
  setCursorPosition,
  setCursorPlaced,
  setCursorVisible,
  onCircuitChange: _onCircuitChange, // Not used in hook
  saveState,
}: UseDNAEditingProps) {
  const [clipboard, setClipboard] = useState<string[] | null>(null)

  const getEffectiveLength = () => expandedLayout?.expandedLength ?? dnaLength

  const selectionIncludesComponentBases = (startBp: number, endBp: number): boolean => {
    if (!expandedLayout) return false
    const len = expandedLayout.expandedLength
    if (len <= 0) return false
    const start = Math.max(0, Math.min(len - 1, startBp))
    const end = Math.max(0, Math.min(len - 1, endBp))
    for (let i = start; i <= end; i++) {
      if (expandedLayout.expandedToComponentId[i] !== null) return true
    }
    return false
  }

  const expandedSelectionToBackgroundSpan = (startBp: number, endBp: number): { bgStart: number; bgCount: number } | null => {
    if (!expandedLayout) return null
    const len = expandedLayout.expandedLength
    const start = Math.max(0, Math.min(len - 1, startBp))
    const end = Math.max(0, Math.min(len - 1, endBp))

    const bgIndices: number[] = []
    for (let i = start; i <= end; i++) {
      const bg = expandedLayout.expandedToBackground[i]
      if (bg === null) return null
      bgIndices.push(bg)
    }
    if (bgIndices.length === 0) return null
    // Require contiguity in background space
    for (let i = 1; i < bgIndices.length; i++) {
      if (bgIndices[i] !== bgIndices[i - 1] + 1) return null
    }
    return { bgStart: bgIndices[0], bgCount: bgIndices.length }
  }

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return
    
    // Save state before deletion
    saveState()
    
    const effectiveLength = getEffectiveLength()
    const { startBp, endBp } = normalizeSelection(selection.startBp, selection.endBp, effectiveLength)
    const deleteCountExpanded = endBp >= startBp ? endBp - startBp + 1 : (effectiveLength - startBp) + endBp + 1
    
    // Calculate cursor position after deletion - always between bases (fractional)
    const cursorPosAfterDelete = Math.max(0, startBp - 0.5)
    
    if (expandedLayout) {
      // Expanded mode: delete contiguous background spans
      // (Component deletion is handled separately in CircuitCanvas)
      if (deleteCountExpanded <= 0) return
      if (endBp < startBp) {
        alert('Wrapped deletion is not supported when components are present.')
        return
      }
      const bgSpan = expandedSelectionToBackgroundSpan(startBp, endBp)
      if (!bgSpan) {
        // Selection contains only component bases (no background DNA to delete)
        // This is fine - components are deleted separately by the caller
        setSelection(null)
        setCursorPosition(Math.max(0, startBp - 0.5))
        setCursorPlaced(false)
        setCursorVisible(true)
        return
      }
      const { bgStart, bgCount } = bgSpan

      setDnaSequence((prev) => {
        const next = [...prev]
        next.splice(bgStart, bgCount)
        setDnaLength(next.length)
        return next
      })

      // Shift component insertion indices in expanded space by number of background bp removed
      setComponents((prev) => shiftComponentPositions(prev, startBp, -bgCount))
    } else {
      // Background-only mode
      const deleteCount = endBp >= startBp ? endBp - startBp + 1 : (dnaLength - startBp) + endBp + 1
      setDnaSequence((prev) => {
        const newSeq = [...prev]
        if (endBp >= startBp) {
          newSeq.splice(startBp, deleteCount)
        } else {
          // Wrapped deletion
          newSeq.splice(startBp)
          newSeq.splice(0, endBp + 1)
        }
        setDnaLength(newSeq.length)
        return newSeq
      })
      setComponents((prev) => shiftComponentPositions(prev, startBp, -deleteCount))
    }
    
    // Place cursor at the position where deletion occurred
    setCursorPosition(cursorPosAfterDelete)
    setCursorPlaced(false) // Allow cursor to follow mouse again after deletion
    setCursorVisible(true)
    
    setSelection(null)
  }, [selection, dnaLength, expandedLayout, saveState, setDnaSequence, setDnaLength, setComponents, setCursorPosition, setCursorPlaced, setCursorVisible, setSelection])

  const handleCopySelection = useCallback(() => {
    if (!selection) return
    if (expandedLayout) {
      const effectiveLength = expandedLayout.expandedLength
      const { startBp, endBp } = normalizeSelection(selection.startBp, selection.endBp, effectiveLength)
      if (endBp < startBp) {
        alert('Wrapped copy is not supported when components are present.')
        return
      }
      if (selectionIncludesComponentBases(startBp, endBp)) {
        alert('Cannot copy bases that overlap a component.')
        return
      }
      const bgSpan = expandedSelectionToBackgroundSpan(startBp, endBp)
      if (!bgSpan) return
      const selectedSeq = dnaSequence.slice(bgSpan.bgStart, bgSpan.bgStart + bgSpan.bgCount)
      setClipboard(selectedSeq)
      return
    }
    const selectedSeq = getSequenceRange(dnaSequence, selection.startBp, selection.endBp)
    setClipboard(selectedSeq)
  }, [selection, dnaSequence, expandedLayout])

  const handleCutSelection = useCallback(() => {
    if (!selection) return
    handleCopySelection()
    handleDeleteSelection()
  }, [selection, handleCopySelection, handleDeleteSelection])

  const handlePaste = useCallback((position?: number) => {
    if (!clipboard) return
    
    // If there's a selection, show confirmation dialog for replacement
    if (selection) {
      const { startBp, endBp } = normalizeSelection(selection.startBp, selection.endBp, dnaLength)
      const selectedCount = endBp >= startBp ? endBp - startBp + 1 : (dnaLength - startBp) + endBp + 1
      const clipboardSeq = clipboard.join('')
      const clipboardPreview = clipboardSeq.length > 20 
        ? clipboardSeq.substring(0, 20) + '...' 
        : clipboardSeq
      
      const confirmed = window.confirm(
        `Do you want to replace ${selectedCount} base pair${selectedCount !== 1 ? 's' : ''} with ${clipboardPreview}?`
      )
      
      if (!confirmed) {
        return // User cancelled
      }
      
      // Save state before replacement
      saveState()
      
      // Replace the selected region with clipboard content
      const replaceCount = selectedCount
      
      setDnaSequence((prev) => {
        const newSeq = [...prev]
        if (endBp >= startBp) {
          newSeq.splice(startBp, replaceCount, ...clipboard)
        } else {
          // Wrapped replacement
          newSeq.splice(startBp, dnaLength - startBp, ...clipboard.slice(0, dnaLength - startBp))
          newSeq.splice(0, endBp + 1, ...clipboard.slice(dnaLength - startBp))
        }
        setDnaLength(newSeq.length)
        return newSeq
      })
      
      // NEW: Shift component positions after replacement (simple position shift)
      const lengthDiff = clipboard.length - replaceCount
      if (lengthDiff !== 0) {
        setComponents((prev) => shiftComponentPositions(prev, endBp, lengthDiff))
      }
      
      // Place cursor after replacement
      const cursorPosAfterReplace = startBp + clipboard.length - 0.5
      setCursorPosition(cursorPosAfterReplace)
      setCursorPlaced(false)
      setCursorVisible(true)
      
      // Clear selection
      setSelection(null)
      
      return
    }
    
    // Normal paste (no selection) - insert at cursor position
    // Save state before paste
    saveState()
    
    // Use cursor position if available, otherwise use provided position
    let insertPosition: number
    if (cursorPosition !== null) {
      insertPosition = Math.round(cursorPosition)
    } else if (position !== undefined) {
      insertPosition = position
    } else {
      return
    }

    if (expandedLayout) {
      // Insert into background at the mapped insertion index.
      const expandedPos = Math.max(0, Math.min(expandedLayout.expandedLength, insertPosition))
      const bgInsert = expandedLayout.expandedInsertionToBackgroundInsertion(expandedPos)

      setDnaSequence((prev) => {
        const next = [...prev]
        next.splice(bgInsert, 0, ...clipboard)
        setDnaLength(next.length)
        return next
      })

      // Shift component insertion indices at/after the insertion boundary
      setComponents((prev) => shiftComponentPositionsAtOrAfter(prev, expandedPos, clipboard.length))

      if (cursorPosition !== null) {
        setCursorPosition(expandedPos + clipboard.length - 0.5)
        setCursorPlaced(true)
        setCursorVisible(true)
      }
      return
    }

    insertPosition = Math.max(0, Math.min(dnaLength, insertPosition))
    
    setDnaSequence((prev) => {
      const newSeq = [...prev]
      newSeq.splice(insertPosition, 0, ...clipboard)
      setDnaLength(newSeq.length)
      return newSeq
    })
    
    // NEW: Shift component positions after insertion (simple position shift)
    setComponents((prev) => shiftComponentPositions(prev, insertPosition, clipboard.length))
    
    // Move cursor after paste
    if (cursorPosition !== null) {
      setCursorPosition(insertPosition + clipboard.length - 0.5)
      setCursorPlaced(true)
      setCursorVisible(true)
    }
  }, [clipboard, cursorPosition, dnaLength, expandedLayout, saveState, selection, setDnaSequence, setDnaLength, setComponents, setCursorPosition, setCursorPlaced, setCursorVisible, setSelection])

  const handleReverseComplement = useCallback(() => {
    if (!selection) return
    
    // Save state before reverse complement
    saveState()
    
    const selectedSeq = getSequenceRange(dnaSequence, selection.startBp, selection.endBp)
    const revComp = reverseComplement(selectedSeq)
    
    const { startBp, endBp } = normalizeSelection(selection.startBp, selection.endBp, dnaLength)
    const replaceCount = endBp >= startBp ? endBp - startBp + 1 : (dnaLength - startBp) + endBp + 1
    
    setDnaSequence((prev) => {
      const newSeq = [...prev]
      if (endBp >= startBp) {
        newSeq.splice(startBp, replaceCount, ...revComp)
      } else {
        // Wrapped replacement
        newSeq.splice(startBp, dnaLength - startBp, ...revComp.slice(0, dnaLength - startBp))
        newSeq.splice(0, endBp + 1, ...revComp.slice(dnaLength - startBp))
      }
      return newSeq
    })
  }, [selection, dnaSequence, dnaLength, saveState, setDnaSequence])

  return {
    clipboard,
    handleDeleteSelection,
    handleCopySelection,
    handleCutSelection,
    handlePaste,
    handleReverseComplement,
  }
}

