import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../lib/motion'
import { PlatformLogo } from '../PlatformToggles'
import type { LogoPlatform } from '../PlatformToggles'

// Search-page hero for the Altitude direction. Owned by the Altitude theme; renders only when that theme is on.
const PHRASES = ['Find what’s trending.', 'Spot breakouts early.', 'Plan the next video.']
// The platforms that pop out of the horizon, centre first.
const ICONS: LogoPlatform[] = ['tiktok', 'instagram', 'youtube', 'reddit', 'x']

// `children` is the search box, placed in the middle of the hero.
export function AltitudeHero({ clientName, children }: { clientName: string; children?: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduced || paused) return
    const t = window.setInterval(() => setI((n) => (n + 1) % PHRASES.length), 2600)
    return () => window.clearInterval(t)
  }, [reduced, paused])

  return (
    <header className="alt-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="alt-sky" aria-hidden="true">
        <span className="alt-cloud c1" />
        <span className="alt-cloud c2" />
        <span className="alt-cloud c3" />
        <span className="alt-cloud c4" />
      </div>
      <div className="alt-ground" aria-hidden="true" />
      <div className="alt-hero-inner">
        <span className="alt-eyebrow">Trend research for {clientName}</span>
        <h1 className="alt-headline">
          <span className="alt-left" aria-live={reduced ? undefined : 'polite'}>
            <span className="alt-rot">
              {PHRASES.map((p, n) => (
                <span key={p} className={n === i ? 'is-on' : n === (i + PHRASES.length - 1) % PHRASES.length ? 'is-out' : ''} aria-hidden={n !== i}>
                  {p}
                </span>
              ))}
            </span>
          </span>
          <span className="alt-icons" aria-hidden="true">
            {ICONS.map((p, n) => (
              <span key={p} className={`alt-icon i${n}`} style={{ '--n': n } as React.CSSProperties}>
                <PlatformLogo platform={p} size={n === 0 ? 64 : 44} />
              </span>
            ))}
          </span>
          <span className="alt-right">One place for every client.</span>
        </h1>
        <p className="alt-lede">Search TikTok, see which small accounts are beating their size, and turn the best one into a plan your client can approve.</p>
        {children && <div className="alt-search">{children}</div>}
      </div>
    </header>
  )
}
