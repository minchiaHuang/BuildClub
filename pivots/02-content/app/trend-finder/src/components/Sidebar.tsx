import { useEffect, useRef, useState } from 'react'
import type { Client } from '../types'
import type { Workspace } from '../state'
import { useApp } from '../lib/appContext'

export type View =
  | 'overview'
  | 'search'
  | 'results'
  | 'shortlist'
  | 'saved'
  | 'approvals'
  | 'review'
  | 'plans'
  | 'plan'
  | 'settings'
  | 'add-client'

const paths: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  saved: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  approvals: 'M20 6 9 17l-5-5',
  plans: 'M8 4h11v16H8zM5 4v16M11 8h5M11 12h5M11 16h3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  overview: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
}

function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

interface Props {
  clients: Client[]
  workspace: Workspace
  setWorkspace: (w: Workspace) => void
  view: View
  setView: (v: View) => void
  counts: { shortlist: number }
  onSignOut: () => void
  onAddClient: () => void
  open: boolean
  onClose: () => void
  live: boolean
}

function ClientSwitcher({ clients, workspace, setWorkspace, onAddClient }: Pick<Props, 'clients' | 'workspace' | 'setWorkspace' | 'onAddClient'>) {
  const { agency } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = clients.find((c) => c.id === workspace)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (w: Workspace) => {
    setWorkspace(w)
    setOpen(false)
  }

  return (
    <div className="switcher" ref={ref}>
      <button className="switcher-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`avatar ${current ? '' : 'avatar-agency'}`}>{current ? initials(current.name) : '▦'}</span>
        <span className="switcher-text">
          <span className="switcher-label">{current ? 'Client' : agency.agencyName}</span>
          <strong>{current ? current.name : 'All clients'}</strong>
        </span>
        <span className="switcher-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="switcher-menu" role="menu">
          <button role="menuitem" className={`switcher-item ${workspace === 'all' ? 'on' : ''}`} onClick={() => choose('all')}>
            <span className="avatar avatar-agency">▦</span>
            <span>
              <strong>All clients</strong>
              <span className="small muted">Agency overview</span>
            </span>
          </button>
          <div className="switcher-sep" />
          <span className="switcher-head">Clients</span>
          {clients.map((c) => (
            <button
              key={c.id}
              role="menuitem"
              className={`switcher-item ${workspace === c.id ? 'on' : ''}`}
              onClick={() => choose(c.id)}
            >
              <span className="avatar">{initials(c.name)}</span>
              <span>
                <strong>{c.name}</strong>
                <span className="small muted">{c.niche}</span>
              </span>
            </button>
          ))}
          <div className="switcher-sep" />
          <button
            role="menuitem"
            className="switcher-item switcher-add"
            onClick={() => {
              setOpen(false)
              onAddClient()
            }}
          >
            <span className="avatar avatar-add">+</span>
            <span>
              <strong>Add client</strong>
              <span className="small muted">Name, audience, what they can't film</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar(p: Props) {
  const { agency, role } = useApp()
  const userName = role === 'manager' ? agency.managerName : 'Team member'
  const inClient = p.workspace !== 'all'
  const item = (v: View, icon: keyof typeof paths, label: string, count?: number, active = p.view === v) => (
    <button
      className={`side-link ${active ? 'side-on' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        p.setView(v)
        p.onClose()
      }}
    >
      <Icon name={icon} />
      <span>{label}</span>
      {count ? <span className="side-count">{count}</span> : null}
    </button>
  )

  return (
    <>
      {p.open && <div className="side-scrim" onClick={p.onClose} />}
      <aside className={`sidebar ${p.open ? 'sidebar-open' : ''}`} aria-label="Main">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          Remake
        </div>

        <ClientSwitcher clients={p.clients} workspace={p.workspace} setWorkspace={p.setWorkspace} onAddClient={p.onAddClient} />

        <nav className="side-nav">
          {inClient ? (
            <>
              {item('search', 'search', 'Search', undefined, p.view === 'search' || p.view === 'results')}
              {item(
                'shortlist',
                'saved',
                'Shortlist',
                p.counts.shortlist,
                ['shortlist', 'saved', 'approvals', 'review', 'plans', 'plan'].includes(p.view),
              )}
              <div className="side-sep" />
              {item('settings', 'settings', 'Client settings')}
            </>
          ) : (
            <>
              {item('overview', 'overview', 'Overview')}
              <p className="side-hint">Pick a client above to search and save ideas.</p>
            </>
          )}
        </nav>

        <div className="side-foot">
          {p.live ? (
            <span className="live-pill" title="Search results are real TikTok videos">
              Live TikTok data
            </span>
          ) : (
            <span className="sample-pill" title="All accounts and numbers are made up for this demo">
              Sample data
            </span>
          )}
          <div className="side-user">
            <span className="avatar avatar-user">{initials(userName) || '?'}</span>
            <span className="side-user-text">
              <strong>{role === 'manager' ? `${userName} (manager)` : userName}</strong>
              <span className="small muted">{agency.agencyName}</span>
            </span>
            <button className="icon-btn" onClick={p.onSignOut} aria-label="Sign out" title="Sign out">
              <Icon name="out" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
