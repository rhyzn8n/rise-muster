const RANGE_OPTIONS = ['Weekly', 'Monthly', 'Custom']

export default function Topbar({ title, subtitle, range, onRangeChange, customLabel }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>

      <div className="range-control">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt}
            className={`range-opt${range === opt ? ' active' : ''}${opt === 'Custom' ? ' custom' : ''}`}
            onClick={() => onRangeChange(opt)}
          >
            {opt === 'Custom' && range === 'Custom' ? `${customLabel} ▾` : opt}
          </button>
        ))}
      </div>
    </div>
  )
}
