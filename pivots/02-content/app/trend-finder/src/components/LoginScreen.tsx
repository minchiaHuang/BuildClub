import { useState } from 'react'
import { useApp } from '../lib/appContext'
import { LandingAltitude } from './landing/LandingAltitude'
import { login } from '../lib/auth'

interface Props {
  // `real` is true when the API has accounts: staff then sign in with email and password.
  // Without accounts it stays the demo sign-in, where no password is checked.
  real?: boolean
  // Skip the landing page, e.g. after the session ended in the middle of work.
  startAtLogin?: boolean
  onSignIn: () => void
}

// Staff covers the whole agency (team members and the manager who approves); clients get their own account.
// Clients never see the agency's client list: their login is a separate second step (not built yet).
export function LoginScreen({ real = false, startAtLogin = false, onSignIn }: Props) {
  const { role: savedRole, setRole } = useApp()
  const [mode, setMode] = useState<'landing' | 'login' | 'register' | 'client'>(startAtLogin ? 'login' : 'landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState<'staff' | 'client'>('staff')
  const [staffRole, setStaffRole] = useState<'member' | 'manager'>(savedRole === 'manager' ? 'manager' : 'member')

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
    <main className="landing landing-alt">
      <nav className="la-nav" aria-label="Main">
        <button type="button" className="la-logo la-logo-btn" onClick={() => setMode('landing')}>
          <span className="la-mark" aria-hidden="true">↗</span> Remake
        </button>
        <div className="la-actions">
          <button type="button" className="la-pill la-outline" onClick={() => setMode('landing')}>Back</button>
        </div>
      </nav>

      <section className="alt-hero la-hero la-login">
        <div className="alt-sky" aria-hidden="true">
          <span className="alt-cloud c1" /><span className="alt-cloud c2" /><span className="alt-cloud c3" />
        </div>
        <div className="alt-ground" aria-hidden="true" />
        {mode === 'client' ? (
          <div className="la-login-card">
            <div className="la-login-head">
              <h1>Client login</h1>
              <p>Client accounts are coming soon. Your agency will send you an invite to see your plans.</p>
            </div>
            <button type="button" className="la-pill la-outline la-big" onClick={() => setMode('login')}>
              Back to log in
            </button>
          </div>
        ) : (
          <form className="la-login-card" onSubmit={submit}>
            <div className="la-login-head">
              <h1>{register && !real ? 'Start with the sample agency' : 'Log in to Remake'}</h1>
              {real ? (
                <p>Use the email and password your agency set up for you.</p>
              ) : (
                <p>Demo only. There is no password, and only the account type you pick is saved.</p>
              )}
            </div>
            <label className="field">
              <span className="field-label">{isClient ? 'Email' : 'Work email'}</span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={isClient ? 'you@company.com' : 'you@agency.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {real && !isClient && (
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            <fieldset className="la-roles">
              <legend className="field-label">Log in as</legend>
              <label className="la-role">
                <input type="radio" name="account" checked={!isClient} onChange={() => setAccount('staff')} />
                <strong>Staff</strong>
                <span>Find videos, plan them and approve them.</span>
              </label>
              <label className="la-role">
                <input type="radio" name="account" checked={isClient} onChange={() => setAccount('client')} />
                <strong>Client</strong>
                <span>See your plans and how the month is going.</span>
              </label>
            </fieldset>
            {!isClient && (
              <fieldset className="la-seg">
                <legend className="field-label">Your role</legend>
                <label>
                  <input type="radio" name="staff-role" checked={staffRole === 'member'} onChange={() => setStaffRole('member')} />
                  <span>Team member</span>
                </label>
                <label>
                  <input type="radio" name="staff-role" checked={staffRole === 'manager'} onChange={() => setStaffRole('manager')} />
                  <span>Manager (approves)</span>
                </label>
              </fieldset>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="la-pill la-solid la-big" disabled={busy}>
              {isClient ? 'Continue' : register && !real ? 'Register and log in' : 'Log in'}
            </button>
            {!real && (
              <p className="la-login-switch">
                {register ? 'Already using Remake? ' : 'New here? '}
                <button type="button" className="link-btn" onClick={() => setMode(register ? 'login' : 'register')}>
                  {register ? 'Log in' : 'Register free'}
                </button>
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  )
}
