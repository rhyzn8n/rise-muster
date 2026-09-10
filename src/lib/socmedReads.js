import { rangeToISOBounds } from './dateRange.js'

// Unlike the other three apps, this doesn't read Firestore directly — it
// calls Muster's own serverless bridge (api/socmed-summary.js), since
// Socmed Tracker lives in a separate Firebase project a KAKAW-signed-in
// user can't query directly.
export async function fetchSocmedStats(range) {
  const { startISO, endISO } = rangeToISOBounds(range)
  const url = `/api/socmed-summary?start=${startISO}&end=${endISO}`
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Socmed summary request failed (${response.status})`)
  }
  return response.json()
}
