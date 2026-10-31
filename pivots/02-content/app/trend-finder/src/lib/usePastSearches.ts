import { useEffect, useState } from 'react'

// Past searches and client topics from the server for what is typed (live mode only).
// Waits for typing to pause, and an older answer never replaces a newer one.
export function usePastSearches(text: string, live: boolean, ms = 150): string[] {
  const [found, setFound] = useState<{ q: string; queries: string[] }>({ q: '', queries: [] })
  useEffect(() => {
    const q = text.trim()
    if (!live || !q) return
    let current = true
    const id = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => current && Array.isArray(d?.queries) && setFound({ q: text, queries: d.queries }))
        .catch(() => {})
    }, ms)
    return () => {
      current = false
      clearTimeout(id)
    }
  }, [text, live, ms])
  return live && text.trim() && found.q === text ? found.queries : []
}
