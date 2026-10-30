import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Video } from '../types'
import { platformName } from '../lib/metrics'
import { PlatformLogo } from './PlatformToggles'
import {
  getActivePreview, isPreviewFailed, markPreviewFailed, playerUrl, releasePreview, sendCommand, setActivePreview, subscribePreviews,
  tiktokVideoId,
} from '../lib/tiktokPlayer.ts'
import { useTiktokFrame } from '../lib/useTiktokFrame.ts'

const hues: Record<string, number> = {
  'crispy-asmr': 32,
  'blind-taste-test': 200,
  'three-ingredient-dessert': 330,
  'buying-wrong': 140,
  'press-hack': 260,
}

// Small controls over a cover (sound, "Watch on TikTok") are spans, not buttons: the tile is itself a button, and nesting is invalid.
function ThumbControl({ label, role, onActivate, className, children }: { label: string; role: 'button' | 'link'; onActivate: () => void; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`thumb-ctl ${className ?? ''}`}
      role={role}
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onActivate()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.stopPropagation()
        e.preventDefault()
        onActivate()
      }}
    >
      {children}
    </span>
  )
}

const SoundIcon = ({ on }: { on: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
    {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
  </svg>
)

// The one mounted hover-preview player. It stays mounted after the pointer leaves (paused, hidden) so a re-hover sends `play`
// instead of loading TikTok again. Mounting it fresh per video gives each player its own ready / muted state.
function PreviewPlayer({ id, hovering }: { id: string; hovering: boolean }) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null)
  const { ready, muted, setMuted } = useTiktokFrame(frame, { initialMuted: true, onFail: () => markPreviewFailed(id) })
  useEffect(() => {
    if (!ready) return
    if (hovering) sendCommand(frame, 'play')
    else {
      // Leaving also turns sound back off, so the next hover starts muted like the first.
      sendCommand(frame, 'pause')
      sendCommand(frame, 'mute')
      setMuted(true)
    }
  }, [ready, hovering, frame, setMuted])
  const showControls = ready && hovering
  return (
    <>
      <iframe
        ref={setFrame}
        className={`thumb-player ${hovering ? '' : 'thumb-player-idle'}`}
        src={playerUrl(id, 'preview')}
        title=""
        allow="autoplay"
        referrerPolicy="origin"
        tabIndex={-1}
        aria-hidden="true"
      />
      {showControls && (
        <ThumbControl
          role="button"
          className="thumb-sound"
          label={muted ? 'Turn sound on' : 'Turn sound off'}
          onActivate={() => {
            sendCommand(frame, muted ? 'unMute' : 'mute')
            setMuted(!muted)
          }}
        >
          <SoundIcon on={!muted} />
        </ThumbControl>
      )}
    </>
  )
}

// Real cover image for live videos; a coloured stand-in for sample data (or if the cover fails to load).
// With `preview`, hovering with a mouse (after a short pause, so scrolling past loads nothing) plays the video muted in place.
// Only one preview player exists app-wide; it is paused, not removed, when the pointer leaves. If TikTok blocks the player
// (rate limit), the cover stays and a "Watch on TikTok" link replaces the preview until the page reloads.
export function Thumb({ video, large = false, preview = false }: { video: Video; large?: boolean; preview?: boolean }) {
  const [broken, setBroken] = useState(false)
  const [hovering, setHovering] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const id = preview && video.live && video.url && video.platform === 'tiktok' ? tiktokVideoId(video.url) : undefined
  const active = useSyncExternalStore(subscribePreviews, getActivePreview) === id
  const failed = useSyncExternalStore(subscribePreviews, () => (id ? isPreviewFailed(id) : false))
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (id) releasePreview(id)
    },
    [id],
  )
  const stop = () => {
    window.clearTimeout(timer.current)
    setHovering(false)
  }
  const hue = hues[video.formatId] ?? 180
  const showImage = video.thumbnail && !broken
  return (
    <div className={`thumb ${large ? 'thumb-lg' : ''} ${showImage ? 'thumb-img' : ''} ${hovering && id && (active || failed) ? 'thumb-has-ctl' : ''}`} style={{ '--hue': hue } as React.CSSProperties}
      onPointerEnter={
        id
          ? (e) => {
              if (e.pointerType !== 'mouse') return
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => {
                setHovering(true)
                if (!isPreviewFailed(id)) setActivePreview(id)
              }, 300)
            }
          : undefined
      }
      onPointerLeave={id ? stop : undefined}
    >
      {showImage && (
        <img
          className={video.platform === 'youtube' ? 'thumb-yt' : undefined}
          src={video.thumbnail}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      )}
      {id && active && !failed && <PreviewPlayer id={id} hovering={hovering} />}
      {failed && hovering && video.url && (
        <ThumbControl role="link" className="thumb-fail" label="Watch on TikTok" onActivate={() => window.open(video.url, '_blank', 'noopener,noreferrer')}>
          Watch on TikTok ↗
        </ThumbControl>
      )}
      <span className={`plat plat-${video.platform}`} title={platformName[video.platform]}>
        <PlatformLogo platform={video.platform} size={large ? 16 : 14} />
        {large && platformName[video.platform]}
      </span>
      {!showImage && <span className="thumb-hook">{video.hook}</span>}
      {video.lengthSec > 0 && (
        <span className="thumb-len">
          {Math.floor(video.lengthSec / 60)}:{String(video.lengthSec % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  )
}
