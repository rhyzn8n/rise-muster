import { dateToISO } from './dateRange.js'

// ---------------------------------------------------------------------------
// Rebuilt to match SEO Pulse's real Technical Health tab, confirmed against
// source. That tab deliberately does NOT classify raw LCP/INP/CLS against
// Google's thresholds — a single day's Lighthouse run is noisy (+/-5-15
// points between identical back-to-back checks), so it uses a 7-day
// ROLLING AVERAGE of PageSpeed's own 0-100 `score` instead, and classifies
// via the same 90/50 cutoffs the app's ScoreBadge component already uses
// everywhere else (>=90 good, >=50 borderline, <50 poor).
//
// The single "cumulative site-wide status" below is Muster's own synthesis
// on top of that confirmed methodology (SEO Pulse's tab shows per-page
// detail, not one aggregate label) — built from the real building blocks
// (rolling average, 90/50 cutoffs), not a separate guess.
// ---------------------------------------------------------------------------

function shiftDateId(id, days) {
  const [y, m, d] = id.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dateToISO(dt)
}

// snapshotDocs: array of { id: 'YYYY-MM-DD', pages: [...] }, any order.
export function computeRollingAverages(snapshotDocs) {
  if (!snapshotDocs.length) return { latestId: null, rollingByKey: {} }
  const sorted = [...snapshotDocs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const latest = sorted[sorted.length - 1]
  const windowStartId = shiftDateId(latest.id, -6) // 7-day window including latest

  const windowDocs = sorted.filter((d) => d.id >= windowStartId && d.id <= latest.id)
  const buckets = {} // "url|device" -> [scores]
  windowDocs.forEach((d) => {
    ;(d.pages || []).forEach((p) => {
      if (p.error || p.score == null) return
      const key = `${p.url}|${p.device}`
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(p.score)
    })
  })

  const rollingByKey = {}
  Object.entries(buckets).forEach(([key, scores]) => {
    rollingByKey[key] = scores.reduce((a, b) => a + b, 0) / scores.length
  })

  return { latestId: latest.id, rollingByKey }
}

// Matches ScoreBadge's own color cutoffs exactly (confirmed from
// components/common.jsx): >=90 good, >=50 borderline, <50 poor.
function classifyScore(score) {
  if (score == null) return null
  if (score >= 90) return 'Good'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}

const RANK = { Good: 0, 'Needs Improvement': 1, Poor: 2 }

export function classifyCumulative(rollingByKey) {
  const verdicts = Object.values(rollingByKey).map(classifyScore).filter(Boolean)
  if (!verdicts.length) return null
  return verdicts.reduce((worst, v) => (RANK[v] > RANK[worst] ? v : worst), 'Good')
}
