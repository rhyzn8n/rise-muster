import { useEffect, useState } from 'react'
import { fetchCreativeTeamCounts } from '../lib/creativeTeamReads.js'
import { fetchEmailMarketingStats } from '../lib/emailMarketingReads.js'
import { fetchSeoStats } from '../lib/seoReads.js'
import { fetchSocmedStats } from '../lib/socmedReads.js'

// One-shot fetch per range change (not a live onSnapshot listener) — matches
// how SEO Pulse's own data is already just a periodic sync snapshot, and
// keeps this first data-wiring pass simple. Can move to onSnapshot later if
// a live-updating dashboard turns out to matter.
//
// Uses allSettled, not all — one card's read failing (e.g. a Firestore rules
// issue on one collection, or the Socmed bridge's service account not being
// set up yet) should never blank out the other three. Each failure is
// logged to console with a clear label so it's actually visible, instead of
// silently swallowed into state.
export function useLiveStats(range) {
  const [state, setState] = useState({
    loading: true,
    errors: {},
    creativeTeam: null,
    emailMarketing: null,
    seo: null,
    socmed: null,
  })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, errors: {} }))

    const jobs = [
      { key: 'creativeTeam', label: 'Creative Team (Job Docket)', fn: fetchCreativeTeamCounts },
      { key: 'emailMarketing', label: 'Email Marketing (Lead Importer)', fn: fetchEmailMarketingStats },
      { key: 'seo', label: 'SEO (SEO Pulse)', fn: fetchSeoStats },
      { key: 'socmed', label: 'Social Media (Socmed Tracker)', fn: fetchSocmedStats },
    ]

    Promise.allSettled(jobs.map((j) => j.fn(range))).then((results) => {
      if (cancelled) return

      const next = { loading: false, errors: {}, creativeTeam: null, emailMarketing: null, seo: null, socmed: null }
      results.forEach((result, i) => {
        const { key, label } = jobs[i]
        if (result.status === 'fulfilled') {
          next[key] = result.value
        } else {
          console.error(`[Muster] ${label} failed to load:`, result.reason)
          next.errors[key] = result.reason?.message || String(result.reason)
        }
      })
      setState(next)
    })

    return () => {
      cancelled = true
    }
  }, [range.start.getTime(), range.end.getTime()])

  return state
}
