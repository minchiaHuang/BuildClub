import type { Video } from '../types'
import { agoShort, compact, outlierScore, scoreLine, tierName, tierOf, times } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  video: Video
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
}

// One video in the results grid: cover, usual → this video's views, a plain label, the hook and who posted it.
export function VideoTile({ video, saved, onOpen, onToggleSave }: Props) {
  const score = outlierScore(video)
  const tier = tierOf(score)
  const byFollowers = video.medianViews === null
  return (
    <article className="tile">
      <button className="tile-main" onClick={onOpen} aria-label={`Open breakdown: ${video.hook}. ${scoreLine(video)}`}>
        <Thumb video={video} />
        <div className="tile-body">
          <div className="tile-compare">
            <span className="cmp-from">{compact(video.medianViews ?? video.followers)}</span>
            <span className="cmp-arrow" aria-hidden="true">→</span>
            <span className={`cmp-to score-${tier}`}>{compact(video.views)}</span>
          </div>
          <span className="tile-cap">{byFollowers ? 'followers → views' : 'usual views → this video'}</span>
          <span className={`tier tier-${tier} tile-tier`}>
            {tierName[tier]} · {times(score)}
          </span>
          <span className="tile-hook">{video.hook}</span>
          <span className="tile-meta">
            {video.handle} · {agoShort(video.daysAgo)}
          </span>
        </div>
      </button>
      <button
        className={`tile-save ${saved ? 'tile-save-on' : ''}`}
        aria-pressed={saved}
        aria-label={saved ? 'Saved to client. Click to remove' : 'Save to client'}
        title={saved ? 'Saved' : 'Save to client'}
        onClick={onToggleSave}
      >
        {saved ? '★' : '☆'}
      </button>
    </article>
  )
}
