import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STEPS, STEP_LABEL, stepOf, shotNeeds, nextAction, flagsOf, patchFor, targetsOf, needsConfirm, STUCK_DAYS } from '../src/lib/steps.ts'

const idea = { id: 'i', videoId: 'v', clientId: 'c', dueDate: '2099-01-01', notes: '', status: 'saved' }
const shot = (o = {}) => ({ time: '0-2s', shot: 'close-up', ...o })
const DAY = 86_400_000
const none = {}

test('six steps in order with English labels', () => {
  assert.deepEqual(STEPS.map((s) => STEP_LABEL[s]), ['Idea', 'Script', 'Storyboard', 'Filming', 'Editing', 'Posted'])
})

test('Idea: saved with no shots, or shots with no lines (old plans)', () => {
  assert.equal(stepOf(idea, [], none), 'idea')
  assert.equal(stepOf(idea, [shot(), shot()], none), 'idea')
  assert.equal(stepOf(idea, [shot({ line: '   ' })], none), 'idea')
})

test('Script: a line on at least one shot, frames missing', () => {
  assert.equal(stepOf(idea, [shot({ line: 'Hi' }), shot()], none), 'script')
  assert.equal(stepOf(idea, [shot({ line: 'Hi', frameImage: '/f/1' }), shot({ line: 'Yo' })], none), 'script')
})

test('Storyboard: every shot has a frame', () => {
  assert.equal(stepOf(idea, [shot({ line: 'a', frameImage: '/f/1' }), shot({ frameImage: '/f/2' })], none), 'storyboard')
})

test('Storyboard: sent for approval, whatever the shots hold', () => {
  assert.equal(stepOf({ ...idea, status: 'waiting' }, [], none), 'storyboard')
  assert.equal(stepOf({ ...idea, status: 'waiting' }, [shot()], none), 'storyboard')
})

test('a sent-back plan goes by its shots again', () => {
  assert.equal(stepOf({ ...idea, status: 'rejected' }, [shot({ line: 'a' })], none), 'script')
  assert.equal(stepOf({ ...idea, status: 'rejected' }, [shot()], none), 'idea')
})

test('Filming: approved with no stage, stage approved or filming', () => {
  const a = { ...idea, status: 'approved' }
  assert.equal(stepOf(a, [], none), 'filming')
  assert.equal(stepOf({ ...a, stage: 'approved' }, [], none), 'filming')
  assert.equal(stepOf({ ...a, stage: 'filming' }, [], none), 'filming')
})

test('Editing: stage editing, or a cut exists', () => {
  const a = { ...idea, status: 'approved' }
  assert.equal(stepOf({ ...a, stage: 'editing' }, [], none), 'editing')
  assert.equal(stepOf(a, [], { cut: true }), 'editing')
  assert.equal(stepOf({ ...a, stage: 'filming' }, [], { cut: true }), 'editing')
})

test('Posted: stage posted, or a published post', () => {
  const a = { ...idea, status: 'approved' }
  assert.equal(stepOf({ ...a, stage: 'posted' }, [], none), 'posted')
  assert.equal(stepOf(a, [], { published: true }), 'posted')
  assert.equal(stepOf({ ...a, stage: 'editing' }, [], { cut: true, published: true }), 'posted')
})

test('a stage left on an unapproved plan is ignored', () => {
  assert.equal(stepOf({ ...idea, stage: 'posted' }, [], none), 'idea')
})

test('a cut or post on an unapproved plan does not move it', () => {
  assert.equal(stepOf(idea, [], { cut: true }), 'idea')
})

test('shotNeeds counts lines and frames still missing', () => {
  assert.deepEqual(shotNeeds([]), { shots: 0, lines: 0, frames: 0 })
  assert.deepEqual(shotNeeds([shot({ line: 'a' }), shot(), shot({ frameImage: '/f' })]), { shots: 3, lines: 2, frames: 2 })
})

