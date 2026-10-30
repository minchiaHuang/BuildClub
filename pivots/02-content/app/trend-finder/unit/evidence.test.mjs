import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as e from '../src/lib/evidence.ts'

const UNKNOWN_DAYS = 999
let n = 0
const base = (o = {}) => ({
  denominator: 'median', medianN: 6, baselineFrom: '2026-10-02', baselineTo: '2026-10-24', medianFetchedAt: Date.UTC(2026, 9, 29, 9, 12), ...o,
})
function vid(o = {}) {
  n += 1
  const { baseline, ...rest } = o
  return {
    id: `v${n}`, platform: 'tiktok', handle: `@acct${n}`, hook: '', views: 1000, followers: 5000, medianViews: 100, daysAgo: 5,
    lengthSec: 20, shares: 1, saves: 1, formatId: 'x', keywords: [], live: true,
    baseline: baseline === undefined ? base() : baseline === null ? undefined : baseline, ...rest,
  }
}
const cohort = (accounts, hits) => ({ rows: [], accounts, hits, counted: accounts })

test('limited when the denominator is followers', () => {
  const v = vid({ medianViews: null, followers: 1000, baseline: base({ denominator: 'followers', medianN: null }) })
  assert.equal(e.evidenceOf(v), 'limited')
  assert.equal(e.evidenceOf(vid({ medianViews: null, followers: 1000, baseline: null })), 'limited')
})

test('limited when the median has no N', () => {
  assert.equal(e.evidenceOf(vid({ baseline: base({ medianN: null }) }), cohort(4, 3)), 'limited')
  assert.equal(e.evidenceOf(vid({ baseline: null, medianViews: 100 }), cohort(4, 3)), 'limited')
})

test('limited when posted more than 30 days ago; an unknown date is not', () => {
  assert.equal(e.evidenceOf(vid({ daysAgo: 31 }), cohort(3, 2)), 'limited')
  assert.equal(e.evidenceOf(vid({ daysAgo: 30 }), cohort(3, 2)), 'high')
  const u = vid({ daysAgo: UNKNOWN_DAYS })
  assert.equal(e.evidenceOf(u), 'medium')
  assert.match(e.sourceLine(u) + e.plainLine(u), /Posting date unknown/)
})

test('high needs a median, 3 accounts and 2 hits', () => {
  assert.equal(e.evidenceOf(vid(), cohort(3, 2)), 'high')
  assert.equal(e.evidenceOf(vid(), cohort(3, 1)), 'medium')
  assert.equal(e.evidenceOf(vid()), 'medium')
})

test('medium with 2 hits among only 2 accounts', () => {
  assert.equal(e.evidenceOf(vid(), cohort(2, 2)), 'medium')
})

test('no label for YouTube, X, Reddit', () => {
  for (const platform of ['youtube', 'x', 'reddit']) assert.equal(e.evidenceOf(vid({ platform }), cohort(4, 3)), null)
})

test('instagram gets a level but never high (no cohort)', () => {
  assert.equal(e.evidenceOf(vid({ platform: 'instagram', baseline: base({ medianN: 6 }) })), 'medium')
})

test('no label when there is no denominator', () => {
  assert.equal(e.evidenceOf(vid({ medianViews: null, followers: 0, baseline: null })), null)
})

test('cohort: one row per account, from its newest video, not its best', () => {
  const c = e.cohortOf([
    vid({ handle: '@a', views: 1000, medianViews: 100, daysAgo: 9 }),
    vid({ handle: '@a', views: 150, medianViews: 100, daysAgo: 2 }),
  ])
  assert.equal(c.rows.length, 1)
  assert.equal(c.rows[0].multiple, 1.5)
  assert.equal(c.rows[0].hit, false)
})

test('cohort: 2× is a hit, 1.9× is not; rough rows are listed but not counted', () => {
  const c = e.cohortOf([
    vid({ handle: '@a', views: 200, medianViews: 100 }),
    vid({ handle: '@b', views: 190, medianViews: 100 }),
    vid({ handle: '@c', views: 500, medianViews: 100 }),
    vid({ handle: '@d', views: 5000, medianViews: null, followers: 100, baseline: base({ denominator: 'followers', medianN: null }) }),
  ])
  assert.equal(c.rows.length, 4)
  assert.equal(c.accounts, 4)
  assert.equal(c.counted, 3)
  assert.equal(c.hits, 2)
  const d = c.rows.find((r) => r.handle === '@d')
  assert.equal(d.rough, true)
  assert.equal(d.hit, null)
})

