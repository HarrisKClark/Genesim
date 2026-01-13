/**
 * Sequence Export Utilities
 * Generates FASTA and GenBank files from circuit data
 */

import type { CircuitComponent } from '../types/dnaTypes'
import type { BackboneSpec } from '../types/backboneTypes'

// Sequence lengths for different component types
const COMPONENT_LENGTHS: Record<string, number> = {
  promoter: 100,
  rbs: 20,
  gene: 500,
  terminator: 50,
}

// Backbone element lengths
const BACKBONE_LENGTHS = {
  spacer: 200,
  antibiotic: 1000,
  origin: 200,
}

export interface Feature {
  type: string
  start: number
  end: number
  strand: 1 | -1
  label: string
  qualifiers?: Record<string, string>
}

/**
 * Generate a random DNA sequence of specified length
 */
export function generateRandomSequence(length: number): string {
  const bases = ['A', 'T', 'G', 'C']
  let sequence = ''
  for (let i = 0; i < length; i++) {
    sequence += bases[Math.floor(Math.random() * 4)]
  }
  return sequence
}

/**
 * Get the sequence length for a component type
 */
function getComponentLength(type: string): number {
  const normalizedType = type.toLowerCase()
  return COMPONENT_LENGTHS[normalizedType] || 500
}

/**
 * Generate a sequence for a component based on its type
 */
export function getComponentSequence(comp: CircuitComponent): string {
  const length = getComponentLength(comp.type)
  return generateRandomSequence(length)
}

/**
 * Generate backbone sequence based on spec
 * Structure: spacer + (antibiotic + spacer)* + origin + spacer
 */
export function generateBackboneSequence(backbone: BackboneSpec): {
  sequence: string
  features: Feature[]
} {
  let sequence = ''
  const features: Feature[] = []
  let position = 0

  // Initial spacer (200bp)
  sequence += generateRandomSequence(BACKBONE_LENGTHS.spacer)
  position += BACKBONE_LENGTHS.spacer

  // Antibiotic resistance markers
  const resistances = backbone.resistances || []
  for (let i = 0; i < resistances.length; i++) {
    const resistance = resistances[i]
    const abStart = position

    // Antibiotic sequence (1000bp)
    sequence += generateRandomSequence(BACKBONE_LENGTHS.antibiotic)
    position += BACKBONE_LENGTHS.antibiotic

    features.push({
      type: 'misc_feature',
      start: abStart + 1, // GenBank is 1-indexed
      end: position,
      strand: 1,
      label: `${resistance.code}_resistance`,
      qualifiers: {
        note: `${resistance.name || resistance.code} resistance marker`,
        gene: resistance.code,
      },
    })

    // Spacer between antibiotics (200bp) - except after last one
    if (i < resistances.length - 1) {
      sequence += generateRandomSequence(BACKBONE_LENGTHS.spacer)
      position += BACKBONE_LENGTHS.spacer
    }
  }

  // Spacer before origin if there were antibiotics
  if (resistances.length > 0) {
    sequence += generateRandomSequence(BACKBONE_LENGTHS.spacer)
    position += BACKBONE_LENGTHS.spacer
  }

  // Origin of replication (200bp)
  const oriStart = position
  sequence += generateRandomSequence(BACKBONE_LENGTHS.origin)
  position += BACKBONE_LENGTHS.origin

  features.push({
    type: 'rep_origin',
    start: oriStart + 1, // GenBank is 1-indexed
    end: position,
    strand: 1,
    label: backbone.originName || 'ori',
    qualifiers: {
      note: `${backbone.originName || 'Origin'} - copy number ~${backbone.copyNumber}`,
    },
  })

  // Final spacer (200bp)
  sequence += generateRandomSequence(BACKBONE_LENGTHS.spacer)
  position += BACKBONE_LENGTHS.spacer

  return { sequence, features }
}

/**
 * Build full plasmid sequence from components and backbone
 * Insert comes first (position 0), then backbone
 */
