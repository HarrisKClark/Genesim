import { CircuitComponent } from '../types/dnaTypes'

/**
 * Utilities for the new position-based component system
 * Components are overlays on DNA, positioned at insertion indices
 */

type ExtraInsertion = { position: number; length: number }

/**
 * Build an offsets table for insertion boundaries.
 *
 * offsets[p] = total inserted pixel width contributed by components with position < p
 * (i.e. the displacement applied to the boundary at insertion index p).
 *
 * This is intentionally based on strict `< p` so bases never "stretch under" a block that starts
 * at boundary p.
 */
export function buildInsertionOffsets(
  components: CircuitComponent[],
  bpPerPixel: number,
  dnaLength: number,
  opts?: { excludeId?: string; extraInsertions?: ExtraInsertion[] }
): number[] {
  const n = Math.max(0, Math.floor(dnaLength))
  const offsets = new Array(n + 1).fill(0) as number[]
  if (!Number.isFinite(bpPerPixel) || bpPerPixel <= 0) return offsets

  const events = new Array(n + 1).fill(0) as number[]
  const addInsertion = (posRaw: number, lenRaw: number) => {
    const pos = Math.round(posRaw)
    if (!Number.isFinite(pos) || pos < 0 || pos > n) return
    if (!Number.isFinite(lenRaw) || lenRaw <= 0) return
    const lenPx = lenRaw / bpPerPixel
    if (!Number.isFinite(lenPx) || lenPx <= 0) return
    events[pos] += lenPx
  }

  for (const comp of components) {
    if (opts?.excludeId && comp.id === opts.excludeId) continue
    if (comp.position === undefined) continue
    addInsertion(comp.position, comp.length)
  }
  for (const extra of opts?.extraInsertions || []) {
    addInsertion(extra.position, extra.length)
  }

  // offsets[0] = 0; offsets[p] = offsets[p-1] + events[p-1]
  for (let p = 1; p <= n; p++) {
    offsets[p] = offsets[p - 1] + events[p - 1]
  }
  return offsets
}

export function insertionIndexToX(position: number, offsets: number[], bpPerPixel: number): number {
  if (!Number.isFinite(position)) return 0
  if (!Number.isFinite(bpPerPixel) || bpPerPixel <= 0) return 0
  const n = Math.max(0, offsets.length - 1)
  const p = Math.max(0, Math.min(n, Math.round(position)))
  return p / bpPerPixel + (offsets[p] || 0)
}

/**
 * Convert a mouse X (relative to strand start) into the nearest integer insertion index.
 * This is displacement-aware: it inverts insertionIndexToX() via binary search.
 */
export function xToInsertionIndex(x: number, offsets: number[], bpPerPixel: number): number {
  if (!Number.isFinite(x)) return 0
  const n = Math.max(0, offsets.length - 1)
  if (n === 0) return 0
  if (!Number.isFinite(bpPerPixel) || bpPerPixel <= 0) return 0

  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const midX = insertionIndexToX(mid, offsets, bpPerPixel)
    if (midX < x) lo = mid + 1
    else hi = mid
  }

  const right = lo
  const left = Math.max(0, right - 1)
  const leftX = insertionIndexToX(left, offsets, bpPerPixel)
  const rightX = insertionIndexToX(right, offsets, bpPerPixel)
  return Math.abs(x - leftX) <= Math.abs(rightX - x) ? left : right
}

/**
 * Check if a component position would overlap with existing components
 */
export function isPositionValid(
  position: number,
  length: number,
  components: CircuitComponent[],
  excludeId?: string
): boolean {
  // Position is insertion index, component occupies [position, position + length]
  const start = Math.round(position)
  const end = start + Math.round(length)
  
  for (const comp of components) {
    if (comp.id === excludeId || comp.position === undefined) continue
    
    const compStart = Math.round(comp.position)
    const compEnd = compStart + Math.round(comp.length)
    
    // Check if intervals overlap
    if (start < compEnd && compStart < end) {
      return false
    }
  }
  
  return true
}

