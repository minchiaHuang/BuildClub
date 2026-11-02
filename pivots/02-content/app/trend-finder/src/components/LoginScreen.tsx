import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { useApp } from '../lib/appContext'
import { LandingAltitude } from './landing/LandingAltitude'
import { login } from '../lib/auth'
import { googleErrorMessage } from '../lib/googleError'

interface Props {
  // `real` is true when the API has accounts: staff then sign in with email and password.
  // Without accounts it stays the demo sign-in, where no password is checked.
  real?: boolean
  // Skip the landing page, e.g. after the session ended in the middle of work.
  startAtLogin?: boolean
  onSignIn: () => void
  // 'login' after a sign-out: straight to the log-in form, not the landing page.
  startOn?: 'landing' | 'login'
}

// Staff covers the whole agency (team members and the manager who approves); clients get their own account.
// Clients never see the agency's client list: their login is a separate second step (not built yet).
export function LoginScreen({ real = false, startAtLogin = false, onSignIn, startOn = 'landing' }: Props) {
  const { role: savedRole, setRole } = useApp()
  const [mode, setMode] = useState<'landing' | 'login' | 'register' | 'client'>(startAtLogin ? 'login' : startOn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => googleErrorMessage(window.location.search))
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState<'staff' | 'client'>('staff')
  const [staffRole, setStaffRole] = useState<'member' | 'manager'>(savedRole === 'manager' ? 'manager' : 'member')

  // Show a failed Google sign-in once, then take the reason out of the address.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('google_error')) {
      url.searchParams.delete('google_error')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [])

  // The server says whether Google sign-in is set up; the button only shows when it is.
  const [google, setGoogle] = useState(false)
  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : { google: false }))
      .then((c: { google?: boolean }) => setGoogle(c.google === true))
      .catch(() => setGoogle(false))
  }, [])

  // "Try the demo" skips sign-up: enter the sample agency as a team member.
  const tryDemo = () => {
    setRole('member')
    onSignIn()
  }
  if (mode === 'landing') return <LandingAltitude onLogIn={() => setMode('login')} onDemo={real ? () => setMode('login') : tryDemo} />

  const register = mode === 'register'
  const isClient = account === 'client'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isClient) {
      setMode('client')
      return
    }
    setRole(staffRole)
    if (!real) return onSignIn()
    setError(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      onSignIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rk rk-auth">
      <nav className="rk-nav" aria-label="Main">
        <div className="rk-wrap rk-nav-in">
          <button type="button" className="rk-logo rk-logo-btn" onClick={() => setMode('landing')}>
            <Logo height={24} />
          </button>
          <div className="rk-nav-actions">
            <button type="button" className="rk-btn rk-btn-ghost" onClick={() => setMode('landing')}>Back</button>
          </div>
        </div>
      </nav>

      <div className="rk-wrap rk-auth-wrap">
        <header className="rk-panel rk-dots rk-auth-panel">
          <h1>
            {mode === 'client' ? (
              <>Your plans, <em>soon</em>.</>
            ) : register && !real ? (
              <>Start with the <em>sample agency</em>.</>
            ) : (
              <>Welcome back to <em>Remake</em>.</>
            )}
          </h1>
          <p className="rk-auth-lede">
            {real
              ? 'Use the email and password your agency set up for you.'
              : 'Demo only. There is no password, and only the account type you pick is saved.'}
          </p>
        </header>

        {mode === 'client' ? (
          <div className="rk-auth-card">
            <h2 className="rk-auth-title">Client login</h2>
            <p className="rk-auth-text">Client logins are coming soon. Your agency will send you an invite to see your plans.</p>
            <button type="button" className="rk-btn rk-btn-outline rk-btn-big rk-btn-block" onClick={() => setMode('login')}>
              Back to log in
            </button>
          </div>
        ) : (
          <form className="rk-auth-card" onSubmit={submit}>
            <label className="rk-field">
              <span className="rk-field-label">{isClient ? 'Email' : 'Work email'}</span>
              <input
                id="login-email"
                className="rk-input"
                type="email"
                autoComplete="email"
                placeholder={isClient ? 'you@company.com' : 'you@agency.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {real && !isClient && (
              <label className="rk-field">
                <span className="rk-field-label">Password</span>
                <input
                  id="login-password"
                  className="rk-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            <fieldset className="rk-fieldset">
              <legend className="rk-field-label">Log in as</legend>
              <div className="rk-choices">
                <label className="rk-choice">
                  <input type="radio" name="account" checked={!isClient} onChange={() => setAccount('staff')} />
                  <strong>Staff</strong>
                  <span>Find videos, plan them and approve them.</span>
                </label>
                <label className="rk-choice">
                  <input type="radio" name="account" checked={isClient} onChange={() => setAccount('client')} />
                  <strong>Client</strong>
                  <span>See your plans and how the month is going.</span>
                </label>
              </div>
            </fieldset>
            {!isClient && (
              <fieldset className="rk-fieldset">
                <legend className="rk-field-label">Your role</legend>
                <div className="rk-choices">
                  <label className="rk-choice">
                    <input type="radio" name="staff-role" checked={staffRole === 'member'} onChange={() => setStaffRole('member')} />
                    <strong>Team member</strong>
                  </label>
                  <label className="rk-choice">
                    <input type="radio" name="staff-role" checked={staffRole === 'manager'} onChange={() => setStaffRole('manager')} />
                    <strong>Manager (approves)</strong>
                  </label>
                </div>
              </fieldset>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="rk-btn rk-btn-primary rk-btn-big rk-btn-block" disabled={busy}>
              {isClient ? 'Continue' : register && !real ? 'Register and log in' : 'Log in'}
              <span className="rk-arrow" aria-hidden="true">→</span>
            </button>
            {google && !isClient && (
              <a className="rk-btn rk-btn-outline rk-btn-big rk-btn-block" href="/api/auth/google/start">
                Continue with Google
              </a>
            )}
            {!real && (
              <p className="rk-auth-text">
                {register ? 'Already using Remake? ' : 'New here? '}
                <button type="button" className="link-btn" onClick={() => setMode(register ? 'login' : 'register')}>
                  {register ? 'Log in' : 'Register free'}
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
