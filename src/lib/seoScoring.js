// ---------------------------------------------------------------------------
// Ported verbatim from SEO Pulse's real lib/scoring.js (confirmed against
// source, not reconstructed from the handoff's description of it).
// ---------------------------------------------------------------------------

export const QUALITY_WEIGHT = 0.75
export const REVISION_WEIGHT = 0.25

export function computeQualityScore(article) {
  const scores = [article.yoastSeoScore, article.yoastReadabilityScore, article.headlineScore].filter(
    (v) => v != null
  )
  if (!scores.length) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

// Each revision entry can carry a `count` (e.g. "2 minor revisions" logged
// as one entry) — defaults to 1 if not set.
export function computeRevisionEfficiency(revisions) {
  if (!revisions || revisions.length === 0) return 100
  const majorEquivalents = revisions.reduce((sum, r) => {
    const count = r.count || 1
    return sum + count * (r.type === 'major' ? 1 : 1 / 3)
  }, 0)
  const score = 100 - majorEquivalents * 28 - Math.max(0, majorEquivalents - 1) * 24
  return Math.max(0, Math.round(score))
}

export function computeComposite(qualityScore, revisionEfficiency) {
  if (qualityScore == null) return null
  return qualityScore * QUALITY_WEIGHT + revisionEfficiency * REVISION_WEIGHT
}
