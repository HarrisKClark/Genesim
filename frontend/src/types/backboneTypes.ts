export interface BackboneResistance {
  /** Short code used for naming, e.g. "Cm", "Kan" (2–3 chars) */
  code: string
  /** Human-readable label, e.g. "Chloramphenicol" */
  name: string
}

export interface BackboneSpec {
  /** Average copy number (shown as `${copyNumber}C`, e.g. 10 -> "10C") */
  copyNumber: number
  /** Origin of replication name, e.g. "ColE1" */
  originName: string
  /** 0–5 antibiotic resistances */
  resistances: BackboneResistance[]
}

export function normalizeBackboneCode(code: string): string {
  const c = (code ?? '').trim()
  if (!c) return ''
  // Keep alnum only; TitleCase-ish for short codes (Amp, Kan, Cm).
  const cleaned = c.replace(/[^a-zA-Z0-9]/g, '')
  if (!cleaned) return ''
  if (cleaned.length === 1) return cleaned.toUpperCase()
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase()
}

export function formatBackboneLabel(spec: BackboneSpec): string {
  const cn = Number(spec.copyNumber)
  const cnPart = Number.isFinite(cn) && cn > 0 ? `${Math.round(cn)}C` : '0C'
  const origin = (spec.originName ?? '').trim().replace(/\s+/g, '')
  const codes = (spec.resistances ?? [])
    .map((r) => normalizeBackboneCode(r.code))
    .filter(Boolean)
  const resistPart = codes.length ? codes.join('+') : 'None'
  return `BB_${cnPart}_${origin || 'Origin'}_${resistPart}`
}


