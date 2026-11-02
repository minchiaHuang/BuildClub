import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  editLine,
  extractPalette,
  mergeFrame,
  mergeScript,
  mergeShotScript,
  purposeFor,
  setPalette,
  toHex,
} from '../src/lib/storyboard.ts'

const shots = () => [
  { time: '0-3s', shot: 'Pour the sauce', line: 'old one' },
  { time: '3-8s', shot: 'Stir', line: 'my own words', edited: true, frameImage: '/f/1.svg', palette: ['#111111'] },
  { time: '8-12s', shot: 'Plate it' },
]
const written = [
  { line: 'new 0', options: ['a', 'b', 'c'], purpose: 'hook' },
  { line: 'new 1', options: ['d'], purpose: 'body' },
  { line: 'new 2', options: [], purpose: 'cta' },
]

test('purposeFor: first hooks, last asks, the rest are body', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => purposeFor(i, 4)), ['hook', 'body', 'body', 'cta'])
  assert.equal(purposeFor(0, 1), 'hook')
})

test('mergeScript keeps edited lines and everything else on the shot', () => {
  const out = mergeScript(shots(), written)
  assert.equal(out[0].line, 'new 0')
  assert.deepEqual(out[0].options, ['a', 'b', 'c'])
  assert.equal(out[0].purpose, 'hook')
  assert.equal(out[0].edited, false)
  assert.equal(out[1].line, 'my own words')
  assert.equal(out[1].edited, true)
  assert.equal(out[1].frameImage, '/f/1.svg')
  assert.equal(out[2].line, 'new 2')
  assert.equal(out[2].shot, 'Plate it')
})

test('mergeScript with force replaces edited lines and clears the flag; frames and palette stay', () => {
  const out = mergeScript(shots(), written, true)
  assert.equal(out[1].line, 'new 1')
  assert.equal(out[1].edited, false)
  assert.equal(out[1].frameImage, '/f/1.svg')
  assert.deepEqual(out[1].palette, ['#111111'])
})

test('mergeScript ignores a shorter answer and does not mutate the input', () => {
  const before = shots()
  const out = mergeScript(before, written.slice(0, 1))
  assert.equal(out[0].line, 'new 0')
  assert.equal(out[2].line, undefined)
  assert.equal(before[0].line, 'old one')
})

test('mergeShotScript changes only that shot and clears its edited flag', () => {
  const out = mergeShotScript(shots(), 1, { line: 'again', options: ['x'], purpose: 'body' })
  assert.equal(out[1].line, 'again')
  assert.equal(out[1].edited, false)
  assert.equal(out[0].line, 'old one')
  assert.equal(out[2].line, undefined)
})

test('editLine sets edited; mergeFrame resets the palette; setPalette stores it', () => {
  assert.equal(editLine(shots(), 0, 'typed')[0].edited, true)
  assert.equal(editLine(shots(), 0, 'typed')[0].line, 'typed')
  const framed = mergeFrame(shots(), 1, '/f/2.svg')
  assert.equal(framed[1].frameImage, '/f/2.svg')
  assert.equal(framed[1].palette, undefined)
  assert.equal(framed[1].line, 'my own words')
  assert.deepEqual(setPalette(shots(), 2, ['#aabbcc'])[2].palette, ['#aabbcc'])
})

// ---- palette -----------------------------------------------------------------------------------

function pixels(parts) {
  const out = []
  for (const [rgba, n] of parts) for (let i = 0; i < n; i++) out.push(...rgba)
  return Uint8ClampedArray.from(out)
}

test('toHex pads and clamps', () => {
  assert.equal(toHex(0, 5, 255), '#0005ff')
  assert.equal(toHex(300, -4, 15.6), '#ff0010')
})

test('extractPalette returns the biggest colours first', () => {
  const data = pixels([[[244, 241, 234, 255], 600], [[228, 87, 46, 255], 250], [[34, 34, 34, 255], 100], [[46, 134, 171, 255], 50]])
  assert.deepEqual(extractPalette(data), ['#f4f1ea', '#e4572e', '#222222', '#2e86ab'])
})

test('extractPalette merges near colours and stops at the count', () => {
  const data = pixels([
    [[200, 0, 0, 255], 300],
    [[222, 20, 10, 255], 200], // a different bucket, but the same red to the eye
    [[0, 200, 0, 255], 100],
    [[0, 0, 200, 255], 90],
    [[200, 200, 0, 255], 80],
    [[0, 200, 200, 255], 70],
    [[120, 120, 120, 255], 60],
  ])
  const out = extractPalette(data, 5)
  assert.equal(out.length, 5)
  assert.equal(out[0], '#c80000')
  assert.ok(!out.includes('#de140a'))
  assert.equal(extractPalette(data, 2).length, 2)
})

test('extractPalette skips transparent pixels and copes with empty data', () => {
  const data = pixels([[[10, 20, 30, 0], 500], [[90, 160, 20, 255], 5]])
  assert.deepEqual(extractPalette(data), ['#5aa014'])
  assert.deepEqual(extractPalette(new Uint8ClampedArray(0)), [])
  assert.deepEqual(extractPalette(pixels([[[1, 2, 3, 10], 20]])), [])
})

test('extractPalette is deterministic on ties', () => {
  const data = pixels([[[255, 0, 0, 255], 10], [[0, 0, 255, 255], 10]])
  assert.deepEqual(extractPalette(data), extractPalette(data))
  assert.equal(extractPalette(data).length, 2)
})
