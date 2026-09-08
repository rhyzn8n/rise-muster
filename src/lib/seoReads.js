import { collection, getDocs, collectionGroup } from 'firebase/firestore'
import { db } from '../firebase.js'
import { dateToISO, rangeToISOBounds } from './dateRange.js'
import { computeQualityScore, computeRevisionEfficiency, computeComposite } from './seoScoring.js'
import { buildKeywordMap, countRankingMovers } from './keywordMapLogic.js'
import { classifyCumulative } from './webVitalsThresholds.js'

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

  // Core Web Vitals — always the LATEST snapshot, never range-averaged.
  // PageSpeed has no historical endpoint, so this is a current-state read.
  const cwvSnap = await getDocs(collection(db, 'seoPulse', 'meta', 'cwvSnapshots'))
  let latestCwvDoc = null
  let latestCwvId = null
  cwvSnap.forEach((doc) => {
    if (!latestCwvId || doc.id > latestCwvId) {
      latestCwvId = doc.id
      latestCwvDoc = doc.data()
    }
  })
  const cwvStatus = latestCwvDoc ? classifyCumulative(latestCwvDoc.pages || []) : null

  // Articles — used for both composite score and keyword-map matching.
  const { startISO, endISO } = rangeToISOBounds(range)
  const articlesSnap = await getDocs(collection(db, 'seoPulse', 'meta', 'articles'))
  const allArticles = articlesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  const publishedThisRange = allArticles.filter(
    (a) => a.status === 'Published' && a.publishDate && a.publishDate >= startISO && a.publishDate <= endISO
  )

  let articlesPublished = 0
  let compositeSum = 0
  let compositeCount = 0

  if (publishedThisRange.length) {
    const revisionsSnap = await getDocs(collectionGroup(db, 'revisions'))
    const revisionsByArticleId = {}
    revisionsSnap.forEach((doc) => {
      const articleId = doc.ref.parent.parent?.id
      if (!articleId) return
      if (!revisionsByArticleId[articleId]) revisionsByArticleId[articleId] = []
      revisionsByArticleId[articleId].push(doc.data())
    })

    publishedThisRange.forEach((a) => {
      articlesPublished += 1
      const quality = computeQualityScore(a)
      const revisionEfficiency = computeRevisionEfficiency(revisionsByArticleId[a.id])
      const composite = computeComposite(quality, revisionEfficiency)
      if (composite != null) {
        compositeSum += composite
        compositeCount += 1
      }
    })
  }

  const avgCompositeScore = compositeCount ? Math.round((compositeSum / compositeCount) * 10) / 10 : null

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
    cwvStatus,
    articlesPublished,
    avgCompositeScore,
    // Computed but not on the Sitrep card this round — available for a
    // future SEO detail tab.
    aiReferralSessions,
    conflictsToFix,
    rankingMovers: { improving, declining },
  }
}
