import type { Client, Format, SavedIdea, Video } from '../types'
import { useApp } from '../lib/appContext'
import {
  decisionStats,
  dueText,
  planName,
  sampleFormatById,
  sampleVideoById,
} from '../lib/clientHome'
import { t, tp } from '../lib/i18n'
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
  const { agency, setAgency, account } = useApp()
  return (
    <fieldset className="cannot agency-box">
      <legend>
        <h3>{t('home.agency.title')}</h3>
        <span className="small muted">{t('home.agency.desc')}</span>
      </legend>
      <div className="settings-grid">
        <label className="field">
          <span className="field-label">{t('home.agency.name')}</span>
          <input id="agency-name" value={agency.agencyName} readOnly={!!account?.agency} title={account?.agency ? t('home.agency.setByAccount') : undefined} onChange={(e) => setAgency({ agencyName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">{t('home.agency.manager')}</span>
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
          <h1>{t('home.overview.title')}</h1>
          <p className="muted">{t('home.overview.sub', { clients: tp('home.count.client', clients.length) })}</p>
        </div>
        <button className="btn btn-primary" onClick={onAddClient}>
          {t('home.overview.add')}
        </button>
      </header>

      {clients.length === 0 ? (
        <div className="empty">
          <h3>{t('home.overview.noneTitle')}</h3>
          <p>{t('home.overview.noneBody')}</p>
          <button className="btn btn-primary" onClick={onAddClient}>
            {t('home.overview.add')}
          </button>
        </div>
      ) : (
        <>
          <div className="ch-grid">
            <MonthCard heading={t('home.overview.monthHeading')} approved={totals.approved} target={totals.target} waiting={totals.waiting} />

            <Card
              id="ov-waiting"
              className="ov-waiting"
              label="Needs your approval"
              title={t('home.overview.waitingTitle')}
            >
              {waitingRows.length === 0 ? (
                <Empty>{t('home.overview.waitingEmpty')}</Empty>
              ) : (
                <ul className="ch-rows">
                  {waitingRows.map((r) => (
                    <li key={r.c.id} className="ch-row">
                      <span className="ch-row-text">
                        <strong>{r.c.name}</strong>
                        <span className="small muted">{t('home.overview.toApprove', { plans: tp('home.count.plan', r.waiting) })}</span>
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.c.id, 'review')} aria-label={t('home.overview.openAria', { name: r.c.name })}>
                        {t('home.overview.open')}
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
                  <th>{t('home.overview.colClient')}</th>
                  <th>{t('home.overview.colApproved')}</th>
                  <th className="num">{t('home.overview.colWaiting')}</th>
                  <th className="num">{t('home.overview.colSentBack')}</th>
                  <th>{t('home.overview.colDecisions')}</th>
                  <th>{t('home.overview.colNext')}</th>
                  <th aria-label={t('home.overview.colActions')} />
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
                            {t('home.overview.ofTarget', { approved, target: c.monthlyTarget })}
                          </span>
                        </div>
                      </td>
                      <td className="num">
                        {waiting ? (
                          <button className="link-btn" onClick={() => onOpen(c.id, 'review')} aria-label={t('home.overview.waitingAria', { n: waiting, name: c.name })}>
                            {waiting}
                          </button>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td className="num">{sentBack ? sentBack : <span className="muted">0</span>}</td>
                      <td>
                        <span className="small">
                          {stats.decided ? t('home.overview.decisionsOf', { approved: stats.approved, decided: stats.decided }) : <span className="muted">{t('home.overview.noneYet')}</span>}
                        </span>
                      </td>
                      <td>
                        {next ? (
                          <span className="ov-next">
                            <span className="small">{planName(next, videoById, formatById).name}</span>
                            <span className="small muted">{dueText(next.dueDate)}</span>
                          </span>
                        ) : (
                          <span className="muted small">{t('home.overview.nothingApproved')}</span>
                        )}
                      </td>
                      <td className="num">
                        <button className="btn btn-ghost btn-sm" onClick={() => onOpen(c.id, 'home')}>
                          {t('home.overview.home')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <LaterSection
            intro={t('home.overview.laterIntro')}
            cards={[
              {
                title: t('home.overview.later1Title'),
                what: t('home.overview.later1What'),
                needs: t('home.overview.later1Needs'),
              },
              {
                title: t('home.overview.later2Title'),
                what: t('home.overview.later2What'),
                needs: t('home.overview.later2Needs'),
              },
              {
                title: t('home.overview.later3Title'),
                what: t('home.overview.later3What'),
                needs: t('home.overview.later3Needs'),
              },
            ]}
          />
        </>
      )}

      <AgencySection />
    </section>
  )
}
