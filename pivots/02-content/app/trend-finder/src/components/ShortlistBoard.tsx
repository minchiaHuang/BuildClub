import type { Dispatch, SetStateAction } from 'react'
import type { Client, Format, SavedIdea, Video } from '../types'
import { useManagerName } from '../lib/appContext'
import { ClientScreen } from './ClientScreen'

interface Props {
  client: Client
  // Ideas for every client; the board shows this client's.
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onChangeIdeas: Dispatch<SetStateAction<SavedIdea[]>>
  onOpenPlan: (ideaId: string) => void
  onFindMore: () => void
  onReview: () => void
}

// PLACEHOLDER (Stage 0). Stream B replaces this with the shortlist board:
// Shortlisted → Waiting for the manager → Approved (ready to film), plus a "Sent back" lane.
// Until then it shows the old saved-ideas list and a link to the manager's review.
export function ShortlistBoard(p: Props) {
  const manager = useManagerName()
  return (
    <>
      <ClientScreen
        client={p.client}
        ideas={p.ideas}
        videoById={p.videoById}
        formatById={p.formatById}
        setStatus={(ids, status) => p.onChangeIdeas((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, status } : i)))}
        onRemove={(id) => p.onChangeIdeas((prev) => prev.filter((i) => i.id !== id))}
        onPlan={p.onOpenPlan}
        onFindMore={p.onFindMore}
      />
      <button className="btn btn-primary" onClick={p.onReview}>
        Review as {manager}
      </button>
    </>
  )
}