test('next action says what moves the card on', () => {
  const m = 'Annie'
  assert.equal(nextAction(idea, [], none, { canDecide: false, manager: m }), 'Add the shot list')
  assert.equal(nextAction(idea, [shot(), shot(), shot()], none, { canDecide: false, manager: m }), 'Write lines for 3 shots')
  assert.equal(nextAction(idea, [shot()], none, { canDecide: false, manager: m }), 'Write lines for 1 shot')
  assert.equal(nextAction(idea, [shot({ line: 'a' }), shot()], none, { canDecide: false, manager: m }), 'Write lines for 1 shot')
  assert.equal(nextAction(idea, [shot({ line: 'a' }), shot({ line: 'b' })], none, { canDecide: false, manager: m }), 'Make frames for 2 shots')
  assert.equal(nextAction(idea, [shot({ line: 'a', frameImage: '/f' })], none, { canDecide: false, manager: m }), 'Send for approval')
  assert.equal(nextAction({ ...idea, status: 'waiting' }, [], none, { canDecide: false, manager: m }), 'Waiting for Annie')
  assert.equal(nextAction({ ...idea, status: 'waiting' }, [], none, { canDecide: true, manager: m }), 'Approve or send back')
  assert.equal(nextAction({ ...idea, status: 'rejected' }, [shot()], none, { canDecide: true, manager: m }), 'Fix it and send it again')
  const a = { ...idea, status: 'approved' }
  assert.equal(nextAction(a, [], none, { canDecide: false, manager: m }), 'Film the shots')
  assert.equal(nextAction({ ...a, stage: 'editing' }, [], none, { canDecide: false, manager: m }), 'Make the video')
  assert.equal(nextAction(a, [], { cut: true }, { canDecide: false, manager: m }), 'Get the video approved, then post it')
  assert.equal(nextAction({ ...a, stage: 'posted' }, [], none, { canDecide: false, manager: m }), 'Posted')
})

test('Stuck: no change for 3 days, with the number of days', () => {
  const now = 100 * DAY
  assert.equal(flagsOf({ ...idea, updatedAt: now - 2 * DAY }, 'idea', none, now).stuckDays, undefined)
  assert.equal(flagsOf({ ...idea, updatedAt: now - 3 * DAY }, 'idea', none, now).stuckDays, 3)
  assert.equal(flagsOf({ ...idea, updatedAt: now - 4.6 * DAY }, 'idea', none, now).stuckDays, 4)
  assert.equal(STUCK_DAYS, 3)
})

test('Stuck uses the newest sign of life: takes, cuts and posts count', () => {
  const now = 100 * DAY
  const old = { ...idea, status: 'approved', updatedAt: now - 10 * DAY }
  assert.equal(flagsOf(old, 'filming', { activityAt: now - DAY }, now).stuckDays, undefined)
  assert.equal(flagsOf(old, 'filming', { activityAt: now - 5 * DAY }, now).stuckDays, 5)
})

test('Stuck: an old plan with no timestamp at all is never flagged', () => {
  assert.equal(flagsOf(idea, 'idea', none, 100 * DAY).stuckDays, undefined)
})

test('Stuck falls back to older timestamps when updatedAt is missing', () => {
  const now = 100 * DAY
  assert.equal(flagsOf({ ...idea, sentAt: now - 6 * DAY }, 'idea', none, now).stuckDays, 6)
  assert.equal(flagsOf({ ...idea, decidedAt: now - 4 * DAY, sentAt: now - 9 * DAY }, 'idea', none, now).stuckDays, 4)
})

test('a posted card is never stuck or overdue', () => {
  const now = new Date(2026, 10, 10).getTime()
  const f = flagsOf({ ...idea, dueDate: '2026-11-01', updatedAt: now - 9 * DAY }, 'posted', none, now)
  assert.deepEqual(f, {})
})

