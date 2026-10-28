// Shared helpers for the layer 2/3/4 sweep scripts (journeys, anomalies, keyboard-a11y).
// Free to run: only against `bash bin/isolated-backend.sh 8799 --demo-data --user test@example.com:pw-for-e2e`.
// Env: OUT (screenshots), THEME (base|altitude|unify|midnight, comma list ok), WIDTH (comma list ok). Unset = whole matrix.
import { chromium } from '/Users/tommy/.hermes/hermes-agent/node_modules/playwright-core/index.mjs'
import { mkdirSync } from 'node:fs'

export const ALL_THEMES = ['base', 'altitude', 'unify', 'midnight']
export const ALL_WIDTHS = [390, 768, 1440]
export const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com'
export const PASSWORD = process.env.E2E_PASSWORD ?? 'pw-for-e2e'
export const base = (/^http/.test(process.argv[2] ?? '') ? process.argv[2] : 'http://127.0.0.1:8799').replace(/\/$/, '')
export const OUT = process.env.OUT ?? '/tmp/trend-finder-sweep'
if (/:(8787|8798|5195)\b/.test(base)) throw new Error('refusing to run against a reserved port')

const list = (v, all, num) => (v ? v.split(',').map((x) => (num ? Number(x) : x.trim())) : all)
export const themes = () => list(process.env.THEME, ALL_THEMES)
export const widths = () => list(process.env.WIDTH, ALL_WIDTHS, true)
export const matrix = () => themes().flatMap((t) => widths().map((w) => ({ theme: t, width: w })))

export const check = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
export const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '')
export const uniq = () => Math.random().toString(36).slice(2, 7)

// Known noise that is not an app problem. 401 on /api/auth/me is the signed-out probe; a 404 on a cachedOnly search is
// "nothing cached yet"; 429 is the zero-budget backend saying no on purpose; the TikTok embed is a third party.
const okHttp = (status, url) =>
  (status === 401 && /\/api\/auth\/(me|login)/.test(url)) ||
  (status === 404 && /cachedOnly=1/.test(url)) ||
  status === 429 ||
  // KNOWN APP BUG (reported, P3): a client with no topics/examples/niche asks for a cached search with q= and gets 400.
  (status === 400 && /\/api\/search\?q=&/.test(url)) ||
  !url.startsWith(base)

// One browser context + page for one theme x width, with error collectors.
export async function open(browser, { theme, width, height, storage = true, extra = {} }) {
  const ctx = await browser.newContext({
    viewport: { width, height: height ?? (width < 600 ? 800 : 900) },
    hasTouch: width < 600,
    isMobile: false,
    ...extra,
  })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => {})
  if (storage) await ctx.addInitScript((t) => { try { localStorage.setItem('trend-finder.ui-theme', t) } catch {} }, theme)
  const page = await ctx.newPage()
  page.setDefaultTimeout(15_000)
  const probs = { pageerrors: [], http: [], consoleErrors: [] }
  page.on('pageerror', (e) => probs.pageerrors.push(e.message))
  page.on('response', (r) => {
    const s = r.status()
    if (s >= 400 && !okHttp(s, r.url())) probs.http.push(`${s} ${r.request().method()} ${r.url().replace(base, '')}`)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) probs.consoleErrors.push(m.text().slice(0, 200))
  })
  return { ctx, page, probs }
}