/**
 * Find the nearest valid position for a component
 * Returns the position and whether it was snapped
 */
export function snapToValidPosition(
  desiredPosition: number,
  length: number,
  dnaLength: number,
  components: CircuitComponent[],
  excludeId?: string
): { position: number; snapped: boolean; blockedBy: string[] } {
  // Clamp to valid DNA bounds (position is insertion index, component extends to position + length)
  const minPos = 0
  const lenInt = Math.max(0, Math.round(length))
  const maxPos = Math.max(0, Math.round(dnaLength) - lenInt)
  const desiredInt = Math.round(desiredPosition)
  const clampedPos = Math.max(minPos, Math.min(maxPos, desiredInt))
  
  // Check if desired position is valid
  if (isPositionValid(clampedPos, lenInt, components, excludeId)) {
    return { position: clampedPos, snapped: false, blockedBy: [] }
  }
  
  // Find all placed components sorted by position
  const sortedComps = components
    .filter(c => c.position !== undefined && c.id !== excludeId)
    .sort((a, b) => a.position! - b.position!)
  
  if (sortedComps.length === 0) {
    return { position: clampedPos, snapped: false, blockedBy: [] }
  }
  
  // Find blocking components
  const blockedBy: string[] = []
  for (const comp of sortedComps) {
    const compStart = Math.round(comp.position!)
    const compEnd = compStart + Math.round(comp.length)
    const start = clampedPos
    const end = clampedPos + lenInt
    
    if (start < compEnd && compStart < end) {
      blockedBy.push(comp.id)
    }
  }
  
  // Try to find valid gaps between components
  const candidates: number[] = []
  
  // Try before first component
  const firstComp = sortedComps[0]
  const beforeFirstPos = Math.round(firstComp.position!) - lenInt
  if (beforeFirstPos >= minPos) {
    candidates.push(beforeFirstPos)
  }
  
  // Try gaps between components
  for (let i = 0; i < sortedComps.length - 1; i++) {
    const curr = sortedComps[i]
    const next = sortedComps[i + 1]
    
    const gapStart = Math.round(curr.position!) + Math.round(curr.length)
    const gapEnd = Math.round(next.position!)
    const gapSize = gapEnd - gapStart
    
    if (gapSize >= lenInt) {
      // Component fits in gap - place at gap start
      candidates.push(gapStart)
    }
  }
  
  // Try after last component
  const lastComp = sortedComps[sortedComps.length - 1]
  const afterLastPos = Math.round(lastComp.position!) + Math.round(lastComp.length)
  if (afterLastPos + lenInt <= Math.round(dnaLength)) {
    candidates.push(afterLastPos)
  }
  
  // Find closest candidate to desired position
  if (candidates.length > 0) {
    const closest = candidates.reduce((prev, curr) => {
      return Math.abs(curr - clampedPos) < Math.abs(prev - clampedPos) ? curr : prev
    })
    return { position: closest, snapped: true, blockedBy }
  }
  
  // No valid position found - return clamped position anyway
  return { position: clampedPos, snapped: true, blockedBy }
}

/**
 * Snap an insertion boundary to the nearest valid boundary, treating components as
 * inserted segments (expanded bp space).
 *
 * Valid insertion boundaries are any integer position in [0..expandedLength] that is NOT
 * strictly inside a component span (start < pos < end). Boundaries at start or end are valid.
 *
 * If componentLength is provided, ensures the component fits entirely within bounds
 * (position + componentLength <= expandedLength), preventing right-side overhang.
 *
 * This allows adjacent placement like [block1][block2] by inserting and shifting downstream.
 */
