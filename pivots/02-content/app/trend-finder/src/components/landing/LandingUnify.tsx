import { useEffect, useState, type CSSProperties } from 'react'
import { SlotCounter } from '../themes/unify/SlotCounter'
import { usePrefersReducedMotion } from '../../lib/motion'

// Public landing page for the Unify direction: website hero + "how it works" section, with Log in and Register.
// Sign-in is a demo for now, so both buttons enter the sample agency.

const STEPS = [
  { title: 'Search a niche', body: "Type your client's niche, like budget recipes. Trend Finder searches TikTok live for what's working right now." },
  { title: 'Spot the outliers', body: "Each video gets an outlier score: how far it beat the creator's usual views. Small accounts with huge jumps rise to the top." },
  { title: 'Plan the copy', body: 'Turn the best video into a shot-by-shot plan: hook, scenes, caption and sound, in your client’s voice.' },
  { title: 'Client approves on their phone', body: 'Send the plan to your client. They approve or send it back with a note from their phone, no login needed.' },
  { title: 'Brief your editor', body: 'Once approved, copy a clean brief for your editor with the reference video and shot list attached.' },
]

const em = (n: number) => ({ '--n': n }) as CSSProperties

function StepVisual({ i }: { i: number }) {
  if (i === 0) return (
    <div className="lu-vis">
      <p className="lu-vis-label">Search TikTok</p>
      <div className="lu-search"><span>budget recipes</span><b>Find trends</b></div>
      <ul className="lu-pills"><li>Trending now</li><li>Student meals</li><li>Air fryer</li><li>Meal prep</li></ul>
    </div>
  )
  if (i === 1) return (
    <div className="lu-vis">
      <p className="lu-vis-label">Outliers this week</p>
      {[['Crispy tofu, $3', '4k → 610k', '153×'], ['5-min ramen hack', '9k → 420k', '47×'], ['Pantry pasta', '12k → 190k', '16×']].map(([t, v, x]) => (
        <div className="lu-row" key={t}><span>{t}</span><span className="lu-muted">{v}</span><b>{x}</b></div>
      ))}
    </div>
  )
  if (i === 2) return (
    <div className="lu-vis">
      <p className="lu-vis-label">Shot plan · 3 scenes</p>
      <ol className="lu-shots"><li><b>Hook</b> “This tofu cost me $3.”</li><li><b>Scene 2</b> Press, cube, toss in cornflour</li><li><b>Scene 3</b> Air fry, crunch test close-up</li></ol>
    </div>
  )
  if (i === 3) return (
    <div className="lu-vis lu-vis-phone">
      <div className="lu-phone">
        <p className="lu-vis-label">For Annie</p>
        <p className="lu-phone-title">Student budget crispy tofu</p>
        <div className="lu-phone-btns"><span className="lu-ok">Approve</span><span>Not this one</span></div>
      </div>
    </div>
  )
  return (
    <div className="lu-vis">
      <p className="lu-vis-label">Editor brief</p>
      <pre className="lu-brief">{'Reference: @tofu.tom (153×)\nHook: "This tofu cost me $3."\nLength: 22s · Sound: trending #4\nApproved by Annie'}</pre>
      <span className="lu-copy">Copy brief</span>
    </div>
  )
}

export function LandingUnify({ onLogIn, onRegister }: { onLogIn: () => void; onRegister: () => void }) {
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduced || paused) return
    const t = window.setInterval(() => setActive((a) => (a + 1) % STEPS.length), 4000)
    return () => window.clearInterval(t)
  }, [reduced, paused])

  return (
    <div className="landing landing-unify">
      <nav className="lu-nav">
        <a className="lu-word" href="#">trend finder</a>
        <div className="lu-links"><a href="#">Product</a><a href="#how">How it works</a><a href="#">Customers</a></div>
        <div className="lu-auth">
          <button type="button" className="lu-text" onClick={onLogIn}>Log in</button>
          <button type="button" className="lu-black" onClick={onRegister}>Register</button>
        </div>
      </nav>

      <main>
        <section className="lu-hero">
          <div className="lu-hero-copy">
            <p className="lu-eyebrow">For social media agencies</p>
            <h1 className="lu-h1">
              Find the <em style={em(0)}>videos</em> worth <em style={em(1)}>copying</em>, for every client
            </h1>
            <p className="lu-lede">See which TikToks are getting far more views than usual, and plan a version for each brand you manage.</p>
            <div className="lu-ctas">
              <button type="button" className="lu-black lu-lg" onClick={onRegister}>Register free</button>
              <button type="button" className="lu-under" onClick={onLogIn}>Log in to your dashboard</button>
            </div>
            <p className="lu-note">Demo: both buttons open the sample agency.</p>
            <ul className="lu-pills"><li>TikTok live search</li><li>Outlier scores</li><li>Client approvals</li><li>Editor briefs</li></ul>
            <p className="lu-count">Trend Finder has scanned <SlotCounter value={1284301} /> videos <span className="lu-sample">sample</span></p>
          </div>

          <div className="lu-preview" aria-label="Product preview">
            <div className="lu-card">
              <div className="lu-card-top"><span className="lu-eyebrow">Best to copy</span><span className="lu-tag">Breakout</span></div>
              <p className="lu-card-title">Student budget crispy tofu</p>
              <div className="lu-thumb" aria-hidden="true"><span>▶</span></div>
              <div className="lu-card-stats">
                <div><span className="lu-muted">Usual</span><b>4k</b></div>
                <span className="lu-arrow">→</span>
                <div><span className="lu-muted">This video</span><b>610k</b></div>
                <div className="lu-score"><span className="lu-muted">Outlier</span><b>153×</b></div>
              </div>
              <div className="lu-card-foot"><span>3 accounts copying · Rising</span><span className="lu-under-s">Plan this for Annie</span></div>
            </div>
          </div>
        </section>

        <section className="lu-how" id="how">
          <p className="lu-eyebrow">How it works</p>
          <h2 className="lu-h2">From a niche to an <em style={em(0)}>approved</em> plan in one sitting</h2>
          <div className="lu-steps-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <ol className="lu-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className={i === active ? 'is-active' : ''}>
                  <button type="button" aria-expanded={i === active} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}>
                    <span className="lu-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lu-step-title">{s.title}</span>
                  </button>
                  {i === active && <p className="lu-step-body">{s.body}</p>}
                </li>
              ))}
            </ol>
            <div className="lu-stage" aria-live="polite">
              <div className="lu-stage-inner" key={active}><StepVisual i={active} /></div>
            </div>
          </div>

          <div className="lu-stats">
            <div className="lu-stat"><b>153×</b><span>best outlier this week</span></div>
            <div className="lu-stat"><b>12</b><span>clients in one dashboard</span></div>
            <div className="lu-stat"><b>2 min</b><span>from search to plan</span></div>
            <div className="lu-stat"><b>1 tap</b><span>for your client to approve</span></div>
          </div>
          <p className="lu-note">Sample numbers.</p>
        </section>

        <section className="lu-strip">
          <div className="lu-strip-card">
            <h2 className="lu-h2">Bring your next client a trend <em style={em(0)}>first</em></h2>
            <div className="lu-ctas">
              <button type="button" className="lu-black lu-lg" onClick={onRegister}>Register free</button>
              <button type="button" className="lu-under" onClick={onLogIn}>Log in</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
