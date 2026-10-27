import { useEffect, useRef, useState } from 'react'
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

// Muted player embed for a real TikTok video, or null when we can't build one (sample data).
// Instagram is left out: its /embed page never autoplays and shows only a still with a play button.
function previewSrc(video: Video): string | null {
  if (!video.live || !video.url || video.platform !== 'tiktok') return null
  const id = video.url.match(/\/video\/(\d+)/)?.[1]
  return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=1&muted=1&controls=0&loop=1&music_info=0&description=0&rel=0` : null
}

// Real cover image for live videos; a coloured stand-in for sample data (or if the cover fails to load).
// With `preview`, hovering with a mouse (after a short pause, so scrolling past loads nothing) plays the video muted in place.
export function Thumb({ video, large = false, preview = false }: { video: Video; large?: boolean; preview?: boolean }) {
  const [broken, setBroken] = useState(false)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const src = preview ? previewSrc(video) : null
  const stop = () => {
    window.clearTimeout(timer.current)
    setPlaying(false)
  }
  const hue = hues[video.formatId] ?? 180
  const showImage = video.thumbnail && !broken
  return (
    <div className={`thumb ${large ? 'thumb-lg' : ''} ${showImage ? 'thumb-img' : ''}`} style={{ '--hue': hue } as React.CSSProperties}
      onPointerEnter={
        src
          ? (e) => {
              if (e.pointerType !== 'mouse') return
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => setPlaying(true), 300)
            }
          : undefined
      }
      onPointerLeave={src ? stop : undefined}
    >
      {showImage && (
        <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      )}
      {playing && src && (
        <iframe className="thumb-player" src={src} title="" allow="autoplay" referrerPolicy="origin" tabIndex={-1} aria-hidden="true" />
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
