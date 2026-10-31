import { useEffect, useRef } from 'react'

// Keyboard shortcuts for the results grid. Tiles mark their main button with data-video-id,
// so the shortcuts move real DOM focus (screen readers follow it) and act on the focused tile.

export const resultsShortcuts: { keys: string; label: string }[] = [
  { keys: 'J / K', label: 'Next / previous video' },
  { keys: 'Enter', label: 'Open the focused video' },
  { keys: 'S', label: 'Add to or remove from the shortlist' },
  { keys: 'P', label: 'Shortlist it, or open its plan' },
  { keys: '/', label: 'Search' },
  { keys: 'Esc', label: 'Close' },
  { keys: '?', label: 'Show these shortcuts' },
]

interface Handlers {
  onToggleSave: (videoId: string) => void
  onPlan: (videoId: string) => void
  onToggleHelp: () => void
  onCloseHelp: () => void
  searchInputId: string
}

const tileSelector = '.grid [data-video-id]'

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

function focusedTileId(): string | null {
  const tile = document.activeElement?.closest('.tile')
  return tile?.querySelector<HTMLElement>('[data-video-id]')?.dataset.videoId ?? null
}

function moveFocus(step: 1 | -1) {
  const tiles = [...document.querySelectorAll<HTMLElement>(tileSelector)]
  if (!tiles.length) return
  const tile = document.activeElement?.closest('.tile')
  const current = tiles.findIndex((t) => t.closest('.tile') === tile)
  const next = current === -1 ? 0 : Math.min(Math.max(current + step, 0), tiles.length - 1)
  const el = tiles[next]
  el.focus({ preventScroll: true })
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.closest('.tile')?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
}

export function useResultsShortcuts(handlers: Handlers) {
  // Latest handlers without re-adding the listener on every render.
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(document.activeElement)) return
      // A modal (the video drawer) or overlay is open: it owns the keyboard.
      if (document.querySelector('[aria-modal="true"], .phone-wrap')) return
      const h = ref.current
      if (e.key === '?') {
        e.preventDefault()
        h.onToggleHelp()
        return
      }
      if (e.key === 'Escape') {
        h.onCloseHelp()
        return
      }
      if (e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'j' || key === 'k') {
        e.preventDefault()
        moveFocus(key === 'j' ? 1 : -1)
      } else if (key === 's' || key === 'p') {
        const id = focusedTileId()
        if (!id) return
        e.preventDefault()
        if (key === 's') h.onToggleSave(id)
        else h.onPlan(id)
      } else if (e.key === '/') {
        const input = document.getElementById(h.searchInputId)
        if (!input) return
        e.preventDefault()
        input.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
