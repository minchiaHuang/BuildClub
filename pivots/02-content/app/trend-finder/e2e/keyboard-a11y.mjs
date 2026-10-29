// Layer 4: keyboard and accessibility. Daphne's journey with the keyboard only (Tab / Shift+Tab / Enter / Space / Esc),
// plus per-screen scans: unnamed controls (ariaSnapshot + DOM), images without alt, iframes without a title, tap targets
// under 40x40 px at phone width, and focus-ring visibility at every Tab stop.
//   OUT=/some/dir [THEME=base,unify] [WIDTH=1440,390] node e2e/keyboard-a11y.mjs http://127.0.0.1:8799
import { writeFileSync } from 'node:fs'
import { addClient, base, check, demoVideo, launch, makeReporter, open, sidebar, themes, uniq, visibleText, widths } from './lib/harness.mjs'

const THEMES = themes()
const WIDTHS = process.env.WIDTH ? widths() : [1440, 390]
const rep = makeReporter('keyboard-a11y')
const browser = await launch()

// ---- in-page helpers -------------------------------------------------------------------------------------------
const NAME_FN = `(el) => {
  const a = el.getAttribute('aria-label'); if (a) return a.trim()
  const lb = el.getAttribute('aria-labelledby')
  if (lb) { const t = lb.split(' ').map((i) => document.getElementById(i)?.textContent || '').join(' ').trim(); if (t) return t }
  if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent).join(' ').trim()
  const img = el.querySelector && el.querySelector('img[alt]:not([alt=""])');
  return ((el.innerText || el.value || el.placeholder || el.title || el.getAttribute('alt') || (img && img.alt) || '') + '').trim().replace(/\\s+/g, ' ')
}`
// Style fingerprint of the element and its next two ancestors (focus rings are often drawn on a :focus-within wrapper).
const SIG_FN = `(e) => { const one = (x) => { const s = getComputedStyle(x); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderTopColor, s.backgroundColor, s.textDecorationLine, s.color].join('|') }; const a = e.parentElement, b = a && a.parentElement; return one(e) + '//' + (a ? one(a) : '') + '//' + (b ? one(b) : '') + '//' + (e.nextElementSibling ? one(e.nextElementSibling) : '') }`

async function stop(page) {
  return page.evaluate(`(() => {
    const nm = ${NAME_FN}, sig = ${SIG_FN}
    const el = document.activeElement
    let prevRing = null
    const p = window.__prev
    if (p && p !== el && p.isConnected && window.__prevSig) prevRing = { name: window.__prevName, frame: !!window.__prevFrame, ring: sig(p) !== window.__prevSig || (!!p.parentElement && p.parentElement.matches(':focus-within')) }
    if (!el || el === document.body) return { body: true, prevRing }
    const r = el.getBoundingClientRect()
    const vis = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight + 2000 && r.left > -5
    const offscreenX = r.right <= 0 || r.left >= innerWidth
    return { name: nm(el), key: nm(el) + ' [' + (el.dataset.videoId || '') + '] <' + el.tagName.toLowerCase() + ' ' + el.className + '>', tag: el.tagName, id: el.id, inDialog: !!el.closest('[role=dialog]'), vis, offscreenX, prevRing, video: el.dataset.videoId || '' }
  })()`)
}

