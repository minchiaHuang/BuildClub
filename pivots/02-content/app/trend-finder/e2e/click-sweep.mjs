// Layer 1 of the UI/UX sweep: click every button.
//   bash bin/isolated-backend.sh 8797 --demo-data --user test@example.com:pw-for-e2e     (free: no .env, every budget 0)
//   node e2e/click-sweep.mjs http://127.0.0.1:8797 <outDir>
//
// Matrix: 4 themes x widths 390/768/1440 x every screen. For each screen it collects the visible controls
// (button, a[href], [role=button], [role=tab], input, select, textarea, summary), and for each one: records its
// accessible name, clicks it (or types into it), waits 400 ms, and checks
//   1. pageerror / console.error (whitelist below),
//   2. API answers: 5xx always fails; 4xx passes only as 429 (budgets are 0) or a deliberate 401, and only when the
//      screen shows a message about it,
//   3. a reaction: URL, page-state fingerprint or focus changed (none = "no-reaction", a P1 candidate for a human),
//   4. a disabled control has a title / aria-describedby / explanatory text beside it.
// Between controls the screen is put back to its start state (Escape, then a re-open when the page differs).
//
// Env: THEMES=base,altitude WIDTHS=390,1440 SCREENS=search,saved CONC=6 (parallel jobs) REAL=1 (see below).
//
// Writes go to a SANDBOX by default so jobs can run in parallel: PUT /api/{clients,ideas,library,pulses}, DELETE
// /api/share*, POST /api/review/*/decide and POST /api/auth/logout are answered by the script (the request is
// recorded as a "write"), and everything else hits the real isolated backend. REAL=1 then re-runs, against the real
// backend with the seed restored after every write, only the controls whose click wrote something (theme base).
//
// Deliberate simplifications (also listed in sweep.md):
//  - "in viewport" = visible and horizontally on screen; elements further down the page are included (Playwright scrolls).
//  - The sidebar (aside.sidebar) is tested on search (client mode), overview (agency mode) and mobile-drawer only,
//    not repeated on every screen.
//  - A list of more than 6 look-alike siblings (video tiles, chips) is sampled: first, second and last.
//  - Browser runs with prefers-reduced-motion so animated landings do not fake a "reaction".
import { chromium } from '/Users/tommy/.hermes/hermes-agent/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

