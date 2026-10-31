import { useState } from 'react'
import type { Pattern } from '../lib/live'
import { COPY, followerBand, times as multipleText, type Cohort } from '../lib/evidence'
import { times } from '../lib/metrics'
import { PlatformLogo } from './PlatformToggles'

interface Props {
  patterns: Pattern[]
  cohorts: Map<string, Cohort>
  active: string | null
  onPick: (label: string | null) => void
}

// Live results: sounds and hashtags that several accounts used, as the real-data version of "formats that repeat".
export function PatternStrip({ patterns, cohorts, active, onPick }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const openCohort = open ? cohorts.get(open) : undefined
  return (
    <div className="trends">
      <div className="section-head">
        <div className="section-title">
          <h2>Sounds and hashtags many accounts are using</h2>
          <p className="section-sub">
            When several accounts use the same sound or hashtag, it's a trend, not luck. Tap one to see those videos.
          </p>
        </div>
        {active && (
          <button className="btn btn-ghost btn-sm" onClick={() => onPick(null)}>
            Show all videos
          </button>
        )}
      </div>
      {patterns.length === 0 ? (
        <p className="muted small">No sound or hashtag shows up across several accounts in these results yet.</p>
      ) : (
        <div className="trend-row">
          {patterns.map((p) => {
            const on = active === p.label
            const cohort = cohorts.get(p.label)
            const expanded = open === p.label
            return (
              <div key={p.label} className="trend-item">
                <button
                  className={`trend-card ${on ? 'trend-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => onPick(on ? null : p.label)}
                >
                  <span className="pattern-kind">
                    <PlatformLogo platform="tiktok" size={12} />
                    <span className={`stage-pill ${p.kind === 'sound' ? 'stage-pill-early' : 'stage-pill-rising'}`}>
                      {p.kind === 'sound' ? 'Sound' : 'Hashtag'}
                    </span>
                  </span>
                  <strong className="pattern-label">{p.label}</strong>
                  <span className="trend-text">
                    {p.accounts} accounts{p.avgScore > 0 && ` · avg ${times(p.avgScore)}`}
                  </span>
                </button>
                {cohort && (
                  <button
                    className="btn btn-ghost btn-sm trend-toggle"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : p.label)}
                  >
                    Accounts ({cohort.accounts})
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {open && openCohort && (
        <div className="trend-accounts" role="region" aria-label={`Accounts using ${open}`}>
          <strong className="pattern-label">{open}</strong>
          {openCohort.rows.length > 0 && (
            <ul className="trend-account-list">
              {openCohort.rows.map((r) => (
                <li key={r.videoId} className="trend-account-row">
                  <span className="trend-account-handle">{r.handle}</span>
                  <span className="muted">{followerBand(r.followers)}</span>
                  <span>{r.multiple !== null ? multipleText(r.multiple) : '–'}</span>
                  <span className={r.hit ? 'trend-hit' : 'muted'}>
                    {r.rough ? COPY.roughShort : r.hit === null ? '–' : r.hit ? 'Hit' : 'Not a hit'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {openCohort.accounts > 0 &&
            (openCohort.accounts < 3 ? (
              <p className="small">{COPY.oneOff}</p>
            ) : (
              <p className="small">{COPY.hitRate(openCohort.hits, openCohort.counted)}</p>
            ))}
          <p className="muted small">{COPY.tiktokOnly}</p>
        </div>
      )}
    </div>
  )
}
