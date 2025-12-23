import { CircuitComponent } from '../types/dnaTypes'

/**
 * Pure utility functions for DNA sequence operations
 */
export class DNAOperations {
  /**
   * Rotate DNA sequence so newOrigin becomes position 0
   * Returns rotated sequence and updated components with wrapped positions
   */
  static setOrigin(
    sequence: string[],
    newOrigin: number,
    components: CircuitComponent[],
    dnaLength: number
  ): {
    rotatedSequence: string[]
    updatedComponents: CircuitComponent[]
  } {
    if (newOrigin <= 0 || newOrigin >= dnaLength) {
      return { rotatedSequence: sequence, updatedComponents: components }
    }
    
    const rotatedSequence = [
      ...sequence.slice(newOrigin),
      ...sequence.slice(0, newOrigin),
    ]
    
    const updatedComponents = components.map((comp) => {
      // Prefer new position-based model; fall back to deprecated startBp/endBp if needed.
      const oldPos = comp.position ?? comp.startBp
      if (oldPos === undefined) return comp

      const len = Math.round(comp.length || 0)
      let newPos = Math.round(oldPos) - newOrigin
      if (newPos < 0) newPos = dnaLength + newPos // Wrap around to end

      // Keep both fields consistent for migration purposes
      const next: CircuitComponent = {
        ...comp,
        position: newPos,
      }
      if (comp.startBp !== undefined) {
        next.startBp = newPos
        next.endBp = newPos + len
      }
      return next
    })
    
    return { rotatedSequence, updatedComponents }
  }
  
  /**
   * Delete a component from DNA sequence and shift downstream components
   */
  static deleteComponent(
    sequence: string[],
    start: number,
    length: number,
    components: CircuitComponent[],
    componentId: string,
    bpToX: (bp: number) => number
  ): {
    newSequence: string[]
    updatedComponents: CircuitComponent[]
    newLength: number
  } {
    // Remove sequence chunk
    const newSeq = [...sequence]
    newSeq.splice(start, length)
    
    // Remove component and shift others
    const without = components.filter((c) => c.id !== componentId)
    const updated = without.map((c) => {
      if (c.startBp !== undefined && c.startBp >= start + length) {
        const newStart = c.startBp - length
        const newEnd = (c.endBp ?? (c.startBp + (c.length || 100))) - length
        return { ...c, startBp: newStart, endBp: newEnd, x: bpToX(newStart) }
      }
      return c
    })
    
    return {
      newSequence: newSeq,
      updatedComponents: updated,
      newLength: newSeq.length,
    }
  }
  
  /**
   * Insert a component placeholder into DNA sequence
   */
  static insertComponent(
    sequence: string[],
    position: number,
    length: number
  ): {
    newSequence: string[]
    placeholderSeq: string[]
  } {
    const placeholderSeq = Array(length).fill('N')
    const newSeq = [...sequence]
    newSeq.splice(position, 0, ...placeholderSeq)
    
    return {
      newSequence: newSeq,
      placeholderSeq,
    }
  }
  
  /**
   * Move a component from one position to another in the DNA sequence
   * Handles index shifting correctly when moving left or right
   */
  static moveComponent(
    sequence: string[],
    oldStart: number,
    newStart: number,
    length: number
  ): string[] {
    if (oldStart === newStart) return sequence
    
    const newSeq = [...sequence]
    
    // Extract the component sequence
    const componentSeq = newSeq.slice(oldStart, oldStart + length)
    
    // Remove from old position (this shifts all subsequent indices left by length)
    newSeq.splice(oldStart, length)
    
    // Calculate adjusted insert position
    // If moving right, newStart was measured before removal, so subtract length
    const adjustedNewStart = newStart > oldStart ? newStart - length : newStart
    
    // Insert at adjusted position
    newSeq.splice(adjustedNewStart, 0, ...componentSeq)
    
    return newSeq
  }
  