// ---- console.error whitelist: only known, reasonable messages, each with its reason ------------------------------
const CONSOLE_WHITELIST = [
  // Chrome logs every non-2xx fetch as a console error; the status itself is judged by the API check below.
  { re: /^Failed to load resource: the server responded with a status of \d+/, why: 'judged by the API-response check' },
  // Benign layout notification from the browser.
  { re: /ResizeObserver loop/, why: 'benign browser notice' },
  // Typing into a field and then leaving it for a mailto: link: no handler is installed in headless Chrome.
  { re: /(Failed|Not allowed) to launch '(mailto|tel):/, why: 'headless Chrome has no mail handler' },
]
// Responses that are expected by design (method, url regex, status).
const API_WHITELIST = [
  { re: /\/api\/auth\/me$/, status: 401, why: 'signed-out visitor; the app then shows the sign-in page' },
  { re: /\/favicon/, status: 404, why: 'no favicon is shipped' },
  { re: /cachedOnly=1/, status: 404, why: 'nothing cached yet for that word; the free check then shows no pulse' },
  { re: /\/api\/channel$/, status: 400, why: 'the isolated backend has no channel-summary key; the screen says summaries are not set up' },
]
// A 429/401 must be explained on screen with words like these.
const MESSAGE_RE = /limit|budget|cap\b|quota|unavailable|can.?t|couldn.?t|could not|failed|error|try again|wrong|sign in|not available|no budget|over|isn.?t|not working|went wrong|reached|later|paused|off/i
const DESTRUCTIVE_RE = /sign out|log ?out|turn off|reject|delete|remove|withdraw|clear|archive|approve|discard|reset|send to|move to|mark|posted|stage/i

const base = (process.argv[2] ?? 'http://127.0.0.1:8797').replace(/\/$/, '')
const OUT = process.argv[3] ?? '/tmp/click-sweep'
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'pw-for-e2e'
const THEMES = (process.env.THEMES ?? 'base,altitude,unify,midnight').split(',')
const WIDTHS = (process.env.WIDTHS ?? '390,768,1440').split(',').map(Number)
const ONLY = process.env.SCREENS ? process.env.SCREENS.split(',') : null
const CONC = Number(process.env.CONC ?? 6)
const REAL = process.env.REAL === '1'
const MAXC = Number(process.env.MAXC ?? 0) // smoke test: cap controls per screen
const HEIGHT = { 390: 844, 768: 1024, 1440: 900 }
const THEME_KEY = 'trend-finder.ui-theme'
const WS_KEY = 'trend-finder.workspace.v2'
mkdirSync(`${OUT}/fail`, { recursive: true })
mkdirSync(`${OUT}/screens`, { recursive: true })
const STATE_FILE = `${OUT}/state.json`
const SEED_FILE = `${OUT}/seed.json`
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'x'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

const browser = await chromium.launch({ channel: 'chrome' })

// =========================================================================================================
// Seed: sign in, first client, a real (pinned, free) search, save videos, then shape idea states through the API
// so every screen has something on it (saved, waiting, approved in each stage, rejected) and a share link exists.
// =========================================================================================================
const S = { clientId: '', token: '', clients: [], ideas: [], library: null, pulses: null }
async function seed() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20_000)
  await page.goto(base + '/?ui=base', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const first = page.getByRole('dialog', { name: 'Add your first client' })
  await first.waitFor()
  await page.getByLabel('Client name').fill('Evergreen Foods')
  await first.getByRole('button', { name: 'Add client' }).click()
  await page.locator('aside.sidebar').waitFor()
  await page.locator('aside.sidebar .side-link', { hasText: 'Search' }).first().click()
  await page.locator('.search-input input').fill('tofu')
  await page.getByRole('button', { name: 'Find trending videos' }).click()
  await page.locator('.tile').first().waitFor({ timeout: 30_000 })
  const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
  const want = ['tt-7578804710463819028', ...ids.filter((i) => i !== 'tt-7578804710463819028')].slice(0, 6)
  for (const id of want) {
    await page.locator(`[data-video-id="${id}"]`).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: /^Save to/ }).click()
    await page.waitForTimeout(1200)
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'detached' }).catch(() => {})
  }
  await page.waitForTimeout(1500)
  const api = ctx.request
  const get = async (p) => (await api.get(base + p)).json()
  const put = async (p, data) => {
    const r = await api.put(base + p, { data })
    if (!r.ok()) throw new Error(`PUT ${p} -> ${r.status()}`)
  }
  let ideas = await get('/api/ideas')
  if (!ideas || ideas.length < 5) throw new Error(`seed: only ${ideas?.length} saved ideas`)
  const now = Date.now()
  const day = 86_400_000
  const due = (n) => new Date(now + n * day).toISOString().slice(0, 10)
  const patch = [
    { status: 'waiting', sentAt: now - 3600_000, noteToApprover: 'Easy one: a block of tofu, two pans, one afternoon.', dueDate: due(5) },
    { status: 'waiting', sentAt: now - 7200_000, noteToApprover: 'Trend is rising this week.', dueDate: due(9) },
    { status: 'approved', stage: 'approved', decidedAt: now - day, notes: 'Cut on the beat; keep the pan sound.', dueDate: due(3) },
    { status: 'approved', stage: 'filming', decidedAt: now - 2 * day, notes: 'Overhead shots only.', dueDate: due(1) },
    { status: 'rejected', rejectReason: 'Too similar to last week.', decidedAt: now - day, dueDate: due(7) },
    { status: 'approved', stage: 'posted', postedAt: now - day, decidedAt: now - 5 * day, dueDate: due(-2) },
  ]
  ideas = ideas.map((idea, i) => (patch[i] ? { ...idea, ...patch[i] } : idea))
  await put('/api/ideas', ideas)
  let clients = await get('/api/clients')
  const c0 = clients[0]
  if (clients.length < 2) {
    clients = [...clients, { ...c0, id: 'acme-bakery', name: 'Acme Bakery', niche: 'Bakery', audience: 'Local families', topics: ['sourdough'], examples: ['sourdough'] }]
    await put('/api/clients', clients)
  }
  const share = await (await api.post(base + '/api/share', { data: { clientId: c0.id } })).json()
  S.clientId = c0.id
  S.token = share.token
  S.clients = clients
  S.ideas = await get('/api/ideas')
  S.library = await get('/api/library')
  S.pulses = await get('/api/pulses')
  await ctx.storageState({ path: STATE_FILE })
  writeFileSync(SEED_FILE, JSON.stringify(S, null, 1))
  await ctx.close()
  log(`seeded: client ${S.clientId}, ${S.ideas.length} ideas, token ${S.token.slice(0, 6)}...`)
}
if (!existsSync(SEED_FILE) || !existsSync(STATE_FILE) || process.env.RESEED === '1') await seed()
else Object.assign(S, JSON.parse(readFileSync(SEED_FILE, 'utf8')))

// Real-mode restore: put the seed data back after a control that wrote.
async function restoreSeed(request) {
  for (const [p, d] of [['/api/clients', S.clients], ['/api/ideas', S.ideas], ['/api/library', S.library], ['/api/pulses', S.pulses]]) {
    if (d != null) await request.put(base + p, { data: d })
  }
  const r = await request.post(base + '/api/share', { data: { clientId: S.clientId } })
  if (r.ok()) S.token = (await r.json()).token
}

// =========================================================================================================
// Page helpers
// =========================================================================================================
const INIT = ({ themeKey, theme, wsKey }) => {
  try {
    localStorage.setItem(themeKey, theme)
    const ws = new URLSearchParams(location.search).get('ws')
    if (ws) localStorage.setItem(wsKey, JSON.stringify(ws))
  } catch {}
}

