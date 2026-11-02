import { topicLine, topicsFor } from '../../lib/publish'
import { usePublishSummary } from './usePublishSummary'

// How earlier videos on a topic did, from the numbers entered after posting. Nothing when there are none.
// `text` is what the person is searching for; empty lists the best-measured topics.
export function TopicResults({ text }: { text: string }) {
  const summary = usePublishSummary()
  const lines = topicsFor(summary, text).flatMap((t) => {
    const line = topicLine(t)
    return line ? [{ topic: t.topic, line }] : []
  })
  if (!lines.length) return null
  return (
    <section className="pub-topics" aria-label="How your earlier videos did">
      <h3 className="pub-topics-title small">How your earlier videos did</h3>
      <ul>
        {lines.map((l) => (
          <li key={l.topic} className="small">
            {l.line}
          </li>
        ))}
      </ul>
    </section>
  )
}
