// Floating 3D pill tags with depth of field, used by the Altitude landing.
import type { CSSProperties, ReactNode } from 'react'
import { PlatformLogo, type LogoPlatform } from '../PlatformToggles'

export type PillSpec = {
  label: string
  tone: string
  platform?: LogoPlatform
  icon?: ReactNode
  x: string // left edge in %; above 50 the pill is anchored by its right edge so it stays inside the panel
  y: string
  rot: number
  depth: number // 0 = far (blurred, small), 1 = near (sharp)
  front?: boolean
}

export function Pill({ p, i }: { p: PillSpec; i: number }) {
  const blur = p.depth >= 0.8 ? 0 : (1 - p.depth) * 7
  const right = parseFloat(p.x) > 50
  const style = {
    ...(right ? { right: `${Math.max(2, 88 - parseFloat(p.x))}%` } : { left: p.x }),
    top: p.y,
    '--rot': `${p.rot}deg`,
    '--depth': p.depth,
    '--blur': `${blur.toFixed(1)}px`,
    '--scale': (0.72 + p.depth * 0.32).toFixed(2),
    '--delay': `${-i * 1.3}s`,
    zIndex: p.front ? 3 : 1,
  } as unknown as CSSProperties
  return (
    <span className={`mn-pill mn-tone-${p.tone}${right ? ' mn-pill-r' : ''}`} style={style} aria-hidden="true">
      <span className="mn-pill-body">
        <span className="mn-pill-icon">{p.platform ? <PlatformLogo platform={p.platform} size={22} /> : p.icon}</span>
        {p.label}
      </span>
    </span>
  )
}
