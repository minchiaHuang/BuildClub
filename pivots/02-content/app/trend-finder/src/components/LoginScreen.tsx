import { useState } from 'react'
import type { Role } from '../types'
import { useApp } from '../lib/appContext'
import { LandingAltitude } from './landing/LandingAltitude'

// MOCK sign-in for the demo. No account or password is checked or stored; only the picked role is kept.
export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const { role: savedRole, setRole } = useApp()
  const [mode, setMode] = useState<'landing' | 'login' | 'register'>('landing')
  const [email, setEmail] = useState('')
  const [role, setPickedRole] = useState<Role>(savedRole)

  if (mode === 'landing') return <LandingAltitude onLogIn={() => setMode('login')} onRegister={() => setMode('register')} />

  const register = mode === 'register'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setRole(role)
    onSignIn()
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
        <form className="la-login-card" onSubmit={submit}>
          <div className="la-login-head">
            <h1>{register ? 'Start with the sample agency' : 'Log in to Remake'}</h1>
            <p>Demo only. There is no password, and only the role you pick is saved.</p>
          </div>
          <label className="field">
            <span className="field-label">Work email</span>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <fieldset className="la-roles">
            <legend className="field-label">I am a</legend>
            <label className="la-role">
              <input type="radio" name="role" checked={role === 'member'} onChange={() => setPickedRole('member')} />
              <strong>Team member</strong>
              <span>Find videos and plan them for clients.</span>
            </label>
            <label className="la-role">
              <input type="radio" name="role" checked={role === 'manager'} onChange={() => setPickedRole('manager')} />
              <strong>Manager</strong>
              <span>Approve plans or send them back.</span>
            </label>
          </fieldset>
          <button type="submit" className="la-pill la-solid la-big">
            {register ? 'Register and log in' : 'Log in'}
          </button>
          <p className="la-login-switch">
            {register ? 'Already using Remake? ' : 'New here? '}
            <button type="button" className="link-btn" onClick={() => setMode(register ? 'login' : 'register')}>
              {register ? 'Log in' : 'Register free'}
            </button>
          </p>
        </form>
      </section>
    </main>
  )
}
