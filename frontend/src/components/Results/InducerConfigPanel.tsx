import React from 'react'

export type InducerFunction = 'constant' | 'sin' | 'pulse' | 'ramp' | 'square'

export interface InducerConfig {
  name: string
  function: InducerFunction
  value: number       // For constant
  baseline: number    // For sin/square/pulse/ramp
  amplitude: number   // For sin/square/pulse
  period: number      // For sin/square/pulse
  duty_cycle: number  // For square/pulse
  slope: number       // For ramp
  delay: number       // Delay before function starts
}

interface InducerConfigPanelProps {
  induciblePromoters: Array<{ inducerName: string; promoterName: string }>
  inducerConfigs: Record<string, InducerConfig>
  onConfigChange: React.Dispatch<React.SetStateAction<Record<string, InducerConfig>>>
  disabled: boolean
  showInducerPlot: boolean
  onShowInducerPlotChange: (show: boolean) => void
  inducerPlotMode: 'separate' | 'overlay'
  onPlotModeChange: (mode: 'separate' | 'overlay') => void
}

export default function InducerConfigPanel({
  induciblePromoters,
  inducerConfigs,
  onConfigChange,
  disabled,
  showInducerPlot,
  onShowInducerPlotChange,
  inducerPlotMode,
  onPlotModeChange,
}: InducerConfigPanelProps) {
  if (induciblePromoters.length === 0) return null

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
      <div
        className="sim-label"
        style={{
          marginBottom: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <span>Inducer Concentrations</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={showInducerPlot}
              onChange={(e) => onShowInducerPlotChange(e.target.checked)}
              disabled={disabled}
            />
            Plot
          </label>
          {showInducerPlot && (
            <select
              className="sim-input"
              value={inducerPlotMode}
              onChange={(e) => onPlotModeChange(e.target.value as 'separate' | 'overlay')}
              style={{ width: 'auto', fontSize: 10, padding: '2px 6px' }}
              disabled={disabled}
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

          const updateConfig = (updates: Partial<InducerConfig>) => {
            onConfigChange((prev) => ({
              ...prev,
              [inducerName]: { ...prev[inducerName], ...updates },
            }))
          }

          return (
            <div
              key={inducerName}
              style={{
                padding: 10,
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                background: 'var(--bg-input)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
                {inducerName}{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                  (for {promoterName})
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Function selection */}
                <label style={{ fontSize: 11, minWidth: 100 }}>
                  Function:
                  <select
                    className="sim-input"
                    value={fn}
                    onChange={(e) => updateConfig({ function: e.target.value as InducerFunction })}
                    disabled={disabled}
                    style={{ width: '100%', marginTop: 2 }}
                  >
                    <option value="constant">Constant</option>
                    <option value="sin">Sine</option>
                    <option value="square">Square</option>
                    <option value="pulse">Pulse</option>
                    <option value="ramp">Ramp</option>
                  </select>
                </label>

                {/* Delay (common to all) */}
                <label style={{ fontSize: 11, minWidth: 60 }}>
                  Delay:
                  <input
                    className="sim-input"
                    type="number"
                    min={0}
                    step={10}
                    value={config.delay}
                    onChange={(e) =>
                      updateConfig({ delay: Math.max(0, Number(e.target.value) || 0) })
                    }
                    disabled={disabled}
                    style={{ width: '100%', marginTop: 2 }}
                  />
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
                      onChange={(e) =>
                        updateConfig({ value: Math.max(0, Number(e.target.value) || 0) })
                      }
                      disabled={disabled}
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
                        onChange={(e) =>
                          updateConfig({ baseline: Math.max(0, Number(e.target.value) || 0) })
                        }
                        disabled={disabled}
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
                        onChange={(e) =>
                          updateConfig({ slope: Number(e.target.value) || 0 })
                        }
                        disabled={disabled}
                        style={{ width: '100%', marginTop: 2 }}
                      />
                    </label>
                  </>
                )}

                {/* Periodic functions: sin, square, pulse */}
                {(fn === 'sin' || fn === 'square' || fn === 'pulse') && (
                  <>
                    <label style={{ fontSize: 11, minWidth: 80 }}>
                      Baseline:
                      <input
                        className="sim-input"
                        type="number"
                        min={0}
                        step={0.1}
                        value={config.baseline}
                        onChange={(e) =>
                          updateConfig({ baseline: Math.max(0, Number(e.target.value) || 0) })
                        }
                        disabled={disabled}
                        style={{ width: '100%', marginTop: 2 }}
                      />
                    </label>
                    <label style={{ fontSize: 11, minWidth: 80 }}>
                      Amplitude:
                      <input
                        className="sim-input"
                        type="number"
                        min={0}
                        step={0.1}
                        value={config.amplitude}
                        onChange={(e) =>
                          updateConfig({ amplitude: Math.max(0, Number(e.target.value) || 0) })
                        }
                        disabled={disabled}
                        style={{ width: '100%', marginTop: 2 }}
                      />
                    </label>
                    <label style={{ fontSize: 11, minWidth: 80 }}>
                      Period:
                      <input
                        className="sim-input"
                        type="number"
                        min={1}
                        step={10}
                        value={config.period}
                        onChange={(e) =>
                          updateConfig({ period: Math.max(1, Number(e.target.value) || 100) })
                        }
                        disabled={disabled}
                        style={{ width: '100%', marginTop: 2 }}
                      />
                    </label>
                    {(fn === 'square' || fn === 'pulse') && (
                      <label style={{ fontSize: 11, minWidth: 80 }}>
                        Duty Cycle:
                        <input
                          className="sim-input"
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={config.duty_cycle}
                          onChange={(e) =>
                            updateConfig({
                              duty_cycle: Math.max(0, Math.min(1, Number(e.target.value) || 0.5)),
                            })
                          }
                          disabled={disabled}
                          style={{ width: '100%', marginTop: 2 }}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

