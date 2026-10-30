import { useState } from 'react'
import type { IdeaStatus, Video } from '../types'
import { agoShort, compact, hasDate, hasScore, outlierScore, scoreLine, tierName, tierOf, times, viewsWord } from '../lib/metrics'
import { Thumb } from './Thumb'
import { useManagerName } from '../lib/appContext'
import { EvidenceChip } from './EvidenceChip'
import { COPY, EVIDENCE_TEXT, BASELINE_PLATFORMS, cachedLabel, evidenceOf, plainLine, type Cohort } from '../lib/evidence'

interface Props {
  video: Video
  onOpen: () => void
  // Adds the video to the client's shortlist, or takes it off again.
  onToggleSave: () => void
  // Where this video stands for the current client, if it's been shortlisted or sent.
  status?: IdeaStatus
  // The accounts using the same pattern in this search, if any.
  cohort?: Cohort
}

const statusBadge = (manager: string): Record<IdeaStatus, string> => ({
  saved: 'Shortlisted',
  waiting: `Sent to ${manager}`,
  approved: 'Approved',
  rejected: 'Sent back',
})

// One video in the results grid: cover, usual → this video's views, a plain label, the hook and who posted it.
export function VideoTile({ video, onOpen, onToggleSave, status, cohort }: Props) {
  const manager = useManagerName()
  const score = outlierScore(video)
  const tier = tierOf(score)
  const byFollowers = video.medianViews === null
  // The button pops only when it's clicked, not when a tile shows up already shortlisted.
  const [pop, setPop] = useState(false)
  const saved = status === 'saved'
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
        {status && status !== 'saved' && <span className={`tile-status tile-status-${status}`}>{statusBadge(manager)[status]}</span>}
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
            {video.live && video.fromCache && ` · ${cachedLabel(video.fetchedAt ?? 0, Date.now())}`}
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
