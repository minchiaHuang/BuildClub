import { useEffect, useRef, useState } from 'react'
import type { Client } from '../types'
import type { Workspace } from '../state'
import { AGENCY_NAME } from '../state'
import type { Account } from '../lib/auth'

export type View = 'overview' | 'search' | 'results' | 'saved' | 'approvals' | 'review' | 'plans' | 'plan' | 'settings' | 'channel'

const paths: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  saved: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  approvals: 'M20 6 9 17l-5-5',
  plans: 'M8 4h11v16H8zM5 4v16M11 8h5M11 12h5M11 16h3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  channel: 'M4 6h16v10H4zM8 20h8M12 16v4M10 9l5 2.5L10 14z',
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
  counts: { saved: number; waiting: number; plans: number }
  onSignOut: () => void
  // The signed-in person; null in the no-account demo.
  account: Account | null
  open: boolean
  onClose: () => void
  live: boolean
  onAddClient: () => void
}

function ClientSwitcher({ clients, workspace, setWorkspace, onAddClient, agency }: Pick<Props, 'clients' | 'workspace' | 'setWorkspace'> & { onAddClient: () => void; agency: string }) {
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
          <span className="switcher-label">{current ? 'Client' : agency}</span>
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
              <span className="small muted">New client</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

const PHONE = '(max-width: 860px)'

export function Sidebar(p: Props) {
  const inClient = p.workspace !== 'all'
  // On phones the sidebar is a slide-over: closed, it is off-screen, so keyboard and screen readers must skip it.
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const m = window.matchMedia(PHONE)
    const onChange = () => setPhone(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  const { open, onClose } = p
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      document.querySelector<HTMLElement>('.mobile-bar .icon-btn')?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
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
      <aside className={`sidebar ${p.open ? 'sidebar-open' : ''}`} aria-label="Main" inert={phone && !p.open}>
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          Trend Finder
        </div>

        <ClientSwitcher agency={p.account?.agency || AGENCY_NAME} clients={p.clients} workspace={p.workspace} setWorkspace={p.setWorkspace} onAddClient={() => { p.onClose(); p.onAddClient() }} />

        <nav className="side-nav">
          {inClient ? (
            <>
              {item('search', 'search', 'Search', undefined, p.view === 'search' || p.view === 'results')}
              {item('saved', 'saved', 'Saved ideas', p.counts.saved)}
              {item('approvals', 'approvals', 'Approvals', p.counts.waiting, p.view === 'approvals' || p.view === 'review')}
              {item('plans', 'plans', 'Plans', p.counts.plans, p.view === 'plans' || p.view === 'plan')}
              {item('channel', 'channel', 'Channel')}
              <div className="side-sep" />
              {item('settings', 'settings', 'Client settings')}
            </>
          ) : (
            <>
              {item('overview', 'overview', 'Overview')}
              {item('channel', 'channel', 'Channel')}
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
            <span className="avatar avatar-user">{p.account ? initials(p.account.name || p.account.email) : 'D'}</span>
            <span className="side-user-text">
              <strong>{p.account ? p.account.name || p.account.email : 'Demo user'}</strong>
              <span className="small muted">{p.account?.agency || AGENCY_NAME}</span>
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
