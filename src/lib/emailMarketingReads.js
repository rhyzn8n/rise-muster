import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore'
import { db } from '../firebase.js'

// ---------------------------------------------------------------------------
// Uses only fields explicitly documented in Lead Importer's handoff:
// leads.createdAt, campaigns.{recipients,opens,clicks,sent,dateSent},
// services.{targeted}, and serviceRegistrations (read via collectionGroup,
// same pattern the handoff itself requires for cross-lead queries).
//
// Deliberately NOT computed here — needs exact logic from lib/leadmeter.js
// and settings/leadmeter (warmCutoffDays), not yet reviewed:
//   - Hot / Warm / Cold split
//
// TODO-VERIFY: createdAt / dateSent stored as Firestore Timestamp assumed
// below (.toDate()) — confirm against real data.
// ---------------------------------------------------------------------------

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

export async function fetchEmailMarketingStats(range) {
  // New leads in range
  const leadsSnap = await getDocs(collection(db, 'leads'))
  let newLeads = 0
  leadsSnap.forEach((doc) => {
    const createdAt = toDate(doc.data().createdAt)
    if (createdAt && createdAt >= range.start && createdAt <= range.end) newLeads += 1
  })

  // Campaign raw sums in range
  const campaignsSnap = await getDocs(collection(db, 'campaigns'))
  let sent = 0
  let opens = 0
  let clicks = 0
  campaignsSnap.forEach((doc) => {
    const c = doc.data()
    const dateSent = toDate(c.dateSent)
    if (dateSent && dateSent >= range.start && dateSent <= range.end) {
      sent += c.sent || 0
      opens += c.opens || 0
      clicks += c.clicks || 0
    }
  })
  const openRate = sent > 0 ? (opens / sent) * 100 : null
  const ctr = sent > 0 ? (clicks / sent) * 100 : null

  // Target coverage: targeted services vs. those with >=1 registration in range
  const servicesSnap = await getDocs(query(collection(db, 'services'), where('targeted', '==', true)))
  const targetedServiceNames = servicesSnap.docs.map((d) => d.data().name)

  const regsSnap = await getDocs(collectionGroup(db, 'serviceRegistrations'))
  const coveredThisRange = new Set()
  regsSnap.forEach((doc) => {
    const r = doc.data()
    const registeredAt = toDate(r.registeredAt)
    if (
      registeredAt &&
      registeredAt >= range.start &&
      registeredAt <= range.end &&
      targetedServiceNames.includes(r.service)
    ) {
      coveredThisRange.add(r.service)
    }
  })

  return {
    newLeads,
    openRate,
    ctr,
    targetCoverage: { covered: coveredThisRange.size, total: targetedServiceNames.length },
    hotWarmSplit: null, // not computed — needs leadmeter.js's exact thresholds
  }
}
