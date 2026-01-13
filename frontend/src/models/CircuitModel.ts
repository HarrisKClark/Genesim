import { CircuitComponent } from '../types/dnaTypes'
import { detectOperons as detectOperonsUtil } from '../utils/operonDetection'
import { getPromoterParams, getPromoterStrength, getRbsStrength } from '../utils/partLibrary'

export interface CircuitElement {
  id: string
  type: 'promoter' | 'rbs' | 'gene' | 'terminator' | 'operator' | 'other'
  startBp: number
  endBp: number
  name: string
  originalComponent: CircuitComponent
  metadata?: Record<string, any>
}

export interface Operon {
  id: string
  promoter: CircuitElement
  rbsGenePairs: Array<{ rbs: CircuitElement; gene: CircuitElement }>
  terminator?: CircuitElement
  startBp: number
  endBp: number
  isValid: boolean
  warnings: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  operons: Operon[]
}

export interface SimulationCircuit {
  name: string
  operons: Array<{
    id: string
    promoter: { 
      name: string
      strength: number
      inducer?: string 
      // New promoter params for activation + repression
      activity?: number
      leak?: number
      activatorName?: string
      actK?: number
      actN?: number
      inhibitorName?: string
      repK?: number
      repN?: number
      // Inducible promoter params
      inducerName?: string
      indK?: number
      indN?: number
    }
    genes: Array<{
      name: string
      product: string
      rbsStrength: number
      rbsName?: string
    }>
    terminator?: { 
      name: string
      efficiency: number 
    }
  }>
  connections: Array<{
    regulator: string
    target: string
    type: 'activation' | 'repression'
  }>
}

/**
 * CircuitModel - Structured representation of a genetic circuit
 * Parses DNA components into a circuit model and provides analysis capabilities
 */
export class CircuitModel {
  private components: CircuitComponent[]
  private dnaLength: number
  private elements: CircuitElement[]

  constructor(components: CircuitComponent[], dnaLength: number) {
    this.components = components
    this.dnaLength = dnaLength
    this.elements = this.parseComponents()
  }

  /**
   * Parse CircuitComponents into structured CircuitElements
   */
  private parseComponents(): CircuitElement[] {
    const elements: CircuitElement[] = []

    for (const comp of this.components) {
      // NEW: Only process components that are placed on DNA (have position)
      if (comp.position === undefined) continue

      // IMPORTANT: `position` is an insertion index (left edge), not a center point.
      // Represent component span as [startBp, endBp) in background bp space.
      const startBpRaw = Math.round(comp.position)
      const lengthBp = Math.max(0, Math.round(comp.length))
      const startBp = Math.max(0, Math.min(this.dnaLength, startBpRaw))
      const endBp = Math.max(startBp, Math.min(this.dnaLength, startBp + lengthBp))

      const element: CircuitElement = {
        id: comp.id,
        type: this.mapComponentType(comp.type),
        startBp,
        endBp,
        name: comp.name,
        originalComponent: comp,
        metadata: {
          color: comp.color,
          subType: comp.subType,
          position: comp.position,
          length: comp.length,
        },
      }

      elements.push(element)
    }

    // Sort by genomic position (left to right)
    return elements.sort((a, b) => a.startBp - b.startBp)
  }

  /**
   * Map component type string to CircuitElement type
   */
  private mapComponentType(type: string): CircuitElement['type'] {
    const lowerType = type.toLowerCase()
    
    if (lowerType.includes('promoter') || lowerType.includes('prom')) {
      return 'promoter'
    }
    if (lowerType.includes('rbs') || lowerType.includes('ribosome')) {
      return 'rbs'
    }
    if (lowerType.includes('gene') || lowerType.includes('cds') || lowerType.includes('coding')) {
      return 'gene'
    }
    if (lowerType.includes('terminator') || lowerType.includes('term')) {
      return 'terminator'
    }
    if (lowerType.includes('operator')) {
      return 'operator'
    }
    
    return 'other'
  }

  /**
   * Get all circuit elements sorted by position
   */
  getElements(): CircuitElement[] {
    return [...this.elements]
  }

  /**
   * Detect operons in the circuit using pattern matching
   */
  detectOperons(): Operon[] {
    return detectOperonsUtil(this.elements)
  }

  /**
   * Validate the entire circuit structure
   */
  validateCircuit(): ValidationResult {
    const operons = this.detectOperons()
    const errors: string[] = []
    const warnings: string[] = []

    // Check for basic circuit issues
    if (this.elements.length === 0) {
      warnings.push('No components placed on DNA')
    }

    // Check for overlapping components
    for (let i = 0; i < this.elements.length - 1; i++) {
      const curr = this.elements[i]
      const next = this.elements[i + 1]
      
      if (curr.endBp > next.startBp) {
        warnings.push(
          `Overlapping components: ${curr.name} (${curr.startBp}-${curr.endBp}) ` +
          `and ${next.name} (${next.startBp}-${next.endBp})`
        )
      }
    }

    // Collect operon-specific warnings
    for (const operon of operons) {
      warnings.push(...operon.warnings)
    }

    const isValid = errors.length === 0

    return {
      isValid,
      errors,
      warnings,
      operons,
    }
  }

  /**
   * Export circuit in simulation-friendly format
   */
  toSimulationFormat(): SimulationCircuit {
    const operons = this.detectOperons()

    return {
      name: 'Genetic Circuit',
      operons: operons.map(operon => ({
        id: operon.id,
        promoter: (() => {
          const p = getPromoterParams(operon.promoter.name)
          return {
          name: operon.promoter.name,
          strength: getPromoterStrength(operon.promoter.name),
          inducer: operon.promoter.metadata?.inducer,
          activity: p.activity,
          leak: p.leak,
          activatorName: p.activatorName,
          actK: p.actK,
          actN: p.actN,
          inhibitorName: p.inhibitorName,
          repK: p.repK,
          repN: p.repN,
          inducerName: p.inducerName,
          indK: p.indK,
          indN: p.indN,
          }
        })(),
        genes: operon.rbsGenePairs.map(pair => ({
          name: pair.gene.name,
          product: pair.gene.name, // Could be enhanced with actual product names
          rbsStrength: getRbsStrength(pair.rbs.name),
          rbsName: pair.rbs.name,
        })),
        terminator: operon.terminator ? {
          name: operon.terminator.name,
          efficiency: 0.95, // Default termination efficiency
        } : undefined,
      })),
      connections: [], // Would need additional logic to detect regulatory interactions
    }
  }

  /**
   * Get statistics about the circuit
   */
  getStatistics() {
    const typeCounts: Record<string, number> = {}
    
    for (const element of this.elements) {
      typeCounts[element.type] = (typeCounts[element.type] || 0) + 1
    }

    return {
      totalElements: this.elements.length,
      typeCounts,
      totalLength: this.dnaLength,
      coveragePercent: this.elements.reduce(
        (sum, el) => sum + (el.endBp - el.startBp),
        0
      ) / this.dnaLength * 100,
    }
  }
}