  /**
   * Shift components downstream after an insertion or deletion
   */
  static shiftComponentsDownstream(
    components: CircuitComponent[],
    fromPosition: number,
    shiftAmount: number,
    bpToX: (bp: number) => number,
    excludeId?: string
  ): CircuitComponent[] {
    return components.map((comp) => {
      if (comp.id === excludeId) return comp
      if (comp.startBp !== undefined && comp.startBp >= fromPosition) {
        const newStart = comp.startBp + shiftAmount
        const newEnd = (comp.endBp ?? (comp.startBp + (comp.length || 100))) + shiftAmount
        return { ...comp, startBp: newStart, endBp: newEnd, x: bpToX(newStart) }
      }
      return comp
    })
  }
  
  /**
   * Shift components when another component moves
   * Handles both DNA sequence and component position updates atomically
   */
  static shiftComponentsForMove(
    components: CircuitComponent[],
    movingId: string,
    oldStart: number,
    newStart: number,
    length: number,
    bpToX: (bp: number) => number
  ): CircuitComponent[] {
    const moving = components.find(c => c.id === movingId)
    if (!moving) return components
    
    return components.map(comp => {
      if (comp.id === movingId) {
        // Update the moving component to its new position
        return {
          ...comp,
          startBp: newStart,
          endBp: newStart + length,
          x: bpToX(newStart)
        }
      }
      
      if (comp.startBp === undefined) return comp
      
      let adjustedStart = comp.startBp
      let adjustedEnd = comp.endBp ?? (comp.startBp + (comp.length || 100))
      
      // Component shift logic when another component moves:
      // 1. Removal at oldStart shifts everything after left by length
      // 2. Insertion at newStart shifts everything after right by length
      
      if (oldStart < newStart) {
        // Moving right: components between old and new positions shift left
        if (adjustedStart > oldStart && adjustedStart <= newStart) {
          adjustedStart -= length
          adjustedEnd -= length
        }
      } else {
        // Moving left: components between new and old positions shift right
        if (adjustedStart >= newStart && adjustedStart < oldStart) {
          adjustedStart += length
          adjustedEnd += length
        }
      }
      
      return {
        ...comp,
        startBp: adjustedStart,
        endBp: adjustedEnd,
        x: bpToX(adjustedStart)
      }
    })
  }
  
  /**
   * Validate if a component can be placed at a given position
   */
  static validatePlacement(
    start: number,
    length: number,
    dnaLength: number,
    components: CircuitComponent[],
    excludeId?: string
  ): boolean {
    // Check bounds
    if (start < 0 || start + length > dnaLength) {
      return false
    }
    
    // Check for overlaps
    const candidateEnd = start + length
    for (const comp of components) {
      if (comp.id === excludeId) continue
      if (comp.startBp === undefined) continue
      
      const compStart = comp.startBp
      const compEnd = comp.endBp ?? (compStart + (comp.length || 10))
      
      // Check if intervals overlap
      if (start < compEnd && compStart < candidateEnd) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * Validate that DNA sequence and components are synchronized
   * Checks that component positions contain 'N' bases as expected
   */
  static validateComponentSync(
    sequence: string[],
    components: CircuitComponent[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    for (const comp of components) {
      if (comp.startBp === undefined) continue
      
      const start = comp.startBp
      const end = comp.endBp ?? (start + (comp.length || 10))
      
      // Check bounds
      if (start < 0 || end > sequence.length) {
        errors.push(`Component ${comp.name} (${comp.id}) out of bounds: ${start}-${end} (DNA length: ${sequence.length})`)
        continue
      }
      
      // Check if sequence at component position contains 'N's (as expected)
      const componentSeq = sequence.slice(start, end)
      const hasOnlyN = componentSeq.every(base => base === 'N')
      
      if (!hasOnlyN) {
        const nonN = componentSeq.filter(b => b !== 'N').length
        const sampleBases = componentSeq.slice(0, 10).join('')
        errors.push(
          `Component ${comp.name} (${comp.id}) at ${start}-${end} has ${nonN}/${componentSeq.length} non-N bases (sample: "${sampleBases}...")`
        )
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

