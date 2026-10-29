// Journey 2: Annie reviews on her phone. Daphne's side is set up over the UI (desktop, 2 ideas sent); then Annie opens the
// link in a fresh context (no cookies) at the matrix width: sees the reference video, note and shot list, approves one,
// sends one back with a reason. Daphne's still-open Approvals page must show both answers within 20 s.
//   OUT=/some/dir [THEME=base] [WIDTH=390] node e2e/journeys/annie-phone.mjs http://127.0.0.1:8799
import { base, check, launch, makeReporter, matrix, noHScroll, open, visibleText } from '../lib/harness.mjs'
import { copyAnnieLink, daphneSendIdeas } from '../lib/daphne.mjs'

const rep = makeReporter('journey2-annie')
const browser = await launch()

for (const { theme, width } of matrix()) {
  const c = rep.cell(theme, width)
  let d = null
  let link = ''
  let a = null
  let t0 = 0
  await c.step('setup: Daphne sends 2 ideas, copies link', async () => {
    d = await daphneSendIdeas(browser, { n: 2, theme, prefix: 'Annie test', note: 'Good for the lunch rush.' })
    await d.page.locator('.approval').nth(1).waitFor()
    check((await d.page.locator('.approval').count()) === 2, 'expected 2 waiting ideas')
    link = await copyAnnieLink(d.page)
  }, () => d?.page)
  await c.step('Annie opens link with no cookies', async () => {
    a = await open(browser, { theme, width })
    check((await a.ctx.cookies()).length === 0, 'Annie context has cookies')
    await a.page.goto(base + link, { waitUntil: 'domcontentloaded' })
    await a.page.locator('.review-card').first().waitFor()
    check((await a.page.locator('.review-card').count()) >= 1, 'no cards')
  }, () => a?.page)
  await c.step('card shows reference video, note, shot list', async () => {
    const card = a.page.locator('.review-card').first()
    check(await card.locator('.review-ref').count(), 'no reference video block')
    const ref = card.locator('.review-ref')
    check((await ref.locator('iframe, img, video, a').count()) > 0, 'reference block has no video/thumbnail/link')
    check(!/swipe/i.test(await a.page.locator('.review-head').innerText()), 'the hint still talks about swiping, but the page has buttons')
    // She can open the original video: a "Watch the video" link and the thumbnail both go to its page, in a new tab.
    const watch = card.getByRole('link', { name: /^Watch the video/ })
    check((await watch.count()) === 1, 'no "Watch the video" link on the review card')
    check((await watch.getAttribute('target')) === '_blank' && /^https?:\/\//.test((await watch.getAttribute('href')) ?? ''), 'the watch link does not open the video in a new tab')
    check((await ref.locator('a.review-ref-thumb').getAttribute('href')) === (await watch.getAttribute('href')), 'the thumbnail does not link to the video')
    check((await card.innerText()).includes('Good for the lunch rush.'), 'Daphne\'s note is missing')
    check((await card.locator('.review-shots li').count()) >= 1, 'shot list is empty')
    await noHScroll(a.page)
    const box = await card.boundingBox()
    check(box.width <= width, `card ${box.width}px wide on ${width}px screen`)
    for (const n of ['Approve', 'Not this one']) {
      const b = card.getByRole('button', { name: n })
      await b.scrollIntoViewIfNeeded()
      const bb = await b.boundingBox()
      check(bb && bb.height >= 36, `${n} button is only ${bb?.height}px tall`)
    }
  }, () => a?.page)
  await c.step('Annie approves one', async () => {
    t0 = Date.now()
    await a.page.locator('.review-card').first().getByRole('button', { name: 'Approve' }).click()
    await a.page.waitForFunction(() => document.querySelectorAll('.review-card').length === 1)
  }, () => a?.page)
  await c.step('Annie sends one back with a reason', async () => {
    const card = a.page.locator('.review-card').first()
    await card.getByRole('button', { name: 'Not this one' }).click()
    const reason = card.getByLabel(/What should change/)
    await reason.waitFor()
    await reason.fill('Too long for our audience, cut to 15s.')
    await card.getByRole('button', { name: 'Send back' }).click()
    await a.page.locator('.review-card').first().waitFor({ state: 'detached' })
    check(!/Something went wrong/.test(await visibleText(a.page)), 'error shown after answering')
  }, () => a?.page)
  await c.step('Annie reload: answered cards stay gone', async () => {
    await a.page.reload({ waitUntil: 'domcontentloaded' })
    await a.page.locator('main.review-page').waitFor()
    await a.page.waitForTimeout(800)
    check((await a.page.locator('.review-card').count()) === 0, 'answered cards came back after reload')
  }, () => a?.page)
  await c.step('Daphne sees both answers within 20 s', async () => {
    await d.page.bringToFront()
    await d.page.locator('.approval .status-approved').first().waitFor({ timeout: 22_000 })
    await d.page.locator('.approval .status-rejected').first().waitFor({ timeout: 5_000 })
    const secs = (Date.now() - t0) / 1000
    console.log(`      Daphne saw the answers ${secs.toFixed(1)} s after Annie's first click`)
    check(secs <= 24, `took ${secs.toFixed(1)} s`)
  }, () => d?.page)
  await c.step("Daphne can read Annie's reason", async () => {
    // Plans page lists the not-approved idea; its plan shows the feedback.
    await d.page.locator('.approval', { has: d.page.locator('.status-rejected') }).getByRole('button', { name: 'Open plan' }).click()
    await d.page.getByText('Too long for our audience, cut to 15s.').waitFor()
  }, () => d?.page)
  if (a) await c.problems('no page errors / bad HTTP (Annie)', a.probs)
  if (d) await c.problems('no page errors / bad HTTP (Daphne)', d.probs)
  await a?.ctx.close()
  await d?.ctx.close()
}
await browser.close()
rep.finish()
