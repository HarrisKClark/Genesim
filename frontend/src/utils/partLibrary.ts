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
      // Repressed promoters (Hill repression). No activator by default.
      { type: 'promoter', name: 'pR', subType: 'Lambda pR', color: '#4a90e2', activity: 1.0, inhibitorName: 'Lambda CI', repK: 10.0, repN: 2.0, leak: 0.0 },
      { type: 'promoter', name: 'pLac', subType: 'Lac Promoter', color: '#4a90e2', activity: 1.0, inhibitorName: 'Lac I', repK: 10.0, repN: 2.0, leak: 0.0 },
      { type: 'promoter', name: 'pTet', subType: 'Tetracycline Promoter', color: '#4a90e2', activity: 1.0, inhibitorName: 'TetR', repK: 10.0, repN: 2.0, leak: 0.0 },
    ],
  },
  {
    id: 'gene',
    name: 'Genes',
    components: [
      // Inhibitors are produced like regular genes
      { type: 'gene', name: 'Lambda CI', subType: 'Lambda CI repressor', color: '#50c878', geneClass: 'repressor' },
      { type: 'gene', name: 'Lac I', subType: 'Lac repressor', color: '#50c878', geneClass: 'repressor' },
      { type: 'gene', name: 'TetR', subType: 'Tet repressor', color: '#50c878', geneClass: 'repressor' },
      // Fluorescent reporters
      { type: 'gene', name: 'GFP', subType: 'Green Fluorescent Protein', color: '#50c878', geneClass: 'reporter' },
      { type: 'gene', name: 'RFP', subType: 'Red Fluorescent Protein', color: '#50c878', geneClass: 'reporter' },
      { type: 'gene', name: 'BFP', subType: 'Blue Fluorescent Protein', color: '#50c878', geneClass: 'reporter' },
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
  {
    id: 'rbs',
    name: 'RBS',
    components: [
      { type: 'rbs', name: 'RBS1', subType: 'Standard RBS', color: '#9b59b6', rbsStrength: 1.0 },
      { type: 'rbs', name: 'RBS2', subType: 'Strong RBS', color: '#9b59b6', rbsStrength: 2.0 },
      { type: 'rbs', name: 'RBS3', subType: 'Weak RBS', color: '#9b59b6', rbsStrength: 0.5 },
    ],
  },
  // Intentionally omitted for now: regulators/riboswitch/test-part
]

const customPromoters: PartTemplate[] = []
const customGenes: PartTemplate[] = []

function allTemplates(): PartTemplate[] {
  return [
    ...baseComponentCategories.flatMap((c) => c.components),
    ...customPromoters,
    ...customGenes,
  ]
}

export function registerCustomPromoter(t: PartTemplate) {
  customPromoters.push({ ...t, type: 'promoter' })
}

export function registerCustomGene(t: PartTemplate) {
  customGenes.push({ ...t, type: 'gene' })
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
  }
}


