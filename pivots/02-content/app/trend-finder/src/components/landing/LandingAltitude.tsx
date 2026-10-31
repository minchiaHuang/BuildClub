import { useState } from 'react'

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

// Numbered mono label above a section headline. Numbers follow page order.
function Label({ n, children }: { n: string; children: string }) {
  return <span className="rk-label">{n}. {children}</span>
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

// Section 1b: one search ("tofu"), two clients. The picks change per client, and one video is ruled out
// because MYST has no kitchen. Clicking a pick opens the demo app.
type Pick = { title: string; score: string; why: string; blocked?: string }
const PICKS: Record<'evergreen' | 'myst', { name: string; about: string; picks: Pick[] }> = {
  evergreen: {
    name: 'Evergreen Foods',
    about: 'Plant-based meals · has a test kitchen',
    picks: [
      { title: 'Crispy tofu, three ways', score: '42×', why: 'Easy to film in their kitchen. Fits the weekly recipe slot.' },
      { title: 'Tofu blind taste test', score: '18×', why: 'Street interviews. Shows the product in real hands.' },
      { title: '15-minute tofu meal prep', score: '11×', why: 'Matches their "quick dinners" posts.' },
    ],
  },
  myst: {
    name: 'MYST Nightclub',
    about: 'Nightclub · bar and dance floor, no kitchen',
    picks: [
      { title: 'Tofu taste test at the bar', score: '18×', why: 'Crowd reactions suit a busy Friday night.' },
      { title: 'Late-night snack ranking', score: '9×', why: 'Staff on camera, filmed after close.' },
      { title: 'Crispy tofu, three ways', score: '42×', why: 'Needs a stove and prep space.', blocked: 'Can’t film: no kitchen' },
    ],
  },
}

function MiniDemo({ onDemo }: { onDemo: () => void }) {
  const [client, setClient] = useState<keyof typeof PICKS>('evergreen')
  const c = PICKS[client]
  return (
    <div className="rk-demo" aria-label="Example: the same search, picked for two different clients">
      <div className="rk-demo-bar">
        <span className="rk-demo-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="rk-demo-url">remake.app</span>
      </div>
      <div className="rk-demo-body">
        <div className="rk-demo-top">
          <div className="rk-demo-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <span>tofu</span>
          </div>
          <div className="rk-demo-switch" role="group" aria-label="Pick a client">
            {(Object.keys(PICKS) as (keyof typeof PICKS)[]).map((k) => (
              <button key={k} type="button" aria-pressed={client === k} className={client === k ? 'is-on' : ''} onClick={() => setClient(k)}>
                {PICKS[k].name}
              </button>
            ))}
          </div>
        </div>
        <p className="rk-demo-about">{c.about}</p>
        <ul className="rk-demo-picks" key={client}>
          {c.picks.map((p, i) => (
            <li key={p.title} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className={`rk-pick${p.blocked ? ' is-blocked' : ''}`} onClick={onDemo}>
                <Media kind="video" label="Trend clip" ratio="9 / 16" className="rk-pick-thumb" />
                <span className="rk-pick-text">
                  <span className="rk-pick-title">{p.title}</span>
                  <span className="rk-pick-why">{p.why}</span>
                  {p.blocked ? (
                    <span className="rk-badge rk-badge-no">{p.blocked}</span>
                  ) : i === 0 ? (
                    <span className="rk-badge rk-badge-best">★ Best to copy · {p.score}</span>
                  ) : (
                    <span className="rk-badge rk-badge-score">{p.score} usual views</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const STEPS: { title: string; text: string; shot: string; icon: keyof typeof ICONS }[] = [
  { title: 'Client profile', text: 'Add each client once: what they sell, their tone, and what they can’t film.', shot: 'Client profile screen', icon: 'profile' },
  { title: 'Search', text: 'Type a topic. See the videos getting far more views than usual.', shot: 'Search results screen', icon: 'search' },
  { title: 'Shortlist', text: 'Pick the videos worth copying for this client.', shot: 'Shortlist board', icon: 'star' },
  { title: 'Shot list', text: 'Each pick becomes a shot-by-shot plan your team can film.', shot: 'Shot list screen', icon: 'list' },
  { title: 'Manager approves', text: 'Your manager approves on their phone. Then you film.', shot: 'Manager review on phone', icon: 'check' },
]

const PROBLEMS = [
  { title: 'Ten clients. Ideas in ten chats.', text: 'Links pile up in DMs, notes and group chats. Nobody knows which idea is for which client.' },
  { title: 'Hours of scrolling for one video.', text: 'You scroll for an hour to find one video worth copying. Then you do it again for the next client.' },
  { title: 'Approvals lost in DMs.', text: 'The plan waits in your manager’s messages. Filming day comes and nothing is signed off.' },
]

const COMPARE: [string, string, string][] = [
  ['Who it’s for', 'One account', 'Every client you manage'],
  ['What you see', 'The same list for everyone', 'Picks for each client'],
  ['Can they film it?', 'Not checked', 'Checked against the client profile'],
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
    title: 'Approvals in seconds, from a phone.',
    text: 'Your manager sees the reference video and the shot list. They approve, approve with changes, or send it back with a reason.',
    media: 'Manager review on a phone',
  },
  {
    eyebrow: 'Client memory',
    title: 'It remembers what each client said.',
    text: 'Every approval and every “not this one” is saved to the client. Next month’s picks start from what they liked.',
    media: 'Client memory: “Sent back: not on brand”',
  },
]

const FAQ = [
  { q: 'Which platforms does it search?', a: 'TikTok today. Instagram is coming soon.' },
  { q: 'Does it write scripts for us?', a: 'No. Remake shows why a real video worked and plans the shots. Your team writes and films.' },
  { q: 'How long does approval take my manager?', a: 'About a minute per idea. They see the video, the shot list and a note, then tap approve or send back.' },
  { q: 'Can my clients log in?', a: 'Not yet. Client access is coming soon, by invite from your agency.' },
  { q: 'How much does it cost?', a: 'It’s free while Remake is in beta.' },
  { q: 'What happens to our data?', a: 'Your clients and plans stay in your agency’s account. We don’t share them or use them to train anything.' },
]

export function LandingAltitude({ onLogIn, onDemo }: { onLogIn: () => void; onDemo: () => void }) {
  return (
    <main className="rk">
      {/* 0 · Sticky nav */}
      <nav className="rk-nav" aria-label="Main">
        <div className="rk-wrap rk-nav-in">
          <a className="rk-logo" href="#top">
            <span className="rk-mark" aria-hidden="true">↗</span> Remake
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
            <Label n="01">For social media agencies</Label>
            <h1>Know what each client should <em>film</em> this week.</h1>
            <p className="rk-lede">
              Remake finds the trending videos worth copying for each client, plans the shots, and gets your manager’s OK.
              Built for agencies with 5 to 20 clients.
            </p>
            <div className="rk-ctas">
              <DemoButton onDemo={onDemo} big />
              <a className="rk-btn rk-btn-on-navy rk-btn-big" href="#tour">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg>
                Watch the 60-second tour
              </a>
            </div>
            <p className="rk-note">No sign-up. Sample agency ready.</p>
          </div>
          <MiniDemo onDemo={onDemo} />
        </div>
      </header>

      {/* 2 · Proof under the CTA. No logos until we have permission to use them. */}
      <section className="rk-proof-wrap" aria-label="Who it’s for">
        <div className="rk-wrap">
          <ul className="rk-proof">
            <li><strong>Shaped with Sydney social agencies</strong></li>
            <li>Ranks by <strong>views ÷ followers</strong>, the rule agencies already use</li>
            <li>Agency quote goes here <span className="rk-pending">(waiting on permission)</span></li>
          </ul>
        </div>
      </section>

      {/* Tour video: target of "Watch the 60-second tour" */}
      <section id="tour" className="rk-tour" aria-label="60-second tour">
        <div className="rk-wrap">
          <Media kind="video" label="60-second product tour" ratio="16 / 9" className="rk-tour-video" />
        </div>
      </section>

      {/* 3 · Problem */}
      <section className="rk-section" aria-labelledby="rk-problem-h">
        <div className="rk-wrap">
          <Label n="02">Sound familiar?</Label>
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
          <Label n="03">How it works</Label>
          <h2 id="rk-how-h">From a topic to an approved shot list, in five steps.</h2>
          <ol className="rk-cells">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rk-cell">
                <Media kind="photo" label={s.shot} ratio="4 / 3" />
                <Icon name={s.icon} />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="rk-cell-index">STEP [{String(i + 1).padStart(2, '0')}]</span>
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
          <Label n="04">Why not a trend tool?</Label>
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
          <Label n="05">Inside Remake</Label>
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
            <p className="rk-soft">Remake reads why real videos work. <em>Your team</em> films them.</p>
          </blockquote>
        </div>
      </section>

      {/* 8 · FAQ */}
      <section id="faq" className="rk-section rk-faq" aria-labelledby="rk-faq-h">
        <div className="rk-wrap rk-faq-in">
          <div>
            <Label n="06">FAQ</Label>
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
            <p className="rk-note">No sign-up. Sample agency ready.</p>
          </div>
        </div>
      </section>

      {/* 10 · Footer */}
      <footer className="rk-footer">
        <div className="rk-wrap rk-footer-in">
          <span className="rk-logo"><span className="rk-mark" aria-hidden="true">↗</span> Remake</span>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="mailto:hello@example.com">Contact</a>
            <a href="#top">Privacy</a>
            <a href="#top">Terms</a>
          </nav>
          <span className="rk-copy">© 2026 Remake</span>
        </div>
      </footer>
    </main>
  )
}
