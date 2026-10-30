// End-to-end walk through Trend Finder against an isolated backend (free: no .env, every budget 0).
//   bash bin/isolated-backend.sh 8797 --demo-data --user test@example.com:pw-for-e2e
//   OUT=/some/dir WIDTH=1440 node e2e/full-flow.mjs http://127.0.0.1:8797
// WIDTH=390 runs only the phone steps (landing and Annie's review page). Any failed check exits 1.
import { chromium } from '/Users/tommy/.hermes/hermes-agent/node_modules/playwright-core/index.mjs'
import { mkdirSync } from 'node:fs'

const base = (process.argv[2] ?? 'http://127.0.0.1:8797').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/trend-finder-e2e'
const WIDTH = Number(process.env.WIDTH ?? 1440)
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'pw-for-e2e'
const AGENCY = 'E2E Agency'
const CLIENT = 'Acme Bakery'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 600 ? 800 : 900 } })
const page = await ctx.newPage()
page.setDefaultTimeout(15_000)

const results = []
let n = 0
async function step(name, fn, target = page) {
  const id = String(++n).padStart(2, '0')
  const file = `${OUT}/${id}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  try {
    await fn()
    await target.screenshot({ path: file })
    results.push({ name, ok: true })
    console.log(`PASS  ${name}`)
  } catch (e) {
    await target.screenshot({ path: file }).catch(() => {})
    results.push({ name, ok: false, err: e.message.split('\n')[0] })
    console.log(`FAIL  ${name}: ${e.message.split('\n')[0]}`)
  }
}
const check = (cond, msg) => { if (!cond) throw new Error(msg) }
const text = (p = page) => p.locator('body').innerText()
const goto = (path) => page.goto(base + path, { waitUntil: 'domcontentloaded' })
const sidebar = () => page.getByRole('complementary', { name: 'Main' })
// The sidebar is a drawer on a phone; the desktop steps never need it closed.
const platform = (name) => page.getByRole('group', { name: 'Platforms' }).getByRole('button', { name })
const nav = (name) => sidebar().getByRole('button', { name, exact: false }).first()

// 1. Landing: the counter is a real number, never labelled "sample".
await step('1 landing counter', async () => {
  await goto('/?ui=unify')
  const count = page.locator('.lu-count')
  await count.waitFor()
  await page.waitForFunction(() => /scanned\s+[\d,]+\s+videos/.test(document.querySelector('.lu-count')?.textContent ?? ''))
  await page.waitForTimeout(2500) // let the slot counter settle
  const t = await count.innerText()
  const m = t.replace(/\s+/g, ' ').match(/scanned ([\d,\s]+) videos/)
  check(m && Number(m[1].replace(/\D/g, '')) > 0, `no real count in "${t}"`)
  check(!/sample/i.test(await text()), 'the landing page says "sample"')
})

// 12 (part). Annie on a phone is checked in step 7 below; the rest needs the desktop layout.
if (WIDTH >= 600) {
  await step('2 wrong password then sign in', async () => {
    await goto('/?ui=base')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByText('Wrong email or password.').waitFor()
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    // A live API with no clients asks for the first one; the sample clients never appear.
    const first = page.getByRole('dialog', { name: 'Add your first client' })
    await first.waitFor()
    check(!(await text()).includes('Evergreen Foods'), 'a sample client shows on a live API')
    check((await first.getByRole('button', { name: 'Cancel' }).count()) === 0, 'the first client can be skipped')
    await page.getByLabel('Client name').fill('Starter Co')
    await first.getByRole('button', { name: 'Add client' }).click()
    // The agency name sits by the signed-in person.
    await sidebar().waitFor()
    check(!(await sidebar().innerText()).includes('Evergreen Foods'), 'a sample client is in the switcher')
    check((await sidebar().innerText()).includes(AGENCY), `sidebar does not show "${AGENCY}"`)
    await sidebar().locator('.switcher-btn').click()
    await page.getByRole('menuitem', { name: /All clients/ }).click()
    await page.getByRole('heading', { name: 'Where every client stands' }).waitFor()
  })

  await step('3 add a client', async () => {
    await sidebar().locator('.switcher-btn').click()
    await page.getByRole('menuitem', { name: /Add client/ }).click()
    await page.getByLabel('Client name').fill(CLIENT)
    // Topics are tags: Enter adds one (without submitting the form), a pasted list becomes one tag each.
    const topics = page.getByRole('dialog').getByLabel('Topics to watch')
    await topics.fill('sourdough')
    await topics.press('Enter')
    check(await page.getByRole('dialog').isVisible(), 'Enter in the topics box submitted the form')
    await topics.fill('croissant, cake,')
    for (const t of ['sourdough', 'croissant', 'cake'])
      await page.getByRole('dialog').getByRole('button', { name: `Remove ${t}` }).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Add client' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sidebar().waitFor()
    check((await text()).includes(CLIENT), 'the client is gone after a reload')
    const saved = (await (await ctx.request.get(base + '/api/clients')).json()).find((c) => c.name === CLIENT)
    check(saved?.topics?.join('|') === 'sourdough|croissant|cake', `topics saved as ${JSON.stringify(saved?.topics)}`)
    await sidebar().locator('.switcher-btn').click()
    await page.getByRole('menuitem', { name: new RegExp(CLIENT) }).click()
  })

  await step('4 search tofu on TikTok + Instagram, then add Reddit', async () => {
    await nav('Search').click()
    const box = page.locator('.search-input input')
    await box.fill('tofu')
    // TikTok is the default; Instagram goes on.
    if ((await platform('Instagram').getAttribute('aria-pressed')) !== 'true') await platform('Instagram').click()
    if ((await platform('TikTok').getAttribute('aria-pressed')) !== 'true') await platform('TikTok').click()
    await page.getByRole('button', { name: 'Find trending videos' }).click()
    await page.locator('.tile').first().waitFor({ timeout: 30_000 })
    const tiles = await page.locator('.tile').count()
    check(tiles > 30, `expected both platforms' videos merged, got ${tiles} tiles`)
    const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
    check(ids.some((i) => i.startsWith('tt-')) && ids.some((i) => i.startsWith('ig-')), 'TikTok and Instagram videos are not both there')
    const t = await text()
    check(/TikTok/.test(t) && /Instagram/.test(t), 'platform labels missing')
    // Reddit has no pinned search and no budget: its own line says so, the rest stays.
    await platform('Reddit').click()
    await page.getByRole('button', { name: 'Find trending videos' }).click()
    await page.locator('p.error[role=alert]', { hasText: /^Reddit:/ }).waitFor({ timeout: 30_000 })
    check((await page.locator('.tile').count()) > 0, 'the other platforms lost their results')
  })

  await step('5 suggestions offer "tofu"', async () => {
    await nav('Search').click()
    const box = page.locator('.search-input input')
    await box.fill('tof')
    // Past searches arrive after the typing pauses.
    await page.waitForFunction(() => document.querySelector('.search-input datalist option'), null, { timeout: 5000 }).catch(() => {})
    const options = await page.locator('.search-input datalist option').evaluateAll((o) => o.map((x) => x.getAttribute('value')))
    check(options.includes('tofu'), `datalist has ${JSON.stringify(options)}`)
  })

  await step('6 open a broken-down video', async () => {
    await nav('Search').click()
    await page.locator('.search-input input').fill('tofu')
    await page.getByRole('button', { name: 'Find trending videos' }).click()
    await page.locator('.tile').first().waitFor({ timeout: 30_000 })
    // The three demo breakdowns belong to known videos.
    await page.locator('[data-video-id="tt-7578804710463819028"]').click()
    // The breakdown loads when the video is saved; the finished one on disk comes back with no AI call.
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: /^Save to/ }).click()
    await drawer.getByRole('heading', { name: 'What each line does' }).waitFor({ timeout: 30_000 })
    // Close and reopen: the "can they film it" check now asks the API, which has no budget and says 429.
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'detached' })
    await page.locator('[data-video-id="tt-7578804710463819028"]').click()
    const fit = drawer.locator('section.fit')
    await fit.waitFor()
    await page.waitForTimeout(1500)
    const t = await fit.innerText()
    check(/can't check this one/i.test(t), `expected the graceful "can't check" line, got: ${t}`)
    check(await drawer.getByRole('heading', { name: 'What each line does' }).isVisible(), 'the line roles vanished')
    // The pinned search is old data: no baseline details, so the evidence is limited and the calculation says so.
    const calc = await drawer.locator('section.calc').innerText()
    // This video has no median at all, so the formula falls back to followers and says it is rough.
    check(/Rough estimate \(views ÷ followers\)/.test(calc), `expected the rough-estimate formula, got: ${calc}`)
    check((calc.match(/Rough estimate/g) ?? []).length === 1, 'the rough-estimate line shows twice')
    check(/Evidence: limited/.test(calc), `expected "Evidence: limited", got: ${calc}`)
    check(/We can't see watch time or retention/.test(calc), 'limit line 1 missing')
    check(!/Instagram views include paid/.test(calc), 'the Instagram limit line shows on a TikTok video')
    check(/These numbers don't mean a copy will go viral/.test(calc), 'limit line 3 missing')
    check(await drawer.getByRole('button', { name: /^Plan this for/ }).isVisible(), 'the panel broke')
  })

  await step('7a save, plan, send for approval', async () => {
    await page.getByRole('dialog').getByRole('button', { name: /^Plan this for/ }).click()
    await page.getByRole('button', { name: /^Send to .* for approval/ }).click()
    await page.locator('.plan-bar').getByText(/^Waiting for/).waitFor()
  })
}

