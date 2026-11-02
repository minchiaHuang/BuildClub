import { useEffect, useRef, useState } from 'react'
import { Logo } from './Logo'
import type { Client } from '../types'
import type { Workspace } from '../state'
import { useApp } from '../lib/appContext'
import { t } from '../lib/i18n'

export type View =
  | 'overview'
  | 'home'
  | 'search'
  | 'results'
  | 'shortlist'
  | 'review'
  | 'plan'
  | 'settings'
  | 'preferences'
  | 'channel'
  | 'add-client'

const paths: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  saved: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  approvals: 'M20 6 9 17l-5-5',
  plans: 'M8 4h11v16H8zM5 4v16M11 8h5M11 12h5M11 16h3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  channel: 'M4 6h16M4 12h10M4 18h6M17 14l3 3-3 3',
  overview: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  brief: 'M5 4h14v16H5zM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0M8 17c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7',
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
  // Plans that need action: waiting for approval plus sent back.
  counts: { plans: number }
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
          <span className="switcher-label">{current ? t('shell.side.client') : agency.agencyName}</span>
          <strong>{current ? current.name : t('shell.side.allClients')}</strong>
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
              <strong>{t('shell.side.allClients')}</strong>
              <span className="small muted">{t('shell.side.allClientsHint')}</span>
            </span>
          </button>
          <div className="switcher-sep" />
          <span className="switcher-head">{t('shell.side.clients')}</span>
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
                <span className="small muted">{t('shell.side.sells', { niche: c.niche })}</span>
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
              <strong>{t('shell.side.addClient')}</strong>
              <span className="small muted">{t('shell.side.addClientHint')}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar(p: Props) {
  const { agency, role, account } = useApp()
  const userName = account?.name || (role === 'manager' ? agency.managerName : t('shell.side.teamMember'))
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
      <aside className={`sidebar ${p.open ? 'sidebar-open' : ''}`} aria-label={t('shell.side.main')}>
        <div className="side-brand">
          <Logo height={22} />
        </div>

        {/* On phones the sidebar is a slide-out menu: close it after a pick so the new screen isn't hidden behind it. */}
        <ClientSwitcher
          clients={p.clients}
          workspace={p.workspace}
          setWorkspace={(w) => {
            p.setWorkspace(w)
            p.onClose()
          }}
          onAddClient={() => {
            p.onAddClient()
            p.onClose()
          }}
        />

        <nav className="side-nav">
          {inClient ? (
            <>
              {item('home', 'home', t('shell.side.home'))}
              {item('search', 'search', t('shell.side.findIdeas'), undefined, p.view === 'search' || p.view === 'results')}
              {/* Plans = the board of saved ideas + review (batch mode) + one plan */}
              {item('shortlist', 'plans', t('shell.side.plans'), p.counts.plans, ['shortlist', 'review', 'plan'].includes(p.view))}
              <div className="side-sep" />
              {item('channel', 'channel', t('shell.side.channel'))}
              {item('settings', 'brief', t('shell.side.brief'))}
            </>
          ) : (
            <>
              {/* All clients Home (the view is still called 'overview' inside the app) */}
              {item('overview', 'home', t('shell.side.home'))}
              {item('channel', 'channel', t('shell.side.channel'))}
              <p className="side-hint">{t('shell.side.pickClient')}</p>
            </>
          )}
        </nav>

        <div className="side-foot">
          <a className="link-btn" href="/method" target="_blank" rel="noreferrer">
            {t('shell.side.method')}
          </a>
          {p.live ? (
            <span className="live-pill" title={t('shell.side.liveTip')}>
              {t('shell.side.live')}
            </span>
          ) : (
            <span className="sample-pill" title={t('shell.side.sampleTip')}>
              {t('shell.side.sample')}
            </span>
          )}
          {item('preferences', 'settings', t('shell.side.settings'))}
          <div className="side-user">
            <span className="avatar avatar-user">{initials(userName) || '?'}</span>
            <span className="side-user-text">
              <strong>{role === 'manager' && !account ? t('shell.side.manager', { name: userName }) : userName}</strong>
              <span className="small muted">{agency.agencyName}</span>
            </span>
            <button
              className="icon-btn"
              onClick={() => {
                p.onClose()
                p.onSignOut()
              }}
              aria-label={t('shell.side.signOut')}
              title={t('shell.side.signOut')}
            >
              <Icon name="out" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
