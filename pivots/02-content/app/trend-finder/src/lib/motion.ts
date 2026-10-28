import { useEffect, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

// Small motion helpers shared by screens. Durations come from the CSS motion tokens in tokens.css.

const reducedQuery = '(prefers-reduced-motion: reduce)'

function subscribeReduced(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(reducedQuery)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const readReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.(reducedQuery).matches

// True when the person has asked the system for less motion.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, () => false)
}

// Reads a duration token such as --dur-slow ("300ms") as milliseconds.
export function tokenMs(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = parseFloat(raw)
  if (Number.isNaN(n)) return fallback
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n
}

// Counts from 0 up to `target` once, and again only when `target` changes (not on every render).
// Returns the target straight away when reduced motion is on.
export function useCountUp(target: number, durationMs?: number): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (reduced) return
    const duration = durationMs ?? tokenMs('--dur-slow', 300)
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = Math.min((now - start) / duration, 1)
      // Ease-out, close to the --ease curve.
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])
  return reduced ? target : value
}

// Runs a screen change inside a View Transition (a short cross-fade on the main area, styled in base.css),
// or instantly where the API is missing or reduced motion is on.
export function withScreenTransition(update: () => void): void {
  const doc = typeof document === 'undefined' ? undefined : (document as Document & { startViewTransition?: (cb: () => void) => unknown })
  if (!doc?.startViewTransition || readReduced()) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}
