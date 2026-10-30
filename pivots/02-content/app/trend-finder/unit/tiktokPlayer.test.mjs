import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '../src/lib/tiktokPlayer.ts'

test('tiktokVideoId reads the numeric id', () => {
  assert.equal(t.tiktokVideoId('https://www.tiktok.com/@a/video/7123456789012345678?x=1'), '7123456789012345678')
  assert.equal(t.tiktokVideoId('https://www.tiktok.com/@a'), undefined)
  assert.equal(t.tiktokVideoId(undefined), undefined)
})

test('playerUrl preview is muted autoplay without controls', () => {
  const u = new URL(t.playerUrl('42', 'preview'))
  assert.equal(u.origin + u.pathname, 'https://www.tiktok.com/player/v1/42')
  assert.equal(u.searchParams.get('autoplay'), '1')
  assert.equal(u.searchParams.get('muted'), '1')
  assert.equal(u.searchParams.get('controls'), '0')
})

test('playerUrl full has controls and volume button, no autoplay', () => {
  const u = new URL(t.playerUrl('42', 'full'))
  for (const [k, v] of Object.entries({ controls: '1', volume_control: '1', autoplay: '0', music_info: '0', description: '0', rel: '0' })) {
    assert.equal(u.searchParams.get(k), v, k)
  }
  assert.equal(u.searchParams.get('muted'), null)
})

test('parsePlayerMessage accepts only TikTok player messages', () => {
  const ok = { 'x-tiktok-player': true, type: 'onMute', value: true }
  assert.deepEqual(t.parsePlayerMessage('https://www.tiktok.com', ok), { type: 'onMute', value: true })
  assert.equal(t.parsePlayerMessage('https://evil.example', ok), null)
  assert.equal(t.parsePlayerMessage('https://www.tiktok.com', { type: 'onMute' }), null)
  assert.equal(t.parsePlayerMessage('https://www.tiktok.com', 'onMute'), null)
  assert.equal(t.parsePlayerMessage('https://www.tiktok.com', null), null)
  assert.equal(t.parsePlayerMessage('https://www.tiktok.com', { 'x-tiktok-player': true, type: 5 }), null)
})

test('isPlayerError and commandMessage', () => {
  assert.equal(t.isPlayerError({ type: 'onPlayerError', value: { errorCode: 2001 } }), true)
  assert.equal(t.isPlayerError({ type: 'onPlayerReady', value: null }), false)
  assert.deepEqual(t.commandMessage('unMute'), { type: 'unMute', 'x-tiktok-player': true })
})

test('only one preview is active; a failed one frees its slot and is remembered', () => {
  let n = 0
  const off = t.subscribePreviews(() => n++)
  t.setActivePreview('a')
  t.setActivePreview('b')
  assert.equal(t.getActivePreview(), 'b')
  t.releasePreview('a')
  assert.equal(t.getActivePreview(), 'b')
  t.markPreviewFailed('b')
  assert.equal(t.getActivePreview(), null)
  assert.equal(t.isPreviewFailed('b'), true)
  assert.equal(t.isPreviewFailed('a'), false)
  assert.ok(n >= 3)
  off()
})
