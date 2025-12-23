/**
 * Circuit component constants
 */

export const COMPONENT_COLORS: Record<string, string> = {
  promoter: '#4a90e2',
  gene: '#50c878',
  terminator: '#e67e22',
  riboswitch: '#f39c12',
  rbs: '#9b59b6',
  repressor: '#e74c3c',
  activator: '#3498db',
  'test-part': '#95a5a6',
}

// Component sizes in base pairs
export const COMPONENT_SIZES: Record<string, number> = {
  promoter: 50,
  gene: 300,
  terminator: 30,
  riboswitch: 100,
  rbs: 20,
  repressor: 200,
  activator: 200,
  'test-part': 10,
}

export const DNA_BASES = ['A', 'T', 'G', 'C']
export const DNA_LENGTH = 1000 // 1000 base pairs
export const BP_PER_PIXEL_BASE = 2 // Base pairs per pixel at zoom 1

/**
 * Generate dummy DNA sequence
 */
export function generateDNA(length: number): string[] {
  return Array.from({ length }, () => DNA_BASES[Math.floor(Math.random() * DNA_BASES.length)])
}

