// Journey 1: Daphne's day. Login, pick a client, search tofu on TikTok + Instagram, open the drawer, save, plan, send for
// review, copy Annie's link, Annie approves, due date + editor note, board to Posted, Overview counts.
//   bash bin/isolated-backend.sh 8799 --demo-data --user test@example.com:pw-for-e2e
//   OUT=/some/dir [THEME=base,unify] [WIDTH=390] node e2e/journeys/daphne-daily.mjs http://127.0.0.1:8799
import { addClient, check, demoVideo, launch, login, makeReporter, matrix, nav, noHScroll, open, searchFor, selectClient, sidebar, switcher, uniq, visibleText, platformBtn } from '../lib/harness.mjs'
import { copyAnnieLink } from '../lib/daphne.mjs'

const rep = makeReporter('journey1-daphne')
const browser = await launch()
const postedCount = async (page) => {
  await switcher(page)
  await page.getByRole('menuitem', { name: /All clients/ }).click()
  const stat = page.locator('.stat-ring .stat-num')
  await stat.waitFor()
  const t = await stat.innerText()
  return { done: Number(t.split('/')[0].replace(/\D/g, '')), text: t, waiting: Number((await page.locator('.stat').nth(1).locator('.stat-num').innerText()).replace(/\D/g, '')) }
}

