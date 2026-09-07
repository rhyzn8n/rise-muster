// ---------------------------------------------------------------------------
// PLACEHOLDER DATA — replace this file's exports with real reads next round.
//
// Each shape here is deliberately modeled on what each source app can
// actually expose, per its own handoff doc, so swapping this out for a real
// Firestore read later shouldn't require restructuring the components:
//   - Job Docket:    open/overdue/completed counts, workload pts (est/actual,
//                     never blended), revision health band, trend sparkline
//   - SEO Pulse:     sessions, AI referral sessions (floor estimate),
//                     ranking movers, cannibalization conflicts, articles
//   - Lead Importer: leads + Leadmeter split, campaign KPIs, target coverage
//                     (bounce/unsubscribe fields flagged low-confidence)
//   - Socmed Tracker: requests filtered origin !== "scheduler", coverage %,
//                     events, target progress — Cumulative Growth omitted
//                     (known open bug in the source app, §5.8)
// ---------------------------------------------------------------------------

export const healthChips = [
  { label: 'Job Docket sync', value: 'live', status: 'good' },
  { label: 'SEO Pulse sync', value: '4m ago', status: 'good' },
  { label: 'Lead Importer', value: 'live', status: 'good' },
  { label: 'Socmed backup', value: '6d ago', status: 'warn' },
]

export const creativeTeam = {
  displayName: 'Creative Team',
  sourceApp: 'Job Docket',
  status: 'good',
  stats: [
    { num: '7', label: 'Open tickets' },
    { num: '2', label: 'Overdue', tone: 'down' },
    { num: '34', label: 'Completed (period)' },
    { num: '128 / 141', label: 'Workload pts (est / actual)' },
    { num: 'Good', label: 'Revision health', tone: 'up' },
    { num: '+18%', label: 'vs. last period' },
  ],
  footnote: 'Tickets created vs. completed — trend ▂▄▃▅▆▇▆',
}

export const seo = {
  displayName: 'SEO',
  sourceApp: 'SEO Pulse',
  status: 'warn',
  stats: [
    { num: '4,820', label: 'Organic sessions' },
    { num: '96', label: 'AI referral sessions*' },
    { num: '11 ↑ / 3 ↓', label: 'Ranking movers', tone: 'up' },
    { num: '2', label: 'Conflicts to fix' },
    { num: '5', label: 'Articles published' },
    { num: '87.4', label: 'Avg. composite score' },
  ],
  footnote: '*floor estimate — Perplexity + zero-click citations undercounted',
}

export const emailMarketing = {
  displayName: 'Email Marketing',
  sourceApp: 'Lead Importer',
  status: 'good',
  stats: [
    { num: '312', label: 'New leads (period)' },
    { num: '41%', label: 'Hot / Warm split' },
    { num: '6 / 8', label: 'Target coverage' },
    { num: '24.1%', label: 'Open rate (cum.)' },
    { num: '3.6%', label: 'CTR (cum.)' },
    { num: 'Webinars', label: 'Top objective type' },
  ],
  footnote: 'Bounce / unsubscribe figures',
  footnoteBadge: 'unverified field mapping',
}

export const socialMedia = {
  displayName: 'Social Media',
  sourceApp: 'Socmed Tracker',
  status: 'good',
  stats: [
    { num: '58', label: 'Requests (excl. scheduler)' },
    { num: '21 / 32', label: 'Service coverage' },
    { num: '4', label: 'Events this period' },
    { num: '72%', label: 'Monthly target' },
    { num: 'NCLEX USA', label: 'Most successful event' },
    { num: '—', label: 'Cumulative growth**' },
  ],
  footnote: '**omitted — known bug in source app, not yet fixed',
}

export const projectCards = [creativeTeam, seo, emailMarketing, socialMedia]

export const coverageMatrix = {
  columns: ['SEO', 'Social', 'Leads', 'Creative'],
  rows: [
    { service: 'NCLEX USA', cells: ['good', 'good', 'good', 'good'] },
    { service: 'NCLEX Canada', cells: ['warn', 'good', 'good', 'warn'] },
    { service: 'Middle East Exam', cells: ['bad', 'warn', 'good', 'bad'] },
    { service: 'IPASS PNLE', cells: ['good', 'bad', 'warn', 'warn'] },
    { service: 'Visascreen', cells: ['warn', 'good', 'good', 'good'] },
  ],
}

export const growthScorecard = [
  { label: 'Organic sessions', delta: '+18.2%', tone: 'up' },
  { label: 'Email Marketing coverage', delta: '+8.0%', tone: 'up' },
  { label: 'Social Media coverage', delta: '-3.1%', tone: 'down' },
  { label: 'Requests fulfilled', delta: '+18.0%', tone: 'up' },
]
