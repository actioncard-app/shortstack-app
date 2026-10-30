import { test, expect, type Page, type Browser } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Passwords for seeded accounts come from .env.test (git-ignored), never from the repo.
const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, '..', '.env.test'), 'utf8').trim().split('\n').map(l => l.split('=')))
const SHOTS = path.join(import.meta.dirname, '..', 'screenshots', process.env.BASE_URL ? 'live' : '')
const run = Date.now().toString(36)
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${test.info().project.name}-${name}.png`) })

test.describe.configure({ mode: 'serial' })
let A = { email: '', user: '' }, B = { email: '', user: '' }
const PW = 'e2e-Pass-' + run
let clipId = ''

async function signup(page: Page, who: { email: string; user: string }) {
  await page.goto('./#/')
  await page.getByText('New here? Create an account').click()
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(PW)
  await page.getByLabel('Username').fill(who.user)
  await page.getByLabel('Display name').fill('E2E ' + who.user)
  await page.getByLabel(/I agree/).check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toContainText('18 or older') // blocked without the 18+ box
  await page.getByLabel("I'm 18 or older").check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByTestId('feed')).toBeVisible({ timeout: 20000 })
}
// Wait for the single-clip view itself (its back link), not just a matching first clip in the old feed.
async function openClip(page: Page, id: string) {
  await page.goto(`./#/v/${id}`)
  await expect(page.getByRole('link', { name: 'Back to feed' })).toBeVisible()
  await expect(page.getByTestId('clip').first()).toHaveAttribute('data-id', id)
}
async function login(page: Page, email: string, pw: string) {
  await page.goto('./#/')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(pw)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('For You')).toBeVisible({ timeout: 20000 })
}
async function fresh(browser: Browser, opts = test.info().project.use) {
  const ctx = await browser.newContext({ ...opts })
  return { ctx, page: await ctx.newPage() }
}

test('sign up (18+ gate) and upload a clip', async ({ page }) => {
  const p = test.info().project.name.slice(0, 3)
  A = { email: `e2e-a-${p}-${run}@shortstack.test`, user: `e2e_a_${p}_${run}` }
  B = { email: `e2e-b-${p}-${run}@shortstack.test`, user: `e2e_b_${p}_${run}` }
  await page.goto('./#/'); await shot(page, '01-login')
  await signup(page, A)
  await shot(page, '02-feed')
  await page.getByRole('link', { name: 'Create' }).click()
  await page.getByTestId('file').setInputFiles(path.join(import.meta.dirname, 'e2e-sample.webm'))
  await page.getByLabel('Caption').fill('E2E test clip, safe to delete #e2etest')
  await shot(page, '03-upload')
  await page.getByRole('button', { name: 'Post' }).click()
  await page.waitForURL(/#\/v\//, { timeout: 60000 })
  clipId = page.url().split('#/v/')[1]
  await expect(page.getByTestId('clip').first()).toBeVisible()
  await expect.poll(() => page.locator('video').first().evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15000 }).toBeGreaterThan(0)
})

test('record with (fake) camera', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit has no fake-camera flag; recording is covered on Chromium only')
  await login(page, A.email, PW)
  await page.getByRole('link', { name: 'Create' }).click()
  await page.getByRole('button', { name: /Record with camera/ }).click()
  await page.getByRole('button', { name: /Start recording/ }).click()
  await page.waitForTimeout(3500)
  await shot(page, '04-recording')
  await page.getByRole('button', { name: /Stop/ }).click()
  await page.getByLabel('Caption').fill('E2E camera recording #e2etest')
  await page.getByRole('button', { name: 'Post' }).click()
  await page.waitForURL(/#\/v\//, { timeout: 60000 })
  await expect(page.getByTestId('clip').first()).toBeVisible()
})

test('feed swipe autoplays next clip; like + comment persist', async ({ page }) => {
  await login(page, A.email, PW)
  const feed = page.getByTestId('feed')
  await expect(page.getByTestId('clip').nth(2)).toBeAttached()
  const clips = page.getByTestId('clip')
  await swipe(page, 1)
  expect(await feed.evaluate(e => e.scrollTop)).toBeGreaterThan(300)
  const second = clips.nth(1).locator('video')
  await expect.poll(() => second.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 10000 }).toBe(true)
  expect(await clips.nth(0).locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
  await shot(page, '05-feed-swiped')

  await openClip(page, clipId)
  const likeBtn = page.getByRole('button', { name: 'Like' }).first()
  await expect(page.getByTestId('like-count').first()).toHaveText('0')
  await likeBtn.click(); await expect(page.getByTestId('like-count').first()).toHaveText('1')
  await page.waitForTimeout(800); await page.reload()
  await expect(page.getByRole('button', { name: 'Like' }).first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('like-count').first()).toHaveText('1')

  await page.getByRole('button', { name: 'Comments' }).first().click()
  await page.getByLabel('Add comment').fill('First! (e2e)')
  await page.getByRole('button', { name: 'Post' }).click()
  await expect(page.getByTestId('comment')).toContainText('First! (e2e)')
  await shot(page, '06-comments')
})

