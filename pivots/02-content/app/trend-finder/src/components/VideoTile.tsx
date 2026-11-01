import { useState } from 'react'
import type { IdeaStatus, Video } from '../types'
import { compact } from '../lib/metrics'
import { beatUsual, daysAgoWords } from './find/words'
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

// Where the plan stands, as a plain line under the video (no coloured badge on the cover).
const statusLine = (manager: string): Record<IdeaStatus, string> => ({
  saved: 'Saved, shots not planned yet',
  waiting: `Plan sent to ${manager} for approval`,
  approved: `${manager} approved the plan`,
  rejected: `${manager} sent the plan back`,
})

// One video in the results grid: cover, views, one sentence comparing them with usual, what it says and who posted it.
export function VideoTile({ video, onOpen, onToggleSave, status }: Props) {
  const manager = useManagerName()
  const compare = beatUsual(video)
  // The button pops only when it's clicked, not when a tile shows up already shortlisted.
  const [pop, setPop] = useState(false)
  const saved = status === 'saved'
  return (
    <article className="tile">
      <button className="tile-main" data-video-id={video.id} onClick={onOpen} aria-label={`See why it worked: ${video.hook}. ${compare}`}>
        <Thumb video={video} />
        <div className="tile-body">
          <span className="tile-views">
            <span className="tile-compare">{compact(video.views)}</span> views
          </span>
          <span className="tile-cap">{compare}</span>
          <span className="tile-hook">{video.hook}</span>
          <span className="tile-meta">
            {video.handle} · {daysAgoWords(video.daysAgo)}
          </span>
          {status && status !== 'saved' && <span className="tile-plan">{statusLine(manager)[status]}</span>}
        </div>
      </button>
      {/* Once it's sent, the badge shows where it stands and the shortlist button goes away. */}
      {(!status || saved) && (
        <button
          className={`tile-save ${saved ? 'tile-save-on' : ''} ${pop ? 'tile-save-pop' : ''}`}
          aria-pressed={saved}
          aria-label={saved ? 'Saved. Click to unsave' : 'Save this idea'}
          title={saved ? 'Saved' : 'Save this idea'}
          onClick={() => {
            setPop(true)
            onToggleSave()
          }}
          onAnimationEnd={() => setPop(false)}
        >
          {saved ? '✓ Saved' : '+ Save'}
        </button>
      )}
    </article>
  )
}
