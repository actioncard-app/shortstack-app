// Screenshot capture only (run with SHOT_DIR=before|after). Not part of the pass/fail suite.
import { test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const DIR = process.env.SHOT_DIR
test.skip(!DIR, 'set SHOT_DIR to capture')
const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, '..', '.env.test'), 'utf8').trim().split('\n').map(l => l.split('=')))
const out = (n: string) => path.join(import.meta.dirname, '..', 'screenshots', DIR!, `${n}.png`)
async function login(page: Page, email: string, pw: string) {
  await page.goto('./#/'); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(pw)
  await page.getByRole('button', { name: 'Log in' }).click(); await page.waitForTimeout(3500)
}
test('capture', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('iphone'))
  await page.goto('./#/'); await page.waitForTimeout(1500); await page.screenshot({ path: out('login') })
  await login(page, 'tester@shortstack.test', env.TESTER_PW); await page.screenshot({ path: out('feed') })
  const id = await page.locator('[data-id]').first().getAttribute('data-id')
  await page.goto(`./#/v/${id}`); await page.waitForTimeout(2500); await page.screenshot({ path: out('single-clip') })
  await page.goto('./#/u/ss_demo'); await page.waitForTimeout(2500); await page.screenshot({ path: out('profile') })
  await page.goto('./#/new'); await page.waitForTimeout(1500); await page.screenshot({ path: out('upload') })
  await page.goto('./#/notices'); await page.waitForTimeout(2000); await page.screenshot({ path: out('notices') })
  await page.evaluate(() => localStorage.clear()); await page.goto('./#/'); await page.reload()
  await login(page, 'admin@shortstack.test', env.ADMIN_PW); await page.goto('./#/admin'); await page.waitForTimeout(2500); await page.screenshot({ path: out('admin') })
})
