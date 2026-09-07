import { useEffect, useState } from 'react'
import { subscribeAuth, loginWithGoogle, logout } from '../firebase.js'

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still checking, null = signed out

  useEffect(() => subscribeAuth(setUser), [])

  if (user === undefined) {
    return (
      <div className="shell">
        <div className="placeholder-panel" style={{ gridColumn: '1 / -1' }}>
          Checking sign-in…
        </div>
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="shell">
        <div className="placeholder-panel" style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ marginBottom: 12 }}>PROJECT MUSTER — RISE</h2>
          <p style={{ marginBottom: 20 }}>Sign in with the same Google account you use for Job Docket / SEO Pulse.</p>
          <button className="range-opt active" onClick={loginWithGoogle}>
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return children({ user, logout })
}
