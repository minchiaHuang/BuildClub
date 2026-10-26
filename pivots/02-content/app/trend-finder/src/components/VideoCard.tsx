import type { Video } from '../types'
import { ago, compact, outlierScore, times, viewsPerFollower } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  video: Video
  rank: number
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
}

export function VideoCard({ video, rank, saved, onOpen, onToggleSave }: Props) {
  const score = outlierScore(video)
  return (
    <article className="vcard">
      <button className="vcard-main" onClick={onOpen} aria-label={`Open breakdown: ${video.hook}`}>
        <Thumb video={video} />
        <div className="vcard-body">
          <div className="vcard-top">
            <span className="rank">#{rank}</span>
            <span className={`score ${score >= 20 ? 'score-hot' : ''}`}>{times(score)}</span>
          </div>
          <strong className="vcard-hook">"{video.hook}"</strong>
          <span className="handle">{video.handle}</span>
          <dl className="mini-stats">
            <div>
              <dt>Views</dt>
              <dd>{compact(video.views)}</dd>
            </div>
            <div>
              <dt>Followers</dt>
              <dd>{compact(video.followers)}</dd>
            </div>
            <div>
              <dt>Views ÷ followers</dt>
              <dd>{times(viewsPerFollower(video))}</dd>
            </div>
          </dl>
          <span className="posted">{ago(video.daysAgo)}</span>
        </div>
      </button>
      <button
        className={`save ${saved ? 'save-on' : ''}`}
        aria-pressed={saved}
        onClick={onToggleSave}
        title={saved ? 'Saved to client' : 'Save to client'}
      >
        {saved ? '★ Saved' : '☆ Save'}
      </button>
    </article>
  )
}
