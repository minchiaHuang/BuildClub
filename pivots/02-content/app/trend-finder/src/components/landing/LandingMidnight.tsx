// Public landing page for the Midnight direction. Sign-in is a demo for now; the sample-agency notes show only without the live API.
import { Pill, type PillSpec } from './midnight/Pills'
import { TypingSearch } from './TypingSearch'
import { useLiveInfo } from '../../lib/useLiveInfo'
import { useParallax } from './midnight/useParallax'

const PILLS: PillSpec[] = [
  { label: 'TIKTOK', tone: 'tiktok', platform: 'tiktok', x: '9%', y: '22%', rot: -8, depth: 1, front: true },
  { label: 'INSTAGRAM', tone: 'instagram', platform: 'instagram', x: '70%', y: '17%', rot: 7, depth: 0.45 },
  { label: 'YOUTUBE', tone: 'youtube', platform: 'youtube', x: '76%', y: '47%', rot: -6, depth: 1, front: true },
  { label: 'REDDIT', tone: 'reddit', platform: 'reddit', x: '4%', y: '55%', rot: 9, depth: 0.35 },
  { label: 'X', tone: 'x', platform: 'x', x: '30%', y: '14%', rot: 5, depth: 0.5 },
  { label: '153× BREAKOUT', tone: 'green', icon: '🚀', x: '16%', y: '68%', rot: -4, depth: 0.9, front: true },
  { label: 'RISING', tone: 'purple', icon: '📈', x: '62%', y: '71%', rot: 6, depth: 0.55 },
]

const BADGES = ['Built for agencies', 'TikTok live search', 'Client approvals']

function Laurel({ children }: { children: string }) {
  const leaf = (
    <svg viewBox="0 0 16 40" width="14" height="36" aria-hidden="true">
      <path d="M13 2C5 10 3 24 12 38" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {[8, 15, 22, 29].map((y) => (
        <ellipse key={y} cx="7" cy={y} rx="4.2" ry="2" transform={`rotate(-40 7 ${y})`} fill="currentColor" />
      ))}
    </svg>
  )
  return (
    <li className="mn-laurel">
      {leaf}
      <span>{children}</span>
      <span className="mn-flip">{leaf}</span>
    </li>
  )
}

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function LandingMidnight({ onLogIn, onRegister }: { onLogIn: () => void; onRegister: () => void }) {
  const { mode } = useLiveInfo()
  const ref = useParallax<HTMLDivElement>()
  return (
    <main className="landing landing-midnight">
      <div className="mn-panel" ref={ref}>
        <nav className="mn-nav">
          <span className="mn-brand">
            <span className="mn-mark" aria-hidden="true" />
            Trend Finder
          </span>
          <span className="mn-links">
            <a href="#mn-how">Features</a>
            <a href="#mn-how">Pricing</a>
            <a href="#mn-how">Reviews</a>
          </span>
          <span className="mn-nav-right">
            <button className="mn-textbtn" onClick={onLogIn}>Log in</button>
            <button className="mn-whitepill" onClick={onRegister}>Ask for access</button>
          </span>
        </nav>

        <div className="mn-stage">
          {PILLS.map((p, i) => (
            <Pill key={p.label} p={p} i={i} />
          ))}
          <h1 className="mn-headline">
            Find the videos
            <br />
            worth copying,
            <br />
            for every client.
          </h1>
        </div>

        <p className="mn-sub">See which TikToks are getting far more views than usual, and plan a version for each brand you manage.</p>
        <TypingSearch variant="midnight" />
        <div className="mn-hero-cta">
          <button className="mn-blue" onClick={onRegister}>
            Ask for access <Arrow />
          </button>
          <button className="mn-link" onClick={onLogIn}>Log in to your dashboard</button>
          {mode === 'sample' && <span className="mn-demo">Demo: both buttons open the sample agency.</span>}
        </div>
        <ul className="mn-laurels">
          {BADGES.map((b) => (
            <Laurel key={b}>{b}</Laurel>
          ))}
        </ul>
      </div>

      <section className="mn-how" id="mn-how">
        <h2>How it works</h2>
        <ol className="mn-steps">
          <li>
            <div className="mn-card">
              <div className="mn-mock-search">🔍 vegan meal prep<span>Search</span></div>
            </div>
            <h3>1. Search the niche</h3>
            <p>Type what your client is about. We search TikTok live.</p>
          </li>
          <li>
            <div className="mn-card">
              <div className="mn-mock-score">
                4k <span>→</span> 610k<b>153×</b>
              </div>
            </div>
            <h3>2. Find the outliers</h3>
            <p>Videos ranked by how far they beat the account’s usual views.</p>
          </li>
          <li>
            <div className="mn-card">
              <ul className="mn-mock-plan">
                <li><i>1</i>Hook: “I tried tofu 5 ways”</li>
                <li><i>2</i>Fast cuts, overhead</li>
                <li><i>3</i>Reveal + caption</li>
              </ul>
            </div>
            <h3>3. Turn it into a shot plan</h3>
            <p>Early, Rising or Peaked: pick the format before it’s everywhere.</p>
          </li>
          <li>
            <div className="mn-card">
              <div className="mn-mock-phone">
                <span>Annie · Plan</span>
                <b>Approve</b>
              </div>
            </div>
            <h3>4. Client approves</h3>
            <p>Annie approves on their phone. Copy the brief for your editor.</p>
          </li>
        </ol>
        <div className="mn-close">
          <h2>Find the next one first.</h2>
          <div className="mn-close-btns">
            <button className="mn-blue" onClick={onRegister}>Ask for access <Arrow /></button>
            <button className="mn-ghost" onClick={onLogIn}>Log in</button>
          </div>
        </div>
      </section>
    </main>
  )
}
