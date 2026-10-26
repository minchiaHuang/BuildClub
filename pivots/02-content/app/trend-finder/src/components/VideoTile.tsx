import type { Video } from '../types'
import { agoShort, compact, outlierScore, scoreLine, tierName, tierOf, times } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  video: Video
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
}

// One video in the results grid: cover, one big score with a plain label and what it means, and one line of context.
export function VideoTile({ video, saved, onOpen, onToggleSave }: Props) {
  const score = outlierScore(video)
  const tier = tierOf(score)
  return (
    <article className="tile">
      <button className="tile-main" onClick={onOpen} aria-label={`Open breakdown: ${video.hook}`}>
        <Thumb video={video} />
        <div className="tile-body">
          <div className="tile-score">
            <span className={`score score-${tier}`}>{times(score)}</span>
            <span className={`tier tier-${tier}`}>{tierName[tier]}</span>
          </div>
          <span className={`score-line score-line-${tier}`}>{scoreLine(video)}</span>
          <span className="tile-hook">{video.hook}</span>
          <span className="tile-meta">
            {compact(video.views)} views · {compact(video.followers)} followers · {agoShort(video.daysAgo)}
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
