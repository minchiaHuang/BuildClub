import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvalLine, badgeOf, checkMetrics, missingApproval, ideaResultLine, percent, postNote, topicLine, topicsFor } from '../src/lib/publish.ts'

test('checkMetrics accepts whole numbers 0 or more and leaves blanks out', () => {
  const c = checkMetrics({ views: '1200', likes: '0', comments: ' 15 ', shares: '', followers: '' })
  assert.deepEqual(c.values, { views: 1200, likes: 0, comments: 15 })
  assert.deepEqual(c.errors, {})
  assert.equal(c.empty, false)
})

test('checkMetrics takes thousands separators', () => {
  assert.equal(checkMetrics({ views: '12,400' }).values.views, 12400)
  assert.equal(checkMetrics({ views: '12 400' }).values.views, 12400)
})

test('checkMetrics refuses decimals, negatives, exponents and words', () => {
  for (const bad of ['12.5', '-3', '1e3', 'abc', '+5', '9'.repeat(20)]) {
    const c = checkMetrics({ saves: bad })
    assert.ok(c.errors.saves, `${bad} should be refused`)
    assert.equal(c.values.saves, undefined)
  }
})

test('checkMetrics reports empty only when nothing was typed', () => {
  assert.equal(checkMetrics({}).empty, true)
  assert.equal(checkMetrics({ views: '  ' }).empty, true)
  assert.equal(checkMetrics({ views: 'x' }).empty, false)
})

test('topicLine writes the plural and singular lines', () => {
  const t = { topic: 'tofu', ideas: 2, measuredIdeas: 2, totalViews: 24800, avgViews: 12400, avgEngagementRate: 0.0773 }
  assert.equal(topicLine(t), 'Your last 2 tofu videos: 12.4k views avg, 7.7% engagement')
  assert.equal(topicLine({ ...t, ideas: 1, measuredIdeas: 1 }), 'Your last tofu video: 12.4k views, 7.7% engagement')
  assert.equal(topicLine({ ...t, avgEngagementRate: null }), 'Your last 2 tofu videos: 12.4k views avg')
})

test('topicLine is null without numbers', () => {
  assert.equal(topicLine({ topic: 'tofu', ideas: 1, measuredIdeas: 0, totalViews: null, avgViews: null, avgEngagementRate: null }), null)
})

test('percent drops a trailing .0', () => {
  assert.equal(percent(0.05), '5%')
  assert.equal(percent(0.0773), '7.7%')
})

test('topicsFor matches search words and hides topics without numbers', () => {
  const mk = (topic, measuredIdeas, avgViews) => ({ topic, ideas: measuredIdeas, measuredIdeas, totalViews: avgViews, avgViews, avgEngagementRate: null })
  const summary = { ideas: [], topics: [mk('tofu', 2, 100), mk('vegan', 1, 900), mk('noodles', 0, null)] }
  assert.deepEqual(topicsFor(summary, 'crispy Tofu bowl').map((t) => t.topic), ['tofu'])
  assert.deepEqual(topicsFor(summary, '').map((t) => t.topic), ['tofu', 'vegan'])
  assert.deepEqual(topicsFor(summary, 'noodles'), [])
  assert.deepEqual(topicsFor(null, 'tofu'), [])
})

test('ideaResultLine for a board card', () => {
  assert.equal(ideaResultLine({ ideaId: 'a', posts: 1, measuredPosts: 1, views: 12400, engagementRate: 0.077 }), '12.4k views · 7.7% engagement')
  assert.equal(ideaResultLine({ ideaId: 'a', posts: 1, measuredPosts: 0, views: null, engagementRate: null }), null)
  assert.equal(ideaResultLine(undefined), null)
})

test('a fake post is never called published', () => {
  assert.deepEqual(badgeOf({ status: 'published', externalId: 'fake-abc' }, false), { label: 'Simulated', kind: 'wait' })
  assert.deepEqual(badgeOf({ status: 'published', externalId: null }, true), { label: 'Simulated', kind: 'wait' })
  assert.deepEqual(badgeOf({ status: 'published', externalId: 'real-1' }, false), { label: 'Published', kind: 'ok' })
  assert.equal(badgeOf({ status: 'scheduled', externalId: 'fake-x' }, true).label, 'Queued (simulated)')
  assert.equal(badgeOf({ status: 'failed', externalId: null }, true).kind, 'no')
  assert.equal(badgeOf({ status: 'draft', externalId: null }, true).label, 'Draft')
  assert.equal(postNote({ status: 'published', externalId: 'fake-a', platform: 'tiktok' }, true), 'Simulated post: nothing was sent to TikTok')
  assert.equal(postNote({ status: 'published', externalId: 'r', platform: 'tiktok' }, false), null)
})

test('approvalLine names the approver, the time and the version', () => {
  const at = new Date(2026, 10, 2, 14, 5).getTime()
  const cut = { output: { url: 'x', size: 1, durationSec: 1 }, stale: false, review: { status: 'approved', sentAt: at - 1, decidedAt: at } }
  assert.equal(approvalLine(cut, 'Annie'), 'Approved by Annie · 2 Nov 14:05 · this version')
  assert.match(approvalLine({ ...cut, stale: true }, 'Annie'), /older version/)
  assert.equal(approvalLine({ ...cut, review: { status: 'waiting', sentAt: 1 } }, 'Annie'), null)
  assert.equal(approvalLine(null, 'Annie'), null)
})

test('missingApproval explains what is missing', () => {
  const out = { url: 'x', size: 1, durationSec: 1 }
  assert.match(missingApproval('saved', null, 'Annie'), /approve the plan/)
  assert.match(missingApproval('approved', { output: undefined, stale: false, review: null }, 'Annie'), /Make the video first/)
  assert.match(missingApproval('approved', { output: out, stale: false, review: { status: 'waiting', sentAt: 1 } }, 'Annie'), /approve the finished video first/)
  assert.match(missingApproval('approved', { output: out, stale: false, review: null }, 'Annie'), /not sent yet/)
  assert.equal(missingApproval('approved', { output: out, stale: false, review: { status: 'approved', sentAt: 1 } }, 'Annie'), null)
})

test('topicsFor shows topics with identical numbers once', () => {
  const t = (topic) => ({ topic, ideas: 1, measuredIdeas: 1, totalViews: 5, avgViews: 5, avgEngagementRate: 0.1 })
  assert.deepEqual(topicsFor({ ideas: [], topics: [t('tofu'), t('豆腐')] }, '').map((x) => x.topic), ['tofu'])
})
