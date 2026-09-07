// ---------------------------------------------------------------------------
// Pure local-time date helpers. Deliberately never uses `new Date().toISOString()`
// for date-only values — Job Docket's own handoff documents a real production
// bug where exactly that pattern silently rolled dates back a day (or a whole
// month on the 1st) for any timezone ahead of UTC, including the Philippines
// (UTC+8). Everything here uses local getters instead.
// ---------------------------------------------------------------------------

export function todayISO() {
  const d = new Date()
  return dateToISO(d)
}

export function dateToISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Job Docket stores dueDate/dateCompleted as plain "YYYY-MM-DD" strings
// (confirmed from its real todayISO()), not Firestore Timestamps — so range
// boundaries need an ISO-string form too, for direct string comparison
// (the exact pattern Job Docket's own code uses: t.dueDate < todayISO()).
export function rangeToISOBounds(range) {
  return { startISO: dateToISO(range.start), endISO: dateToISO(range.end) }
}

// Monday-start week containing `d`.
export function startOfWeek(d = new Date()) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = copy.getDay() // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow
  copy.setDate(copy.getDate() + diff)
  return copy
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfToday(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

// Returns { start: Date, end: Date, label: string } for the given range mode.
// "Custom" isn't wired to a real date picker yet — returns the current month
// as a stand-in until that UI is built.
export function resolveRange(mode) {
  const now = new Date()
  const end = endOfToday(now)

  if (mode === 'Weekly') {
    const start = startOfWeek(now)
    return { start, end, label: `${dateToISO(start)} – ${dateToISO(now)}` }
  }

  if (mode === 'Custom') {
    const start = startOfMonth(now)
    return { start, end, label: `${dateToISO(start)} – ${dateToISO(now)} (custom picker not built yet)` }
  }

  // Monthly default
  const start = startOfMonth(now)
  return { start, end, label: `${dateToISO(start)} – ${dateToISO(now)}` }
}
