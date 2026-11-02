import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areas, parseLang, readLang, writeLang, LANG_KEY, interpolate, setActiveLang, t, tp } from '../src/lib/i18n.ts'

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every en key exists in zh-Hant and vice versa, with the same placeholders', () => {
  for (const [area, { en, zhHant }] of Object.entries(areas)) {
    assert.deepEqual(Object.keys(zhHant).sort(), Object.keys(en).sort(), `${area}: key sets differ`)
    for (const key of Object.keys(en)) {
      assert.equal(placeholders(zhHant[key]), placeholders(en[key]), `${key}: placeholders differ`)
      assert.ok(zhHant[key].trim() !== '', `${key}: empty zh-Hant text`)
    }
  }
})

test('keys carry their area prefix, so areas never collide', () => {
  for (const [area, { en }] of Object.entries(areas)) {
    for (const key of Object.keys(en)) assert.ok(key.startsWith(`${area}.`), `${key} should start with ${area}.`)
  }
})

test('every plural base has both .one and .other', () => {
  for (const [area, { en }] of Object.entries(areas)) {
    for (const key of Object.keys(en)) {
      const base = key.match(/^(.*)\.(one|other)$/)?.[1]
      if (base) assert.ok(`${base}.one` in en && `${base}.other` in en, `${area}: ${base} needs .one and .other`)
    }
  }
})

test('parseLang falls back to English', () => {
  assert.equal(parseLang('zh-Hant'), 'zh-Hant')
  for (const bad of [null, undefined, '', 'zh', 'fr', 3]) assert.equal(parseLang(bad), 'en')
})

test('readLang and writeLang survive blocked storage', () => {
  const boom = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readLang(boom), 'en')
  assert.equal(readLang(null), 'en')
  assert.doesNotThrow(() => writeLang('zh-Hant', boom))
  const seen = {}
  writeLang('zh-Hant', { getItem: () => null, setItem: (k, v) => { seen[k] = v } })
  assert.deepEqual(seen, { [LANG_KEY]: 'zh-Hant' })
})

test('interpolate fills placeholders and leaves unknown ones', () => {
  assert.equal(interpolate('Hi {name}, {n} left', { name: 'Annie', n: 3 }), 'Hi Annie, 3 left')
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}')
})

test('t and tp follow the active language', () => {
  setActiveLang('en')
  assert.equal(t('shell.side.sells', { niche: 'tea' }), 'Sells: tea')
  setActiveLang('zh-Hant')
  assert.equal(t('shell.side.sells', { niche: 'tea' }), '販售：tea')
  setActiveLang('en')
  assert.equal(typeof tp, 'function')
})