export function buildFullPlasmidSequence(
  components: CircuitComponent[],
  dnaLength: number,
  backbone: BackboneSpec
): { sequence: string; features: Feature[] } {
  // Sort components by position
  const placedComponents = components
    .filter((c) => c.position !== undefined)
    .sort((a, b) => (a.position || 0) - (b.position || 0))

  let insertSequence = ''
  const features: Feature[] = []
  let currentPos = 0

  // Build insert sequence with features
  for (const comp of placedComponents) {
    const compPos = comp.position || 0

    // Fill gap with random sequence (non-coding region before this component)
    if (compPos > currentPos) {
      const gapLength = compPos - currentPos
      insertSequence += generateRandomSequence(gapLength)
      currentPos = compPos
    }

    // Add component sequence
    const compLength = getComponentLength(comp.type)
    const compSequence = generateRandomSequence(compLength)
    insertSequence += compSequence

    // Map component type to GenBank feature type
    const featureType = mapComponentTypeToFeature(comp.type)

    // Feature position is based on where we are in the final sequence
    const featureStart = insertSequence.length - compLength + 1 // GenBank is 1-indexed
    const featureEnd = insertSequence.length

    features.push({
      type: featureType,
      start: featureStart,
      end: featureEnd,
      strand: 1,
      label: comp.name,
      qualifiers: getComponentQualifiers(comp),
    })

    // Advance position past this component
    currentPos = compPos + compLength
  }

  // Fill remaining non-coding region after the last component to reach dnaLength
  if (dnaLength > currentPos) {
    const trailingGap = dnaLength - currentPos
    insertSequence += generateRandomSequence(trailingGap)
  }

  // Generate backbone sequence
  const backboneResult = generateBackboneSequence(backbone)

  // Offset backbone features by insert length
  const insertLength = insertSequence.length
  const offsetBackboneFeatures = backboneResult.features.map((f) => ({
    ...f,
    start: f.start + insertLength,
    end: f.end + insertLength,
  }))

  return {
    sequence: insertSequence + backboneResult.sequence,
    features: [...features, ...offsetBackboneFeatures],
  }
}

/**
 * Map component type to GenBank feature type
 */
function mapComponentTypeToFeature(type: string): string {
  const normalized = type.toLowerCase()
  switch (normalized) {
    case 'promoter':
      return 'promoter'
    case 'rbs':
      return 'RBS'
    case 'gene':
      return 'CDS'
    case 'terminator':
      return 'terminator'
    default:
      return 'misc_feature'
  }
}

/**
 * Get GenBank qualifiers for a component
 */
function getComponentQualifiers(comp: CircuitComponent): Record<string, string> {
  const qualifiers: Record<string, string> = {
    label: comp.name,
  }

  const normalized = comp.type.toLowerCase()
  switch (normalized) {
    case 'gene':
      qualifiers.product = comp.name
      if (comp.subType) {
        qualifiers.note = `${comp.subType} gene`
      }
      break
    case 'promoter':
      qualifiers.note = `${comp.name} promoter`
      break
    case 'rbs':
      qualifiers.note = 'Ribosome binding site'
      break
    case 'terminator':
      qualifiers.note = `${comp.name} terminator`
      break
  }

  return qualifiers
}

/**
 * Format sequence as FASTA
 */
export function toFasta(name: string, sequence: string): string {
  const lines: string[] = [`>${name}`]

  // Split sequence into 60-character lines (FASTA standard)
  for (let i = 0; i < sequence.length; i += 60) {
    lines.push(sequence.slice(i, i + 60))
  }

  return lines.join('\n') + '\n'
}

/**
 * Format sequence as GenBank
 */
export function toGenBank(
  name: string,
  sequence: string,
  features: Feature[],
  definition?: string
): string {
  const lines: string[] = []
  const seqLength = sequence.length
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase().replace(',', '')

  // LOCUS line
  const locusName = name.slice(0, 16).replace(/\s+/g, '_')
  lines.push(`LOCUS       ${locusName.padEnd(16)} ${seqLength.toString().padStart(7)} bp    DNA     circular SYN ${dateStr}`)

  // DEFINITION
  lines.push(`DEFINITION  ${definition || name}`)

  // ACCESSION
  lines.push(`ACCESSION   .`)

  // VERSION
  lines.push(`VERSION     .`)

  // KEYWORDS
  lines.push(`KEYWORDS    .`)

  // SOURCE
  lines.push(`SOURCE      synthetic construct`)
  lines.push(`  ORGANISM  synthetic construct`)
  lines.push(`            other sequences; artificial sequences.`)

  // FEATURES header
  lines.push(`FEATURES             Location/Qualifiers`)

  // Source feature
  lines.push(`     source          1..${seqLength}`)
  lines.push(`                     /organism="synthetic construct"`)
  lines.push(`                     /mol_type="other DNA"`)

  // Component features
  for (const feature of features) {
    const location = feature.strand === -1
      ? `complement(${feature.start}..${feature.end})`
      : `${feature.start}..${feature.end}`

    lines.push(`     ${feature.type.padEnd(16)}${location}`)

    // Add qualifiers
    if (feature.qualifiers) {
      for (const [key, value] of Object.entries(feature.qualifiers)) {
        lines.push(`                     /${key}="${value}"`)
      }
    }
  }

  // ORIGIN and sequence
  lines.push(`ORIGIN`)

  // Format sequence in GenBank style (60 bp per line, numbered)
  const seqLower = sequence.toLowerCase()
  for (let i = 0; i < seqLower.length; i += 60) {
    const lineNum = (i + 1).toString().padStart(9)
    const chunks: string[] = []
    for (let j = 0; j < 60 && i + j < seqLower.length; j += 10) {
      chunks.push(seqLower.slice(i + j, Math.min(i + j + 10, seqLower.length)))
    }
    lines.push(`${lineNum} ${chunks.join(' ')}`)
  }

  lines.push(`//`)

  return lines.join('\n') + '\n'
}

