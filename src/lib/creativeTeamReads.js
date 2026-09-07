import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { rangeToISOBounds } from './dateRange.js'

// ---------------------------------------------------------------------------
// Ported directly from Job Docket's real App.jsx (confirmed against its
// actual source, not just its handoff description):
//   - dueDate / dateCompleted are plain "YYYY-MM-DD" strings (todayISO()),
//     compared with plain string `<`/`>=` — not Firestore Timestamps.
//   - CLOSED_STATUSES / PAUSED_STATUSES / workloadPoints() / revisionEquivalent()
//     / revisionHealthBand() below are copied verbatim from its source so
//     Muster's numbers can't silently drift from what Job Docket itself shows.
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = ['Completed', 'Cancelled']
const PAUSED_STATUSES = ['On Hold', 'Completed', 'Cancelled'] // excluded from overdue, per Job Docket's own logic

function workloadPoints(list, mode = 'estimated') {
  return list.reduce((sum, t) => {
    const val =
      mode === 'actual'
        ? t.actualComplexity ?? t.estimatedComplexity ?? t.complexity ?? 1
        : t.estimatedComplexity ?? t.complexity ?? 1
    return sum + val
  }, 0)
}

function revisionEquivalent(ticket) {
  const active = (ticket.revisions || []).filter((r) => !r.voided)
  const minor = active.filter((r) => r.type === 'minor').length
  const major = active.filter((r) => r.type === 'major').length
  return minor / 3 + major
}

function revisionHealthBand(pct) {
  if (pct <= 15) return { label: 'Good', tone: 'up' }
  if (pct <= 30) return { label: 'Normal', tone: undefined }
  if (pct <= 50) return { label: 'Watch', tone: undefined }
  return { label: 'High', tone: 'down' }
}

export async function fetchCreativeTeamCounts(range) {
  const { startISO, endISO } = rangeToISOBounds(range)
  const todayISO = new Date().toISOString().slice(0, 10) // safe here — only used for a same-instant "now" string compare, not stored/shifted

  const snap = await getDocs(collection(db, 'tickets_v2'))
  const all = []
  snap.forEach((doc) => all.push(doc.data()))

  const open = all.filter((t) => !CLOSED_STATUSES.includes(t.status))
  const overdue = open.filter((t) => t.dueDate && !PAUSED_STATUSES.includes(t.status) && t.dueDate < todayISO)

  const completedInRange = all.filter(
    (t) => t.status === 'Completed' && t.dateCompleted && t.dateCompleted >= startISO && t.dateCompleted <= endISO
  )

  const assignedPts = workloadPoints(
    all.filter((t) => t.dateRequested && t.dateRequested >= startISO && t.dateRequested <= endISO),
    'estimated'
  )
  const completedPts = workloadPoints(completedInRange, 'actual')

  const needingRevision = completedInRange.filter((t) => (t.revisions || []).some((r) => !r.voided))
  const revisionRatePct = completedInRange.length
    ? Math.round((needingRevision.length / completedInRange.length) * 100)
    : 0
  const band = completedInRange.length ? revisionHealthBand(revisionRatePct) : null

  return {
    open: open.length,
    overdue: overdue.length,
    completedInRange: completedInRange.length,
    workloadPointsEstActual: `${assignedPts} / ${completedPts}`,
    revisionHealth: band ? `${band.label} (${revisionRatePct}%)` : null,
    revisionHealthTone: band?.tone,
  }
}
