import type { Client, Format, SavedIdea, Video } from '../types'
import { useApp, useManagerName } from '../lib/appContext'
import { plural } from '../lib/metrics'
import { ProgressRing } from './ProgressRing'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  // Ideas for every client; the portal shows this client's.
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onSignOut: () => void
}

// What a client account sees: only their own plans, read-only. Ideas the team is still choosing and plans
// sent back stay inside the agency. Not wired up yet: it comes back with the client login
// (the second step after "Client" on the login screen).
export function ClientPortal(p: Props) {
  const { agency } = useApp()
  const manager = useManagerName()
  const mine = p.ideas.filter((i) => i.clientId === p.client.id)
  const approved = mine.filter((i) => i.status === 'approved').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const waiting = mine.filter((i) => i.status === 'waiting').sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
  const progress = Math.min(approved.length / p.client.monthlyTarget, 1) * 100

  const card = (idea: SavedIdea) => {
    const v = p.videoById.get(idea.videoId)
    if (!v) return null
    const f = p.formatById.get(v.formatId)
    const shots = idea.shots ?? f?.shotList ?? []
    return (
      <li key={idea.id} className="board-card">
        <Thumb video={v} />
        <div className="board-card-body">
          <strong>{v.live ? v.hook : f?.name}</strong>
          <span className="small muted">Based on {v.live ? v.handle : `"${v.hook}" · ${v.handle}`}</span>
          <span className="small">
            Due {idea.dueDate} · {plural(shots.length, 'shot')}
          </span>
          {shots.length > 0 && (
            <details className="portal-shots">
              <summary className="small">See the shot list</summary>
              <ol>
                {shots.map((s, n) => (
                  <li key={n} className="small">
                    {s.time && <span className="muted">{s.time} · </span>}
                    {s.shot}
                    {s.text && <span className="muted"> · Text on screen: "{s.text}"</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </li>
    )
  }

  const column = (title: string, list: SavedIdea[], empty: string, tone: string) => (
    <section className={`board-col board-col-${tone}`} aria-label={title}>
      <header className="board-col-head">
        <h2>{title}</h2>
        <span className="board-count">{list.length}</span>
      </header>
      {list.length ? <ul className="board-list">{list.map(card)}</ul> : <p className="board-empty small muted">{empty}</p>}
    </section>
  )

  return (
    <div className="portal">
      <header className="portal-bar">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          Remake
        </div>
        <div className="portal-user">
          <span className="small muted">
            {p.client.name} · client of {agency.agencyName}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={p.onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        <section className="client board">
          <header className="client-head">
            <div>
              <span className="eyebrow">{agency.agencyName} · Your plans</span>
              <h1>{p.client.name}</h1>
              <p className="muted">
                Videos {agency.agencyName} is planning for you. Once {manager} approves a plan, the team films it.
              </p>
            </div>
            <div className="target">
              <ProgressRing value={progress} size={56} stroke={6} />
              <div className="target-text">
                <span className="target-num">
                  {approved.length} <span className="muted">of {p.client.monthlyTarget}</span>
                </span>
                <span className="small muted">videos approved this month</span>
              </div>
            </div>
          </header>

          <div className="board-cols">
            {column('Ready to film', approved, 'Approved plans show up here.', 'approved')}
            {column(`Waiting for ${manager}`, waiting, `Nothing waiting for ${manager} right now.`, 'waiting')}
          </div>
        </section>
      </main>
    </div>
  )
}
