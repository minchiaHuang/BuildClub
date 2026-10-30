import { useState } from 'react'
import type { IdeaStatus, Video } from '../types'
import { agoShort, compact, hasDate, hasScore, outlierScore, scoreLine, tierName, tierOf, times, viewsWord } from '../lib/metrics'
import { Thumb } from './Thumb'
import { EvidenceChip } from './EvidenceChip'
import { COPY, EVIDENCE_TEXT, BASELINE_PLATFORMS, evidenceOf, plainLine, type Cohort } from '../lib/evidence'

interface Props {
  video: Video
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  // Where this video stands for the current client, if it's been saved or sent.
  status?: IdeaStatus
  // The accounts using the same pattern in this search, if any.
  cohort?: Cohort
}

const statusBadge: Record<IdeaStatus, string> = {
  saved: 'Saved',
  waiting: 'Sent to Annie',
  approved: 'Approved',
  rejected: 'Not approved',
}

// One video in the results grid: cover, usual → this video's views, a plain label, the hook and who posted it.
export function VideoTile({ video, saved, onOpen, onToggleSave, status, cohort }: Props) {
  const score = outlierScore(video)
  const tier = tierOf(score)
  const byFollowers = video.medianViews === null
  // The star pops only when it's clicked, not when a tile shows up already saved.
  const [pop, setPop] = useState(false)
  const evidence = video.live ? evidenceOf(video, cohort) : null
  const spoken = !video.live
    ? ''
    : evidence
      ? `${EVIDENCE_TEXT[evidence]}. ${plainLine(video, cohort)}`
      : BASELINE_PLATFORMS.includes(video.platform)
        ? ''
        : COPY.noPlatform
  return (
    <article className="tile">
      <button className="tile-main" data-video-id={video.id} onClick={onOpen} aria-label={`Open breakdown: ${video.hook}. ${scoreLine(video)}${spoken ? `. ${spoken}` : ''}`}>
        <Thumb video={video} preview />
        {status && status !== 'saved' && <span className={`tile-status tile-status-${status}`}>{statusBadge[status]}</span>}
        <div className="tile-body">
          {hasScore(video) ? (
            <>
              <div className="tile-compare">
                <span className="cmp-from">{compact(video.medianViews ?? video.followers)}</span>
                <span className="cmp-arrow" aria-hidden="true">→</span>
                <span className={`cmp-to score-${tier}`}>{compact(video.views)}</span>
              </div>
              <span className="tile-cap">{byFollowers ? 'followers → views' : `usual ${viewsWord(video)} → this video`}</span>
              <span className={`tier tier-${tier} tile-tier`}>
                {tierName[tier]} · {times(score)}
              </span>
            </>
          ) : (
            <>
              <div className="tile-compare">
                <span className="cmp-to">{compact(video.views)}</span>
              </div>
              <span className="tile-cap">{viewsWord(video)}</span>
            </>
          )}
          <EvidenceChip video={video} cohort={cohort} compact />
          <span className="tile-hook">{video.hook}</span>
          <span className="tile-meta">
            {video.handle}
            {hasDate(video) && ` · ${agoShort(video.daysAgo)}`}
            {video.comments !== undefined && ` · ${compact(video.comments)} comments`}
          </span>
        </div>
      </button>
      <button
        className={`tile-save ${saved ? 'tile-save-on' : ''} ${pop ? 'tile-save-pop' : ''}`}
        aria-pressed={saved}
        aria-label={saved ? 'Saved to client. Click to remove' : 'Save to client'}
        title={saved ? 'Saved' : 'Save to client'}
        onClick={() => {
          setPop(true)
          onToggleSave()
        }}
        onAnimationEnd={() => setPop(false)}
      >
        {saved ? '★' : '☆'}
      </button>
    </article>
  )
}
