export interface PartTemplate {
  type: string
  name: string
  subType?: string
  color: string
  // Promoter params
  promoterStrength?: number // legacy alias for activity
  activity?: number
  rbsStrength?: number

  // Gene classification for UI tabs
  geneClass?: 'reporter' | 'activator' | 'repressor'
  
  // Promoter classification for UI tabs
  // inducible: needs small molecule to activate (IPTG, arabinose, etc.)
  // regulated: on/off by default, modulated by another gene
  // constitutive: always on
  promoterClass?: 'inducible' | 'regulated' | 'constitutive'
  
  // For inducible promoters: the small molecule inducer name
  inducerName?: string
  indK?: number  // Hill constant for inducer
  indN?: number  // Hill coefficient for inducer

  // Promoter regulation (activation + repression)
  activatorName?: string
  actK?: number
  actN?: number
  inhibitorName?: string
  repK?: number
  repN?: number
  leak?: number
}

export interface ComponentCategory {
  id: string
  name: string
  components: PartTemplate[]
}

const baseComponentCategories: ComponentCategory[] = [
  {
    id: 'promoter',
    name: 'Promoters',
    components: [
      // === CONSTITUTIVE PROMOTERS (always on, no regulation) ===
      { type: 'promoter', name: 'pJ23100', subType: 'Anderson Strong', color: '#27ae60', activity: 1.0, promoterClass: 'constitutive', leak: 1.0 },
      { type: 'promoter', name: 'pJ23106', subType: 'Anderson Medium', color: '#27ae60', activity: 0.5, promoterClass: 'constitutive', leak: 1.0 },
      { type: 'promoter', name: 'pJ23117', subType: 'Anderson Weak', color: '#27ae60', activity: 0.1, promoterClass: 'constitutive', leak: 1.0 },
      
      // === REGULATED PROMOTERS (on by default, modulated by genes) ===
      { type: 'promoter', name: 'pR', subType: 'Lambda pR (repressed by Lambda CI)', color: '#4a90e2', activity: 1.0, promoterClass: 'regulated', inhibitorName: 'Lambda CI', repK: 10.0, repN: 2.0, leak: 0.0 },
      { type: 'promoter', name: 'pLac', subType: 'Lac (repressed by LacI)', color: '#4a90e2', activity: 1.0, promoterClass: 'regulated', inhibitorName: 'Lac I', repK: 10.0, repN: 2.0, leak: 0.0 },
      { type: 'promoter', name: 'pTet', subType: 'Tet (repressed by TetR)', color: '#4a90e2', activity: 1.0, promoterClass: 'regulated', inhibitorName: 'TetR', repK: 10.0, repN: 2.0, leak: 0.0 },
      { type: 'promoter', name: 'pLux', subType: 'Lux (activated by LuxR)', color: '#4a90e2', activity: 1.0, promoterClass: 'regulated', activatorName: 'LuxR', actK: 10.0, actN: 2.0, leak: 0.01 },
      { type: 'promoter', name: 'pBad', subType: 'Bad (activated by AraC)', color: '#4a90e2', activity: 1.0, promoterClass: 'regulated', activatorName: 'AraC', actK: 10.0, actN: 2.0, leak: 0.01 },
      
      // === INDUCIBLE PROMOTERS (need small molecule to activate) ===
      { type: 'promoter', name: 'pLac-IPTG', subType: 'IPTG-inducible Lac', color: '#9b59b6', activity: 1.0, promoterClass: 'inducible', inducerName: 'IPTG', leak: 0.01 },
      { type: 'promoter', name: 'pAra', subType: 'Arabinose-inducible', color: '#9b59b6', activity: 1.0, promoterClass: 'inducible', inducerName: 'Arabinose', leak: 0.01 },
      { type: 'promoter', name: 'pTet-aTc', subType: 'aTc-inducible Tet', color: '#9b59b6', activity: 1.0, promoterClass: 'inducible', inducerName: 'aTc', leak: 0.01 },
      { type: 'promoter', name: 'pRha', subType: 'Rhamnose-inducible', color: '#9b59b6', activity: 1.0, promoterClass: 'inducible', inducerName: 'Rhamnose', leak: 0.01 },
      { type: 'promoter', name: 'pT7-IPTG', subType: 'T7/IPTG-inducible', color: '#9b59b6', activity: 2.0, promoterClass: 'inducible', inducerName: 'IPTG', leak: 0.0 },
    ],
  },
  {
    id: 'rbs',
    name: 'RBS',
    components: [
      { type: 'rbs', name: 'RBS1', subType: 'Standard RBS', color: '#9b59b6', rbsStrength: 1.0 },
      { type: 'rbs', name: 'RBS2', subType: 'Strong RBS', color: '#9b59b6', rbsStrength: 2.0 },
      { type: 'rbs', name: 'RBS3', subType: 'Weak RBS', color: '#9b59b6', rbsStrength: 0.5 },
    ],
  },
  {
    id: 'gene',
    name: 'Genes',
    components: [
      // Repressors
      { type: 'gene', name: 'Lambda CI', subType: 'Lambda CI repressor', color: '#50c878', geneClass: 'repressor' },
      { type: 'gene', name: 'Lac I', subType: 'Lac repressor', color: '#50c878', geneClass: 'repressor' },
      { type: 'gene', name: 'TetR', subType: 'Tet repressor', color: '#50c878', geneClass: 'repressor' },
      // Activators
      { type: 'gene', name: 'LuxR', subType: 'LuxR activator', color: '#e67e22', geneClass: 'activator' },
      { type: 'gene', name: 'AraC', subType: 'AraC activator', color: '#e67e22', geneClass: 'activator' },
      // Fluorescent reporters
      { type: 'gene', name: 'GFP', subType: 'Green Fluorescent Protein', color: '#2ecc71', geneClass: 'reporter' },
      { type: 'gene', name: 'RFP', subType: 'Red Fluorescent Protein', color: '#e74c3c', geneClass: 'reporter' },
      { type: 'gene', name: 'BFP', subType: 'Blue Fluorescent Protein', color: '#3498db', geneClass: 'reporter' },
      { type: 'gene', name: 'YFP', subType: 'Yellow Fluorescent Protein', color: '#f1c40f', geneClass: 'reporter' },
      { type: 'gene', name: 'CFP', subType: 'Cyan Fluorescent Protein', color: '#1abc9c', geneClass: 'reporter' },
      { type: 'gene', name: 'mCherry', subType: 'mCherry Fluorescent Protein', color: '#ff2d55', geneClass: 'reporter' },
      { type: 'gene', name: 'mOrange', subType: 'mOrange Fluorescent Protein', color: '#ff9500', geneClass: 'reporter' },
      { type: 'gene', name: 'Luc', subType: 'Luciferase (luminescent reporter)', color: '#9b59b6', geneClass: 'reporter' },
      { type: 'gene', name: 'LacZ', subType: 'β-galactosidase (LacZ reporter)', color: '#34495e', geneClass: 'reporter' },
    ],
  },
  {
    id: 'terminator',
    name: 'Terminators',
    components: [
      { type: 'terminator', name: 'T1', subType: 'T1 Terminator', color: '#e67e22' },
      { type: 'terminator', name: 'T7', subType: 'T7 Terminator', color: '#e67e22' },
      { type: 'terminator', name: 'rrnB', subType: 'rrnB Terminator', color: '#e67e22' },
      { type: 'terminator', name: 'T4', subType: 'T4 Terminator', color: '#e67e22' },
    ],
  },
  // Intentionally omitted for now: regulators/riboswitch/test-part
]