test('Overdue: past the due date, counted in whole days', () => {
  const now = new Date(2026, 10, 10, 15, 0).getTime()
  assert.equal(flagsOf({ ...idea, dueDate: '2026-11-10' }, 'idea', none, now).overdueDays, undefined)
  assert.equal(flagsOf({ ...idea, dueDate: '2026-11-11' }, 'idea', none, now).overdueDays, undefined)
  assert.equal(flagsOf({ ...idea, dueDate: '2026-11-09' }, 'idea', none, now).overdueDays, 1)
  assert.equal(flagsOf({ ...idea, dueDate: '2026-11-08' }, 'idea', none, now).overdueDays, 2)
})

test('Overdue: a missing or odd due date is not flagged', () => {
  const now = new Date(2026, 10, 10).getTime()
  assert.equal(flagsOf({ ...idea, dueDate: '' }, 'idea', none, now).overdueDays, undefined)
  assert.equal(flagsOf({ ...idea, dueDate: 'soon' }, 'idea', none, now).overdueDays, undefined)
})

const frames = [shot({ line: 'a', frameImage: '/f' })]
test('drag: a saved plan with shots can be sent to Storyboard, one without cannot', () => {
  assert.deepEqual(targetsOf(idea, [shot({ line: 'a' })], none, true), ['storyboard'])
  assert.deepEqual(targetsOf(idea, [shot({ line: 'a' })], none, false), ['storyboard'])
  assert.deepEqual(targetsOf(idea, [], none, true), [])
})

test('drag: a plan already at Storyboard unsent cannot be dragged anywhere', () => {
  assert.deepEqual(targetsOf(idea, frames.concat(frames), none, true).filter((t) => t !== 'storyboard'), [])
})

test('drag: only the manager can drop a waiting plan into Filming', () => {
  const w = { ...idea, status: 'waiting' }
  assert.deepEqual(targetsOf(w, frames, none, true), ['filming'])
  assert.deepEqual(targetsOf(w, frames, none, false), [])
})

test('drag: approved plans move between Filming, Editing, Posted and back to Storyboard', () => {
  const a = { ...idea, status: 'approved' }
  assert.deepEqual(targetsOf(a, frames, none, false), ['storyboard', 'editing', 'posted'])
  assert.deepEqual(targetsOf({ ...a, stage: 'editing' }, frames, none, false), ['storyboard', 'filming', 'posted'])
})

test('drag: a drag cannot fake a step the data contradicts', () => {
  const a = { ...idea, status: 'approved', stage: 'editing' }
  // a cut exists, so Filming would still read Editing; a post exists, so nothing but Posted holds
  assert.ok(!targetsOf(a, frames, { cut: true }, false).includes('filming'))
  assert.deepEqual(targetsOf(a, frames, { cut: true, published: true }, false).filter((t) => t !== 'storyboard'), [])
})

test('patchFor: moving to a stage uses the stage move; approving is the board\'s job', () => {
  const a = { ...idea, status: 'approved' }
  assert.equal(patchFor(a, 'editing', none, false, 5).stage, 'editing')
  assert.equal(patchFor(a, 'posted', none, false, 5).postedAt, 5)
  assert.equal(patchFor(a, 'idea', none, false, 5), null)
  assert.equal(patchFor({ ...idea, status: 'waiting' }, 'filming', none, false, 5), null)
  assert.deepEqual(patchFor({ ...idea, status: 'waiting' }, 'filming', none, true, 5), { status: 'approved' })
})

test('only taking an approval back needs confirming', () => {
  const a = { ...idea, status: 'approved' }
  assert.equal(needsConfirm(a, 'storyboard'), true)
  assert.equal(needsConfirm(a, 'editing'), false)
  assert.equal(needsConfirm({ ...idea, status: 'saved' }, 'storyboard'), false)
  assert.equal(needsConfirm({ ...idea, status: 'waiting' }, 'filming'), false)
})
