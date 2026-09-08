import HealthStrip from '../components/HealthStrip.jsx'
import ProjectCard from '../components/ProjectCard.jsx'
import CoverageMatrix from '../components/CoverageMatrix.jsx'
import GrowthScorecard from '../components/GrowthScorecard.jsx'
import { healthChips, coverageMatrix, growthScorecard } from '../data/placeholderData.js'
import { useLiveStats } from '../hooks/useLiveStats.js'

const PENDING = 'Pending'

function buildCreativeTeamCard(live) {
  const d = live || {}
  return {
    displayName: 'Creative Team',
    status: 'good',
    stats: [
      { num: d.open ?? '—', label: 'Open tickets' },
      { num: d.overdue ?? '—', label: 'Overdue', tone: d.overdue ? 'down' : undefined },
      { num: d.completedInRange ?? '—', label: 'Completed (period)' },
      { num: d.workloadPointsEstActual ?? '—', label: 'Workload pts (est / actual)' },
      { num: d.revisionHealth ?? '—', label: 'Revision health', tone: d.revisionHealthTone },
      { num: PENDING, label: 'vs. last period' },
    ],
    footnote: 'All live, using the real workloadPoints()/revisionEquivalent()/revisionHealthBand() formulas ported from Job Docket\u2019s source. "vs. last period" still pending — needs a second read for the prior range.',
  }
}

function buildEmailMarketingCard(live) {
  const d = live || {}
  const openRate = d.openRate != null ? `${d.openRate.toFixed(1)}%` : '—'
  const ctr = d.ctr != null ? `${d.ctr.toFixed(1)}%` : '—'
  const coverage = d.targetCoverage ? `${d.targetCoverage.covered} / ${d.targetCoverage.total}` : '—'
  return {
    displayName: 'Email Marketing',
    status: 'good',
    stats: [
      { num: d.newLeads ?? '—', label: 'New leads (period)' },
      { num: PENDING, label: 'Hot / Warm split' },
      { num: coverage, label: 'Target coverage' },
      { num: openRate, label: 'Open rate (period)' },
      { num: ctr, label: 'CTR (period)' },
      { num: PENDING, label: 'Top objective type' },
    ],
    footnote: 'Leads, coverage, open rate/CTR are live. Hot/Warm/Cold split needs leadmeter.js\u2019s exact thresholds — not wired yet.',
    footnoteBadge: 'bounce/unsubscribe fields unverified upstream',
  }
}

function buildSeoCard(live) {
  const d = live || {}
  const movers = d.rankingMovers ? `${d.rankingMovers.improving} ↑ / ${d.rankingMovers.declining} ↓` : '—'
  return {
    displayName: 'SEO',
    status: 'warn',
    stats: [
      { num: PENDING, label: 'Organic sessions' },
      { num: d.aiReferralSessions ?? '—', label: 'AI referral sessions*' },
      { num: movers, label: 'Ranking movers' },
      { num: d.conflictsToFix ?? '—', label: 'Conflicts to fix' },
      { num: d.articlesPublished ?? '—', label: 'Articles published' },
      { num: d.avgCompositeScore ?? '—', label: 'Avg. composite score' },
    ],
    footnote: '*floor estimate. AI referral, Ranking movers, Conflicts to fix, Articles published, and Avg. composite score are all live now — only Organic sessions is still pending (field name unconfirmed).',
  }
}

// Social Media has no same-project bridge built yet (separate Firebase
// project) — this card stays fully placeholder until that serverless
// function exists.
const socialMediaCard = {
  displayName: 'Social Media',
  status: 'good',
  stats: [
    { num: PENDING, label: 'Requests (excl. scheduler)' },
    { num: PENDING, label: 'Service coverage' },
    { num: PENDING, label: 'Events this period' },
    { num: PENDING, label: 'Monthly target' },
    { num: PENDING, label: 'Most successful event' },
    { num: '—', label: 'Cumulative growth**' },
  ],
  footnote: '**Socmed Tracker lives in a separate Firebase project — needs the serverless bridge function before any of this is live.',
}

export default function SitrepTab({ range }) {
  const { loading, errors, creativeTeam, emailMarketing, seo } = useLiveStats(range)
  const errorCount = Object.keys(errors || {}).length

  const cards = [
    buildCreativeTeamCard(creativeTeam),
    buildSeoCard(seo),
    buildEmailMarketingCard(emailMarketing),
    socialMediaCard,
  ]

  return (
    <>
      <HealthStrip chips={healthChips} />

      <div className="section-head">
        <h2>Operations</h2>
        <div className="hint">
          {loading ? 'Loading live data…' : errorCount ? `${errorCount} card(s) failed to load — check console` : 'Click a card to open the full app'}
        </div>
      </div>

      <div className="grid">
        {cards.map((card) => (
          <ProjectCard key={card.displayName} {...card} />
        ))}
      </div>

      <div className="section-head">
        <h2>Across operations</h2>
        <div className="hint">Views no single app can show on its own — still placeholder, pending per-card data</div>
      </div>

      <div className="cross-grid">
        <CoverageMatrix columns={coverageMatrix.columns} rows={coverageMatrix.rows} />
        <GrowthScorecard rows={growthScorecard} />
      </div>
    </>
  )
}
