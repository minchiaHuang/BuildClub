import { PlatformLogo, type LogoPlatform } from '../PlatformToggles'
import { Logo } from '../Logo'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'

// Public landing page, built to the conversion flow in docs/landing-page-flow.md (sections 0–10)
// and the look in docs/landing-page-design.md ("Classic + Night Shift": white page, navy panels, dots on some navy).
// One goal: a click on "Try the demo", which skips sign-up and opens the sample agency.
// Photos and videos are labelled placeholders until the real screenshots and tour are ready.
// Styles: src/styles/landing-remake.css, scoped under .rk.

const CTA = 'Try the demo'

// Placeholder for a photo or video that will be supplied later. The label says what goes there.
function Media({ kind, label, ratio, className = '' }: { kind: 'photo' | 'video'; label: string; ratio: string; className?: string }) {
  const name = kind === 'video' ? 'Video' : 'Photo'
  return (
    <div className={`rk-ph rk-ph-${kind} ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={`${name} placeholder: ${label}`}>
      <span className="rk-ph-tag">
        {kind === 'video' ? (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 5-4.5 3.5 3 2.5-2 3 3.5" /></svg>
        )}
        {name}
      </span>
      <span className="rk-ph-label">{label}</span>
    </div>
  )
}

function DemoButton({ onDemo, big }: { onDemo: () => void; big?: boolean }) {
  return (
    <button type="button" className={`rk-btn rk-btn-primary${big ? ' rk-btn-big' : ''}`} onClick={onDemo}>
      {CTA} <span className="rk-arrow" aria-hidden="true">→</span>
    </button>
  )
}

const ICONS = {
  profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  star: <path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.6-.8z" />,
  list: <><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  check: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="m9.5 12 2 2 3.5-4" /></>,
}
function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="rk-cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

// Section 1b: one search ("tofu") for one sample client. Hovering (or focusing) a pick fades its video in above the card
// card below it; clicking opens the full preview (PickPreview), whose button opens the demo app.
// Sample data only: the accounts and numbers are made up for the landing page.
type Pick = {
  title: string
  score: string
  why: string
  // Who posted it and how it did, for the preview.
  account: string
  views: string
  // Why it's worth copying for this client, in one or two sentences (preview only).
  reason: string
  // What the agency would film, 3–4 shots with a start time (preview only).
  shots?: [time: string, shot: string][]
  blocked?: string
}
type ClientKey = 'evergreen'
const PICKS: Record<ClientKey, { name: string; about: string; picks: Pick[] }> = {
  evergreen: {
    name: 'Evergreen Foods',
    about: 'Plant-based meals · has a test kitchen',
    picks: [
      {
        title: 'Crispy tofu, three ways',
        score: '42×',
        why: 'Easy to film in their kitchen. Fits the weekly recipe slot.',
        account: '@saucyplants',
        views: '1.4M views · usually 33K',
        reason: 'Evergreen already posts a weekly recipe from its test kitchen. This is three quick cooks of one product, so the team can film it in an afternoon with no new gear.',
        shots: [
          ['0:00', 'Close-up: the tofu block drops onto the board'],
          ['0:03', 'Press and cube it, sped up'],
          ['0:08', 'Three pans side by side, one per recipe'],
          ['0:20', 'Crunch test, then the pack shot'],
        ],
      },
      {
        title: 'Tofu blind taste test',
        score: '18×',
        why: 'Street interviews. Shows the product in real hands.',
        account: '@streeteats.syd',
        views: '410K views · usually 23K',
        reason: 'Real people tasting the product sells it better than an ad. One person with a phone and a tray of samples can film this outside a shop.',
        shots: [
          ['0:00', 'Hook: “Can you tell which one is tofu?”'],
          ['0:02', 'Three strangers taste, faces close up'],
          ['0:12', 'The reveal'],
          ['0:18', 'Pack shot and where to buy it'],
        ],
      },
      {
        title: '15-minute tofu meal prep',
        score: '11×',
        why: 'Matches their "quick dinners" posts.',
        account: '@prepwithpri',
        views: '260K views · usually 24K',
        reason: 'It fits Evergreen’s “quick dinners” posts. The timer on screen gives people a reason to watch to the end.',
        shots: [
          ['0:00', 'Timer starts on screen'],
          ['0:02', 'Chop and fry, filmed from above'],
          ['0:15', 'Fill four lunch boxes'],
          ['0:25', 'Into the fridge, timer stops at 15:00'],
        ],
      },
    ],
  },
}

// The badge on a pick: winner (mustard), score, or why it can't be filmed.
function PickBadge({ pick, best }: { pick: Pick; best: boolean }) {
  if (pick.blocked) return <span className="rk-badge rk-badge-no">{pick.blocked}</span>
  if (best) return <span className="rk-badge rk-badge-best">★ Best to copy · {pick.score}</span>
  return <span className="rk-badge rk-badge-score">{pick.score} their usual views</span>
}

// opener: the card that opened the preview, so focus can go back to it (Safari doesn't focus buttons on click).
type Preview = { client: ClientKey; index: number; opener: HTMLElement }

const DEMO_PLATFORMS: { id: LogoPlatform; name: string }[] = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'x', name: 'X' },
  { id: 'reddit', name: 'Reddit' },
]

function MiniDemo({ onPreview }: { onPreview: (p: Preview) => void }) {
  const client: ClientKey = 'evergreen'
  const c = PICKS[client]
  const [platform, setPlatform] = useState<LogoPlatform>('tiktok')
  return (
    <div className="rk-demo" aria-label={`Example: a search for tofu, picked for ${c.name}`}>
      <div className="rk-demo-bar">
        <span className="rk-demo-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="rk-demo-url">remake.app</span>
      </div>
      <div className="rk-demo-body">
        <div className="rk-demo-platforms" role="group" aria-label="Where to search">
          {DEMO_PLATFORMS.map((pl) => (
            <button
              key={pl.id}
              type="button"
              className={platform === pl.id ? 'is-on' : undefined}
              aria-pressed={platform === pl.id}
              onClick={() => setPlatform(pl.id)}
            >
              <PlatformLogo platform={pl.id} size={22} />
              <span>{pl.name}</span>
            </button>
          ))}
        </div>
        <div className="rk-demo-top">
          <div className="rk-demo-search">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <span>tofu</span>
          </div>
          <span className="rk-demo-client">{c.name}</span>
        </div>
        <p className="rk-demo-about">{c.about}</p>
        <ul className="rk-demo-picks">
          {c.picks.map((p, i) => (
            <li key={p.title} style={{ '--i': i } as CSSProperties}>
              <button
                type="button"
                className={`rk-pick${p.blocked ? ' is-blocked' : ''}`}
                aria-haspopup="dialog"
                onClick={(e) => onPreview({ client, index: i, opener: e.currentTarget })}
              >
                <Media kind="video" label="Trending video" ratio="9 / 16" className="rk-pick-thumb" />
                <span className="rk-pick-text">
                  <span className="rk-pick-title">{p.title}</span>
                  <span className="rk-pick-meta">{p.account} · {p.views}</span>
                  <span className="rk-pick-why">{p.why}</span>
                  <PickBadge pick={p} best={i === 0} />
                </span>
              </button>
              {/* On hover or keyboard focus: the video alone, fading in just above its own card. Decorative copy of the thumb. */}
              <div className="rk-hovercard" aria-hidden="true">
                <div className="rk-hovercard-video">
                  <span className="rk-hovercard-playing">
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg>
                    Playing
                  </span>
                  <span className="rk-hovercard-progress"><i /></span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// In-page preview of one pick: the video big, why it suits the client, and the first few shots
// (or why it can't be filmed). Focus stays inside; Esc, the backdrop and Close all close it,
// and focus goes back to the card that opened it.
function PickPreview({ preview, onClose, onDemo }: { preview: Preview; onClose: () => void; onDemo: () => void }) {
  const client = PICKS[preview.client]
  const pick = client.picks[preview.index]
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { opener } = preview
    cardRef.current?.focus({ preventScroll: true })
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [onClose, preview])

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !cardRef.current) return
    const items = [...cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const inside = cardRef.current.contains(active) && active !== cardRef.current
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="rk-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={cardRef}
        className="rk-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rk-preview-title"
        aria-describedby="rk-preview-reason"
        tabIndex={-1}
        onKeyDown={trapTab}
      >
        <div className={`rk-modal-media rk-dots${pick.blocked ? ' is-blocked' : ''}`}>
          <Media kind="video" label={`Trending video: ${pick.title}`} ratio="9 / 16" className="rk-modal-video" />
        </div>
        <div className="rk-modal-body">
          <div className="rk-modal-scroll">
            <span className="rk-eyebrow">For {client.name} · search “tofu”</span>
            <h2 id="rk-preview-title" className="rk-modal-title">{pick.title}</h2>
            <p className="rk-modal-meta">{pick.account} · {pick.views}</p>
            <PickBadge pick={pick} best={preview.index === 0} />
            <h3 className="rk-modal-h">{pick.blocked ? 'Why it can’t be filmed' : `Why it suits ${client.name}`}</h3>
            <p id="rk-preview-reason" className="rk-modal-text">{pick.reason}</p>
            {pick.shots && (
              <>
                <h3 className="rk-modal-h">What your team would film</h3>
                <ul className="rk-shots">
                  {pick.shots.map(([time, shot]) => (
                    <li key={time}>
                      <span className="rk-shot-time">{time}</span>
                      <span>{shot}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="rk-modal-actions">
            <button type="button" className="rk-btn rk-btn-outline" onClick={onClose}>Close</button>
            <button type="button" className="rk-btn rk-btn-primary" onClick={onDemo}>
              {pick.blocked ? CTA : 'Plan this in the demo'} <span className="rk-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS: { title: string; text: string; shot: string; icon: keyof typeof ICONS }[] = [
  { title: 'Client profile', text: 'Add each client once: what they sell, how they sound, and what they can’t film.', shot: 'Client profile screen', icon: 'profile' },
  { title: 'Search', text: 'Type a topic. See the videos that got way more views than usual.', shot: 'Search results screen', icon: 'search' },
  { title: 'Shortlist', text: 'Pick the videos worth copying for this client.', shot: 'Shortlist board', icon: 'star' },
  { title: 'Shot list', text: 'Turn each pick into a shot list your team can film.', shot: 'Shot list screen', icon: 'list' },
  { title: 'Manager approves', text: 'Your manager approves on their phone. Then you film.', shot: 'Manager review on phone', icon: 'check' },
]

// How it works: each step card shows a small animated product illustration instead of a photo.
// Plays once per card when it scrolls into view (staggered left to right), replays on hover.
// The end state is the base CSS, so reduced motion (and no JS) shows the finished picture.
// Styles: "How it works illustrations" in landing-remake.css.
const ART_STAGGER = 450
const ART_MS = 2800 // whole run of one card, at the CSS --slow factor
const at = (ms: number) => ({ '--t': `${ms}ms` }) as CSSProperties
const Tick = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4 8.5 2.6 2.5L12 5.5" /></svg>
)
const Play = () => <svg viewBox="0 0 16 16"><path d="M5.5 3.5v9l7-4.5z" fill="currentColor" /></svg>

function ArtProfile() {
  const rows = [['Sells', 'Tofu meals'], ['Tone', 'Warm, funny'], ['Can’t film', 'Outdoors']]
  return (
    <div className="rk-art-card">
      <div className="rk-art-head rk-a rk-a-fade"><span className="rk-art-avatar">EF</span><b>Evergreen Foods</b></div>
      {rows.map(([k, v], i) => (
        <div key={k} className="rk-art-row">
          <span className="rk-art-mono rk-a rk-a-fade" style={at(150 + i * 250)}>{k}</span>
          <span className="rk-art-val rk-a rk-a-wipe" style={at(250 + i * 250)}>{v}</span>
          <span className="rk-art-tick rk-a rk-a-pop" style={at(450 + i * 250)}><Tick /></span>
        </div>
      ))}
    </div>
  )
}

function ArtSearch() {
  return (
    <>
      <div className="rk-art-search rk-a rk-a-rise">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <span className="rk-art-typed rk-a rk-a-type" style={at(150)}>tofu</span>
      </div>
      <span className="rk-art-mono rk-a rk-a-fade" style={at(700)}>3 videos way above usual</span>
      <div className="rk-art-tiles">
        {['42×', '18×', '9×'].map((m, i) => (
          <div key={m} className="rk-art-tile rk-a rk-a-drop" style={at(800 + i * 100)}>
            <span className="rk-art-thumb"><Play /></span>
            <span className="rk-art-mult">{m}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function ArtShortlist() {
  const picks = [['Crispy tofu, 3 ways', '42×'], ['Tofu taste test', '18×'], ['Silken tofu hack', '9×']]
  return (
    <div className="rk-art-list">
      {picks.map(([t, m], i) => (
        <div key={t} className={`rk-art-pick rk-a rk-a-rise${i ? ' rk-art-pick-lose' : ''}`} style={at(i * 80)}>
          <div className="rk-art-pick-in rk-a rk-a-dim" style={at(750)}>
            <span className="rk-art-thumb"><Play /></span>
            <span className="rk-art-pick-t">{t}</span>
            <span className="rk-art-mult rk-a rk-a-pop" style={at(300 + i * 80)}>{m}</span>
          </div>
          {i === 0 && <span className="rk-art-pill rk-art-best rk-a rk-a-pop" style={at(800)}>★ Best to copy</span>}
        </div>
      ))}
    </div>
  )
}

function ArtShots() {
  const shots = [['0–2s', 'Close-up: tofu sizzles'], ['2–6s', 'Flip it, three ways'], ['6–12s', 'First bite, reaction'], ['12–15s', 'Caption and logo']]
  return (
    <div className="rk-art-card">
      <div className="rk-art-head rk-a rk-a-fade"><span className="rk-art-mono">Shot list</span><b>Crispy tofu</b></div>
      {shots.map(([time, text], i) => (
        <div key={time} className="rk-art-shot">
          <span className="rk-art-mono rk-a rk-a-fade" style={at(200 + i * 220)}>{time}</span>
          <span className="rk-art-val rk-a rk-a-wipe" style={at(260 + i * 220)}>{text}</span>
        </div>
      ))}
    </div>
  )
}

function ArtApprove() {
  return (
    <div className="rk-art-board">
      <div className="rk-art-col">
        <span className="rk-art-mono">Waiting</span>
        <div className="rk-art-mini rk-a rk-a-up" style={at(450)}>
          <span className="rk-art-thumb"><Play /></span>
          <b>Taste test</b>
          <span className="rk-art-pill rk-art-wait">Waiting</span>
        </div>
      </div>
      <div className="rk-art-col">
        <span className="rk-art-mono">Approved</span>
        <div className="rk-art-mini rk-a rk-a-move" style={at(200)}>
          <span className="rk-art-thumb"><Play /></span>
          <b>Crispy tofu</b>
          <span className="rk-art-pills">
            <span className="rk-art-pill rk-art-wait rk-a rk-a-out" style={at(350)}>Waiting</span>
            <span className="rk-art-pill rk-art-ok rk-a rk-a-pop" style={at(480)}>✓ Approved</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const STEP_ART: Record<keyof typeof ICONS, () => React.JSX.Element> = {
  profile: ArtProfile,
  search: ArtSearch,
  star: ArtShortlist,
  list: ArtShots,
  check: ArtApprove,
}

function StepArt({ name }: { name: keyof typeof ICONS }) {
  const Art = STEP_ART[name]
  return (
    <div className="rk-art" aria-hidden="true">
      <div className="rk-art-stage"><Art /></div>
    </div>
  )
}

// Arms the cards (hidden start state), then autoplays them whenever the section scrolls into view. Reduced motion: never armed.
function useStepArt() {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = ref.current
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cells = Array.from(list.querySelectorAll<HTMLElement>('.rk-cell'))
    const play = (cell: HTMLElement, delay: number) => {
      cell.style.setProperty('--d', `${delay}ms`)
      cell.dataset.artStart = String(performance.now() + delay)
      cell.classList.add('rk-run')
    }
    list.classList.add('rk-armed')
    if (!('IntersectionObserver' in window)) {
      cells.forEach((c, i) => play(c, i * ART_STAGGER))
      return
    }
    // Autoplay: when the section scrolls into view, play all five cards left to right.
    // Scrolled away and back, it plays again. Nothing loops while it stays on screen.
    let playing = false
    const io = new IntersectionObserver(([entry]) => {
      if (!playing && entry.intersectionRatio >= 0.3) {
        playing = true
        cells.forEach((cell, i) => {
          cell.classList.add('rk-reset')
          void cell.offsetWidth
          cell.classList.remove('rk-reset')
          play(cell, i * ART_STAGGER)
        })
      } else if (playing && !entry.isIntersecting) {
        playing = false
        cells.forEach((cell) => cell.classList.remove('rk-run'))
      }
    }, { threshold: [0, 0.3] })
    io.observe(list)
    return () => {
      io.disconnect()
      list.classList.remove('rk-armed')
      cells.forEach((c) => c.classList.remove('rk-run', 'rk-reset'))
    }
  }, [])
  // Replay on hover or focus, once the current run has finished
  const replay = (e: SyntheticEvent<HTMLLIElement>) => {
    const cell = e.currentTarget
    if (!ref.current?.classList.contains('rk-armed')) return
    if (performance.now() < Number(cell.dataset.artStart ?? 0) + ART_MS) return
    cell.style.setProperty('--d', '0ms')
    cell.dataset.artStart = String(performance.now())
    cell.classList.add('rk-reset')
    void cell.offsetWidth
    cell.classList.remove('rk-reset')
    cell.classList.add('rk-run')
  }
  return { ref, replay }
}

const PROBLEMS = [
  { title: 'Ten clients. Ideas in ten chats.', text: 'Links pile up in DMs, notes and group chats. Nobody knows which idea is for which client.' },
  { title: 'Hours of scrolling for one video.', text: 'You scroll for an hour to find one video worth copying. Then you do it again for the next client.' },
  { title: 'Approvals lost in DMs.', text: 'The plan waits in your manager’s messages. Filming day comes and nothing is signed off.' },
]

const COMPARE: [string, string, string][] = [
  ['Who it’s for', 'One account', 'Every client you manage'],
  ['What you see', 'The same list for everyone', 'Picks for each client'],
  ['Can they film it?', 'Not checked', 'Checked against what the client can film'],
  ['Where it stops', 'At the video', 'At a shot list your team can film'],
  ['Approvals', 'Lost in chat', 'In one place, on the manager’s phone'],
  ['Memory', 'Forgets', 'Remembers every yes, no and reason'],
]

const CLOSEUPS = [
  {
    eyebrow: 'Shortlist board',
    title: 'Every client’s ideas on one board.',
    text: 'See what’s shortlisted, what’s waiting for your manager, and what’s ready to film. No more ideas spread across ten chats.',
    media: 'Shortlist board: Shortlisted → Waiting → Approved',
  },
  {
    eyebrow: 'Manager review',
    title: 'Approvals from a phone, in about a minute.',
    text: 'Your manager sees the original video and your shot list. They approve it, ask for changes, or send it back with a reason.',
    media: 'Manager review on a phone',
  },
  {
    eyebrow: 'Client memory',
    title: 'It remembers what each client said.',
    text: 'Every approval and every “not this one” is saved to the client. Next month, you can see what they liked and why.',
    media: 'Client memory: “Sent back: not on brand”',
  },
]

const FAQ = [
  { q: 'Which apps does it search?', a: 'TikTok today. Instagram is coming soon.' },
  { q: 'Does it write scripts for us?', a: 'No. Remake shows why a real video worked and lays out the shots. Your team writes and films.' },
  { q: 'How long does it take my manager to approve?', a: 'About a minute per idea. They see the video, the shot list and a note, then tap approve or send back.' },
  { q: 'Can my clients log in?', a: 'Not yet. Client access is coming soon, by invite from your agency.' },
  { q: 'How much does it cost?', a: 'It’s free while we’re still testing it.' },
  { q: 'Who can see our client info?', a: 'Your clients and plans stay in your agency’s account. We don’t share them or use them to train anything.' },
]

export function LandingAltitude({ onLogIn, onDemo }: { onLogIn: () => void; onDemo: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const stepArt = useStepArt()
  return (
    <main className="rk">
      {/* 0 · Sticky nav */}
      <nav className="rk-nav" aria-label="Main">
        <div className="rk-wrap rk-nav-in">
          <a className="rk-logo" href="#top">
            <Logo height={24} />
          </a>
          <div className="rk-links">
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="rk-nav-actions">
            <button type="button" className="rk-btn rk-btn-ghost" onClick={onLogIn}>Log in</button>
            <button type="button" className="rk-btn rk-btn-primary rk-btn-sm" onClick={onDemo}>{CTA}</button>
          </div>
        </div>
      </nav>

      {/* 1 · Hero: navy panel with dots; the mini demo (1b) overlaps its bottom edge */}
      <header id="top" className="rk-hero">
        <div className="rk-wrap">
          <div className="rk-panel rk-dots rk-hero-panel">
            <span className="rk-announce"><span className="rk-badge rk-badge-new">New</span> Instagram search is coming soon</span>
            <h1>Know what each client should <em>film</em> this week.</h1>
            <p className="rk-lede">
              Remake finds the TikToks worth copying for each client, plans the shots, and gets your manager’s OK before you film.
              Made for agencies with 5 to 20 clients.
            </p>
            <div className="rk-ctas">
              <DemoButton onDemo={onDemo} big />
              <a className="rk-btn rk-btn-on-navy rk-btn-big" href="#tour">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg>
                Watch the tour (under a minute)
              </a>
            </div>
            <p className="rk-note">No sign-up. A sample agency is ready to go.</p>
          </div>
          <MiniDemo onPreview={setPreview} />
        </div>
      </header>

      {/* 2 · Proof under the CTA. No logos until we have permission to use them. */}
      <section className="rk-proof-wrap" aria-label="Who it’s for">
        <div className="rk-wrap">
          <ul className="rk-proof">
            <li><strong>Built with social agencies in Sydney</strong></li>
            <li>Ranks videos by <strong>views ÷ followers</strong>, the check agencies already do by hand</li>
            <li>Quote from an agency goes here <span className="rk-pending">(waiting for their OK)</span></li>
          </ul>
        </div>
      </section>

      {/* Tour video: target of "Watch the tour" */}
      <section id="tour" className="rk-tour" aria-label="Product tour, under a minute">
        <div className="rk-wrap">
          <video
            className="rk-tour-video"
            controls
            preload="metadata"
            playsInline
            poster="/media/remake-tour-poster.jpg"
            aria-label="Remake product tour, under a minute: find a trending video, check the client can film it, and plan the shoot"
          >
            <source src="/media/remake-tour.mp4" type="video/mp4" />
            Your browser can’t play this video. <a href="/media/remake-tour.mp4">Download the tour (MP4)</a>.
          </video>
        </div>
      </section>

      {/* 3 · Problem */}
      <section className="rk-section" aria-labelledby="rk-problem-h">
        <div className="rk-wrap">
          <h2 id="rk-problem-h">Finding ideas shouldn’t take <em>all week</em>.</h2>
          <div className="rk-problems">
            {PROBLEMS.map((p) => (
              <article key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · How it works, on the hairline grid, then the second CTA */}
      <section id="how" className="rk-section rk-grid" aria-labelledby="rk-how-h">
        <div className="rk-wrap">
          <h2 id="rk-how-h">From one search to an approved shot list, in five steps.</h2>
          <ol className="rk-cells" ref={stepArt.ref}>
            {STEPS.map((s) => (
              <li key={s.title} className="rk-cell" onPointerEnter={stepArt.replay} onFocus={stepArt.replay}>
                <StepArt name={s.icon} />
                <Icon name={s.icon} />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="rk-center">
            <DemoButton onDemo={onDemo} big />
          </div>
        </div>
      </section>

      {/* 5 · Why not a trend tool? Night band, no dots behind the table */}
      <section className="rk-section rk-night" aria-labelledby="rk-vs-h">
        <div className="rk-wrap">
          <h2 id="rk-vs-h">Trend tools show what’s popular. Remake shows what each client should <em>film</em>.</h2>
          <div className="rk-table-wrap">
            <table className="rk-table">
              <thead>
                <tr>
                  <th scope="col"><span className="rk-sr">Compared</span></th>
                  <th scope="col">Trend tools</th>
                  <th scope="col" className="rk-us">Remake</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, them, us]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{them}</td>
                    <td className="rk-us"><span className="rk-tick" aria-hidden="true">✓</span>{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6 · Close-ups for the agency owner */}
      <section className="rk-section" aria-labelledby="rk-inside-h">
        <div className="rk-wrap">
          <h2 id="rk-inside-h" className="rk-sr">Inside Remake</h2>
          <div className="rk-closeups">
            {CLOSEUPS.map((c) => (
              <article key={c.eyebrow} className="rk-closeup">
                <div className="rk-closeup-copy">
                  <span className="rk-eyebrow">{c.eyebrow}</span>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </div>
                <Media kind="photo" label={c.media} ratio="4 / 3" className="rk-closeup-media" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · Stance: night band with dots */}
      <section className="rk-section rk-night rk-dots rk-stance" aria-label="Our stance">
        <div className="rk-wrap">
          <blockquote>
            <p>We don’t write your content.</p>
            <p className="rk-soft">Remake shows why real videos worked. <em>Your team</em> films them.</p>
          </blockquote>
        </div>
      </section>

      {/* 8 · FAQ */}
      <section id="faq" className="rk-section rk-faq" aria-labelledby="rk-faq-h">
        <div className="rk-wrap rk-faq-in">
          <div>
            <h2 id="rk-faq-h">Questions agencies ask.</h2>
          </div>
          <div className="rk-faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<span className="rk-plus" aria-hidden="true" /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9 · Final CTA: navy panel with dots */}
      <section className="rk-final" aria-labelledby="rk-final-h">
        <div className="rk-wrap">
          <div className="rk-panel rk-dots rk-final-panel">
            <h2 id="rk-final-h">See what each client should <em>film</em> this week.</h2>
            <DemoButton onDemo={onDemo} big />
            <p className="rk-note">No sign-up. A sample agency is ready to go.</p>
          </div>
        </div>
      </section>

      {/* 10 · Footer */}
      <footer className="rk-footer">
        <div className="rk-wrap rk-footer-in">
          <span className="rk-logo"><Logo height={22} /></span>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            {/* Placeholders until the pages and a real inbox exist: plain text, not links, so nothing jumps or opens. */}
            {['Contact', 'Privacy', 'Terms'].map((label) => (
              <span key={label} className="rk-soon">{label} <span className="rk-soon-tag">soon</span></span>
            ))}
          </nav>
          <span className="rk-copy">© 2026 Remake</span>
        </div>
      </footer>

      {preview && <PickPreview preview={preview} onClose={closePreview} onDemo={onDemo} />}
    </main>
  )
}
