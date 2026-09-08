import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { dateToISO, rangeToISOBounds } from './dateRange.js'
import { computeQualityScore, DEFAULT_QUALITY_WEIGHTS } from './seoScoring.js'
import { buildKeywordMap, countRankingMovers } from './keywordMapLogic.js'
import { computeRollingAverages, classifyCumulative } from './webVitalsThresholds.js'

// ---------------------------------------------------------------------------
// ga4Daily field names (totals.sessions/totalUsers/newUsers) and cwvSnapshots
// shape (pages[].lcp/inp/cls) both confirmed against real source
// (sync-ga4.js / sync-cwv.js) — no more guessing on these two.
//
// Sessions/Visitors/New users display the PERIOD TOTAL (sum across the
// selected range) — matching what SEO Pulse's own Site Traffic tab shows.
// The Good/Watch status is computed separately from the PERIOD AVERAGE
// (per-day) vs. the 30-day baseline's per-day average, since the current
// range and the baseline window can have different day counts, so their
// totals alone aren't a fair comparison — only their daily rates are.
//
// TODO-VERIFY: Article Library path assumed as seoPulse/meta/articles with
// a `revisions` subcollection — mirrors the confirmed ga4Daily/gscDaily
// pattern but isn't itself confirmed against source.
// ---------------------------------------------------------------------------