async function makeCtx(theme, width, signedIn) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 900 },
    storageState: signedIn ? STATE_FILE : undefined,
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  await ctx.addInitScript(INIT, { themeKey: THEME_KEY, theme, wsKey: WS_KEY })
  if (!REAL) {
    // Sandbox: writes are answered here so parallel jobs and the seed stay untouched.
    await ctx.route(/\/api\/(clients|ideas|library|pulses)$/, async (route) => {
      const req = route.request()
      if (req.method() !== 'PUT') return route.continue()
      const body = req.postData() ?? 'null'
      return route.fulfill({ status: 200, contentType: 'application/json', body })
    })
    await ctx.route(/\/api\/share(\/[^/]+)?(\?.*)?$/, (route) =>
      route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.continue(),
    )
    await ctx.route(/\/api\/auth\/logout$/, (route) => route.fulfill({ status: 204 }))
    await ctx.route(/\/api\/review\/[^/]+\/decide$/, (route) => {
      const b = JSON.parse(route.request().postData() || '{}')
      const idea = S.ideas.find((i) => i.id === b.ideaId) ?? S.ideas[0]
      const { notes: _n, ...rest } = idea
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...rest, status: b.decision, decidedAt: Date.now(), ...(b.reason ? { rejectReason: b.reason } : {}) }),
      })
    })
  }
  return ctx
}

function watch(page) {
  const bag = { errors: [], resp: [], writes: [], dialogs: 0, popups: 0, downloads: 0, inflight: 0 }
  page._bag = bag
  page.on('pageerror', (e) => bag.errors.push({ kind: 'pageerror', text: String(e.message ?? e).slice(0, 300) }))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // Messages from third-party frames (TikTok embeds) are not ours.
    const from = m.location()?.url ?? ''
    if (from && !from.startsWith(base) && !from.startsWith('blob:') && !from.startsWith('data:')) return
    const t = m.text()
    if (CONSOLE_WHITELIST.some((w) => w.re.test(t))) return
    bag.errors.push({ kind: 'console', text: t.slice(0, 300) })
  })
  page.on('request', (r) => {
    bag.inflight++
    if (r.method() !== 'GET' && /\/api\//.test(r.url())) bag.writes.push(`${r.method()} ${r.url().replace(base, '')}`)
  })
  page.on('requestfinished', () => (bag.inflight = Math.max(0, bag.inflight - 1)))
  page.on('requestfailed', () => (bag.inflight = Math.max(0, bag.inflight - 1)))
  page.on('response', (r) => {
    // Third-party hosts (TikTok embeds etc.) are not ours to judge, and have no network here anyway.
    if (r.url().startsWith(base)) bag.resp.push({ status: r.status(), method: r.request().method(), url: r.url().replace(base, '') })
  })
  page.on('dialog', (d) => {
    bag.dialogs++
    d.accept().catch(() => {})
  })
  page.on('download', () => bag.downloads++)
  page.context().on('page', (p) => {
    if (p === page) return
    bag.popups++
    p.close().catch(() => {})
  })
  return bag
}

// In-page: tag every testable control with data-sw and describe it.
const COLLECT = ({ allowSidebar, scopeSel }) => {
  const SEL = 'button, a[href], [role=button], [role=tab], input, select, textarea, summary'
  const nameOf = (e) => {
    const lb = e.getAttribute('aria-labelledby')
    if (lb) {
      const t = lb.split(' ').map((i) => document.getElementById(i)?.innerText ?? '').join(' ').replace(/\s+/g, ' ').trim()
      if (t) return t
    }
    const al = e.getAttribute('aria-label')
    if (al && al.trim()) return al.trim()
    if (e.labels && e.labels.length) return [...e.labels].map((l) => l.innerText).join(' ').replace(/\s+/g, ' ').trim()
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim()
    if (t) return t
    return (e.getAttribute('title') || e.getAttribute('alt') || e.getAttribute('placeholder') || e.getAttribute('value') || e.querySelector('img[alt]')?.alt || '').trim()
  }
  const dialogs = [...document.querySelectorAll('[role=dialog], dialog[open]')].filter((d) => d.checkVisibility?.() ?? d.offsetParent !== null)
  const scope = scopeSel ? (document.querySelector(scopeSel) ?? document) : dialogs.length ? dialogs[dialogs.length - 1] : document
  const all = [...scope.querySelectorAll(SEL)]
  document.querySelectorAll('[data-sw]').forEach((e) => e.removeAttribute('data-sw'))
  const out = []
  const groups = new Map()
  for (const e of all) {
    if (e.type === 'hidden') continue
    const r = e.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    if (e.checkVisibility && !e.checkVisibility({ visibilityProperty: true })) continue
    if (r.right <= 0 || r.left >= innerWidth) continue
    if (e.closest('[aria-hidden=true], [inert]') && !e.closest('[role=dialog]')) continue
    if (!allowSidebar && !dialogs.length && e.closest('aside.sidebar')) continue
    if (e.closest('.ui-switcher') && false) continue
    const idx = out.length
    e.setAttribute('data-sw', String(idx))
    const tag = e.tagName.toLowerCase()
    const cls = typeof e.className === 'string' ? e.className : ''
    const group = [tag, e.getAttribute('role') ?? '', cls, e.parentElement?.className ?? ''].join('|')
    groups.set(group, (groups.get(group) ?? 0) + 1)
    const disabled = e.disabled === true || e.getAttribute('aria-disabled') === 'true'
    let why = !!(e.getAttribute('title') || e.getAttribute('aria-describedby'))
    if (disabled && !why) {
      const box = e.closest('li, form, section, div, p') ?? e.parentElement
      const own = (e.innerText || '').trim().length
      why = (box?.innerText ?? '').trim().length > own + 8
    }
    const href = e.getAttribute('href')
    out.push({
      idx,
      tag,
      type: e.getAttribute('type') ?? '',
      role: e.getAttribute('role') ?? '',
      name: nameOf(e),
      href,
      target: e.getAttribute('target') ?? '',
      disabled,
      why,
      group,
      readonly: !!e.readOnly,
      pressed: e.getAttribute('aria-pressed') === 'true',
      // A submit button of a form whose required fields are empty: the browser's own "fill in this field" bubble
      // answers, which is not in the DOM.
      blocked: e.type === 'submit' && !!e.form && !e.form.checkValidity(),
      options: tag === 'select' ? [...e.options].map((o) => o.value) : undefined,
      sidebar: !!e.closest('aside.sidebar'),
    })
  }
  const seen = new Map()
  for (const o of out) {
    const n = (seen.get(o.group) ?? 0) + 1
    seen.set(o.group, n)
    o.groupSize = groups.get(o.group)
    o.groupPos = n
  }
  return out
}