let reviewUrl = ''
let reviewPage = null
let annieCtx = null
async function openAnnie() {
  annieCtx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 600 ? 800 : 900 } })
  reviewPage = await annieCtx.newPage()
  reviewPage.setDefaultTimeout(15_000)
  await reviewPage.goto(base + reviewUrl, { waitUntil: 'domcontentloaded' })
}

if (WIDTH >= 600) {
  await step('7b Copy link for Annie', async () => {
    const shared = page.waitForResponse((r) => r.url().endsWith('/api/share') && r.request().method() === 'POST')
    await sidebar().getByRole('button', { name: /^Approvals/ }).click()
    await page.getByRole('button', { name: 'Copy link for Annie' }).click()
    const body = await (await shared).json()
    const url = String(body.url ?? body.path ?? '')
    const m = url.match(/\/review\/[^/?#\s]+/)
    check(m, `no /review/<token> link in ${JSON.stringify(body)}`)
    reviewUrl = m[0]
  })
} else {
  // Phone run: Daphne's setup is the desktop run's job. Here a waiting copy of its idea is added over the API
  // (the first run already got its idea approved), then Annie opens her link on the phone.
  await step('7 prepare a link for Annie', async () => {
    const login = await ctx.request.post(base + '/api/auth/login', { data: { email: EMAIL, password: PASSWORD } })
    check(login.ok(), `login ${login.status()}`)
    const clients = await (await ctx.request.get(base + '/api/clients')).json()
    const c = (clients ?? []).find((x) => x.name === CLIENT)
    check(c, `run the 1440 width first: there is no "${CLIENT}" client`)
    const ideas = await (await ctx.request.get(base + '/api/ideas')).json()
    const first = ideas.find((i) => i.clientId === c.id)
    check(first, 'run the 1440 width first: there is no idea')
    const copy = { ...first, id: `phone-${Date.now()}`, status: 'waiting', sentAt: Date.now() }
    for (const k of ['stage', 'postedAt', 'decidedAt', 'rejectReason']) delete copy[k]
    const put = await ctx.request.put(base + '/api/ideas', { data: [...ideas, copy] })
    check(put.ok(), `ideas ${put.status()}`)
    const share = await ctx.request.post(base + '/api/share', { data: { clientId: c.id } })
    check(share.ok(), `share ${share.status()}`)
    reviewUrl = String((await share.json()).url).match(/\/review\/[^/?#\s]+/)[0]
  })
}

await step('7c Annie opens the link and approves', async () => {
  await openAnnie()
  const card = reviewPage.locator('.review-card').first()
  await card.waitFor()
  check((await card.innerText()).length > 20, 'the card is empty')
  if (WIDTH >= 600) {
    await reviewPage.screenshot({ path: `${OUT}/07-annie-card.png` })
    await card.getByRole('button', { name: 'Approve' }).click()
    await reviewPage.locator('.review-card').first().waitFor({ state: 'detached' })
  } else {
    // On a phone the card must fit the screen and its buttons must be reachable.
    const box = await card.boundingBox()
    check(box.width <= WIDTH, `card is ${box.width}px wide on a ${WIDTH}px screen`)
    const sw = await reviewPage.evaluate(() => document.documentElement.scrollWidth)
    check(sw <= WIDTH, `page scrolls sideways: ${sw}px`)
    await card.getByRole('button', { name: 'Approve' }).scrollIntoViewIfNeeded()
    check(await card.getByRole('button', { name: 'Approve' }).isVisible(), 'Approve is hidden')
  }
}, { screenshot: (o) => reviewPage?.screenshot(o) })

if (WIDTH >= 600) {
  await step('8 Daphne sees Approved, due date change keeps it', async () => {
    await page.bringToFront()
    // Approvals polls every 20 seconds, so Annie's answer shows up without a reload.
    await page.locator('.approval .status-approved').first().waitFor({ timeout: 35_000 })
    await sidebar().getByRole('button', { name: /^Plans/ }).click()
    await page.getByRole('button', { name: 'Open plan' }).first().click()
    await page.locator('#plan-due').fill('2026-12-24')
    await page.getByText('Approved. Due 24 Dec.').waitFor()
    await page.waitForTimeout(1500) // let the change save
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sidebar().getByRole('button', { name: /^Approvals/ }).click()
    await page.getByRole('heading', { name: /Nothing waiting|waiting for Annie/ }).waitFor()
    await page.locator('.approval .status-approved').first().waitFor()
    check(!(await page.locator('.idea-actions').getByText('Withdraw').count()), 'the idea fell back to waiting')
    await sidebar().getByRole('button', { name: /^Plans/ }).click()
    await page.getByText('Due 24 Dec').first().waitFor()
  })

  await step('9 Board: move to Posted, month count +1', async () => {
    await sidebar().getByRole('button', { name: /^Plans/ }).click()
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    for (const next of ['Filming', 'Editing', 'Posted']) {
      await page.getByRole('button', { name: new RegExp(`^${next} →`) }).first().click()
    }
    await page.getByRole('region', { name: 'Posted' }).locator('.board-card').first().waitFor()
    await page.locator('.side-brand').first().click().catch(() => {})
    await sidebar().locator('.switcher-btn').click()
    await page.getByRole('menuitem', { name: /All clients/ }).click()
    const stat = page.locator('.stat-ring')
    await stat.waitFor()
    const done = Number((await stat.locator('.stat-num').innerText()).split('/')[0].replace(/\D/g, ''))
    check(done === 1, `videos posted this month is ${done}, expected 1`)
  })

  await step('10 Channel page', async () => {
    await sidebar().locator('.switcher-btn').click()
    await page.getByRole('menuitem', { name: new RegExp(CLIENT) }).click()
    await nav('Channel').click()
    await page.getByRole('heading', { name: 'Decode a channel' }).waitFor()
    for (const name of ['TikTok', 'Instagram']) {
      check(await page.locator('.cchip', { hasText: name }).count(), `no ${name} chip`)
    }
    const empty = page.locator('.empty')
    await empty.waitFor()
    check((await empty.innerText()).includes('Decode a channel to see the formats it keeps using.'), 'empty card text is wrong')
  })

  await step('11 sign out, API says 401', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByRole('button', { name: 'Sign in' }).waitFor()
    const r = await page.request.get(base + '/api/ideas')
    check(r.status() === 401, `/api/ideas gave ${r.status()} after sign-out`)
  })
}

await annieCtx?.close()
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps passed (width ${WIDTH}). Screenshots: ${OUT}`)
process.exit(failed.length ? 1 : 0)
