import { useState } from 'react'
import Plot from 'react-plotly.js'
import './ResultsPanel.css'
import { CircuitModel } from '../models/CircuitModel'
import { DNA_LENGTH } from '../constants/circuitConstants'
import { CircuitComponent } from '../types/dnaTypes'

interface ResultsPanelProps {
  onClose: () => void
  circuitData: any
}

export default function ResultsPanel({ onClose, circuitData }: ResultsPanelProps) {
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiBaseUsed, setApiBaseUsed] = useState<string | null>(null)
  const [simMethod, setSimMethod] = useState<'deterministic' | 'stochastic' | 'flow'>('deterministic')
  const [flowRuns, setFlowRuns] = useState<number>(200)
  const [runLength, setRunLength] = useState<number>(1000)
  const [timeStep, setTimeStep] = useState<number>(1)
  const [alphaMBase, setAlphaMBase] = useState<number>(1.0)
  const [alphaPBase, setAlphaPBase] = useState<number>(1.0)
  const [deltaM, setDeltaM] = useState<number>(0.1)
  const [deltaP, setDeltaP] = useState<number>(0.01)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)

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
    if (!circuitData || !Array.isArray(circuitData) || circuitData.length === 0) {
      alert('Please add components to your circuit first')
      return
    }
    setSimulationStatus('running')
    setResults(null)
    setProgress(0)

    try {
      // Quick reachability check: Vite proxy returns a blank 500 when the backend is unreachable.
      const healthResp = await fetchWithFallback('/health')
      if (!healthResp.ok) {
        const healthText = await healthResp.text().catch(() => '')
        throw new Error(`Backend health check failed (${healthResp.status}): ${healthText}`)
      }

      const components = circuitData as CircuitComponent[]
      const model = new CircuitModel(components, DNA_LENGTH)
      const sim = model.toSimulationFormat()

      const transcripts = sim.operons
        .filter((op) => !!op.terminator && op.genes.length > 0)
        .map((op) => ({
          id: op.id,
          promoterName: op.promoter.name,
          promoterStrength: op.promoter.activity ?? op.promoter.strength,
          leak: op.promoter.leak ?? 0.0,
          activatorName: op.promoter.activatorName ?? null,
          actK: op.promoter.actK ?? 10.0,
          actN: op.promoter.actN ?? 2.0,
          inhibitorName: op.promoter.inhibitorName ?? null,
          repK: op.promoter.repK ?? 10.0,
          repN: op.promoter.repN ?? 2.0,
          terminatorName: op.terminator?.name ?? null,
          cistrons: op.genes.map((g, idx) => ({
            id: `${op.id}:cistron-${idx}`,
            geneName: g.name,
            rbsName: g.rbsName ?? null,
            rbsStrength: g.rbsStrength,
          })),
        }))

      if (transcripts.length === 0) {
        setSimulationStatus('error')
        setError('No complete transcripts found (need promoter → RBS → gene (1+) → terminator).')
        return
      }

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
            alpha_m_base: alphaMBase,
            alpha_p_base: alphaPBase,
            delta_m: deltaM,
            delta_p: deltaP,
            m0: 0,
            p0: 0,
          },
        }),
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`Backend error (${resp.status}): ${text}`)
      }

      if (!resp.body) {
        throw new Error('Streaming response not supported by backend')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
          let newlineIdx = buffer.indexOf('\n')
          while (newlineIdx >= 0) {
            const line = buffer.slice(0, newlineIdx).trim()
            buffer = buffer.slice(newlineIdx + 1)
            if (line) {
              const event = JSON.parse(line)
              if (event.type === 'progress') {
                setProgress(event.value)
              } else if (event.type === 'result') {
                setResults(event.value)
                setSimulationStatus('complete')
                setProgress(1)
                reader.cancel?.()
                return
              } else if (event.type === 'error') {
                throw new Error(event.value)
              }
            }
            newlineIdx = buffer.indexOf('\n')
          }
        }

        if (done) {
          break
        }
      }

      throw new Error('Simulation stream ended before result')
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: '#666', fontFamily: 'Courier New, monospace' }}>
                Type:{' '}
                <select
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value as any)}
                  style={{
                    marginLeft: 6,
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontFamily: 'Courier New, monospace',
                    fontSize: 12,
                  }}
                  disabled={simulationStatus === 'running'}
                >
                  <option value="deterministic">Deterministic</option>
                  <option value="stochastic">Stochastic (Gillespie)</option>
                  <option value="flow">Flow cytometer</option>
                </select>
              </label>

              <label style={{ fontSize: 12, color: '#666', fontFamily: 'Courier New, monospace' }}>
                Run Length:{' '}
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={runLength}
                  onChange={(e) => setRunLength(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    marginLeft: 6,
                    width: 80,
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontFamily: 'Courier New, monospace',
                    fontSize: 12,
                  }}
                  disabled={simulationStatus === 'running'}
                />
              </label>

              {simMethod === 'flow' && (
                <label style={{ fontSize: 12, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  Runs:{' '}
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={flowRuns}
                    onChange={(e) => setFlowRuns(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                    style={{
                      marginLeft: 6,
                      width: 90,
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 12,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
              )}

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'Courier New, monospace',
                  color: '#666',
                }}
                disabled={simulationStatus === 'running'}
              >
                {showAdvanced ? '▼' : '▶'} Advanced
              </button>
            </div>

            {showAdvanced && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                padding: 10,
                background: '#f8f8f8',
                borderRadius: 4,
                border: '1px solid #e0e0e0',
              }}>
                <label style={{ fontSize: 11, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  Time Step (dt):
                  <input
                    type="number"
                    min={0.01}
                    max={10}
                    step={0.1}
                    value={timeStep}
                    onChange={(e) => setTimeStep(Math.max(0.01, Number(e.target.value) || 1))}
                    style={{
                      marginTop: 4,
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid #ddd',
                      borderRadius: 3,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 11,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
                <label style={{ fontSize: 11, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  α<sub>m</sub> (transcription):
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={alphaMBase}
                    onChange={(e) => setAlphaMBase(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      marginTop: 4,
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid #ddd',
                      borderRadius: 3,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 11,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
                <label style={{ fontSize: 11, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  α<sub>p</sub> (translation):
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={alphaPBase}
                    onChange={(e) => setAlphaPBase(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      marginTop: 4,
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid #ddd',
                      borderRadius: 3,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 11,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
                <label style={{ fontSize: 11, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  δ<sub>m</sub> (mRNA decay):
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={deltaM}
                    onChange={(e) => setDeltaM(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      marginTop: 4,
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid #ddd',
                      borderRadius: 3,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 11,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
                <label style={{ fontSize: 11, color: '#666', fontFamily: 'Courier New, monospace' }}>
                  δ<sub>p</sub> (protein decay):
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={deltaP}
                    onChange={(e) => setDeltaP(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      marginTop: 4,
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid #ddd',
                      borderRadius: 3,
                      fontFamily: 'Courier New, monospace',
                      fontSize: 11,
                    }}
                    disabled={simulationStatus === 'running'}
                  />
                </label>
              </div>
            )}
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleRunSimulation}
            disabled={simulationStatus === 'running'}
            style={{ marginTop: 12 }}
          >
            {simulationStatus === 'running' ? 'Running...' : 'Run Simulation'}
          </button>
          <div className="simulation-status">
            Status: <span className={`status-${simulationStatus}`}>{simulationStatus}</span>
          </div>
        </div>

        {simulationStatus === 'running' && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Simulating circuit...</p>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
              />
            </div>
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

        {simulationStatus === 'complete' && results && simMethod === 'flow' && results.flowCytometry && (
          <div className="results-visualization">
            <h3>Flow cytometry</h3>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 10 }}>
              Runs: {results.flowCytometry.runs}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {(results.flowCytometry.proteins || []).map((p: any) => (
                <Plot
                  key={p.label}
                  data={[
                    {
                      x: p.values,
                      type: 'histogram',
                      name: p.label,
                      nbinsx: 30,
                    },
                  ]}
                  layout={{
                    width: 520,
                    height: 360,
                    title: `${p.label} final distribution`,
                    xaxis: { title: 'Final protein concentration (arb)' },
                    yaxis: { title: 'Cell count' },
                    bargap: 0.05,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {simulationStatus === 'complete' && results && simMethod !== 'flow' && (
          <div className="results-visualization">
            <h3>Time Series Results</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Plot
                data={(results.transcripts || []).flatMap((tx: any) =>
                  (tx.proteins || []).map((p: any) => ({
                    x: results.time,
                    y: p.values,
                    type: 'scatter',
                    mode: 'lines',
                    name: `${p.label} (${tx.id})`,
                  }))
                )}
                layout={{
                  width: 520,
                  height: 360,
                  title: 'Proteins',
                  xaxis: { title: 'Time (arb)' },
                  yaxis: { title: 'Protein (arb)' },
                  hovermode: 'closest',
                  legend: { orientation: 'h' },
                }}
              />

              <Plot
                data={(results.transcripts || []).map((tx: any) => ({
                  x: results.time,
                  y: tx.mRNA.values,
                  type: 'scatter',
                  mode: 'lines',
                  name: `${tx.id} mRNA`,
                }))}
                layout={{
                  width: 520,
                  height: 360,
                  title: 'mRNA per transcript',
                  xaxis: { title: 'Time (arb)' },
                  yaxis: { title: 'mRNA (arb)' },
                  hovermode: 'closest',
                  legend: { orientation: 'h' },
                }}
              />
            </div>

            <div style={{ marginTop: '12px' }}>
              <h3 style={{ marginBottom: '8px' }}>Final values</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd' }}>Transcript</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd' }}>Promoter</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #ddd' }}>Cistrons</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #ddd' }}>Final mRNA</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd' }}>Final proteins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(results.summary || []).map((row: any) => (
                      <tr key={row.transcriptId}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{row.transcriptId}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{row.promoterName}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.cistronCount}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                          {Number(row.final_mRNA).toFixed(3)}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                          {(row.final_proteins || []).map((v: number, i: number) => (
                            <span key={i} style={{ marginRight: '10px' }}>
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
        )}

        {simulationStatus === 'idle' && (
          <div className="empty-results">
            <p>Click "Run Simulation" to start</p>
          </div>
        )}
      </div>
    </div>
  )
}


