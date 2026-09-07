export default function ProjectCard({ displayName, status, stats, footnote, footnoteBadge, openHref = '#' }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className={`status-dot ${status}`} />
          <h3>{displayName}</h3>
        </div>
        <a className="open-link" href={openHref} title={`Opens the live app behind ${displayName} in a new tab`}>
          Open ↗
        </a>
      </div>

      <div className="stat-row">
        {stats.slice(0, 3).map((s) => (
          <div className="stat" key={s.label}>
            <div className={`num${s.tone ? ` ${s.tone}` : ''}`}>{s.num}</div>
            <div className="lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {stats.length > 3 && (
        <div className="stat-row">
          {stats.slice(3, 6).map((s) => (
            <div className="stat" key={s.label}>
              <div className={`num${s.tone ? ` ${s.tone}` : ''}`}>{s.num}</div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {footnote && (
        <div className="subline">
          <span>{footnote}</span>
          {footnoteBadge && <span className="badge confidence">{footnoteBadge}</span>}
        </div>
      )}
    </div>
  )
}
