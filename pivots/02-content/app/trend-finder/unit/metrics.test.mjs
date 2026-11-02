import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byFollowers, hasScore, outlierScore, scoreLine, usualMultiple } from '../src/lib/metrics.ts'

const vid = (o = {}) => ({
  id: 'v', platform: 'tiktok', handle: '@a', hook: '', views: 10000, followers: 1000, medianViews: 500, daysAgo: 5,
  lengthSec: 20, shares: 0, saves: 0, formatId: 'x', keywords: [], live: true, ...o,
})

test('score is views over followers when followers are known, even with usual views', () => {
  const v = vid()
  assert.equal(byFollowers(v), true)
  assert.equal(outlierScore(v), 10)
  assert.equal(scoreLine(v), '10× more views than followers')
  // The usual-views multiple stays available as secondary info.
  assert.equal(usualMultiple(v), 20)
})

test('falls back to usual views only when followers are unknown or 0', () => {
  const v = vid({ followers: 0, medianViews: 2000 })
  assert.equal(byFollowers(v), false)
  assert.equal(outlierScore(v), 5)
  assert.equal(scoreLine(v), '5 times its usual views')
})

test('reddit uses the subreddit usual upvotes', () => {
  const v = vid({ platform: 'reddit', followers: 0, medianViews: 100, views: 1000 })
  assert.equal(outlierScore(v), 10)
})

test('no score when neither followers nor usual views are known', () => {
  const v = vid({ followers: 0, medianViews: null })
  assert.equal(hasScore(v), false)
  assert.equal(outlierScore(v), 0)
})

test('ranking order follows views over followers', () => {
  const a = vid({ id: 'a', views: 5000, followers: 100, medianViews: 10000 }) // 50x followers, 0.5x usual
  const b = vid({ id: 'b', views: 50000, followers: 10000, medianViews: 1000 }) // 5x followers, 50x usual
  const sorted = [b, a].sort((x, y) => outlierScore(y) - outlierScore(x)).map((v) => v.id)
  assert.deepEqual(sorted, ['a', 'b'])
})