test('follow creator, Following tab, profile + shop placeholder', async ({ page }) => {
  await login(page, A.email, PW)
  await page.goto('./#/u/ss_demo')
  const before = Number(await page.getByTestId('followers').innerText())
  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.getByTestId('followers')).toHaveText(String(before + 1))
  await expect(page.getByTestId('shop')).toContainText('No real money')
  await shot(page, '07-profile')
  await page.goto('./#/'); await page.getByRole('button', { name: 'Following' }).click()
  await expect(page.getByTestId('clip').first()).toContainText('@ss_demo')
  await page.goto('./#/u/ss_demo'); await page.getByRole('button', { name: 'Unfollow' }).click()
  await expect(page.getByTestId('followers')).toHaveText(String(before))
  await page.goto('./#/edit')
  await page.getByLabel('Bio').fill('E2E bio'); await page.getByRole('button', { name: 'Appalachia' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('E2E bio')).toBeVisible(); await expect(page.locator('.chip', { hasText: 'Appalachia' })).toBeVisible()
})

test('share link opens the single clip when logged out', async ({ browser }) => {
  const { ctx, page } = await fresh(browser)
  await openClip(page, clipId)
  await expect(page.getByText('E2E test clip').first()).toBeVisible()
  await shot(page, '08-share-link'); await ctx.close()
})

