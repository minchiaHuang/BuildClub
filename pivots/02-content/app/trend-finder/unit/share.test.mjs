import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AlreadyReviewed, LinkClosed, REJECT_TAGS, VideoReplaced, decideCut, loadReview, reviewTokenFromPath, sendDecision } from '../src/lib/share.ts'

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
  assert.deepEqual(await loadReview('t'), { client: { name: 'Tofu Bar' }, ideas: [], cuts: [] })
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

test('loadReview keeps cuts when present and fills [] when an older backend omits them', async () => {
  const cut = { idea: { id: 'i1' }, cut: { url: '/u', durationSec: 12, version: '1730000000000000123', sentAt: 5 } }
  globalThis.fetch = reply(200, { client: { name: 'T' }, ideas: [], cuts: [cut] })
  assert.deepEqual((await loadReview('t')).cuts, [cut])
  globalThis.fetch = reply(200, { client: { name: 'T' }, ideas: [] })
  assert.deepEqual((await loadReview('t')).cuts, [])
})

test('decideCut posts the decision with the version as a JSON string', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response('{}', { status: 200 })
  }
  const v = '1730000000000000123'
  await decideCut('tok', 'i/1', false, v, 'too long')
  assert.equal(calls[0].url, '/api/review/tok/cuts/i%2F1/decide')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, JSON.stringify({ decision: 'rejected', reason: 'too long', version: v }))
  assert.equal(typeof JSON.parse(calls[0].init.body).version, 'string')
  await decideCut('tok', 'i1', true, v)
  assert.deepEqual(JSON.parse(calls[1].init.body), { decision: 'approved', version: v })
})

test('decideCut maps each failure to its error', async () => {
  globalThis.fetch = reply(404, { error: 'x', code: 'link_closed' })
  await assert.rejects(decideCut('t', 'i', true, '1'), LinkClosed)
  globalThis.fetch = reply(404, { error: 'x', code: 'not_waiting' })
  await assert.rejects(decideCut('t', 'i', true, '1'), AlreadyReviewed)
  globalThis.fetch = reply(409, { error: 'x', code: 'replaced' })
  await assert.rejects(decideCut('t', 'i', true, '1'), VideoReplaced)
  globalThis.fetch = reply(422, { error: 'Say what to change.' })
  await assert.rejects(decideCut('t', 'i', false, '1', ''), (e) => e.message === "Couldn't save your answer.")
  globalThis.fetch = reply(500)
  await assert.rejects(decideCut('t', 'i', true, '1'), (e) => e.message === "Couldn't save your answer." && !(e instanceof VideoReplaced))
  globalThis.fetch = reply(200, {})
  await decideCut('t', 'i', true, '1')
})
