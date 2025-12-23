import { useMemo, useCallback } from 'react'
import { CircuitComponent } from '../types/dnaTypes'
import { COMPONENT_SIZES } from '../constants/circuitConstants'

interface UseComponentPlacementProps {
  components: CircuitComponent[]
  dnaLength: number
}

interface PlacementInterval {
  id: string
  start: number
  end: number
}

interface ResolveResult {
  startBp: number
  blockedPartIds: string[]
  snappedFromBlocked: boolean
}

interface UseComponentPlacementReturn {
  placedIntervals: PlacementInterval[]
  resolveNoOverlapStartBp: (
    desiredStartBp: number, 
    opts: { maxStartBp: number; excludeId?: string; componentLength?: number }
  ) => ResolveResult
  isInsideComponent: (bp: number) => boolean
  insertComponentIntoDNA: (
    dnaSequence: string[],
    position: number,
    componentLength: number
  ) => {
    newSequence: string[]
    placeholderSeq: string[]
  }
}

export function useComponentPlacement({
  components,
  dnaLength,
}: UseComponentPlacementProps): UseComponentPlacementReturn {
  // Calculate placed intervals for collision detection
  const placedIntervals = useMemo(() => {
    return components
      .filter((c) => c.startBp !== undefined)
      .map((c) => {
        const start = c.startBp ?? 0
        const len = c.length || COMPONENT_SIZES[c.type] || 100
        const end = c.endBp ?? (start + len)
        return { id: c.id, start, end }
      })
  }, [components])
  
  // Check if a bp position is inside any placed component
  const isInsideComponent = useCallback((bp: number) => {
    return components.some((comp) => {
      if (comp.startBp === undefined) return false
      const start = comp.startBp
      const end = comp.endBp ?? (start + (comp.length || 10))
      return bp >= start && bp < end
    })
  }, [components])
  
  // Resolve non-overlapping placement position
  const resolveNoOverlapStartBp = useCallback(
    (desiredStartBp: number, opts: { maxStartBp: number; excludeId?: string; componentLength?: number }): ResolveResult => {
      const minStartBp = 0
      const maxStartBp = Math.max(0, opts.maxStartBp)
      const clamped = Math.max(minStartBp, Math.min(maxStartBp, desiredStartBp))
      // Get component length from opts, or estimate from maxStartBp
      const compLength = opts.componentLength || (dnaLength - maxStartBp)

      // Check if placing a component at `bp` with length `compLength` would overlap any existing interval
      const wouldOverlap = (bp: number) => {
        const candidateStart = bp
        const candidateEnd = bp + compLength
        return placedIntervals.some((it) => {
          if (it.id === opts.excludeId) return false
          // Two intervals [a, b) and [c, d) overlap if a < d && c < b
          return candidateStart < it.end && it.start < candidateEnd
        })
      }

      // Get all intervals that the candidate would overlap with
      const getBlockers = (bp: number) => {
        const candidateStart = bp
        const candidateEnd = bp + compLength
        return placedIntervals.filter((it) => {
          if (it.id === opts.excludeId) return false
          return candidateStart < it.end && it.start < candidateEnd
        })
      }

      const blockers = getBlockers(clamped)
      if (blockers.length === 0) {
        return { startBp: clamped, blockedPartIds: [], snappedFromBlocked: false }
      }

      // Find candidate positions: just before each blocker's start, or just after each blocker's end
      const candidates = blockers
        .flatMap((b) => [
          b.start - compLength, // Place component ending just before blocker starts
          b.end,                // Place component starting just after blocker ends
        ])
        .map((bp) => Math.max(minStartBp, Math.min(maxStartBp, bp)))
        .filter((bp) => !wouldOverlap(bp))

      if (candidates.length === 0) {
        // Fallback: scan outward (rare; assumes intervals are mostly disjoint)
        let left = clamped
        let right = clamped
        while (left > minStartBp || right < maxStartBp) {
          if (left > minStartBp) {
            left -= 1
            if (!wouldOverlap(left)) return { startBp: left, blockedPartIds: blockers.map((b) => b.id), snappedFromBlocked: true }
          }
          if (right < maxStartBp) {
            right += 1
            if (!wouldOverlap(right)) return { startBp: right, blockedPartIds: blockers.map((b) => b.id), snappedFromBlocked: true }
          }
        }
        return { startBp: clamped, blockedPartIds: blockers.map((b) => b.id), snappedFromBlocked: true }
      }

      let best = candidates[0]
      let bestDist = Math.abs(best - clamped)
      for (const c of candidates.slice(1)) {
        const d = Math.abs(c - clamped)
        if (d < bestDist) {
          best = c
          bestDist = d
        }
      }
      return { startBp: best, blockedPartIds: blockers.map((b) => b.id), snappedFromBlocked: true }
    },
    [placedIntervals, dnaLength]
  )
  
  // Insert component placeholder into DNA sequence
  const insertComponentIntoDNA = useCallback((
    dnaSequence: string[],
    position: number,
    componentLength: number
  ) => {
    const placeholderSeq = Array(componentLength).fill('N')
    const newSeq = [...dnaSequence]
    newSeq.splice(position, 0, ...placeholderSeq)
    
    return {
      newSequence: newSeq,
      placeholderSeq,
    }
  }, [])
  
  return {
    placedIntervals,
    resolveNoOverlapStartBp,
    isInsideComponent,
    insertComponentIntoDNA,
  }
}



