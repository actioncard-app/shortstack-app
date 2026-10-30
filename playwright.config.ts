import { defineConfig, devices } from '@playwright/test'
const base = process.env.BASE_URL || 'http://localhost:4173/'
export default defineConfig({
  testDir: 'e2e', timeout: 120_000, workers: 1, retries: 0, reporter: [['list']],
  use: {
    baseURL: base, headless: true, screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
    permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
  },
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite preview --port 4173 --strictPort', url: base, reuseExistingServer: true },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
})
