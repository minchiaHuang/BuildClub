import type { CSSProperties } from 'react'
import { SlotCounter } from './unify/SlotCounter'
import { useLiveInfo } from '../../lib/useLiveInfo'

// Search-page hero for the Unify direction. Owned by the Unify theme; renders only when that theme is on.
export function UnifyHero({ clientName }: { clientName: string }) {
  const { live, stats } = useLiveInfo()
  return (
    <header className="unify-hero">
      <p className="uh-eyebrow">Trend research for {clientName}</p>
      <h1 className="uh-title">
        Find the <em style={{ '--n': 0 } as CSSProperties}>videos</em> your clients should{' '}
        <em style={{ '--n': 1 } as CSSProperties}>copy</em>, before{' '}
        <em style={{ '--n': 2 } as CSSProperties}>everyone else</em> does
      </h1>
      <p className="uh-lede">Search TikTok live, see which videos beat their creator's usual numbers, and send a plan to your client for sign-off.</p>
      <ul className="uh-tags">
        <li>TikTok live search</li>
        <li>Outlier scores</li>
        <li>Approvals built in</li>
      </ul>
      {live ? (
        stats && (
          <p className="uh-count">
            Trend Finder has scanned <SlotCounter value={stats.videosScanned} /> videos
          </p>
        )
      ) : (
        <p className="uh-count">
          <span className="uh-stars" aria-hidden="true">★★★★★</span>
          Trend Finder has scanned <SlotCounter value={1284301} /> videos this month <span className="uh-sample">sample</span>
        </p>
      )}
    </header>
  )
}
