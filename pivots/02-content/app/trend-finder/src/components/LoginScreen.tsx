import { LandingAltitude } from './landing/LandingAltitude'

// MOCK sign-in for the demo. No account or password is checked or stored.
export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return <LandingAltitude onLogIn={onSignIn} onRegister={onSignIn} />
}
