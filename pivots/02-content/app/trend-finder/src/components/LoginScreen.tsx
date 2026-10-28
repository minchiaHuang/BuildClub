import { AGENCY_NAME } from '../state'
import type { ComponentType } from 'react'
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

// MOCK sign-in for the demo. No account or password is checked or stored.
export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const ui = useUiTheme()
  // Designs with a landing page (hero + what it does) show it, with Log in / Register; the rest get the plain sign-in card.
  // The design switcher lives on the public website only; the dashboard keeps whichever design was picked here.
  const Landing = landings[ui]
  const page = Landing ? <Landing onLogIn={onSignIn} onRegister={onSignIn} /> : <BaseLogin onSignIn={onSignIn} />
  return (
    <>
      {page}
      <ThemeSwitcher />
    </>
  )
}

function BaseLogin({ onSignIn }: { onSignIn: () => void }) {
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
            onSignIn()
          }}
        >
          <button type="submit" className="btn btn-primary login-btn">
            Continue as demo agency
          </button>
          <p className="small muted login-note">
            Demo only: sign-in isn't built yet. You'll enter as <strong>{AGENCY_NAME}</strong> with sample clients.
          </p>
        </form>
      </div>
    </div>
  )
}
