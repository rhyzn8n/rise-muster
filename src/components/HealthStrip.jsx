export default function HealthStrip({ chips }) {
  return (
    <div className="health-strip">
      {chips.map((chip) => (
        <div className="health-chip" key={chip.label}>
          <span className={`health-led ${chip.status}`} />
          <span className="label">{chip.label}</span>
          <span className="value">{chip.value}</span>
        </div>
      ))}
    </div>
  )
}
