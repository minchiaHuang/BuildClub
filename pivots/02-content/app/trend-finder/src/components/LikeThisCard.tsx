import type { Format, Video } from '../types'
import type { MediaSource } from '../lib/parseQuery'
import type { FormatTrend } from '../lib/metrics'
import { byFollowers, meanScore, outlierScore, platformName } from '../lib/metrics'
import { beatUsualAverage, spreadSentence, spreadVerdict } from './find/words'
import { Thumb } from './Thumb'
import { t, tp } from '../lib/i18n'

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
          <img src={source.previewUrl} alt={t('find.screenshot')} />
        ) : best ? (
          <Thumb video={{ ...best, hook: source.label, platform: source.platform ?? best.platform }} />
        ) : null}
        <span className="small muted">
          {source.kind === 'image' ? t('find.screenshot') : source.platform ? t('find.like.link', { platform: platformName[source.platform] }) : t('find.like.yourLink')}
        </span>
      </div>

      <div className="like-body">
        <div className="answer-head">
          <span className="eyebrow">{t('find.like.eyebrow')}</span>
          <span className="ai-tag">{real ? t('find.like.aiTag') : t('find.like.mockTag')}</span>
        </div>
        <h2>{t('find.like.looksLike', { name: format.name })}</h2>
        {!real && <span className="small muted">{t('find.like.sample')}</span>}

        {trend && (
          <p className="like-verdict">
            <strong>{spreadVerdict(trend)}</strong>{' '}
            {t('find.like.body', {
              spread: spreadSentence(trend),
              similar: tp('find.like.similar', matches.length),
              avg: beatUsualAverage(avg, matches.some(byFollowers)),
            })}
          </p>
        )}

        {real && source.kind === 'image' ? (
          <p>{format.summary}</p>
        ) : (
        <dl className="why why-compact">
          <div>
            <dt>{t('find.why.start')}</dt>
            <dd>{format.why.hook}</dd>
          </div>
          <div>
            <dt>{t('find.why.first3s')}</dt>
            <dd>{format.why.first3s}</dd>
          </div>
          <div>
            <dt>{t('find.why.made')}</dt>
            <dd>{format.why.format}</dd>
          </div>
        </dl>
        )}

        {best && (
          <div className="like-actions">
            <button className="btn btn-primary" onClick={() => onPlan(best.id)}>
              {savedIds.has(best.id) ? t('find.openPlan') : t('find.saveFor', { client: clientName })}
            </button>
            <span className="small muted">{t('find.like.usesClosest')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
