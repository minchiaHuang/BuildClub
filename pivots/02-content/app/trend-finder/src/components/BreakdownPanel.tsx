import { useEffect } from 'react'
import type { Client, Format, Video } from '../types'
import {
  ago,
  clientFit,
  compact,
  outlierScore,
  platformName,
  shareSaveRate,
  times,
  viewsPerDay,
  viewsPerFollower,
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

  const fit = clientFit(format, client)
  const metrics = [
    { label: 'Outlier score', value: times(outlierScore(video)), note: `vs ${compact(video.medianViews)} usual views` },
    { label: 'Views ÷ followers', value: times(viewsPerFollower(video)), note: `${compact(video.followers)} followers` },
    {
      label: 'Shares + saves',
      value: `${shareSaveRate(video).toFixed(1)} per 100 views`,
      note: video.saves === null ? 'Instagram hides saves, so shares only' : `${compact(video.shares)} shares, ${compact(video.saves)} saves`,
    },
    { label: 'Growth', value: `${compact(viewsPerDay(video))} views/day`, note: `Posted ${ago(video.daysAgo)}` },
    { label: 'Format used by', value: `${formatAccounts} accounts`, note: formatAccounts >= 3 ? 'A pattern, not luck' : 'Too few to be sure' },
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
          <div className="drawer-top">
            <Thumb video={video} large />
            <dl className="metric-list">
              {metrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                  <span className="note">{m.note}</span>
                </div>
              ))}
            </dl>
          </div>

          <div className={`fit ${fit.ok ? 'fit-ok' : 'fit-no'}`}>
            <strong>Can {client.name} film this?</strong>
            <span>{fit.text}</span>
          </div>

          <section className="block">
            <h3>
              Why it worked <span className="ai-tag">AI breakdown · sample</span>
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

          <section className="block">
            <h3>Shot list</h3>
            <ol className="shots">
              {format.shotList.map((s) => (
                <li key={s.time}>
                  <span className="shot-time">{s.time}</span>
                  <span>
                    {s.shot}
                    {s.text && <span className="shot-text">Text: "{s.text}"</span>}
                  </span>
                </li>
              ))}
            </ol>
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
