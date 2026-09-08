import { collection, getDocs, collectionGroup } from 'firebase/firestore'
import { db } from '../firebase.js'
import { dateToISO, rangeToISOBounds } from './dateRange.js'
import { computeQualityScore, computeRevisionEfficiency, computeComposite } from './seoScoring.js'
import { buildKeywordMap, countRankingMovers } from './keywordMapLogic.js'

// ---------------------------------------------------------------------------
// AI referral fields, and the Articles Published / Avg Composite Score
// formulas, are confirmed against real source (scoring.js). Conflicts to Fix
// now uses the real cannibalization logic (keywordMap.js) — see
// keywordMapLogic.js for the one unconfirmed piece (normalizePath).
//
// TODO-VERIFY: Article Library path assumed as seoPulse/meta/articles with
// a `revisions` subcollection — mirrors the confirmed ga4Daily/gscDaily
// pattern but isn't itself confirmed against source.
//
// Still not computed — needs the trend-classification logic, not yet
// reviewed:
//   - Ranking movers
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

export async function fetchSeoStats(range) {
  const dayIds = eachDateInRange(range.start, range.end)
  const ga4Snap = await getDocs(collection(db, 'seoPulse', 'meta', 'ga4Daily'))

  const byId = {}
  ga4Snap.forEach((doc) => {
    byId[doc.id] = doc.data()
  })

  let aiReferralSessions = 0
  dayIds.forEach((id) => {
    const d = byId[id]
    if (d && typeof d.aiReferralSessions === 'number') aiReferralSessions += d.aiReferralSessions
  })

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
  // own reporting delay means "today" never has real data yet).
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

  // Ranking movers: current selected range vs. the immediately-prior
  // period of equal length (not the 90-day cannibalization window above —
  // this follows the card's own date-range selector instead).
  const rangeSpanMs = range.end.getTime() - range.start.getTime()
  const priorEnd = new Date(range.start.getTime() - 1)
  const priorStart = new Date(priorEnd.getTime() - rangeSpanMs)

  const currentRangeDayIds = eachDateInRange(range.start, range.end)
  const priorRangeDayIds = eachDateInRange(priorStart, priorEnd)
  const currentDocs = currentRangeDayIds.map((id) => gscById[id]).filter(Boolean)
  const priorDocs = priorRangeDayIds.map((id) => gscById[id]).filter(Boolean)

  const { improving, declining } = countRankingMovers(currentDocs, priorDocs)

  return {
    aiReferralSessions,
    articlesPublished,
    avgCompositeScore,
    conflictsToFix,
    rankingMovers: { improving, declining },
    organicSessions: null, // not read — field name not confirmed
  }
}
