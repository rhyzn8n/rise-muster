// ---------------------------------------------------------------------------
// Cannibalization logic ported from SEO Pulse's real lib/keywordMap.js
// (confirmed against source). Adapted from a React hook (useRangeData +
// useMemo) into a plain async function, since Muster does one-shot reads
// rather than live-subscribed tab state.
//
// TODO-VERIFY: normalizePath() below is a RECONSTRUCTION, not the real one —
// SEO Pulse's actual lib/trend.js wasn't available. It assumes GSC page URLs
// and article URLs both normalize to a bare pathname. If Conflicts to Fix
// comes back suspiciously low (articles/GSC pages failing to match), this
// is the first thing to check against the real trend.js.
//
// Recommendation thresholds are from confirmed decisions (not reconstructed):
// 0 clicks = "Can't assess yet", <5 total clicks = "Low signal — monitor",
// leading share >=85% = "Dismiss-worthy", 65-84% = "Investigate", <65% = "Fix".
// ---------------------------------------------------------------------------

function normalizePath(urlOrPath) {
  if (!urlOrPath) return ''
  let path = urlOrPath
  try {
    path = new URL(urlOrPath, 'https://placeholder.invalid').pathname
  } catch {
    // fall through and use the raw string
  }
  path = path.split('?')[0].split('#')[0]
  if (!path.endsWith('/')) path += '/'
  return path
}

function classifyConflict(totalClicks, leadingShare) {
  if (totalClicks === 0) return "Can't assess yet"
  if (totalClicks < 5) return 'Low signal — monitor'
  if (leadingShare >= 0.85) return 'Dismiss-worthy'
  if (leadingShare >= 0.65) return 'Investigate'
  return 'Fix'
}

// Ported verbatim from SEO Pulse's real lib/trend.js (confirmed against
// source).
export function classifyTrend(current, previous, { lowerIsBetter = false, threshold = 0.1 } = {}) {
  if (current == null || previous == null || previous === 0) return null
  const pctChange = (current - previous) / previous
  const improved = lowerIsBetter ? pctChange < 0 : pctChange > 0
  if (Math.abs(pctChange) < threshold) return { label: 'Stable', pctChange }
  return { label: improved ? 'Improving' : 'Declining', pctChange }
}

// Average GSC position per page, weighted by impressions — same weighting
// approach used elsewhere in the real keywordMap.js aggregation.
export function avgPositionByPage(gscDailyDocs) {
  const byPage = {}
  gscDailyDocs.forEach((d) => {
    ;(d.queries || []).forEach((q) => {
      const path = normalizePath(q.page)
      if (!byPage[path]) byPage[path] = { positionSum: 0, weight: 0 }
      const weight = q.impressions || 1
      byPage[path].positionSum += (q.position || 0) * weight
      byPage[path].weight += weight
    })
  })
  const result = {}
  Object.entries(byPage).forEach(([path, v]) => {
    result[path] = v.weight ? v.positionSum / v.weight : null
  })
  return result
}

// Ranking movers: pages whose average position improved/declined vs. the
// immediately-prior period of equal length. Lower position = better rank.
export function countRankingMovers(currentDocs, previousDocs) {
  const current = avgPositionByPage(currentDocs)
  const previous = avgPositionByPage(previousDocs)
  let improving = 0
  let declining = 0
  Object.keys(current).forEach((path) => {
    const trend = classifyTrend(current[path], previous[path], { lowerIsBetter: true })
    if (trend?.label === 'Improving') improving += 1
    if (trend?.label === 'Declining') declining += 1
  })
  return { improving, declining }
}

export function buildKeywordMap(gscDailyDocs, articles) {
  const queryMap = {}

  gscDailyDocs.forEach((d) => {
    ;(d.queries || []).forEach((q) => {
      const key = q.query?.toLowerCase().trim()
      if (!key) return
      if (!queryMap[key]) queryMap[key] = { query: q.query, clicks: 0, impressions: 0, pages: {} }
      queryMap[key].clicks += q.clicks || 0
      queryMap[key].impressions += q.impressions || 0
      const path = normalizePath(q.page)
      if (!queryMap[key].pages[path]) queryMap[key].pages[path] = { path, clicks: 0 }
      queryMap[key].pages[path].clicks += q.clicks || 0
    })
  })

  const articleKeywordMap = {}
  articles.forEach((a) => {
    ;(a.keywords || []).forEach((kw) => {
      const key = kw.toLowerCase().trim()
      if (!key) return
      if (!articleKeywordMap[key]) articleKeywordMap[key] = []
      articleKeywordMap[key].push({ id: a.id, url: a.publishedUrl || a.url || null })
    })
  })

  // Type 1: manual mapping conflicts — 2+ articles claiming the same keyword.
  const manualConflicts = Object.entries(articleKeywordMap)
    .filter(([, arts]) => arts.length > 1)
    .map(([keyword, arts]) => {
      const queryEntry = queryMap[keyword]
      let total = 0
      let leading = 0
      arts.forEach((a) => {
        const path = a.url ? normalizePath(a.url) : null
        const clicks = path && queryEntry ? queryEntry.pages[path]?.clicks || 0 : 0
        total += clicks
        if (clicks > leading) leading = clicks
      })
      const leadingShare = total > 0 ? leading / total : 0
      return { type: 'manual', keyword, totalClicks: total, recommendation: classifyConflict(total, leadingShare) }
    })

  // Type 2: real GSC traffic split across 2+ of our own pages for one query.
  const rankingConflicts = Object.values(queryMap)
    .map((q) => {
      const pages = Object.values(q.pages).filter((p) => p.clicks > 0 || q.impressions > 0)
      const total = pages.reduce((s, p) => s + p.clicks, 0)
      const leading = pages.reduce((m, p) => Math.max(m, p.clicks), 0)
      const leadingShare = total > 0 ? leading / total : 0
      return { type: 'ranking', keyword: q.query, pageCount: pages.length, totalClicks: total, recommendation: classifyConflict(total, leadingShare) }
    })
    .filter((q) => q.pageCount > 1)

  const allConflicts = [...manualConflicts, ...rankingConflicts]
  const conflictsToFix = allConflicts.filter((c) => c.recommendation === 'Fix').length

  return { manualConflicts, rankingConflicts, conflictsToFix, totalConflicts: allConflicts.length }
}
