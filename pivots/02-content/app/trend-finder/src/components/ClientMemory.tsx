import type { Client, Format, SavedIdea, Video } from '../types'
import { decisionLabel, memorySummary, planTitle } from '../lib/memory'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
}

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// What Remake has learned about this client: every manager decision, newest first, with the plan and the reason.
export function ClientMemory({ client, ideas, videoById, formatById }: Props) {
  const events = [...(client.memory ?? [])].reverse()
  return (
    <section className="client-memory">
      <header className="client-memory-head">
        <h3>What we've learned about {client.name}</h3>
        {events.length > 0 && <span className="small muted">{memorySummary(events)}</span>}
      </header>
      {events.length === 0 ? (
        <p className="small muted">No decisions yet. Every approval and rejection will be remembered here.</p>
      ) : (
        <ul className="memory-list">
          {events.map((e) => {
            const plan = planTitle(e.ideaId, ideas, videoById, formatById)
            return (
              <li key={`${e.ideaId}-${e.at}`} className="memory-item">
                <div className="memory-row">
                  <span className={`status memory-${e.kind}`}>{decisionLabel[e.kind]}</span>
                  <span className="small muted">{day(e.at)}</span>
                </div>
                <strong>{plan.title}</strong>
                {plan.detail && <span className="small muted">{plan.detail}</span>}
                {e.reason && <p className="quote">{e.reason}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
