import type { Platform } from '../types'
import { platformName } from '../lib/metrics'

const tiktokPath =
  'M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'

export function PlatformLogo({ platform, size = 18 }: { platform: Platform | 'youtube'; size?: number }) {
  if (platform === 'tiktok') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
        <path d={tiktokPath} fill="#25F4EE" transform="translate(-0.7 -0.7)" />
        <path d={tiktokPath} fill="#FE2C55" transform="translate(0.7 0.7)" />
        <path d={tiktokPath} fill="var(--tiktok)" />
      </svg>
    )
  }
  if (platform === 'instagram') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig-grad)" />
        <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.9" />
        <circle cx="16.4" cy="7.6" r="1.1" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" />
      <path d="M10 8.8v6.4l5.4-3.2z" fill="#fff" />
    </svg>
  )
}

interface Props {
  selected: Platform[]
  onChange: (next: Platform[]) => void
  showSoon?: boolean
  // Live search covers TikTok only for now, so Instagram shows as coming soon.
  live?: boolean
}

const all: Platform[] = ['instagram', 'tiktok']

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
      {showSoon && (
        <button type="button" className="platform platform-soon" disabled title="Coming later">
          <PlatformLogo platform="youtube" />
          YouTube Shorts
          <span className="soon">Soon</span>
        </button>
      )}
    </div>
  )
}
