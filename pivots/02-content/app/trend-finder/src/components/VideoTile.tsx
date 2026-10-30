import { useState } from 'react'
import type { IdeaStatus, Video } from '../types'
import { agoShort, compact, outlierScore, scoreLine, tierName, tierOf, times } from '../lib/metrics'
import { Thumb } from './Thumb'
import { useManagerName } from '../lib/appContext'

interface Props {
  video: Video
  onOpen: () => void
  // Adds the video to the client's shortlist, or takes it off again.
  onToggleSave: () => void
  // Where this video stands for the current client, if it's been shortlisted or sent.
  status?: IdeaStatus
}

const statusBadge = (manager: string): Record<IdeaStatus, string> => ({
  saved: 'Shortlisted',
  waiting: `Sent to ${manager}`,
  approved: 'Approved',
  rejected: 'Sent back',
})

// One video in the results grid: cover, usual → this video's views, a plain label, the hook and who posted it.
export function VideoTile({ video, onOpen, onToggleSave, status }: Props) {
  const manager = useManagerName()
  const score = outlierScore(video)
  const tier = tierOf(score)
  const byFollowers = video.medianViews === null
  // The button pops only when it's clicked, not when a tile shows up already shortlisted.
  const [pop, setPop] = useState(false)
  const saved = status === 'saved'
  return (
    <article className="tile">
      <button className="tile-main" data-video-id={video.id} onClick={onOpen} aria-label={`Open breakdown: ${video.hook}. ${scoreLine(video)}`}>
        <Thumb video={video} />
        {status && status !== 'saved' && <span className={`tile-status tile-status-${status}`}>{statusBadge(manager)[status]}</span>}
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
      {/* Once it's sent, the badge shows where it stands and the shortlist button goes away. */}
      {(!status || saved) && (
        <button
          className={`tile-save ${saved ? 'tile-save-on' : ''} ${pop ? 'tile-save-pop' : ''}`}
          aria-pressed={saved}
          aria-label={saved ? 'Shortlisted. Click to remove' : 'Add to shortlist'}
          title={saved ? 'Shortlisted' : 'Add to shortlist'}
          onClick={() => {
            setPop(true)
            onToggleSave()
          }}
          onAnimationEnd={() => setPop(false)}
        >
          {saved ? '✓ Shortlisted' : '+ Shortlist'}
        </button>
      )}
    </article>
  )
}