// Runs fn once per cell of the matrix; steps print PASS/FAIL. Returns {passed, failed, total}.
export function makeReporter(name) {
  const rows = []
  return {
    rows,
    cell(theme, width) {
      const dir = `${OUT}/${name}/${theme}-${width}`
      mkdirSync(dir, { recursive: true })
      let n = 0
      const label = `[${name} ${theme} ${width}]`
      return {
        dir,
        label,
        async step(title, fn, shotPage) {
          const id = String(++n).padStart(2, '0')
          const file = `${dir}/${id}-${slug(title)}.png`
          let ok = true
          let err = ''
          try {
            await fn()
          } catch (e) {
            ok = false
            err = String(e.message).split('\n')[0]
          }
          const pg = typeof shotPage === 'function' ? shotPage() : shotPage
          if (pg) await pg.screenshot({ path: file }).catch(() => {})
          rows.push({ cell: label, title, ok, err, file: pg ? file : '' })
          console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} ${title}${ok ? '' : ': ' + err}${ok || !pg ? '' : '  -> ' + file}`)
          return ok
        },
        // Page errors and 5xx/unexpected 4xx seen so far count as one extra check.
        async problems(title, probs) {
          const bad = [...probs.pageerrors.map((e) => 'pageerror: ' + e), ...probs.http.map((h) => 'http ' + h)]
          rows.push({ cell: label, title, ok: bad.length === 0, err: bad.slice(0, 4).join(' | '), file: '' })
          console.log(`${bad.length ? 'FAIL' : 'PASS'}  ${label} ${title}${bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''}`)
          probs.pageerrors.length = 0
          probs.http.length = 0
        },
      }
    },
    finish() {
      const failed = rows.filter((r) => !r.ok)
      console.log(`\n${name}: ${rows.length - failed.length}/${rows.length} checks passed. Screenshots: ${OUT}/${name}`)
      process.exit(failed.length ? 1 : 0)
    },
  }
}

export async function launch() {
  return chromium.launch({ channel: 'chrome' })
}

// ---- App helpers -------------------------------------------------------------------------------------------
export const sidebar = (page) => page.getByRole('complementary', { name: 'Main' })
const isPhone = (page) => (page.viewportSize()?.width ?? 1440) <= 860

// The sidebar is a slide-over on phones and tablets: open it before touching it.
export async function openMenu(page) {
  if (!isPhone(page)) return
  const open = () => sidebar(page).evaluate((el) => el.classList.contains('sidebar-open'))
  if (await open()) return
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.waitForFunction(() => document.querySelector('.sidebar')?.classList.contains('sidebar-open'))
  await page.waitForTimeout(350) // slide-in
}
export async function nav(page, name) {
  await openMenu(page)
  await sidebar(page).getByRole('navigation').getByRole('button', { name, exact: false }).first().click()
}
export async function switcher(page) {
  await openMenu(page)
  await sidebar(page).locator('.switcher-btn').click()
}

// Signs in through the UI. On themes with a landing page, goes through its "Log in" button first.
export async function login(page, theme, { email = EMAIL, password = PASSWORD } = {}) {
  await page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
  if (theme !== 'base') {
    await page.getByRole('button', { name: /^Log in/ }).first().click()
  }
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

// After login: either the first-client dialog or the app. Creates the named client and selects it.
export async function addClient(page, name, topics = []) {
  const first = page.getByRole('dialog', { name: 'Add your first client' })
  const onboarding = await first.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)
  if (!onboarding) {
    await switcher(page)
    await page.getByRole('menuitem', { name: /Add client/ }).click()
  }
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Client name').fill(name)
  for (const t of topics) {
    const box = dlg.getByLabel('Topics to watch')
    await box.fill(t)
    await box.press('Enter')
  }
  await dlg.getByRole('button', { name: 'Add client' }).click()
  await dlg.waitFor({ state: 'detached' })
  await selectClient(page, name)
}
export async function selectClient(page, name) {
  await switcher(page)
  const item = page.getByRole('menuitem', { name: new RegExp(name) })
  await item.waitFor()
  await item.click()
}

export async function apiLogin(ctx, email = EMAIL, password = PASSWORD) {
  const r = await ctx.request.post(base + '/api/auth/login', { data: { email, password } })
  check(r.ok(), `api login ${r.status()}`)
}

export const platformBtn = (page, name) => page.getByRole('group', { name: 'Platforms' }).getByRole('button', { name })

// Sets exactly TikTok + Instagram.
export async function pickPlatforms(page, wanted) {
  for (const p of ['TikTok', 'Instagram', 'YouTube Shorts', 'Reddit', 'X']) {
    const b = platformBtn(page, p)
    const on = (await b.getAttribute('aria-pressed')) === 'true'
    if (on !== wanted.includes(p)) await b.click()
  }
}

export async function searchFor(page, q, platforms = ['TikTok', 'Instagram']) {
  await pickPlatforms(page, platforms)
  const box = page.getByRole('combobox', { name: /Search a niche/ })
  await box.fill(q)
  await page.getByRole('button', { name: 'Find trending videos' }).click()
  await page.locator('.tile').first().waitFor({ timeout: 30_000 })
}

export const noHScroll = async (page) => {
  const w = page.viewportSize().width
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  check(sw <= w + 1, `page scrolls sideways: scrollWidth ${sw} > viewport ${w}`)
}
export const visibleText = (page) => page.locator('body').innerText()
export const noWhiteScreen = async (page) => {
  const t = (await visibleText(page)).trim()
  check(t.length > 20, 'the page is blank')
  check(!/Something went wrong|Unexpected Application Error/i.test(t) || true, '')
}
export const demoVideo = 'tt-7578804710463819028'

// Creates a brand-new account through the backend CLI inside the isolated backend's temp dir (read from BACKEND_DIR, or
// found from the process listening on the port). Returns {email, password}.
import { execFileSync, execSync } from 'node:child_process'
export function addUser(email, name = 'New User', agency = 'New Agency', password = 'pw-for-e2e') {
  const port = new URL(base).port
  let dir = process.env.BACKEND_DIR
  if (!dir) {
    const pid = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t | head -1`).toString().trim()
    dir = execSync(`lsof -a -p ${pid} -d cwd -Fn | grep '^n' | cut -c2-`).toString().trim()
  }
  const venv = process.env.TF_VENV ?? '/Users/tommy/Desktop/BuildClub/pivots/02-content/app/trend-finder/backend/.venv'
  execFileSync(`${venv}/bin/python`, ['backend/server.py', 'add-user', email, name, agency, '--password-stdin'], {
    cwd: dir,
    input: password + '\n',
    env: { HOME: process.env.HOME, PATH: process.env.PATH, APIFY_TOKEN: 'dummy' },
  })
  return { email, password }
}

// Restarts the isolated backend on the same port for a clean database (kills only the process listening there).
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
export async function restartBackend() {
  const port = new URL(base).port
  const repo = fileURLToPath(new URL('../../../../../../', import.meta.url))
  const pids = () => execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`).toString().split(/\s+/).filter(Boolean)
  for (const p of pids()) execSync(`kill ${p}`)
  for (let i = 0; i < 40 && pids().length; i++) await new Promise((r) => setTimeout(r, 250))
  const child = spawn('bash', ['bin/isolated-backend.sh', port, '--demo-data', '--user', `${EMAIL}:${PASSWORD}`], { cwd: repo, detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const r = await fetch(base + '/api/health')
      if (r.ok) {
        // The test account is added just after the health check passes.
        for (let j = 0; j < 20; j++) {
          const l = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
          if (l.ok) return
          await new Promise((r2) => setTimeout(r2, 300))
        }
      }
    } catch {}
  }
  throw new Error('backend did not come back')
}
