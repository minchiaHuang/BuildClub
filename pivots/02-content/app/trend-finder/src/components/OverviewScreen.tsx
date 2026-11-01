import type { Client, Format, SavedIdea, Video } from '../types'
import { useApp } from '../lib/appContext'
import {
  decisionStats,
  dueText,
  planName,
  sampleFormatById,
  sampleVideoById,
} from '../lib/clientHome'
import { plural } from '../lib/metrics'
import { ProgressRing } from './ProgressRing'
import { Card, Empty, LaterSection, MonthCard } from './home/HomeCards'

interface Props {
  clients: Client[]
  ideas: SavedIdea[]
  // Optional so App compiles without them; without them plan names come from the sample data only.
  videoById?: Map<string, Video>
  formatById?: Map<string, Format>
  onOpen: (clientId: string, view: 'home' | 'review' | 'search') => void
  onAddClient: () => void
}

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

// All clients Home: the same "before posting" numbers as one client's Home, added up across every client,
// plus one row per client. Post-performance analytics are marked placeholders.
export function OverviewScreen({ clients, ideas, videoById = sampleVideoById, formatById = sampleFormatById, onOpen, onAddClient }: Props) {
  const ids = new Set(clients.map((c) => c.id))
  const all = ideas.filter((i) => ids.has(i.clientId))
  const rows = clients.map((c) => {
    const mine = all.filter((i) => i.clientId === c.id)
    const approved = mine.filter((i) => i.status === 'approved').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const stats = decisionStats([c], ideas)
    return {
      c,
      approved: approved.length,
      waiting: mine.filter((i) => i.status === 'waiting').length,
      sentBack: mine.filter((i) => i.status === 'rejected').length,
      next: approved[0],
      stats,
    }
  })
  const totals = {
    approved: rows.reduce((s, r) => s + r.approved, 0),
    target: clients.reduce((s, c) => s + c.monthlyTarget, 0),
    waiting: rows.reduce((s, r) => s + r.waiting, 0),
  }
  const waitingRows = rows.filter((r) => r.waiting > 0)

  return (
    <section className="overview ch ch-wide">
      <header className="page-head-row">
        <div className="page-head">
          <h1>Client dashboard</h1>
          <p className="muted">
            This month's video targets and what's waiting for you, across {plural(clients.length, 'client')}.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAddClient}>
          + Add client
        </button>
      </header>

      {clients.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Add your first client to start finding videos for them.</p>
          <button className="btn btn-primary" onClick={onAddClient}>
            + Add client
          </button>
        </div>
      ) : (
        <>
          <div className="ch-grid">
            <MonthCard heading="Videos approved this month, all clients" approved={totals.approved} target={totals.target} waiting={totals.waiting} />

            <Card
              id="ov-waiting"
              className="ov-waiting"
              label="Needs your approval"
              title={totals.waiting ? `${plural(totals.waiting, 'plan')} waiting for your approval` : 'No plans waiting for your approval'}
            >
              {waitingRows.length === 0 ? (
                <Empty>When someone sends a plan for approval, the client shows up here.</Empty>
              ) : (
                <ul className="ch-rows">
                  {waitingRows.map((r) => (
                    <li key={r.c.id} className="ch-row">
                      <span className="ch-row-text">
                        <strong>{r.c.name}</strong>
                        <span className="small muted">{plural(r.waiting, 'plan')} to approve</span>
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.c.id, 'review')} aria-label={`Open ${r.c.name}'s plans to approve`}>
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

          </div>

          <div className="table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Approved this month</th>
                  <th className="num">Waiting for you</th>
                  <th className="num">Sent back</th>
                  <th>Your decisions</th>
                  <th>Next to film</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, approved, waiting, sentBack, next, stats }) => {
                  const pct = Math.min(approved / Math.max(c.monthlyTarget, 1), 1) * 100
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
                          <ProgressRing value={pct} tone={pct < 50 ? 'behind' : undefined} />
                          <span className="small">
                            {approved} of {c.monthlyTarget}
                          </span>
                        </div>
                      </td>
                      <td className="num">
                        {waiting ? (
                          <button className="link-btn" onClick={() => onOpen(c.id, 'review')} aria-label={`${waiting} waiting for you for ${c.name}. Open`}>
                            {waiting}
                          </button>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td className="num">{sentBack ? sentBack : <span className="muted">0</span>}</td>
                      <td>
                        <span className="small">
                          {stats.decided ? `${stats.approved} of ${stats.decided} approved` : <span className="muted">None yet</span>}
                        </span>
                      </td>
                      <td>
                        {next ? (
                          <span className="ov-next">
                            <span className="small">{planName(next, videoById, formatById).name}</span>
                            <span className="small muted">{dueText(next.dueDate)}</span>
                          </span>
                        ) : (
                          <span className="muted small">Nothing approved yet</span>
                        )}
                      </td>
                      <td className="num">
                        <button className="btn btn-ghost btn-sm" onClick={() => onOpen(c.id, 'home')}>
                          Home
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <LaterSection
            intro="These need numbers from each client's TikTok account after videos go live. Remake doesn't collect them yet, so nothing here is real data."
            cards={[
              {
                title: 'How posted videos did, per client',
                what: "For each client, views on the videos they posted this month, next to that client's usual views.",
                needs: "Would need: access to every client's TikTok stats.",
              },
              {
                title: 'Which copied videos worked best',
                what: 'Across all clients, which kinds of copied video got the best results once posted.',
                needs: 'Would need: TikTok stats, plus a link from each posted video back to its plan.',
              },
              {
                title: 'Follower growth, per client',
                what: "How each client's followers changed month by month.",
                needs: "Would need: access to every client's TikTok stats.",
              },
            ]}
          />
        </>
      )}

      <AgencySection />
    </section>
  )
}
