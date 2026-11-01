import { useState } from 'react'
import { Logo } from './Logo'
import { useApp } from '../lib/appContext'
import { LandingAltitude } from './landing/LandingAltitude'

interface Props {
  onSignIn: () => void
  // 'login' after a sign-out: straight to the log-in form, not the landing page.
  startOn?: 'landing' | 'login'
}

// MOCK sign-in for the demo. No account or password is checked or stored; only the picked role is kept.
// Staff covers the whole agency and signs in as the manager (so plans can be approved in the demo); clients get their own account.
// Clients never see the agency's client list: their login is a separate second step (not built yet).
// The demo email and password are pre-filled so testers can just press the button. Nothing checks them.
const DEMO_EMAIL = 'demo@remake.app'
const DEMO_PASSWORD = 'remake-demo'

export function LoginScreen({ onSignIn, startOn = 'landing' }: Props) {
  const { setRole } = useApp()
  const [mode, setMode] = useState<'landing' | 'login' | 'client'>(startOn)
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [account, setAccount] = useState<'staff' | 'client'>('staff')

  // "Log in" and "Try the demo" both open the same log-in screen, where people pick Staff or Client.
  if (mode === 'landing') return <LandingAltitude onLogIn={() => setMode('login')} onDemo={() => setMode('login')} />

  const isClient = account === 'client'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isClient) {
      setMode('client')
    } else {
      setRole('manager')
      onSignIn()
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
            {mode === 'client' ? <>Your plans, <em>soon</em>.</> : <>Welcome back to <em>Remake</em>.</>}
          </h1>
          <p className="rk-auth-lede">This is a demo. The log-in details are filled in for you. We only save the account type you pick.</p>
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
            <label className="rk-field">
              <span className="rk-field-label">Password</span>
              <input
                id="login-password"
                className="rk-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="rk-field-hint">Demo log-in: {DEMO_EMAIL} / {DEMO_PASSWORD}, already filled in.</span>
            </label>
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
            <button type="submit" className="rk-btn rk-btn-primary rk-btn-big rk-btn-block">
              {isClient ? 'Continue' : 'Log in'}
              <span className="rk-arrow" aria-hidden="true">→</span>
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
