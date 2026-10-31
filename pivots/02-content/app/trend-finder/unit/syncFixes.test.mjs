import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keepUnsavedDraft, sameIdeaList, withoutSamples } from '../src/lib/ideasSync.ts'
import { IdeasConflict, SaveError, saveIdeas } from '../src/lib/live.ts'
import { onUnauthorized } from '../src/lib/authGate.ts'

const idea = (id, extra = {}) => ({ id, clientId: 'c', videoId: 'v', status: 'saved', ...extra })
const memStorage = () => {
  const m = new Map()
  return { setItem: (k, v) => m.set(k, v), getItem: (k) => m.get(k) ?? null }
}

test('a 401 during the ideas save leaves the unsaved edit in sessionStorage', async () => {
  const confirmed = [idea('a')]
  const edited = [idea('a', { status: 'waiting' })]
  const store = memStorage()
  globalThis.fetch = async () => ({ status: 401, ok: false, headers: new Headers(), json: async () => ({}) })
  onUnauthorized(() => keepUnsavedDraft(confirmed, edited, 'draft', store))
  await assert.rejects(saveIdeas(edited, '"1"'), (e) => e instanceof SaveError && e.status === 401)
  assert.deepEqual(JSON.parse(store.getItem('draft')), edited)
})

test('keepUnsavedDraft writes nothing when everything is confirmed', () => {
  const store = memStorage()
  keepUnsavedDraft([idea('a')], [idea('a')], 'draft', store)
  assert.equal(store.getItem('draft'), null)
})

test('saveIdeas returns the revision and the list the server kept', async () => {
  const merged = [idea('a', { status: 'approved' })]
  globalThis.fetch = async () => new Response(JSON.stringify(merged), { status: 200, headers: { ETag: '"7"' } })
  const out = await saveIdeas([idea('a', { status: 'waiting' })], '"6"')
  assert.equal(out.rev, '"7"')
  assert.deepEqual(out.items, merged)
})

test('saveIdeas still raises IdeasConflict on 409', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ideas: [idea('x')] }), { status: 409, headers: { ETag: '"9"' } })
  await assert.rejects(saveIdeas([], '"1"'), IdeasConflict)
})

test('sameIdeaList ignores field order but not content', () => {
  assert.equal(sameIdeaList([{ id: 'a', status: 's' }], [{ status: 's', id: 'a' }]), true)
  assert.equal(sameIdeaList([idea('a')], [idea('a', { status: 'approved' })]), false)
  assert.equal(sameIdeaList([idea('a')], []), false)
})

test('withoutSamples drops the built-in sample ids', () => {
  assert.deepEqual(withoutSamples([{ id: 's1' }, { id: 'mine' }], [{ id: 's1' }]), [{ id: 'mine' }])
})
