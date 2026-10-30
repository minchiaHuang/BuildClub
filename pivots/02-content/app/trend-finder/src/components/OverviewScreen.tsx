import type { Client, SavedIdea } from '../types'
import { useApp } from '../lib/appContext'
import { ProgressRing } from './ClientScreen'

interface Props {
  clients: Client[]
  ideas: SavedIdea[]
  onOpen: (clientId: string, view: 'saved' | 'approvals' | 'search') => void
  onAddClient: () => void
}

const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)

// Agency name and manager name, edited here because they apply to every client. Saves as you type.
function AgencySection() {
  const { agency, setAgency } = useApp()
  return (
    <fieldset className="cannot agency-box">
      <legend>
        <h3>Agency</h3>
        <span className="small muted">The manager approves plans. Their name shows wherever a plan waits for review.</span>
      </legend>
      <div className="settings-grid">
        <label className="field">
          <span className="field-label">Agency name</span>
          <input id="agency-name" value={agency.agencyName} onChange={(e) => setAgency({ agencyName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Manager's name</span>
          <input id="manager-name" value={agency.managerName} onChange={(e) => setAgency({ managerName: e.target.value })} />
        </label>
      </div>
    </fieldset>
  )
}

export function OverviewScreen({ clients, ideas, onOpen, onAddClient }: Props) {
  const { agency } = useApp()
  const rows = clients.map((c) => {
    const mine = ideas.filter((i) => i.clientId === c.id)
    const approved = mine.filter((i) => i.status === 'approved')
    const waiting = mine.filter((i) => i.status === 'waiting').length
    const nextDue = approved.map((i) => i.dueDate).sort()[0]
    return { c, saved: mine.length, approved: approved.length, waiting, nextDue }
  })
  const totals = {
    approved: rows.reduce((s, r) => s + r.approved, 0),
    target: clients.reduce((s, c) => s + c.monthlyTarget, 0),
    waiting: rows.reduce((s, r) => s + r.waiting, 0),
  }

  return (
    <section className="overview">
      <header className="page-head-row">
        <div className="page-head">
          <span className="eyebrow">{agency.agencyName} · All clients</span>
          <h1>Where every client stands</h1>
          <p className="muted">This month's video targets, what's waiting for approval, and what's due next. Pick a client to find ideas.</p>
        </div>
        <button className="btn btn-primary" onClick={onAddClient}>
          + Add client
        </button>
      </header>

      <div className="stat-row">
        <div className="stat stat-ring">
          <ProgressRing value={totals.target ? Math.min(totals.approved / totals.target, 1) * 100 : 0} size={52} stroke={6} />
          <div>
            <span className="stat-num">
              {totals.approved}
              <span className="muted"> / {totals.target}</span>
            </span>
            <span className="small muted">videos approved this month</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-num">{totals.waiting}</span>
          <span className="small muted">waiting for approval</span>
        </div>
        <div className="stat">
          <span className="stat-num">{clients.length}</span>
          <span className="small muted">active clients</span>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Add your first client to start finding videos for them.</p>
          <button className="btn btn-primary" onClick={onAddClient}>
            + Add client
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="client-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>This month</th>
                <th className="num">Saved</th>
                <th className="num">Waiting</th>
                <th>Next due</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, saved, approved, waiting, nextDue }) => {
                const pct = Math.min(approved / c.monthlyTarget, 1) * 100
                const behind = pct < 50
                const due = nextDue ? daysUntil(nextDue) : null
                return (
                  <tr key={c.id}>
                    <td>
                      <button className="link-strong" onClick={() => onOpen(c.id, 'search')}>
                        {c.name}
                      </button>
                      <span className="small muted">{c.niche}</span>
                    </td>
                    <td>
                      <div className="progress">
                        <ProgressRing value={pct} tone={behind ? 'behind' : undefined} />
                        <span className="small">
                          {approved} of {c.monthlyTarget}
                        </span>
                      </div>
                    </td>
                    <td className="num">{saved}</td>
                    <td className="num">
                      {waiting ? (
                        <button className="pill pill-wait pill-btn" onClick={() => onOpen(c.id, 'approvals')}>
                          {waiting} waiting
                        </button>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td>
                      {due === null ? (
                        <span className="muted small">Nothing approved yet</span>
                      ) : (
                        <span className={`small ${due < 3 ? 'due-soon' : ''}`}>
                          {due <= 0 ? 'Today' : due === 1 ? 'Tomorrow' : `In ${due} days`}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <button className="btn btn-ghost btn-sm" onClick={() => onOpen(c.id, 'search')}>
                        Find ideas
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AgencySection />
    </section>
  )
}
