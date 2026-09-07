const NAV_ITEMS = ['Sitrep', 'Creative Team', 'SEO', 'Email Marketing', 'Social Media', 'System Health']

export default function Sidebar({ active, onSelect, userEmail, onSignOut }) {
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
        <span>{userEmail || 'rhyzn8n'}</span>
        <span className="open-link" onClick={onSignOut} style={{ cursor: 'pointer' }}>
          Sign out
        </span>
      </div>
    </aside>
  )
}
