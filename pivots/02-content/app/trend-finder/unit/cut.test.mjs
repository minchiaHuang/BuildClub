import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_MUSIC_BYTES,
  SPEEDS,
  canStartCut,
  checkMusic,
  deleteMusic,
  formatDuration,
  getCut,
  musicType,
  pollCut,
  putMusic,
  startCut,
} from '../src/lib/cut.ts'

const state = (status, extra = {}) => ({ status, progress: 0, step: '', speed: 1.1, stale: false, music: null, ...extra })

function fakeFetch(responses) {
  const calls = []
  const orig = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    const next = responses.length > 1 ? responses.shift() : responses[0]
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 })
  }
  return { calls, restore: () => (globalThis.fetch = orig) }
}

test('constants', () => {
  assert.equal(MAX_MUSIC_BYTES, 30 * 1024 * 1024)
  assert.deepEqual(SPEEDS, [1, 1.1, 1.25])
})

test('musicType falls back to the extension, case-insensitively', () => {
  assert.equal(musicType({ name: 'a.MP3', type: '' }), 'audio/mpeg')
  assert.equal(musicType({ name: 'a.m4a', type: '' }), 'audio/mp4')
  assert.equal(musicType({ name: 'a.WAV', type: '' }), 'audio/wav')
  assert.equal(musicType({ name: 'a.mp3', type: 'audio/mpeg' }), 'audio/mpeg')
  assert.equal(musicType({ name: 'a.wav', type: 'audio/x-wav' }), 'audio/x-wav')
  assert.equal(musicType({ name: 'a.mp3', type: 'video/mp4' }), null)
  assert.equal(musicType({ name: 'a.ogg', type: '' }), null)
  assert.equal(musicType({ name: 'a.m4a', type: 'audio/x-m4a' }), 'audio/mp4')
  assert.equal(musicType({ name: 'a.mp3', type: 'audio/mp3' }), 'audio/mpeg')
  assert.equal(musicType({ name: 'a.wav', type: 'audio/wave' }), 'audio/wav')
  assert.equal(musicType({ name: 'a.ogg', type: 'audio/ogg' }), null)
  assert.equal(musicType({ name: 'a.mp3', type: 'text/plain' }), null)
  assert.equal(checkMusic({ name: 'a.m4a', type: 'audio/x-m4a', size: 10 }), null)
})

test('checkMusic uses the server copy', () => {
  assert.equal(checkMusic({ name: 'a.mp3', type: 'audio/mpeg', size: MAX_MUSIC_BYTES + 1 }), 'The music file is over the 30 MB limit.')
  assert.equal(checkMusic({ name: 'a.txt', type: 'text/plain', size: 10 }), 'Upload an .mp3, .m4a or .wav audio file.')
  assert.equal(checkMusic({ name: 'a.mp3', type: 'audio/mpeg', size: MAX_MUSIC_BYTES }), null)
})

test('canStartCut needs an approved plan, all shots chosen, and no active cut', () => {
  const ok = { status: 'approved', shotsDone: 3, shotsTotal: 3, active: false }
  assert.equal(canStartCut(ok), true)
  assert.equal(canStartCut({ ...ok, shotsDone: 2 }), false)
  assert.equal(canStartCut({ ...ok, shotsDone: 0, shotsTotal: 0 }), false)
  assert.equal(canStartCut({ ...ok, active: true }), false)
  assert.equal(canStartCut({ ...ok, status: 'saved' }), false)
  assert.equal(canStartCut({ ...ok, status: 'rejected' }), false)
})

test('formatDuration', () => {
  assert.equal(formatDuration(75), '1:15')
  assert.equal(formatDuration(5), '0:05')
  assert.equal(formatDuration(59.6), '1:00')
  assert.equal(formatDuration(0), '0:00')
})

