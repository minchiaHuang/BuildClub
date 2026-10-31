import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleErrorMessage } from '../src/lib/googleError.ts'

test('googleErrorMessage gives a short message per reason', () => {
  for (const reason of ['expired', 'rejected', 'unverified', 'no_account']) {
    assert.match(googleErrorMessage(`?google_error=${reason}`), /\w/)
  }
  assert.notEqual(googleErrorMessage('?google_error=expired'), googleErrorMessage('?google_error=no_account'))
})

test('googleErrorMessage is null without a known reason', () => {
  assert.equal(googleErrorMessage(''), null)
  assert.equal(googleErrorMessage('?google_error=whatever'), null)
  assert.equal(googleErrorMessage('?other=1'), null)
})
