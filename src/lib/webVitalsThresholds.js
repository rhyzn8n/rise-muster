// ---------------------------------------------------------------------------
// Google's official published Core Web Vitals thresholds
// (web.dev/articles/defining-core-web-vitals-thresholds), not something
// specific to this app — same cutoffs Chrome/Lighthouse/CrUX use.
// lcp/inp are milliseconds, cls is unitless.
// ---------------------------------------------------------------------------

function classifyMetric(value, good, poor) {
  if (value == null) return null
  if (value <= good) return 'Good'
  if (value > poor) return 'Poor'
  return 'Needs Improvement'
}

export function classifyLCP(ms) {
  return classifyMetric(ms, 2500, 4000)
}
export function classifyINP(ms) {
  return classifyMetric(ms, 200, 500)
}
export function classifyCLS(unitless) {
  return classifyMetric(unitless, 0.1, 0.25)
}

const RANK = { Good: 0, 'Needs Improvement': 1, Poor: 2 }

// A page/device's overall verdict is its worst individual metric.
export function classifyPage(page) {
  const verdicts = [classifyLCP(page.lcp), classifyINP(page.inp), classifyCLS(page.cls)].filter(Boolean)
  if (!verdicts.length) return null
  return verdicts.reduce((worst, v) => (RANK[v] > RANK[worst] ? v : worst), 'Good')
}

// Site-wide cumulative status: Poor if any page fails outright, Needs
// Improvement if any page is borderline, Good only if every tracked
// page/device passes all three metrics.
export function classifyCumulative(pages) {
  const verdicts = pages.map(classifyPage).filter(Boolean)
  if (!verdicts.length) return null
  return verdicts.reduce((worst, v) => (RANK[v] > RANK[worst] ? v : worst), 'Good')
}
