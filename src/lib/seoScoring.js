// ---------------------------------------------------------------------------
// Ported verbatim from SEO Pulse's real, current lib/scoring.js. Composite
// Score (Quality x75% + Revision Efficiency x25%) is no longer used by
// Muster — replaced with Quality Score alone, per the app's own update.
// ---------------------------------------------------------------------------

// Platform facts (Yoast's own scoring systems), not admin-configurable.
export const RAW_SCORE_MAX = {
  headlineScore: 100,
  yoastSeoScore: 19,
  yoastReadabilityScore: 7,
}

// Admin-configurable in SEO Pulse's Sync & Admin — if these are ever
// changed there, Muster's own average will silently drift from SEO Pulse's
// display unless this default is updated to match.
export const DEFAULT_QUALITY_WEIGHTS = {
  yoastSeoScore: 0.5,
  yoastReadabilityScore: 0.35,
  headlineScore: 0.15,
}

// Weighted average of Headline/Yoast SEO/Yoast Readability, each first
// normalized to a 0-100% of its own max before weighting. Missing fields
// are excluded and the remaining weights renormalized, so a partially
// scored article isn't penalized for a blank field.
export function computeQualityScore(article, weights = DEFAULT_QUALITY_WEIGHTS) {
  const fields = ['headlineScore', 'yoastSeoScore', 'yoastReadabilityScore']
  const items = fields
    .map((field) => ({
      field,
      raw: article[field],
      max: RAW_SCORE_MAX[field],
      weight: weights[field] ?? 0,
    }))
    .filter((item) => item.raw != null)

  if (!items.length) return null

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return null

  const weightedSum = items.reduce((sum, item) => {
    const pct = (item.raw / item.max) * 100
    return sum + pct * item.weight
  }, 0)

  return weightedSum / totalWeight
}
