import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickInitialIdeas } from '../src/lib/migrateLocal.ts'
import { rebaseIdeas, changedIdeas } from '../src/lib/ideasSync.ts'

const idea = (id, extra = {}) => ({ id, videoId: 'v' + id, clientId: 'c', status: 'saved', dueDate: '', notes: '', ...extra })

test('nothing on the server and not migrated: upload the local ideas', () => {
  const local = [idea('a'), idea('b')]
  assert.deepEqual(pickInitialIdeas(null, local, false), { ideas: local, upload: true })
})

test('the server already has ideas: they win and nothing is uploaded', () => {
  const remote = [idea('a')]
  assert.deepEqual(pickInitialIdeas(remote, [idea('a'), idea('b')], false), { ideas: remote, upload: false })
})

test('already migrated: always the server copy, never an upload', () => {
  assert.deepEqual(pickInitialIdeas(null, [idea('a')], true), { ideas: [], upload: false })
  const remote = [idea('z')]
  assert.deepEqual(pickInitialIdeas(remote, [idea('a')], true), { ideas: remote, upload: false })
})

test('no local ideas to move: nothing to upload', () => {
  assert.deepEqual(pickInitialIdeas(null, null, false), { ideas: [], upload: false })
  assert.deepEqual(pickInitialIdeas(null, [], false), { ideas: [], upload: false })
})

test('rebaseIdeas puts my edit on top of the other tab\'s list', () => {
  const base = [idea('a'), idea('b')]
  const mine = [idea('a', { notes: 'mine' }), idea('b'), idea('c')]
  const theirs = [idea('a'), idea('b', { status: 'waiting' })]
  const out = rebaseIdeas(base, mine, theirs)
  assert.equal(out.find((i) => i.id === 'a').notes, 'mine')
  assert.equal(out.find((i) => i.id === 'b').status, 'waiting')
  assert.ok(out.some((i) => i.id === 'c'))
})

test('rebaseIdeas applies my delete but keeps what the other tab added', () => {
  const base = [idea('a'), idea('b')]
  const mine = [idea('b')]
  const theirs = [idea('a'), idea('b'), idea('d')]
  assert.deepEqual(rebaseIdeas(base, mine, theirs).map((i) => i.id).sort(), ['b', 'd'])
})

test('changedIdeas lists only added or edited ideas', () => {
  const base = [idea('a'), idea('b')]
  const now = [idea('a', { notes: 'x' }), idea('b'), idea('c')]
  assert.deepEqual(changedIdeas(base, now).map((i) => i.id), ['a', 'c'])
})
