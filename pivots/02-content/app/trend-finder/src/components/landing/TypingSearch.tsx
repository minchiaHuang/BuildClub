import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../lib/motion'
import { PlatformLogo } from '../PlatformToggles'
import type { LogoPlatform } from '../PlatformToggles'

// Landing-page search bar that types out the kind of trend research agencies do in Remake, one platform at a time.
// Decorative: it shows what the product does; the real search is inside the dashboard.
const SEARCHES: { platform: LogoPlatform; text: string }[] = [
  { platform: 'tiktok', text: 'Trending tofu recipes this week' },
  { platform: 'tiktok', text: 'Crispy tofu ASMR, is it still rising?' },
  { platform: 'instagram', text: 'Tofu blind taste test reels' },
  { platform: 'tiktok', text: 'Trending food formats this week' },
  { platform: 'instagram', text: 'Breakout reels from small cafe accounts' },
  { platform: 'youtube', text: 'Shorts beating their usual views in fitness' },
]

export function TypingSearch({ variant }: { variant: 'altitude' }) {
  const reduced = usePrefersReducedMotion()
  const [i, setI] = useState(0)
  const [len, setLen] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const full = SEARCHES[i].text

  useEffect(() => {
    if (reduced) return
    const done = !deleting && len === full.length
    const empty = deleting && len === 0
    const delay = done ? 1600 : empty ? 300 : deleting ? 28 : 65
    const t = window.setTimeout(() => {
      if (done) setDeleting(true)
      else if (empty) {
        setDeleting(false)
        setI((n) => (n + 1) % SEARCHES.length)
      } else setLen((n) => n + (deleting ? -1 : 1))
    }, delay)
    return () => window.clearTimeout(t)
  }, [len, deleting, full, reduced])

  const shown = reduced ? full : full.slice(0, len)
  const searching = !reduced && !deleting && len === full.length

  return (
    <div className={`tsearch tsearch-${variant}`} aria-hidden="true">
      <span className="tsearch-platform" key={i}>
        <PlatformLogo platform={SEARCHES[i].platform} size={22} />
      </span>
      <span className="tsearch-text">
        {shown}
        <span className="tsearch-caret" />
      </span>
      <span className={`tsearch-go ${searching ? 'is-searching' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
    </div>
  )
}