// State shared by all steps of one cell.
function kb(page, c) {
  const st = { stops: [], tabs: 0, offscreen: [], noRing: new Map() }
  const note = (s) => {
    // A cross-origin iframe (the TikTok / YouTube player embed) draws its own focus inside the frame; the page cannot
    // style a ring on it, so it is not judged here.
    if (s.prevRing && !s.prevRing.ring && s.prevRing.name && !s.prevRing.frame) st.noRing.set(s.prevRing.name.slice(0, 60), (st.noRing.get(s.prevRing.name.slice(0, 60)) ?? 0) + 1)
    if (s.offscreenX && !s.inDialog) st.offscreen.push(s.name?.slice(0, 50))
  }
  const press = async (key) => {
    await page.evaluate(`(() => { const nm = ${NAME_FN}, sig = ${SIG_FN}; const e = document.activeElement; window.__prev = e; window.__prevName = e && e !== document.body ? nm(e) : ''; window.__prevFrame = !!e && e.tagName === 'IFRAME'; window.__prevSig = e && e !== document.body ? sig(e) : '' })()`)
    await page.keyboard.press(key)
    await page.waitForTimeout(220) // let :focus transitions finish so the blurred style of the previous stop is final
    const s = await stop(page)
    note(s)
    return s
  }
  // Tab until the focused control matches (RegExp on "name [videoId] <tag class>" or a CSS selector string).
  const tabTo = async (match, { max = 90, back = false } = {}) => {
    const re = typeof match === 'string' ? null : match
    for (let i = 0; i < max; i++) {
      const s = await press(back ? 'Shift+Tab' : 'Tab')
      st.tabs++
      if (s.body) continue
      let hit = re ? re.test(s.key) : await page.evaluate((sel) => document.activeElement.matches(sel), match)
      if (hit) return { ...s, presses: i + 1 }
    }
    const here = await stop(page)
    throw new Error(`Tab never reached ${match} in ${max} presses (now on ${here.name ?? 'body'})`)
  }
  const active = () => stop(page)
  return { st, press, tabTo, active }
}

// ---- static scans ------------------------------------------------------------------------------------------------
async function scan(page, c, screen, width) {
  const res = await page.evaluate(`(() => {
    const nm = ${NAME_FN}
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.right > 0 && r.left < innerWidth && !e.closest('[aria-hidden=true]') }
    // Off-canvas sidebar on phones is not "on screen".
    const onScreen = (e) => { const r = e.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 }
    const q = [...document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=menuitem], input:not([type=hidden]), select, textarea, summary')].filter((e) => vis(e) && onScreen(e))
    const unnamed = q.filter((e) => !nm(e)).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 40))
    const imgs = [...document.querySelectorAll('img')].filter((i) => vis(i) && !i.hasAttribute('alt') && i.getAttribute('role') !== 'presentation').map((i) => (i.src || '').slice(-40))
    const roleImg = [...document.querySelectorAll('[role=img]')].filter((i) => vis(i) && !nm(i)).map((i) => i.className)
    const iframes = [...document.querySelectorAll('iframe')].filter((i) => vis(i) && !i.title && !i.getAttribute('aria-label')).map((i) => (i.src || '').slice(0, 60))
    // A file input taken out of the Tab order is opened by its visible button, which is the tap target.
    const small = q.filter((e) => !e.matches('input[type=file][tabindex="-1"]')).filter((e) => { const r = e.getBoundingClientRect(); const inline = getComputedStyle(e).display === 'inline'; return (r.width < 40 || r.height < 40) && !(e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio') && e.closest('label') && e.closest('label').getBoundingClientRect().height >= 40) })
      .map((e) => { const r = e.getBoundingClientRect(); const lab = e.closest('label'); return { name: nm(e).slice(0, 40) || e.className, w: Math.round(r.width), h: Math.round(r.height), tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 30), inline: getComputedStyle(e).display === 'inline' } })
    return { unnamed, imgs, roleImg, iframes, small, n: q.length }
  })()`)
  const aria = await page.locator('body').ariaSnapshot()
  const dlgAria = (await page.getByRole('dialog').count()) ? await page.getByRole('dialog').first().ariaSnapshot() : ''
  const emptyName = [...(aria + '\n' + dlgAria).matchAll(/^\s*- (button|link|checkbox|combobox|textbox|menuitem|switch|tab|radio)(?: \[[^\]]*\])*:?\s*(?:$|\/)/gm)].map((m) => m[1])
  const noTitleFrames = /^\s*- iframe(?: \[[^\]]*\])*:?\s*$/m.test(aria) ? ['iframe'] : []
  const dedupe = (a, f = JSON.stringify) => [...new Map(a.map((x) => [f(x), x])).values()]
  const small = dedupe(res.small, (s) => `${s.name}|${s.w}x${s.h}`)
  const out = { screen, width, unnamed: res.unnamed, emptyNameInAria: emptyName, imgsWithoutAlt: res.imgs, roleImgNoName: res.roleImg, iframesNoTitle: res.iframes, tapTargetsUnder40: small }
  writeFileSync(`${c.dir}/scan-${screen.replace(/\W+/g, '-')}.json`, JSON.stringify(out, null, 1))
  return out
}
const brief = (a) => a.slice(0, 6).map((x) => (typeof x === 'string' ? x : `${x.name} ${x.w}x${x.h}`)).join('; ') + (a.length > 6 ? ` (+${a.length - 6} more)` : '')

