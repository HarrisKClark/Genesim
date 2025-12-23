/**
 * DNA sequence utility functions
 */

export const DNA_BASES = ['A', 'T', 'G', 'C'] as const
export type DNABase = typeof DNA_BASES[number]

/**
 * Get complement of a base
 */
export function complement(base: DNABase): DNABase {
  const complementMap: Record<DNABase, DNABase> = {
    A: 'T',
    T: 'A',
    G: 'C',
    C: 'G',
  }
  return complementMap[base]
}

/**
 * Reverse complement of a DNA sequence
 */
export function reverseComplement(sequence: string[]): string[] {
  return sequence
    .map(base => complement(base as DNABase))
    .reverse()
}

/**
 * Calculate GC content of a sequence
 */
export function calculateGCContent(sequence: string[]): number {
  if (sequence.length === 0) return 0
  const gcCount = sequence.filter(base => base === 'G' || base === 'C').length
  return gcCount / sequence.length
}

/**
 * Translate DNA sequence to amino acids
 */
export function translate(sequence: string[]): string[] {
  const codonTable: Record<string, string> = {
    'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
    'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
    'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
    'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
    'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
    'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
    'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
    'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
    'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
    'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
    'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
    'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
    'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
    'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
    'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G',
  }

  const aminoAcids: string[] = []
  for (let i = 0; i < sequence.length - 2; i += 3) {
    const codon = sequence.slice(i, i + 3).join('')
    aminoAcids.push(codonTable[codon] || '?')
  }
  return aminoAcids
}

/**
 * Validate DNA sequence
 */
export function validateSequence(sequence: string[]): boolean {
  return sequence.every(base => DNA_BASES.includes(base as DNABase))
}

/**
 * Normalize selection range for circular DNA
 */
export function normalizeSelection(startBp: number, endBp: number, dnaLength: number): { startBp: number; endBp: number; isWrapped: boolean } {
  let normalizedStart = startBp % dnaLength
  let normalizedEnd = endBp % dnaLength
  
  if (normalizedStart < 0) normalizedStart += dnaLength
  if (normalizedEnd < 0) normalizedEnd += dnaLength
  
  // Check if selection wraps around
  const isWrapped = normalizedEnd < normalizedStart
  
  if (isWrapped) {
    // Wrapped selection: e.g., 950-50
    return { startBp: normalizedStart, endBp: normalizedEnd, isWrapped: true }
  } else {
    // Normal selection: e.g., 50-150
    return { startBp: normalizedStart, endBp: normalizedEnd, isWrapped: false }
  }
}

/**
 * Get sequence from selection range
 */
export function getSequenceRange(sequence: string[], startBp: number, endBp: number): string[] {
  const { startBp: start, endBp: end, isWrapped } = normalizeSelection(startBp, endBp, sequence.length)
  
  if (isWrapped) {
    // Wrapped: get from start to end, then from 0 to end
    return [...sequence.slice(start), ...sequence.slice(0, end + 1)]
  } else {
    return sequence.slice(start, end + 1)
  }
}

