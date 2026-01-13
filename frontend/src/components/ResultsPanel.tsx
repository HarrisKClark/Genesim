import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import Plot from 'react-plotly.js'
import './ResultsPanel.css'
import { CircuitModel } from '../models/CircuitModel'
import { DNA_LENGTH } from '../constants/circuitConstants'
import { CircuitComponent } from '../types/dnaTypes'
import { getPartTemplate } from '../utils/partLibrary'

interface ResultsPanelProps {
  onClose: () => void
  circuitData?: any
  cultureCells?: Array<{
    id: string
    cellType: string
    cellName: string
    circuits: Array<{
      id: string
      backbone: any
      components: CircuitComponent[]
    }>
    activeCircuitIndex: number
  }>
}

export default function ResultsPanel({ onClose, circuitData, cultureCells }: ResultsPanelProps) {
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [resultsByCell, setResultsByCell] = useState<
    Array<{ cellId: string; cellType: string; cellName: string; result: any }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [apiBaseUsed, setApiBaseUsed] = useState<string | null>(null)
  const [simMethod, setSimMethod] = useState<'deterministic' | 'stochastic' | 'flow'>('stochastic')
  const [flowRuns, setFlowRuns] = useState<number>(200)
  const [runLength, setRunLength] = useState<number>(1000)
  const [timeStep, setTimeStep] = useState<number>(1)
  const [initialByGene, setInitialByGene] = useState<Record<string, { m0: number; p0: number }>>({})
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [plotReportersOnly, setPlotReportersOnly] = useState<boolean>(false)
  
  // Inducer configuration for inducible promoters
  type InducerFunction = 'constant' | 'sin' | 'pulse' | 'ramp' | 'square'
  interface InducerConfig {
    name: string
    function: InducerFunction
    value: number       // For constant
    baseline: number    // For sin/square/pulse/ramp
    amplitude: number   // For sin/square/pulse
    period: number      // For sin/square/pulse
    duty_cycle: number  // For square/pulse
    slope: number       // For ramp
    delay: number       // Delay before function starts (returns baseline/0 until delay)
  }
  const [inducerConfigs, setInducerConfigs] = useState<Record<string, InducerConfig>>({})
  const [inducerPlotMode, setInducerPlotMode] = useState<'separate' | 'overlay'>('overlay')
  const [showInducerPlot, setShowInducerPlot] = useState<boolean>(true)

  // Detect theme for plot styling
  const plotTheme = useMemo(() => {
    // Check for theme classes on layout element
    const layout = document.querySelector('.layout')
    const isDark = layout?.classList.contains('dark-mode')
    const isIluvatar = layout?.classList.contains('iluvatar-mode')
    
    if (isIluvatar) {
      return {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#e0e0e0', family: 'Courier New, monospace' },
        xaxis: { gridcolor: '#333333', zerolinecolor: '#444444' },
        yaxis: { gridcolor: '#333333', zerolinecolor: '#444444' },
      }
    } else if (isDark) {
      return {
        paper_bgcolor: '#252540',
        plot_bgcolor: '#252540',
        font: { color: '#c8c8d8', family: 'Courier New, monospace' },
        xaxis: { gridcolor: '#3a3a5a', zerolinecolor: '#4a4a6a' },
        yaxis: { gridcolor: '#3a3a5a', zerolinecolor: '#4a4a6a' },
      }
    }
    return {
      paper_bgcolor: '#fff',
      plot_bgcolor: '#fff',
      font: { color: '#333', family: 'Courier New, monospace' },
      xaxis: { gridcolor: '#e0e0e0', zerolinecolor: '#ccc' },
      yaxis: { gridcolor: '#e0e0e0', zerolinecolor: '#ccc' },
    }
  }, [simulationStatus]) // Re-compute when results change

  const cultureTranscriptPreview = useMemo(() => {
    try {
      const cells =
        cultureCells && cultureCells.length > 0
          ? cultureCells
          : [
              {
                id: '__single__',
                cellType: 'MG1655',
                cellName: 'Cell',
                circuits: [{ id: '__single_plasmid__', backbone: null as any, components: (circuitData as CircuitComponent[]) ?? [] }],
                activeCircuitIndex: 0,
              },
            ]

      return cells.map((cell) => {
        const plasmids = cell.circuits ?? []
        const transcripts = plasmids.flatMap((pl) => {
          const comps = pl.components ?? []
          if (!Array.isArray(comps) || comps.length === 0) return []
          const model = new CircuitModel(comps, DNA_LENGTH)
          const sim = model.toSimulationFormat()
          return (sim.operons || [])
            .filter((op) => !!op.terminator && op.genes.length > 0)
            .map((op) => {
              const txId = `${cell.id}:${pl.id}:${op.id}`
              return {
                id: txId,
                promoterName: op.promoter.name,
                promoterStrength: op.promoter.activity ?? op.promoter.strength,
                leak: op.promoter.leak ?? 0.0,
                activatorName: op.promoter.activatorName ?? null,
                actK: op.promoter.actK ?? 10.0,
                actN: op.promoter.actN ?? 2.0,
                inhibitorName: op.promoter.inhibitorName ?? null,
                repK: op.promoter.repK ?? 10.0,
                repN: op.promoter.repN ?? 2.0,
                // Inducible promoter: external small molecule inducer
                inducerName: op.promoter.inducerName ?? null,
                indK: op.promoter.indK ?? 0.5,
                indN: op.promoter.indN ?? 2.0,
                terminatorName: op.terminator?.name ?? null,
                cistrons: op.genes.map((g, idx) => ({
                  id: `${txId}:cistron-${idx}`,
                  geneName: g.name,
                  rbsName: g.rbsName ?? null,
                  rbsStrength: g.rbsStrength,
                })),
              }
            })
        })
        return {
          cellId: cell.id,
          cellType: cell.cellType,
          cellName: cell.cellName,
          transcripts,
        }
      })
    } catch {
      return []
    }
  }, [circuitData, cultureCells])

  const geneEntries = useMemo(() => {
    return (cultureTranscriptPreview || []).flatMap((cell: any) =>
      (cell.transcripts || []).flatMap((tx: any) =>
        (tx.cistrons || []).map((c: any) => ({
          id: c.id as string,
          geneName: c.geneName as string,
          transcriptId: tx.id as string,
          promoterName: tx.promoterName as string,  // Human-readable label
          cellId: cell.cellId as string,
          cellType: cell.cellType as string,
          cellName: cell.cellName as string,
        }))
      )
    )
  }, [cultureTranscriptPreview])

  const reporterGeneNames = useMemo(() => {
    const names = new Set<string>()
    for (const g of geneEntries) {
      const tmpl = getPartTemplate('gene', g.geneName)
      if (tmpl?.geneClass === 'reporter') names.add(g.geneName)
    }
    return names
  }, [geneEntries])

  const isReporterName = (name: string): boolean => {
    if (!name) return false
    if (reporterGeneNames.has(name)) return true
    const tmpl = getPartTemplate('gene', name)
    if (tmpl?.geneClass === 'reporter') return true
    const n = name.toLowerCase()
    return (
      n === 'gfp' ||
      n === 'rfp' ||
      n === 'yfp' ||
      n === 'bfp' ||
      n === 'cfp' ||
      n.includes('mcherry') ||
      n.includes('lacZ'.toLowerCase()) ||
      n.includes('luc')
    )
  }

  const reporterColorFor = (name: string): string | null => {
    if (!name) return null
    const tmpl = getPartTemplate('gene', name)
    if (tmpl?.geneClass === 'reporter' && tmpl.color) return tmpl.color
    const n = name.toLowerCase()
    if (n === 'gfp') return '#2ecc71'
    if (n === 'rfp') return '#e74c3c'
    if (n === 'bfp') return '#3498db'
    if (n === 'yfp') return '#f1c40f'
    if (n === 'cfp') return '#1abc9c'
    if (n.includes('mcherry')) return '#ff2d55'
    if (n.includes('luc')) return '#9b59b6'
    if (n.includes('lacz')) return '#34495e'
    return null
  }

  // Detect inducible promoters and their inducer molecules
  const induciblePromoters = useMemo(() => {
    const inducers = new Map<string, { promoterName: string; inducerName: string }>()
    for (const cell of cultureTranscriptPreview || []) {
      for (const tx of cell.transcripts || []) {
        const promoterName = tx.promoterName as string
        const tmpl = getPartTemplate('promoter', promoterName)
        if (tmpl?.promoterClass === 'inducible' && tmpl.inducerName) {
          // Use inducer name as key to avoid duplicates
          if (!inducers.has(tmpl.inducerName)) {
            inducers.set(tmpl.inducerName, { promoterName, inducerName: tmpl.inducerName })
          }
        }
      }
    }
    return Array.from(inducers.values())
  }, [cultureTranscriptPreview])

  // Initialize inducer configs when inducible promoters change
  useEffect(() => {
    setInducerConfigs((prev) => {
      const next: Record<string, InducerConfig> = {}
      for (const { inducerName } of induciblePromoters) {
        next[inducerName] = prev[inducerName] ?? {
          name: inducerName,
          function: 'constant' as InducerFunction,
          value: 1,
          baseline: 0,
          amplitude: 1,
          period: 100,
          duty_cycle: 0.5,
          slope: 0.01,
          delay: 0,
        }
      }
      return next
    })
  }, [induciblePromoters])

  const geneSig = useMemo(() => geneEntries.map((g) => g.id).join('|'), [geneEntries])
  useEffect(() => {
    setInitialByGene((prev) => {
      const next: Record<string, { m0: number; p0: number }> = {}
      for (const g of geneEntries) {
        next[g.id] = prev[g.id] ?? { m0: 0, p0: 0 }
      }
      return next
    })
  }, [geneSig])

  const apiCandidates = () => {
    const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined
    const normalizedEnv = envBase ? envBase.replace(/\/$/, '') : null
    const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : null
    const runtimeProto = typeof window !== 'undefined' ? window.location.protocol : 'http:'
    const runtimeBase = runtimeHost ? `${runtimeProto}//${runtimeHost}:8000/api` : null
    // Prefer dev proxy; fall back to direct backend.
    return [normalizedEnv ?? '/api', runtimeBase, 'http://127.0.0.1:8000/api', 'http://localhost:8000/api'].filter(
      (x): x is string => !!x
    )
  }

  const fetchWithFallback = async (path: string, init?: RequestInit) => {
    let lastErr: any = null
    for (const base of apiCandidates()) {
      const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`
      try {
        const resp = await fetch(url, init)
        // If Vite proxy can't reach backend, it commonly returns a blank 500.
        if (base === '/api' && resp.status === 500) {
          const text = await resp.text().catch(() => '')
          if (!text || text.trim().length === 0) {
            lastErr = new Error('Vite proxy could not reach backend')
            continue
          }
          // restore consumed body for later error reporting: return as-is
          // (caller will handle resp.ok and text)
          setApiBaseUsed(base)
          return new Response(text, { status: resp.status, statusText: resp.statusText, headers: resp.headers })
        }

        setApiBaseUsed(base)
        return resp
      } catch (e) {
        lastErr = e
        continue
      }
    }
    throw lastErr ?? new Error('Backend not reachable')
  }

  const handleRunSimulation = async () => {
    setError(null)
    setApiBaseUsed(null)
    setSimulationStatus('running')
    setResultsByCell([])
    setProgress(0)

    try {
      // Quick reachability check: Vite proxy returns a blank 500 when the backend is unreachable.
      const healthResp = await fetchWithFallback('/health')
      if (!healthResp.ok) {
        const healthText = await healthResp.text().catch(() => '')
        throw new Error(`Backend health check failed (${healthResp.status}): ${healthText}`)
      }

      const cellsToRun = cultureTranscriptPreview
      if (!cellsToRun || cellsToRun.length === 0) {
        setSimulationStatus('error')
        setError('No cells found to simulate.')
        return
      }

      const runnable = cellsToRun.filter((c: any) => (c.transcripts?.length ?? 0) > 0)
      if (runnable.length === 0) {
        setSimulationStatus('error')
        setError('No complete transcripts found (need promoter → RBS → gene (1+) → terminator).')
        return
      }

      const collected: Array<{ cellId: string; cellType: string; cellName: string; result: any }> = []
      const totalCells = runnable.length

      for (let i = 0; i < totalCells; i++) {
        const cell = runnable[i]
        const transcripts = cell.transcripts

        // Flatten cistrons in request order for initial conditions.
        const cistronIds: string[] = []
        for (const tx of transcripts) {
          for (const c of tx.cistrons || []) cistronIds.push(String(c.id))
        }
        const m0_by_gene = cistronIds.map((id) => initialByGene[id]?.m0 ?? 0)
        const p0_by_gene = cistronIds.map((id) => initialByGene[id]?.p0 ?? 0)

        // Build inducer configs array for backend
        const inducersForBackend = Object.values(inducerConfigs).length > 0 
          ? Object.values(inducerConfigs) 
          : undefined

        // Use streaming endpoint for real-time progress
        const resp = await fetchWithFallback('/simulate/transcripts/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcripts,
            params: {
              method: simMethod,
              runs: simMethod === 'flow' ? flowRuns : undefined,
              T: runLength,
              dt: timeStep,
              m0_by_gene,
              p0_by_gene,
              inducers: inducersForBackend,
            },
          }),
        })

        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(`Backend error (${resp.status}): ${text}`)
        }
        if (!resp.body) {
          throw new Error('Streaming not supported')
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let gotResult = false

        while (true) {
          const { done, value } = await reader.read()
          if (value) {
            buffer += decoder.decode(value, { stream: !done })
            let newlineIdx = buffer.indexOf('\n')
            while (newlineIdx >= 0) {
              const line = buffer.slice(0, newlineIdx).trim()
              buffer = buffer.slice(newlineIdx + 1)
              if (line) {
                try {
                  const event = JSON.parse(line)
                  if (event.type === 'progress') {
                    const v = Math.min(1, Math.max(0, Number(event.value) || 0))
                    // Force React to render immediately
                    flushSync(() => {
                      setProgress((i + v) / totalCells)
                    })
                  } else if (event.type === 'result') {
                    collected.push({
                      cellId: cell.cellId,
                      cellType: cell.cellType,
                      cellName: cell.cellName,
                      result: event.data,
                    })
                    setResultsByCell([...collected])
                    flushSync(() => {
                      setProgress((i + 1) / totalCells)
                    })
                    gotResult = true
                  } else if (event.type === 'error') {
                    throw new Error(event.message || event.value)
                  }
                } catch (parseErr) {
                  console.warn('Failed to parse event:', line, parseErr)
                }
              }
              newlineIdx = buffer.indexOf('\n')
            }
          }
          if (gotResult || done) break
        }
      }

      setSimulationStatus('complete')
      setProgress(1)
    } catch (e: any) {
      setSimulationStatus('error')
      const msg = e?.message || 'Simulation failed'
      const withHint =
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? `${msg} (Start backend on 127.0.0.1:8000: uvicorn app.main:app --reload --port 8000)`
          : msg
      setError(withHint)
      setProgress(0)
    }
  }

  return (
    <div className="results-panel">
      <div className="results-header">
        <h2>Simulation Results</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="results-content">
        <div className="simulation-controls">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="sim-label">
                Type:{' '}
                <select
                  className="sim-input sim-select"
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value as any)}
                  disabled={simulationStatus === 'running'}
                >
                  <option value="deterministic">Deterministic</option>
                  <option value="stochastic">Stochastic</option>
                  <option value="flow">Flow cytometer</option>
                </select>
              </label>

              <label className="sim-label">
                Run Length:{' '}
                <input
                  className="sim-input"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={runLength}
                  onChange={(e) => setRunLength(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: 80 }}
                  disabled={simulationStatus === 'running'}
                />
              </label>

              {simMethod === 'flow' && (
                <label className="sim-label">
                  Runs:{' '}
                  <input
                    className="sim-input"
                    type="number"
                    min={1}
                    max={100000}
                    value={flowRuns}
                    onChange={(e) => setFlowRuns(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                    style={{ width: 90 }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
              )}

              <button
                className="sim-advanced-btn"
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={simulationStatus === 'running'}
              >
                {showAdvanced ? '▼' : '▶'} Advanced
              </button>
            </div>

            {showAdvanced && (
              <div className="sim-advanced-panel">
                <label className="sim-checkbox-label">
                  <input
                    type="checkbox"
                    checked={plotReportersOnly}
                    onChange={(e) => setPlotReportersOnly(e.target.checked)}
                    disabled={simulationStatus === 'running'}
                  />
                  Plot only reporter genes
                </label>
                <label className="sim-label" style={{ display: 'block' }}>
                  Time Step (dt):
                  <input
                    className="sim-input"
                    type="number"
                    min={0.01}
                    max={10}
                    step={0.1}
                    value={timeStep}
                    onChange={(e) => setTimeStep(Math.max(0.01, Number(e.target.value) || 1))}
                    style={{ marginTop: 4, width: '100%' }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="sim-label" style={{ marginBottom: 6 }}>
                    Initial conditions per gene
                  </div>
                  {geneEntries.length === 0 ? (
                    <div className="sim-hint">
                      Add a complete transcript (promoter → gene(s) → terminator) to set per-gene initials.
                    </div>
                  ) : (
                    <div className="sim-gene-grid">
                      <div className="sim-gene-header">Gene</div>
                      <div className="sim-gene-header">m₀</div>
                      <div className="sim-gene-header">p₀</div>
                      {geneEntries.map((g) => (
                        <div key={g.id} style={{ display: 'contents' }}>
                          <div className="sim-gene-name">
                            {g.geneName} <span className="sim-gene-context">({g.cellName} / {g.promoterName})</span>
                          </div>
                          <input
                            className="sim-input sim-gene-input"
                            type="number"
                            min={0}
                            step={0.1}
                            value={initialByGene[g.id]?.m0 ?? 0}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value) || 0)
                              setInitialByGene((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? { m0: 0, p0: 0 }), m0: v } }))
                            }}
                            disabled={simulationStatus === 'running'}
                          />
                          <input
                            className="sim-input sim-gene-input"
                            type="number"
                            min={0}
                            step={0.1}
                            value={initialByGene[g.id]?.p0 ?? 0}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value) || 0)
                              setInitialByGene((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? { m0: 0, p0: 0 }), p0: v } }))
                            }}
                            disabled={simulationStatus === 'running'}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inducer Configuration */}
                {induciblePromoters.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                    <div className="sim-label" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span>Inducer Concentrations</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={showInducerPlot}
                            onChange={(e) => setShowInducerPlot(e.target.checked)}
                            disabled={simulationStatus === 'running'}
                          />
                          Plot
                        </label>
                        {showInducerPlot && (
                          <select
                            className="sim-input"
                            value={inducerPlotMode}
                            onChange={(e) => setInducerPlotMode(e.target.value as 'separate' | 'overlay')}
                            style={{ width: 'auto', fontSize: 10, padding: '2px 6px' }}
                            disabled={simulationStatus === 'running'}
                          >
                            <option value="overlay">Overlay</option>
                            <option value="separate">Separate</option>
                          </select>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {induciblePromoters.map(({ inducerName, promoterName }) => {
                        const config = inducerConfigs[inducerName]
                        if (!config) return null
                        const fn = config.function
                        return (
                          <div key={inducerName} style={{ 
                            padding: 10, 
                            border: '1px solid var(--border-light)', 
                            borderRadius: 4,
                            background: 'var(--bg-input)'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
                              {inducerName} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(for {promoterName})</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <label style={{ fontSize: 11, minWidth: 100 }}>
                                Function:
                                <select
                                  className="sim-input"
                                  value={fn}
                                  onChange={(e) => setInducerConfigs((prev) => ({
                                    ...prev,
                                    [inducerName]: { ...prev[inducerName], function: e.target.value as InducerFunction }
                                  }))}
                                  disabled={simulationStatus === 'running'}
                                  style={{ width: '100%', marginTop: 2 }}
                                >
                                  <option value="constant">Constant</option>
                                  <option value="sin">Sine</option>
                                  <option value="square">Square</option>
                                  <option value="pulse">Pulse</option>
                                  <option value="ramp">Ramp</option>
                                </select>
                              </label>

                              {/* Constant: just value */}
                              {fn === 'constant' && (
                                <label style={{ fontSize: 11, minWidth: 80 }}>
                                  Value:
                                  <input
                                    className="sim-input"
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={config.value}
                                    onChange={(e) => setInducerConfigs((prev) => ({
                                      ...prev,
                                      [inducerName]: { ...prev[inducerName], value: Math.max(0, Number(e.target.value) || 0) }
                                    }))}
                                    disabled={simulationStatus === 'running'}
                                    style={{ width: '100%', marginTop: 2 }}
                                  />
                                </label>
                              )}

                              {/* Ramp: baseline + slope */}
                              {fn === 'ramp' && (
                                <>
                                  <label style={{ fontSize: 11, minWidth: 80 }}>
                                    Baseline:
                                    <input
                                      className="sim-input"
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={config.baseline}
                                      onChange={(e) => setInducerConfigs((prev) => ({
                                        ...prev,
                                        [inducerName]: { ...prev[inducerName], baseline: Math.max(0, Number(e.target.value) || 0) }
                                      }))}
                                      disabled={simulationStatus === 'running'}
                                      style={{ width: '100%', marginTop: 2 }}
                                    />
                                  </label>
                                  <label style={{ fontSize: 11, minWidth: 80 }}>
                                    Slope:
                                    <input
                                      className="sim-input"
                                      type="number"
                                      step={0.001}
                                      value={config.slope}
                                      onChange={(e) => setInducerConfigs((prev) => ({
                                        ...prev,
                                        [inducerName]: { ...prev[inducerName], slope: Number(e.target.value) || 0 }
                                      }))}
                                      disabled={simulationStatus === 'running'}
                                      style={{ width: '100%', marginTop: 2 }}
                                    />
                                  </label>
                                </>
                              )}

                              {/* Sin/Square/Pulse: baseline + amplitude + period (+ duty for square/pulse) */}
                              {(fn === 'sin' || fn === 'square' || fn === 'pulse') && (
                                <>
                                  <label style={{ fontSize: 11, minWidth: 70 }}>
                                    Baseline:
                                    <input
                                      className="sim-input"
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={config.baseline}
                                      onChange={(e) => setInducerConfigs((prev) => ({
                                        ...prev,
                                        [inducerName]: { ...prev[inducerName], baseline: Math.max(0, Number(e.target.value) || 0) }
                                      }))}
                                      disabled={simulationStatus === 'running'}
                                      style={{ width: '100%', marginTop: 2 }}
                                    />
                                  </label>
                                  <label style={{ fontSize: 11, minWidth: 70 }}>
                                    Amplitude:
                                    <input
                                      className="sim-input"
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={config.amplitude}
                                      onChange={(e) => setInducerConfigs((prev) => ({
                                        ...prev,
                                        [inducerName]: { ...prev[inducerName], amplitude: Math.max(0, Number(e.target.value) || 0) }
                                      }))}
                                      disabled={simulationStatus === 'running'}
                                      style={{ width: '100%', marginTop: 2 }}
                                    />
                                  </label>
                                  <label style={{ fontSize: 11, minWidth: 70 }}>
                                    Period:
                                    <input
                                      className="sim-input"
                                      type="number"
                                      min={1}
                                      step={10}
                                      value={config.period}
                                      onChange={(e) => setInducerConfigs((prev) => ({
                                        ...prev,
                                        [inducerName]: { ...prev[inducerName], period: Math.max(1, Number(e.target.value) || 100) }
                                      }))}
                                      disabled={simulationStatus === 'running'}
                                      style={{ width: '100%', marginTop: 2 }}
                                    />
                                  </label>
                                  {(fn === 'square' || fn === 'pulse') && (
                                    <label style={{ fontSize: 11, minWidth: 70 }}>
                                      Duty:
                                      <input
                                        className="sim-input"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={config.duty_cycle}
                                        onChange={(e) => setInducerConfigs((prev) => ({
                                          ...prev,
                                          [inducerName]: { ...prev[inducerName], duty_cycle: Math.min(1, Math.max(0, Number(e.target.value) || 0.5)) }
                                        }))}
                                        disabled={simulationStatus === 'running'}
                                        style={{ width: '100%', marginTop: 2 }}
                                      />
                                    </label>
                                  )}
                                </>
                              )}
                              {/* Delay: available for all function types */}
                              <label style={{ fontSize: 11, minWidth: 70 }}>
                                Delay:
                                <input
                                  className="sim-input"
                                  type="number"
                                  min={0}
                                  step={10}
                                  value={config.delay}
                                  onChange={(e) => setInducerConfigs((prev) => ({
                                    ...prev,
                                    [inducerName]: { ...prev[inducerName], delay: Math.max(0, Number(e.target.value) || 0) }
                                  }))}
                                  disabled={simulationStatus === 'running'}
                                  style={{ width: '100%', marginTop: 2 }}
                                />
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Run button and status on same row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <button 
                className="btn btn-primary"
                onClick={handleRunSimulation}
                disabled={simulationStatus === 'running'}
              >
                {simulationStatus === 'running' ? 'Running...' : 'RUN SIMULATION'}
              </button>
              {simulationStatus !== 'idle' && (
                <span className={`status-badge status-${simulationStatus}`}>
                  {simulationStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        {simulationStatus === 'running' && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Simulating circuit...</p>
            <div className="progress-bar-container">
              <div
                className={`progress-bar-fill ${progress === 0 ? 'indeterminate' : ''}`}
                style={{ width: progress > 0 ? `${Math.min(Math.max(progress, 0), 1) * 100}%` : undefined }}
              />
            </div>
            <p className="progress-text">{progress > 0 ? `${Math.round(progress * 100)}%` : 'Starting...'}</p>
          </div>
        )}

        {simulationStatus === 'error' && (
          <div className="empty-results">
            <p style={{ color: '#e74c3c', fontWeight: 600 }}>Simulation error</p>
            <p style={{ color: '#555' }}>{error}</p>
            {apiBaseUsed && (
              <p style={{ color: '#777', fontSize: '12px', marginTop: '6px' }}>
                API base used: {apiBaseUsed}
              </p>
            )}
          </div>
        )}

        {simulationStatus === 'complete' &&
          resultsByCell.length > 0 &&
          simMethod === 'flow' &&
          resultsByCell.some((r) => r.result?.flowCytometry) && (
          <div className="results-visualization">
            <h3>Flow cytometry</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {resultsByCell.flatMap((cell) =>
                (cell.result?.flowCytometry?.proteins || [])
                  .filter((p: any) => !plotReportersOnly || isReporterName(p.label))
                  .map((p: any) => ({ ...p, __cellLabel: `${cell.cellType}: ${cell.cellName}` }))
              ).map((p: any) => (
                <Plot
                  key={`${p.__cellLabel}:${p.label}`}
                  data={[
                    {
                      x: p.values,
                      type: 'histogram',
                      name: `${p.__cellLabel} · ${p.label}`,
                      nbinsx: 30,
                      marker: reporterColorFor(p.label) ? { color: reporterColorFor(p.label) as any } : undefined,
                    },
                  ]}
                  layout={{
                    width: 520,
                    height: 360,
                    title: plotReportersOnly ? `Reporters only` : `All proteins`,
                    xaxis: { title: 'Final protein concentration (arb)', ...plotTheme.xaxis },
                    yaxis: { title: 'Cell count', ...plotTheme.yaxis },
                    bargap: 0.05,
                    paper_bgcolor: plotTheme.paper_bgcolor,
                    plot_bgcolor: plotTheme.plot_bgcolor,
                    font: plotTheme.font,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {simulationStatus === 'complete' && resultsByCell.length > 0 && simMethod !== 'flow' && (() => {
          // Build protein traces for the plot
          const proteinTraces = resultsByCell.flatMap((cell) =>
            (cell.result?.transcripts || []).flatMap((tx: any) =>
              (tx.proteins || [])
                .filter((p: any) => !plotReportersOnly || isReporterName(p.label))
                .map((p: any) => ({
                  x: cell.result?.time,
                  y: p.values,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  name: `${cell.cellName} / ${p.label}`,
                  line: reporterColorFor(p.label) ? { color: reporterColorFor(p.label) as any } : undefined,
                  yaxis: 'y' as const,
                }))
            )
          )
          
          // Check if we have any inducer data to show
          const hasInducers = Array.isArray(resultsByCell[0]?.result?.inducers) && resultsByCell[0].result.inducers.length > 0
          const shouldShowInducerOverlay = showInducerPlot && inducerPlotMode === 'overlay' && hasInducers
          
          // Build inducer traces only if we have inducer data
          const inducerTraces = shouldShowInducerOverlay
            ? resultsByCell[0].result.inducers.map((ind: any) => ({
                x: resultsByCell[0].result.time,
                y: ind.values,
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: `[Inducer] ${ind.name}`,
                line: { width: 2, dash: 'dash' as const },
                yaxis: 'y2' as const,
              }))
            : []
          
          return (
          <div className="results-visualization">
            <h3>Time Series Results</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Plot
                data={[...proteinTraces, ...inducerTraces]}
                layout={{
                  width: 520,
                  height: 360,
                  title: plotReportersOnly ? 'Proteins (reporters only)' : 'Proteins',
                  xaxis: { title: 'Time (arb)', ...plotTheme.xaxis },
                  yaxis: { title: 'Protein (arb)', ...plotTheme.yaxis },
                  ...(shouldShowInducerOverlay ? {
                    yaxis2: {
                      title: 'Inducer (arb)',
                      overlaying: 'y',
                      side: 'right',
                      ...plotTheme.yaxis,
                    }
                  } : {}),
                  hovermode: 'closest',
                  legend: { orientation: 'h', font: plotTheme.font },
                  paper_bgcolor: plotTheme.paper_bgcolor,
                  plot_bgcolor: plotTheme.plot_bgcolor,
                  font: plotTheme.font,
                }}
              />

              <Plot
                data={resultsByCell.flatMap((cell) =>
                  (cell.result?.transcripts || []).map((tx: any) => ({
                    x: cell.result?.time,
                    y: tx.mRNA.values,
                    type: 'scatter',
                    mode: 'lines',
                    name: `${cell.cellType}: ${cell.cellName} · ${tx.id} mRNA`,
                  }))
                )}
                layout={{
                  width: 520,
                  height: 360,
                  title: 'mRNA per transcript',
                  xaxis: { title: 'Time (arb)', ...plotTheme.xaxis },
                  yaxis: { title: 'mRNA (arb)', ...plotTheme.yaxis },
                  hovermode: 'closest',
                  legend: { orientation: 'h', font: plotTheme.font },
                  paper_bgcolor: plotTheme.paper_bgcolor,
                  plot_bgcolor: plotTheme.plot_bgcolor,
                  font: plotTheme.font,
                }}
              />

              {/* Inducer Concentration Plot - only show if separate mode, showInducerPlot, and there are inducers */}
              {showInducerPlot && inducerPlotMode === 'separate' && hasInducers && (
                <Plot
                  data={resultsByCell[0].result.inducers.map((ind: any) => ({
                    x: resultsByCell[0].result.time,
                    y: ind.values,
                    type: 'scatter',
                    mode: 'lines',
                    name: ind.name,
                    line: { width: 2 },
                  }))}
                  layout={{
                    width: 520,
                    height: 360,
                    title: 'Inducer Concentrations',
                    xaxis: { title: 'Time (arb)', ...plotTheme.xaxis },
                    yaxis: { title: 'Concentration (arb)', ...plotTheme.yaxis },
                    hovermode: 'closest',
                    legend: { orientation: 'h', font: plotTheme.font },
                    paper_bgcolor: plotTheme.paper_bgcolor,
                    plot_bgcolor: plotTheme.plot_bgcolor,
                    font: plotTheme.font,
                  }}
                />
              )}
            </div>

            <div className="results-table-section">
              <h3>Final values</h3>
              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Transcript</th>
                      <th>Promoter</th>
                      <th className="text-right">Cistrons</th>
                      <th className="text-right">Final mRNA</th>
                      <th>Final proteins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsByCell.flatMap((cell) =>
                      (cell.result?.summary || []).map((row: any) => ({
                        ...row,
                        __cellLabel: `${cell.cellType}: ${cell.cellName}`,
                      }))
                    ).map((row: any) => (
                      <tr key={row.transcriptId}>
                        <td>
                          <div className="cell-label">{row.__cellLabel}</div>
                          {row.transcriptId}
                        </td>
                        <td>{row.promoterName}</td>
                        <td className="text-right">{row.cistronCount}</td>
                        <td className="text-right">
                          {Number(row.final_mRNA).toFixed(3)}
                        </td>
                        <td>
                          {(row.final_proteins || []).map((v: number, i: number) => (
                            <span key={i} className="protein-value">
                              p{i + 1}: {Number(v).toFixed(3)}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="results-actions">
              <button className="btn btn-secondary">Export CSV</button>
              <button className="btn btn-secondary">Export Image</button>
            </div>
          </div>
        )})()}

        {simulationStatus === 'idle' && (
          <div className="empty-results">
            <p>Click "Run Simulation" to start</p>
          </div>
        )}
      </div>
    </div>
  )
}


