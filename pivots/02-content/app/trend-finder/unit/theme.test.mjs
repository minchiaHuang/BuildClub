import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTheme, readTheme, writeTheme, applyTheme, THEME_KEY } from '../src/lib/theme.ts'

const store = (value) => ({ getItem: () => value, setItem() {} })

test('a saved light or dark is kept', () => {
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('dark'), 'dark')
  assert.equal(readTheme(store('dark')), 'dark')
})

test('a missing or bad value means system', () => {
  for (const bad of [null, undefined, '', 'Dark', 'blue', 3, {}]) assert.equal(parseTheme(bad), 'system')
  assert.equal(readTheme(store(null)), 'system')
  assert.equal(readTheme(store('nope')), 'system')
  assert.equal(readTheme(null), 'system')
})

test('storage that throws means system and never throws out', () => {
  const boom = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readTheme(boom), 'system')
  assert.doesNotThrow(() => writeTheme('dark', boom))
})

test('writeTheme stores under the theme key', () => {
  const seen = {}
  writeTheme('light', { getItem: () => null, setItem: (k, v) => { seen[k] = v } })
  assert.deepEqual(seen, { [THEME_KEY]: 'light' })
})

test('applyTheme sets data-theme, and system removes it', () => {
  const attrs = new Map()
  const root = { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) }
  applyTheme('dark', root)
  assert.equal(attrs.get('data-theme'), 'dark')
  applyTheme('system', root)
  assert.equal(attrs.has('data-theme'), false)
})
