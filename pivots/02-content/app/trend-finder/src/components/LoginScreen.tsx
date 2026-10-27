import { AGENCY_NAME } from '../state'

// MOCK sign-in for the demo. No account or password is checked or stored.
export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
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
