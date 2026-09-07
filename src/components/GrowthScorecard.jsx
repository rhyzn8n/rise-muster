export default function GrowthScorecard({ rows }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <h3>Growth scorecard</h3>
        </div>
      </div>
      {rows.map((row) => (
        <div className="scorecard-row" key={row.label}>
          <span>{row.label}</span>
          <span className={`delta ${row.tone}`}>{row.delta}</span>
        </div>
      ))}
    </div>
  )
}
