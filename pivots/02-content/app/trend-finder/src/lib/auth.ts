// Sign-in with the API's session cookie (HttpOnly, so this code never sees it). Same-origin
// requests send it on their own, in dev through the Vite proxy as well.
export interface Account {
  email: string
  name: string
  agency: string
}

export type AuthState =
  | { kind: 'open' } // the API has no accounts yet (or isn't there): the app opens as it always did
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; account: Account }

export async function me(): Promise<AuthState> {
  try {
    const r = await fetch('/api/auth/me')
    if (r.status === 401) return { kind: 'signed-out' }
    if (!r.ok) return { kind: 'open' }
    const body = await r.json()
    if (body?.users === true && typeof body.email === 'string') {
      return { kind: 'signed-in', account: { email: body.email, name: body.name, agency: body.agency } }
    }
    return { kind: 'open' }
  } catch {
    return { kind: 'open' }
  }
}

// Throws an Error carrying the API's own message ("Wrong email or password.").
export async function login(email: string, password: string): Promise<Account> {
  let r: Response
  try {
    r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error("Couldn't reach the server. Try again.")
  }
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(typeof body?.error === 'string' ? body.error : "Couldn't sign in. Try again.")
  return body as Account
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Offline: the cookie is cleared by the next successful sign-out; the screen still moves on.
  }
}
