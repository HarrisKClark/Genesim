import { useMemo, useState } from 'react'
import { useDrag } from 'react-dnd'
import './ComponentLibrary.css'
import OperonAnalysisPanel from './Analysis/OperonAnalysisPanel'
import { Operon, ValidationResult } from '../models/CircuitModel'
import { getComponentCategories } from '../utils/partLibrary'
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
  }))

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

// Props for operon analysis passed from parent
interface AnalysisPanelProps {
  operons: Operon[]
  validationResult: ValidationResult | null
  selectedOperonId: string | null
  showHighlights: boolean
  onOperonSelect: (operonId: string | null) => void
  onHighlightToggle: (show: boolean) => void
}

function AnalysisPanel(props: AnalysisPanelProps) {
  return <OperonAnalysisPanel {...props} />
}

interface ComponentLibraryProps {
  // Operon analysis props
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
  operons = [],
  validationResult = null,
  selectedOperonId = null,
  showOperonHighlights = false,
  onOperonSelect = () => {},
  onHighlightToggle = () => {},
  onPartContextMenu,
}: ComponentLibraryProps) {
  const [mainTab, setMainTab] = useState<'parts' | 'analysis'>('parts')
  const [activePartCategory, setActivePartCategory] = useState<string>('promoter')
  const [geneTab, setGeneTab] = useState<'reporter' | 'activator' | 'repressor'>('reporter')
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [libraryRevision, setLibraryRevision] = useState(0)

  const componentCategories = useMemo(() => {
    // Recompute when custom parts are created (session-only store)
    return getComponentCategories()
  }, [libraryRevision])
  const activeCategory = componentCategories.find(cat => cat.id === activePartCategory) || componentCategories[0]
  const visibleComponents =
    activeCategory.id === 'gene'
      ? activeCategory.components.filter((c) => (c.geneClass || 'reporter') === geneTab)
      : activeCategory.components

  return (
    <div className="component-library">
      {/* Main tabs: Parts vs Analysis */}
      <div className="main-tabs">
        <button
          className={`main-tab ${mainTab === 'parts' ? 'active' : ''}`}
          onClick={() => setMainTab('parts')}
        >
          Parts
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
              {visibleComponents.map((comp, idx) => (
                <ComponentItem
                  key={`${comp.type}-${idx}`}
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
                  className="component-item"
                  style={{
                    border: '2px dashed #999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0.9,
                  }}
                  onClick={() => setCustomDialogOpen(true)}
                  title="Add custom promoter"
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#666' }}>+</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <AnalysisPanel
          operons={operons}
          validationResult={validationResult}
          selectedOperonId={selectedOperonId}
          showHighlights={showOperonHighlights}
          onOperonSelect={onOperonSelect}
          onHighlightToggle={onHighlightToggle}
        />
      )}

      <CustomPromoterDialog
        isOpen={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        onCreated={() => setLibraryRevision((v) => v + 1)}
      />
    </div>
  )
}
