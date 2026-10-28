import { TypingSearch } from './TypingSearch'
import { useLiveInfo } from '../../lib/useLiveInfo'
import { Pill, type PillSpec } from './midnight/Pills'
import { PlatformLogo } from '../PlatformToggles'
import type { LogoPlatform } from '../PlatformToggles'

// Public landing page for the Altitude direction: website hero + "what it does" section, with Log in and Register.
// Sign-in is a demo for now; the sample-agency notes show only without the live API.
// Reuses the Altitude hero classes (.alt-sky, .alt-cloud, .alt-rot, .alt-icons) from theme-altitude.css.
// How the platforms appear in the sky: 'tags' (Midnight-style text pills, being tried now) or 'round' (logo badges).
// The round version is kept so we can switch back by changing this one value.
const SKY_STYLE: 'tags' | 'round' = 'tags'

// Text tags around the headline, kept to the sides so they never cover it. Depth 1 = sharp and in front, lower = smaller and blurred.
const TAGS: PillSpec[] = [
  { label: 'TIKTOK', tone: 'tiktok', platform: 'tiktok', x: '5%', y: '24%', rot: -8, depth: 1, front: true },
  { label: 'INSTAGRAM', tone: 'instagram', platform: 'instagram', x: '74%', y: '13%', rot: 7, depth: 1, front: true },
  { label: 'YOUTUBE', tone: 'youtube', platform: 'youtube', x: '5%', y: '58%', rot: 6, depth: 0.6 },
  { label: 'X', tone: 'x', platform: 'x', x: '86%', y: '50%', rot: -6, depth: 0.35 },
  { label: 'REDDIT', tone: 'reddit', platform: 'reddit', x: '22%', y: '13%', rot: 5, depth: 0.3 },
  { label: '153× BREAKOUT', tone: 'green', icon: '🚀', x: '76%', y: '68%', rot: -4, depth: 0.85, front: true },
  { label: 'RISING', tone: 'purple', icon: '📈', x: '20%', y: '80%', rot: 6, depth: 0.15 },
]

// Platform icons framing the headline, sized by importance: TikTok (live) first, then Instagram and YouTube, then Reddit and X.
const SKY: { p: LogoPlatform; x: string; y: string; size: number; rank: 1 | 2 | 3; delay: string }[] = [
  { p: 'tiktok', x: '13%', y: '22%', size: 88, rank: 1, delay: '0ms' },
  { p: 'instagram', x: '81%', y: '20%', size: 72, rank: 2, delay: '120ms' },
  { p: 'youtube', x: '8%', y: '56%', size: 60, rank: 2, delay: '240ms' },
  { p: 'x', x: '88%', y: '54%', size: 44, rank: 3, delay: '360ms' },
  { p: 'reddit', x: '76%', y: '72%', size: 40, rank: 3, delay: '480ms' },
]

function StepIcon({ kind }: { kind: 'search' | 'plan' }) {
  return kind === 'search' ? (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  )
}

