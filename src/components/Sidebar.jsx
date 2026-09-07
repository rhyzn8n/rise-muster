const NAV_ITEMS = ['Sitrep', 'Creative Team', 'SEO', 'Email Marketing', 'Social Media', 'System Health']

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-name">
          MUSTER
          <span>Project Muster — RISE</span>
        </div>
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item}
          className={`nav-item${active === item ? ' active' : ''}`}
          onClick={() => onSelect(item)}
        >
          <span className="nav-dot" />
          {item}
        </button>
      ))}

      <div className="sidebar-foot">
        <span>rhyzn8n</span>
        <span>Admin</span>
      </div>
    </aside>
  )
}
