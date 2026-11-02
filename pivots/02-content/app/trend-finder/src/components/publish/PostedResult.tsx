import { useEffect, useState } from 'react'
import { getPublishMode, ideaResultLine } from '../../lib/publish'
import { usePublishSummary } from './usePublishSummary'

let modeCache: Promise<boolean> | null = null
const loadSimulated = () => (modeCache ??= getPublishMode().then((m) => m.simulated, () => true))

// The result of a posted video on its board card: "12.4k views · 7.7% engagement". When the server only
// simulates posting, the card says so, so a simulated post never reads as a real one.
export function PostedResult({ ideaId }: { ideaId: string }) {
  const summary = usePublishSummary()
  const [simulated, setSimulated] = useState(false)
  useEffect(() => {
    let live = true
    void loadSimulated().then((s) => live && setSimulated(s))
    return () => {
      live = false
    }
  }, [])
  const line = ideaResultLine(summary?.ideas.find((i) => i.ideaId === ideaId))
  if (!line && !simulated) return null
  return (
    <p className="pub-card-result small">
      {simulated && <span className="pill pill-wait pub-badge">Simulated</span>}{' '}
      {line ? (
        <>
          <span className="pb-next-label">Result</span> {line}
        </>
      ) : (
        <span className="muted">No numbers yet</span>
      )}
    </p>
  )
}
