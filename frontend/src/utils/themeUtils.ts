/**
 * Centralized theme utilities for consistent styling across all components.
 * All color values are derived from CSS custom properties defined in index.css.
 */

// Get computed CSS variable value from document root
export function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// Convert hex to rgba
export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(128, 128, 128, ${alpha})`
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Theme color getters - call these in component render to get current theme values
export const theme = {
  // Backgrounds
  get bgPrimary() { return getCssVar('--bg-primary', '#e8e8e8') },
  get bgSecondary() { return getCssVar('--bg-secondary', '#d4d4d4') },
  get bgTertiary() { return getCssVar('--bg-tertiary', '#c0c0c0') },
  get bgInput() { return getCssVar('--bg-input', '#f5f5f5') },
  get bgHover() { return getCssVar('--bg-hover', '#ebebeb') },
  get bgHeader() { return getCssVar('--bg-header', '#3a3a3a') },
  get bgDialog() { return getCssVar('--bg-dialog', 'white') },
  get bgDialogHeader() { return getCssVar('--bg-dialog-header', '#fafafa') },
  
  // Text
  get textPrimary() { return getCssVar('--text-primary', '#000') },
  get textSecondary() { return getCssVar('--text-secondary', '#333') },
  get textTertiary() { return getCssVar('--text-tertiary', '#555') },
  get textMuted() { return getCssVar('--text-muted', '#666') },
  get textHint() { return getCssVar('--text-hint', '#777') },
  get textInverse() { return getCssVar('--text-inverse', '#e0e0e0') },
  get textOnAccent() { return getCssVar('--text-on-accent', '#fff') },
  
  // Borders
  get borderPrimary() { return getCssVar('--border-primary', '#888') },
  get borderSecondary() { return getCssVar('--border-secondary', '#aaa') },
  get borderLight() { return getCssVar('--border-light', '#ddd') },
  get borderInput() { return getCssVar('--border-input', '#ccc') },
  get borderCell() { return getCssVar('--border-cell', '#888') },
  
  // Accent
  get accentPrimary() { return getCssVar('--accent-primary', '#4a90e2') },
  get accentHover() { return getCssVar('--accent-hover', '#2d5aa0') },
  
  // Other
  get shadowColor() { return getCssVar('--shadow-color', 'rgba(0, 0, 0, 0.15)') },
  get overlayColor() { return getCssVar('--overlay-color', 'rgba(0, 0, 0, 0.35)') },
  
  // DNA colors
  get dnaSense() { return getCssVar('--dna-sense', '#3b82f6') },
  get dnaAntisense() { return getCssVar('--dna-antisense', '#ef4444') },
  get dnaBackbone() { return getCssVar('--dna-backbone', '#6b7280') },
  
  // Plot colors
  get plotBg() { return getCssVar('--plot-bg', '#fff') },
  get plotPaper() { return getCssVar('--plot-paper', '#fff') },
  get plotGrid() { return getCssVar('--plot-grid', '#e0e0e0') },
  get plotText() { return getCssVar('--plot-text', '#333') },
  
  // Cursor color - needs to be visible against the DNA strands
  get cursorColor() { return getCssVar('--cursor-color', '#000') },
}

// Common dialog styles - use these for consistent dialog appearance
export function getDialogStyles() {
  return {
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: theme.overlayColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    container: {
      background: theme.bgDialog,
      border: `2px solid ${theme.borderPrimary}`,
      borderRadius: 0,
      padding: 0,
      minWidth: 400,
      maxWidth: '90vw',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column' as const,
      boxShadow: `4px 4px 0 ${theme.shadowColor}`,
      fontFamily: 'Courier New, monospace',
    },
    header: {
      padding: '12px 16px',
      borderBottom: `1px solid ${theme.borderLight}`,
      background: theme.bgDialogHeader,
      fontWeight: 600,
      fontSize: 14,
      color: theme.textPrimary,
    },
    body: {
      padding: 16,
      overflowY: 'auto' as const,
      color: theme.textPrimary,
    },
    footer: {
      padding: '12px 16px',
      borderTop: `1px solid ${theme.borderLight}`,
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end',
      background: theme.bgDialogHeader,
    },
    label: {
      display: 'block',
      marginBottom: 4,
      fontWeight: 600,
      fontSize: 12,
      color: theme.textSecondary,
    },
    input: {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid ${theme.borderInput}`,
      borderRadius: 0,
      fontSize: 13,
      fontFamily: 'Courier New, monospace',
      background: theme.bgInput,
      color: theme.textPrimary,
    },
    select: {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid ${theme.borderInput}`,
      borderRadius: 0,
      fontSize: 13,
      fontFamily: 'Courier New, monospace',
      background: theme.bgInput,
      color: theme.textPrimary,
    },
    primaryButton: {
      padding: '8px 16px',
      background: theme.accentPrimary,
      color: theme.textOnAccent,
      border: `1px solid ${theme.accentHover}`,
      borderRadius: 0,
      cursor: 'pointer',
      fontFamily: 'Courier New, monospace',
      fontWeight: 600,
      fontSize: 12,
    },
    secondaryButton: {
      padding: '8px 16px',
      background: theme.bgSecondary,
      color: theme.textPrimary,
      border: `1px solid ${theme.borderPrimary}`,
      borderRadius: 0,
      cursor: 'pointer',
      fontFamily: 'Courier New, monospace',
      fontWeight: 600,
      fontSize: 12,
    },
    dangerButton: {
      padding: '8px 16px',
      background: '#e74c3c',
      color: '#fff',
      border: '1px solid #c0392b',
      borderRadius: 0,
      cursor: 'pointer',
      fontFamily: 'Courier New, monospace',
      fontWeight: 600,
      fontSize: 12,
    },
  }
}

// Context menu styles
export function getContextMenuStyles() {
  return {
    container: {
      position: 'fixed' as const,
      background: theme.bgDialog,
      border: `1px solid ${theme.borderPrimary}`,
      borderRadius: 0,
      boxShadow: `2px 2px 8px ${theme.shadowColor}`,
      zIndex: 1000,
      minWidth: 160,
      padding: '4px 0',
      fontFamily: 'Courier New, monospace',
    },
    item: {
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: 12,
      color: theme.textPrimary,
      background: 'transparent',
      border: 'none',
      width: '100%',
      textAlign: 'left' as const,
      fontFamily: 'Courier New, monospace',
    },
    itemHover: {
      background: theme.bgHover,
    },
    separator: {
      height: 1,
      background: theme.borderLight,
      margin: '4px 0',
    },
  }
}

// Cell/circuit button styles (+ and x buttons)
export function getCellButtonStyles(size: number = 30) {
  return {
    addButton: {
      width: size,
      height: size,
      borderRadius: 999,
      border: `2px solid ${hexToRgba(theme.accentPrimary, 0.85)}`,
      background: theme.bgSecondary,
      color: hexToRgba(theme.accentPrimary, 0.95),
      fontFamily: 'Courier New, monospace',
      fontWeight: 900,
      fontSize: Math.round(size * 0.7),
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    deleteButton: {
      width: size,
      height: size,
      borderRadius: 4,
      border: `1px solid ${hexToRgba(theme.accentPrimary, 0.8)}`,
      background: theme.bgSecondary,
      color: hexToRgba(theme.accentPrimary, 0.95),
      fontFamily: 'Courier New, monospace',
      fontWeight: 900,
      fontSize: Math.round(size * 0.8),
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
  }
}

// Cell frame styles
export function getCellFrameStyles() {
  return {
    frame: {
      border: `2px dotted ${hexToRgba(theme.accentPrimary, 0.7)}`,
      borderRadius: 12,
    },
    label: {
      background: theme.bgPrimary,
      color: hexToRgba(theme.accentPrimary, 0.95),
      fontFamily: 'Courier New, monospace',
    },
    dragHighlight: {
      border: `2px solid ${hexToRgba(theme.accentPrimary, 0.55)}`,
      background: hexToRgba(theme.accentPrimary, 0.08),
      boxShadow: `0 0 10px ${hexToRgba(theme.accentPrimary, 0.15)}`,
    },
  }
}

