import { useEffect, useState } from 'react'
import { fetchCreativeTeamCounts } from '../lib/creativeTeamReads.js'
import { fetchEmailMarketingStats } from '../lib/emailMarketingReads.js'
import { fetchSeoStats } from '../lib/seoReads.js'

// One-shot fetch per range change (not a live onSnapshot listener) — matches
// how SEO Pulse's own data is already just a periodic sync snapshot, and
// keeps this first data-wiring pass simple. Can move to onSnapshot later if
// a live-updating dashboard turns out to matter.
export function useLiveStats(range) {
  const [state, setState] = useState({ loading: true, error: null, creativeTeam: null, emailMarketing: null, seo: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    Promise.all([fetchCreativeTeamCounts(range), fetchEmailMarketingStats(range), fetchSeoStats(range)])
      .then(([creativeTeam, emailMarketing, seo]) => {
        if (cancelled) return
        setState({ loading: false, error: null, creativeTeam, emailMarketing, seo })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, creativeTeam: null, emailMarketing: null, seo: null })
      })

    return () => {
      cancelled = true
    }
  }, [range.start.getTime(), range.end.getTime()])

  return state
}
