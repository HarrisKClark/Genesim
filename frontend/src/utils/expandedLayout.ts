import { CircuitComponent } from '../types/dnaTypes'

export interface ExpandedLayout {
  /** Full displayed DNA (background + inserted component bases) */
  expandedSequence: string[]
  /** Length of expandedSequence */
  expandedLength: number
  /** For each expanded index i, the underlying background index, or null if this base is from a component */
  expandedToBackground: Array<number | null>
  /** For each expanded index i, the component id if this base is from a component, else null */
  expandedToComponentId: Array<string | null>
  /** Component ranges in expanded indices: [start, end) */
  componentRanges: Array<{ id: string; start: number; end: number; color: string }>
  /** Map an expanded insertion boundary pos -> background insertion index (0..backgroundLength) */
  expandedInsertionToBackgroundInsertion: (pos: number) => number
  /** True if expanded base index is inside any component */
  isComponentBaseIndex: (bpIndex: number) => boolean
}

type ExtraInsertion = {
  id: string
  position: number
  length: number
  sequence: string[]
  color: string
}

/**
 * Build the on-screen expanded DNA layout.
 *
 * Semantics:
 * - Background DNA contributes exactly backgroundSequence.length bases.
 * - Each placed component contributes `length` bases inserted at `position` (expanded insertion index).
 * - Component bases are treated as real bp tiles in the expanded index space, but are owned by the component.
 *
 * This enables adjacent placement like [block1][block2] with no "invisible barrier".
 */
export function buildExpandedLayout(opts: {
  backgroundSequence: string[]
  components: CircuitComponent[]
  extraInsertions?: ExtraInsertion[]
}): ExpandedLayout {
  const backgroundSequence = opts.backgroundSequence
  const backgroundLength = backgroundSequence.length

  const placedComponents: ExtraInsertion[] = [
    ...opts.components
      .filter((c) => c.position !== undefined)
      .map((c) => ({
        id: c.id,
        position: Math.round(c.position!),
        length: Math.max(0, Math.round(c.length)),
        sequence: (c.sequence && c.sequence.length ? c.sequence : Array(Math.max(0, Math.round(c.length))).fill('N')) as string[],
        color: c.color || '#666',
      })),
    ...(opts.extraInsertions || []),
  ]
    .filter((c) => Number.isFinite(c.position) && c.position >= 0 && Number.isFinite(c.length) && c.length > 0)
    .sort((a, b) => a.position - b.position)

  const totalInserted = placedComponents.reduce((acc, c) => acc + c.length, 0)
  
  // Calculate expanded length to accommodate all components.
  // Must be at least backgroundLength + totalInserted, but also large enough
  // to fit the highest-positioned component (position + length).
  let expandedLength = backgroundLength + totalInserted
  for (const comp of placedComponents) {
    const compEnd = comp.position + comp.length
    if (compEnd > expandedLength) {
      expandedLength = compEnd
    }
  }

  const expandedSequence = new Array(expandedLength) as string[]
  const expandedToBackground = new Array(expandedLength).fill(null) as Array<number | null>
  const expandedToComponentId = new Array(expandedLength).fill(null) as Array<string | null>

  const componentRanges: Array<{ id: string; start: number; end: number; color: string }> = []

  let bgIdx = 0
  let compIdx = 0
  let i = 0

  while (i < expandedLength) {
    const nextComp = placedComponents[compIdx]
    if (nextComp && i === nextComp.position) {
      const start = i
      for (let k = 0; k < nextComp.length && i < expandedLength; k++, i++) {
        expandedSequence[i] = nextComp.sequence[k] ?? 'N'
        expandedToComponentId[i] = nextComp.id
      }
      componentRanges.push({ id: nextComp.id, start, end: i, color: nextComp.color })
      compIdx++
      continue
    }

    // Fill with background base
    expandedSequence[i] = backgroundSequence[bgIdx] ?? 'N'
    expandedToBackground[i] = bgIdx
    bgIdx++
    i++
  }

  const isComponentBaseIndex = (bpIndex: number) => {
    if (!Number.isFinite(bpIndex)) return false
    const idx = Math.floor(bpIndex)
    if (idx < 0 || idx >= expandedLength) return false
    return expandedToComponentId[idx] !== null
  }

  const expandedInsertionToBackgroundInsertion = (posRaw: number) => {
    const pos = Math.max(0, Math.min(expandedLength, Math.round(posRaw)))
    // number of background bases strictly before this boundary
    let count = 0
    for (let j = 0; j < pos; j++) {
      if (expandedToBackground[j] !== null) count++
    }
    return count
  }

  return {
    expandedSequence,
    expandedLength,
    expandedToBackground,
    expandedToComponentId,
    componentRanges,
    expandedInsertionToBackgroundInsertion,
    isComponentBaseIndex,
  }
}




