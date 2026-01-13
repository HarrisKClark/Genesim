import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './Header'
import CircuitCanvas from './CircuitCanvas'
import ComponentLibrary from './ComponentLibrary'
import ResultsPanel from './ResultsPanel'
import SettingsPanel from './SettingsPanel'
import './Layout.css'
import PartContextMenu, { PartContextMenuState, PartRef } from './PartContextMenu'
import SavedCircuitsDialog from './SavedCircuitsDialog'
import BackboneEditorDialog from './BackboneEditorDialog'
import NewCellDialog from './NewCellDialog'
import NewPlasmidDialog from './NewPlasmidDialog'
import CellEditorDialog from './CellEditorDialog'
import DownloadDialog from './DownloadDialog'
import { DNA_LENGTH, generateDNA } from '../constants/circuitConstants'
import { CircuitComponent } from '../types/dnaTypes'
import { CircuitFileV1, loadDraft, saveDraft } from '../utils/circuitPersistence'
import { exportCustomParts, importCustomParts } from '../utils/partLibrary'
import type { BackboneSpec } from '../types/backboneTypes'
import { theme as themeColors } from '../utils/themeUtils'

const DEFAULT_BACKBONE: BackboneSpec = {
  copyNumber: 10,
  originName: 'ColE1',
  resistances: [{ code: 'Cm', name: 'Chloramphenicol' }],
}

const DEFAULT_CELL_TYPE = 'MG1655'
const DEFAULT_CELL_NAME = 'Cell'

type CultureCell = {
  id: string
  cellType: string
  cellName: string
  circuits: Array<{
    id: string
    backbone: BackboneSpec
    components: CircuitComponent[]
    dnaLength: number
    dnaSequence: string[]
  }>
  activeCircuitIndex: number
}

