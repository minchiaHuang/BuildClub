import { useEffect } from 'react'
import type { Client, Format, Video } from '../types'
import {
  ago,
  compact,
  outlierScore,
  platformName,
  scoreLine,
  shareSaveRate,
  tierName,
  tierOf,
  times,
  viewsPerDay,
} from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  video: Video
  format: Format
  formatAccounts: number
  client: Client
  saved: boolean
  onClose: () => void
  onSave: () => void
  onPlan: () => void
}

export function BreakdownPanel({ video, format, formatAccounts, client, saved, onClose, onSave, onPlan }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const score = outlierScore(video)
  const tier = tierOf(score)
  // The numbers are the point of this panel, so they get their own row of cards.
  const stats = [
    { label: 'Views', value: compact(video.views), note: `${compact(video.followers)} followers` },
    {
      label: 'Shares + saves',
      value: `${shareSaveRate(video).toFixed(1)}`,
      unit: 'per 100 views',
      note: video.saves === null ? 'Instagram hides saves' : `${compact(video.shares)} shares · ${compact(video.saves)} saves`,
    },
    { label: 'Growth', value: compact(viewsPerDay(video)), unit: 'views a day', note: `Posted ${ago(video.daysAgo)}` },
    {
      label: 'Format used by',
      value: String(formatAccounts),
      unit: formatAccounts === 1 ? 'account' : 'accounts',
      note: formatAccounts >= 3 ? 'A pattern, not luck' : 'Too few to be sure',
    },
  ]

  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <span className="eyebrow">
              {platformName[video.platform]} · {video.handle}
            </span>
            <h2 id="drawer-title">"{video.hook}"</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-video">
            <Thumb video={video} large />
          </div>

          <section className="stats" aria-label="Video analytics">
            <div className={`stat-card stat-score stat-${tier}`}>
              <span className="stat-label">Score</span>
              <div className="stat-score-row">
                <span className="stat-big">{times(score)}</span>
                <span className={`tier tier-${tier}`}>{tierName[tier]}</span>
              </div>
              <span className="stat-note">{scoreLine(video)}</span>
              <span className="stat-compare">
                {compact(video.medianViews ?? video.followers)} → <strong>{compact(video.views)}</strong>
              </span>
            </div>
            {stats.map((m) => (
              <div key={m.label} className="stat-card">
                <span className="stat-label">{m.label}</span>
                <span className="stat-value">
                  {m.value}
                  {m.unit && <span className="stat-unit"> {m.unit}</span>}
                </span>
                <span className="stat-note">{m.note}</span>
              </div>
            ))}
          </section>

          {video.live && (
            <section className="block live-facts">
              {video.url && (
                <a className="btn btn-ghost watch-link" href={video.url} target="_blank" rel="noreferrer">
                  Watch on TikTok ↗
                </a>
              )}
              {video.caption && <p className="caption">{video.caption}</p>}
              {video.music && <span className="small muted">Sound: {video.music}</span>}
            </section>
          )}

          <section className="block">
            <h3>
              {video.live ? 'What we know' : 'Why it worked'}{' '}
              <span className="ai-tag">{video.live ? 'From TikTok data' : 'Sample · written by hand'}</span>
            </h3>
            <dl className="why">
              <div>
                <dt>Hook</dt>
                <dd>{format.why.hook}</dd>
              </div>
              <div>
                <dt>First 3 seconds</dt>
                <dd>{format.why.first3s}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{format.why.length}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{format.why.format}</dd>
              </div>
              <div>
                <dt>Sound</dt>
                <dd>{format.why.sound}</dd>
              </div>
            </dl>
          </section>

        </div>

        <footer className="drawer-foot">
          <button className="btn btn-ghost" onClick={onSave}>
            {saved ? '★ Saved to client' : `Save to ${client.name}`}
          </button>
          <button className="btn btn-primary" onClick={onPlan}>
            Create recreate plan
          </button>
        </footer>
      </aside>
    </div>
  )
}
