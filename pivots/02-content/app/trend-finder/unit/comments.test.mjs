import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAt, parseAt, sortByTime } from '../src/lib/comments.ts'

test('formatAt shows minutes and seconds, hours only when needed', () => {
  assert.equal(formatAt(0), '0:00')
  assert.equal(formatAt(75.4), '1:15')
  assert.equal(formatAt(3725), '1:02:05')
})

test('sortByTime orders by atSec without changing the input', () => {
  const input = [{ atSec: 12.5 }, { atSec: 3 }, { atSec: 7 }]
  assert.deepEqual(sortByTime(input).map((c) => c.atSec), [3, 7, 12.5])
  assert.deepEqual(input.map((c) => c.atSec), [12.5, 3, 7])
})

test('parseAt reads m:ss, h:mm:ss and plain seconds', () => {
  assert.equal(parseAt('1:15'), 75)
  assert.equal(parseAt('1:02:05'), 3725)
  assert.equal(parseAt('42'), 42)
  assert.equal(parseAt('abc'), null)
  assert.equal(parseAt('1:75'), null)
  assert.equal(parseAt(''), null)
})