function uuid() {
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function cloneComponents(arr: any): CircuitComponent[] {
  if (!Array.isArray(arr)) return []
  return (arr as any[]).map((c) => ({
    ...(c as any),
    sequence: Array.isArray((c as any).sequence) ? ([...(c as any).sequence] as any) : (c as any).sequence,
  }))
}

function createDefaultCell(cellNumber: number): CultureCell {
  return {
    id: uuid(),
    cellType: DEFAULT_CELL_TYPE,
    cellName: `${DEFAULT_CELL_NAME}${Math.max(1, Math.round(cellNumber || 1))}`,
    circuits: [{ id: uuid(), backbone: DEFAULT_BACKBONE, components: [], dnaLength: DNA_LENGTH, dnaSequence: generateDNA(DNA_LENGTH) }],
    activeCircuitIndex: 0,
  }
}

export default function Layout() {
  const [showResults, setShowResults] = useState(false)
  const [cells, setCells] = useState<CultureCell[]>([])
  const [activeCellId, setActiveCellId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [zoomSensitivity, setZoomSensitivity] = useState(0.5) // Default to less sensitive
  const [theme, setTheme] = useState<'light' | 'dark' | 'iluvatar'>(() => {
    // Load from localStorage on initial render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('genesim-theme')
      if (saved === 'dark' || saved === 'iluvatar') return saved
    }
    return 'light'
  })
  const [fileName, setFileName] = useState('Untitled Circuit')
  const [currentCircuitId, setCurrentCircuitId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const activeCell = useMemo(
    () => (activeCellId ? cells.find((c) => c.id === activeCellId) : undefined) ?? cells[0],
    [cells, activeCellId]
  )
  const activeBackbone = activeCell?.circuits?.[activeCell.activeCircuitIndex]?.backbone ?? DEFAULT_BACKBONE
  const [backboneEditorOpen, setBackboneEditorOpen] = useState(false)
  const [newCellOpen, setNewCellOpen] = useState(false)
  const [newPlasmidOpen, setNewPlasmidOpen] = useState(false)
  const [newPlasmidTargetCellId, setNewPlasmidTargetCellId] = useState<string | null>(null)
  const [editCellId, setEditCellId] = useState<string | null>(null)
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [partMenu, setPartMenu] = useState<PartContextMenuState | null>(null)

  const nextCellNumber = useMemo(() => (cells?.length ?? 0) + 1, [cells])

  // Persist theme preference and apply to document root
  const handleThemeChange = (value: 'light' | 'dark' | 'iluvatar') => {
    setTheme(value)
    localStorage.setItem('genesim-theme', value)
  }
  
  // Apply theme class to document.documentElement so CSS variables are accessible globally
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark-mode', 'iluvatar-mode')
    if (theme === 'dark') {
      root.classList.add('dark-mode')
    } else if (theme === 'iluvatar') {
      root.classList.add('iluvatar-mode')
    }
  }, [theme])
  
  // Compute theme class
  const themeClass = theme === 'dark' ? 'dark-mode' : theme === 'iluvatar' ? 'iluvatar-mode' : ''
  
  // Operon analysis state
  const [showOperonHighlights, setShowOperonHighlights] = useState(false)
  const [selectedOperonId, setSelectedOperonId] = useState<string | null>(null)
  const [circuitAnalysis, setCircuitAnalysis] = useState<any>(null)

  const autosaveTimer = useRef<number | null>(null)

  // Runtime migration: ensure every plasmid has its own background DNA.
  // This prevents older in-memory states (or older saves) from sharing DNA across plasmids.
  useEffect(() => {
    setCells((prev) => {
      let changed = false
      const next = prev.map((c) => {
        const nextCircuits = c.circuits.map((p) => {
          const dnaLen = Number((p as any).dnaLength ?? DNA_LENGTH)
          const dnaSeq = Array.isArray((p as any).dnaSequence) ? ((p as any).dnaSequence as string[]) : generateDNA(dnaLen)
          if ((p as any).dnaLength !== dnaLen || (p as any).dnaSequence !== dnaSeq) {
            // Only consider as changed when fields were missing/invalid, not when already present.
            if (!(p as any).dnaSequence || !(p as any).dnaLength) changed = true
            return { ...(p as any), dnaLength: dnaLen, dnaSequence: dnaSeq } as any
          }
          return p
        })
        if (nextCircuits !== c.circuits) {
          return { ...c, circuits: nextCircuits }
        }
        return c
      })
      return changed ? (next as any) : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeComponents = useMemo(() => {
    const cell = activeCell ?? cells[0]
    const idx = cell?.activeCircuitIndex ?? 0
    return cell?.circuits?.[idx]?.components ?? []
  }, [activeCell, cells])

  // Auto-restore draft on first mount
  useEffect(() => {
    ;(async () => {
      const draft = await loadDraft().catch(() => null)
      if (
        (draft?.cultureCells?.length ?? 0) > 0 ||
        (draft?.cellCircuits?.length ?? 0) > 0 ||
        (draft?.components?.length ?? 0) > 0
      ) {
        if (!draft) return
        importCustomParts(draft.customParts)
        let nextCells: CultureCell[] | null = null
        if (draft.cultureCells && draft.cultureCells.length > 0) {
          nextCells = draft.cultureCells.map((c, idx) => ({
            id: uuid(),
            cellType: c.cellType || DEFAULT_CELL_TYPE,
            cellName: c.cellName || `${DEFAULT_CELL_NAME}${idx + 1}`,
            circuits: (() => {
              // Backward-compatible: allow older shapes.
              // - New shape: circuits = [{ id, backbone, components, dnaLength?, dnaSequence? }]
              // - Old shape: circuits = CircuitComponent[][]
              const maybeCircuits: any = (c as any).circuits
              const cellBackbone = (c as any).backbone ?? DEFAULT_BACKBONE
              if (Array.isArray(maybeCircuits) && maybeCircuits.length > 0 && maybeCircuits[0] && 'components' in maybeCircuits[0]) {
                return (maybeCircuits as any[]).map((p) => {
                  const dnaLen = Number(p.dnaLength ?? DNA_LENGTH)
                  const dnaSeq = Array.isArray(p.dnaSequence) ? (p.dnaSequence as string[]) : generateDNA(dnaLen)
                  return {
                    id: String(p.id ?? uuid()),
                    backbone: (p.backbone ?? cellBackbone) as BackboneSpec,
                    components: cloneComponents(p.components ?? []),
                    dnaLength: dnaLen,
                    dnaSequence: dnaSeq,
                  }
                })
              }
              if (Array.isArray(maybeCircuits)) {
                return (maybeCircuits as CircuitComponent[][]).map((arr) => ({
                  id: uuid(),
                  backbone: cellBackbone,
                  components: cloneComponents(arr ?? []),
                  dnaLength: DNA_LENGTH,
                  dnaSequence: generateDNA(DNA_LENGTH),
                }))
              }
              return [{ id: uuid(), backbone: cellBackbone, components: [], dnaLength: DNA_LENGTH, dnaSequence: generateDNA(DNA_LENGTH) }]
            })(),
            activeCircuitIndex: 0,
          }))
        } else {
          const circuits =
            draft.cellCircuits && draft.cellCircuits.length > 0 ? draft.cellCircuits : [draft.components ?? []]
          nextCells = [
            {
              ...createDefaultCell((cells?.length ?? 0) + 1),
              circuits: circuits.map((arr) => ({
                id: uuid(),
                backbone: draft.backbone ?? DEFAULT_BACKBONE,
                components: cloneComponents(arr ?? []),
                dnaLength: (draft.dnaLength ?? DNA_LENGTH) as number,
                dnaSequence: Array.isArray((draft as any).dnaSequence) ? ((draft as any).dnaSequence as string[]) : generateDNA((draft.dnaLength ?? DNA_LENGTH) as number),
              })),
              activeCircuitIndex: 0,
            },
          ]
        }
        setCells(nextCells)
        setActiveCellId(nextCells[0].id)
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
      const cultureCells: CircuitFileV1['cultureCells'] = cells.map((c) => ({
        cellType: c.cellType,
        cellName: c.cellName,
          circuits: c.circuits.map((p) => ({
            id: p.id,
            backbone: p.backbone,
            components: p.components,
            dnaLength: p.dnaLength,
            dnaSequence: p.dnaSequence,
          })) as any,
        activeCircuitIndex: c.activeCircuitIndex,
      }))
      // saveDraft signature: (dnaLength, components, dnaSequence?, customParts?, backbone?, cellCircuits?, cultureCells?)
      saveDraft(DNA_LENGTH, activeComponents, undefined, exportCustomParts(), activeBackbone, undefined, cultureCells).catch(() => {})
    }, 500)
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [activeComponents, activeBackbone, cells])

  const openPartMenu = (e: React.MouseEvent, part: PartRef) => {
    e.preventDefault()
    e.stopPropagation()
    setPartMenu({
      x: e.clientX,
      y: e.clientY,
      part,
    })
  }

  const handleNewProject = () => {
    if (dirty && activeComponents.length > 0) {
      const yes = window.confirm('Discard unsaved changes and start a new circuit?')
      if (!yes) return
    }
    setCells([])
    setActiveCellId(null)
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
    if (dirty && activeComponents.length > 0) {
      const yes = window.confirm('You have unsaved changes. Continue to load anyway?')
      if (!yes) return
    }
    setSaveLoadMode('load')
    setSaveLoadOpen(true)
  }

  const handleLoaded = (rec: CircuitFileV1) => {
    importCustomParts(rec.customParts)
    let nextCells: CultureCell[] = []
    if (rec.cultureCells && rec.cultureCells.length > 0) {
      nextCells = rec.cultureCells.map((c, idx) => {
        const cellBackbone = (c as any).backbone ?? rec.backbone ?? DEFAULT_BACKBONE
        const rawCircuits: any = (c as any).circuits
        let circuits: CultureCell['circuits'] = [
          { id: uuid(), backbone: cellBackbone, components: [], dnaLength: DNA_LENGTH, dnaSequence: generateDNA(DNA_LENGTH) },
        ]
        if (Array.isArray(rawCircuits) && rawCircuits.length > 0) {
          if (rawCircuits[0] && typeof rawCircuits[0] === 'object' && 'components' in rawCircuits[0]) {
            circuits = (rawCircuits as any[]).map((p) => {
              const dnaLen = Number(p.dnaLength ?? DNA_LENGTH)
              const dnaSeq = Array.isArray(p.dnaSequence) ? (p.dnaSequence as string[]) : generateDNA(dnaLen)
              return {
                id: String(p.id ?? uuid()),
                backbone: (p.backbone ?? cellBackbone) as BackboneSpec,
                components: cloneComponents(p.components ?? []),
                dnaLength: dnaLen,
                dnaSequence: dnaSeq,
              }
            })
          } else {
            // old shape: CircuitComponent[][]
            circuits = (rawCircuits as CircuitComponent[][]).map((arr) => ({
              id: uuid(),
              backbone: cellBackbone,
              components: cloneComponents(arr ?? []),
              dnaLength: DNA_LENGTH,
              dnaSequence: generateDNA(DNA_LENGTH),
            }))
          }
        }
        const activeCircuitIndex = Math.max(0, Math.min(circuits.length - 1, Number((c as any).activeCircuitIndex ?? 0)))
        return {
          id: uuid(),
          cellType: (c as any).cellType || DEFAULT_CELL_TYPE,
          cellName: (c as any).cellName || `${DEFAULT_CELL_NAME}${idx + 1}`,
          circuits,
          activeCircuitIndex,
        }
      })
    } else {
      const legacy = rec.cellCircuits && rec.cellCircuits.length > 0 ? rec.cellCircuits : [rec.components ?? []]
      const first = createDefaultCell(1)
      nextCells = [
        {
          ...first,
          circuits: legacy.map((arr) => ({
            id: uuid(),
            backbone: rec.backbone ?? DEFAULT_BACKBONE,
            components: cloneComponents(arr ?? []),
            dnaLength: (rec.dnaLength ?? DNA_LENGTH) as number,
            dnaSequence: Array.isArray((rec as any).dnaSequence) ? ((rec as any).dnaSequence as string[]) : generateDNA((rec.dnaLength ?? DNA_LENGTH) as number),
          })),
          activeCircuitIndex: 0,
        },
      ]
    }
    setCells(nextCells)
    setActiveCellId(nextCells[0]?.id ?? null)
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
    <div className={`layout ${themeClass}`}>
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onNewCircuit={handleNewProject}
        onLoadCircuit={handleOpenLoad}
        onSaveCircuit={handleOpenSave}
        onDownload={() => setDownloadOpen(true)}
      />
      <div className="layout-content">
        <ComponentLibrary 
          cultureCells={cells}
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
          {cells.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: themeColors.bgPrimary,
                fontFamily: 'Courier New, monospace',
                gap: 24,
                padding: 40,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: themeColors.textSecondary }}>Welcome to GeneSim</div>
              <div style={{ fontSize: 14, color: themeColors.textMuted, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                Start by adding a cell to your culture. Each cell can contain one or more plasmids with genetic circuits.
              </div>
              <button
                onClick={() => setNewCellOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 28px',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: 'Courier New, monospace',
                  background: themeColors.accentPrimary,
                  color: themeColors.textOnAccent,
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  boxShadow: `0 4px 12px ${themeColors.shadowColor}`,
                  transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = `0 6px 16px ${themeColors.shadowColor}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 4px 12px ${themeColors.shadowColor}`
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                <span>Add Your First Cell</span>
              </button>
              <div style={{ fontSize: 11, color: themeColors.textHint, marginTop: 8 }}>
                Or load an existing project from the File menu
              </div>
            </div>
          ) : (
          <CircuitCanvas
            onCircuitChange={(data) => {
              if (!activeCellId) return
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== activeCellId) return c
                  const nextCircuits = c.circuits.map((p, i) =>
                    i === c.activeCircuitIndex ? { ...p, components: data } : p
                  )
                  return { ...c, circuits: nextCircuits }
                })
              )
              setDirty(true)
            }}
            onCircuitChangeForPlasmid={(cellId, plasmidIndex, data) => {
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cellId) return c
                  const nextCircuits = c.circuits.map((p, i) =>
                    i === plasmidIndex ? { ...p, components: data } : p
                  )
                  return { ...c, circuits: nextCircuits }
                })
              )
              setDirty(true)
            }}
            circuitData={activeComponents}
            zoomSensitivity={zoomSensitivity}
            fileName={fileName}
            // active cell props
            backbone={activeBackbone}
            onEditBackbone={() => setBackboneEditorOpen(true)}
            cellType={activeCell?.cellType}
            cellName={activeCell?.cellName}
            onAddCircuitInCell={() => {
              if (!activeCellId) return
              setNewPlasmidTargetCellId(activeCellId)
              setNewPlasmidOpen(true)
            }}
            onAddCircuitInCellForCell={(cellId) => {
              setActiveCellId(cellId)
              setNewPlasmidTargetCellId(cellId)
              setNewPlasmidOpen(true)
            }}
            // culture props for rendering & activation
            cultureCells={cells}
            activeCellId={activeCellId ?? undefined}
            onActivateCell={(id) => setActiveCellId(id)}
            onActivatePlasmid={(cellId, plasmidIndex) => {
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cellId) return c
                  const maxIdx = Math.max(0, (c.circuits?.length ?? 1) - 1)
                  const nextIdx = Math.max(0, Math.min(maxIdx, plasmidIndex))
                  if (c.activeCircuitIndex === nextIdx) return c
                  return { ...c, activeCircuitIndex: nextIdx }
                })
              )
            }}
            onPlasmidDnaChange={(cellId, plasmidIndex, dnaSequence, dnaLength) => {
              let changed = false
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cellId) return c
                  const idx = Math.max(0, Math.min((c.circuits?.length ?? 1) - 1, plasmidIndex))
                  const p = c.circuits[idx]
                  if (!p) return c
                  if (p.dnaLength === dnaLength && p.dnaSequence === dnaSequence) return c
                  changed = true
                  const nextCircuits = c.circuits.map((pp, i) =>
                    i === idx ? { ...pp, dnaLength, dnaSequence } : pp
                  )
                  return { ...c, circuits: nextCircuits }
                })
              )
              if (changed) setDirty(true)
            }}
            onAddCell={() => {
              setNewCellOpen(true)
            }}
            onDeleteCell={(id) => {
              setCells((prev) => {
                if (prev.length <= 1) return prev
                const next = prev.filter((c) => c.id !== id)
                // If we deleted the active cell, pick the first remaining.
                if (id === activeCellId) setActiveCellId(next[0]?.id ?? null)
                return next.length ? next : prev
              })
              setDirty(true)
            }}
            onDeletePlasmid={(cellId, plasmidId) => {
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cellId) return c
                  if ((c.circuits?.length ?? 0) <= 1) {
                    // Keep at least one plasmid slot per cell.
                    return c
                  }
                  const nextCircuits = (c.circuits ?? []).filter((p) => p.id !== plasmidId)
                  const nextActive = Math.max(0, Math.min(nextCircuits.length - 1, c.activeCircuitIndex))
                  return { ...c, circuits: nextCircuits, activeCircuitIndex: nextActive }
                })
              )
              setDirty(true)
            }}
            onEditCell={(cellId) => {
              setEditCellId(cellId)
            }}
            showOperonHighlights={showOperonHighlights}
            selectedOperonId={selectedOperonId}
            onOperonClick={setSelectedOperonId}
            onAnalysisUpdate={setCircuitAnalysis}
            onPartContextMenu={openPartMenu}
          />
          )}
          {showResults && (
            <ResultsPanel 
              onClose={() => setShowResults(false)}
              circuitData={activeComponents}
              cultureCells={cells}
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
        theme={theme}
        onThemeChange={handleThemeChange}
      />
      <SavedCircuitsDialog
        isOpen={saveLoadOpen}
        mode={saveLoadMode}
        currentName={fileName}
        currentComponents={activeComponents}
        currentCultureCells={cells.map((c) => ({
          cellType: c.cellType,
          cellName: c.cellName,
          circuits: c.circuits,
          activeCircuitIndex: c.activeCircuitIndex,
        }))}
        currentBackbone={activeBackbone}
        currentDnaLength={DNA_LENGTH}
        currentCircuitId={currentCircuitId}
        onClose={() => setSaveLoadOpen(false)}
        onLoaded={handleLoaded}
        onSaved={handleSaved}
      />
      <NewCellDialog
        isOpen={newCellOpen}
        defaultCellType={DEFAULT_CELL_TYPE}
        defaultCellName={`${DEFAULT_CELL_NAME}${nextCellNumber}`}
        defaultBackbone={DEFAULT_BACKBONE}
        onCreate={({ cellType, cellName, backbone }) => {
          const cell: CultureCell = {
            id: uuid(),
            cellType,
            cellName,
            circuits: [{ id: uuid(), backbone, components: [], dnaLength: DNA_LENGTH, dnaSequence: generateDNA(DNA_LENGTH) }],
            activeCircuitIndex: 0,
          }
          setCells((prev) => [...prev, cell])
          setActiveCellId(cell.id)
          setDirty(true)
        }}
        onClose={() => setNewCellOpen(false)}
      />
      <NewPlasmidDialog
        isOpen={newPlasmidOpen}
        defaultBackbone={DEFAULT_BACKBONE}
        onCreate={(bb) => {
          const targetId = newPlasmidTargetCellId ?? activeCellId
          if (!targetId) return
          setCells((prev) =>
            prev.map((c) =>
              c.id !== targetId
                ? c
                : {
                    ...c,
                    circuits: [...c.circuits, { id: uuid(), backbone: bb, components: [], dnaLength: DNA_LENGTH, dnaSequence: generateDNA(DNA_LENGTH) }],
                    activeCircuitIndex: c.activeCircuitIndex + 1,
                  }
            )
          )
          setDirty(true)
          setNewPlasmidTargetCellId(null)
        }}
        onClose={() => {
          setNewPlasmidOpen(false)
          setNewPlasmidTargetCellId(null)
        }}
      />
      <BackboneEditorDialog
        isOpen={backboneEditorOpen}
        value={activeBackbone}
        onChange={(next) => {
          if (!activeCellId) return
          setCells((prev) =>
            prev.map((c) => {
              if (c.id !== activeCellId) return c
              const idx = c.activeCircuitIndex
              const circuits = c.circuits.map((p, i) => (i === idx ? { ...p, backbone: next } : p))
              return { ...c, circuits }
            })
          )
          setDirty(true)
        }}
        onClose={() => setBackboneEditorOpen(false)}
      />
      <CellEditorDialog
        isOpen={!!editCellId}
        cellType={cells.find((c) => c.id === editCellId)?.cellType ?? DEFAULT_CELL_TYPE}
        cellName={cells.find((c) => c.id === editCellId)?.cellName ?? `${DEFAULT_CELL_NAME}${nextCellNumber}`}
        onSave={({ cellType, cellName }) => {
          const id = editCellId
          if (!id) return
          setCells((prev) => prev.map((c) => (c.id === id ? { ...c, cellType, cellName } : c)))
          setDirty(true)
        }}
        onClose={() => setEditCellId(null)}
      />
      <DownloadDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        cultureCells={cells.map((c) => ({
          id: c.id,
          cellType: c.cellType,
          cellName: c.cellName,
          circuits: c.circuits.map((p) => ({
            id: p.id,
            backbone: p.backbone,
            components: p.components,
            dnaLength: p.dnaLength,
          })),
        }))}
      />
      <PartContextMenu menu={partMenu} onClose={() => setPartMenu(null)} />
    </div>
  )
}

