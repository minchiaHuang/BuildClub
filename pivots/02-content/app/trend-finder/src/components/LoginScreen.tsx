import { AGENCY_NAME } from '../state'
import { useUiTheme } from '../lib/theme'
import { ThemeSwitcher } from './ThemeSwitcher'
import { LandingAltitude } from './landing/LandingAltitude'
import { LandingUnify } from './landing/LandingUnify'
import { LandingMidnight } from './landing/LandingMidnight'

// MOCK sign-in for the demo. No account or password is checked or stored.
export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const ui = useUiTheme()
  // The two reference directions get a full landing page (hero + what it does) with Log in / Register.
  // The design switcher lives on the public website only; the dashboard keeps whichever design was picked here.
  const page =
    ui === 'altitude' ? (
      <LandingAltitude onLogIn={onSignIn} onRegister={onSignIn} />
    ) : ui === 'unify' ? (
      <LandingUnify onLogIn={onSignIn} onRegister={onSignIn} />
    ) : ui === 'midnight' ? (
      <LandingMidnight onLogIn={onSignIn} onRegister={onSignIn} />
    ) : (
      <BaseLogin onSignIn={onSignIn} />
    )
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
