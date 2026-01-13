import { useEffect, useMemo, useState } from 'react'
import { useDrag } from 'react-dnd'
import './ComponentLibrary.css'
import OperonAnalysisPanel from './Analysis/OperonAnalysisPanel'
import { Operon, ValidationResult } from '../models/CircuitModel'
import { getComponentCategories, subscribePartLibrary } from '../utils/partLibrary'
import CustomPromoterDialog from './CustomPromoterDialog'

interface ComponentItemProps {
  type: string
  name: string
  subType?: string
  color: string
  onContextMenu?: (e: React.MouseEvent) => void
}

function ComponentItem({ type, name, subType, color, onContextMenu }: ComponentItemProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'circuit-component',
    item: { type, name, subType },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [type, name, subType])  // Dependencies ensure item updates when part changes

  return (
    <div
      ref={drag}
      className={`component-item ${isDragging ? 'dragging' : ''}`}
      style={{ borderColor: color }}
      onContextMenu={onContextMenu}
    >
      <div className="component-color-bar" style={{ backgroundColor: color }} />
      <span className="component-name">{name}</span>
      {subType && <span className="component-subtype">{subType}</span>}
    </div>
  )
}

import { CircuitComponent } from '../types/dnaTypes'

// Culture cell type for multi-cell analysis
interface CultureCell {
  id: string
  cellType: string
  cellName: string
  circuits: Array<{
    id: string
    components: CircuitComponent[]
    dnaLength?: number
  }>
}

interface ComponentLibraryProps {
  // Culture data for multi-cell/plasmid analysis
  cultureCells?: CultureCell[]
  // Legacy single-plasmid props (fallback)
  operons?: Operon[]
  validationResult?: ValidationResult | null
  selectedOperonId?: string | null
  showOperonHighlights?: boolean
  onOperonSelect?: (operonId: string | null) => void
  onHighlightToggle?: (show: boolean) => void
  onPartContextMenu?: (e: React.MouseEvent, part: { source: 'library'; type: string; name: string; subType?: string; color: string }) => void
  onSimulationClick?: () => void
}