test('getCut, startCut and deleteMusic hit the right routes', async () => {
  const f = fakeFetch([{ body: state('none') }])
  try {
    await getCut('a b')
    await startCut('a b', 3, 1.25)
    await deleteMusic('a b')
    await getCut('a b', 2)
  } finally {
    f.restore()
  }
  assert.equal(f.calls[0].url, '/api/ideas/a%20b/cut')
  assert.equal(f.calls[1].url, '/api/ideas/a%20b/cut')
  assert.equal(f.calls[1].init.method, 'POST')
  assert.deepEqual(JSON.parse(f.calls[1].init.body), { shotCount: 3, speed: 1.25 })
  assert.equal(f.calls[1].init.headers['content-type'], 'application/json')
  assert.equal(f.calls[2].url, '/api/ideas/a%20b/cut/music')
  assert.equal(f.calls[2].init.method, 'DELETE')
  assert.equal(f.calls[3].url, '/api/ideas/a%20b/cut?shots=2')
})

test('API errors surface the server sentence, else the fallback', async () => {
  let f = fakeFetch([{ status: 409, body: { error: 'Choose a take for shot 3 first.' } }])
  try {
    await assert.rejects(startCut('i', 3, 1.1), { message: 'Choose a take for shot 3 first.' })
  } finally {
    f.restore()
  }
  f = fakeFetch([{ status: 500, body: {} }])
  try {
    await assert.rejects(getCut('i'), { message: "Couldn't load the cut." })
  } finally {
    f.restore()
  }
})

test('putMusic sends the licence header, type and encoded filename', async () => {
  const f = fakeFetch([{ body: state('none', { music: { name: 'é.mp3', size: 3 } }) }])
  let res
  try {
    res = await putMusic('i', new File(['abc'], 'é song.mp3', { type: 'audio/mpeg' }))
  } finally {
    f.restore()
  }
  const { url, init } = f.calls[0]
  assert.equal(url, '/api/ideas/i/cut/music')
  assert.equal(init.method, 'PUT')
  assert.equal(init.headers['x-license-confirmed'], 'yes')
  assert.equal(init.headers['content-type'], 'audio/mpeg')
  assert.equal(init.headers['x-filename'], encodeURIComponent('é song.mp3'))
  assert.equal(res.music.size, 3)
})

test('putMusic sends the canonical type for a non-canonical browser type', async () => {
  const f = fakeFetch([{ body: state('none') }])
  try {
    await putMusic('i', new File(['abc'], 'song.m4a', { type: 'audio/x-m4a' }))
  } finally {
    f.restore()
  }
  assert.equal(f.calls[0].init.headers['content-type'], 'audio/mp4')
})

test('pollCut reports each state and resolves on done', async () => {
  const f = fakeFetch([
    { body: state('running') },
    { body: state('running') },
    { body: state('done', { output: { url: 'u', size: 1, durationSec: 2 } }) },
  ])
  const seen = []
  let final
  try {
    final = await pollCut('i', (s) => seen.push(s.status), { intervalMs: 1 })
  } finally {
    f.restore()
  }
  assert.deepEqual(seen, ['running', 'running', 'done'])
  assert.equal(final.status, 'done')
  assert.equal(f.calls.length, 3)
})

test('pollCut resolves (does not throw) with a failed state', async () => {
  const f = fakeFetch([{ body: state('failed', { error: 'boom' }) }])
  let final
  try {
    final = await pollCut('i', () => {}, { intervalMs: 1 })
  } finally {
    f.restore()
  }
  assert.equal(final.status, 'failed')
  assert.equal(final.error, 'boom')
})

test('pollCut resolves null and stops fetching once aborted', async () => {
  const f = fakeFetch([{ body: state('running') }])
  const ctl = new AbortController()
  let calls = 0
  let final
  try {
    final = await pollCut(
      'i',
      () => {
        calls += 1
        if (calls === 2) ctl.abort()
      },
      { signal: ctl.signal, intervalMs: 1 },
    )
    const fetched = f.calls.length
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(f.calls.length, fetched)
    assert.equal(fetched, 2)
  } finally {
    f.restore()
  }
  assert.equal(final, null)
})

test('pollCut with an already-aborted signal never fetches', async () => {
  const f = fakeFetch([{ body: state('running') }])
  const ctl = new AbortController()
  ctl.abort()
  let final
  try {
    final = await pollCut('i', () => {}, { signal: ctl.signal, intervalMs: 1 })
  } finally {
    f.restore()
  }
  assert.equal(final, null)
  assert.equal(f.calls.length, 0)
})
