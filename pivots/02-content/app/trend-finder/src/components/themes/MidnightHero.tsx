// Search-page hero for the Midnight direction. Owned by the Midnight theme; renders only when that theme is on.
import { Pill, type PillSpec } from '../landing/midnight/Pills'
import { useParallax } from '../landing/midnight/useParallax'

const PILLS: PillSpec[] = [
  { label: 'TIKTOK', tone: 'tiktok', platform: 'tiktok', x: '6%', y: '20%', rot: -7, depth: 1, front: true },
  { label: 'INSTAGRAM', tone: 'instagram', platform: 'instagram', x: '74%', y: '14%', rot: 6, depth: 0.4 },
  { label: 'YOUTUBE', tone: 'youtube', platform: 'youtube', x: '80%', y: '62%', rot: -5, depth: 0.95, front: true },
  { label: 'REDDIT', tone: 'reddit', platform: 'reddit', x: '3%', y: '66%', rot: 8, depth: 0.3 },
  { label: 'RISING', tone: 'purple', icon: '📈', x: '28%', y: '6%', rot: 4, depth: 0.25 },
]

export function MidnightHero({ clientName }: { clientName: string }) {
  const ref = useParallax<HTMLDivElement>()
  return (
    <div className="mn-panel mn-panel-compact" ref={ref}>
      <div className="mn-stage">
        {PILLS.map((p, i) => (
          <Pill key={p.label} p={p} i={i} />
        ))}
        <h1 className="mn-headline">
          {clientName}’s next trend,
          <br />
          before it peaks.
        </h1>
      </div>
      <p className="mn-sub">Search a niche. We rank small accounts beating their usual views.</p>
    </div>
  )
}
