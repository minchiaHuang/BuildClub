import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approverNote } from '../src/lib/approverNote.ts'
import { getActiveLang, setActiveLang } from '../src/lib/i18n.ts'

const CJK = /[　-〿㐀-鿿＀-￯]/
const client = { id: 'c1', name: 'Pip Cafe', niche: 'cafe', audience: 'Busy Mums', monthlyTarget: 4, examples: [], cannot: [] }
const format = { id: 'f1', name: 'Latte art', needs: [], needsKnown: true, effort: 'easy', audiences: [] }

test('the note saved for the review link has no Chinese while the UI is zh-Hant', () => {
  setActiveLang('zh-Hant')
  try {
    assert.ok(CJK.test(approverNote(client, format, getActiveLang())), 'sanity: the in-app draft is Chinese')
    const saved = approverNote(client, format, 'en')
    assert.ok(!CJK.test(saved), `saved note has CJK: ${saved}`)
    assert.match(saved, /busy mums/)
    assert.equal(getActiveLang(), 'zh-Hant', 'active language is restored')
  } finally {
    setActiveLang('en')
  }
})
