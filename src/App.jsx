import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import SitrepTab from './tabs/SitrepTab.jsx'

export default function App() {
  const [active, setActive] = useState('Sitrep')
  const [range, setRange] = useState('Monthly')

  const subtitleByTab = {
    Sitrep: 'All four operations, one glance',
  }

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={setActive} />

      <main className="main">
        <Topbar
          title={active}
          subtitle={subtitleByTab[active]}
          range={range}
          onRangeChange={setRange}
          customLabel="Sep 1 – Sep 7"
        />

        {active === 'Sitrep' ? (
          <SitrepTab />
        ) : (
          <div className="card">
            <div className="placeholder-panel">
              {active} detail view — not built yet, next round.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
