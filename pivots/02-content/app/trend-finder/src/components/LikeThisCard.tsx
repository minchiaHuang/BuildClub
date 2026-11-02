import type { Format, Video } from '../types'
import type { MediaSource } from '../lib/parseQuery'
import type { FormatTrend } from '../lib/metrics'
import { meanScore, outlierScore, plural, platformName } from '../lib/metrics'
import { beatUsualAverage, spreadSentence, spreadVerdict } from './find/words'
import { Thumb } from './Thumb'

interface Props {
  source: MediaSource
  format: Format
  trend: FormatTrend | undefined
  matches: Video[]
  clientName: string
  // True when the breakdown is the AI's reading of the real video.
  real?: boolean
  onPlan: (videoId: string) => void
  // Videos already on this client's shortlist (or sent): the button then opens the plan instead.
  savedIds: Set<string>
}

export function LikeThisCard({ source, format, trend, matches, clientName, real, onPlan, savedIds }: Props) {
  const best = [...matches].sort((a, b) => outlierScore(b) - outlierScore(a))[0]
  const avg = meanScore(matches)

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
          <span className="ai-tag">{real ? 'AI breakdown' : 'Match · mock'}</span>
        </div>
        <h2>This looks like: {format.name}</h2>
        {!real && <span className="small muted">A sample match from the demo videos.</span>}

        {trend && (
          <p className="like-verdict">
            <strong>{spreadVerdict(trend)}</strong> {spreadSentence(trend)}. We found {plural(matches.length, 'similar video')}, with{' '}
            {beatUsualAverage(avg, false)} on average.
          </p>
        )}

        {real && source.kind === 'image' ? (
          <p>{format.summary}</p>
        ) : (
        <dl className="why why-compact">
          <div>
            <dt>How it starts</dt>
            <dd>{format.why.hook}</dd>
          </div>
          <div>
            <dt>First 3 seconds</dt>
            <dd>{format.why.first3s}</dd>
          </div>
          <div>
            <dt>How it's made</dt>
            <dd>{format.why.format}</dd>
          </div>
        </dl>
        )}

        {best && (
          <div className="like-actions">
            <button className="btn btn-primary" onClick={() => onPlan(best.id)}>
              {savedIds.has(best.id) ? 'Open plan' : `Save for ${clientName}`}
            </button>
            <span className="small muted">Uses the closest match below as the original.</span>
          </div>
        )}
      </div>
    </div>
  )
}