export function snapToValidInsertionPosition(
  desiredPosition: number,
  expandedLength: number,
  components: CircuitComponent[],
  opts?: { excludeId?: string; componentLength?: number; isRepositioning?: boolean }
): { position: number; snapped: boolean; blockedBy: string[] } {
  const n = Math.max(0, Math.round(expandedLength))
  const compLen = opts?.componentLength ? Math.max(0, Math.round(opts.componentLength)) : 0
  const desired = Math.round(desiredPosition)
  // For repositioning: the component will extend the space when placed, so max is the full length
  // For new components: position + componentLength must fit within expandedLength
  const maxValidPos = opts?.isRepositioning ? n : (compLen > 0 ? Math.max(0, n - compLen) : n)
  let pos = Math.max(0, Math.min(maxValidPos, desired))

  // Check if the NEW component [pos, pos+compLen] would overlap with any existing component
  // IMPORTANT: For repositioning, we need to account for the shift that will happen
  // when the component is inserted. Components at >= pos will shift by compLen.
  const blockers: Array<{ id: string; start: number; end: number }> = []
  const newStart = pos
  const newEnd = pos + compLen
  
  for (const comp of components) {
    if (opts?.excludeId && comp.id === opts.excludeId) continue
    if (comp.position === undefined) continue
    const start = Math.round(comp.position)
    const length = Math.max(0, Math.round(comp.length))
    const end = start + length
    
    // For repositioning: simulate the shift that will happen when component is inserted
    // Components at >= pos will move right by compLen
    let checkStart = start
    let checkEnd = end
    if (opts?.isRepositioning && start >= pos) {
      checkStart = start + compLen
      checkEnd = end + compLen
    }
    
    // Check for ANY overlap between [newStart, newEnd] and [checkStart, checkEnd]
    // Overlap occurs when: newStart < checkEnd AND newEnd > checkStart
    if (newStart < checkEnd && newEnd > checkStart) {
      blockers.push({ id: comp.id, start, end })
    }
  }

  if (blockers.length === 0) {
    return { position: pos, snapped: false, blockedBy: [] }
  }

  // Find valid positions that don't cause overlap.
  // Try positions just before and just after each blocking component.
  const candidates: number[] = []
  
  for (const b of blockers) {
    // Position just before blocker (so new component ends at blocker's start)
    const beforePos = b.start - compLen
    if (beforePos >= 0) {
      candidates.push(beforePos)
    }
    // Position just after blocker (new component starts at blocker's end)
    const afterPos = b.end
    // For repositioning: allow placing at end (component extends space)
    // For new: must fit within current bounds
    if (opts?.isRepositioning ? (afterPos <= n) : (afterPos + compLen <= n)) {
      candidates.push(afterPos)
    }
    // For repositioning: also consider placing AT the blocker's start position
    // This works because the blocker will shift right when the component is inserted
    // Result: component ends where blocker begins (adjacent/touching)
    if (opts?.isRepositioning && b.start >= 0 && b.start <= n) {
      candidates.push(b.start)
    }
  }
  
  // Find the candidate closest to desired position
  let bestPos = pos
  let bestDist = Number.POSITIVE_INFINITY
  
  for (const cand of candidates) {
    // Verify this candidate is within bounds
    if (cand < 0 || cand > maxValidPos) continue
    
    // Verify this candidate doesn't overlap with any other component
    // IMPORTANT: When repositioning, components at >= cand will shift by compLen,
    // so we need to check overlap AFTER the simulated shift
    const candEnd = cand + compLen
    let valid = true
    for (const comp of components) {
      if (opts?.excludeId && comp.id === opts.excludeId) continue
      if (comp.position === undefined) continue
      const start = Math.round(comp.position)
      const compLength = Math.max(0, Math.round(comp.length))
      
      // Simulate the shift: components at >= cand will move by +compLen
      const shiftedStart = start >= cand ? start + compLen : start
      const shiftedEnd = shiftedStart + compLength
      
      // Check overlap with shifted positions
      if (cand < shiftedEnd && candEnd > shiftedStart) {
        valid = false
        break
      }
    }
    
    if (valid) {
      const dist = Math.abs(cand - desired)
      if (dist < bestDist) {
        bestDist = dist
        bestPos = cand
      }
    }
  }

  // Also apply component length constraint to snapped position
  bestPos = Math.max(0, Math.min(maxValidPos, bestPos))
  return { position: bestPos, snapped: true, blockedBy: blockers.map((b) => b.id) }
}

