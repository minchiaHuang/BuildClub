import { useState } from 'react'
import type { Video } from '../types'
import { platformName } from '../lib/metrics'
import { PlatformLogo } from './PlatformToggles'

const hues: Record<string, number> = {
  'crispy-asmr': 32,
  'blind-taste-test': 200,
  'three-ingredient-dessert': 330,
  'buying-wrong': 140,
  'press-hack': 260,
}

// Real cover image for live videos; a coloured stand-in for sample data (or if the cover fails to load).
export function Thumb({ video, large = false }: { video: Video; large?: boolean }) {
  const [broken, setBroken] = useState(false)
  const hue = hues[video.formatId] ?? 180
  const showImage = video.thumbnail && !broken
  return (
    <div className={`thumb ${large ? 'thumb-lg' : ''} ${showImage ? 'thumb-img' : ''}`} style={{ '--hue': hue } as React.CSSProperties}>
      {showImage && (
        <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      )}
      <span className={`plat plat-${video.platform}`} title={platformName[video.platform]}>
        <PlatformLogo platform={video.platform} size={large ? 16 : 14} />
        {large && platformName[video.platform]}
      </span>
      {!showImage && <span className="thumb-hook">{video.hook}</span>}
      <span className="thumb-len">
        {Math.floor(video.lengthSec / 60)}:{String(video.lengthSec % 60).padStart(2, '0')}
      </span>
    </div>
  )
}
