import HealthStrip from '../components/HealthStrip.jsx'
import ProjectCard from '../components/ProjectCard.jsx'
import CoverageMatrix from '../components/CoverageMatrix.jsx'
import GrowthScorecard from '../components/GrowthScorecard.jsx'
import { healthChips, projectCards, coverageMatrix, growthScorecard } from '../data/placeholderData.js'

export default function SitrepTab() {
  return (
    <>
      <HealthStrip chips={healthChips} />

      <div className="section-head">
        <h2>Operations</h2>
        <div className="hint">Click a card to open the full app</div>
      </div>

      <div className="grid">
        {projectCards.map((card) => (
          <ProjectCard key={card.displayName} {...card} />
        ))}
      </div>

      <div className="section-head">
        <h2>Across operations</h2>
        <div className="hint">Views no single app can show on its own</div>
      </div>

      <div className="cross-grid">
        <CoverageMatrix columns={coverageMatrix.columns} rows={coverageMatrix.rows} />
        <GrowthScorecard rows={growthScorecard} />
      </div>
    </>
  )
}
