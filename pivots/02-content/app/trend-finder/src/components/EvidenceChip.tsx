import type { Video } from '../types'
import { BASELINE_PLATFORMS, COPY, EVIDENCE_TEXT, evidenceOf, plainLine, type Cohort } from '../lib/evidence'

// The evidence label and one plain line under a recommendation. Platforms with no baseline details say so instead.
export function EvidenceChip({ video, cohort, compact }: { video: Video; cohort?: Cohort; compact?: boolean }) {
  if (!video.live) return null
  const evidence = evidenceOf(video, cohort)
  if (!evidence) {
    return BASELINE_PLATFORMS.includes(video.platform) ? null : <span className="evidence-line">{COPY.noPlatform}</span>
  }
  return (
    <span className={`evidence${compact ? ' evidence-compact' : ''}`}>
      <span className={`stage-pill evidence-chip evidence-${evidence}`}>{EVIDENCE_TEXT[evidence]}</span>
      <span className="evidence-line">{plainLine(video, cohort)}</span>
    </span>
  )
}
