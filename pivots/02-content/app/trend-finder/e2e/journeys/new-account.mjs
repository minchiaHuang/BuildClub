// Journey 3: a brand-new account's first use. Landing (themes that have one) -> Log in -> empty "add your first client" state
// -> add client -> first search -> Channel page. The account is created through the backend CLI.
//   OUT=/some/dir [THEME=base] [WIDTH=390] node e2e/journeys/new-account.mjs http://127.0.0.1:8799
import { addUser, apiLogin, restartBackend, base, check, launch, makeReporter, matrix, nav, noHScroll, open, searchFor, sidebar, uniq, visibleText } from '../lib/harness.mjs'

const rep = makeReporter('journey3-new-account')
const browser = await launch()

// One-off: a second account must not see the first account's clients. (Needs a backend that already has data.)
{
  const c = rep.cell('api', 0)
  const { ctx } = await open(browser, { theme: 'base', width: 1440 })
  await c.step('a new account does not see other accounts\' clients', async () => {
    const u = addUser(`iso-${uniq()}@example.com`, 'Iso User', 'Iso Agency')
    await apiLogin(ctx, u.email, u.password)
    const clients = (await (await ctx.request.get(base + '/api/clients')).json()) ?? []
    const ideas = (await (await ctx.request.get(base + '/api/ideas')).json()) ?? []
    check(clients.length === 0 && ideas.length === 0, `new account sees ${clients.length} clients and ${ideas.length} ideas that belong to another account`)
  })
  await ctx.close()
}

for (const { theme, width } of matrix()) {
  const c = rep.cell(theme, width)
  // The empty first-use state needs an empty database: every cell starts from a freshly restarted backend.
  await restartBackend()
  const email = `new-${theme}-${width}-${uniq()}@example.com`
  const { ctx, page, probs } = await open(browser, { theme, width })
  const P = () => page
  await c.step('create account via CLI', async () => { addUser(email, 'New User', 'New Agency') })
  await c.step('landing + Log in', async () => {
    await page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
    if (theme === 'base') {
      await page.getByRole('heading', { name: /Find what's working/ }).waitFor()
    } else {
      const b = page.getByRole('button', { name: /^Log in/ }).first()
      await b.waitFor()
      await noHScroll(page)
      await page.screenshot({ path: `${c.dir}/landing-full.png`, fullPage: true })
      await b.click()
    }
    await page.getByLabel('Email').waitFor()
    await noHScroll(page)
  }, P)
  await c.step('wrong password is explained', async () => {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('nope')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByText('Wrong email or password.').waitFor()
  }, P)
  await c.step('sign in -> empty state asks for first client', async () => {
    await page.getByLabel('Password').fill('pw-for-e2e')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const dlg = page.getByRole('dialog', { name: 'Add your first client' })
    await dlg.waitFor()
    check((await dlg.getByRole('button', { name: 'Cancel' }).count()) === 0, 'the first client can be skipped')
    check(await dlg.getByRole('button', { name: 'Add client' }).isDisabled(), 'Add client is enabled with no name')
    const t = await visibleText(page)
    check(!t.includes('Evergreen Foods'), 'sample client shown to a new account')
    await noHScroll(page)
  }, P)
  await c.step('add client with a topic tag', async () => {
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('Client name').fill('Fresh Tofu Co')
    const topics = dlg.getByLabel('Topics to watch')
    await topics.fill('tofu')
    await topics.press('Enter')
    check(await dlg.isVisible(), 'Enter in topics submitted the form')
    await dlg.getByRole('button', { name: 'Remove tofu' }).waitFor()
    await dlg.getByRole('button', { name: 'Add client' }).click()
    await dlg.waitFor({ state: 'detached' })
    await sidebar(page).waitFor()
    await page.getByText('Fresh Tofu Co').first().waitFor()
    const t = await visibleText(page)
    check(t.includes('New Agency'), 'agency name not shown')
  }, P)
  await c.step('first search finds videos', async () => {
    await nav(page, 'Search')
    await searchFor(page, 'tofu')
    check((await page.locator('.tile').count()) > 30, 'few tiles')
    await noHScroll(page)
  }, P)
  await c.step('Channel page opens with empty state', async () => {
    await nav(page, 'Channel')
    await page.getByRole('heading', { name: 'Decode a channel' }).waitFor()
    await page.locator('.empty').waitFor()
    check((await page.locator('.empty').innerText()).includes('Decode a channel to see the formats it keeps using.'), 'empty text')
    await noHScroll(page)
  }, P)
  await c.step('reload keeps the account and client', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sidebar(page).waitFor()
    check((await visibleText(page)).includes('Fresh Tofu Co'), 'client gone after reload')
  }, P)
  await c.problems('no page errors / bad HTTP', probs)
  await ctx.close()
}
await browser.close()
rep.finish()
