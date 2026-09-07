import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { dateToISO } from './dateRange.js'

// ---------------------------------------------------------------------------
// SEO Pulse's handoff only gives exact field names for one thing:
// ga4Daily/{date}.aiReferralSessions / .aiReferralUsers / .aiReferralBySource
// (added in the "AI Referral Session Tracking" section). Plain session/user
// daily totals are described only as "daily totals" without a documented
// field key, so they are NOT read here — wiring a guessed field name could
// silently show a confident-looking wrong number instead of no number.
//
// Also not computed here — needs the real formulas, not yet reviewed:
//   - Ranking movers (needs the trend-classification logic)
//   - Cannibalization conflicts to fix (needs useKeywordMap's thresholds)
//   - Articles published + composite score (needs scoring.js's exact formula)
//
// ga4Daily doc IDs are date-keyed (per the handoff's Firestore schema), so
// this reads day by day across the range rather than a range query.
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
  const ga4DailyRef = collection(db, 'seoPulse', 'meta', 'ga4Daily')
  const snap = await getDocs(ga4DailyRef)

  const byId = {}
  snap.forEach((doc) => {
    byId[doc.id] = doc.data()
  })

  let aiReferralSessions = 0
  dayIds.forEach((id) => {
    const d = byId[id]
    if (d && typeof d.aiReferralSessions === 'number') aiReferralSessions += d.aiReferralSessions
  })

  return {
    aiReferralSessions,
    organicSessions: null, // not read — field name not confirmed
    rankingMovers: null,
    conflictsToFix: null,
    articlesPublished: null,
    avgCompositeScore: null,
  }
}
