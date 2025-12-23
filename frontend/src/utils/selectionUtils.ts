/**
 * Selection utility functions
 */

/**
 * Calculate selection range from mouse positions
 * Prevents wrapping - only selects in the direction of the drag
 */
export function calculateSelectionRange(
  startBp: number,
  endBp: number,
  dnaLength: number
): { startBp: number; endBp: number } {
  // Clamp to valid range
  const clampedStart = Math.max(0, Math.min(dnaLength - 1, startBp))
  const clampedEnd = Math.max(0, Math.min(dnaLength - 1, endBp))
  
  // Always return a non-wrapped selection
  // If end < start, it means the user dragged backwards, so swap them
  if (clampedEnd < clampedStart) {
    return {
      startBp: clampedEnd,
      endBp: clampedStart,
    }
  }
  
  return {
    startBp: clampedStart,
    endBp: clampedEnd,
  }
}

/**
 * Check if a base pair position is within selection
 */
export function isInSelection(
  bp: number,
  selectionStart: number,
  selectionEnd: number,
  dnaLength: number
): boolean {
  const normalizedBp = ((bp % dnaLength) + dnaLength) % dnaLength
  
  // Handle wrapped selection
  if (selectionEnd >= dnaLength) {
    // Selection wraps around
    const wrappedEnd = selectionEnd % dnaLength
    return normalizedBp >= selectionStart || normalizedBp <= wrappedEnd
  } else {
    // Normal selection
    return normalizedBp >= selectionStart && normalizedBp <= selectionEnd
  }
}

