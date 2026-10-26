import { useId } from 'react'
import type { Platform } from '../types'
import { platformName } from '../lib/metrics'

const tiktokPath =
  'M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'
const xPath =
  'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.25 6.93zM17.61 20.64h2.04L6.49 3.24H4.3z'

export type LogoPlatform = Platform | 'youtube' | 'reddit' | 'x'

const logoName: Record<LogoPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  reddit: 'Reddit',
  x: 'X',
}

// Round brand marks: each platform's logo inside a circle in its brand colour.
export function PlatformLogo({ platform, size = 18 }: { platform: LogoPlatform; size?: number }) {
  const gradId = useId()
  const common = { 'aria-hidden': true, width: size, height: size, viewBox: '0 0 24 24', className: 'logo-round' } as const
  switch (platform) {
    case 'instagram':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id={gradId} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="12" fill={`url(#${CSS.escape(gradId)})`} />
          <rect x="6.6" y="6.6" width="10.8" height="10.8" rx="3.3" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="15.2" cy="8.8" r="0.8" fill="#fff" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <g transform="translate(6.1 5.7) scale(0.5)">
            <path d={tiktokPath} fill="#25F4EE" transform="translate(-0.9 -0.9)" />
            <path d={tiktokPath} fill="#FE2C55" transform="translate(0.9 0.9)" />
            <path d={tiktokPath} fill="#fff" />
          </g>
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#FF0000" />
          <path d="M9.8 7.9v8.2l6.6-4.1z" fill="#fff" />
        </svg>
      )
    case 'reddit':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <circle cx="6.9" cy="11.4" r="1.3" fill="#fff" />
          <circle cx="17.1" cy="11.4" r="1.3" fill="#fff" />
          <ellipse cx="12" cy="13.8" rx="5.9" ry="4.1" fill="#fff" />
          <circle cx="9.7" cy="13.3" r="0.95" fill="#FF4500" />
          <circle cx="14.3" cy="13.3" r="0.95" fill="#FF4500" />
          <path d="M9.9 15.5q2.1 1.2 4.2 0" fill="none" stroke="#FF4500" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M12 9.7l1.1-3.3 2.4.6" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16.1" cy="7.1" r="1.1" fill="#fff" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <path d={xPath} fill="#fff" transform="translate(6.6 6.6) scale(0.45)" />
        </svg>
      )
  }
}

interface Props {
  selected: Platform[]
  onChange: (next: Platform[]) => void
  showSoon?: boolean
  // Live search covers TikTok only for now, so Instagram shows as coming soon.
  live?: boolean
}

const all: Platform[] = ['instagram', 'tiktok']
const soonPlatforms: LogoPlatform[] = ['youtube', 'reddit', 'x']

// Platform on/off buttons with each platform's logo. At least one stays on.
export function PlatformToggles({ selected, onChange, showSoon = false, live = false }: Props) {
  return (
    <div className="platforms" role="group" aria-label="Platforms">
      {all.map((p) => {
        if (live && p === 'instagram') {
          return (
            <button key={p} type="button" className="platform platform-soon" disabled title="Live Instagram search is coming later">
              <PlatformLogo platform={p} />
              {platformName[p]}
              <span className="soon">Soon</span>
            </button>
          )
        }
        const on = live ? p === 'tiktok' : selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            className={`platform ${on ? 'platform-on' : ''}`}
            aria-pressed={on}
            onClick={() => {
              if (live) return
              const next = on ? selected.filter((x) => x !== p) : [...selected, p]
              if (next.length) onChange(next)
            }}
          >
            <PlatformLogo platform={p} />
            {platformName[p]}
            <span className="platform-check" aria-hidden="true">
              {on ? '✓' : ''}
            </span>
          </button>
        )
      })}
      {showSoon &&
        soonPlatforms.map((p) => (
          <button key={p} type="button" className="platform platform-soon" disabled title={`${logoName[p]} search is coming later`}>
            <PlatformLogo platform={p} />
            {logoName[p]}
            <span className="soon">Soon</span>
          </button>
        ))}
    </div>
  )
}