for (const { theme, width } of matrix()) {
  const c = rep.cell(theme, width)
  const { ctx, page, probs } = await open(browser, { theme, width })
  const name = `Daphne ${uniq()}`
  let annie = null
  let before = null
  const P = () => page

  await c.step('login', async () => {
    await login(page, theme)
    await sidebar(page).waitFor()
    // Either the first-client dialog or the app: both mean the sign-in worked.
    await noHScroll(page)
  }, P)
  await c.step('add + pick client', async () => {
    await addClient(page, name, ['tofu'])
    await page.getByText(name).first().waitFor()
    check((await page.locator('.mobile-bar, .sidebar').first().innerText()).includes(name) || (await visibleText(page)).includes(name), 'client name not shown')
  }, P)
  await c.step('overview baseline', async () => {
    before = await postedCount(page)
    await selectClient(page, name)
  }, P)
  await c.step('search tofu on TikTok + Instagram', async () => {
    await nav(page, 'Search')
    check((await visibleText(page)).includes(name), 'search screen does not name the client')
    await searchFor(page, 'tofu')
    const tiles = await page.locator('.tile').count()
    check(tiles > 30, `expected both platforms merged, got ${tiles} tiles`)
    const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
    check(ids.some((i) => i.startsWith('tt-')) && ids.some((i) => i.startsWith('ig-')), 'TikTok and Instagram not both present')
    await noHScroll(page)
  }, P)
  await c.step('drawer: stats, can-we-film, what we know', async () => {
    await page.locator(`[data-video-id="${demoVideo}"]`).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('region', { name: 'Video analytics' }).waitFor()
    await dlg.getByRole('heading', { name: /^Can .* film it\?/ }).waitFor()
    await dlg.getByRole('heading', { name: /What we know/ }).waitFor()
    // Can-we-film asks the paid API: 429 here, so the panel must say so in words.
    await page.waitForTimeout(1500)
    const fit = await dlg.locator('section.fit').innerText()
    check(/can't check this one|film|Hard|Easy/i.test(fit) && fit.length > 20, `can-we-film panel says: "${fit}"`)
    check(await dlg.getByRole('button', { name: /^Save to/ }).isVisible(), 'no Save button')
    check(await dlg.getByRole('link', { name: /Watch on TikTok/ }).isVisible(), 'no Watch on TikTok link')
    await noHScroll(page)
  }, P)
  await c.step('save: lines + breakdown appear', async () => {
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('button', { name: /^Save to/ }).click()
    await dlg.getByRole('heading', { name: 'What each line does' }).waitFor({ timeout: 30_000 })
    check((await dlg.locator('ul.line-roles li, .line-roles li').count()) > 3 || (await dlg.getByRole('listitem').count()) > 3, 'no lines listed')
    await dlg.getByRole('button', { name: /Saved to/ }).waitFor()
  }, P)
  await c.step('plan: edit a shot', async () => {
    await page.getByRole('dialog').getByRole('button', { name: /^Plan this for/ }).click()
    await page.getByRole('heading', { level: 1 }).first().waitFor()
    const shot = page.getByLabel('Shot 1: what we film')
    await shot.fill('Daphne edit: close-up of the tofu block')
    await page.getByLabel('Shot 1: text on screen').fill('Tofu day')
    await page.getByRole('button', { name: '+ Add a shot' }).click()
    check((await page.locator('.shot-edit li').count()) > 5, 'shot not added')
    await page.getByLabel('Remove shot 3').click()
    await page.getByRole('button', { name: 'Undo remove' }).waitFor()
    await page.locator('#note-to-approver').fill('Fits the lunch crowd.')
    await page.waitForTimeout(1200)
    await noHScroll(page)
  }, P)
  await c.step('send for review', async () => {
    await page.getByRole('button', { name: /^Send to .* for approval/ }).click()
    await page.locator('.plan-bar').getByText(/^Waiting for/).waitFor()
    await page.getByRole('status').filter({ hasText: /Sent to .* for approval/ }).waitFor()
    check(await page.getByLabel('Shot 1: what we film').count() === 0, 'shots still editable while waiting')
    check((await visibleText(page)).includes('Daphne edit: close-up of the tofu block'), 'edited shot is not shown after sending')
  }, P)
  let link = ''
  await c.step('Approvals: copy Annie link', async () => {
    await nav(page, 'Approvals')
    await page.locator('.approval').first().waitFor()
    link = await copyAnnieLink(page)
    check((await page.locator('.approval').count()) === 1, 'expected exactly one waiting idea')
  }, P)
  await c.step('Annie (no cookies) approves', async () => {
    const a = await open(browser, { theme, width, storage: true })
    annie = a
    await a.page.goto(base_(link), { waitUntil: 'domcontentloaded' })
    const card = a.page.locator('.review-card').first()
    await card.waitFor()
    const t = await card.innerText()
    check(t.includes('Fits the lunch crowd.'), 'Daphne\'s note is not on the card')
    check(t.includes('Daphne edit: close-up of the tofu block'), 'edited shot is not on the card')
    await card.getByRole('button', { name: 'Approve' }).click()
    await a.page.locator('.review-card').first().waitFor({ state: 'detached' })
  }, () => annie?.page)
  await c.step('Daphne sees Approved (<= 35 s)', async () => {
    await page.bringToFront()
    await page.locator('.approval .status-approved').first().waitFor({ timeout: 35_000 })
  }, P)
  await c.step('plan: due date + editor note survive reload', async () => {
    await nav(page, 'Plans')
    await page.getByRole('button', { name: 'Open plan' }).first().click()
    await page.locator('#plan-due').fill('2026-12-24')
    await page.locator('#plan-editor-notes').fill('Use the warm filter.')
    await page.getByText('Approved. Due 2026-12-24.').waitFor()
    await page.waitForTimeout(1500)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await selectClient(page, name)
    await nav(page, 'Plans')
    await page.getByRole('button', { name: 'Open plan' }).first().click()
    check((await page.locator('#plan-due').inputValue()) === '2026-12-24', 'due date lost after reload')
    check((await page.locator('#plan-editor-notes').inputValue()) === 'Use the warm filter.', 'editor note lost after reload')
    check((await page.getByLabel('Shot 1: what we film').inputValue()).startsWith('Daphne edit'), 'edited shot lost after reload')
    await page.getByRole('button', { name: /Copy brief for editor/ }).click()
    await page.getByText('Brief copied').waitFor()
    const brief = await page.evaluate(() => navigator.clipboard.readText())
    check(brief.includes('Use the warm filter.') && brief.includes('2026-12-24'), 'copied brief misses the note or due date')
  }, P)
  await c.step('board: Approved -> Posted', async () => {
    await nav(page, 'Plans')
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    for (const next of ['Filming', 'Editing', 'Posted']) {
      await page.getByRole('button', { name: new RegExp(`^${next} →`) }).first().click()
      await page.getByRole('region', { name: next }).locator('.board-card').first().waitFor()
    }
    const left = await page.getByRole('region', { name: 'Approved' }).locator('.board-card').count()
    check(left === 0, 'card still in Approved')
    await noHScroll(page)
  }, P)
  await c.step('Overview: posted count +1', async () => {
    const after = await postedCount(page)
    check(after.done === before.done + 1, `posted this month ${before.text} -> ${after.text}, expected +1`)
    check((await page.locator('.client-table').innerText()).includes(name), 'client missing from the overview table')
    await noHScroll(page)
  }, P)
  await c.problems('no page errors / bad HTTP', probs)
  await annie?.ctx.close()
  await ctx.close()
}
await browser.close()
rep.finish()

function base_(link) {
  return (process.argv[2] ?? 'http://127.0.0.1:8799').replace(/\/$/, '') + link
}
