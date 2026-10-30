import { useState } from 'react'
import { login, type Account } from '../lib/auth'
import { useLiveInfo } from '../lib/useLiveInfo'
import type { ComponentType } from 'react'
import { AGENCY_NAME } from '../state'
import { useUiTheme, type UiTheme } from '../lib/theme'
import { ThemeSwitcher } from './ThemeSwitcher'
// altitude
import { LandingAltitude } from './landing/LandingAltitude'

// unify
import { LandingUnify } from './landing/LandingUnify'

// midnight
import { LandingMidnight } from './landing/LandingMidnight'

type Landing = ComponentType<{ onLogIn: () => void; onRegister: () => void }>
// Each design registers its landing page on its own line.
const landings: Partial<Record<UiTheme, Landing>> = {
  // altitude
  altitude: LandingAltitude,

  // unify
  unify: LandingUnify,

  // midnight
  midnight: LandingMidnight,
}

// Where "Ask for access" writes to. Accounts are made by hand; there is no self-service sign-up.
const ACCESS_EMAIL = 'tommycat997@gmail.com'
const askForAccess = () => {
  window.location.href = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent('Trend Finder access')}`
}

// `real` is true when the API has accounts: the form then signs in for real. Otherwise it is the
// no-account demo entry, which checks nothing.
export function LoginScreen({ real, onSignIn }: { real: boolean; onSignIn: (account?: Account) => void }) {
  const ui = useUiTheme()
  const [formOpen, setFormOpen] = useState(false)
  // Designs with a landing page (hero + what it does) show it, with Log in / Ask for access; the rest get the plain sign-in card.
  // The design switcher lives on the public website only; the dashboard keeps whichever design was picked here.
  const Landing = landings[ui]
  const showLanding = Landing && !(real && formOpen)
  const page = showLanding ? (
    <Landing onLogIn={real ? () => setFormOpen(true) : () => onSignIn()} onRegister={askForAccess} />
  ) : (
    <BaseLogin real={real} onSignIn={onSignIn} onBack={Landing ? () => setFormOpen(false) : undefined} />
  )
  return (
    <>
      {page}
      <ThemeSwitcher />
    </>
  )
}

function BaseLogin({ real, onSignIn, onBack }: { real: boolean; onSignIn: (account?: Account) => void; onBack?: () => void }) {
  const { mode } = useLiveInfo()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!real) return onSignIn()
    setBusy(true)
    setError('')
    try {
      onSignIn(await login(email, password))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in. Try again.")
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          Trend Finder
        </div>
        <div className="login-copy">
          <h1>Find what's working for every client</h1>
          <p className="muted">Trending video research, approvals and filming plans for social media agencies.</p>
        </div>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {real && (
            <>
              <label className="field">
                <span className="field-label">Email</span>
                <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
            {real ? (busy ? 'Signing in…' : 'Sign in') : 'Continue as demo agency'}
          </button>
          {onBack && (
            <button type="button" className="btn btn-ghost login-btn" onClick={onBack}>
              Back
            </button>
          )}
          {!real && mode !== 'live' && (
            <p className="small muted login-note">
              Demo only: sign-in isn't built yet. You'll enter as <strong>{AGENCY_NAME}</strong> with sample clients.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
