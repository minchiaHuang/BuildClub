import { useEffect, useState } from 'react'
import type { Cue } from '../../lib/grading'
import { getCues } from '../../lib/grading'

// The cues of the last finished video, re-read whenever the video changes. null = none yet (or not loaded).
export function useCues(ideaId: string, videoUrl: string | undefined) {
  const [data, setData] = useState<{ cues: Cue[]; edited: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!videoUrl) {
      setData(null)
      return
    }
    let live = true
    setError(null)
    getCues(ideaId).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [ideaId, videoUrl])
  return { data, setData, error }
}
