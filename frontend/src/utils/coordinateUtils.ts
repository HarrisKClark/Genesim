/**
 * Coordinate conversion utilities for DNA sequence visualization
 */

/**
 * Convert base pair position to X coordinate
 */
export function bpToX(bp: number, bpPerPixel: number): number {
  return bp / bpPerPixel
}

/**
 * Convert X coordinate to base pair position
 */
export function xToBp(x: number, bpPerPixel: number): number {
  return Math.floor(x * bpPerPixel)
}

/**
 * Get base pair position from mouse event
 */
export function getBpFromMouse(
  e: React.MouseEvent | MouseEvent,
  canvasRef: React.RefObject<HTMLDivElement>,
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  canvasWidth: number,
  totalWidth: number,
  bpPerPixel: number,
  dnaLength: number
): number | null {
  if (!canvasRef.current || !scrollContainerRef.current) return null
  const rect = canvasRef.current.getBoundingClientRect()
  const scrollLeft = scrollContainerRef.current.scrollLeft
  const currentLineX = canvasWidth > 0 && totalWidth < canvasWidth ? (canvasWidth - totalWidth) / 2 : 0
  const x = (e.clientX - rect.left) + scrollLeft - currentLineX
  const bp = xToBp(x, bpPerPixel)
  return Math.max(0, Math.min(dnaLength - 1, bp))
}

/**
 * Get cursor position from mouse event
 * Returns cursor position: 0 = before first base, 1 = after first base, etc.
 * Cursor position N means "between base N-1 and base N" (or "after base N-1")
 */
export function getCursorPositionFromMouse(
  e: React.MouseEvent | MouseEvent,
  canvasRef: React.RefObject<HTMLDivElement>,
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  canvasWidth: number,
  totalWidth: number,
  bpPerPixel: number,
  dnaLength: number,
  _showBasePairs: boolean // Kept for API compatibility but not used - cursor works in both views
): number | null {
  if (!canvasRef.current || !scrollContainerRef.current) return null
  // Allow cursor in both DNA view and abstract view
  
  const rect = canvasRef.current.getBoundingClientRect()
  const scrollLeft = scrollContainerRef.current.scrollLeft
  const currentLineX = canvasWidth > 0 && totalWidth < canvasWidth ? (canvasWidth - totalWidth) / 2 : 0
  const mouseX = (e.clientX - rect.left) + scrollLeft - currentLineX
  
  // Find which base the mouse is over
  const baseIndex = Math.floor(mouseX * bpPerPixel)
  const clampedBaseIndex = Math.max(0, Math.min(dnaLength - 1, baseIndex))
  
  // Calculate the X position of the base's left edge and width
  const baseLeftX = bpToX(clampedBaseIndex, bpPerPixel)
  const baseWidth = 1 / bpPerPixel
  
  // Determine which half of the base the mouse is on
  // Left half → cursor before base (position = baseIndex)
  // Right half → cursor after base (position = baseIndex + 1)
  const relativeX = mouseX - baseLeftX
  if (relativeX < baseWidth / 2) {
    // Left half: cursor before this base (position = baseIndex)
    return Math.max(0, clampedBaseIndex)
  } else {
    // Right half: cursor after this base (position = baseIndex + 1)
    return Math.min(dnaLength, clampedBaseIndex + 1)
  }
}

/**
 * Convert cursor position to base index for selection
 * 
 * Cursor position N means "after base N-1" (insertion point between bases).
 * 
 * When selecting by dragging from cursor A to cursor B:
 * - We want to select the bases that lie between the two cursor positions
 * - Cursor at position A is after base A-1
 * - Cursor at position B is after base B-1
 * - Bases between: from base A to base B-1 (inclusive)
 * 
 * Example: cursor at 3 (after 'c') to cursor at 4 (after 'd')
 * - Should select base 3 ('d') only
 * - So: startBp = 3, endBp = 3
 * - Which means: startBp = cursorPos, endBp = cursorPos - 1
 * 
 * But wait, that gives us [3, 3] which is correct!
 * 
 * Actually, the issue is in how we convert. Let me think:
 * - For the START cursor (when dragging forward): we want the base AFTER the cursor = cursorPos
 * - For the END cursor (when dragging forward): we want the base BEFORE the cursor = cursorPos - 1
 * 
 * So the conversion depends on whether it's the start or end. But we don't have that context here.
 * 
 * Let me use a different approach: select the base that the cursor is "over" when dragging.
 * When cursor is at position N (between base N-1 and base N), and we're dragging forward,
 * we select base N (the base the cursor is moving toward).
 * 
 * But for the end cursor, we want base N-1 (the base the cursor just passed).
 * 
 * Actually, I think the simplest fix is:
 * - For start cursor: base = cursorPos (base after cursor)
 * - For end cursor: base = cursorPos - 1 (base before cursor)
 * 
 * But since we don't know which is which in this function, let's make it context-aware.
 * Actually, let's just fix it in the selection logic instead.
 */
export function cursorPosToBaseIndex(cursorPos: number, dnaLength: number): number {
  // Cursor position N means "after base N-1"
  // For selection, we want to select the base that the cursor is "over"
  // When dragging forward, cursor at position N selects base N (the base after the cursor)
  // When dragging backward, cursor at position N selects base N-1 (the base before the cursor)
  // 
  // Since we don't know direction here, we'll use a conservative approach:
  // Select the base BEFORE the cursor (N-1), which works for backward drags
  // But we'll fix the forward drag case in the selection logic
  if (cursorPos <= 0) return 0
  return Math.max(0, Math.min(dnaLength - 1, Math.floor(cursorPos) - 1))
}

