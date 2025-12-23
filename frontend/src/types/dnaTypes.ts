/**
 * DNA-related type definitions
 */

export interface DNASelection {
  startBp: number
  endBp: number
}

export type EditMode = 'normal' | 'insert' | 'replace'

export type SelectionMode = 'none' | 'selecting' | 'selected'

/**
 * Circuit component interface
 * Components are overlays on DNA, not mutations of it
 */
export interface CircuitComponent {
  id: string
  type: string
  name: string
  subType?: string
  color: string
  
  // Component's own DNA sequence (immutable)
  sequence: string[]
  
  // Insertion position (index between bases, undefined = not placed)
  position?: number
  
  // Length in base pairs (for rendering)
  length: number
  
  // Visual position (derived, for rendering - will be removed in favor of computed)
  x?: number
  y?: number
  
  // DEPRECATED: Old position system (for migration only)
  startBp?: number
  endBp?: number
}

