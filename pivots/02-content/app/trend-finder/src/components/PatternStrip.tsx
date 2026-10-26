import type { Pattern } from '../lib/live'
import { times } from '../lib/metrics'

interface Props {
  query: string
  patterns: Pattern[]
  active: string | null
  onPick: (label: string | null) => void
}

// Live results: sounds and hashtags that several accounts used, as the real-data version of "formats that repeat".
export function PatternStrip({ query, patterns, active, onPick }: Props) {
  return (
    <div className="trends">
      <div className="section-head">
        <div>
          <span className="eyebrow">Sounds and hashtags that repeat</span>
          <h2>What's spreading in "{query}"</h2>
        </div>
        {active && (
          <button className="btn btn-ghost" onClick={() => onPick(null)}>
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
                <span className={`stage-pill ${p.kind === 'sound' ? 'stage-pill-early' : 'stage-pill-rising'}`}>
                  {p.kind === 'sound' ? 'Sound' : 'Hashtag'}
                </span>
                <strong className="pattern-label">{p.label}</strong>
                <span className="trend-text">
                  Used by {p.accounts} accounts here, averaging {times(p.avgScore)}
                </span>
                <span className="trend-counts">{p.videoIds.length} videos</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
