import type { AuthState } from './auth'

// AuthState from me(), or the plain { signedIn } shape.
type GateAuth = AuthState | { signedIn: boolean; account?: unknown }

// 'open' means the API has no accounts yet, so the app opens as it always did.
function allowed(auth: GateAuth): boolean {
  return 'kind' in auth ? auth.kind !== 'signed-out' : auth.signedIn
}

// The view to show: the sign-in page until there is a session, then whatever was asked for.
export function nextView(auth: GateAuth, requested: string): string {
  return allowed(auth) ? requested : 'login'
}

// Calls made by the sign-in form itself (a wrong password is a 401 too) or by the public review page.
const EXEMPT = ['/api/auth/', '/api/review/']

let handler: (() => void) | null = null
let wrapped: typeof fetch | null = null

// Runs `handler` whenever an API call comes back 401 (the session ended). Registering again replaces the handler.
export function onUnauthorized(next: () => void): void {
  handler = next
  const current = globalThis.fetch
  if (wrapped && current === wrapped) return
  const original = current.bind(globalThis)
  wrapped = async (input, init) => {
    const res = await original(input, init)
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const path = url.startsWith('http') ? new URL(url).pathname : url
      if (path.startsWith('/api/') && !EXEMPT.some((p) => path.startsWith(p))) handler?.()
    }
    return res
  }
  globalThis.fetch = wrapped
}