test('report -> admin takedown -> creator notice -> appeal -> restore', async ({ browser }) => {
  // B reports A's clip
  const b = await fresh(browser); await signup(b.page, B)
  await openClip(b.page, clipId)
  await b.page.getByRole('button', { name: 'More' }).first().click()
  await b.page.getByText('Report this clip').click()
  await b.page.getByLabel('No scams, spam or fake giveaways').check()
  await b.page.getByLabel('Report details').fill('e2e: pretend this is a fake giveaway')
  await shot(b.page, '09-report')
  await b.page.getByRole('button', { name: 'Send report' }).click()
  await expect(b.page.getByText('A person will review')).toBeVisible()

  // admin takes it down
  const ad = await fresh(browser); await login(ad.page, 'admin@shortstack.test', env.ADMIN_PW)
  await ad.page.goto('./#/admin')
  const item = ad.page.getByTestId('report-item').filter({ hasText: 'E2E test clip' })
  await expect(item).toBeVisible()
  await item.getByLabel('Reason for creator').fill('The clip promises free money for sharing, which is a common scam pattern.')
  await shot(ad.page, '10-admin')
  await item.getByRole('button', { name: 'Take down' }).click()
  await expect(ad.page.getByText('Creator was notified')).toBeVisible()
  // hidden from others
  await b.page.goto(`./#/v/${clipId}`); await b.page.reload(); await expect(b.page.getByText("isn't available")).toBeVisible()

  // creator sees notice naming clip, rule, reason; appeals
  const a = await fresh(browser); await login(a.page, A.email, PW)
  await a.page.goto('./#/notices')
  const n = a.page.getByTestId('notice').first()
  await expect(n).toContainText('E2E test clip'); await expect(n).toContainText('No scams, spam or fake giveaways'); await expect(n).toContainText('free money')
  await n.getByRole('button', { name: 'Appeal' }).click()
  await a.page.getByLabel('Appeal reason').fill('It is a test pattern, no giveaway.')
  await a.page.getByRole('button', { name: 'Send appeal' }).click()
  await expect(n).toContainText('waiting for review')
  await shot(a.page, '11-notice-appeal')

  // admin restores
  await ad.page.reload()
  const ap = ad.page.getByTestId('appeal-item').filter({ hasText: 'E2E test clip' })
  ad.page.once('dialog', d => d.accept('Checked it, no giveaway. Restored.'))
  await ap.getByRole('button', { name: 'Restore clip' }).click()
  await expect(ad.page.getByText('Done')).toBeVisible()
  await a.page.reload(); await expect(a.page.getByTestId('notice').first()).toContainText('accepted')
  await b.page.goto(`./#/v/${clipId}`); await b.page.reload(); await expect(b.page.getByTestId('clip').first()).toHaveAttribute('data-id', clipId)

  // block: B blocks A, A's clips vanish from B's feed
  await b.page.getByRole('button', { name: 'More' }).first().click()
  await b.page.getByRole('button', { name: new RegExp('Block @' + A.user) }).first().click()
  await expect(b.page.getByText(/You won't see their clips/)).toBeVisible()
  await b.page.goto('./#/'); await b.page.reload(); await expect(b.page.getByTestId('clip').first()).toBeVisible()
  await expect(b.page.getByTestId('feed')).not.toContainText('@' + A.user)
  await shot(b.page, '12-feed-after-block')
  await Promise.all([a.ctx.close(), b.ctx.close(), ad.ctx.close()])
})

// Which clip is on screen right now (the one under the screen centre).
const visibleClip = (page: Page) => page.evaluate(() => {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
  return el?.closest('[data-testid=clip]')?.getAttribute('data-id') ?? null
})
// Chromium: real wheel input. Mobile WebKit in Playwright has no wheel or touch-swipe API, so there
// we scroll the feed container programmatically (proves the snap container scrolls, not the finger gesture).
async function swipe(page: Page, dir: 1 | -1) {
  const h = page.viewportSize()!.height
  if (test.info().project.name.includes('webkit')) await page.getByTestId('feed').evaluate((e, d) => e.scrollBy({ top: d, behavior: 'smooth' }), dir * h)
  else { await page.mouse.move(100, h / 2); await page.mouse.wheel(0, dir * h) }
  await page.waitForTimeout(1200)
}
async function checkSwipes(page: Page, id: string) {
  await expect(page.getByTestId('clip').first()).toHaveAttribute('data-id', id)
  await expect.poll(() => page.getByTestId('clip').count()).toBeGreaterThan(1)
  expect(await visibleClip(page)).toBe(id)
  await swipe(page, 1)
  const next = await visibleClip(page)
  expect(next).not.toBeNull(); expect(next).not.toBe(id)
  await swipe(page, -1)
  expect(await visibleClip(page)).toBe(id)
}
test('single clip and share link keep swiping up/down', async ({ page, browser }) => {
  await login(page, A.email, PW)
  const id = await page.getByTestId('clip').nth(2).getAttribute('data-id')
  await openClip(page, id!)
  await checkSwipes(page, id!)
  await shot(page, '13-single-clip-swipe')
  const { ctx, page: anon } = await fresh(browser)
  await anon.goto(`./#/v/${id}`)
  await checkSwipes(anon, id!)
  await ctx.close()
})

test('discover: communities, hashtags, tab bar; double-tap likes', async ({ page }) => {
  await login(page, A.email, PW)
  for (const t of ['Home', 'Discover', 'Inbox', 'Profile']) await expect(page.locator('nav').getByRole('link', { name: t })).toBeVisible()
  await page.locator('nav').getByRole('link', { name: 'Discover' }).click()
  await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible()
  await page.getByRole('link', { name: /Appalachia/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Appalachia' })).toBeVisible()
  await expect(page.locator('a.cell').first()).toBeVisible()
  await page.goto('./#/discover/tag/travel'); await expect(page.getByRole('heading', { name: '#travel' })).toBeVisible()
  await expect(page.locator('a.cell').first()).toBeVisible()
  // double-tap the open clip to like it
  await page.locator('a.cell').first().click()
  await expect(page.getByRole('link', { name: 'Back to feed' })).toBeVisible()
  const first = page.getByTestId('clip').first()
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(800)
  const before = Number(await first.getByTestId('like-count').innerText())
  const liked = await first.getByRole('button', { name: 'Like' }).getAttribute('aria-pressed')
  if (liked === 'true') { await first.getByRole('button', { name: 'Like' }).click(); await expect(first.getByTestId('like-count')).toHaveText(String(before - 1)) }
  const base = Number(await first.getByTestId('like-count').innerText())
  await first.locator('.tapzone').dblclick({ position: { x: 150, y: 300 } })
  await expect(first.getByRole('button', { name: 'Like' })).toHaveAttribute('aria-pressed', 'true')
  await expect(first.getByTestId('like-count')).toHaveText(String(base + 1))
  await first.getByRole('button', { name: 'Like' }).click() // undo, keep demo data clean
  await expect(first.getByTestId('like-count')).toHaveText(String(base))
})
