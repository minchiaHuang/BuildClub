import type { Pattern } from '../lib/live'
import { beatUsualAverage } from './find/words'

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
            When several accounts use the same sound or hashtag, it's catching on, not luck. Tap one to see only those videos.
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
                <span className="field-label">{p.kind === 'sound' ? 'Sound' : 'Hashtag'}</span>
                <strong className="pattern-label">{p.label}</strong>
                <span className="trend-text">
                  Used by {p.accounts} accounts. Their videos got {beatUsualAverage(p.avgScore, true)} on average.
                </span>
                <span className="trend-count">{p.videoIds.length === 1 ? '1 video' : `${p.videoIds.length} videos`} in these results</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
