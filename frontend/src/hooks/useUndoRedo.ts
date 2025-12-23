import { useState, useCallback } from 'react'
import { CircuitComponent } from '../types/dnaTypes'

export interface EditState {
  dnaSequence: string[]
  dnaLength: number
  components: CircuitComponent[]
}

interface UseUndoRedoProps {
  dnaSequence: string[]
  dnaLength: number
  components: CircuitComponent[]
  onCircuitChange: (components: CircuitComponent[]) => void
  setDnaSequence: React.Dispatch<React.SetStateAction<string[]>>
  setDnaLength: React.Dispatch<React.SetStateAction<number>>
  setComponents: React.Dispatch<React.SetStateAction<CircuitComponent[]>>
  setSelection: React.Dispatch<React.SetStateAction<{ startBp: number; endBp: number } | null>>
}

const MAX_UNDO_HISTORY = 50

export function useUndoRedo({
  dnaSequence,
  dnaLength,
  components,
  onCircuitChange,
  setDnaSequence,
  setDnaLength,
  setComponents,
  setSelection,
}: UseUndoRedoProps) {
  const [undoStack, setUndoStack] = useState<EditState[]>([])
  const [redoStack, setRedoStack] = useState<EditState[]>([])

  // Save current state to undo stack
  const saveState = useCallback(() => {
    const currentState: EditState = {
      dnaSequence: [...dnaSequence],
      dnaLength,
      components: components.map(comp => ({ ...comp })),
    }
    setUndoStack((prev) => {
      const newStack = [...prev, currentState]
      // Limit stack size
      return newStack.slice(-MAX_UNDO_HISTORY)
    })
    // Clear redo stack when new edit is made
    setRedoStack([])
  }, [dnaSequence, dnaLength, components])

  // Undo function
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    
    // Save current state to redo stack
    const currentState: EditState = {
      dnaSequence: [...dnaSequence],
      dnaLength,
      components: components.map(comp => ({ ...comp })),
    }
    setRedoStack((prev) => [...prev, currentState])
    
    // Restore previous state
    const previousState = undoStack[undoStack.length - 1]
    setDnaSequence([...previousState.dnaSequence])
    setDnaLength(previousState.dnaLength)
    setComponents(previousState.components.map(comp => ({ ...comp })))
    onCircuitChange(previousState.components.map(comp => ({ ...comp })))
    
    // Remove from undo stack
    setUndoStack((prev) => prev.slice(0, -1))
    
    // Clear selection
    setSelection(null)
  }, [undoStack, dnaSequence, dnaLength, components, onCircuitChange, setDnaSequence, setDnaLength, setComponents, setSelection])

  // Redo function
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    
    // Save current state to undo stack
    const currentState: EditState = {
      dnaSequence: [...dnaSequence],
      dnaLength,
      components: components.map(comp => ({ ...comp })),
    }
    setUndoStack((prev) => [...prev, currentState])
    
    // Restore next state
    const nextState = redoStack[redoStack.length - 1]
    setDnaSequence([...nextState.dnaSequence])
    setDnaLength(nextState.dnaLength)
    setComponents(nextState.components.map(comp => ({ ...comp })))
    onCircuitChange(nextState.components.map(comp => ({ ...comp })))
    
    // Remove from redo stack
    setRedoStack((prev) => prev.slice(0, -1))
    
    // Clear selection
    setSelection(null)
  }, [redoStack, dnaSequence, dnaLength, components, onCircuitChange, setDnaSequence, setDnaLength, setComponents, setSelection])

  return {
    saveState,
    handleUndo,
    handleRedo,
  }
}