function eachDateInRange(start, end) {
  const dates = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(dateToISO(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function avgOverDays(byId, dayIds, field) {
  const values = dayIds.map((id) => byId[id]?.totals?.[field]).filter((v) => typeof v === 'number')
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function sumOverDays(byId, dayIds, field) {
  const values = dayIds.map((id) => byId[id]?.totals?.[field]).filter((v) => typeof v === 'number')
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0)
}

// Good unless current average is more than 25% below the 30-day baseline —
// same deviation threshold SEO Pulse's own Overview tab uses. Traffic being
// unusually high is never flagged as a problem, only a real drop is.
function baselineStatus(current, baseline) {
  if (current == null || baseline == null || baseline === 0) return null
  return current >= baseline * 0.75 ? 'Good' : 'Watch'
}

export async function fetchSeoStats(range) {
  const dayIds = eachDateInRange(range.start, range.end)
  const ga4Snap = await getDocs(collection(db, 'seoPulse', 'meta', 'ga4Daily'))

  const ga4ById = {}
  ga4Snap.forEach((doc) => {
    ga4ById[doc.id] = doc.data()
  })

  const daysWithData = dayIds.filter((id) => ga4ById[id]?.totals).length
  console.info(
    `[Muster] SEO date window: ${dayIds[0]} to ${dayIds[dayIds.length - 1]} (${dayIds.length} days requested, ${daysWithData} have synced ga4Daily data). Missing day IDs:`,
    dayIds.filter((id) => !ga4ById[id]?.totals)
  )

  let aiReferralSessions = 0
  dayIds.forEach((id) => {
    const d = ga4ById[id]
    if (d && typeof d.aiReferralSessions === 'number') aiReferralSessions += d.aiReferralSessions
  })

  // 30-day trailing baseline, immediately before the selected range.
  const baselineEnd = new Date(range.start.getTime() - 1)
  const baselineStart = new Date(baselineEnd)
  baselineStart.setDate(baselineStart.getDate() - 29)
  const baselineDayIds = eachDateInRange(baselineStart, baselineEnd)

  const sessionsAvg = avgOverDays(ga4ById, dayIds, 'sessions')
  const visitorsAvg = avgOverDays(ga4ById, dayIds, 'totalUsers')
  const newUsersAvg = avgOverDays(ga4ById, dayIds, 'newUsers')

  const sessionsTotal = sumOverDays(ga4ById, dayIds, 'sessions')
  const visitorsTotal = sumOverDays(ga4ById, dayIds, 'totalUsers')
  const newUsersTotal = sumOverDays(ga4ById, dayIds, 'newUsers')

  const sessionsBaseline = avgOverDays(ga4ById, baselineDayIds, 'sessions')
  const visitorsBaseline = avgOverDays(ga4ById, baselineDayIds, 'totalUsers')
  const newUsersBaseline = avgOverDays(ga4ById, baselineDayIds, 'newUsers')

  const sessions = { value: sessionsTotal, status: baselineStatus(sessionsAvg, sessionsBaseline) }
  const visitors = { value: visitorsTotal, status: baselineStatus(visitorsAvg, visitorsBaseline) }
  const newUsers = { value: newUsersTotal, status: baselineStatus(newUsersAvg, newUsersBaseline) }

  // Core Web Vitals — 7-day rolling average per page/device (PageSpeed's
  // own `score`, 0-100), not raw LCP/INP/CLS thresholds — a single day's
  // Lighthouse run is noisy, per SEO Pulse's own Technical Health tab.
  // Fetch the last 14 days so there's enough history for a real 7-day
  // window even if the most recent day or two hasn't synced yet.
  const cwvSnap = await getDocs(collection(db, 'seoPulse', 'meta', 'cwvSnapshots'))
  const today = new Date()
  const cwv14DayIds = new Set(eachDateInRange(new Date(today.getTime() - 13 * 86400000), today))
  const cwvDocs = []
  cwvSnap.forEach((doc) => {
    if (cwv14DayIds.has(doc.id)) cwvDocs.push({ id: doc.id, ...doc.data() })
  })
  const { rollingByKey } = computeRollingAverages(cwvDocs)
  const cwvStatus = classifyCumulative(rollingByKey)

  // Articles — used for both Quality Score and keyword-map matching.
  const { startISO, endISO } = rangeToISOBounds(range)
  const articlesSnap = await getDocs(collection(db, 'seoPulse', 'meta', 'articles'))
  const allArticles = articlesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  // Quality Weights are admin-editable in SEO Pulse's Sync & Admin — read
  // the live value directly off the seoPulse/meta doc rather than keeping
  // a hardcoded copy, so this can never silently drift out of sync if
  // someone changes the weights there. Falls back to the confirmed default
  // only if the field has never been set.
  const metaSnap = await getDoc(doc(db, 'seoPulse', 'meta'))
  const qualityWeights = metaSnap.exists() && metaSnap.data().qualityWeights
    ? metaSnap.data().qualityWeights
    : DEFAULT_QUALITY_WEIGHTS

  const publishedThisRange = allArticles.filter(
    (a) => a.status === 'Published' && a.publishDate && a.publishDate >= startISO && a.publishDate <= endISO
  )

  let articlesPublished = 0
  let qualitySum = 0
  let qualityCount = 0

  publishedThisRange.forEach((a) => {
    articlesPublished += 1
    const quality = computeQualityScore(a, qualityWeights)
    if (quality != null) {
      qualitySum += quality
      qualityCount += 1
    }
  })

  const avgQualityScore = qualityCount ? Math.round((qualitySum / qualityCount) * 10) / 10 : null

  // Conflicts to Fix — trailing 90-day GSC window, ending yesterday (GSC's
  // own reporting delay means "today" never has real data yet). Computed
  // but not shown on the Sitrep card — kept for a future SEO detail tab.
  const gscEnd = new Date()
  gscEnd.setDate(gscEnd.getDate() - 1)
  const gscStart = new Date(gscEnd)
  gscStart.setDate(gscStart.getDate() - 89)
  const gscDayIds = eachDateInRange(gscStart, gscEnd)

  const gscSnap = await getDocs(collection(db, 'seoPulse', 'meta', 'gscDaily'))
  const gscById = {}
  gscSnap.forEach((doc) => {
    gscById[doc.id] = doc.data()
  })
  const gscDocsInWindow = gscDayIds.map((id) => gscById[id]).filter(Boolean)

  const { conflictsToFix } = buildKeywordMap(gscDocsInWindow, allArticles)

  const rangeSpanMs = range.end.getTime() - range.start.getTime()
  const priorEnd = new Date(range.start.getTime() - 1)
  const priorStart = new Date(priorEnd.getTime() - rangeSpanMs)
  const currentRangeDayIds = eachDateInRange(range.start, range.end)
  const priorRangeDayIds = eachDateInRange(priorStart, priorEnd)
  const currentGscDocs = currentRangeDayIds.map((id) => gscById[id]).filter(Boolean)
  const priorGscDocs = priorRangeDayIds.map((id) => gscById[id]).filter(Boolean)
  const { improving, declining } = countRankingMovers(currentGscDocs, priorGscDocs)

  return {
    sessions,
    visitors,
    newUsers,
    daysWithData,
    daysRequested: dayIds.length,
    cwvStatus,
    articlesPublished,
    avgQualityScore,
    // Computed but not on the Sitrep card this round — available for a
    // future SEO detail tab.
    aiReferralSessions,
    conflictsToFix,
    rankingMovers: { improving, declining },
  }
}
