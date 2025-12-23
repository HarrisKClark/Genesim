import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './Header'
import CircuitCanvas from './CircuitCanvas'
import ComponentLibrary from './ComponentLibrary'
import ResultsPanel from './ResultsPanel'
import SettingsPanel from './SettingsPanel'
import './Layout.css'
import PartContextMenu, { PartContextMenuState, PartRef } from './PartContextMenu'
import SavedCircuitsDialog from './SavedCircuitsDialog'
import { DNA_LENGTH } from '../constants/circuitConstants'
import { CircuitComponent } from '../types/dnaTypes'
import { CircuitFileV1, loadDraft, saveDraft } from '../utils/circuitPersistence'

export default function Layout() {
  const [showResults, setShowResults] = useState(false)
  const [circuitData, setCircuitData] = useState<CircuitComponent[] | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [zoomSensitivity, setZoomSensitivity] = useState(0.5) // Default to less sensitive
  const [fileName, setFileName] = useState('Untitled Circuit')
  const [currentCircuitId, setCurrentCircuitId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save')
  const [partMenu, setPartMenu] = useState<PartContextMenuState | null>(null)
  
  // Operon analysis state
  const [showOperonHighlights, setShowOperonHighlights] = useState(false)
  const [selectedOperonId, setSelectedOperonId] = useState<string | null>(null)
  const [circuitAnalysis, setCircuitAnalysis] = useState<any>(null)

  const autosaveTimer = useRef<number | null>(null)

  const componentsForPersistence = useMemo(() => circuitData ?? [], [circuitData])

  // Auto-restore draft on first mount
  useEffect(() => {
    ;(async () => {
      const draft = await loadDraft().catch(() => null)
      if (draft?.components?.length) {
        setCircuitData(draft.components)
        setFileName(draft.name === 'Draft' ? 'Untitled Circuit' : draft.name)
        setCurrentCircuitId(null)
        setDirty(false)
      }
    })()
  }, [])

  // Debounced autosave draft on changes
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      saveDraft(DNA_LENGTH, componentsForPersistence).catch(() => {})
    }, 500)
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [componentsForPersistence])

  const openPartMenu = (e: React.MouseEvent, part: PartRef) => {
    e.preventDefault()
    e.stopPropagation()
    setPartMenu({
      x: e.clientX,
      y: e.clientY,
      part,
    })
  }

  const handleNewCircuit = () => {
    if (dirty && componentsForPersistence.length > 0) {
      const yes = window.confirm('Discard unsaved changes and start a new circuit?')
      if (!yes) return
    }
    setCircuitData([])
    setFileName('Untitled Circuit')
    setCurrentCircuitId(null)
    setDirty(false)
    setSelectedOperonId(null)
  }

  const handleOpenSave = () => {
    setSaveLoadMode('save')
    setSaveLoadOpen(true)
  }

  const handleOpenLoad = () => {
    if (dirty && componentsForPersistence.length > 0) {
      const yes = window.confirm('You have unsaved changes. Continue to load anyway?')
      if (!yes) return
    }
    setSaveLoadMode('load')
    setSaveLoadOpen(true)
  }

  const handleLoaded = (rec: CircuitFileV1) => {
    setCircuitData(rec.components ?? [])
    setFileName(rec.name ?? 'Untitled Circuit')
    setCurrentCircuitId(rec.id)
    setDirty(false)
    setSelectedOperonId(null)
  }

  const handleSaved = (rec: CircuitFileV1) => {
    setFileName(rec.name ?? fileName)
    setCurrentCircuitId(rec.id)
    setDirty(false)
  }

  return (
    <div className="layout">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onNewCircuit={handleNewCircuit}
        onLoadCircuit={handleOpenLoad}
        onSaveCircuit={handleOpenSave}
      />
      <div className="layout-content">
        <ComponentLibrary 
          operons={circuitAnalysis?.operons || []}
          validationResult={circuitAnalysis?.validationResult || null}
          selectedOperonId={selectedOperonId}
          showOperonHighlights={showOperonHighlights}
          onOperonSelect={setSelectedOperonId}
          onHighlightToggle={setShowOperonHighlights}
          onPartContextMenu={openPartMenu}
          onSimulationClick={() => setShowResults(true)}
        />
        <div className="main-canvas-area">
          <CircuitCanvas 
            onCircuitChange={(data) => {
              setCircuitData(data)
              setDirty(true)
            }}
            circuitData={circuitData}
            zoomSensitivity={zoomSensitivity}
            fileName={fileName}
            showOperonHighlights={showOperonHighlights}
            selectedOperonId={selectedOperonId}
            onOperonClick={setSelectedOperonId}
            onAnalysisUpdate={setCircuitAnalysis}
            onPartContextMenu={openPartMenu}
          />
          {showResults && (
            <ResultsPanel 
              onClose={() => setShowResults(false)}
              circuitData={circuitData}
            />
          )}
        </div>
      </div>
      {!showResults && (
        <button 
          className="results-toggle"
          onClick={() => setShowResults(true)}
        >
          Simulation
        </button>
      )}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        zoomSensitivity={zoomSensitivity}
        onZoomSensitivityChange={setZoomSensitivity}
      />
      <SavedCircuitsDialog
        isOpen={saveLoadOpen}
        mode={saveLoadMode}
        currentName={fileName}
        currentComponents={componentsForPersistence}
        currentDnaLength={DNA_LENGTH}
        currentCircuitId={currentCircuitId}
        onClose={() => setSaveLoadOpen(false)}
        onLoaded={handleLoaded}
        onSaved={handleSaved}
      />
      <PartContextMenu menu={partMenu} onClose={() => setPartMenu(null)} />
    </div>
  )
}