// ---- run ---------------------------------------------------------------------------------------------------------
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const c = rep.cell(theme, width)
    const phone = width <= 860
    const name = `Keys ${uniq()}`
    const { ctx, page, probs } = await open(browser, { theme, width })
    const K = kb(page, c)
    const P = () => page
    const scans = []
    const doScan = async (screen) => {
      const r = await scan(page, c, screen, width)
      scans.push(r)
      return r
    }
    let annie = null
    let link = ''

    await c.step('login with the keyboard', async () => {
      await page.goto(`${base}/?ui=${theme}`, { waitUntil: 'domcontentloaded' })
      if (theme !== 'base') {
        await K.tabTo(/^Log in/)
        await page.keyboard.press('Enter')
      }
      await K.tabTo(/^Email /)
      await page.keyboard.type('test@example.com')
      await K.tabTo(/^Password /)
      await page.keyboard.type('pw-for-e2e')
      await page.keyboard.press('Enter')
      await sidebar(page).waitFor({ timeout: 15_000 }).catch(async () => {
        await page.getByRole('dialog', { name: 'Add your first client' }).waitFor()
      })
      await doScan('after-login')
    }, P)

    await c.step('Esc closes the Add client dialog, focus returns to the switcher', async () => {
      if (phone) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      const first = await page.getByRole('dialog', { name: 'Add your first client' }).isVisible().catch(() => false)
      if (first) return // a first client cannot be dismissed; nothing to test
      await K.tabTo('.switcher-btn')
      await page.keyboard.press('Enter')
      await page.getByRole('menu').waitFor()
      await K.tabTo(/Add client|New client/)
      await page.keyboard.press('Enter')
      const dlg = page.getByRole('dialog')
      await dlg.waitFor()
      const problems = []
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))
      if (!inside) problems.push('focus did not move into the Add client dialog when it opened')
      await page.keyboard.press('Escape')
      await dlg.waitFor({ state: 'detached', timeout: 3000 })
      // On a phone the menu closes when the dialog opens, so focus goes to the button that opens the menu.
      const back = await page.evaluate(() => (document.activeElement?.className ?? '') + '|' + (document.activeElement?.getAttribute('aria-label') ?? ''))
      if (!(phone ? /\|Open menu$/ : /switcher-btn/).test(String(back))) problems.push(`after Esc the focus is on "${back || 'body'}", not the button that opened the dialog`)
      check(problems.length === 0, problems.join('; '))
    }, P)

    await c.step('Add client with the keyboard, then pick it', async () => {
      if (!(await page.getByRole('dialog', { name: 'Add your first client' }).isVisible().catch(() => false))) {
        if (!(await sidebar(page).evaluate((el) => el.classList.contains('sidebar-open') || getComputedStyle(el).position !== 'fixed'))) {
          await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
        }
        await K.tabTo('.switcher-btn')
        await page.keyboard.press('Enter')
        await K.tabTo(/Add client|New client/)
        await page.keyboard.press('Enter')
        await page.getByRole('dialog').waitFor()
      }
      await K.tabTo(/^Client name/)
      await page.keyboard.type(name)
      await doScan('add-client-dialog')
      await page.keyboard.press('Enter') // submits the form
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 })
      // pick the client (add already selects it on a first client; otherwise use the switcher)
      if (phone) { const open = await sidebar(page).evaluate((el) => el.classList.contains('sidebar-open')); if (!open) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) } }
      await K.tabTo('.switcher-btn')
      await page.keyboard.press('Enter')
      await K.tabTo(new RegExp(name))
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      check((await visibleText(page)).includes(name), 'client not selected')
    }, P)

    await c.step('Esc closes the phone menu and focus returns to Open menu', async () => {
      if (!phone) return
      if (!(await sidebar(page).evaluate((el) => el.classList.contains('sidebar-open')))) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      const open = await sidebar(page).evaluate((el) => el.classList.contains('sidebar-open'))
      check(!open, 'Esc does not close the phone menu')
      const nm = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)
      check(nm === 'Open menu', `focus after closing the menu is on "${nm}", not Open menu`)
    }, P)

    await c.step('Tab reaches only things you can see', async () => {
      // On a phone the closed slide-over menu stays in the tab order: keyboard focus vanishes off screen.
      check(K.st.offscreen.length === 0, `focus landed on ${K.st.offscreen.length} controls that are off screen: ${[...new Set(K.st.offscreen)].slice(0, 6).join(', ')}`)
    }, P)

    await c.step('Search with the keyboard (Space toggles platforms, Enter searches)', async () => {
      if (phone) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      await K.tabTo(/^Search \[\] <button/)
      await page.keyboard.press('Enter')
      await page.getByRole('combobox', { name: /Search a niche/ }).waitFor()
      await page.waitForTimeout(400)
      // The hidden file input sits behind the visible "Upload screenshot" button: one Tab stop, not two.
      const fileTab = await page.locator('input[type=file]').first().getAttribute('tabindex')
      check(fileTab === '-1', `the hidden screenshot file input is its own Tab stop (tabindex=${fileTab})`)
      await K.tabTo(/^Instagram \[/)
      const was = await page.evaluate(() => document.activeElement.getAttribute('aria-pressed'))
      await page.keyboard.press('Space')
      const now = await page.evaluate(() => document.activeElement.getAttribute('aria-pressed'))
      check(was !== now, 'Space did not toggle Instagram')
      if (now !== 'true') await page.keyboard.press('Space')
      await K.tabTo(/^Search a niche/)
      await page.keyboard.type('tofu')
      await page.keyboard.press('Enter')
      await page.locator('.tile').first().waitFor({ timeout: 30_000 })
      await doScan('results')
    }, P)

    await c.step('open the video with Enter; Esc closes it and focus returns to the tile', async () => {
      await K.tabTo(new RegExp(`\\[${demoVideo}\\]`), { max: 160 })
      await page.keyboard.press('Enter')
      const dlg = page.getByRole('dialog')
      await dlg.waitFor()
      await page.waitForTimeout(600)
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))
      check(inside, 'focus did not move into the drawer')
      await doScan('drawer')
      // Tab must stay inside the drawer.
      for (let i = 0; i < 14; i++) await page.keyboard.press('Tab')
      check(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'Tab escaped the open drawer')
      await page.keyboard.press('Shift+Tab')
      check(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'Shift+Tab escaped the open drawer')
      await page.keyboard.press('Escape')
      await dlg.waitFor({ state: 'detached', timeout: 4000 })
      const back = await page.evaluate(() => document.activeElement?.dataset?.videoId ?? document.activeElement?.tagName)
      check(back === demoVideo, `after Esc the focus is on "${back}", not the tile that opened the drawer`)
    }, P)

    await c.step('save (Space) and open the plan (Enter) from the drawer', async () => {
      await page.keyboard.press('Enter')
      await page.getByRole('dialog').waitFor()
      await K.tabTo(/^Save to/)
      await page.keyboard.press('Space')
      await page.getByRole('dialog').getByRole('heading', { name: 'What each line does' }).waitFor({ timeout: 30_000 })
      await K.tabTo(/^Plan this for/)
      await page.keyboard.press('Enter')
      await page.getByLabel('Shot 1: what we film').waitFor()
      await page.waitForTimeout(300)
      await doScan('plan')
      const f = await K.active()
      check(!f.body, 'after opening the plan, keyboard focus is lost on <body>; a keyboard user has to Tab from the top of the page')
    }, P)

    await c.step('edit a shot and send for approval with the keyboard', async () => {
      await K.tabTo(/^Shot 1: what we film/)
      await page.keyboard.press('Control+A')
      await page.keyboard.type('Keyboard edit: close-up of tofu')
      await K.tabTo(/^Send to .* for approval/)
      await page.keyboard.press('Space')
      await page.locator('.plan-bar').getByText(/^Waiting for/).waitFor()
      const f = await K.active()
      check(!f.body, 'after sending, keyboard focus is lost (the Send button disappeared and focus fell to <body>)')
    }, P)

    await c.step('Approvals: copy Annie link with Enter', async () => {
      if (phone) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      await K.tabTo(/^Approvals/)
      await page.keyboard.press('Enter')
      await page.locator('.approval').first().waitFor()
      await K.tabTo(/^Copy link for Annie/)
      await page.keyboard.press('Enter')
      await page.getByText('Copied', { exact: true }).waitFor()
      link = (await page.evaluate(() => navigator.clipboard.readText())).match(/\/review\/[^/?#\s]+/)?.[0]
      check(link, 'no review link in the clipboard')
      await doScan('approvals')
    }, P)

    await c.step("Annie's page with the keyboard only (Approve)", async () => {
      annie = await open(browser, { theme, width })
      const ak = kb(annie.page, c)
      await annie.page.goto(base + link, { waitUntil: 'domcontentloaded' })
      await annie.page.locator('.review-card').first().waitFor()
      const r = await scan(annie.page, c, 'annie-review', width)
      scans.push(r)
      await ak.tabTo(/^Approve /, { max: 40 })
      await annie.page.keyboard.press('Enter')
      await annie.page.locator('.review-card').first().waitFor({ state: 'detached' })
      const f = await ak.active()
      check(!f.body, 'after answering the last card, focus is lost on <body>')
    }, () => annie?.page)

    await c.step('board: move a card with the keyboard', async () => {
      await page.bringToFront()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sidebar(page).waitFor()
      if (phone) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      await K.tabTo('.switcher-btn')
      await page.keyboard.press('Enter')
      await K.tabTo(new RegExp(name))
      await page.keyboard.press('Enter')
      if (phone) { await K.tabTo(/^Open menu/); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
      await K.tabTo(/^Plans/)
      await page.keyboard.press('Enter')
      await K.tabTo(/^Board /)
      await page.keyboard.press('Enter')
      await page.getByRole('region', { name: 'Approved' }).locator('.board-card').first().waitFor()
      await doScan('board')
      await K.tabTo(/^Filming →/)
      await page.keyboard.press('Enter')
      await page.getByRole('region', { name: 'Filming' }).locator('.board-card').first().waitFor()
    }, P)

    // Screens the journey does not visit, scanned by mouse navigation.
    await c.step('scan: overview, channel, settings, saved', async () => {
      const { nav, switcher } = await import('./lib/harness.mjs')
      for (const [label, screen] of [['Channel', 'channel'], ['Client settings', 'settings'], ['Saved ideas', 'saved']]) {
        await nav(page, label)
        await page.waitForTimeout(500)
        await doScan(screen)
      }
      await switcher(page)
      await page.getByRole('menuitem', { name: /All clients/ }).click()
      await page.locator('.client-table').waitFor()
      await doScan('overview')
    }, P)

    // ---- verdicts ---------------------------------------------------------------------------------------------
    const all = (k) => scans.flatMap((s) => (s[k] ?? []).map((x) => (typeof x === 'string' ? `${s.screen}: ${x}` : { ...x, name: `${s.screen}: ${x.name}` })))
    await c.step('every button/link/input has a readable name (DOM + ariaSnapshot)', async () => {
      const u = [...all('unnamed'), ...all('emptyNameInAria')]
      check(u.length === 0, `${u.length} unnamed controls: ${brief(u)}`)
    })
    await c.step('images have alt text or are decorative; iframes have a title', async () => {
      const u = [...all('imgsWithoutAlt'), ...all('roleImgNoName'), ...all('iframesNoTitle')]
      check(u.length === 0, `${u.length} images/frames without a text alternative: ${brief(u)}`)
    })
    await c.step('focus ring visible on every Tab stop', async () => {
      const bad = [...K.st.noRing.entries()]
      check(bad.length === 0, `${bad.length} controls show no focus change: ${bad.slice(0, 8).map(([n, k]) => `${n} (x${k})`).join('; ')}`)
    })
    if (width < 600) {
      await c.step('tap targets are at least 40x40 px', async () => {
        const small = all('tapTargetsUnder40')
        writeFileSync(`${c.dir}/tap-targets-under-40.json`, JSON.stringify(small, null, 1))
        check(small.length === 0, `${small.length} controls under 40x40: ${brief(small)}`)
      })
    }
    await c.problems('no page errors / bad HTTP', probs)
    await annie?.ctx.close()
    await ctx.close()
  }
}
await browser.close()
rep.finish()