export default function ComponentLibrary({
  cultureCells = [],
  operons = [],
  validationResult = null,
  selectedOperonId = null,
  showOperonHighlights = false,
  onOperonSelect = () => {},
  onHighlightToggle = () => {},
  onPartContextMenu,
}: ComponentLibraryProps) {
  const [mainTab, setMainTab] = useState<'parts' | 'analysis' | 'circuits' | 'cells'>('parts')
  const [activePartCategory, setActivePartCategory] = useState<string>('promoter')
  const [geneTab, setGeneTab] = useState<'reporter' | 'activator' | 'repressor'>('reporter')
  const [promoterTab, setPromoterTab] = useState<'constitutive' | 'regulated' | 'inducible'>('constitutive')
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [libraryRevision, setLibraryRevision] = useState(0)

  useEffect(() => {
    return subscribePartLibrary(() => setLibraryRevision((v) => v + 1))
  }, [])

  const componentCategories = useMemo(() => {
    // Recompute when custom parts are created (session-only store)
    return getComponentCategories()
  }, [libraryRevision])
  const activeCategory = componentCategories.find(cat => cat.id === activePartCategory) || componentCategories[0]
  const visibleComponents = (() => {
    if (activeCategory.id === 'gene') {
      return activeCategory.components.filter((c) => (c.geneClass || 'reporter') === geneTab)
    }
    if (activeCategory.id === 'promoter') {
      return activeCategory.components.filter((c) => (c.promoterClass || 'regulated') === promoterTab)
    }
    return activeCategory.components
  })()

  return (
    <div className="component-library">
      {/* Main tabs */}
      <div className="main-tabs">
        <button
          className={`main-tab ${mainTab === 'parts' ? 'active' : ''}`}
          onClick={() => setMainTab('parts')}
        >
          Parts
        </button>
        <button
          className={`main-tab ${mainTab === 'circuits' ? 'active' : ''}`}
          onClick={() => setMainTab('circuits')}
        >
          Circuits
        </button>
        <button
          className={`main-tab ${mainTab === 'cells' ? 'active' : ''}`}
          onClick={() => setMainTab('cells')}
        >
          Cells
        </button>
        <button
          className={`main-tab ${mainTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setMainTab('analysis')}
        >
          Analysis
        </button>
      </div>

      {mainTab === 'parts' ? (
        <>
          {/* Part category tabs */}
          <div className="component-tabs">
            {componentCategories.map((category) => (
              <button
                key={category.id}
                className={`component-tab ${activePartCategory === category.id ? 'active' : ''}`}
                onClick={() => setActivePartCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="component-content">
            {activeCategory.id === 'promoter' && (
              <div className="component-tabs" style={{ marginTop: 0, borderTop: 'none' }}>
                <button
                  className={`component-tab ${promoterTab === 'constitutive' ? 'active' : ''}`}
                  onClick={() => setPromoterTab('constitutive')}
                >
                  Constitutive
                </button>
                <button
                  className={`component-tab ${promoterTab === 'regulated' ? 'active' : ''}`}
                  onClick={() => setPromoterTab('regulated')}
                >
                  Regulated
                </button>
                <button
                  className={`component-tab ${promoterTab === 'inducible' ? 'active' : ''}`}
                  onClick={() => setPromoterTab('inducible')}
                >
                  Inducible
                </button>
              </div>
            )}
            {activeCategory.id === 'gene' && (
              <div className="component-tabs" style={{ marginTop: 0, borderTop: 'none' }}>
                <button
                  className={`component-tab ${geneTab === 'reporter' ? 'active' : ''}`}
                  onClick={() => setGeneTab('reporter')}
                >
                  Reporters
                </button>
                <button
                  className={`component-tab ${geneTab === 'activator' ? 'active' : ''}`}
                  onClick={() => setGeneTab('activator')}
                >
                  Activators
                </button>
                <button
                  className={`component-tab ${geneTab === 'repressor' ? 'active' : ''}`}
                  onClick={() => setGeneTab('repressor')}
                >
                  Repressors
                </button>
              </div>
            )}
            <div className="component-grid">
              {visibleComponents.map((comp) => (
                <ComponentItem
                  key={`${comp.type}-${comp.name}`}
                  type={comp.type}
                  name={comp.name}
                  subType={comp.subType}
                  color={comp.color}
                  onContextMenu={
                    onPartContextMenu
                      ? (e) => onPartContextMenu(e, { source: 'library', type: comp.type, name: comp.name, subType: comp.subType, color: comp.color })
                      : undefined
                  }
                />
              ))}

              {activeCategory.id === 'promoter' && (
                <div
                  className="component-item add-custom-part"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setCustomDialogOpen(true)}
                  title="Add custom promoter"
                >
                  <span className="add-custom-part-icon">+</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : mainTab === 'analysis' ? (
        <OperonAnalysisPanel
          cultureCells={cultureCells}
          operons={operons}
          validationResult={validationResult}
          selectedOperonId={selectedOperonId}
          showHighlights={showOperonHighlights}
          onOperonSelect={onOperonSelect}
          onHighlightToggle={onHighlightToggle}
        />
      ) : mainTab === 'circuits' ? (
        <div className="component-content">
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            Circuits
          </div>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            This tab will hold circuit management tools (new/load/save, templates, etc.).
          </div>
        </div>
      ) : (
        <div className="component-content">
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            Cells
          </div>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            This tab will hold cell context (chassis, growth conditions, plasmid copy number effects, etc.).
          </div>
        </div>
      )}

      <CustomPromoterDialog
        isOpen={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        onCreated={() => setLibraryRevision((v) => v + 1)}
      />
    </div>
  )
}
