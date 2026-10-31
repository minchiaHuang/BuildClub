import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AlreadyReviewed, LinkClosed, REJECT_TAGS, loadReview, reviewTokenFromPath, sendDecision } from '../src/lib/share.ts'

const reply = (status, body) => async () => new Response(body === undefined ? null : JSON.stringify(body), { status })

test('reviewTokenFromPath reads the token from /review/<token>', () => {
  assert.equal(reviewTokenFromPath('/review/abc_-123'), 'abc_-123')
  assert.equal(reviewTokenFromPath('/review/abc_-123/'), 'abc_-123')
  assert.equal(reviewTokenFromPath('/plan'), null)
  assert.equal(reviewTokenFromPath('/review/'), null)
})

test('there are five preset reject tags', () => {
  assert.equal(REJECT_TAGS.length, 5)
  assert.deepEqual(REJECT_TAGS, [
    "Doesn't fit the brand's tone",
    "Format doesn't suit this client",
    'Too hard or costly to film',
    'Did something similar recently',
    'Other',
  ])
})

test('loadReview gives null for a closed link and throws for any other failure', async () => {
  globalThis.fetch = reply(404, { error: "This link isn't active." })
  assert.equal(await loadReview('t'), null)
  globalThis.fetch = reply(500)
  await assert.rejects(loadReview('t'), /load/)
  globalThis.fetch = reply(200, { client: { name: 'Tofu Bar' }, ideas: [] })
  assert.deepEqual(await loadReview('t'), { client: { name: 'Tofu Bar' }, ideas: [] })
})

test('sendDecision tells "already reviewed" (404) apart from other failures', async () => {
  globalThis.fetch = reply(404, { error: "This idea isn't waiting for review.", code: 'not_waiting' })
  await assert.rejects(sendDecision('t', 'i1', true), AlreadyReviewed)
  globalThis.fetch = reply(500)
  await assert.rejects(sendDecision('t', 'i1', true), (e) => e instanceof Error && !(e instanceof AlreadyReviewed))
  globalThis.fetch = reply(200, {})
  await sendDecision('t', 'i1', false, 'too long', ['Other'])
})

test('sendDecision tells a closed link from an already reviewed idea by code, not by wording', async () => {
  globalThis.fetch = reply(404, { error: 'Any wording at all', code: 'link_closed' })
  await assert.rejects(sendDecision('t', 'i1', true), LinkClosed)
  globalThis.fetch = reply(404, { error: 'This link has gone, link link', code: 'not_waiting' })
  await assert.rejects(sendDecision('t', 'i1', true), AlreadyReviewed)
})
