import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextView, onUnauthorized } from '../src/lib/authGate.ts'

test('nextView sends a signed-out visitor to login', () => {
  assert.equal(nextView({ signedIn: false }, 'plan'), 'login')
  assert.equal(nextView({ kind: 'signed-out' }, 'plan'), 'login')
})

test('nextView lets a signed-in account through to the requested view', () => {
  assert.equal(nextView({ signedIn: true, account: { email: 'a@b.c' } }, 'plan'), 'plan')
  assert.equal(nextView({ kind: 'signed-in', account: { email: 'a@b.c', name: 'A', agency: 'X' } }, 'plan'), 'plan')
})

test('onUnauthorized runs the handler once when a request comes back 401', async () => {
  globalThis.fetch = async () => ({ status: 401, ok: false })
  let calls = 0
  onUnauthorized(() => {
    calls += 1
  })
  await fetch('/api/ideas')
  assert.equal(calls, 1)
  // A wrong password is also a 401, but that is the login form's own error, not an expired session.
  await fetch('/api/auth/login', { method: 'POST' })
  assert.equal(calls, 1)
})

test('onUnauthorized ignores answers that are not 401', async () => {
  let calls = 0
  globalThis.fetch = async () => ({ status: 200, ok: true })
  onUnauthorized(() => {
    calls += 1
  })
  await fetch('/api/ideas')
  assert.equal(calls, 0)
})
