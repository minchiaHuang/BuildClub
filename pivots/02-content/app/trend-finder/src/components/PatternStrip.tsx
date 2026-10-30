import type { Pattern } from '../lib/live'
import { times } from '../lib/metrics'
import { PlatformLogo } from './PlatformToggles'

interface Props {
  patterns: Pattern[]
  active: string | null
  onPick: (label: string | null) => void
}

// Live results: sounds and hashtags that several accounts used, as the real-data version of "formats that repeat".
export function PatternStrip({ patterns, active, onPick }: Props) {
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
            return (
              <button
                key={p.label}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