// In-page: a fingerprint of everything a click is expected to change.
const FINGERPRINT = () => {
  const st = []
  document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-selected],[aria-current],[aria-checked],details,button,a,[role=tab],[role=button]').forEach((e) => {
    st.push([e.tagName, typeof e.className === 'string' ? e.className : '', e.getAttribute('aria-pressed'), e.getAttribute('aria-expanded'), e.getAttribute('aria-selected'), e.getAttribute('aria-current'), e.disabled ? 1 : 0, e.open ? 1 : 0].join('|'))
  })
  const vals = [...document.querySelectorAll('input,select,textarea')].map((e) => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value))
  const dlg = document.querySelectorAll('[role=dialog], dialog[open]').length
  const s = document.body.innerText + '#' + st.join(';') + '#' + vals.join(',') + '#' + dlg + '#' + document.body.innerHTML.length + '#' + (document.querySelector('aside.sidebar')?.className ?? '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  const a = document.activeElement
  const focus = a && a !== document.body ? `${a.tagName}|${a.getAttribute('data-sw') ?? ''}|${(a.innerText || a.getAttribute('aria-label') || '').slice(0, 30)}` : ''
  return { h, focus, text: document.body.innerText }
}
const printState = async (page) => ({ url: page.url(), ...(await page.evaluate(FINGERPRINT)) })

async function settle(page, extra = 300) {
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(extra)
}
async function waitQuiet(page, max = 4000) {
  const t0 = Date.now()
  while (page._bag.inflight > 0 && Date.now() - t0 < max) await page.waitForTimeout(100)
}