test('cohorts use TikTok videos only', () => {
  const t = [1, 2].map((i) => vid({ handle: `@t${i}` }))
  const ig = [1, 2].map((i) => vid({ handle: `@i${i}`, platform: 'instagram' }))
  const all = [...t, ...ig]
  const pat = { kind: 'sound', label: 'song', accounts: 4, avgScore: 1, videoIds: all.map((v) => v.id) }
  const m = e.cohortsByPattern(all, [pat])
  assert.equal(m.get('song').accounts, 2)
  const byVid = e.cohortsByVideo(all, [pat])
  assert.equal(byVid.get(t[0].id).accounts, 2)
  assert.equal(byVid.has(ig[0].id), false)
})

test('cohortsByVideo maps a video to the first pattern containing it', () => {
  const a = [1, 2, 3].map((i) => vid({ handle: `@a${i}` }))
  const p1 = { kind: 'sound', label: 'one', accounts: 3, avgScore: 1, videoIds: a.map((v) => v.id) }
  const p2 = { kind: 'hashtag', label: 'two', accounts: 1, avgScore: 1, videoIds: [a[0].id] }
  const m = e.cohortsByVideo(a, [p1, p2])
  assert.equal(m.get(a[0].id).accounts, 3)
})

test('plainLine matches the copy table', () => {
  const v = vid({ views: 144270, medianViews: 6300 })
  assert.equal(
    e.plainLine(v, { rows: [], accounts: 4, hits: 3, counted: 4 }),
    "22.9× this account's median (baseline: 6 videos); 4 accounts use this pattern, 3 also hit 2× or more",
  )
  assert.equal(e.plainLine(v), "22.9× this account's median (baseline: 6 videos)")
  const f = vid({ views: 77000, followers: 1000, medianViews: null, baseline: base({ denominator: 'followers', medianN: null }) })
  assert.equal(e.plainLine(f), 'Rough: 77× views ÷ followers')
})

test('formulaLine shows N and the date range, or says the details are missing', () => {
  const v = vid({ views: 144270, medianViews: 6300 })
  assert.equal(e.formulaLine(v), '144k views ÷ 6.3k median (6 videos, 2026-10-02 to 2026-10-24) = 22.9×')
  const old = vid({ views: 144270, medianViews: 6300, baseline: null })
  assert.match(e.formulaLine(old), /Baseline details not recorded/)
  assert.ok(!e.formulaLine(old).includes('NaN'))
})

test('fetchedLine and sourceLine', () => {
  const at = new Date(2026, 9, 31, 14, 2).getTime()
  const med = new Date(2026, 9, 29, 9, 12).getTime()
  const v = vid({ fetchedAt: at, baseline: base({ medianFetchedAt: med }) })
  assert.equal(e.stamp(at), '2026-10-31 14:02')
  assert.equal(e.fetchedLine(v), 'Median fetched 2026-10-29 09:12 · this search fetched 2026-10-31 14:02')
  assert.equal(e.sourceLine(v), 'Public page, fetched 2026-10-31 14:02')
})

test('limitLines: three fixed lines, per-platform', () => {
  const tt = e.limitLines(vid({ saves: 3 }))
  assert.deepEqual(tt, ["We can't see watch time or retention", "These numbers don't mean a copy will go viral"])
  const ig = e.limitLines(vid({ platform: 'instagram', saves: null }))
  assert.deepEqual(ig, [
    "We can't see watch time or retention or saves",
    'Instagram views include paid (boosted) views',
    "These numbers don't mean a copy will go viral",
  ])
})

test('cachedLabel rounds down: 47 hours is 1 day', () => {
  const now = Date.UTC(2026, 9, 30, 12)
  assert.equal(e.cachedLabel(now - 47 * 3600000, now), 'Cached · fetched 1 day ago')
})

test('cachedLabel: today and N days', () => {
  const now = Date.now()
  assert.equal(e.cachedLabel(now, now), 'Cached · fetched today')
  assert.equal(e.cachedLabel(now - 3 * 86400000, now), 'Cached · fetched 3 days ago')
  assert.equal(e.cachedLabel(0, now), 'Cached')
})

test('fillBaseline copies medianViews and every baseline field', () => {
  const fresh = vid({ medianViews: 6300, baseline: base() })
  const old = { ...fresh, medianViews: null, views: 7, fetchedAt: 123, baseline: base({ denominator: 'followers', medianN: null, baselineFrom: null, baselineTo: null, medianFetchedAt: null }) }
  const r = e.fillBaseline(old, fresh)
  assert.equal(r.baseline.denominator, 'median')
  assert.deepEqual(r.baseline, fresh.baseline)
  assert.equal(r.medianViews, 6300)
  assert.equal(r.id, old.id)
  assert.equal(r.views, 7)
  assert.equal(r.fetchedAt, 123)
})

test('followerBand edges', () => {
  assert.equal(e.followerBand(9999), '<10k')
  assert.equal(e.followerBand(10000), '10k–100k')
  assert.equal(e.followerBand(100000), '100k–1M')
  assert.equal(e.followerBand(1000000), '1M+')
  assert.equal(e.followerBand(0), '–')
})