export function LandingAltitude({ onLogIn, onRegister }: { onLogIn: () => void; onRegister: () => void }) {
  const { mode } = useLiveInfo()
  return (
    <main className="landing landing-alt">
      <a className="la-strip" href="#what">
        Now searching TikTok live{' '}
        {mode === 'sample' && (
          <>
            <span aria-hidden="true">·</span> Instagram coming soon{' '}
          </>
        )}
        <span aria-hidden="true">→</span>
      </a>
      <nav className="la-nav" aria-label="Main">
        <a className="la-logo" href="#top">
          <span className="la-mark" aria-hidden="true">↗</span> Trend Finder
        </a>
        <div className="la-links">
          <a href="#what">Product</a>
          <a href="#what">How it works</a>
          <a href="#cta">Pricing</a>
        </div>
        <div className="la-actions">
          <button type="button" className="la-pill la-outline" onClick={onLogIn}>Log in</button>
          <button type="button" className="la-pill la-solid" onClick={onRegister}>Register</button>
        </div>
      </nav>

      <header id="top" className="alt-hero la-hero">
        <div className="alt-sky" aria-hidden="true">
          <span className="alt-cloud c1" /><span className="alt-cloud c2" /><span className="alt-cloud c3" /><span className="alt-cloud c4" />
        </div>
        {/* Platform icons framing the headline, biggest = most important. */}
        {SKY_STYLE === 'tags' ? (
          <div className="la-sky-icons la-sky-tags" aria-hidden="true">
            {TAGS.map((t, i) => (
              <Pill key={t.label} p={t} i={i} />
            ))}
          </div>
        ) : (
          <div className="la-sky-icons" aria-hidden="true">
            {SKY.map((s) => (
              <span key={s.p} className={`la-sky-icon rank-${s.rank}`} style={{ left: s.x, top: s.y, '--d': s.delay } as React.CSSProperties}>
                <PlatformLogo platform={s.p} size={s.size} />
              </span>
            ))}
          </div>
        )}
        <div className="alt-ground" aria-hidden="true" />
        <div className="alt-hero-inner">
          <span className="alt-eyebrow">Trend research for social media agencies</span>
          <h1 className="alt-headline la-headline la-stacked">
            <span className="alt-left">Find the videos worth copying,</span>
            <span className="alt-right">for every client.</span>
          </h1>
          <p className="alt-lede la-lede">
            See which TikToks are getting far more views than usual, and plan a version for each brand you manage.
          </p>
          <TypingSearch variant="altitude" />
          <div className="la-ctas">
            <button type="button" className="la-pill la-solid la-big" onClick={onRegister}>Register free</button>
            <button type="button" className="la-pill la-outline la-big" onClick={onLogIn}>Log in to dashboard</button>
          </div>
          {mode === 'sample' && <p className="la-note">Demo: both buttons open the sample agency.</p>}
        </div>
      </header>

      <section id="what" className="la-what" aria-labelledby="la-what-h">
        <span className="la-eyebrow">What it does</span>
        <h2 id="la-what-h">From a niche to an approved video, in four steps.</h2>
        <ol className="la-steps">
          <li className="la-step">
            <span className="la-ico"><StepIcon kind="search" /></span>
            <div className="la-vis la-vis-search"><span>vegan meal prep</span><i aria-hidden="true">↵</i></div>
            <h3>Search a niche</h3>
            <p>Type your client’s topic. We pull what’s trending on TikTok right now.</p>
          </li>
          <li className="la-step">
            <span className="la-ico la-ico-text" aria-hidden="true">×</span>
            <div className="la-vis la-vis-outlier" aria-label="Usually 4k views, this one 610k, 153 times usual">
              <span className="la-bar a" /><span className="la-bar b" />
              <span className="la-out-txt">4k → 610k · <b>153×</b></span>
            </div>
            <h3>Spot outliers</h3>
            <p>Small accounts beating their usual views, and formats others are copying: Early, Rising or Peaked.</p>
          </li>
          <li className="la-step">
            <span className="la-ico"><StepIcon kind="plan" /></span>
            <div className="la-vis la-vis-plan"><span>1 · Hook</span><span>2 · Prep</span><span>3 · Reveal</span></div>
            <h3>Plan the copy</h3>
            <p>Turn one video into a shot-by-shot plan for your client’s brand.</p>
          </li>
          <li className="la-step">
            <span className="la-ico la-ico-text" aria-hidden="true">✓</span>
            <div className="la-vis la-vis-phone" aria-hidden="true">
              <div className="la-phone"><span className="la-ph-line" /><span className="la-ph-line s" /><span className="la-ph-btn">Approve</span></div>
            </div>
            <h3>Client approves</h3>
            <p>Annie approves on their phone, then you copy a brief for the editor.</p>
          </li>
        </ol>
      </section>

      <section id="cta" className="la-cta" aria-label="Get started">
        <p>Built for agencies managing many clients.</p>
        <div className="la-ctas">
          <button type="button" className="la-pill la-outline" onClick={onLogIn}>Log in</button>
          <button type="button" className="la-pill la-solid" onClick={onRegister}>Register free</button>
        </div>
      </section>
    </main>
  )
}
