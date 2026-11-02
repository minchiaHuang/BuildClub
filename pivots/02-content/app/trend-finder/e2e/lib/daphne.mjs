// Sets up Daphne's side over the real UI at desktop width: a new client with `n` ideas sent to Annie.
// Used by journey 2 (Annie on a phone) and the anomaly checks, which need waiting ideas to exist.
import { addClient, apiLogin, base, check, login, nav, open, searchFor, uniq, demoVideo } from './harness.mjs'

export async function daphneSendIdeas(browser, { n = 1, theme = 'base', prefix = 'Client', note } = {}) {
  const { ctx, page, probs } = await open(browser, { theme, width: 1440 })
  const name = `${prefix} ${uniq()}`
  await login(page, theme)
  await addClient(page, name)
  await nav(page, 'Search')
  await searchFor(page, 'tofu')
  const ids = await page.locator('.tile-main').evaluateAll((els) => els.map((e) => e.dataset.videoId))
  const pick = [demoVideo, ...ids.filter((i) => i !== demoVideo && i.startsWith('tt-'))].slice(0, n)
  for (let k = 0; k < pick.length; k++) {
    if (k > 0) {
      await nav(page, 'Search')
      await searchFor(page, 'tofu')
    }
    await page.locator(`[data-video-id="${pick[k]}"]`).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('button', { name: /^Plan this for/ }).click()
    if (note) await page.locator('#note-to-approver').fill(note)
    // Only three demo videos have an AI breakdown; any other has no shots yet, and Send stays off until one is written.
    if (await page.getByRole('button', { name: /^Send to .* for approval/ }).isDisabled()) {
      await page.getByRole('button', { name: '+ Add a shot' }).click()
      await page.getByLabel('Shot 1: what we film').fill('Film the plated dish from above')
    }
    await page.getByRole('button', { name: /^Send to .* for approval/ }).click()
    await page.locator('.plan-bar').getByText(/^Waiting for/).waitFor()
  }
  await nav(page, 'Approvals')
  return { ctx, page, probs, name }
}

export async function copyAnnieLink(page) {
  await page.getByRole('button', { name: 'Copy link for Annie' }).click()
  await page.getByText('Copied', { exact: true }).waitFor()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  check(/\/review\/[^/?#\s]+/.test(url), `clipboard has no review link: "${url}"`)
  return url.match(/\/review\/[^/?#\s]+/)[0]
}
