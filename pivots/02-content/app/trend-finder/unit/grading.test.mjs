import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_OPTIONS,
  cueAt,
  cuesChanged,
  formatCueTime,
  isDefaultOptions,
  optionsDiffer,
  previewUrl,
  zoneWarning,
  trimPhrase,
  autoCutLine,
  autoCutByShot,
} from '../src/lib/grading.ts'
import { startCut } from '../src/lib/cut.ts'

const opts = (over = {}) => ({ ...DEFAULT_OPTIONS, ...over })

test('formatCueTime shows minutes, seconds and tenths', () => {
  assert.equal(formatCueTime(0), '0:00.0')
  assert.equal(formatCueTime(3.24), '0:03.2')
  assert.equal(formatCueTime(3.25), '0:03.3')
  assert.equal(formatCueTime(59.96), '1:00.0')
  assert.equal(formatCueTime(75.96), '1:16.0')
  assert.equal(formatCueTime(600), '10:00.0')
})

test('formatCueTime treats bad input as zero', () => {
  assert.equal(formatCueTime(-2), '0:00.0')
  assert.equal(formatCueTime(NaN), '0:00.0')
  assert.equal(formatCueTime(Infinity), '0:00.0')
})

test('optionsDiffer: unknown history claims nothing', () => {
  assert.equal(optionsDiffer(null, opts({ grade: 'warm' })), false)
})

test('optionsDiffer: grade and burn changes differ', () => {
  assert.equal(optionsDiffer(opts(), opts()), false)
  assert.equal(optionsDiffer(opts(), opts({ grade: 'warm' })), true)
  assert.equal(optionsDiffer(opts(), opts({ burnSubtitles: true })), true)
  assert.equal(optionsDiffer(opts({ burnSubtitles: true }), opts()), true)
})

test('optionsDiffer: the style only counts while subtitles are burned in', () => {
  const big = { size: 'L', position: 'bottom', box: true }
  assert.equal(optionsDiffer(opts(), opts({ subtitleStyle: big })), false)
  assert.equal(optionsDiffer(opts({ burnSubtitles: true }), opts({ burnSubtitles: true, subtitleStyle: big })), true)
  assert.equal(optionsDiffer(opts({ burnSubtitles: true }), opts({ burnSubtitles: true, subtitleStyle: { ...DEFAULT_OPTIONS.subtitleStyle, box: false } })), true)
  assert.equal(optionsDiffer(opts({ burnSubtitles: true }), opts({ burnSubtitles: true, subtitleStyle: { ...DEFAULT_OPTIONS.subtitleStyle, position: 'middle' } })), true)
})

test('isDefaultOptions is true only when nothing was chosen', () => {
  assert.equal(isDefaultOptions(opts()), true)
  assert.equal(isDefaultOptions(opts({ subtitleStyle: { size: 'L', position: 'middle', box: false } })), true) // style without burn changes nothing
  assert.equal(isDefaultOptions(opts({ grade: 'bw' })), false)
  assert.equal(isDefaultOptions(opts({ burnSubtitles: true })), false)
})

test('cueAt picks the cue under the playhead', () => {
  const cues = [{ id: 0, start: 0.5, end: 2, text: 'a' }, { id: 1, start: 2, end: 3, text: 'b' }]
  assert.equal(cueAt(cues, 0.2), null)
  assert.equal(cueAt(cues, 0.5).id, 0)
  assert.equal(cueAt(cues, 2).id, 1)
  assert.equal(cueAt(cues, 3), null)
})

test('cuesChanged ignores untouched and reverted drafts', () => {
  const cues = [{ id: 0, start: 0, end: 1, text: 'a' }, { id: 1, start: 1, end: 2, text: 'b' }]
  assert.equal(cuesChanged(cues, {}), false)
  assert.equal(cuesChanged(cues, { 1: 'b' }), false)
  assert.equal(cuesChanged(cues, { 1: 'c' }), true)
})

test('previewUrl encodes the preset', () => {
  assert.equal(previewUrl('i 1', 'warm', 0.5), '/api/ideas/i%201/cut/grade-preview?preset=warm&t=0.5')
})

test('startCut sends only shotCount and speed when nothing extra is chosen', async () => {
  const orig = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ status: 'queued' }), { status: 202 })
  }
  try {
    await startCut('i1', 2, 1.1)
    await startCut('i1', 2, 1.1, { grade: 'warm', burnSubtitles: true, subtitleStyle: { size: 'M', position: 'bottom', box: true } })
  } finally {
    globalThis.fetch = orig
  }
  assert.deepEqual(calls[0].body, { shotCount: 2, speed: 1.1 })
  assert.equal(calls[1].body.grade, 'warm')
  assert.equal(calls[1].body.burnSubtitles, true)
})

const S = { size: 'M', position: 'bottom', box: true }

test('zoneWarning: bottom subtitles collide with TikTok but not Reels; middle is fine', () => {
  assert.match(zoneWarning('tiktok', S), /TikTok/)
  assert.equal(zoneWarning('reels', S), null)
  assert.equal(zoneWarning('tiktok', { ...S, position: 'middle' }), null)
})

const trims = [
  { shot: 0, kind: 'pause', start: 1, end: 2.2 },
  { shot: 0, kind: 'filler', start: 3, end: 3.4 },
  { shot: 1, kind: 'pause', start: 0, end: 0.5 },
]

test('trimPhrase counts and totals each kind', () => {
  assert.equal(trimPhrase(trims), '2 pauses (1.7 s), 1 filler (0.4 s)')
  assert.equal(trimPhrase([trims[1]]), '1 filler (0.4 s)')
  assert.equal(trimPhrase([]), '')
})

test('autoCutLine states what was removed and the lengths', () => {
  assert.equal(autoCutLine({ originalSec: 24.1, trims }, 18.4), 'Removed 2 pauses (1.7 s), 1 filler (0.4 s) · Final length 18.4 s, was 24.1 s')
  assert.equal(autoCutLine({ originalSec: 5, trims: [] }, 5), 'Nothing needed cutting · Final length 5.0 s, was 5.0 s')
  assert.equal(autoCutLine({ originalSec: null, trims: [] }, 5), 'Nothing needed cutting · Final length 5.0 s')
})

test('autoCutByShot is 1-based and skips untouched shots', () => {
  assert.deepEqual(autoCutByShot(trims), [
    { shot: 1, text: '1 pause (1.2 s), 1 filler (0.4 s)' },
    { shot: 2, text: '1 pause (0.5 s)' },
  ])
})
