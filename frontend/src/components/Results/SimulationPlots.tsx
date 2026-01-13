import Plot from 'react-plotly.js'

interface PlotTheme {
  paper_bgcolor: string
  plot_bgcolor: string
  font: { color: string; family: string }
  xaxis: { gridcolor: string; zerolinecolor: string }
  yaxis: { gridcolor: string; zerolinecolor: string }
}

interface CellResult {
  cellId: string
  cellType: string
  cellName: string
  result: any
}

interface SimulationPlotsProps {
  resultsByCell: CellResult[]
  simMethod: 'deterministic' | 'stochastic' | 'flow'
  plotTheme: PlotTheme
  plotReportersOnly: boolean
  isReporterName: (name: string) => boolean
  reporterColorFor: (name: string) => string | null
  showInducerPlot: boolean
  inducerPlotMode: 'separate' | 'overlay'
}

export default function SimulationPlots({
  resultsByCell,
  simMethod,
  plotTheme,
  plotReportersOnly,
  isReporterName,
  reporterColorFor,
  showInducerPlot,
  inducerPlotMode,
}: SimulationPlotsProps) {
  if (resultsByCell.length === 0) return null

  // Flow cytometry results
  if (simMethod === 'flow' && resultsByCell.some((r) => r.result?.flowCytometry)) {
    return (
      <div className="results-visualization">
        <h3>Flow cytometry</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {resultsByCell
            .flatMap((cell) =>
              (cell.result?.flowCytometry?.proteins || [])
                .filter((p: any) => !plotReportersOnly || isReporterName(p.label))
                .map((p: any) => ({
                  ...p,
                  __cellLabel: `${cell.cellType}: ${cell.cellName}`,
                }))
            )
            .map((p: any) => (
              <Plot
                key={`${p.__cellLabel}:${p.label}`}
                data={[
                  {
                    x: p.values,
                    type: 'histogram',
                    name: `${p.__cellLabel} · ${p.label}`,
                    nbinsx: 30,
                    marker: reporterColorFor(p.label)
                      ? { color: reporterColorFor(p.label) as any }
                      : undefined,
                  },
                ]}
                layout={{
                  width: 520,
                  height: 360,
                  title: plotReportersOnly ? 'Reporters only' : 'All proteins',
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
    )
  }

  // Time series results
  if (simMethod !== 'flow') {
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

    const hasInducers =
      Array.isArray(resultsByCell[0]?.result?.inducers) &&
      resultsByCell[0].result.inducers.length > 0
    const shouldShowInducerOverlay = showInducerPlot && inducerPlotMode === 'overlay' && hasInducers

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
          {/* Protein plot */}
          <Plot
            data={[...proteinTraces, ...inducerTraces]}
            layout={{
              width: 520,
              height: 360,
              title: plotReportersOnly ? 'Proteins (reporters only)' : 'Proteins',
              xaxis: { title: 'Time (arb)', ...plotTheme.xaxis },
              yaxis: { title: 'Protein (arb)', ...plotTheme.yaxis },
              ...(shouldShowInducerOverlay
                ? {
                    yaxis2: {
                      title: 'Inducer (arb)',
                      overlaying: 'y',
                      side: 'right',
                      ...plotTheme.yaxis,
                    },
                  }
                : {}),
              hovermode: 'closest',
              legend: { orientation: 'h', font: plotTheme.font },
              paper_bgcolor: plotTheme.paper_bgcolor,
              plot_bgcolor: plotTheme.plot_bgcolor,
              font: plotTheme.font,
            }}
          />

          {/* mRNA plot */}
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

          {/* Separate inducer plot */}
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
      </div>
    )
  }

  return null
}