// =========================================================================================================
// Screens
// =========================================================================================================
async function boot(page, ws) {
  await page.goto(`${base}/?ws=${ws === 'all' ? 'all' : S.clientId}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside.sidebar').waitFor({ state: 'attached', timeout: 20_000 })
  await settle(page, 500)
}
async function openMenuIfPhone(page) {
  const m = page.getByRole('button', { name: 'Open menu' })
  if (await m.isVisible().catch(() => false)) {
    await m.click()
    await page.waitForTimeout(350)
    return true
  }
  return false
}
async function nav(page, label) {
  await openMenuIfPhone(page)
  await page.locator('aside.sidebar .side-link', { hasText: label }).first().click()
  await settle(page, 400)
}
async function toResults(page) {
  await boot(page, 'client')
  await page.locator('.search-input input').fill('tofu')
  await page.getByRole('button', { name: 'Find trending videos' }).click()
  await page.locator('.tile').first().waitFor({ timeout: 30_000 })
  await settle(page, 500)
}

const NA = Symbol('n/a')
const SCREENS = [
  { id: 'overview', auth: true, sidebar: true, open: (p) => boot(p, 'all') },
  { id: 'search', auth: true, sidebar: true, open: (p) => boot(p, 'client') },
  { id: 'results', auth: true, open: toResults },
  {
    id: 'video-drawer',
    auth: true,
    open: async (p) => {
      await toResults(p)
      await p.locator('[data-video-id="tt-7578804710463819028"]').click()
      await p.getByRole('dialog').waitFor()
      await settle(p, 800)
    },
  },
  { id: 'saved', auth: true, open: async (p) => { await boot(p, 'client'); await nav(p, 'Saved ideas') } },
  { id: 'approvals', auth: true, open: async (p) => { await boot(p, 'client'); await nav(p, 'Approvals') } },
  {
    id: 'review',
    auth: true,
    open: async (p) => {
      await boot(p, 'client')
      await nav(p, 'Approvals')
      await p.getByRole('button', { name: 'Review as Annie' }).click()
      await settle(p, 400)
    },
  },
  { id: 'plans', auth: true, open: async (p) => { await boot(p, 'client'); await nav(p, 'Plans') } },
  {
    id: 'board',
    auth: true,
    open: async (p) => {
      await boot(p, 'client')
      await nav(p, 'Plans')
      await p.getByRole('group', { name: 'Plans view' }).getByRole('button', { name: 'Board' }).click()
      await settle(p, 400)
    },
  },
  {
    id: 'plan',
    auth: true,
    open: async (p) => {
      await boot(p, 'client')
      await nav(p, 'Plans')
      await p.locator('.idea .btn-primary').first().click()
      await settle(p, 500)
    },
  },
  { id: 'settings', auth: true, open: async (p) => { await boot(p, 'client'); await nav(p, 'Client settings') } },
  { id: 'channel', auth: true, open: async (p) => { await boot(p, 'client'); await nav(p, 'Channel') } },
  {
    id: 'client-menu',
    auth: true,
    scope: '.switcher-menu',
    open: async (p) => {
      await boot(p, 'client')
      await openMenuIfPhone(p)
      await p.locator('.switcher-btn').click()
      await p.getByRole('menu').waitFor()
    },
    sidebar: true,
  },
  {
    id: 'add-client',
    auth: true,
    open: async (p) => {
      await boot(p, 'client')
      await openMenuIfPhone(p)
      await p.locator('.switcher-btn').click()
      await p.getByRole('menuitem', { name: /Add client/ }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'mobile-drawer',
    auth: true,
    scope: 'aside.sidebar',
    sidebar: true,
    open: async (p) => {
      await boot(p, 'client')
      if (!(await openMenuIfPhone(p))) return NA
    },
  },
  { id: 'landing', auth: false, themes: ['altitude', 'unify', 'midnight'], open: async (p) => { await p.goto(base + '/', { waitUntil: 'domcontentloaded' }); await p.locator('h1').first().waitFor(); await settle(p, 800) } },
  {
    id: 'login',
    auth: false,
    open: async (p, job) => {
      await p.goto(base + '/', { waitUntil: 'domcontentloaded' })
      await p.locator('h1').first().waitFor()
      if (job.theme !== 'base') {
        await p.getByRole('button', { name: /^log in$/i }).or(p.getByRole('link', { name: /^log in$/i })).first().click()
      }
      await p.getByLabel('Email').waitFor()
      await settle(p, 400)
    },
  },
  { id: 'share', auth: false, open: async (p) => { await p.goto(`${base}/review/${S.token}`, { waitUntil: 'domcontentloaded' }); await p.locator('h1').first().waitFor(); await settle(p, 500) } },
  { id: 'share-bad-token', auth: false, open: async (p) => { await p.goto(`${base}/review/not-a-real-token`, { waitUntil: 'domcontentloaded' }); await p.locator('body').waitFor(); await settle(p, 500) } },
]

// =========================================================================================================
// Testing one control
// =========================================================================================================
const keyOf = (d, i) => `${d.tag}${d.type ? ':' + d.type : ''}|${d.name || '(no name)'}|${i}`

function pickTargets(descs, allowSidebar) {
  const keep = descs.filter((d) => {
    if (d.groupSize > 6 && !(d.groupPos <= 2 || d.groupPos === d.groupSize)) return false
    if (d.sidebar && !allowSidebar) return false
    return true
  })
  const nth = new Map()
  const withKeys = keep.map((d) => {
    const base0 = `${d.tag}${d.type ? ':' + d.type : ''}|${d.name || '(no name)'}`
    const n = (nth.get(base0) ?? 0) + 1
    nth.set(base0, n)
    return { ...d, key: n > 1 ? `${base0}#${n}` : base0 }
  })
  const destructive = (d) => DESTRUCTIVE_RE.test(d.name)
  return [...withKeys.filter((d) => !destructive(d)), ...withKeys.filter(destructive)]
}

async function typeInto(loc, d) {
  const t = d.type
  if (d.tag === 'select') {
    const opt = d.options?.[1] ?? d.options?.[0]
    if (opt !== undefined) await loc.selectOption(opt, { timeout: 3000 })
    return
  }
  if (d.tag === 'textarea') return loc.fill('Test note: film this on Friday.', { timeout: 3000 })
  if (['text', 'search', 'email', 'url', 'tel', 'password', ''].includes(t) || t === 'number') {
    const v = t === 'email' ? 'test@example.com' : t === 'password' ? 'wrong-pw' : t === 'number' ? '3' : t === 'url' ? 'https://example.com' : 'tofu'
    await loc.fill(v, { timeout: 3000 })
    await loc.press('Enter', { timeout: 3000 })
    return
  }
  if (t === 'date') return loc.fill('2030-01-15', { timeout: 3000 })
  if (t === 'range') return loc.fill('2', { timeout: 3000 }).catch(() => loc.click({ timeout: 3000 }))
  return loc.click({ timeout: 3000 })
}

