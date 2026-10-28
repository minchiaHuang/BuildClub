import { useEffect, useMemo, useState } from 'react'
import type { Format, Video } from '../types'
import { suggest } from '../lib/suggest'
import type { Suggestion } from '../lib/suggest'
import { useLiveInfo } from '../lib/useLiveInfo'

interface Props {
  text: string
  formats: Format[]
  videos: Video[]
  onRefine: (value: string) => void
  onAsk: (value: string) => void
  inputId: string
  // Shown when there's nothing to suggest (e.g. an empty box).
  fallback?: React.ReactNode
}

// Wait until typing pauses so the chips don't flicker on every key.
function useSettled(value: string, ms = 150) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

// Past searches and client topics from the server; an older answer never replaces a newer one.
function usePastSearches(text: string, live: boolean): string[] {
  const [found, setFound] = useState<{ q: string; queries: string[] }>({ q: '', queries: [] })
  useEffect(() => {
    if (!live || !text.trim()) return
    let current = true
    fetch(`/api/suggest?q=${encodeURIComponent(text)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => current && Array.isArray(d?.queries) && setFound({ q: text, queries: d.queries }))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [text, live])
  return live && found.q === text ? found.queries : []
}

export function Suggestions({ text, formats, videos, onRefine, onAsk, inputId, fallback = null }: Props) {
  const settled = useSettled(text)
  const live = useLiveInfo().mode === 'live'
  const past = usePastSearches(settled, live)
  const items = useMemo<Suggestion[]>(() => {
    if (!live) return suggest(settled, formats, videos)
    const real = past.map((q) => ({ label: q, value: q, kind: 'refine' as const }))
    // In live mode only questions come from the rules; sample-format chips are left out.
    const rules = suggest(settled, formats, videos).filter((s) => s.kind === 'question')
    return [...real, ...rules.filter((r) => !past.includes(r.value))]
  }, [live, past, settled, formats, videos])
  if (items.length === 0) return <>{fallback}</>

  const pick = (s: Suggestion) => {
    if (s.kind === 'question') onAsk(s.value)
    else {
      onRefine(s.value)
      // Keep typing after adding a chip.
      document.getElementById(inputId)?.focus()
    }
  }

  // Arrow keys move between chips; Escape or ↑ goes back to the search box.
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const buttons = [...(e.currentTarget.parentElement?.querySelectorAll('button') ?? [])]
    const i = buttons.indexOf(e.currentTarget)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      buttons[Math.min(i + 1, buttons.length - 1)]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (i === 0) document.getElementById(inputId)?.focus()
      else buttons[i - 1]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'Escape') {
      e.preventDefault()
      document.getElementById(inputId)?.focus()
    }
  }

  const questions = items[0].kind === 'question'
  return (
    <div className="suggest" aria-live="polite">
      <span className="field-label">{questions ? 'Ask:' : 'Narrow it down:'}</span>
      <div className="suggest-list">
        {items.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`suggestion suggestion-${s.kind}`}
            onClick={() => pick(s)}
            onKeyDown={onKeyDown}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
