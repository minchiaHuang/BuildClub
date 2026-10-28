import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Format, SavedIdea, Video } from '../types'
import { loadReview, sendDecision } from '../lib/share'
import type { Review } from '../lib/share'
import { ReviewScreen } from './ReviewScreen'

// Annie's page, opened from the link Daphne shares: no sidebar and no login.
export function ReviewPage({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null | undefined>(undefined)
  const [ideas, setIdeas] = useState<SavedIdea[]>([])
  const [failed, setFailed] = useState('')

  const load = useCallback(() => {
    loadReview(token)
      .then((r) => {
        setReview(r)
        setIdeas(r ? r.ideas.map((i) => i.idea) : [])
      })
      .catch((e: Error) => setFailed(e.message))
  }, [token])
  useEffect(load, [load])

  const videoById = useMemo(
    () => new Map((review?.ideas ?? []).flatMap((i): [string, Video][] => (i.video ? [[i.idea.videoId, i.video]] : []))),
    [review],
  )
  const formatById = useMemo(
    () => new Map((review?.ideas ?? []).flatMap((i): [string, Format][] => (i.format ? [[i.format.id, i.format]] : []))),
    [review],
  )

  // The card has already animated away, so take it out of the list; put it back if the answer didn't save.
  const decide = (ideaId: string, approved: boolean, reason?: string) => {
    setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, status: approved ? 'approved' : 'rejected' } : i)))
    sendDecision(token, ideaId, approved, reason)
      .then(() => setFailed(''))
      .catch((e: Error) => {
        setFailed(e.message + ' Please try again.')
        load()
      })
  }

  if (failed && !review) {
    return (
      <main className="review-page">
        <div className="empty">
          <h2>Something went wrong</h2>
          <p>{failed}</p>
        </div>
      </main>
    )
  }
  if (review === undefined) return <main className="review-page" aria-busy="true" />
  if (review === null) {
    return (
      <main className="review-page">
        <div className="empty">
          <h2>This link isn't active</h2>
          <p>Ask for a new link.</p>
        </div>
      </main>
    )
  }
  return (
    <main className="review-page">
      {failed && (
        <p className="small" role="alert">
          {failed}
        </p>
      )}
      <ReviewScreen
        client={{ id: ideas[0]?.clientId ?? '', name: review.client.name }}
        ideas={ideas}
        videoById={videoById}
        formatById={formatById}
        onDecide={decide}
      />
    </main>
  )
}
