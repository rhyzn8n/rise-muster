import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import SitrepTab from './tabs/SitrepTab.jsx'
import AuthGate from './components/AuthGate.jsx'
import { resolveRange } from './lib/dateRange.js'

export default function App() {
  const [active, setActive] = useState('Sitrep')
  const [rangeMode, setRangeMode] = useState('Monthly')
  const range = useMemo(() => resolveRange(rangeMode), [rangeMode])

  const subtitleByTab = {
    Sitrep: 'All four operations, one glance',
  }

  return (
    <AuthGate>
      {({ user, logout }) => (
        <div className="shell">
          <Sidebar active={active} onSelect={setActive} userEmail={user.email} onSignOut={logout} />

          <main className="main">
            <Topbar
              title={active}
              subtitle={subtitleByTab[active]}
              range={rangeMode}
              onRangeChange={setRangeMode}
              customLabel={range.label}
            />

            {active === 'Sitrep' ? (
              <SitrepTab range={range} />
            ) : (
              <div className="card">
                <div className="placeholder-panel">{active} detail view — not built yet, next round.</div>
              </div>
            )}
          </main>
        </div>
      )}
    </AuthGate>
  )
}
