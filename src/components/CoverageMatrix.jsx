export default function CoverageMatrix({ columns, rows }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <h3>Service coverage matrix</h3>
        </div>
      </div>
      <table className="matrix">
        <thead>
          <tr>
            <th>Service</th>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.service}>
              <td>{row.service}</td>
              {row.cells.map((status, i) => (
                <td key={i}>
                  <span className={`pip ${status}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
