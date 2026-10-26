import type { Video } from '../types'
import { platformName } from '../lib/metrics'

const hues: Record<string, number> = {
  'crispy-asmr': 32,
  'blind-taste-test': 200,
  'three-ingredient-dessert': 330,
  'buying-wrong': 140,
  'press-hack': 260,
}

// Stand-in for a real video thumbnail until we have real data.
export function Thumb({ video, large = false }: { video: Video; large?: boolean }) {
  const hue = hues[video.formatId] ?? 180
  return (
    <div className={`thumb ${large ? 'thumb-lg' : ''}`} style={{ '--hue': hue } as React.CSSProperties}>
      <span className={`plat plat-${video.platform}`} title={platformName[video.platform]}>
        {large ? platformName[video.platform] : video.platform === 'tiktok' ? 'TT' : 'IG'}
      </span>
      <span className="thumb-hook">{video.hook}</span>
      <span className="thumb-len">0:{String(video.lengthSec).padStart(2, '0')}</span>
    </div>
  )
}
