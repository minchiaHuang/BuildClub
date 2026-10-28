import { useSyncExternalStore } from 'react'

// Which visual direction the app is wearing. 'base' is the monochrome default; the other two follow
// the Altitude and Unify references. Set with ?ui=altitude in the URL or the switcher; remembered per browser.
export type UiTheme = 'base' | 'altitude' | 'unify' | 'midnight'
export const uiThemes: { id: UiTheme; label: string }[] = [
  { id: 'base', label: 'Current' },
  { id: 'altitude', label: 'Altitude' },
  { id: 'unify', label: 'Unify' },
  { id: 'midnight', label: 'Midnight' },
]

const KEY = 'trend-finder.ui-theme'
const isTheme = (x: unknown): x is UiTheme => x === 'base' || x === 'altitude' || x === 'unify' || x === 'midnight'
const listeners = new Set<() => void>()

function initial(): UiTheme {
  const fromUrl = new URLSearchParams(location.search).get('ui')
  if (isTheme(fromUrl)) return fromUrl
  try {
    const saved = localStorage.getItem(KEY)
    if (isTheme(saved)) return saved
  } catch {
    // Storage blocked: fall back to the default.
  }
  return 'base'
}

let current: UiTheme = initial()
document.documentElement.dataset.ui = current

export function setUiTheme(next: UiTheme) {
  current = next
  document.documentElement.dataset.ui = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Not remembered, still applied.
  }
  listeners.forEach((l) => l())
}

export const useUiTheme = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