async function testControl(page, d, ctxInfo, shotBase) {
  const bag = page._bag
  const res = { key: d.key, name: d.name, tag: d.tag, type: d.type, role: d.role, sidebar: d.sidebar, status: 'pass', issues: [], writes: [], ms: 0 }
  const t0 = Date.now()
  const add = (kind, detail) => res.issues.push({ kind, detail })
  if (!d.name) add('no-name', 'control has no accessible name')

  // Locate it again (the page was possibly reset since the list was taken).
  let loc = page.locator(`[data-sw="${d.idx}"]`)
  const nameNow = await loc.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim()).catch(() => null)
  if (nameNow === null) {
    res.status = 'skip'
    res.skip = 'could not find it again after reset'
    return res
  }

  if (REAL && /sign out|log ?out/i.test(d.name)) {
    res.status = 'skip'
    res.skip = 'sign out would end the shared session of the real pass'
    return res
  }
  if (d.disabled) {
    if (!d.why) add('disabled-no-reason', 'disabled with no title and no explaining text beside it')
    res.skip = 'disabled (not clicked)'
    res.status = res.issues.length ? 'fail' : 'skip'
    return res
  }
  const external = d.tag === 'a' && d.href && (/^(mailto:|tel:)/.test(d.href) || d.target === '_blank' || (/^https?:/.test(d.href) && !d.href.startsWith(base)))
  if (external || d.type === 'file') {
    if (d.tag === 'a' && !d.href) add('no-href', 'link has no destination')
    res.skip = external ? `external link (${d.href}), not followed` : 'file input, not driven'
    res.status = res.issues.length ? 'fail' : 'skip'
    return res
  }

  if (d.pressed || d.blocked) {
    res.skip = d.pressed ? 'already the chosen option (aria-pressed)' : 'form has empty required fields: the browser asks for them'
    res.status = 'skip'
    return res
  }

  const before = await printState(page)
  await page.waitForTimeout(120)
  const before2 = await printState(page)
  const stable = before.h === before2.h
  bag.errors.length = 0
  bag.resp.length = 0
  bag.writes.length = 0
  bag.dialogs = 0
  bag.popups = 0
  bag.downloads = 0
  let clickErr = null
  try {
    if (['input', 'select', 'textarea'].includes(d.tag) && !['checkbox', 'radio', 'button', 'submit', 'reset', 'image'].includes(d.type)) await typeInto(loc, d)
    else if (['checkbox', 'radio'].includes(d.type)) await loc.evaluate((e) => (e.labels?.[0] ?? e).click())
    else await loc.click({ timeout: 4000 })
  } catch (e) {
    clickErr = String(e.message ?? e).split('\n').filter((l) => /intercept|not visible|not stable|disabled|outside|detached|Timeout/.test(l)).slice(0, 3).join(' / ')
  }
  await page.waitForTimeout(400)
  await waitQuiet(page)
  const after = await printState(page).catch(() => ({ url: 'GONE', h: -1, focus: '', text: '' }))
  res.writes = [...bag.writes]

  if (clickErr) add('click-failed', clickErr.slice(0, 200))
  for (const e of bag.errors) add(e.kind, e.text)
  // API answers
  for (const r of bag.resp) {
    if (r.status < 400) continue
    const wl = API_WHITELIST.find((w) => w.re.test(r.url) && w.status === r.status)
    if (wl) continue
    const line = `${r.method} ${r.url} -> ${r.status}`
    if (r.status >= 500) add('http5xx', line)
    else if (r.status === 429 || r.status === 401) {
      // A plan locked while the approver reviews it fetches the breakdown only for show: nothing to tell her.
      const lockedPlan = /\/api\/analyze/.test(r.url) && /Locked while/.test(after.text)
      if (!lockedPlan && !MESSAGE_RE.test(after.text)) add('no-message', `${line}, but the screen shows no message about it`)
      res.apiNote = (res.apiNote ?? '') + line + '; '
    } else add('http4xx', line)
  }
  // reaction
  const reacted = before.url !== after.url || before.h !== after.h || before.focus !== after.focus || bag.popups > 0 || bag.downloads > 0 || bag.dialogs > 0 || bag.writes.length > 0
  res.reacted = reacted
  res.url = after.url !== before.url ? after.url.replace(base, '') : undefined
  if (!reacted) {
    if (!stable) res.unstable = true
    else add('no-reaction', 'URL, page state and focus unchanged after the click')
  }
  res.status = res.issues.length ? 'fail' : 'pass'
  res.ms = Date.now() - t0
  if (res.status === 'fail') {
    const f = `${shotBase}__${String(d.idx).padStart(3, '0')}-${slug(d.name)}.png`
    await page.screenshot({ path: `${OUT}/fail/${f}` }).catch(() => {})
    res.shot = `fail/${f}`
  }
  res.fingerprintBefore = undefined
  return res
}