const customPromoters: PartTemplate[] = []
const customGenes: PartTemplate[] = []

export type CustomPartsBundle = {
  promoters: PartTemplate[]
  genes: PartTemplate[]
}

let _revision = 0
const _listeners = new Set<() => void>()

function bumpRevision() {
  _revision += 1
  for (const l of _listeners) l()
}

export function subscribePartLibrary(listener: () => void) {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

export function exportCustomParts(): CustomPartsBundle {
  return {
    promoters: customPromoters.map((p) => ({ ...p })),
    genes: customGenes.map((g) => ({ ...g })),
  }
}

function upsertCustom(arr: PartTemplate[], t: PartTemplate) {
  const key = `${t.type}:${t.name}`
  const idx = arr.findIndex((x) => `${x.type}:${x.name}` === key)
  const normalized = { ...t, type: t.type }
  if (idx >= 0) arr[idx] = normalized
  else arr.push(normalized)
}

export function importCustomParts(bundle: Partial<CustomPartsBundle> | null | undefined) {
  if (!bundle) return
  let changed = false
  for (const p of bundle.promoters ?? []) {
    const beforeLen = customPromoters.length
    upsertCustom(customPromoters, { ...p, type: 'promoter' })
    changed = changed || customPromoters.length !== beforeLen
  }
  for (const g of bundle.genes ?? []) {
    const beforeLen = customGenes.length
    upsertCustom(customGenes, { ...g, type: 'gene' })
    changed = changed || customGenes.length !== beforeLen
  }
  if (changed) bumpRevision()
}

function allTemplates(): PartTemplate[] {
  return [
    ...baseComponentCategories.flatMap((c) => c.components),
    ...customPromoters,
    ...customGenes,
  ]
}

export function registerCustomPromoter(t: PartTemplate) {
  customPromoters.push({ ...t, type: 'promoter' })
  bumpRevision()
}

export function registerCustomGene(t: PartTemplate) {
  customGenes.push({ ...t, type: 'gene' })
  bumpRevision()
}

export function getComponentCategories(): ComponentCategory[] {
  const base = baseComponentCategories.map((c) => ({
    ...c,
    components: [...c.components],
  }))

  const promoterCat = base.find((c) => c.id === 'promoter')
  if (promoterCat) promoterCat.components = [...promoterCat.components, ...customPromoters]

  const geneCat = base.find((c) => c.id === 'gene')
  if (geneCat) geneCat.components = [...geneCat.components, ...customGenes]

  return base
}

export function getPartTemplate(type: string, name: string): PartTemplate | undefined {
  return allTemplates().find((t) => t.type === type && t.name === name)
}

export function getPromoterStrength(name: string): number {
  const t = getPartTemplate('promoter', name)
  return (t?.activity ?? t?.promoterStrength ?? 1.0)
}

export function getRbsStrength(name: string): number {
  return getPartTemplate('rbs', name)?.rbsStrength ?? 1.0
}

export function getPromoterParams(name: string): {
  activity: number
  leak: number
  activatorName?: string
  actK: number
  actN: number
  inhibitorName?: string
  repK: number
  repN: number
  inducerName?: string
  indK: number
  indN: number
} {
  const t = getPartTemplate('promoter', name)
  return {
    activity: (t?.activity ?? t?.promoterStrength ?? 1.0),
    leak: t?.leak ?? 0.0,
    activatorName: t?.activatorName,
    actK: t?.actK ?? 10.0,
    actN: t?.actN ?? 2.0,
    inhibitorName: t?.inhibitorName,
    repK: t?.repK ?? 10.0,
    repN: t?.repN ?? 2.0,
    inducerName: t?.inducerName,
    indK: t?.indK ?? 0.5,
    indN: t?.indN ?? 2.0,
  }
}


