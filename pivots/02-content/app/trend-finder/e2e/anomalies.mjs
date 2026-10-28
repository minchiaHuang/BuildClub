// Layer 3: abnormal states. page.route() fakes /api/* answers; every scenario expects a message the user can read, a way to
// recover, no white screen and no lost data.
//   OUT=/some/dir [THEME=base] [WIDTH=1440,390] node e2e/anomalies.mjs http://127.0.0.1:8799
import { addClient, apiLogin, base, check, launch, login, makeReporter, nav, noHScroll, open, searchFor, selectClient, sidebar, uniq, visibleText, demoVideo, themes, widths } from './lib/harness.mjs'

const THEMES = process.env.THEME ? themes() : ['base']
const WIDTHS = process.env.WIDTH ? widths() : [1440, 390]
const rep = makeReporter('anomalies')
const browser = await launch()

const notBlank = async (page) => {
  const t = (await visibleText(page)).trim()
  check(t.length > 30, `white screen: body text is "${t.slice(0, 40)}"`)
  check((await page.locator('#root').innerHTML()).length > 200, 'the React root is empty')
}
// A saved (not yet sent) idea is listed under "Saved ideas"; Plans only lists approved ones.
async function openPlan(page) {
  await nav(page, 'Saved ideas')
  await page.getByRole('button', { name: 'Open plan' }).first().click()
  await page.getByLabel('Shot 1: what we film').waitFor()
}
const searchBox = (page) => page.getByRole('combobox', { name: /Search a niche/ })
const findBtn = (page) => page.getByRole('button', { name: 'Find trending videos' })
async function startSearch(page, q = 'tofu') {
  await searchBox(page).fill(q)
  await findBtn(page).click()
}
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
// Only the live (paid-path) searches: leave the free cachedOnly polls alone.
const liveSearch = (url) => /\/api\/search\?/.test(url.toString()) && !/cachedOnly=1/.test(url.toString())

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const c = rep.cell(theme, width)
    const client = `Anom ${uniq()}`
    // ---- setup: one client with one saved idea, through the UI -------------------------------------------------
    let ideaTitle = ''
    {
      const s = await open(browser, { theme, width })
      await c.step('setup: client + saved idea', async () => {
        await login(s.page, theme)
        await addClient(s.page, client, ['tofu'])
        await nav(s.page, 'Search')
        await searchFor(s.page, 'tofu')
        await s.page.locator(`[data-video-id="${demoVideo}"]`).click()
        await s.page.getByRole('dialog').getByRole('button', { name: /^Save to/ }).click()
        await s.page.getByRole('dialog').getByRole('heading', { name: 'What each line does' }).waitFor({ timeout: 30_000 })
        await s.page.getByRole('dialog').getByRole('button', { name: /^Plan this for/ }).click()
        await s.page.getByLabel('Shot 1: what we film').waitFor()
        ideaTitle = await s.page.getByRole('heading', { level: 1 }).first().innerText()
        await s.page.waitForTimeout(1500)
      }, s.page)
      await s.ctx.close()
    }

    // Fresh signed-in page on the Search screen of the test client.
    async function fresh(setup) {
      const o = await open(browser, { theme, width })
      await apiLogin(o.ctx)
      if (setup) await setup(o)
      await o.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
      await sidebar(o.page).waitFor()
      await selectClient(o.page, client)
      return o
    }
    async function scenario(title, body, { search = true } = {}) {
      let o
      const ok = await c.step(title, async () => {
        o = await fresh()
        await body(o)
        await notBlank(o.page)
      }, () => o?.page)
      await o?.ctx.close()
      return ok
    }
    async function searchScenario(title, handler, expect, { recover = true } = {}) {
      let o
      await c.step(title, async () => {
        o = await fresh()
        const page = o.page
        await nav(page, 'Search')
        await page.route(liveSearch, handler)
        await startSearch(page)
        await expect(page)
        await notBlank(page)
        await noHScroll(page)
        if (recover) {
          // Recovery: the fake goes away, the same search works again without a reload.
          await page.unroute(liveSearch)
          await page.waitForTimeout(300)
          if (!(await findBtn(page).isVisible())) await nav(page, 'Search')
          await searchBox(page).fill('tofu ')
          await searchBox(page).fill('tofu')
          await findBtn(page).click()
          await page.locator('.tile').first().waitFor({ timeout: 30_000 })
        }
      }, () => o?.page)
      await o?.ctx.close()
    }
    const alertText = (page) => page.locator('[role=alert], .error').allInnerTexts().then((a) => a.join(' | '))

    await searchScenario('search returns 0 results', (r) => json(r, 200, { videos: [], cached: false, fetchedAt: Date.now(), mediansPending: false }), async (page) => {
      await page.waitForTimeout(1500)
      const t = await visibleText(page)
      check(/No videos|nothing|no results|found 0|0 videos/i.test(t), 'no "nothing found" message; page says: ' + t.replace(/\s+/g, ' ').slice(0, 300))
    })
    await searchScenario('search -> 429 (daily limit)', (r) => json(r, 429, { error: 'Daily search budget reached (fake)' }), async (page) => {
      await page.waitForTimeout(1200)
      const a = await alertText(page)
      check(/budget reached|limit/i.test(a + (await visibleText(page))), 'the 429 message is not shown; alerts: ' + a)
    })
    await searchScenario('search -> 502 bad gateway', (r) => json(r, 502, { error: 'Upstream scraper down (fake)' }), async (page) => {
      await page.waitForTimeout(1200)
      check(/Upstream scraper down/i.test(await visibleText(page)), 'the 502 message is not shown; alerts: ' + (await alertText(page)))
    })
    await searchScenario('search -> 502 with an HTML body (no JSON)', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>' }), async (page) => {
      await page.waitForTimeout(1200)
      const t = await visibleText(page)
      check(/failed|couldn't|error|try again|wrong|unavailable|Bad Gateway|not running/i.test(t), 'no readable error for an HTML 502; alerts: ' + (await alertText(page)))
      check(!/<html>/.test(t), 'raw HTML shown to the user')
    })
    await searchScenario('search -> network failure', (r) => r.abort('connectionrefused'), async (page) => {
      await page.waitForTimeout(1500)
      const t = await visibleText(page)
      check(/failed|couldn't|error|offline|connection|try again|network|reach/i.test(t), 'no error after a network failure; page says: ' + t.replace(/\s+/g, ' ').slice(0, 200))
      check((await page.locator('.tile').count()) === 0, 'tiles shown from nowhere')
    })
    {
      let seenLoading = false
      await searchScenario('search -> 3 s slow response shows progress, then results', async (r) => {
        await new Promise((res) => setTimeout(res, 3000))
        await r.continue().catch(() => {})
      }, async (page) => {
        await page.waitForTimeout(700)
        const t = await visibleText(page)
        seenLoading = /Searching|Looking|Loading|Finding|…|\.\.\./.test(t) || (await page.locator('[aria-busy=true], .live-loading, .loading, [role=progressbar], [role=status]').count()) > 0
        check(seenLoading, 'no progress indicator while the search is slow')
        const b = findBtn(page)
        // A second click while it runs must not break anything.
        if (await b.isVisible().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {})
        await page.locator('.tile').first().waitFor({ timeout: 20_000 })
      }, { recover: false })
    }

    // 300-character titles and captions, with spaces and as one unbroken word.
    for (const [label, mk] of [['300-char caption with spaces', (i) => `Title ${i} ` + 'word '.repeat(60)], ['300-char caption, one unbroken word', (i) => 'A'.repeat(300) + i]]) {
      let o
      await c.step(`long text: ${label}`, async () => {
        o = await fresh()
        const page = o.page
        await nav(page, 'Search')
        await page.route(liveSearch, async (route) => {
          const resp = await route.fetch()
          const body = await resp.json()
          body.videos.forEach((v, i) => { v.text = mk(i); v.author = 'x'.repeat(40); v.music = 'M'.repeat(120) })
          await route.fulfill({ response: resp, json: body })
        })
        await startSearch(page, 'tofu')
        await page.locator('.tile').first().waitFor({ timeout: 30_000 })
        await page.waitForTimeout(800)
        await noHScroll(page)
        // No tile may stick out of its column.
        const bad = await page.evaluate(() => [...document.querySelectorAll('.tile, .tile-main')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible').length)
        check(bad === 0, `${bad} tiles overflow their box`)
        await page.locator('.tile-main').first().click()
        const dlg = page.getByRole('dialog')
        await dlg.waitFor()
        await page.waitForTimeout(500)
        const dOver = await dlg.evaluate((d) => d.scrollWidth - d.clientWidth)
        check(dOver <= 2, `drawer scrolls sideways by ${dOver}px`)
        check(await dlg.getByRole('button', { name: 'Close' }).isVisible(), 'Close button is not visible with a long title')
        const inView = await dlg.getByRole('button', { name: /^Save to/ }).isVisible()
        check(inView, 'Save button is not reachable with a long title')
        await dlg.getByRole('button', { name: /^Plan this for/ }).click()
        await page.getByLabel('Shot 1: what we film').waitFor()
        await noHScroll(page)
        check(await page.getByRole('button', { name: /^Send to .* for approval/ }).isVisible(), 'Send button hidden with a long title')
      }, () => o?.page)
      await o?.ctx.close()
    }

    // Old data: fields the API stopped sending (documented optional ones, then a harsher stress).
    await scenario('old search data: optional fields missing (medianViews, upvotes, community)', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await page.route(liveSearch, async (route) => {
        const resp = await route.fetch()
        const body = await resp.json()
        body.videos.forEach((v) => { delete v.medianViews; delete v.upvotes; delete v.community; delete v.medianUpvotes })
        await route.fulfill({ response: resp, json: body })
      })
      await startSearch(page)
      await page.locator('.tile').first().waitFor({ timeout: 30_000 })
      await page.locator('.tile-main').first().click()
      await page.getByRole('dialog').waitFor()
    })
    await scenario('old search data: followers, hashtags, music, cover, duration missing', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await page.route(liveSearch, async (route) => {
        const resp = await route.fetch()
        const body = await resp.json()
        body.videos.forEach((v) => { delete v.followers; delete v.hashtags; delete v.music; delete v.cover; delete v.duration; delete v.shares; delete v.createTime })
        await route.fulfill({ response: resp, json: body })
      })
      await startSearch(page)
      await page.locator('.tile').first().waitFor({ timeout: 30_000 })
      await page.locator('.tile-main').first().click()
      await page.getByRole('dialog').waitFor()
    })
    await scenario('old saved ideas: notes, dueDate, shots, status fields missing', async (o) => {
      const page = o.page
      await page.route('**/api/ideas', async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        const resp = await route.fetch()
        const list = await resp.json()
        list.forEach((i) => { delete i.notes; delete i.dueDate; delete i.shots; delete i.noteToApprover; delete i.sentAt })
        await route.fulfill({ response: resp, json: list })
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      await selectClient(page, client)
      await openPlan(page)
      const t = await visibleText(page)
      check(!/undefined|NaN|null/.test(t), 'the plan shows undefined/NaN/null: ' + (t.match(/.{20}(undefined|NaN|null).{20}/)?.[0] ?? ''))
    })
    await scenario('old library: saved video missing fields', async (o) => {
      const page = o.page
      await page.route('**/api/library', async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        const resp = await route.fetch()
        const lib = await resp.json()
        lib.videos.forEach((v) => { delete v.hashtags; delete v.music; delete v.thumbnail; delete v.caption })
        lib.formats.forEach((f) => { delete f.props; delete f.needs; delete f.tags; delete f.audiences })
        await route.fulfill({ response: resp, json: lib })
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      await selectClient(page, client)
      await openPlan(page)
    })

    // ---- load-time failures ------------------------------------------------------------------------------------
    await scenario('GET /api/ideas fails at load (502)', async (o) => {
      const page = o.page
      await page.route('**/api/ideas', (r) => (r.request().method() === 'GET' ? json(r, 502, { error: 'down' }) : r.continue()))
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      const t = await visibleText(page)
      check(/couldn't load|could not load|try again|offline|error|reload/i.test(t), 'load failure is silent: the app shows no message; text: ' + t.replace(/\s+/g, ' ').slice(0, 160))
    })
    await scenario('saving an edit fails (PUT /api/ideas 500): user is told', async (o) => {
      const page = o.page
      await openPlan(page)
      await page.route('**/api/ideas', (r) => (r.request().method() === 'PUT' ? json(r, 500, { error: 'disk full' }) : r.continue()))
      await page.getByLabel('Shot 1: what we film').fill('edit that cannot be saved')
      await page.waitForTimeout(1800)
      const t = await visibleText(page)
      check(/couldn't save|could not save|not saved|failed to save|save failed|try again|offline/i.test(t), 'a failed save shows nothing: the user thinks the edit is safe')
    })
    await scenario('session expires mid-flow (401 on save)', async (o) => {
      const page = o.page
      await openPlan(page)
      await page.route('**/api/ideas', (r) => (r.request().method() === 'PUT' ? json(r, 401, { error: 'Sign in first.' }) : r.continue()))
      await page.getByLabel('Shot 1: what we film').fill('edit after the session ended')
      await page.waitForTimeout(1800)
      const t = await visibleText(page)
      check(/sign in|signed out|session|log in|expired|couldn't save/i.test(t), 'a 401 on save shows nothing; no way to know the edit was lost')
    })

    // ---- reload mid-flow ---------------------------------------------------------------------------------------
    await scenario('reload mid-search (slow search) leaves a working app', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await page.route(liveSearch, async (r) => { await new Promise((res) => setTimeout(res, 2500)); await r.continue().catch(() => {}) })
      await startSearch(page)
      await page.waitForTimeout(500)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      await selectClient(page, client)
      await nav(page, 'Search')
      await searchFor(page, 'tofu')
    })
    await scenario('reload right after typing in a shot: edit is kept', async (o) => {
      const page = o.page
      await openPlan(page)
      await page.getByLabel('Shot 1: what we film').fill('typed just before reload')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      await selectClient(page, client)
      await openPlan(page)
      const v = await page.getByLabel('Shot 1: what we film').inputValue()
      check(v === 'typed just before reload', `shot 1 is "${v.slice(0, 40)}" after reload`)
    })
    await scenario('reload with the plan screen open returns to the same screen', async (o) => {
      const page = o.page
      await openPlan(page)
      await page.getByLabel('Shot 1: what we film').waitFor()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      await page.waitForTimeout(1200)
      check(await page.getByLabel('Shot 1: what we film').count(), 'reload dropped her back to another screen (the URL never changes, so the plan she was editing is gone)')
    })

    // ---- two tabs on the same idea ---------------------------------------------------------------------------
    {
      let a, b
      await c.step('two tabs edit the same idea: both edits survive', async () => {
        a = await fresh()
        b = { page: await a.ctx.newPage() }
        await b.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
        await sidebar(b.page).waitFor()
        await selectClient(b.page, client)
        for (const p of [a.page, b.page]) {
          await openPlan(p)
        }
        await a.page.getByLabel('Shot 1: what we film').fill('TAB A shot edit')
        await a.page.waitForTimeout(1200)
        await b.page.locator('#note-to-approver').fill('TAB B note edit')
        await b.page.waitForTimeout(1200)
        const r = await a.ctx.request.get(base + '/api/ideas')
        const ideas = await r.json()
        const mine = ideas.find((i) => i.shots?.[0]?.shot?.includes('TAB A') || i.noteToApprover === 'TAB B note edit')
        check(mine, 'neither edit reached the server')
        check(mine.shots?.[0]?.shot === 'TAB A shot edit', "tab A's shot edit was overwritten by tab B's older copy of the idea (last write wins, no warning)")
        check(mine.noteToApprover === 'TAB B note edit', "tab B's note edit is missing")
      }, () => b?.page)
      await a?.ctx.close()
    }
    {
      let a, b
      await c.step('two tabs: an idea saved in tab A survives tab B editing', async () => {
        a = await fresh()
        b = { page: await a.ctx.newPage() }
        await b.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
        await sidebar(b.page).waitFor()
        await selectClient(b.page, client)
        const before = (await (await a.ctx.request.get(base + '/api/ideas')).json()).length
        // Tab A saves a second video; tab B (which has not seen it) then edits the first plan.
        await nav(a.page, 'Search')
        await searchFor(a.page, 'tofu')
        const ids = await a.page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
        const other = ids.find((i) => i.startsWith('tt-') && i !== demoVideo)
        await a.page.locator(`[data-video-id="${other}"]`).click()
        await a.page.getByRole('dialog').getByRole('button', { name: /^Save to/ }).click()
        await a.page.getByRole('dialog').getByRole('button', { name: /Saved to/ }).waitFor({ timeout: 30_000 })
        await a.page.waitForTimeout(1500)
        const mid = (await (await a.ctx.request.get(base + '/api/ideas')).json()).length
        check(mid === before + 1, `tab A did not save its idea (${before} -> ${mid})`)
        await openPlan(b.page)
        await b.page.getByLabel('Shot 1: what we film').fill('TAB B edit after A saved')
        await b.page.waitForTimeout(1500)
        const after = (await (await a.ctx.request.get(base + '/api/ideas')).json()).length
        check(after === mid, `tab B's stale list deleted ${mid - after} idea(s) saved by tab A (${mid} -> ${after})`)
      }, () => a?.page)
      await a?.ctx.close()
    }
    void ideaTitle
  }
}
await browser.close()
rep.finish()
