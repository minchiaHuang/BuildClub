import type { Client, ClientEvent } from '../types'

const kindLabel: Record<ClientEvent['kind'], string> = {
  approved: 'Approved',
  'approved-with-changes': 'Approved with changes',
  'sent-back': 'Sent back',
}

// What Remake has learned about this client: every manager decision, newest first.
// Stage 0 shows the raw list; stream C adds the plan names and makes it easier to scan.
export function ClientMemory({ client }: { client: Client }) {
  const events = [...(client.memory ?? [])].reverse()
  return (
    <section className="client-memory">
      <h3>What we've learned about {client.name}</h3>
      {events.length === 0 ? (
        <p className="small muted">No decisions yet. Every approval and rejection will be remembered here.</p>
      ) : (
        <ul>
          {events.map((e) => (
            <li key={`${e.ideaId}-${e.at}`}>
              <strong>{kindLabel[e.kind]}</strong> · {new Date(e.at).toLocaleDateString()}
              {e.reason && <span className="muted"> · {e.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