// =========================================================================================================
// Run one (theme, width) job: every screen
// =========================================================================================================
async function runJob(theme, width, only) {
  const out = []
  const job = { theme, width }
  const ctxs = {}
  const pages = {}
  const pageFor = async (auth) => {
    const k = auth ? 'in' : 'out'
    if (!pages[k]) {
      ctxs[k] = await makeCtx(theme, width, auth)
      pages[k] = await ctxs[k].newPage()
      pages[k].setDefaultTimeout(15_000)
      watch(pages[k])
    }
    return pages[k]
  }
  for (const scr of SCREENS) {
    if (ONLY && !ONLY.includes(scr.id)) continue
    if (scr.themes && !scr.themes.includes(theme)) continue
    if (REAL && !only?.has(scr.id)) continue
    const page = await pageFor(scr.auth)
    const tag = `${scr.id}__${theme}__${width}`
    const entry = { screen: scr.id, theme, width, controls: [], load: { issues: [] } }
    out.push(entry)
    const bag = page._bag
    try {
      bag.errors.length = 0
      bag.resp.length = 0
      const r = await scr.open(page, job)
      if (r === NA) {
        entry.na = true
        continue
      }
      await settle(page, 300)
      // load-time problems
      for (const e of bag.errors) entry.load.issues.push({ kind: e.kind, detail: e.text })
      for (const r2 of bag.resp) {
        if (r2.status >= 500) entry.load.issues.push({ kind: 'http5xx', detail: `${r2.method} ${r2.url} -> ${r2.status}` })
        else if (r2.status >= 400 && !API_WHITELIST.some((w) => w.re.test(r2.url) && w.status === r2.status) && r2.status !== 429)
          entry.load.issues.push({ kind: 'http4xx', detail: `${r2.method} ${r2.url} -> ${r2.status}` })
      }
      await page.screenshot({ path: `${OUT}/screens/${tag}.png`, fullPage: true }).catch(() => {})
      const start = await printState(page)
      entry.startText = start.text.slice(0, 400)
      const allowSidebar = !!scr.sidebar
      const targets = pickTargets(await page.evaluate(COLLECT, { allowSidebar, scopeSel: scr.scope ?? null }), allowSidebar)
      const want = only?.get(scr.id)
      for (const d of MAXC ? targets.slice(0, MAXC) : targets) {
        if (want && !want.has(d.key)) continue
        // Back to the start state?
        let now = await printState(page).catch(() => null)
        if (!now || now.h !== start.h || now.url !== start.url) {
          await page.keyboard.press('Escape').catch(() => {})
          await page.waitForTimeout(150)
          now = await printState(page).catch(() => null)
        }
        if (!now || now.h !== start.h || now.url !== start.url) {
          if (process.env.DBG) log('reopen before', d.key, now?.h, start.h)
          const rr = await scr.open(page, job)
          if (process.env.DBG) log('after reopen', JSON.stringify(await page.evaluate(() => document.querySelector('aside.sidebar')?.className)), (await printState(page)).h)
          await settle(page, 200)
          if (rr === NA) break
        }
        // Re-tag after any reset so data-sw indices are current, and match by key.
        const cur = pickTargets(await page.evaluate(COLLECT, { allowSidebar, scopeSel: scr.scope ?? null }), allowSidebar)
        const dd = cur.find((c) => c.key === d.key) ?? null
        if (!dd) {
          entry.controls.push({ key: d.key, name: d.name, tag: d.tag, status: 'skip', skip: 'not present after reset', issues: [], writes: [] })
          continue
        }
        let res
        try {
          res = await Promise.race([
            testControl(page, dd, job, tag),
            sleep(40_000).then(() => { throw new Error('control test timed out') }),
          ])
        } catch (e) {
          res = { key: dd.key, name: dd.name, tag: dd.tag, status: 'fail', issues: [{ kind: 'harness', detail: String(e.message).slice(0, 200) }], writes: [] }
          await page.screenshot({ path: `${OUT}/fail/${tag}__${slug(dd.name)}-harness.png` }).catch(() => {})
        }
        entry.controls.push(res)
        if (REAL && res.writes?.length) await restoreSeed(ctxs.in.request)
        if (REAL && res.writes?.length) await scr.open(page, job).catch(() => {})
      }
    } catch (e) {
      entry.load.issues.push({ kind: 'open-failed', detail: String(e.message).split('\n')[0].slice(0, 250) })
      await page.screenshot({ path: `${OUT}/fail/${tag}__open-failed.png` }).catch(() => {})
    }
    log(`${tag}: ${entry.controls.length} controls, ${entry.controls.filter((c) => c.status === 'fail').length} fail`)
  }
  for (const c of Object.values(ctxs)) await c.close().catch(() => {})
  writeFileSync(`${OUT}/part-${REAL ? 'real-' : ''}${theme}-${width}.json`, JSON.stringify(out))
  return out
}

