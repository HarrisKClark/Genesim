/**
 * DNA Rendering Utilities
 * Helper functions for DNA visualization calculations
 */

/**
 * Get the complementary base for a given DNA base
 */
export function getComplementaryBase(base: string): string {
  const complement: Record<string, string> = {
    A: 'T',
    T: 'A',
    G: 'C',
    C: 'G',
    N: 'N',
  }
  return complement[base.toUpperCase()] || 'N'
}

/**
 * Get the antisense sequence (complementary strand)
 */
export function getAntisenseSequence(senseSequence: string[]): string[] {
  return senseSequence.map(getComplementaryBase)
}

/**
 * Get the background color for a DNA base
 */
export function getBaseColor(base: string, opacity: string = ''): string {
  const colors: Record<string, string> = {
    A: '#e74c3c',
    T: '#3498db',
    G: '#2ecc71',
    C: '#f39c12',
    N: '#999',
  }
  return (colors[base.toUpperCase()] || '#666') + opacity
}

/**
 * Calculate display text for a component block based on available width
 * Three-stage rendering:
 * 1. Full text if it fits
 * 2. First letter + "..." if abbreviated fits
 * 3. Nothing if too small
 */
export function calculateDisplayText(
  name: string,
  availableWidth: number,
  fontSize: number
): string {
  const charWidth = fontSize * 0.65
  const fullTextWidth = name.length * charWidth
  const abbreviatedWidth = 4 * charWidth // "X..." = 4 chars

  if (availableWidth >= fullTextWidth) {
    return name
  } else if (availableWidth >= abbreviatedWidth && name.length > 1) {
    return name[0] + '...'
  } else if (availableWidth >= charWidth) {
    return name[0]
  }
  return ''
}

/**
 * Calculate font size based on zoom level with min/max constraints
 */
export function calculateFontSize(
  zoom: number,
  minSize: number = 8,
  maxSize: number = 14,
  baseSize: number = 8
): number {
  return Math.max(minSize, Math.min(maxSize, baseSize * zoom))
}

/**
 * Calculate base height based on zoom level
 */
export function calculateBaseHeight(zoom: number): number {
  return Math.max(12, Math.min(24, 12 * zoom))
}

/**
 * Calculate strand spacing based on zoom level
 */
export function calculateStrandSpacing(zoom: number): number {
  return Math.max(20, Math.min(40, 20 * zoom))
}

/**
 * Calculate backbone dimensions
 */
export interface BackboneDimensions {
  gap: number
  height: number
  padding: number
  stubLength: number
  y: number
  left: number
  width: number
  midY: number
}

export function calculateBackboneDimensions(
  zoom: number,
  lineY: number,
  lineX: number,
  totalWidth: number,
  strandSpacing: number,
  baseHeight: number
): BackboneDimensions {
  const gap = Math.max(55, Math.min(95, 70 * zoom))
  const height = Math.round(Math.max(18, Math.min(26, 20 * zoom)))
  const padding = Math.round(Math.max(35, Math.min(80, 55 * zoom)))
  const stubLength = Math.round(Math.max(14, Math.min(28, 18 * zoom)))
  const y = Math.round(lineY + strandSpacing / 2 + baseHeight / 2 + gap)
  const left = Math.round(lineX - padding)
  const width = Math.round(totalWidth + padding * 2)
  const midY = Math.round(y + height / 2)

  return { gap, height, padding, stubLength, y, left, width, midY }
}

/**
 * Calculate abstract block dimensions
 */
export interface AbstractBlockDimensions {
  height: number
  top: number
}

export function calculateAbstractBlockDimensions(
  lineY: number,
  strandSpacing: number,
  baseHeight: number
): AbstractBlockDimensions {
  const height = strandSpacing + baseHeight
  const top = lineY - strandSpacing / 2 - baseHeight / 2
  return { height, top }
}

/**
 * Check if label should be shown (to prevent overlapping)
 */
export function shouldShowLabel(
  currentX: number,
  lastLabelX: number,
  label: string,
  fontSize: number = 13,
  minGap: number = 12
): boolean {
  const estimatedLabelWidth = label.length * fontSize * 0.62
  const minGapPx = estimatedLabelWidth + minGap
  return currentX - lastLabelX >= minGapPx
}

/**
 * User selection styles for cross-browser compatibility
 */
export const noSelectStyles = {
  userSelect: 'none' as const,
  WebkitUserSelect: 'none' as const,
  MozUserSelect: 'none' as const,
  msUserSelect: 'none' as const,
}

