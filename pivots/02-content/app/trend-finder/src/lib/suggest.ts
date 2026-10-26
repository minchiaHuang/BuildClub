import type { KeyboardEvent } from 'react'
import type { Format, Video } from '../types'
import { formatTrend, stageOrder } from './metrics'
import { matchesKeyword, parseQuery } from './parseQuery'

export interface Suggestion {
  label: string
  // The full search text if this suggestion is picked.
  value: string
  // 'refine' adds to what she typed; 'question' is a finished question that runs straight away.
  kind: 'refine' | 'question'
}

const MAX = 5
const questionStart = /^(why|what|which|how|is|are|should|can|does|do)\b/i

// Formats that exist for the words typed so far, most promising first (Early before Everywhere).
function formatsFor(keywords: string[], formats: Format[], videos: Video[]): Format[] {
  const byId = new Map(formats.map((f) => [f.id, f]))
  const pool = keywords.length
    ? videos.filter((v) => keywords.some((k) => matchesKeyword(v, byId.get(v.formatId), k)))
    : videos
  return formats
    .filter((f) => pool.some((v) => v.formatId === f.id))
    .map((f) => formatTrend(f, pool))
    .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage])
    .map((t) => t.format)
}

function questionSuggestions(text: string, formats: Format[], videos: Video[]): Suggestion[] {
  const typed = text.trim().toLowerCase()
  const interp = parseQuery(text.replace(questionStart, ''), formats)
  const found = formatsFor(interp.keywords, formats, videos)
  const audiences = [...new Set(found.flatMap((f) => f.audiences))]

  const questions = [
    ...found.map((f) => `why ${f.short.endsWith('s') ? 'are' : 'is'} ${f.short} trending?`),
    ...audiences.map((a) => `what tofu videos work for ${a}?`),
    "what's trending in tofu this week?",
    ...found.map((f) => `is ${f.short} still worth copying?`),
    ...found.map((f) => `how do I film ${f.short}?`),
  ]

  // Keep questions that start the same way and contain every other word she typed
  // (the last word can be half-typed), so "why is tofu" still offers "why is crispy tofu trending?".
  const [firstWord, ...rest] = typed.split(/\s+/)
  const filler = new Set(['is', 'are', 'the', 'a', 'do', 'does', 'i'])
  const needed = rest.filter((w) => !filler.has(w))
  return [...new Set(questions)]
    .filter((q) => q.startsWith(firstWord) && q !== typed)
    .filter((q) => {
      const qWords = q.replace(/[?']/g, ' ').split(/\s+/)
      return needed.every((w) => qWords.some((qw) => qw.startsWith(w)))
    })
    .slice(0, MAX)
    .map((q) => ({ label: q, value: q, kind: 'question' }))
}

function refineSuggestions(text: string, formats: Format[], videos: Video[]): Suggestion[] {
  const base = text.replace(/\s+$/, '')
  const words = base.split(' ')
  const last = words[words.length - 1].toLowerCase()

  // Half-typed word: offer to finish it ("tofu des" -> "tofu desserts").
  const completing = formats
    .flatMap((f) => [f.short.split(' ').find((w) => w !== 'tofu') ?? '', ...f.tags])
    .filter((w) => w && w !== last && w.startsWith(last) && last.length >= 2)
  if (completing.length && !text.endsWith(' ')) {
    const head = words.slice(0, -1).join(' ')
    // Drop "dessert" when "desserts" is also offered.
    const unique = [...new Set(completing)].filter((w, _, all) => !all.includes(`${w}s`))
    return unique.slice(0, MAX).map((w) => ({
      label: w,
      value: `${head ? `${head} ` : ''}${w}`,
      kind: 'refine' as const,
    }))
  }

  const interp = parseQuery(base, formats)
  if (interp.keywords.length === 0 && interp.topics.length === 0) return []
  const found = formatsFor(interp.keywords, formats, videos)
  if (found.length === 0) return []

  const out: Suggestion[] = []
  const justNiche = interp.topics.length === 0 && interp.keywords.length === 1 && !interp.audience

  if (interp.topics.length === 0) {
    for (const f of found.slice(0, 3)) {
      // "tofu" -> "crispy tofu"; anything longer just gets the format word added.
      const word = f.tags[0]
      const label = f.short.replace(/\btofu\b/, '').trim()
      out.push({ label: `+ ${label}`, value: justNiche ? f.short : `${base} ${word}`, kind: 'refine' })
    }
  }
  if (!interp.audience) {
    const pool = interp.topics.length ? found.filter((f) => interp.topics.some((t) => t.formatId === f.id)) : found
    const audience = pool.flatMap((f) => f.audiences)[0]
    if (audience) out.push({ label: `+ for ${audience}`, value: `${base} for ${audience}`, kind: 'refine' })
  }
  if (!interp.days) out.push({ label: '+ this week', value: `${base} this week`, kind: 'refine' })
  if (!interp.platforms) out.push({ label: '+ on TikTok', value: `${base} on TikTok`, kind: 'refine' })
  if (!interp.maxLength) out.push({ label: '+ under 30 sec', value: `${base} under 30 seconds`, kind: 'refine' })

  return out.slice(0, MAX)
}

export function suggest(text: string, formats: Format[], videos: Video[]): Suggestion[] {
  const t = text.trimStart()
  if (!t || /https?:\/\//i.test(t)) return []
  return questionStart.test(t) ? questionSuggestions(t, formats, videos) : refineSuggestions(text, formats, videos)
}

// Lets ↓ in a search box jump into the suggestion chips below it.
export function focusFirstSuggestion(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'ArrowDown') return
  const first = e.currentTarget.closest('.search-box, .results')?.querySelector<HTMLButtonElement>('.suggestion')
  if (first) {
    e.preventDefault()
    first.focus()
  }
}