/**
 * Shift component insertion indices for an insertion at boundary `fromPosition`.
 * This is inclusive (>=) because inserting at a component start should push it downstream.
 * 
 * After shifting, validates that all components remain at valid positions (>= 0).
 * Negative positions would indicate a bug in the insertion logic.
 */
export function shiftComponentPositionsAtOrAfter(
  components: CircuitComponent[],
  fromPosition: number,
  shiftAmount: number,
  opts?: { excludeId?: string }
): CircuitComponent[] {
  const from = Math.round(fromPosition)
  return components.map((comp) => {
    if (opts?.excludeId && comp.id === opts.excludeId) return comp
    if (comp.position === undefined) return comp
    if (Math.round(comp.position) >= from) {
      const newPosition = Math.round(comp.position) + shiftAmount
      // Ensure position doesn't go negative (would be invalid)
      return { ...comp, position: Math.max(0, newPosition) }
    }
    return comp
  })
}

/**
 * Get visual X position for a component based on its insertion position
 */
export function getComponentVisualX(
  component: CircuitComponent,
  bpToX: (bp: number) => number,
  pixelsPerBp: number
): number {
  if (component.position === undefined) return 0
  
  // Component visually centers on its insertion position
  const insertionX = bpToX(component.position)
  const componentWidth = component.length * pixelsPerBp
  return insertionX - componentWidth / 2
}

/**
 * Get the insertion position from a mouse X coordinate
 */
export function mouseXToPosition(
  mouseX: number,
  bpPerPixel: number
): number {
  return mouseX * bpPerPixel
}

/**
 * Move a component to a new position
 * Simple update - no DNA splicing needed!
 */
export function moveComponentToPosition(
  components: CircuitComponent[],
  componentId: string,
  newPosition: number
): CircuitComponent[] {
  return components.map(comp => {
    if (comp.id === componentId) {
      return { ...comp, position: newPosition }
    }
    return comp
  })
}

/**
 * Place a new component at a position
 */
export function placeComponentAtPosition(
  components: CircuitComponent[],
  newComponent: CircuitComponent,
  position: number
): CircuitComponent[] {
  return [...components, { ...newComponent, position }]
}

/**
 * Remove a component
 */
export function removeComponent(
  components: CircuitComponent[],
  componentId: string
): CircuitComponent[] {
  return components.filter(c => c.id !== componentId)
}

/**
 * Shift component positions after DNA edit (deletion/insertion in background DNA)
 */
export function shiftComponentPositions(
  components: CircuitComponent[],
  fromPosition: number,
  shiftAmount: number
): CircuitComponent[] {
  return components.map(comp => {
    if (comp.position !== undefined && comp.position > fromPosition) {
      return { ...comp, position: comp.position + shiftAmount }
    }
    return comp
  })
}

/**
 * Migrate old component format (startBp/endBp) to new format (position)
 */
export function migrateComponent(oldComponent: CircuitComponent): CircuitComponent {
  // If already has position, return as is
  if (oldComponent.position !== undefined && oldComponent.sequence) {
    return oldComponent
  }
  
  // If has startBp, use it as position
  const position = oldComponent.startBp
  
  // Generate component sequence (all N's for now)
  const sequence = Array(oldComponent.length || 10).fill('N')
  
  return {
    ...oldComponent,
    position,
    sequence,
  }
}

/**
 * Get all components sorted by position
 */
export function getSortedComponents(components: CircuitComponent[]): CircuitComponent[] {
  return components
    .filter(c => c.position !== undefined)
    .sort((a, b) => a.position! - b.position!)
}

