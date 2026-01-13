import React from 'react'

interface GeneEntry {
  id: string
  geneName: string
  transcriptId: string
  promoterName: string
  cellId: string
  cellType: string
  cellName: string
}

interface SimulationControlsProps {
  simMethod: 'deterministic' | 'stochastic' | 'flow'
  onSimMethodChange: (method: 'deterministic' | 'stochastic' | 'flow') => void
  runLength: number
  onRunLengthChange: (length: number) => void
  flowRuns: number
  onFlowRunsChange: (runs: number) => void
  timeStep: number
  onTimeStepChange: (step: number) => void
  showAdvanced: boolean
  onShowAdvancedChange: (show: boolean) => void
  plotReportersOnly: boolean
  onPlotReportersOnlyChange: (only: boolean) => void
  geneEntries: GeneEntry[]
  initialByGene: Record<string, { m0: number; p0: number }>
  onInitialByGeneChange: React.Dispatch<React.SetStateAction<Record<string, { m0: number; p0: number }>>>
  disabled: boolean
  children?: React.ReactNode // For inducer config panel
}

export default function SimulationControls({
  simMethod,
  onSimMethodChange,
  runLength,
  onRunLengthChange,
  flowRuns,
  onFlowRunsChange,
  timeStep,
  onTimeStepChange,
  showAdvanced,
  onShowAdvancedChange,
  plotReportersOnly,
  onPlotReportersOnlyChange,
  geneEntries,
  initialByGene,
  onInitialByGeneChange,
  disabled,
  children,
}: SimulationControlsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      {/* Basic controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="sim-label">
          Type:{' '}
          <select
            className="sim-input sim-select"
            value={simMethod}
            onChange={(e) => onSimMethodChange(e.target.value as any)}
            disabled={disabled}
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
            onChange={(e) => onRunLengthChange(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 80 }}
            disabled={disabled}
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
              onChange={(e) => onFlowRunsChange(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              style={{ width: 90 }}
              disabled={disabled}
            />
          </label>
        )}

        <button
          className="sim-advanced-btn"
          onClick={() => onShowAdvancedChange(!showAdvanced)}
          disabled={disabled}
        >
          {showAdvanced ? '▼' : '▶'} Advanced
        </button>
      </div>

      {/* Advanced panel */}
      {showAdvanced && (
        <div className="sim-advanced-panel">
          <label className="sim-checkbox-label">
            <input
              type="checkbox"
              checked={plotReportersOnly}
              onChange={(e) => onPlotReportersOnlyChange(e.target.checked)}
              disabled={disabled}
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
              onChange={(e) => onTimeStepChange(Math.max(0.01, Number(e.target.value) || 1))}
              style={{ marginTop: 4, width: '100%' }}
              disabled={disabled}
            />
          </label>
          
          {/* Initial conditions per gene */}
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
                      {g.geneName}{' '}
                      <span className="sim-gene-context">
                        ({g.cellName} / {g.promoterName})
                      </span>
                    </div>
                    <input
                      className="sim-input sim-gene-input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={initialByGene[g.id]?.m0 ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0)
                        onInitialByGeneChange((prev) => ({
                          ...prev,
                          [g.id]: { ...(prev[g.id] ?? { m0: 0, p0: 0 }), m0: v },
                        }))
                      }}
                      disabled={disabled}
                    />
                    <input
                      className="sim-input sim-gene-input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={initialByGene[g.id]?.p0 ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0)
                        onInitialByGeneChange((prev) => ({
                          ...prev,
                          [g.id]: { ...(prev[g.id] ?? { m0: 0, p0: 0 }), p0: v },
                        }))
                      }}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Children slot for inducer config */}
          {children}
        </div>
      )}
    </div>
  )
}

