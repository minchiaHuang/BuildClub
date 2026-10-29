// Layer 3: abnormal states. page.route() fakes /api/* answers; every scenario expects a message the user can read, a way to
// recover, no white screen and no lost data.
//   OUT=/some/dir [THEME=base] [WIDTH=1440,390] node e2e/anomalies.mjs http://127.0.0.1:8799
import { addClient, apiLogin, base, check, launch, login, makeReporter, nav, noHScroll, open, pickPlatforms, searchFor, seedIdeas, selectClient, sidebar, switcher, uniq, visibleText, demoVideo, themes, widths } from './lib/harness.mjs'

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
        const inView = await dlg.getByRole('button', { name: /Saved? to/ }).isVisible()
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
      // The edit is kept: once the API works again, Retry sends it.
      await page.unroute('**/api/ideas')
      await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
      await page.waitForTimeout(1500)
      const saved = (await (await o.ctx.request.get(base + '/api/ideas')).json()).some((i) => i.shots?.some((x) => x.shot === 'edit that cannot be saved'))
      check(saved, 'Retry did not send the edit that failed to save')
      check(!(await page.getByRole('alert').count()), 'the save warning stays after a successful retry')
    })
    await scenario('session expires mid-flow (401 on save)', async (o) => {
      const page = o.page
      await openPlan(page)
      await page.route('**/api/ideas', (r) => (r.request().method() === 'PUT' ? json(r, 401, { error: 'Sign in first.' }) : r.continue()))
      await page.getByLabel('Shot 1: what we film').fill('edit after the session ended')
      await page.waitForTimeout(1800)
      const t = await visibleText(page)
      check(/sign in|signed out|session|log in|expired|couldn't save/i.test(t), 'a 401 on save shows nothing; no way to know the edit was lost')
      check(/session ended/i.test(t), 'a 401 on save does not say the session ended')
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
        // Tab B held an old copy, so its save is refused: it is told, and shows the newer list.
        check(/changed in another tab/i.test(await visibleText(b.page)), 'tab B is not told that its edit was refused because the list changed in another tab')
        check((await b.page.locator('#note-to-approver').inputValue().catch(() => '')) !== 'TAB B note edit' || mine.noteToApprover === 'TAB B note edit', "tab B's screen still shows an edit that was not saved")
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
        check(/changed in another tab/i.test(await visibleText(b.page)), 'tab B is not told that its edit was refused')
      }, () => a?.page)
      await a?.ctx.close()
    }
    // After login the sidebar switcher and the page header name the same client.
    {
      let o
      await c.step('after login the client switcher agrees with the page header', async () => {
        o = await open(browser, { theme, width })
        await apiLogin(o.ctx)
        await o.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
        await sidebar(o.page).waitFor()
        await o.page.waitForTimeout(1500)
        const sw = await sidebar(o.page).locator('.switcher-btn strong').innerText()
        check(sw !== 'All clients', 'the switcher says "All clients" while the page shows a client')
        const body = await visibleText(o.page)
        check(body.includes(sw), `the switcher says "${sw}" but the page never names it`)
      }, () => o?.page)
      await o?.ctx.close()
    }
    // A client with no topics must not trigger the automatic "Trending now" search with an empty query.
    {
      let o
      await c.step('client without topics: no search with an empty query', async () => {
        o = await open(browser, { theme, width })
        await apiLogin(o.ctx)
        const asked = []
        o.page.on('request', (r) => /\/api\/search\?q=(&|$)/.test(r.url()) && asked.push(r.url()))
        await o.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
        await sidebar(o.page).waitFor()
        await addClient(o.page, `NoTopic ${uniq()}`)
        await nav(o.page, 'Search')
        await o.page.waitForTimeout(2000)
        check(asked.length === 0, `the app asked for a search with an empty query: ${asked[0]}`)
        check(o.probs.http.length === 0, 'bad HTTP: ' + o.probs.http.join(' | '))
      }, () => o?.page)
      await o?.ctx.close()
    }
    // Why a button is off: Send needs a real shot, and says so; the empty search / client name buttons carry a title.
    await scenario('Send for approval: blank shots do not count, and the reason is shown', async (o) => {
      const page = o.page
      await openPlan(page)
      const send = page.getByRole('button', { name: /^Send to .* for approval/ })
      const sendable = async () => !(await send.isDisabled())
      // No breakdown (the zero-budget API refuses it): the empty Shots section says so.
      const rows = () => page.locator('.shot-edit li').count()
      while ((await rows()) > 0) await page.getByRole('button', { name: /^Remove shot 1$/ }).click()
      check(!(await sendable()), 'Send is enabled with no shots at all')
      check(/at least one shot/i.test((await send.getAttribute('title')) ?? ''), 'disabled Send has no title saying why')
      check(await page.locator('#send-hint').isVisible(), 'the reason for the disabled Send is not visible next to it')
      await page.getByRole('button', { name: '+ Add a shot' }).click()
      await page.waitForTimeout(300)
      check(!(await sendable()), 'Send is enabled while the only shot is blank')
      await page.getByLabel('Shot 1: what we film').fill('   ')
      check(!(await sendable()), 'Send is enabled for a whitespace-only shot')
      await page.getByLabel('Shot 1: what we film').fill('Pour the sauce')
      check(await sendable(), 'Send stays disabled with a real shot')
      check((await page.locator('#send-hint').count()) === 0, 'the reason stays after the shot was filled in')
    })
    await scenario('search -> 429 on TikTok and Instagram: the refusal is shown once, saved searches are buttons', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await pickPlatforms(page, ['TikTok', 'Instagram'])
      const sentence = 'New Apify work is turned off. Saved searches and finished breakdowns still work.'
      let asked = 0
      await page.route(liveSearch, (r) => { asked++; return json(r, 429, { error: `${sentence} Try a saved search, like "tofu".` }) })
      await startSearch(page, 'pasta')
      await page.getByRole('alert').first().waitFor()
      const text = await visibleText(page)
      const n = text.split('New Apify work is turned off').length - 1
      check(n === 1, `the same refusal sentence is shown ${n} times`)
      const chip = page.getByRole('alert').getByRole('button', { name: '"tofu"' })
      check(await chip.count(), 'the suggested saved search "tofu" is not a button')
      const before = asked
      await chip.click()
      await page.waitForTimeout(800)
      check(asked > before, 'clicking the "tofu" suggestion did not run that search')
    })
    await scenario('accounts with 0 followers and no usual views get no x score', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await page.route(liveSearch, async (route) => {
        const resp = await route.fetch()
        const body = await resp.json()
        body.videos.forEach((v) => { v.followers = 0; v.medianViews = null })
        await route.fulfill({ response: resp, json: body })
      })
      await startSearch(page)
      await page.locator('.tile').first().waitFor({ timeout: 30_000 })
      await page.waitForTimeout(800)
      const t = await visibleText(page)
      const hit = t.match(/.{15}[\d,.]+[kM]?\s?×.{10}/)
      check(!hit, `a x score is shown for an account with 0 followers and no usual views: "${hit?.[0]}"`)
      await page.locator('.tile-main').first().click()
      const d = await page.getByRole('dialog').innerText()
      check(!/[\d,.]+[kM]?\s?×/.test(d), 'the video drawer shows a x score for an unscored account')
    })
    await scenario('"Plan another video" returns to the last results', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await searchFor(page, 'tofu')
      const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
      const other = ids.find((i) => i.startsWith('tt-') && i !== demoVideo)
      await page.locator(`[data-video-id="${other}"]`).click()
      const dlg = page.getByRole('dialog')
      await dlg.getByRole('button', { name: /^Save to/ }).click()
      await dlg.getByRole('button', { name: /Saved to/ }).waitFor({ timeout: 30_000 })
      await dlg.getByRole('button', { name: /^Plan this for/ }).click()
      await page.getByLabel('Shot 1: what we film').or(page.getByRole('button', { name: '+ Add a shot' })).first().waitFor()
      if (!(await page.getByLabel('Shot 1: what we film').count())) {
        await page.getByRole('button', { name: '+ Add a shot' }).click()
        await page.getByLabel('Shot 1: what we film').fill('Close-up of the pour')
      }
      await page.getByRole('button', { name: /^Send to .* for approval/ }).click()
      await page.getByRole('button', { name: 'Plan another video' }).first().click()
      await page.locator('.tile').first().waitFor({ timeout: 5000 }).catch(() => {})
      check((await page.locator('.tile').count()) > 0, 'Plan another video lands on an empty search box instead of the last results')
    })
    await scenario('a long shot description wraps in its box instead of being cut off', async (o) => {
      const page = o.page
      await openPlan(page)
      const box = page.getByLabel('Shot 1: what we film')
      await box.fill('Close-up of the tofu being lifted out of the pot with chopsticks while the steam rises and the camera pulls back to show the whole table '.repeat(2))
      await page.waitForTimeout(300)
      const cut = await box.evaluate((el) => el.scrollHeight - el.clientHeight)
      check(cut <= 1, `the shot text is cut off: ${cut}px of it is hidden`)
      const wide = await box.evaluate((el) => el.scrollWidth - el.clientWidth)
      check(wide <= 1, `the shot text scrolls sideways by ${wide}px`)
      await noHScroll(page)
    })
    await scenario('Channel summaries without server keys: a user-facing message, no .env hint', async (o) => {
      const page = o.page
      await nav(page, 'Channel')
      await page.locator('#channel-handle').fill('@somechannel')
      await page.getByRole('button', { name: 'Decode channel' }).click()
      await page.waitForTimeout(1500)
      const t = await visibleText(page)
      check(!/\.env|TYPESAFE_API_KEY|restart the API/i.test(t), 'the Channel screen shows a developer hint (.env / key name): ' + (t.match(/.{30}(\.env|TYPESAFE_API_KEY).{30}/)?.[0] ?? ''))
      const r = await o.ctx.request.post(base + '/api/channel', { data: { platform: 'youtube', handle: '@somechannel' } })
      const body = await r.json().catch(() => ({}))
      check(!/\.env|TYPESAFE_API_KEY/.test(String(body.error ?? '')), `the API error still names .env / the key: "${body.error}"`)
    })
    await scenario('plan for a client with no audience: the default note has no empty "Fits ." and the watch link is not browser blue', async (o) => {
      const page = o.page
      await openPlan(page)
      const note = await page.locator('#note-to-approver').inputValue()
      check(!/^Fits\s*\./i.test(note), `the default note to Annie starts with an empty clause: "${note.slice(0, 40)}"`)
      const color = await page.locator('.plan-watch').first().evaluate((a) => getComputedStyle(a).color)
      check(!['rgb(0, 0, 238)', 'rgb(85, 26, 139)', 'rgb(0, 102, 204)'].includes(color), `the Watch link uses the browser's default colour ${color}`)
    })
    await scenario('client with no niche, audience or starter searches: no dangling labels', async (o) => {
      const page = o.page
      await nav(page, 'Saved ideas')
      const sub = await page.locator('.client-head').innerText()
      check(!/Audience:\s*(\n|$)/.test(sub) && !/^\s*·/m.test(sub), `the Saved ideas subtitle has empty parts: "${sub.replace(/\s+/g, ' ').slice(0, 120)}"`)
      await nav(page, 'Search')
      await page.waitForTimeout(800)
      const titles = await page.locator('.chip-group').evaluateAll((gs) => gs.map((g) => ({ t: g.querySelector('.chip-group-title')?.textContent, n: g.querySelectorAll('.cchip').length, skel: !!g.querySelector('.cchip-skeleton') })))
      const empty = titles.filter((g) => g.n === 0 && !g.skel)
      check(empty.length === 0, `a chip label is shown with no chips: ${JSON.stringify(empty)}`)
    })
    await scenario('plan without an AI breakdown says the shots are up to her', async (o) => {
      const page = o.page
      // A video the zero-budget API has no cached breakdown for: /api/analyze answers 429 and the shot list stays empty.
      await nav(page, 'Search')
      await searchFor(page, 'tofu')
      const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
      const other = ids.find((i) => i.startsWith('tt-') && i !== demoVideo)
      await page.locator(`[data-video-id="${other}"]`).click()
      const dlg = page.getByRole('dialog')
      await dlg.getByRole('button', { name: /^Save to/ }).click()
      await dlg.getByRole('button', { name: /Saved to/ }).waitFor({ timeout: 30_000 })
      await dlg.getByRole('button', { name: /^Plan this for/ }).click()
      await page.getByRole('heading', { name: 'Shots' }).waitFor()
      await page.waitForTimeout(1500)
      check(/AI breakdown isn't available for this video, so add the shots yourself/.test(await visibleText(page)), 'the empty Shots section gives no explanation')
    })
    // Rewrites the test client's saved ideas (`f` gets them in saved order and a due-date maker) and keeps everyone else's.
    const approveSome = async (o, f) => {
      const cid = (await (await o.ctx.request.get(`${base}/api/clients`)).json()).find((x) => x.name === client)?.id
      const day = 86_400_000
      const due = (n) => new Date(Date.now() + n * day).toISOString().slice(0, 10)
      await seedIdeas(o.ctx, (list) => f(list.filter((i) => i.clientId === cid), due).concat(list.filter((i) => i.clientId !== cid)))
    }
    await c.step('dates read like "31 Oct" everywhere, never 2026-10-31 or 31/10/2026', async () => {
      const o = await fresh((o) =>
        approveSome(o, (mine, due) =>
          mine.map((i, n) => (n === 0 ? { ...i, status: 'approved', stage: 'approved', dueDate: due(5), decidedAt: Date.now() } : i)),
        ),
      )
      try {
        const page = o.page
        const bad = (t) => /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.exec(t)?.[0]
        for (const name of ['Plans', 'Saved ideas']) {
          await nav(page, name)
          await page.waitForTimeout(400)
          const t = await visibleText(page)
          check(!bad(t), `${name}: a raw date is shown: ${bad(t)}`)
          check(/\b\d{1,2} [A-Z][a-z]{2}\b/.test(t), `${name}: no "31 Oct" style date found`)
        }
      } finally {
        await o.ctx.close()
      }
    })
    await c.step('overdue ideas say so, and posted ideas leave Plans, its badge and "Next due"', async () => {
      const o = await fresh((o) =>
        approveSome(o, (mine, due) => {
          const base0 = mine[0]
          const mk = (n, extra) => ({ ...base0, id: `${base0.id}-c${n}`, status: 'approved', decidedAt: Date.now(), ...extra })
          return [
            mk(1, { stage: 'filming', dueDate: due(-3) }), // overdue, still to film
            mk(2, { stage: 'posted', postedAt: Date.now(), dueDate: due(-10) }), // done, long past its due date
            mk(3, { stage: 'approved', dueDate: due(5) }),
          ]
        }),
      )
      try {
        const page = o.page
        // Plans: two to film (one overdue), the posted one gone from the list; the badge counts the same two.
        await nav(page, 'Plans')
        await page.getByRole('heading', { name: 'Ready to film' }).waitFor()
        const items = await page.locator('ul.idea-list > li').count()
        check(items === 2, `Plans lists ${items} ideas, expected 2 (the posted one should not be there)`)
        const t = await visibleText(page)
        check(/Overdue · due \d{1,2} [A-Z][a-z]{2}/.test(t), 'Plans: the overdue idea is not marked overdue')
        check(/\bDue \d{1,2} [A-Z][a-z]{2}/.test(t), 'Plans: the on-time idea lost its "Due" date')
        const badge = await sidebar(page).locator('.side-link', { hasText: 'Plans' }).locator('.side-count').innerText()
        check(badge.trim() === '2', `the Plans badge says ${badge}, expected 2`)
        // The Board still shows the posted one.
        await page.getByRole('button', { name: 'Board', exact: true }).click()
        check((await page.locator('.board-card').count()) === 3, 'the Board should still list all 3 approved ideas')
        // Saved ideas: the posted idea reads "Posted", not "Approved".
        await nav(page, 'Saved ideas')
        await page.locator('.idea .status').first().waitFor()
        const st = await page.locator('.idea .status').allInnerTexts()
        check(st.filter((x) => x === 'Posted').length === 1, `Saved ideas statuses: ${JSON.stringify(st)}, expected one Posted`)
        check(/Overdue · due/.test(await visibleText(page)), 'Saved ideas: the overdue idea is not marked overdue')
        // Overview: the next due idea is the overdue one (3 days), in red; the posted one (10 days) doesn't count.
        await switcher(page)
        await page.getByRole('menuitem', { name: /All clients/ }).click()
        const cell = page.locator('tr', { hasText: client }).locator('td').nth(4).locator('span')
        const text = (await cell.innerText()).trim()
        check(text === 'Overdue 3 days', `Overview "Next due" says "${text}", expected "Overdue 3 days"`)
        check(/due-soon/.test((await cell.getAttribute('class')) ?? ''), 'an overdue "Next due" is not red')
      } finally {
        await o.ctx.close()
      }
    })
    await scenario('empty search box and empty client name: the disabled buttons say why', async (o) => {
      const page = o.page
      await nav(page, 'Search')
      await searchBox(page).fill('')
      check(/search for/i.test((await findBtn(page).getAttribute('title')) ?? ''), 'disabled "Find trending videos" has no title')
      await switcher(page)
      await page.getByRole('menuitem', { name: /Add client/ }).click()
      check(/client name/i.test((await page.getByRole('dialog').getByRole('button', { name: 'Add client' }).getAttribute('title')) ?? ''), 'disabled "Add client" has no title')
    })
    // The "Main audience" box is a text field with suggestions (it looks like a drop-down in Chrome), so it needs a hint.
    {
      let o
      await c.step('Add client: the Main audience field says what to type', async () => {
        o = await open(browser, { theme, width })
        await apiLogin(o.ctx)
        await o.page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
        await sidebar(o.page).waitFor()
        await switcher(o.page)
        await o.page.getByRole('menuitem', { name: /Add client/ }).click()
        const ph = await o.page.getByRole('dialog').getByLabel('Main audience').getAttribute('placeholder')
        check(ph && ph.trim().length > 3, 'the Main audience field is blank with no placeholder')
      }, () => o?.page)
      await o?.ctx.close()
    }
    void ideaTitle
  }
}
await browser.close()
rep.finish()
