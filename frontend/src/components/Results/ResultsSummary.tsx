
interface CellResult {
  cellId: string
  cellType: string
  cellName: string
  result: any
}

interface ResultsSummaryProps {
  resultsByCell: CellResult[]
  onExportCSV?: () => void
  onExportImage?: () => void
}

export default function ResultsSummary({
  resultsByCell,
  onExportCSV,
  onExportImage,
}: ResultsSummaryProps) {
  if (resultsByCell.length === 0) return null

  const summaryRows = resultsByCell.flatMap((cell) =>
    (cell.result?.summary || []).map((row: any) => ({
      ...row,
      __cellLabel: `${cell.cellType}: ${cell.cellName}`,
    }))
  )

  if (summaryRows.length === 0) return null

  return (
    <>
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
              {summaryRows.map((row: any) => (
                <tr key={row.transcriptId}>
                  <td>
                    <div className="cell-label">{row.__cellLabel}</div>
                    {row.transcriptId}
                  </td>
                  <td>{row.promoterName}</td>
                  <td className="text-right">{row.cistronCount}</td>
                  <td className="text-right">{Number(row.final_mRNA).toFixed(3)}</td>
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
        <button className="btn btn-secondary" onClick={onExportCSV}>
          Export CSV
        </button>
        <button className="btn btn-secondary" onClick={onExportImage}>
          Export Image
        </button>
      </div>
    </>
  )
}

