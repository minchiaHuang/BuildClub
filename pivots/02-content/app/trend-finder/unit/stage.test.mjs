import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, STAGE_LABEL, moveTo, postedThisMonth, stageOf } from '../src/lib/stage.ts'

const base = { id: 'i', videoId: 'v', clientId: 'c', dueDate: '2026-11-02', notes: '' }

test('stages run Ready to film → Filming → Editing → Posted', () => {
  assert.deepEqual(STAGES.map((s) => STAGE_LABEL[s]), ['Ready to film', 'Filming', 'Editing', 'Posted'])
})

test('stageOf: only approved plans have a stage; no stage means Ready to film', () => {
  assert.equal(stageOf({ ...base, status: 'saved' }), null)
  assert.equal(stageOf({ ...base, status: 'waiting', stage: 'filming' }), null)
  assert.equal(stageOf({ ...base, status: 'approved' }), 'approved')
  assert.equal(stageOf({ ...base, status: 'approved', stage: 'editing' }), 'editing')
})

test('moveTo stamps postedAt once and clears it when moved back', () => {
  const a = { ...base, status: 'approved' }
  assert.deepEqual(moveTo(a, 'posted', 100), { stage: 'posted', postedAt: 100 })
  assert.deepEqual(moveTo({ ...a, stage: 'posted', postedAt: 50 }, 'posted', 100), { stage: 'posted', postedAt: 50 })
  assert.deepEqual(moveTo({ ...a, stage: 'posted', postedAt: 50 }, 'editing', 100), { stage: 'editing', postedAt: undefined })
  assert.equal(moveTo({ ...base, status: 'waiting' }, 'filming', 100), null)
})

test('postedThisMonth counts this local month only', () => {
  const now = new Date(2026, 9, 31, 23, 0)
  const p = (t, extra = {}) => ({ ...base, status: 'approved', stage: 'posted', postedAt: t, ...extra })
  const ideas = [
    p(new Date(2026, 9, 1, 0, 0).getTime()),
    p(new Date(2026, 8, 30, 23, 59).getTime()),
    p(new Date(2026, 10, 1, 0, 0).getTime()),
    p(new Date(2026, 9, 5).getTime(), { stage: 'editing' }),
    p(new Date(2026, 9, 5).getTime(), { status: 'waiting' }),
  ]
  assert.equal(postedThisMonth(ideas, now), 1)
})