// =========================================================================================================
// Main + reports
// =========================================================================================================
const t0 = Date.now()
let only = null
if (REAL) {
  // Re-run only the controls that wrote something in the sandbox pass.
  const prev = JSON.parse(readFileSync(`${OUT}/sweep.json`, 'utf8'))
  only = new Map()
  for (const e of prev.entries) {
    if (e.theme !== 'base') continue
    for (const c of e.controls) if (c.writes?.length) {
      const k = `${e.width}|${e.screen}`
      if (!only.has(k)) only.set(k, new Set())
      only.get(k).add(c.key)
    }
  }
}
const jobs = []
for (const w of WIDTHS) for (const th of REAL ? ['base'] : THEMES) jobs.push([th, w])
const results = []
if (REAL) {
  // Real mode is serial: the backend state is shared.
  for (const [th, w] of jobs) {
    const perScreen = new Map()
    for (const [k, v] of only) if (k.startsWith(`${w}|`)) perScreen.set(k.split('|')[1], v)
    results.push(...(await runJob(th, w, perScreen)))
  }
} else {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONC, jobs.length) }, async () => {
      while (next < jobs.length) {
        const [th, w] = jobs[next++]
        log(`start ${th} ${w}`)
        try {
          results.push(...(await runJob(th, w, null)))
        } catch (e) {
          log(`JOB FAILED ${th} ${w}: ${e.message}`)
          results.push({ screen: '(job)', theme: th, width: w, controls: [], load: { issues: [{ kind: 'job-failed', detail: String(e.message).slice(0, 250) }] } })
        }
      }
    }),
  )
}
await browser.close()
const secs = Math.round((Date.now() - t0) / 1000)

const file = REAL ? 'sweep-real' : 'sweep'
if (process.env.MERGE === '1' && ONLY) {
  const prev = JSON.parse(readFileSync(`${OUT}/sweep.json`, 'utf8'))
  results.unshift(...prev.entries.filter((e) => !ONLY.includes(e.screen)))
}
writeFileSync(`${OUT}/${file}.json`, JSON.stringify({ base, secs, themes: THEMES, widths: WIDTHS, whitelist: { console: CONSOLE_WHITELIST.map((w) => `${w.re} -- ${w.why}`), api: API_WHITELIST.map((w) => `${w.re} ${w.status} -- ${w.why}`) }, entries: results }, null, 1))

// sweep.md: screen x element x (theme, width)
const SYM = { pass: 'ok', fail: 'FAIL', skip: '-' }
const cols = []
for (const th of THEMES) for (const w of WIDTHS) cols.push(`${th}/${w}`)
let md = `# Click sweep${REAL ? ' (real backend, writes only)' : ''}\n\nRun time ${secs}s. Cells: ok = pass, FAIL = at least one issue (see list), - = skipped (disabled/external/file/unstable) or not present.\n\n`
let total = 0, fails = 0, skips = 0
const failures = []
const bySc = new Map()
for (const e of results) {
  if (!bySc.has(e.screen)) bySc.set(e.screen, [])
  bySc.get(e.screen).push(e)
}
for (const [sc, es] of bySc) {
  md += `## ${sc}\n\n`
  const issuesLoad = es.flatMap((e) => e.load.issues.map((i) => `${e.theme}/${e.width}: ${i.kind} ${i.detail}`))
  if (issuesLoad.length) md += `Load issues:\n${issuesLoad.map((x) => `- ${x}`).join('\n')}\n\n`
  const keys = []
  for (const e of es) for (const c of e.controls) if (!keys.includes(c.key)) keys.push(c.key)
  md += `| element | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`
  for (const k of keys) {
    const row = cols.map((col) => {
      const [th, w] = col.split('/')
      const e = es.find((x) => x.theme === th && x.width === Number(w))
      const c = e?.controls.find((x) => x.key === k)
      if (!c) return ' '
      return c.status === 'fail' ? 'FAIL:' + [...new Set(c.issues.map((i) => i.kind))].join(',') : SYM[c.status]
    })
    md += `| ${k.replace(/\|/g, ' / ').replace(/\n/g, ' ')} | ${row.join(' | ')} |\n`
  }
  md += '\n'
  for (const e of es) for (const c of e.controls) {
    total++
    if (c.status === 'fail') {
      fails++
      failures.push({ screen: sc, theme: e.theme, width: e.width, key: c.key, issues: c.issues, shot: c.shot })
    } else if (c.status === 'skip') skips++
  }
}
md += `## Totals\n\n- control tests: ${total}\n- failing: ${fails}\n- skipped: ${skips}\n\n## Failures\n\n`
for (const f of failures) md += `- ${f.screen} ${f.theme}/${f.width} "${f.key}": ${f.issues.map((i) => `${i.kind}: ${i.detail}`).join(' | ')}${f.shot ? ` [${f.shot}]` : ''}\n`
md += `\n## Whitelists\n\nconsole.error:\n${CONSOLE_WHITELIST.map((w) => `- ${w.re}: ${w.why}`).join('\n')}\n\nAPI:\n${API_WHITELIST.map((w) => `- ${w.re} ${w.status}: ${w.why}`).join('\n')}\n`
writeFileSync(`${OUT}/${file}.md`, md)
console.log(`done in ${secs}s: ${total} control tests, ${fails} failing, ${skips} skipped -> ${OUT}/${file}.md`)
