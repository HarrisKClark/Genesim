import { CircuitElement, Operon } from '../models/CircuitModel'

/**
 * Finite state machine states for operon detection
 */
enum OperonState {
  SEARCHING = 'SEARCHING',           // Looking for promoter to start new operon
  AFTER_PROMOTER = 'AFTER_PROMOTER', // Found promoter, looking for RBS
  AFTER_RBS = 'AFTER_RBS',           // Found RBS, looking for gene
  AFTER_GENE = 'AFTER_GENE',         // Found gene, can accept another RBS or terminator
  COMPLETE = 'COMPLETE',              // Found terminator, operon complete
}

interface OperonBuilder {
  promoter: CircuitElement | null
  rbsGenePairs: Array<{ rbs: CircuitElement; gene: CircuitElement }>
  pendingRbs: CircuitElement | null
  terminator: CircuitElement | null
  startBp: number
}

/**
 * Detect operons in a list of circuit elements
 * An operon consists of: Promoter -> (RBS -> Gene)+ -> Terminator?
 */
export function detectOperons(elements: CircuitElement[]): Operon[] {
  const operons: Operon[] = []
  let state: OperonState = OperonState.SEARCHING
  let currentOperon: OperonBuilder = createEmptyBuilder()
  let operonCounter = 0

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]

    switch (state) {
      case OperonState.SEARCHING:
        if (element.type === 'promoter') {
          // Start a new operon
          currentOperon = {
            promoter: element,
            rbsGenePairs: [],
            pendingRbs: null,
            terminator: null,
            startBp: element.startBp,
          }
          state = OperonState.AFTER_PROMOTER
        }
        break

      case OperonState.AFTER_PROMOTER:
        if (element.type === 'rbs') {
          // Found RBS after promoter
          currentOperon.pendingRbs = element
          state = OperonState.AFTER_RBS
        } else if (element.type === 'promoter') {
          // Found another promoter before completing operon
          // Save current incomplete operon and start new one
          if (currentOperon.promoter) {
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = {
            promoter: element,
            rbsGenePairs: [],
            pendingRbs: null,
            terminator: null,
            startBp: element.startBp,
          }
          state = OperonState.AFTER_PROMOTER
        } else if (element.type === 'terminator') {
          // Terminator without genes - incomplete operon
          if (currentOperon.promoter) {
            currentOperon.terminator = element
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = createEmptyBuilder()
          state = OperonState.SEARCHING
        }
        break

      case OperonState.AFTER_RBS:
        if (element.type === 'gene') {
          // Complete RBS-gene pair
          if (currentOperon.pendingRbs) {
            currentOperon.rbsGenePairs.push({
              rbs: currentOperon.pendingRbs,
              gene: element,
            })
            currentOperon.pendingRbs = null
          }
          state = OperonState.AFTER_GENE
        } else if (element.type === 'terminator') {
          // Terminator after RBS (no gene yet) - still record terminator so we don't warn "missing terminator"
          if (currentOperon.promoter) {
            currentOperon.terminator = element
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = createEmptyBuilder()
          state = OperonState.SEARCHING
        } else if (element.type === 'promoter') {
          // New promoter - save current operon and start new
          if (currentOperon.promoter) {
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = {
            promoter: element,
            rbsGenePairs: [],
            pendingRbs: null,
            terminator: null,
            startBp: element.startBp,
          }
          state = OperonState.AFTER_PROMOTER
        } else {
          // Unexpected element - treat as incomplete operon
          if (currentOperon.promoter) {
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = createEmptyBuilder()
          state = OperonState.SEARCHING
        }
        break

      case OperonState.AFTER_GENE:
        if (element.type === 'rbs') {
          // Another RBS - polycistronic operon
          currentOperon.pendingRbs = element
          state = OperonState.AFTER_RBS
        } else if (element.type === 'terminator') {
          // Terminator completes the operon
          currentOperon.terminator = element
          operons.push(finalizeOperon(currentOperon, operonCounter++))
          currentOperon = createEmptyBuilder()
          state = OperonState.SEARCHING
        } else if (element.type === 'promoter') {
          // New promoter - current operon ends here (no terminator)
          if (currentOperon.promoter) {
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = {
            promoter: element,
            rbsGenePairs: [],
            pendingRbs: null,
            terminator: null,
            startBp: element.startBp,
          }
          state = OperonState.AFTER_PROMOTER
        } else {
          // Other element - operon ends
          if (currentOperon.promoter && currentOperon.rbsGenePairs.length > 0) {
            operons.push(finalizeOperon(currentOperon, operonCounter++))
          }
          currentOperon = createEmptyBuilder()
          state = OperonState.SEARCHING
        }
        break
    }
  }

  // Finalize any remaining operon at the end
  if (currentOperon.promoter && currentOperon.rbsGenePairs.length > 0) {
    operons.push(finalizeOperon(currentOperon, operonCounter++))
  }

  return operons
}

/**
 * Create an empty operon builder
 */
function createEmptyBuilder(): OperonBuilder {
  return {
    promoter: null,
    rbsGenePairs: [],
    pendingRbs: null,
    terminator: null,
    startBp: 0,
  }
}

/**
 * Finalize an operon builder into an Operon object
 */
function finalizeOperon(builder: OperonBuilder, counter: number): Operon {
  if (!builder.promoter) {
    throw new Error('Cannot finalize operon without promoter')
  }

  const endBp = builder.terminator
    ? builder.terminator.endBp
    : builder.rbsGenePairs.length > 0
    ? builder.rbsGenePairs[builder.rbsGenePairs.length - 1].gene.endBp
    : builder.promoter.endBp

  const operon: Operon = {
    id: `operon-${counter}`,
    promoter: builder.promoter,
    rbsGenePairs: builder.rbsGenePairs,
    terminator: builder.terminator ?? undefined,
    startBp: builder.startBp,
    endBp,
    isValid: true,
    warnings: [],
  }

  // Validate the operon
  operon.warnings = validateOperon(operon)
  operon.isValid = operon.warnings.length === 0

  return operon
}

/**
 * Validate an operon and return warnings
 */
export function validateOperon(operon: Operon): string[] {
  const warnings: string[] = []

  // Check for missing terminator
  if (!operon.terminator) {
    warnings.push(`Operon "${operon.promoter.name}" missing terminator`)
  }

  // Check for no genes
  if (operon.rbsGenePairs.length === 0) {
    warnings.push(`Operon "${operon.promoter.name}" has no genes`)
  }

  // Check for unusual spacing between elements
  const elements: CircuitElement[] = [
    operon.promoter,
    ...operon.rbsGenePairs.flatMap(pair => [pair.rbs, pair.gene]),
  ]
  
  if (operon.terminator) {
    elements.push(operon.terminator)
  }

  for (let i = 0; i < elements.length - 1; i++) {
    const curr = elements[i]
    const next = elements[i + 1]
    const gap = next.startBp - curr.endBp

    // Warn if gap is too large (> 100bp between operon elements)
    if (gap > 100) {
      warnings.push(
        `Large gap (${gap}bp) between ${curr.name} and ${next.name}`
      )
    }

    // Warn if elements overlap
    if (gap < 0) {
      warnings.push(
        `Overlapping elements: ${curr.name} and ${next.name}`
      )
    }
  }

  // Check for RBS without gene (shouldn't happen after state machine, but safety check)
  for (const pair of operon.rbsGenePairs) {
    if (!pair.rbs || !pair.gene) {
      warnings.push('Incomplete RBS-gene pair detected')
    }
  }

  return warnings
}

/**
 * Get a human-readable description of an operon
 */
export function describeOperon(operon: Operon): string {
  const geneCount = operon.rbsGenePairs.length
  const geneNames = operon.rbsGenePairs.map(pair => pair.gene.name).join(', ')
  const terminatorStatus = operon.terminator ? 'terminated' : 'unterminated'
  
  return `${operon.promoter.name} → ${geneCount} gene${geneCount !== 1 ? 's' : ''} (${geneNames}) [${terminatorStatus}]`
}

/**
 * Check if two operons overlap
 */
export function operonsOverlap(operon1: Operon, operon2: Operon): boolean {
  return operon1.startBp < operon2.endBp && operon2.startBp < operon1.endBp
}

/**
 * Get all genes in an operon
 */
export function getOperonGenes(operon: Operon): CircuitElement[] {
  return operon.rbsGenePairs.map(pair => pair.gene)
}

/**
 * Calculate operon length in base pairs
 */
export function getOperonLength(operon: Operon): number {
  return operon.endBp - operon.startBp
}

