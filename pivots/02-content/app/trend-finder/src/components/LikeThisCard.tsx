import type { Format, Video } from '../types'
import type { MediaSource } from '../lib/parseQuery'
import type { FormatTrend } from '../lib/metrics'
import { outlierScore, plural, platformName, stageText, times } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  source: MediaSource
  format: Format
  trend: FormatTrend | undefined
  matches: Video[]
  clientName: string
  onPlan: (videoId: string) => void
}

const verdicts = {
  early: { label: 'Worth copying now', tone: 'early' },
  rising: { label: 'Worth copying soon', tone: 'rising' },
  everywhere: { label: 'Probably too late', tone: 'everywhere' },
  'one-off': { label: 'Not proven yet', tone: 'one-off' },
} as const

export function LikeThisCard({ source, format, trend, matches, clientName, onPlan }: Props) {
  const best = [...matches].sort((a, b) => outlierScore(b) - outlierScore(a))[0]
  const avg = matches.reduce((s, v) => s + outlierScore(v), 0) / Math.max(matches.length, 1)
  const verdict = trend ? verdicts[trend.stage] : null

  return (
    <div className="like">
      <div className="like-source">
        {source.previewUrl ? (
          <img src={source.previewUrl} alt="Your screenshot" />
        ) : best ? (
          <Thumb video={{ ...best, hook: source.label, platform: source.platform ?? best.platform }} />
        ) : null}
        <span className="small muted">
          {source.kind === 'image' ? 'Your screenshot' : source.platform ? `${platformName[source.platform]} link` : 'Your link'}
        </span>
      </div>

      <div className="like-body">
        <div className="answer-head">
          <span className="eyebrow">Find more like this</span>
          <span className="ai-tag">Match · mock</span>
        </div>
        <h2>This looks like: {format.name}</h2>

        {verdict && trend && (
          <div className={`verdict verdict-${verdict.tone}`}>
            <strong>{verdict.label}</strong>
            <span>
              {stageText(trend)}. {plural(matches.length, 'similar video')} found, averaging {times(avg)} their
              account's usual views.
            </span>
          </div>
        )}

        <dl className="why why-compact">
          <div>
            <dt>Hook</dt>
            <dd>{format.why.hook}</dd>
          </div>
          <div>
            <dt>First 3 seconds</dt>
            <dd>{format.why.first3s}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{format.why.format}</dd>
          </div>
        </dl>

        {best && (
          <div className="like-actions">
            <button className="btn btn-primary" onClick={() => onPlan(best.id)}>
              Add to shortlist for {clientName}
            </button>
            <span className="small muted">Uses the best match below as the reference.</span>
          </div>
        )}
      </div>
    </div>
  )
}
